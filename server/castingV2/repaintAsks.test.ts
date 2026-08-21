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
    const result = repaintAsksFor({ pronouns: her, delta: { free: { hairWorn: "hair down" } }, prose });

    expect(result).toEqual({
      ok: true,
      asks: [{ slot: "hair", noun: "hair", words: "hair down" }],
    });
  });

  it("THE DEGENERATE CASE: no library, words only — the master alone plus words", () => {
    /* fable-171 condition 1, and the road every new cast travels. It is the
       first fixture here for exactly that reason. */
    const recipe = recipeFrom(repaintAsksFor({
      pronouns: her,
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
    const result = repaintAsksFor({ pronouns: her, delta: { hairColour: "copper" }, prose });

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
      pronouns: her,
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
    const result = repaintAsksFor({ pronouns: her, delta: { eyeColour: "green" }, prose });

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
    const both = repaintAsksFor({ pronouns: her, delta: { eyeColour: "green" }, prose });
    const one = repaintAsksFor({ pronouns: her, delta: { eyeColour: "green" }, prose, scope: "eye@left" });

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
    const result = repaintAsksFor({ pronouns: her, delta: { eyeColour: "green" }, prose, scope: "lips" });

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
      pronouns: her,
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
    const result = repaintAsksFor({ pronouns: her, delta: { eyeColour: "green" }, prose, scope: undefined });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks.map((ask) => ask.slot)).toEqual(["eye@left", "eye@right"]);
  });

  it("takes an accessory's slot from the described OBJECT, never from the facet", () => {
    const result = repaintAsksFor({
      pronouns: her,
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
      pronouns: her,
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
      pronouns: her,
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
      pronouns: her,
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
      pronouns: her,
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
      pronouns: her,
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
      pronouns: her,
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
      pronouns: her,
      delta: { free: { eyeColourFree: "her left and right eyes fiery red" } },
      prose,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks.map((ask) => ask.slot)).toEqual(["eye@left", "eye@right"]);
  });

  it("CONTROL — the same sentence WITH a scope is the path the refusal points at", () => {
    const result = repaintAsksFor({
      pronouns: her,
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
      pronouns: her,
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
      pronouns: her,
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
      pronouns: her,
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
      pronouns: her,
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
      pronouns: her,
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
      pronouns: her,
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
      pronouns: her,
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
      pronouns: her,
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
      pronouns: her,
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
    const result = repaintAsksFor({ pronouns: her, delta: { free: { expression: "a soft, closed-mouth smile" } }, prose });

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
      pronouns: her,
      delta: { hairColour: "copper" },
      prose,
      restore: { state: { hairColour: "copper", free: { expression: "a soft, closed-mouth smile" } }, slots: [] },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.presentation).toEqual([{ noun: "expression", words: "a soft, closed-mouth smile" }]);
    expect(result.asks.map((ask) => ask.slot)).toEqual(["hair"]);
  });

  it("REPORTS a restore slot the catalogue cannot name, instead of skipping it in silence", () => {
    /*
      OPEN_LANE_CARRY_DESIGN.md §4 finding 2, ordered by fable-766 §3.

      The skip itself is right — there is no noun to restore an unnameable slot
      with — and its SILENCE was the defect: a restore would put back everything
      except that feature and say nothing, which is the build-lost class. Driven
      directly with a key no catalogue entry answers for, because the shape is
      unreachable through today's vocabulary and a guard nothing can exercise is
      a guard nobody has tested.

      **The specimen was `open:horns` until the open lane's branch landed, and
      then the catalogue started answering for it** — a control whose specimen
      has joined the vocabulary tests the vocabulary rather than the control.
      That has now happened twice in this family, in both directions
      (`openKindPolicy.test.ts`'s `qualifierFor` control lost `horns` to
      promotion), so the rule is worth stating where the next one will read it:
      **pick an unknown-key specimen that nothing is on a path to catalogue.**
      `elbow` is not a feature this product has, is not in the open namespace,
      and no roadmap item introduces it.
    */
    const result = repaintAsksFor({
      pronouns: her,
      delta: { hairColour: "copper" },
      prose,
      restore: { state: { hairColour: "copper" }, slots: ["elbow@left", "hair"] },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    /* Named, and only the unnameable one — `hair` resolves and is restored. */
    expect(result.unnameableRestores).toEqual(["elbow@left"]);
  });

  it("CONTROL — an ordinary restore reports nothing, so the field cannot become noise", () => {
    /* The negative half. Report unconditionally and this goes red rather than
       every render quietly acquiring a warning about slots that were fine. */
    const result = repaintAsksFor({
      pronouns: her,
      delta: { hairColour: "copper" },
      prose,
      restore: { state: { hairColour: "copper" }, slots: ["hair"] },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.unnameableRestores).toBeUndefined();
  });

  it("CONTROL — a branch with no expression carries no clause at all", () => {
    /* The inert half. Make the clause unconditional and this goes red rather
       than every render quietly acquiring a sentence about her face. */
    const result = repaintAsksFor({
      pronouns: her,
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
    const result = repaintAsksFor({ pronouns: her, delta: { free: { expression: "a wide, open smile" } }, prose });

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
       a presentation fact rides the change clause (fable-446). Makeup is the
       reason this test is not deleted.

       `ink` LEFT ON 2026-08-20 and did not stop refusing — it moved to its own
       reason, and the arm below is where that distinction is held. */
    for (const [delta, facet] of [
      [{ makeup: "a red lip" }, "makeup"],
    ] as const) {
      const result = repaintAsksFor({ pronouns: her, delta, prose });
      expect(result.ok, facet).toBe(false);
      if (result.ok) continue;
      expect(result.reason, facet).toBe("notASlot");
      expect(result.facet, facet).toBe(facet);
    }
  });

  /*
    AN INK ASK WITH NOWHERE ON HER NAMED — its OWN reason, not makeup's.

    Driven directly, because it is meant to be unreachable: the ink branch
    upstream asks where before anything is claimed, so a take with no placement
    never reaches this door. Unreachable is a CLAIM, and a comment calling a
    branch synthetic has cost this codebase a whole walk before — so the door is
    driven here rather than certified by the path that usually behaves.

    The reason must NOT be `notASlot`: that one means the catalogue decided this
    facet has no picture, which is the opposite of true now. A customer who is
    told "that isn't something I can place yet" about a tattoo we can place has
    been told something false about the product.
  */
  it("refuses an ink ask with no placement, in ink's own words", () => {
    const result = repaintAsksFor({
      pronouns: her,
      delta: { free: { ink: "a small swallow" } },
      prose,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("unplacedInk");
    expect(result.facet).toBe("ink");
    expect(result.detail).toContain("nothing says where on her it goes");
  });

  /*
    AND WITH ONE, IT IS AN ASK ABOUT THE PLACEMENT'S OWN SLOT.

    The other half of the same control: a door that refused whatever it was
    handed would pass the arm above and take the whole wire down with it. This
    is also the first time an ink ask has produced a slot at all.
  */
  it("takes an ink ask to the placement's slot once somebody says where", () => {
    const result = repaintAsksFor({
      pronouns: her,
      delta: { free: { ink: "a small swallow" } },
      prose,
      inkPlacement: { placement: "neck", side: null },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks.map((ask) => ask.slot)).toEqual(["ink:neck"]);
  });

  it("carries the side she named onto the slot, for a per-side placement", () => {
    /* The side is this road's measured failure — 300 credits refunded twice for
       a design on the wrong anatomical side (DECISION_LOG R7-7G) — so the slot
       the ask lands on is the sided one, and the picture-half clause reads its
       instance from exactly this. */
    const result = repaintAsksFor({
      pronouns: her,
      delta: { free: { ink: "a small swallow" } },
      prose,
      inkPlacement: { placement: "upperArm", side: "left" },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks.map((ask) => ask.slot)).toEqual(["ink:upperArm@left"]);
  });

  it("tells an unnamed worn object apart from a decided absence", () => {
    /* Same input facet, two different honest answers, and they must not wear
       each other's label: one is owed work on the placement table, the other is
       a ruling. */
    const result = repaintAsksFor({
      pronouns: her,
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
    const result = repaintAsksFor({ pronouns: her, delta: { free: { lips: "  " } }, prose });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("noWords");
  });

  it("refuses a delta that writes nothing — an empty ask list is a charge for nothing", () => {
    /* The assembler would accept it: no asks is a legitimate pure-carry recipe,
       and it would paint, land and bill. This caller is the only layer that
       knows somebody typed a sentence and paid for it. */
    const result = repaintAsksFor({ pronouns: her, delta: {}, prose });

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
      const recipe = recipeFrom(repaintAsksFor({ pronouns: her, delta, prose, accessoryKind: "earring" }));
      expect(recipe.ok, JSON.stringify(delta)).toBe(true);
      if (!recipe.ok) continue;
      expect(recipe.ask, JSON.stringify(delta)).toMatch(/^Change only /);
    }
  });

  it("carries a slot the library has never held, because the ask names it", () => {
    /* `slotNotNamed` is the assembler's refusal for a slot with no library entry
       and no noun on the ask. Supplying the catalogue's noun on every ask is what
       makes a first-ever edit of a feature expressible at all. */
    const asks = repaintAsksFor({ pronouns: her, delta: { free: { nose: "a slightly narrower bridge" } }, prose });
    expect(asks.ok).toBe(true);
    if (!asks.ok) return;
    expect(asks.asks[0]!.noun).toBe("nose");

    const recipe = assembleRecipe({ master, pronouns: her, library: [], asks: asks.asks });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.ask).toBe("Change only her nose: a slightly narrower bridge.");
  });
});

/*
  A KIND NOBODY HAS CATALOGUED — the open lane's own loop
  (`OPEN_LANE_DESIGN_NOTE.md` §8 step 4, shape (a) ruled in fable-760 §2).

  It cannot enter through the written loop: every gate in there keys on the
  closed union in turn and an open kind has no facet. So it has a loop of its
  own, beside the presentation loop, reading the composed state for the same
  reason presentation does — nothing files an open slot yet, so the composition
  is the only place one is written down.

  `cat ears` is the specimen throughout rather than `horns`, deliberately, on
  the rule this family has now paid for twice: **pick a specimen nothing is on a
  path to catalogue.** Horns were promoted mid-campaign; a two-word kind also
  exercises the one thing the key form is lossy about.
*/
describe("an uncatalogued kind rides its own synthesized slot", () => {
  const catEars = { noun: "cat ears", words: "soft grey cat ears set high on her head" };

  it("becomes an ask on the open key, said with the STORED noun", () => {
    const result = repaintAsksFor({ pronouns: her, delta: { open: { "cat-ears": catEars } }, prose });

    expect(result).toEqual({
      ok: true,
      asks: [{
        slot: "open:cat-ears",
        /* Her word, spaces intact — NOT the token. The key is lossy (`cat ears`
           and `cat-ears` key the same), so the noun is carried beside it and
           every copy path reads the record. */
        noun: "cat ears",
        words: "soft grey cat ears set high on her head",
      }],
    });
  });

  it("says it to the painter in her own words, through the real assembler", () => {
    const recipe = recipeFrom(repaintAsksFor({ pronouns: her, delta: { open: { "cat-ears": catEars } }, prose }));

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    /* The degenerate case, which is the road every open kind travels until
       step 3's mint door files a crop: the master alone, plus words. */
    expect(recipe.references).toHaveLength(1);
    expect(recipe.references[0]!.role).toEqual({ kind: "master" });
    expect(recipe.ask).toBe("Change only her cat ears: soft grey cat ears set high on her head.");
  });

  it("KEEPS SAYING IT on a later render that never mentioned it", () => {
    /*
      THE CARRY, and it is the whole of fable-566's requirement that this chunk
      can meet. Every render anchors on the pristine master, which has no cat
      ears — so a recipe that goes quiet about them paints them off her head.
      The composed state is the only place the kind is written down (no facet,
      so no library row), exactly as with a smile.
    */
    const result = repaintAsksFor({
      pronouns: her,
      delta: { hairColour: "copper" },
      prose,
      restore: { state: { hairColour: "copper", open: { "cat-ears": catEars } }, slots: [] },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks.map((ask) => ask.slot)).toEqual(["open:cat-ears", "hair"]);
  });

  it("CONTROL — a branch that never asked for one carries no open ask at all", () => {
    /* The inert half. Make the loop unconditional and this goes red rather than
       every render quietly acquiring a slot nobody asked about. */
    const result = repaintAsksFor({
      pronouns: her,
      delta: { hairColour: "copper" },
      prose,
      restore: { state: { hairColour: "copper" }, slots: [] },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks.map((ask) => ask.slot)).toEqual(["hair"]);
  });

  it("a CARRIED kind alone is not an ask — it does not satisfy the empty-ask door", () => {
    /*
      opus-569 §3. The carried channels are re-said on every render forever, so
      counting them as asks would let a kind asked three steps ago satisfy the
      guard against *a charge for nothing* on every render after it.
    */
    const result = repaintAsksFor({
      pronouns: her,
      delta: {},
      prose,
      restore: { state: { open: { "cat-ears": catEars } }, slots: [] },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("nothingAsked");
  });

  it("and the SAME kind asked THIS step is a whole ask on its own", () => {
    /* The other half, which is the one that must not refuse: a door that says
       no to everybody would pass the arm above and take the feature away. */
    const result = repaintAsksFor({
      pronouns: her,
      delta: { open: { "cat-ears": catEars } },
      prose,
      restore: { state: { open: { "cat-ears": catEars } }, slots: [] },
    });

    expect(result.ok).toBe(true);
  });

  it("a CARRIED presentation fact alone is not an ask either — the sibling", () => {
    /*
      The live half of the same finding, and the reason it is fixed here rather
      than merely guarded against: `presentation` has been read from the
      composed state since 2026-08-14, so a branch with a standing smile has
      satisfied this door on every later render since.
    */
    const result = repaintAsksFor({
      pronouns: her,
      delta: {},
      prose,
      restore: { state: { free: { expression: "a soft, closed-mouth smile" } }, slots: [] },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("nothingAsked");
  });

  it("REFUSES rather than putting the key in her sentence when the noun is missing", () => {
    /*
      The one place a customer's sentence is composed from an open kind, and the
      key is a token: falling back to it would dispatch *"Change only her
      cat-ears: …"* at full price. A refusal is free.
    */
    const result = repaintAsksFor({
      pronouns: her,
      delta: { open: { "cat-ears": { noun: "  ", words: "soft grey cat ears" } } },
      prose,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("noWords");
    expect(result.facet).toBeNull();
  });

  it("REFUSES a key the library would refuse after the render was paid for", () => {
    /*
      `parseSlot` has no space in its grammar, so `open:cat ears` is
      `slotNotAFeatureSlot` at the database door — painted, charged, never
      filed, re-rolled on every later render. The catalogue's resolver and the
      library's door hold ONE grammar, and this is the arm that says so from
      the ask side.
    */
    const result = repaintAsksFor({
      pronouns: her,
      delta: { open: { "cat ears": catEars } },
      prose,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("uncatalogued");
  });

  it("a PRUNE re-says what survives and says nothing about what did not", () => {
    /*
      fable-777 §1's negative bound, and it is the half that proves the prune
      road's fix carries the SURVIVING composition rather than the old one.

      `dropTheCarry` is arithmetic: `composeChain` runs over the steps that are
      left, so a fact whose step was struck is simply not in the state this door
      is handed, and the master — which never had it — does the removing. Hand
      it the pre-prune composition instead and the prune would paint nothing
      out, which is the shape that would pass every positive arm above.
    */
    const restate = [{ slot: "earring@left", taken: "gold hoops" }];

    const survived = repaintAsksFor({
      pronouns: her,
      delta: {}, prose, restate,
      restore: { state: { free: { expression: "a soft, closed-mouth smile" } }, slots: [] },
    });
    expect(survived.ok).toBe(true);
    if (!survived.ok) return;
    expect(survived.presentation).toEqual([{ noun: "expression", words: "a soft, closed-mouth smile" }]);

    /* And the same prune against a composition the struck step is gone from. */
    const struck = repaintAsksFor({ pronouns: her, delta: {}, prose, restate, restore: { state: {}, slots: [] } });
    expect(struck.ok).toBe(true);
    if (!struck.ok) return;
    expect(struck.presentation).toBeUndefined();
  });

  it("the empty-ask door judges the ASK, never her state — its replay class is unchanged", () => {
    /*
      fable-777 §2's bound (c). `nothingAsked` is money-adjacent and it is NOT
      in `REPLAY_DOORS`, which means it is not state-comparing and a fresh take
      meets it exactly as a first ask does. The tightening reads the composed
      state, so this arm exists to prove the door's GROUND did not move with it:
      the same delta gets the same verdict whether or not the branch is carrying
      anything.

      Both directions, because a door that answered the same way to everything
      would also pass one of them.
    */
    const carrying = { open: { "cat-ears": catEars }, free: { expression: "a soft, closed-mouth smile" } };

    for (const state of [{}, carrying]) {
      /* Writes nothing: refused, whatever she is carrying. */
      const empty = repaintAsksFor({ pronouns: her, delta: {}, prose, restore: { state, slots: [] } });
      expect(empty.ok, JSON.stringify(state)).toBe(false);
      if (!empty.ok) expect(empty.reason).toBe("nothingAsked");

      /* Writes something: served, whatever she is carrying. */
      const asking = repaintAsksFor({
      pronouns: her,
        delta: { hairColour: "copper" }, prose,
        restore: { state: { ...state, hairColour: "copper" }, slots: [] },
      });
      expect(asking.ok, JSON.stringify(state)).toBe(true);
    }
  });

  it("CONTROL — an ordinary presentation ASK still walks through the tightened door", () => {
    /*
      fable-777 §2's bound (a), in the shape the service actually calls with:
      the state is the branch composed, and this step's own smile is in it. The
      tightening must refuse a CARRIED clause and must not refuse an ASKED one —
      a guard that said no to both would pass the two arms above and take
      *make her smile* away from every customer.
    */
    const result = repaintAsksFor({
      pronouns: her,
      delta: { free: { expression: "a wide, open smile" } },
      prose,
      restore: { state: { free: { expression: "a wide, open smile" } }, slots: [] },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.presentation).toEqual([{ noun: "expression", words: "a wide, open smile" }]);
  });

  it("REFUSES when the composed state it was handed dropped this step's own ask", () => {
    /* A dropped ask is a paid picture whose instruction never reached the
       painter — the defect class this whole module exists to close, arriving
       through a composition rather than through a gate. */
    const result = repaintAsksFor({
      pronouns: her,
      delta: { open: { "cat-ears": catEars } },
      prose,
      restore: { state: { hairColour: "copper" }, slots: [] },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("uncatalogued");
    expect(result.detail).toContain("cat-ears");
  });
});

/*
  THE CARRY/EDIT SPLIT FOR AN OPEN KIND — D-244's two directions, ruled in
  fable-909 §1 and built here.

  The loop above says every open kind in the COMPOSED state, on every render of
  the branch, forever. That was the only carrier there was while nothing minted
  a crop for one. Now that step 3's door files them, saying it again is not
  merely redundant — it is the thing that STOPS the crop riding: an open kind
  re-said is an EDIT, and D-244 line 2 is that a feature's own crop never rides
  in its own edit. So a paid crop was minted and then dropped by the very
  sentence that was preserving the feature before it existed.

  The split the ruling draws, and each arm below is one line of it:

    (a) named in THIS step's `delta.open` → an EDIT. Re-said in the change
        clause, D-244 applies, its own crop does not ride. The customer is
        changing the thing; regenerating it from the anchor plus the full word
        stack is exactly right.
    (b) present only in the COMPOSED state, and a crop exists → a CARRY. The
        crop rides as a reference AND its read-back words ride as the standing
        sentence — the ANATOMY configuration, which is what an open slot's
        catalogue entry already says it is. Justified by this program's own
        courts: crop alone with no words delivered 0 of 5, words present 5 of 5.
    (c) present only in the composed state and NO crop exists → re-said from the
        composed state exactly as today. The words carrier, unchanged, and the
        fallback that stops a cropless kind vanishing.

  `cropped` is the set of slots the LIBRARY can actually carry by crop this
  render, derived once by the caller from the library it is about to hand the
  assembler. Derived once rather than twice on purpose (working law 4): two
  answers to *can this feature carry itself* would drift, and the drift would be
  invisible because both are plausible.
*/
describe("an open kind splits into a CARRY and an EDIT (D-244, fable-909 §1)", () => {
  const catEars = { noun: "cat ears", words: "soft grey cat ears set high on her head" };
  const openSlot = "open:cat-ears";
  const openCrop = { key: "casting-v2/library/open-cat-ears.png" };
  /*
    The library's words are DELIBERATELY not the ask's words. They are the
    render's read-back — what the painter actually delivered, which is the whole
    reason the mint reads the frame — so an arm that passed by quoting the ask
    back at itself would fail here.
  */
  const carriedLibrary = [{
    slot: openSlot,
    tier: "anatomy" as const,
    noun: "cat ears",
    words: ["soft grey cat ears, tall and tufted, set high on her head"],
    carry: openCrop,
  }];

  const carryingBranch = (cropped?: ReadonlySet<string>) => repaintAsksFor({
      pronouns: her,
    delta: { hairColour: "copper" },
    prose,
    restore: { state: { hairColour: "copper", open: { "cat-ears": catEars } }, slots: [] },
    ...(cropped ? { cropped } : {}),
  });

  it("(b) a CARRIED kind whose crop exists is not an ask at all", () => {
    const result = carryingBranch(new Set([openSlot]));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    /* Only the hair. The cat ears are the LIBRARY's to carry this render. */
    expect(result.asks.map((ask) => ask.slot)).toEqual(["hair"]);
  });

  it("(b) and through the REAL assembler the crop rides AND its words stand", () => {
    const asks = carryingBranch(new Set([openSlot]));
    expect(asks.ok).toBe(true);
    if (!asks.ok) return;

    const recipe = assembleRecipe({
      master, pronouns: her, library: carriedLibrary, asks: asks.asks,
    });

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    /* THE CROP IS ON THE WIRE — the fact C1 went looking for and did not find. */
    expect(recipe.references.map((reference) => reference.role)).toEqual([
      { kind: "master" },
      { kind: "carry", slot: openSlot },
    ]);
    expect(recipe.references[1]!.image).toBe(openCrop);
    expect(recipe.carried).toContain(openSlot);
    /* AND THE WORDS RIDE BESIDE IT. An open slot is `anatomy` in the catalogue,
       and anatomy's crop wins about a third of the distance on its own — the
       sentence is what carried the fact 5 of 5. */
    expect(recipe.prompt).toContain("Reference 2 is the exact cat ears she has");
    expect(recipe.prompt)
      .toContain("Keep her cat ears exactly: soft grey cat ears, tall and tufted, set high on her head.");
    /* And the change clause is about the HAIR alone — a carried kind is not an
       edit, and saying it in the ask is what put it in `edited` before. */
    expect(recipe.ask).toBe("Change only her hair: coloured colour prose for copper.");
    expect(recipe.edited).toEqual(["hair"]);
  });

  it("(a) the SAME kind asked THIS STEP is an EDIT, and its own crop is REFUSED", () => {
    /*
      D-244 line 2 in the direction that must not move. The service drops an
      edited slot's crop before the assembler sees it; this drives the guard
      DIRECTLY with the crop present (working law 3), because a backstop whose
      only test runs through a caller that already prevents the case is a
      backstop nothing has tested.
    */
    const asks = repaintAsksFor({
      pronouns: her,
      delta: { open: { "cat-ears": catEars } },
      prose,
      restore: { state: { open: { "cat-ears": catEars } }, slots: [] },
      cropped: new Set([openSlot]),
    });

    expect(asks.ok).toBe(true);
    if (!asks.ok) return;
    /* Re-said, crop or no crop: the customer is changing this thing. */
    expect(asks.asks.map((ask) => ask.slot)).toEqual([openSlot]);

    const recipe = assembleRecipe({
      master, pronouns: her, library: carriedLibrary, asks: asks.asks,
    });
    expect(recipe.ok).toBe(false);
    if (recipe.ok) return;
    expect(recipe.reason).toBe("carriesItsOwnEdit");
    expect(recipe.slot).toBe(openSlot);
  });

  it("(c) a CARRIED kind with NO crop is re-said from the composed state, as before", () => {
    const result = carryingBranch(new Set());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks.map((ask) => ask.slot)).toEqual([openSlot, "hair"]);
  });

  it("CONTROL — a caller that says nothing about crops gets exactly today's behaviour", () => {
    /*
      The inertness half. `cropped` absent must be indistinguishable from an
      empty library, so the change cannot alter one render on any road that has
      not opted into it — and so the fallback is the words carrier rather than
      silence.
    */
    const result = carryingBranch();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks.map((ask) => ask.slot)).toEqual([openSlot, "hair"]);
  });

  it("CONTROL — the split keys on THIS STEP's delta and never on the crop alone", () => {
    /*
      The misaimed-guard class, which has cost this program twice. If the split
      keyed on "does a crop exist" alone, the arm above would still pass and an
      EDIT to a kind that already has a crop would silently stop being said —
      the customer types "make the cat ears black" and the recipe carries a
      photograph of the grey ones and asks for nothing.
    */
    const edited = repaintAsksFor({
      pronouns: her,
      delta: { open: { "cat-ears": { noun: "cat ears", words: "sleek black cat ears" } } },
      prose,
      restore: { state: { open: { "cat-ears": { noun: "cat ears", words: "sleek black cat ears" } } }, slots: [] },
      cropped: new Set([openSlot]),
    });

    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.asks).toEqual([{
      slot: openSlot, noun: "cat ears", words: "sleek black cat ears",
    }]);
  });
});

/**
 * A DISTRIBUTED KIND IS CARRIED BY TWO CROPS, AND THE ASK MUST SEE THEM — the
 * D1 wire's second half (fable-1001 §3).
 *
 * `cropped` is the set of slots the library can carry by crop this render, and
 * the carry/edit split above tests it against `open:<kind>`. A distributed kind
 * files per side — `open:wings@left` and `open:wings@right` — so the same set
 * arrives spelled differently, and a membership test written for the sideless
 * key answers NO on a kind that is fully crop-carried. The consequence is not a
 * missing crop but the opposite and worse: the kind is re-said, which makes it
 * an EDIT, and an edit's own crops are refused by the assembler (D-244 line 2).
 * **Both crops paid for to preserve her wings would be dropped by the sentence
 * written to preserve them** — the same shape as the sentence/carry defect the
 * carry split closed for the sideless case.
 *
 * Written RED against the wire.
 */
describe("a distributed open kind is carried by its two per-side crops", () => {
  const wings = { noun: "wings", words: "large black feathered wings" };
  const sides = new Set(["open:wings@left", "open:wings@right"]);

  it("(b) a CARRIED distributed kind whose two crops exist is not an ask at all", () => {
    const result = repaintAsksFor({
      pronouns: her,
      delta: { hairColour: "copper" },
      prose,
      restore: { state: { hairColour: "copper", open: { wings } }, slots: [] },
      cropped: sides,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    /* Only the hair. Her wings are the LIBRARY's to carry this render, in two
       pictures rather than one. */
    expect(result.asks.map((ask) => ask.slot)).toEqual(["hair"]);
  });

  it("(c) and ONE side alone is not a carry — the kind is still re-said", () => {
    /*
      The control that keeps the fix from reading "any side present means
      carried". A distributed kind whose library holds one wing is exactly the
      half-picture the counting gate exists to refuse; the words must still ride
      or she loses the other one.
    */
    const result = repaintAsksFor({
      pronouns: her,
      delta: { hairColour: "copper" },
      prose,
      restore: { state: { hairColour: "copper", open: { wings } }, slots: [] },
      cropped: new Set(["open:wings@left"]),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks.map((ask) => ask.slot)).toEqual(["open:wings", "hair"]);
  });
});
