/**
 * WHAT EACH SLOT IS, AND HOW TO ASK A PICTURE ABOUT IT — the slot catalogue
 * (§2.6 / §6.2 step 2: the last piece between the mint and a caller).
 *
 * `referenceMint.ts` takes a slot's identity as INPUT — question, guard kind,
 * tier, noun — and refuses nothing on that axis, because the caller is the
 * assembler's own ask list where slots are the key by construction. This is the
 * table that answers those four for every slot the product can name, so a caller
 * composes a mint from a slot key rather than from four decisions it would have
 * to make correctly every time.
 *
 * # Nothing here INVENTS a segmentation question
 *
 * The words in a question go to a segmentation model, and D-213 is that a
 * segmenter is never asked an open question. So every question here is taken
 * from a table that already owns one — `regionNameOf` for the facet vocabulary,
 * `LANDMARK_OF_ACCESSORY.region` for the things a face can wear — and a slot
 * whose facets disagree about their region refuses to resolve rather than
 * picking one. A second list of "what to ask about hair" is law 4's copy, and
 * the copies drift.
 *
 * # A SLOT WITH NO QUESTION OF ITS OWN IS WORDS-ONLY, BY CONSTRUCTION
 *
 * The region vocabulary is coarser than the stylist's, and the gap is not an
 * inconvenience to round off — it is the fidelity law's exact shape. There is no
 * question that names a jawline; the nearest one is `face skin`. Cutting it
 * anyway would file **a crop of her whole face under the name "her jaw"**, and
 * the crop would then measure 100% complete against the region it was cut from,
 * because the boundary the guard checks would be the wrong boundary (the class
 * that took four appearances to name). The same in the other direction: her SKIN
 * is all of her visible skin — a tan does not stop at the jaw (working law 8) —
 * so `face skin` is narrower than the slot and a face crop labelled "her skin"
 * is a partial wearing the name of the whole.
 *
 * Those slots carry WORDS, and the words are not a consolation prize: for
 * anatomy the words are the carrier of record and the crop is an assist worth
 * about a third of its own value (§3.0a). What closes the gap is open-vocabulary
 * regions (roadmap §5), not a broader crop.
 *
 * # A LATERALITY WORD IS NEVER IN A QUESTION
 *
 * SAM 3 asked "left earring" and "right earring" on a frame wearing ONE returned
 * the same hoop twice, byte-identical; asked "earring" on a frame wearing two it
 * returned one mask. It answers a class with an instance and ignores the side
 * word entirely. So a per-instance slot's question is the plain class noun, and
 * the SIDE is imposed by the frame the question is asked of — her own midline,
 * one half at a time ({@link SlotDefinition.frame} = `ownSide`). A call can only
 * answer about the pixels it was handed.
 *
 * This matters more than it looks. If the question carried the side word, the
 * cut and the guard's second read would ask the same wrong question, agree
 * perfectly, and file the RIGHT ear's crop as the left one — the checker that
 * cannot fail, one layer down from where fable-173 already closed it.
 *
 * # NO SLOT HAS TIER `surface`, AND THAT IS THE RULING RATHER THAN AN OMISSION
 *
 * A surface worn on anatomy is ONE anatomy slot whose word stack holds the
 * surface words (fable-201, on law 8: a person has lips, and the panel row is
 * "her lips"). Makeup is worn state on the anatomy slots it is worn on
 * (fable-168). Gloss rides `lips`; a tan rides `skin`; freckles ride `skin`. So
 * every surface the current vocabulary can express lands in an anatomy slot's
 * stack, and the catalogue has no surface-tier entry to hand anyone.
 *
 * The tier itself stays reachable and must not be deleted: fable-195's carve-out
 * makes an UPLOADED makeup reference a legal anchor, and the parked makeup
 * face-chart idea (roadmap §3) would arrive as one. What the mint refuses is a
 * surface that MINTED a crop, which is a different thing.
 *
 * **The founder's earlier "crops stay bare" idea was superseded by D-244
 * itself** — a crop never rides its own feature's edit, so a lips crop carrying
 * some gloss pixels can never contaminate the lips' own next render, and purity
 * stopped mattering. Recorded here so the next reader does not resurrect
 * mint-tagging machinery that the edit law already made unreachable.
 *
 * # WHAT CAN ACTUALLY MINT A CROP TODAY: `hair`, AND NOTHING ELSE
 *
 * A crop enters the library only if its kind has a positive completeness
 * specimen, and one kind has one (`referenceCompleteness.ts`). Every other slot
 * with a perfectly good question — lips, eyes, brows, ears, earrings — will be
 * refused at the door with its reading attached, and will write its words. That
 * is fable-173's ruling working as designed, and the refusal is also the thing
 * that produces the specimen.
 */
import { LANDMARK_OF_ACCESSORY } from "./accessoryKinds";
import { regionNameOf } from "./maskedRefine";
import type { FeatureSlot, FeatureTier } from "./recipeAssembler";
import type { SlotSpec } from "./referenceMint";
import { parseSlot, slotKey, INSTANCES, type Instance } from "./referenceSlots";
import type { Facet } from "./refineFacets";

/** The panel's sections. One list, so the UI derives its headings rather than
 *  keeping a second answer to "where does her jaw go". */
export type SlotGroup = "face" | "hair" | "body" | "accessories";

/**
 * WHICH FRAME A SLOT'S QUESTION MAY BE ASKED OF.
 *
 * `ownSide` is not a hint. A bilateral slot asked of the whole frame gets back
 * whichever instance the segmenter felt like naming, and nothing downstream can
 * tell which one it was.
 */
export type SlotFrame = "wholeFrame" | "ownSide";

export type SlotDefinition = {
  slot: FeatureSlot;
  /** The feature half of the key: `hair`, `eye`, `earring`. */
  feature: string;
  /** `null` for a feature there is one of. */
  instance: Instance | null;
  tier: FeatureTier;
  group: SlotGroup;
  /** Bare and plain, the stylist's word: `hair`, `left earring`. */
  noun: string;
  /** The segmentation question, or `null` when no question names this slot. */
  question: string | null;
  /** The completeness specimen family. `null` exactly when `question` is. */
  guardKind: string | null;
  frame: SlotFrame;
  /** How the pair is spoken while it matches. Present only for a per-side slot. */
  pairNoun?: string;
  /** Present exactly when `question` is null — why, in one sentence. */
  wordsOnly?: string;
};

/**
 * Where a slot's question comes from, named rather than assumed.
 *
 * `none` carries the RELATION between the slot and the nearest region there is,
 * because "no question" and "the wrong question" are different failures and the
 * second one is the one that files a picture of her face as her jaw.
 */
type QuestionSource =
  /** The unique region of this slot's facets, through `regionNameOf`. */
  | { from: "facetRegion" }
  /** The accessory table's own region — `statedAccessories` has no facet region. */
  | { from: "accessoryRegion"; region: string }
  | {
    from: "none";
    /** How the nearest available region relates to the slot. */
    relation: "broader" | "narrower";
    note: string;
  };

type CatalogueEntry = {
  /** Key form: no spaces, because `parseSlot` refuses them. */
  feature: string;
  /** How a stylist says it, bare. An instance prefixes its side. */
  noun: string;
  tier: FeatureTier;
  group: SlotGroup;
  /**
   * The facets whose words land in this slot's stack.
   *
   * Two jobs in one field on purpose: it is where the question is derived from,
   * and it is the mapping the totality test walks. A facet in two slots or in
   * none is caught there rather than in a panel with a missing row.
   */
  facets: readonly Facet[];
  /**
   * ONE OF IT, OR ONE PER SIDE — and a pair carries the word it is spoken as.
   *
   * A pair is stored as instances and SPOKEN as one row while it matches
   * (`presentPair`), so the plural is needed the moment a bilateral slot
   * exists. It is DATA rather than a rule: English plurals are not a rule you
   * want inside a paid product, and `lashes` pluralized by rule reads
   * "lasheses". Carried on the variant so a bilateral slot cannot be added
   * without one.
   */
  instances: { of: "one" } | { of: "perSide"; pairNoun: string };
  question: QuestionSource;
};

/**
 * THE ANATOMY SLOTS.
 *
 * Ordered the way a face is read rather than alphabetically: hair, then the
 * face from the eyes down, then skin. The panel takes this order.
 */
const ANATOMY_SLOTS: readonly CatalogueEntry[] = [
  {
    feature: "hair",
    noun: "hair",
    tier: "anatomy",
    group: "hair",
    facets: ["hair.cut", "hair.colour", "hair.texture", "hairFinish", "hairWorn"],
    instances: { of: "one" },
    question: { from: "facetRegion" },
  },
  {
    feature: "facial-hair",
    noun: "facial hair",
    tier: "anatomy",
    /* It is hair, and a stylist says "hair and beard" in one breath. Grouped
       under Hair rather than Face for that reason and no stronger one. */
    group: "hair",
    facets: ["facialHair"],
    instances: { of: "one" },
    question: { from: "facetRegion" },
  },
  {
    feature: "eye",
    noun: "eye",
    tier: "anatomy",
    group: "face",
    facets: ["eye.colour", "eye.shape"],
    instances: { of: "perSide", pairNoun: "eyes" },
    question: { from: "facetRegion" },
  },
  {
    feature: "brow",
    noun: "brow",
    tier: "anatomy",
    group: "face",
    facets: ["brows"],
    instances: { of: "perSide", pairNoun: "brows" },
    question: { from: "facetRegion" },
  },
  {
    feature: "lashes",
    noun: "lashes",
    tier: "anatomy",
    group: "face",
    facets: ["lashes"],
    instances: { of: "perSide", pairNoun: "lashes" },
    question: {
      from: "none",
      relation: "broader",
      note: "that question is the whole eye, so a crop of it filed as her lashes is the eye's crop under a second name — two rows holding one fact (D-242)",
    },
  },
  {
    feature: "nose",
    noun: "nose",
    tier: "anatomy",
    group: "face",
    facets: ["nose"],
    instances: { of: "one" },
    question: { from: "facetRegion" },
  },
  {
    feature: "lips",
    noun: "lips",
    tier: "anatomy",
    group: "face",
    facets: ["lips"],
    instances: { of: "one" },
    question: { from: "facetRegion" },
  },
  {
    feature: "teeth",
    noun: "teeth",
    tier: "anatomy",
    group: "face",
    facets: ["teeth"],
    instances: { of: "one" },
    question: {
      from: "none",
      relation: "broader",
      note: "that question is the mouth, so a crop of it filed as her teeth is the lips' crop under a second name",
    },
  },
  {
    feature: "cheekbone",
    noun: "cheekbone",
    tier: "anatomy",
    group: "face",
    facets: ["cheekbones"],
    instances: { of: "perSide", pairNoun: "cheekbones" },
    question: {
      from: "none",
      relation: "broader",
      note: "a crop of that region filed as her cheekbone is a picture of her whole face",
    },
  },
  {
    feature: "jaw",
    noun: "jaw",
    tier: "anatomy",
    group: "face",
    facets: ["jaw"],
    instances: { of: "one" },
    question: {
      from: "none",
      relation: "broader",
      note: "a crop of that region filed as her jaw is a picture of her whole face",
    },
  },
  {
    feature: "chin",
    noun: "chin",
    tier: "anatomy",
    group: "face",
    facets: ["chin"],
    instances: { of: "one" },
    question: {
      from: "none",
      relation: "broader",
      note: "a crop of that region filed as her chin is a picture of her whole face",
    },
  },
  {
    feature: "ear",
    noun: "ear",
    tier: "anatomy",
    group: "face",
    facets: ["ears"],
    instances: { of: "perSide", pairNoun: "ears" },
    question: { from: "facetRegion" },
  },
  {
    feature: "skin",
    noun: "skin",
    tier: "anatomy",
    group: "body",
    /* Tone, character and marks are all facts about her skin, and they are all
       said in this one stack. Marks fold in here rather than taking a slot: a
       stylist says "her freckles" about her skin, and a single named mark is
       still a sentence about where it sits. A mark editable as its own row
       needs an instance id from a detector, which is the tattoo studio's
       machinery (roadmap §3) — named as owed rather than approximated here. */
    facets: ["skinTone", "skinCharacter", "marks"],
    instances: { of: "one" },
    question: {
      from: "none",
      relation: "narrower",
      note: "her skin is all of her visible skin — a tan does not stop at the jaw (working law 8) — so a face crop filed as her skin is a partial wearing the name of the whole, and it would read complete against the wrong boundary",
    },
  },
];

/**
 * THE THINGS SHE WEARS, derived from the placement table rather than restated.
 *
 * `LANDMARK_OF_ACCESSORY` already owns what kinds of object exist, what to ask a
 * segmenter for, and which of them are worn in twos. Every one of those three is
 * exactly what this catalogue needs, so it takes them — a second list of "things
 * a face can wear" is the copy law 4 forbids, and `bornWornDetector` derives its
 * own classes from the same table for the same reason.
 */
/**
 * How each PAIRED accessory kind is spoken as one thing.
 *
 * Written down rather than pluralized by rule, for the same reason the anatomy
 * entries are: `${region}s` happens to be right for earrings and would be wrong
 * for the first kind whose plural is not an "s". A pair kind with no entry
 * REFUSES at construction rather than reaching a customer misspelled.
 */
const PAIR_NOUN_OF_ACCESSORY: Record<string, string> = {
  earring: "earrings",
};

function pairNounOfAccessory(region: string): string {
  const plural = PAIR_NOUN_OF_ACCESSORY[region];
  if (plural === undefined) {
    throw new Error(
      `"${region}" is worn in twos and has no plural in PAIR_NOUN_OF_ACCESSORY, so the panel cannot say it as one thing`,
    );
  }
  return plural;
}

const ACCESSORY_SLOTS: readonly CatalogueEntry[] = LANDMARK_OF_ACCESSORY.map((entry) => ({
  feature: entry.region.replace(/ /g, "-"),
  noun: entry.region,
  tier: "item" as const,
  group: "accessories" as const,
  facets: ["statedAccessories"],
  instances: entry.pair
    ? ({ of: "perSide" as const, pairNoun: pairNounOfAccessory(entry.region) })
    : ({ of: "one" as const }),
  question: { from: "accessoryRegion" as const, region: entry.region },
}));

export const SLOT_CATALOGUE: readonly CatalogueEntry[] = [...ANATOMY_SLOTS, ...ACCESSORY_SLOTS];

/**
 * Every facet in the refine vocabulary, and where its words land.
 *
 * Total by test rather than by type, because `Facet` is a string — the same
 * shape `ZONE_SCOPE` uses, and for the same reason: a facet nobody assigned is
 * a feature the panel silently cannot show. `notASlot` is a real answer and
 * carries its reason, so "unassigned" and "deliberately absent" never look
 * alike.
 */
export type FacetAssignment =
  | { feature: string }
  /** One slot per kind (and per side) from the accessory table. */
  | { family: "accessories" }
  | { notASlot: string };

export const FACET_SLOTS: Record<Facet, FacetAssignment> = {
  "hair.cut": { feature: "hair" },
  "hair.colour": { feature: "hair" },
  "hair.texture": { feature: "hair" },
  hairFinish: { feature: "hair" },
  hairWorn: { feature: "hair" },
  facialHair: { feature: "facial-hair" },
  "eye.colour": { feature: "eye" },
  "eye.shape": { feature: "eye" },
  brows: { feature: "brow" },
  lashes: { feature: "lashes" },
  nose: { feature: "nose" },
  lips: { feature: "lips" },
  teeth: { feature: "teeth" },
  cheekbones: { feature: "cheekbone" },
  jaw: { feature: "jaw" },
  chin: { feature: "chin" },
  ears: { feature: "ear" },
  skinTone: { feature: "skin" },
  skinCharacter: { feature: "skin" },
  marks: { feature: "skin" },
  makeup: {
    notASlot:
      "makeup is worn STATE on the anatomy slots it is worn on (fable-168), and a surface worn on anatomy is one anatomy slot whose stack holds the surface words (fable-201) — a smoky eye rides eye@left and eye@right, a nude lip rides lips",
  },
  statedAccessories: { family: "accessories" },
  ink: {
    notASlot:
      "OWED, not absent: ink is per placement and its question comes from the placement rather than from a region table, so its slots arrive with the tattoo studio and the flash-sheet path (D-138, roadmap §3). Inventing a `tattoo` question here would ask a segmenter an open question (D-213)",
  },
  expression: {
    notASlot:
      "presentation, not identity (D-136) — a follow must never inherit a smile — and there is no zone that contains it (zoneScope `fullFrame`), so there is nothing to cut and nothing to carry",
  },
};

function entryOf(feature: string): CatalogueEntry | undefined {
  return SLOT_CATALOGUE.find((entry) => entry.feature === feature);
}

/**
 * The one question this slot's facets ask, or a refusal to guess.
 *
 * Throws rather than picking, because two facets in one slot naming two regions
 * means the slot is two slots and no default is honest about that.
 */
function facetRegionOf(entry: CatalogueEntry): string {
  const regions = new Set(entry.facets.map((facet) => regionNameOf(facet)));
  if (regions.size !== 1) {
    throw new Error(
      `slot "${entry.feature}" derives its question from facets that name ${regions.size} regions `
      + `(${Array.from(regions).map((region) => String(region)).join(", ")}) — it is two slots, not one`,
    );
  }
  const region = Array.from(regions)[0];
  if (region === null || region === undefined) {
    throw new Error(
      `slot "${entry.feature}" has no region in the facet vocabulary, so it cannot take its question from one`,
    );
  }
  return region;
}

/** The nearest region there is, for a slot that has no question of its own. */
function nearestRegionOf(entry: CatalogueEntry): string | null {
  const regions = new Set(entry.facets.map((facet) => regionNameOf(facet)));
  if (regions.size !== 1) return null;
  return Array.from(regions)[0] ?? null;
}

function definitionOf(entry: CatalogueEntry, instance: Instance | null): SlotDefinition {
  const noun = instance === null ? entry.noun : `${instance} ${entry.noun}`;
  const base = {
    slot: slotKey(entry.feature, instance ?? undefined),
    feature: entry.feature,
    instance,
    tier: entry.tier,
    group: entry.group,
    noun,
    frame: entry.instances.of === "perSide" ? ("ownSide" as const) : ("wholeFrame" as const),
    ...(entry.instances.of === "perSide" ? { pairNoun: entry.instances.pairNoun } : {}),
  };

  if (entry.question.from === "none") {
    const nearest = nearestRegionOf(entry);
    return {
      ...base,
      question: null,
      guardKind: null,
      wordsOnly: nearest === null
        ? `no segmentation question names this slot — ${entry.question.note}`
        : `the nearest question the region vocabulary has is "${nearest}", which is `
          + `${entry.question.relation} than this slot: ${entry.question.note}`,
    };
  }

  const question = entry.question.from === "accessoryRegion"
    ? entry.question.region
    : facetRegionOf(entry);
  /*
    THE GUARD KIND IS THE QUESTION, and it is derived rather than typed twice.

    A specimen family is "what a complete crop of THIS THING looks like", and
    the thing is exactly what the question names — `hair`'s 94.6% positive was
    measured on a crop of the region `hair`. Two names for one concept, kept in
    two fields, is where a `lips` crop starts being judged by hair's number.
    If a family ever has to be broader than one question, it gets its own column
    here on the day somebody measures the specimen that makes it true.
  */
  return { ...base, question, guardKind: question };
}

/**
 * What this slot is — or `null` when the catalogue has never heard of it.
 *
 * Null rather than a default: a slot nobody catalogued is a feature nobody
 * decided the tier of, and the unowned-axis class says an unowned field falls
 * to the loudest prior on every tile at once.
 */
export function slotDefinition(slot: FeatureSlot): SlotDefinition | null {
  const parsed = parseSlot(slot);
  if (parsed === null) return null;
  const entry = entryOf(parsed.feature);
  if (entry === undefined) return null;
  if (entry.instances.of === "perSide" && parsed.instance === undefined) return null;
  if (entry.instances.of === "one" && parsed.instance !== undefined) return null;
  return definitionOf(entry, parsed.instance ?? null);
}

/**
 * Every slot the vocabulary can name, in panel order, both sides expanded.
 *
 * A pair is stored as instances and SPOKEN as one row while it matches
 * (`presentPair`) — this list is the storage vocabulary, and the panel derives
 * its rows from the instances rather than from a second list here.
 */
export function catalogueSlots(): SlotDefinition[] {
  return SLOT_CATALOGUE.flatMap((entry) => (
    entry.instances.of === "perSide"
      ? INSTANCES.map((instance) => definitionOf(entry, instance))
      : [definitionOf(entry, null)]
  ));
}

/**
 * The mint's input for one slot, composed from this slot's own record plus the
 * stack the render is filing.
 *
 * The words are the caller's — they come from the ask list and the library, and
 * the catalogue has no business holding a copy of what has been said about a
 * face. Everything else is here, so a caller cannot make three of these four
 * decisions right and the fourth one up.
 */
export function slotSpecFor(slot: FeatureSlot, words: readonly string[]): SlotSpec | null {
  const definition = slotDefinition(slot);
  if (definition === null) return null;
  return {
    slot: definition.slot,
    tier: definition.tier,
    noun: definition.noun,
    words,
    question: definition.question,
    guardKind: definition.guardKind,
  };
}
