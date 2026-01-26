import { handleRoot } from "./routes/root";
import { handleIntegrationWebhook } from "./routes/webhook-integration";
import { handleLiteWebhook } from "./routes/webhook-lite";

const port = Bun.env.PORT || 3000;
const webhookSecret = Bun.env.NOTION_WEBHOOK_SECRET;
const liteWebhookApiKey = Bun.env.LITE_WEBHOOK_API_KEY;
const notionApiKey = Bun.env.NOTION_API_KEY;

if (!webhookSecret) {
  console.warn(
    "Warning: NOTION_WEBHOOK_SECRET is not set. Integration webhook validation will fail.",
  );
}

if (!liteWebhookApiKey) {
  console.warn(
    "Warning: LITE_WEBHOOK_API_KEY is not set. Lite webhook validation will fail.",
  );
}

if (!notionApiKey) {
  console.warn(
    "Warning: NOTION_API_KEY is not set. Notion API operations will fail.",
  );
}

const server = Bun.serve({
  port: Number(port),
  routes: {
    "/": () => handleRoot(),
    "/webhook/integration": async (req) =>
      handleIntegrationWebhook(req, webhookSecret || ""),
    "/webhook/lite": async (req) =>
      handleLiteWebhook(req, liteWebhookApiKey || ""),
  },
});

console.log(`Listening on ${server.url}`);
console.log(`Integration webhook endpoint: ${server.url}webhook/integration`);
console.log(`Lite webhook endpoint: ${server.url}webhook/lite`);
