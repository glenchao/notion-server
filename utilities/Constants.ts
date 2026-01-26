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

/**
 * Glen's Playground database ID
 * URL: https://www.notion.so/glenchao/2f4dcaada6d6803ea6eee2a5838fa3f5
 */
export const DATABASE_GLENS_PLAYGROUND = "2f4dcaada6d6803ea6eee2a5838fa3f5";

/**
 * Vancouver House 2 database ID
 * URL: https://www.notion.so/glenchao/2e8dcaada6d68041a2ffcae1de5cff16
 */
export const DATABASE_VANCOUVER_HOUSE_2 = "2e8dcaada6d68041a2ffcae1de5cff16";

/**
 * Small Business Acquisition database ID
 * URL: https://www.notion.so/glenchao/2e2dcaada6d6806bb9a0e897ada05643
 */
export const DATABASE_SMALL_BUSINESS_ACQUISITION = "2e2dcaada6d6806bb9a0e897ada05643";
