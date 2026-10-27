import { describe, expect, it } from "vitest";
import { axisAskWords, carriesHoldingTheirAsks, chainAsksBySlot, isComparativeAsk, wordsHoldAsks } from "./askHeldByWords";
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

describe("the word test never holds a crop to a house name (#2666)", () => {
  const base = {
    publicId: "r", candidateId: 1, variantId: 5, role: "carry", slot: "hair", tier: "anatomy", noun: "hair",
    maskKey: null, digest: null, geometry: null, guard: null, refusal: null, retiredAt: null, createdAt: new Date(0),
  };
  const shortCrop = { ...base, id: 7, version: 2, words: ["short dark brown hair, closely cropped"], storageKey: "crop.png" };

  it("a house cut name is tested as its family, so the short-crop picture keeps riding (the card's case)", () => {
    /* The axis value as the interpreter files it: the house name, not the customer's words. */
    const composed = { hairStyle: "standard crop" } as never;
    expect(chainAsksBySlot(composed).get("hair")).toEqual(["cropped"]);
    const result = carriesHoldingTheirAsks({ rows: [shortCrop] as never[], composed });
    expect(result.rows.map((row: { id: number }) => row.id)).toEqual([7]);
    expect(result.contradicted).toHaveLength(0);
    expect(result.contradictedSlots).toEqual([]);
  });

  it("a bun crop never rides against a short-crop cut filed as an axis (the #2650 case)", () => {
    const composed = { hairStyle: "standard crop" } as never;
    const bun = { ...base, id: 12, version: 3, words: ["Dark brown hair pulled into a high top bun"], storageKey: "bun.png" };
    const alone = carriesHoldingTheirAsks({ rows: [bun] as never[], composed });
    expect(alone.rows).toHaveLength(0);
    expect(alone.contradictedSlots).toEqual(["hair"]);
    /* And with the step-1 crop still in the library, that one rides instead. */
    const both = carriesHoldingTheirAsks({ rows: [shortCrop, bun] as never[], composed });
    expect(both.rows.map((row: { id: number }) => row.id)).toEqual([7]);
    expect(both.contradicted.map((row: { id: number }) => row.id)).toEqual([12]);
    expect(both.reinstated).toEqual(["hair"]);
  });

  it("a hair colour is still tested: a black-hair crop does not ride against copper", () => {
    const composed = { hairColour: "copper" } as never;
    expect(chainAsksBySlot(composed).get("hair")).toEqual(["copper"]);
    const black = { ...base, id: 13, version: 2, words: ["short black hair, closely cropped"], storageKey: "black.png" };
    const result = carriesHoldingTheirAsks({ rows: [black] as never[], composed });
    expect(result.rows).toHaveLength(0);
    expect(result.contradictedSlots).toEqual(["hair"]);
    const copper = { ...base, id: 14, version: 3, words: ["short copper hair, closely cropped"], storageKey: "copper.png" };
    expect(carriesHoldingTheirAsks({ rows: [copper] as never[], composed }).rows).toHaveLength(1);
  });

  it("plain-word axes ask their own value; a trend eye shape asks nothing", () => {
    expect(axisAskWords("hairTexture", "curly")).toBe("curly");
    expect(axisAskWords("eyeColour", "green")).toBe("green");
    expect(axisAskWords("makeup", "smoky eyeliner")).toBe("smoky eyeliner");
    expect(axisAskWords("eyeShape", "hooded")).toBe("hooded");
    expect(axisAskWords("eyeShape", "fox eyes")).toBeNull();
    /* Derived from the cut table, never a copied list. */
    expect(axisAskWords("hairStyle", "bob")).toBe("mid-length");
  });

  it("an axis beside a free ask: both are judged, and a crop that argues is still refused", () => {
    const composed = { hairStyle: "standard crop", free: { hairWorn: "worn down" } } as never;
    expect(chainAsksBySlot(composed).get("hair")).toEqual(["cropped", "worn down"]);
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
