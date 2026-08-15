import { describe, expect, it } from "vitest";

import { scopedAskIsUnsayable, repaintAsksFor, repaintCannotRemove, type EditProse } from "./repaintAsks";
import { assembleRecipe } from "./recipeAssembler";
import type { CastPronouns } from "./castPronouns";

/**
 * The translation between the two vocabularies — the delta's imperative lane and
 * the recipe's declarative one.
 *
 * Every refusal here is proven by DRIVING it, and the positive cases are put
 * through the REAL assembler rather than compared against a shape: what has to
 * be true is that these asks build a recipe, not that they match a fixture the
 * assembler never sees. (opus-146 §4's discipline, one module along.)
 */

/* The prose object stands in for `EDIT_PROSE` with the same signature and
   recognisably different text, so a test that passed by accidentally
   reproducing production prose cannot. */
const prose: EditProse = {
  eyeColour: (value) => `iris prose for ${value}`,
  eyeShape: (value) => `shape prose for ${value}`,
  hairStyle: (value) => `a ${value} (family)`,
  hairColour: (value) => `colour prose for ${value}`,
  hairTexture: (value) => `texture prose for ${value}`,
};

const her: CastPronouns = {
  subject: "she", object: "her", possessive: "her", plural: false,
};

const master = { key: "casting-v2/candidates/master.png" };

function recipeFrom(asks: ReturnType<typeof repaintAsksFor>) {
  if (!asks.ok) throw new Error(`expected asks, got ${asks.reason}`);
  return assembleRecipe({ master, pronouns: her, library: [], asks: asks.asks });
}

describe("one step's delta becomes the recipe's asks", () => {
  it("says a free-lane ask as the user's own state, on the slot that owns it", () => {
    const result = repaintAsksFor({ delta: { free: { hairWorn: "hair down" } }, prose });

    expect(result).toEqual({
      ok: true,
      asks: [{ slot: "hair", noun: "hair", words: "hair down" }],
    });
  });

  it("THE DEGENERATE CASE: no library, words only — the master alone plus words", () => {
    /* fable-171 condition 1, and the road every new cast travels. It is the
       first fixture here for exactly that reason. */
    const recipe = recipeFrom(repaintAsksFor({
      delta: { free: { hairWorn: "hair down" } }, prose,
    }));

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.references).toHaveLength(1);
    expect(recipe.references[0]!.role).toEqual({ kind: "master" });
    expect(recipe.references[0]!.image).toBe(master);
    expect(recipe.ask).toBe("Change only her hair: hair down.");
    expect(recipe.prompt).toContain("Reference 1 is the photograph of this person");
    expect(recipe.prompt).toContain("Change only her hair: hair down.");
  });

  it("says a guaranteed value through the SAME prose the prompt is composed with", () => {
    const result = repaintAsksFor({ delta: { hairColour: "copper" }, prose });

    expect(result).toEqual({
      ok: true,
      asks: [{ slot: "hair", noun: "hair", words: "coloured colour prose for copper" }],
    });
  });

  it("gives one slot ONE ask when a step writes two of its facets", () => {
    /* A cut and a colour in one breath are one visible thing. Two asks for one
       slot would be two instructions about one feature, and the assembler
       refuses a slot twice referenced anyway (fable-174). */
    const result = repaintAsksFor({
      delta: { hairStyle: "mullet", hairColour: "copper" }, prose,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks).toHaveLength(1);
    expect(result.asks[0]!.slot).toBe("hair");
    expect(result.asks[0]!.words)
      .toBe("cut into a mullet (family), coloured colour prose for copper");
  });

  it("gives a bilateral feature one ask per instance", () => {
    /* Stored as instances, spoken as pairs (fable-167). "Her eyes" is one
       sentence to the user and two slots to the recipe. */
    const result = repaintAsksFor({ delta: { eyeColour: "green" }, prose });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks.map((ask) => ask.slot)).toEqual(["eye@left", "eye@right"]);
    expect(result.asks.map((ask) => ask.noun)).toEqual(["left eye", "right eye"]);
    for (const ask of result.asks) expect(ask.words).toBe("green — iris prose for green");
  });

  it("narrows to ONE instance when she pointed at one, with the same words", () => {
    /*
      The founder's question — "how would i edit just the left or right eye?" —
      and the answer the per-eye court bought: 31 of 32 single-side paints
      landed on exactly the asked eye, zero on the wrong one, zero on both
      (opus-342). What the court changed was the SLOT LIST and nothing else, so
      this asserts both halves: one ask, and the identical sentence.
    */
    const both = repaintAsksFor({ delta: { eyeColour: "green" }, prose });
    const one = repaintAsksFor({ delta: { eyeColour: "green" }, prose, scope: "eye@left" });

    expect(one.ok).toBe(true);
    if (!one.ok || !both.ok) return;
    expect(one.asks.map((ask) => ask.slot)).toEqual(["eye@left"]);
    /* `eye@right` is not mentioned AT ALL — that absence is the feature. */
    expect(JSON.stringify(one.asks)).not.toContain("eye@right");
    /* Same wording as the unscoped ask: the narrowing may not become a second
       vocabulary, or the court measured a sentence this build does not send. */
    expect(one.asks[0]!.words).toBe(both.asks[0]!.words);
  });

  it("REFUSES rather than quietly painting the whole face when the scope names nothing this ask writes", () => {
    /*
      The door (fable-444 §3). A scope that falls through to a whole-face render
      is a both-eyes charge for a one-eye ask, and the picture would look like a
      correct render of a different question — which is exactly how this
      program's worst defects have looked.
    */
    const result = repaintAsksFor({ delta: { eyeColour: "green" }, prose, scope: "lips" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("notASlot");
    expect(result.facet).toBe("eye.colour");
  });

  /*
    THE BACKSTOP KEEPS ITS OWN DRIVE (fable-489 §3c).

    The service now refuses this shape BEFORE the claim, which means the late
    door would never be reached through the front door again — and a backstop
    tested only through a well-behaved front door is untested (law 3). So it is
    driven here, directly, on the founder's own shape: his cauliflower ear read
    as a MARK with the scope on an ear.
  */
  it("still refuses a scoped ask whose facet has no slot in the scope", () => {
    const result = repaintAsksFor({
      delta: { free: { marks: ["cauliflower ear on her left ear"] } },
      prose,
      scope: "ear@left",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("notASlot");
    expect(result.facet).toBe("marks");
  });

  /*
    AND THE EARLY DOOR IS NARROWER THAN THIS ONE, which is what stops it
    over-refusing: it fires only when EVERY answered facet is outside the scope.
  */
  it("the early predicate says nothing about an ask with one facet INSIDE the scope", () => {
    const both = { eyeColour: "green" as const, free: { marks: ["a scar"] } };
    expect(scopedAskIsUnsayable({ delta: both, scope: "eye@left" }).unsayable).toBe(false);
    /* And it agrees with the door when nothing is inside. */
    expect(scopedAskIsUnsayable({ delta: { free: { marks: ["a scar"] } }, scope: "ear@left" }))
      .toMatchObject({ unsayable: true, facets: ["marks"] });
  });

  it("the early predicate declines to judge what needs an accessory kind it has not got", () => {
    /* Cannot-tell must not become a refusal: without the kind, a stated
       accessory has no slots to narrow, so the early door stands down and the
       late one decides with the kind in hand. */
    expect(scopedAskIsUnsayable({
      delta: { free: { statedAccessories: ["a gold hoop"] } },
      scope: "eye@left",
    }).unsayable).toBe(false);
  });

  it("leaves an unscoped ask exactly as it was", () => {
    /* The inert half: every render before the panel sends a scope. */
    const result = repaintAsksFor({ delta: { eyeColour: "green" }, prose, scope: undefined });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks.map((ask) => ask.slot)).toEqual(["eye@left", "eye@right"]);
  });

  it("takes an accessory's slot from the described OBJECT, never from the facet", () => {
    const result = repaintAsksFor({
      delta: { free: { statedAccessories: ["small gold hoops"] } },
      prose,
      accessoryKind: "earring",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks.map((ask) => ask.slot)).toEqual(["earring@left", "earring@right"]);
    for (const ask of result.asks) expect(ask.words).toBe("small gold hoops");
  });

  it("keeps a plural subject's whole set as the state", () => {
    /* A plural value is the COMPLETE current answer rather than an increment,
       so the state phrase is the whole list. */
    const result = repaintAsksFor({
      delta: { free: { marks: ["a scar on her cheek", "freckles across her nose"] } },
      prose,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks).toEqual([{
      slot: "skin",
      noun: "skin",
      words: "a scar on her cheek, freckles across her nose",
    }]);
  });
});

/**
 * A DEPARTURE IS A SLOT GOING VACANT (chunk 3, `LIBRARY_REMOVAL_DESIGN.md`).
 *
 * This described a refusal until today, and the refusal's reason was true of
 * the recipe as it then was: a departure has no state phrase to regenerate a
 * FEATURE from. There is one about the SITE, it lives in the placement table,
 * and the slot simply stops carrying.
 *
 * The specimen is the founder's own step 5 — *"remove her glasses"* — which
 * refused in 33.2 s and refunded on the shift-59 walk.
 */
describe("a departure vacates the slot and says so", () => {
  it("turns her own glasses leaving into a vacate ask that names the bare site", () => {
    const result = repaintAsksFor({
      delta: { free: { statedAccessories: [] }, absent: { statedAccessories: ["glasses"] } },
      prose,
      accessoryKind: "glasses",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks).toHaveLength(1);
    expect(result.asks[0]!.slot).toBe("glasses");
    /* The sentence comes from the catalogue, so it names the SITE rather than
       telling the reader what to conclude — and it carries no words. */
    expect(result.asks[0]!.vacate?.says).toContain("no glasses");
    expect(result.asks[0]!.vacate?.says).toContain("uncovered");
    expect(result.asks[0]!.words).toBeUndefined();
  });

  it("takes a BEARD off, which nothing on this road could do until today", async () => {
    /*
      V3 slice (b), the first non-accessory departure.

      Everything `facialHair` needed already existed — it is departable, it has
      a slot, a question and a guard kind — and the ask refused `uncatalogued`
      anyway, because the sentence that says a thing is gone lived on the table
      for things you WEAR. Moving the phrase onto a kind-keyed home is the whole
      fix, and this is the door where the old refusal was raised.
    */
    const result = repaintAsksFor({
      delta: { free: {}, absent: { facialHair: ["beard"] } },
      prose,
    });

    expect(result.ok, "reason" in result ? String((result as { reason?: unknown }).reason) : "")
      .toBe(true);
    if (!result.ok) return;
    expect(result.asks).toHaveLength(1);
    expect(result.asks[0]!.slot).toBe("facial-hair");
    /* A STATE that names the site, like every other one: what is gone AND what
       the skin under it looks like, which is the half a render gets wrong. */
    expect(result.asks[0]!.vacate?.says).toContain("no beard");
    expect(result.asks[0]!.vacate?.says).toContain("clean-shaven");
    expect(result.asks[0]!.words).toBeUndefined();
  });

  it("CONTROL — a kind with no phrase still refuses rather than improvising one", () => {
    /*
      The other half, and the half that keeps the move honest: adding a home for
      the sentence must not open the door for kinds nobody has written one for.
      `ink` is departable and has no phrase (its slots arrive with the tattoo
      studio), so it refuses exactly as it did before.
    */
    const result = repaintAsksFor({
      delta: { free: {}, absent: { ink: ["the star behind her ear"] } },
      prose,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    /* It refuses at the FIRST door that can answer honestly — for ink that is
       `unnamedObject`, one step before the phrase lookup, because its slots
       come from the placement and there is no slot to look a phrase up for.
       Named exactly rather than loosely: "some refusal" would pass if the door
       moved to one that was wrong for a different reason. */
    expect(result.reason).toBe("unnamedObject");
  });

  it("vacates BOTH lobes when a pair leaves, because a pair is two slots", () => {
    const result = repaintAsksFor({
      delta: { free: { statedAccessories: [] }, absent: { statedAccessories: ["gold hoop earrings"] } },
      prose,
      accessoryKind: "earring",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks.map((ask) => ask.slot)).toEqual(["earring@left", "earring@right"]);
    for (const ask of result.asks) expect(ask.vacate?.says).toContain("bare");
  });

  /**
   * A SENTENCE THAT NAMES ONE SIDE AND POINTS AT NOTHING (fable-604 §3a).
   *
   * Typed prose does not scope; only the tapped box does. So an unscoped
   * *"her right eye — fiery red"* fanned the ask out to BOTH eyes with the side
   * word still inside the value, and the recipe dispatched — verbatim from a
   * dev row — *"Change only his left eye: her right eye fiery red; his right
   * eye: her right eye fiery red"*, at full price. The render's own read-back
   * caught it afterwards and nothing consulted the reading.
   *
   * The three controls beside it are the whole of the rule: naming BOTH sides
   * is a statement about the pair, a scoped ask is exactly the path this door
   * points at, and a feature with one instance has no sides to confuse.
   */
  it("REFUSES a side named in prose with nothing pointed at, rather than dispatching a contradiction", () => {
    const result = repaintAsksFor({
      delta: { free: { eyeColourFree: "her right eye fiery red" } },
      prose,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("sideNamedWithoutScope");
    expect(result.detail).toContain("right");
  });

  it("CONTROL — a sentence naming BOTH sides is about the pair, and goes through", () => {
    const result = repaintAsksFor({
      delta: { free: { eyeColourFree: "her left and right eyes fiery red" } },
      prose,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks.map((ask) => ask.slot)).toEqual(["eye@left", "eye@right"]);
  });

  it("CONTROL — the same sentence WITH a scope is the path the refusal points at", () => {
    const result = repaintAsksFor({
      delta: { free: { eyeColourFree: "her right eye fiery red" } },
      prose,
      scope: "eye@right",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks.map((ask) => ask.slot)).toEqual(["eye@right"]);
  });

  it("CONTROL — a side word about a feature there is only ONE of never reaches the door", () => {
    /* "Parted on the left" is a haircut, and hair has one instance: there is no
       fan-out for a side word to contradict. */
    const result = repaintAsksFor({
      delta: { free: { hairWorn: "parted on the left" } },
      prose,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks.map((ask) => ask.slot)).toEqual(["hair"]);
  });

  /**
   * THE INFERENCE, DARK (fable-604 §3b).
   *
   * The refusal above is the honest answer until a court has run. These pin
   * what the court is testing: with the inference armed, the sentence narrows
   * to the side it names — the SAME slot a tapped box produces, so there is one
   * definition of "her right eye" rather than two — and it narrows to HER side
   * on both, which is the mirrored arm the image-half law demands of every
   * per-side claim.
   */
  it("ARMED — narrows to the side the words name, right", () => {
    const result = repaintAsksFor({
      delta: { free: { eyeColourFree: "her right eye fiery red" } },
      prose,
      inferSideFromWords: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks.map((ask) => ask.slot)).toEqual(["eye@right"]);
  });

  it("ARMED — and left, which is the mirrored half of the same claim", () => {
    const result = repaintAsksFor({
      delta: { free: { eyeColourFree: "her left eye fiery red" } },
      prose,
      inferSideFromWords: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks.map((ask) => ask.slot)).toEqual(["eye@left"]);
  });

  it("ARMED — a sentence about the pair still asks for both", () => {
    const result = repaintAsksFor({
      delta: { free: { eyeColourFree: "her left and right eyes fiery red" } },
      prose,
      inferSideFromWords: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks.map((ask) => ask.slot)).toEqual(["eye@left", "eye@right"]);
  });

  it("REFUSES to take one of a pair off, because the one court of that sentence saw it take both", () => {
    /*
      The narrowing is granted for PAINT and not for a VACANCY. The per-eye
      court measured single-side paints (31/32 exact, zero on the wrong eye);
      the only time a per-side vacancy sentence was watched it took BOTH sides
      (opus-275, located to the vacancy sentence rather than to the word "right"
      by opus-342 §3).

      So this is the fidelity law's declared shortcut being named instead of
      taken: she asks for one hoop off, and rather than shipping the shape a
      court has already seen fail, the door refuses free and whole.
    */
    const result = repaintAsksFor({
      delta: { free: { statedAccessories: [] }, absent: { statedAccessories: ["gold hoop earrings"] } },
      prose,
      accessoryKind: "earring",
      scope: "earring@left",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("perSideRemoval");
    expect(result.detail).toContain("both");
  });

  it("CONTROL — a scoped removal of a thing there is only ONE of is untouched", () => {
    /*
      The refusal above is about a fan-out a scope can narrow, and glasses have
      no sides to narrow between: the list is one slot scoped or unscoped, so
      nothing about the render changes and refusing it would be a door closing
      on a case it was never built for.
    */
    const result = repaintAsksFor({
      delta: { free: { statedAccessories: [] }, absent: { statedAccessories: ["glasses"] } },
      prose,
      accessoryKind: "glasses",
      scope: "glasses",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks.map((ask) => ask.slot)).toEqual(["glasses"]);
  });

  it("CONTROL — an UNSCOPED pair removal still vacates both, exactly as it did", () => {
    /* The inert half. Every removal before the panel sends a scope. */
    const result = repaintAsksFor({
      delta: { free: { statedAccessories: [] }, absent: { statedAccessories: ["gold hoop earrings"] } },
      prose,
      accessoryKind: "earring",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks.map((ask) => ask.slot)).toEqual(["earring@left", "earring@right"]);
  });

  it("CONTROL — a departure of something the table cannot name still refuses", () => {
    /* The honest answer, and the same one the mint gives. An absence sentence
       improvised at the call site is the free-floating prose fable-195 ruled
       against, and the price of getting it wrong is a paid render that says
       something untrue about her face. */
    const result = repaintAsksFor({
      delta: { free: { statedAccessories: [] }, absent: { statedAccessories: ["her tiara"] } },
      prose,
      accessoryKind: null,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("unnamedObject");
    expect(result.detail).toContain("tiara");
  });

  it("CONTROL — survivors are still stated, so a partial removal is not a vacate", () => {
    /* "Take the hoops off" against hoops AND glasses leaves the glasses on her,
       and the surviving item has to keep being said or the next render drops
       it. The empty-value skip above is narrow for exactly this reason. */
    const result = repaintAsksFor({
      delta: {
        free: { statedAccessories: ["thin wire glasses"] },
        absent: { statedAccessories: ["gold hoop earrings"] },
      },
      prose,
      accessoryKind: "glasses",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks.map((ask) => ask.slot)).toEqual(["earring@left", "earring@right", "glasses"]);
    expect(result.asks.at(-1)!.words).toBe("thin wire glasses");
    expect(result.asks.at(-1)!.vacate).toBeUndefined();
  });
});

/*
  A FACT WITH NOWHERE TO FILE IT (fable-446).

  `expression` is the first ask the road could not state — presentation rather
  than identity (D-136), no zone to cut, nothing to carry — and until this it
  refused into the refund. It now rides the recipe in words alone.
*/
describe("a presentation fact rides the words and files nowhere", () => {
  it("says it in the recipe rather than refusing the render", () => {
    const result = repaintAsksFor({ delta: { free: { expression: "a soft, closed-mouth smile" } }, prose });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.presentation).toEqual([{ noun: "expression", words: "a soft, closed-mouth smile" }]);
    /* And NOTHING is filed: no slot means no mint, no crop, no carry, and no
       row that would hand a follow a smile she never asked for. */
    expect(result.asks).toEqual([]);
  });

  it("keeps saying it on a later render that never mentioned it", () => {
    /*
      THE ONE-FRAME CLASS, which this feature would otherwise walk straight
      into. Every render anchors on the pristine master, so a recipe that goes
      quiet about her smile paints the master's face back — the smile would
      last exactly one frame, the way a born-worn removal did and a body edit
      did. The composed state is the only place a slotless fact is written
      down, so it is re-said from there on every render of the branch.
    */
    const result = repaintAsksFor({
      delta: { hairColour: "copper" },
      prose,
      restore: { state: { hairColour: "copper", free: { expression: "a soft, closed-mouth smile" } }, slots: [] },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.presentation).toEqual([{ noun: "expression", words: "a soft, closed-mouth smile" }]);
    expect(result.asks.map((ask) => ask.slot)).toEqual(["hair"]);
  });

  it("CONTROL — a branch with no expression carries no clause at all", () => {
    /* The inert half. Make the clause unconditional and this goes red rather
       than every render quietly acquiring a sentence about her face. */
    const result = repaintAsksFor({
      delta: { hairColour: "copper" },
      prose,
      restore: { state: { hairColour: "copper" }, slots: [] },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.presentation).toBeUndefined();
  });

  it("is a whole ask on its own — it does not fall through the empty-ask door", () => {
    /*
      `nothingAsked` exists because an empty ask list is a charge for nothing.
      A render whose only ask is a presentation clause has no slots and is not
      nothing: she typed a sentence, the recipe says it, and the picture is
      supposed to change.
    */
    const result = repaintAsksFor({ delta: { free: { expression: "a wide, open smile" } }, prose });

    expect(result.ok).toBe(true);
  });
});

describe("what it refuses rather than paints", () => {

  it("refuses an ask whose facet has no slot, rather than dropping it", () => {
    /* THE DEFECT CLASS THIS EXISTS TO CLOSE. A dropped ask is a paid picture
       whose instruction never reached the painter — the hairWorn gate's own
       shape, arriving through the recipe instead of through the reader. */
    /* `expression` was on this list until 2026-08-14 and is not any more: it
       has no slot for the same decided reason and no longer needs one, because
       a presentation fact rides the change clause (fable-446). Makeup and ink
       still refuse, and they are the reason this test is not deleted. */
    for (const [delta, facet] of [
      [{ makeup: "a red lip" }, "makeup"],
      [{ free: { ink: "a small swallow on her wrist" } }, "ink"],
    ] as const) {
      const result = repaintAsksFor({ delta, prose });
      expect(result.ok, facet).toBe(false);
      if (result.ok) continue;
      expect(result.reason, facet).toBe("notASlot");
      expect(result.facet, facet).toBe(facet);
    }
  });

  it("tells an unnamed worn object apart from a decided absence", () => {
    /* Same input facet, two different honest answers, and they must not wear
       each other's label: one is owed work on the placement table, the other is
       a ruling. */
    const result = repaintAsksFor({
      delta: { free: { statedAccessories: ["a lapel pin"] } },
      prose,
      accessoryKind: null,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("unnamedObject");
    expect(result.facet).toBe("statedAccessories");
  });

  it("refuses a written facet with nothing to say about it", () => {
    const result = repaintAsksFor({ delta: { free: { lips: "  " } }, prose });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("noWords");
  });

  it("refuses a delta that writes nothing — an empty ask list is a charge for nothing", () => {
    /* The assembler would accept it: no asks is a legitimate pure-carry recipe,
       and it would paint, land and bill. This caller is the only layer that
       knows somebody typed a sentence and paid for it. */
    const result = repaintAsksFor({ delta: {}, prose });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("nothingAsked");

    /* The positive control on that claim: the assembler really does say yes. */
    const permissive = assembleRecipe({ master, pronouns: her, library: [], asks: [] });
    expect(permissive.ok).toBe(true);
  });

  it("names the removal it cannot yet express", () => {
    const refusal = repaintCannotRemove();
    expect(refusal.ok).toBe(false);
    expect(refusal.reason).toBe("removal");
    expect(refusal.detail).toContain("D-244");
  });
});

describe("the asks the assembler is actually handed", () => {
  it("builds a recipe rather than tripping the declarative-state contract", () => {
    /*
      Driven through the REAL assembler for opus-146 §4's reason: what has to be
      true is that these words BUILD A RECIPE, not that they match a pattern a
      copy of the assembler's regex would also match. `wordsNotDeclarative` is
      the specific thing at risk — every phrase here is composed by this module,
      and an imperative opener anywhere in it would refuse a paid render.
    */
    for (const delta of [
      { free: { hairWorn: "hair down" } },
      { hairColour: "copper" as const },
      { hairStyle: "mullet" },
      { eyeShape: "hooded" as const },
      { free: { statedAccessories: ["small gold hoops"] } },
      { free: { brows: "fuller, softly arched" } },
    ]) {
      const recipe = recipeFrom(repaintAsksFor({ delta, prose, accessoryKind: "earring" }));
      expect(recipe.ok, JSON.stringify(delta)).toBe(true);
      if (!recipe.ok) continue;
      expect(recipe.ask, JSON.stringify(delta)).toMatch(/^Change only /);
    }
  });

  it("carries a slot the library has never held, because the ask names it", () => {
    /* `slotNotNamed` is the assembler's refusal for a slot with no library entry
       and no noun on the ask. Supplying the catalogue's noun on every ask is what
       makes a first-ever edit of a feature expressible at all. */
    const asks = repaintAsksFor({ delta: { free: { nose: "a slightly narrower bridge" } }, prose });
    expect(asks.ok).toBe(true);
    if (!asks.ok) return;
    expect(asks.asks[0]!.noun).toBe("nose");

    const recipe = assembleRecipe({ master, pronouns: her, library: [], asks: asks.asks });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.ask).toBe("Change only her nose: a slightly narrower bridge.");
  });
});
