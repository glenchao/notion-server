import { z } from "zod";
import { ScopedLogger } from "../logging/SimpleLogger";
import { callGemini } from "../modelAccess/gemini";
import type { NotionWebhookEvent } from "../types/webhook-events";
import {
  fetchDatabaseDataSource,
  fetchPage,
  getNotionClient,
  simplifyDataSourceSchema,
  simplifyPageProperties,
} from "../utilities/notionClient";
import {
  extractDatabaseIdFromPayload,
  extractPageIdFromPayload,
} from "../utilities/notionUtils";

// ============================================================================
// Zod Schemas for Gemini Structured Outputs
// ============================================================================

/**
 * Schema for a single property value filled by Gemini
 * Using array of objects instead of record for Gemini compatibility
 */
const FilledPropertySchema = z.object({
  propertyName: z.string().describe("The name of the property being filled"),
  value: z
    .union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()])
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
        name: z.string(),
        walkTimeMinutes: z.number(),
        distanceMeters: z.number().optional(),
        features: z
          .array(z.string())
          .optional()
          .describe("e.g., playground, sports fields, dog park"),
      }),
    )
    .describe("Parks within 10 minute walk"),

  publicTransit: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum([
          "bus",
          "skytrain",
          "seabus",
          "westcoastexpress",
          "other",
        ]),
        walkTimeMinutes: z.number(),
        routes: z
          .array(z.string())
          .optional()
          .describe("Bus routes or train lines available"),
      }),
    )
    .describe("Public transit options within 15 minute walk"),

  transitTimes: z
    .object({
      toDowntown: z.object({
        transitTimeMinutes: z.number(),
        description: z.string().describe("Brief description of the route"),
      }),
      toUBC: z.object({
        transitTimeMinutes: z.number(),
        description: z.string(),
      }),
      toYVR: z.object({
        transitTimeMinutes: z.number(),
        description: z.string(),
      }),
      toOakridgePark: z.object({
        transitTimeMinutes: z.number(),
        description: z.string(),
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

  try {
    // Extract page ID from payload
    const pageId = extractPageIdFromPayload(payload);
    if (!pageId) {
      logger.log("error", "No page ID found in payload");
      logger.end();
      return false;
    }

    logger.log("info", "Processing page", { pageId });

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

    logger.log("info", "Successfully processed page");
    logger.end();
    return true;
  } catch (error) {
    logger.log("error", "Error processing", {
      error: error instanceof Error ? error.message : String(error),
    });
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
export function extractAddress(properties: Record<string, unknown>): string | null {
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

IMPORTANT:
- Be thorough - search multiple sources to verify information
- If you cannot find reliable information, set the value to null
- For strata/building information, look for strata council minutes, depreciation reports
- Check for recent sales history, price changes, days on market

Return the filled properties in the structured format specified.`;
}

/**
 * Build the prompt for surroundings research
 */
export function buildSurroundingsResearchPrompt(address: string): string {
  return `You are an expert Vancouver location analyst with access to Google Search and Google Maps.

PROPERTY ADDRESS: ${address}

YOUR TASK: Research the surroundings of this property and provide detailed information about:

1. NEARBY PARKS (within 10 minute walk):
   - Find all parks within approximately 800m walking distance
   - Include park name, walking time, and any notable features (playground, sports fields, dog park, etc.)

2. PUBLIC TRANSIT OPTIONS (within 15 minute walk):
   - Find all bus stops, SkyTrain stations, SeaBus terminals within walking distance
   - Include the name, type, walking time, and available routes/lines

3. TRANSIT TIMES TO KEY DESTINATIONS (by public transit):
   - Vancouver Downtown (Waterfront Station as reference)
   - UBC (University of British Columbia campus)
   - YVR (Vancouver International Airport)
   - Oakridge Park (formerly Oakridge Centre/Mall at 41st and Cambie)

RESEARCH INSTRUCTIONS:
1. Use Google Maps to calculate accurate walking distances and transit times
2. Use Google Search to verify transit routes and schedules
3. For transit times, assume typical weekday morning travel (8-9 AM)
4. Include the transit route description (e.g., "Take 99 B-Line to Broadway-City Hall, transfer to Canada Line")
5. Be accurate with walking times - 80m ≈ 1 minute walking

Return the surroundings information in the structured format specified.`;
}

/**
 * Update page properties in Notion
 */
async function updatePageProperties(
  pageId: string,
  propertyValues: PropertyValues,
  schema: Record<string, { type: string; name: string; options?: string[] }>,
): Promise<void> {
  const logger = new ScopedLogger("updatePageProperties");
  const client = getNotionClient();

  if (!client) {
    logger.log("error", "Notion client not available");
    logger.end();
    return;
  }

  // Build the properties update object
  const properties: Record<string, unknown> = {};

  for (const filledProp of propertyValues.filledProperties) {
    const { propertyName: key, value } = filledProp;
    if (value === null) continue;

    const propSchema = schema[key];
    if (!propSchema) continue;

    // Convert value based on property type
    switch (propSchema.type) {
      case "rich_text":
        properties[key] = {
          rich_text: [{ type: "text", text: { content: String(value) } }],
        };
        break;
      case "number":
        if (typeof value === "number") {
          properties[key] = { number: value };
        }
        break;
      case "select":
        if (typeof value === "string") {
          properties[key] = { select: { name: value } };
        }
        break;
      case "multi_select":
        if (Array.isArray(value)) {
          properties[key] = {
            multi_select: value.map((v) => ({ name: String(v) })),
          };
        }
        break;
      case "checkbox":
        if (typeof value === "boolean") {
          properties[key] = { checkbox: value };
        }
        break;
      case "url":
        if (typeof value === "string") {
          properties[key] = { url: value };
        }
        break;
      // Skip read-only types
      case "title":
      case "formula":
      case "rollup":
      case "created_time":
      case "created_by":
      case "last_edited_time":
      case "last_edited_by":
        break;
      default:
        logger.log("debug", "Skipping unsupported property type", {
          propertyType: propSchema.type,
        });
    }
  }

  if (Object.keys(properties).length === 0) {
    logger.log("info", "No properties to update");
    logger.end();
    return;
  }

  try {
    await client.pages.update({
      page_id: pageId,
      // Cast to expected type - we've already validated the property types above
      properties: properties as Parameters<
        typeof client.pages.update
      >[0]["properties"],
    });
    logger.log("info", "Updated properties", {
      count: Object.keys(properties).length,
    });
    logger.end();
  } catch (error) {
    logger.log("error", "Error updating page", {
      error: error instanceof Error ? error.message : String(error),
    });
    logger.end();
  }
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
          table_width: 3,
          has_column_header: true,
          has_row_header: false,
          children: [
            {
              type: "table_row",
              table_row: {
                cells: [
                  [{ type: "text", text: { content: "Park Name" } }],
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
          table_width: 4,
          has_column_header: true,
          has_row_header: false,
          children: [
            {
              type: "table_row",
              table_row: {
                cells: [
                  [{ type: "text", text: { content: "Stop/Station" } }],
                  [{ type: "text", text: { content: "Type" } }],
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

    blocks.push({
      type: "table",
      table: {
        table_width: 3,
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
              ],
            },
          },
          {
            type: "table_row",
            table_row: {
              cells: [
                [{ type: "text", text: { content: "Downtown Vancouver" } }],
                [
                  {
                    type: "text",
                    text: {
                      content: `${surroundings.transitTimes.toDowntown.transitTimeMinutes} min`,
                    },
                  },
                ],
                [
                  {
                    type: "text",
                    text: {
                      content: surroundings.transitTimes.toDowntown.description,
                    },
                  },
                ],
              ],
            },
          },
          {
            type: "table_row",
            table_row: {
              cells: [
                [{ type: "text", text: { content: "UBC" } }],
                [
                  {
                    type: "text",
                    text: {
                      content: `${surroundings.transitTimes.toUBC.transitTimeMinutes} min`,
                    },
                  },
                ],
                [
                  {
                    type: "text",
                    text: {
                      content: surroundings.transitTimes.toUBC.description,
                    },
                  },
                ],
              ],
            },
          },
          {
            type: "table_row",
            table_row: {
              cells: [
                [{ type: "text", text: { content: "YVR Airport" } }],
                [
                  {
                    type: "text",
                    text: {
                      content: `${surroundings.transitTimes.toYVR.transitTimeMinutes} min`,
                    },
                  },
                ],
                [
                  {
                    type: "text",
                    text: {
                      content: surroundings.transitTimes.toYVR.description,
                    },
                  },
                ],
              ],
            },
          },
          {
            type: "table_row",
            table_row: {
              cells: [
                [{ type: "text", text: { content: "Oakridge Park" } }],
                [
                  {
                    type: "text",
                    text: {
                      content: `${surroundings.transitTimes.toOakridgePark.transitTimeMinutes} min`,
                    },
                  },
                ],
                [
                  {
                    type: "text",
                    text: {
                      content:
                        surroundings.transitTimes.toOakridgePark.description,
                    },
                  },
                ],
              ],
            },
          },
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
