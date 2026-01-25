import { Client } from "@notionhq/client";

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
