import { getNotionClient } from "../../../utilities/notionClient";

/**
 * Inserts a test table block into a Notion page
 * @param pageId - The ID of the page to insert the table into
 */
async function insertTestTable(pageId: string): Promise<void> {
  const client = getNotionClient();
  if (!client) {
    console.error("[pageUpdated] Notion client not available. NOTION_API_KEY may be missing.");
    return;
  }

  try {
    console.log("[pageUpdated] Inserting test table into page:", pageId);

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
                        text: { content: "https://example.com/alice" },
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
                        text: { content: "https://example.com/bob" },
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
                        text: { content: "https://example.com/charlie" },
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

    console.log("[pageUpdated] Successfully inserted test table");
  } catch (error) {
    console.error("[pageUpdated] Error inserting test table:", error);
    throw error;
  }
}

/**
 * Handles page update events from Notion
 * @param eventData - The page event data
 * @returns Processing result
 */
export async function handlePageUpdated(
  eventData: Record<string, unknown>,
): Promise<{
  eventType: string;
  objectType: string;
  processed: boolean;
}> {
  const pageId = eventData.id as string | undefined;
  const pageTitle = eventData.title as string | undefined;
  const pageUrl = eventData.url as string | undefined;

  console.log("[pageUpdated] Page updated:", { pageId, pageTitle, pageUrl });
  
  // Test handler: Insert a table block when page is updated
  if (pageId) {
    try {
      await insertTestTable(pageId);
    } catch (error) {
      console.error("[pageUpdated] Failed to insert test table:", error);
      // Continue processing even if table insertion fails
    }
  }

  return {
    eventType: "page.updated",
    objectType: "page",
    processed: true,
  };
}
