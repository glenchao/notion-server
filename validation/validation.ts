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
  console.log("[validation] Starting webhook signature validation", {
    bodyLength: body.length,
    signatureLength: signature.length,
    hasSecret: !!secret,
    secretLength: secret?.length || 0,
  });

  if (!secret) {
    console.error("[validation] Webhook secret is missing");
    return false;
  }

  if (!signature) {
    console.error("[validation] Signature is missing");
    return false;
  }

  // Extract the hash from the signature (format: "sha256=<hash>")
  let signatureHash: string;
  if (signature.startsWith("sha256=")) {
    signatureHash = signature.substring(7);
    console.log("[validation] Extracted hash from sha256= prefix", {
      originalSignature: signature.substring(0, 20) + "...",
      hashLength: signatureHash.length,
    });
  } else {
    // Fallback: assume the signature is already just the hash
    signatureHash = signature;
    console.log("[validation] Using signature as-is (no sha256= prefix)", {
      signatureLength: signatureHash.length,
    });
  }

  try {
    // Compute HMAC-SHA256 of the body using the secret
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(body);

    console.log("[validation] Computing HMAC-SHA256 signature", {
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

    console.log("[validation] Computed signature", {
      computedLength: computedSignature.length,
      providedLength: signatureHash.length,
      computedPrefix: computedSignature.substring(0, 16) + "...",
      providedPrefix: signatureHash.substring(0, 16) + "...",
    });

    // Compare with provided signature (timing-safe comparison)
    if (computedSignature.length !== signatureHash.length) {
      console.error("[validation] Signature length mismatch", {
        computedLength: computedSignature.length,
        providedLength: signatureHash.length,
      });
      return false;
    }

    let result = 0;
    for (let i = 0; i < computedSignature.length; i++) {
      result |= computedSignature.charCodeAt(i) ^ signatureHash.charCodeAt(i);
    }

    const isValid = result === 0;
    if (isValid) {
      console.log("[validation] Signature validation successful");
    } else {
      console.error("[validation] Signature validation failed - signatures do not match");
    }

    return isValid;
  } catch (error) {
    console.error("[validation] Error validating webhook signature:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
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
  console.log("[validation] Starting webhook request validation", {
    method: request.method,
    url: request.url,
    hasSecret: !!secret,
  });

  // Only allow POST requests
  if (request.method !== "POST") {
    console.warn("[validation] Invalid request method", {
      method: request.method,
      expected: "POST",
    });
    return {
      valid: false,
      response: new Response("Method not allowed", { status: 405 }),
    };
  }

  // Get the signature from headers (official header name per Notion docs)
  const signature = request.headers.get(HEADER_NOTION_SIGNATURE);
  
  console.log("[validation] Checking for signature header", {
    hasXNotionSignature: !!signature,
    allHeaders: Object.fromEntries(request.headers.entries()),
  });

  if (!signature) {
    console.error("[validation] Missing signature header", {
      availableHeaders: Array.from(request.headers.keys()),
    });
    return {
      valid: false,
      response: new Response(`Missing ${HEADER_NOTION_SIGNATURE} header`, { status: 401 }),
    };
  }

  // Check if secret is configured
  if (!secret) {
    console.error("[validation] Webhook secret not configured");
    return {
      valid: false,
      response: new Response("Webhook secret not configured", { status: 500 }),
    };
  }

  // Read the request body
  console.log("[validation] Reading request body");
  const body = await request.text();
  console.log("[validation] Request body read", {
    bodyLength: body.length,
    bodyPreview: body.substring(0, 200) + (body.length > 200 ? "..." : ""),
  });

  // Validate the webhook signature
  console.log("[validation] Validating webhook signature");
  const isValid = await validateWebhookSignature(body, signature, secret);

  if (!isValid) {
    console.error("[validation] Webhook signature validation failed");
    return {
      valid: false,
      response: new Response("Invalid webhook signature", { status: 401 }),
    };
  }

  // Parse the webhook payload
  console.log("[validation] Parsing webhook payload");
  let payload;
  try {
    payload = JSON.parse(body);
    console.log("[validation] Payload parsed successfully", {
      payloadType: typeof payload,
      payloadKeys: payload && typeof payload === "object" ? Object.keys(payload) : null,
      hasType: payload && typeof payload === "object" && "type" in payload,
      hasObject: payload && typeof payload === "object" && "object" in payload,
    });
  } catch (error) {
    console.error("[validation] Failed to parse JSON payload", {
      error: error instanceof Error ? error.message : String(error),
      bodyPreview: body.substring(0, 500),
    });
    return {
      valid: false,
      response: new Response("Invalid JSON payload", { status: 400 }),
    };
  }

  console.log("[validation] Webhook request validation successful");
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
  console.log("[validation] Starting lite webhook request validation", {
    method: request.method,
    url: request.url,
    hasApiKey: !!apiKey,
  });

  // Only allow POST requests
  if (request.method !== "POST") {
    console.warn("[validation] Invalid request method for lite webhook", {
      method: request.method,
      expected: "POST",
    });
    return {
      valid: false,
      response: new Response("Method not allowed", { status: 405 }),
    };
  }

  // Get the API key from headers (check both Authorization Bearer and X-API-Key)
  const authHeader = request.headers.get(HEADER_AUTHORIZATION);
  const apiKeyHeader = request.headers.get(HEADER_X_API_KEY);

  console.log("[validation] Checking for API key in headers", {
    hasAuthorization: !!authHeader,
    hasXApiKey: !!apiKeyHeader,
    authHeaderPrefix: authHeader?.substring(0, 20) + "...",
  });

  let providedKey: string | null = null;
  if (authHeader?.startsWith(BEARER_PREFIX)) {
    providedKey = authHeader.substring(BEARER_PREFIX.length);
    console.log("[validation] Extracted API key from Authorization Bearer header", {
      keyLength: providedKey.length,
      keyPrefix: providedKey.substring(0, 10) + "...",
    });
  } else if (apiKeyHeader) {
    providedKey = apiKeyHeader;
    console.log("[validation] Extracted API key from X-API-Key header", {
      keyLength: providedKey.length,
      keyPrefix: providedKey.substring(0, 10) + "...",
    });
  }

  if (!providedKey) {
    console.error("[validation] Missing API key in headers", {
      availableHeaders: Array.from(request.headers.keys()),
    });
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
    console.error("[validation] API key not configured");
    return {
      valid: false,
      response: new Response("API key not configured", { status: 500 }),
    };
  }

  // Validate the API key (timing-safe comparison)
  console.log("[validation] Validating API key", {
    providedKeyLength: providedKey.length,
    expectedKeyLength: apiKey.length,
  });

  if (providedKey.length !== apiKey.length) {
    console.error("[validation] API key length mismatch", {
      providedLength: providedKey.length,
      expectedLength: apiKey.length,
    });
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
    console.error("[validation] API key validation failed - keys do not match");
    return {
      valid: false,
      response: new Response("Invalid API key", { status: 401 }),
    };
  }

  console.log("[validation] API key validation successful");

  // Read and parse the request body
  console.log("[validation] Reading and parsing request body");
  let payload;
  try {
    const body = await request.text();
    console.log("[validation] Request body read", {
      bodyLength: body.length,
      bodyPreview: body.substring(0, 200) + (body.length > 200 ? "..." : ""),
    });
    payload = JSON.parse(body);
    console.log("[validation] Payload parsed successfully", {
      payloadType: typeof payload,
      payloadKeys: payload && typeof payload === "object" ? Object.keys(payload) : null,
    });
  } catch (error) {
    console.error("[validation] Failed to parse JSON payload", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return {
      valid: false,
      response: new Response("Invalid JSON payload", { status: 400 }),
    };
  }

  console.log("[validation] Lite webhook request validation successful");
  return { valid: true, payload };
}
