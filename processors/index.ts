import type { IWebhookProcessor } from "../types/webhook";
import { glensPlaygroundProcessor } from "./glensPlaygroundProcessor.ts";
import { smallBusinessAcquisitionProcessor } from "./smallBusinessAcquisitionProcessor.ts";
import { vancouverHouse2Processor } from "./vancouverHouse2Processor.ts";

/**
 * Registry of all webhook processors
 *
 * To add a new processor:
 * 1. Create your processor file (e.g., myProcessor.ts)
 * 2. Import it above
 * 3. Add it to the allProcessors array below
 */
export const allProcessors: readonly IWebhookProcessor[] = [
  glensPlaygroundProcessor,
  vancouverHouse2Processor,
  smallBusinessAcquisitionProcessor,
] as const;
