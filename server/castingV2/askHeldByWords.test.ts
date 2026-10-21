import { describe, expect, it } from "vitest";
import { carriesHoldingTheirAsks, chainAsksBySlot, isComparativeAsk, wordsHoldAsks } from "./askHeldByWords";
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

  it("sets aside only the rows that argue, and the NEWEST holding row rides again (the relay's finding on #2653)", () => {
    const rows = [
      { ...base, id: 1, version: 1, words: ["short hair, closely cropped"], storageKey: "old.png" },
      { ...base, id: 2, version: 2, words: ["hair pulled into a high top bun"], storageKey: "bun.png" },
    ] as never[];
    const result = carriesHoldingTheirAsks({ rows, composed });
    expect(result.rows.map((row: { id: number }) => row.id)).toEqual([1]);
    expect(result.contradicted.map((row: { id: number }) => row.id)).toEqual([2]);
    expect(result.reinstated).toEqual(["hair"]);
    expect(result.contradictedSlots).toEqual([]);
  });

  it("with no holding row at all, every row stays home and the slot goes to words", () => {
    const rows = [
      { ...base, id: 4, version: 1, words: ["long hair worn down"], storageKey: "long.png" },
      { ...base, id: 5, version: 2, words: ["hair pulled into a high top bun"], storageKey: "bun.png" },
    ] as never[];
    const result = carriesHoldingTheirAsks({ rows, composed });
    expect(result.rows).toHaveLength(0);
    expect(result.contradictedSlots).toEqual(["hair"]);
    expect(result.reinstated).toEqual([]);
  });

  it("does not judge a disputed row, which never rides", () => {
    const rows = [{
      ...base, id: 3, version: 3, words: ["hair in a high top knot"], storageKey: null,
      refusal: { reason: REFUSAL_THAT_IS_EVIDENCE_ONLY, kind: "hair", coverage: 9900, contentKey: null, maskKey: null, geometry: null },
    }] as never[];
    const result = carriesHoldingTheirAsks({ rows, composed });
    expect(result.contradicted).toHaveLength(0);
    /* No row holds, so the slot is words — the disputed row was never sent. */
    expect(result.contradictedSlots).toEqual(["hair"]);
  });
});

describe("the word test reads only the customer's own words (#2666)", () => {
  const base = {
    publicId: "r", candidateId: 1, variantId: 5, role: "carry", slot: "hair", tier: "anatomy", noun: "hair",
    maskKey: null, digest: null, geometry: null, guard: null, refusal: null, retiredAt: null, createdAt: new Date(0),
  };
  const shortCrop = { ...base, id: 7, version: 2, words: ["short dark brown hair, closely cropped"], storageKey: "crop.png" };

  it("a real house cut name never becomes an ask, and the short-crop picture keeps riding", () => {
    /* The axis value as the interpreter files it: the house name, not the customer's words. */
    const composed = { hairStyle: "standard crop" } as never;
    expect(chainAsksBySlot(composed).has("hair")).toBe(false);
    const result = carriesHoldingTheirAsks({ rows: [shortCrop] as never[], composed });
    expect(result.rows.map((row: { id: number }) => row.id)).toEqual([7]);
    expect(result.contradicted).toHaveLength(0);
    expect(result.contradictedSlots).toEqual([]);
  });

  it("no guaranteed axis is ever read, whatever its value", () => {
    const composed = {
      eyeColour: "green", eyeShape: "almond", hairStyle: "standard crop",
      hairColour: "dark brown", hairTexture: "curly", makeup: "smoky eyeliner",
    } as never;
    expect(Array.from(chainAsksBySlot(composed).entries())).toEqual([]);
  });

  it("an axis beside a free ask leaves the free ask judged, and it still refuses a crop that argues", () => {
    const composed = { hairStyle: "standard crop", free: { hairWorn: "worn down" } } as never;
    expect(chainAsksBySlot(composed).get("hair")).toEqual(["worn down"]);
    const bun = { ...base, id: 8, version: 3, words: ["hair pulled into a high top bun"], storageKey: "bun.png" };
    const down = { ...base, id: 9, version: 1, words: ["short hair worn down, closely cropped"], storageKey: "down.png" };
    const result = carriesHoldingTheirAsks({ rows: [down, bun] as never[], composed });
    expect(result.rows.map((row: { id: number }) => row.id)).toEqual([9]);
    expect(result.reinstated).toEqual(["hair"]);
  });

  it("a comparative ask is left out, so the OLD crop is never reinstated against it", () => {
    expect(chainAsksBySlot({ free: { hairCut: "longer hair" } } as never).has("hair")).toBe(false);
    const oldLong = { ...base, id: 10, version: 1, words: ["long hair worn down"], storageKey: "old.png" };
    const newer = { ...base, id: 11, version: 2, words: ["very long hair to the waist"], storageKey: "new.png" };
    const result = carriesHoldingTheirAsks({ rows: [oldLong, newer] as never[], composed: { free: { hairCut: "longer hair" } } as never });
    /* Not judged: nothing set aside, nothing reinstated from the past. */
    expect(result.contradicted).toHaveLength(0);
    expect(result.reinstated).toEqual([]);
    expect(result.rows).toHaveLength(2);
  });

  it("the comparative reader catches the comparative and nothing ordinary", () => {
    for (const ask of ["fuller brows", "a bit darker", "more freckles", "greener still", "much shorter hair"]) {
      expect(isComparativeAsk(ask), ask).toBe(true);
    }
    for (const ask of ["short crop", "silver hair", "copper waves", "layered bob", "freckles across the nose", "worn down"]) {
      expect(isComparativeAsk(ask), ask).toBe(false);
    }
  });
});
