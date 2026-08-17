/**
 * WHAT A PAID RENDER'S PROMPT ACTUALLY SAYS — the prose, not the shape.
 *
 * # Why this file exists
 *
 * Every other test of the compositor road asserts on STRUCTURE: how many
 * references, which ordinal, which refusal. Not one of them looked at the
 * sentence a paying render would carry, and that is exactly where the defect
 * was living. `scripts/repaint-prompt-preview-disposable.mts` printed the
 * string once and found, in a single sentence, that the recipe told the painter
 * her earring slot contained GLASSES — on live rows, for free, before any spend.
 * fable-285 ordered the disposable graduated here so the finding cannot come
 * back.
 *
 * The specimens are the sentences the LIVE mint wrote into production rows,
 * read off `hayabusa.proxy.rlwy.net:23768` on 2026-08-12. They are the negative
 * controls: if the door and the mint's per-slot read were both removed, these
 * assertions fail. That is the property working law 2 asks for — an instrument
 * whose verdicts count for something is one that can fail.
 *
 * # No database, no engine, no clock
 *
 * The rows are shaped by hand and folded through the REAL `repaintAsksFor` and
 * the REAL `assembleRecipe`. The prose is the product's own, not a fixture's.
 */
import { describe, expect, it } from "vitest";

import { assembleRecipe, type LibraryEntry } from "./recipeAssembler";
import { repaintAsksFor } from "./repaintAsks";
import { pronounsForSex } from "./castPronouns";
import { EDIT_PROSE } from "./refineService";
import { accessoryKindsNamedIn, accessoryKindOfSlot } from "./slotWordShape";

const MASTER = { key: "casting-v2/candidates/master.png" };
const PRONOUNS = pronounsForSex("female");

/** A carry crop, so the slot rides as a reference rather than as words alone. */
const CROP = { key: "casting-v2/library/crop.png" };

/**
 * No `carry`: this slot is the one being EDITED, and D-244 is that a crop never
 * rides its own feature's edit — the assembler refuses `carriesItsOwnEdit`. Its
 * words ride on the edit sentence instead, which is the exact lane the glasses
 * came down: "Change only the left earring: <the whole stack>".
 */
function earring(instance: "left" | "right", words: readonly string[]): LibraryEntry {
  return {
    slot: `earring@${instance}`,
    tier: "item",
    noun: `${instance} earring`,
    words,
  };
}

/** The founder's step 1, the ask that carried the glasses sentence in shift 55. */
function promptForEarringEdit(library: readonly LibraryEntry[]): string {
  const asks = repaintAsksFor({
    delta: { free: { statedAccessories: ["small gold hoop earrings"] } },
    prose: EDIT_PROSE,
    accessoryKind: "earring",
  });
  if (!asks.ok) throw new Error(`the ask layer refused: ${asks.reason}`);
  const recipe = assembleRecipe({ master: MASTER, pronouns: PRONOUNS, library, asks: asks.asks });
  if (!recipe.ok) throw new Error(`the assembler refused: ${recipe.reason} on ${recipe.slot}`);
  return recipe.prompt;
}

/**
 * THE STANDING ASSERTION: no accessory slot's own sentence names another kind.
 *
 * Applied to the whole emitted prompt by walking the library it was built from,
 * so a slot added to the catalogue tomorrow is covered without anyone
 * remembering to extend a list.
 */
function namesAKindOutsideItsSlot(library: readonly LibraryEntry[]): string[] {
  const strayed: string[] = [];
  for (const entry of library) {
    const kind = accessoryKindOfSlot(entry.slot);
    if (kind === null) continue;
    for (const word of entry.words) {
      for (const named of accessoryKindsNamedIn(word)) {
        if (named !== kind) strayed.push(`${entry.slot} names ${named}`);
      }
    }
  }
  return strayed;
}

describe("the prompt a paid render carries", () => {
  /* Verbatim production row #3/#4, the shape the fixed mint can no longer
     write. Kept here as the thing that must never be emitted again. */
  const GLASSES_ROW = "Small gold hoop earrings with a tiny dangling cross charm "
    + "beneath each hoop, plus dark tortoiseshell cat-eye glasses";
  /* Verbatim production rows #15/#16 — what the per-slot read produces. */
  const CLEAN_ROW = "Small gold hoop earrings with a dangling cross charm hanging from each hoop";

  it("does not ask the painter for a kind that is not in the slot", () => {
    const library = [earring("left", [CLEAN_ROW]), earring("right", [CLEAN_ROW])];
    const prompt = promptForEarringEdit(library);

    expect(namesAKindOutsideItsSlot(library)).toEqual([]);
    expect(prompt.toLowerCase()).not.toContain("glasses");
    expect(prompt.toLowerCase()).not.toContain("spectacles");
  });

  it("FAILS on the production sentence, which is what makes it an instrument", () => {
    /*
      The negative control. This library is what production actually held, and
      the assertion above must be able to fail on it — otherwise it is a green
      light that proves nothing (working law 2, and D-235's "an affirmative
      without a `saw` is not a reading").
    */
    const library = [earring("left", [GLASSES_ROW]), earring("right", [GLASSES_ROW])];
    const prompt = promptForEarringEdit(library);

    expect(namesAKindOutsideItsSlot(library)).toEqual([
      "earring@left names glasses",
      "earring@right names glasses",
    ]);
    expect(prompt.toLowerCase()).toContain("glasses");
  });

  it("never emits a doubled terminator, whatever the stack holds", () => {
    /*
      `words.join(", ")` over a stack whose entries end in full stops produced
      "…at both earlobes., small gold hoop earrings" in the prompt AND
      "…piled into a high bun., in a bun — …" on the founder's face panel. The
      mint now strips the terminator where the stack is built; this is the
      assertion at the far end, where a user would see it.
    */
    const library = [earring("left", [CLEAN_ROW]), earring("right", [CLEAN_ROW])];
    expect(promptForEarringEdit(library)).not.toContain("., ");
  });

  it("says a slot's state once, not as a pile that argues with itself", () => {
    /*
      Production row #14 held "warm reddish-copper" and "auburn-brown" in one
      row — the colour caption carried from an earlier render, the cut caption
      fresh from this one, both re-said in a single prompt under D-244. A slot's
      words are its CURRENT STATE (fable-286 ruling 2), so the fixed mint files
      one sentence and this is what a one-sentence stack reads like.
    */
    const hair: LibraryEntry = {
      slot: "hair",
      tier: "anatomy",
      noun: "hair",
      words: ["Long auburn-brown hair worn down, center-parted, past the shoulders"],
      carry: CROP,
    };
    const prompt = promptForEarringEdit([earring("left", [CLEAN_ROW]), earring("right", [CLEAN_ROW]), hair]);

    /*
      SAID ONCE — which is what this case has always been about, and from
      2026-08-17 it is once rather than zero.

      Between fable-598 and fable-863 a carried ANATOMY slot said its words zero
      times: the picture was held to be the whole description. Measured on an
      eye, that costs the feature — crop alone delivered 0 of 5, words present 5
      of 5 — so anatomy's word stack rides beside its crop again (fable-192
      restored). An ITEM's crop still speaks alone, and the earrings in this
      same prompt are the control for it.

      The defect this case exists for is untouched and is now checkable in the
      text rather than by its absence: the stack holds ONE state sentence, so
      the prompt says the current caption and never the stale one it used to
      pile beside it.
    */
    expect(prompt).toContain("Keep her hair exactly: Long auburn-brown hair worn down, center-parted, past the shoulders.");
    expect(prompt).not.toContain("reddish-copper");
    expect(prompt).toContain("Reference 2 is the exact hair she has — the same hair, unchanged.");
    /* The item control, in the same prompt: the earring crops say nothing. */
    expect(prompt).not.toContain("Keep the left earring exactly");
  });

  it("carries no pair claim into a per-instance slot's own sentence", () => {
    /* Mismatched pairs are a ruled feature, and the claim was being filed
       identically under both sides — so it was not even evidence of itself. */
    const library = [earring("left", [CLEAN_ROW]), earring("right", [CLEAN_ROW])];
    const prompt = promptForEarringEdit(library).toLowerCase();

    expect(prompt).not.toContain("both earlobes");
    expect(prompt).not.toContain("at each ear");
    expect(prompt).not.toContain("matching pair");
  });
});
