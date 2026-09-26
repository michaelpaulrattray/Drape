/**
 * THE ROLL ENGINE ON HIS ACCOUNT (#1079, #1084): under `CASTING_ROLL_ENGINE_SCOPE`
 * a user's roll renders on the 2.5 model `CASTING_ROLL_ENGINE_MODEL` names;
 * both on ONE queue. And the edit sibling each engine takes for an image-anchored
 * render is declared per model, never assumed.
 *
 * ⚠ **EVERYONE ELSE NOW RENDERS ON SUNBURST, NOT ON GPT IMAGE 2 (#1340** — his
 * word, 2026-09-26: *"anywhere we currently use gpt image 2.0 will be 2.5
 * sunburst by default now"*). Every arm below that used to read GPT Image 2 as
 * the unscoped answer reads Sunburst instead, and that is the change rather
 * than a loosened assertion: **before it, his account rolled on Sunburst and
 * every other account rolled on the older engine.** The scope flag now selects
 * an EXCEPTION — which is how a court puts somebody on `flare`.
 *
 * Driven at the engine's own door with the real factory (no network: the
 * engine is never asked to render), so a rename of the flag or a lost sibling
 * reddens here rather than on his sheet.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  FAL_GPT_IMAGE_2,
  FAL_GPT_IMAGE_2_EDIT,
  FAL_GPT_IMAGE_25_FLARE,
  FAL_GPT_IMAGE_25_FLARE_EDIT,
  FAL_GPT_IMAGE_25_SUNBURST,
  FAL_GPT_IMAGE_25_SUNBURST_EDIT,
  editSiblingOf,
} from "../providers/falImages";
import {
  CASTING_ROLL_ENGINE_MODEL_ENV,
  CASTING_ROLL_ENGINE_SCOPE_ENV,
  CASTING_V2_SCOPE_ENV,
  validateCastingRollEngineEnvironment,
} from "./castingV2Scope";
import { castingCreativeEngine, resetCastingEngineForTests } from "./rollEngine";

const saved: Record<string, string | undefined> = {};
const KEYS = [CASTING_V2_SCOPE_ENV, CASTING_ROLL_ENGINE_SCOPE_ENV, CASTING_ROLL_ENGINE_MODEL_ENV, "FAL_KEY", "ROLL_IMAGE_CONCURRENCY", "ROLL_IMAGE_MAX_QUEUE_DEPTH"];

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k];
  process.env.FAL_KEY = "test-key";
  process.env[CASTING_V2_SCOPE_ENV] = "all";
  process.env[CASTING_ROLL_ENGINE_MODEL_ENV] = "flare";
  resetCastingEngineForTests();
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  resetCastingEngineForTests();
});

describe("#1079 · which engine paints whose roll", () => {
  it("off, or absent: EVERYONE renders on Sunburst — the default his 2026-09-26 word moved (#1340)", () => {
    delete process.env[CASTING_ROLL_ENGINE_SCOPE_ENV];
    expect(castingCreativeEngine(1).id).toBe(`fal:${FAL_GPT_IMAGE_25_SUNBURST}`);
    expect(castingCreativeEngine(2).id).toBe(`fal:${FAL_GPT_IMAGE_25_SUNBURST}`);
    expect(castingCreativeEngine().id).toBe(`fal:${FAL_GPT_IMAGE_25_SUNBURST}`);
    /* Named, because the regression this guards is a silent return to the
       engine every non-founder account was still on until #1340. */
    expect(castingCreativeEngine(2).id).not.toBe(`fal:${FAL_GPT_IMAGE_2}`);
  });

  it("users:1 + model flare — his roll renders on Flare and everyone else's on Sunburst", () => {
    process.env[CASTING_ROLL_ENGINE_SCOPE_ENV] = "users:1";
    expect(castingCreativeEngine(1).id).toBe(`fal:${FAL_GPT_IMAGE_25_FLARE}`);
    expect(castingCreativeEngine(2).id).toBe(`fal:${FAL_GPT_IMAGE_25_SUNBURST}`);
    expect(castingCreativeEngine().id).toBe(`fal:${FAL_GPT_IMAGE_25_SUNBURST}`);
  });

  it("users:1 + model sunburst — scoped and unscoped now name the SAME engine, and are still two branches", () => {
    process.env[CASTING_ROLL_ENGINE_SCOPE_ENV] = "users:1";
    process.env[CASTING_ROLL_ENGINE_MODEL_ENV] = "sunburst";
    expect(castingCreativeEngine(1).id).toBe(`fal:${FAL_GPT_IMAGE_25_SUNBURST}`);
    expect(castingCreativeEngine(2).id).toBe(`fal:${FAL_GPT_IMAGE_25_SUNBURST}`);
    /*
      Since #1340 this is the production position and both answers agree, so an
      id comparison alone could pass with the scope branch deleted entirely.
      The INSTANCES still differ — one is memoized per chosen model, the other
      is the single default engine — which is what proves the flag is still
      wired rather than merely harmless.
    */
    expect(castingCreativeEngine(1)).not.toBe(castingCreativeEngine(2));
  });

  it("a scope with no model behind it, or a model outside the vocabulary, is a BOOT refusal — never a silent GPT Image 2", () => {
    expect(() => validateCastingRollEngineEnvironment({ scope: "users:1", castingScope: "all", model: undefined }))
      .toThrow(/CASTING_ROLL_ENGINE_MODEL must be one of flare, sunburst/);
    expect(() => validateCastingRollEngineEnvironment({ scope: "users:1", castingScope: "all", model: "dall-e" }))
      .toThrow(/got "dall-e"/);
    expect(validateCastingRollEngineEnvironment({ scope: "users:1", castingScope: "all", model: "Sunburst" }))
      .toEqual({ kind: "users", userIds: [1] });
    /* Off needs no model — the variable is only read when someone is under scope. */
    expect(validateCastingRollEngineEnvironment({ scope: undefined, castingScope: "all", model: undefined })).toEqual({ kind: "off" });
    /* And at the point of use an unset model under scope falls to the DEFAULT,
       which is Sunburst since #1340 (the boot refusal is what keeps this
       unreachable on production). */
    process.env[CASTING_ROLL_ENGINE_SCOPE_ENV] = "users:1";
    delete process.env[CASTING_ROLL_ENGINE_MODEL_ENV];
    expect(castingCreativeEngine(1).id).toBe(`fal:${FAL_GPT_IMAGE_25_SUNBURST}`);
  });

  it("the two engines are memoized separately and survive each other", () => {
    process.env[CASTING_ROLL_ENGINE_SCOPE_ENV] = "users:1";
    const flare = castingCreativeEngine(1);
    const plain = castingCreativeEngine(2);
    expect(castingCreativeEngine(1)).toBe(flare);
    expect(castingCreativeEngine(2)).toBe(plain);
    expect(flare).not.toBe(plain);
  });

  it("the flag reads through the parent — CASTING_V2_SCOPE off means the default engine for everyone", () => {
    process.env[CASTING_V2_SCOPE_ENV] = "off";
    process.env[CASTING_ROLL_ENGINE_SCOPE_ENV] = "users:1";
    expect(castingCreativeEngine(1).id).toBe(`fal:${FAL_GPT_IMAGE_25_SUNBURST}`);
    /* The arm is about the PARENT gating the child, so it has to fail when the
       child is honoured: Flare is what he would get if the chain leaked. */
    expect(castingCreativeEngine(1).id).not.toBe(`fal:${FAL_GPT_IMAGE_25_FLARE}`);
  });
});

describe("#1079 · the edit sibling is declared per engine", () => {
  it("all three roll engines have an edit door, and it is their own", () => {
    expect(editSiblingOf(FAL_GPT_IMAGE_2)).toBe(FAL_GPT_IMAGE_2_EDIT);
    expect(editSiblingOf(FAL_GPT_IMAGE_25_FLARE)).toBe(FAL_GPT_IMAGE_25_FLARE_EDIT);
    expect(editSiblingOf(FAL_GPT_IMAGE_25_SUNBURST)).toBe(FAL_GPT_IMAGE_25_SUNBURST_EDIT);
  });

  it("a model with no sibling has none — the render refuses a reference rather than painting strangers", () => {
    expect(editSiblingOf("fal-ai/nano-banana-pro")).toBeNull();
    expect(editSiblingOf("openai/gpt-image-3")).toBeNull();
  });

  it("the Flare endpoints are the fal ids the court rendered on (#1068)", () => {
    expect(FAL_GPT_IMAGE_25_FLARE).toBe("openai/gpt-image-2.5/flare/text-to-image");
    expect(FAL_GPT_IMAGE_25_FLARE_EDIT).toBe("openai/gpt-image-2.5/flare/edit");
  });
});
