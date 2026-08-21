/**
 * THE ABSENCE SENTENCES, PINNED BEFORE THEY MOVED (V3 slice (b), fable-531 §4b).
 *
 * Slice (b) moves the vacancy phrase off the accessory placement table and onto
 * a home keyed by KIND, so a beard can say it is gone. The acceptance for the
 * move is that **nothing changes**: the three accessory sentences are to be
 * MOVED, not rewritten, and the difference between those two is invisible in a
 * diff and loud in production — these strings go into paid prompts.
 *
 * `vacancyPin.json` was captured with `git show HEAD:accessoryKinds.ts` BEFORE
 * the new module existed, and it is not regenerated. A golden refreshed when it
 * fails is a golden that agrees with whatever it is shown; a golden taken from
 * the thing it is meant to check is not one at all.
 *
 * The em dash is the reason this is compared in BYTES rather than by eye: this
 * project has twice had a Windows console re-encode one silently, and a
 * sentence that differs by one character is a different sentence to a model.
 */
import { describe, expect, it } from "vitest";
import type { CastPronouns } from "./castPronouns";

/* One Cast, one set of words for her — §5e made these sentences a function
   of the Cast's own pronouns rather than a constant. */
const HER_PRONOUNS: CastPronouns = { subject: "she", object: "her", possessive: "her", plural: false };

import pin from "./vacancyPin.json";
import { LANDMARK_OF_ACCESSORY } from "./accessoryKinds";
import { VACANCY_BY_KIND, vacantPhraseFor } from "./vacancyPhrases";

describe("the move did not rewrite a single sentence", () => {
  /*
    ⚠ THE PIN NOW COMPARES THE RENDERED SENTENCE, and that is the whole
    acceptance for §5e's engine-facing half (ruled fable-1220 §3).
    
    The table's own strings carry `{their}` placeholders since 2026-08-22, so
    comparing them raw would just say "the placeholder is a placeholder". What
    the golden is FOR is the claim that nothing was rewritten — and that claim
    is about what reaches the painter. So the pin is read through
    `vacantPhraseFor` with a FEMALE Cast, where every one of these sentences is
    byte-identical to what it was before the parameterisation.
    
    That makes this pin stronger rather than weaker: it proves the correction
    changed EXACTLY ONE sentence (the beard's, which said "his" about everybody)
    and left the three golden ones alone. The golden itself is untouched, still
    captured from `git show HEAD:accessoryKinds.ts` before the module existed,
    and still never regenerated.
    
    **If any vacate-class delivery regression shows up at a later court, the
    pronoun parameterisation is the FIRST SUSPECT** — the suspicion filed in
    advance, which is what an uncourted change to a paid prompt owes.
  */
  it("holds every accessory phrase byte for byte, as the painter reads it", () => {
    for (const [kind, says] of Object.entries(pin.vacantPhrase)) {
      expect(vacantPhraseFor(kind, HER_PRONOUNS), kind).toBe(says);
    }
  });

  it("holds the per-instance form byte for byte, side and all", () => {
    for (const [kind, form] of Object.entries(pin.vacantPhrasePerInstance)) {
      expect(vacantPhraseFor(kind, HER_PRONOUNS, "left"), kind).toBe(form.replace("{side}", "left"));
    }
  });

  it("⚠ THE ONE SENTENCE THAT CHANGED — the beard said HIS about every Cast", () => {
    /*
      Ground 1 of the three that license this change: the previous state was
      SELF-INCONSISTENT. The beard phrase said *"HIS jaw, chin and upper lip"*
      and the freckle phrase said *"HER skin clear and even"*, about one person.
      That is not a courted baseline, it is two guesses disagreeing — and it is
      why this is a correction rather than a prompt edit.
    */
    const hers = vacantPhraseFor("facial hair", HER_PRONOUNS)!;
    expect(hers).toContain("her jaw, chin and upper lip");
    expect(hers, "the sentence still said HIS about a female Cast").not.toContain("his ");
  });

  it("AND A MALE CAST READS EVERY ONE OF THEM AS HIS", () => {
    /* The other direction, which is the whole point: a male Cast used to be
       told about "her face", "her nose" and "her skin". */
    const him: CastPronouns = { subject: "he", object: "him", possessive: "his", plural: false };
    for (const kind of Object.keys(VACANCY_BY_KIND)) {
      const said = vacantPhraseFor(kind, him)!;
      expect(said, kind).not.toMatch(/\bher\b/);
    }
  });

  it("AND A CAST WHOSE SEX IS UNKNOWN READS AS THEIR, never she", () => {
    const them: CastPronouns = { subject: "they", object: "them", possessive: "their", plural: true };
    for (const kind of Object.keys(VACANCY_BY_KIND)) {
      const said = vacantPhraseFor(kind, them)!;
      expect(said, kind).not.toMatch(/\b(her|his)\b/);
      /* And no placeholder survives into a paid prompt. */
      expect(said, kind).not.toMatch(/\{[a-z]+\}/);
    }
  });

  it("covers every kind that could say it was gone before the move", () => {
    /* The vacuous-pin check. If the golden were empty every assertion above
       would pass over nothing, and this file would be the checker that cannot
       fail — the exact shape the vocabulary pin was written to refuse. */
    expect(Object.keys(pin.vacantPhrase).sort())
      .toEqual(LANDMARK_OF_ACCESSORY.map((entry) => entry.region).sort());
    expect(Object.keys(pin.vacantPhrase).length).toBe(3);
  });

  it("has gained exactly the kind this slice adds, and no others", () => {
    /*
      An addition is neither a move nor a change, and it is answered by naming
      it — the same rule the vocabulary pin learned when horns arrived. Adding a
      kind without a line here is indistinguishable from a kind that arrived by
      accident.
    */
    const added = Object.keys(VACANCY_BY_KIND).filter((kind) => !(kind in pin.vacantPhrase));
    /* `freckles` joined on 2026-08-15 as a DECLARED shortcut: one kind of mark
       ships with a sentence and the rest refuse (`MARK_KINDS`), with the
       per-kind vocabulary owed and on the board. */
    expect(added.sort()).toEqual(["facial hair", "freckles"]);
  });

  it("CAN FAIL — the comparison, driven on a sentence with one character moved", () => {
    /* Without this the byte comparison above could be passing on a fixture
       shape nobody has checked (a `toBe` against `undefined` on both sides). */
    const tampered = `${pin.vacantPhrase.glasses} `;
    expect(tampered).not.toBe(pin.vacantPhrase.glasses);
    expect(VACANCY_BY_KIND.glasses?.says).not.toBe(tampered);
  });
});
