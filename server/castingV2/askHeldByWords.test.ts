import { describe, expect, it } from "vitest";
import { carriesHoldingTheirAsks, chainAsksBySlot, wordsHoldAsks } from "./askHeldByWords";
import { REFUSAL_THAT_IS_EVIDENCE_ONLY } from "./referenceCompleteness";

describe("the fixed word test behind #2650", () => {
  it("holds an ask when every claim-bearing word appears, endings forgiven", () => {
    expect(wordsHoldAsks(["Short textured pixie cut, closely cropped at the sides"], ["short crop"], "hair")).toBe(true);
    expect(wordsHoldAsks(["freckles scattered over the nose and both cheeks"], ["freckles across the nose and cheeks"], "skin")).toBe(true);
  });

  it("does not hold an ask the words argue with, or say nothing about", () => {
    expect(wordsHoldAsks(["Dark brown hair pulled into a high top bun"], ["short crop"], "hair")).toBe(false);
    expect(wordsHoldAsks([], ["short crop"], "hair")).toBe(false);
  });

  it("reads the chain's asks per whole slot, and leaves per-side slots and picture-taken asks alone", () => {
    const asks = chainAsksBySlot({ free: { hairCut: "short crop" }, eyeColour: "green" } as never);
    expect(asks.get("hair")).toEqual(["short crop"]);
    /* Ruling C: the library, not the delta, remembers which eye is green. */
    expect(Array.from(asks.keys()).some((slot) => slot.includes("@"))).toBe(false);
    const pictured = chainAsksBySlot({
      free: { hairCut: "the hair in the attached picture" }, fromPicture: ["hairCut"],
    } as never);
    expect(pictured.has("hair")).toBe(false);
  });
});

describe("the send side judges the row that would ride (#2650)", () => {
  const base = {
    publicId: "r", candidateId: 1, variantId: 5, role: "carry", slot: "hair", tier: "anatomy", noun: "hair",
    maskKey: null, digest: null, geometry: null, guard: null, refusal: null, retiredAt: null, createdAt: new Date(0),
  };
  const composed = { free: { hairCut: "short crop" } } as never;

  it("drops EVERY row of a slot whose live row contradicts — an older crop never resurfaces", () => {
    const rows = [
      { ...base, id: 1, version: 1, words: ["short hair, closely cropped"], storageKey: "old.png" },
      { ...base, id: 2, version: 2, words: ["hair pulled into a high top bun"], storageKey: "bun.png" },
    ] as never[];
    const result = carriesHoldingTheirAsks({ rows, composed });
    expect(result.rows).toHaveLength(0);
    expect(result.contradicted.map((row: { id: number }) => row.id)).toEqual([2]);
  });

  it("does not judge a disputed row, which never rides", () => {
    const rows = [{
      ...base, id: 3, version: 3, words: ["hair in a high top knot"], storageKey: null,
      refusal: { reason: REFUSAL_THAT_IS_EVIDENCE_ONLY, kind: "hair", coverage: 9900, contentKey: null, maskKey: null, geometry: null },
    }] as never[];
    const result = carriesHoldingTheirAsks({ rows, composed });
    expect(result.contradicted).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
  });
});
