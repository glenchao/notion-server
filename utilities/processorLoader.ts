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
  console.log("[getProcessorsToExecute] Checking processors:", {
    total: allProcessors.length,
  });

  const processorsToExecute = allProcessors.filter((processor) => {
    // Check if processor is enabled
    const enabled =
      typeof processor.isEnabled === "function"
        ? processor.isEnabled(payload)
        : processor.isEnabled;

    if (!enabled) {
      console.log(
        `[getProcessorsToExecute] Processor ${processor.name} (${processor.id}) is disabled`,
      );
      return false;
    }

    // Check if processor should execute
    const shouldExecute =
      typeof processor.shouldExecute === "function"
        ? processor.shouldExecute(payload)
        : processor.shouldExecute;

    if (!shouldExecute) {
      console.log(
        `[getProcessorsToExecute] Processor ${processor.name} (${processor.id}) should not execute`,
      );
      return false;
    }

    console.log(
      `[getProcessorsToExecute] Processor ${processor.name} (${processor.id}) will execute`,
    );
    return true;
  });

  console.log("[getProcessorsToExecute] Final result:", {
    total: allProcessors.length,
    toExecute: processorsToExecute.length,
    processorNames: processorsToExecute.map((p) => p.name),
  });

  return processorsToExecute;
}
