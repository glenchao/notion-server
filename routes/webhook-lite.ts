import { ScopedLogger } from "../logging/SimpleLogger";
import { validateLiteWebhookRequest } from "../validation/validation";

export async function handleLiteWebhook(
  req: Request,
  liteWebhookApiKey: string,
): Promise<Response> {
  const logger = new ScopedLogger("webhook-lite");

  logger.log("info", "Received lite webhook request", {
    method: req.method,
    url: req.url,
    hasApiKey: !!liteWebhookApiKey,
  });

  // Validate the lite webhook request using API key
  logger.log("info", "Starting validation");
  const validation = await validateLiteWebhookRequest(req, liteWebhookApiKey);

  if (!validation.valid) {
    logger.log("error", "Validation failed", {
      status: validation.response.status,
      statusText: validation.response.statusText,
    });
    logger.end();
    return validation.response;
  }

  // Handle the validated webhook payload
  const payload = validation.payload;
  logger.log("info", "Received valid lite webhook", {
    payloadType: typeof payload,
    payloadKeys:
      payload && typeof payload === "object" ? Object.keys(payload) : null,
    payload: payload,
  });

  // TODO: Process the lite webhook payload here
  // For now, just return success
  logger.log("info", "Processing lite webhook payload");
  logger.end();
  return new Response(
    JSON.stringify({ success: true, received: true, type: "lite" }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}
