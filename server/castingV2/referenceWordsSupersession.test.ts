/**
 * A SUPERSEDED ROW KEEPS ITS CARRIER, BYTE FOR BYTE.
 *
 * The defect these drive is not hypothetical: three rows of a live production
 * commit replaced crop-bearing rows with words-only ones, at a higher version,
 * so the slot stopped carrying — and two of the three had empty words as well,
 * leaving a face's earrings with neither a sentence nor a picture.
 *
 * Every case here asserts the FIELDS THAT TRAVEL, because "the carrier is
 * copied" is the whole claim and a test that only checked the words would have
 * passed against the mechanism that caused the incident.
 */
import { describe, expect, it } from "vitest";

import { assertReferenceRowShape } from "../db/castingV2ReferenceLibrary";
import { supersedingWordsRow, wordsAreUntrue } from "./referenceWordsSupersession";
import type { StoredReference } from "./referenceLibrary";

const GEOMETRY = {
  bbox: { x: 480, y: 300, width: 27, height: 74 },
  frame: { width: 1024, height: 1536 },
};

function stored(overrides: Partial<StoredReference> = {}): StoredReference {
  return {
    id: 8,
    publicId: "ref-8",
    candidateId: 1598,
    variantId: 170,
    role: "carry",
    slot: "earring@right" as StoredReference["slot"],
    tier: "item",
    noun: "right earring",
    words: ["Small gold hoop earrings with a dangling gold cross charm hanging from each hoop."],
    storageKey: "casting-v2/library/earring-right.png",
    maskKey: "casting-v2/library/earring-right-mask.png",
    digest: "b3d1c0ffee0000000000000000000000000000000000000000000000000000aa",
    geometry: GEOMETRY,
    guard: { kind: "earring", coverage: 8800, spill: 120, threshold: 7000 },
    refusal: null,
    version: 3,
    retiredAt: null,
    createdAt: new Date("2026-08-11T00:00:00Z"),
    ...overrides,
  };
}

describe("supersedingWordsRow — only the words change", () => {
  it("carries the crop, its mask, its digest, its geometry and its guard reading across", () => {
    const source = stored();

    const row = supersedingWordsRow(source, ["Gold hoop earring with a dangling cross charm"]);

    expect(row.words).toEqual(["Gold hoop earring with a dangling cross charm"]);
    /* THE CARRIER, field by field. The incident was a row that kept the words
       and lost this object entirely. */
    expect(row.image).toEqual({
      storageKey: source.storageKey,
      maskKey: source.maskKey,
      digest: source.digest,
      geometry: GEOMETRY,
      guard: { kind: "earring", coverage: 8800, spill: 120, threshold: 7000 },
    });
    /* The digest is the byte identity `repaintRender` refuses on: a copied key
       with a re-derived or dropped digest is how the library and storage come
       to disagree about one picture. */
    expect(row.image!.digest).toBe(source.digest);
    expect(row.refusal).toBeUndefined();
    /* And the row the door would accept, driven through the real door rather
       than eyeballed. */
    expect(() => assertReferenceRowShape(row)).not.toThrow();
  });

  it("keeps the row's identity — role, slot, tier and noun are not re-derived", () => {
    const row = supersedingWordsRow(stored(), ["anything"]);

    expect(row.role).toBe("carry");
    expect(row.slot).toBe("earring@right");
    expect(row.tier).toBe("item");
    expect(row.noun).toBe("right earring");
  });

  it("carries a REFUSAL and its kept pixels for a row that has one instead of a crop", () => {
    const source = stored({
      storageKey: null, maskKey: null, digest: null, geometry: null, guard: null,
      refusal: {
        reason: "noSpecimen", kind: "earring", coverage: 10000,
        contentKey: "casting-v2/refused/earring.png",
        maskKey: "casting-v2/refused/earring-mask.png",
        geometry: GEOMETRY,
      },
    });

    const row = supersedingWordsRow(source, ["a slim gold hoop"]);

    expect(row.image).toBeUndefined();
    expect(row.refusal).toEqual({
      reason: "noSpecimen",
      kind: "earring",
      coverage: 10000,
      crop: {
        contentKey: "casting-v2/refused/earring.png",
        maskKey: "casting-v2/refused/earring-mask.png",
        geometry: GEOMETRY,
      },
    });
    expect(() => assertReferenceRowShape(row)).not.toThrow();
  });

  it("carries a refusal that kept NO pixels without inventing a crop for it", () => {
    const source = stored({
      storageKey: null, maskKey: null, digest: null, geometry: null, guard: null,
      refusal: {
        reason: "brokenOutline", kind: "earring", coverage: 4200,
        contentKey: null, maskKey: null, geometry: null,
      },
    });

    const row = supersedingWordsRow(source, ["a slim gold hoop"]);

    expect(row.refusal).toEqual({ reason: "brokenOutline", kind: "earring", coverage: 4200 });
    expect(row.refusal!.crop).toBeUndefined();
    expect(() => assertReferenceRowShape(row)).not.toThrow();
  });

  it("files an EMPTY stack beside a kept crop — the honest row, not a lost one", () => {
    /* This is what a slot gets when the re-read says nothing and the old words
       were untrue: the sentence goes, the pixels stay, and the assembler says
       "the same right earring, unchanged". */
    const row = supersedingWordsRow(stored(), []);

    expect(row.words).toEqual([]);
    expect(row.image!.storageKey).toBe("casting-v2/library/earring-right.png");
    expect(() => assertReferenceRowShape(row)).not.toThrow();
  });
});

describe("wordsAreUntrue — dirty means untrue, not untidy", () => {
  const EARRING = "earring@left";

  it("blanks an earring's words that name her GLASSES", () => {
    expect(wordsAreUntrue(EARRING, ["Small gold hoop earrings and dark tortoiseshell glasses"]))
      .toBe(true);
  });

  it("blanks words that claim the pair", () => {
    expect(wordsAreUntrue(EARRING, ["gold hoops in both ears"])).toBe(true);
  });

  it("does NOT blank a true sentence that merely ends in a full stop", () => {
    expect(wordsAreUntrue(EARRING, ["A slim gold hoop earring."])).toBe(false);
  });

  it("SEES PAST THE TERMINATOR to the wrongness behind it", () => {
    /*
      THE SPECIMEN, and the reason this is a function rather than a comparison.
      Production row #2 both names her glasses AND ends in a period.
      `slotWordsRefusal` checks punctuation first and returns only its first
      refusal, so a caller testing the REASON reads "merely untidy" — and the
      first version of this rule left that row exactly where it was, glasses and
      all.
    */
    expect(wordsAreUntrue(EARRING, ["Small gold hoop earrings and dark tortoiseshell rectangular glasses."]))
      .toBe(true);
  });

  it("does not blank a clean row", () => {
    expect(wordsAreUntrue(EARRING, ["a slim gold hoop"])).toBe(false);
    expect(wordsAreUntrue(EARRING, [])).toBe(false);
  });
});
