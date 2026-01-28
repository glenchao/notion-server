import { smallBusinessAcquisitionExecutor } from "../executors/smallBusinessAcquisitionExecutor";
import type { IWebhookProcessor } from "../types/webhook";
import { DATABASE_SMALL_BUSINESS_ACQUISITION } from "../utilities/Constants";
import { isEventType, isPageEventFromDatabase } from "../utilities/notionUtils";

/**
 * Webhook processor for Small Business Acquisition database
 * Executes when a new page is created in the target database
 */
export const smallBusinessAcquisitionProcessor: IWebhookProcessor = {
  id: "c3d4e5f6-a7b8-9012-cdef-123456789012", // GUID
  name: "Small Business Acquisition Processor",
  isEnabled: true,
  shouldExecute: (payload: Record<string, unknown>) => {
    return (
      isEventType(payload, ["page.created"]) &&
      isPageEventFromDatabase(payload, DATABASE_SMALL_BUSINESS_ACQUISITION)
    );
  },
  executor: smallBusinessAcquisitionExecutor,
};
