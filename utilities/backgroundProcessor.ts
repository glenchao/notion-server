import { ScopedLogger } from "../logging/SimpleLogger";
import type { NotionWebhookEvent } from "../types/webhook-events";
import { handleWebhookPayload } from "../routes/webhook-integration/webhookIntegration";

/**
 * Processes webhook payload in the background without blocking the HTTP response.
 * Errors are logged but not thrown to prevent affecting other operations.
 *
 * Uses queueMicrotask to ensure processing runs after the response is sent.
 *
 * @param payload - The validated webhook payload to process
 */
export function processWebhookInBackground(payload: NotionWebhookEvent): void {
  queueMicrotask(async () => {
    const logger = new ScopedLogger("processWebhookInBackground");
    try {
      logger.log("info", "Starting background webhook processing");
      const result = await handleWebhookPayload(payload);
      logger.log("info", "Background webhook processing completed", {
        result,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.log("error", "Error in background webhook processing:", {
        error: errorMessage,
      });
    } finally {
      logger.end();
    }
  });
}
