/**
 * WHICH ENGINE RENDERS A ROLL — `CASTING_ROLL_ENGINE_FLARE_SCOPE` (#1079).
 *
 * The founder read court #1068's three strips of his own cyborg brief and
 * ruled, verbatim: *"honestly flare gave good results … switch to flare and
 * let me roll some ill be able to see the difference."* What that ruling
 * becomes in code is a scope flag, and these are the four things it has to be
 * true of:
 *
 *   1. **Absent means off, and off is byte-identical to before.** Every user,
 *      including his, renders on GPT Image 2 with no flag set.
 *   2. **The scope is per user.** Inside it, Flare; outside it, GPT Image 2 —
 *      in the same process, with no restart between the two reads.
 *   3. **ONE QUEUE.** Both engines are handed the SAME `ProviderQueue`
 *      instance. `assertFalBudget()` proves an account ceiling of 20 requests
 *      in flight across five paths; it counts requests, not models, so a
 *      second queue at `ROLL_IMAGE_CONCURRENCY` would silently double the roll
 *      road's claim on it. This is asserted at the object identity handed to
 *      the engine factory, not inferred from the code reading that way.
 *   4. **The chain is enforced where it is used**, not only at boot: a user
 *      outside `CASTING_V2_SCOPE` has no roll to render whatever this flag
 *      says.
 *
 * The engine factory is mocked so nothing dispatches and no money moves; what
 * is under test is the CHOICE, and the wire itself is proven in
 * `server/providers/falImagesAnchored.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FAL_GPT_IMAGE_2, FAL_GPT_IMAGE_2_5_FLARE } from "../providers/falImages";
import type { ProviderQueue } from "../providers/providerQueue";

const built: { model: string | undefined; queue: ProviderQueue | undefined }[] = [];

vi.mock("../providers/falImages", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../providers/falImages")>();
  return {
    ...actual,
    createFalCreativeEngine: (config: { model?: string; queue?: ProviderQueue }) => {
      built.push({ model: config.model, queue: config.queue });
      return { id: `fal:${config.model}`, generateCandidate: async () => { throw new Error("not dispatched in this suite"); } };
    },
  };
});

const { castingCreativeEngine, resetCastingEngineForTests } = await import("./rollEngine");
const {
  CASTING_ROLL_ENGINE_FLARE_SCOPE_ENV,
  validateCastingRollEngineFlareEnvironment,
} = await import("./castingV2Scope");

const CASTING = "CASTING_V2_SCOPE";
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of [CASTING, CASTING_ROLL_ENGINE_FLARE_SCOPE_ENV, "FAL_KEY"]) saved[key] = process.env[key];
  process.env.FAL_KEY = "test-key";
  process.env[CASTING] = "all";
  delete process.env[CASTING_ROLL_ENGINE_FLARE_SCOPE_ENV];
  built.length = 0;
  resetCastingEngineForTests();
});

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetCastingEngineForTests();
});

describe("the roll engine inside CASTING_ROLL_ENGINE_FLARE_SCOPE", () => {
  it("absent means off: every user renders on GPT Image 2, his account included", () => {
    expect(castingCreativeEngine(1).id).toBe(`fal:${FAL_GPT_IMAGE_2}`);
    expect(castingCreativeEngine(2).id).toBe(`fal:${FAL_GPT_IMAGE_2}`);
    expect(built.map((entry) => entry.model)).toEqual([FAL_GPT_IMAGE_2]);
  });

  it('"off" spelled out is the same answer as absent', () => {
    process.env[CASTING_ROLL_ENGINE_FLARE_SCOPE_ENV] = "off";
    expect(castingCreativeEngine(1).id).toBe(`fal:${FAL_GPT_IMAGE_2}`);
  });

  it("users:1 — HIS rolls render on Flare and nobody else's move, in one process", () => {
    process.env[CASTING_ROLL_ENGINE_FLARE_SCOPE_ENV] = "users:1";
    expect(castingCreativeEngine(1).id).toBe(`fal:${FAL_GPT_IMAGE_2_5_FLARE}`);
    expect(castingCreativeEngine(2).id).toBe(`fal:${FAL_GPT_IMAGE_2}`);
    /* And the answer does not drift on a second read of the same user. */
    expect(castingCreativeEngine(1).id).toBe(`fal:${FAL_GPT_IMAGE_2_5_FLARE}`);
  });

  it('"all" moves everyone', () => {
    process.env[CASTING_ROLL_ENGINE_FLARE_SCOPE_ENV] = "all";
    expect(castingCreativeEngine(7).id).toBe(`fal:${FAL_GPT_IMAGE_2_5_FLARE}`);
  });

  it("ONE QUEUE: the two engines are handed the same ProviderQueue instance", () => {
    process.env[CASTING_ROLL_ENGINE_FLARE_SCOPE_ENV] = "users:1";
    castingCreativeEngine(1);
    castingCreativeEngine(2);
    expect(built).toHaveLength(2);
    expect(built[0]?.model).toBe(FAL_GPT_IMAGE_2_5_FLARE);
    expect(built[1]?.model).toBe(FAL_GPT_IMAGE_2);
    expect(built[0]?.queue).toBeDefined();
    /* Identity, not equality: two queues configured alike would pass a deep
       compare and still spend the account allowance twice. */
    expect(built[0]?.queue).toBe(built[1]?.queue);
  });

  it("memoized per model: a second roll on the same engine builds nothing new", () => {
    process.env[CASTING_ROLL_ENGINE_FLARE_SCOPE_ENV] = "users:1";
    const first = castingCreativeEngine(1);
    const second = castingCreativeEngine(1);
    expect(second).toBe(first);
    expect(built).toHaveLength(1);
  });

  it("the parent is enforced at the point of use, not only at boot", () => {
    process.env[CASTING] = "users:2";
    process.env[CASTING_ROLL_ENGINE_FLARE_SCOPE_ENV] = "users:1";
    /* User 1 is named by the child and is outside casting entirely: no roll to
       render, so the flag cannot reach him. */
    expect(castingCreativeEngine(1).id).toBe(`fal:${FAL_GPT_IMAGE_2}`);
  });

  it("a malformed scope refuses rather than guessing", () => {
    process.env[CASTING_ROLL_ENGINE_FLARE_SCOPE_ENV] = "users:abc";
    expect(() => castingCreativeEngine(1)).toThrow(/must be "off", "all", or "users:"/);
  });
});

describe("the boot check on CASTING_ROLL_ENGINE_FLARE_SCOPE", () => {
  it("refuses a scope reaching past its parent", () => {
    expect(() =>
      validateCastingRollEngineFlareEnvironment({ scope: "users:1,2", castingScope: "users:1" }),
    ).toThrow(/names users outside CASTING_V2_SCOPE: 2/);
  });

  it('refuses "all" under a limited parent', () => {
    expect(() =>
      validateCastingRollEngineFlareEnvironment({ scope: "all", castingScope: "users:1" }),
    ).toThrow(/cannot be "all"/);
  });

  it("refuses being on while casting is off", () => {
    expect(() =>
      validateCastingRollEngineFlareEnvironment({ scope: "users:1", castingScope: undefined }),
    ).toThrow(/there is no roll to render/);
  });

  it("refuses a malformed value", () => {
    expect(() =>
      validateCastingRollEngineFlareEnvironment({ scope: "user:1", castingScope: "all" }),
    ).toThrow(/must be "off", "all", or "users:"/);
  });

  it("positive control: the check PASSES the shapes production will actually carry", () => {
    expect(validateCastingRollEngineFlareEnvironment({ scope: undefined, castingScope: "all" }).kind).toBe("off");
    expect(validateCastingRollEngineFlareEnvironment({ scope: "users:1", castingScope: "all" })).toEqual({
      kind: "users",
      userIds: [1],
    });
  });
});
