/**
 * ONE CARD PER FACET (V1 step 2, the other half of the subject card).
 *
 * A SUBJECT is what a person can ask to change; a FACET is what the system
 * supersedes on. They are nearly the same set and deliberately not identical:
 * five free subjects share a facet with a guaranteed axis (`hairCut` and
 * `hairStyle` are both `hair.cut`), which is the whole reason `refineFacets`
 * exists — two answers to one question must be unrepresentable rather than
 * merely detectable. So there are 28 subjects and 29 facets, and the four
 * facet-keyed tables live here rather than on the subject's card.
 *
 * # What a card answers
 *
 * `zone` — the scope its edit follows (ZONE_SCOPE).
 * `slot` — where the library files it, or the written reason it files nowhere
 *          (FACET_SLOTS).
 * `region` — the segmentation question it asks, or **null** (REGION_OF_FACET).
 * `movesItsEdge` — whether it may claim a reveal, with its reason
 *          (MOVES_ITS_EDGE).
 *
 * # `region: null` is the one that matters
 *
 * Eight facets have no masked path, and before this they said so by being
 * absent from a `Partial<Record<…>>` — the fourth silent decider (F2). Written
 * as `null` it is a decision anyone can read, and the pin holds all eight to it.
 * The rule behind it is D-213's: **a segmenter is never asked an open
 * question**, so a facet with no region has no masked path rather than a prompt
 * invented for it.
 *
 * # And the two that disagree, kept apart on purpose
 *
 * `movesItsEdge` is not `CHANGE_AMPLITUDE`'s SURFACE band wearing another name.
 * The amplitude record is instrument-only — it tells a band table what
 * threshold to count at — and reusing it here would promote a measurement
 * constant onto the paid render path. They genuinely disagree: `hair.colour` is
 * REPLACEMENT amplitude (every strand pixel moves) and moves no edge at all.
 */
import type { FacetAssignment } from "./referenceSlotCatalogue";
import type { Facet } from "./refineFacets";
import type { ZoneScope } from "./zoneScope";

export type FacetCard = {
  /** The scope this facet's edit follows. */
  readonly zone: ZoneScope;
  /** Where the library files it, or the written reason it files nowhere. */
  readonly slot: FacetAssignment;
  /**
   * The segmentation question it asks — words that are SENT to a model.
   * `null` means no masked path, which is a decision rather than an omission.
   */
  readonly region: string | null;
  /** Whether it can move its region's edge, and therefore claim a reveal. */
  readonly movesItsEdge: { readonly moves: boolean; readonly why: string };
};

export const FACET_CARDS = {
  "hair.cut": {
    zone: "distributedFacet",
    slot: { feature: "hair" },
    region: "hair",
    movesItsEdge: { moves: true, why: "a cut is a new silhouette" },
  },
  "hair.colour": {
    zone: "distributedFacet",
    slot: { feature: "hair" },
    region: "hair",
    movesItsEdge: { moves: false, why: "a recoloured ponytail is the same ponytail" },
  },
  "hair.texture": {
    zone: "distributedFacet",
    slot: { feature: "hair" },
    region: "hair",
    movesItsEdge: { moves: true, why: "curl pattern changes how far the mass stands out" },
  },
  hairFinish: {
    zone: "distributedFacet",
    slot: { feature: "hair" },
    region: "hair",
    movesItsEdge: { moves: false, why: "shine changes how light sits, not where the hair is" },
  },
  hairWorn: {
    zone: "distributedFacet",
    slot: { feature: "hair" },
    region: "hair",
    movesItsEdge: { moves: true, why: "up, down, tied back — the shrink this machinery was built for" },
  },
  facialHair: {
    zone: "distributedFacet",
    slot: { feature: "facial-hair" },
    region: "facial hair",
    movesItsEdge: { moves: true, why: "shaving removes it entirely" },
  },
  marks: {
    zone: "distributedFacet",
    slot: { feature: "skin" },
    region: "face skin",
    movesItsEdge: { moves: false, why: "freckles do not remove skin — the right phantom's own facet" },
  },
  "eye.colour": {
    zone: "bilateralPair",
    slot: { feature: "eye" },
    region: "eyes",
    movesItsEdge: { moves: false, why: "the iris does not change shape" },
  },
  "eye.shape": {
    zone: "bilateralPair",
    slot: { feature: "eye" },
    region: "eyes",
    movesItsEdge: { moves: true, why: "a corner lift moves the lid boundary" },
  },
  brows: {
    zone: "bilateralPair",
    slot: { feature: "brow" },
    region: "eyebrows",
    movesItsEdge: { moves: true, why: "a shape change moves the brow's edge" },
  },
  lashes: {
    zone: "bilateralPair",
    slot: { feature: "lashes" },
    region: "eyes",
    movesItsEdge: { moves: true, why: "lashes extend and retract past the lid" },
  },
  ears: {
    zone: "bilateralPair",
    slot: { feature: "ear" },
    region: "ear",
    movesItsEdge: { moves: true, why: "an ear is exposed or covered" },
  },
  cheekbones: {
    zone: "bilateralPair",
    slot: { feature: "cheekbone" },
    region: "face skin",
    movesItsEdge: { moves: false, why: "bone structure reads as shading over a wide area" },
  },
  nose: {
    zone: "localFacet",
    slot: { feature: "nose" },
    region: "nose",
    movesItsEdge: { moves: true, why: "a contour edit moves the edge" },
  },
  lips: {
    zone: "localFacet",
    slot: { feature: "lips" },
    region: "lips",
    movesItsEdge: { moves: true, why: "fuller lips move the vermilion border" },
  },
  teeth: {
    zone: "localFacet",
    slot: { feature: "teeth" },
    region: "lips",
    movesItsEdge: { moves: false, why: "behind the lips; the lips' own edge is unmoved" },
  },
  chin: {
    zone: "localFacet",
    slot: { feature: "chin" },
    region: "face skin",
    movesItsEdge: { moves: true, why: "as the jaw, over a smaller arc" },
  },
  jaw: {
    zone: "localFacet",
    slot: { feature: "jaw" },
    region: "face skin",
    movesItsEdge: { moves: true, why: "a contour against the background" },
  },
  makeup: {
    zone: "localFacet",
    slot: {
      notASlot:
        "makeup is worn STATE on the anatomy slots it is worn on (fable-168), and a surface worn on anatomy is one anatomy slot whose stack holds the surface words (fable-201) — a smoky eye rides eye@left and eye@right, a nude lip rides lips",
    },
    region: "face skin",
    movesItsEdge: { moves: false, why: "makeup sits on the surface it is painted on" },
  },
  statedAccessories: {
    zone: "object",
    slot: { family: "accessories" },
    region: null,
    movesItsEdge: { moves: true, why: "an object arrives or departs" },
  },
  ink: {
    zone: "object",
    slot: {
      notASlot:
        "OWED, not absent: ink is per placement and its question comes from the placement rather than from a region table, so its slots arrive with the tattoo studio and the flash-sheet path (D-138, roadmap §3). Inventing a `tattoo` question here would ask a segmenter an open question (D-213)",
    },
    region: null,
    movesItsEdge: { moves: false, why: "a design is drawn on skin; the skin stays where it is" },
  },
  skinTone: {
    zone: "allSkin",
    slot: { feature: "skin" },
    region: "face skin",
    movesItsEdge: { moves: false, why: "a tan is her own surface, a few levels different" },
  },
  skinCharacter: {
    zone: "allSkin",
    slot: { feature: "skin" },
    region: "face skin",
    movesItsEdge: { moves: false, why: "texture is the freckle case by another name" },
  },
  expression: {
    zone: "fullFrame",
    slot: {
      notASlot:
        "presentation, not identity (D-136) — a follow must never inherit a smile — and there is no zone that contains it (zoneScope `fullFrame`), so there is nothing to cut and nothing to carry",
    },
    region: null,
    movesItsEdge: { moves: true, why: "features move; it routes full-frame and never reaches here" },
  },
  bust: {
    zone: "fullFrame",
    slot: { feature: "build" },
    region: null,
    movesItsEdge: { moves: true, why: "the chest's outline under the garment moves" },
  },
  waist: {
    zone: "fullFrame",
    slot: { feature: "build" },
    region: null,
    movesItsEdge: { moves: true, why: "two side contours move" },
  },
  shoulders: {
    zone: "fullFrame",
    slot: { feature: "build" },
    region: null,
    movesItsEdge: { moves: true, why: "the shoulder line against the backdrop moves" },
  },
  arms: {
    zone: "fullFrame",
    slot: { feature: "build" },
    region: null,
    movesItsEdge: { moves: true, why: "an arm's own edge against the backdrop moves" },
  },
  build: {
    zone: "fullFrame",
    slot: { feature: "build" },
    region: null,
    movesItsEdge: { moves: true, why: "the whole figure's outline moves" },
  },
} as const satisfies Record<string, FacetCard>;

export const FACET_KEYS = Object.keys(FACET_CARDS) as Facet[];

export const FACET_CARD_ENTRIES = Object.entries(FACET_CARDS) as ReadonlyArray<
  readonly [Facet, FacetCard]
>;

/** One field of every card, as the table it used to be typed out as. */
export function facetTableOf<T>(read: (card: FacetCard) => T): Record<Facet, T> {
  return Object.fromEntries(
    FACET_CARD_ENTRIES.map(([facet, card]) => [facet, read(card)]),
  ) as Record<Facet, T>;
}
