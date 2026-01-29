import type { NotionWebhookEvent } from "../types/webhook-events";
import { extractPageIdFromPayload } from "../utilities/notionUtils";

/**
 * Executor for Small Business Acquisition database - logs when a new page is created
 * @param payload - The webhook payload containing the page information
 * @returns True if successful, false otherwise
 */
export async function smallBusinessAcquisitionExecutor(
  payload: NotionWebhookEvent,
): Promise<boolean> {
  try {
    const pageId = extractPageIdFromPayload(payload);

    if (!pageId) {
      console.error(
        "[smallBusinessAcquisitionExecutor] No page ID found in payload",
      );
      return false;
    }

    console.log(
      "[smallBusinessAcquisitionExecutor] New page created in Small Business Acquisition database:",
      pageId,
    );
    console.log(
      "[smallBusinessAcquisitionExecutor] Full payload:",
      JSON.stringify(payload, null, 2),
    );

    return true;
  } catch (error) {
    console.error(
      "[smallBusinessAcquisitionExecutor] Error processing:",
      error,
    );
    return false;
  }
}
