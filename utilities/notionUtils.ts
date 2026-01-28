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
  payload: Record<string, unknown>,
): string | undefined {
  const entity = payload.entity as { id: string; type: string } | undefined;
  return entity?.id;
}

/**
 * Checks if the webhook payload has one of the expected event types
 *
 * @param payload - The webhook payload
 * @param expectedTypes - Array of expected event types (e.g., ["page.created", "page.updated"])
 * @returns True if the payload has one of the expected event types
 */
export function isEventType(
  payload: Record<string, unknown>,
  expectedTypes: string[],
): boolean {
  const eventType = payload.type as string | undefined;
  return eventType !== undefined && expectedTypes.includes(eventType);
}

/**
 * Checks if the webhook payload is a page event
 *
 * @param payload - The webhook payload
 * @returns True if the payload represents a page event
 */
export function isPageEvent(payload: Record<string, unknown>): boolean {
  // Check if it's a page event
  const eventType = payload.type as string | undefined;
  if (!eventType || !eventType.startsWith("page.")) {
    return false;
  }

  // Check if the entity is a page
  const entity = payload.entity as { id: string; type: string } | undefined;
  return entity?.type === "page";
}

/**
 * Checks if the webhook event was triggered by a user (person), not a bot or agent
 *
 * @param payload - The webhook payload
 * @returns True if at least one author is a person (user-triggered)
 */
export function isUserTriggeredEvent(
  payload: Record<string, unknown>,
): boolean {
  const authors = payload.authors as
    | Array<{ id: string; type: "person" | "bot" | "agent" }>
    | undefined;

  if (!authors || authors.length === 0) {
    return false;
  }

  return authors.some((author) => author.type === "person");
}

/**
 * Checks if the webhook payload is a page event from a specific database
 *
 * @param payload - The webhook payload
 * @param targetDatabaseId - The target database ID to check against
 * @returns True if the payload is a page event from the target database
 */
export function isPageEventFromDatabase(
  payload: Record<string, unknown>,
  targetDatabaseId: string,
): boolean {
  // Check if it's a page event
  if (!isPageEvent(payload)) {
    return false;
  }

  // The parent is typically in the data field of the webhook payload
  const eventData = payload.data as Record<string, unknown> | undefined;
  const parent = eventData?.parent as
    | { id: string; type: string; database_id?: string }
    | undefined;

  if (!parent) {
    return false;
  }

  // Check if parent type indicates it's a database
  // Parent type can be "database_id" or the parent itself might have a database_id field
  const isDatabaseParent =
    parent.type === "database_id" ||
    parent.type === "database" ||
    parent.database_id !== undefined;

  if (!isDatabaseParent) {
    return false;
  }

  // Extract database ID - it might be in parent.id or parent.database_id
  const dbId = parent.database_id || parent.id;
  if (!dbId) {
    return false;
  }

  // Compare normalized IDs (without dashes, case-insensitive)
  return (
    normalizeNotionId(String(dbId)) === normalizeNotionId(targetDatabaseId)
  );
}
