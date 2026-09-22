/**
 * THE ROLL ENGINE ON HIS ACCOUNT (#1079): under `CASTING_ROLL_ENGINE_FLARE_SCOPE`
 * a user's roll renders on GPT Image 2.5 Flare; everyone else's on GPT Image 2;
 * both on ONE queue. And the edit sibling each engine takes for an image-anchored
 * render is declared per model, never assumed.
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
  editSiblingOf,
} from "../providers/falImages";
import { CASTING_ROLL_ENGINE_FLARE_SCOPE_ENV, CASTING_V2_SCOPE_ENV } from "./castingV2Scope";
import { castingCreativeEngine, resetCastingEngineForTests } from "./rollEngine";

const saved: Record<string, string | undefined> = {};
const KEYS = [CASTING_V2_SCOPE_ENV, CASTING_ROLL_ENGINE_FLARE_SCOPE_ENV, "FAL_KEY", "ROLL_IMAGE_CONCURRENCY", "ROLL_IMAGE_MAX_QUEUE_DEPTH"];

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k];
  process.env.FAL_KEY = "test-key";
  process.env[CASTING_V2_SCOPE_ENV] = "all";
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
  it("off, or absent: everyone renders on GPT Image 2 — the bytes every roll received before", () => {
    delete process.env[CASTING_ROLL_ENGINE_FLARE_SCOPE_ENV];
    expect(castingCreativeEngine(1).id).toBe(`fal:${FAL_GPT_IMAGE_2}`);
    expect(castingCreativeEngine(2).id).toBe(`fal:${FAL_GPT_IMAGE_2}`);
    expect(castingCreativeEngine().id).toBe(`fal:${FAL_GPT_IMAGE_2}`);
  });

  it("users:1 — his roll renders on Flare, another account's on GPT Image 2, a caller with no user on GPT Image 2", () => {
    process.env[CASTING_ROLL_ENGINE_FLARE_SCOPE_ENV] = "users:1";
    expect(castingCreativeEngine(1).id).toBe(`fal:${FAL_GPT_IMAGE_25_FLARE}`);
    expect(castingCreativeEngine(2).id).toBe(`fal:${FAL_GPT_IMAGE_2}`);
    expect(castingCreativeEngine().id).toBe(`fal:${FAL_GPT_IMAGE_2}`);
  });

  it("the two engines are memoized separately and survive each other", () => {
    process.env[CASTING_ROLL_ENGINE_FLARE_SCOPE_ENV] = "users:1";
    const flare = castingCreativeEngine(1);
    const plain = castingCreativeEngine(2);
    expect(castingCreativeEngine(1)).toBe(flare);
    expect(castingCreativeEngine(2)).toBe(plain);
    expect(flare).not.toBe(plain);
  });

  it("the flag reads through the parent — CASTING_V2_SCOPE off means GPT Image 2 for everyone", () => {
    process.env[CASTING_V2_SCOPE_ENV] = "off";
    process.env[CASTING_ROLL_ENGINE_FLARE_SCOPE_ENV] = "users:1";
    expect(castingCreativeEngine(1).id).toBe(`fal:${FAL_GPT_IMAGE_2}`);
  });
});

describe("#1079 · the edit sibling is declared per engine", () => {
  it("both roll engines have an edit door, and it is their own", () => {
    expect(editSiblingOf(FAL_GPT_IMAGE_2)).toBe(FAL_GPT_IMAGE_2_EDIT);
    expect(editSiblingOf(FAL_GPT_IMAGE_25_FLARE)).toBe(FAL_GPT_IMAGE_25_FLARE_EDIT);
  });

  it("a model with no sibling has none — the render refuses a reference rather than painting strangers", () => {
    expect(editSiblingOf("openai/gpt-image-2.5/sunburst/text-to-image")).toBeNull();
    expect(editSiblingOf("fal-ai/nano-banana-pro")).toBeNull();
  });

  it("the Flare endpoints are the fal ids the court rendered on (#1068)", () => {
    expect(FAL_GPT_IMAGE_25_FLARE).toBe("openai/gpt-image-2.5/flare/text-to-image");
    expect(FAL_GPT_IMAGE_25_FLARE_EDIT).toBe("openai/gpt-image-2.5/flare/edit");
  });
});
