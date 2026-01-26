import { getNotionClient } from "../../../utilities/notionClient";

/**
 * Inserts a test table block into a Notion page
 * @param pageId - The ID of the page to insert the table into
 */
async function insertTestTable(pageId: string): Promise<void> {
  const client = getNotionClient();
  if (!client) {
    console.error(
      "[insertTestTable] Notion client not available. NOTION_API_KEY may be missing.",
    );
    return;
  }

  try {
    console.log("[insertTestTable] Inserting test table into page:", pageId);

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

    console.log("[insertTestTable] Successfully inserted test table");
  } catch (error) {
    console.error("[insertTestTable] Error inserting test table:", error);
    throw error;
  }
}

/**
 * Handles page properties updated events from Notion
 *
 * Event type: page.properties_updated
 * Description: Triggered when a page's property is updated.
 * Is aggregated: Yes
 *
 * @param eventData - The page event data (enriched with entity info)
 * @returns Processing result
 */
export async function handlePagePropertiesUpdated(
  eventData: Record<string, unknown>,
): Promise<{
  eventType: string;
  objectType: string;
  processed: boolean;
}> {
  // Extract page ID from entity or eventData (for backward compatibility)
  const entity = eventData.entity as { id: string; type: string } | undefined;
  const pageId = entity?.id || (eventData.id as string | undefined);
  const updatedProperties =
    (eventData.updated_properties as string[] | undefined) || [];
  const parent = eventData.parent as { id: string; type: string } | undefined;

  console.log("[pagePropertiesUpdated] Page properties updated:", {
    pageId,
    updatedProperties,
    parent,
  });

  // Insert test table when page properties are updated
  if (pageId) {
    try {
      await insertTestTable(pageId);
    } catch (error) {
      console.error(
        "[pagePropertiesUpdated] Failed to insert test table:",
        error,
      );
      // Continue processing even if table insertion fails
    }
  }

  return {
    eventType: "page.properties_updated",
    objectType: "page",
    processed: true,
  };
}
