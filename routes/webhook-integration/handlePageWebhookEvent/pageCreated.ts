/**
 * Handles page creation events from Notion
 * 
 * Event type: page.created
 * Description: Triggered when a new page is created.
 * Is aggregated: Yes
 * 
 * @param eventData - The page event data (enriched with entity info)
 * @returns Processing result
 */
export async function handlePageCreated(
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

  console.log("[pageCreated] Page created:", {
    pageId,
    parent,
  });
  
  // TODO: Add your page creation logic here
  // Example: Save to database, send notification, etc.

  return {
    eventType: "page.created",
    objectType: "page",
    processed: true,
  };
}
