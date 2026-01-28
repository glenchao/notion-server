/**
 * Google Gemini AI Client
 *
 * Single function to call Gemini with Google Search and Maps tools enabled.
 * Streaming by default, with optional structured output.
 */

import {
  google,
  type GoogleGenerativeAIProviderMetadata,
  type GoogleGenerativeAIProviderOptions,
} from "@ai-sdk/google";
import { streamText, Output } from "ai";
import type { z } from "zod";

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
 * Call Google Gemini with Search and Maps tools enabled.
 * Returns a streaming result by default.
 *
 * @example
 * // Basic streaming text
 * const result = await callGemini({ prompt: "What's the weather in Seattle?" });
 * for await (const chunk of result.textStream) {
 *   process.stdout.write(chunk);
 * }
 *
 * @example
 * // Structured output with schema
 * const result = await callGemini({
 *   prompt: "Find restaurants near me",
 *   location: { latitude: 47.6062, longitude: -122.3321 },
 *   schema: z.object({ restaurants: z.array(z.string()) }),
 * });
 * for await (const partial of result.experimental_partialOutputStream) {
 *   console.log(partial);
 * }
 */
export async function callGemini<T extends z.ZodTypeAny>(
  options: GeminiOptions<T>
) {
  const {
    prompt,
    location,
    schema,
    model = "gemini-2.5-flash",
    useSearch = true,
    useMaps = true,
  } = options;

  const tools: Record<string, ReturnType<typeof google.tools.googleSearch>> = {};
  if (useSearch) {
    tools.google_search = google.tools.googleSearch({});
  }
  if (useMaps) {
    tools.google_maps = google.tools.googleMaps({});
  }

  const providerOptions: { google: GoogleGenerativeAIProviderOptions } = {
    google: {
      retrievalConfig: location
        ? {
            latLng: { latitude: location.latitude, longitude: location.longitude },
          }
        : undefined,
    },
  };

  return streamText({
    model: google(model),
    tools: Object.keys(tools).length > 0 ? tools : undefined,
    prompt,
    providerOptions,
    output: schema ? Output.object({ schema }) : undefined,
  });
}

/**
 * Extract grounding metadata from provider metadata
 */
export function getGroundingMetadata(
  providerMetadata: Record<string, unknown> | undefined
) {
  const metadata = providerMetadata?.google as
    | GoogleGenerativeAIProviderMetadata
    | undefined;
  return metadata?.groundingMetadata;
}
