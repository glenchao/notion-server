import { vancouverHouse2Executor } from "../executors/vancouverHouse2Executor";
import type { IWebhookProcessor } from "../types/webhook";
import { DATABASE_VANCOUVER_HOUSE_2 } from "../utilities/Constants";
import {
  isPageEventFromDatabase,
  isUserTriggeredEvent,
} from "../utilities/notionUtils";

/**
 * Webhook processor for Vancouver House 2 database
 * Executes on all page events triggered by a user (not bots/automations)
 */
export const vancouverHouse2Processor: IWebhookProcessor = {
  id: "b2c3d4e5-f6a7-8901-bcde-f12345678901", // GUID
  name: "Vancouver House 2 Processor",
  isEnabled: true,
  shouldExecute: (payload: Record<string, unknown>) => {
    return (
      isUserTriggeredEvent(payload) &&
      isPageEventFromDatabase(payload, DATABASE_VANCOUVER_HOUSE_2)
    );
  },
  executor: vancouverHouse2Executor,
};
