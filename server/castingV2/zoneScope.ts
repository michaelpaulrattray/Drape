/**
 * ZONE SCOPE — how big an edit's zone is, decided by the FACET, not the delta.
 *
 * # The mistake this closes
 *
 * A fringe was built as strands painted onto a forehead patch. That is the
 * minimal-diff framing: the pixels that change are on the forehead, so scope the
 * zone there. It produced appliqué — sparse wisps on repainted skin — through
 * three rounds of gating that all chased the symptom.
 *
 * A fringe is a CUT CHANGE. A stylist selects the whole head of hair and changes
 * the cut; nobody paints strands onto a forehead. The founder's correction and
 * working law #7: **the user's ontology governs design.** Ask first how the user
 * would describe what changes — that description is the spec, and the zone
 * follows it.
 *
 * So the zone is not derived from where the pixels move. It is derived from
 * **what kind of thing is being changed**, and that is a finite question over a
 * finite vocabulary, which is why this file is a table rather than a heuristic.
 *
 * # Derived, never mirrored (law #4)
 *
 * The keys come from `allFacets()`. A facet added to the vocabulary without a
 * scope here fails `zoneScope.test.ts`, so this cannot quietly fall behind the
 * thing it describes.
 */
import { allFacets, type Facet } from "./refineFacets";

/**
 * The five ways an edit's territory is decided.
 *
 * `object` and `distributedFacet` are the two that get confused, and the fringe
 * is why: both change a small number of pixels, and only one of them is about a
 * small thing.
 */
export type ZoneScope =
  /**
   * ADDITIONS, scoped by the DESCRIBED OBJECT plus a destination allowance —
   * the silhouette law's positive form. The thing is not there yet, so nothing
   * can segment it; the instruction says what it is, and the allowance comes
   * from that description (a drop earring's length becomes a corridor below the
   * lobe). Boundary-contact auto-expand is the under-estimate catch.
   */
  | "object"
  /**
   * FACET EDITS whose region is genuinely local — the thing being changed
   * occupies one bounded place and stays there.
   */
  | "localFacet"
  /**
   * PATTERNS THROUGH A REGION, RENDERED WHOLE. The zone is the facet's FULL
   * region plus its destination allowance, and the instruction describes the
   * complete result rather than the difference.
   *
   * A fringe, layers, volume, a sweep, balayage, stubble, a freckle pattern —
   * every one of these is a property of a whole region that happens to show most
   * strongly in part of it. Scoping to where it shows is the fringe error.
   */
  | "distributedFacet"
  /**
   * BILATERAL PAIRS. Both sides are rendered and **cross-side sameness is
   * asserted**, because independently rendered corridors can mint mismatched
   * jewellery or odd eyes. One question about two regions — and the segmentation
   * is two questions, since a SAM-class model returns one instance per call.
   */
  | "bilateralPair"
  /**
   * THE FACET SPANS ALL VISIBLE SKIN. Scoping a tan or a skin tone to the face
   * manufactures a body mismatch, so these take the full-skin region or route
   * full-frame.
   */
  | "allSkin"
  /**
   * NOT A REGION EDIT AT ALL — routed to the anchored full-frame path.
   *
   * A smile moves cheeks, eyes, jaw, brow and mouth at once; there is no zone
   * that contains it, and any zone drawn for it would be a lie about what
   * changes. Founder ruling: **remove it from the region world entirely.** Its
   * home is the base-anchored full-frame path with identity anchored and the
   * verification net doing the checking — which is where "a warm open smile"
   * already worked in practice.
   */
  | "fullFrame";

/**
 * Facets whose scope the INSTRUCTION can override, and why that is not a defect
 * in the model.
 *
 * *"A scar on her cheek"* is an object; *"freckles across her nose and cheeks"*
 * is a pattern through a region. Same facet, two scopes, and the difference is
 * in what was asked rather than in which slot it landed. The table records the
 * DEFAULT and names the override so a caller cannot silently pick one.
 *
 * This is a genuine finding of the audit: **scope is a property of the facet AND
 * the instruction**, and a table keyed only by facet would have been wrong for
 * these two.
 */
export const INSTRUCTION_MAY_OVERRIDE: Partial<Record<Facet, { to: ZoneScope; when: string }>> = {
  marks: { to: "object", when: "a single named mark — a scar, one birthmark — rather than a pattern" },
  ink: { to: "distributedFacet", when: "a sleeve or a piece spanning a whole limb rather than one placement" },
};

/**
 * Facets whose class is NOT obvious from the pixels, returned as questions
 * rather than guesses — the audit's own instruction.
 */
export const OPEN_QUESTIONS: Partial<Record<Facet, string>> = {
  /* All three ruled by the founder, 2026-08-06. Kept as an empty map rather than
     deleted: the audit's discipline is that an ambiguous facet comes back as a
     question, and the next one added has somewhere to go. */
};

/**
 * THE TABLE. Every facet in the vocabulary, with the scope its zone follows.
 *
 * Entries carry a note where the reason is not self-evident, because the whole
 * point of the fringe post-mortem is that the obvious-looking scope was wrong.
 */
export const ZONE_SCOPE: Record<Facet, ZoneScope> = {
  /* ---- distributed: patterns through a region, rendered whole ---- */
  "hair.cut": "distributedFacet",
  "hair.colour": "distributedFacet",
  "hair.texture": "distributedFacet",
  hairFinish: "distributedFacet",
  hairWorn: "distributedFacet",
  facialHair: "distributedFacet",
  marks: "distributedFacet",

  /* ---- bilateral pairs: two regions, one question, sameness asserted ---- */
  "eye.colour": "bilateralPair",
  "eye.shape": "bilateralPair",
  brows: "bilateralPair",
  lashes: "bilateralPair",
  ears: "bilateralPair",
  cheekbones: "bilateralPair",

  /* ---- genuinely local ---- */
  nose: "localFacet",
  lips: "localFacet",
  teeth: "localFacet",
  chin: "localFacet",
  /* FOUNDER RULING: a single local contour. The jawline is one connected
     symmetric feature, so it is one region — a genuinely one-sided jaw ask is
     re-ask territory, not a scope class. */
  jaw: "localFacet",
  /* FOUNDER RULING: several LOCAL facets asked together, never one face-wide
     one. A face-wide makeup render would repaint her whole face to change a lip.
     "A smoky eye and a nude lip" is two renders, composed by the existing
     multi-patch machinery — and that is correct, because they are then
     independently retryable. Cross-region coherence (left blush matching right)
     rides the sameness reader as advisory. */
  makeup: "localFacet",

  /* ---- additions, scoped by what the instruction says the thing is ---- */
  statedAccessories: "object",
  ink: "object",

  /* ---- the facet spans all visible skin ---- */
  skinTone: "allSkin",
  skinCharacter: "allSkin",

  /* ---- not a zone at all ---- */
  expression: "fullFrame",
};

export function zoneScopeOf(facet: Facet): ZoneScope {
  const scope = ZONE_SCOPE[facet];
  if (!scope) {
    /* Loud rather than defaulted. A facet with no scope would silently take
       whatever the last caller assumed, which is the fringe error with a
       different name. */
    throw new Error(`facet "${facet}" has no zone scope — add it to ZONE_SCOPE`);
  }
  return scope;
}

/** Facets whose zone must cover their whole region, not the part that shows. */
export function isDistributed(facet: Facet): boolean {
  return zoneScopeOf(facet) === "distributedFacet";
}

/** Facets rendered on both sides, with cross-side sameness asserted. */
export function isBilateral(facet: Facet): boolean {
  return zoneScopeOf(facet) === "bilateralPair";
}

/**
 * Does this facet have a region at all?
 *
 * `false` means the masked path is the wrong path — do not build a zone, route
 * to the anchored full-frame arm. Asking a zone builder for a smile's mask is
 * the fringe error at maximum scale.
 */
export function hasRegion(facet: Facet): boolean {
  return zoneScopeOf(facet) !== "fullFrame";
}

/** Every facet the vocabulary can produce, for the completeness test. */
export function scopedFacets(): Facet[] {
  return allFacets();
}
