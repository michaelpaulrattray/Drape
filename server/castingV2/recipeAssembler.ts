/**
 * THE RECIPE ASSEMBLER — where D-244, the Edit Law, lives in code.
 *
 * The founder's ruling (2026-08-10, *"this isn't Photoshop"*): **words change,
 * crops carry.** Every edit REGENERATES its feature from that feature's ANCHOR
 * plus its FULL word stack; a feature's own carry crop NEVER rides in its own
 * edit; a feature nobody touched rides its minted crop, pixel-frozen; removal
 * is striking the words and regenerating from the anchor with what survives.
 *
 * This module turns a cast's reference library plus a set of asks into the
 * exact list of references and word stacks one render sends. It is the single
 * place those decisions are made, so there is no second list to drift from it
 * (working law 4).
 *
 * # It REFUSES rather than repairs
 *
 * Every refusal is a `RecipeRefusal` the caller can act on rather than an
 * exception to be swallowed:
 *
 *  - **`carriesItsOwnEdit`** — D-244 line 2. A recipe that hands a feature its
 *    own crop while editing it is the contaminated mint, and the whole law
 *    exists to make it unreachable. Refused structurally, not avoided by
 *    convention.
 *  - **`slotTwiceReferenced`** — fable-174 (founder): one slot, one reference,
 *    per render. Two references claiming one feature are conflicting
 *    instructions, and the assembler makes them impossible to express.
 *  - **`emptyWordStack`** — the one thing D-244 leaves load-bearing. Line 2
 *    regenerates from the FULL stack, so a lost or empty delta is a silently
 *    forgotten edit; an ask that carries no words for a slot with no anchor
 *    would regenerate the feature from the master with nothing said about it,
 *    which is a quiet revert dressed as an edit.
 *  - **`surfaceCarriesCrop`** — the carry contract below. A surface that holds
 *    a minted crop is a slot built against the one tier that has no working
 *    instrument to catch it, so it is refused at construction instead.
 *  - **`nounNotBare`** and **`slotNotNamed`** — the prompt is built here, so
 *    the grammar it needs is checked here. A feature the render cannot name is
 *    a feature it cannot ask about, and a determiner that arrived with a noun
 *    queues behind the one the template supplies.
 *
 * # THE CARRY CONTRACT, PER TIER (fable-192, measured — not precautionary)
 *
 * The count bisect and the configuration diff measured what a reference crop can
 * do to a master that disagrees with it, and the answer is graded (§3.0a):
 *
 *   introduced ITEM     the crop is the carrier            proven outright
 *   ANATOMY             the crop rides AND the word stack rides in EVERY
 *                       recipe — words are the carrier of record, the crop is
 *                       an assist worth about a third of its own value
 *   SURFACE             words only, always. No crop ever rides for a surface,
 *                       and there is currently no instrument that can certify
 *                       one if it did.
 *
 * *"Measurable is not delivered."* A crop that wins a third of the distance is
 * not what a customer would call *"she has those lips"*, so crop strength alone
 * never backs a carry promise for anatomy. That is why anatomy's words ride even
 * on renders that do not touch it, and why this is behavior here rather than
 * advice in a document.
 *
 * # The reference ORDINALS and the prompt sentences are derived together
 *
 * "Reference 2 is her lips" is only true if the lips crop is the second element
 * of the array actually sent. Those two have to be built in one pass or they
 * drift — the class this codebase keeps meeting. So the assembler emits both,
 * from one loop, and nothing downstream is permitted to reorder the references
 * without rebuilding the sentences.
 *
 * # The degenerate case is not an edge case
 *
 * A cast with no library and a words-only ask assembles to **the master alone,
 * plus words**. That is the road every NEW cast travels first (fable-171's
 * condition 1), and it falls out of the same code path rather than being
 * special-cased — a second path for the common case is how a fork hides
 * defects.
 *
 * Nothing calls this yet. It lands dark by having no call site, which is the
 * only kind of dark a pure function needs.
 */

import { vacantPhraseFor } from "./vacancyPhrases";
import { capitalize, type CastPronouns } from "./castPronouns";
import { IMPERATIVE_OPENER } from "./declarativeState";
import { accessoryKindOfSlot, type SlotWordsRefusal } from "./slotWordShape";
import { untrueWordsRefusal } from "./referenceWordsSupersession";
import { slotDefinition } from "./referenceSlotCatalogue";
/* The open lane's key grammar has ONE owner and this module reads it rather
   than splitting a string (fable-1001 §1). `referenceSlots` imports nothing, so
   there is no cycle to weigh here. */
import { isInkSlot, openKindOfSlot } from "./referenceSlots";
import {
  inkDeliveredCarrySentence, inkDeliveredTransformSentence, inkNotOnClothingClause,
  inkRealismClause,
} from "./inkRealism";
import type { InkTransform } from "../../shared/inkTransforms";
import { imageHalfClause } from "./sidePhrasing";
import { inkDesignWasExamined, type InkCutRoute } from "../../shared/inkCutRoute";

/** A library key is a PANEL SLOT — the stylist's ontology, never `facet@region`
 *  (fable-173). Bilateral features are stored per instance and spoken as pairs
 *  (fable-167): `eye@left`, `earring@right`. */
export type FeatureSlot = string;

export type ReferenceImage = {
  /** Storage key or equivalent handle. The assembler never reads bytes. */
  key: string;
  /** For the record and for byte-identity proofs at the wire. */
  sha?: string;
};

export type ReferenceRole =
  | { kind: "master" }
  /** An introduced item's FROZEN INTRODUCTION REFERENCE (D-192/D-244 line 3):
   *  a tattoo's flash sheet, a makeup look's source image, a lip shape's source
   *  image. Pixel-stable forever; it is what the item's edits regenerate from. */
  | { kind: "anchor"; slot: FeatureSlot }
  /** The crop minted from the last delivery that touched this slot (line 4).
   *  Rides untouched renders byte-identical; never its own slot's edit. */
  | { kind: "carry"; slot: FeatureSlot }
  /**
   * A PICTURE THE CUSTOMER SUPPLIED FOR THIS EDIT — the fourth role (approved
   * fable-1096 §1), and it is honestly a fourth thing.
   *
   * Not the master, not ours, not minted from any delivery, and not frozen at
   * an introduction: it is a reference SHE attached, cut down to the feature
   * she is pointing at, and it belongs to the one ask that carries it. D-244
   * line 3 is untouched by it — anatomy still regenerates from the master, and
   * a source rides BESIDE that rather than standing in for it.
   *
   * The alternative was widening `anchor` to accept an anatomy slot, and it was
   * refused: an anchor meaning both *the thing this feature regenerates from*
   * and *a picture she attached once* is how a slot loses its meaning three
   * shifts later.
   *
   * **Per ask by construction**, which is what makes the regenerate answer true
   * by type rather than by care (§9.8): a regenerate re-runs the same ask, the
   * ask holds its `referenceId`, so the source re-rides and the failed
   * attempt's harvest never enters.
   */
  | { kind: "source"; slot: FeatureSlot };

/**
 * Which carrier the tier boundary gives this feature (§3.0a, fable-192).
 *
 * It is REQUIRED on every entry and has no default. A defaulted tier is the
 * unowned-axis class: every entry would silently fall to whichever value the
 * author happened to type first, identically, and nothing downstream would
 * show it.
 */
export type FeatureTier =
  /** Introduced and worn: an earring, a tattoo, her own glasses. Crop carries. */
  | "item"
  /** Geometry the master owns: lips, eyes, brows, hair, the shape of her face.
   *  Crop rides AND the words ride, every render. */
  | "anatomy"
  /** Worn state on a slot: gloss, a tan, a makeup look. Words only, always. */
  | "surface";

export type LibraryEntry = {
  slot: FeatureSlot;
  /** The carrier this feature gets. See {@link FeatureTier}. */
  tier: FeatureTier;
  /**
   * Present only for INTRODUCED features. Anatomy and surfaces have no anchor
   * entry: their anchor is the master, and the master is always reference 1.
   * Born-worn accessories (her own glasses) are in the master too, so they are
   * anatomy for this purpose (D-244 line 3).
   */
  anchor?: ReferenceImage;
  /** Minted from the frame that last delivered this slot. Absent until one has. */
  carry?: ReferenceImage;
  /** Every word ever accepted about this slot, oldest first. The full stack. */
  words: readonly string[];
  /**
   * How the slot is spoken about — the stylist's wording, not the engineer's key.
   *
   * **Always bare, and plain**: `"lips"`, `"hair"`, `"left eye"`, `"left
   * earring"`. The NOUN names the slot; the DESCRIPTION rider carries the
   * specifics, so "the exact left earring she has — a wide gold hoop, unchanged"
   * says each thing once. Every template below supplies its own determiner — "the exact
   * ${noun}", "keep ${possessive} ${noun}" — and a determiner that arrived with
   * the noun would queue behind them ("the exact the wide gold hoop"). A part of
   * her takes the possessive; a worn item takes an article. That is the
   * worn-versus-hers distinction `segmentsOnFace` already draws, one layer up.
   */
  noun: string;
  /**
   * THIS SLOT IS EMPTY — she took the thing off, and the anchor still wears it.
   *
   * The library's third role, read (migration 0030, fable-326/327). Its `words`
   * are the site's own vacant phrase, and they must be said on EVERY subsequent
   * render rather than once: the master is reference 1 of every render on this
   * road and it has her glasses on it forever, so a recipe that goes quiet about
   * them is a recipe that paints them back. Proved with pictures before this
   * field existed — remove, then ask for copper hair, and the glasses return.
   *
   * It travels as a flag rather than as "an entry with no images" because the
   * two are not the same thing: an anatomy slot nothing has delivered yet also
   * has no images, and it is not empty — it is undescribed.
   */
  vacant?: true;
};

export type Ask = {
  slot: FeatureSlot;
  /** Needed only for a slot the library has never held — a feature the render
   *  cannot name is a feature it cannot ask about. */
  noun?: string;
  /** The DELTA — what this render adds. Empty only when `remove` is set. */
  words?: string;
  /**
   * Removal is not a rollback: it strikes matching words from the stack and
   * regenerates from the anchor with what survives (D-244 line 5). Each entry
   * must match a word already in the slot's stack.
   */
  remove?: readonly string[];
  /**
   * THE SLOT GOES VACANT for this render (chunk 3,
   * `LIBRARY_REMOVAL_DESIGN.md` §3).
   *
   * Neither asked nor carried: an empty word stack, no crop (the carry loop
   * already skips edited slots), and no anchor — sending the frozen
   * introduction reference of the thing being taken off would hand the painter
   * a picture of it.
   *
   * **The sentence is required, and that is the whole point.** Dropping the
   * words and the crop leaves the recipe SILENT about the feature, and the
   * master is reference 1 — so a born-worn item (her own glasses, in the master
   * by definition) gets painted straight back on by the render that was meant
   * to remove it. Carrying the sentence in the type rather than checking for it
   * at runtime is deliberate: a vacate that cannot say the absence should not
   * be constructible, because the corner where one exists is a paid render that
   * quietly does nothing.
   *
   * `says` is DERIVED by the caller from the slot catalogue
   * (`vacantPhraseFor`), never authored per ask — fable-195's rule about
   * descriptions, and the same reason: a sentence generated from the record has
   * nowhere to diverge to. The assembler cannot reach the catalogue itself
   * (the catalogue imports this module's types), so the derivation belongs one
   * layer out, exactly as `accessoryKind` already does.
   */
  vacate?: { says: string };
  /**
   * THIS SLOT'S ASK HAS BEEN TAKEN BACK — the prune's own shape (V3(c),
   * fable-536 §2).
   *
   * A prune deletes the step that added a thing and recomposes what is left, so
   * there is nothing to ADD and nothing to strike: the carry list is derived
   * from the surviving chain (`prunedCarries`), the crop simply stops riding,
   * and the render anchors on the pristine master which never had the thing.
   * That road is measured — the horns removal court read 3/3 gone and 3/3 clean
   * by dropping the carry alone.
   *
   * So why an ask at all, if the recipe says nothing? **Because the verification
   * needs a question at the wire.** A prune that arrived as an ABSENCE of asks
   * would give the net nothing to check, and the render would ship unverified
   * on precisely the fact it exists to change. This names the slot and what was
   * taken back, so the assembler can state it, the reader can be asked about it,
   * and `nothingAsked` keeps meaning exactly what it says.
   *
   * It is not `vacate`: a vacancy SAYS an absence and retires the slot, which is
   * right for a thing the master itself has and wrong for a thing an edit added
   * — retiring here would make a prune irreversible, and re-adding the step must
   * bring the crop back.
   */
  restate?: { taken: string };
};

export type AssembleInput = {
  master: ReferenceImage;
  /** The cast's own pronouns, never assumed. `segmentsOnFace` shipped "hers"
   *  onto a male candidate's face before this was passed rather than guessed. */
  pronouns: CastPronouns;
  /** The cast's reference library. An empty library is the degenerate case. */
  library: readonly LibraryEntry[];
  asks: readonly Ask[];
  /**
   * ASKS WITH NOTHING TO CUT AND NOTHING TO CARRY (fable-446).
   *
   * `expression` is the first of them: presentation rather than identity
   * (D-136), `fullFrame` in every zone table, and a decided `notASlot` in the
   * catalogue — *"there is nothing to cut and nothing to carry"*. Until this
   * existed the road refused the ask outright and gave the money back, which
   * was honest and was still a customer typing *make her smile* and getting a
   * refund.
   *
   * So it rides as WORDS ONLY. It is deliberately not an {@link Ask}: an ask is
   * keyed on a slot, and a slot is what the mint files, the carry crops and the
   * verification counts as delivered. A presentation clause reaches exactly one
   * place — the change sentence — and the invariants that keep the library
   * honest cannot see it, which is the point rather than an omission.
   */
  presentation?: readonly PresentationClause[];
  /**
   * THE PICTURES SHE ATTACHED, one per slot at most (fable-1096 §2).
   *
   * Each must name a slot this render ASKS about — a picture riding with
   * nothing said about it is a reference the painter is free to read as
   * anything — and a slot may carry one, never two.
   *
   * The caller passes what the picture IS, not what to say about it: the prose
   * is written here, from a closed vocabulary, so that a carrier is described
   * to the engine honestly and identically on every render. That is the scale
   * court's lesson in a type — calling a redacted form *"only hair"* would be
   * lying to the engine about what it is looking at, and the court measured
   * what that costs.
   */
  sources?: readonly RecipeSource[];
  /**
   * THE DESIGNS ALREADY ON HER THAT THIS RENDER IS NOT ABOUT — see
   * {@link CarriedInkDesign}.
   *
   * Absent is *nothing carries*, which is every render this product served
   * before it existed and every render on a Cast with no applied design.
   *
   * **The caller decides WHICH designs are applied on this branch**, and this
   * module does not and must not: a Cast holds rows a customer merely uploaded
   * and rows minted for a cut she then declined, and painting one of those onto
   * her next unrelated edit would be a tattoo she never asked for at full
   * price. What arrives here is the answer, never the question.
   */
  carriedInk?: readonly CarriedInkDesign[];
  /**
   * SAY WHERE A SIDE IS, as well as whose it is (`CASTING_SIDE_PHRASING_SCOPE`).
   *
   * Decided by the caller because the flag is per user and this function knows
   * nothing about users — the same reason `pronouns` arrives rather than being
   * looked up. Absent is off, which is the sentence this assembler has always
   * written.
   */
  placeSides?: boolean;
};

/**
 * WHAT A SOURCE PICTURE ACTUALLY SHOWS — a closed vocabulary, because the
 * sentence describing it has to be true.
 *
 * Each member arrives with the road that mints that kind of carrier, and with
 * its own sentence rather than by widening a neighbour's. Calling a redacted
 * form *"only hair"* would be lying to the engine about what it is looking at,
 * and the scale court measured what that costs.
 *
 * # THE NAME IS THE CONTAINMENT (ruled fable-1137 §2d)
 *
 * `inkDesignOnTransparency` is literally what `cutOutPixels` produces — the
 * design in its own pixels, everything else alpha-zero. It is named for the
 * OBJECT rather than for the feature so that the fence is legible in the type
 * itself: **a future member called `inkFromPhoto` would read as the violation
 * it would be**, and it would have to be written by a hand that could see it
 * saying so. That is the whole reason this vocabulary is closed rather than a
 * string.
 *
 * The uploaded photograph is not a member and cannot become one by accident.
 *
 * `inkAsDelivered` (the transform road, fable-1274 §1) reads under exactly the
 * same rule and passes it: those bytes are a crop of a frame THIS PRODUCT
 * PAINTED, harvested by the delivery mint, never anything a customer uploaded.
 *
 * ⚠ **DERIVED FROM `SourceKind` AS OF 2026-08-21, and that is the fence too.**
 * It was written out as a literal union, and the day `inkAsDelivered` joined
 * `SourceKind` this list silently stopped naming every member — a second list
 * shadowing a source of truth, drifting the way working law 4 says they always
 * do, in the one place whose whole job is to enumerate what may be sent. It had
 * no caller left to notice.
 */
export type SourcePicture = SourceKind["pictures"];

/**
 * WHAT KIND OF PICTURE THIS IS, AND WHAT THAT KIND OWES.
 *
 * A union rather than a flag, because the ink road carries an obligation the
 * hair road does not have and OPTIONAL IS WHAT THE DEFECT LOOKS LIKE — the same
 * lesson `scope` below is written from. A caller assembling an ink source must
 * state what was done to the bytes before they were stored; there is no shape
 * of this type in which it can forget, and forgetting is the failure that would
 * send an unexamined photograph to an engine.
 *
 * `null` is a legal value and is REFUSED at assembly (`sourceNotExamined`).
 * That is the distinction the type cannot make and the door can: the caller is
 * forced to SAY which of the three it is, and saying "nobody looked" is
 * answered with a refusal rather than a render.
 */
type SourceKind =
  | { pictures: "hairOnRedactedForm" }
  | {
    pictures: "inkDesignOnTransparency";
    /** What was done to these bytes before they were stored — the design row's
     *  own column (migration 0047). `null` means nobody looked. */
    cutRoute: InkCutRoute | null;
  }
  /**
   * THE TATTOO SHE ALREADY HAS, ON THE RENDER THAT CHANGES IT (fable-1274 1).
   *
   * The transform road's whole shape, and it is a SOURCE rather than a carry for
   * the reason the two types already differ: a source belongs to an ASK and
   * carries the ask's own words; a carry has no ask and says *keep what is
   * there*. A customer asking to make it bigger is asking about that slot, so
   * the slot is EDITED and its picture is a source.
   *
   * It is also why the naive build is already refused. Pass the same slot as a
   * source AND in `carriedInk` and `carriesItsOwnEdit` fires -- *one picture
   * twice with two sentences, keep it exactly as it is beside change it to
   * this*. That refusal was written for D-244 line 2 and it stands guard over
   * this road unaltered, which is the proof the road is sited correctly.
   *
   * `change` rides on the source rather than inside `scope` because it is a
   * CLOSED value the sentence owner reads, not free prose: the whole point is
   * that a transform cannot describe a design, only a change to one.
   *
   * # ⚠ A DELIVERED CROP IS NEVER EDITED DIRECTLY (founder rule, fable-1275 §1)
   *
   * The bytes this member points at are always cut from a REAL DELIVERED FRAME.
   * A retouched crop would claim a state no render ever produced — the
   * minted-loss class inverted, a record running AHEAD of reality instead of
   * behind it. So every change to a tattoo is a RENDER: the mint cuts the new
   * baseline from the new frame, and a render that hides the surface cannot
   * update the record at all, which is the disputed machinery correctly keeping
   * the old baseline rather than a gap.
   *
   * Its consequence is a real one and is on the founder's record: editing a
   * COVERED piece needs a render that shows the skin. The narrow answer that
   * builds without settling the whole wardrobe question is the ASK-SCOPED
   * VISIBILITY EXCEPTION (fable-1276 §2) — an edit targeting a covered piece
   * lowers the neckline FOR THAT RENDER ONLY, and the next render re-anchors to
   * his own outfit, because the master winning is the feature rather than the
   * bug.
   *
   * # The partial edit, and why it is not an exclusion clause (fable-1276 §1)
   *
   * *"Remove one swallow"* does NOT become prose the painter has to parse. The
   * ask's source is a PER-ASK COPY of the stored crop with the named or tapped
   * motif alpha'd out — the engine is handed a reference that simply lacks the
   * element, which is the same discipline as every other picture on this road:
   * the instruction is in the bytes, not in a sentence about the bytes.
   *
   * The two rules meet without contradicting: INSTRUCTION MATERIAL is editable
   * (that copy is made for one ask and dies with it), the RECORD is not. The
   * stored crop is untouched, and it updates only when a delivered frame says
   * so. Words do the isolating until the tap lands; the tap makes it precise.
   */
  | {
    pictures: "inkAsDelivered";
    change: InkTransform;
  };

export type RecipeSource = SourceKind & {
  slot: FeatureSlot;
  image: ReferenceImage;
  /**
   * WHAT THIS PICTURE IS ALLOWED TO GIVE HER — and it is REQUIRED, which is the
   * whole of the design (ruled fable-1108 §2).
   *
   * A crop cannot scope itself: a picture of a haircut is a picture of a
   * haircut in SOME colour whether anybody asked for the colour or not. So the
   * words are the only scoping instrument there is, and his fable-1048
   * amendment — *"if someone wanted a hairstyle but a different hair color its
   * important that the words that ride along with the reference state it the
   * style only not the color"* — lives or dies on this field arriving.
   *
   * **Optional is what the defect looked like.** The take was resolved,
   * courted, logged and then dropped one line before the recipe, so `style` and
   * `fullLook` dispatched byte-identical prompts and a customer who asked to
   * keep her own colour was given the reference's. A required field means a
   * source that says nothing about what it claims does not COMPILE — the class
   * killed rather than the instance.
   *
   * Composed by its owner (`hairTakeSentence`) at the call site that knows the
   * take. This module splices; it does not decide what a take claims, because
   * that list lives beside the facets it is derived from.
   */
  scope: string;
};

/**
 * A DESIGN SHE ALREADY HAS, ON A RENDER THAT IS NOT ABOUT IT — the ink carry.
 *
 * # The hole it fills, measured
 *
 * Ink never enters `casting_reference_library` (ruled fable-1137 §3): the
 * design row is the durable, digest-verified, purge-pathed home of those bytes
 * and a library copy would be the second list that drifts. That ruling settled
 * where the bytes LIVE and left open what puts them back on the next render —
 * so a delivered tattoo survived exactly as long as the ask that asked for it.
 *
 * Read off the wire rather than reasoned about (opus-864 §1): step one painted
 * a chest piece and step two, *"give him green eyes"*, dispatched the master
 * and one hair crop. No ink reference, no ink clause. The composed delta still
 * held the customer's ink words — the CHAIN remembered and the RECIPE did not.
 *
 * # Why it is not a {@link RecipeSource}
 *
 * A source belongs to an ASK — `sourceNotAsked` refuses one whose slot this
 * render says nothing about, and that refusal is right: a picture nobody has a
 * sentence for is a picture the painter may read as anything. A carry is the
 * opposite shape. There is no ask, the sentence is *keep what is already
 * there*, and the slot lands in `carried` rather than `edited` — so the
 * verification asks *is it still there* instead of *did it arrive*.
 *
 * # Why it is not a {@link LibraryEntry} either
 *
 * A library carry is a crop harvested from the frame that last delivered the
 * slot. This is the customer's own artwork on transparency, which is a
 * different picture and must be described as a different picture: calling a
 * redacted form *"only hair"* is the lie the scale court priced, and calling a
 * design-on-transparency *"the exact tattoo he has"* and stopping there would
 * be the same lie with the alpha channel unexplained.
 */
export type CarriedInkDesign = {
  slot: FeatureSlot;
  image: ReferenceImage;
  /**
   * The catalogue's own bare noun for the placement — `upper chest tattoo`,
   * `left upper arm tattoo`. Bare, like every other noun this module is
   * handed, because the template supplies the determiner.
   */
  noun: string;
} & (
  /**
   * WHICH PICTURE THIS CARRY IS — a union rather than a flag, and the two
   * members carry different fields because they are different pictures with
   * different obligations (the discipline {@link SourceKind} is written on).
   *
   * `designArtwork` is the customer's own design on transparency: the road this
   * lane travelled alone until clause (a). It must state what was done to those
   * bytes, because they are HERS and an unexamined upload is possibly a
   * photograph of a person.
   *
   * `deliveredCrop` is a cut of one of OUR OWN delivered frames — the tattoo as
   * it landed on her, at the size it landed, with the boundary in the picture.
   * It carries no `cutRoute` and cannot: nothing of the customer's upload is in
   * those bytes, and a field asking *what was done to her picture* about a
   * render would be a fence pointed at the wrong object. The containment rule
   * is not weakened by its absence — a delivered crop can only exist for a
   * design that already rode to a render, which the same fence had to pass.
   */
  | {
    picture: "designArtwork";
    /**
     * What was done to these bytes before they were stored — the design row's
     * own column (migration 0047). `null` means nobody looked, and it REFUSES
     * here exactly as it refuses on a source: a carry is a render too, and an
     * unexamined design reaching an engine is the same exposure whichever door
     * it came through. Required rather than optional for {@link SourceKind}'s
     * reason — a caller that could forget is a caller that will.
     */
    cutRoute: InkCutRoute | null;
  }
  | { picture: "deliveredCrop" }
);

/**
 * One presentation fact, said in the recipe and filed nowhere.
 *
 * `noun` is bare (`expression`) for the same reason a slot's is: this module
 * decides whether a thing takes an article or a possessive, and a caller that
 * shipped "her expression" would be that decision made twice.
 */
export type PresentationClause = { noun: string; words: string };

export type RecipeReference = {
  role: ReferenceRole;
  image: ReferenceImage;
  /** The sentence naming this reference by the ordinal it actually occupies.
   *  The master's is the identity clause, and it is reference 1. */
  sentence: string;
};

/**
 * A feature nobody touched this render, whose words ride anyway.
 *
 * Anatomy and surfaces both get one: for anatomy the sentence rides BESIDE the
 * carried crop (words are the carrier of record, the crop is the assist); for a
 * surface it is the only thing that rides at all.
 */
export type StandingWords = {
  slot: FeatureSlot;
  noun: string;
  words: readonly string[];
  sentence: string;
};

export type Recipe = {
  ok: true;
  /** In send order. Element 0 is always the master. */
  references: readonly RecipeReference[];
  /** The slots this render edits — the DELIVERED column of verification. */
  edited: readonly FeatureSlot[];
  /**
   * The slots whose ask this render TOOK BACK — named, and deliberately not in
   * `edited`: nothing was delivered into them, and the verification asks the
   * opposite question about them (is it gone) from the one it asks about an
   * edit (is it there).
   */
  restated: readonly FeatureSlot[];
  /** Every slot this render promises to hold — the CARRIED column. An item or
   *  anatomy slot carries by crop, a surface by words alone; all three are
   *  promises, so all three are verified. */
  carried: readonly FeatureSlot[];
  /**
   * The slots this render declared VACANT — a subset of `edited`.
   *
   * The mint's only licence to retire a crop. A departure is carried by this
   * list and never by the reader's silence: `noCut` on an untouched slot has at
   * least three causes with no departure among them, and a library that retired
   * on that signal would delete her earrings because a render came out shadowy
   * (`LIBRARY_REMOVAL_DESIGN.md` §4).
   */
  vacated: readonly FeatureSlot[];
  /** Per edited slot, the full word stack that regenerates it. A vacated slot
   *  appears here holding nothing — present and empty, never absent. */
  wordStacks: ReadonlyMap<FeatureSlot, readonly string[]>;
  /** The reference sentences, in ordinal order, ready to join with the ask. */
  sentences: readonly string[];
  /** The carry contract's word half, in library order — anatomy and surfaces
   *  that this render does not touch but must still say out loud. */
  standing: readonly StandingWords[];
  /** The change instruction, in the proven small-ask frame. Empty when nothing
   *  is asked (a pure carry render). */
  ask: string;
  /**
   * THE STACK ENTRIES THIS RECIPE REFUSED TO SAY — usually empty.
   *
   * A row already in the database whose prose is UNTRUE about its own slot. The
   * row is left exactly where it is (nothing here rewrites history); it simply
   * does not speak on this render. Reported rather than dropped in silence,
   * because a prompt that quietly says less than the library holds is
   * indistinguishable from a library that lost a fact — see {@link
   * withheldWords} for the whole argument.
   */
  withheld: readonly WithheldWords[];
  /**
   * THE WHOLE PROMPT, in send order, and the only text a caller sends.
   *
   * It is built here so that "reference 3 is her hair" is true of the array
   * that actually goes out. A caller that composed its own prose from the parts
   * would be the second list this codebase keeps meeting — right until someone
   * reorders the references and nobody notices, because the drift is invisible
   * in every output except the picture.
   */
  prompt: string;
};

/**
 * One stack entry that did not reach the prompt, and why.
 *
 * `slot` and `word` are what was withheld; `reason` is the door's own vocabulary
 * (`wordsNameAnotherKind`, `wordsClaimThePair`, `wordsDescribeTheArtifact`),
 * never a second spelling invented here.
 */
export type WithheldWords = {
  slot: FeatureSlot;
  word: string;
  reason: SlotWordsRefusal["reason"];
  detail: string;
};

export type RecipeRefusal = {
  ok: false;
  reason:
    | "carriesItsOwnEdit"
    | "slotTwiceReferenced"
    | "emptyWordStack"
    | "removeNotInStack"
    | "surfaceCarriesCrop"
    | "nounNotBare"
    | "slotNotNamed"
    | "wordsNotDeclarative"
    /** A vacate carrying words as well — see `Ask.vacate`. */
    | "vacateAlsoAsks"
    /** A prune's ask was given something to say as well — see `Ask.restate`. */
    | "restateAlsoAsks"
    /** A prune's ask named nothing, so nothing could be verified about it. */
    | "restateSaysNothing"
    /** A vacate whose sentence is empty; the recipe would go silent. */
    | "vacateSaysNothing"
    /** A presentation clause with no words — see {@link AssembleInput.presentation}. */
    | "presentationSaysNothing"
    /**
     * A source picture naming a slot this render does not ask about.
     *
     * Refused rather than dropped: a reference in the request that no sentence
     * accounts for is a picture the painter may read as anything, and a recipe
     * that silently discards what a customer attached is the confession class
     * D-181 exists to prevent — one layer too late to say anything about it.
     */
    | "sourceNotAsked"
    /**
     * AN INK DESIGN WHOSE BYTES NOBODY HAS LOOKED AT (ruled fable-1137 §4).
     *
     * `cutRoute` has three answers and the third is the one this exists for:
     * `cut` (the design was cut out of the picture she gave us), `rideWhole`
     * (the cutter looked and the picture was already the design), and `null` —
     * NOBODY LOOKED, because `CASTING_INK_CUT_SCOPE` was off for that account
     * when the row was written.
     *
     * On this road unexamined means POSSIBLY A PHOTOGRAPH OF A PERSON, which is
     * the exposure the cutter exists to close. Every row stored before that flag
     * flips holds unexamined bytes, so the hole is not hypothetical — it is the
     * exact set of rows the flag's off-period created, and a refine wire without
     * this line would quietly re-open it for them.
     *
     * **Refused, never skipped.** A silent skip would paint the ask without the
     * design and charge for it, which is the confession class one door along.
     */
    | "sourceNotExamined"
    /**
     * A CARRIED DESIGN WHOSE SLOT IS NOT AN INK SLOT.
     *
     * {@link CarriedInkDesign} takes a `FeatureSlot`, which is a string, so
     * `hair` type-checks. The sentence this loop writes says *tattoo design*
     * and *artwork on a transparent background*, and saying that about a hair
     * crop would be the scale court's lie with the roles swapped — the engine
     * told what a picture is by a template rather than by the picture.
     *
     * Refused rather than described some other way: the caller has assembled
     * something incoherent, and the honest answer to an incoherent recipe is
     * the refund, not a second sentence for it.
     */
    | "inkCarryNotInkSlot";
  /** Null for a refusal about something that has no slot by construction. */
  slot: FeatureSlot | null;
  detail: string;
};

export type AssembleResult = Recipe | RecipeRefusal;

/** A possessive replaces an article; it never queues behind one. */
const LEADING_DETERMINER = /^(?:a|an|the|her|his|their|its)\s+/i;

/**
 * THE DECLARATIVE-STATE CONTRACT (fable-195), and it is a contract with our own
 * interpreter rather than a detector judging a picture.
 *
 * The marker and its reasoning now live in `declarativeState`, imported rather
 * than restated: the interpreter's prompt names the same openers to the model
 * that this refuses on the way in, and two copies of that list would drift the
 * day one of them grew a word (working law 4). This module keeps the REFUSAL;
 * that one keeps the rule.
 */

/**
 * THE ASK, kept small on purpose.
 *
 * The bisect stripped the carrying recipe to two references and it still
 * carried, so what survived of the bundle is the naming form and **the size of
 * the ask** — name each reference for what it is, and do not ask for a region
 * redraw in the same breath (§3.0a, fable-192). Building the sentence here is
 * what makes that behavior rather than advice: a caller cannot paste a
 * paragraph into a frame it does not own.
 *
 * The clause states the feature's WHOLE target state — the full word stack, not
 * the delta alone — because that is what D-244 line 2 regenerates from.
 */
/**
 * WHERE THAT SIDE IS IN THE PICTURE — behind `CASTING_SIDE_PHRASING_SCOPE`,
 * decided by the caller, which is the only side that knows whose render this is.
 *
 * Her right eye is on the LEFT of the photograph, and the engine appears to
 * paint by position rather than by anatomy: a court of twelve renders put a
 * per-side eye edit on the named eye 6/6 when the named side was her LEFT (the
 * image's right) and 3/6 when it was her RIGHT (the image's left) — the misses
 * all landing on the image's right half, whatever the recipe named
 * (`V4_SIDE_INFERENCE_COURT.md`).
 *
 * That is a positional bias rather than a naming confusion, and it suggests one
 * cheap lever: say the side BOTH ways, so the anatomy the customer means and the
 * half of the picture it lives in cannot disagree. It is an experiment, it is
 * dark until its own court runs on the failing arm, and it says nothing this
 * product does not already know — the sides come from the same catalogue the
 * panel draws its boxes from.
 */
function whereItIs(slot: FeatureSlot, placeSides: boolean): string {
  if (!placeSides) return "";
  const definition = slotDefinition(slot);
  if (definition === null || definition.instance === null) return "";
  /* Through the shared owner rather than spelled here: the view-reference lane
     says the same sentence now, and two copies of a measured phrase drift at
     exactly the place the phrase exists to hold still (fable-1006 §3). */
  return imageHalfClause(definition.instance);
}

function askSentence(
  asks: readonly Ask[],
  bySlot: ReadonlyMap<FeatureSlot, LibraryEntry>,
  wordStacks: ReadonlyMap<FeatureSlot, readonly string[]>,
  possessive: string,
  presentation: readonly PresentationClause[],
  placeSides: boolean,
): string | { unnamed: FeatureSlot } | { saysNothing: string } {
  const clauses: string[] = [];
  for (const ask of asks) {
    /*
      A TAKEN-BACK SLOT CONTRIBUTES NO CLAUSE — see `Ask.restate`.

      The thing was added by an edit and this render anchors on the pristine
      master, which never had it; the carry list no longer holds it either. So
      there is nothing to say, and saying something would be the vacancy road
      (which is for what the photograph itself brought). It is skipped here
      rather than given an empty clause, because an ask with no words and no
      noun is exactly what `slotNotNamed` is for on every OTHER shape.
    */
    if (ask.restate) continue;
    if (ask.vacate) {
      /*
        THE ABSENCE IS SAID IN THE SAME BREATH AS EVERY OTHER CHANGE.

        It rides the "Change only …" sentence rather than getting a sentence of
        its own, because a removal IS one of this render's changes and a second
        sentence about it would be a second instruction about one feature — the
        thing this assembler refuses everywhere else. The phrase names the SITE
        as well as the absence ("bare earlobes", "her face uncovered"), which is
        the same lesson `HAIR_ARRANGEMENTS` paid for: a wording that tells the
        reader WHERE beats one that tells it what to conclude.
      */
      /*
        AND SAID ONCE (fable-332). A pair vacates two slots in one breath, and
        each of them carries the kind's phrase — which put the same sentence in
        the change clause twice: *"Change only no earrings — both earlobes bare,
        nothing hanging from either ear; no earrings — both earlobes bare,
        nothing hanging from either ear."* Two instructions about one fact is
        the thing this assembler refuses everywhere else; the second copy adds
        no fact and is dropped rather than deduplicated downstream.
      */
      if (!clauses.includes(ask.vacate.says)) clauses.push(ask.vacate.says);
      continue;
    }
    const entry = bySlot.get(ask.slot);
    const noun = entry?.noun ?? ask.noun;
    if (noun === undefined || noun.trim() === "") return { unnamed: ask.slot };
    /* A worn item takes an article; a part of her takes the possessive
       (`segmentsOnFace`'s worn-vs-hers distinction, one layer up, and the same
       reason: a stylist speaks about a thing, and about her). */
    const named = entry?.tier === "item" ? `the ${noun}` : `${possessive} ${noun}`;
    clauses.push(`${named}${whereItIs(ask.slot, placeSides)}: ${(wordStacks.get(ask.slot) ?? []).join(", ")}`);
  }
  /*
    AND THE PRESENTATION CLAUSES RIDE THE SAME SENTENCE.

    Last, so a smile reads as the note it is beside the features that were
    changed, and in the same breath rather than in a second instruction — the
    rule the vacate phrase already obeys, for the same reason (§3.0a: one small
    ask, not a paragraph).

    A clause with nothing to say REFUSES here rather than being dropped. It
    cannot happen through the door upstream, which is exactly why it is asserted
    here: `Change only her expression: .` is a paid render told to change
    something into nothing, and a silent drop would be the same render with no
    trace of what went missing.
  */
  for (const clause of presentation) {
    const noun = clause.noun.trim();
    const words = clause.words.trim();
    if (noun === "" || words === "") return { saysNothing: noun === "" ? "(unnamed)" : noun };
    clauses.push(`${possessive} ${noun}: ${words}`);
  }
  if (clauses.length === 0) return "";
  return `Change only ${clauses.join("; ")}.`;
}

/**
 * THE DESCRIPTION RIDER (fable-194, founder-confirmed): every reference is NAMED
 * for what it is, optionally followed by a SHORT DESCRIPTION that strengthens it.
 *
 * **Derived from the slot's own record at emission, never authored beside it**
 * (fable-195). That is what keeps it from becoming the thing this assembler
 * refuses elsewhere — two instructions about one feature. A description
 * generated from the entry's own accepted words cannot diverge from them,
 * because there is nowhere for it to diverge to.
 *
 * It also settles where anatomy's word half rides. fable-192 requires the word
 * stack in EVERY recipe; a slot with a reference now carries its words on that
 * reference's own sentence, and a slot without one gets a standing sentence.
 * Said once, attached to the thing it is about.
 */
/**
 * WHAT A CARRIED CROP IS CALLED — and it is never re-described.
 * (Founder chase of 2026-08-15, ruled in fable-598 §2: POINT, DON'T DESCRIBE.)
 *
 * This used to emit the slot's whole word stack beside its picture, and his own
 * dispatched prompt is the record of what that costs:
 *
 *   Reference 2 is the exact left earring she has — Small silver cross pendant
 *   on a thin silver chain, plain narrow crucifix shape…, unchanged.
 *   Reference 3 is the exact right earring she has — Silver-tone cross pendant
 *   with rounded tubular arms and beveled edges, suspended from a curb-link
 *   chain, unchanged.
 *
 * Two pictures of ONE object — 34 and 35 pixels wide, the same cross — and two
 * different sentences about it. Both crosses drifted on that render and the
 * right one drifted worse: the side whose sentence sat furthest from what its
 * own crop showed.
 *
 * **A carried crop is the fact. A description beside it is a second author
 * arguing with the picture**, and when they disagree the engine has to choose.
 * So the words name the slot and the claim, and nothing else.
 *
 * It also serves the founder's own pair rule (fable-592) BY CONSTRUCTION: a
 * matched pair rides two agreeing crops, a deliberately mismatched pair rides
 * its two honest ones, and there is no sentence anywhere to force agreement
 * onto either.
 */
function describe(entry: LibraryEntry): string {
  return `the same ${entry.noun}, unchanged`;
}

/**
 * The word stack a slot regenerates from on THIS render.
 *
 * Removal strikes; a delta appends. Both leave one ordered list, and that list
 * is the whole instruction for the feature — the anchor supplies the pixels it
 * started from and nothing else does.
 *
 * # THE ASK SUPERSEDES THE VACANCY (fable-401, and the founder found it live)
 *
 * A vacancy's words are an absence — *"no glasses — her face uncovered, no
 * frames, no lenses…"* — filed so that every LATER render re-says it and the
 * master does not paint her glasses back on. That rule is right for every slot
 * this render is not touching, and exactly wrong for the one it is: an ask that
 * puts the thing BACK is the newest answer about that slot, so appending it to
 * the absence dispatched both instructions in one clause —
 *
 *   "Change only the glasses: no glasses — her face uncovered, …, glasses."
 *
 * — which is what the founder paid 25 credits for twice on production v#182.
 * The painter obeyed the vacate, the verifier honestly saw no glasses, and the
 * render refused into the refund. **A user could not reverse a removal**, and
 * removal-and-reversal is one promise, not two.
 *
 * So the absence stands down for its own slot the same way an edited slot's
 * carry crop already does, and for the same reason: never send a reference — in
 * pixels OR in words — that contradicts the stated ask (fable-318 R2). It
 * stands down only when the ask actually SAYS something; a bare strike against
 * a vacancy still meets `removeNotInStack`, which is the honest answer to
 * taking off what is already off.
 *
 * The landing half needs nothing: `deriveLibrary` gives `state` to the newest
 * row, so the re-add's own reference wins the slot back the moment it mints.
 */
function stackFor(entry: LibraryEntry | undefined, ask: Ask): readonly string[] | { missing: string } {
  const asked = ask.words !== undefined && ask.words.trim() !== "";
  const existing = entry?.vacant === true && asked ? [] : entry?.words ?? [];
  let survived = [...existing];
  for (const strike of ask.remove ?? []) {
    const at = survived.indexOf(strike);
    if (at === -1) return { missing: strike };
    survived.splice(at, 1);
  }
  if (asked) survived.push(ask.words!.trim());
  return survived;
}

/**
 * THE IDENTITY CLAUSE — reference 1, named the way the carrying recipe named it.
 *
 * The pronoun tracks the cast rather than the specimen the form was measured on
 * (`segmentsOnFace` paid for that lesson: a male candidate's eyes called "hers"
 * in front of his own face). The FORM is what carried; the pronoun never was
 * part of it.
 */
function identityClause(pronouns: CastPronouns): string {
  return [
    `Reference 1 is the photograph of this person — reproduce ${pronouns.object} exactly:`,
    "same face, same pose, same lighting, same framing, same background.",
  ].join(" ");
}

/**
 * WHAT A SOURCE IS SAID TO BE — and it is said to be exactly what it is.
 *
 * The wording is the scale arm's own, which is the wording that DELIVERED: the
 * length arrived 2/2 with the grey form described and explicitly excluded from
 * the instruction, and stayed short 2/2 on a plain cutout carrying the same
 * length sentence. So the honesty is not manners — the picture being described
 * as what it is is part of what made it work.
 */
function sourceSentence(
  ordinal: number,
  source: SourceKind,
  pronouns: CastPronouns,
  noun: string,
): string {
  switch (source.pictures) {
    case "hairOnRedactedForm":
      return [
        `Reference ${ordinal} is the picture supplied for ${pronouns.possessive} hair:`,
        "it shows hair on a plain grey form standing in for a head.",
        "The grey form is NOT part of the instruction — it is there only to show how long",
        `the hair is relative to a head. Match that length and that shape on ${pronouns.object}.`,
      ].join(" ");
    /*
      THE DESIGN, AND NOTHING ELSE THAT WAS IN ITS PICTURE.

      What the engine is shown is the cutter's own output — the artwork on
      transparency — so the honest description is the short one, and saying it
      is the same discipline the arm above bought: the picture is described as
      what it IS, and the grey form's precedent is that stating the part which
      is not the instruction is what made the instruction land.
    */
    case "inkDesignOnTransparency":
      return [
        `Reference ${ordinal} is the tattoo design supplied for this edit:`,
        "it is the artwork alone on a transparent background, with nothing else from the",
        "picture it came from. The transparent area is NOT part of the instruction — it is",
        "there only so the design's own shape and edges are unambiguous.",
        /*
          AND WHAT A TATTOO IS ON SKIN — the clause this lane never had, and the
          reason his chest frame came back reading as a drawing (fable-1179 §2a).
          Everything above describes the PICTURE; without these two sentences the
          only instruction about the RESULT is "reproduce that artwork", and
          reproduction of a drawing is a drawing.
        */
        inkRealismClause(pronouns),
        inkNotOnClothingClause(pronouns),
      ].join(" ");
    /*
      THE TRANSFORM, SAID BY THE CARRY'S OWN OWNER.

      Not composed here. `inkDeliveredTransformSentence` is the same function
      that writes the carry sentence with one clause swapped, so the two cannot
      come to disagree about what this picture IS — and what it is took three
      frames and three clauses to get right.
    */
    case "inkAsDelivered":
      return inkDeliveredTransformSentence(ordinal, noun, pronouns, source.change);
  }
}

/**
 * A DESIGN SHE ALREADY HAS, SAID AS A CARRY — see {@link CarriedInkDesign}.
 *
 * Two halves, in the order the source path already proved: the PROVEN NAMING
 * FORM first — *"Reference N is the exact ${noun} ${subject} ${has}"*, the
 * wording the carry bisect held fixed while it stripped everything else away —
 * and then the honesty about what the picture IS.
 *
 * The second half is not manners. The scale arm measured that describing the
 * grey form, and explicitly excluding it from the instruction, is part of what
 * made the instruction land; the transparent background is the same fact about
 * a different picture, and a carry that stopped at the naming form would hand
 * the painter an alpha channel with nothing said about it.
 *
 * And it ends by saying the one thing a carry means that an edit does not:
 * **it is already there.** A tattoo the recipe merely NAMES is a tattoo the
 * engine may re-draw somewhere else at some other size, which is drift wearing
 * a carry's clothes.
 */
function inkCarrySentence(ordinal: number, noun: string, pronouns: CastPronouns): string {
  const has = pronouns.plural ? "have" : "has";
  return [
    `Reference ${ordinal} is the exact ${noun} ${pronouns.subject} already ${has}:`,
    "the artwork alone on a transparent background, with nothing else from the picture it",
    "came from. The transparent area is NOT part of the instruction — it is there only so",
    `the design's own shape and edges are unambiguous. ${capitalize(pronouns.subject)} already ${has} this tattoo:`,
    "keep it exactly as it is, in the same place and at the same size.",
    /*
      "KEEP IT EXACTLY" IS ABOUT THE DESIGN, NEVER ABOUT THE MATERIAL.

      Said alone it is the decal instruction — it was the whole of what this lane
      told the painter, and a carried tattoo re-drawn as reproduced artwork is
      the same defect as a fresh one. Same shape, same place, same size; drawn as
      ink in skin every time.
    */
    inkRealismClause(pronouns),
    inkNotOnClothingClause(pronouns),
    /*
      ⚠ AND THE BOUNDARY CLAUSE THAT USED TO BE HERE IS GONE — `8f0515d2`,
      reverted in clause (a)'s own commit (fable-1194 §2c).

      It said where the design stops, in the founder's own words, as a place
      rather than a prohibition. `490` carried it on the wire in full and drew
      the design a third of the way down a white T-shirt, exactly as the two
      arms before it had. Three clauses, three shirts: the extent is not a word
      problem, and this lane's `at the same size` points at 1200x1697 of artwork
      with no body in it on a render anchored to a master with no tattoo on it,
      so the painter has nothing to measure whatever else it is told.

      **This sentence is the FALLBACK now**, said only when no delivered crop
      exists for the design — see {@link inkDeliveredCarrySentence}, which is
      the same instruction pointed at a picture that contains the size. The
      measurement is kept in `inkRealism.ts`'s header rather than as a clause
      nobody wanted to be the one to remove.
    */
  ].join(" ");
}

/**
 * THE LIBRARY AS THIS RECIPE IS ALLOWED TO SAY IT (fable-1266 §1b).
 *
 * The write door has refused a malformed word stack since the earring rows named
 * her glasses — but only from the day it landed, and only for the shapes it
 * could reach. Two gaps meet here:
 *
 *   the past    every row written BEFORE the door existed is still in the
 *               database, still carrying whatever it said, and D-244 re-says a
 *               slot's whole stack on every edit. Eight production earring rows
 *               named her glasses.
 *   the reach   the door's kind check returned early for anatomy, so no skin or
 *               build row was ever asked what its prose said. On a tattooed
 *               torso, *"Describe this person's skin"* answers with the ink —
 *               and the ink already has an author with GEOMETRY, the design's
 *               own crop, which says the same design in the same place at the
 *               same size. The words say "tattooed chest" and float.
 *
 * # Why it withholds instead of refusing the recipe
 *
 * `wordsNotDeclarative` a few lines below refuses the whole render for a bad
 * persisted word, and this could have been written as its neighbour. It is not,
 * and the reason is the module's own cost model: *a refusal costs the render its
 * reference and costs the user nothing.* Refusing HERE would cost the user the
 * render — a customer whose cast holds one old row would have every later refine
 * fall into the refund until somebody rewrote her library. The correct outcome
 * is the one the ink lane already has: the crop remains the single author, and
 * the render proceeds.
 *
 * # Why it is not a repair
 *
 * The offending STACK ENTRY is withheld whole. Nothing edits prose — a door that
 * rewrote the words would hide the regression it exists to catch, and a stack is
 * a list of captions, so dropping one caption still leaves every other version's
 * caption speaking. The database row is untouched.
 *
 * The untrue/untidy split is NOT re-derived here: `untrueWordsRefusal` owns it,
 * and a trailing full stop is untidy rather than untrue — blanking a true
 * sentence to fix its punctuation would delete a fact for nothing.
 */
function withheldWords(library: readonly LibraryEntry[]): {
  spoken: readonly LibraryEntry[];
  withheld: readonly WithheldWords[];
} {
  const withheld: WithheldWords[] = [];
  const spoken = library.map((entry) => {
    const kept = entry.words.filter((word) => {
      const refusal = untrueWordsRefusal(entry.slot, [word]);
      if (refusal === null) return true;
      withheld.push({ slot: entry.slot, word, reason: refusal.reason, detail: refusal.detail });
      return false;
    });
    return kept.length === entry.words.length ? entry : { ...entry, words: kept };
  });
  return { spoken, withheld };
}

export function assembleRecipe(input: AssembleInput): AssembleResult {
  /* Derived ONCE and used everywhere below, so no branch of this function can
     read a stack the recipe has decided not to say. `input.library` is not read
     again after this line. */
  const { spoken: library, withheld } = withheldWords(input.library);
  const bySlot = new Map(library.map((entry) => [entry.slot, entry]));
  const restated = input.asks.filter((ask) => ask.restate).map((ask) => ask.slot);
  /* A taken-back slot is not an edited one: nothing is delivered into it, and
     `edited` is the DELIVERED column of the verification. */
  const edited = input.asks.filter((ask) => !ask.restate).map((ask) => ask.slot);
  const editedSet = new Set(edited);
  /*
    A SOURCE BELONGS TO AN ASK, and the ask list is what says so.

    Checked against every ask INCLUDING a restate — a taken-back slot is not in
    `edited` — because what makes a source legal is that this render has a
    sentence about that feature, not that it delivers into it.
  */
  const sourceOf = new Map(input.sources?.map((source) => [source.slot, source]) ?? []);
  for (const source of input.sources ?? []) {
    if (!input.asks.some((ask) => ask.slot === source.slot)) {
      return {
        ok: false, reason: "sourceNotAsked", slot: source.slot,
        detail: `a picture was attached for ${source.slot}, which this render says nothing about`,
      };
    }
    /*
      A DESIGN NOBODY HAS LOOKED AT NEVER RIDES TO A RENDER (fable-1137 §4).

      Read off the design row's own `cutRoute`, which is the only thing that
      knows: `null` is not "unset", it is the recorded fact that
      `CASTING_INK_CUT_SCOPE` was off when those bytes were stored, so what sits
      at `storageKey` is the picture the customer uploaded rather than the
      design cut out of it — possibly a photograph of a person, which is the
      exposure the cutter exists to close.

      THE PREDICATE HAS ONE OWNER (ruled fable-1146 §3a). `inkDesignWasExamined`
      is the same function the PRE-CLAIM door asks, so the two cannot come to
      disagree about what "nobody looked" means — written out as `=== null` at
      both, they are two spellings of one rule, and the day the absence stops
      being spelled `null` only one of them would follow.

      Both doors, not one: the pre-claim door refuses FREE, which is the right
      shape for a fact known before the claim, and this one stays because THIS
      is the last door before an engine sees bytes. A backstop whose only test
      runs through a door that usually behaves is not a tested guard (law 3), so
      this arm is driven with the door bypassed. It is stated in the assembler's own refusal vocabulary so the
      caller answers it the way it answers every other malformed recipe: free,
      named, and never a silent skip.
    */
    if (
      source.pictures === "inkDesignOnTransparency"
      && !inkDesignWasExamined(source.cutRoute)
    ) {
      return {
        ok: false, reason: "sourceNotExamined", slot: source.slot,
        detail: `the design attached for ${source.slot} has not been through the cutter, so nobody has looked at what is in its picture; it needs its cut before it can ride to a render`,
      };
    }
  }
  const pronouns = input.pronouns;
  const possessive = pronouns.possessive;
  const has = pronouns.plural ? "have" : "has";

  const identity = identityClause(pronouns);
  const references: RecipeReference[] = [
    { role: { kind: "master" }, image: input.master, sentence: identity },
  ];
  const wordStacks = new Map<FeatureSlot, readonly string[]>();
  const claimed = new Set<FeatureSlot>();
  const sentences: string[] = [identity];
  /** Which reference each carried slot ended up at, so a standing sentence can
   *  point at it by the ordinal it actually occupies. */
  const ordinalOf = new Map<FeatureSlot, number>();
  /** The slots this render declared vacant, in ask order. The mint reads this
   *  to decide what may be retired, and NOTHING else may originate a departure
   *  (`LIBRARY_REMOVAL_DESIGN.md` §4). */
  const vacated: FeatureSlot[] = [];

  /** Ordinal in the sent array: the master is 1, so the next is length + 1. */
  const nextOrdinal = () => references.length + 1;

  for (const entry of library) {
    const imperative = entry.words.find((word) => IMPERATIVE_OPENER.test(word.trim()));
    if (imperative !== undefined) {
      return {
        ok: false, reason: "wordsNotDeclarative", slot: entry.slot,
        detail: `${entry.slot} holds "${imperative}", which is an instruction rather than a state; the stack is re-said in full on every edit and imperatives do not accumulate`,
      };
    }
    if (LEADING_DETERMINER.test(entry.noun)) {
      /*
        The templates below supply the possessive, and a possessive REPLACES an
        article rather than queueing behind it — "her a mullet" and "her the
        lips" were both live in real data before `segmentsOnFace` fixed the same
        grammar one layer up. A worn ITEM names itself and keeps its article.
      */
      return {
        ok: false, reason: "nounNotBare", slot: entry.slot,
        detail: `${entry.slot}'s noun "${entry.noun}" starts with a determiner; recipe nouns are bare and every template supplies its own`,
      };
    }
  }

  /* ---- the EDITED slots: anchor + full word stack, never their own crop ---- */

  for (const ask of input.asks) {
    const entry = bySlot.get(ask.slot);
    if (ask.restate) {
      /*
        NOTHING IS SAID, AND THAT IS THE POINT. The thing was added by an edit,
        the anchor is the pristine master that never had it, and the carry list
        no longer holds it — so the recipe stays silent and the master does the
        removing by arithmetic. Saying an absence here would be the vacancy
        road, which is for what the photograph itself brought.

        Refused rather than half-formed if it is given anything else to do: an
        ask cannot both take a thing back and describe it.
      */
      if ((ask.words !== undefined && ask.words.trim() !== "") || ask.vacate || ask.remove) {
        return {
          ok: false, reason: "restateAlsoAsks", slot: ask.slot,
          detail: `${ask.slot} is being taken back and also asked for; a slot cannot be undone and described in one render`,
        };
      }
      if (ask.restate.taken.trim() === "") {
        return {
          ok: false, reason: "restateSaysNothing", slot: ask.slot,
          detail: `${ask.slot} is being taken back with nothing named, so the verification would have no question to ask about it`,
        };
      }
      wordStacks.set(ask.slot, []);
      continue;
    }
    if (ask.vacate) {
      /*
        A VACATE IS THE WHOLE ASK FOR ITS SLOT, and the two refusals below say
        so rather than letting a half-formed one through.

        Words beside a vacate would be a render told to remove the earrings and
        describe them in the same clause; an empty sentence would leave the slot
        silent, which is the exact failure the sentence exists to prevent — the
        master is reference 1 and silence is an instruction to keep what is in
        it.
      */
      if (ask.words !== undefined && ask.words.trim() !== "") {
        return {
          ok: false, reason: "vacateAlsoAsks", slot: ask.slot,
          detail: `${ask.slot} is being vacated and also given words ("${ask.words}"); a slot cannot be taken off and described in one render`,
        };
      }
      if (ask.vacate.says.trim() === "") {
        return {
          ok: false, reason: "vacateSaysNothing", slot: ask.slot,
          detail: `${ask.slot} is being vacated with no sentence, so the recipe would go silent about it and the master would paint it back on`,
        };
      }
      /* Empty by construction, and RECORDED: `wordStacks` is what the record
         and the panel read, so a vacated slot must appear there holding
         nothing rather than be absent from it. */
      wordStacks.set(ask.slot, []);
      vacated.push(ask.slot);
      /* No anchor, deliberately — see `Ask.vacate`. The carry loop below skips
         it too, because a vacate puts the slot in `editedSet`. */
      continue;
    }
    if (ask.words !== undefined && IMPERATIVE_OPENER.test(ask.words.trim())) {
      /* The interpreter's own output, checked at the boundary it crosses. */
      return {
        ok: false, reason: "wordsNotDeclarative", slot: ask.slot,
        detail: `the ask for ${ask.slot} reads "${ask.words}", which is an instruction; the interpreter owes a state phrase`,
      };
    }
    const stack = stackFor(entry, ask);
    if ("missing" in stack) {
      return {
        ok: false, reason: "removeNotInStack", slot: ask.slot,
        detail: `"${stack.missing}" is not in ${ask.slot}'s word stack, so striking it would change nothing`,
      };
    }
    if (stack.length === 0 && !entry?.anchor) {
      /*
        Nothing to say and nothing introduced: regenerating from the master with
        an empty stack repaints the feature as she was born, which is a revert
        wearing an edit's clothes. The caller must mean a removal of the whole
        introduced thing, and that is a different ask.
      */
      return {
        ok: false, reason: "emptyWordStack", slot: ask.slot,
        detail: `${ask.slot} would regenerate from the master with nothing said about it`,
      };
    }
    wordStacks.set(ask.slot, stack);

    /*
      THE SOURCE RIDES HERE — with its ask, before the anchor, and inside the
      same `claimed` fence.

      Before the anchor check rather than after it, because that check ends in
      `continue` for anatomy: hair has no anchor, and a source placed after the
      continue would be a picture that never rode with the very feature it was
      cut for.
    */
    const source = sourceOf.get(ask.slot);
    if (source) {
      if (claimed.has(ask.slot)) {
        return {
          ok: false, reason: "slotTwiceReferenced", slot: ask.slot,
          detail: `${ask.slot} was given two references in one render (fable-174)`,
        };
      }
      claimed.add(ask.slot);
      ordinalOf.set(ask.slot, nextOrdinal());
      /*
        THE PICTURE, THEN WHAT IT MAY GIVE HER — two sentences, in that order.

        The description is APPENDED to rather than replaced: *"Match that length
        and that shape"* is the scale arm's own wording and it is what
        delivered, 2/2. Wiring a missing sentence and rewording a proven one in
        the same change would leave neither readable.
      */
      /*
        THE NOUN IS THE ASK'S OR THE LIBRARY'S, and an ink slot has no library
        row at all (ink never enters the library), so it comes off the ask.
        `slotNotNamed` below already refuses an ask that can supply neither.
      */
      const sourceNoun = entry?.noun ?? ask.noun ?? ask.slot;
      sentences.push(
        `${sourceSentence(nextOrdinal(), source, pronouns, sourceNoun)} ${source.scope}`.trim(),
      );
      references.push({
        role: { kind: "source", slot: ask.slot },
        image: source.image,
        sentence: sentences[sentences.length - 1]!,
      });
    }

    if (!entry?.anchor) continue; /* anatomy — the master is already reference 1 */
    if (claimed.has(ask.slot)) {
      return {
        ok: false, reason: "slotTwiceReferenced", slot: ask.slot,
        detail: `${ask.slot} was given two references in one render (fable-174)`,
      };
    }
    claimed.add(ask.slot);
    ordinalOf.set(ask.slot, nextOrdinal());
    sentences.push(
      `Reference ${nextOrdinal()} is the exact ${entry.noun} as it was introduced — the same ${entry.noun}.`,
    );
    references.push({
      role: { kind: "anchor", slot: ask.slot },
      image: entry.anchor,
      sentence: sentences[sentences.length - 1]!,
    });
  }

  /* ---- the CARRIED slots: the minted crop, pixel-frozen ---- */

  /*
    A DISTRIBUTED OPEN KIND IS TWO PICTURES OF ONE THING, AND IS SPOKEN OF ONCE
    (the D1 wire; ruled fable-1002 §2/§3 on the measurement in opus-737 §3).

    The library files such a kind per SIDE, because one crop cannot honestly hold
    two things on opposite sides of a body. Said with the ordinary form that
    produced two sentences each declaring itself THE thing:

      Reference 2 is the exact wings she has — the same wings, unchanged.
      Reference 3 is the exact wings she has — the same wings, unchanged.

    The earring precedent does not save it. `earring@left` carries the noun *left
    earring* from the catalogue, so its two sentences disambiguate; an open
    kind's noun is the CUSTOMER'S own word, identical on both rows, and no
    singular may be derived from it (`wings` → `wing` is a guess and `cat-ears` →
    `cat-ear` a worse one).

    So the two are collapsed into one clause holding both ordinals. **It says
    nothing about which picture is which side, deliberately**: the rows' side
    labels come from a mask, a per-side claim in prose is the
    image-half-not-anatomy trap, and on a CARRY the label is all risk and no
    information — what the engine needs to know is that these are halves of one
    feature, which the clause says.

    Derived here from the entries rather than authored anywhere, exactly as the
    wholly-vacant pair's collapse below is: the rows go on recording each side,
    and how that state is SAID is the assembler's job.
  */
  const sidedOpenCarries = new Map<string, FeatureSlot[]>();
  for (const entry of library) {
    if (!entry.carry || editedSet.has(entry.slot)) continue;
    const open = openKindOfSlot(entry.slot);
    if (open === null || open.side === null) continue;
    const held = sidedOpenCarries.get(open.kind) ?? [];
    held.push(entry.slot);
    sidedOpenCarries.set(open.kind, held);
  }
  /* Two, never one: the count gate refuses a crop unless both sides answered, so
     a lone per-side row is a library holding one from an earlier render — and
     "References 2 and 3" naming one picture would be a sentence about a
     reference that does not exist. */
  const collapsedOpenKinds = new Set(
    Array.from(sidedOpenCarries.entries())
      .filter(([, slots]) => slots.length === 2)
      .map(([kind]) => kind),
  );
  /** The first side's ordinal, held until the second arrives and the clause can
   *  name both. */
  const openPairFirst = new Map<string, { ordinal: number; at: number }>();
  /** Kinds whose one keep-sentence has already been said, so the second row goes
   *  quiet — the wholly-vacant pair's own mechanism, one loop along. */
  const openPairSaid = new Set<string>();

  for (const entry of library) {
    if (entry.carry && entry.tier === "surface") {
      /*
        A surface's carrier is words, always — that tier's crop was never proven
        to carry and there is currently no instrument that could certify one if
        it were. A minted surface crop means something upstream built a slot
        against the tier boundary, and it is refused here rather than sent.
        Checked before the edited/untouched split, because the defect is that the
        crop EXISTS, not that this particular render would have sent it.
      */
      return {
        ok: false, reason: "surfaceCarriesCrop", slot: entry.slot,
        detail: `${entry.slot} is a surface and is carried by words only; a minted crop must not ride for it`,
      };
    }

    if (!entry.carry) continue;
    if (editedSet.has(entry.slot)) {
      /*
        D-244 line 2, refused structurally. Reaching this branch means a caller
        built an edit that would hand a feature its own crop — the defect the
        law makes unreachable — so nothing is assembled and nothing is painted.
      */
      return {
        ok: false, reason: "carriesItsOwnEdit", slot: entry.slot,
        detail: `${entry.slot} is edited by this render and cannot also carry its own minted crop`,
      };
    }
    if (claimed.has(entry.slot)) {
      return {
        ok: false, reason: "slotTwiceReferenced", slot: entry.slot,
        detail: `${entry.slot} was given two references in one render (fable-174)`,
      };
    }
    claimed.add(entry.slot);
    ordinalOf.set(entry.slot, nextOrdinal());
    /*
      THE PROVEN NAMING FORM. "Reference N is the exact X ${subject} ${has}" is
      the wording the carrying recipe used, and the bisect held it fixed while
      it stripped everything else away — count and position fell, naming and ask
      size are what survived (§3.0a). So it is emitted here rather than left to
      each caller's prose.
    */
    const openSide = openKindOfSlot(entry.slot);
    const collapses = openSide !== null
      && openSide.side !== null
      && collapsedOpenKinds.has(openSide.kind);
    if (collapses) {
      const kind = openSide!.kind;
      const first = openPairFirst.get(kind);
      const mine = nextOrdinal();
      if (first === undefined) {
        /* The first side reserves its ordinal and says nothing yet — the clause
           cannot be written until the second picture has one. */
        openPairFirst.set(kind, { ordinal: mine, at: references.length });
        references.push({
          role: { kind: "carry", slot: entry.slot },
          image: entry.carry,
          /* Replaced below with the joint clause, so both references carry the
             sentence that is actually on the wire about them. */
          sentence: "",
        });
        continue;
      }
      const clause = `References ${first.ordinal} and ${mine} are the exact ${entry.noun} `
        + `${pronouns.subject} ${has}, one picture of each side — ${describe(entry)}.`;
      sentences.push(clause);
      references.push({
        role: { kind: "carry", slot: entry.slot },
        image: entry.carry,
        sentence: clause,
      });
      references[first.at] = { ...references[first.at]!, sentence: clause };
      continue;
    }
    sentences.push(
      `Reference ${nextOrdinal()} is the exact ${entry.noun} ${pronouns.subject} ${has} — ${describe(entry)}.`,
    );
    references.push({
      role: { kind: "carry", slot: entry.slot },
      image: entry.carry,
      sentence: sentences[sentences.length - 1]!,
    });
  }

  /* ---- the INK carries: her own artwork, from the design row, unedited ---- */

  /*
    AFTER the library's crops and before the standing words, which is where an
    ink carry belongs in both directions: it is a picture, so it goes with the
    pictures, and it is not a library row, so it cannot ride inside a loop over
    `input.library`.

    Every refusal below is one the library carry loop already makes for its own
    rows. They are re-made rather than shared because the two lists are
    different types with different owners — and a carry that skipped them would
    be the weaker door on the same law.
  */
  for (const design of input.carriedInk ?? []) {
    if (!isInkSlot(design.slot)) {
      return {
        ok: false, reason: "inkCarryNotInkSlot", slot: design.slot,
        detail: `${design.slot} was carried as an ink design and is not an ink slot, so the recipe would tell the painter a picture is a tattoo design when nothing says it is`,
      };
    }
    /*
      A DESIGN NOBODY HAS LOOKED AT NEVER RIDES TO A RENDER (fable-1137 §4),
      AND A CARRY IS A RENDER.

      Same predicate, same owner, same sentence as the source door above — an
      unexamined design is possibly a photograph of a person whichever field of
      the recipe it arrived in, and a fence that held on one road and not the
      other would be the widening tripwire's exposure with a carry's alibi.
    */
    /*
      ON THE ARTWORK LANE ONLY, and the exemption is structural rather than a
      carve-out: a `deliveredCrop` has no `cutRoute` field to read, because
      nothing of the customer's upload is in its bytes. The fence still holds
      over the whole road — a delivered crop can only exist for a design that
      already rode to a render, and that ride went through this same door.
    */
    if (design.picture === "designArtwork" && !inkDesignWasExamined(design.cutRoute)) {
      return {
        ok: false, reason: "sourceNotExamined", slot: design.slot,
        detail: `the design carried for ${design.slot} has not been through the cutter, so nobody has looked at what is in its picture; it needs its cut before it can ride to a render`,
      };
    }
    if (LEADING_DETERMINER.test(design.noun)) {
      return {
        ok: false, reason: "nounNotBare", slot: design.slot,
        detail: `${design.slot}'s noun "${design.noun}" starts with a determiner; recipe nouns are bare and every template supplies its own`,
      };
    }
    if (editedSet.has(design.slot)) {
      /*
        D-244 line 2 again, and on this road it is not a theoretical defect: a
        render that EDITS the tattoo is handed the design as a SOURCE, with the
        ask's own words about what is changing. Carrying it as well would send
        one picture twice with two sentences — *keep it exactly as it is* beside
        *change it to this* — which is the contradiction the assembler exists to
        refuse rather than dispatch at full price.
      */
      return {
        ok: false, reason: "carriesItsOwnEdit", slot: design.slot,
        detail: `${design.slot} is edited by this render and cannot also carry the design it already has`,
      };
    }
    if (claimed.has(design.slot)) {
      return {
        ok: false, reason: "slotTwiceReferenced", slot: design.slot,
        detail: `${design.slot} was given two references in one render (fable-174)`,
      };
    }
    claimed.add(design.slot);
    ordinalOf.set(design.slot, nextOrdinal());
    /*
      TWO PICTURES, TWO SENTENCES, AND THEY MAY NEVER SHARE ONE (fable-1194 §2a).

      The artwork carry describes a design on transparency with no body in it;
      the delivered carry describes the tattoo on HER OWN SKIN, and the skin is
      the fact it was minted to supply. A sentence that fitted both would have
      to say nothing about the surface, which is the one thing the delivered
      crop is for. `inkRealism.test.ts` drives them apart.
    */
    sentences.push(design.picture === "deliveredCrop"
      ? inkDeliveredCarrySentence(nextOrdinal(), design.noun, pronouns)
      : inkCarrySentence(nextOrdinal(), design.noun, pronouns));
    references.push({
      role: { kind: "carry", slot: design.slot },
      image: design.image,
      sentence: sentences[sentences.length - 1]!,
    });
  }

  /* ---- the carry contract's WORD half: what rides without being edited ---- */

  const standing: StandingWords[] = [];
  /*
    A PAIR THAT IS WHOLLY EMPTY SPEAKS AS A PAIR (fable-332).

    The library is keyed per side, so "she took her earrings off" leaves TWO
    vacancies, and saying each one's sentence puts two instructions about one
    fact in the prompt: *"no earring on her left ear …. no earring on her right
    ear …."* The stylist's sentence for that state is "no earrings" — the
    kind's own pair phrase, which is also the wording the removal bench
    measured. So when both instances of a pair are vacant, the FIRST of them
    says the pair phrase and the second says nothing.

    Derived here from the two entries rather than authored anywhere: the rows
    keep recording which lobe is empty, and how that state is SAID is the
    assembler's job. One sided sentence still stands alone when only one lobe
    is empty — a state nothing can currently reach, and deliberately so: the
    mirror bench of 2026-08-12 found "her right ear" clearing BOTH ears in five
    attempts out of six, so a one-sided promise is not one the product can keep.
  */
  const vacantSlots = library
    .filter((entry) => entry.vacant === true && !editedSet.has(entry.slot))
    .map((entry) => entry.slot);
  const pairFeature = (slot: FeatureSlot): string | null => {
    const at = slot.lastIndexOf("@");
    return at === -1 ? null : slot.slice(0, at);
  };
  const whollyVacantPairs = new Set(
    vacantSlots
      .map(pairFeature)
      .filter((feature): feature is string => feature !== null)
      .filter((feature) => (
        vacantSlots.filter((slot) => pairFeature(slot) === feature).length > 1
      )),
  );
  const pairAlreadySaid = new Set<string>();

  for (const entry of library) {
    if (editedSet.has(entry.slot)) continue;
    /*
      AN EMPTY SLOT SAYS SO, WHATEVER TIER IT IS.

      Before the two `continue`s below rather than after them, because both would
      throw a vacancy away: an ITEM is skipped here (its crop carries it) and a
      vacancy is precisely an item with no crop to carry it. Skipping it leaves
      the recipe silent about a thing the master is still wearing, which is the
      one-frame removal in one line.

      The phrase is the same `vacantPhrase` the vacate ask says at edit time —
      one sentence, one source, said in the change clause on the render that
      removes it and standing on every render after. It is already a complete
      state sentence naming the site ("no glasses — her face uncovered …"), so it
      is emitted as itself rather than poured into the "Keep her X exactly"
      template, which would produce *"Keep her glasses exactly: no glasses"*.
    */
    if (entry.vacant === true) {
      if (entry.words.length === 0) continue;
      const feature = pairFeature(entry.slot);
      if (feature !== null && whollyVacantPairs.has(feature)) {
        if (pairAlreadySaid.has(feature)) continue;
        const pairWords = vacantPhraseFor(accessoryKindOfSlot(entry.slot));
        if (pairWords !== null) {
          /* Marked only once the collapse has actually happened. Marking it
             before would silence the SECOND lobe of a kind that has no pair
             sentence to collapse into — an empty site going quiet, which is
             the one-frame removal wearing a tidier hat. Its own control found
             this. */
          pairAlreadySaid.add(feature);
          standing.push({
            slot: entry.slot,
            noun: entry.noun,
            words: [pairWords],
            sentence: `${pairWords}.`,
          });
          continue;
        }
        /* No pair phrase for this kind — fall through and let the instance
           speak for itself rather than going silent about an empty site. */
      }
      standing.push({
        slot: entry.slot,
        noun: entry.noun,
        words: entry.words,
        sentence: `${entry.words.join(", ")}.`,
      });
      continue;
    }
    /*
      fable-192, measured rather than precautionary. A surface has no other
      carrier at all; anatomy's crop wins about a third of the distance against
      a master that disagrees with it, so the words ride BESIDE the crop rather
      than being replaced by it. An ITEM's crop carried outright, and describing
      it again would put a word stack and a reference in competition over one
      feature.
    */
    if (entry.words.length === 0) continue;
    /*
      A SLOT THAT SENT A CROP STILL SAYS ITS WORDS — IF IT IS ANATOMY.
      (Measured 2026-08-17, opus-638; ruled fable-863 §3.)

      This line used to skip EVERY slot holding a reference, on the reasoning
      that its words had already been said on the reference's own sentence. For
      an ITEM that is right and it is fable-598's earned rule: a carried crop is
      the fact, a description beside it is a second author arguing with the
      picture, and his two 34 px crosses drifted worst on the side whose sentence
      sat furthest from its own crop. So POINT, DON'T DESCRIBE — for items.

      For ANATOMY it silently overrode fable-192, which requires the word stack
      in every recipe because *anatomy's crop wins about a third of the distance
      against a master that disagrees with it*. The reference sentence a carried
      crop gets is bare by design — "the same left eye, unchanged" — so an
      anatomy slot with a crop was saying NOTHING about what the feature is.

      What that cost, measured on one cast across three presentations of the
      same crop (padded to the frame, clean, and scaled to 512 px):

        crop alone, no words       her delivered eye colour came back  0 of 5
        words present (with or
        without the crop)                                              5 of 5

      The presentation moved three ways and changed nothing; the sentence
      changed everything. The founder's own outside-the-app exhibit is the same
      shape — his prompt named what the crop was for ("@Image 1 is her left eye
      COLOUR"), which is a crop-plus-words render on another engine, and it
      delivered.

      Keyed on the TIER, which is the catalogue's own class for the slot, and
      never on a list of slot names: a name list is a second source of truth that
      every new slot joins by being forgotten.
    */
    if (ordinalOf.has(entry.slot) && entry.tier === "item") continue;
    if (entry.tier === "item") continue;
    /*
      AND THE DISTRIBUTED OPEN KIND'S TWO ROWS SAY ONE SENTENCE (fable-1002 §3).

      Both rows hold the render's read-back of the SAME feature, one side each,
      so the ordinary form says "Keep her wings exactly: …" twice — and the words
      it repeats are a single wing's description standing in for her wings. One
      sentence per kind, and the two readings are joined rather than one of them
      being dropped: a mismatched pair is a FEATURE in the founder's own words,
      not a defect to reconcile.

      Identical readings collapse to the stylist's own word for a pair that
      agrees (*matching*, the word the earring row already uses). Differing ones
      are both said, WITHOUT a laterality word — the mask's side label is not a
      fact the prose may assert, and the carry needs no such label to work.
    */
    const openSide = openKindOfSlot(entry.slot);
    if (openSide !== null && openSide.side !== null && collapsedOpenKinds.has(openSide.kind)) {
      if (openPairSaid.has(openSide.kind)) continue;
      openPairSaid.add(openSide.kind);
      const sides = (sidedOpenCarries.get(openSide.kind) ?? [])
        .map((slot) => library.find((row) => row.slot === slot))
        .filter((row): row is LibraryEntry => row !== undefined)
        .map((row) => row.words.join(", "));
      const [first, second] = sides;
      const said = first === second || second === undefined
        ? `${first}, matching on both sides`
        : `one side ${first}, the other ${second}`;
      standing.push({
        slot: entry.slot,
        noun: entry.noun,
        words: entry.words,
        sentence: `Keep ${possessive} ${entry.noun} exactly: ${said}.`,
      });
      continue;
    }
    standing.push({
      slot: entry.slot,
      noun: entry.noun,
      words: entry.words,
      /* Imperative, so one form serves a plural noun and a singular one alike —
         "her lips remains" and "her hair remain" are both wrong, and a template
         that can produce either is a template that will. */
      sentence: `Keep ${possessive} ${entry.noun} exactly: ${entry.words.join(", ")}.`,
    });
  }

  /*
    CARRIED is derived from the library in one filter rather than accumulated in
    the two loops above — a second list built alongside a source of truth drifts
    from it (working law 4), and this one would have had to agree with both.
  */
  const carried = [
    ...library
      .filter((entry) => !editedSet.has(entry.slot))
      .filter((entry) => entry.carry !== undefined || (entry.tier !== "item" && entry.words.length > 0))
      .map((entry) => entry.slot),
    /*
      AND HER OWN DESIGNS, WHICH ARE CARRIED AND ARE NOT LIBRARY ROWS.

      In `carried` rather than merely in `references` because that list is the
      CARRIED column of the verification — every slot this render PROMISES to
      hold. A design riding as a picture nobody counted would be delivered
      unverified on exactly the fact the carry exists to keep, which is how a
      tattoo comes back wrong and nothing goes red.

      Read off `references` — WHAT ACTUALLY WENT OUT — and never off
      `input.carriedInk`, and that distinction was bought by a sabotage rather
      than reasoned about. Cutting the loop that pushes the reference left this
      list still naming the slot: ten arms went red and *"counts it as
      CARRIED"* stayed green, which is a recipe PROMISING to hold a tattoo
      whose picture it never sent. A carried column derived from the request is
      a claim; derived from the array on the wire it is a fact (working law 5).

      Appended rather than folded into the filter above because these are two
      different types from two different sources of truth, and one expression
      pretending otherwise is the drift working law 4 names.
    */
    ...references.flatMap((reference) => (
      reference.role.kind === "carry" && isInkSlot(reference.role.slot)
        ? [reference.role.slot]
        : []
    )),
  ];

  const ask = askSentence(
    input.asks, bySlot, wordStacks, possessive, input.presentation ?? [],
    input.placeSides === true,
  );
  if (typeof ask !== "string" && "saysNothing" in ask) {
    return {
      ok: false, reason: "presentationSaysNothing", slot: null,
      detail: `the recipe was handed a presentation clause about ${ask.saysNothing} with nothing to say, so the render would be told to change it into nothing`,
    };
  }
  if (typeof ask !== "string") {
    return {
      ok: false, reason: "slotNotNamed", slot: ask.unnamed,
      detail: `${ask.unnamed} has no library entry and the ask carries no noun, so the render cannot say what it is changing`,
    };
  }

  /*
    ---- WHAT A TATTOO IS ON SKIN, FOR THE LANE THAT HAS NO PICTURE ----

    fable-1180 §1 ordered the realism language into BOTH ink lanes; fable-1184
    §3b shaped the landing as the repaint recipe's ink SENTENCES, fresh and
    carry — and both of those are reference lanes. So the words-only lane got
    nothing, and it was read at the wire rather than argued: the same recipe
    built at `42652964` and at `283a0f37` produced the identical prompt, digest
    for digest, 201 characters, whose whole ink instruction was

        "Change only his neck tattoo: a small geometric skeleton design."

    That is a LIVE lane — `CASTING_REPAINT_SCOPE` is `users:1` in production and
    D-137's face/neck road lets words alone document ink there — so it was a
    paid render told to draw a tattoo and told nothing about what one is.
    Countersigned fable-1190 §1.

    # WHY IT IS ITS OWN SENTENCE AND NOT PART OF "Change only …"

    §3.0a's small-ask rule: the ask clause is deliberately small, one phrase per
    feature, and a caller cannot paste a paragraph into a frame it does not own.
    The vacate and presentation clauses ride that sentence precisely BECAUSE
    they are one phrase each. This is a paragraph, so it goes after — where "it"
    has the tattoo the ask just named as its antecedent, which it would not have
    in front.

    # WHY THE CONDITION IS "NO SOURCE" AND NOT MERELY "AN INK ASK"

    An ink SOURCE rides the ask list's own ink slot — `refineService` takes the
    source's slot from `asks` by construction — so on the reference lane there
    IS an ink ask, and it already carries this clause on its reference sentence.
    Said again here it would be the same instruction twice in one prompt, which
    is the thing this assembler refuses everywhere else. A CARRY needs no test:
    a carried slot is never an edited one, so it is never in `asks` at all.

    Said ONCE for any number of ink asks (fable-332's rule, the same reason the
    vacate phrase de-duplicates), and never for a restate or a vacate — there is
    no tattoo being drawn in either, and telling the painter how to draw ink
    while taking some off is an instruction about nothing.
  */
  const inkAsksWithoutAPicture = input.asks.some((one) => (
    isInkSlot(one.slot) && !one.restate && one.vacate === undefined && !sourceOf.has(one.slot)
  ));
  const inkWords = inkAsksWithoutAPicture
    ? `${inkRealismClause(pronouns)} ${inkNotOnClothingClause(pronouns)}`
    : "";

  return {
    ok: true, references, edited, restated, carried, vacated, wordStacks, sentences, standing, ask,
    withheld,
    prompt: [...sentences, ...standing.map((entry) => entry.sentence), ask, inkWords]
      .filter((line) => line !== "")
      .join(" "),
  };
}
