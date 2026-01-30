import { z } from "zod";
import { getSessionData, ScopedLogger } from "../logging/SimpleLogger";
import { callGemini } from "../modelAccess/gemini";
import type { NotionWebhookEvent } from "../types/webhook-events";
import {
  addPageComment,
  fetchDatabaseDataSource,
  fetchPage,
  getNotionClient,
  simplifyDataSourceSchema,
  simplifyPageProperties,
  updatePageProperties,
} from "../utilities/notionClient";
import {
  extractDatabaseIdFromPayload,
  extractPageIdFromPayload,
} from "../utilities/notionUtils";

// ============================================================================
// Zod Schemas for Gemini Structured Outputs
// ============================================================================

/**
 * Schema for a Place property value (location with coordinates)
 */
const PlaceValueSchema = z.object({
  lat: z.number().describe("Latitude coordinate"),
  lon: z.number().describe("Longitude coordinate"),
  name: z.string().nullable().describe("Name of the place"),
  address: z.string().nullable().describe("Full address of the place"),
  google_place_id: z
    .string()
    .nullable()
    .optional()
    .describe("Google Place ID for the location"),
});

/**
 * Schema for a single property value filled by Gemini
 * Using array of objects instead of record for Gemini compatibility
 */
const FilledPropertySchema = z.object({
  propertyName: z.string().describe("The name of the property being filled"),
  value: z
    .union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.string()),
      z.null(),
      PlaceValueSchema,
    ])
    .describe("The researched value for this property"),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe("Confidence level for this property value"),
});

/**
 * Schema for property values to be filled by Gemini
 * Uses array of objects instead of z.record() for Gemini compatibility
 */
const PropertyValuesSchema = z.object({
  filledProperties: z
    .array(FilledPropertySchema)
    .describe("Array of property names with their researched values"),
  sources: z.array(z.string()).describe("URLs of sources used for research"),
  notes: z
    .string()
    .optional()
    .describe("Additional notes or caveats about the research"),
});

/**
 * Schema for surroundings research
 */
const SurroundingsSchema = z.object({
  nearbyParks: z
    .array(
      z.object({
        name: z.string().describe("Official name of the park"),
        google_place_id: z
          .string()
          .nullable()
          .describe("Google Place ID for verification"),
        distanceMeters: z
          .number()
          .describe("Walking distance in meters from property"),
        walkTimeMinutes: z
          .number()
          .describe("Walking time in minutes (calculate as distance/80)"),
        features: z
          .array(z.string())
          .optional()
          .describe("e.g., playground, sports fields, dog park"),
      }),
    )
    .describe(
      "Parks within 10 minute walk, SORTED by walking time (shortest first)",
    ),

  publicTransit: z
    .array(
      z.object({
        name: z.string().describe("Official stop/station name"),
        google_place_id: z
          .string()
          .nullable()
          .describe("Google Place ID for verification"),
        type: z.enum([
          "bus",
          "skytrain",
          "seabus",
          "westcoastexpress",
          "other",
        ]),
        distanceMeters: z
          .number()
          .describe("Walking distance in meters from property"),
        walkTimeMinutes: z.number(),
        routes: z
          .array(z.string())
          .optional()
          .describe("Bus routes or train lines available"),
      }),
    )
    .describe(
      "Public transit options within 15 minute walk, SORTED by walking time (shortest first)",
    ),

  transitTimes: z
    .object({
      toDowntown: z.object({
        transitTimeMinutes: z
          .number()
          .describe(
            "Exact transit time in minutes from Google Maps Directions",
          ),
        description: z
          .string()
          .describe(
            "Route description from Google Maps (e.g., 'Bus 99 to Commercial-Broadway, then SkyTrain')",
          ),
        googleMapsUrl: z
          .string()
          .nullable()
          .optional()
          .describe("Google Maps directions URL for verification"),
      }),
      toUBC: z.object({
        transitTimeMinutes: z
          .number()
          .describe("Exact transit time from Google Maps"),
        description: z.string().describe("Route description from Google Maps"),
        googleMapsUrl: z.string().nullable().optional(),
      }),
      toYVR: z.object({
        transitTimeMinutes: z
          .number()
          .describe("Exact transit time from Google Maps"),
        description: z.string().describe("Route description from Google Maps"),
        googleMapsUrl: z.string().nullable().optional(),
      }),
      toOakridgePark: z.object({
        transitTimeMinutes: z
          .number()
          .describe("Exact transit time from Google Maps"),
        description: z.string().describe("Route description from Google Maps"),
        googleMapsUrl: z.string().nullable().optional(),
      }),
    })
    .describe("Public transit times to key destinations"),

  sources: z.array(z.string()).describe("URLs of sources used for research"),
});

type PropertyValues = z.infer<typeof PropertyValuesSchema>;
type Surroundings = z.infer<typeof SurroundingsSchema>;

// ============================================================================
// Executor Implementation
// ============================================================================

/**
 * Executor for Vancouver House 2 database
 * - Fetches page content and database schema
 * - Uses Gemini to research and fill missing property values
 * - Uses Gemini to research surroundings (parks, transit, distances)
 * - Writes results back to Notion
 *
 * @param payload - The webhook payload containing the page information
 * @returns True if successful, false otherwise
 */
export async function vancouverHouse2Executor(
  payload: NotionWebhookEvent,
): Promise<boolean> {
  const logger = new ScopedLogger("vancouverHouse2Executor");
  const sessionData = getSessionData();
  const sessionId = sessionData?.sessionId ?? "unknown";

  // Extract page creator from payload authors (first person type)
  const pageCreatorId = payload.authors.find((a) => a.type === "person")?.id;

  try {
    // Extract page ID from payload
    const pageId = extractPageIdFromPayload(payload);
    if (!pageId) {
      logger.log("error", "No page ID found in payload");
      logger.end();
      return false;
    }

    logger.log("info", "Processing page", { pageId });

    // Add initial comment to indicate processing has started
    await addPageComment(
      pageId,
      `Looking into this... (sessionId: ${sessionId})`,
    );

    // Fetch page content
    const page = await fetchPage(pageId);
    if (!page) {
      logger.log("error", "Failed to fetch page");
      logger.log("debug", "Full payload", { payload });
      logger.end();
      return false;
    }

    logger.log("debug", "Page content", { page });

    // Get parent database ID from payload
    const databaseId = extractDatabaseIdFromPayload(payload);
    if (!databaseId) {
      logger.log("error", "Page is not in a database");
      logger.end();
      return false;
    }

    // Fetch data source schema (contains the database column definitions)
    const dataSource = await fetchDatabaseDataSource(databaseId);
    if (!dataSource) {
      logger.log("error", "Failed to fetch data source schema");
      logger.end();
      return false;
    }

    // Simplify for AI consumption
    const schema = simplifyDataSourceSchema(dataSource);
    const currentValues = simplifyPageProperties(page);
    const propertyAddress = extractAddress(currentValues);

    logger.log("debug", "Database schema", { schema });
    logger.log("debug", "Current values", { currentValues });
    logger.log("info", "Property address", { propertyAddress });

    if (!propertyAddress) {
      logger.log(
        "warn",
        "No address found in page properties, skipping research",
      );
      // Notify that we're skipping due to missing address
      await addPageComment(
        pageId,
        `Skipped: No address found in page properties. sessionId: ${sessionId}`,
        pageCreatorId ? [pageCreatorId] : undefined,
      );
      logger.end();
      return true; // Not an error, just nothing to research
    }

    // Run both Gemini calls in parallel using allSettled to handle individual failures
    logger.log("info", "Starting parallel Gemini research...");
    const [propertySettled, surroundingsSettled] = await Promise.allSettled([
      researchPropertyValues(schema, currentValues, propertyAddress),
      researchSurroundings(propertyAddress),
    ]);

    // Handle property research result
    const propertyResult =
      propertySettled.status === "fulfilled" ? propertySettled.value : null;
    if (propertySettled.status === "rejected") {
      logger.log("error", "Property research failed", {
        reason: String(propertySettled.reason),
      });
    } else {
      logger.log("info", "Property research result", {
        result: propertyResult,
      });
    }

    // Handle surroundings research result
    const surroundingsResult =
      surroundingsSettled.status === "fulfilled"
        ? surroundingsSettled.value
        : null;
    if (surroundingsSettled.status === "rejected") {
      logger.log("error", "Surroundings research failed", {
        reason: String(surroundingsSettled.reason),
      });
    } else {
      logger.log("info", "Surroundings research result", {
        result: surroundingsResult,
      });
    }

    // Write results back to Notion
    if (propertyResult) {
      await updatePageProperties(pageId, propertyResult, schema);
    }

    if (surroundingsResult) {
      await appendSurroundingsTable(pageId, surroundingsResult);
    }

    // Add completion comment and tag the creator
    await addPageComment(
      pageId,
      `Done processing! sessionId: ${sessionId}`,
      pageCreatorId ? [pageCreatorId] : undefined,
    );

    logger.log("info", "Successfully processed page");
    logger.end();
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.log("error", "Error processing", { error: errorMessage });

    // Try to add error comment if we have a pageId
    const pageId = extractPageIdFromPayload(payload);
    if (pageId) {
      await addPageComment(
        pageId,
        `Error during processing: ${errorMessage}. sessionId: ${sessionId}`,
        pageCreatorId ? [pageCreatorId] : undefined,
      );
    }

    logger.end();
    return false;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extracts the property address from page properties
 * Looks for common property name patterns
 */
export function extractAddress(
  properties: Record<string, unknown>,
): string | null {
  const addressKeys = [
    "Address",
    "address",
    "Property Address",
    "Location",
    "location",
  ];

  for (const key of addressKeys) {
    const value = properties[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  // Also check for title property which might contain the address
  const title =
    properties["Name"] ||
    properties["name"] ||
    properties["Title"] ||
    properties["title"];
  if (typeof title === "string" && title.trim().length > 0) {
    return title.trim();
  }

  return null;
}

/**
 * Research and fill missing property values using Gemini
 */
export async function researchPropertyValues(
  schema: Record<string, { type: string; name: string; options?: string[] }>,
  currentValues: Record<string, unknown>,
  address: string,
): Promise<PropertyValues | null> {
  const logger = new ScopedLogger("researchPropertyValues");

  // Identify missing properties (null, empty string, or empty array)
  // Skip button properties - they are interactive elements, not data to fill
  const missingProperties: string[] = [];
  for (const [key, value] of Object.entries(currentValues)) {
    // Skip button properties
    if (schema[key]?.type === "button") {
      continue;
    }
    if (
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    ) {
      missingProperties.push(key);
    }
  }

  if (missingProperties.length === 0) {
    logger.log("info", "No missing properties to fill");
    logger.end();
    return null;
  }

  logger.log("info", "Missing properties", { missingProperties });

  // Build the prompt
  const prompt = buildPropertyResearchPrompt(
    schema,
    currentValues,
    address,
    missingProperties,
  );

  try {
    const result = await callGemini({
      prompt,
      schema: PropertyValuesSchema,
      model: "gemini-2.5-pro", // Use pro for better research
      useSearch: true,
      useMaps: true,
    });

    // Consume the stream and get the final result
    const text = await result.text;
    logger.log("debug", "Gemini response text", { text });

    // Get the structured output
    const output = await result.output;
    logger.end();
    return output as PropertyValues;
  } catch (error) {
    logger.log("error", "Error calling Gemini", {
      error: error instanceof Error ? error.message : String(error),
    });
    logger.end();
    return null;
  }
}

/**
 * Research surroundings using Gemini
 */
export async function researchSurroundings(
  address: string,
): Promise<Surroundings | null> {
  const logger = new ScopedLogger("researchSurroundings");

  const prompt = buildSurroundingsResearchPrompt(address);

  try {
    const result = await callGemini({
      prompt,
      schema: SurroundingsSchema,
      model: "gemini-2.5-pro",
      useSearch: true,
      useMaps: true,
    });

    // Consume the stream and get the final result
    const text = await result.text;
    logger.log("debug", "Gemini response text", { text });

    // Get the structured output
    const output = await result.output;
    logger.end();
    return output as Surroundings;
  } catch (error) {
    logger.log("error", "Error calling Gemini", {
      error: error instanceof Error ? error.message : String(error),
    });
    logger.end();
    return null;
  }
}

/**
 * Build the prompt for property research
 */
export function buildPropertyResearchPrompt(
  schema: Record<string, { type: string; name: string; options?: string[] }>,
  currentValues: Record<string, unknown>,
  address: string,
  missingProperties: string[],
): string {
  return `You are an expert Vancouver real estate researcher with access to Google Search and Google Maps.

PROPERTY ADDRESS: ${address}

YOUR TASK: Research and fill in the missing property values for this real estate listing.

DATABASE SCHEMA (property definitions):
${JSON.stringify(schema, null, 2)}

CURRENT VALUES (already filled):
${JSON.stringify(currentValues, null, 2)}

MISSING PROPERTIES TO RESEARCH:
${missingProperties.join(", ")}

RESEARCH INSTRUCTIONS:
1. Use Google Search extensively to find information about this property
2. Prioritize these Vancouver real estate sources:
   - rew.ca
   - zealty.ca
   - bccondosandhomes.com
   - realtor.ca
   - Strata reports and building information
3. For select/multi-select properties, ONLY use values from the provided options list
4. For number properties, extract numerical values (price, square footage, year built, etc.)
5. For text properties, provide concise, accurate information
6. Include confidence levels for each property based on source reliability
7. List all sources used

PLACE PROPERTY INSTRUCTIONS:
For properties of type "place", you MUST return a place object with:
- lat: The latitude coordinate (number)
- lon: The longitude coordinate (number)
- name: The name of the place (string or null)
- address: The full address (string or null)
- google_place_id: The Google Place ID if available (string or null)

Use Google Maps to get accurate coordinates and the google_place_id for the property address.
Example place value:
{
  "lat": 49.2827,
  "lon": -123.1207,
  "name": "Property Name",
  "address": "123 Main St, Vancouver, BC V6B 1A1",
  "google_place_id": "ChIJN1t_tDeuEmsRUsoyG83frY4"
}

IMPORTANT:
- Be thorough - search multiple sources to verify information
- If you cannot find reliable information, set the value to null
- For strata/building information, look for strata council minutes, depreciation reports
- Check for recent sales history, price changes, days on market
- For place properties, always use Google Maps to get coordinates and google_place_id

Return the filled properties in the structured format specified.`;
}

/**
 * Build the prompt for surroundings research
 */
export function buildSurroundingsResearchPrompt(address: string): string {
  return `You are an expert Vancouver location analyst with access to Google Search and Google Maps.

PROPERTY ADDRESS: ${address}

YOUR TASK: Research the surroundings of this property using Google Maps to find ACCURATE nearby places.

== CRITICAL: USE GOOGLE MAPS NEARBY SEARCH ==
You MUST use Google Maps to search for nearby places. Do NOT guess or estimate distances.
For each place found, you MUST provide:
- The EXACT distance in meters from Google Maps
- The google_place_id from Google Maps (if available)
- Walking time calculated as: distanceMeters / 80 (average walking speed is 80m/min)

== 1. NEARBY PARKS (within 800m / 10 minute walk) ==
Search for: "parks near ${address}"
- Use Google Maps to find the CLOSEST parks first
- Include official park name, exact distance, and any amenities
- SORT results by walking time (shortest first)
- Only include parks within 800m walking distance

== 2. PUBLIC TRANSIT (within 1200m / 15 minute walk) ==
Search for: "transit stops near ${address}" and "skytrain stations near ${address}"
- Find bus stops, SkyTrain stations, SeaBus terminals
- Include official stop names and route numbers
- SORT results by walking time (shortest first)
- Prioritize SkyTrain stations and major bus routes (B-Lines, RapidBus)

== 3. TRANSIT TIMES TO KEY DESTINATIONS (CRITICAL - USE GOOGLE MAPS DIRECTIONS) ==

You MUST use Google Maps Directions API (transit mode) to get EXACT travel times.
DO NOT estimate or guess travel times. Look up each route on Google Maps.

For EACH destination, perform a Google Maps directions search:
- Origin: "${address}"
- Mode: Transit (public transportation)
- Departure: Weekday 8:00 AM

DESTINATIONS TO LOOK UP:
1. toDowntown: "${address}" to "Waterfront Station, Vancouver"
2. toUBC: "${address}" to "University of British Columbia, Vancouver"
3. toYVR: "${address}" to "Vancouver International Airport (YVR)"
4. toOakridgePark: "${address}" to "Oakridge Park, Vancouver" (41st Ave and Cambie St)

For each route, record:
- transitTimeMinutes: The EXACT time shown by Google Maps (not estimated)
- description: The route Google Maps suggests (e.g., "Walk to X station, take Y line to Z")
- googleMapsUrl: The Google Maps directions URL if available

== DATA QUALITY REQUIREMENTS ==
1. ALL distances must come from Google Maps - do NOT estimate
2. ALL transit times must come from Google Maps Directions - do NOT guess
3. Walking times = distanceMeters / 80 (rounded to nearest minute)
4. Include google_place_id when available for verification
5. Sort parks and transit results by walking time (shortest first)
6. Do not include places you cannot verify on Google Maps
7. If a park or transit stop cannot be found on Google Maps, do not include it

== VERIFICATION ==
Before returning any travel time, confirm you looked it up on Google Maps.
If you cannot look up a travel time on Google Maps, use 0 for the time and note "Unable to verify" in the description.

Return the surroundings information in the structured format specified.`;
}

/**
 * Append surroundings information as tables to the page body
 */
async function appendSurroundingsTable(
  pageId: string,
  surroundings: Surroundings,
): Promise<void> {
  const logger = new ScopedLogger("appendSurroundingsTable");
  const client = getNotionClient();

  if (!client) {
    logger.log("error", "Notion client not available");
    logger.end();
    return;
  }

  try {
    const blocks: Parameters<
      typeof client.blocks.children.append
    >[0]["children"] = [];

    // Header for surroundings section
    blocks.push({
      type: "heading_2",
      heading_2: {
        rich_text: [
          { type: "text", text: { content: "📍 Location & Surroundings" } },
        ],
      },
    });

    // Nearby Parks Table
    if (surroundings.nearbyParks.length > 0) {
      blocks.push({
        type: "heading_3",
        heading_3: {
          rich_text: [
            {
              type: "text",
              text: { content: "🌳 Nearby Parks (10 min walk)" },
            },
          ],
        },
      });

      blocks.push({
        type: "table",
        table: {
          table_width: 4,
          has_column_header: true,
          has_row_header: false,
          children: [
            {
              type: "table_row",
              table_row: {
                cells: [
                  [{ type: "text", text: { content: "Park Name" } }],
                  [{ type: "text", text: { content: "Distance" } }],
                  [{ type: "text", text: { content: "Walk Time" } }],
                  [{ type: "text", text: { content: "Features" } }],
                ],
              },
            },
            ...surroundings.nearbyParks.map((park) => ({
              type: "table_row" as const,
              table_row: {
                cells: [
                  [{ type: "text" as const, text: { content: park.name } }],
                  [
                    {
                      type: "text" as const,
                      text: { content: `${park.distanceMeters}m` },
                    },
                  ],
                  [
                    {
                      type: "text" as const,
                      text: { content: `${park.walkTimeMinutes} min` },
                    },
                  ],
                  [
                    {
                      type: "text" as const,
                      text: { content: park.features?.join(", ") || "-" },
                    },
                  ],
                ],
              },
            })),
          ],
        },
      });
    }

    // Public Transit Table
    if (surroundings.publicTransit.length > 0) {
      blocks.push({
        type: "heading_3",
        heading_3: {
          rich_text: [
            {
              type: "text",
              text: { content: "🚌 Public Transit (15 min walk)" },
            },
          ],
        },
      });

      blocks.push({
        type: "table",
        table: {
          table_width: 5,
          has_column_header: true,
          has_row_header: false,
          children: [
            {
              type: "table_row",
              table_row: {
                cells: [
                  [{ type: "text", text: { content: "Stop/Station" } }],
                  [{ type: "text", text: { content: "Type" } }],
                  [{ type: "text", text: { content: "Distance" } }],
                  [{ type: "text", text: { content: "Walk Time" } }],
                  [{ type: "text", text: { content: "Routes" } }],
                ],
              },
            },
            ...surroundings.publicTransit.map((transit) => ({
              type: "table_row" as const,
              table_row: {
                cells: [
                  [{ type: "text" as const, text: { content: transit.name } }],
                  [{ type: "text" as const, text: { content: transit.type } }],
                  [
                    {
                      type: "text" as const,
                      text: { content: `${transit.distanceMeters}m` },
                    },
                  ],
                  [
                    {
                      type: "text" as const,
                      text: { content: `${transit.walkTimeMinutes} min` },
                    },
                  ],
                  [
                    {
                      type: "text" as const,
                      text: { content: transit.routes?.join(", ") || "-" },
                    },
                  ],
                ],
              },
            })),
          ],
        },
      });
    }

    // Transit Times Table
    blocks.push({
      type: "heading_3",
      heading_3: {
        rich_text: [
          {
            type: "text",
            text: { content: "🚇 Transit Times to Key Destinations" },
          },
        ],
      },
    });

    // Helper to create a transit time row with optional Google Maps link
    const createTransitRow = (
      destination: string,
      time: number,
      description: string,
      googleMapsUrl?: string | null,
    ) => ({
      type: "table_row" as const,
      table_row: {
        cells: [
          [{ type: "text" as const, text: { content: destination } }],
          [{ type: "text" as const, text: { content: `${time} min` } }],
          [{ type: "text" as const, text: { content: description } }],
          [
            googleMapsUrl
              ? {
                  type: "text" as const,
                  text: { content: "View Route", link: { url: googleMapsUrl } },
                }
              : { type: "text" as const, text: { content: "-" } },
          ],
        ],
      },
    });

    blocks.push({
      type: "table",
      table: {
        table_width: 4,
        has_column_header: true,
        has_row_header: false,
        children: [
          {
            type: "table_row",
            table_row: {
              cells: [
                [{ type: "text", text: { content: "Destination" } }],
                [{ type: "text", text: { content: "Transit Time" } }],
                [{ type: "text", text: { content: "Route" } }],
                [{ type: "text", text: { content: "Map" } }],
              ],
            },
          },
          createTransitRow(
            "Downtown Vancouver",
            surroundings.transitTimes.toDowntown.transitTimeMinutes,
            surroundings.transitTimes.toDowntown.description,
            surroundings.transitTimes.toDowntown.googleMapsUrl,
          ),
          createTransitRow(
            "UBC",
            surroundings.transitTimes.toUBC.transitTimeMinutes,
            surroundings.transitTimes.toUBC.description,
            surroundings.transitTimes.toUBC.googleMapsUrl,
          ),
          createTransitRow(
            "YVR Airport",
            surroundings.transitTimes.toYVR.transitTimeMinutes,
            surroundings.transitTimes.toYVR.description,
            surroundings.transitTimes.toYVR.googleMapsUrl,
          ),
          createTransitRow(
            "Oakridge Park",
            surroundings.transitTimes.toOakridgePark.transitTimeMinutes,
            surroundings.transitTimes.toOakridgePark.description,
            surroundings.transitTimes.toOakridgePark.googleMapsUrl,
          ),
        ],
      },
    });

    // Sources
    if (surroundings.sources.length > 0) {
      blocks.push({
        type: "paragraph",
        paragraph: {
          rich_text: [
            { type: "text", text: { content: "Sources: " } },
            ...surroundings.sources.slice(0, 5).map((source, i) => ({
              type: "text" as const,
              text: {
                content:
                  i === surroundings.sources.length - 1 || i === 4
                    ? source
                    : `${source}, `,
                link: { url: source },
              },
            })),
          ],
        },
      });
    }

    await client.blocks.children.append({
      block_id: pageId,
      children: blocks,
    });

    logger.log("info", "Appended surroundings tables to page");
    logger.end();
  } catch (error) {
    logger.log("error", "Error appending blocks", {
      error: error instanceof Error ? error.message : String(error),
    });
    logger.end();
  }
}
