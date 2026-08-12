/**
 * THE ABSENCE SENTENCE, driven at the table it lives in (chunk 3,
 * `LIBRARY_REMOVAL_DESIGN.md` §3).
 *
 * A vacated slot must SAY the absence, because the master is reference 1 and a
 * born-worn item is IN it: silence about her glasses is an instruction to paint
 * them back on. The sentence is derived from `LANDMARK_OF_ACCESSORY` at
 * emission rather than authored per ask (fable-195's rule about descriptions —
 * a sentence generated from the record has nowhere to diverge to), so this is
 * where its properties are proved.
 */
import { describe, expect, it } from "vitest";

import { LANDMARK_OF_ACCESSORY, accessoryKindOf, vacantPhraseFor } from "./accessoryKinds";
import { imperativeOpenerIn } from "./declarativeState";
import { slotWordsRefusal } from "./slotWordShape";

describe("every kind the product can place can also say it is gone", () => {
  it("has a phrase for every entry in the table", () => {
    /* The compiler already requires the field; this proves none of them is the
       empty string, which the type cannot say. */
    const silent = LANDMARK_OF_ACCESSORY.filter((entry) => entry.vacantPhrase.trim() === "");
    expect(silent).toEqual([]);
  });

  it("every phrase is a STATE, so the assembler's marker passes it by construction", () => {
    /* Not by care — by construction. An absence sentence that opened with
       "remove" would refuse at `wordsNotDeclarative` on the paid path. */
    const instructions = LANDMARK_OF_ACCESSORY
      .map((entry) => ({ region: entry.region, opener: imperativeOpenerIn(entry.vacantPhrase) }))
      .filter((entry) => entry.opener !== null);
    expect(instructions).toEqual([]);
  });

  it("every phrase names the SITE, not just the absence", () => {
    /*
      `HAIR_ARRANGEMENTS` paid for this lesson twice: a wording that tells the
      reader WHERE beats a wording that tells it what to conclude. "No glasses"
      alone leaves a painter looking at a photograph of her in glasses with
      nothing to look AT.
    */
    for (const entry of LANDMARK_OF_ACCESSORY) {
      expect(entry.vacantPhrase, entry.region).toMatch(/—/);
      expect(entry.vacantPhrase.split("—")[1]!.trim().length).toBeGreaterThan(10);
    }
  });

  it("reads the phrase through the kind the same table decides", () => {
    /* End to end through the two functions a caller actually uses, so the pair
       cannot drift: the words name a kind, the kind names a phrase. */
    expect(vacantPhraseFor(accessoryKindOf("her tortoiseshell glasses"))).toContain("no glasses");
    expect(vacantPhraseFor(accessoryKindOf("gold hoop earrings"))).toContain("no earrings");
    /* Longest match wins, so a nose stud is not an earring — the defect
       `accessoryEntry` was rewritten for, checked here on the new surface. */
    expect(vacantPhraseFor(accessoryKindOf("a small nose stud"))).toContain("no nose jewellery");
  });

  it("CONTROL — a kind the table does not hold says NOTHING rather than improvising", () => {
    /* The honest answer. A caller must refuse; an invented absence sentence is
       a paid render saying something untrue about her face. */
    expect(vacantPhraseFor(accessoryKindOf("her tiara"))).toBeNull();
    expect(vacantPhraseFor(null)).toBeNull();
    expect(vacantPhraseFor("hair")).toBeNull();
  });
});

/**
 * THE PER-INSTANCE FORM — what a pair's own lobe records when it goes empty
 * (fable-332).
 *
 * The library is keyed per side and `slotWordsRefusal` refuses a per-side row
 * whose words claim the pair. Until this form existed, an earring removal
 * LANDED and could not be recorded, so it refused into the refund — never
 * charge for a fact the product is about to forget.
 */
describe("a pair records its empty lobe in words that lobe may file", () => {
  it("every pair kind has a per-instance form, and every single kind may skip it", () => {
    /* The type cannot say "required when `pair` is true"; this can. */
    const pairsWithout = LANDMARK_OF_ACCESSORY
      .filter((entry) => entry.pair && !entry.vacantPhrasePerInstance)
      .map((entry) => entry.region);
    expect(pairsWithout).toEqual([]);
  });

  it("fills the side from the instance it was handed, and never invents one", () => {
    expect(vacantPhraseFor("earring", "left")).toBe(
      "no earring on her left ear — that earlobe bare, nothing hanging from it");
    expect(vacantPhraseFor("earring", "right")).toContain("her right ear");
    /* No instance, same table, the pair sentence — the call every existing
       caller makes is untouched. */
    expect(vacantPhraseFor("earring")).toContain("both earlobes bare");
    expect(vacantPhraseFor("earring", null)).toContain("both earlobes bare");
    /* A kind worn singly ignores the instance rather than growing a side. */
    expect(vacantPhraseFor("glasses", "left")).toBe(vacantPhraseFor("glasses"));
  });

  it("THE POINT: the per-instance form may be FILED on its own slot and the pair form may not", () => {
    /*
      The refusal this whole form exists to clear, driven through the door
      itself rather than described. Both directions, because a form that only
      ever passes proves nothing about the rule it is passing.
    */
    for (const side of ["left", "right"] as const) {
      const slot = `earring@${side}`;
      expect(slotWordsRefusal(slot, [vacantPhraseFor("earring", side)!]), slot).toBeNull();
      expect(slotWordsRefusal(slot, [vacantPhraseFor("earring")!])?.reason, slot)
        .toBe("wordsClaimThePair");
    }
  });

  it("and it is still a STATE that names the site", () => {
    for (const side of ["left", "right"] as const) {
      const phrase = vacantPhraseFor("earring", side)!;
      expect(imperativeOpenerIn(phrase)).toBeNull();
      expect(phrase).toMatch(/—/);
      expect(phrase.split("—")[1]!.trim().length).toBeGreaterThan(10);
    }
  });
});
