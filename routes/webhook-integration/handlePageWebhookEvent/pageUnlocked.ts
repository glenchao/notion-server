/**
 * Handles page unlocked events from Notion
 * 
 * Event type: page.unlocked
 * Description: Triggered when a page is unlocked.
 * Is aggregated: No
 * 
 * @param eventData - The page event data (enriched with entity info)
 * @returns Processing result
 */
export async function handlePageUnlocked(
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

  console.log("[pageUnlocked] Page unlocked:", {
    pageId,
    parent,
  });

  // TODO: Add your page unlocked logic here
  // Example: Re-enable editing features, update UI state, etc.

  return {
    eventType: "page.unlocked",
    objectType: "page",
    processed: true,
  };
}
