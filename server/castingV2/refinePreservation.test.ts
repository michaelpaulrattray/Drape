import { describe, expect, it } from "vitest";

import { composePreservation, unprotectedFacets } from "./refinePreservation";
import { facetsWrittenBy } from "./refineDelta";
import { allFacets } from "./refineFacets";

const of = (delta: Parameters<typeof facetsWrittenBy>[0]) => composePreservation(facetsWrittenBy(delta));

/**
 * THE TAIL IS SUBTRACTION, NOT BOILERPLATE (D-166).
 *
 * It was static, so a prompt that said "Change the hair: coloured pastel pink"
 * also said "the same hair" — and the model sided with the tail. Measured on
 * production before this existed: 19 of the 25 most recent variants protected
 * the hair while the edits changed it.
 */
describe("the preservation clause names everything except what changes", () => {
  it("drops the whole category when the whole category is being edited", () => {
    const { clause } = of({ free: { expression: "a slight smile" } });
    expect(clause).not.toContain("the same expression");
    /* And everything else still holds. */
    expect(clause).toContain("the same hair");
    expect(clause).toContain("the same skin");
  });

  /*
    THE FOUNDER'S OWN EXAMPLE: a hair-COLOUR edit yields "the same haircut" and
    never "the same hair". The category breaks up rather than vanishing, or the
    untouched half is abandoned along with the half that changed.
  */
  it("breaks a category up and names the survivors", () => {
    const { clause } = of({ hairColour: "copper" });
    expect(clause).not.toContain("the same hair colour");
    /* The BARE category clause must be gone — "the same hair" as its own list
       item, which is the phrase that argued with the instruction. Written as a
       lookahead for a list boundary, because "the same hair texture" legitimately
       contains "the same hair" and an over-eager assertion here would fail on the
       very sibling the ruling asks for. */
    expect(clause).not.toMatch(/the same hair(?=[,.]| and )/);
    expect(clause).toContain("the same haircut");
    expect(clause).toContain("the same hair texture");
    expect(clause).toContain("the hair worn the same way");
  });

  it("does the same across the lane boundary", () => {
    /* A FREE hair shade supersedes the guaranteed one (D-159), so it must
       subtract the identical facet — the tail follows the facet, not the key. */
    const { clause } = of({ free: { hairShade: "pastel pink" } });
    expect(clause).not.toContain("the same hair colour");
    expect(clause).toContain("the same haircut");
  });

  it("protects the whole picture when nothing about it is edited", () => {
    const { clause } = of({ free: { statedAccessories: "small gold hoops" } });
    for (const whole of ["the same hair", "the same eyes", "the same skin", "the same mouth"]) {
      expect(clause, whole).toContain(whole);
    }
  });

  /* The shoot is never a facet, so it is never subtracted. */
  it("always holds the person and the shoot", () => {
    for (const delta of [{ hairColour: "copper" as const }, { free: { expression: "a smile" } }]) {
      const { clause } = of(delta);
      for (const always of ["the same person", "the same clothing", "the same lighting",
        "the same framing", "the same background"]) {
        expect(clause, always).toContain(always);
      }
    }
  });

  /*
    ACCESSORIES ARE PIXEL-CONDITIONAL (D-166 as amended), AND THE EXAMPLES CAME
    OUT (D-183).

    It cannot name "her glasses" — brief-stated accessories never reach the
    candidate's resolved identity, and the licence is failure-to-appear, so
    naming them against a face that has none would invite the model to ADD them.

    The first version of this test asserted the clause CONTAINED "glasses",
    which is the same mistake one level down: on the founder's bare-eared
    candidate, "remove earrings" produced a prompt whose only mention of
    earrings was this clause's example list, and the render came back wearing a
    hoop and a stud that were never in the base. Naming a category invites it.
  */
  it("protects worn things by pointing at the reference, never by naming any", () => {
    const { clause } = of({ eyeColour: "green" });
    expect(clause).toContain("anything worn in the reference photograph");
    /* Not one example. A removal's prompt must not contain the word for the
       thing being removed anywhere except where it is being removed. */
    expect(clause).not.toMatch(/glasses|earrings|studs|a chain/);
  });

  /*
    TOTALITY. A facet no category covers is a facet the model is free to redraw,
    and it would be invisible — the tail would simply never mention it.
  */
  it("covers every facet either lane can produce", () => {
    expect(unprotectedFacets()).toEqual([]);
    expect(allFacets().length).toBeGreaterThan(20);
  });

  it("reads as a sentence rather than as a list of fragments", () => {
    const { clause } = of({ hairColour: "copper" });
    expect(clause).toMatch(/^Everything else must be identical to the reference: /);
    expect(clause).toContain(" and ");
    expect(clause).toContain("not a new photograph of a similar person");
  });
});

/**
 * SUBTRACT THE COMPOSED DELTA, NEVER ONE STEP.
 *
 * If the tail subtracted only the step being added, a facet edited three
 * refinements ago would be protected as "identical to the reference" — and the
 * reference is the sharp ORIGINAL. That is revert-to-the-original pressure on
 * every earlier edit, once per render: the mullet-shortening disease rebuilt
 * inside the machinery meant to cure it.
 */
describe("what the tail is subtracted from", () => {
  it("leaves an earlier edit unprotected once it is in the composed delta", () => {
    const composed = { hairStyle: "a mullet", eyeColour: "green" as const };
    const { clause, protectedFacets } = of(composed);
    expect(clause).not.toContain("the same haircut");
    expect(clause).not.toContain("the same eye colour");
    expect(protectedFacets).not.toContain("hair.cut");
    expect(protectedFacets).not.toContain("eye.colour");
    /* The untouched siblings still hold. */
    expect(clause).toContain("the same hair colour");
    expect(clause).toContain("the same eye shape");
  });
});
