/**
 * TRANSFORM THE DESIGN YOU HAVE — the mechanical half (fable-1269 §2, designed
 * opus-940, countersigned fable-1274).
 *
 * His ask, the hour his tattoo card went live: *"like make it bigger or somthing
 * now it has a bounding box?"* The whole road exists so that sentence does not
 * misroute as a NEW words-tattoo and replace his specific chest piece with a
 * reinvention.
 *
 * The shape under test here is the one the code already made available and
 * nobody had used: **a transform is an EDIT on the ink slot whose SOURCE is that
 * slot's own delivered crop.** Nothing routes to it yet — this file drives the
 * vocabulary, the sentence owner and the assembler directly (working law 3: a
 * guard whose only test runs through a model that usually behaves is untested).
 */
import { describe, expect, it } from "vitest";

import { pronounsForSex } from "./castPronouns";
import { inkDeliveredCarrySentence, inkDeliveredTransformSentence } from "./inkRealism";
import { assembleRecipe, type LibraryEntry } from "./recipeAssembler";
import { INK_TRANSFORM_AXES, inkTransformClause, type InkTransform } from "../../shared/inkTransforms";

const MASTER = { key: "casting-v2/candidates/master.png", sha: "16bb85180e9e" };
const HE = pronounsForSex("male");
const CROP = { key: "casting-v2/ink/delivered.png", sha: "aa11bb22cc33" };
const SLOT = "ink:upperChest";

/**
 * ⚠ HER EXISTING DESCRIPTION, RE-SAID — and the assembler taught us this.
 *
 * The first version of this fixture put the customer's own sentence in the ask:
 * `words: "make it bigger"`. The assembler refused it, by name:
 *
 *   wordsNotDeclarative — "the ask for ink:upperChest reads 'make it bigger',
 *   which is an instruction; the interpreter owes a state phrase"
 *
 * That refusal is the design report's own conclusion arriving from the other
 * direction. A transform files NO new `free.ink` words (opus-940 §4, ratified
 * fable-1274 §3) because a delta re-said on every later edit is "twice the size
 * of what?" two renders on. So the ask carries the state that was ALREADY
 * true — her existing description of the design, unchanged — and the CHANGE
 * rides on the source alone, in `source.change`, where it dies with its ask.
 */
const HIS_EXISTING_WORDS = "a large geometric chest piece";

const BIGGER: InkTransform = { axis: "size", direction: "bigger", factor: null };
const TWICE: InkTransform = { axis: "size", direction: "bigger", factor: 2 };

function transformRecipe(change: InkTransform, over: {
  carriedInk?: Parameters<typeof assembleRecipe>[0]["carriedInk"];
  library?: readonly LibraryEntry[];
} = {}) {
  return assembleRecipe({
    master: MASTER,
    pronouns: HE,
    library: over.library ?? [],
    asks: [{ slot: SLOT, noun: "upper chest tattoo", words: HIS_EXISTING_WORDS }],
    sources: [{
      slot: SLOT, image: CROP, scope: "", pictures: "inkAsDelivered", change,
    }],
    ...(over.carriedInk ? { carriedInk: over.carriedInk } : {}),
  });
}

/* ------------------------------------------------------------- the vocabulary */

describe("the vocabulary — a transform names a CHANGE and can never name a design", () => {
  it("says what changes AND that nothing else does, on every axis", () => {
    /*
      The second half is not politeness. The carry lane measured that "put it
      back exactly as it is" said ALONE is the decal instruction; a transform
      that only says "bigger" is that same sentence with its anchor removed.
    */
    const every: InkTransform[] = [
      BIGGER,
      { axis: "size", direction: "smaller", factor: null },
      { axis: "height", direction: "higher" },
      { axis: "height", direction: "lower" },
      { axis: "intensity", direction: "darker" },
      { axis: "intensity", direction: "lighter" },
    ];
    /* Derived from the vocabulary, so an axis added tomorrow without a case
       here fails rather than being silently unexercised. */
    expect(new Set(every.map((one) => one.axis))).toEqual(new Set(INK_TRANSFORM_AXES));
    for (const change of every) {
      const said = inkTransformClause(change, HE);
      expect(said).toContain("this same tattoo");
      expect(said).toContain("Everything else about it stays exactly as this picture shows it");
    }
  });

  it("spells a stated factor and never invents one", () => {
    expect(inkTransformClause(TWICE, HE)).toContain("about twice the size it appears in this picture");
    /* A bare "bigger" gets a comparison, not a magnitude nobody typed. */
    expect(inkTransformClause(BIGGER, HE)).toContain("noticeably larger");
    expect(inkTransformClause(BIGGER, HE)).not.toMatch(/twice|times|half/);
  });

  it("reads as one grammar in both size forms", () => {
    /* Written as one template with a substituted phrase, the factor form read
       "about twice the size it is here than it appears in this picture". */
    for (const change of [BIGGER, TWICE, { axis: "size", direction: "smaller", factor: 0.5 } as const]) {
      expect(inkTransformClause(change, HE)).not.toMatch(/the size it appears in this picture than/);
      expect(inkTransformClause(change, HE)).not.toMatch(/than it appears in this picture\. .*than/);
    }
  });

  it("has NO sideways axis, and that is a measurement", () => {
    /* The engine paints by position rather than by anatomy, and the legacy ink
       road refunded 300 credits twice for a wrong anatomical side. A horizontal
       move is that hazard with a paid render attached. */
    expect(INK_TRANSFORM_AXES).not.toContain("side");
    for (const axis of INK_TRANSFORM_AXES) expect(axis).not.toMatch(/left|right|side/i);
  });
});

/* ----------------------------------------------------------- the one sentence */

describe("the sentence — carry and transform have ONE owner and cannot drift", () => {
  it("shares every word about what the picture IS, and differs in one clause", () => {
    const carry = inkDeliveredCarrySentence(2, "upper chest tattoo", HE);
    const changed = inkDeliveredTransformSentence(2, "upper chest tattoo", HE, BIGGER);

    /*
      The prefix is the part that took three frames and three clauses to get
      right — it is what stopped a design being drawn a third of the way down a
      white T-shirt. A transform that lost it would lose it silently.
    */
    const upTo = "whatever edge you can see in it is the real edge of the design.";
    expect(carry.indexOf(upTo)).toBeGreaterThan(0);
    expect(changed.slice(0, carry.indexOf(upTo) + upTo.length))
      .toBe(carry.slice(0, carry.indexOf(upTo) + upTo.length));

    /* And the one clause that differs, in both directions. */
    expect(carry).toContain("the same design, in the same place, at the same size");
    expect(changed).not.toContain("at the same size");
    expect(changed).toContain("noticeably larger");
  });

  it("keeps the realism and clothing clauses on the transform lane too", () => {
    const changed = inkDeliveredTransformSentence(2, "upper chest tattoo", HE, TWICE);
    expect(changed).toContain("HEALED tattoo");
    expect(changed).toContain("never printed, embroidered or otherwise placed on his clothing");
  });
});

/* ------------------------------------------------------------- the assembler */

describe("the assembler — a transform rides as a SOURCE on the slot it edits", () => {
  it("sends the delivered crop and says what to change about it", () => {
    const recipe = transformRecipe(BIGGER);
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;

    expect(recipe.references).toHaveLength(2);
    expect(recipe.references[1]!.role).toEqual({ kind: "source", slot: SLOT });
    expect(recipe.references[1]!.image).toBe(CROP);
    expect(recipe.references[1]!.sentence).toContain("noticeably larger");
    expect(recipe.edited).toEqual([SLOT]);
    /* The slot is EDITED, so the verification asks "did it arrive", not "is it
       still there". A transform is a delivery. */
    expect(recipe.carried).not.toContain(SLOT);
  });

  it("REFUSES the naive build — the same slot as a source and as its own carry", () => {
    /*
      The refusal that already existed, standing guard over this road unaltered.
      It was written for D-244 line 2: one picture twice with two sentences,
      "keep it exactly as it is" beside "change it to this".
    */
    const refusal = transformRecipe(BIGGER, {
      carriedInk: [{
        slot: SLOT, picture: "deliveredCrop", noun: "upper chest tattoo", image: CROP,
      }],
    });
    expect(refusal.ok).toBe(false);
    if (refusal.ok) return;
    expect(refusal.reason).toBe("carriesItsOwnEdit");
  });

  it("REFUSES an ask carrying the CHANGE as its words", () => {
    /*
      The guard that keeps the design honest, and it is the assembler's, not a
      new one. If a future interpreter files "make it bigger" as the ask's
      words, that instruction becomes a stack entry re-said on every later
      render — the skin/ink double-carry's sibling, on the field next door.
    */
    const refusal = assembleRecipe({
      master: MASTER, pronouns: HE, library: [],
      asks: [{ slot: SLOT, noun: "upper chest tattoo", words: "make it bigger" }],
      sources: [{
        slot: SLOT, image: CROP, scope: "", pictures: "inkAsDelivered", change: BIGGER,
      }],
    });
    expect(refusal.ok).toBe(false);
    if (refusal.ok) return;
    expect(refusal.reason).toBe("wordsNotDeclarative");
  });

  it("REFUSES a transform nothing asked about", () => {
    /* A picture with no sentence is a picture the painter may read as anything. */
    const refusal = assembleRecipe({
      master: MASTER, pronouns: HE, library: [],
      asks: [{ slot: "lips", noun: "lips", words: "a soft nude lip" }],
      sources: [{
        slot: SLOT, image: CROP, scope: "", pictures: "inkAsDelivered", change: BIGGER,
      }],
    });
    expect(refusal.ok).toBe(false);
    if (refusal.ok) return;
    expect(refusal.reason).toBe("sourceNotAsked");
  });

  it("never says the words of the OTHER ink lane about these bytes", () => {
    /*
      The delivered crop is a picture of HER OWN SKIN; the design artwork is a
      picture on transparency with no body in it. Two pictures, two sentences,
      and fable-1194 §2a is that they may never share one.
    */
    const recipe = transformRecipe(TWICE);
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    const said = recipe.references[1]!.sentence;
    expect(said).toContain("cut out of a photograph of him");
    expect(said).not.toContain("the tattoo design supplied for this edit");
  });
});
