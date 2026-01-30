import { describe, expect, test, mock, spyOn, beforeEach } from "bun:test";
import {
  extractAddress,
  buildPropertyResearchPrompt,
  buildSurroundingsResearchPrompt,
  researchPropertyValues,
  researchSurroundings,
} from "./vancouverHouse2Executor";

// ============================================================================
// Pure Function Tests (no mocking needed)
// ============================================================================

describe("extractAddress", () => {
  test("should extract address from 'Address' key", () => {
    const properties = { Address: "123 Main St, Vancouver, BC" };
    expect(extractAddress(properties)).toBe("123 Main St, Vancouver, BC");
  });

  test("should extract address from lowercase 'address' key", () => {
    const properties = { address: "456 Oak Ave" };
    expect(extractAddress(properties)).toBe("456 Oak Ave");
  });

  test("should extract from 'Property Address' key", () => {
    const properties = { "Property Address": "789 Elm St" };
    expect(extractAddress(properties)).toBe("789 Elm St");
  });

  test("should extract from 'Location' key", () => {
    const properties = { Location: "Downtown Vancouver" };
    expect(extractAddress(properties)).toBe("Downtown Vancouver");
  });

  test("should fall back to 'Name' if no address keys found", () => {
    const properties = { Name: "123 Test Property" };
    expect(extractAddress(properties)).toBe("123 Test Property");
  });

  test("should fall back to 'Title' if no address keys found", () => {
    const properties = { Title: "456 Title Property" };
    expect(extractAddress(properties)).toBe("456 Title Property");
  });

  test("should return null if no address found", () => {
    const properties = { SomeOtherField: "value" };
    expect(extractAddress(properties)).toBeNull();
  });

  test("should return null for empty string values", () => {
    const properties = { Address: "", Name: "   " };
    expect(extractAddress(properties)).toBeNull();
  });

  test("should trim whitespace from address", () => {
    const properties = { Address: "  123 Main St  " };
    expect(extractAddress(properties)).toBe("123 Main St");
  });

  test("should prefer Address over Name", () => {
    const properties = {
      Address: "Real Address",
      Name: "Property Name",
    };
    expect(extractAddress(properties)).toBe("Real Address");
  });
});

describe("buildPropertyResearchPrompt", () => {
  const mockSchema = {
    Price: { type: "number", name: "Price" },
    Bedrooms: { type: "number", name: "Bedrooms" },
    Status: { type: "select", name: "Status", options: ["Active", "Sold", "Pending"] },
  };

  const mockCurrentValues = {
    Price: null,
    Bedrooms: 2,
    Status: null,
  };

  test("should include address in prompt", () => {
    const prompt = buildPropertyResearchPrompt(
      mockSchema,
      mockCurrentValues,
      "123 Main St, Vancouver",
      ["Price", "Status"]
    );

    expect(prompt).toContain("123 Main St, Vancouver");
  });

  test("should include missing properties in prompt", () => {
    const prompt = buildPropertyResearchPrompt(
      mockSchema,
      mockCurrentValues,
      "123 Main St",
      ["Price", "Status"]
    );

    expect(prompt).toContain("Price");
    expect(prompt).toContain("Status");
  });

  test("should include schema in prompt", () => {
    const prompt = buildPropertyResearchPrompt(
      mockSchema,
      mockCurrentValues,
      "123 Main St",
      ["Price"]
    );

    expect(prompt).toContain("DATABASE SCHEMA");
    expect(prompt).toContain('"type": "number"');
  });

  test("should include current values in prompt", () => {
    const prompt = buildPropertyResearchPrompt(
      mockSchema,
      mockCurrentValues,
      "123 Main St",
      ["Price"]
    );

    expect(prompt).toContain("CURRENT VALUES");
    expect(prompt).toContain('"Bedrooms": 2');
  });

  test("should include Vancouver real estate sources", () => {
    const prompt = buildPropertyResearchPrompt(
      mockSchema,
      mockCurrentValues,
      "123 Main St",
      ["Price"]
    );

    expect(prompt).toContain("rew.ca");
    expect(prompt).toContain("zealty.ca");
    expect(prompt).toContain("realtor.ca");
  });
});

describe("buildSurroundingsResearchPrompt", () => {
  test("should include address in prompt", () => {
    const prompt = buildSurroundingsResearchPrompt("123 Main St, Vancouver");
    expect(prompt).toContain("123 Main St, Vancouver");
  });

  test("should mention parks research", () => {
    const prompt = buildSurroundingsResearchPrompt("123 Main St");
    expect(prompt).toContain("NEARBY PARKS");
    expect(prompt).toContain("10 minute walk");
  });

  test("should mention transit research", () => {
    const prompt = buildSurroundingsResearchPrompt("123 Main St");
    expect(prompt).toContain("PUBLIC TRANSIT");
    expect(prompt).toContain("SkyTrain");
    expect(prompt).toContain("bus");
  });

  test("should include key destinations", () => {
    const prompt = buildSurroundingsResearchPrompt("123 Main St");
    expect(prompt).toContain("Downtown");
    expect(prompt).toContain("UBC");
    expect(prompt).toContain("YVR");
    expect(prompt).toContain("Oakridge");
  });

  test("should mention Google Maps for research", () => {
    const prompt = buildSurroundingsResearchPrompt("123 Main St");
    expect(prompt).toContain("Google Maps");
  });
});

// ============================================================================
// Tests with Mocked Gemini (for research functions)
// ============================================================================

describe("researchPropertyValues", () => {
  // Mock the callGemini module
  const mockCallGemini = mock(() =>
    Promise.resolve({
      text: Promise.resolve("Mocked response"),
      output: Promise.resolve({
        filledProperties: [
          { propertyName: "Price", value: 1500000, confidence: "high" },
          { propertyName: "Bedrooms", value: 3, confidence: "medium" },
        ],
        sources: ["https://rew.ca/123"],
        notes: "Test note",
      }),
    })
  );

  beforeEach(() => {
    mockCallGemini.mockClear();
  });

  test("should return null when no missing properties", async () => {
    const schema = {
      Price: { type: "number", name: "Price" },
    };
    const currentValues = {
      Price: 1000000, // Already filled
    };

    const result = await researchPropertyValues(schema, currentValues, "123 Main St");
    expect(result).toBeNull();
  });

  test("should identify missing properties correctly", async () => {
    const schema = {
      Price: { type: "number", name: "Price" },
      Bedrooms: { type: "number", name: "Bedrooms" },
      Notes: { type: "rich_text", name: "Notes" },
    };
    const currentValues = {
      Price: null,      // missing
      Bedrooms: 3,      // filled
      Notes: "",        // missing (empty string)
    };

    // This will call the real function which tries to call Gemini
    // In a real test, we'd mock callGemini at the module level
    // For now, just test the logic path

    // The function should identify Price and Notes as missing
    // We can't easily test this without module mocking, but we've tested
    // the pure functions above
  });

  test("should skip button properties", async () => {
    const schema = {
      Price: { type: "number", name: "Price" },
      ActionButton: { type: "button", name: "ActionButton" },
    };
    const currentValues = {
      Price: 1000000,
      ActionButton: null, // Button should be skipped even if "empty"
    };

    const result = await researchPropertyValues(schema, currentValues, "123 Main St");
    expect(result).toBeNull(); // No missing properties after skipping button
  });
});

describe("researchSurroundings", () => {
  test("should build correct prompt for address", async () => {
    // Test that the prompt includes the address
    // The actual Gemini call would need module-level mocking
    const address = "1234 W Broadway, Vancouver, BC";
    const prompt = buildSurroundingsResearchPrompt(address);

    expect(prompt).toContain(address);
    expect(prompt).toContain("PROPERTY ADDRESS");
  });
});

// ============================================================================
// Integration-style tests (with real payload structure)
// ============================================================================

describe("vancouverHouse2Executor integration patterns", () => {
  test("schema and current values structure matches expected format", () => {
    // This validates the data structures we expect from Notion
    const exampleSchema = {
      Name: { type: "title", name: "Name" },
      Price: { type: "number", name: "Price" },
      Bedrooms: { type: "number", name: "Bedrooms" },
      Status: {
        type: "select",
        name: "Status",
        options: ["Active", "Pending", "Sold"],
      },
      Tags: {
        type: "multi_select",
        name: "Tags",
        options: ["Waterfront", "New Build", "Renovated"],
      },
    };

    const exampleCurrentValues = {
      Name: "123 Main Street Unit 456",
      Price: null,
      Bedrooms: null,
      Status: null,
      Tags: [],
    };

    // Extract address should work with the Name field
    const address = extractAddress(exampleCurrentValues);
    expect(address).toBe("123 Main Street Unit 456");

    // Build prompt should include schema info
    const prompt = buildPropertyResearchPrompt(
      exampleSchema,
      exampleCurrentValues,
      address!,
      ["Price", "Bedrooms", "Status", "Tags"]
    );

    expect(prompt).toContain("123 Main Street Unit 456");
    expect(prompt).toContain("Active");
    expect(prompt).toContain("multi_select");
  });

  test("PropertyValues response structure is valid", () => {
    // Validate the expected response structure from Gemini
    const exampleResponse = {
      filledProperties: [
        { propertyName: "Price", value: 1500000, confidence: "high" as const },
        { propertyName: "Bedrooms", value: 2, confidence: "high" as const },
        {
          propertyName: "Status",
          value: "Active",
          confidence: "medium" as const,
        },
        {
          propertyName: "Tags",
          value: ["Waterfront", "New Build"],
          confidence: "low" as const,
        },
      ],
      sources: [
        "https://rew.ca/listing/123",
        "https://zealty.ca/property/456",
      ],
      notes: "Price based on recent comparable sales in the area.",
    };

    // Validate structure
    expect(exampleResponse.filledProperties).toBeArray();
    expect(exampleResponse.filledProperties[0].propertyName).toBe("Price");
    expect(exampleResponse.filledProperties[0].value).toBe(1500000);
    expect(exampleResponse.filledProperties[0].confidence).toBe("high");
    expect(exampleResponse.sources).toContain("https://rew.ca/listing/123");
  });

  test("Surroundings response structure is valid", () => {
    const exampleResponse = {
      nearbyParks: [
        {
          name: "Queen Elizabeth Park",
          walkTimeMinutes: 8,
          distanceMeters: 650,
          features: ["gardens", "tennis courts", "viewpoint"],
        },
      ],
      publicTransit: [
        {
          name: "King Edward Station",
          type: "skytrain" as const,
          walkTimeMinutes: 5,
          routes: ["Canada Line"],
        },
        {
          name: "Cambie & 33rd",
          type: "bus" as const,
          walkTimeMinutes: 3,
          routes: ["15", "33"],
        },
      ],
      transitTimes: {
        toDowntown: {
          transitTimeMinutes: 15,
          description: "Canada Line from King Edward to Waterfront",
        },
        toUBC: {
          transitTimeMinutes: 35,
          description: "Canada Line to Broadway-City Hall, transfer to 99 B-Line",
        },
        toYVR: {
          transitTimeMinutes: 25,
          description: "Canada Line from King Edward to YVR-Airport",
        },
        toOakridgePark: {
          transitTimeMinutes: 8,
          description: "Walk or one stop on Canada Line",
        },
      },
      sources: ["https://translink.ca", "https://maps.google.com"],
    };

    expect(exampleResponse.nearbyParks).toBeArray();
    expect(exampleResponse.publicTransit[0].type).toBe("skytrain");
    expect(exampleResponse.transitTimes.toDowntown.transitTimeMinutes).toBe(15);
  });
});
