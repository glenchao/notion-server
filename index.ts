import { Client } from "@notionhq/client";
import { validateWebhookRequest, validateLiteWebhookRequest } from "./webhook";

const port = process.env.PORT || 3000;
const webhookSecret = process.env.NOTION_WEBHOOK_SECRET;
const liteWebhookApiKey = process.env.LITE_WEBHOOK_API_KEY;

if (!webhookSecret) {
  console.warn("Warning: NOTION_WEBHOOK_SECRET is not set. Integration webhook validation will fail.");
}

if (!liteWebhookApiKey) {
  console.warn("Warning: LITE_WEBHOOK_API_KEY is not set. Lite webhook validation will fail.");
}

const server = Bun.serve({
  port: Number(port),
  routes: {
    "/": () => new Response("Bun Notion Webhook Server!"),
    "/webhook/integration": async (req) => {
      // Validate the integration webhook request using HMAC signature
      const validation = await validateWebhookRequest(req, webhookSecret || "");

      if (!validation.valid) {
        return validation.response;
      }

      // Handle the validated webhook payload
      const payload = validation.payload;
      console.log("Received valid integration webhook:", payload);

      // TODO: Process the integration webhook payload here
      // For now, just return success
      return new Response(
        JSON.stringify({ success: true, received: true, type: "integration" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    },
    "/webhook/lite": async (req) => {
      // Validate the lite webhook request using API key
      const validation = await validateLiteWebhookRequest(req, liteWebhookApiKey || "");

      if (!validation.valid) {
        return validation.response;
      }

      // Handle the validated webhook payload
      const payload = validation.payload;
      console.log("Received valid lite webhook:", payload);

      // TODO: Process the lite webhook payload here
      // For now, just return success
      return new Response(
        JSON.stringify({ success: true, received: true, type: "lite" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    },
  },
});

console.log(`Listening on ${server.url}`);
console.log(`Integration webhook endpoint: ${server.url}/webhook/integration`);
console.log(`Lite webhook endpoint: ${server.url}/webhook/lite`);