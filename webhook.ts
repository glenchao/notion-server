/**
 * Validates a Notion webhook signature
 * @param body - The raw request body as a string
 * @param signature - The signature from the notion-signature header
 * @param secret - The webhook secret from Notion
 * @returns Promise that resolves to true if the signature is valid, false otherwise
 */
export async function validateWebhookSignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  if (!secret) {
    return false;
  }

  try {
    // Compute HMAC-SHA256 of the body using the secret
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(body);

    // Use Web Crypto API for HMAC
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      messageData
    );

    // Convert signature to hex string
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Compare with provided signature (timing-safe comparison)
    if (computedSignature.length !== signature.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < computedSignature.length; i++) {
      result |= computedSignature.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return result === 0;
  } catch (error) {
    console.error("Error validating webhook signature:", error);
    return false;
  }
}

/**
 * Validates a Notion webhook request and returns the parsed payload if valid
 * @param request - The incoming request
 * @param secret - The webhook secret from Notion
 * @returns An object with either a valid payload or an error response
 */
export async function validateWebhookRequest(
  request: Request,
  secret: string
): Promise<
  | { valid: true; payload: unknown }
  | { valid: false; response: Response }
> {
  // Only allow POST requests
  if (request.method !== "POST") {
    return {
      valid: false,
      response: new Response("Method not allowed", { status: 405 }),
    };
  }

  // Get the signature from headers
  const signature = request.headers.get("notion-signature");
  if (!signature) {
    return {
      valid: false,
      response: new Response("Missing notion-signature header", { status: 401 }),
    };
  }

  // Check if secret is configured
  if (!secret) {
    return {
      valid: false,
      response: new Response("Webhook secret not configured", { status: 500 }),
    };
  }

  // Read the request body
  const body = await request.text();

  // Validate the webhook signature
  const isValid = await validateWebhookSignature(body, signature, secret);

  if (!isValid) {
    return {
      valid: false,
      response: new Response("Invalid webhook signature", { status: 401 }),
    };
  }

  // Parse the webhook payload
  let payload;
  try {
    payload = JSON.parse(body);
  } catch (error) {
    return {
      valid: false,
      response: new Response("Invalid JSON payload", { status: 400 }),
    };
  }

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
  apiKey: string
): Promise<
  | { valid: true; payload: unknown }
  | { valid: false; response: Response }
> {
  // Only allow POST requests
  if (request.method !== "POST") {
    return {
      valid: false,
      response: new Response("Method not allowed", { status: 405 }),
    };
  }

  // Get the API key from headers (check both Authorization Bearer and X-API-Key)
  const authHeader = request.headers.get("authorization");
  const apiKeyHeader = request.headers.get("x-api-key");
  
  let providedKey: string | null = null;
  if (authHeader?.startsWith("Bearer ")) {
    providedKey = authHeader.substring(7);
  } else if (apiKeyHeader) {
    providedKey = apiKeyHeader;
  }

  if (!providedKey) {
    return {
      valid: false,
      response: new Response("Missing API key (use Authorization: Bearer <key> or X-API-Key header)", { status: 401 }),
    };
  }

  // Check if API key is configured
  if (!apiKey) {
    return {
      valid: false,
      response: new Response("API key not configured", { status: 500 }),
    };
  }

  // Validate the API key (timing-safe comparison)
  if (providedKey.length !== apiKey.length) {
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
    return {
      valid: false,
      response: new Response("Invalid API key", { status: 401 }),
    };
  }

  // Read and parse the request body
  let payload;
  try {
    const body = await request.text();
    payload = JSON.parse(body);
  } catch (error) {
    return {
      valid: false,
      response: new Response("Invalid JSON payload", { status: 400 }),
    };
  }

  return { valid: true, payload };
}
