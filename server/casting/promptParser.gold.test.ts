/**
 * Parser gold-standard suite — LIVE Gemini calls, validated against
 * PARSER_GOLD_STANDARD_V2.md. Skips without GEMINI_API_KEY.
 *
 * The two canaries are HARD assertions (D-14):
 *  - Test 16 (Zendaya): celebrity restraint — gender + age ONLY. If this
 *    starts filling features, the parser has drifted; escalate the model
 *    (PARSER_MODELS → TEXT_HEAVY_FALLBACK) before touching the prompt.
 *  - Test 25 (override pattern): enum + override BOTH populated.
 *
 * The remaining tests assert tolerantly per the gold doc §9 (random brand
 * assignment varies run-to-run by design; judgment-call fields allow the
 * documented alternatives).
 */
import { describe, it, expect } from "vitest";
import { parseCastingPrompt } from "./promptParser";
import { CASTING_BRANDS } from "../../shared/castingOptions";

const hasKey = !!process.env.GEMINI_API_KEY;
if (!hasKey) {
  console.log("[test] Skipping parser gold-standard tests — no GEMINI_API_KEY");
}

const TIMEOUT = 45_000;

describe.skipIf(!hasKey)("parser gold standard (live Gemini)", () => {
  // ── CANARY: Test 16 — celebrity restraint ─────────────────────────────────
  it(
    "T16 canary — Zendaya reference fills gender + age ONLY",
    async () => {
      const out = await parseCastingPrompt("someone like Zendaya but older");
      expect(out.intent).toBe("parsed");
      expect(out.fields.gender).toBe("Female");
      const age = parseInt(String(out.fields.age ?? "0"), 10);
      expect(age).toBeGreaterThanOrEqual(30);
      expect(age).toBeLessThanOrEqual(50);
      // The restraint core: NO invented features, NO ethnicity encoding
      expect(out.fields.ethnicityBlend).toEqual([]);
      for (const forbidden of ["skinTone", "hairColor", "eyeColor", "faceShape", "jawline", "cheekbones", "hairTexture", "bodyType"]) {
        expect(out.fields, `parser drifted: encoded celebrity ${forbidden}`).not.toHaveProperty(forbidden);
      }
    },
    TIMEOUT,
  );

  // ── CANARY: Test 25 — the override pattern ────────────────────────────────
  it(
    "T25 canary — override pattern populates enum AND override",
    async () => {
      const out = await parseCastingPrompt(
        "Korean woman, late 20s, shag wolf cut with side-swept curtain bangs and asymmetric face-framing layers, ash blonde with dark roots",
      );
      expect(out.intent).toBe("parsed");
      expect(out.fields.gender).toBe("Female");
      expect(out.fields.ethnicityBlend).toEqual([{ name: "East Asian", pct: 100 }]);
      expect(out.fields.hairStyle, "enum missing — chip would have nothing to display").toBeTruthy();
      expect(out.fields.hairStyleOverride, "override missing — user detail silently lost").toBeTruthy();
      expect(out.fields.hairColor).toBeTruthy();
      expect(out.fields.hairColorOverride).toBeTruthy();
      expect(String(out.fields.hairStyleOverride)).toMatch(/curtain bangs/i);
    },
    TIMEOUT,
  );

  // ── Representative coverage (tolerant per gold §9) ────────────────────────
  it(
    "T1 — terse: asian guy 30s",
    async () => {
      const out = await parseCastingPrompt("asian guy 30s");
      expect(out.fields.gender).toBe("Male");
      expect(out.fields.ethnicityBlend).toEqual([{ name: "East Asian", pct: 100 }]);
      const age = parseInt(String(out.fields.age ?? "0"), 10);
      expect(age).toBeGreaterThanOrEqual(30);
      expect(age).toBeLessThanOrEqual(39);
    },
    TIMEOUT,
  );

  it(
    "T2 — Mediterranean enum: young italian woman",
    async () => {
      const out = await parseCastingPrompt("young italian woman");
      expect(out.fields.gender).toBe("Female");
      expect(out.fields.ethnicityBlend).toEqual([{ name: "Mediterranean", pct: 100 }]);
    },
    TIMEOUT,
  );

  it(
    "T6 — identity-rich prompt hits the production target",
    async () => {
      const out = await parseCastingPrompt(
        "athletic Brazilian woman, strong jaw, dark curly hair, editorial vibe, mid-twenties",
      );
      expect(out.fields.gender).toBe("Female");
      expect(out.fields.bodyType).toBe("Athletic");
      expect(out.fields.ethnicityBlend).toEqual([{ name: "Latino", pct: 100 }]);
      const vibe = out.fields.castingVibe as { editorial: number };
      expect(vibe.editorial).toBeGreaterThanOrEqual(0.5);
      expect(String(out.fields.hairTexture ?? "")).toBe("Curly");
    },
    TIMEOUT,
  );

  it(
    "T15 — truly empty input gets a random brand, nothing else",
    async () => {
      const out = await parseCastingPrompt("model");
      expect(out.intent).toBe("parsed");
      expect(CASTING_BRANDS).toContain(out.fields.castingBrand as string);
      // Restraint: no invented physical features
      for (const forbidden of ["gender", "skinTone", "hairColor", "eyeColor", "bodyType"]) {
        expect(out.fields).not.toHaveProperty(forbidden);
      }
    },
    TIMEOUT,
  );

  it(
    "T17 — subculture maps to brand, not vibe: pink-haired punk girl",
    async () => {
      const out = await parseCastingPrompt("pink-haired punk girl");
      expect(out.fields.gender).toBe("Female");
      expect(["Saint Laurent", "Balenciaga"]).toContain(out.fields.castingBrand as string);
      expect(String(out.fields.hairColor ?? "")).toMatch(/pink|magenta/i);
    },
    TIMEOUT,
  );

  it(
    "T26 — global random intent returns intent only",
    async () => {
      const out = await parseCastingPrompt("surprise me with a model");
      expect(out.intent).toBe("random");
      expect(out.fields).toEqual({});
    },
    TIMEOUT,
  );

  it(
    "T27 — per-field random: woman, late 20s, athletic, random hair color",
    async () => {
      const out = await parseCastingPrompt("woman, late 20s, athletic, random hair color");
      expect(out.intent).toBe("parsed");
      expect(out.fields.gender).toBe("Female");
      expect(out.fields.bodyType).toBe("Athletic");
      expect(out.randomizeFields).toContain("hairColor");
      expect(out.fields).not.toHaveProperty("hairColor");
    },
    TIMEOUT,
  );
});
