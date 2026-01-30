import { ScopedLogger } from "../logging/SimpleLogger";

/**
 * Handles webhook verification requests from Notion
 * Verification requests contain a "verification_token" field in the JSON payload
 * Note: Verification requests may also include the X-Notion-Signature header,
 * so we check the payload content rather than header presence
 * @param req - The incoming request
 * @returns Response if it's a verification request, null otherwise
 */
export async function handleVerificationRequest(
  req: Request,
): Promise<Response | null> {
  const logger = new ScopedLogger("verification");

  logger.log("info", "Checking for verification request", {
    method: req.method,
    url: req.url,
  });

  // Likely a verification request - use clone to check body without consuming original
  try {
    const clonedReq = req.clone();
    const body = await clonedReq.text();

    logger.log("debug", "Reading request body", {
      bodyLength: body.length,
      bodyPreview: body.substring(0, 200) + (body.length > 200 ? "..." : ""),
    });

    // Try to parse as JSON
    let payload: any;
    try {
      payload = JSON.parse(body);
      logger.log("debug", "Parsed JSON payload", {
        payloadKeys: payload && typeof payload === "object" ? Object.keys(payload) : null,
      });
    } catch (parseError) {
      logger.log("debug", "Failed to parse as JSON, checking if plain text token", {
        error: parseError instanceof Error ? parseError.message : String(parseError),
      });
      
      // If not JSON, check if the body itself is the token
      if (body.startsWith("secret_")) {
        logger.log("info", "Received verification token (plain text)", {
          tokenLength: body.length,
          tokenPrefix: body.substring(0, 20) + "...",
        });
        logger.end();
        return new Response(body, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      }
      
      // Not a verification request and not valid JSON
      logger.log("debug", "Not a verification request - invalid format");
      logger.end();
      return null;
    }

    // Check for verification token in JSON payload
    // According to Notion docs, the field is "verification_token"
    const token =
      payload?.verification_token ||
      payload?.challenge ||
      payload?.token ||
      payload?.secret;

    logger.log("debug", "Checking for verification token in payload", {
      hasVerificationToken: !!payload?.verification_token,
      hasChallenge: !!payload?.challenge,
      hasToken: !!payload?.token,
      hasSecret: !!payload?.secret,
      foundToken: !!token,
    });

    if (token && typeof token === "string" && token.startsWith("secret_")) {
      logger.log("info", "Received verification token", {
        tokenLength: token.length,
        tokenPrefix: token.substring(0, 20) + "...",
      });
      logger.end();
      // Echo back the token for verification (as per Notion docs)
      return new Response(token, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    logger.log("debug", "No valid verification token found in payload");
  } catch (error) {
    logger.log("error", "Error handling verification request", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Return null instead of error response - let the caller handle it
    logger.end();
    return null;
  }

  logger.end();
  return null;
}
