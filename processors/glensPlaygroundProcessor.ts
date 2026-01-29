import { insertTestTable } from "../executors/insertTestTable";
import type { IWebhookProcessor } from "../types/webhook";
import { DATABASE_GLENS_PLAYGROUND } from "../utilities/Constants";
import { isPageEventFromDatabase } from "../utilities/notionUtils";

/**
 * Webhook processor for Glen's Playground database
 */
export const glensPlaygroundProcessor: IWebhookProcessor = {
  id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", // GUID
  name: "Glen's Playground Processor",
  isEnabled: true, // Always enabled
  shouldExecute: (payload) => {
    return isPageEventFromDatabase(payload, DATABASE_GLENS_PLAYGROUND);
  },
  executor: insertTestTable,
};
