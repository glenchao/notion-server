/**
 * Handles page locked events from Notion
 * 
 * Event type: page.locked
 * Description: Triggered when a page is locked from editing.
 * Is aggregated: No
 * 
 * @param eventData - The page event data (enriched with entity info)
 * @returns Processing result
 */
export async function handlePageLocked(
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

  console.log("[pageLocked] Page locked:", {
    pageId,
    parent,
  });

  // TODO: Add your page locked logic here
  // Example: Disable editing features, update UI state, etc.

  return {
    eventType: "page.locked",
    objectType: "page",
    processed: true,
  };
}
