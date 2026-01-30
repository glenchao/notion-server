import { ScopedLogger } from "../logging/SimpleLogger";
import type { NotionWebhookEvent } from "../types/webhook-events";
import { getNotionClient } from "../utilities/notionClient";
import { extractPageIdFromPayload } from "../utilities/notionUtils";

/**
 * Inserts a test table block into a Notion page
 * @param payload - The webhook payload containing the page information
 * @returns True if successful, false otherwise
 */
export async function insertTestTable(
  payload: NotionWebhookEvent,
): Promise<boolean> {
  const logger = new ScopedLogger("insertTestTable");

  try {
    // Extract page ID from payload
    const pageId = extractPageIdFromPayload(payload);

    if (!pageId) {
      logger.log("error", "No page ID found in payload");
      logger.end();
      return false;
    }

    const client = getNotionClient();
    if (!client) {
      logger.log(
        "error",
        "Notion client not available. NOTION_API_KEY may be missing.",
      );
      logger.end();
      return false;
    }

    logger.log("info", "Inserting test table into page", { pageId });

    await client.blocks.children.append({
      block_id: pageId,
      children: [
        {
          type: "table",
          table: {
            table_width: 3,
            has_column_header: true,
            has_row_header: false,
            children: [
              // Header row
              {
                type: "table_row",
                table_row: {
                  cells: [
                    [
                      {
                        type: "text",
                        text: { content: "Name" },
                      },
                    ],
                    [
                      {
                        type: "text",
                        text: { content: "Number" },
                      },
                    ],
                    [
                      {
                        type: "text",
                        text: { content: "Link" },
                      },
                    ],
                  ],
                },
              },
              // Row 1
              {
                type: "table_row",
                table_row: {
                  cells: [
                    [
                      {
                        type: "text",
                        text: { content: "Alice Johnson" },
                      },
                    ],
                    [
                      {
                        type: "text",
                        text: { content: "42" },
                      },
                    ],
                    [
                      {
                        type: "text",
                        text: {
                          content: "Alice's Link",
                          link: { url: "https://example.com/alice" },
                        },
                      },
                    ],
                  ],
                },
              },
              // Row 2
              {
                type: "table_row",
                table_row: {
                  cells: [
                    [
                      {
                        type: "text",
                        text: { content: "Bob Smith" },
                      },
                    ],
                    [
                      {
                        type: "text",
                        text: { content: "17" },
                      },
                    ],
                    [
                      {
                        type: "text",
                        text: {
                          content: "Bob's Link",
                          link: { url: "https://example.com/bob" },
                        },
                      },
                    ],
                  ],
                },
              },
              // Row 3
              {
                type: "table_row",
                table_row: {
                  cells: [
                    [
                      {
                        type: "text",
                        text: { content: "Charlie Brown" },
                      },
                    ],
                    [
                      {
                        type: "text",
                        text: { content: "99" },
                      },
                    ],
                    [
                      {
                        type: "text",
                        text: {
                          content: "Charlie's Link",
                          link: { url: "https://example.com/charlie" },
                        },
                      },
                    ],
                  ],
                },
              },
            ],
          },
        },
      ],
    });

    logger.log("info", "Successfully inserted test table");
    logger.end();
    return true;
  } catch (error) {
    logger.log("error", "Error inserting test table", {
      error: error instanceof Error ? error.message : String(error),
    });
    logger.end();
    return false;
  }
}
