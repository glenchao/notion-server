/**
 * Examples of using Google Gemini with AI SDK
 * 
 * These examples demonstrate how to use:
 * - Structured outputs with Zod schemas
 * - Google Search grounding
 * - Google Maps grounding
 * - Combining all features together
 */

import {
  generateTextWithSearch,
  generateTextWithMaps,
  generateStructuredOutput,
  generateTextWithSearchAndMaps,
  generateStructuredOutputWithTools,
  streamTextWithSearch,
  google,
  SUPPORTED_MODELS,
} from '../modelAccess/gemini';
import { generateText, generateObject } from 'ai';
import { z } from 'zod';

/**
 * Example 1: Basic text generation with Google Search
 */
export async function exampleSearch() {
  const result = await generateTextWithSearch(
    'What are the top 5 AI news stories from the past week? Include dates for each story.'
  );

  console.log('Generated Text:', result.text);
  console.log('Sources:', result.sources);
  console.log('Grounding Metadata:', result.groundingMetadata);
}

/**
 * Example 2: Text generation with Google Maps
 */
export async function exampleMaps() {
  // Los Angeles coordinates
  const location = { latitude: 34.050481, longitude: -118.248526 };

  const result = await generateTextWithMaps(
    'What are the best Italian restaurants within a 15-minute walk from here?',
    location
  );

  console.log('Generated Text:', result.text);
  console.log('Sources:', result.sources);
  console.log('Grounding Metadata:', result.groundingMetadata);
}

/**
 * Example 3: Structured output with Zod schema
 */
export async function exampleStructuredOutput() {
  const recipeSchema = z.object({
    recipe_name: z.string().describe('The name of the recipe'),
    prep_time_minutes: z.number().optional().describe('Time in minutes to prepare'),
    ingredients: z.array(
      z.object({
        name: z.string().describe('Name of the ingredient'),
        quantity: z.string().describe('Quantity with units'),
      })
    ),
    instructions: z.array(z.string()),
  });

  const recipe = await generateStructuredOutput(
    `Extract the recipe from: The user wants to make chocolate chip cookies.
    They need 2 cups of flour, 1 cup of sugar, 1/2 cup of butter, and 2 eggs.
    First, mix the dry ingredients. Then cream the butter and sugar.
    Add eggs and mix. Finally, add flour and bake at 375°F for 10 minutes.`,
    recipeSchema
  );

  console.log('Structured Recipe:', recipe);
}

/**
 * Example 4: Combining Google Search and Google Maps
 */
export async function exampleSearchAndMaps() {
  const location = { latitude: 37.7749, longitude: -122.4194 }; // San Francisco

  const result = await generateTextWithSearchAndMaps(
    'What are the best coffee shops near me, and what are people saying about them online?',
    location
  );

  console.log('Generated Text:', result.text);
  console.log('Sources:', result.sources);
}

/**
 * Example 5: Structured output with Google Search and Google Maps
 * This demonstrates all three features working together
 */
export async function exampleAllFeatures() {
  const restaurantSchema = z.object({
    restaurants: z.array(
      z.object({
        name: z.string(),
        address: z.string(),
        rating: z.number(),
        price_level: z.enum(['$', '$$', '$$$', '$$$$']).optional(),
        review_summary: z.string().describe('Summary of recent reviews'),
        distance_meters: z.number().optional(),
      })
    ),
  });

  const location = { latitude: 40.7589, longitude: -73.9851 }; // New York City

  const result = await generateStructuredOutputWithTools(
    'Find the top 3 Italian restaurants near Times Square with the best recent reviews. Include their addresses, ratings, and a summary of what people are saying.',
    restaurantSchema,
    location
  );

  console.log('Structured Restaurants:', result.object);
  console.log('Sources:', result.sources);
  console.log('Grounding Metadata:', result.groundingMetadata);
}

/**
 * Example 6: Using the model directly with advanced configuration
 */
export async function exampleDirectModel() {
  const { text, providerMetadata } = await generateText({
    model: google(SUPPORTED_MODELS.PRO_PREVIEW),
    tools: {
      google_search: google.tools.googleSearch({
        mode: 'MODE_DYNAMIC', // Only search when needed
      }),
      google_maps: google.tools.googleMaps({}),
    },
    providerOptions: {
      google: {
        retrievalConfig: {
          latLng: { latitude: 34.050481, longitude: -118.248526 },
        },
        thinkingConfig: {
          thinkingLevel: 'high', // For Gemini 3 models
          includeThoughts: true,
        },
      },
    },
    prompt: 'Plan a day trip in Los Angeles. Include restaurants, attractions, and current events happening today.',
  });

  console.log('Generated Text:', text);
  console.log('Provider Metadata:', providerMetadata);
}

/**
 * Example 7: Streaming with Google Search
 */
export async function exampleStreaming() {
  const result = await streamTextWithSearch(
    'What are the latest developments in AI research?'
  );

  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }

  console.log('\n\nFull Text:', await result.text);
  console.log('Sources:', await result.sources);
}

/**
 * Example 8: Structured output with URL Context and Search
 */
export async function exampleWithUrlContext() {
  const summarySchema = z.object({
    title: z.string(),
    key_points: z.array(z.string()),
    author: z.string().optional(),
    date: z.string().optional(),
  });

  const { object, sources } = await generateObject({
    model: google(SUPPORTED_MODELS.PRO_PREVIEW),
    schema: summarySchema,
    tools: {
      google_search: google.tools.googleSearch({}),
      url_context: google.tools.urlContext({}),
    },
    prompt: `Based on this URL: https://ai.google.dev/gemini-api/docs/structured-output,
            summarize the key points about structured outputs.
            Also search for the latest updates about Gemini structured outputs.`,
  });

  console.log('Structured Summary:', object);
  console.log('Sources:', sources);
}

// Run examples (uncomment to test)
// exampleSearch();
// exampleMaps();
// exampleStructuredOutput();
// exampleSearchAndMaps();
// exampleAllFeatures();
// exampleDirectModel();
// exampleStreaming();
// exampleWithUrlContext();
