import { validateWebhookRequest } from "../validation/validation";
import { handleVerificationRequest } from "../validation/verification";

export async function handleIntegrationWebhook(
  req: Request,
  webhookSecret: string,
): Promise<Response> {
  console.log("[webhook-integration] Received integration webhook request", {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries()),
  });

  // Only handle POST requests
  if (req.method !== "POST") {
    console.warn("[webhook-integration] Method not allowed:", req.method);
    return new Response("Method not allowed", { status: 405 });
  }

  // Check if this is a verification request (Notion sends a token starting with "secret_")
  // Verification requests typically don't have a signature header
  const hasSignature = req.headers.get("notion-signature");
  console.log("[webhook-integration] Signature check:", {
    hasSignature: !!hasSignature,
  });

  if (!hasSignature) {
    console.log("[webhook-integration] No signature found, checking for verification request");
    const verificationResponse = await handleVerificationRequest(req);
    if (verificationResponse) {
      console.log("[webhook-integration] Handled verification request successfully");
      return verificationResponse;
    }
    console.log("[webhook-integration] Not a verification request, continuing with validation");
  }

  // If we have a signature, this is a regular webhook - validate it
  // The original request body is still available since we used clone() above
  console.log("[webhook-integration] Starting webhook validation");
  const validation = await validateWebhookRequest(req, webhookSecret);

  if (!validation.valid) {
    console.error("[webhook-integration] Webhook validation failed:", {
      status: validation.response.status,
      statusText: validation.response.statusText,
    });
    return validation.response;
  }

  // Handle the validated webhook payload
  const payload = validation.payload;
  console.log("[webhook-integration] Received valid integration webhook:", {
    payloadType: typeof payload,
    payloadKeys: payload && typeof payload === "object" ? Object.keys(payload) : null,
    payload: payload,
  });

  // TODO: Process the integration webhook payload here
  // For now, just return success
  console.log("[webhook-integration] Processing webhook payload and returning success");
  return new Response(
    JSON.stringify({ success: true, received: true, type: "integration" }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}
