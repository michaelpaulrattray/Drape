/**
 * ONE QUEUE, TWO ENGINES (#1079) — asserted at the object identity handed to
 * the engine factory.
 *
 * `assertFalBudget()` proves at boot that the declared paths' concurrency
 * allowances fit inside the provider account's ceiling of 20 requests in flight
 * (`ROLL_IMAGE_CONCURRENCY` 8 + `SIGN_VIEW_CONCURRENCY` 3 +
 * `REFINE_EDIT_CONCURRENCY` 3 + `FAL_CONCURRENCY` 5 = 19 of 20; it was five
 * paths summing to exactly 20 until the plate mint's row retired with the ink
 * studio, #1158 slice 4d). **That arithmetic counts requests, not models.**
 * So the moment the roll
 * road gained a second engine, the thing keeping it honest stopped being the
 * boot check and became one line — the queue instance both engines are handed.
 *
 * ⚠ **WHY AN ARM RATHER THAN A READ OF THE CODE.** Giving Flare its own queue
 * at `ROLL_IMAGE_CONCURRENCY` — the obvious, tidy-looking change — was driven
 * against the merged tree on 2026-09-22 and **5,690 tests passed** while the
 * roll road quietly claimed 16 of a 20-request ceiling. What that costs is on
 * this program's record already: the founder's fresh casts came back missing
 * eyes, brows and ears because reads over the line were refused, and a refused
 * courtesy read shows up as a feature the customer is told she does not have.
 *
 * The factory is mocked, so nothing is constructed that could dispatch and no
 * key is needed beyond the fixture; what is under test is what the roll engine
 * HANDS OVER, which no other suite looks at.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProviderQueue } from "../providers/providerQueue";

const handed: { model: string | undefined; queue: ProviderQueue | undefined }[] = [];

vi.mock("../providers/falImages", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../providers/falImages")>();
  return {
    ...actual,
    createFalCreativeEngine: (config: { model?: string; queue?: ProviderQueue }) => {
      handed.push({ model: config.model, queue: config.queue });
      return {
        id: `fal:${config.model}`,
        generateCandidate: async () => {
          throw new Error("this suite never dispatches");
        },
      };
    },
  };
});

const { FAL_GPT_IMAGE_2, FAL_GPT_IMAGE_25_FLARE } = await import("../providers/falImages");
const { castingCreativeEngine, resetCastingEngineForTests } = await import("./rollEngine");
const { CASTING_ROLL_ENGINE_SCOPE_ENV, CASTING_ROLL_ENGINE_MODEL_ENV, CASTING_V2_SCOPE_ENV } = await import("./castingV2Scope");

const KEYS = [CASTING_V2_SCOPE_ENV, CASTING_ROLL_ENGINE_SCOPE_ENV, CASTING_ROLL_ENGINE_MODEL_ENV, "FAL_KEY"];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of KEYS) saved[key] = process.env[key];
  process.env.FAL_KEY = "test-key";
  process.env[CASTING_V2_SCOPE_ENV] = "all";
  process.env[CASTING_ROLL_ENGINE_SCOPE_ENV] = "users:1";
  process.env[CASTING_ROLL_ENGINE_MODEL_ENV] = "flare";
  handed.length = 0;
  resetCastingEngineForTests();
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  resetCastingEngineForTests();
});

describe("#1079 · the two roll engines share ONE provider queue", () => {
  it("the Flare engine and the GPT Image 2 engine are handed the SAME ProviderQueue instance", () => {
    castingCreativeEngine(1);
    castingCreativeEngine(2);
    expect(handed.map((entry) => entry.model)).toEqual([FAL_GPT_IMAGE_25_FLARE, FAL_GPT_IMAGE_2]);
    expect(handed[0]?.queue).toBeDefined();
    /* Identity, not equality: two queues configured alike pass a deep compare
       and still spend the account's allowance twice over. */
    expect(handed[0]?.queue).toBe(handed[1]?.queue);
  });

  it("and the order of arrival does not change the answer — the plain engine first", () => {
    castingCreativeEngine(2);
    castingCreativeEngine(1);
    expect(handed).toHaveLength(2);
    expect(handed[0]?.queue).toBe(handed[1]?.queue);
  });

  it("positive control: the reader can tell two queues apart", () => {
    /* Without this, a reader that silently compared a value to itself — or one
       queue to `undefined` — would pass the arms above forever. */
    castingCreativeEngine(1);
    castingCreativeEngine(2);
    const other = { not: "the queue" } as unknown as ProviderQueue;
    expect(handed[0]?.queue).not.toBe(other);
    expect(handed[0]?.queue).not.toBeUndefined();
  });
});
