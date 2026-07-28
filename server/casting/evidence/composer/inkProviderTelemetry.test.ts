import { describe, expect, it } from "vitest";
import {
  extractInkProviderTelemetry,
  INK_TEXT_PROVIDER_CONFIG,
} from "./inkProviderTelemetry";

describe("R7-7D ink provider telemetry", () => {
  it("pins a non-thinking classifier budget with ample response headroom", () => {
    expect(INK_TEXT_PROVIDER_CONFIG).toEqual({
      thinkingBudget: 0,
      includeThoughts: false,
      maxOutputTokens: 4096,
    });
  });

  it("extracts only closed metadata from an empty MAX_TOKENS response", () => {
    expect(extractInkProviderTelemetry({
      response: {
        candidates: [{ finishReason: "MAX_TOKENS" }],
        usageMetadata: {
          promptTokenCount: 121,
          candidatesTokenCount: 0,
          thoughtsTokenCount: 256,
          totalTokenCount: 377,
        },
      },
      textLength: 0,
    })).toEqual({
      candidateCount: 1,
      finishReason: "MAX_TOKENS",
      blockReason: null,
      textLength: 0,
      promptTokenCount: 121,
      candidateTokenCount: 0,
      thoughtsTokenCount: 256,
      totalTokenCount: 377,
      errorName: null,
    });
  });

  it("collapses payload-bearing provider errors to a closed name", () => {
    const error = Object.assign(
      new Error('payload={"contents":[{"text":"private"}]}'),
      { body: "private-body", stack: "private-stack" },
    );
    const telemetry = extractInkProviderTelemetry({ error });
    expect(telemetry.errorName).toBe("Error");
    expect(Object.keys(telemetry)).not.toEqual(
      expect.arrayContaining(["message", "stack", "body"]),
    );
    expect(JSON.stringify(telemetry)).not.toContain("private");
  });
});
