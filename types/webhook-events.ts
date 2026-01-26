// ============================================================================
// Base Types for Webhook Events
// ============================================================================

/**
 * Author of a webhook event
 */
export interface WebhookAuthor {
  id: string;
  type: "person" | "bot" | "agent";
}

/**
 * Entity that triggered the webhook event
 */
export interface WebhookEntity {
  id: string;
  type: "page" | "block" | "database" | "data_source" | "comment";
}

/**
 * Parent reference in webhook event data
 */
export interface WebhookParent {
  id: string;
  type: "page" | "database" | "block" | "space" | "data_source";
}

/**
 * Accessible user/bot information (for public integrations)
 */
export interface WebhookAccessibleBy {
  id: string;
  type: "person" | "bot";
}

/**
 * Updated block reference
 */
export interface UpdatedBlock {
  id: string;
  type: "block";
}

/**
 * Updated property information for schema updates
 */
export interface UpdatedProperty {
  id: string;
  name: string;
  action: "created" | "updated" | "deleted";
}

// ============================================================================
// Event-Specific Data Types
// ============================================================================

/**
 * Data for page.created event
 */
export interface PageCreatedData {
  parent: WebhookParent;
}

/**
 * Data for page.properties_updated event
 */
export interface PagePropertiesUpdatedData {
  parent: WebhookParent;
  updated_properties: string[];
}

/**
 * Data for page.content_updated event
 */
export interface PageContentUpdatedData {
  parent: WebhookParent;
  updated_blocks: UpdatedBlock[];
}

/**
 * Data for page.moved event
 */
export interface PageMovedData {
  parent: WebhookParent;
}

/**
 * Data for page.deleted event
 */
export interface PageDeletedData {
  parent: WebhookParent;
}

/**
 * Data for page.undeleted event
 */
export interface PageUndeletedData {
  parent: WebhookParent;
}

/**
 * Data for page.locked event
 */
export interface PageLockedData {
  parent: WebhookParent;
}

/**
 * Data for page.unlocked event
 */
export interface PageUnlockedData {
  parent: WebhookParent;
}

/**
 * Data for database.created event
 */
export interface DatabaseCreatedData {
  parent: WebhookParent;
}

/**
 * Data for database.content_updated event (deprecated)
 */
export interface DatabaseContentUpdatedData {
  parent: WebhookParent;
  updated_blocks: UpdatedBlock[];
}

/**
 * Data for database.moved event
 */
export interface DatabaseMovedData {
  parent: WebhookParent;
}

/**
 * Data for database.deleted event
 */
export interface DatabaseDeletedData {
  parent: WebhookParent;
}

/**
 * Data for database.undeleted event
 */
export interface DatabaseUndeletedData {
  parent: WebhookParent;
}

/**
 * Data for database.schema_updated event (deprecated)
 */
export interface DatabaseSchemaUpdatedData {
  parent: WebhookParent;
  updated_properties: UpdatedProperty[];
}

/**
 * Data for data_source.content_updated event
 */
export interface DataSourceContentUpdatedData {
  parent: WebhookParent;
  updated_blocks: UpdatedBlock[];
}

/**
 * Data for data_source.created event
 */
export interface DataSourceCreatedData {
  parent: WebhookParent;
}

/**
 * Data for data_source.deleted event
 */
export interface DataSourceDeletedData {
  parent: WebhookParent;
}

/**
 * Data for data_source.moved event
 */
export interface DataSourceMovedData {
  parent: WebhookParent;
}

/**
 * Data for data_source.schema_updated event
 */
export interface DataSourceSchemaUpdatedData {
  parent: WebhookParent;
  updated_properties: UpdatedProperty[];
}

/**
 * Data for data_source.undeleted event
 */
export interface DataSourceUndeletedData {
  parent: WebhookParent;
}

/**
 * Data for comment.created event
 */
export interface CommentCreatedData {
  page_id: string;
  parent: WebhookParent;
}

/**
 * Data for comment.updated event
 */
export interface CommentUpdatedData {
  page_id: string;
  parent: WebhookParent;
}

/**
 * Data for comment.deleted event
 */
export interface CommentDeletedData {
  page_id: string;
  parent: WebhookParent;
}

// ============================================================================
// Base Webhook Event Structure
// ============================================================================

/**
 * Base structure for all webhook events
 */
export interface BaseWebhookEvent<T extends string, D> {
  /** The unique ID of the webhook event */
  id: string;
  /** ISO 8601 formatted time at which the event occurred */
  timestamp: string;
  /** The workspace ID where the event originated from */
  workspace_id: string;
  /** The workspace name (optional, may not be present in all events) */
  workspace_name?: string;
  /** The ID of the webhook subscription */
  subscription_id: string;
  /** Associated integration ID the subscription is set up with */
  integration_id: string;
  /** Type of the event, e.g. "page.created" */
  type: T;
  /** Array of authors who performed the action */
  authors: WebhookAuthor[];
  /** Array of accessible bots and users (only for public integrations) */
  accessible_by?: WebhookAccessibleBy[];
  /** Attempt number (1-8) of the current event delivery */
  attempt_number: number;
  /** API version (optional, present in newer events) */
  api_version?: string;
  /** ID and type of the object that triggered the event */
  entity: WebhookEntity;
  /** Additional, event-specific data */
  data: D;
}

// ============================================================================
// Specific Webhook Event Types
// ============================================================================

/**
 * page.content_updated event
 */
export type PageContentUpdatedEvent = BaseWebhookEvent<
  "page.content_updated",
  PageContentUpdatedData
>;

/**
 * page.created event
 */
export type PageCreatedEvent = BaseWebhookEvent<
  "page.created",
  PageCreatedData
>;

/**
 * page.deleted event
 */
export type PageDeletedEvent = BaseWebhookEvent<
  "page.deleted",
  PageDeletedData
>;

/**
 * page.locked event
 */
export type PageLockedEvent = BaseWebhookEvent<
  "page.locked",
  PageLockedData
>;

/**
 * page.moved event
 */
export type PageMovedEvent = BaseWebhookEvent<"page.moved", PageMovedData>;

/**
 * page.properties_updated event
 */
export type PagePropertiesUpdatedEvent = BaseWebhookEvent<
  "page.properties_updated",
  PagePropertiesUpdatedData
>;

/**
 * page.undeleted event
 */
export type PageUndeletedEvent = BaseWebhookEvent<
  "page.undeleted",
  PageUndeletedData
>;

/**
 * page.unlocked event
 */
export type PageUnlockedEvent = BaseWebhookEvent<
  "page.unlocked",
  PageUnlockedData
>;

/**
 * database.content_updated event (deprecated in 2025-09-03 API version)
 */
export type DatabaseContentUpdatedEvent = BaseWebhookEvent<
  "database.content_updated",
  DatabaseContentUpdatedData
>;

/**
 * database.created event
 */
export type DatabaseCreatedEvent = BaseWebhookEvent<
  "database.created",
  DatabaseCreatedData
>;

/**
 * database.deleted event
 */
export type DatabaseDeletedEvent = BaseWebhookEvent<
  "database.deleted",
  DatabaseDeletedData
>;

/**
 * database.moved event
 */
export type DatabaseMovedEvent = BaseWebhookEvent<
  "database.moved",
  DatabaseMovedData
>;

/**
 * database.schema_updated event (deprecated in 2025-09-03 API version)
 */
export type DatabaseSchemaUpdatedEvent = BaseWebhookEvent<
  "database.schema_updated",
  DatabaseSchemaUpdatedData
>;

/**
 * database.undeleted event
 */
export type DatabaseUndeletedEvent = BaseWebhookEvent<
  "database.undeleted",
  DatabaseUndeletedData
>;

/**
 * data_source.content_updated event (new in 2025-09-03 API version)
 */
export type DataSourceContentUpdatedEvent = BaseWebhookEvent<
  "data_source.content_updated",
  DataSourceContentUpdatedData
>;

/**
 * data_source.created event (new in 2025-09-03 API version)
 */
export type DataSourceCreatedEvent = BaseWebhookEvent<
  "data_source.created",
  DataSourceCreatedData
>;

/**
 * data_source.deleted event (new in 2025-09-03 API version)
 */
export type DataSourceDeletedEvent = BaseWebhookEvent<
  "data_source.deleted",
  DataSourceDeletedData
>;

/**
 * data_source.moved event (new in 2025-09-03 API version)
 */
export type DataSourceMovedEvent = BaseWebhookEvent<
  "data_source.moved",
  DataSourceMovedData
>;

/**
 * data_source.schema_updated event (new in 2025-09-03 API version)
 */
export type DataSourceSchemaUpdatedEvent = BaseWebhookEvent<
  "data_source.schema_updated",
  DataSourceSchemaUpdatedData
>;

/**
 * data_source.undeleted event (new in 2025-09-03 API version)
 */
export type DataSourceUndeletedEvent = BaseWebhookEvent<
  "data_source.undeleted",
  DataSourceUndeletedData
>;

/**
 * comment.created event
 */
export type CommentCreatedEvent = BaseWebhookEvent<
  "comment.created",
  CommentCreatedData
>;

/**
 * comment.deleted event
 */
export type CommentDeletedEvent = BaseWebhookEvent<
  "comment.deleted",
  CommentDeletedData
>;

/**
 * comment.updated event
 */
export type CommentUpdatedEvent = BaseWebhookEvent<
  "comment.updated",
  CommentUpdatedData
>;

// ============================================================================
// Union Type for All Webhook Events
// ============================================================================

/**
 * Union type representing all possible Notion webhook event types
 */
export type NotionWebhookEvent =
  | PageContentUpdatedEvent
  | PageCreatedEvent
  | PageDeletedEvent
  | PageLockedEvent
  | PageMovedEvent
  | PagePropertiesUpdatedEvent
  | PageUndeletedEvent
  | PageUnlockedEvent
  | DatabaseContentUpdatedEvent
  | DatabaseCreatedEvent
  | DatabaseDeletedEvent
  | DatabaseMovedEvent
  | DatabaseSchemaUpdatedEvent
  | DatabaseUndeletedEvent
  | DataSourceContentUpdatedEvent
  | DataSourceCreatedEvent
  | DataSourceDeletedEvent
  | DataSourceMovedEvent
  | DataSourceSchemaUpdatedEvent
  | DataSourceUndeletedEvent
  | CommentCreatedEvent
  | CommentDeletedEvent
  | CommentUpdatedEvent;

// ============================================================================
// Event Type Constants
// ============================================================================

/**
 * All supported webhook event type strings
 */
export const WEBHOOK_EVENT_TYPES = {
  PAGE_CONTENT_UPDATED: "page.content_updated",
  PAGE_CREATED: "page.created",
  PAGE_DELETED: "page.deleted",
  PAGE_LOCKED: "page.locked",
  PAGE_MOVED: "page.moved",
  PAGE_PROPERTIES_UPDATED: "page.properties_updated",
  PAGE_UNDELETED: "page.undeleted",
  PAGE_UNLOCKED: "page.unlocked",
  DATABASE_CONTENT_UPDATED: "database.content_updated",
  DATABASE_CREATED: "database.created",
  DATABASE_DELETED: "database.deleted",
  DATABASE_MOVED: "database.moved",
  DATABASE_SCHEMA_UPDATED: "database.schema_updated",
  DATABASE_UNDELETED: "database.undeleted",
  DATA_SOURCE_CONTENT_UPDATED: "data_source.content_updated",
  DATA_SOURCE_CREATED: "data_source.created",
  DATA_SOURCE_DELETED: "data_source.deleted",
  DATA_SOURCE_MOVED: "data_source.moved",
  DATA_SOURCE_SCHEMA_UPDATED: "data_source.schema_updated",
  DATA_SOURCE_UNDELETED: "data_source.undeleted",
  COMMENT_CREATED: "comment.created",
  COMMENT_DELETED: "comment.deleted",
  COMMENT_UPDATED: "comment.updated",
} as const;

/**
 * Type for webhook event type strings
 */
export type WebhookEventType =
  (typeof WEBHOOK_EVENT_TYPES)[keyof typeof WEBHOOK_EVENT_TYPES];
