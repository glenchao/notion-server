import { handlePageCreated } from "./pageCreated";
import { handlePageUpdated } from "./pageUpdated";
import { handlePageDeleted } from "./pageDeleted";

/**
 * Handles page webhook events from Notion
 * @param eventType - The type of page event (e.g., "page.created", "page.updated", "page.deleted")
 * @param eventData - The page event data
 * @returns Processing result
 */
export async function handlePageWebhookEvent(
  eventType: string | undefined,
  eventData: Record<string, unknown> | undefined,
): Promise<{
  eventType?: string;
  objectType: string;
  processed: boolean;
}> {
  if (!eventData) {
    console.warn(
      "[handlePageWebhookEvent] Page event received but no data provided",
    );
    return {
      eventType,
      objectType: "page",
      processed: false,
    };
  }

  const pageId = eventData.id as string | undefined;
  const pageTitle = eventData.title as string | undefined;
  const pageUrl = eventData.url as string | undefined;

  console.log("[handlePageWebhookEvent] Processing page event:", {
    eventType,
    pageId,
    pageTitle,
    pageUrl,
  });

  // Handle different page event types
  switch (eventType) {
    case "page.created":
    case "page.added":
      return await handlePageCreated(eventData);

    case "page.updated":
    case "page.content_changed":
      return await handlePageUpdated(eventData);

    case "page.deleted":
    case "page.removed":
      return await handlePageDeleted(eventData);

    default:
      console.log("[handlePageWebhookEvent] Unknown page event type:", eventType);
      return {
        eventType,
        objectType: "page",
        processed: false,
      };
  }
}
