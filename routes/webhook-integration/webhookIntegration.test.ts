import { describe, expect, test, mock, spyOn, beforeEach } from "bun:test";
import { handleWebhookPayload } from "./webhookIntegration";
import type { NotionWebhookEvent } from "../../types/webhook-events";

// Import the real payload for testing
import realPayload from "../../mock/payload.vancouverHouse2.page.created.json";

describe("handleWebhookPayload", () => {
  // This test uses the real payload which triggers the Vancouver House 2 processor
  // and calls Gemini API, so it needs a longer timeout (2 minutes)
  test(
    "should process a valid page.created webhook payload",
    async () => {
      const payload = realPayload as NotionWebhookEvent;

      const result = await handleWebhookPayload(payload);

      expect(result).toBeDefined();
      expect(result.eventType).toBe("page.created");
      expect(result.objectType).toBe("page");
      expect(typeof result.processed).toBe("boolean");
      expect(typeof result.processorsExecuted).toBe("number");
    },
    { timeout: 120000 }
  );

  test("should throw error for invalid payload", async () => {
    // @ts-expect-error - testing invalid input
    await expect(handleWebhookPayload(null)).rejects.toThrow(
      "Invalid payload: expected an object"
    );
  });

  test("should return correct structure for page events", async () => {
    const payload: NotionWebhookEvent = {
      api_version: "2025-09-03",
      attempt_number: 1,
      authors: [{ id: "test-author-id", type: "person" }],
      data: {
        parent: {
          id: "test-database-id",
          type: "database",
        },
      },
      entity: { id: "test-page-id", type: "page" },
      id: "test-event-id",
      integration_id: "test-integration-id",
      subscription_id: "test-subscription-id",
      timestamp: new Date().toISOString(),
      type: "page.created",
      workspace_id: "test-workspace-id",
    };

    const result = await handleWebhookPayload(payload);

    expect(result).toMatchObject({
      eventType: "page.created",
      objectType: "page",
    });
  });

  test("should handle payload with no matching processors", async () => {
    // Create a payload that won't match any processor
    const payload: NotionWebhookEvent = {
      api_version: "2025-09-03",
      attempt_number: 1,
      authors: [{ id: "test-author-id", type: "bot" }], // bot author typically doesn't trigger
      data: {
        parent: {
          id: "non-existent-database-id",
          type: "database",
        },
      },
      entity: { id: "test-page-id", type: "page" },
      id: "test-event-id",
      integration_id: "test-integration-id",
      subscription_id: "test-subscription-id",
      timestamp: new Date().toISOString(),
      type: "page.created",
      workspace_id: "test-workspace-id",
    };

    const result = await handleWebhookPayload(payload);

    expect(result.processorsExecuted).toBe(0);
    expect(result.processed).toBe(false);
  });
});

describe("handleWebhookPayload - different event types", () => {
  test("should handle page.properties_updated event", async () => {
    const payload: NotionWebhookEvent = {
      api_version: "2025-09-03",
      attempt_number: 1,
      authors: [{ id: "test-author-id", type: "person" }],
      data: {
        parent: { id: "test-db-id", type: "database" },
        updated_properties: ["Name", "Status"],
      },
      entity: { id: "test-page-id", type: "page" },
      id: "test-event-id",
      integration_id: "test-integration-id",
      subscription_id: "test-subscription-id",
      timestamp: new Date().toISOString(),
      type: "page.properties_updated",
      workspace_id: "test-workspace-id",
    };

    const result = await handleWebhookPayload(payload);

    expect(result.eventType).toBe("page.properties_updated");
    expect(result.objectType).toBe("page");
  });

  test("should handle page.deleted event", async () => {
    const payload: NotionWebhookEvent = {
      api_version: "2025-09-03",
      attempt_number: 1,
      authors: [{ id: "test-author-id", type: "person" }],
      data: {
        parent: { id: "test-db-id", type: "database" },
      },
      entity: { id: "test-page-id", type: "page" },
      id: "test-event-id",
      integration_id: "test-integration-id",
      subscription_id: "test-subscription-id",
      timestamp: new Date().toISOString(),
      type: "page.deleted",
      workspace_id: "test-workspace-id",
    };

    const result = await handleWebhookPayload(payload);

    expect(result.eventType).toBe("page.deleted");
  });
});
