import { validateLiteWebhookRequest } from "../validation/validation";

export async function handleLiteWebhook(
  req: Request,
  liteWebhookApiKey: string
): Promise<Response> {
  // Validate the lite webhook request using API key
  const validation = await validateLiteWebhookRequest(req, liteWebhookApiKey);

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
}
