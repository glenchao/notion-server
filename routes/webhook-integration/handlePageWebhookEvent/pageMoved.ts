/**
 * Handles page moved events from Notion
 * 
 * Event type: page.moved
 * Description: Triggered when a page is moved to another location.
 * Is aggregated: Yes
 * 
 * @param eventData - The page event data (enriched with entity info)
 * @returns Processing result
 */
export async function handlePageMoved(
  eventData: Record<string, unknown>,
): Promise<{
  eventType: string;
  objectType: string;
  processed: boolean;
}> {
  // Extract page ID from entity or eventData (for backward compatibility)
  const entity = eventData.entity as { id: string; type: string } | undefined;
  const pageId = entity?.id || (eventData.id as string | undefined);
  const parent = eventData.parent as { id: string; type: string } | undefined;

  console.log("[pageMoved] Page moved:", {
    pageId,
    newParent: parent,
  });

  // TODO: Add your page moved logic here
  // Example: Update page hierarchy, sync location changes, etc.

  return {
    eventType: "page.moved",
    objectType: "page",
    processed: true,
  };
}
