import { describe, expect, it } from "vitest";

import { slotsOfPrunedStep } from "./prunedSlots";

/**
 * The arithmetic behind the fix ruled at fable-1324, driven directly.
 *
 * The court that bought it is at the wire (opus-971 §2): a mid-chain ink
 * removal computed its prune perfectly and was then CHARGED 25 credits and
 * REFUNDED them, because the repaint road's ask builder could name no slot for
 * the `ink` facet. These are the shapes that decide it, with the two real
 * production step deltas among them rather than invented ones.
 */
describe("what a pruned step names when its facets cannot", () => {
  /* v500's own step, read off the dev row 2026-08-21: a reference-road tattoo
     that minted, so both pointers stand. */
  const inkWithPointers = {
    free: { ink: ["the tattoo design in the attached picture on his upper chest"] },
    inkApplied: { "ink:upperChest": "be0cfbe7-bb33-4993-8b98-fabc66aa7376" },
    inkDelivered: { "ink:upperChest": "3f11f226-0d4b-45da-a1b0-6b12be842374" },
  };
  /* v477's own step, same cast, same sitting: the SAME ask that minted nothing.
     Its words are the only record of where the tattoo went. */
  const inkWordsOnly = {
    free: { ink: ["the tattoo design in the attached picture on her upper chest"] },
  };

  it("reads the slot off the step's own pointers", () => {
    expect(slotsOfPrunedStep(inkWithPointers as never)).toEqual(["ink:upperChest"]);
  });

  it("falls to the step's own WORDS when it minted nothing", () => {
    expect(slotsOfPrunedStep(inkWordsOnly as never)).toEqual(["ink:upperChest"]);
  });

  it("takes the side from the step's words on a per-side surface", () => {
    expect(slotsOfPrunedStep({
      free: { ink: ["small swallow tattoo on his left upper arm"] },
    } as never)).toEqual(["ink:upperArm@left"]);
  });

  it("NAMES NOTHING for a per-side surface with no side in the words", () => {
    /*
      The refusal this module exists to make honest rather than expensive.
      *Sleeve implies arm implies pick one* is the inference fable-1115 §3
      outlawed, and the legacy ink road refunded 300 credits twice for the wrong
      anatomical side. The caller answers this case free, before the claim.
    */
    expect(slotsOfPrunedStep({
      free: { ink: ["a small swallow tattoo on his upper arm"] },
    } as never)).toEqual([]);
  });

  it("NAMES NOTHING when one step's words hold two surfaces", () => {
    /* Picking the first would be picking. The pointers answer this case when
       the step actually minted; the words alone must not guess. */
    expect(slotsOfPrunedStep({
      free: { ink: ["a swallow on her neck", "a rose on her upper chest"] },
    } as never)).toEqual([]);
  });

  it("PREFERS the pointers over the words when the two are both there", () => {
    /*
      The pointer is the fact recorded by the render that put the tattoo on her;
      the words are a reading of a sentence. A step whose words say one surface
      and whose pointer says another is a row this product should never write —
      and if it ever does, the recorded fact wins rather than the prose.
    */
    expect(slotsOfPrunedStep({
      free: { ink: ["a swallow on her neck"] },
      inkDelivered: { "ink:upperChest": "crop-1" },
    } as never)).toEqual(["ink:upperChest"]);
  });

  it("names an OPEN KIND, which has no facet at all", () => {
    /*
      `facetsWrittenBy` is blind to `delta.open`, so the struck facet set comes
      out EMPTY and the road refused one line earlier than it did for ink — same
      blindness fable-900 §2b fixed at the out-of-frame door, one door along.
    */
    expect(slotsOfPrunedStep({
      open: { halo: { noun: "halo", words: "a thin golden halo" } },
    } as never)).toEqual(["open:halo"]);
  });

  it("names the ink AND the open kind when one step wrote both", () => {
    expect(slotsOfPrunedStep({
      free: { ink: ["a swallow on her neck"] },
      open: { wings: { noun: "wings", words: "black feathered wings" } },
    } as never).sort()).toEqual(["ink:neck", "open:wings"]);
  });

  /*
    NEGATIVE CONTROLS. This module is ADDITIVE: every facet the catalogue can
    already name must come back empty from here, or the union at the call site
    would start naming slots twice and a restate would be built for a facet
    whose own ask already covers it.
  */
  it.each([
    ["a hair cut", { free: { hairCut: "a copper shag" } }],
    ["a hair colour", { hairColour: "copper" }],
    ["an eye colour", { eyeColour: "green" }],
    ["an accessory", { free: { statedAccessories: ["small gold hoops"] } }],
    ["a bare departure", { absent: { statedAccessories: ["glasses"] } }],
    ["nothing at all", {}],
  ])("names nothing for %s", (_what, delta) => {
    expect(slotsOfPrunedStep(delta as never)).toEqual([]);
  });
});
