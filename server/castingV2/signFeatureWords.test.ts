/**
 * THE SIGN'S OWN HALF OF ARROW 6 — the read, its failures, and the boundary the
 * words must never cross.
 *
 * `viewFeatureWords.test.ts` tries the RULE and `packageOrchestrator.test.ts`
 * tries the WIRE. What is left is the gathering: that it anchors on the branch
 * the Sign was quoted against, that a database that will not answer costs the
 * customer some words rather than the whole Cast, and that the words go to the
 * engine and to no log or staff surface — the class the access grid keeps out
 * of every projection.
 *
 * Driven directly (working law 3): every refusal below is reachable only
 * through a whole Sign, and a backstop whose only test runs through a caller
 * that usually behaves is a backstop nothing has tested.
 */
import { describe, expect, it, vi } from "vitest";

/**
 * The logger is mocked so the FIELDS this lane writes are readable — the same
 * shape `faceScan.test.ts` and `refineService.test.ts` use, and the fields are
 * ours either way.
 */
const logged: { fields: Record<string, unknown>; message: string }[] = [];
vi.mock("../logging/logger", () => {
  const record = () => (fields: unknown, message: string) => {
    logged.push({ fields: (fields ?? {}) as Record<string, unknown>, message });
  };
  return {
    createModuleLogger: () => ({
      error: record(), warn: record(), info: record(), debug: record(), fatal: record(),
    }),
  };
});

import { carriedFeatureWords, type SignServiceDependencies } from "./signService";

const WORDS = "a long scaled tail at the base of the spine";

const row = (over: Record<string, unknown> = {}) => ({
  id: 1,
  publicId: "ref-1",
  candidateId: 7,
  variantId: null,
  role: "carry" as const,
  slot: "open:tail",
  tier: "anatomy" as const,
  noun: "tail",
  words: [WORDS],
  storageKey: null,
  maskKey: null,
  digest: null,
  geometry: null,
  guard: null,
  refusal: null,
  version: 1,
  retiredAt: null,
  createdAt: new Date("2026-08-19T00:00:00Z"),
  ...over,
});

const deps = (over: Partial<SignServiceDependencies> = {}): SignServiceDependencies => ({
  listLibrary: vi.fn(async () => [row()] as never),
  readKindRegion: vi.fn(async () => ({
    locality: "single" as const,
    anchorRegion: "belowWaist" as const,
    model: "m",
    promptVersion: "v1",
  })),
  ...over,
} as SignServiceDependencies);

const input = {
  userId: 1,
  candidateId: 7,
  selectedVariantId: 42,
  operationId: "55555555-5555-4555-8555-555555555555",
};

describe("gathering the words the anchor cannot show", () => {
  it("reads the library of the BRANCH this Sign is anchoring on", async () => {
    const listLibrary = vi.fn(async () => [row()] as never);
    await carriedFeatureWords(deps({ listLibrary }), input);
    /*
      The variant, not the candidate's master. A Cast signed off one branch
      carrying another branch's features is `branch-state-identity` failing,
      and it is invisible until a customer sees a feature they removed.
    */
    expect(listLibrary).toHaveBeenCalledWith({
      userId: 1,
      candidateId: 7,
      anchorVariantId: 42,
    });
  });

  it("carries a feature the master frame cannot reach", async () => {
    const carried = await carriedFeatureWords(deps(), input);
    expect(carried).toEqual([{
      slot: "open:tail",
      noun: "tail",
      words: [WORDS],
      region: "belowWaist",
    }]);
  });

  it("carries NOTHING when the same feature sits where the anchor can see it", async () => {
    const readKindRegion = vi.fn(async () => ({
      locality: "single" as const,
      anchorRegion: "torso" as const,
      model: "m",
      promptVersion: "v1",
    }));
    expect(await carriedFeatureWords(deps({ readKindRegion }), input)).toEqual([]);
  });

  it("asks for each kind's region ONCE, however many slots it files", async () => {
    /* A distributed kind files one slot per side and they share a properties
       row. Two reads would be two round trips for one answer on every Sign. */
    const listLibrary = vi.fn(async () => [
      row({ id: 1, slot: "open:wings@left", noun: "left wing" }),
      row({ id: 2, slot: "open:wings@right", noun: "right wing" }),
    ] as never);
    const readKindRegion = vi.fn(async () => ({
      locality: "distributed" as const,
      anchorRegion: "belowWaist" as const,
      model: "m",
      promptVersion: "v1",
    }));
    const carried = await carriedFeatureWords(deps({ listLibrary, readKindRegion }), input);
    expect(readKindRegion).toHaveBeenCalledTimes(1);
    expect(carried.map((feature) => feature.slot)).toEqual(["open:wings@left", "open:wings@right"]);
  });
});

describe("a read that fails costs words, never the Cast", () => {
  it("returns nothing when the library cannot be read", async () => {
    const listLibrary = vi.fn(async () => { throw new Error("db down"); });
    await expect(carriedFeatureWords(deps({ listLibrary }), input)).resolves.toEqual([]);
  });

  it("returns nothing for a kind whose region read throws — never a guess", async () => {
    const readKindRegion = vi.fn(async () => { throw new Error("db down"); });
    await expect(carriedFeatureWords(deps({ readKindRegion }), input)).resolves.toEqual([]);
  });

  it("returns nothing for a kind with no properties row at all", async () => {
    const readKindRegion = vi.fn(async () => null);
    await expect(carriedFeatureWords(deps({ readKindRegion }), input)).resolves.toEqual([]);
  });

  it("is inert for a face with an empty library", async () => {
    const listLibrary = vi.fn(async () => [] as never);
    const readKindRegion = vi.fn(async () => null);
    expect(await carriedFeatureWords(deps({ listLibrary, readKindRegion }), input)).toEqual([]);
    /* Not one round trip bought for a face that has nothing to say. */
    expect(readKindRegion).not.toHaveBeenCalled();
  });
});

describe("the words reach the engine and nothing else", () => {
  it("the log line names the SLOT and never the words", async () => {
    /*
      The library's words are the customer's creative content — the same class
      as `masterPrompt`, which the access grid keeps out of every staff surface.
      A log IS a staff surface. The whole payload is serialized rather than
      walked field by field, because a leak arrives through the field nobody
      thought to check.
    */
    logged.length = 0;
    await carriedFeatureWords(deps(), input);

    const line = logged.find((entry) => entry.message.includes("carry as words"));
    expect(line).toBeDefined();
    expect(JSON.stringify(line!.fields)).toContain("open:tail");
    expect(JSON.stringify(line!.fields)).not.toContain("scaled");
    expect(JSON.stringify(line!.fields)).not.toContain(WORDS);
  });

  it("and a declined feature is reported by slot and reason, still without its words", async () => {
    /* The refusals are the half most likely to reach for the words in order to
       explain itself, which is exactly why the negative arm is here too. */
    const readKindRegion = vi.fn(async () => ({
      locality: "single" as const,
      anchorRegion: "torso" as const,
      model: "m",
      promptVersion: "v1",
    }));
    logged.length = 0;
    await carriedFeatureWords(deps({ readKindRegion }), input);

    const line = logged.find((entry) => entry.message.includes("carry as words"));
    expect(line!.fields).toMatchObject({
      rode: [],
      declined: [{ slot: "open:tail", reason: "shown" }],
    });
    expect(JSON.stringify(line!.fields)).not.toContain(WORDS);
  });
});
