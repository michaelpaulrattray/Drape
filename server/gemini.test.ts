import { describe, it, expect } from "vitest";

/**
 * Test to validate the Gemini API key is working correctly.
 * This makes a minimal API call to verify credentials.
 */
describe("Gemini API Key Validation", () => {
  it("should have GEMINI_API_KEY environment variable set", () => {
    expect(process.env.GEMINI_API_KEY).toBeDefined();
    expect(process.env.GEMINI_API_KEY).not.toBe("");
  });

  it("should be able to connect to Gemini API", async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }

    // Make a minimal request to list models (lightweight endpoint)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    expect(response.ok).toBe(true);
    
    const data = await response.json();
    expect(data.models).toBeDefined();
    expect(Array.isArray(data.models)).toBe(true);
    expect(data.models.length).toBeGreaterThan(0);
  });
});
