import { validateWebhookRequest } from "../validation/validation";
import { handleVerificationRequest } from "../validation/verification";
import { HEADER_NOTION_SIGNATURE } from "../utilities/Constants";

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

  // Check if this is a verification request first
  // Verification requests contain a "verification_token" field in the payload
  // Note: Verification requests may also include the X-Notion-Signature header,
  // so we should check the payload content rather than relying on header presence
  console.log("[webhook-integration] Checking for verification request");
  const verificationResponse = await handleVerificationRequest(req);
  if (verificationResponse) {
    console.log("[webhook-integration] Handled verification request successfully");
    return verificationResponse;
  }

  // If not a verification request, this is a regular webhook - validate it
  console.log("[webhook-integration] Not a verification request, starting webhook validation");
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

  // Process the webhook payload
  try {
    const result = await handleWebhookPayload(payload);
    return new Response(
      JSON.stringify({ success: true, ...result }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[webhook-integration] Error processing webhook payload:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

/**
 * Handles different types of webhook payloads from Notion
 * @param payload - The validated webhook payload
 * @returns Processing result
 */
async function handleWebhookPayload(payload: unknown): Promise<{
  eventType?: string;
  objectType?: string;
  processed: boolean;
}> {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid payload: expected an object");
  }

  const webhookPayload = payload as Record<string, unknown>;
  
  // Extract event information
  const eventType = webhookPayload.type as string | undefined;
  const objectType = webhookPayload.object as string | undefined;
  const eventData = webhookPayload.data as Record<string, unknown> | undefined;

  console.log("[webhook-integration] Processing webhook event:", {
    eventType,
    objectType,
    hasData: !!eventData,
  });

  // Handle page-specific events
  if (objectType === "page" || eventType?.startsWith("page.")) {
    return await handlePageWebhookEvent(eventType, eventData);
  }

  // Handle other object types if needed in the future
  console.log("[webhook-integration] Unhandled webhook object type:", objectType);
  return {
    eventType,
    objectType,
    processed: false,
  };
}

/**
 * Handles page webhook events from Notion
 * @param eventType - The type of page event (e.g., "page.created", "page.updated", "page.deleted")
 * @param eventData - The page event data
 * @returns Processing result
 */
async function handlePageWebhookEvent(
  eventType: string | undefined,
  eventData: Record<string, unknown> | undefined,
): Promise<{
  eventType?: string;
  objectType: string;
  processed: boolean;
}> {
  if (!eventData) {
    console.warn("[webhook-integration] Page event received but no data provided");
    return {
      eventType,
      objectType: "page",
      processed: false,
    };
  }

  const pageId = eventData.id as string | undefined;
  const pageTitle = eventData.title as string | undefined;
  const pageUrl = eventData.url as string | undefined;

  console.log("[webhook-integration] Processing page event:", {
    eventType,
    pageId,
    pageTitle,
    pageUrl,
  });

  // Handle different page event types
  switch (eventType) {
    case "page.created":
    case "page.added":
      console.log("[webhook-integration] Page created:", { pageId, pageTitle });
      // TODO: Add your page creation logic here
      // Example: Save to database, send notification, etc.
      break;

    case "page.updated":
    case "page.content_changed":
      console.log("[webhook-integration] Page updated:", { pageId, pageTitle });
      // TODO: Add your page update logic here
      // Example: Update database, sync changes, etc.
      break;

    case "page.deleted":
    case "page.removed":
      console.log("[webhook-integration] Page deleted:", { pageId });
      // TODO: Add your page deletion logic here
      // Example: Remove from database, cleanup resources, etc.
      break;

    default:
      console.log("[webhook-integration] Unknown page event type:", eventType);
      break;
  }

  return {
    eventType,
    objectType: "page",
    processed: true,
  };
}
