import { describe, expect, it } from "vitest";
import {
  ANCHOR_FRAMINGS,
  BODY_ANCHOR_REGIONS,
  anchorPresentsIn,
  type AnchorFraming,
} from "../../shared/bodyAnchorRegions";
import {
  INK_PLACEMENTS,
  inkPlacementEntry,
  inkPlacementAvailability,
  anchorAvailability,
  isInkPlacement,
  type InkPlacement,
} from "../../shared/inkPlacementVocabulary";

/**
 * THE VOCABULARY IS A READING, SO THE TEST PINS THE READING.
 *
 * Every word here comes from `V3B_PLACEMENT_VOCABULARY_READING.md` — 56 reads of
 * house money over four frames, with sixteen production masters opened at full
 * resolution first. Nothing in this file is a preference.
 */
describe("the vocabulary is exactly what the photograph was measured to contain", () => {
  it("holds the three measured survivors and nothing else", () => {
    expect([...INK_PLACEMENTS]).toEqual(["neck", "upperArm", "upperChest"]);
  });

  it("names surfaces, never bones — the words that read NOTHING are absent", () => {
    /*
      §4 of the reading, twelve reads on a bare scoop frame with a covered crew
      frame as its negative control: `collarbone`, `collarbones`, `clavicle` and
      `decolletage` returned nothing on skin that was bare, unoccluded and
      plainly visible. `upper chest` and `chest skin` found it exactly. It was
      the WORD, so the words are the thing this test guards.
    */
    const readNothing = ["collarbone", "collarbones", "clavicle", "decolletage"];
    const words = INK_PLACEMENTS.map((key) => inkPlacementEntry(key).readerWord);
    for (const bone of readNothing) expect(words).not.toContain(bone);
  });

  it("excludes every placement the frame does not contain", () => {
    /*
      §2: elbow, hand, waist and knee refused honestly on 4 of 4 — those are the
      lucky ones. `forearm` is the dangerous one: 3 of 4 frames returned
      UPPER-ARM skin, from the opposite side of the body, confidently labelled
      forearm. It is the reason this vocabulary is closed.
    */
    for (const absent of ["forearm", "elbow", "hand", "waist", "knee", "thigh", "back"]) {
      expect(isInkPlacement(absent)).toBe(false);
    }
  });

  it("rejects a key that is merely close to a real one", () => {
    for (const near of ["upper arm", "upperarm", "UpperArm", "chest", "neckline", ""]) {
      expect(isInkPlacement(near)).toBe(false);
    }
  });

  it("gives every placement an anchor the region vocabulary already knows", () => {
    for (const key of INK_PLACEMENTS) {
      expect(BODY_ANCHOR_REGIONS).toContain(inkPlacementEntry(key).anchor);
    }
  });

  it("says which placements come in a pair, because laterality is this road's known killer", () => {
    /*
      The legacy ink road refunded 300 credits twice for "wrong anatomical side"
      (DECISION_LOG R7-7G, 2026-07-29) and V2 measured the same failure from
      scratch three weeks later. An arm has two of it; a neck and an upper chest
      do not.
    */
    expect(inkPlacementEntry("upperArm").sides).toBe("perSide");
    expect(inkPlacementEntry("neck").sides).toBe("one");
    expect(inkPlacementEntry("upperChest").sides).toBe("one");
  });
});

describe("the frame gate — derived from the region table, never mirrored beside it", () => {
  it("admits the two bare-skin placements on the master frame", () => {
    expect(inkPlacementAvailability("neck", "master").kind).toBe("available");
    expect(inkPlacementAvailability("upperArm", "master").kind).toBe("available");
  });

  it("⚠ THE UPPER CHEST IS IN FRAME — what is OVER it is not this door's question", () => {
    /*
      This arm used to expect `mayBeCovered`, and the reading behind it is
      unchanged and still true: "upper chest" is available on a scoop neck and
      absent on a crew neck, in the same product, at the same moment.

      What moved (item 7a, fable-1368 ruling 3) is WHO ANSWERS IT. That reading
      is a fact about a GARMENT, and this module knows nothing about which
      garment a particular cast is wearing — it had `dependsOnGarment` frozen
      onto the placement, which is the crew tee's answer wearing the clothes of
      an anatomical one. `inkSurfaceCoverage.ts` owns the question now and
      answers it from the cast's own stored line; `inkSurfaceCoverage.test.ts`
      is where "the crew tee covers the upper chest" is now pinned.

      What is left here is the one thing this door can genuinely settle, and it
      is still the D-226-versus-out-of-frame line `castingFrame.ts` draws: a
      covered upper chest is a different GARMENT away, so the camera took it;
      a waist is a different PHOTOGRAPH away, so it did not.
    */
    expect(inkPlacementAvailability("upperChest", "master").kind).toBe("available");
  });

  it("answers for every framing the product can produce", () => {
    for (const framing of ANCHOR_FRAMINGS) {
      for (const key of INK_PLACEMENTS) {
        expect(inkPlacementAvailability(key, framing).kind).toBeTypeOf("string");
      }
    }
  });
});

/**
 * THE NEGATIVE CONTROL FOR A GATE THAT REFUSES NOTHING TODAY.
 *
 * All three measured placements sit in regions the master shows, so the frame
 * half of this module cannot fail on today's vocabulary. That is exactly the
 * condition under which a control quietly stops being one — so it is driven
 * directly, on the total function underneath, where a refusal is reachable.
 */
describe("the derivation can fail, proven on the function rather than the table", () => {
  it("refuses a below-waist anchor on the master frame", () => {
    const verdict = anchorAvailability("belowWaist", "master", "her thigh");
    expect(verdict.kind).toBe("outOfFrame");
    if (verdict.kind !== "outOfFrame") throw new Error("unreachable");
    expect(verdict.what).toBe("her thigh");
  });

  it("admits the same anchor on a full-length view", () => {
    expect(anchorAvailability("belowWaist", "frontFull", "her thigh").kind)
      .toBe("available");
  });

  it("agrees with the region table on every region and every framing", () => {
    for (const region of BODY_ANCHOR_REGIONS) {
      for (const framing of ANCHOR_FRAMINGS) {
        const derived = anchorAvailability(region, framing, "it").kind === "available";
        expect(derived).toBe(anchorPresentsIn(region, framing));
      }
    }
  });
});

/**
 * AND THE SENTENCE THAT KEEPS THE NEXT READER FROM TRUSTING THE WRONG GATE.
 *
 * The derivation is NECESSARY, NOT SUFFICIENT. `forearm` sits in the `arms`
 * region, and `arms` presents on the master framing — so a pure derivation
 * ADMITS the one word the reading proved dangerous. What rejects it is the
 * closed vocabulary above, and this test exists so that stays true rather than
 * becoming folklore.
 */
describe("the derivation is necessary and not sufficient — the finding, held", () => {
  it("would admit the arms region on the frame whose forearm does not exist", () => {
    expect(anchorPresentsIn("arms", "master")).toBe(true);
  });

  it("so the closed list is what refuses it", () => {
    expect(isInkPlacement("forearm")).toBe(false);
  });
});

describe("types are load-bearing, not decoration", () => {
  it("narrows a validated string to a placement", () => {
    const raw: string = "neck";
    if (!isInkPlacement(raw)) throw new Error("expected a placement");
    const key: InkPlacement = raw;
    expect(inkPlacementEntry(key).noun).toBe("her neck");
  });

  it("keeps the customer's words as copy rather than identifiers", () => {
    const nouns = INK_PLACEMENTS.map((key) => inkPlacementEntry(key).noun);
    expect(nouns).toEqual(["her neck", "her upper arm", "her upper chest"]);
    for (const noun of nouns) expect(noun).not.toMatch(/[_@]/);
  });

  it("exposes every framing the anchor table knows", () => {
    const framings: readonly AnchorFraming[] = ANCHOR_FRAMINGS;
    expect(framings).toContain("master");
    expect(framings.length).toBeGreaterThan(1);
  });
});
