import { ScopedLogger } from "../logging/SimpleLogger";
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
  const logger = new ScopedLogger("smallBusinessAcquisitionExecutor");

  try {
    const pageId = extractPageIdFromPayload(payload);

    if (!pageId) {
      logger.log("error", "No page ID found in payload");
      logger.end();
      return false;
    }

    logger.log(
      "info",
      "New page created in Small Business Acquisition database",
      { pageId },
    );
    logger.log("debug", "Full payload", { payload });

    logger.end();
    return true;
  } catch (error) {
    logger.log("error", "Error processing", {
      error: error instanceof Error ? error.message : String(error),
    });
    logger.end();
    return false;
  }
}
