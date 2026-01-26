/**
 * Handles page undeleted (restored from trash) events from Notion
 * 
 * Event type: page.undeleted
 * Description: Triggered when a page is restored from the trash.
 * Is aggregated: Yes
 * 
 * @param eventData - The page event data (enriched with entity info)
 * @returns Processing result
 */
export async function handlePageUndeleted(
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

  console.log("[pageUndeleted] Page restored from trash:", {
    pageId,
    parent,
  });

  // TODO: Add your page undeleted logic here
  // Example: Restore page data, re-enable features, etc.

  return {
    eventType: "page.undeleted",
    objectType: "page",
    processed: true,
  };
}
