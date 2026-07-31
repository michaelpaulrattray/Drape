import { describe, it, expect } from "vitest";

/**
 * Validates that the Gemini API key works, by making a real call.
 *
 * **Live-credential suite — opt in with `TEST_GEMINI_API_KEY`.** It no longer
 * reads `GEMINI_API_KEY`: `vitest.setup.ts` strips that so a default
 * `pnpm test` cannot reach a provider on the founder's account. This suite
 * proves a credential, which is only meaningful when you are deliberately
 * checking one.
 */
const apiKey = process.env.TEST_GEMINI_API_KEY;

if (!apiKey) {
  console.log("[gemini.test] skipped — set TEST_GEMINI_API_KEY to check the live credential");
}

describe.skipIf(!apiKey)("Gemini API Key Validation", () => {
  it("should be able to connect to Gemini API", async () => {
    // Make a minimal request to list models (lightweight endpoint)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    );

    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.models).toBeDefined();
    expect(Array.isArray(data.models)).toBe(true);
    expect(data.models.length).toBeGreaterThan(0);
  });
});
