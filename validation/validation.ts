import { ScopedLogger } from "../logging/SimpleLogger";
import {
  HEADER_NOTION_SIGNATURE,
  HEADER_AUTHORIZATION,
  HEADER_X_API_KEY,
  BEARER_PREFIX,
} from "../utilities/Constants";

/**
 * Validates a Notion webhook signature
 * @param body - The raw request body as a string
 * @param signature - The signature from the X-Notion-Signature header (format: "sha256=<hash>")
 * @param secret - The webhook secret from Notion (verification_token)
 * @returns Promise that resolves to true if the signature is valid, false otherwise
 */
export async function validateWebhookSignature(
  body: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const logger = new ScopedLogger("validateWebhookSignature");

  logger.log("info", "Starting webhook signature validation", {
    bodyLength: body.length,
    signatureLength: signature.length,
    hasSecret: !!secret,
    secretLength: secret?.length || 0,
  });

  if (!secret) {
    logger.log("error", "Webhook secret is missing");
    logger.end();
    return false;
  }

  if (!signature) {
    logger.log("error", "Signature is missing");
    logger.end();
    return false;
  }

  // Extract the hash from the signature (format: "sha256=<hash>")
  let signatureHash: string;
  if (signature.startsWith("sha256=")) {
    signatureHash = signature.substring(7);
    logger.log("debug", "Extracted hash from sha256= prefix", {
      originalSignature: signature.substring(0, 20) + "...",
      hashLength: signatureHash.length,
    });
  } else {
    // Fallback: assume the signature is already just the hash
    signatureHash = signature;
    logger.log("debug", "Using signature as-is (no sha256= prefix)", {
      signatureLength: signatureHash.length,
    });
  }

  try {
    // Compute HMAC-SHA256 of the body using the secret
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(body);

    logger.log("debug", "Computing HMAC-SHA256 signature", {
      keyLength: keyData.length,
      messageLength: messageData.length,
    });

    // Use Web Crypto API for HMAC
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      messageData,
    );

    // Convert signature to hex string
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    logger.log("debug", "Computed signature", {
      computedLength: computedSignature.length,
      providedLength: signatureHash.length,
      computedPrefix: computedSignature.substring(0, 16) + "...",
      providedPrefix: signatureHash.substring(0, 16) + "...",
    });

    // Compare with provided signature (timing-safe comparison)
    if (computedSignature.length !== signatureHash.length) {
      logger.log("error", "Signature length mismatch", {
        computedLength: computedSignature.length,
        providedLength: signatureHash.length,
      });
      logger.end();
      return false;
    }

    let result = 0;
    for (let i = 0; i < computedSignature.length; i++) {
      result |= computedSignature.charCodeAt(i) ^ signatureHash.charCodeAt(i);
    }

    const isValid = result === 0;
    if (isValid) {
      logger.log("info", "Signature validation successful");
    } else {
      logger.log("error", "Signature validation failed - signatures do not match");
    }

    logger.end();
    return isValid;
  } catch (error) {
    logger.log("error", "Error validating webhook signature", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    logger.end();
    return false;
  }
}

/**
 * Validates a Notion webhook request and returns the parsed payload if valid
 * @param request - The incoming request
 * @param secret - The webhook secret from Notion (verification_token)
 * @returns An object with either a valid payload or an error response
 */
export async function validateWebhookRequest(
  request: Request,
  secret: string,
): Promise<
  | { valid: true; payload: unknown }
  | { valid: false; response: Response }
> {
  const logger = new ScopedLogger("validateWebhookRequest");

  logger.log("info", "Starting webhook request validation", {
    method: request.method,
    url: request.url,
    hasSecret: !!secret,
  });

  // Only allow POST requests
  if (request.method !== "POST") {
    logger.log("warn", "Invalid request method", {
      method: request.method,
      expected: "POST",
    });
    logger.end();
    return {
      valid: false,
      response: new Response("Method not allowed", { status: 405 }),
    };
  }

  // Get the signature from headers (official header name per Notion docs)
  const signature = request.headers.get(HEADER_NOTION_SIGNATURE);
  
  logger.log("debug", "Checking for signature header", {
    hasXNotionSignature: !!signature,
    allHeaders: Object.fromEntries(request.headers.entries()),
  });

  if (!signature) {
    logger.log("error", "Missing signature header", {
      availableHeaders: Array.from(request.headers.keys()),
    });
    logger.end();
    return {
      valid: false,
      response: new Response(`Missing ${HEADER_NOTION_SIGNATURE} header`, { status: 401 }),
    };
  }

  // Check if secret is configured
  if (!secret) {
    logger.log("error", "Webhook secret not configured");
    logger.end();
    return {
      valid: false,
      response: new Response("Webhook secret not configured", { status: 500 }),
    };
  }

  // Read the request body
  logger.log("debug", "Reading request body");
  const body = await request.text();
  logger.log("debug", "Request body read", {
    bodyLength: body.length,
    bodyPreview: body.substring(0, 200) + (body.length > 200 ? "..." : ""),
  });

  // Validate the webhook signature
  logger.log("info", "Validating webhook signature");
  const isValid = await validateWebhookSignature(body, signature, secret);

  if (!isValid) {
    logger.log("error", "Webhook signature validation failed");
    logger.end();
    return {
      valid: false,
      response: new Response("Invalid webhook signature", { status: 401 }),
    };
  }

  // Parse the webhook payload
  logger.log("debug", "Parsing webhook payload");
  let payload;
  try {
    payload = JSON.parse(body);
    logger.log("debug", "Payload parsed successfully", {
      payloadType: typeof payload,
      payloadKeys: payload && typeof payload === "object" ? Object.keys(payload) : null,
      hasType: payload && typeof payload === "object" && "type" in payload,
      hasObject: payload && typeof payload === "object" && "object" in payload,
    });
  } catch (error) {
    logger.log("error", "Failed to parse JSON payload", {
      error: error instanceof Error ? error.message : String(error),
      bodyPreview: body.substring(0, 500),
    });
    logger.end();
    return {
      valid: false,
      response: new Response("Invalid JSON payload", { status: 400 }),
    };
  }

  logger.log("info", "Webhook request validation successful");
  logger.end();
  return { valid: true, payload };
}

/**
 * Validates a lite webhook request using API key/token authentication
 * @param request - The incoming request
 * @param apiKey - The API key/token for lite webhooks
 * @returns An object with either a valid payload or an error response
 */
export async function validateLiteWebhookRequest(
  request: Request,
  apiKey: string,
): Promise<
  | { valid: true; payload: unknown }
  | { valid: false; response: Response }
> {
  const logger = new ScopedLogger("validateLiteWebhookRequest");

  logger.log("info", "Starting lite webhook request validation", {
    method: request.method,
    url: request.url,
    hasApiKey: !!apiKey,
  });

  // Only allow POST requests
  if (request.method !== "POST") {
    logger.log("warn", "Invalid request method for lite webhook", {
      method: request.method,
      expected: "POST",
    });
    logger.end();
    return {
      valid: false,
      response: new Response("Method not allowed", { status: 405 }),
    };
  }

  // Get the API key from headers (check both Authorization Bearer and X-API-Key)
  const authHeader = request.headers.get(HEADER_AUTHORIZATION);
  const apiKeyHeader = request.headers.get(HEADER_X_API_KEY);

  logger.log("debug", "Checking for API key in headers", {
    hasAuthorization: !!authHeader,
    hasXApiKey: !!apiKeyHeader,
    authHeaderPrefix: authHeader?.substring(0, 20) + "...",
  });

  let providedKey: string | null = null;
  if (authHeader?.startsWith(BEARER_PREFIX)) {
    providedKey = authHeader.substring(BEARER_PREFIX.length);
    logger.log("debug", "Extracted API key from Authorization Bearer header", {
      keyLength: providedKey.length,
      keyPrefix: providedKey.substring(0, 10) + "...",
    });
  } else if (apiKeyHeader) {
    providedKey = apiKeyHeader;
    logger.log("debug", "Extracted API key from X-API-Key header", {
      keyLength: providedKey.length,
      keyPrefix: providedKey.substring(0, 10) + "...",
    });
  }

  if (!providedKey) {
    logger.log("error", "Missing API key in headers", {
      availableHeaders: Array.from(request.headers.keys()),
    });
    logger.end();
    return {
      valid: false,
      response: new Response(
        `Missing API key (use ${HEADER_AUTHORIZATION}: Bearer <key> or ${HEADER_X_API_KEY} header)`,
        { status: 401 },
      ),
    };
  }

  // Check if API key is configured
  if (!apiKey) {
    logger.log("error", "API key not configured");
    logger.end();
    return {
      valid: false,
      response: new Response("API key not configured", { status: 500 }),
    };
  }

  // Validate the API key (timing-safe comparison)
  logger.log("debug", "Validating API key", {
    providedKeyLength: providedKey.length,
    expectedKeyLength: apiKey.length,
  });

  if (providedKey.length !== apiKey.length) {
    logger.log("error", "API key length mismatch", {
      providedLength: providedKey.length,
      expectedLength: apiKey.length,
    });
    logger.end();
    return {
      valid: false,
      response: new Response("Invalid API key", { status: 401 }),
    };
  }

  let result = 0;
  for (let i = 0; i < providedKey.length; i++) {
    result |= providedKey.charCodeAt(i) ^ apiKey.charCodeAt(i);
  }

  if (result !== 0) {
    logger.log("error", "API key validation failed - keys do not match");
    logger.end();
    return {
      valid: false,
      response: new Response("Invalid API key", { status: 401 }),
    };
  }

  logger.log("info", "API key validation successful");

  // Read and parse the request body
  logger.log("debug", "Reading and parsing request body");
  let payload;
  try {
    const body = await request.text();
    logger.log("debug", "Request body read", {
      bodyLength: body.length,
      bodyPreview: body.substring(0, 200) + (body.length > 200 ? "..." : ""),
    });
    payload = JSON.parse(body);
    logger.log("debug", "Payload parsed successfully", {
      payloadType: typeof payload,
      payloadKeys: payload && typeof payload === "object" ? Object.keys(payload) : null,
    });
  } catch (error) {
    logger.log("error", "Failed to parse JSON payload", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    logger.end();
    return {
      valid: false,
      response: new Response("Invalid JSON payload", { status: 400 }),
    };
  }

  logger.log("info", "Lite webhook request validation successful");
  logger.end();
  return { valid: true, payload };
}
