import { describe, expect, it } from "vitest";

import { allFacets } from "./refineFacets";
import {
  INSTRUCTION_MAY_OVERRIDE,
  OPEN_QUESTIONS,
  ZONE_SCOPE,
  isBilateral,
  isDistributed,
  zoneScopeOf,
} from "./zoneScope";

/**
 * The zone-scope audit, proved total over the facet vocabulary.
 *
 * The fringe was scoped by its delta rather than its facet and produced appliqué
 * through three rounds of gating. The point of a table is that the next facet
 * cannot repeat it silently — so the test that matters is completeness, and it
 * derives its domain from the vocabulary rather than restating it (law #4).
 */

describe("every facet has a zone scope — derived from the vocabulary, never mirrored", () => {
  it("covers the whole vocabulary", () => {
    const missing = allFacets().filter((facet) => !(facet in ZONE_SCOPE));
    expect(missing, "a facet with no scope takes whatever the last caller assumed").toEqual([]);
  });

  it("carries no scope for a facet the vocabulary does not have", () => {
    /* The other direction: a stale entry is a mirror that has drifted. */
    const vocabulary = new Set(allFacets());
    const stale = Object.keys(ZONE_SCOPE).filter((facet) => !vocabulary.has(facet));
    expect(stale, "an entry for a facet that no longer exists is drift").toEqual([]);
  });

  it("refuses loudly for an unknown facet rather than defaulting", () => {
    expect(() => zoneScopeOf("hair.somethingNobodyAdded")).toThrow(/no zone scope/);
  });
});

describe("the classes the fringe post-mortem produced", () => {
  it("scopes a cut change to the whole hair, not to where the pixels move", () => {
    /* The founding member. A fringe changes forehead pixels and is not a
       forehead edit. */
    expect(zoneScopeOf("hair.cut")).toBe("distributedFacet");
    expect(isDistributed("hair.cut")).toBe(true);
  });

  it("puts every hair facet in the same class, because they are all the same region", () => {
    for (const facet of ["hair.cut", "hair.colour", "hair.texture", "hairFinish", "hairWorn"]) {
      expect(zoneScopeOf(facet), `${facet} is a pattern through the whole hair`).toBe("distributedFacet");
    }
  });

  it("keeps additions on the object class, where the destination comes from the description", () => {
    expect(zoneScopeOf("statedAccessories")).toBe("object");
  });

  it("marks bilateral facets so cross-side sameness gets asserted", () => {
    for (const facet of ["eye.colour", "eye.shape", "brows", "lashes", "ears"]) {
      expect(isBilateral(facet), `${facet} is two regions and one question`).toBe(true);
    }
  });

  it("sends skin-spanning facets to the full skin rather than the face", () => {
    /* Scoping a tan to the face manufactures a body mismatch. */
    expect(zoneScopeOf("skinTone")).toBe("allSkin");
    expect(zoneScopeOf("skinCharacter")).toBe("allSkin");
  });
});

describe("what the audit could not answer, kept as questions rather than guesses", () => {
  it("names the facets whose class is genuinely ambiguous", () => {
    /* The audit's own instruction: an ambiguous facet comes back as a question.
       This pins the list so an answer has to REMOVE an entry deliberately. */
    expect(Object.keys(OPEN_QUESTIONS).sort()).toEqual(["expression", "jaw", "makeup"]);
  });

  it("every open question is about a facet that exists and still has a working default", () => {
    for (const facet of Object.keys(OPEN_QUESTIONS)) {
      expect(allFacets(), `${facet} must be a real facet`).toContain(facet);
      expect(() => zoneScopeOf(facet), "an unanswered question still needs a scope to run on").not.toThrow();
    }
  });

  it("records the two facets whose scope the INSTRUCTION decides, not the slot", () => {
    /* A scar is an object; freckles are a pattern. Same facet, two scopes — a
       table keyed only by facet would have been wrong for these. */
    expect(Object.keys(INSTRUCTION_MAY_OVERRIDE).sort()).toEqual(["ink", "marks"]);
    expect(INSTRUCTION_MAY_OVERRIDE.marks?.to).toBe("object");
    expect(zoneScopeOf("marks"), "the default is the pattern reading").toBe("distributedFacet");
    expect(INSTRUCTION_MAY_OVERRIDE.ink?.to).toBe("distributedFacet");
    expect(zoneScopeOf("ink"), "the default is the placement reading").toBe("object");
  });
});
