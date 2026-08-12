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
