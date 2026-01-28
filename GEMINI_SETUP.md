# Google Gemini AI SDK Setup

This project is configured to use the Vercel AI SDK with Google Gemini provider, supporting the most advanced models with Google Maps, Google Search, and structured outputs.

## Setup

### 1. Install Dependencies

Dependencies are already installed:
- `@ai-sdk/google` - Google Gemini provider for AI SDK
- `ai` - Vercel AI SDK core
- `zod` - Schema validation for structured outputs

### 2. Environment Variables

Create a `.env` file in the project root with your Google API key:

```bash
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
```

Get your API key from: https://aistudio.google.com/apikey

### 3. Supported Models

The following models support **all three features** (structured outputs, Google Search, Google Maps):

| Model | Description | Best For |
|-------|-------------|----------|
| `gemini-3-pro-preview` | Most advanced model | Complex tasks, best quality |
| `gemini-3-flash-preview` | Fast and capable | Speed + quality balance |
| `gemini-2.5-pro` | Stable production model | Production applications |
| `gemini-2.5-flash` | Fast and efficient | High-throughput scenarios |

**Recommended**: Use `gemini-3-pro-preview` for the most advanced capabilities.

## Features

### 1. Structured Outputs

Generate type-safe, validated JSON responses using Zod schemas:

```typescript
import { generateStructuredOutput } from './modelAccess/gemini';
import { z } from 'zod';

const schema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string().email(),
});

const result = await generateStructuredOutput(
  'Extract user information from: John Doe, 30, john@example.com',
  schema
);
```

### 2. Google Search Grounding

Access real-time web information with automatic citations:

```typescript
import { generateTextWithSearch } from './modelAccess/gemini';

const result = await generateTextWithSearch(
  'What are the top 5 AI news stories from the past week?'
);

console.log(result.text); // Generated text with citations
console.log(result.sources); // Source URLs
console.log(result.groundingMetadata); // Detailed grounding info
```

### 3. Google Maps Grounding

Get location-aware responses with Google Maps data:

```typescript
import { generateTextWithMaps } from './modelAccess/gemini';

const result = await generateTextWithMaps(
  'What are the best Italian restaurants within a 15-minute walk?',
  { latitude: 34.050481, longitude: -118.248526 } // Optional location
);

console.log(result.text);
console.log(result.sources); // Google Maps links
```

### 4. Combining All Features

Use structured outputs with both Google Search and Google Maps:

```typescript
import { generateStructuredOutputWithTools } from './modelAccess/gemini';
import { z } from 'zod';

const restaurantSchema = z.object({
  restaurants: z.array(
    z.object({
      name: z.string(),
      address: z.string(),
      rating: z.number(),
      review_summary: z.string(),
    })
  ),
});

const result = await generateStructuredOutputWithTools(
  'Find top 3 Italian restaurants near Times Square with recent reviews',
  restaurantSchema,
  { latitude: 40.7589, longitude: -73.9851 }
);

console.log(result.object); // Type-safe structured data
console.log(result.sources); // Citations from Search and Maps
```

## Usage Examples

See `examples/geminiExamples.ts` for comprehensive examples including:

- Basic text generation with search
- Location-based queries with Maps
- Structured data extraction
- Combining multiple tools
- Streaming responses
- Advanced configuration

## API Reference

### Utility Functions

#### `generateTextWithSearch(prompt: string)`
Generate text with Google Search grounding.

#### `generateTextWithMaps(prompt: string, location?: { latitude: number; longitude: number })`
Generate text with Google Maps grounding.

#### `generateStructuredOutput<T>(prompt: string, schema: T)`
Generate structured output using Zod schema.

#### `generateTextWithSearchAndMaps(prompt: string, location?: { latitude: number; longitude: number })`
Combine Google Search and Maps in one request.

#### `generateStructuredOutputWithTools<T>(prompt: string, schema: T, location?: { latitude: number; longitude: number })`
**Most powerful**: Structured output + Search + Maps all together.

#### `streamTextWithSearch(prompt: string)`
Stream text generation with Google Search.

### Direct Model Access

```typescript
import { google, SUPPORTED_MODELS } from './modelAccess/gemini';
import { generateText } from 'ai';

const { text } = await generateText({
  model: google(SUPPORTED_MODELS.PRO_PREVIEW),
  tools: {
    google_search: google.tools.googleSearch({}),
    google_maps: google.tools.googleMaps({}),
  },
  providerOptions: {
    google: {
      retrievalConfig: {
        latLng: { latitude: 34.050481, longitude: -118.248526 },
      },
      thinkingConfig: {
        thinkingLevel: 'high', // For Gemini 3 models
      },
    },
  },
  prompt: 'Your prompt here',
});
```

## Model Capabilities

### Gemini 3 Pro Preview (`gemini-3-pro-preview`)
- ✅ Structured outputs (JSON Schema)
- ✅ Google Search grounding
- ✅ Google Maps grounding
- ✅ Thinking control (high/low levels)
- ✅ Multimodal (text, images, video, audio, PDF)
- ✅ 1,048,576 input tokens

### Gemini 3 Flash Preview (`gemini-3-flash-preview`)
- ✅ All features of Pro Preview
- ⚡ Faster response times
- ✅ Thinking control (minimal/low/medium/high levels)

### Gemini 2.5 Pro (`gemini-2.5-pro`)
- ✅ Structured outputs
- ✅ Google Search grounding
- ✅ Google Maps grounding
- ✅ Production-ready, stable

### Gemini 2.5 Flash (`gemini-2.5-flash`)
- ✅ All features of 2.5 Pro
- ⚡ Fastest response times
- ✅ Cost-effective

## Pricing

- **Google Search Grounding**: Billed per search query (Gemini 3) or per prompt (Gemini 2.5)
- **Google Maps Grounding**: $25 per 1K grounded prompts (500 free requests/day)
- **Structured Outputs**: Included in standard model pricing

See [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing) for details.

## Best Practices

1. **Use Gemini 3 Pro Preview** for the most advanced features and best quality
2. **Use Gemini 3 Flash Preview** when you need speed with advanced features
3. **Provide location context** when using Google Maps for better results
4. **Use structured outputs** for data extraction and classification tasks
5. **Enable Google Search** for real-time information and current events
6. **Combine tools** when you need both web search and location data

## Troubleshooting

### API Key Issues
- Ensure `GOOGLE_GENERATIVE_AI_API_KEY` is set in your `.env` file
- Verify the API key is valid at https://aistudio.google.com/apikey

### Schema Limitations
- Google Generative AI uses a subset of JSON Schema
- `z.union()` and `z.record()` are not supported
- Use `z.enum()` instead of unions when possible

### Rate Limits
- Google Search: Check your API quota
- Google Maps: 500 free requests/day, then $25/1K prompts

## Resources

- [AI SDK Documentation](https://ai-sdk.dev)
- [Google Gemini API Docs](https://ai.google.dev/gemini-api/docs)
- [Structured Outputs Guide](https://ai.google.dev/gemini-api/docs/structured-output)
- [Google Search Grounding](https://ai.google.dev/gemini-api/docs/google-search)
- [Google Maps Grounding](https://ai.google.dev/gemini-api/docs/maps-grounding)
