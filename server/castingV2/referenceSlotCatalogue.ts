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
import { facetTableOf } from "./facetCards";
import {
  inkPlacementBareNoun,
  inkPlacementEntry,
  isInkPlacement,
} from "../../shared/inkPlacementVocabulary";
import { regionNameOf } from "./maskedRefine";
import type { FeatureSlot, FeatureTier } from "./recipeAssembler";
import type { SlotSpec } from "./referenceMint";
import { isOpenKindKey, openKindNoSpecimenReason } from "./openKindPolicy";
import {
  parseSlot,
  slotKey,
  INSTANCES,
  inkPlacementOfSlot,
  inkSideSlotKey,
  inkSlotKey,
  isInkSlot,
  isOpenSlot,
  OPEN_SLOT_PREFIX,
  openKindOfSlot,
  type Instance,
  type InkAskPlacement,
  type SlotFrame,
} from "./referenceSlots";
import type { Facet } from "./refineFacets";

export type { SlotFrame };

/** The panel's sections. One list, so the UI derives its headings rather than
 *  keeping a second answer to "where does her jaw go". */
export type SlotGroup = "face" | "hair" | "body" | "accessories";

/**
 * WHETHER THIS SLOT IS A ROW ON THE PANEL — and if not, where its words are read.
 *
 * A slot exists so that words about a feature have somewhere to LAND. Whether
 * the panel draws a row for it is a second question, and the founder answered it
 * separately (fable-360, fable-382 §1): *"only show the 8 rows that real
 * pictures have"*, *"i dont think eyelashes really needs to be there ·
 * cheekbones or jaw or chin"*.
 *
 * So this is data on the one catalogue rather than a second list of "rows the
 * panel shows" — law 4's copy, which would drift the first time a slot is added.
 * Three answers, and the difference between the last two is the whole point:
 *
 *   own          the slot speaks for itself
 *   foldedInto   no row, but its words are read on another row's — a lash ask
 *                still lands, and it is read under her eyes
 *   none         no row and no words on screen; askable in the box, carried in
 *                the stack, never a square
 *
 * `none` is not "unsupported". Facial structure is words by founder ruling, and
 * a words-only slot with no row is exactly that ruling: the ask works, the words
 * are kept, and the panel does not offer a picture of something that has none.
 */
export type PanelPlacement =
  | { row: "own" }
  | { row: "foldedInto"; feature: string; why: string }
  | { row: "none"; why: string };

export type SlotDefinition = {
  slot: FeatureSlot;
  /** The feature half of the key: `hair`, `eye`, `earring`. */
  feature: string;
  /** `null` for a feature there is one of. */
  instance: Instance | null;
  tier: FeatureTier;
  group: SlotGroup;
  /** Whether the panel draws a row for it, and where its words are read if not. */
  panel: PanelPlacement;
  /** Bare and plain, the stylist's word: `hair`, `left earring`. */
  noun: string;
  /** The segmentation question, or `null` when no question names this slot. */
  question: string | null;
  /** The completeness specimen family. `null` exactly when `question` is. */
  guardKind: string | null;
  frame: SlotFrame;
  /** When this slot's crop is re-cut — see {@link CatalogueEntry.remint}. */
  remint: RemintRule;
  /**
   * THE REGION THIS ROW MAY BE DRAWN FROM, and never cut for the library.
   *
   * `null` for almost every slot, because almost every slot is drawn from the
   * region it is cut from. See {@link CatalogueEntry.display}.
   */
  display: string | null;
  /** How the pair is spoken while it matches. Present only for a per-side slot. */
  pairNoun?: string;
  /** Present exactly when `question` is null — why, in one sentence. */
  wordsOnly?: string;
  /**
   * WHAT THIS ROW STATES WHEN THE SCAN ASKED AND FOUND NOTHING — *"bald"*.
   *
   * See {@link CatalogueEntry.whenAbsent}. Absent on almost every slot, and
   * absent is the safe answer: a slot without it draws no row when its read
   * comes back empty, which is what every slot did before this field existed.
   */
  whenAbsent?: { says: string; why: string };
  /**
   * WHY THIS SLOT HAS A QUESTION AND NO GUARD — the open lane's carve-out.
   *
   * Present on open slots ONLY, and never on a catalogued one. The invariant
   * above — `guardKind` is null exactly when `question` is — is stated over the
   * CLOSED catalogue, and an open kind is the one thing that cannot satisfy it:
   * it has a question (its own noun) and no completeness specimen, because a
   * specimen family is a measurement nobody has taken for a kind nobody has
   * catalogued.
   *
   * fable-766 §2 ratified recording the reason rather than faking a guard or
   * falling back to words-only, on V1's own principle: silence becomes a loud,
   * written decision. **Its bound is that the mint door must READ this** — a
   * recorded fact nobody consults is the silent null it replaced.
   */
  noSpecimen?: string;
};

/**
 * WHEN A SLOT'S CROP IS RE-CUT.
 *
 * `whenEarned` is what every slot did before this existed and what almost every
 * slot should go on doing: the mint files a slot when THIS render delivered
 * something into it, and a slot the render did not touch keeps the crop it
 * already has. A re-cut costs vision calls, and paying them on eleven slots per
 * render to re-photograph eleven features nobody edited is not a trade this
 * product makes.
 *
 * `everyRender` is the exception the below-head crop forced, and it is not about
 * cost — it is about what the crop CONTAINS.
 */
export type RemintRule = "whenEarned" | "everyRender";

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
  /**
   * ASKED OF THE FRAME THAT DELIVERED IT, NEVER OF THE MASTER.
   *
   * An ADDITION arrives through an edit, so its facet card says `region: null`
   * and means it: segmenting the master for horns asks where a thing is that
   * she does not have, and `needsLandmarkDestination` is the path that places
   * one instead. That is a fact about the MASTER.
   *
   * The mint is a different picture. It cuts from the frame that just delivered
   * the feature, where the thing is plainly there and plainly askable — the
   * detection court read 0.0000% on three bare frames against 0.39–0.87% on
   * twelve worn ones, asked exactly this word. So the cutting region lives
   * here, on the slot, rather than being smuggled into the facet table where it
   * would send a master-time reader after something she has not got.
   *
   * Two consumers, two truths, one word — and the word travels under the source
   * that says which picture it is for.
   */
  | { from: "deliveredRegion"; region: string; note: string }
  /**
   * NOT ASKED — COMPOSED, from two regions that ARE answered.
   *
   * D-213 forbids asking a segmenter an open question, and no question names a
   * body. `derived` is the third possibility the catalogue was missing: a region
   * that is arithmetic on answers the reader already gives. `belowHead` is the
   * whole-subject matte below the bottom of the `face` box (`belowHeadMask`),
   * and nothing new is asked of any model to obtain it.
   *
   * Its guard is geometric for the same reason (`derived-geometry`): there is no
   * calibrated completeness specimen for a composed region, and borrowing
   * another family's number would be a guard nobody measured. What CAN be proved
   * is that the crop holds every pixel the derivation kept, and that is stricter
   * than a specimen.
   */
  | { from: "derived"; of: "belowHead"; note: string }
  | {
    from: "none";
    /**
     * How the nearest available region relates to the slot.
     *
     * Optional for one case and one case only: a slot whose facets name NO
     * region has no nearest thing for a relation to be about, and horns is the
     * first of those — its facet card writes `region: null` deliberately, so
     * "broader" or "narrower" here would be a false word in the source that
     * nothing would ever print. A slot that DOES have a nearest region must
     * still say how it relates, and the catalogue refuses to load otherwise:
     * that sentence is read by a person deciding whether a crop is honest.
     */
    relation?: "broader" | "narrower";
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
  /** Absent means {@link PanelPlacement} `own` — most slots speak for themselves. */
  panel?: PanelPlacement;
  /**
   * WHEN THIS SLOT'S CROP IS RE-CUT. Absent means `whenEarned`, which is what
   * every slot did before `build` needed otherwise (fable-424 §4).
   *
   * A slot marked `everyRender` is filed on every delivered render whether or
   * not this one earned it, so its crop is always cut from the frame in hand.
   * It is law 4 at the door: a crop that persists across other people's edits is
   * a COPY drifting from its source, and the alternative — a list of which edits
   * invalidate which crop — is wrong the day somebody adds a slot to it.
   */
  remint?: RemintRule;
  /**
   * SHOWN, NEVER CARRIED — a region a row may be DRAWN from that must never be
   * cut for the library (fable-428 §3).
   *
   * The founder's rule is that every panel row has a bounding box on the
   * photograph: *"nothing should ride words alone in the right panel"*. Most
   * rows satisfy it for free, because the region they are drawn from is the
   * region their crop is cut from — one answer, two uses.
   *
   * `skin` is the row where those two come apart, and it comes apart in a
   * direction that matters. Her skin is ALL of her visible skin — a tan does not
   * stop at the jaw (working law 8) — so a crop of her face filed as *her skin*
   * is a partial wearing the name of the whole, complete against the wrong
   * boundary. That is why its `question` is `none` and must stay `none`.
   *
   * But a ROW is a name and a click affordance, not a scope diagram. The face
   * skin cutout reads as skin at a glance, and the scope of the edit lives where
   * law 8 enforces it — in the ask's own words at edit time. Measured on three
   * production frames before the choice was made: a face-skin box claims
   * **11.5–12.5%** of the area a tan would touch. Filed here with the decision
   * rather than discovered after it.
   *
   * The separation is structural, not remembered: `slotSpecFor` — the mint's
   * only door — never carries this field, so a display region has no route to a
   * crop. `referenceSlotCatalogue.test.ts` drives that it cannot.
   */
  display?: string;
  /**
   * WHAT THE ROW SAYS WHEN THE SCAN ASKED AND FOUND NOTHING — founder ruling,
   * fable-889: asked whether hair should appear on his bald cyborg cast,
   * **"yes show bald"**.
   *
   * A finding of nothing is a LOOK, not a gap (working law 8 — a stylist names
   * bald, clean-shaven, no makeup), so the row stays and states it rather than
   * vanishing. The design and its grounds are `PANEL_ABSENT_STATE_DESIGN.md`.
   *
   * # ABSENCE MUST NOT BE CONFOUNDED WITH OCCLUSION, WHICH IS WHY IT IS
   * # AUTHORED HERE AND NEVER DERIVED
   *
   * The scan's own header says the trap in one sentence: an empty read is
   * *"an honest answer on a face with an ear behind her hair and a finding on a
   * face looking straight at the camera."* One field, two facts. So a feature
   * is admitted by somebody deciding it, in writing, beside the reason — the
   * discipline `panel` and `display` already follow — and the default is
   * SILENCE. Ears, eyes, brows and lashes are routinely hidden by hair or pose
   * and may never hold one; nose, lips and teeth have nothing to state, and
   * *"nose: none"* would be a bug wearing a caption.
   *
   * Named `whenAbsent` rather than anything containing "none", because
   * {@link PanelPlacement} already has `row: "none"` and it means DRAW NO ROW —
   * the exact opposite. Two meanings of "none" one field apart would be read
   * wrong inside a month.
   *
   * The words are the panel's own statement about the photograph and are never
   * the customer's: not a delta, not an ask, and nothing carries them into a
   * recipe or files them in the library.
   */
  whenAbsent?: { says: string; why: string };
};

const STRUCTURE_IS_WORDS = (part: string): PanelPlacement => ({
  row: "none",
  why:
    `facial structure is WORDS by founder ruling (fable-360: "for now facial structure runs as `
    + `words/descriptions but dont show them in the cutouts"), and he named ${part} again in `
    + `fable-382 §1. The slot keeps its stack and the ask box still reaches it; what it does not `
    + `have is a row on the panel, because there is no question that names it and a row with `
    + `neither a picture nor anything said is an empty square with a label`,
});

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
    /*
      THE FOUNDER'S OWN CASE, and the reason it is safe here: the crown is in
      frame on every casting framing this product produces, and hair is not
      something another feature hides. An empty hair read is bald or broken —
      never hidden — which is the one thing that makes stating it honest.

      CONTROLLED ON PRODUCTION READINGS BEFORE THE WORD SHIPPED (§5 of the
      design note, run 2026-08-17 off `casting_face_scans`, every frame opened
      by eye rather than taken from the reader's prose — law 9):
        POSITIVE  8 of 8 haired readings returned a hair REGION, including a
                  close-cropped grey buzz cut, which is the nearest thing to
                  bald that still has hair
        NEGATIVE  6 of 6 readings that returned EMPTY are visibly bald men
                  (his cyborg roll) — not one confident patch of scalp
    */
    whenAbsent: {
      says: "bald",
      why:
        "the crown is in frame on every casting framing this product produces and nothing occludes "
        + "it, so an empty hair read is bald or broken and never hidden — the founder's own case "
        + "(fable-889: \"yes show bald\"), controlled 8/8 positive and 6/6 negative on production "
        + "readings before the word shipped",
    },
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
    /*
      The same argument, and the same reading answered it in the same pass: the
      jaw is in frame, nothing occludes it, and clean-shaven is a look a stylist
      names. On those 14 production readings the beard question came back FOUND
      on 5 visibly bearded faces and EMPTY on the clean-shaven and female ones.
    */
    whenAbsent: {
      says: "clean-shaven",
      why:
        "the jaw is in frame and nothing occludes it, so an empty read is clean-shaven rather than "
        + "hidden, and clean-shaven is a look a stylist names — fable-889's own generalisation, "
        + "controlled on the same production readings as hair",
    },
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
    /*
      AND THE SAME SENTENCE, ONE LAYER UP. The reason lashes can never have a
      picture of their own — the only region that contains them IS the eye — is
      the reason they are read on the eyes row rather than beside it. The
      founder's words were shorter: "i dont think eyelashes really needs to be
      there" (fable-382 §1).
    */
    panel: {
      row: "foldedInto",
      feature: "eye",
      why:
        "the only region that contains lashes is the eye itself, so a lash row could never hold a "
        + "picture that was not the eyes' picture under a second name (D-242) — the words are read "
        + "on the eyes row, and a lash ask still lands in this slot's own stack",
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
    /*
      AND THE SAME REGION THE NOTE ABOVE REFUSES AS A CROP DRAWS THE ROW
      (founder, fable-463: *"her teeth never gained a bounding box after the
      edit"* — the smile delivered, the teeth plainly there, no box).

      Exactly the skin precedent one row over: as a CARRIER the mouth would be
      the lips' crop under a second name, and every later render would be told
      her teeth are her lips. As a ROW it is a name and a click affordance, and
      the mouth is where a person looks to judge teeth.

      AND THE REGION IS "teeth", NOT the lips', which is a reading rather than
      a guess. Measured on his own two frames (`probe-his-lips-disposable`):

        v#186, the smile     lips 0 px · teeth 1,345 px
        v#184, closed mouth  lips 2,363 px · teeth 0 px

      So the segmenter answers this question with the teeth themselves when they
      are in the picture and with nothing when they are not — which makes the
      region its own discriminator: a closed mouth yields no box, no row, and
      nothing had to be gated on the describer to make that true. The note above
      still stands for CUTTING (a crop of the mouth filed as her teeth is the
      lips' crop renamed), which is why the question stays `none`.

      AND THE WORD IS "ALL THE TEETH", because the bare noun answers a CLASS
      WITH AN INSTANCE (founder, fable-619 §2: his vampire render drew the box
      around one fang, and the describer honestly described the one tooth it
      was handed). Benched rather than edited into place
      (`bench-teeth-box-disposable`), bars written first, the mouth's own box as
      the denominator so "a row of teeth" and "one tooth" are told apart by
      measurement:

        question                his fangs   even   diastema   crowded   closed×3
        "teeth"                    10%       82%      86%       16%      silent
        "the teeth" / "her teeth"  10%       27%      16%       16%      silent
        "all the teeth"            76%       82%      98%       87%      silent
        "upper and lower teeth"    78%       90%      97%       93%      silent
                                              (box width as a share of the mouth's)

      Two questions pass every arm, and the tie breaks on WHAT THEY BECAME: by
      box area, "upper and lower teeth" occupies 70–88% of the mouth's own box
      on the three smiles, which is the mouth wearing the teeth's name — the
      very thing the note above refuses. "all the teeth" stays at 34–42% and is
      still the teeth. Silent on all three closed mouths either way, so nothing
      was traded for it.
    */
    display: "all the teeth",
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
    panel: STRUCTURE_IS_WORDS("cheekbones"),
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
    panel: STRUCTURE_IS_WORDS("the jaw"),
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
    panel: STRUCTURE_IS_WORDS("the chin"),
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
    /*
      HER BUILD — the founder's own new row (fable-360 ruling 3, narrowed to ONE
      concept in fable-382 §3). Five facets fold into it exactly as three fold
      into `skin`, and the split is never visible: one row, one prefill, one ask.
    */
    feature: "build",
    noun: "build",
    tier: "anatomy",
    group: "body",
    facets: ["bust", "waist", "shoulders", "arms", "build"],
    instances: { of: "one" },
    /*
      HER BUILD IS DERIVED, and the note it used to carry has been half
      measured away (opus-326, ruled in fable-422 §2).

      What it said: no question names a build, and a crop of her filed as her
      build is a second master — "measured this week as +7% to +10% face-height
      drift when a reference at the wrong scale rides a render".

      The drift half is superseded. That measurement was taken before
      `referenceFit.padToFrame` existed; with the padding applied the body bench
      measured head height stable to ≤1% across fifteen renders, with the
      REFERENCELESS floor render moving it as much as the crop arms did. A
      number that no longer reproduces cannot go on justifying a feature loss.

      The second-portrait half stands, and the bench answered it too: a carrier's
      identity cost scales with how much of her FACIAL GEOMETRY it contains
      (fable-423 §2). The below-head crop contains none — it starts under her
      chin — which is why it carries where the skin bench's face-cut cost
      identity on 2 of 3 faces.

      And the reason this changed at all: under words alone a delivered build is
      lost ENTIRELY on the next edit — 3 faces of 3, back inside the floor's own
      noise, as though she had never paid for it. The same crop kept 92–109%.
    */
    question: {
      from: "derived",
      of: "belowHead",
      note: "no question names a build, so this region is composed rather than asked: the whole-subject matte below the bottom of the `face` box. Its completeness is arithmetic against the masks that built it, never a specimen nobody calibrated",
    },
    /*
      AND IT IS RE-CUT EVERY RENDER, because a below-head crop is not only her
      build — it is her CLOTHES (opus-328 §4, ruled in fable-424 §4).

        step 1  narrower shoulders          → the crop is minted: a grey t-shirt
        step 2  "put her in a black blazer" → `build` earned nothing, so under
                                              `whenEarned` nothing re-cuts it
        step 3  "green eyes"                → the grey t-shirt rides again, into
                                              a frame that must keep the blazer

      Re-cutting from the frame in hand makes that unreachable rather than
      merely avoided (law 4), and it costs no enumeration of which edits
      invalidate a torso — the kind of list that is wrong the first time somebody
      adds a slot to it. What it costs is two reads on the delivered frame, and
      only on a face that has a build to keep: `mintedSlotsForRender` still files
      nothing where nothing has ever been said, because an unedited build is
      already carried by the pristine master every render anchors on.
    */
    remint: "everyRender",
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
    /*
      AND THE SAME REGION THE NOTE ABOVE REFUSES AS A CROP IS THE ONE THE PANEL
      DRAWS HER SKIN FROM (founder's box rule, ruled in fable-428 §2).

      Not a contradiction — two different questions about one region. As a
      CARRIER it would be a picture of her face labelled "her skin", and every
      later render would be told her skin is her face. As a ROW it is a name and
      a click affordance, and "her face skin" is where a person looks to judge
      skin. The understatement is real and measured (11.5–12.5% of what a tan
      touches, three production frames) and it is filed on `display` above
      rather than discovered by somebody later.
    */
    display: "face skin",
  },
  {
    /*
      HORNS — a slot so her horns have somewhere to STAND (fable-525 §3), and
      since 2026-08-15 a PAIR that carries by crop like any other feature.

      # Why this entry changed

      The survival court measured both arms on the same face and the same
      chained edit: words held 3/3 and a real cut held 3/3, neither beating the
      other, so the slot was words-only and said so. Both arms were scored on
      PRESENCE and IDENTITY. Neither was asked whether they are the same HORNS.

      The founder: *"horns should be carried by reference as well — it's a
      feature, otherwise they would change on every refinement"*, generalised
      the same day: *"it's not just horns that carry, this was just an example of
      anything in the future."* Crop-carry is the default for every promoted
      feature kind; words-carry is never a feature's ship. The tie rule is
      amended with it — a presence tie does not decide a carrier question, and
      instance constancy is part of the bar (`V2_HORNS_VERDICT.md`'s head).

      # And they are a PAIR, declared rather than wired

      *"Left and right bounding boxes and edits should apply to things like
      horns."* `perSide` is the declaration the machinery already follows: two
      slots, per-side rows on the panel, per-side asks, and — the part that
      matters most here — a question asked of ONE HALF OF THE FRAME at a time.

      That is not a nicety. Asked "horns" on a whole frame, the segmenter
      answers with ONE horn and not always the same one: measured on three
      chained specimens, the placement axis swung by most of a face-width
      (`V2_HORN_CONSTANCY_READING.md`). A pair read whole cannot be judged for
      constancy at all, so the founder's ruling and the instrument's own
      limitation demand the same shape.

      The limits ride with it: survival and removal are n=3 on ONE face, and the
      old paste road has measured none of it (`admittedOn: "repaintOnly"` on the
      subject card, enforced at the admission door).
    */
    feature: "horns",
    noun: "horn",
    tier: "anatomy",
    /* Not "accessories": horns are not worn, they GROW — she is not carrying
       them and cannot take them off in the way a hoop comes out of a lobe. The
       stylist's grouping for a thing coming through the hairline is the head. */
    group: "hair",
    facets: ["horns"],
    /* A pair, by founder ruling and by the instrument's own limitation — see
       the note above. The question stays the plain class noun; the SIDE is
       imposed by the half of the frame it is asked of. */
    instances: { of: "perSide", pairNoun: "horns" },
    /*
      ASKED OF THE DELIVERED FRAME. The facet card says `region: null` and is
      right about the master — horns arrive through an edit, so segmenting the
      picture she has now asks where a thing is she has not got. The mint cuts
      from the frame that just delivered them, where the same word is answered
      perfectly.
    */
    question: {
      from: "deliveredRegion",
      region: "horns",
      note: "the detection court read 0.0000% on three visibly bare frames against 0.39–0.87% on twelve worn ones, across two faces, asked exactly \"horns\" — the word was never the doubt; what was missing was a ruled reason to cut, and the founder supplied it (2026-08-15)",
    },
    /*
      IT GETS A ROW, and now the row has a picture behind it (fable-527 §3, then
      the founder's carry ruling of 2026-08-15).

      The first version of this entry said no row, on the reasoning that a row is
      a picture and horns have no crop. The founder overruled the first half, and
      his carry ruling has now removed the second: horns are cut like any other
      feature, so the row draws from the slot's OWN question rather than from a
      display region that could never be filed.

      That is why `display` is gone from this entry. It exists for a slot whose
      picture and crop must differ — skin's face cut, teeth's mouth — and horns
      is no longer one of those: the words it is shown from and the words it is
      cut from are the same words, and now both are allowed.
    */
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
  /**
   * ONE SLOT PER PLACEMENT, decided by where on her she said it goes.
   *
   * # The reason, kept alive from the fence it used to be
   *
   * This facet read `notASlot` until the ink lane was built, and its reason was
   * the specification nobody had recognised as one: *"ink is per placement and
   * its question comes from the placement rather than from a region table, so
   * its slots arrive with the tattoo studio and the flash-sheet path (D-138,
   * roadmap §3). **Inventing a `tattoo` question here would ask a segmenter an
   * open question (D-213)**."*
   *
   * That last sentence rides here verbatim because it is the caution that stops
   * the next person collapsing this branch into `{ feature: "tattoo" }` for
   * tidiness. There is no `tattoo` region. A segmenter asked one would be asked
   * an open question, and the three words that DO cut these surfaces — `neck`,
   * `upper arm`, `upper chest` — were bought on sixteen production masters, one
   * per placement, which is why the slot has to be chosen rather than looked up.
   *
   * # Why it is `context` and not a table
   *
   * The same shape `family` is, for the same reason: the value that picks the
   * slot is resolved at RUNTIME — there by the accessory's kind, here by the
   * placement the customer's own sentence named — so the table cannot hold it
   * and a caller has to carry it in. Absence is its own named refusal rather
   * than `notASlot`, because *"she named no place"* and *"this facet has no
   * slot by decision"* are different facts and only the first is answerable.
   */
  | { perPlacement: "ink" }
  | { notASlot: string };

export const FACET_SLOTS: Record<Facet, FacetAssignment> = facetTableOf((card) => card.slot);

function entryOf(feature: string): CatalogueEntry | undefined {
  return SLOT_CATALOGUE.find((entry) => entry.feature === feature);
}

/**
 * A FOLDED SLOT'S WORDS MUST HAVE SOMEWHERE TO BE READ — checked once, at load.
 *
 * `foldedInto` names another feature, and a name is a reference that can rot: a
 * host that is renamed, deleted, or itself folded away would take the folded
 * slot's words off the screen SILENTLY — the ask would still work, the stack
 * would still fill, and nothing anywhere would say why nobody could see it. So
 * the catalogue refuses to load rather than shipping a slot that speaks into a
 * room with no door.
 */
/**
 * A SLOT WITH A NEAREST REGION MUST SAY HOW IT RELATES — checked at load, for
 * the same reason the fold check is: the sentence it produces is read by a
 * person deciding whether this slot could honestly have been a crop.
 */
for (const entry of SLOT_CATALOGUE) {
  if (entry.question.from !== "none") continue;
  if (nearestRegionOf(entry) === null) continue;
  if (entry.question.relation === undefined) {
    throw new Error(
      `"${entry.feature}" has no question of its own but its facets name a region — say whether that region is broader or narrower than this slot`,
    );
  }
}

for (const entry of SLOT_CATALOGUE) {
  if (entry.panel?.row !== "foldedInto") continue;
  const host = entryOf(entry.panel.feature);
  if (host === undefined) {
    throw new Error(
      `"${entry.feature}" is folded into "${entry.panel.feature}", which is not a catalogued feature — its words would be invisible`,
    );
  }
  if ((host.panel ?? { row: "own" }).row !== "own") {
    throw new Error(
      `"${entry.feature}" is folded into "${host.feature}", which has no row of its own — its words would be invisible`,
    );
  }
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

/**
 * REGION WORDS A ROW MAY BE DRAWN FROM THAT NO FACET'S TABLE OWNS.
 *
 * A display region is sent to a real segmenter, so an improvised phrase here
 * would be the open question D-213 forbids arriving through the display door
 * instead of the cutting one. Almost every one is already owned by
 * `REGION_OF_FACET` — the word the compositor cuts with — and this table is for
 * the ones that are not, each carrying the reading that earned it.
 *
 * It is deliberately NOT a route into the mint: `slotSpecFor` does not read
 * `display` at all, so nothing here can become a crop.
 */
export const DISPLAY_REGION_VOCABULARY: Readonly<Record<string, string>> = {
  horns:
    "measured by the horns court, 2026-08-14, on two of the founder's own faces "
    + "(`docs/specs/V2_HORNS_VERDICT.md`): the segmenter answers \"horns\" with 0.0000% of "
    + "the frame on six visibly bare renders and 0.3888–0.8741% on twelve worn ones, per "
    + "face and never pooled. Total separation, which is why this row needs no floor of its "
    + "own — any pixels at all are the region answering, exactly as the scan has always "
    + "treated a question no accessory court measured. It is a DISPLAY region and not a "
    + "cutting one: the survival court's crop arm beat nothing, and a mint would need a "
    + "completeness specimen this kind has never bought",
  teeth:
    "measured on the founder's own production frames, 2026-08-14 "
    + "(probe-his-lips-disposable): the segmenter answers \"teeth\" with 1,345 px on his "
    + "smiling frame and 0 px on his closed-mouth one, while \"lips\" answers 0 px and "
    + "2,363 px on the same two. The two are different questions to this reader, whatever "
    + "they are to a diagram — which is also why his panel had no LIPS row on the smile",
  "all the teeth":
    "the same question asked so that it answers the CLASS (fable-619 §2, benched "
    + "2026-08-15 in `bench-teeth-box-disposable`): on his fanged render the bare noun "
    + "returns a box 10% of the mouth's width — one fang, which is what his panel showed "
    + "him — and this phrasing returns 76%. Across four frames where teeth are plainly in "
    + "the picture it returns 76/82/98/87% of the mouth's width, and on three closed "
    + "mouths it returns nothing at all. \"upper and lower teeth\" scores the same on the "
    + "width arm and was rejected on a second measurement: by AREA it becomes 70–88% of "
    + "the mouth's own box, which is the mouth wearing the teeth's name",
};

/**
 * The key a DERIVED region travels under, and the reason it reads like a
 * sentence no one would send to a model: it is never sent to one. The mint
 * matches on this exact string and composes the mask from regions that ARE
 * asked; anything else reaching a reader under it would be an open question.
 */
export const DERIVED_REGION_KEY = {
  belowHead: "derived:below-head",
} as const;

/** Is this region key one the mint must COMPOSE rather than ask for? */
export function isDerivedRegion(question: string | null): question is string {
  return question !== null && Object.values(DERIVED_REGION_KEY).includes(question as never);
}

/**
 * THE REAL QUESTIONS A DERIVED KEY IS COMPOSED FROM — beside the key that is
 * never asked, deliberately.
 *
 * `derived:below-head` may not reach a segmenter; `face` must. Keeping both
 * facts in one place is what stops the composer from inventing its own name for
 * the head: a second spelling of "face" here and in `regionNameOf` is the copy
 * that drifts, and the day one of them changes the mint would compose a build
 * from a region nobody else believes in.
 *
 * The whole-subject matte is not in this table because it is not a QUESTION —
 * it is the matting model's one job, asked through the reader's own `subject`
 * seam with no name to get wrong.
 */
export const DERIVED_REGION_ASKS = {
  belowHead: { head: "face" },
} as const;

/**
 * CAN A SEGMENTER BE ASKED FOR THIS SLOT'S REGION? — one predicate, three
 * readers.
 *
 * Before derived regions existed, every consumer spelled this `question ===
 * null`, and that was the same sentence: no question, no picture. A derived
 * region breaks the spelling without breaking the meaning — `build` now HAS a
 * region key and still cannot be asked for, because the key is composed and
 * handing it to a reader would be the open question D-213 forbids.
 *
 * So the fact lives here once and is derived by everyone else. The alternative
 * was three copies of `question === null || isDerivedRegion(question)`, which is
 * the second list law 4 is about — and the version of it that would have sent
 * `derived:below-head` to a segmenter from whichever copy was missed.
 */
/* A type predicate, so a caller that has checked does not then have to assert:
   `question` and `guardKind` are non-null together or not at all, and this is
   the one place that fact is worth teaching the compiler. */
export function isAskable(
  definition: SlotDefinition,
): definition is SlotDefinition & { question: string; guardKind: string } {
  return definition.question !== null && !isDerivedRegion(definition.question);
}

function definitionOf(entry: CatalogueEntry, instance: Instance | null): SlotDefinition {
  const noun = instance === null ? entry.noun : `${instance} ${entry.noun}`;
  const base = {
    slot: slotKey(entry.feature, instance ?? undefined),
    feature: entry.feature,
    instance,
    tier: entry.tier,
    group: entry.group,
    panel: entry.panel ?? { row: "own" as const },
    noun,
    frame: entry.instances.of === "perSide" ? ("ownSide" as const) : ("wholeFrame" as const),
    remint: entry.remint ?? ("whenEarned" as const),
    display: entry.display ?? null,
    /* Carried only where it was authored: a slot with nothing here says nothing
       when its read is empty, which is what every slot did before this field. */
    ...(entry.whenAbsent ? { whenAbsent: entry.whenAbsent } : {}),
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

  if (entry.question.from === "derived") {
    /*
      A COMPOSED REGION TRAVELS UNDER A KEY, NOT UNDER A QUESTION.

      `DERIVED_REGION_KEY` is deliberately not a phrase any segmenter would be
      asked: the mint recognises it and composes the mask itself, and a reader
      handed it by mistake would be being asked an open question, which is the
      thing D-213 forbids. The guard kind says what judges the crop — geometry,
      not a specimen — so the two fields still name one concept each.
    */
    const key = DERIVED_REGION_KEY[entry.question.of];
    /* The guard kind is the key, exactly as it is the question everywhere else
       — one name for one concept. A separate name here would have been the
       first slot in the catalogue whose crop could be judged under a family it
       does not belong to, which is the failure that invariant guards. Nothing
       can adopt a specimen under this name because the mint never sends it to
       a guard: it proves the crop geometrically instead. */
    return { ...base, question: key, guardKind: key };
  }

  const question = entry.question.from === "accessoryRegion" || entry.question.from === "deliveredRegion"
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
 * WHAT AN OPEN KIND IS, IN THE CATALOGUE'S OWN RECORD SHAPE.
 *
 * Every field is `openKindPolicy`'s answer or a derivation from horns — the one
 * kind that has travelled this road for real — and the reason for each is on the
 * line. `SlotDefinition` is a total record, so a branch that answers it at all
 * has to answer all of it; that totality is the point of synthesizing a key
 * rather than threading an open kind past the catalogue as a special case.
 *
 * The noun grammar is the normalizer's, asked without throwing: a key that is
 * not one the open lane could have minted gets `null`, exactly like every other
 * key the catalogue has never heard of.
 */
function openSlotDefinition(slot: FeatureSlot): SlotDefinition | null {
  /*
    THE TOKEN, AND IT IS NOT THE STYLIST'S WORD — say so here rather than let a
    later reader assume it (found by the call-site sweep, reported in opus-568).

    The design note's premise was that "the stylist's word and the model's key
    are the same string", and that was true while every specimen was one word.
    Once the key is a single token (fable-775 §3) it stops being true: `cat ears`
    and `cat-ears` both key as `open:cat-ears`, so **the display noun cannot be
    recovered from the key and must never be derived from it.** The real noun,
    spaces intact, is stored beside the ask and on the library row.

    So the fields below carry the TOKEN, and every copy path is required to read
    the stored noun instead. `recipeAssembler` already does (`entry?.noun ??
    ask.noun`, and it refuses outright when neither answers); the scope-copy path
    is unreachable because the scope door refuses an open key and an open kind
    draws no panel row to point at. The one live consumer of the token is
    `question` — see its own note.
  */
  /*
    THE SIDE COMES OFF FIRST, THROUGH THE GRAMMAR'S OWN PARSER (fable-1001 §1).

    A distributed kind files one row per side — `open:wings@left` — and the
    token this branch validates is the KIND, never the key. Splitting the string
    here would be the second speller of a grammar that has exactly one owner,
    which is the defect fable-1001 §2 required swept rather than repeated.
  */
  const parsed = openKindOfSlot(slot);
  if (parsed === null) return null;
  const token = parsed.kind;
  if (!isOpenKindKey(token)) return null;
  const noun = token;
  return {
    slot,
    feature: noun,
    /*
      NULL for every kind but a DISTRIBUTED one, and the exception is the D1
      wire (founder ruling fable-987 §1, shape ruled fable-1001).

      It read `null, ALWAYS` until 2026-08-19, on the ground that an open kind is
      singular until promoted and *per-instance geometry is exactly what
      promotion buys*. That sentence stays true about the SURFACE and is what
      keeps the kind unscopable — the scope door still refuses an open key, the
      panel still draws no per-side row, and nothing customer-facing learns to
      say `@left`. What changed is underneath it: a kind whose instances sit on
      opposite sides cannot be pictured by one crop, so the LIBRARY files one row
      per side. The instance here is the storage grammar arriving, never a
      surface promotion.
    */
    instance: parsed.side,
    /*
      The horns precedent, and its reason transfers verbatim: horns are not
      worn, they GROW — she is not carrying them and cannot take them off the
      way a hoop comes out of a lobe. An open kind is asked for, not put on.
      `anatomy` also means the words ride every render beside the crop, which is
      what fable-566 requires of a feature that must not re-roll.
    */
    tier: "anatomy",
    /*
      STATED, NOT DERIVED — the least-wrong of four closed values. Nobody has
      catalogued this thing, so no grouping is honest. It decides panel ordering
      only, and an open kind draws no row, so this value is inert by
      construction. Declared here so that the day it stops being inert, this
      line is what gets read.
    */
    group: "face",
    /* The panel draws catalogued rows. A kind nobody has catalogued has no row
       to draw, and inventing one would put an uncourted feature in the founder's
       face chart. */
    panel: {
      row: "none",
      why: `nobody has catalogued ${noun}, so there is no courted row to draw — it is askable in the `
        + `box and carried in the stack, and it earns a row at promotion`,
    },
    noun,
    /*
      ASKED OF THE DELIVERED FRAME, NEVER OF THE MASTER — the horns entry states
      the reason exactly: an open kind arrives through an edit, so segmenting the
      picture she has now asks where a thing is that she has not got.

      **DECLARED: this asks the segmenter for the TOKEN, so a two-word kind is
      asked as `cat-ears` rather than `cat ears`.** It is the one place the
      single-token key reaches a model, it is engine-facing rather than
      customer-facing, and whether it costs anything is a MEASUREMENT rather
      than an argument — filed in opus-568 with the specimens to run it on.
      Named here instead of left as a coincidence, because a question the reader
      answers slightly worse is exactly the kind of quiet ceiling the fidelity
      law is about.
    */
    question: noun,
    /* And the one field where the closed invariant cannot hold. See
       `noSpecimen` below and `SlotDefinition`'s own note. */
    guardKind: null,
    /*
      `openKindZoneScope()` is `fullFrame`, and `ownSide` is meaningless for a
      slot with no instance — which is every open kind but a distributed one.

      A side key gets `ownSide` for the same reason `earring@left` does, stated
      at `SlotFrame`: asked of the whole frame a two-sided question comes back as
      the union of both sides, and a crop taken from it would be a picture of
      both wings filed as one, scoring 100% against the very mask it was cut
      from. The mint refuses rather than cutting when the reader cannot scope to
      a side, and that refusal is what produces the specimen.
    */
    frame: parsed.side === null ? "wholeFrame" : "ownSide",
    /* The default every slot should keep: `everyRender` re-buys vision calls to
       re-photograph a feature nobody edited. */
    remint: "whenEarned",
    /* Drawn from the region it is cut from, like almost every slot. */
    display: null,
    noSpecimen: openKindNoSpecimenReason(noun),
  };
}

/**
 * WHY NO INK SLOT HAS A COMPLETENESS GUARD — recorded, never left null.
 *
 * The catalogue's invariant is that `guardKind` is null exactly when `question`
 * is, stated over the CLOSED catalogue. An ink slot has a question — the
 * placement's measured reader word — and no specimen family, which breaks the
 * biconditional the same way an open kind does and for a REASON OF ITS OWN.
 *
 * **The ground is not "nobody has measured it yet". It is that there is nothing
 * here to measure** (ruled fable-1137 §3): a completeness family judges a CROP
 * WE CUT against specimens of that kind, and ink is never cut for the library.
 * The design's pixels are the customer's own, already sitting at
 * `casting_ink_designs.storageKey` with a digest, and the recipe reads them
 * there on every assembly. A `guardKind` naming a family nothing will ever
 * consult would be a field declared inert on the day it was written — and the
 * one thing worse than an unmeasured guard is a guard that reads as measured.
 *
 * An open placement has a SECOND reason on top of this one and it is the open
 * lane's: her own word for a surface names no region anybody has measured, so
 * there is no region to cut from even if this road ever cut.
 */
function inkNoSpecimenReason(placement: string, measured: boolean): string {
  const second = measured
    ? ""
    : ` — and "${placement}" names no surface the vocabulary has measured, so there is no `
      + "region to cut from either";
  return "an ink slot is never cut for the library (fable-1137 §3): the design's own bytes are "
    + "the carrier, read from the design row at assembly time, so no crop of ours exists for a "
    + `completeness family to judge${second}`;
}

/**
 * WHAT A TATTOO AT A PLACE IS, IN THE CATALOGUE'S OWN RECORD SHAPE.
 *
 * The shape is not invented here — the `ink` facet card specified it in a
 * `notASlot` reason written as a fence: *"ink is per placement and its question
 * comes from the placement rather than from a region table"*, and *"inventing a
 * `tattoo` question here would ask a segmenter an open question (D-213)"*. So
 * there is a slot per PLACEMENT, its question is the placement's own MEASURED
 * word, and no new word is asked of any model.
 *
 * `null` for a key this lane could not have minted, exactly like every other
 * key the catalogue has never heard of.
 */
function inkSlotDefinition(slot: FeatureSlot): SlotDefinition | null {
  const parsed = inkPlacementOfSlot(slot);
  if (parsed === null) return null;
  const placement = parsed.placement;
  /*
    THE TOKEN'S SHAPE RULE IS THE SLOT GRAMMAR'S, ASKED OF THE GRAMMAR ITSELF.

    A placement phrase may be the customer's own word (fable-1078: a
    reference-tattoo ask is never refused on placement), and her word can hold a
    space — `parseSlot` refuses one, so a spaced key would resolve here and be
    refused downstream by a grammar this branch had quietly disagreed with. The
    open lane paid for that exact gap once (`openKindPolicy`'s kebab note:
    resolved here, refused at the library door, AFTER the render was paid for).

    So the rule is not restated — the grammar's own parser is asked whether the
    composed key survives it. One owner, and the day `parseSlot` changes this
    branch changes with it.
  */
  if (placement === "" || parseSlot(inkSlotKey(placement)) === null) return null;
  const measured = isInkPlacement(placement);
  const entry = measured ? inkPlacementEntry(placement) : null;
  /*
    THE SIDE IS THE VOCABULARY'S ANSWER, never this branch's.

    `upperArm` is `perSide` and the other two are `one`, so a sided key for a
    one-of-it surface and a sideless key for a paired one are both refused —
    the same two rejections the closed catalogue makes on `entry.instances.of`,
    read off the placement table instead of a second copy of it.

    An OPEN placement is exempt in both directions and that is honest rather
    than lax: nobody has measured whether her word names one surface or a pair,
    and refusing the sideless key would turn an unmeasured question into a
    refusal, while refusing the sided one would drop a side she stated out loud.
  */
  if (entry !== null) {
    if (entry.sides === "perSide" && parsed.side === null) return null;
    if (entry.sides === "one" && parsed.side !== null) return null;
  }
  /* The surface in ordinary words, from the vocabulary's copy for a measured
     one and from her own phrase for an open one. `left upper arm tattoo` — the
     bare, plain form every other slot's noun takes. */
  const surface = entry === null ? placement : inkPlacementBareNoun(entry.key);
  const noun = `${parsed.side === null ? "" : `${parsed.side} `}${surface} tattoo`;
  return {
    slot,
    /* The placement token, the way an open kind's feature half is its own
       token: the prefix is the namespace and the feature is what is in it. */
    feature: placement,
    instance: parsed.side,
    /*
      A tattoo is INTRODUCED AND WORN, which is the tier's own first example —
      *"an earring, a tattoo, her own glasses"*. It is not anatomy: she did not
      arrive with it, the master does not hold it, and it arrives through an
      edit carrying its own picture.
    */
    tier: "item",
    /* Where on her it is, in the panel's four words. `neck` and `upperChest`
       sit on the torso group's half of the body rather than the face chart's;
       an open placement has no measured region and takes the same answer,
       which is inert either way while the row below is `none`. */
    group: "body",
    /*
      NO ROW, AND THE ROOM IS THE REASON RATHER THAN THE FEATURE.

      The panel this catalogue draws is the FACE chart, and a tattoo on an upper
      arm is not a face feature. The surface a customer sees her designs on is
      the ink studio, which is owed and unbuilt (fable-1138 §3) — so drawing a
      row here would put a tattoo in the wrong room to avoid saying it has none.
    */
    panel: {
      row: "none",
      why: `a design belongs in the ink studio rather than the face chart, and that surface is `
        + `owed — ${noun} is askable and carried, and it earns its row when the room exists`,
    },
    noun,
    /*
      THE PLACEMENT'S OWN MEASURED WORD, and NO NEW ONE (D-213, and the facet
      card's own caution).

      `neck`, `upper arm`, `upper chest` were bought on sixteen production
      masters (`V3B_PLACEMENT_VOCABULARY_READING.md`) — the reading where
      `collarbone`, `clavicle` and `decolletage` returned nothing on skin that
      was plainly bare while `upper chest` found it exactly. It is derived off
      the entry rather than retyped, so the day a better word is measured this
      follows it.

      An open placement asks her own word, which is the open lane's precedent
      and its declared limit: engine-facing, and whether it reads worse than a
      measured one is a MEASUREMENT nobody has taken for a surface nobody has
      catalogued.

      **DECLARED INERT TODAY.** Nothing asks it: ink never mints, so no cut is
      ever scoped by this word, and `catalogueSlots()` — the scan's enumeration
      — holds the closed catalogue only. It is written because the day a render
      has to be VERIFIED at the place it painted, this line is what gets read,
      and the alternative is inventing the word in that sitting.
    */
    question: entry === null ? placement : entry.readerWord,
    /* And the field where the closed invariant cannot hold. See
       `inkNoSpecimenReason` — the ground is that nothing of ours is cut. */
    guardKind: null,
    /*
      `ownSide` for a sided key for the same reason `earring@left` has it: asked
      of the whole frame, a two-sided question comes back as the union of both
      sides. Inert while nothing asks — declared, not assumed.
    */
    frame: parsed.side === null ? "wholeFrame" : "ownSide",
    /* Inert with the two above: a slot that never mints never re-mints. The
       default is the one every slot should keep. */
    remint: "whenEarned",
    display: null,
    /*
      NO `pairNoun`, AND ITS ABSENCE IS A STATEMENT.

      A matched pair is the earring's premise — one thing worn in twos, spoken
      about as one row while it matches. Two designs on two arms are two
      designs: they are separate uploads, separate rows, separate bytes, and a
      customer who put different artwork on each arm has not got a diverged
      pair, she has got two tattoos. Supplying a pair noun would invite the
      panel to say *"her upper arm tattoos"* about them.
    */
    noSpecimen: inkNoSpecimenReason(placement, measured),
  };
}

/**
 * What this slot is — or `null` when the catalogue has never heard of it.
 *
 * Null rather than a default: a slot nobody catalogued is a feature nobody
 * decided the tier of, and the unowned-axis class says an unowned field falls
 * to the loudest prior on every tile at once.
 */
export function slotDefinition(slot: FeatureSlot): SlotDefinition | null {
  /*
    THE ONE DYNAMIC BRANCH, AND IT IS CONFINED TO THE OPEN NAMESPACE
    (fable-760 §2a, `OPEN_LANE_CARRY_DESIGN.md` §2).

    Before `parseSlot`, deliberately: the open key rides a separator the slot
    grammar does not use, so recognising it here is what keeps the closed
    `feature@instance` grammar untouched. One branch, one exit, and it can only
    ever be entered by a key carrying the prefix.
  */
  if (isOpenSlot(slot)) return openSlotDefinition(slot);
  /*
    THE SECOND DYNAMIC BRANCH, CONFINED THE SAME WAY (ruled fable-1137 §2a).

    Before `parseSlot` for the identical reason the open branch is: `ink:neck`
    holds no space, so the closed grammar would parse it as a FEATURE called
    `ink:neck` and hand it to `entryOf`, which has never heard of it — null, by
    accident rather than by decision. Recognising the namespace here is what
    makes the ink lane's answer a decision.
  */
  if (isInkSlot(slot)) return inkSlotDefinition(slot);

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
 * The slots the mint re-cuts on EVERY delivered render, whatever this one
 * earned.
 *
 * Derived from the one catalogue rather than listed a second time here: a
 * parallel list of "slots that re-mint" is exactly law 4's copy, and it would be
 * wrong the first time a slot's rule changed. One member today (`build`), and
 * the reason is on its entry.
 */
export function slotsRemintedEveryRender(): SlotDefinition[] {
  return catalogueSlots().filter((definition) => definition.remint === "everyRender");
}

/**
 * THE SLOTS ONE FEATURE OCCUPIES — one, or one per side.
 *
 * A caller that knows the feature (`hair`, `earring`) should never have to know
 * whether it is worn in twos: `slotDefinition("earring")` refuses by design, and
 * a caller papering over that refusal by appending `@left` itself is the second
 * list this catalogue exists to prevent.
 *
 * `null` — not `[]` — for a feature the catalogue has never heard of, because
 * "this feature has no slots" and "nobody catalogued this feature" are different
 * answers and only one of them is a bug.
 */
export function slotsForFeature(feature: string): SlotDefinition[] | null {
  const entry = entryOf(feature);
  if (entry === undefined) return null;
  return entry.instances.of === "perSide"
    ? INSTANCES.map((instance) => definitionOf(entry, instance))
    : [definitionOf(entry, null)];
}

/** The facets whose words land in this slot's stack, in catalogue order. */
export function facetsOfSlot(slot: FeatureSlot): readonly Facet[] | null {
  const parsed = parseSlot(slot);
  if (parsed === null) return null;
  return entryOf(parsed.feature)?.facets ?? null;
}

/**
 * WHERE THIS FACET'S WORDS GO, resolved all the way to slots.
 *
 * `FACET_SLOTS` answers with a feature, a FAMILY, or a reason it is not a slot;
 * this turns all three into the list a writer can actually file against, and the
 * family is where the accessory gap is closed.
 *
 * **An accessory's slot comes from the described OBJECT, not from the facet.**
 * `statedAccessories` is one facet over every kind of thing a face can wear — an
 * earring at the lobe, glasses at the eyes — which is exactly why it has no
 * region of its own and why the harvest already derives a kind from the words
 * (`accessoryKindOf`). That derivation is the caller's to make and to pass in
 * here; deriving it a second time from the same words in this module is the copy
 * that drifts, and the two would then disagree about whether an ask was about
 * ears or eyes.
 *
 * A kind the table does not know returns `[]` rather than an invented slot: the
 * honest answer is that this product cannot yet name what she is wearing.
 */
export function slotsForFacet(
  facet: Facet,
  context: { accessoryKind?: string | null; inkPlacement?: InkAskPlacement | null } = {},
): SlotDefinition[] {
  const assignment = FACET_SLOTS[facet];
  if ("notASlot" in assignment) return [];
  if ("family" in assignment) {
    const kind = context.accessoryKind;
    if (!kind) return [];
    return slotsForFeature(kind.replace(/ /g, "-")) ?? [];
  }
  if ("perPlacement" in assignment) {
    /*
      THE PLACEMENT COMES IN, exactly as the accessory's kind does — see
      `FacetAssignment`'s own note for why it cannot come off the table.

      Empty on absence, which the caller turns into ink's own named refusal.
      It is NOT `notASlot`: this facet has a slot, and what is missing is the
      one fact that says which. Through `slotDefinition` rather than
      `slotsForFeature` because the ink lane is a dynamic branch and the closed
      catalogue has never held these keys — the same call every other consumer
      of an ink key makes, so a change to the grammar reaches here for free.
    */
    const placement = context.inkPlacement;
    if (!placement) return [];
    const key = placement.side === null
      ? inkSlotKey(placement.placement)
      : inkSideSlotKey(placement.placement, placement.side);
    const definition = slotDefinition(key);
    return definition === null ? [] : [definition];
  }
  return slotsForFeature(assignment.feature) ?? [];
}

/**
 * THE FAN-OUT, NARROWED TO THE ONE INSTANCE SHE POINTED AT (fable-444, ruling C).
 *
 * A bilateral facet fans out to one slot per side, which is what makes "her
 * eyes" one sentence and two references. A scope says *this ask is about that
 * one instance*, and every consumer of {@link slotsForFacet} on a scoped render
 * has to narrow the same way or the two disagree about what the render was.
 *
 * It lives HERE, beside the fan-out it narrows, because it has two callers and a
 * second copy of it is working law 4's mirror: `repaintAsks` narrowed and the
 * mint did not, so a scoped green eye would have been PAINTED on one eye and
 * FILED on both — the library's `eye@right` row claiming a delivery its own
 * render never made, on the strength of a verdict about the other eye. The
 * library is what ruling C makes the memory of per-side, so a mint that fans out
 * is the ruling failing at the one place it is load-bearing.
 *
 * Deliberately a FILTER of what the catalogue already returned rather than a
 * lookup of its own: a scope can only ever NARROW the list this facet was always
 * going to produce, so a scope naming a slot this facet does not have narrows to
 * nothing and the caller's own refusal fires instead of quietly painting — or
 * filing — the whole face.
 */
export function narrowToScope(
  definitions: readonly SlotDefinition[],
  scope: FeatureSlot | undefined,
): SlotDefinition[] {
  if (scope === undefined) return [...definitions];
  return definitions.filter((definition) => definition.slot === scope);
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
    /* DERIVED, NEVER MIRRORED. The reason lives on the definition; this hands
       it to the mint door, which is the reader fable-766 §2's bound requires.
       A spec that dropped it would leave an open kind indistinguishable from a
       jaw — a question the vocabulary cannot name — and it would file words
       forever while looking configured. */
    ...(definition.noSpecimen === undefined ? {} : { noSpecimen: definition.noSpecimen }),
    frame: definition.frame,
  };
}
