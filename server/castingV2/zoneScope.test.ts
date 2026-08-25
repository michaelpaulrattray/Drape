import { describe, expect, it } from "vitest";

import { allFacets } from "./refineFacets";
import {
  INSTRUCTION_MAY_OVERRIDE,
  OPEN_QUESTIONS,
  ZONE_SCOPE,
  hasRegion,
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

describe("the three the audit sent back, now ruled", () => {
  it("has no open questions left", () => {
    /* Pinned so a new ambiguity has to be added deliberately rather than
       accumulating quietly. */
    expect(Object.keys(OPEN_QUESTIONS)).toEqual([]);
  });

  it("makeup composes from LOCAL facets — a lip edit never repaints her face", () => {
    /* "A smoky eye and a nude lip" is two renders, and that is the point: they
       are independently retryable. */
    expect(zoneScopeOf("makeup")).toBe("localFacet");
  });

  it("expression has no region at all and routes full-frame", () => {
    /* A smile moves cheeks, eyes, jaw and brow at once. Any zone drawn for it
       would be a lie about what changes. */
    expect(zoneScopeOf("expression")).toBe("fullFrame");
    expect(hasRegion("expression"), "the masked path is the wrong path for it").toBe(false);
  });

  it("every other facet DOES have a region — the control", () => {
    /*
      Without this, `hasRegion` could be false everywhere and the assertion
      above would still pass.

      THE BODY FACETS JOIN EXPRESSION, and the reason is the same shape rather
      than a second exception: there is no question that names a build. A torso
      mask wearing a waist's name is the wrong-boundary class, so the body row
      carries WORDS and routes full-frame (fable-381 §A.4: "there is no version
      of that which is not two masters"). If open-vocabulary regions ever make a
      torso cut honest, this list shortens and the change is deliberate.
    */
    /*
      `wardrobe` joins them 2026-08-23 (item 8) for a THIRD reason worth keeping
      apart from the other two: a garment IS segmentable — `decolletage`
      outlined a sports bra precisely on the day this landed — but no MEASURED
      word for *her outfit* exists in this product's vocabulary, and a word
      invented here is exactly the class that court photographed. It carries the
      stored LINE instead, which travels into the five signed views where a crop
      of this frame's fabric would be a picture of the wrong angle.
    */
    const regionless = allFacets().filter((facet) => !hasRegion(facet));
    expect(regionless).toEqual([
      "bust", "waist", "shoulders", "arms", "build", "expression", "wardrobe",
    ]);
  });

  it("jaw is one local contour, not a bilateral pair", () => {
    expect(zoneScopeOf("jaw")).toBe("localFacet");
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
