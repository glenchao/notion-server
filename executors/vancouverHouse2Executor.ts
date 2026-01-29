import { z } from "zod";
import { callGemini } from "../modelAccess/gemini";
import type { NotionWebhookEvent } from "../types/webhook-events";
import {
  fetchDatabaseSchema,
  fetchPage,
  getNotionClient,
  simplifyDatabaseSchema,
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
 * Schema for property values to be filled by Gemini
 * This is intentionally flexible to accommodate any database schema
 */
const PropertyValuesSchema = z.object({
  filledProperties: z
    .record(
      z.string(),
      z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.array(z.string()),
        z.null(),
      ]),
    )
    .describe("Key-value pairs of property names to their researched values"),
  sources: z.array(z.string()).describe("URLs of sources used for research"),
  confidence: z
    .record(z.string(), z.enum(["high", "medium", "low"]))
    .describe("Confidence level for each filled property"),
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
  const LOG_PREFIX = "[vancouverHouse2Executor]";

  try {
    // Extract page ID from payload
    const pageId = extractPageIdFromPayload(payload);
    if (!pageId) {
      console.error(`${LOG_PREFIX} No page ID found in payload`);
      return false;
    }

    console.log(`${LOG_PREFIX} Processing page:`, pageId);

    // Fetch page content
    const page = await fetchPage(pageId);
    if (!page) {
      console.error(`${LOG_PREFIX} Failed to fetch page`);
      console.log(
        `${LOG_PREFIX} Full payload:`,
        JSON.stringify(payload, null, 2),
      );
      return false;
    }

    console.log(`${LOG_PREFIX} Page content:`, JSON.stringify(page, null, 2));

    // Get parent database ID from payload
    const databaseId = extractDatabaseIdFromPayload(payload);
    if (!databaseId) {
      console.error(`${LOG_PREFIX} Page is not in a database`);
      return false;
    }

    // Fetch database schema
    const database = await fetchDatabaseSchema(databaseId);
    if (!database) {
      console.error(`${LOG_PREFIX} Failed to fetch database schema`);
      return false;
    }

    // Simplify for AI consumption
    const schema = simplifyDatabaseSchema(database);
    const currentValues = simplifyPageProperties(page);
    const propertyAddress = extractAddress(currentValues);

    console.log(
      `${LOG_PREFIX} Database schema:`,
      JSON.stringify(schema, null, 2),
    );
    console.log(
      `${LOG_PREFIX} Current values:`,
      JSON.stringify(currentValues, null, 2),
    );
    console.log(`${LOG_PREFIX} Property address:`, propertyAddress);

    if (!propertyAddress) {
      console.warn(
        `${LOG_PREFIX} No address found in page properties, skipping research`,
      );
      return true; // Not an error, just nothing to research
    }

    // Run both Gemini calls in parallel using allSettled to handle individual failures
    console.log(`${LOG_PREFIX} Starting parallel Gemini research...`);
    const [propertySettled, surroundingsSettled] = await Promise.allSettled([
      researchPropertyValues(schema, currentValues, propertyAddress),
      researchSurroundings(propertyAddress),
    ]);

    // Handle property research result
    const propertyResult =
      propertySettled.status === "fulfilled" ? propertySettled.value : null;
    if (propertySettled.status === "rejected") {
      console.error(
        `${LOG_PREFIX} Property research failed:`,
        propertySettled.reason,
      );
    } else {
      console.log(
        `${LOG_PREFIX} Property research result:`,
        JSON.stringify(propertyResult, null, 2),
      );
    }

    // Handle surroundings research result
    const surroundingsResult =
      surroundingsSettled.status === "fulfilled"
        ? surroundingsSettled.value
        : null;
    if (surroundingsSettled.status === "rejected") {
      console.error(
        `${LOG_PREFIX} Surroundings research failed:`,
        surroundingsSettled.reason,
      );
    } else {
      console.log(
        `${LOG_PREFIX} Surroundings research result:`,
        JSON.stringify(surroundingsResult, null, 2),
      );
    }

    // Write results back to Notion
    if (propertyResult) {
      await updatePageProperties(pageId, propertyResult, schema);
    }

    if (surroundingsResult) {
      await appendSurroundingsTable(pageId, surroundingsResult);
    }

    console.log(`${LOG_PREFIX} Successfully processed page`);
    return true;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error processing:`, error);
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
function extractAddress(properties: Record<string, unknown>): string | null {
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
async function researchPropertyValues(
  schema: Record<string, { type: string; name: string; options?: string[] }>,
  currentValues: Record<string, unknown>,
  address: string,
): Promise<PropertyValues | null> {
  const LOG_PREFIX = "[researchPropertyValues]";

  // Identify missing properties (null, empty string, or empty array)
  const missingProperties: string[] = [];
  for (const [key, value] of Object.entries(currentValues)) {
    if (
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    ) {
      missingProperties.push(key);
    }
  }

  if (missingProperties.length === 0) {
    console.log(`${LOG_PREFIX} No missing properties to fill`);
    return null;
  }

  console.log(`${LOG_PREFIX} Missing properties:`, missingProperties);

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
    console.log(`${LOG_PREFIX} Gemini response text:`, text);

    // Get the structured output
    const output = await result.output;
    return output as PropertyValues;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error calling Gemini:`, error);
    return null;
  }
}

/**
 * Research surroundings using Gemini
 */
async function researchSurroundings(
  address: string,
): Promise<Surroundings | null> {
  const LOG_PREFIX = "[researchSurroundings]";

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
    console.log(`${LOG_PREFIX} Gemini response text:`, text);

    // Get the structured output
    const output = await result.output;
    return output as Surroundings;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error calling Gemini:`, error);
    return null;
  }
}

/**
 * Build the prompt for property research
 */
function buildPropertyResearchPrompt(
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
function buildSurroundingsResearchPrompt(address: string): string {
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
  const LOG_PREFIX = "[updatePageProperties]";
  const client = getNotionClient();

  if (!client) {
    console.error(`${LOG_PREFIX} Notion client not available`);
    return;
  }

  // Build the properties update object
  const properties: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(propertyValues.filledProperties)) {
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
        console.log(
          `${LOG_PREFIX} Skipping unsupported property type: ${propSchema.type}`,
        );
    }
  }

  if (Object.keys(properties).length === 0) {
    console.log(`${LOG_PREFIX} No properties to update`);
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
    console.log(
      `${LOG_PREFIX} Updated ${Object.keys(properties).length} properties`,
    );
  } catch (error) {
    console.error(`${LOG_PREFIX} Error updating page:`, error);
  }
}

/**
 * Append surroundings information as tables to the page body
 */
async function appendSurroundingsTable(
  pageId: string,
  surroundings: Surroundings,
): Promise<void> {
  const LOG_PREFIX = "[appendSurroundingsTable]";
  const client = getNotionClient();

  if (!client) {
    console.error(`${LOG_PREFIX} Notion client not available`);
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

    console.log(`${LOG_PREFIX} Appended surroundings tables to page`);
  } catch (error) {
    console.error(`${LOG_PREFIX} Error appending blocks:`, error);
  }
}
