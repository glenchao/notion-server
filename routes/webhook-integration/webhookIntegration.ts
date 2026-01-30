import { getSessionData, ScopedLogger } from "../../logging/SimpleLogger.ts";
import type { NotionWebhookEvent } from "../../types/webhook-events";
import { getProcessorsToExecute } from "../../utilities/processorLoader";
import { validateWebhookRequest } from "../../validation/validation";
import { handleVerificationRequest } from "../../validation/verification";

export async function handleIntegrationWebhook(
  req: Request,
  webhookSecret: string,
): Promise<Response> {
  const logger = new ScopedLogger("handleIntegrationWebhook");

  const session = getSessionData();
  logger.log("info", "Received integration webhook request", { session });

  // Only handle POST requests
  if (req.method !== "POST") {
    logger.log("warn", "Method not allowed:", { method: req.method });
    logger.end();
    return new Response("Method not allowed", { status: 405 });
  }

  // Check if this is a verification request first
  // Verification requests contain a "verification_token" field in the payload
  // Note: Verification requests may also include the X-Notion-Signature header,
  // so we should check the payload content rather than relying on header presence
  logger.log("info", "Checking for verification request");
  const verificationResponse = await handleVerificationRequest(req);
  if (verificationResponse) {
    logger.log("info", "Handled verification request successfully");
    logger.end();
    return verificationResponse;
  }

  // If not a verification request, this is a regular webhook - validate it
  logger.log("info", "Not a verification request, starting webhook validation");
  const validation = await validateWebhookRequest(req, webhookSecret);

  if (!validation.valid) {
    logger.log("error", "Webhook validation failed:", {
      status: validation.response.status,
      statusText: validation.response.statusText,
    });
    logger.end();
    return validation.response;
  }

  // Handle the validated webhook payload
  const payload = validation.payload;
  logger.log("info", "Received valid integration webhook", {
    payloadType: typeof payload,
    payloadKeys:
      payload && typeof payload === "object" ? Object.keys(payload) : null,
    payload,
  });

  // Process the webhook payload
  try {
    const result = await handleWebhookPayload(payload);
    logger.end();
    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.log("error", "Error processing webhook payload:", {
      error: errorMessage,
    });
    logger.end();
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
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
export async function handleWebhookPayload(
  payload: NotionWebhookEvent,
): Promise<{
  eventType?: string;
  objectType?: string;
  processed: boolean;
  processorsExecuted?: number;
}> {
  const logger = new ScopedLogger("handleWebhookPayload");

  logger.log("info", "Processing webhook payload");

  if (!payload || typeof payload !== "object") {
    logger.end();
    throw new Error("Invalid payload: expected an object");
  }

  // Type assertion to NotionWebhookEvent - validation has already been done
  const webhookPayload = payload as NotionWebhookEvent;

  logger.log("info", "Processing webhook event:", {
    eventType: webhookPayload.type,
    entity: webhookPayload.entity,
    hasData: !!webhookPayload.data,
  });

  // Get all processors that should be executed
  const processorsToExecute = await getProcessorsToExecute(webhookPayload);

  // Execute all matching processors in parallel
  const executionResults = await Promise.allSettled(
    processorsToExecute.map(async (processor) => {
      logger.log("info", "Executing processor", {
        processorId: processor.id,
        processorName: processor.name,
      });
      try {
        const success = await processor.executor(webhookPayload);
        logger.log("info", `Processor ${processor.name} completed:`, {
          success,
        });
        return { processor: processor.name, success: success };
      } catch (error) {
        logger.log("error", "Processor failed", {
          processorId: processor.id,
          processorName: processor.name,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return { processor: processor.name, success: false };
      }
    }),
  );

  // Count successful executions
  const successfulExecutions = executionResults.filter(
    (result) => result.status === "fulfilled" && result.value.success === true,
  ).length;

  logger.end();
  return {
    eventType: webhookPayload.type,
    objectType: webhookPayload.entity?.type,
    processed: successfulExecutions > 0,
    processorsExecuted: successfulExecutions,
  };
}
