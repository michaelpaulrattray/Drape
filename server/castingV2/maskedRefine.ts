/**
 * MASKED EDITING, ON THE PRODUCT PATH — the workstream's seam, and it is one
 * function in one place.
 *
 * The founder's walk died on drift: a freckles edit replaced her hairstyle, an
 * earrings edit deleted her glasses, a removal refused at a face plainly wearing
 * the thing. The fix is not a better prompt or a stricter reader. **The model
 * returns a whole frame; we take only the pixels inside the region that was
 * asked about, and put them into an otherwise untouched master.** What happened
 * everywhere else stops being a question for a judge and becomes `Buffer.compare`.
 *
 * # Where this sits
 *
 * `refineService` already calls the engine once and gets a frame back. That call
 * does not change — **full-frame context with local harvest** is the standing
 * rider, because the model needs the whole face to know what it is editing. This
 * runs immediately after it, on the bytes, and returns a different set of bytes.
 * Everything downstream — the fault detector, the verification net, the retry,
 * the refund — is untouched and does not know this happened.
 *
 * # Dark by default, and SCOPED when it opens
 *
 * `MASKED_EDITING_SCOPE` is `off`, so a deploy of this changes nothing at all:
 * the function returns the engine's own bytes, byte for byte, and a test proves
 * it.
 *
 * It is a SCOPE rather than a boolean because this program has one convention for
 * every spendable surface — `off` / `all` / `users:<ids>` — and the first flip
 * goes to the founder's account alone. A boolean would have made "on for me" and
 * "on for everyone" the same edit, which is exactly the decision that deserves
 * two. Widening is a separate founder call after the walk, never a rider on the
 * flip. Same parser as `CASTING_V2_SCOPE`, deliberately: a second scope grammar
 * would be a mirror, and mirrors drift (law #4).
 *
 * # It REFUSES rather than falling open
 *
 * When the flag is on and a mask cannot be built, this throws instead of quietly
 * returning the unmasked frame. Falling open would be the invoked-but-inert
 * class in its purest form: the guarantee would be present in the code, absent
 * in the picture, and nothing would say so. A throw routes into the refund path
 * that already exists for a failed refinement, which is the honest outcome —
 * the user is not charged for an edit the system could not make safely.
 *
 * The one exception is a facet with no region at all. An expression is not a
 * region edit (D-233): a smile moves cheeks, eyes, jaw and brow at once, and any
 * zone drawn for it would be a lie about what changes. Those route full-frame by
 * design, so this returns the engine's frame untouched and says why.
 */
import { createModuleLogger } from "../logging/logger";
import {
  MaskError,
  assertUsable,
  attachedTo,
  coverage,
  dilateMask,
  expandUntilClear,
  harvestMatteFrom,
  intersectMask,
  subtractMask,
  unionMasks,
} from "./maskGeometry";
import {
  adoptInteraction,
  compositeMasked,
  confirmedColour,
  differenceMatte,
  harvestGate,
  outsideMaskUnchanged,
  readRaster,
  writeMaskPng,
  writePng,
  type Mask,
  type Raster,
} from "./maskedComposite";
import { compositeSeam } from "./compositeIntegrity";
import { captureRefusedRender } from "./diagnosticCapture";
import { ProviderError } from "../providers/types";
import { hasRegion, zoneScopeOf } from "./zoneScope";
import { castingV2EnabledForUser, parseCastingV2Scope } from "./castingV2Scope";
import type { Facet } from "./refineFacets";
import { FACET_CARD_ENTRIES, facetTableOf } from "./facetCards";
import { regionTableOf } from "./regionCards";
import { LANDMARK_OF_ACCESSORY, accessoryEntry } from "./accessoryKinds";

const log = createModuleLogger("castingV2/maskedRefine");

/**
 * THE FLAG. **LIVE FOR THE FOUNDER'S ACCOUNT ONLY** (founder decision,
 * 2026-08-06, after the face wall passed).
 *
 * `users:1` — the sole admin, and the only account this path touches. Widening
 * to `all` is a separate founder decision after the walk, never a rider on this
 * one; that separation is the entire reason this is a scope rather than a
 * boolean.
 *
 * **The rollback is this line: set it back to `"off"`.** Nothing else has to
 * change, and every other user is already on that path.
 */
export const MASKED_EDITING_SCOPE = "users:1";

/** Is the masked path live for this user? Off means off for everyone. */
export function maskedEditingEnabledFor(userId: number | undefined): boolean {
  const scope = parseCastingV2Scope(MASKED_EDITING_SCOPE);
  if (scope.kind === "off") return false;
  if (scope.kind === "all") return true;
  return userId !== undefined && castingV2EnabledForUser(scope, userId);
}

/** Feathering the zone; the harvest matte supplies the visible edge. */
const FEATHER_PX = 4;
/**
 * REACHES ARE FRACTIONS OF THE FRAME, NOT PIXEL CONSTANTS.
 *
 * They were absolute — 40px for strand recovery, 14px for the interaction band —
 * which is local on the 1024x1536 the workstream was measured on and the WHOLE
 * FRAME on anything small. A constant in pixels is a constant that assumes a
 * resolution, and this path already promises never to resample; it should not
 * quietly assume one instead.
 *
 * The fractions are the measured values divided by 1024, so behaviour at the
 * resolution everything was calibrated on is unchanged.
 */
const STRAND_REACH_FRACTION = 40 / 1024;
const BAND_FRACTION = 14 / 1024;
/**
 * How far the painted region is grown before the reveal is measured against it.
 *
 * Two segmentations of the same face on two frames do not agree pixel for pixel,
 * and every pixel they disagree on would read as vacated territory — painter
 * background shipped along an unchanged hair edge on an edit that only recoloured
 * it. This absorbs that wobble, and the novelty gate downstream catches whatever
 * survives it.
 *
 * A fraction rather than a pixel count, for the reason the two above it are:
 * **a constant in pixels is a constant that assumes a resolution**, on a path
 * that promises never to resample. Provisional at 8 — large enough to swallow
 * SAM 3's frame-to-frame boundary jitter on the specimens measured, small enough
 * that a real reveal (a shoulder, a temple) is orders of magnitude wider.
 */
const VACANCY_TOLERANCE_FRACTION = 8 / 1024;
/**
 * How far from her old region a DEPARTED strand is still looked for.
 *
 * Deliberately its own number rather than sharing `STRAND_REACH_FRACTION`,
 * because it answers a different physical question. That one asks how far a
 * newly painted strand tip may extend past the segmenter's confidence — a tip,
 * so a short distance. This asks how far her EXISTING loose hair lay from the
 * mass it belonged to, and on a long style that is not a tip: her flyaways run
 * most of the way down her chest, hundreds of pixels from the ponytail.
 *
 * The bound is not really this number — it is the projection, which fires only
 * where the master carries old-hair content against the painter's plate, and the
 * novelty gate under it. Distance is the cheap outer fence that keeps the
 * question anywhere near the hair at all.
 */
const DEPARTED_REACH_FRACTION = 160 / 1024;
/**
 * HOW FAR A DEPARTED OBJECT'S OWN EDGE IS LOOKED FOR — and why it is not that.
 *
 * The reach above is honest about what bounds it: *"the bound is not really this
 * number — it is the projection, and the novelty gate under it."* On the shrink
 * lane that is true and the 160px is free. On a removal it is not, because the
 * removal's vacancy no longer passes the veil gate — so this reach is the only
 * fence left standing, and a number written when something else was load-bearing
 * cannot be inherited by the case where it is.
 *
 * Measured, not asserted. With the departure taking the ponytail's reach, the
 * delivered vacancy on the glasses specimen was **17.5% on her actual frames and
 * 60% more than thirty-two pixels away** — the projection firing across every
 * dark thing near a dark object, which is her hair, admitted at full strength
 * because the lane that used to catch it is the one we deliberately opened.
 *
 * The physical question a removal asks is much smaller: **where does this
 * object's own anti-aliased boundary and contact shadow run?** That is the width
 * of the boundary a segmenter cannot place exactly — the same quantity
 * `VACANCY_TOLERANCE_FRACTION` already measures from the other side, and
 * deliberately its own name rather than a second use of that one, because two
 * meanings sharing a constant is how a number outlives its argument.
 */
const DEPARTED_EDGE_REACH_FRACTION = 8 / 1024;
/**
 * The share of old content above which a revealed pixel is replaced WHOLE.
 *
 * See the note at `departedFully`: for a removal the strand opacity is not the
 * alpha, it is the evidence. A pixel a quarter covered by the departing hair is
 * still a contaminated pixel, and taking the plate at a quarter strength leaves
 * a ghost. Low rather than zero so that the projection's own noise floor cannot
 * vacate a whole shoulder, and so the outer edge still has somewhere to ramp.
 */
const REMOVAL_TOTAL_ABOVE = 0.25;
/**
 * HOW FAR THE DEPARTED THING'S OWN TERRITORY GROWS PER PASS.
 *
 * Not a pad. The territory is grown by `expandUntilClear` until none of the old
 * content presses against its boundary — the hem guillotine's own answer, reused
 * because this is the same physical complaint one object over: **a segmentation
 * tight to an object cannot contain that object's own anti-aliased edge and
 * contact shadow**, and a mask that stops where the frames' edge does not is the
 * same straight cut, one pixel wide instead of across her hair.
 *
 * A hand-picked number of pixels here would be the measurement-window law
 * violated from the other side: a constant tuned until this fixture looked right.
 * The step is only the resolution of the search — small, because the thing being
 * searched for is one or two pixels wide, and the loop stops the moment contact
 * clears. A fraction rather than a pixel count, for the reason every reach above
 * it is: a constant in pixels assumes a resolution.
 */
const DEPARTED_TERRITORY_STEP_FRACTION = 4 / 1024;
const scaled = (fraction: number, width: number, height: number) =>
  Math.max(4, Math.round(Math.min(width, height) * fraction));

/**
 * ONE BILATERAL REGION, AS TWO — each side a WHOLE-FRAME mask, so a caller that
 * holds one of them is holding it in the same coordinates as everything else it
 * owns and never has to know where the cut was made.
 *
 * The keys are the subject's own: `left` is HER left. Every instance key in the
 * library means the same thing (`referenceSlots`), the panel says "her left
 * earring", and the tilt reader has read the smaller x as her right eye since
 * long before this existed.
 */
export type SideRegions = { left: Mask; right: Mask };

/**
 * What a region looks like to this module. One call per named region, so the
 * caller owns which segmenter answers and this owns what is done with it.
 */
export type RegionReader = {
  /**
   * Everything the named region covers in this image.
   *
   * `absentIsAnswer` is the difference between *the model could not answer* and
   * *the answer is nowhere*, and conflating them is what made a removal
   * impossible. Asked of the MASTER for a region the record says is there, an
   * empty reply is a failed question and must refuse — composing on it would
   * deliver "nothing changed" at full price. Asked of the PAINTED frame after
   * *"take her glasses off"*, an empty reply is **the painter doing the job**,
   * and refusing it charges her for the picture she already had.
   *
   * The caller knows which of the two it is asking, so the caller says. Same
   * asymmetry D-235 drew for the reader's affirmatives: silence resolves in
   * whichever direction does not take the user's money, and which direction that
   * is depends on the question.
   */
  /*
    `imageUrl` — WHERE THESE EXACT BYTES ALSO LIVE, when they live anywhere.

    Optional, and it changes nothing about the answer: the mask still comes back
    in `image`'s pixel space, because that is the only space the caller has. It
    is a transport hint, so a reader that can send an address instead of a
    2.3 MB upload may do so — twelve questions about one photograph currently
    carry twelve copies of it (fable-358 §3).

    **A reader may only use it once it has proven the address holds these
    bytes.** Passing a URL that is nearly the frame — a thumbnail, a re-encode,
    last version's master — is the wrong-frame class, and the caller cannot be
    the one who guarantees it, because the caller is exactly who gets it wrong.
  */
  /*
    `axisKey` — WHOSE FACE THESE FRAMES ARE, when the caller knows.

    Optional, and it changes no answer: it names the CANDIDATE whose frames
    these are, so her vertical axis — the face read a bilateral question needs
    before it can cut the picture in half — is read once for that face instead
    of once per frame.

    Measured before it was allowed: across a candidate's whole chain her midline
    moves **0.3px in 1024** (0.031% of the width), and 0.1px on the founder's own
    cast, against a face read that costs 13.7 seconds of the ~23 a bilateral
    region takes. The cut it decides is a half-frame split, and no feature is a
    third of a pixel wide.

    It is an APPROXIMATION and is declared as one: a cached axis is a claim
    about a frame it was not read from. Omit it and every frame reads its own,
    which is what this did before.
  */
  region(input: {
    image: Buffer;
    name: string;
    absentIsAnswer?: boolean;
    imageUrl?: string;
    axisKey?: string;
  }): Promise<Mask>;
  /**
   * THE SAME REGION WITH ITS TWO SIDES STILL APART — optional, and the option
   * is the point.
   *
   * A bilateral region is read one side to a picture already; `region` unions
   * the two before anyone else sees them, and that union is why nothing per-side
   * can be cut. A crop of both her earrings filed as `earring@left` scores 100%
   * against the union it was cut from — the wrong-boundary class, wearing a
   * number.
   *
   * It is a SECOND METHOD rather than an option on `region` because an option
   * that changes the return shape makes every caller carry both types forever
   * (fable-211). Being optional is what keeps the honest fallback honest: a
   * reader without this capability produces a REFUSAL with the true reason, and
   * never a guessed split.
   *
   * `null` means *this name has no sides for me* — asked of a nose, or of a
   * frame too narrow to cut — and costs nothing. It is not "there is none here";
   * that answer is two empty masks, and only when `absentIsAnswer` says so.
   *
   * The keys are ANATOMICAL: `left` is her left, which in a frame she faces the
   * camera in is the image's right half.
   */
  regionSides?(input: {
    image: Buffer;
    name: string;
    absentIsAnswer?: boolean;
    /** The same transport hint `region` takes, under the same proof. */
    imageUrl?: string;
    /** The same face hint `region` takes — and this is the road that pays for
     *  it, since a side read is what buys the axis in the first place. */
    axisKey?: string;
  }): Promise<SideRegions | null>;
  /** A soft whole-subject matte, for edge ramps. */
  subject(input: { image: Buffer }): Promise<Mask>;
  /**
   * WHERE A THING WOULD BE, even when nothing can see it.
   *
   * A different capability from segmentation, not a worse one. A segmenter
   * answers *where is this in the picture* and returns nothing at all when hair
   * covers the ear; a landmark model answers *where is the ear on this face* and
   * still answers. That distinction is D-213's sibling, and it is the whole
   * reason an addition can be placed at all.
   */
  landmark(input: { image: Buffer; name: string }): Promise<{ x: number; y: number }[]>;
};

export type MaskedRefineInput = {
  /** The master — her current picture. Never resampled. */
  master: { bytes: Buffer; contentType: string };
  /** What the engine returned, whole-frame. */
  painted: { bytes: Buffer; contentType: string };
  /** Which facets this instruction wrote. Decides the zone's scope. */
  facets: readonly Facet[];
  /**
   * WHERE A FACET LIVES WHEN THE FACET ALONE DOES NOT SAY.
   *
   * `makeup` is the case: a lip gloss and a foundation are one facet in two
   * places, and `REGION_OF_FACET` can only hold one answer. The caller resolves
   * it from the instruction (`makeupPlacement`) and passes the same map to the
   * segment store, so the harvest and the store cannot name a crop differently.
   */
  regionOverrides?: Readonly<Partial<Record<Facet, string>>>;
  reader: RegionReader;
  /** Whose refinement this is — the scope is per user, not per deploy. */
  userId?: number;
  /** What the instruction said the thing IS. Places an addition. */
  described?: string;
  /**
   * WHAT A REMOVAL TOOK OFF HER — carried, because the record cannot say it.
   *
   * An object removal deletes its own facet from the recipe, so
   * `facetsWrittenBy(composed)` no longer names it and no question is ever
   * asked about the thing being removed. The painter takes the glasses off, the
   * harvest claims nothing at the eyes, and `outsideMaskUnchanged` then
   * guarantees the master is kept exactly there — the composite puts them back
   * and she pays for the face she started with.
   *
   * `described` cannot stand in for this: it holds the SURVIVORS, so a chain of
   * earrings plus glasses minus the glasses would place the question at her
   * earlobes — the failure `LANDMARK_OF_ACCESSORY` exists to prevent.
   *
   * # A LIST, and the singular was quietly capping this at one
   *
   * A base-worn departure now lives in the recipe rather than in one request's
   * local (D-238), so it stands on EVERY later render — the base still has the
   * glasses on, so every render must take them off again, and every render must
   * therefore mask for them. Two departures on one face is then an ordinary
   * state ("no glasses" and "no freckles"), and passing only the first would
   * mask one and let the composite hand the other straight back. A silent cap
   * reads as coverage, so there is none: each departure asks its own question.
   */
  departed?: readonly string[];
  /** For the log line, so a composite can be traced to its operation. */
  operationId?: string;
  /**
   * RETURN THE WORKING, for calibration only.
   *
   * The alternative is a harness that rebuilds this pipeline to look inside it,
   * and that alternative has already cost this program three silent divergences
   * — `maskedRefine` and the calibration harness drifting apart while both stayed
   * green. A fixture that inspects THIS function's own masks cannot drift from
   * it. Off on every product path, and it only adds allocations.
   */
  explain?: boolean;
};

/**
 * WHAT A COMPOSITE CAN PROVE ABOUT ITSELF — one shape, one name, one place.
 *
 * It has a name because it is PASSED THROUGH three layers and rebuilt in one of
 * them, and a rebuild that re-lists its own fields is the copy that drifts
 * (working law 4). `assembleWithCarriedSegments` re-listed two of three, so
 * `deliveredRegions` was dropped on exactly the renders that carried a segment
 * — the delivered-anchored cut silently inert on the second edit of any face,
 * while every test and every type still read green.
 */
export type HarvestEvidence = {
  /** Where the composite was allowed to differ from the master. */
  applied: Mask;
  /**
   * The geography of this render, by the question that produced it.
   *
   * Two kinds of answer live in one map, and the difference is stated here
   * rather than left to be inferred:
   *
   * - **Segmented** — a region the reader drew on the MASTER. The great
   *   majority, and what the name has always meant.
   * - **PLACED** — an addition's destination corridor, which no reader could
   *   have drawn because the thing was not there yet (D-213). Filed under the
   *   accessory's kind id, which is the same string the segmenter would be
   *   asked if the thing already existed (`LANDMARK_OF_ACCESSORY.region`).
   *
   * The second kind is why accessories could never be kept. The corridor was
   * built, unioned into the zone and then dropped on the floor, so the segment
   * cutter — which looks a facet's ground up in this map by NAME — found
   * nothing for `statedAccessories` and filed nothing, on every face, on every
   * render this campaign has paid for.
   */
  masterRegions: ReadonlyMap<string, Mask>;
  /**
   * WHERE THE THING IS NOW — the same questions, asked of the DELIVERED frame.
   *
   * The silhouette half of `own(facet) = applied ∩ (region(delivered) ∪
   * region(master))`. A master-anchored segment can only ever keep the ground
   * the thing used to occupy, and the things a customer buys live where the
   * master has nothing: hair worn down lives on her shoulders, and her
   * master's hair region is a bun. Measured on the founder's own v#163 — the
   * store kept 100% of what it was given and **10% of what she bought**.
   *
   * # It costs no vision call, and that is not luck
   *
   * The harvest already asks this exact question for its own content gate
   * (`regionOf("painted", …)`, one call per question, memoised). Until this
   * map existed the answer was computed, used once and dropped for every
   * ordinary region. This is the same read, kept.
   *
   * # Why it is a SECOND map rather than a wider `masterRegions`
   *
   * `masterRegions` has another consumer: `detailForVerification` cuts the
   * reader's magnified crop from it. Folding the delivered extent in would
   * move the box a stochastic reader is shown on a paid render, as a side
   * effect of a change to the STORAGE path. Two questions, two meanings, two
   * maps; the segment cutter is the only thing that unions them.
   *
   * Absent, or missing a name, means the delivered read did not settle — and
   * a claim is never built on a reading that did not happen (design rule 2).
   */
  deliveredRegions?: ReadonlyMap<string, Mask>;
  /**
   * THE BILATERAL NAMES WITH THEIR TWO SIDES STILL APART, on each frame.
   *
   * The same reads as the two maps above, kept instead of merged: the union in
   * `masterRegions` is what the composite works on, and the split is what a
   * per-instance library slot has to be cut from. Both come out of one set of
   * calls, so this costs no vision call — it is `deliveredRegions`' own bargain
   * one question over.
   *
   * A name appears here only when the reader can answer two-sidedly; anything
   * else is simply absent, which is what the mint reads as *no side to cut* and
   * files as words. There is no entry meaning "we guessed".
   */
  masterSideRegions?: ReadonlyMap<string, SideRegions>;
  deliveredSideRegions?: ReadonlyMap<string, SideRegions>;
};

export type MaskedRefineResult = {
  bytes: Buffer;
  contentType: string;
  /** What actually happened, for the record and the log. */
  outcome: "composited" | "flag-off" | "no-region";
  /** Present when composited — the promise, restated in numbers. */
  guarantee?: {
    outsideIdentical: boolean;
    blendBandPixels: number;
    zoneCoverage: number;
  };
  /**
   * THE SEAM VERDICT FOR THIS COMPOSITE — every render, not only the torn ones.
   *
   * `enforced` says whether this render's classes were ones a boundary step can
   * never be legitimate on. It is recorded beside the verdict so the flip
   * decision can read "what would have been refused" off the rows rather than
   * off memory.
   */
  seam?: {
    torn: boolean;
    enforced: boolean;
    boundaryPixels: number;
    tornPixels: number;
    share: number;
    worstExcess: number;
    signedMean: number;
    signedSpread: number;
    coherence: number;
  };
  /**
   * WHAT THE COMPOSITE CAN PROVE ABOUT PIXELS IT DID NOT TOUCH.
   *
   * The composite's own guarantee is that everything outside `applied` is
   * byte-identical to the master. So for any facet whose master region does not
   * meet `applied`, the picture at that facet IS the master's picture — which
   * means asking a stochastic reader to re-decide it is asking it to re-answer
   * a question arithmetic has already settled. Run-6 is the exhibit: `hairWorn`
   * read three ways across three renders on hair measured at **0.00** mean
   * |Δluma|, and the third reading refused a correct render.
   *
   * These are the regions the harvest ALREADY segmented for its own work, kept
   * rather than re-derived — the cost of this is zero vision calls, which is the
   * whole reason the design survives. A facet whose region is not in here gets a
   * live read, because "we did not look" is not "it did not change".
   *
   * Present on the product path, unlike `explain` — the verification step is not
   * calibration.
   */
  evidence?: HarvestEvidence;
  /**
   * The masks this composite was actually built from, when `explain` was asked
   * for. `applied` is the canonical one: it is the only boundary source that
   * cannot disagree with the picture, and three of this session's four wrong
   * measurements came from checking against something else.
   */
  explain?: {
    /** The zone as the facet's scope drew it, before any boundary expansion. */
    zoneAsScoped: Mask;
    zone: Mask;
    harvested: Mask;
    vacated: Mask;
    departed: Mask;
    /** A base-worn departure's own ground: its master extent, grown until clear. */
    departedTerritory: Mask;
    /** The vacancy inside that ground — the part the veil gate does not govern. */
    departedVacancy: Mask;
    /**
     * The claim after the harvest gate and BEFORE the territory rule.
     *
     * Separated because a stage table that jumps from the raw claim to the
     * delivered one attributes a loss to whichever stage the reader already
     * suspects — and one such reading has already cost this diagnosis a wrong
     * verdict. Two stages narrow this claim; they are now two numbers.
     */
    ungoverned: Mask;
    delivered: Mask;
    applied: Mask;
  };
};

/**
 * WHICH SEGMENTATION QUESTION A FACET ASKS.
 *
 * Deliberately small and explicit rather than derived from the facet id: the
 * words here are sent to a segmentation model, and D-213 is that a segmenter is
 * never asked an open question. A facet with no entry has no masked path and
 * says so, rather than having a prompt invented for it.
 */
const REGION_OF_FACET: Partial<Record<Facet, string>> = Object.fromEntries(
  FACET_CARD_ENTRIES
    .filter(([, card]) => card.region !== null)
    .map(([facet, card]) => [facet, card.region as string]),
);

export function regionNameOf(facet: Facet): string | null {
  return REGION_OF_FACET[facet] ?? null;
}

/**
 * WHICH REGIONS HAVE CONTENT FINER THAN A SEGMENTER'S BOUNDARY.
 *
 * # The defect this ends
 *
 * `differenceMatte` recovers a strand as the projection of `(patch − master)`
 * onto `(strand − master)`, where `strand` is measured from the interior of the
 * confirmed content. It was run for **every** region, and for a `marks` edit
 * the confirmed content is FACE SKIN — so the reference colour is her skin, and
 * the recovery reaches forty pixels past the jaw into her hair.
 *
 * *Dark hair → pale background* is very nearly parallel to *dark hair → skin*.
 * Measured on the production pixels of run-6's torn render (candidate
 * `7c796a72`, variant `198005a3`, charged 25 and scored compliant):
 *
 *   left notch     master [8,6,6] → delivered [136,129,127]   alpha **0.730**
 *   left wash      master [7,6,6] → delivered  [92, 90, 88]   alpha **0.490**
 *   untouched hair / untouched background                     alpha 0.000
 *
 * So the mechanism written to rescue a hem on her hair ends claimed a slab of
 * background lying over it, at 73% opacity, and the composite delivered it as a
 * hole punched through her hair. The module's own doc anticipates the
 * neighbouring case correctly — a repainted shirt moves grey toward a slightly
 * different grey, a delta nearly ORTHOGONAL to `(strand − master)`, projecting
 * to ~0 — but that defence assumes master and patch are the SAME MATERIAL. It
 * has nothing to say about the painter having replaced one material with
 * another, which is what a drifting hair silhouette does.
 *
 * # Why a region property, and why declared rather than derived from the name
 *
 * Fringe is a fact about the MATERIAL, not about the edit: hair has flyaway
 * strands whether you are recolouring it or cutting it, and skin has none
 * whatever you do to it. So it belongs to the region, once.
 *
 * `Record<string, …>` with a test that closes the reverse direction — every
 * region name reachable from `REGION_OF_FACET` or `LANDMARK_OF_ACCESSORY` must
 * have an entry — because this file already carries the scar of the other
 * approach: a `names[0]` harvest and a literal `"earring"` fallback, both true
 * for the only case anyone had driven and silent about the rest.
 *
 * # What this does NOT fix, stated
 *
 * The regions that keep fringe keep the projection's blind spot with it: a
 * glasses harvest can still confuse *skin → hair-drift* with *skin → frame*.
 * Turning fringe off there would lose the thing it is for — a wire temple arm
 * is two pixels wide and is exactly what a segmenter's boundary discards. That
 * exposure is closed by the territory rule, not by this table.
 */
const FRINGE_AT_EDGE: Record<string, { readonly fringe: boolean; readonly why: string }> =
  regionTableOf((card) => ({ fringe: card.fringe.at, why: card.fringe.why }));

/**
 * Whether this region's harvest may reach beyond the segmenter's boundary.
 *
 * Unknown regions do NOT get fringe. A name nobody has considered is a name
 * whose material nobody has considered, and the failure mode of guessing yes is
 * the torn frame; the failure mode of guessing no is a slightly tight boundary.
 * The test closes the gap so this default never has to be relied on.
 */
export function hasFringeAtEdge(region: string): boolean {
  return FRINGE_AT_EDGE[region]?.fringe === true;
}

/**
 * WHICH REGIONS CAN BE MISTAKEN FOR THIS ONE AT ITS BOUNDARY.
 *
 * # The half of the torn frame that no fringe rule can reach
 *
 * `FRINGE_AT_EDGE` removed the strand projection from regions that have no
 * strands, and replaying run-6's own torn render through it took the left notch
 * down 67% and the right phantom 21% — **and left both tears alive**. The
 * remainder is not a recovery reaching too far. It is the harvest itself: once
 * the painter moved her hair, a segmenter asked *"where is her face skin"* on
 * that frame answers with pixels the MASTER has hair in. The harvest is then
 * behaving perfectly by its own lights, and delivering a hole.
 *
 * So the rule is about the OUTCOME rather than about any one mechanism:
 *
 * > A harvest may not deliver a pixel that on the MASTER belongs to a
 * > confusable neighbour this edit does not name — minus every extent the edit
 * > legitimately owns.
 *
 * # Nearly every entry is "hair", and that is the finding
 *
 * Hair is the only region that moves a large silhouette across everything else,
 * which is why every tear in this campaign has been at a hair boundary. The
 * table says so plainly rather than padding for symmetry.
 *
 * # What it must NOT break, because subtracting territory is how you rebuild
 * "the composite puts them back"
 *
 * Three kinds of edit legitimately deliver onto a neighbour's master territory,
 * and all three are exempted by `ownedExtents` at the call site:
 *
 *   - a REMOVAL — glasses arms cross her temples, and the reveal has to land
 *     exactly where the master says "hair";
 *   - a SHRINK — a smaller ponytail reveals background that was hair;
 *   - an ADDITION — wire frames sit ON her hair at the temples, and an
 *     addition's master extent is EMPTY by definition, so its destination
 *     corridor is what owns that ground. Without this exemption "round
 *     wire-frame glasses" delivers arms clipped at the temples after a perfect
 *     paint, and the Tier A catalogue asks for exactly that.
 */
const CONFUSABLE_NEIGHBOURS: Record<string, { readonly with: readonly string[]; readonly why: string }> =
  regionTableOf((card) => card.neighbours);

/** Regions that could be mistaken for this one. Unknown regions have none. */
export function confusableNeighboursOf(region: string): readonly string[] {
  return CONFUSABLE_NEIGHBOURS[region]?.with ?? [];
}

/** Regions declared in the neighbour table — for the reverse-direction test. */
export function neighbourTableNames(): string[] {
  return Object.keys(CONFUSABLE_NEIGHBOURS).sort();
}

/**
 * WHICH FACETS CAN MOVE THEIR REGION'S EDGE — and therefore may claim a reveal.
 *
 * # The third mechanism in run-6's torn frame
 *
 * With the strand projection scoped (`FRINGE_AT_EDGE`) and the territory rule
 * in place, run-6's left notch fell 90% and the RIGHT PHANTOM did not move at
 * all. Per-mask attribution on the replay named it: `vacated` is zero
 * everywhere and **`departed` claims 7,955 px of that band.**
 *
 * `departed` is the reversed projection — it asks what content LEFT a region,
 * with a 160px reach, so a shrinking ponytail's old flyaways can be found far
 * from the mass they belonged to. It was computed for **every** question. On a
 * `marks` edit that means a freckle instruction hunting for skin that departed
 * from her face, across 160 pixels, and then delivering the painter's
 * replacement for it — which is where a hank of hair arrived on her neck.
 *
 * # The rule
 *
 * A reveal only exists where something can leave. A facet that repaints a
 * region's SURFACE cannot move its edge: freckles do not remove skin, a tan
 * does not, lipstick does not, and neither does a hair colour — a recoloured
 * ponytail is the same ponytail. Those facets get no `vacated`, no `departed`,
 * and no reveal, and lose nothing by it.
 *
 * # Its own table, deliberately not `CHANGE_AMPLITUDE`
 *
 * The amplitude record has a SURFACE band that looks like the same distinction
 * and it is **instrument-only** — it exists to tell a band table what threshold
 * to count at. Reusing it here would quietly promote a measurement constant
 * onto the paid render path, which is the class of thing this program keeps
 * finding. They also genuinely disagree: `hair.colour` is REPLACEMENT amplitude
 * (every strand pixel moves) and moves no edge at all.
 *
 * `Record<Facet, …>` so a new facet does not compile without a decision, with a
 * test closing the other direction.
 */
const MOVES_ITS_EDGE: Record<Facet, { readonly moves: boolean; readonly why: string }> =
  facetTableOf((card) => card.movesItsEdge);

/** May any facet in this edit legitimately reveal what was behind something? */
export function anyFacetMovesAnEdge(facets: ReadonlyArray<Facet>): boolean {
  return facets.some((facet) => MOVES_ITS_EDGE[facet]?.moves === true);
}

/** Facets declared in the edge table — for the reverse-direction test. */
export function edgeTableNames(): string[] {
  return Object.keys(MOVES_ITS_EDGE).sort();
}

/** Every region this file can ask a segmenter about — the table's own domain. */
export function segmentableRegionNames(): string[] {
  return Array.from(new Set([
    ...Object.values(REGION_OF_FACET).filter((name): name is string => typeof name === "string"),
    ...LANDMARK_OF_ACCESSORY.map((entry) => entry.region),
  ])).sort();
}

/** Regions declared in the fringe table — for the reverse-direction test. */
export function fringeTableNames(): string[] {
  return Object.keys(FRINGE_AT_EDGE).sort();
}

/**
 * THE NAMED GAP, declared rather than discovered.
 *
 * `object`-class facets — earrings, glasses, ink placements — have a zone, but
 * it does not come from segmenting the master: **the thing is not there yet, so
 * nothing can segment it** (D-213). Their destination is derived from a LANDMARK
 * plus the described object's own extent, which the harness has (`the-walk.mts`
 * builds earring corridors from `moondream3-preview/point`) and this adapter
 * does not yet.
 *
 * That path is now wired: `landmarkNameOf` names the anchor, `additionDestination`
 * builds the corridor, and boundary-contact auto-expand catches an under-estimate.
 * A facet with no landmark vocabulary — ink, whose "left forearm" is not a facial
 * landmark — still refuses by its own name rather than having one invented.
 */
export function needsLandmarkDestination(facet: Facet): boolean {
  return zoneScopeOf(facet) === "object";
}

/**
 * WHICH LANDMARK AN ADDITION HANGS FROM — facet AND instruction, again.
 *
 * `statedAccessories` is one facet covering earrings, glasses and piercings, and
 * they do not share an anchor: an earring hangs from the lobe, glasses sit at the
 * eyes. Keying the landmark on the facet alone would put her spectacles on her
 * earlobes — the same class as the audit's marks-versus-freckles finding, which
 * is now the second time the instruction has turned out to carry half the
 * placement.
 *
 * An accessory nobody has a landmark for REFUSES. Guessing an anchor is guessing
 * anatomy, and a guess dressed as anatomy is the D-210 family.
 *
 * The table itself now lives in `accessoryKinds`, because composition needs the
 * same knowledge to tell "round wire-frame glasses" from "small gold hoops" when
 * retiring a departure (D-238). One table, two consumers.
 */

export function landmarkNameOf(facet: Facet, described?: string): string | null {
  if (!needsLandmarkDestination(facet)) return null;
  if (facet !== "statedAccessories") return null;
  return accessoryEntry(described)?.landmark ?? null;
}

/** Does the described object hang below its anchor? A drop does; glasses do not. */
export function hangsBelowAnchor(described?: string): boolean {
  return accessoryEntry(described)?.drops ?? false;
}

/** A filled disc at a normalised point — the unit an addition is built from. */
function discAt(point: { x: number; y: number }, radius: number, width: number, height: number): Mask {
  const data = Buffer.alloc(width * height, 0);
  const cx = point.x * width;
  const cy = point.y * height;
  for (let y = Math.max(0, Math.floor(cy - radius)); y < Math.min(height, Math.ceil(cy + radius)); y += 1) {
    for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(width, Math.ceil(cx + radius)); x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) data[y * width + x] = 255;
    }
  }
  return { data, width, height };
}

/**
 * THE DESTINATION FOR AN ADDITION — a corridor per landmark, conservative on
 * purpose.
 *
 * The extent comes from the described object, and this deliberately does not try
 * to be clever about it: a stud is a disc at the lobe, a drop hangs below it, and
 * the founder's rider is explicit that **boundary-contact auto-expand catches
 * under-estimates.** So the default is the smaller guess and the expansion loop
 * grows it when paint presses against the edge. Guessing generously would hand
 * the painter more canvas than the ask deserves.
 *
 * **Scale comes from the face, never from a number somebody liked.** The distance
 * between the two landmarks is the head's width at that feature, so a stud is a
 * fraction of it on any face at any framing.
 */
export function additionDestination(input: {
  landmarks: { x: number; y: number }[];
  width: number;
  height: number;
  /** How far the object hangs below its anchor, in multiples of its own radius. */
  dropSteps?: number;
}): Mask {
  if (input.landmarks.length === 0) {
    throw new MaskError("an addition needs a landmark to be placed against — none was returned");
  }
  const { width, height, landmarks } = input;
  const span = landmarks.length > 1
    ? Math.hypot((landmarks[0].x - landmarks[1].x) * width, (landmarks[0].y - landmarks[1].y) * height)
    : Math.min(width, height) * 0.25;
  const radius = Math.max(4, span * 0.035);
  const steps = input.dropSteps ?? 0;
  const parts: Mask[] = [];
  for (const landmark of landmarks) {
    for (let step = 0; step <= steps; step += 1) {
      parts.push(discAt(
        { x: landmark.x, y: landmark.y + (step * radius * 1.4) / height },
        radius, width, height,
      ));
    }
  }
  return parts.length === 1 ? parts[0] : unionMasks(...parts);
}

/**
 * HOW BIG THE ZONE IS FOR THIS FACET — every scope class handled by NAME, and
 * the unimplemented ones throwing rather than defaulting.
 *
 * # Why this is a switch and not a ternary
 *
 * It was `isDistributed(facet) ? dilate(region, 48) : region` — a five-valued
 * table collapsed to a boolean, so three classes shared one branch that had been
 * written for one of them. **`allSkin` was the casualty and it was silent:**
 * `zoneScope.ts` says a tan or a skin tone spans all visible skin, *"scoping a
 * tan to the face manufactures a body mismatch"* — and the adapter handed it
 * `region("face skin")`, which is her face. Her neck and arms would have kept
 * her old tone, and nothing anywhere would have said so.
 *
 * That is the same class as the `"earring"` fallback one screen up: **a default
 * that was true for the only implemented case and silent about being
 * scaffolding.** The rule the module already practices twenty lines above
 * (`REGION_OF_FACET` throws by name rather than inventing a prompt) applies to
 * every dispatch over a facet or an object type: handle the case, or throw
 * naming it. A default value may not stand in for an unimplemented branch.
 *
 * TypeScript's exhaustiveness check does the rest — a sixth `ZoneScope` stops
 * compiling here rather than quietly taking somebody else's branch.
 */
async function scopedZone(facet: Facet, region: Mask): Promise<Mask> {
  const scope = zoneScopeOf(facet);
  switch (scope) {
    case "distributedFacet":
      /* A pattern through a region is rendered WHOLE, with a destination
         allowance — scoping it to where it shows is the fringe error (D-233). */
      return dilateMask(region, 48);
    case "bilateralPair":
      /* Two regions, one question. The two sides are already unioned by the
         reader, which is the only door that rule cannot be forgotten behind. */
      return region;
    case "localFacet":
      /* The thing occupies one bounded place and stays there. */
      return region;
    case "allSkin":
      /*
        DECLARED, NOT IMPLEMENTED — and it says so instead of shipping a face.
        The honest zone is every visible patch of her skin (neck, chest, arms),
        which is a different segmentation question from "face skin" and does not
        have one written yet. Refusing costs a refund; the quiet version costs a
        customer a picture whose face and neck do not match.
      */
      throw new MaskError(
        `"${facet}" spans all of her visible skin, and this path can only ask about her face `
        + "— scoping it to the face would leave her neck and arms behind",
      );
    case "object":
      /* Unreachable: an addition's destination comes from a landmark, and those
         facets are filtered out before this runs. Named anyway — "it cannot get
         here" is the sentence every quiet default was written under. */
      throw new MaskError(`"${facet}" is an addition and is placed from a landmark, never segmented`);
    case "fullFrame":
      /* Unreachable: regionless facets are routed out before any zone is built.
         Kept so the switch is total rather than nearly total. */
      throw new MaskError(`"${facet}" is not a region edit and should never have reached a zone builder`);
    default: {
      const unhandled: never = scope;
      throw new MaskError(`facet "${facet}" has an unhandled zone scope ${String(unhandled)}`);
    }
  }
}

/**
 * THE REVEAL — territory the region USED to occupy and no longer does.
 *
 * Exported and pure so it can be driven with masks instead of with a painter.
 * The behaviour it encodes is the difference between a shrink that works and one
 * that is silently undone, and a test of it that has to summon a real render to
 * fire is a test of the render (working law #3).
 *
 * Read it as one sentence: **inside the zone, where her region was and the
 * painted one is not.** No instruction is consulted, so no phrasing can be
 * missed; a grow returns nothing here and takes the path it always took.
 */
export async function vacancyOf(input: {
  /** The outer bound. Vacancy can never exceed it, like every other claim. */
  zone: Mask;
  /** Where the thing is on HER picture — the territory that may be given up. */
  masterRegion: Mask;
  /** Where the painter left it. Empty is a legitimate answer: a removal. */
  paintedRegion: Mask;
  /** Grown before subtraction, so a jittering boundary vacates nothing. */
  tolerancePx: number;
}): Promise<Mask> {
  const kept = input.tolerancePx > 0
    ? await dilateMask(input.paintedRegion, input.tolerancePx)
    : input.paintedRegion;
  return intersectMask(input.zone, subtractMask(input.masterRegion, kept));
}

/**
 * Take only what was asked for, and leave the rest of her exactly as she was.
 */
export async function harvestRefinement(input: MaskedRefineInput): Promise<MaskedRefineResult> {
  if (!maskedEditingEnabledFor(input.userId)) {
    /* The dark path, and it is byte-for-byte the engine's own answer. */
    return { bytes: input.painted.bytes, contentType: input.painted.contentType, outcome: "flag-off" };
  }

  /*
    A FACET WITH NO REGION ROUTES FULL-FRAME (D-233). An expression is the whole
    face re-posing; there is no zone that contains it, and drawing one would be
    the fringe error at maximum scale. If ANY facet in this edit is regionless
    the whole edit is, because one render cannot be half-masked.
  */
  const regionless = input.facets.filter((facet) => !hasRegion(facet));
  if (regionless.length > 0) {
    log.info(
      { operationId: input.operationId, facets: regionless },
      "[maskedRefine] facet has no region — routing full-frame by design",
    );
    return { bytes: input.painted.bytes, contentType: input.painted.contentType, outcome: "no-region" };
  }

  /*
    ADDITIONS ARE PLACED, NOT SEGMENTED. The thing is not there yet, so nothing
    can segment it (D-213) — its destination comes from a landmark on HER face
    plus the described object's own extent. A facet with no landmark vocabulary
    still refuses by name rather than having one invented for it.
  */
  const objects = input.facets.filter(needsLandmarkDestination);
  const unplaceable = objects.filter((facet) => landmarkNameOf(facet, input.described) === null);
  if (unplaceable.length > 0) {
    throw new MaskError(
      `${unplaceable.join(", ")} is an addition with no landmark to place it against`
      + (input.described ? ` for "${input.described}"` : "")
      + " — inventing an anchor would be a guess dressed as anatomy",
    );
  }

  const segmentable = input.facets.filter((facet) => !needsLandmarkDestination(facet));
  const names = segmentable.map((facet) => {
    /*
      THE CALLER'S OWN PLACEMENT FIRST — one facet can live in more than one
      place, and only the instruction knows which (`makeupPlacement`).

      `makeup` used to be `face skin` whatever it said, so a lip gloss ask
      claimed her whole face and took an earlier edit's freckles with it. The
      override is passed rather than computed here because the SAME answer has
      to reach the harvest and the segment store, and two modules computing it
      separately is how they come to disagree about which mask a crop belongs to.
    */
    const name = input.regionOverrides?.[facet] ?? regionNameOf(facet);
    if (!name) {
      /* Loud. A facet with no segmentation question has no masked path, and
         inventing a prompt for it is exactly what D-213 forbids. */
      throw new MaskError(`facet "${facet}" has no region to segment — add it to REGION_OF_FACET`);
    }
    return name;
  });

  const master: Raster = await readRaster(input.master.bytes);
  let painted: Raster = await readRaster(input.painted.bytes);
  if (painted.width !== master.width || painted.height !== master.height) {
    /*
      MASTER HYGIENE, STATED RATHER THAN HIDDEN — and this is the line that
      refused the founder's first three real edits.
    
      **The MASTER is never resampled**, and that half does not bend: it is the
      picture the guarantee is about. The PATCH is another matter — we are about
      to discard most of it anyway, and the calibration harness has resized it
      since the first fixture for exactly that reason.
    
      Refusing outright was too strict for the wrong half. The engine is now
      told the exact size to return (`createFalMaskedEditEngine` pins
      `image_size`), so this should never fire; it stays as the honest fallback
      for an engine that ignores the ask, and it says so in the log rather than
      quietly resampling.
    */
    log.warn(
      {
        operationId: input.operationId,
        returned: `${painted.width}x${painted.height}`,
        master: `${master.width}x${master.height}`,
      },
      "[maskedRefine] the engine ignored the pinned size — resampling the PATCH, never the master",
    );
    const sharp = (await import("sharp")).default;
    painted = await readRaster(
      await sharp(input.painted.bytes)
        .resize(master.width, master.height, { fit: "fill" })
        .png()
        .toBuffer(),
    );
  }

  /*
    THE ZONE FOLLOWS THE FACET, NOT THE DELTA (D-233). A distributed facet — a
    cut, a colour, a texture — takes its whole region; scoping it to where the
    pixels move is what made a fringe into appliqué.
  */
  /* One paid segmentation per distinct question. Two facets that ask the same
     thing — `hair.cut` and `hair.colour` both segment "hair" — are one call. */
  const asked = new Map<string, Promise<Mask>>();
  /*
    AND THE SAME READS WITH THEIR SIDES APART, under the same keys.

    Not a second set of calls: `regionSides` performs the split `region` was
    performing anyway, and the union below is DERIVED from it. So the memo holds
    one promise per side-capable name and the whole-frame answer is a view of it
    — the alternative, asking both ways, would pay for every bilateral region
    twice to learn something the first call already knew.
  */
  const askedSides = new Map<string, Promise<SideRegions | null>>();
  /*
    A GUARD ON THE PATH THAT ACTUALLY RUNS.

    `requestMatte` checks this and `requestMatte` has no callers, so until today
    nothing checked it where masks are really acquired. A reader returning a
    differently-sized mask misaligns every subsequent index by a row and reports
    nothing: the composite would still produce bytes, the guarantee would still
    "hold" against its own wrong mask, and the picture would be quietly wrong.
    **Never resize a mask to fit** — that is a resample on the one path that
    promises not to have one, and it moves every edge it touches.
  */
  const singleChannel = (mask: Mask, what: string): Mask => {
    if (mask.data.length !== mask.width * mask.height) {
      throw new MaskError(`the "${what}" mask is ${mask.data.length} bytes for ${mask.width}x${mask.height} — not single-channel`);
    }
    return mask;
  };
  const regionOf = (which: "master" | "painted", name: string, absentIsAnswer = false) => {
    const key = `${which}:${name}:${absentIsAnswer}`;
    const already = asked.get(key);
    if (already) return already;

    const image = which === "master" ? input.master.bytes : input.painted.bytes;
    const split = input.reader.regionSides
      ? input.reader.regionSides({ image, name, absentIsAnswer })
      : Promise.resolve(null);
    askedSides.set(key, split);
    const pending = split.then(async (sides) => {
      if (!sides) return input.reader.region({ image, name, absentIsAnswer });
      /* Each half is checked in its own right: the union of two bad strides
         would be caught here, but a side handed on to the library never passes
         through it. */
      singleChannel(sides.left, `${name} (her left)`);
      singleChannel(sides.right, `${name} (her right)`);
      return unionMasks(sides.left, sides.right);
    }).then((mask) => singleChannel(mask, name));
    asked.set(key, pending);
    return pending;
  };

  let zone: Mask | null = null;
  /*
    GROUND THIS EDIT LEGITIMATELY OWNS, collected as it is computed rather than
    re-derived later. It is what keeps the territory rule from re-creating "the
    composite puts them back": a removal's reveal, a shrink's reveal and an
    addition's destination all land on a neighbour's master territory on
    purpose, and an addition has no master extent of its own to appeal to.
  */
  const owned: Mask[] = [];
  /*
    AND THE GROUND AN ADDITION OWNS, UNDER A NAME (the accessory corridor).

    `owned` is a list of anonymous masks — enough for the territory rule, which
    only asks "may this edit legitimately be here", and useless to the segment
    cutter, which asks "where does `statedAccessories` live". That gap is the
    whole reason `statedAccessories: ZERO` is the production census: the corridor
    existed, governed the paint, and was never named, so nothing could look it
    up. Named here, filed into `evidence.masterRegions` below.
  */
  const placed = new Map<string, Mask>();
  for (let index = 0; index < segmentable.length; index += 1) {
    const region = await regionOf("master", names[index]);
    owned.push(region);
    const scoped = await scopedZone(segmentable[index], region);
    zone = zone ? unionMasks(zone, scoped) : scoped;
  }
  for (const facet of objects) {
    /* Two landmarks means two corridors — the bilateral law, and the reason a
       stud's scale can be read off her face rather than guessed. */
    const points = await input.reader.landmark({
      image: input.master.bytes, name: landmarkNameOf(facet, input.described)!,
    });
    const destination = additionDestination({
      landmarks: points,
      width: master.width,
      height: master.height,
      /* A drop hangs; glasses sit. The described object says which. */
      dropSteps: hangsBelowAnchor(input.described) ? 6 : 0,
    });
    /* THE ADDITION'S OWN GROUND. Its master extent is empty — there are no
       glasses on her yet — so the destination corridor is the only thing that
       can own the temples the arms are about to sit on. */
    owned.push(destination);
    /*
      THE SAME TABLE THAT PLACED IT NAMES IT — through `accessoryEntry`, never a
      second scan of the same words. `pairClauseFor` put "one on each ear" on a
      NOSE STUD by re-scanning the word list one function from where the
      longest-match rule was born; the corridor is filed under the entry the
      landmark itself came from, so the mask and its name cannot disagree about
      what kind of object this is.
    */
    const kind = accessoryEntry(input.described)?.region;
    if (kind) {
      const already = placed.get(kind);
      placed.set(kind, already ? unionMasks(already, destination) : destination);
    }
    zone = zone ? unionMasks(zone, destination) : destination;
  }
  /*
    A REMOVAL CAN BE THE WHOLE INSTRUCTION, and then there are no facets at all.

    `facetsWrittenBy(composed)` is built from what the recipe still says, and a
    removal that pruned its only step leaves it empty — so this threw "no facets
    to mask" and the refinement refunded, for an ask the painter had carried out
    perfectly. The departed thing is the territory in that case: her own frames,
    from her own master.
  */
  for (const departedThing of (zone ? [] : input.departed ?? [])) {
    const gone = accessoryEntry(departedThing);
    if (!gone) {
      throw new MaskError(
        `nothing names what "${departedThing}" is — refusing to guess where it was`,
      );
    }
    const worn = await regionOf("master", gone.region, true);
    if (coverage(worn) > 0) zone = zone ? unionMasks(zone, worn) : worn;
  }
  if (!zone) throw new MaskError("no facets to mask");

  /*
    ONE HARVEST PER REGION THE INSTRUCTION TOUCHES — and this is not an edge
    case, it is every chain past its first step.

    The harvest name used to be `names[0]`, with a literal `"earring"` fallback
    when no facet was segmentable. Both were the placeholder-turned-load-bearing
    class: true for the only case anyone had driven, silent about the rest. An
    ask about GLASSES harvested wherever her earrings were, and a compound
    dropped every region after the first.

    **Refusing compounds was my first answer and it was wrong.** Refinements are
    BASE-ANCHORED (D-86): variant N is the ORIGINAL edited by composed
    instructions 1..N, and the master handed to this function is that original.
    So `facetsWrittenBy(composed)` legitimately carries every facet the chain has
    ever written, and by step two of any real session the edit spans two regions.
    A refusal there would have refused the founder's walk at its second step —
    freckles, then fox eyes — while every test stayed green, because nothing in
    the suite drives a CHAIN through this function.

    So each distinct question gets its own harvest, its own reveal and its own
    strand colour, and the results are unioned. The strand colour matters most:
    it is measured from the interior of confirmed content, and one colour shared
    between a hair region and a lip region would be neither of them.

    This is the multi-patch composition D-233's makeup ruling describes, inside
    one render rather than across several. Independently retryable renders are
    still the fuller answer and still their own build.
  */
  type Question = {
    name: string;
    /** May the master legitimately not have this? True only for an addition. */
    absentOnMaster: boolean;
    /** Does her own hair sit in front of it? True only for an accessory. */
    occluded: boolean;
    /**
     * Is this region's occupant a thing the customer asked to have TAKEN OFF?
     *
     * Narrower than `absentOnMaster`, which an addition also sets, and narrower
     * than "something can leave here", which a shrink also sets. It is true only
     * for a name that came out of `input.departed` — and the reason it has to
     * exist is that the removal's rule about a partly-covered pixel governs a
     * departure's vacancy and must NOT govern a shrink's.
     */
    departed: boolean;
  };
  const questions: Question[] = Array.from(new Set(names))
    .map((name) => ({ name, absentOnMaster: false, occluded: false, departed: false }));
  if (objects.length > 0) {
    const entry = accessoryEntry(input.described);
    if (!entry) throw new MaskError("nothing names what this accessory is — refusing to guess a region");
    questions.push({ name: entry.region, absentOnMaster: true, occluded: true, departed: false });
  }
  /*
    AND THE THING THAT LEFT, which no facet in the record points at any more.

    `absentOnMaster: true` is what makes the loop below widen the zone from HER
    OWN frame — for a removal the object is on the master, and the landmark
    corridor is two small discs at the eyes while her frames run out to her
    temples. The vacancy arithmetic is then exactly the distributed shrink's:
    `zone ∩ (masterRegion − painted)`, which for a removed object is its whole
    footprint, because the painter's answer to "where are the glasses" is
    correctly nothing.
  */
  for (const departedThing of input.departed ?? []) {
    const gone = accessoryEntry(departedThing);
    if (!gone) {
      throw new MaskError(
        `nothing names what "${departedThing}" is — refusing to guess where it was`,
      );
    }
    /*
      MARKED, NOT JUST ADDED. "Take the glasses off and give her sunglasses"
      names one region twice — the departure and the addition — and pushing a
      second question would ask the segmenter the same thing twice while the
      one that survives carries the wrong flag. The region is departed ground
      either way; whether something new arrives there is a separate fact.
    */
    const already = questions.find((question) => question.name === gone.region);
    if (already) already.departed = true;
    else questions.push({ name: gone.region, absentOnMaster: true, occluded: true, departed: true });
  }
  if (questions.length === 0) {
    throw new MaskError("nothing names what this edit is about — refusing to guess a region");
  }

  /*
    FOR A REMOVAL, HER CURRENT OBJECT IS THE TERRITORY THAT MUST STOP BEING IT.

    The landmark corridor is two small discs at the eyes; her frames run out to
    her temples. A zone that does not contain the thing being removed cannot
    remove it — the harness's SHRINK arm has always taken the master's own region
    as the zone, and this is that, unioned rather than substituted so an addition
    keeps its destination allowance.
  */
  for (const question of questions) {
    if (!question.absentOnMaster) continue;
    const worn = await regionOf("master", question.name, true);
    /* Her frames, where they are NOW — the removal's own ground, temples and
       all, and the reason a glasses removal is not clipped by the rule below. */
    if (coverage(worn) > 0) owned.push(worn);
    if (coverage(worn) > 0) zone = unionMasks(zone, worn);
  }

  const paintedSubject = await input.reader.subject({ image: input.painted.bytes });
  /*
    THE DEPTH STACK, for additions. Her hair sits in front of anything at the
    lobe, so it rides as `occludedBy` and an earring under it renders BEHIND it
    by construction — softly, so a half-transparent strand passes half the metal
    through, which is what a real strand does to the light behind it.
  */
  const inFront = questions.some((question) => question.occluded)
    ? await input.reader.region({ image: input.master.bytes, name: "hair" }).catch(() => null)
    : null;

  const strandReach = scaled(STRAND_REACH_FRACTION, master.width, master.height);
  const departedReach = scaled(DEPARTED_REACH_FRACTION, master.width, master.height);
  const departedEdgeReach = scaled(DEPARTED_EDGE_REACH_FRACTION, master.width, master.height);
  const tolerancePx = scaled(VACANCY_TOLERANCE_FRACTION, master.width, master.height);
  const territoryStep = scaled(DEPARTED_TERRITORY_STEP_FRACTION, master.width, master.height);

  const perRegion: {
    withStrands: Mask;
    vacated: Mask;
    departed: Mask;
    vacancy: Mask;
    /** Empty unless this question is a base-worn departure — see `territory`. */
    territory: Mask;
    /** Whether this vacancy is the removal's to rule. Never true for a shrink. */
    removalGoverned: boolean;
    strandColour: [number, number, number];
  }[] = [];

  for (const question of questions) {
    /*
      WHERE THE THING IS *NOW* — the question that makes a shrink possible
      without anything ever classifying the instruction. For a segmentable facet
      the answer is already in hand (the zone was built from it, so this is a
      cache hit). For an accessory it is what separates an addition from a
      removal: she is wearing glasses or she is not, and "nowhere" is a
      legitimate answer rather than a failure.
    */
    const masterRegion = await regionOf("master", question.name, question.absentOnMaster);
    /*
      The harvest asks what the PAINTER actually drew. For an addition that is
      the object itself — now that it exists it can be segmented, which is the
      whole asymmetry: unsegmentable before, segmentable after. And for a removal
      the honest answer is *nothing*, which is the point rather than a problem.
    */
    const paintedContent = await regionOf("painted", question.name, true);
    const harvest = await harvestMatteFrom({
      content: paintedContent,
      matte: paintedSubject,
      taperPx: 8,
      ...(question.occluded && inFront ? { occludedBy: inFront } : {}),
    });

    /*
      The strand alpha the segmenter's boundary discards — exact, because we own
      the background (D-230). ONLY where the material has one: see
      `FRINGE_AT_EDGE`. A face-skin harvest reaching forty pixels past the jaw
      recovered a slab of background lying over her hair at alpha 0.730, and the
      composite delivered it as a hole. Skin has no fringe to rescue, so nothing
      is lost by not looking for one.
    */
    const strands = hasFringeAtEdge(question.name)
      ? differenceMatte({ master, patch: painted, confirmed: harvest, reachPx: strandReach })
      : {
        alpha: { data: Buffer.alloc(harvest.data.length, 0), width: harvest.width, height: harvest.height },
        /* The gate still needs the content's own colour; it just does not need
           a recovery to obtain it. */
        strandColour: confirmedColour(painted, harvest) ?? ([0, 0, 0] as [number, number, number]),
      };
    const withStrands: Mask = {
      data: Buffer.from(harvest.data.map((value, index) => Math.max(value, strands.alpha.data[index]!))),
      width: harvest.width,
      height: harvest.height,
    };

    /*
      A REVEAL ONLY EXISTS WHERE SOMETHING CAN LEAVE — see `MOVES_ITS_EDGE`.

      Both halves of this ran for every question. On a `marks` edit that meant a
      freckle instruction hunting across 160 pixels for skin that had departed
      from her face, and then delivering the painter's replacement for it. That
      is where run-6's phantom hank of hair arrived on her neck: `vacated` was
      zero and `departed` claimed 7,955 px of the band.

      Freckles do not remove skin. Nothing is lost by not asking.
    */
    const empty: Mask = { data: Buffer.alloc(master.width * master.height, 0), width: master.width, height: master.height };
    const canReveal = anyFacetMovesAnEdge(input.facets)
      /* A departure is a reveal by definition, whatever the facets say — a
         removal that pruned its only step leaves `facets` empty. */
      || (input.departed?.length ?? 0) > 0;
    const vacated = canReveal
      ? await vacancyOf({ zone, masterRegion, paintedRegion: paintedContent, tolerancePx })
      : empty;
    const departed = canReveal
      ? differenceMatte({
        master: painted,
        patch: master,
        confirmed: masterRegion,
        /* A shrink's flyaways lie most of the way down her chest; a removed
           object's edge lies against the object. See the two reach notes. */
        reachPx: question.departed ? departedEdgeReach : departedReach,
      })
      : { alpha: empty };
    const departedFully: Mask = {
      data: Buffer.from(departed.alpha.data.map((value) =>
        Math.min(255, Math.round(value / REMOVAL_TOTAL_ABOVE)))),
      width: departed.alpha.width,
      height: departed.alpha.height,
    };
    /*
      THE DEPARTED THING'S OWN TERRITORY — and the reason it is not the zone.

      A segmentation tight to an object cannot contain that object's own
      anti-aliased edge and contact shadow: measured on the glasses fixture,
      **79.5% of the surviving rim lay OUTSIDE the segmenter's own eyeglasses
      mask**, and the zone for a pure removal IS that mask, so the vacancy was
      clipped to the inside of the very outline the customer can still see.

      So the ground grows the way the hem's guillotine was answered — expand
      until her old content stops pressing against the boundary, with the old
      content itself as the rider's subject. Bounded three ways: it starts from
      her own frames, it only ever grows toward pixels the difference matte says
      carry the departed thing, and the loop's own coverage ceiling stops it.

      Only for a DEPARTURE. A shrink's old strands are recovered by the same
      matte and must keep passing the veil gate — the flyaway that arrives as a
      hank of hair on her neck is what that gate is holding back.

      The rider's subject here is HER OLD OBJECT AND EVERYTHING THE MATTE STILL
      FINDS OF IT, unioned, and that union is not cosmetic: the recovery only
      ever fires OUTSIDE the segmentation it was given, so a mask of it alone
      touches the seed zone nowhere, reports no contact, and the loop returns
      the tight outline it was handed. The thing pressing on the boundary is the
      object; what lies just past the boundary is the rest of the object.
    */
    const oldContent = unionMasks(masterRegion, attachedTo(departedFully, masterRegion));
    const grownTerritory = question.departed && coverage(masterRegion) > 0
      ? await expandUntilClear({
        painted: oldContent,
        zone: masterRegion,
        stepPx: territoryStep,
        effective: oldContent,
      })
      : null;
    const territory = grownTerritory?.zone ?? null;
    if (grownTerritory) {
      log.info(
        {
          operationId: input.operationId,
          question: question.name,
          passes: grownTerritory.passes,
          stoppedBy: grownTerritory.stoppedBy,
          contactAtStart: grownTerritory.contactAtStart,
          contactAtEnd: grownTerritory.contactAtEnd,
          seenAsScoped: Number(coverage(masterRegion).toFixed(5)),
          ground: Number(coverage(grownTerritory.zone).toFixed(5)),
        },
        "[maskedRefine] the departed thing's own ground, grown until its edge stopped pressing",
      );
    }
    const departedVacated = canReveal
      ? await vacancyOf({
        zone: territory ?? zone, masterRegion: departedFully, paintedRegion: paintedContent, tolerancePx,
      })
      : empty;

    perRegion.push({
      withStrands,
      vacated,
      departed: departed.alpha,
      vacancy: unionMasks(vacated, departedVacated),
      territory: territory ?? empty,
      /*
        ONE PIXEL CANNOT SERVE TWO MASTERS, and this file already ruled which
        master a removal's pixel serves. `REMOVAL_TOTAL_ABOVE` says it plainly —
        *a pixel a quarter covered by the departing thing is still a contaminated
        pixel, and taking the plate at a quarter strength leaves a ghost* — and
        `departedFully` honours it; then the veil gate downstream, whose novelty
        criterion was calibrated to suppress painter-forehead inside a HAIR
        silhouette, scaled those same partial pixels back down and handed ~85% of
        what the recovery caught straight back to her master.

        The two gates are asking opposite questions. The veil gate asks *is this
        her surface rendered again?* and keeps what is novel. A removal asks *was
        any of this the thing that left?* and must replace whatever was. Inside
        the departed thing's own territory the second question is the only one
        with a meaning: there is no surface of hers to protect there — what lies
        under her frames is precisely what the painter was asked to invent.
      */
      removalGoverned: territory !== null,
      strandColour: strands.strandColour,
    });
  }

  /*
    AND THE TERRITORY IS PART OF THE ZONE, or none of the above reaches the
    picture. The composite takes `min(feather(zone), matte)`, so a vacancy
    outside the zone is discarded no matter what any matte says — the same
    arithmetic as the guillotine, which is why the fix has to land in both
    places. Unioned after the loop rather than before it, so a shrink's reveal
    keeps being measured against the zone its own facet drew.
  */
  /*
    HELD BEFORE THE TERRITORY JOINS IT, because `zoneAsScoped` means what its
    name says: the zone as the facet's scope drew it, before any boundary
    expansion. Folding the territory into it silently redefined the population
    every measurement downstream is taken over — this diagnosis has already lost
    one verdict to a shifted population and will not lose a second.
  */
  const zoneAsScoped = zone;
  const departedTerritory = unionMasks(...perRegion.map((region) => region.territory));
  /* The half of the vacancy the veil gate no longer governs, kept for the record
     rather than recomputed — a second derivation of it could disagree. */
  const departedVacancy = unionMasks(
    ...perRegion.map((region) => (region.removalGoverned ? region.vacancy : region.territory)),
  );
  if (coverage(departedTerritory) > 0) {
    zone = unionMasks(zone, departedTerritory);
    /* Owned ground, so the neighbour rule cannot give the rim back to `hair`
       — her temples are exactly where the arms of a pair of glasses sit. */
    owned.push(departedTerritory);
  }

  /*
    The painter's own drift, measured per render — from territory this composite
    claims NOTHING in, across every region. The vacancy is claimed, so it is
    excluded from the sample for the same reason the harvest always was: a
    baseline drawn through the loud part of the frame raises the bar the loud
    part then has to clear.
  */
  const claimed = unionMasks(...perRegion.flatMap((region) => [region.withStrands, region.vacancy]));
  const quietSamples: number[] = [];
  for (let pixel = 0; pixel < claimed.data.length; pixel += 1) {
    if (claimed.data[pixel] !== 0 || pixel % 37 !== 0) continue;
    const at = pixel * 3;
    quietSamples.push((Math.abs(painted.data[at] - master.data[at])
      + Math.abs(painted.data[at + 1] - master.data[at + 1])
      + Math.abs(painted.data[at + 2] - master.data[at + 2])) / 3);
  }
  quietSamples.sort((a, b) => a - b);
  const baselineDelta = quietSamples[Math.floor(quietSamples.length / 2)] ?? 0;

  /*
    Each region gated with ITS OWN strand colour. Only what is really the new
    content, never her surface rendered again — and the reveal narrowed by the
    same gate on `novelty` only, because what lands in a reveal is background and
    skin, and asking it to look like the strand would revert every pixel of it.
  */
  const ungoverned = unionMasks(...perRegion.map((region) => unionMasks(
    harvestGate({
      master, patch: painted, alpha: region.withStrands,
      strandColour: region.strandColour, baselineDelta,
    }).alpha,
    /*
      THE ONE BYPASS, AND IT IS SCOPED TO THE THING THAT LEFT. Inside a
      departure's own territory the removal's rule governs — see
      `removalGoverned`. Everywhere else, including every shrink's reveal and
      every surface repaint, the veil gate governs exactly as it did.
    */
    region.removalGoverned
      ? region.vacancy
      : harvestGate({
        master, patch: painted, alpha: region.vacancy,
        strandColour: region.strandColour, baselineDelta, criterion: "novelty",
      }).alpha,
  )));
  const harvested = unionMasks(...perRegion.map((region) => region.withStrands));
  const vacated = unionMasks(...perRegion.map((region) => region.vacated));
  const departedAlpha = unionMasks(...perRegion.map((region) => region.departed));

  /*
    THE TERRITORY RULE — see `CONFUSABLE_NEIGHBOURS`.

    Subtracted from the DELIVERED content rather than from the zone, so the
    expansion, the interaction band and the feather all inherit it and nothing
    downstream has to remember. A pixel that on the MASTER belongs to a region
    this instruction never named is not this edit's to change, however confident
    the harvest is about it.

    `owned` is the escape hatch and it is load-bearing: the named regions' own
    master extents, a departed object's current footprint, an addition's
    destination corridor, and every reveal computed above. Without it this rule
    IS "the composite puts them back" — the defect it exists downstream of.
  */
  const namedRegions = new Set(questions.map((question) => question.name));
  const protectedNames = new Set<string>();
  for (const question of questions) {
    for (const neighbour of confusableNeighboursOf(question.name)) {
      if (!namedRegions.has(neighbour)) protectedNames.add(neighbour);
    }
  }
  let gated = ungoverned;
  let protectedTerritory: Mask | null = null;
  if (protectedNames.size > 0) {
    const ownedGround = unionMasks(
      ...owned,
      ...perRegion.map((region) => region.vacancy),
      ...perRegion.map((region) => region.vacated),
    );
    for (const name of Array.from(protectedNames)) {
      /*
        FROM THE MASTER, ALWAYS. The painted frame is the thing under suspicion;
        asking it where her hair is would let the measurement follow the answer
        around, which is how run-6's harvest came to believe her hair was skin.

        A neighbour the reader cannot find is not a reason to refuse the whole
        render — it is a reason to protect nothing, which is the behaviour this
        path had before the rule existed.
      */
      const territory = await regionOf("master", name, true).catch(() => null);
      if (territory === null || coverage(territory) === 0) continue;
      protectedTerritory = protectedTerritory
        ? unionMasks(protectedTerritory, territory)
        : territory;
    }
    if (protectedTerritory !== null) {
      const forbidden = subtractMask(protectedTerritory, ownedGround);
      gated = subtractMask(gated, forbidden);
      log.info(
        {
          operationId: input.operationId,
          protecting: Array.from(protectedNames),
          surrenderedCoverage: Number((coverage(ungoverned) - coverage(gated)).toFixed(5)),
        },
        "[maskedRefine] territory it was never asked about, given back to her master",
      );
    }
  }

  /* A zone that stops where the content does not is a guillotine (D-230). */
  const grown = await expandUntilClear({
    /*
      THE PAINT THAT WILL ACTUALLY BE DELIVERED, not everything the painter
      touched — and the difference is the whole behaviour of this loop.

      Defined as "any pixel differing by 25 levels", the mask was the painter's
      WHOLE-FRAME DRIFT: a generated frame differs almost everywhere, so content
      pressed against every edge of the zone forever and the loop grew to its
      pass cap with the zone covering 100% of the frame. Sixteen dilations of a
      1024x1536 mask, twenty to thirty seconds, and a destination zone that had
      stopped meaning anything.

      The rider's subject is the CONTENT, and the content is what the harvest
      keeps. A strand pressing against the boundary is a clipped strand; a
      repainted background pixel is not, and it never was.
    */
    painted: { data: Buffer.from(gated.data), width: gated.width, height: gated.height },
    zone,
    stepPx: 48,
    effective: gated,
  });

  /* Contact shadows, darkening only — her hue cannot change (D-229). */
  const adopted = adoptInteraction({
    master, patch: painted, harvest: gated,
    bandPx: scaled(BAND_FRACTION, master.width, master.height),
    mode: "shadow",
  });

  /* Refused before the composite if the mask cannot do its job. */
  assertUsable(adopted.alpha, "skin");

  const composed = await compositeMasked({
    master, patch: adopted.patch, mask: grown.zone, edgeMatte: adopted.alpha, featherRadius: FEATHER_PX,
  });
  /*
    AND DID WE TEAR IT? — the question nothing in the product asked (see
    `compositeIntegrity`). `outsideMaskUnchanged` proves we changed nothing we
    should not have; this asks whether what we changed INSIDE was cut across
    real content. Run-6's torn render passed the first and would have failed
    this one, and it was scored `delivered_compliant`.
  */
  const seam = compositeSeam({
    master, composite: composed.composite, applied: composed.applied,
  });
  /*
    ENFORCING only where a step at the boundary can never be legitimate. A cut,
    a removal or a shrink is SUPPOSED to change the silhouette, and one clean
    specimen of that kind is not a calibration — those record the verdict and
    deliver, which is how `renderFault` shipped before it was flipped on a
    number. The shadow period produces the evidence its own flip needs.
  */
  const seamEnforced = !anyFacetMovesAnEdge(input.facets)
    && (input.departed?.length ?? 0) === 0;
  if (seam.torn) {
    log[seamEnforced ? "error" : "warn"](
      {
        operationId: input.operationId,
        facets: input.facets,
        enforced: seamEnforced,
        boundaryPixels: seam.boundaryPixels,
        tornPixels: seam.tornPixels,
        worstExcess: Number(seam.worstExcess.toFixed(1)),
      },
      seamEnforced
        ? "[maskedRefine] OUR COMPOSITE TORE THE FRAME — refusing to deliver it"
        : "[maskedRefine] composite seam on an edge-moving edit — SHADOW, delivered anyway",
    );
    if (seamEnforced) {
      /*
        KEEP THE FRAMES, because this refusal is the one nobody could diagnose.
        Dark on every account but the founder's; never throws.
      */
      /* `userId` is optional on this input and the capture is owner-scoped, so
         an unattributed render captures nothing rather than guessing an owner. */
      if (input.userId !== undefined) await captureRefusedRender({
        userId: input.userId,
        operationId: input.operationId ?? "unattributed",
        reason: "composite_fault",
        frames: [
          { name: "painted", bytes: input.painted.bytes },
          { name: "composite", bytes: await writePng(composed.composite) },
          /*
            AND THE ALPHA WE ACTUALLY PAINTED WITH (fable-233 §3).

            `applied` is `min(feather(zone), edgeMatte)` — computed here and,
            until now, discarded. It is the term that decides every boundary
            argument this refusal is about, and without it "the painter drew it
            wrong" and "our own cut lost ground" are indistinguishable from the
            two frames beside it. Run-9 refused at 62 boundary pixels, in the
            middle of a range with no specimen either side, and the frame that
            would settle it does not exist.

            It costs nothing new: the capture's own contract already named it
            (`DiagnosticFrame`: *"`painted`, `composite`, `applied`"*), and it
            rides the same scope, the same private bucket, the same
            reserve-before-write and the same purge promise as the other two.
            One more registered object on a refusal, on one account.

            **This is the half of the gap that is free.** The attribution that
            had to be withdrawn was a DELIVERED render, and this site fires only
            on `composite_fault` — capturing `applied` on delivery is outside the
            founder's narrow approval and is his line, not ours.
          */
          { name: "applied", bytes: await writeMaskPng(composed.applied) },
        ],
      });
      /*
        Its own failure class, because the receipt is the record. `render_fault`
        writes "the image came back damaged" about a provider that did nothing
        wrong — the exact mistake `facts_missing` was split out to stop, one
        layer further in. This one is ours.
      */
      throw new ProviderError("composite_fault", seam.detail);
    }
  }

  const outside = outsideMaskUnchanged(master, composed.composite, composed.applied);
  if (!outside.identical) {
    /* Arithmetic, so this cannot happen — which is exactly why it is checked.
       A guarantee nobody verifies at the point of use is a claim. */
    throw new MaskError(
      `the composite changed ${outside.changedPixels} px outside the applied mask — refusing to deliver it`,
    );
  }

  log.info(
    {
      operationId: input.operationId,
      facets: input.facets,
      zoneCoverage: Number(coverage(grown.zone).toFixed(4)),
      blendBand: outside.bandPixels,
      expansionPasses: grown.passes,
    },
    "[maskedRefine] composited — outside the mask, byte-identical to her master",
  );

  return {
    bytes: await writePng(composed.composite),
    contentType: "image/png",
    outcome: "composited",
    guarantee: {
      outsideIdentical: outside.identical,
      blendBandPixels: outside.bandPixels,
      zoneCoverage: coverage(grown.zone),
    },
    /*
      THE SEAM VERDICT, CARRIED OUT RATHER THAN LOGGED AWAY (fable-119).

      It existed only as a log line, and only when it fired — so the shadow
      period this check has been running in produced nothing a report could be
      derived from. That is fable-109's ruling one consumer over: **a log is not
      an artifact.** The intersections moved onto the row for exactly this
      reason and the flip decision has been waiting on three anecdotes ever
      since.

      Every render, torn or clean, shadow or enforced. A verdict recorded only
      when it fires is a sample of failures with no denominator.
    */
    seam: {
      torn: seam.torn,
      enforced: seamEnforced,
      boundaryPixels: seam.boundaryPixels,
      tornPixels: seam.tornPixels,
      share: seam.share,
      worstExcess: seam.worstExcess,
      /* Shadow only — one specimen is not a calibration. See `SeamVerdict`. */
      signedMean: seam.signedMean,
      signedSpread: seam.signedSpread,
      coherence: seam.coherence,
    },
    /*
      Harvested from the memo the segmentation calls already share, so this is
      a VIEW of what was asked rather than a second list that can drift from it
      (derive, never mirror). Only settled master reads: a promise that rejected
      is not evidence, and awaiting one here would make the verification step
      pay for a call the composite already gave up on.
    */
    evidence: {
      applied: composed.applied,
      masterRegions: await settledMasterRegions(asked, placed),
      deliveredRegions: await settledDeliveredRegions(asked),
      masterSideRegions: await settledSideRegions(askedSides, belongsToMaster(placed)),
      deliveredSideRegions: await settledSideRegions(askedSides, belongsToDelivered),
    },
    ...(input.explain
      ? {
        explain: {
          zoneAsScoped,
          zone: grown.zone,
          harvested,
          vacated,
          departed: departedAlpha,
          departedTerritory,
          departedVacancy,
          ungoverned,
          delivered: gated,
          applied: composed.applied,
        },
      }
      : {}),
  };
}

/**
 * The geography this composite actually obtained, by question.
 *
 * Reads the same memo the composite used, so it cannot name a region the
 * composite did not really segment. A read that REJECTED is left out entirely:
 * the caller's rule is "no region, live read", and a rejected promise is a
 * no-region — reporting it as anything else would let a failed segmentation
 * masquerade as proof that nothing changed there.
 *
 * `placed` is the other kind of answer — an addition's destination corridor,
 * which was never segmented because the thing was not there to segment.
 *
 * # The two are UNIONED, and precedence would have been the same bug again
 *
 * They collide on every addition, and not rarely: an addition asks the master
 * for its own region too (`absentOnMaster`, so that "nowhere" is a legitimate
 * answer), which files `earring` into this map from a read whose honest answer
 * for a genuine addition is EMPTY. Letting either side win outright is wrong in
 * one direction or the other, and letting the READ win — the instinct, since a
 * read is evidence and a corridor is a guess — would have overwritten the
 * corridor with nothing and filed zero accessory segments while every test went
 * green. That is the defect this whole change exists to end, one layer deeper.
 *
 * The union is not a compromise between them; it is the delivered-anchored
 * design's own rule (`own(facet) = applied ∩ (delivered ∪ master)`) arriving at
 * its first consumer. Each side is a different ground and the edit needs both:
 *
 * - the **corridor** is ARRIVED ground — where the new hoop now hangs, which
 *   the master cannot know about because there was nothing there;
 * - the **master read** is DEPARTED ground — where the studs she was already
 *   wearing sat, which the corridor does not reach and which has to vacate.
 *
 * Neither is a claim on its own: `applied` still governs, so a union with empty
 * is exactly the other side, and a segment only ever owns pixels this render was
 * actually allowed to change.
 *
 * # And the DELIVERED extent, for a placed name only
 *
 * The corridor is a conservative geometric guess made before the paint — the
 * founder's rider is explicit that it errs small and lets boundary-contact
 * expansion catch the rest. So the segment cut from it alone would lose a hoop
 * that hangs past six drop steps, and the fringe the expansion won back.
 *
 * The delivered answer is already in hand: the harvest asks the PAINTED frame
 * where this thing is now (`painted:<region>`), for its own content gate. Union
 * it in and the placed ground becomes `corridor ∪ delivered` — the design's
 * arrived ground, at its true extent, for no new vision call. Empty is a
 * legitimate answer to that question and unions to exactly the corridor, so a
 * segmenter that cannot find a two-pixel wire costs nothing.
 *
 * Only for a name `placed` already holds. A painted read for an ordinary region
 * is a different question with a different meaning to its consumers, and hoping
 * it means the same thing here is how a map comes to hold two kinds of answer
 * under one name without saying so.
 */
/**
 * `<which>:<name>:<absentIsAnswer>` — the question is the middle field.
 *
 * ONE parser, because there are now two readers of this memo and a second copy
 * of a key format is a second thing to keep in step with `regionOf` (law 4).
 */
function askedQuestion(key: string): { which: string; name: string } {
  const which = key.slice(0, key.indexOf(":"));
  return { which, name: key.slice(which.length + 1, key.lastIndexOf(":")) };
}

/**
 * Settle a subset of the memo into a map by region name.
 *
 * `keep` decides which reads belong to the map being built, so the two callers
 * differ by their predicate and by nothing else. Only SETTLED reads: a promise
 * that rejected is not evidence, and awaiting one here would make a later step
 * pay for a call the composite already gave up on.
 */
async function settledRegions(
  asked: ReadonlyMap<string, Promise<Mask>>,
  keep: (question: { which: string; name: string }) => boolean,
  seed?: ReadonlyMap<string, Mask>,
): Promise<ReadonlyMap<string, Mask>> {
  const settled = new Map<string, Mask>(seed ? Array.from(seed.entries()) : []);
  await Promise.all(
    Array.from(asked.entries()).map(async ([key, pending]) => {
      const question = askedQuestion(key);
      if (!keep(question)) return;
      try {
        const read = await pending;
        const already = settled.get(question.name);
        settled.set(question.name, already ? unionMasks(already, read) : read);
      } catch { /* a no-region, and the caller reads that as "look again". */ }
    }),
  );
  return settled;
}

/**
 * WHICH READS BELONG TO WHICH MAP — one predicate per map, named once.
 *
 * The whole-frame maps and the side maps are the SAME reads filed two ways, so
 * they must agree about membership. A second copy of "master, plus the painted
 * read of a placed name" is the copy that drifts: the day somebody widens one,
 * the sides quietly stop matching the union they were split from.
 */
const belongsToMaster = (placed?: ReadonlyMap<string, unknown>) => (
  ({ which, name }: { which: string; name: string }) => (
    which === "master" || (which === "painted" && Boolean(placed?.has(name)))
  )
);
const belongsToDelivered = ({ which }: { which: string; name: string }) => which === "painted";

async function settledMasterRegions(
  asked: ReadonlyMap<string, Promise<Mask>>,
  placed?: ReadonlyMap<string, Mask>,
): Promise<ReadonlyMap<string, Mask>> {
  return settledRegions(asked, belongsToMaster(placed), placed);
}

/**
 * The same settling, for the reads that came back as two sides.
 *
 * `placed` seeds nothing here on purpose: an addition's corridor is a
 * DESTINATION, drawn from landmarks rather than read off a picture, and it has
 * no left and right of its own. What a placed accessory does get is its own
 * PAINTED read, split per side by the same predicate the whole-frame map uses —
 * which is how a pair of hoops that did not exist on the master still arrives
 * here as two things.
 *
 * A name whose read did not settle, or whose reader cannot answer two-sidedly,
 * is simply absent. There is no entry meaning "we guessed which side".
 */
async function settledSideRegions(
  askedSides: ReadonlyMap<string, Promise<SideRegions | null>>,
  keep: (question: { which: string; name: string }) => boolean,
): Promise<ReadonlyMap<string, SideRegions>> {
  const settled = new Map<string, SideRegions>();
  await Promise.all(
    Array.from(askedSides.entries()).map(async ([key, pending]) => {
      const question = askedQuestion(key);
      if (!keep(question)) return;
      try {
        const sides = await pending;
        if (!sides) return;
        const already = settled.get(question.name);
        settled.set(question.name, already
          ? {
            left: unionMasks(already.left, sides.left),
            right: unionMasks(already.right, sides.right),
          }
          : sides);
      } catch { /* a no-region, and the caller reads that as "look again". */ }
    }),
  );
  return settled;
}

/**
 * WHERE EACH ASKED-ABOUT THING IS IN THE DELIVERED FRAME.
 *
 * The painted half of the memo, under the region's own name — the arrived
 * ground of `own(facet) = applied ∩ (delivered ∪ master)`. Same reads
 * `settledMasterRegions` throws away for an ordinary name, kept under a map
 * that says what they are instead of being smuggled into one that does not.
 *
 * Every painted name, including a placed one. The accessory case already
 * unions its delivered extent into `masterRegions` (fable-120 half 1) and
 * union is idempotent, so appearing in both maps changes no cut — and leaving
 * it out of this one would make "the delivered extent, by name" false for
 * exactly the facet class that needed it first.
 */
async function settledDeliveredRegions(
  asked: ReadonlyMap<string, Promise<Mask>>,
): Promise<ReadonlyMap<string, Mask>> {
  return settledRegions(asked, belongsToDelivered);
}

/**
 * The reader a caller gets when it has not supplied one.
 *
 * It refuses rather than returning an empty mask, because an empty mask would
 * compose to "nothing changed" and the user would be charged for a picture
 * identical to the one they already had. While the flag is dark nothing ever
 * reaches it — `harvestRefinement` returns before consulting a reader at all,
 * and a test proves the segmenter is not called.
 */
export const refusingRegionReader: RegionReader = {
  region: async () => {
    throw new MaskError("masked editing is enabled but no segmentation reader was supplied");
  },
  subject: async () => {
    throw new MaskError("masked editing is enabled but no segmentation reader was supplied");
  },
  landmark: async () => {
    throw new MaskError("masked editing is enabled but no segmentation reader was supplied");
  },
};
