/**
 * Handles webhook verification requests from Notion
 * Verification requests typically don't have a signature header and contain a token starting with "secret_"
 * @param req - The incoming request
 * @returns Response if it's a verification request, null otherwise
 */
export async function handleVerificationRequest(
  req: Request,
): Promise<Response | null> {
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

  return null;
}
