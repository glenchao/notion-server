import { ScopedLogger } from "../logging/SimpleLogger";
import type { IWebhookProcessor } from "../types/webhook";
import type { NotionWebhookEvent } from "../types/webhook-events";
import { allProcessors } from "../processors";

/**
 * Gets all processors that should be executed based on isEnabled and shouldExecute
 *
 * @param payload - The webhook payload to check against
 * @returns Array of processors that should be executed
 */
export async function getProcessorsToExecute(
  payload: NotionWebhookEvent,
): Promise<IWebhookProcessor[]> {
  const logger = new ScopedLogger("getProcessorsToExecute");

  logger.log("info", "Checking processors", {
    total: allProcessors.length,
  });

  const processorsToExecute = allProcessors.filter((processor) => {
    // Check if processor is enabled
    const enabled =
      typeof processor.isEnabled === "function"
        ? processor.isEnabled(payload)
        : processor.isEnabled;

    if (!enabled) {
      logger.log("debug", "Processor is disabled", {
        processorName: processor.name,
        processorId: processor.id,
      });
      return false;
    }

    // Check if processor should execute
    const shouldExecute =
      typeof processor.shouldExecute === "function"
        ? processor.shouldExecute(payload)
        : processor.shouldExecute;

    if (!shouldExecute) {
      logger.log("debug", "Processor should not execute", {
        processorName: processor.name,
        processorId: processor.id,
      });
      return false;
    }

    logger.log("info", "Processor will execute", {
      processorName: processor.name,
      processorId: processor.id,
    });
    return true;
  });

  logger.log("info", "Final result", {
    total: allProcessors.length,
    toExecute: processorsToExecute.length,
    processorNames: processorsToExecute.map((p) => p.name),
  });

  logger.end();
  return processorsToExecute;
}
