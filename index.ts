import { handleRoot } from "./routes/root";
import { handleIntegrationWebhook } from "./routes/webhook-integration";
import { handleLiteWebhook } from "./routes/webhook-lite";

const port = process.env.PORT || 3000;
const webhookSecret = process.env.NOTION_WEBHOOK_SECRET;
const liteWebhookApiKey = process.env.LITE_WEBHOOK_API_KEY;

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
