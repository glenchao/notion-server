/**
 * Focused tests for the Gemini integration in vancouverHouse2Executor
 *
 * Run with: bun test executors/vancouverHouse2Executor.gemini.test.ts
 *
 * These tests hit the real Gemini API, so they require:
 * - GOOGLE_GENERATIVE_AI_API_KEY to be set in .env.local
 */

import { describe, expect, test } from "bun:test";
import {
  researchPropertyValues,
  researchSurroundings,
  buildPropertyResearchPrompt,
  buildSurroundingsResearchPrompt,
} from "./vancouverHouse2Executor";
import { callGemini } from "../modelAccess/gemini";
import { z } from "zod";

// ============================================================================
// Direct Gemini API Tests (these hit the real API)
// ============================================================================

describe("callGemini - direct API test", () => {
  test("basic text generation works", async () => {
    const result = await callGemini({
      prompt: "Say 'hello world' and nothing else.",
      useSearch: false,
      useMaps: false,
    });

    const text = await result.text;
    console.log("Gemini response:", text);

    expect(text.toLowerCase()).toContain("hello");
  }, 30000); // 30 second timeout

  test("structured output works", async () => {
    const TestSchema = z.object({
      greeting: z.string(),
      count: z.number(),
    });

    const result = await callGemini({
      prompt: "Return a greeting 'Hello' and the number 42.",
      schema: TestSchema,
      useSearch: false,
      useMaps: false,
    });

    const text = await result.text;
    console.log("Gemini text:", text);

    const output = await result.output;
    console.log("Gemini structured output:", output);

    expect(output).toBeDefined();
    expect(output?.greeting).toBeDefined();
    expect(output?.count).toBe(42);
  }, 30000);

  test("Google Search grounding works", async () => {
    const result = await callGemini({
      prompt: "What is the current weather in Vancouver, BC?",
      useSearch: true,
      useMaps: false,
    });

    const text = await result.text;
    console.log("Search grounded response:", text);

    expect(text.length).toBeGreaterThan(0);
  }, 60000); // 60 second timeout for search
});

// ============================================================================
// Property Research Tests (hit real API)
// ============================================================================

describe("researchPropertyValues - real API", () => {
  const testSchema = {
    Name: { type: "title", name: "Name" },
    Price: { type: "number", name: "Price" },
    Bedrooms: { type: "number", name: "Bedrooms" },
    Bathrooms: { type: "number", name: "Bathrooms" },
    "Year Built": { type: "number", name: "Year Built" },
    Status: {
      type: "select",
      name: "Status",
      options: ["Active", "Pending", "Sold"],
    },
  };

  const testCurrentValues = {
    Name: "888 Beach Ave #1234, Vancouver, BC",
    Price: null,
    Bedrooms: null,
    Bathrooms: null,
    "Year Built": null,
    Status: null,
  };

  test("researches property values for a real Vancouver address", async () => {
    const address = "888 Beach Ave, Vancouver, BC";

    console.log("\n--- Starting property research ---");
    console.log("Address:", address);
    console.log("Missing properties:", Object.keys(testCurrentValues).filter(k => testCurrentValues[k as keyof typeof testCurrentValues] === null));

    const result = await researchPropertyValues(
      testSchema,
      testCurrentValues,
      address
    );

    console.log("\n--- Research Result ---");
    console.log(JSON.stringify(result, null, 2));

    expect(result).not.toBeNull();
    if (result) {
      expect(result.filledProperties).toBeArray();
      expect(result.sources).toBeArray();
    }
  }, 120000); // 2 minute timeout for research
});

// ============================================================================
// Surroundings Research Tests (hit real API)
// ============================================================================

describe("researchSurroundings - real API", () => {
  test("researches surroundings for a Vancouver address", async () => {
    const address = "1000 Beach Ave, Vancouver, BC";

    console.log("\n--- Starting surroundings research ---");
    console.log("Address:", address);

    const result = await researchSurroundings(address);

    console.log("\n--- Surroundings Result ---");
    console.log(JSON.stringify(result, null, 2));

    expect(result).not.toBeNull();
    if (result) {
      expect(result.nearbyParks).toBeArray();
      expect(result.publicTransit).toBeArray();
      expect(result.transitTimes).toBeDefined();
      expect(result.sources).toBeArray();
    }
  }, 120000); // 2 minute timeout
});

// ============================================================================
// Debug Test - Run this to see exactly what's happening
// ============================================================================

describe("debug - step by step", () => {
  test("trace the full flow", async () => {
    console.log("\n========================================");
    console.log("DEBUG: Step-by-step Gemini call trace");
    console.log("========================================\n");

    const schema = {
      Price: { type: "number", name: "Price" },
      Bedrooms: { type: "number", name: "Bedrooms" },
    };

    const currentValues = {
      Price: null,
      Bedrooms: null,
    };

    const address = "123 Main St, Vancouver, BC";

    // Step 1: Build the prompt
    console.log("Step 1: Building prompt...");
    const prompt = buildPropertyResearchPrompt(
      schema,
      currentValues,
      address,
      ["Price", "Bedrooms"]
    );
    console.log("Prompt length:", prompt.length);
    console.log("Prompt preview:", prompt.substring(0, 500) + "...\n");

    // Step 2: Define the schema for Gemini
    console.log("Step 2: Defining Zod schema for structured output...");
    const PropertyValuesSchema = z.object({
      filledProperties: z.array(
        z.object({
          propertyName: z.string(),
          value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]),
          confidence: z.enum(["high", "medium", "low"]),
        })
      ),
      sources: z.array(z.string()),
      notes: z.string().optional(),
    });

    // Step 3: Call Gemini
    console.log("Step 3: Calling Gemini...");
    console.log("Model: gemini-2.5-pro");
    console.log("useSearch: true");
    console.log("useMaps: true");

    try {
      const startTime = Date.now();

      const result = await callGemini({
        prompt,
        schema: PropertyValuesSchema,
        model: "gemini-2.5-pro",
        useSearch: true,
        useMaps: true,
      });

      console.log("\nStep 4: Consuming stream...");

      // Get the text response
      const text = await result.text;
      console.log("Text response received in", Date.now() - startTime, "ms");
      console.log("Text length:", text.length);
      console.log("Text preview:", text.substring(0, 300) + "...\n");

      // Get the structured output
      console.log("Step 5: Getting structured output...");
      const output = await result.output;
      console.log("Structured output:", JSON.stringify(output, null, 2));

      console.log("\n========================================");
      console.log("SUCCESS! Total time:", Date.now() - startTime, "ms");
      console.log("========================================\n");

      expect(output).toBeDefined();
    } catch (error) {
      console.error("\n========================================");
      console.error("ERROR in Gemini call:");
      console.error("========================================");
      console.error(error);

      if (error instanceof Error) {
        console.error("\nError name:", error.name);
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }

      throw error;
    }
  }, 180000); // 3 minute timeout
});
