/**
 * ONE CARD PER FACET (V1 step 2, the other half of the subject card).
 *
 * A SUBJECT is what a person can ask to change; a FACET is what the system
 * supersedes on. They are nearly the same set and deliberately not identical:
 * five free subjects share a facet with a guaranteed axis (`hairCut` and
 * `hairStyle` are both `hair.cut`), which is the whole reason `refineFacets`
 * exists — two answers to one question must be unrepresentable rather than
 * merely detectable. So there are 28 subjects and 29 facets, and the
 * facet-keyed tables live here rather than on the subject's card.
 *
 * # What a card answers
 *
 * `zone` — the scope its edit follows (ZONE_SCOPE).
 * `slot` — where the library files it, or the written reason it files nowhere
 *          (FACET_SLOTS).
 * `region` — the segmentation question it asks, or **null** (REGION_OF_FACET).
 *
 * A fourth answer — whether an edit may claim a reveal — was the masked-edit
 * harvest's alone, and was deleted with it (#2859).
 *
 * # `region: null` is the one that matters
 *
 * Eight facets have no masked path, and before this they said so by being
 * absent from a `Partial<Record<…>>` — the fourth silent decider (F2). Written
 * as `null` it is a decision anyone can read, and the pin holds all eight to it.
 * The rule behind it is D-213's: **a segmenter is never asked an open
 * question**, so a facet with no region has no masked path rather than a prompt
 * invented for it.
 */
import type { FacetAssignment } from "./referenceSlotCatalogue";
import type { Facet } from "./refineFacets";
import type { ZoneScope } from "./zoneScope";

/**
 * WHICH SIDE OF THE BORN/WORN LINE A ROW SITS ON — the words the panel says
 * about it. `null` for a facet that can never BE a row (no region, nothing to
 * keep), which is `expression`'s case and is a decision rather than an omission.
 */
type FacetNaming = { shape: "hers" | "worn" | "hairArrangement" } | null;

/**
 * HOW THE PRESERVATION TAIL NAMES IT, and which category it is protected under.
 *
 * Every facet belongs to exactly one category — a facet nobody protects is a
 * facet the model is free to redraw — and the category's own phrase ("the same
 * mouth") belongs to the category rather than to any one member, so it lives in
 * `PRESERVATION_CATEGORIES` beside them.
 */
type FacetPreservation = { category: string; phrase: string };

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
  /** What the panel calls a segment of it, or null when it can never be a row. */
  readonly naming: FacetNaming;
  /** How the preservation tail names it, under which category. */
  readonly preservation: FacetPreservation;
};

/**
 * THE CATEGORIES THE PRESERVATION TAIL SPEAKS IN.
 *
 * One phrase for the whole, so an edit inside a category can say "everything
 * else about her hair" without listing five siblings. The members are on the
 * cards; only the whole-phrase lives here, because it is a fact about the
 * category and not about any facet in it.
 */
export const PRESERVATION_CATEGORIES: Readonly<Record<string, string>> = {
  hair: "the same hair",
  eyes: "the same eyes",
  boneStructure: "the same bone structure",
  mouth: "the same mouth",
  skin: "the same skin",
  build: "the same build",
  makeup: "the same makeup",
  facialHair: "the same facial hair",
  expression: "the same expression",
  /*
    POINTING AT THE PHOTOGRAPH, AND NAMING NOTHING (D-166 amended, D-183).

    It cannot name the record's stated accessories honestly — they live on the
    roll's intent, never reach the candidate's resolved identity, and the
    licence is failure-to-appear, so naming glasses against a bare face would
    invite the model to ADD them. And the examples came out for the same reason
    they went in: the clause used to read "glasses, earrings, studs, a chain",
    and on a bare-eared candidate "remove earrings" produced a prompt whose ONLY
    mention of earrings was that list — the render came back wearing a hoop and
    a stud that were never in the base. Naming a category invites it.
  */
  accessories: "anything worn in the reference photograph still worn and unchanged, and nothing worn that is not in it",
};

export const FACET_CARDS = {
  "hair.cut": {
    zone: "distributedFacet",
    slot: { feature: "hair" },
    region: "hair",
    naming: { shape: "hers" },
    preservation: { category: "hair", phrase: "the same haircut" },
  },
  "hair.colour": {
    zone: "distributedFacet",
    slot: { feature: "hair" },
    region: "hair",
    naming: { shape: "hers" },
    preservation: { category: "hair", phrase: "the same hair colour" },
  },
  "hair.texture": {
    zone: "distributedFacet",
    slot: { feature: "hair" },
    region: "hair",
    naming: { shape: "hers" },
    preservation: { category: "hair", phrase: "the same hair texture" },
  },
  hairFinish: {
    zone: "distributedFacet",
    slot: { feature: "hair" },
    region: "hair",
    naming: { shape: "hers" },
    preservation: { category: "hair", phrase: "the same hair finish" },
  },
  hairWorn: {
    zone: "distributedFacet",
    slot: { feature: "hair" },
    region: "hair",
    naming: { shape: "hairArrangement" },
    preservation: { category: "hair", phrase: "the hair worn the same way" },
  },
  facialHair: {
    zone: "distributedFacet",
    slot: { feature: "facial-hair" },
    region: "facial hair",
    naming: { shape: "hers" },
    preservation: { category: "facialHair", phrase: "the same facial hair" },
  },
  marks: {
    zone: "distributedFacet",
    slot: { feature: "skin" },
    region: "face skin",
    naming: { shape: "hers" },
    preservation: { category: "skin", phrase: "the same freckles, moles and marks" },
  },
  "eye.colour": {
    zone: "bilateralPair",
    slot: { feature: "eye" },
    region: "eyes",
    naming: { shape: "hers" },
    preservation: { category: "eyes", phrase: "the same eye colour" },
  },
  "eye.shape": {
    zone: "bilateralPair",
    slot: { feature: "eye" },
    region: "eyes",
    naming: { shape: "hers" },
    preservation: { category: "eyes", phrase: "the same eye shape" },
  },
  brows: {
    zone: "bilateralPair",
    slot: { feature: "brow" },
    region: "eyebrows",
    naming: { shape: "hers" },
    preservation: { category: "eyes", phrase: "the same brows" },
  },
  lashes: {
    zone: "bilateralPair",
    slot: { feature: "lashes" },
    region: "eyes",
    naming: { shape: "hers" },
    preservation: { category: "eyes", phrase: "the same lashes" },
  },
  ears: {
    zone: "bilateralPair",
    slot: { feature: "ear" },
    region: "ear",
    naming: { shape: "hers" },
    preservation: { category: "boneStructure", phrase: "the same ears" },
  },
  cheekbones: {
    zone: "bilateralPair",
    slot: { feature: "cheekbone" },
    region: "face skin",
    naming: { shape: "hers" },
    preservation: { category: "boneStructure", phrase: "the same cheekbones" },
  },
  nose: {
    zone: "localFacet",
    slot: { feature: "nose" },
    region: "nose",
    naming: { shape: "hers" },
    preservation: { category: "boneStructure", phrase: "the same nose" },
  },
  lips: {
    zone: "localFacet",
    slot: { feature: "lips" },
    region: "lips",
    naming: { shape: "hers" },
    preservation: { category: "mouth", phrase: "the same lips" },
  },
  teeth: {
    zone: "localFacet",
    slot: { feature: "teeth" },
    region: "lips",
    naming: { shape: "hers" },
    preservation: { category: "mouth", phrase: "the same teeth" },
  },
  chin: {
    zone: "localFacet",
    slot: { feature: "chin" },
    region: "face skin",
    naming: { shape: "hers" },
    preservation: { category: "boneStructure", phrase: "the same chin" },
  },
  jaw: {
    zone: "localFacet",
    slot: { feature: "jaw" },
    region: "face skin",
    naming: { shape: "hers" },
    preservation: { category: "boneStructure", phrase: "the same jawline" },
  },
  makeup: {
    zone: "localFacet",
    slot: {
      notASlot:
        "makeup is worn STATE on the anatomy slots it is worn on (fable-168), and a surface worn on anatomy is one anatomy slot whose stack holds the surface words (fable-201) — a smoky eye rides eye@left and eye@right, a nude lip rides lips",
    },
    region: "face skin",
    naming: { shape: "worn" },
    preservation: { category: "makeup", phrase: "the same makeup" },
  },
  statedAccessories: {
    zone: "object",
    slot: { family: "accessories" },
    region: null,
    naming: { shape: "worn" },
    preservation: {
      category: "accessories",
      phrase: "anything else worn in the reference unchanged",
    },
  },
  /**
   * HORNS — promoted off the four courts (fable-525 §3), words-only until the
   * founder ruled otherwise, and now CUT LIKE ANY OTHER FEATURE.
   *
   * # What the courts measured, and the axis they never asked about
   *
   * The survival court ran both arms on the same face, the same chained edit and
   * the same bar: words held 3/3 and a real cut of her own horns (93×235,
   * 121×244, 112×259 px, at the wire) held 3/3 too. Neither beat the other, so
   * the status quo kept the slot and this card said so.
   *
   * Both arms were scored on PRESENCE (horns still there) and IDENTITY (still
   * her). **Neither was asked whether they are the same horns** — curve, extent,
   * placement — and that is the unowned-axis-collapse class: an axis nobody pins
   * re-rolls every render, and a court that cannot see it crowns the cheaper
   * arm.
   *
   * # The founder's ruling, and it is general
   *
   * *"Horns should be carried by reference as well — it's a feature, otherwise
   * they would change on every refinement"*, then: *"it's not just horns that
   * carry, this was just an example of anything in the future."* So crop-carry
   * is the default for every promoted feature kind, and words-carry is never a
   * feature's ship. It agrees with this record's own law — a crop holds what it
   * DEPICTS; the words on a reference are a label the engine does not honour.
   *
   * # And `region` STAYS NULL, because this table answers about the MASTER
   *
   * A facet's region is the question asked of the picture she has NOW, and
   * horns are an addition: segmenting the master for them asks where a thing is
   * that she does not have (an `object`-scope facet, which `maskedRefine.test.ts`
   * pins to a null region). The word was never in doubt — the detection
   * court read 0.0000% on three visibly bare frames against 0.39–0.87% on
   * twelve worn ones, two faces — but it is answered on the DELIVERED frame,
   * which is a different picture and a different question.
   *
   * So the cutting region lives on the slot catalogue as a `deliveredRegion`,
   * where the mint asks it of the frame that just delivered the horns, and this
   * table keeps saying the true thing about the master. The first crops will be
   * refused `noSpecimen` and KEPT — that refusal is the road that produces the
   * specimen this kind has never bought (`referenceCompleteness.ts`): cut,
   * keep, measure, then calibrate.
   */
  horns: {
    zone: "object",
    slot: { feature: "horns" },
    region: null,
    naming: { shape: "hers" },
    preservation: { category: "hair", phrase: "the same horns" },
  },
  ink: {
    zone: "object",
    /*
      OWED UNTIL 2026-08-20, AND NOW ARRIVED.

      This read `notASlot` with a reason that turned out to be the whole
      specification — one slot per placement, its question from the placement
      rather than from a region table, and no invented `tattoo` question for a
      segmenter (D-213). The reason is not deleted: it lives on
      `FacetAssignment`'s `perPlacement` branch, verbatim and load-bearing,
      where the next person deciding what this facet's slot is will read it.
    */
    slot: { perPlacement: "ink" },
    region: null,
    naming: { shape: "worn" },
    preservation: { category: "skin", phrase: "the same tattoos" },
  },
  skinTone: {
    zone: "allSkin",
    slot: { feature: "skin" },
    region: "face skin",
    naming: { shape: "hers" },
    preservation: { category: "skin", phrase: "the same skin tone" },
  },
  skinCharacter: {
    zone: "allSkin",
    slot: { feature: "skin" },
    region: "face skin",
    naming: { shape: "hers" },
    preservation: { category: "skin", phrase: "the same skin texture" },
  },
  expression: {
    zone: "fullFrame",
    slot: {
      notASlot:
        "presentation, not identity (D-136) — a follow must never inherit a smile — and there is no zone that contains it (zoneScope `fullFrame`), so there is nothing to cut and nothing to carry",
    },
    region: null,
    naming: null,
    preservation: { category: "expression", phrase: "the same expression" },
  },
  bust: {
    zone: "fullFrame",
    slot: { feature: "build" },
    region: null,
    naming: null,
    preservation: { category: "build", phrase: "the same chest" },
  },
  waist: {
    zone: "fullFrame",
    slot: { feature: "build" },
    region: null,
    naming: null,
    preservation: { category: "build", phrase: "the same waist" },
  },
  shoulders: {
    zone: "fullFrame",
    slot: { feature: "build" },
    region: null,
    naming: null,
    preservation: { category: "build", phrase: "the same shoulders" },
  },
  arms: {
    zone: "fullFrame",
    slot: { feature: "build" },
    region: null,
    naming: null,
    preservation: { category: "build", phrase: "the same arms" },
  },
  build: {
    zone: "fullFrame",
    slot: { feature: "build" },
    region: null,
    naming: null,
    preservation: { category: "build", phrase: "the same build" },
  },
  /**
   * WHAT SHE IS WEARING — item 8, the Two Paths ruling's refine half
   * (`CASTING_V2_TWO_PATHS_DESIGN.md` §7.1, countersigned fable-1334).
   *
   * ⚠ `notASlot`, and the reason is not "we could not think of one" — **this
   * facet already has a carrier and it is better than a crop.** A wardrobe edit
   * rewrites the branch's stored LINE (`wardrobeLine.ts`, the one owner), and a
   * sentence travels into the roll prompt, the refine recipe, the five signed
   * views and the wardrobe judge — which is more than any crop of a sleeve
   * could do, because those views are rendered fresh at other angles where a
   * crop of this frame's fabric would be the wrong picture.
   *
   * `region: null` for D-213's reason applied honestly: a garment IS
   * segmentable — `decolletage` outlined a sports bra precisely on 2026-08-23 —
   * but no MEASURED word for "her outfit" exists in this product's vocabulary,
   * and a question invented here is the class that court photographed.
   */
  wardrobe: {
    /* The garment is not local and is not one object on her: it is the whole
       clothed area of the frame, and it can change silhouette. */
    zone: "fullFrame",
    slot: {
      notASlot:
        "presentation, not identity (D-136) — a follow must never inherit a costume — and it is carried by the STORED LINE rather than by a crop: a sentence travels into the five signed views, where a crop of this frame's fabric would be a picture of the wrong angle",
    },
    region: null,
    naming: { shape: "worn" },
    preservation: { category: "wardrobe", phrase: "the same clothes" },
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
