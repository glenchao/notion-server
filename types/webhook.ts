/**
 * Webhook processor interface for handling webhook events
 */
export interface IWebhookProcessor {
  /** Unique identifier for the processor (GUID) */
  id: string;
  /** Human-readable name of the processor */
  name: string;
  /** Whether the processor is enabled. Can be a boolean or a function that determines enablement based on payload */
  isEnabled: boolean | ((payload: Record<string, unknown>) => boolean);
  /** Whether the processor should execute. Can be a boolean or a function that determines execution based on payload */
  shouldExecute: boolean | ((payload: Record<string, unknown>) => boolean);
  /** The executor function that processes the payload. Returns true on success, false on failure */
  executor: (payload: Record<string, unknown>) => Promise<boolean> | boolean;
}
