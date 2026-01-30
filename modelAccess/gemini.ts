/**
 * Google Gemini AI Client
 *
 * Single function to call Gemini with Google Search and Maps tools enabled.
 * Streaming by default, with optional structured output.
 *
 * IMPORTANT: Gemini API does NOT support using tools (Search/Maps) AND
 * structured JSON output at the same time. When both are needed, we use
 * a two-step approach:
 * 1. First call with tools to gather research (text output)
 * 2. Second call without tools to parse into structured output
 */

import {
  google,
  type GoogleGenerativeAIProviderMetadata,
  type GoogleGenerativeAIProviderOptions,
} from "@ai-sdk/google";
import { Output, streamText, generateText } from "ai";
import type { z } from "zod";
import { ScopedLogger } from "../logging/SimpleLogger.ts";

export interface GeminiOptions<T extends z.ZodTypeAny = z.ZodTypeAny> {
  /** The prompt to send to Gemini */
  prompt: string;
  /** Optional location for Maps grounding */
  location?: { latitude: number; longitude: number };
  /** Optional Zod schema for structured output */
  schema?: T;
  /** Model to use (defaults to gemini-2.5-flash for speed + full tool support) */
  model?: "gemini-2.5-pro" | "gemini-2.5-flash" | "gemini-2.5-flash-lite";
  /** Enable Google Search grounding (default: true) */
  useSearch?: boolean;
  /** Enable Google Maps grounding (default: true) */
  useMaps?: boolean;
}

/**
 * Result type that mimics the streaming result interface
 */
export interface GeminiResult<T> {
  /** The full text response (awaitable) */
  text: Promise<string>;
  /** The structured output if schema was provided (awaitable) */
  output: Promise<T | undefined>;
  /** Raw research text from tool-grounded call (if tools were used) */
  researchText?: Promise<string>;
}

/**
 * Builds a GeminiResult from a streamText result
 * (streamText returns PromiseLike which needs conversion to Promise)
 */
function buildResult<T>(
  streamResult: { text: PromiseLike<string>; output?: PromiseLike<unknown> },
  researchText?: string,
): GeminiResult<T> {
  return {
    text: Promise.resolve(streamResult.text),
    output: streamResult.output
      ? (Promise.resolve(streamResult.output) as Promise<T | undefined>)
      : Promise.resolve(undefined),
    ...(researchText !== undefined && { researchText: Promise.resolve(researchText) }),
  };
}

/**
 * Call Google Gemini with Search and Maps tools enabled.
 *
 * NOTE: When using BOTH tools (search/maps) AND a schema for structured output,
 * this function performs a two-step call:
 * 1. First call with tools to gather research information
 * 2. Second call to parse the research into structured JSON
 *
 * This is necessary because Gemini's API doesn't support tools + JSON output together.
 *
 * @example
 * // Basic text with search
 * const result = await callGemini({ prompt: "What's the weather in Seattle?" });
 * const text = await result.text;
 *
 * @example
 * // Structured output with schema (and optional search/maps)
 * const result = await callGemini({
 *   prompt: "Find info about this property",
 *   schema: z.object({ price: z.number(), bedrooms: z.number() }),
 *   useSearch: true,
 * });
 * const data = await result.output;
 */
export async function callGemini<T extends z.ZodTypeAny>(
  options: GeminiOptions<T>,
): Promise<GeminiResult<z.infer<T>>> {
  const {
    prompt,
    location,
    schema,
    model = "gemini-2.5-flash",
    useSearch = true,
    useMaps = true,
  } = options;

  const logger = new ScopedLogger("callGemini");
  const hasTools = useSearch || useMaps;
  const hasSchema = !!schema;

  logger.log("info", "Calling Gemini", {
    model,
    hasTools,
    hasSchema,
    useSearch,
    useMaps,
    promptLength: prompt.length,
  });

  // Case 1: Tools + Schema -> Two-step approach
  if (hasTools && hasSchema) {
    logger.log("info", "Using two-step approach (tools + schema)");
    return callGeminiTwoStep(options, logger);
  }

  // Case 2: Tools only (no schema) -> Single call with tools
  if (hasTools && !hasSchema) {
    logger.log("info", "Using tools-only call");
    return callGeminiWithTools(options, logger);
  }

  // Case 3: Schema only (no tools) -> Single call with structured output
  if (!hasTools && hasSchema) {
    logger.log("info", "Using schema-only call");
    return callGeminiWithSchema(options, logger);
  }

  // Case 4: Neither tools nor schema -> Simple text call
  logger.log("info", "Using simple text call");
  return callGeminiSimple(options, logger);
}

/**
 * Two-step approach: First call with tools, then parse with schema
 */
async function callGeminiTwoStep<T extends z.ZodTypeAny>(
  options: GeminiOptions<T>,
  logger: ScopedLogger,
): Promise<GeminiResult<z.infer<T>>> {
  const { prompt, location, schema, model = "gemini-2.5-flash", useSearch, useMaps } = options;

  // Step 1: Call with tools to gather research
  const tools: Record<string, ReturnType<typeof google.tools.googleSearch>> = {};
  if (useSearch) tools.google_search = google.tools.googleSearch({});
  if (useMaps) tools.google_maps = google.tools.googleMaps({});

  const providerOptions: { google: GoogleGenerativeAIProviderOptions } = {
    google: {
      retrievalConfig: location
        ? { latLng: { latitude: location.latitude, longitude: location.longitude } }
        : undefined,
    },
  };

  logger.log("info", "Step 1: Calling with tools for research...");

  const researchResult = await generateText({
    model: google(model),
    tools,
    prompt,
    providerOptions,
  });

  const researchText = researchResult.text;
  logger.log("info", "Step 1 complete", { researchTextLength: researchText.length });
  logger.log("debug", "Research text preview", { preview: researchText.substring(0, 500) });

  // Step 2: Parse the research into structured output
  logger.log("info", "Step 2: Parsing into structured output...");

  const parsePrompt = `Based on the following research, extract the information into the required JSON format.

RESEARCH DATA:
${researchText}

ORIGINAL REQUEST:
${prompt}

Extract the relevant information and return it in the structured format specified.`;

  const parseResult = await streamText({
    model: google(model),
    prompt: parsePrompt,
    output: Output.object({ schema: schema! }),
  });

  logger.log("info", "Step 2 complete");
  logger.end();

  return buildResult<z.infer<T>>(parseResult, researchText);
}

/**
 * Call with tools only (no structured output)
 */
async function callGeminiWithTools<T extends z.ZodTypeAny>(
  options: GeminiOptions<T>,
  logger: ScopedLogger,
): Promise<GeminiResult<z.infer<T>>> {
  const { prompt, location, model = "gemini-2.5-flash", useSearch, useMaps } = options;

  const tools: Record<string, ReturnType<typeof google.tools.googleSearch>> = {};
  if (useSearch) tools.google_search = google.tools.googleSearch({});
  if (useMaps) tools.google_maps = google.tools.googleMaps({});

  const providerOptions: { google: GoogleGenerativeAIProviderOptions } = {
    google: {
      retrievalConfig: location
        ? { latLng: { latitude: location.latitude, longitude: location.longitude } }
        : undefined,
    },
  };

  const result = await streamText({
    model: google(model),
    tools,
    prompt,
    providerOptions,
  });

  logger.end();

  return buildResult<z.infer<T>>(result);
}

/**
 * Call with schema only (no tools)
 */
async function callGeminiWithSchema<T extends z.ZodTypeAny>(
  options: GeminiOptions<T>,
  logger: ScopedLogger,
): Promise<GeminiResult<z.infer<T>>> {
  const { prompt, schema, model = "gemini-2.5-flash" } = options;

  const result = await streamText({
    model: google(model),
    prompt,
    output: Output.object({ schema: schema! }),
  });

  logger.end();

  return buildResult<z.infer<T>>(result);
}

/**
 * Simple text call (no tools, no schema)
 */
async function callGeminiSimple<T extends z.ZodTypeAny>(
  options: GeminiOptions<T>,
  logger: ScopedLogger,
): Promise<GeminiResult<z.infer<T>>> {
  const { prompt, model = "gemini-2.5-flash" } = options;

  const result = await streamText({
    model: google(model),
    prompt,
  });

  logger.end();

  return buildResult<z.infer<T>>(result);
}

/**
 * Extract grounding metadata from provider metadata
 */
export function getGroundingMetadata(
  providerMetadata: Record<string, unknown> | undefined,
) {
  const metadata = providerMetadata?.google as
    | GoogleGenerativeAIProviderMetadata
    | undefined;
  return metadata?.groundingMetadata;
}
