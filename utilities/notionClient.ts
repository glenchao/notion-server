import { Client } from "@notionhq/client";
import type {
  PageObjectResponse,
  DatabaseObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";

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
    console.warn(
      "[notionClient] NOTION_API_KEY is not set. Notion API operations will fail.",
    );
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
  const client = getNotionClient();
  if (!client) {
    console.error("[fetchPage] Notion client not available");
    return null;
  }

  try {
    const response = await client.pages.retrieve({ page_id: pageId });
    // Type guard: check if it's a full page response (not partial)
    if ("properties" in response) {
      return response as PageObjectResponse;
    }
    console.warn("[fetchPage] Received partial page response");
    return null;
  } catch (error) {
    console.error("[fetchPage] Error fetching page:", error);
    return null;
  }
}

/**
 * Fetches a database schema from Notion by ID
 * @param databaseId - The Notion database ID
 * @returns The database object (with schema in properties) or null if not found/error
 */
export async function fetchDatabaseSchema(
  databaseId: string,
): Promise<DatabaseObjectResponse | null> {
  const client = getNotionClient();
  if (!client) {
    console.error("[fetchDatabaseSchema] Notion client not available");
    return null;
  }

  try {
    const response = await client.databases.retrieve({ database_id: databaseId });
    // Type guard: check if it's a full database response
    if ("properties" in response) {
      return response as DatabaseObjectResponse;
    }
    console.warn("[fetchDatabaseSchema] Received partial database response");
    return null;
  } catch (error) {
    console.error("[fetchDatabaseSchema] Error fetching database:", error);
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
 * Converts Notion database properties schema to a simplified format for AI consumption
 * @param database - The database object response
 * @returns Simplified schema object describing each property
 */
export function simplifyDatabaseSchema(
  database: DatabaseObjectResponse,
): Record<string, { type: string; name: string; options?: string[] }> {
  const schema: Record<string, { type: string; name: string; options?: string[] }> = {};

  for (const [key, prop] of Object.entries(database.properties)) {
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
