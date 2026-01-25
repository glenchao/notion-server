import { validateLiteWebhookRequest } from "../validation/validation";

export async function handleLiteWebhook(
  req: Request,
  liteWebhookApiKey: string
): Promise<Response> {
  console.log("[webhook-lite] Received lite webhook request", {
    method: req.method,
    url: req.url,
    hasApiKey: !!liteWebhookApiKey,
  });

  // Validate the lite webhook request using API key
  console.log("[webhook-lite] Starting validation");
  const validation = await validateLiteWebhookRequest(req, liteWebhookApiKey);

  if (!validation.valid) {
    console.error("[webhook-lite] Validation failed", {
      status: validation.response.status,
      statusText: validation.response.statusText,
    });
    return validation.response;
  }

  // Handle the validated webhook payload
  const payload = validation.payload;
  console.log("[webhook-lite] Received valid lite webhook", {
    payloadType: typeof payload,
    payloadKeys: payload && typeof payload === "object" ? Object.keys(payload) : null,
    payload: payload,
  });

  // TODO: Process the lite webhook payload here
  // For now, just return success
  console.log("[webhook-lite] Processing lite webhook payload");
  return new Response(
    JSON.stringify({ success: true, received: true, type: "lite" }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
