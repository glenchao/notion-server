import type {
  NotionWebhookEvent,
  WebhookEventType,
} from "../types/webhook-events";

/**
 * Normalizes a Notion ID by removing dashes for comparison
 * This is useful when comparing Notion IDs that may be in different formats
 * (with or without dashes, different cases)
 *
 * @param id - The Notion ID to normalize
 * @returns The normalized ID (lowercase, no dashes)
 */
export function normalizeNotionId(id: string): string {
  return id.replace(/-/g, "").toLowerCase();
}

/**
 * Extracts the page ID from a webhook payload
 *
 * @param payload - The webhook payload
 * @returns The page ID if found, undefined otherwise
 */
export function extractPageIdFromPayload(
  payload: NotionWebhookEvent,
): string | undefined {
  return payload.entity?.id;
}

/**
 * Checks if the webhook payload has one of the expected event types
 *
 * @param payload - The webhook payload
 * @param expectedTypes - Array of expected event types (e.g., ["page.created", "page.updated"])
 * @returns True if the payload has one of the expected event types
 */
export function isEventType(
  payload: NotionWebhookEvent,
  expectedTypes: WebhookEventType[],
): boolean {
  return expectedTypes.includes(payload.type);
}

/**
 * Checks if the webhook payload is a page event
 *
 * @param payload - The webhook payload
 * @returns True if the payload represents a page event
 */
export function isPageEvent(payload: NotionWebhookEvent): boolean {
  // Check if it's a page event type
  if (!payload.type.startsWith("page.")) {
    return false;
  }

  // Check if the entity is a page
  return payload.entity?.type === "page";
}

/**
 * Checks if the webhook event was triggered by a user (person), not a bot or agent
 *
 * @param payload - The webhook payload
 * @returns True if at least one author is a person (user-triggered)
 */
export function isUserTriggeredEvent(payload: NotionWebhookEvent): boolean {
  if (!payload.authors || payload.authors.length === 0) {
    return false;
  }

  return payload.authors.some((author) => author.type === "person");
}

/**
 * Extracts the parent database ID from a webhook payload
 *
 * @param payload - The webhook payload
 * @returns The database ID if the page is from a database, undefined otherwise
 */
export function extractDatabaseIdFromPayload(
  payload: NotionWebhookEvent,
): string | undefined {
  const parent = payload.data?.parent;

  if (!parent) {
    return undefined;
  }

  // Check if parent type indicates it's a database
  if (parent.type === "database" || parent.type === "data_source") {
    return parent.id;
  }

  return undefined;
}

/**
 * Checks if the webhook payload is a page event from a specific database
 *
 * @param payload - The webhook payload
 * @param targetDatabaseId - The target database ID to check against
 * @returns True if the payload is a page event from the target database
 */
export function isPageEventFromDatabase(
  payload: NotionWebhookEvent,
  targetDatabaseId: string,
): boolean {
  // Check if it's a page event
  if (!isPageEvent(payload)) {
    return false;
  }

  // The parent is in the data field of the webhook payload
  const parent = payload.data?.parent;

  if (!parent) {
    return false;
  }

  // Check if parent type indicates it's a database
  const isDatabaseParent =
    parent.type === "database" || parent.type === "data_source";

  if (!isDatabaseParent) {
    return false;
  }

  // Compare normalized IDs (without dashes, case-insensitive)
  return normalizeNotionId(parent.id) === normalizeNotionId(targetDatabaseId);
}
