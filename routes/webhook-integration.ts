import { validateWebhookRequest } from "../webhook";

export async function handleIntegrationWebhook(
  req: Request,
  webhookSecret: string
): Promise<Response> {
  // Only handle POST requests
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Check if this is a verification request (Notion sends a token starting with "secret_")
  // Verification requests typically don't have a signature header
  const hasSignature = req.headers.get("notion-signature");
  
  if (!hasSignature) {
    // Likely a verification request - use clone to check body without consuming original
    try {
      const clonedReq = req.clone();
      const body = await clonedReq.text();
      
      // Try to parse as JSON
      let payload: any;
      try {
        payload = JSON.parse(body);
      } catch {
        // If not JSON, check if the body itself is the token
        if (body.startsWith("secret_")) {
          console.log("Received verification token (plain text):", body);
          return new Response(body, {
            status: 200,
            headers: { "Content-Type": "text/plain" },
          });
        }
        // Not a verification request and not valid JSON
        return new Response("Invalid request format", { status: 400 });
      }

      // Check for verification token in JSON payload
      const token = 
        payload?.challenge || 
        payload?.token || 
        payload?.verification_token ||
        payload?.secret;

      if (token && typeof token === "string" && token.startsWith("secret_")) {
        console.log("Received verification token:", token);
        // Echo back the token for verification
        return new Response(token, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      }
    } catch (error) {
      console.error("Error handling verification:", error);
      return new Response("Internal server error", { status: 500 });
    }
  }

  // If we have a signature, this is a regular webhook - validate it
  // The original request body is still available since we used clone() above
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
