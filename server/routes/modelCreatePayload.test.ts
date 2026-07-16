/**
 * Client/server contract tests for the models.create boundary (R6 hotfix,
 * 2026-07-16 launch blocker). The old suite proved the server REJECTS
 * `referenceImage` at creation but never proved the real client payload
 * OMITS it — so production casts failed on a raw "Unrecognized key" error.
 *
 * These tests run the REAL client payload builder (buildCreationPreferences)
 * against the REAL production schemas (modelCreateInput / iterateInput) and
 * the REAL intake validator, including a faithful superjson wire round-trip
 * (superjson preserves `undefined` values with the key present — the exact
 * mechanism that made "set it to undefined" insufficient).
 */
import { describe, it, expect } from "vitest";
import superjson from "superjson";
import { modelCreatePreferencesSchema } from "./modelCreateInput";
import { iterateInputSchema } from "./generation/iterateInput";
import { buildCreationPreferences } from "@/features/casting/creationPayload";
import { DEFAULT_PREFERENCES } from "@/features/casting/stores/useCastingFormStore";
import type { ModelPreferences } from "@/features/casting/constants";
import { sanitizeParsed, mergeParsedPreferences } from "../casting/promptParser";
import { validateCreationIntent } from "../casting/identity/creationIntake";
import { REFUSAL_COPY } from "../casting/identity/refusalCopy";

/** What the tRPC link actually does to the input on the wire. */
function overTheWire<T>(payload: T): unknown {
  return superjson.deserialize(JSON.parse(JSON.stringify(superjson.serialize(payload))));
}

const ORDINARY_FORM: ModelPreferences = {
  ...DEFAULT_PREFERENCES,
  gender: "Female",
  age: "24",
  ethnicity: "Nordic",
  skinTone: "Fair / Light",
  eyeColor: "Green",
  hairColor: "Ash Blonde",
  hairStyle: "Long Layers",
};

describe("models.create payload never carries referenceImage (§10.3)", () => {
  it("a fresh-session form (the production blocker) produces a payload the strict schema accepts", () => {
    // New Casting Studio session: prefs are the store defaults, brand
    // resolved at fire time — exactly what handleGenerate sends
    const payload = buildCreationPreferences(DEFAULT_PREFERENCES, "Gucci");
    expect(Object.prototype.hasOwnProperty.call(payload, "referenceImage")).toBe(false);
    expect(modelCreatePreferencesSchema.safeParse(overTheWire(payload)).success).toBe(true);
  });

  it("an ordinary valid casting form is accepted by schema and intake", () => {
    const payload = buildCreationPreferences(ORDINARY_FORM, ORDINARY_FORM.castingBrand || "Prada");
    expect(modelCreatePreferencesSchema.safeParse(overTheWire(payload)).success).toBe(true);
    expect(validateCreationIntent(payload as Record<string, unknown>)).toEqual({ ok: true });
  });

  it("a reference selected before the first headshot cannot leak into creation", () => {
    const withReference: ModelPreferences = {
      ...ORDINARY_FORM,
      referenceImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg",
    };
    const payload = buildCreationPreferences(withReference, "Prada");
    expect(Object.prototype.hasOwnProperty.call(payload, "referenceImage")).toBe(false);
    expect(modelCreatePreferencesSchema.safeParse(overTheWire(payload)).success).toBe(true);
    expect(validateCreationIntent(payload as Record<string, unknown>)).toEqual({ ok: true });
  });

  it("REGRESSION: a referenceImage key set to undefined still reaches the server after superjson — key removal, not undefined, is the fix", () => {
    const payload = buildCreationPreferences(DEFAULT_PREFERENCES, "Gucci");
    const buggy = { ...payload, referenceImage: undefined };
    const wire = overTheWire(buggy) as Record<string, unknown>;
    // superjson round-trips undefined WITH the key present…
    expect(Object.prototype.hasOwnProperty.call(wire, "referenceImage")).toBe(true);
    // …and the strict schema rejects on key presence (the production error)
    expect(modelCreatePreferencesSchema.safeParse(wire).success).toBe(false);
  });
});

describe("the guarded post-headshot iteration path keeps its reference (§10.3)", () => {
  it("iterate accepts a payload with a reference image", () => {
    // Shape performIteration sends after the first headshot exists
    const result = iterateInputSchema.safeParse(overTheWire({
      modelId: 1,
      feedback: "use the hairstyle from the reference",
      assetId: 42,
      maskBase64: undefined,
      referenceImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg",
    }));
    expect(result.success).toBe(true);
    expect(result.success && result.data.referenceImage).toBeTruthy();
  });

  it("iterate accepts a payload without a reference image", () => {
    const result = iterateInputSchema.safeParse(overTheWire({
      modelId: 1,
      feedback: "soften the jawline slightly",
      assetId: 42,
      maskBase64: undefined,
      referenceImage: undefined,
    }));
    expect(result.success).toBe(true);
  });
});

describe("a clothing brief survives translation and refuses honestly at models.create (§10.2)", () => {
  const BRIEF = "A 24-year-old woman wearing a red leather jacket.";

  it("translate-brief → form → creation payload retains the clothing intent in userPrompt and is refused with routing copy, not a raw schema error", () => {
    // Realistic parser output for this brief per PARSER_PROMPT_V2: gender and
    // age extracted, clothing NOT structurally encoded, verbatim userPrompt
    const parsed = sanitizeParsed(
      {
        intent: "parsed",
        userPrompt: BRIEF,
        gender: "Female",
        age: "24",
        ethnicityBlend: [],
        castingVibe: { editorial: 0.33, commercial: 0.34, runway: 0.33 },
        randomizeFields: [],
      },
      BRIEF,
    );
    const merged = mergeParsedPreferences(parsed, {}, BRIEF);

    // ControlPanel.handleParsed applies the merge over the form defaults,
    // then handleGenerate builds the payload
    const formPrefs = { ...DEFAULT_PREFERENCES, ...merged } as unknown as ModelPreferences;
    const payload = buildCreationPreferences(formPrefs, "Prada");

    // The clothing intent is RETAINED, not silently stripped by the translator
    expect(payload.userPrompt).toBe(BRIEF);

    // The strict schema ACCEPTS the payload — no raw Zod error can mask
    // the honest refusal (the production bug hid it behind "Unrecognized key")
    expect(modelCreatePreferencesSchema.safeParse(overTheWire(payload)).success).toBe(true);

    // models.create's intake (which runs BEFORE any save or credit movement)
    // refuses with the plain-English creation-presentation routing copy
    const intake = validateCreationIntent(payload as Record<string, unknown>);
    expect(intake.ok).toBe(false);
    if (!intake.ok) {
      expect(intake.code).toBe("presentation");
      expect(intake.channel).toBe("userPrompt");
      expect(intake.message).toBe(REFUSAL_COPY.creationPresentation);
    }
  });
});
