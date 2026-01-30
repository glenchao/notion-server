import { Client } from "@notionhq/client";
import type {
  DatabaseObjectResponse,
  GetDataSourceResponse,
  PageObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { ScopedLogger } from "../logging/SimpleLogger";

// ============================================================================
// Types for Page Property Updates
// ============================================================================

/**
 * Represents a place value with coordinates for Notion's place property type
 */
export interface PlaceValue {
  lat: number;
  lon: number;
  name?: string | null;
  address?: string | null;
  google_place_id?: string | null;
}

/**
 * Represents a single property to be updated
 */
export interface FilledProperty {
  propertyName: string;
  value: string | number | boolean | string[] | PlaceValue | null;
  confidence?: "high" | "medium" | "low";
}

/**
 * Input for updatePageProperties function
 */
export interface PropertyUpdateInput {
  filledProperties: FilledProperty[];
  sources?: string[];
  notes?: string;
}

let notionClient: Client | null = null;

/**
 * Gets or creates a Notion API client instance
 * @returns Notion Client instance or null if API key is not set
 */
export function getNotionClient(): Client | null {
  if (notionClient) {
    return notionClient;
  }

  const apiKey = Bun.env.NOTION_API_KEY;
  if (!apiKey) {
    const logger = new ScopedLogger("notionClient");
    logger.log(
      "warn",
      "NOTION_API_KEY is not set. Notion API operations will fail.",
    );
    logger.end();
    return null;
  }

  notionClient = new Client({
    auth: apiKey,
  });

  return notionClient;
}

/**
 * Fetches a page from Notion by ID
 * @param pageId - The Notion page ID
 * @returns The page object or null if not found/error
 */
export async function fetchPage(
  pageId: string,
): Promise<PageObjectResponse | null> {
  const logger = new ScopedLogger("fetchPage");
  const client = getNotionClient();
  if (!client) {
    logger.log("error", "Notion client not available");
    logger.end();
    return null;
  }

  try {
    const response = await client.pages.retrieve({ page_id: pageId });
    // Type guard: check if it's a full page response (not partial)
    if ("properties" in response) {
      logger.end();
      return response as PageObjectResponse;
    }
    logger.log("warn", "Received partial page response");
    logger.end();
    return null;
  } catch (error) {
    logger.log("error", "Error fetching page", {
      error: error instanceof Error ? error.message : String(error),
    });
    logger.end();
    return null;
  }
}

/**
 * Fetches a database schema from Notion by ID
 * @param databaseId - The Notion database ID
 * @returns The database object (with schema in properties) or null if not found/error
 */
export async function fetchDatabase(
  databaseId: string,
): Promise<DatabaseObjectResponse | null> {
  const logger = new ScopedLogger("fetchDatabase");
  const client = getNotionClient();
  if (!client) {
    logger.log("error", "Notion client not available");
    logger.end();
    return null;
  }

  try {
    const response = await client.databases.retrieve({
      database_id: databaseId,
    });
    // Type guard: check if it's a full database response
    // PartialDatabaseObjectResponse only has 'object' and 'id', while full response has 'title'
    if ("title" in response) {
      logger.end();
      return response as DatabaseObjectResponse;
    }
    logger.log("warn", "Received partial database response");
    logger.end();
    return null;
  } catch (error) {
    logger.log("error", "Error fetching database", {
      error: error instanceof Error ? error.message : String(error),
    });
    logger.end();
    return null;
  }
}

/**
 * Extracts the parent database ID from a page object
 * @param page - The page object response
 * @returns The parent database ID or null if the page is not in a database
 */
export function getParentDatabaseId(page: PageObjectResponse): string | null {
  if (page.parent.type === "database_id") {
    return page.parent.database_id;
  }
  return null;
}

/**
 * Fetches a data source from Notion by ID
 * Data sources contain the schema/properties of a database
 * @param dataSourceId - The Notion data source ID
 * @returns The data source object (with properties) or null if not found/error
 */
export async function fetchDataSource(
  dataSourceId: string,
): Promise<GetDataSourceResponse | null> {
  const logger = new ScopedLogger("fetchDataSource");
  const client = getNotionClient();
  if (!client) {
    logger.log("error", "Notion client not available");
    logger.end();
    return null;
  }

  try {
    const response = await client.dataSources.retrieve({
      data_source_id: dataSourceId,
    });
    logger.end();
    return response;
  } catch (error) {
    logger.log("error", "Error fetching data source", {
      error: error instanceof Error ? error.message : String(error),
    });
    logger.end();
    return null;
  }
}

/**
 * Fetches the first data source for a database
 * This is a convenience function that combines fetchDatabase and fetchDataSource
 * @param databaseId - The Notion database ID
 * @returns The data source object (with properties) or null if not found/error
 */
export async function fetchDatabaseDataSource(
  databaseId: string,
): Promise<GetDataSourceResponse | null> {
  const logger = new ScopedLogger("fetchDatabaseDataSource");
  const database = await fetchDatabase(databaseId);
  if (!database) {
    logger.end();
    return null;
  }

  if (!database.data_sources || database.data_sources.length === 0) {
    logger.log("warn", "Database has no data sources");
    logger.end();
    return null;
  }

  // Get the first data source (most databases have only one)
  const firstDataSource = database.data_sources[0];
  if (!firstDataSource) {
    logger.log("warn", "First data source is undefined");
    logger.end();
    return null;
  }
  logger.end();
  return fetchDataSource(firstDataSource.id);
}

/**
 * Converts Notion data source properties schema to a simplified format for AI consumption
 * @param dataSource - The data source response (contains properties schema)
 * @returns Simplified schema object describing each property
 */
export function simplifyDataSourceSchema(
  dataSource: GetDataSourceResponse,
): Record<string, { type: string; name: string; options?: string[] }> {
  const schema: Record<
    string,
    { type: string; name: string; options?: string[] }
  > = {};

  for (const [key, prop] of Object.entries(dataSource.properties)) {
    const entry: { type: string; name: string; options?: string[] } = {
      type: prop.type,
      name: prop.name,
    };

    // Extract options for select/multi_select properties
    if (prop.type === "select" && prop.select?.options) {
      entry.options = prop.select.options.map((opt) => opt.name);
    } else if (prop.type === "multi_select" && prop.multi_select?.options) {
      entry.options = prop.multi_select.options.map((opt) => opt.name);
    } else if (prop.type === "status" && prop.status?.options) {
      entry.options = prop.status.options.map((opt) => opt.name);
    }

    schema[key] = entry;
  }

  return schema;
}

/**
 * @deprecated Use simplifyDataSourceSchema instead. DatabaseObjectResponse doesn't have properties.
 * Converts Notion database properties schema to a simplified format for AI consumption
 * @param database - The database object response
 * @returns Simplified schema object describing each property
 */
export function simplifyDatabaseSchema(
  database: DatabaseObjectResponse,
): Record<string, { type: string; name: string; options?: string[] }> {
  const logger = new ScopedLogger("simplifyDatabaseSchema");
  logger.log(
    "warn",
    "This function is deprecated. Use simplifyDataSourceSchema instead.",
  );
  logger.end();
  // This will fail at runtime since DatabaseObjectResponse doesn't have properties
  // Keeping for backward compatibility - callers should migrate to simplifyDataSourceSchema
  return {} as Record<
    string,
    { type: string; name: string; options?: string[] }
  >;
}

/**
 * Converts Notion page properties to a simplified key-value format for AI consumption
 * @param page - The page object response
 * @returns Simplified object with property values
 */
export function simplifyPageProperties(
  page: PageObjectResponse,
): Record<string, unknown> {
  const simplified: Record<string, unknown> = {};

  for (const [key, prop] of Object.entries(page.properties)) {
    switch (prop.type) {
      case "title":
        simplified[key] = prop.title.map((t) => t.plain_text).join("");
        break;
      case "rich_text":
        simplified[key] = prop.rich_text.map((t) => t.plain_text).join("");
        break;
      case "number":
        simplified[key] = prop.number;
        break;
      case "select":
        simplified[key] = prop.select?.name ?? null;
        break;
      case "multi_select":
        simplified[key] = prop.multi_select.map((s) => s.name);
        break;
      case "status":
        simplified[key] = prop.status?.name ?? null;
        break;
      case "date":
        simplified[key] = prop.date
          ? { start: prop.date.start, end: prop.date.end }
          : null;
        break;
      case "checkbox":
        simplified[key] = prop.checkbox;
        break;
      case "url":
        simplified[key] = prop.url;
        break;
      case "email":
        simplified[key] = prop.email;
        break;
      case "phone_number":
        simplified[key] = prop.phone_number;
        break;
      case "formula":
        simplified[key] = prop.formula;
        break;
      case "relation":
        simplified[key] = prop.relation.map((r) => r.id);
        break;
      case "rollup":
        simplified[key] = prop.rollup;
        break;
      case "people":
        simplified[key] = prop.people.map((p) => ("name" in p ? p.name : p.id));
        break;
      case "files":
        simplified[key] = prop.files.map((f) =>
          f.type === "file" ? f.file.url : f.external.url,
        );
        break;
      case "created_time":
        simplified[key] = prop.created_time;
        break;
      case "created_by":
        simplified[key] = prop.created_by.id;
        break;
      case "last_edited_time":
        simplified[key] = prop.last_edited_time;
        break;
      case "last_edited_by":
        simplified[key] = prop.last_edited_by.id;
        break;
      default:
        simplified[key] = null;
    }
  }

  return simplified;
}

/**
 * Updates page properties in Notion based on filled property values
 * Handles type conversion for various Notion property types
 *
 * @param pageId - The Notion page ID to update
 * @param propertyValues - Object containing filled properties to update
 * @param schema - Database schema describing property types
 * @returns True if update was successful, false otherwise
 */
export async function updatePageProperties(
  pageId: string,
  propertyValues: PropertyUpdateInput,
  schema: Record<string, { type: string; name: string; options?: string[] }>,
): Promise<boolean> {
  const logger = new ScopedLogger("updatePageProperties");
  const client = getNotionClient();

  if (!client) {
    logger.log("error", "Notion client not available");
    logger.end();
    return false;
  }

  logger.log("info", "Processing property updates", {
    pageId,
    filledPropertiesCount: propertyValues.filledProperties.length,
    sources: propertyValues.sources,
    notes: propertyValues.notes,
  });

  // Build the properties update object
  const properties: Record<string, unknown> = {};
  const skippedProperties: { key: string; reason: string }[] = [];

  for (const filledProp of propertyValues.filledProperties) {
    const { propertyName: key, value, confidence } = filledProp;

    if (value === null) {
      skippedProperties.push({ key, reason: "null value" });
      continue;
    }

    const propSchema = schema[key];
    if (!propSchema) {
      skippedProperties.push({ key, reason: "not in schema" });
      continue;
    }

    logger.log("debug", "Processing property", {
      key,
      type: propSchema.type,
      confidence,
      valueType: typeof value,
      value: typeof value === "object" ? JSON.stringify(value) : value,
    });

    // Convert value based on property type
    switch (propSchema.type) {
      case "rich_text":
        properties[key] = {
          rich_text: [{ type: "text", text: { content: String(value) } }],
        };
        logger.log("debug", "Set rich_text property", {
          key,
          value: String(value),
        });
        break;
      case "number":
        if (typeof value === "number") {
          properties[key] = { number: value };
          logger.log("debug", "Set number property", { key, value });
        } else {
          skippedProperties.push({
            key,
            reason: `expected number, got ${typeof value}`,
          });
        }
        break;
      case "select":
        if (typeof value === "string") {
          properties[key] = { select: { name: value } };
          logger.log("debug", "Set select property", { key, value });
        } else {
          skippedProperties.push({
            key,
            reason: `expected string, got ${typeof value}`,
          });
        }
        break;
      case "multi_select":
        if (Array.isArray(value)) {
          properties[key] = {
            multi_select: value.map((v) => ({ name: String(v) })),
          };
          logger.log("debug", "Set multi_select property", { key, values: value });
        } else {
          skippedProperties.push({
            key,
            reason: `expected array, got ${typeof value}`,
          });
        }
        break;
      case "checkbox":
        if (typeof value === "boolean") {
          properties[key] = { checkbox: value };
          logger.log("debug", "Set checkbox property", { key, value });
        } else {
          skippedProperties.push({
            key,
            reason: `expected boolean, got ${typeof value}`,
          });
        }
        break;
      case "url":
        if (typeof value === "string") {
          properties[key] = { url: value };
          logger.log("debug", "Set url property", { key, value });
        } else {
          skippedProperties.push({
            key,
            reason: `expected string, got ${typeof value}`,
          });
        }
        break;
      case "place":
        // Place property requires lat, lon, and optionally name, address, google_place_id
        if (
          typeof value === "object" &&
          value !== null &&
          "lat" in value &&
          "lon" in value
        ) {
          const placeValue = value as PlaceValue;
          properties[key] = {
            place: {
              lat: placeValue.lat,
              lon: placeValue.lon,
              name: placeValue.name ?? null,
              address: placeValue.address ?? null,
              google_place_id: placeValue.google_place_id ?? null,
            },
          };
          logger.log("info", "Set place property", {
            key,
            lat: placeValue.lat,
            lon: placeValue.lon,
            name: placeValue.name,
            address: placeValue.address,
            google_place_id: placeValue.google_place_id,
          });
        } else {
          skippedProperties.push({
            key,
            reason: "invalid place object: missing lat/lon or not an object",
          });
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
        skippedProperties.push({
          key,
          reason: `read-only type: ${propSchema.type}`,
        });
        break;
      default:
        skippedProperties.push({
          key,
          reason: `unsupported type: ${propSchema.type}`,
        });
        logger.log("debug", "Skipping unsupported property type", {
          key,
          propertyType: propSchema.type,
        });
    }
  }

  // Log skipped properties summary
  if (skippedProperties.length > 0) {
    logger.log("debug", "Skipped properties", { skippedProperties });
  }

  if (Object.keys(properties).length === 0) {
    logger.log("info", "No properties to update");
    logger.end();
    return true; // Not an error, just nothing to update
  }

  logger.log("info", "Sending update to Notion", {
    propertyCount: Object.keys(properties).length,
    propertyNames: Object.keys(properties),
  });

  try {
    await client.pages.update({
      page_id: pageId,
      // Cast to expected type - we've already validated the property types above
      properties: properties as Parameters<
        typeof client.pages.update
      >[0]["properties"],
    });
    logger.log("info", "Successfully updated properties", {
      count: Object.keys(properties).length,
      updatedProperties: Object.keys(properties),
    });
    logger.end();
    return true;
  } catch (error) {
    logger.log("error", "Error updating page", {
      error: error instanceof Error ? error.message : String(error),
      pageId,
      attemptedProperties: Object.keys(properties),
    });
    logger.end();
    return false;
  }
}
