/**
 * Handles page content updated events from Notion
 * 
 * Event type: page.content_updated
 * Description: Triggered when the content of a page changes — for example adding or removing a block on the page.
 * Is aggregated: Yes
 * 
 * @param eventData - The page event data (enriched with entity info)
 * @returns Processing result
 */
export async function handlePageContentUpdated(
  eventData: Record<string, unknown>,
): Promise<{
  eventType: string;
  objectType: string;
  processed: boolean;
}> {
  // Extract page ID from entity or eventData (for backward compatibility)
  const entity = eventData.entity as { id: string; type: string } | undefined;
  const pageId = entity?.id || (eventData.id as string | undefined);
  const updatedBlocks = (eventData.updated_blocks as Array<{ id: string; type: string }> | undefined) || [];
  const parent = eventData.parent as { id: string; type: string } | undefined;

  console.log("[pageContentUpdated] Page content updated:", {
    pageId,
    updatedBlocksCount: updatedBlocks.length,
    parent,
  });

  // TODO: Add your page content update logic here
  // Example: Sync content changes, update cache, etc.

  return {
    eventType: "page.content_updated",
    objectType: "page",
    processed: true,
  };
}
