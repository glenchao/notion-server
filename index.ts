import { ScopedLogger, withSession } from "./logging/SimpleLogger";
import { handleRoot } from "./routes/root";
import { handleIntegrationWebhook } from "./routes/webhook-integration/webhookIntegration";
import { handleLiteWebhook } from "./routes/webhook-lite";

const logger = new ScopedLogger("startup");

const port = Bun.env.PORT || 3000;
const webhookSecret = Bun.env.NOTION_WEBHOOK_SECRET;
const liteWebhookApiKey = Bun.env.LITE_WEBHOOK_API_KEY;
const notionApiKey = Bun.env.NOTION_API_KEY;

if (!webhookSecret) {
  logger.log(
    "warn",
    "NOTION_WEBHOOK_SECRET is not set. Integration webhook validation will fail.",
  );
}

if (!liteWebhookApiKey) {
  logger.log(
    "warn",
    "LITE_WEBHOOK_API_KEY is not set. Lite webhook validation will fail.",
  );
}

if (!notionApiKey) {
  logger.log(
    "warn",
    "NOTION_API_KEY is not set. Notion API operations will fail.",
  );
}

const server = Bun.serve({
  port: Number(port),
  routes: {
    "/": withSession(handleRoot),
    "/webhook/integration": withSession((req) =>
      handleIntegrationWebhook(req, webhookSecret || ""),
    ),
    "/webhook/lite": withSession((req) =>
      handleLiteWebhook(req, liteWebhookApiKey || ""),
    ),
  },
});

logger.log("info", "Server started", {
  url: server.url.toString(),
  integrationEndpoint: `${server.url}webhook/integration`,
  liteEndpoint: `${server.url}webhook/lite`,
});
logger.end();
