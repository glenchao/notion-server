import { validateWebhookRequest } from "../webhook";

export async function handleIntegrationWebhook(
  req: Request,
  webhookSecret: string
): Promise<Response> {
  // Validate the integration webhook request using HMAC signature
  const validation = await validateWebhookRequest(req, webhookSecret);

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
}
