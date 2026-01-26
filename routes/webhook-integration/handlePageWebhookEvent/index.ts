import { handlePageCreated } from "./pageCreated";
import { handlePageContentUpdated } from "./pageContentUpdated";
import { handlePageDeleted } from "./pageDeleted";
import { handlePageLocked } from "./pageLocked";
import { handlePageMoved } from "./pageMoved";
import { handlePagePropertiesUpdated } from "./pagePropertiesUpdated";
import { handlePageUndeleted } from "./pageUndeleted";
import { handlePageUnlocked } from "./pageUnlocked";

/**
 * Handles page webhook events from Notion
 * 
 * Supports all page event types as documented at:
 * https://developers.notion.com/reference/webhooks-events-delivery
 * 
 * Supported event types:
 * - page.created: Triggered when a new page is created (Aggregated: Yes)
 * - page.content_updated: Triggered when the content of a page changes (Aggregated: Yes)
 * - page.deleted: Triggered when a page is moved to the trash (Aggregated: Yes)
 * - page.locked: Triggered when a page is locked from editing (Aggregated: No)
 * - page.moved: Triggered when a page is moved to another location (Aggregated: Yes)
 * - page.properties_updated: Triggered when a page's property is updated (Aggregated: Yes)
 * - page.undeleted: Triggered when a page is restored from the trash (Aggregated: Yes)
 * - page.unlocked: Triggered when a page is unlocked (Aggregated: No)
 * 
 * @param eventType - The type of page event (e.g., "page.created", "page.content_updated", "page.deleted")
 * @param webhookPayload - The full webhook payload containing entity, data, etc.
 * @returns Processing result
 */
export async function handlePageWebhookEvent(
  eventType: string | undefined,
  webhookPayload: Record<string, unknown> | undefined,
): Promise<{
  eventType?: string;
  objectType: string;
  processed: boolean;
}> {
  if (!webhookPayload) {
    console.warn(
      "[handlePageWebhookEvent] Page event received but no payload provided",
    );
    return {
      eventType,
      objectType: "page",
      processed: false,
    };
  }

  // Extract page ID from entity (according to Notion webhook structure)
  const entity = webhookPayload.entity as { id: string; type: string } | undefined;
  const eventData = webhookPayload.data as Record<string, unknown> | undefined;
  const pageId = entity?.id;

  // Merge entity info into eventData for backward compatibility with existing handlers
  const enrichedEventData = {
    ...eventData,
    id: pageId,
    entity,
  };

  console.log("[handlePageWebhookEvent] Processing page event:", {
    eventType,
    pageId,
    entityType: entity?.type,
    hasData: !!eventData,
  });

  // Handle different page event types according to Notion webhook documentation
  // See: https://developers.notion.com/reference/webhooks-events-delivery
  switch (eventType) {
    // Triggered when a new page is created. (Aggregated: Yes)
    case "page.created":
      return await handlePageCreated(enrichedEventData);

    // Triggered when the content of a page changes — for example adding or removing a block on the page. (Aggregated: Yes)
    case "page.content_updated":
      return await handlePageContentUpdated(enrichedEventData);

    // Triggered when a page is moved to the trash. (Aggregated: Yes)
    case "page.deleted":
      return await handlePageDeleted(enrichedEventData);

    // Triggered when a page is locked from editing. (Aggregated: No)
    case "page.locked":
      return await handlePageLocked(enrichedEventData);

    // Triggered when a page is moved to another location. (Aggregated: Yes)
    case "page.moved":
      return await handlePageMoved(enrichedEventData);

    // Triggered when a page's property is updated. (Aggregated: Yes)
    case "page.properties_updated":
      return await handlePagePropertiesUpdated(enrichedEventData);

    // Triggered when a page is restored from the trash. (Aggregated: Yes)
    case "page.undeleted":
      return await handlePageUndeleted(enrichedEventData);

    // Triggered when a page is unlocked. (Aggregated: No)
    case "page.unlocked":
      return await handlePageUnlocked(enrichedEventData);

    default:
      console.log("[handlePageWebhookEvent] Unknown page event type:", eventType);
      return {
        eventType,
        objectType: "page",
        processed: false,
      };
  }
}
