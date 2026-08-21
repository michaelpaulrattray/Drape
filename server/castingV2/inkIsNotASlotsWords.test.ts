/**
 * A TATTOO HAS ONE AUTHOR, AND IT IS THE CROP (fable-1266 §1, from opus-938 §1).
 *
 * The defect these arms exist for, traced to three lines:
 *
 *   `recipeAssembler`   skips only `tier: "item"`, so an ANATOMY stack speaks
 *   `referenceSlotCat.` skin is `tier: "anatomy"` — so skin speaks
 *   `slotWordShape`     returned null for any non-accessory slot, so nobody
 *                       ever asked skin's prose what it said
 *
 * On a tattooed torso, `captionSlot`'s *"Describe this person's skin"* is read
 * off the WHOLE DELIVERED FRAME and comes back with the ink. Those words are
 * PERSISTED as a library row and D-244 re-says a slot's whole stack on every
 * later edit — so a later render's prompt carries the ink twice:
 *
 *   the ink carry   "Reference N is the exact upper chest tattoo she already
 *                    has… the same design, in the same place, at the same size"
 *                    — pinned to a crop, measurable
 *   the skin stack  "Keep his skin exactly: …, tattooed chest, …"
 *                    — free-floating prose, no geometry
 *
 * Three ends, three groups of arms below: the SOURCE stops saying it, the DOOR
 * stops it being written, and the ASSEMBLY stops every row already in the
 * database from saying it — without touching that row.
 *
 * # The fixture is his own row, and it is his BUILD row rather than his skin row
 *
 * Read out of production 2026-08-21 (`read-all-library-rows-disposable`,
 * `hayabusa.proxy.rlwy.net:23768`): 20 library rows, ZERO containing an ink
 * word, and his inked cast (candidate 1641) holds no `skin` row at all — only
 * three `build` rows, #67/68/69. So the caption in opus-938 §1 was an
 * illustration and is named as one here.
 *
 * `build` is the better fixture anyway, and that is the finding rather than a
 * convenience: it is `tier: "anatomy"` exactly like skin, and its catalogue
 * entry sets `remint: "everyRender"` — it is re-cut from a below-head crop on
 * EVERY render, and an inked chest is inside that crop. So the row below is
 * production row #69's real wording with the clause a tattooed torso would have
 * added to it.
 */
import { describe, expect, it } from "vitest";

import { pronounsForSex } from "./castPronouns";
import { DESCRIBED_ASKS } from "./faceDescribe";
import { captionSlot } from "./realizationCaption";
import { assembleRecipe, type LibraryEntry } from "./recipeAssembler";
import { INK_IS_NOT_THIS_SLOT, inkWordIn, slotWordsRefusal } from "./slotWordShape";
import { wordsAreUntrue, untrueWordsRefusal } from "./referenceWordsSupersession";

/** Production row #69, verbatim, with the clause an inked chest would add. */
const HIS_BUILD_WORDS = "Broad, solid torso with square shoulders and a thick neck, "
  + "a large tattooed chest piece, filling out the t-shirt with visible muscular bulk";

/** Production row #69, verbatim and untouched — the negative control. */
const HIS_BUILD_WORDS_CLEAN = "Broad, solid torso with square shoulders and a thick neck, "
  + "filling out the t-shirt with visible muscular bulk through the chest and shoulders";

const MASTER = { key: "casting-v2/candidates/master.png", sha: "16bb85180e9e" };
const HE = pronounsForSex("male");

const build = (words: string): LibraryEntry => ({
  slot: "build", tier: "anatomy", noun: "build", words: [words],
  carry: { key: "mint/build.png" },
});

/* ------------------------------------------------------------------ the source */

describe("the source — no ask invites a tattoo into a slot that is not one", () => {
  it("says so in the skin ask he reads under his own picture", () => {
    expect(DESCRIBED_ASKS.skin).toContain(INK_IS_NOT_THIS_SLOT);
    /* The precedent this was written from, still standing beside it. */
    expect(DESCRIBED_ASKS.skin).toContain("not her makeup and not the lighting");
  });

  it("says so ON THE WIRE of the caption read that actually feeds a paid render", async () => {
    /*
      Asserted on the outgoing request rather than on a constant near it
      (invariant 5). `captionSlot` is what the library mint hands every slot, and
      its prompt is composed inside a private function — a test that read
      `INK_IS_NOT_THIS_SLOT` alone would pass with the clause never sent.
    */
    const seen: { user?: string } = {};
    const engine = {
      id: "stub",
      complete: async (request: { user: string }) => {
        seen.user = request.user;
        return {
          text: JSON.stringify({ caption: "Weathered tan, deeply lined", visible: true }),
          truncated: false,
          latencyMs: 1,
        };
      },
    } as never;

    const said = await captionSlot({
      noun: "skin", view: "frame", bytes: Buffer.from("pixels"),
      contentType: "image/png", engine,
    });

    expect(said).toBe("Weathered tan, deeply lined");
    expect(seen.user).toContain(INK_IS_NOT_THIS_SLOT);
  });

  it("is ONE sentence with one owner, so the two lanes cannot drift", () => {
    /* Both consumers import the same constant. If a future edit inlines either
       one, the two arms above stop agreeing about what a slot may say — this is
       the arm that says why they are written as containment rather than as two
       hand-copied strings. */
    expect(INK_IS_NOT_THIS_SLOT).toMatch(/never mention a tattoo here/i);
  });
});

/* -------------------------------------------------------------------- the door */

describe("the door — an anatomy stack naming ink is refused, and it could not be before", () => {
  it("refuses his build row the moment it names the tattoo", () => {
    const refusal = slotWordsRefusal("build", [HIS_BUILD_WORDS]);
    expect(refusal?.reason).toBe("wordsNameAnotherKind");
    expect(refusal?.detail).toContain("tattooed");
    expect(refusal?.detail).toContain("rides as a CROP");
  });

  it("refuses the skin caption opus-938 traced, on the slot it was traced on", () => {
    expect(slotWordsRefusal("skin", ["weathered tan, tattooed chest, stubbled jaw"])?.reason)
      .toBe("wordsNameAnotherKind");
  });

  it("does NOT refuse his build row as it actually stands in production", () => {
    /* The negative control kept after the positive passed. A guard that refuses
       its own population is the defect wearing a guard's name. */
    expect(slotWordsRefusal("build", [HIS_BUILD_WORDS_CLEAN])).toBe(null);
    expect(slotWordsRefusal("skin", ["warm olive, freckled across the nose"])).toBe(null);
  });

  it("does NOT refuse the words the ROUTING vocabulary would have refused", () => {
    /*
      `shared/inkInstructionRoute.ts` matches bare "ink" and "half sleeves"
      because over-matching is free for a routing hint. It is not free for a
      door: both of these are true sentences about something that is not ink,
      and refusing them would cost a fact to catch nothing.
    */
    expect(inkWordIn("ink-black waves, cut blunt at the shoulder")).toBe(null);
    expect(slotWordsRefusal("hair", ["ink-black waves, cut blunt at the shoulder"])).toBe(null);
    expect(slotWordsRefusal("build", ["broad shoulders under a shirt with half sleeves"])).toBe(null);
  });

  it("never refuses an INK slot for naming ink", () => {
    /* Written against the fact rather than trusting it: the library refuses an
       ink slot by name today, so this branch is unreachable — and the day it
       becomes reachable must not be the day the door eats its own subject. */
    expect(slotWordsRefusal("ink:upperChest", ["a small swallow tattoo"])).toBe(null);
  });

  it("counts as UNTRUE rather than untidy, which is what lets the assembler act", () => {
    expect(wordsAreUntrue("build", [HIS_BUILD_WORDS])).toBe(true);
    expect(untrueWordsRefusal("build", [HIS_BUILD_WORDS])?.reason).toBe("wordsNameAnotherKind");
    /* And the split it must not break: a trailing full stop is untidy, not
       untrue, and blanking a true sentence for punctuation deletes a fact. */
    expect(wordsAreUntrue("build", [`${HIS_BUILD_WORDS_CLEAN}.`])).toBe(false);
  });
});

/* ---------------------------------------------------------------- the assembly */

describe("the assembly — a row already in the database stops speaking, and stays put", () => {
  it("keeps the ink words out of the prompt his next render would carry", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: HE,
      library: [build(HIS_BUILD_WORDS)],
      asks: [{ slot: "skin", noun: "skin", words: "a few more freckles across the nose" }],
    });

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    /* The whole prompt, not the standing sentence alone: this is the string that
       goes on the wire. */
    expect(recipe.prompt.toLowerCase()).not.toContain("tattoo");
  });

  it("says WHAT it withheld and why, rather than going quiet", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: HE,
      library: [build(HIS_BUILD_WORDS)],
      asks: [{ slot: "skin", noun: "skin", words: "a few more freckles across the nose" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.withheld).toEqual([{
      slot: "build",
      word: HIS_BUILD_WORDS,
      reason: "wordsNameAnotherKind",
      detail: expect.stringContaining("rides as a CROP"),
    }]);
  });

  it("does NOT refuse the render — the customer keeps the picture she paid for", () => {
    /*
      The choice this whole landing turns on. `wordsNotDeclarative` refuses the
      whole recipe for a bad persisted word, and this could have been written as
      its neighbour — at the cost of every later refine on an affected cast
      falling into the refund until somebody rewrote the library by hand.
    */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: HE,
      library: [build(HIS_BUILD_WORDS)],
      asks: [{ slot: "skin", noun: "skin", words: "a few more freckles across the nose" }],
    });
    expect(recipe.ok).toBe(true);
  });

  it("withholds the ENTRY, never the row's other versions", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: HE,
      library: [{
        slot: "build", tier: "anatomy", noun: "build",
        words: [HIS_BUILD_WORDS_CLEAN, HIS_BUILD_WORDS],
        carry: { key: "mint/build.png" },
      }],
      asks: [{ slot: "skin", noun: "skin", words: "a few more freckles across the nose" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.prompt).toContain("square shoulders and a thick neck");
    expect(recipe.prompt.toLowerCase()).not.toContain("tattoo");
    expect(recipe.withheld.map((one) => one.word)).toEqual([HIS_BUILD_WORDS]);
  });

  it("withholds NOTHING on the row as production actually holds it", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: HE,
      library: [build(HIS_BUILD_WORDS_CLEAN)],
      asks: [{ slot: "skin", noun: "skin", words: "a few more freckles across the nose" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.withheld).toEqual([]);
    expect(recipe.prompt).toContain(HIS_BUILD_WORDS_CLEAN);
  });

  it("leaves the ink carry as the ONE author, still saying the design", () => {
    /*
      The point of the whole change: the tattoo is not silenced, it is
      single-authored. The carry rides as a picture with geometry and says so.
    */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: HE,
      library: [build(HIS_BUILD_WORDS)],
      asks: [{ slot: "skin", noun: "skin", words: "a few more freckles across the nose" }],
      carriedInk: [{
        slot: "ink:upperChest",
        picture: "deliveredCrop",
        noun: "upper chest tattoo",
        image: { key: "ink/delivered.png", sha: "aa11bb22" },
      }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.carried).toContain("ink:upperChest");
    /* Said exactly once, by the reference that has the picture. */
    const authors = recipe.sentences.filter((one) => /tattoo/i.test(one));
    expect(authors).toHaveLength(1);
    expect(authors[0]).toMatch(/upper chest/i);
  });
});
