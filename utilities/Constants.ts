/**
 * HTTP header constants used throughout the application
 */

/**
 * Notion webhook signature header
 * Official header name per Notion docs: https://developers.notion.com/reference/webhooks
 */
export const HEADER_NOTION_SIGNATURE = "X-Notion-Signature";

/**
 * Authorization header for Bearer token authentication
 */
export const HEADER_AUTHORIZATION = "authorization";

/**
 * API key header for lite webhooks
 */
export const HEADER_X_API_KEY = "x-api-key";

/**
 * Bearer token prefix for Authorization header
 */
export const BEARER_PREFIX = "Bearer ";
