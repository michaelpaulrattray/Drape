/**
 * `safeParseJsonArray`, driven — the ladder that decides what a customer sees
 * as their suggestion chips.
 *
 * ⚠ THIS FILE EXISTS BECAUSE TWO LIVE DEFECTS SAT UNDER A LABEL CLAIMING THEY
 * WERE COVERED. `geminiPhase2Migration.test.ts` carried a section header
 * reading *"SUGGESTIONS — unit tests for safeParseJsonArray behavior"*, and
 * under it exactly one arm: `it("module loads without errors")`. The parser is
 * module-private and nothing anywhere had ever driven it. **It is not that
 * nobody wrote the tests — the file said someone had.**
 *
 * These arms drive the real parser through the real public function. The seam
 * is `geminiClient`: `safeResponseText` is imported from there, so mocking that
 * module lets any reply text reach the parser. No key, no call, no money.
 *
 * What was found (2026-08-25), before the repair:
 *
 *   {"error":"model refused this request","code":"safety_block"}
 *     -> ["error","model refused this request","code","safety_block"]
 *   {"suggestions":["Fuller lower lip","Stronger jawline"]}
 *     -> ["suggestions","Fuller lower lip","Stronger jawline"]
 *
 * ⚠ THE SECOND IS THE BIGGER ONE AND IT IS NOT AN ERROR PATH. `{"suggestions":
 * [...]}` is the single most ordinary way a model wraps a list it was asked
 * for. Steps 1-2 parsed it and rejected it for not BEING an array; step 3 then
 * harvested every quoted string in the text, so the good suggestions arrived
 * with the word "suggestions" in front of them. The product half-recovered and
 * showed the seam.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

let RESPONSE_TEXT = "";

vi.mock("./geminiClient", () => ({
  getAiClient: () => ({ models: { generateContent: async () => ({}) } }),
  SAFETY_SETTINGS: {},
  safeResponseText: () => RESPONSE_TEXT,
  withTimeout: (p: unknown) => p,
  extractMimeType: () => "image/png",
  extractBase64Data: () => "",
}));
vi.mock("./geminiQueue", () => ({ withTextQueue: (fn: () => unknown) => fn() }));

async function chipsFrom(replyText: string) {
  RESPONSE_TEXT = replyText;
  const { generateCastingSuggestions } = await import("./geminiSuggestions");
  return generateCastingSuggestions("a redhead in her 30s");
}

async function isFallback(replyText: string) {
  const { FALLBACK_SUGGESTIONS } = await import("./geminiSuggestions");
  const out = await chipsFrom(replyText);
  return JSON.stringify(out) === JSON.stringify([...FALLBACK_SUGGESTIONS]);
}

describe("safeParseJsonArray — what reaches the customer's chips", () => {
  beforeEach(() => {
    RESPONSE_TEXT = "";
  });

  // ── Population controls. Without these every arm below would pass against
  //    a parser that returned [] unconditionally. ────────────────────────────
  it("CONTROL — a plain array reply becomes the chips", async () => {
    expect(await chipsFrom(`["Fuller lower lip","Stronger jawline"]`)).toEqual([
      "Fuller lower lip",
      "Stronger jawline",
    ]);
  });

  it("CONTROL — a fenced array reply becomes the chips (step 2)", async () => {
    expect(await chipsFrom("```json\n[\"Fuller lower lip\"]\n```")).toEqual(["Fuller lower lip"]);
  });

  it("CONTROL — a TRUNCATED array is still rescued by step 3, which is what it is for", async () => {
    expect(await chipsFrom(`["Fuller lower lip","Stronger jawl`)).toEqual(["Fuller lower lip"]);
  });

  // ── The two defects, asserted as REPAIRED ────────────────────────────────
  it("a refusal envelope does NOT become the chips — it falls back", async () => {
    // Was: ["error","model refused this request","code","safety_block"] — a
    // safety refusal shown to the customer as four suggestions, one of them
    // reading "model refused this request".
    expect(
      await isFallback(`{"error":"model refused this request","code":"safety_block"}`),
    ).toBe(true);
  });

  it("the ordinary WRAPPER shape is unwrapped — and the key is not a chip", async () => {
    // Was: ["suggestions","Fuller lower lip","Stronger jawline"].
    expect(await chipsFrom(`{"suggestions":["Fuller lower lip","Stronger jawline"]}`)).toEqual([
      "Fuller lower lip",
      "Stronger jawline",
    ]);
  });

  it("a wrapper under a DIFFERENT key is unwrapped too — the rule is shape, not vocabulary", async () => {
    // Deliberately not "suggestions": nothing here may key on a word the model
    // happens to choose, or the next wrapper name reopens the same defect.
    expect(await chipsFrom(`{"ideas":["Warmer expression"],"note":"hope this helps"}`)).toEqual([
      "Warmer expression",
    ]);
  });

  it("NO KEY of a parsed object can ever reach a chip", async () => {
    // The class assertion, not the instance. Every key in this reply is a
    // plausible-looking short string, which is exactly what step 3 used to
    // harvest.
    const chips = await chipsFrom(
      `{"first":"Fuller lower lip","second":"Stronger jawline","third":"Warmer expression"}`,
    );
    for (const key of ["first", "second", "third"]) {
      expect(chips, `the key ${key} must not appear as a chip`).not.toContain(key);
    }
    // …and it is not silently empty-passing: an object with no array in it is
    // the fallback case.
    expect(chips.length).toBeGreaterThan(0);
    expect(
      await isFallback(
        `{"first":"Fuller lower lip","second":"Stronger jawline","third":"Warmer expression"}`,
      ),
    ).toBe(true);
  });

  it("prose with no JSON at all falls back", async () => {
    expect(await isFallback(`I'm sorry, I can't help with that.`)).toBe(true);
  });

  /*
   * ⚠ THE 3-80 CHARACTER BOUND, WHICH NO ARM HAS EVER LOOKED AT.
   *
   * Step 3's regex is `/"([^"]{3,80})"/g`. Both ends are silent: a two-
   * character suggestion is dropped, and an 81-character one is dropped
   * ENTIRELY rather than truncated — it does not arrive clipped, it does not
   * arrive at all. Neither bound was ever chosen in front of anyone, and
   * nothing recorded them. Pinned here so the next person to touch the regex
   * is making a decision.
   *
   * These drive step 3, so the replies are deliberately NOT valid JSON.
   */
  it("⚠ the bound is silent at BOTH ends — under 3 and over 80 characters vanish", async () => {
    const tooShort = `"ok"`;
    const justRight = "x".repeat(80);
    const tooLong = "y".repeat(81);
    const chips = await chipsFrom(`[${tooShort}, "${justRight}", "${tooLong}", "Warmer expression"`);
    expect(chips).toContain(justRight);
    expect(chips).toContain("Warmer expression");
    expect(chips).not.toContain("ok");
    expect(chips).not.toContain(tooLong);
  });

  it("⚠ step 3 caps at SIX and drops the rest silently", async () => {
    const many = Array.from({ length: 9 }, (_, i) => `"suggestion number ${i}"`).join(", ");
    const chips = await chipsFrom(`[${many}`); // unterminated → not valid JSON → step 3
    expect(chips).toHaveLength(6);
  });
});
