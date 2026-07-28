import sharp from "sharp";
import { beforeAll, describe, it, expect } from "vitest";
import {
  extractMimeType,
  extractBase64Data,
  safeResponseText,
  extractImageFromResponse,
  diagnoseResponse,
  formatGeminiError,
  buildIdentityAnchor,
  MAX_GENERATED_IMAGE_BYTES,
} from "./geminiClient";
import {
  BRAND_PROFILES,
  DEFAULT_BRAND_DESCRIPTOR,
  getBrandExpression,
  getSkinDescription,
  hasBodyArt,
  irisDescriptions,
  MASTER_PROMPT_SYSTEM_INSTRUCTION,
} from "./geminiPrompts";
import { clearCastingSession } from "./geminiGeneration";
import { canonicalizeEvidenceDataUrl } from "./evidence/imageValidation";
import { validateNotPlaceholder } from "./placeholderDetection";

let generatedJpeg: Buffer;
let generatedPng: Buffer;
let generatedWebp: Buffer;

beforeAll(async () => {
  const raw = Buffer.alloc(256 * 256 * 3);
  for (let index = 0; index < raw.length; index++) {
    raw[index] = (index * 37 + Math.floor(index / 97)) % 256;
  }
  const source = sharp(raw, {
    raw: { width: 256, height: 256, channels: 3 },
  });
  generatedJpeg = await source.clone().jpeg({ quality: 92 }).toBuffer();
  generatedPng = await source.clone().png().toBuffer();
  generatedWebp = await source.clone().webp({ quality: 92 }).toBuffer();
});

/**
 * Phase 1 Migration Tests
 * Validates all new/updated helpers, constants, and utilities
 * introduced during the Casting Studio migration.
 */

// ============================================================================
// geminiClient.ts — Data URL Utilities
// ============================================================================

describe("extractMimeType", () => {
  it("extracts MIME type from data URL", () => {
    expect(extractMimeType("data:image/png;base64,abc")).toBe("image/png");
    expect(extractMimeType("data:image/jpeg;base64,xyz")).toBe("image/jpeg");
    expect(extractMimeType("data:image/webp;base64,123")).toBe("image/webp");
  });

  it("defaults to image/jpeg for non-data-URL strings", () => {
    expect(extractMimeType("not-a-data-url")).toBe("image/jpeg");
    expect(extractMimeType("")).toBe("image/jpeg");
  });
});

describe("extractBase64Data", () => {
  it("strips data URL prefix", () => {
    expect(extractBase64Data("data:image/png;base64,abc123")).toBe("abc123");
    expect(extractBase64Data("data:image/jpeg;base64,xyz789")).toBe("xyz789");
  });

  it("returns raw string if no prefix", () => {
    expect(extractBase64Data("rawBase64String")).toBe("rawBase64String");
  });
});

// ============================================================================
// geminiClient.ts — Response Helpers
// ============================================================================

describe("safeResponseText", () => {
  it("extracts text from valid response", () => {
    const response = {
      candidates: [{ content: { parts: [{ text: "Hello world" }] } }],
    };
    expect(safeResponseText(response)).toBe("Hello world");
  });

  it("returns empty string for empty response", () => {
    expect(safeResponseText(null)).toBe("");
    expect(safeResponseText(undefined)).toBe("");
    expect(safeResponseText({})).toBe("");
    expect(safeResponseText({ candidates: [] })).toBe("");
  });

  it("returns empty string for response with no text parts", () => {
    const response = {
      candidates: [{ content: { parts: [{ inlineData: { data: "img" } }] } }],
    };
    expect(safeResponseText(response)).toBe("");
  });
});

describe("extractImageFromResponse", () => {
  const responseWithParts = (...parts: unknown[]) => ({
    candidates: [{ content: { parts } }],
  });

  it("declares the generated image from byte magic, not the provider label", async () => {
    const payload = generatedJpeg.toString("base64");
    const extracted = extractImageFromResponse(responseWithParts(
      { text: "some text" },
      { inlineData: { data: payload, mimeType: "image/png" } },
    ));
    expect(extracted).toBe(`data:image/jpeg;base64,${payload}`);
    await expect(canonicalizeEvidenceDataUrl(extracted!)).resolves.toMatchObject({
      mime: "image/webp",
      width: 256,
      height: 256,
    });
  });

  it.each([
    ["PNG", () => generatedPng, "image/png"],
    ["WebP", () => generatedWebp, "image/webp"],
  ])("extracts valid %s bytes with their real MIME", async (
    _label,
    bytes,
    expectedMime,
  ) => {
    const payload = bytes().toString("base64");
    const extracted = extractImageFromResponse(responseWithParts({
      inlineData: { data: payload, mimeType: "image/jpeg" },
    }));
    expect(extracted).toBe(`data:${expectedMime};base64,${payload}`);
    await expect(canonicalizeEvidenceDataUrl(extracted!)).resolves.toMatchObject({
      mime: "image/webp",
      width: 256,
      height: 256,
    });
  });

  it("skips unusable parts and returns the first valid still image", () => {
    const payload = generatedJpeg.toString("base64");
    expect(extractImageFromResponse(responseWithParts(
      { inlineData: { data: "not-base64", mimeType: "image/png" } },
      { inlineData: { data: payload, mimeType: "image/png" } },
    ))).toBe(`data:image/jpeg;base64,${payload}`);
  });

  it.each([
    ["empty", ""],
    ["non-string", 42],
    ["invalid alphabet", "AAAA$==="],
    ["missing padding", "aGVsbG8"],
    ["non-canonical padding bits", "AB=="],
    ["unsupported bytes", Buffer.from("plain text").toString("base64")],
    ["GIF87a", Buffer.from("GIF87a").toString("base64")],
    ["GIF89a", Buffer.from("GIF89a").toString("base64")],
  ])("rejects %s inline image data", (_label, data) => {
    expect(extractImageFromResponse(responseWithParts({
      inlineData: { data, mimeType: "image/png" },
    }))).toBeNull();
  });

  it("rejects an encoded payload above the shared generated-image ceiling", () => {
    const oversized = "A".repeat(
      Math.ceil(MAX_GENERATED_IMAGE_BYTES / 3) * 4 + 4,
    );
    expect(extractImageFromResponse(responseWithParts({
      inlineData: { data: oversized, mimeType: "image/png" },
    }))).toBeNull();
  });

  it("preserves casting payloads above 10 MiB but below the shared ceiling", () => {
    const bytes = Buffer.alloc(10 * 1024 * 1024 + 1, 7);
    bytes.set([0xff, 0xd8, 0xff], 0);
    const payload = bytes.toString("base64");
    expect(extractImageFromResponse(responseWithParts({
      inlineData: { data: payload, mimeType: "image/png" },
    }))).toBe(`data:image/jpeg;base64,${payload}`);
  });

  it("keeps placeholder validation compatible with a JPEG data URL", () => {
    const payload = generatedJpeg.toString("base64");
    const extracted = extractImageFromResponse(responseWithParts({
      inlineData: { data: payload, mimeType: "image/png" },
    }));
    expect(() => validateNotPlaceholder(extracted!)).not.toThrow();
  });

  it("returns null when no image in response", () => {
    const response = {
      candidates: [{
        content: {
          parts: [{ text: "just text" }],
        },
      }],
    };
    expect(extractImageFromResponse(response)).toBeNull();
  });

  it("returns null for empty response", () => {
    expect(extractImageFromResponse(null)).toBeNull();
    expect(extractImageFromResponse({})).toBeNull();
    expect(extractImageFromResponse({ candidates: [{ content: {} }] })).toBeNull();
  });
});

describe("diagnoseResponse", () => {
  it("returns null for healthy response", () => {
    const response = {
      candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }],
    };
    expect(diagnoseResponse(response)).toBeNull();
  });

  it("detects prompt block", () => {
    const response = { promptFeedback: { blockReason: "SAFETY" } };
    expect(diagnoseResponse(response)).toContain("Prompt blocked");
  });

  it("detects missing candidates", () => {
    expect(diagnoseResponse({ candidates: [] })).toContain("No response generated");
    expect(diagnoseResponse({})).toContain("No response generated");
  });

  it("detects safety finish reason", () => {
    const response = {
      candidates: [{ finishReason: "SAFETY" }],
    };
    expect(diagnoseResponse(response)).toContain("Generation stopped: SAFETY");
  });

  it("detects BLOCKED finish reason", () => {
    const response = {
      candidates: [{ finishReason: "BLOCKED" }],
    };
    expect(diagnoseResponse(response)).toContain("Generation stopped: BLOCKED");
  });
});

// ============================================================================
// geminiClient.ts — Error Formatting
// ============================================================================

describe("formatGeminiError", () => {
  it("formats rate limit errors", () => {
    const result = formatGeminiError({ message: "Error 429 too many requests" });
    expect(result).toContain("RATE_LIMIT");
  });

  // Customers never provide the server's Gemini key — auth failures read as
  // a service outage, never as "verify your API key" (final close-out).
  it("formats auth errors as a service outage, never a customer key problem", () => {
    const result = formatGeminiError({ message: "403 Forbidden" });
    expect(result).toBe("The generation service is temporarily unavailable. Please try again later.");
    expect(result).not.toContain("API");
    const keyErr = formatGeminiError({ message: "API key not valid. Please pass a valid API key." });
    expect(keyErr).toBe("The generation service is temporarily unavailable. Please try again later.");
  });

  it("formats server errors", () => {
    const result = formatGeminiError({ message: "500 Internal Server Error" });
    expect(result).toContain("Engine offline");
  });

  it("formats safety errors", () => {
    const result = formatGeminiError({ message: "SAFETY filter blocked" });
    expect(result).toContain("Safety protocols");
  });

  it("formats timeout errors", () => {
    const result = formatGeminiError({ message: "Request timed out after 60s" });
    expect(result).toContain("timed out");
  });

  // Final corrections (error sanitization): raw provider text can carry
  // request payloads, URLs, or key details — no branch passes it through.
  it("NEVER passes unknown error text through — fixed safe wording instead", () => {
    const result = formatGeminiError({ message: "connect ECONNREFUSED db://user:secret@10.0.0.1" });
    expect(result).not.toContain("secret");
    expect(result).not.toContain("10.0.0.1");
    expect(result).toBe("Generation failed unexpectedly. Please try again.");
  });

  it("400 errors return fixed wording without the provider payload", () => {
    const result = formatGeminiError({
      message: "400 Bad Request: POST https://generativelanguage.googleapis.com/v1/models?key=AIza-SECRET {\"contents\":[…]}",
    });
    expect(result).not.toContain("googleapis");
    expect(result).not.toContain("AIza");
    expect(result).toBe("The engine rejected this request. Adjust the instruction and try again.");
  });
});

// ============================================================================
// geminiClient.ts — Identity Anchor
// ============================================================================

describe("buildIdentityAnchor", () => {
  it("builds simple anchor without schema", () => {
    const result = buildIdentityAnchor("A 25-year-old model");
    expect(result).toContain("IDENTITY CONTEXT");
    expect(result).toContain("A 25-year-old model");
  });

  it("builds structured anchor with schema", () => {
    const schema = {
      subject: {
        sex: "Female",
        age: "25",
        ethnicity: "Korean",
        skin_tone: "Light",
        hair_color: "Black",
        hair_style: "Long straight",
        eye_color: "Dark brown",
      },
      facial_features: {
        face_shape: "Oval",
        jawline: "Soft",
        cheekbones: "High",
        nose_shape: "Small",
        lips_shape: "Full",
        eyebrows: "Straight",
      },
    };

    const result = buildIdentityAnchor("Full prompt text", schema);
    expect(result).toContain("IDENTITY");
    expect(result).toContain("Sex: Female");
    expect(result).toContain("Age: 25");
    expect(result).toContain("Ethnicity: Korean");
    expect(result).toContain("Hair: Black");
    expect(result).toContain("Eyes: Dark brown");
    expect(result).toContain("Face shape: Oval");
    expect(result).toContain("Full prompt text");
  });

  it("handles partial schema gracefully", () => {
    const schema = { subject: { sex: "Male" }, facial_features: {} };
    const result = buildIdentityAnchor("prompt", schema);
    expect(result).toContain("Sex: Male");
    expect(result).toContain("prompt");
  });
});

// ============================================================================
// geminiPrompts.ts — Brand Profiles
// ============================================================================

describe("BRAND_PROFILES", () => {
  it("contains all expected brands", () => {
    const expectedBrands = ["Gucci", "Prada", "Saint Laurent", "Balenciaga", "Miu Miu", "Versace", "Zara", "Social Media"];
    expectedBrands.forEach(brand => {
      expect(BRAND_PROFILES[brand]).toBeDefined();
      expect(BRAND_PROFILES[brand].descriptor).toBeTruthy();
    });
  });

  it("each brand has a non-empty descriptor", () => {
    Object.entries(BRAND_PROFILES).forEach(([brand, profile]) => {
      expect(profile.descriptor.length).toBeGreaterThan(20);
    });
  });
});

describe("DEFAULT_BRAND_DESCRIPTOR", () => {
  it("exists and is non-empty", () => {
    expect(DEFAULT_BRAND_DESCRIPTOR).toBeTruthy();
    expect(DEFAULT_BRAND_DESCRIPTOR.length).toBeGreaterThan(20);
  });
});

describe("getBrandExpression", () => {
  it("returns expression for known brands", () => {
    const result = getBrandExpression("Gucci");
    expect(result).toContain("EXPRESSION");
    expect(result).toContain("Eyes direct into lens");
  });

  it("returns default expression for unknown brands", () => {
    const result = getBrandExpression("UnknownBrand");
    expect(result).toContain("EXPRESSION");
    expect(result).toContain("neutral");
  });
});

// ============================================================================
// geminiPrompts.ts — Skin & Iris Descriptions
// ============================================================================

describe("getSkinDescription", () => {
  it("returns description for known texture + finish", () => {
    const result = getSkinDescription("Smooth", "Matte");
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(20);
  });

  it("returns description for dewy finish", () => {
    const result = getSkinDescription("Smooth", "Dewy / Sweat");
    expect(result).toContain("specular");
  });

  it("returns default for unknown texture", () => {
    const result = getSkinDescription("Unknown", "Unknown");
    expect(result).toBeTruthy();
  });
});

describe("irisDescriptions", () => {
  it("contains common eye colors", () => {
    // Keys use specific shade names, not generic "Blue"
    const commonColors = ["Brown", "Ice", "Sky", "Green", "Hazel", "Grey", "Amber", "Dark"];
    commonColors.forEach(color => {
      expect(irisDescriptions[color]).toBeDefined();
      expect(irisDescriptions[color].length).toBeGreaterThan(10);
    });
  });
});

// ============================================================================
// geminiPrompts.ts — Body Art Detection
// ============================================================================

describe("hasBodyArt", () => {
  it("detects tattoo keyword", () => {
    expect(hasBodyArt("small rose tattoo on shoulder")).toBe(true);
  });

  it("detects ink keyword with word boundaries", () => {
    expect(hasBodyArt("black ink on arm")).toBe(true);
  });

  it("detects body art phrase", () => {
    expect(hasBodyArt("has body art on chest")).toBe(true);
  });

  it("detects wax seal", () => {
    expect(hasBodyArt("wax seal tattoo design")).toBe(true);
  });

  it("detects body branding", () => {
    expect(hasBodyArt("body branding on back")).toBe(true);
  });

  it("detects calligraphy tattoo", () => {
    expect(hasBodyArt("calligraphy tattoo on ribs")).toBe(true);
  });

  it("returns false for clean text", () => {
    expect(hasBodyArt("clean skin, no markings")).toBe(false);
    expect(hasBodyArt("smooth complexion")).toBe(false);
  });

  it("does not false-positive on 'think' containing 'ink'", () => {
    // 'ink' should only match as a standalone word
    expect(hasBodyArt("I think this is fine")).toBe(false);
  });
});

// ============================================================================
// geminiPrompts.ts — System Instruction
// ============================================================================

describe("MASTER_PROMPT_SYSTEM_INSTRUCTION", () => {
  it("contains signal priority hierarchy", () => {
    expect(MASTER_PROMPT_SYSTEM_INSTRUCTION).toContain("PRIORITY 1");
    expect(MASTER_PROMPT_SYSTEM_INSTRUCTION).toContain("PRIORITY 2");
    expect(MASTER_PROMPT_SYSTEM_INSTRUCTION).toContain("PRIORITY 3");
  });

  it("contains variety enforcement", () => {
    // Uses "bold" and "combinations" language for variety
    expect(MASTER_PROMPT_SYSTEM_INSTRUCTION).toContain("bold");
    expect(MASTER_PROMPT_SYSTEM_INSTRUCTION).toContain("combinations");
  });

  it("contains JSON output format", () => {
    expect(MASTER_PROMPT_SYSTEM_INSTRUCTION).toContain("natural_description");
    expect(MASTER_PROMPT_SYSTEM_INSTRUCTION).toContain("technical_schema");
  });
});

// ============================================================================
// geminiGeneration.ts — Chat Session
// ============================================================================

describe("clearCastingSession", () => {
  it("can be called without error", () => {
    expect(() => clearCastingSession()).not.toThrow();
  });
});
