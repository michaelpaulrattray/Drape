/**
 * The canonical package, built under the Sign operation (plan §E, §F "Package
 * completion").
 *
 * Five views, each an independently refundable unit — the same law a roll's
 * eight candidates live under, for the same reason: a view that does not arrive
 * refunds its exact slice while the rest of the package stands, and the Cast is
 * usable from its master the whole time (D-72's progressive-package law).
 *
 * WHAT MAKES A VIEW LAND, in order:
 *
 *   generate (anchor as reference) → conformance judged against the SPEC →
 *   commit under the operation's own fence → or refund the slice and write the
 *   failure down where the room can confess to it.
 *
 * Three properties are worth stating because each of them is a defect we would
 * otherwise ship:
 *
 * 1. **The judge may fail what it JUDGED, never what it never saw** (D-246,
 *    amending D-92). A view the judge looked at and rejected still fails and
 *    refunds — D-92's purpose is intact, and view conformance is still theatre
 *    unless it can fail. But a view the judge could not reach, or answered
 *    unreadably about, is now DELIVERED and recorded as `unjudged`. The founder's
 *    ruling is the authority: *detectors must not block real generations because
 *    the detectors are flawed.* This was the last place in the product where a
 *    broken checker still took a customer's money for a picture that may have
 *    been perfect — and the frame was deleted on the way out, so nobody could
 *    ever tell which it had been.
 *
 *    ⚠ **AND SINCE #1612 PART 2 THE REJECTION HALF WAS NARROWED TO ONE AXIS —
 *    his ruling, 2026-09-30.** *"A view the judge looked at and rejected still
 *    fails and refunds"* became true only of IDENTITY; a framing or wardrobe
 *    rejection delivered the picture, charged and marked unchecked, with the
 *    free Try again. It was the same founder ruling one step further: the
 *    detector was not merely unreachable sometimes, it was measurably WRONG
 *    about framing — all 8 refusals this product had ever made were framing or
 *    wardrobe, none was identity, and four of the eight are the four cards
 *    behind #1612.
 *
 *    ⚠ **AND #1903 WENT THE WHOLE WAY — his ruling, 2026-10-07, verbatim:**
 *    *"i think we ditch the measure and checker i mean it been nothing but
 *    problems it should only detect catastropic failure the image engine is
 *    excellent and following our prompting"*. **The two narrowed axes are
 *    DELETED rather than demoted**, and the two that replace them are
 *    catastrophes he approved by name — a broken picture and the wrong number
 *    of people — so EVERY axis refuses again and the delivering branch below
 *    has only D-246 left to fire on. The paragraph above is kept because it is
 *    the measurement his ruling rests on. The rule and the rows are on
 *    {@link viewConformanceRefuses}.
 * 2. **TWO BUDGETS, BECAUSE "WE DECIDED IT WAS WRONG" AND "IT NEVER CAME" ARE
 *    NOT THE SAME EVENT** (founder, 2026-09-25, on his Sifr cast, #1208).
 *    Asked whether a failed view should keep retrying or offer a button, his
 *    answer was *"yes"* to both, in this order — and the first half is here.
 *
 *    - A view the judge LOOKED AT AND REJECTED keeps its one regeneration, on
 *      the legacy back-view gate's own reasoning (D-39/D-40): a second attempt
 *      is worth its cost, a third is a slot machine. ⚠ **Since #1612 part 2
 *      that budget is spent on a CATASTROPHIC rejection and nothing else** —
 *      anything the judge is still asked is a catastrophe, and anything it is
 *      no longer asked about (the crop, the pose, the clothing) delivers the
 *      frame in hand, so there is nothing to redraw and no picture to throw
 *      away in order to redraw it. A regeneration is only ever bought to
 *      replace a picture that is catastrophically wrong.
 *    - A view that NEVER ARRIVED — the engine errored, the read timed out, the
 *      connection dropped — is not a slot machine and never was. It is our
 *      failure to deliver something already paid for, and it is retried up to
 *      {@link VIEW_ARRIVAL_ATTEMPTS} times, spaced.
 *
 *    ⚠ **WHICH FAILURES COUNT AS "NEVER ARRIVED" IS THIS ROAD'S OWN QUESTION,
 *    AND IT IS NOT `isRetryable`'S.** The obvious repair — derive the terminal
 *    set from the provider contract instead of naming two classes here — was
 *    written and driven inside #1208 and then REVERTED, because the contract
 *    answers a different question. `isRetryable` asks *will the transport
 *    succeed if tried again*, and it makes `unknown` terminal on purpose so an
 *    unmapped fault fails closed rather than spinning. This loop asks *did the
 *    customer's paid view arrive*, and an unmapped engine fault is the
 *    commonest way one does not. Deriving would have taken a view failing with
 *    `unknown` from two attempts to ONE — a narrowing folded into the card that
 *    ordered the opposite. The existing arm caught it.
 *
 *    ✅ **AND THE QUESTION IS WRITTEN DOWN NOW RATHER THAN RESTATED HERE
 *    (#1212, 2026-09-26).** It lives as `mayStillArrive` in
 *    `providers/types.ts`, beside `isRetryable` and `refusesAfterRender`,
 *    because the three of them read the SAME union and mean different things —
 *    and a hand-written list of class names on a paid road is how the third one
 *    drifts from the other two without a single test going red. Every class on
 *    the terminal list earns its place by its OWN declaration already saying a
 *    second attempt reaches the identical answer; the ones that read like
 *    candidates and are deliberately left retrying are named there too, with
 *    why. ⚠ **Nothing a customer meets on THIS road changed with that card**:
 *    the terminal set added `cannot_say`, which this road cannot raise — the
 *    only raiser is `refineService.ts`'s `RepaintCannotSayError`, on the repaint
 *    road, and it is not a `ProviderError`. The value was the derivation and its
 *    arms, not a wait saved here.
 *
 *    ✅ **#1301 THEN TOOK THREE OF THE SIX CANDIDATES #1212 FILED, AND ONE OF
 *    THEM IS A REAL WAIT REMOVED FROM A PAID SIGN.** `provider_account`,
 *    `composite_fault` and `removal_not_delivered` are terminal for arrival now;
 *    `render_fault` and `facts_missing` stay on the budget because a redraw from
 *    a stochastic engine is genuinely a different draw, and `segment_store` is
 *    HELD with its reason at the set. **Only `provider_account` is reachable
 *    here** — `falTransport.ts` maps 401/403 to it and `generateView` goes
 *    through that transport — so an exhausted balance costs **five** calls
 *    across a Sign rather than fifteen with backoff, to reach an answer the
 *    first one gave in full. ⚠ **It is a WAIT change and not a money change:**
 *    a slice that never landed refunds either way, which is why #1212 could
 *    file it but not take it, and the arm below asserts the 8,500 alongside the
 *    call count.
 * 3. **A lost commit deletes its object.** If the fence refuses — the sweep got
 *    here first — nothing will ever reference those bytes, and the cleanup
 *    worker only deletes keys a row handed it. Best-effort delete now, or it is
 *    an orphan in the bucket forever.
 */
import { randomUUID } from "node:crypto";

import { recordRefund } from "../casting/atomicCredits";
import { operationChargeReference } from "../casting/operationContract";
import { createGeneration, updateGeneration } from "../db/generations";
import { listOperationViewSteps } from "../db/castingV2Sign";
import {
  activateSignedCast,
  commitPackageSlotAsset,
  listCastAssets,
  recordPackageSlotFailure,
} from "../db/castingV2Sign";
import { createModuleLogger } from "../logging/logger";
import { storageDelete, storagePut } from "../storage";
import { captureRefusedRender } from "./diagnosticCapture";
import { mintViewThumbnail } from "./viewThumbnailMint";
import {
  ProviderError,
  mayStillArrive,
  providerAlreadyBilled,
  type IdentityEngine,
  type ImageResult,
  type ReferenceImage,
} from "../providers/types";
import { CAST_VIEW_ANGLES, type CastViewAngle } from "../../shared/boardTypes";
import {
  CAST_PACKAGE_VIEWS,
  castPackageView,
  composePackageViewPrompt,
} from "./castViewPackage";
import {
  inkViewCropClause,
  type CarriedInkCrop,
} from "./inkViewReferences";
import { pronounsForSex, type CastPronouns } from "./castPronouns";
import {
  composeViewFeatureWordsClause,
  type CarriedFeatureWords,
} from "./viewFeatureWords";
import { castingSignSheetEngine, castingViewConformanceJudge, castingViewEngine } from "./signEngine";
/*
  ⚠ **THE PLATE'S IMPORTS SHRANK RATHER THAN VANISHED (#1904), AND THE
  DIFFERENCE IS THE WHOLE SWEEP.** A Sign no longer renders a plate, so
  `PLATE_ANGLES`, `plateSideFor`, `renderOutfitPlate`, `OutfitPlate` and
  `castingOutfitPlateEngine` leave this file — and the three that remain are
  each still reached on a LIVE road, through the dependency bag this file
  declares and the request the Try again composes:
    `outfitReferenceClause`  — a retried view's outfit sentence (#1474)
    `PLATE_VIEW_ASPECT_RATIO` — the pin that stops a plate-dressed view
                                coming back a different shape from its siblings
    `OutfitReference` / `OutfitPlateEngine` — the types the retry road passes
  Dropping all five because "the Sign stopped using the plate" would be the
  path-three death this repository has paid for four times: a correct change
  taking a control with it.
*/
import {
  PLATE_VIEW_ASPECT_RATIO,
  outfitReferenceClause,
  type OutfitPlateEngine,
  type OutfitReference,
} from "./outfitPlate";
import {
  renderSignSheet,
  signSheetPlan,
  type SignSheetEngine,
  type SignSheetKind,
} from "./signSheet";
import { ARRIVAL_ATTEMPTS, arrivalBackoffMs, waitMs } from "./arrivalRetry";
import {
  SignSheetUnavailableError,
  settleSignSheet,
  settledPanelFor,
  type SettledSignSheet,
} from "./signSheetCoordinator";
import {
  conformanceProvenance,
  judgeUnjudgedOnFailure,
  viewConformanceRefuses,
  type ConformanceAxis,
  type ViewConformanceJudge,
  type ViewConformanceVerdict,
} from "./viewConformance";

const log = createModuleLogger("castingV2/packageOrchestrator");

/** Package objects live under one namespace so cleanup and audit can find them. */
const PACKAGE_KEY_PREFIX = "casting-v2/casts";

/**
 * HOW MANY TIMES A VIEW THAT NEVER ARRIVED IS ASKED FOR AGAIN (#1208).
 *
 * Counts ARRIVAL FAILURES, not attempts in general: three of these and the slot
 * fails named-and-refunded. It is the number the customer is owed a true
 * sentence about, so nothing may restate it as a word — see
 * {@link VIEW_ARRIVAL_ATTEMPTS} usage at the only place that counts.
 *
 * ⚠ **THE NUMBER ITSELF MOVED TO `arrivalRetry.ts` WITH #1966** and this name
 * is kept because it is what this road's arms express themselves in. The SHEET
 * road now asks the same question — it did not until that card, so a transport
 * fault on a sheet lost two or three views where the same fault on a single
 * view was re-asked twice more — and two copies of one budget is the mirror
 * working law 4 is about. That module's header carries why this derivation is
 * safe where {@link SHEET_MAX_RENDERS}'s refusal to derive is also right.
 */
export const VIEW_ARRIVAL_ATTEMPTS = ARRIVAL_ATTEMPTS;

/**
 * HOW MANY TIMES A FRAME THAT ARRIVED IS OFFERED TO STORAGE (#2045) — the
 * first store plus two more, the SAME bytes each time and never a new frame.
 *
 * #1994 stopped the per-view road re-buying a frame because something after it
 * failed, which was right about the money and left one loss standing: when the
 * thing that failed was the STORE, the picture was still in memory, and one
 * bucket blip cost her the view outright. Re-offering bytes we already hold
 * buys nothing from the engine.
 *
 * ⚠ **NOT DERIVED FROM {@link VIEW_ARRIVAL_ATTEMPTS}, ON PURPOSE.** That
 * budget answers *"how often do we re-ask the ENGINE for a render that never
 * came back"*; this one answers *"how often do we re-offer OUR OWN storage
 * bytes already in hand"*. Two questions about two systems — law 4's
 * precondition (the same question) does not hold, so one moving must not move
 * the other.
 */
export const VIEW_STORE_ATTEMPTS = 3;

/**
 * The spacing before each re-store (#2045), indexed by how many stores have
 * failed. Short: a storage blip is a breath, and the frame that is waiting has
 * already cost 40-120 seconds to render. The read repeats its last value, so
 * lengthening {@link VIEW_STORE_ATTEMPTS} without this ladder is safe.
 */
export const VIEW_STORE_BACKOFF_MS: readonly number[] = [500, 1_500];

function viewStoreBackoffMs(failures: number): number {
  return VIEW_STORE_BACKOFF_MS[Math.min(failures - 1, VIEW_STORE_BACKOFF_MS.length - 1)] ?? 0;
}

/**
 * Generations that reached a VERDICT. Unchanged, and deliberately so: one
 * generation, one regeneration, then the judge's rejection stands.
 */
export const VIEW_JUDGED_ATTEMPTS = 2;

/**
 * The loop's hard bound, DERIVED from the two budgets rather than typed beside
 * them.
 *
 * The worst honest sequence alternates roads — arrival, rejection, arrival,
 * rejection, arrival — so the exact bound is the sum, and writing it as a third
 * number is the mirror this file just finished removing from the class check
 * above. A bound that cannot disagree with its budgets also cannot spin.
 */
const VIEW_MAX_ATTEMPTS = VIEW_ARRIVAL_ATTEMPTS + VIEW_JUDGED_ATTEMPTS;

/**
 * The per-view refund reference — **HISTORICAL, AND READ-ONLY SINCE #1968.**
 *
 * ⚠ **NOTHING WRITES A REFUND UNDER THIS SHAPE ANY MORE** (his word of
 * 2026-10-08: views are cut from two sheets and *"can't be refunded one by
 * one"*). `failView` no longer refunds and the recovery sweep no longer settles
 * unsettled views, so no new `<chargeRef>:slot:<angle>` row can be created.
 *
 * ⚠ **AND IT MUST NOT BE DELETED, WHICH IS THE OPPOSITE OF THE USUAL RULE
 * HERE.** `signRecovery`'s ledger read sums every reference a Sign *could* have
 * refunded under, over `CAST_VIEW_ANGLES`, precisely because *"a Sign bought
 * under a different composition has slot refunds this build does not sell, and
 * missing them here understates `alreadyRefunded`"* (D-102). A Sign charged
 * 8,500 before this commit, part-refunded by slice, and settled by the sweep
 * after it is exactly that case: drop this helper and the total-loss refund
 * pays the full charge again on top of slices already given back.
 *
 * So it stays as a READER's key. The shape is frozen for the same reason it
 * always was: the live path and the adjudicator must produce byte-identical
 * references, or the ledger's uniqueness reads a repeat as a fresh refund.
 */
export function packageSlotChargeReference(
  operationId: string,
  angle: CastViewAngle,
): string {
  return `${operationChargeReference(operationId)}:slot:${angle}`;
}

/**
 * The TOTAL-LOSS refund reference — the one reference a Sign refunds under.
 *
 * Derived through the same helper for the same reason it always was: the live
 * orchestrator and the recovery adjudicator both settle a zero-view package,
 * and if their references differed by a byte the ledger's uniqueness would read
 * the second one as a fresh refund rather than a repeat of the first.
 *
 * ⚠ **THE WORD `promotion` IN THE STRING IS HISTORY AND IS FROZEN — DO NOT
 * TIDY IT (#1968).** There is no promotion price any longer: the Sign is one
 * flat charge and this reference now carries the WHOLE refund rather than a
 * base on top of slices. The suffix is an IDEMPOTENCY KEY, not a description,
 * and it is shared with every Sign ever settled under the old decomposition.
 * Renaming it would make the sweep's refund invisible to the live path's and
 * pay a total loss twice for any Sign in flight across the deploy.
 */
export function packagePromotionChargeReference(operationId: string): string {
  return `${operationChargeReference(operationId)}:promotion`;
}

export type PackageOrchestratorDependencies = {
  identityEngine?: () => IdentityEngine;
  judge?: () => ViewConformanceJudge;
  storeImage?: (input: {
    operationId: string;
    bytes: Buffer;
    contentType: string;
  }) => Promise<{ key: string; url: string }>;
  commitSlot?: typeof commitPackageSlotAsset;
  recordFailure?: typeof recordPackageSlotFailure;
  refund?: typeof recordRefund;
  activate?: typeof activateSignedCast;
  deleteObject?: typeof storageDelete;
  /**
   * The wait between arrival retries (#1208).
   *
   * Injected so a test can PROVE the spacing happened — recording the requested
   * milliseconds — without a suite that actually sleeps for them. A test that
   * only asserts the attempt count cannot tell "spaced" from "hammered".
   */
  wait?: (ms: number) => Promise<void>;
  /**
   * THE WARDROBE PLATE'S ENGINE (#1278 path E).
   *
   * Separate from `identityEngine` because they are deliberately two different
   * models — his creativity choice draws the outfit, his quality choice draws
   * the picture — and a suite that stubbed one would otherwise silently stub
   * both and prove nothing about the split.
   */
  outfitPlateEngine?: () => OutfitPlateEngine;
  /**
   * THE SHEET'S ENGINE (#1904) — the one a Sign now renders with.
   *
   * Its sibling above is kept: nothing in `buildCastPackage` reaches the plate
   * any more, but the dependency bag is shared with the Try again road, which
   * does (#1474).
   */
  /**
   * ⚠ **KIND-AWARE, because one injector would prove nothing about the split.**
   * The two sheets differ only in the SIZE baked into their engine, so a double
   * that ignored the argument would let every arm pass while both sheets
   * rendered at the same shape — the defect the size argument exists to stop.
   */
  signSheetEngine?: (kind: SignSheetKind) => SignSheetEngine;
  /**
   * THE REFUSED FRAME'S KEEPER (#1492).
   *
   * Injected for the same reason `wait` is: the production path reaches a
   * database and a private bucket, so a suite could only ever prove that
   * nothing broke. A test that cannot see the capture cannot tell a wired
   * capture from an unwired one — which is precisely the state this road was in
   * for thirteen months while every arm here was green.
   */
  capture?: typeof captureRefusedRender;
};

type PackageSlotOutcome =
  | { angle: CastViewAngle; status: "committed"; assetId: number }
  | {
      angle: CastViewAngle;
      status: "failed";
      reason: string;
      refundedCredits: number;
      refundUnrecorded: boolean;
      /** The commit lost the fence — the sweep owns this slot, and its money. */
      fenced?: boolean;
    };

export type PackageResult = {
  committed: CastViewAngle[];
  failed: CastViewAngle[];
  refundedCredits: number;
  refundUnrecorded: boolean;
  activated: boolean;
  /**
   * TRUE when nothing landed and the base went back too (founder ruling,
   * 2026-08-02). Distinct from `failed.length === promised.length` at the call
   * site because the receipt has to say which of the two prices was returned.
   */
  totalLoss: boolean;
};

export type BuildPackageInput = {
  userId: number;
  operationId: string;
  modelId: number;
  identityRevisionId: string;
  identityText: string;
  anchor: ReferenceImage;
  /**
   * THE TATTOOS SHE ACTUALLY HAS, AS PICTURES OF HER — the delivered-crop lane
   * (fable-1297 §3, from his own *"crop and reference any tattos it can find
   * and see - this would intrun carry into the signing angles"*).
   *
   * ⚠ **It is the only ink lane this package has**, and until #1158 slice 4f it
   * was the second of two: `inkPlates` read the plate table, which the parked
   * mannequin road never filled, so that lane carried nothing into any signed
   * Cast in its whole life. This one's source is the frame that really
   * delivered the ink, cut down to the tattoo as it sits on her — a better
   * picture than a plate as well as an available one, because it holds her own
   * skin, her own tone and the size the design really is on her.
   *
   * Absent or empty, every view composes exactly the prompt and the single
   * reference it composed before this existed.
   */
  inkCrops?: readonly CarriedInkCrop[];
  /**
   * How the product refers to this Cast — `he`, `she`, `they`.
   *
   * Required by the delivered-crop sentence and by nothing else here, so it is
   * optional and defaults to the record's own answer for a Cast whose sex was
   * never stated: `they`, which is correct English rather than a guess.
   */
  pronouns?: CastPronouns;
  /**
   * WHAT THE ANCHOR CANNOT SHOW, AS WORDS — arrow 6 (FOUNDER, 2026-08-19:
   * *"when signing a cast to make the angles the refined image is supplied as
   * the reference and a description so that any features not visible are not
   * lost"*).
   *
   * The anchor is a waist-up photograph. A tail, clawed feet or cybernetic
   * hands are outside that frame entirely, so they rode into the full-body
   * views on nothing at all.
   *
   * Selection is `viewFeatureWords.ts`'s, and it is narrow by construction: a
   * feature the master framing PRESENTS rides nothing, because re-describing
   * what the pixels already carry is the likeness drift fable-876 §2 forbids.
   * Absent or empty, every view composes exactly the prompt it composed before
   * this existed.
   */
  featureWords?: readonly CarriedFeatureWords[];
  /**
   * WHAT THIS CAST IS WEARING — snapshotted at Sign (design §3.3, item 6).
   *
   * Rides beside the anchor for the same reason the crops and the feature
   * words do: it is a fact about this Cast that the composer cannot derive.
   * `null` or absent composes and judges exactly today's sentence, which is
   * every Cast signed to date.
   */
  wardrobeLine?: string | null;
  /**
   * WHAT THIS CAST WAS CAST AS — her own brief, carried into every view (#1278
   * part 1, his eye 2026-09-26: *"The dress is a plain modest version of what the
   * brief describes"*).
   *
   * Rides beside the anchor and the wardrobe line for the same reason they do: a
   * fact about this Cast the composer cannot derive. `null` or absent composes
   * and judges exactly today's sentences, which is every Cast with no source roll.
   *
   * ⚠ **It is `casting_rolls.briefText` — the customer's own words — and NOT
   * `models.masterPrompt`.** The card named the latter; read at the rows it is the
   * whole COMPOSED roll prompt, carrying FRAMING (*"waist-up"*), CAMERA, REALISM,
   * a NEGATIVE line banning the letters he unbanned on views, and an AUTHORITY
   * paragraph claiming precedence over the description. Sending that into a
   * full-length view would order two framings in one prompt and duplicate the very
   * block #1240 unified. `briefText` carries none of it: measured on both of his
   * cyberpunk casts, zero photograph-direction phrases.
   */
  description?: string | null;
  /**
   * WHAT THIS VIEW IS WEARING, AS A PICTURE (#1278 path E, #1474).
   *
   * Set only for `frontFull` and `backFull`, and only when something was found
   * to dress them with. Two roads reach it and they are NOT the same picture:
   *
   * - **A Sign** renders one two-panel wardrobe plate, cuts it in memory and
   *   hands each of those two views its own half — `kind: "plate"`.
   * - **A Try again** on either of them is dressed by its DELIVERED SIBLING, the
   *   other full-length view the customer is already holding —
   *   `kind: "delivered"`. It renders no plate at all when a sibling exists,
   *   which is #1474: a fresh plate is a fresh invention, and it would put the
   *   retried slot in a different outfit from the four already delivered.
   *
   * Every other view, and either of these two with nothing to dress them,
   * composes exactly the prompt and the references it composed before path E
   * existed — which is the property the whole fallback rests on and the one the
   * arms are pointed at.
   *
   * ⚠ **It rides AFTER her ink crops in the reference list, never before.** The
   * crops' own clause quotes ordinals starting at 2, so inserting anything
   * between the anchor and them would renumber sentences that name her tattoos
   * by position.
   */
  outfitReference?: OutfitReference | null;
  /**
   * THE SHEETS THIS PACKAGE IS BEING CUT FROM, ALREADY JUDGED — in flight (#1904).
   *
   * **His word, 2026-10-07, closing #1690:** *"and then we go with the sunburst
   * 2.5 max quality for the sign sheet"*, and his #1926 ruling splitting it in
   * two. When it is set, every view's picture is a panel cut from one of these
   * frames and no view calls an image engine at all; when it is absent, each
   * view composes and renders its own request exactly as it always has.
   *
   * ⚠ **SETTLED SHEETS, NOT MERELY RENDERED ONES — every panel's verdict is
   * decided before these promises resolve, and that is his option A rather than
   * a layering preference.** A view refused for one of the three catastrophes
   * re-renders ITS WHOLE SHEET once and replaces all of that sheet's views
   * together, so the judging cannot happen per view: views commit as they land,
   * and one could commit a first-render panel while a sibling triggers the
   * re-render. {@link settleSignSheet} carries the reasoning and the money
   * boundaries; this field carries its result, and the per-view road below only
   * ever CONSUMES it.
   *
   * ⚠ **A PROMISE RATHER THAN A SHEET, and that is a money decision rather than
   * a style one.** `buildCastPackage` cannot await it before dispatching the
   * views: a sheet that never arrived would then leave five audit rows open and
   * 8,500 credits taken with **not one view attempted**, and an unattempted
   * view is the one failure mode this road has no refund path for. Carried in
   * flight, a dead sheet is an ordinary generation failure five times over and
   * every slice refunds itself.
   *
   * ⚠ **The Try again leaves this unset and must keep doing so.**
   * `viewRetryService.ts` renders ONE view against its delivered sibling, and
   * handing it a sheet would have it pay for five panels to keep one.
   */
  signSheets?: Readonly<Record<SignSheetKind, Promise<SettledSignSheet>>>;
  /**
   * WHAT THE CUSTOMER CALLS THIS CAST — for a refusal sentence, and for nothing
   * else (#1904, his Yuna wording of 2026-10-08).
   *
   * ⚠ **It never reaches an engine or the judge**, and that is the whole of why
   * it is safe to add here. A name in a prompt would be a word about a person
   * the generator has a photograph of — it could only pull the picture toward
   * whoever the model thinks that name looks like. It exists so that a refusal
   * says *"didn't clearly look like Sifr"* instead of naming the pipeline's
   * *"signed likeness"*, which is the term of art his ruling removed.
   *
   * Absent, blank, or whitespace is a Cast with no name, which is the ordinary
   * case — see {@link refusedViewReason}.
   */
  castName?: string | null;
};

async function defaultStoreImage(input: {
  operationId: string;
  bytes: Buffer;
  contentType: string;
}) {
  const extension = input.contentType === "image/jpeg" ? "jpg" : "png";
  // Cryptographic UUID keys, never a pseudo-random source — a guessable key is
  // all that stands between a public-bucket Cast view and anyone who guesses
  // it. (The repo-wide guard rejects the weak API by name in any storage
  // writer, so this comment names it by description.)
  const stored = await storagePut(
    `${PACKAGE_KEY_PREFIX}/${input.operationId}/views/${randomUUID()}.${extension}`,
    input.bytes,
    input.contentType,
  );
  /*
    THE SMALL COPY, BESIDE THE PICTURE (#1389).

    This is the ONE place a signed view's bytes reach storage, which is why the
    thumbnail is minted here and not at the twenty-odd sites that insert a
    `model_assets` row. It is awaited rather than floated: the view it belongs
    to has just spent 40-120 seconds rendering, a shrink costs a fraction of
    that, and an awaited call cannot outlive the request that owns its bytes.

    ⚠ **It cannot fail this function.** `mintViewThumbnail` swallows its own
    errors by construction and returns nothing to branch on — a thumbnail is a
    convenience built from a picture that already exists, and a customer who
    paid for the view gets it whatever the bucket says about the small copy.
  */
  await mintViewThumbnail(stored.key, input.bytes);
  return stored;
}

/**
 * Build the whole package, then activate.
 *
 * Views run concurrently under the provider queue's own budget: they are
 * independent, the room streams them in as they land, and gating the fifth on
 * the fourth would only make the customer wait longer for the same result.
 */
/**
 * WHAT A WHOLE SIGN NEEDS THAT ONE RENDERED VIEW DOES NOT — the money (#1968).
 *
 * ⚠ **`chargedCredits` IS DELIBERATELY NOT ON {@link BuildPackageInput}, AND
 * THE REASON IS A REAL HAZARD RATHER THAN TIDINESS.** That type is shared with
 * {@link renderViewAttempts}, which the paid redo (`packageRedoService`) and a
 * single view's Try again (`viewRetryService`) both compose to RENDER a view
 * and settle their own money themselves. Putting a Sign's charge on it would
 * force two unrelated roads to supply a figure they never read — and the
 * tempting repair, making it optional, fails in the one direction that costs a
 * customer money: an absent charge would refund `undefined` on a total loss.
 *
 * Only the road that CHARGED carries what it charged.
 */
export type SignPackageInput = BuildPackageInput & {
  /**
   * The deduct this Sign actually made, in ledger credits.
   *
   * Threaded from `signService`'s own `price` rather than read from
   * `CASTING_V2_SIGN_PRICE_CREDITS` here, because a Sign in flight across a
   * price change must be given back what it was charged — and his Sign price
   * has moved three times in ten days (450 → 8,500 → 3,250).
   */
  readonly chargedCredits: number;
};

export async function buildCastPackage(
  dependencies: PackageOrchestratorDependencies,
  input: SignPackageInput,
): Promise<PackageResult> {
  /*
    THE PROMISE, WRITTEN DOWN BEFORE ANY WORK — and it is a money control, not
    bookkeeping.

    Recovery has to know which views this Sign PAID FOR, and the profile
    constant cannot tell it: a Sign charged under a six-view profile, left
    non-terminal by a deploy, and swept by a five-view build would have its
    retired slice charged, never generated and never refunded. That is the
    deploy-collision class the founder dogfoods through, and the constant is
    process memory — exactly what `activateSignedCast` refuses to trust.

    So the audit rows are created for the whole promised set up front. They are
    durable, per-angle, already part of the operation's children, and they are
    what `promisedPackageAngles` reads. One extra statement, one whole class of
    silent under-refund closed.
  */
  const promised = await Promise.all(
    CAST_PACKAGE_VIEWS.map(async (angle) => ({
      angle,
      auditId: await openViewAudit(input, angle),
    })),
  );

  /*
    ONE SHEET, AND EVERY VIEW IS A PANEL OF IT — his word, 2026-10-07 (terminal),
    closing #1690: *"and then we go with the sunburst 2.5 max quality for the
    sign sheet"*, after *"sunburst sheets nail it"* and *"gpt image 2.5 had the
    best results and we can also drop the outfit plate if using gpt image 2.5 as
    it can come up with the outfit just as good . only reason for the outfit
    plate was because NBP sucks at outfit creativity"*.

    ⚠ **THE OUTFIT PLATE IS RETIRED ON THIS ROAD, AND IT IS RETIRED RATHER THAN
    DISABLED.** Path E's plate existed for one measured defect — five views
    rendered independently from a chest-up anchor invented five different hems
    and five different shoes (*"the hem and shoes differ every take"*, #1278).
    One frame holding all five panels does not have that defect to mitigate: the
    outfit is the same outfit because it is the same photograph. Keeping a plate
    beside the sheet would be paying `~$0.145` and ~70 s to settle a question
    the sheet cannot ask. **`outfitPlate.ts` is untouched and still live on the
    Try again road** (#1474, where a retried view copies its delivered sibling),
    so nothing is deleted here — what changes is which roads reach it.

    ⚠ **NOTHING WAITS AND NOTHING IS CAUGHT, which is the opposite of the plate
    on both counts.** The plate's promise was deliberately un-awaited so three
    views could start without it, and deliberately `.catch`-ed so a dead plate
    could never fail a Sign. Here every view needs a sheet, so there is nothing
    to run beside them; and swallowing the fault would hand a slot an empty
    picture to charge for. A rejection travels to the views of ITS OWN sheet,
    each fails as *never arrived*, each slice refunds, nothing committed refunds
    the base, and the Cast activates and confesses — the existing total-loss
    road, reached without a line of new money code.

    ⚠ **THIS PARAGRAPH SAID *"a dead sheet IS a dead package"* AND THE SPLIT
    MADE THAT FALSE — corrected in the commit that split it.** With one sheet it
    was exactly right: one fault, five dead slices, the total-loss road. With
    two, **a dead body sheet is a 3-view partial** — the head sheet's three
    views arrive, are judged, are charged and are kept, while the two
    full-length slices refund. The money is right in both shapes because the
    refund is per slice; what changed is that a PARTIAL package is now an
    ordinary outcome of a transport fault rather than a rarity, so the base
    refund and the confession no longer follow automatically from one sheet
    dying. Nothing here needed a new money path for that — but a reader
    reasoning from the old sentence would conclude the opposite.

    ⚠ **AND ONE FORK IS DELIBERATELY NOT TAKEN, because it is his to take.**
    A per-view render retried an arrival failure three times, spaced, on the
    stated ground that a transport fault is *"our failure to deliver something
    already paid for"*. A sheet render is single-shot, so one escaped transport
    fault now kills two or three paid slices with no retry where it used to kill
    one. A spaced sheet-level arrival retry would restore that contract, and his
    *"AT MOST ONE automatic re-render per sheet"* (#1904) can be read either as
    permitting it or as forbidding it. **That reading is his, so it is asked on
    the card rather than decided here.**

    ⚠ **Each engine is built INSIDE its own promise for the plate's reason.**
    `castingSignSheetEngine(kind)` throws on a missing `FAL_KEY` — the door's own
    refusal, and the right one — and built eagerly in the argument list that
    throw would be SYNCHRONOUS here, after five audit rows exist and 8,500
    credits are gone, with nothing to refund it.
  */
  /*
    ⚠ **TWO SHEETS, DISPATCHED TOGETHER — his #1926 ruling, verbatim: *"yes
    option 1 cooks well done"*, and the words that matter are IN PARALLEL.**

    The tempting shape is to render the body sheet first and hand it to the head
    sheet as a second reference showing the finished outfit — the relay's own
    `prompt-head.txt` does exactly that, and it produces a better-agreed
    outfit. It is not built, because it serialises two ~70 s renders into ~140 s
    of a customer's wait for a consistency the brief's outfit paragraph already
    buys. Both sheets therefore take the master as their only reference and the
    same outfit words, which is the arm his parallel test actually ran.

    ⚠ **The cast's tattoos and her feature words go to BOTH**, and splitting
    them by apparent relevance would be inventing a taxonomy: they are facts
    about the PERSON, true of every camera. A tail belongs on the body sheet and
    a facial scar on the head sheet, and no reader here can tell which is which.
  */
  /*
    ⚠ **AND EACH SHEET IS SETTLED, NOT MERELY RENDERED — his #1904 ruling of
    2026-10-08, verbatim and entire: *"go with A"*.** A view refused for one of
    the three catastrophes re-renders its own sheet once, silently, at our cost,
    and all of that sheet's views are replaced together. The judging therefore
    happens HERE, above the views, where one authority can see every panel of a
    sheet at once — `settleSignSheet` carries why a per-view latch cannot do it
    and what the re-render may and may not cost.
  */
  const signSheets = Object.fromEntries(
    signSheetPlan().map((plan) => [
      plan.kind,
      /* Built inside the promise, for the plate's own reason: `castingSignSheetEngine`
         throws on a missing FAL_KEY, and eagerly in the argument list that throw
         would be SYNCHRONOUS here — after five audit rows exist and 8,500
         credits are gone, with nothing to refund it. Now reachable twice. */
      Promise.resolve().then(() => settleSignSheet({
        kind: plan.kind,
        panelOrder: plan.panelOrder,
        /* ⚠ **THE SAME PROMPT AND THE SAME REFERENCES EVERY TIME**, which is his
           ruling's own wording — so the thunk closes over the composition rather
           than taking anything that could differ between generations. */
        render: () => renderSignSheet({
          engine: (dependencies.signSheetEngine ?? castingSignSheetEngine)(plan.kind),
          anchor: input.anchor,
          wardrobeLine: input.wardrobeLine ?? null,
          description: input.description ?? null,
          ...(input.pronouns ? { pronouns: input.pronouns } : {}),
          panelOrder: plan.panelOrder,
          inkCrops: input.inkCrops ?? [],
          featureWords: input.featureWords ?? [],
          operationId: input.operationId,
        }),
        /* Built inside the promise for the engine's own reason, one line up:
           `castingViewConformanceJudge` throws on a missing `OPENROUTER_API_KEY`
           — the §I door refusal, and the right one — and eagerly in the
           argument list that throw would be SYNCHRONOUS here, after five audit
           rows exist and 8,500 credits are gone. Inside, it is a sheet that
           never arrived, and every slice refunds itself. */
        judge: (dependencies.judge ?? castingViewConformanceJudge)(),
        anchor: input.anchor,
        pronouns: input.pronouns ?? pronounsForSex(null),
        userId: input.userId,
        operationId: input.operationId,
        ...(dependencies.capture ? { capture: dependencies.capture } : {}),
        /* #1966 — the sheet's own arrival retries are spaced, and a suite
           proves the spacing by recording the milliseconds rather than
           sleeping. The same injection the per-view loop takes, handed to the
           only place that can re-ask for a SHEET. */
        ...(dependencies.wait ? { wait: dependencies.wait } : {}),
      })),
    ]),
  ) as Record<SignSheetKind, Promise<SettledSignSheet>>;

  const outcomes = await Promise.all(
    /*
      Every view takes the same input and the same sheet. ⚠ The per-angle fork
      that stood here — `PLATE_ANGLES.includes(angle)`, two views waiting on a
      panel and three not — is gone with the plate: there is no longer a view
      that renders differently from its neighbours, which is the whole point of
      a sheet.
    */
    promised.map(({ angle, auditId }) =>
      buildOneView(dependencies, { ...input, signSheets }, angle, auditId)),
  );

  const committed = outcomes
    .filter((outcome): outcome is Extract<PackageSlotOutcome, { status: "committed" }> =>
      outcome.status === "committed")
    .map((outcome) => outcome.angle);
  const failures = outcomes.filter(
    (outcome): outcome is Extract<PackageSlotOutcome, { status: "failed" }> =>
      outcome.status === "failed",
  );
  const refundedCredits = failures.reduce((sum, failure) => sum + failure.refundedCredits, 0);
  const refundUnrecorded = failures.some((failure) => failure.refundUnrecorded);

  if (failures.length > 0) {
    log.warn(
      {
        operationId: input.operationId,
        modelId: input.modelId,
        failed: failures.map((failure) => failure.angle),
        refundedCredits,
      },
      "[packageOrchestrator] package incomplete — failed views refunded their slices",
    );
  }

  /*
    ZERO OF N — the WHOLE charge goes back (founder ruling, 2026-08-02; the
    figure made flat by his word of 2026-10-08, #1968).

    ⚠ **THIS IS THE ONLY ROAD A SIGN REFUNDS ON NOW**, which is his sentence
    exactly: *"Credits only come back if the Sign can't be delivered at all."*
    Until #1968 a refused view gave back its own slice here and this branch
    only added the base on top; `failView` carries why that ended.

    The promotion charge buys permanence: the anchor is rescued from the sheet's
    purge, the identity is sealed, the Cast is repairable. That story is true and
    it survives a PARTIAL package, where the customer has views in hand and a
    Cast to keep them in. It does not survive a total loss — nobody came here to
    buy the preservation of a face they had already paid for on the sheet.

    Zero-of-N is only reachable through systemic failure: our provider account
    exhausted, a transport outage, a judge that could not be reached. Never
    through ordinary stochastic misses — a judge that CAN be reached and refuses
    every panel still delivers nothing, and that is why this branch reads
    `committed`, not `refused`. Retaining any part of the charge there bills the
    customer for OUR outage, which is precisely what the confession law
    forbids.

    The Cast still stands. She keeps the master she chose and the room says
    plainly what happened — see `TOTAL_LOSS_CONFESSION`. What changes is only
    the money, and the invariant it lives under: promotion is retained when the
    candidate CAS is set AND at least one view committed. Recomputable from the
    asset rows alone, which is what lets recovery reach the same verdict after a
    crash without trusting anything this process believed.
  */
  let totalLoss = false;
  let baseRefundUnrecorded = false;
  let baseRefunded = 0;
  /*
    A FENCED slot disqualifies the whole judgement, not just its own slice.

    Losing the fence does not mean the view failed — it means this process is no
    longer the authority on what happened to it. The sweep re-reads the ledger
    and settles from durable rows, so a fenced package's "nothing committed" is
    this process's opinion, not a fact. Acting on it would be a fenced writer
    spending money, which is the one thing the fence exists to stop.
  */
  const anyFenced = failures.some((failure) => failure.fenced);
  if (promised.length > 0 && committed.length === 0 && !anyFenced) {
    const outcome = await (dependencies.refund ?? recordRefund)(
      input.userId,
      /*
        ⚠ **WHAT THIS SIGN WAS CHARGED, NOT WHAT A SIGN COSTS TODAY — #1968.**

        It read `CASTING_V2_SIGN_PROMOTION_PRICE` while the per-view slices
        refunded themselves, so the base and five slices summed to the whole
        charge. With no slices there is one refund, and reading it off a
        constant would pay the wrong amount the moment he moves the price with
        a Sign in flight. `chargedCredits` is the figure `signService`
        deducted, one statement earlier in the same process.
      */
      input.chargedCredits,
      "Cast package: nothing arrived — the Sign refunded in full",
      packagePromotionChargeReference(input.operationId),
    );
    totalLoss = true;
    baseRefunded = outcome.recorded && !outcome.duplicate ? outcome.amount : 0;
    baseRefundUnrecorded = !outcome.recorded;
    /*
      The provider-account alarm's shape, for the same reason it has one: this
      is never the customer's brief and no retry fixes it. It says stop and look
      at the plumbing, not "what was wrong with this Cast".
    */
    log.error(
      {
        operationId: input.operationId,
        modelId: input.modelId,
        promised: promised.length,
        baseRefunded,
        refundedCredits: refundedCredits + baseRefunded,
        recorded: outcome.recorded,
      },
      "[packageOrchestrator] TOTAL LOSS — not one view landed; the whole Sign refunded, base included",
    );
    if (!outcome.recorded) {
      log.error(
        { operationId: input.operationId, reference: outcome.reference },
        "[packageOrchestrator] the promotion refund did not record — the owner remains charged",
      );
    }
  }

  /*
    Activate even when the package is partial (§F): the Cast is usable from its
    master, the missing views confess in place, and a Cast held in
    `provisioning` because one view failed would be a Cast the owner can never
    reach — invisible to every legacy procedure, by design.

    A TOTAL loss activates too: the ruling keeps the Cast and refunds the money.
    A Cast she cannot open is not a kinder outcome than one that explains itself.
  */
  const activation = await (dependencies.activate ?? activateSignedCast)({
    userId: input.userId,
    operationId: input.operationId,
    modelId: input.modelId,
  });
  if (activation.type === "unavailable") {
    log.error(
      { operationId: input.operationId, modelId: input.modelId },
      "[packageOrchestrator] the Cast could not be activated — left for the sweep",
    );
  }

  return {
    committed,
    failed: failures.map((failure) => failure.angle),
    refundedCredits: refundedCredits + baseRefunded,
    refundUnrecorded: refundUnrecorded || baseRefundUnrecorded,
    totalLoss,
    activated: activation.type === "activated" || activation.type === "already_active",
  };
}

/** Opens one view's durable audit row — the promise this Sign is paying for. */
async function openViewAudit(
  input: BuildPackageInput,
  angle: CastViewAngle,
): Promise<number | null> {
  const audit = await createGeneration({
    userId: input.userId,
    modelId: input.modelId,
    operationId: input.operationId,
    // The shared per-view step vocabulary: `view:<angle>` with the angle
    // recorded, so refund accounting reads the same key everywhere.
    stepKey: `view:${angle}`,
    viewAngle: angle,
    type: "multiView",
    status: "processing",
    /* A view has no price of its own since #1968 — the Sign is one flat
       charge on the operation row. Zero here is the honest record, and it
       keeps every per-child sum (the generic stale-operation sweep's
       `ensureFailedChildRefunds` among them) from inventing a slice. */
    pointsCost: 0,
    metadata: { viewType: angle, source: "castingV2.sign" },
  });
  return audit.success ? audit.generationId ?? null : null;
}

/**
 * WHERE A RENDERED VIEW GOES — the one thing the Sign and a Try again do
 * differently, handed in rather than branched on (#1208 slice 2).
 *
 * Returning `null` means the landing lost its fence: the bytes are real and
 * nobody will ever reference them, which is a different fact from a failure
 * and gets its own outcome.
 */
/**
 * HOW MUCH WORK ONE SLOT TOOK — the loop's own two budgets, RETURNED rather
 * than discarded (#1608).
 *
 * ⚠ **`verdicts.length` IS NOT THE NUMBER OF RENDERS AND MUST NOT BE READ AS
 * ONE.** A verdict is pushed only once a picture has come back AND the judge has
 * answered about it, so an attempt that never arrived contributes nothing to that
 * array. A Try again whose first render failed to arrive and whose second landed
 * is a DOUBLE render that `verdicts.length` reports as one — and the double-render
 * rate is the number #1608 exists to put in front of a reader, against Squall's
 * 30–60% estimate. Reading the wrong one would have understated it by exactly the
 * arrival failures, which is the half nobody sees.
 *
 * Nothing new is measured here: `arrivalFailures` and `judgedAttempts` have been
 * counted in this loop since #1208 (*"Counted rather than inferred from the
 * attempt number"*) and thrown away at every return. That is the
 * disappearing-technology law's clause 4 — read what the engine already gives
 * you — and it is the same finding #1542 turned up one module over, where
 * `errorTrackerStatus()` had been computing the deciding fact and had no caller.
 */
export interface ViewAttemptTally {
  /** Render attempts actually begun, 1-based. The `1 or 2` #1608 asks for. */
  readonly attempts: number;
  /** Of those, how many never produced a picture. */
  readonly arrivalFailures: number;
  /** Of those, how many reached the judge. */
  readonly judgedAttempts: number;
}

/**
 * ⚠ **THE LANDING CANNOT TELL WHETHER ITS PICTURE LANDED (#2080).**
 *
 * Thrown by a landing whose commit threw AND whose follow-up question — "did
 * this operation's row land anyway?" — could not be answered either. Both
 * readings are then possible: the row committed and only its acknowledgement
 * was lost, or nothing was written at all.
 *
 * The attempt loop's catch passes it straight out, **without dropping the
 * stored bytes**, because dropping them is the one move that is wrong under
 * the first reading (a delivered row pointing at a deleted object), and its
 * `failed` exit would refund a view the customer may be holding. Out past the
 * loop the operation is still `running`, so the recovery sweep settles it
 * from the asset rows — the same question, asked later by a process that does
 * not share this one's broken connection. Under the second reading the cost
 * is one orphaned object in the bucket, which is the cheap direction.
 */
export class ViewLandingUndecidedError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ViewLandingUndecidedError";
  }
}

type ViewLanding<T> = (landed: {
  stored: { key: string; url: string };
  verdict: ViewConformanceVerdict;
  provenance: { engine: string; provider: string; providerRef?: string };
}) => Promise<T | null>;

/**
 * STORE THE BYTES WE ALREADY HAVE, UP TO {@link VIEW_STORE_ATTEMPTS} TIMES
 * (#2045). Never calls an engine; the last failure is re-thrown unchanged so the
 * attempt loop's catch decides exactly as it did before this existed.
 *
 * Each try mints a fresh key (the store does), so a try that failed leaves
 * nothing a later one could collide with.
 */
async function storeArrivedFrame(
  store: NonNullable<PackageOrchestratorDependencies["storeImage"]>,
  wait: (ms: number) => Promise<void>,
  storeInput: { operationId: string; bytes: Buffer; contentType: string },
  context: { angle: CastViewAngle; attempt: number },
): Promise<{ key: string; url: string }> {
  for (let tries = 1; ; tries += 1) {
    try {
      return await store(storeInput);
    } catch (error) {
      if (tries >= VIEW_STORE_ATTEMPTS) throw error;
      log.warn(
        { err: error, operationId: storeInput.operationId, ...context, storeTry: tries },
        "[packageOrchestrator] the view ARRIVED and storing it failed — storing the same bytes again",
      );
      await wait(viewStoreBackoffMs(tries));
    }
  }
}

/**
 * GENERATE, STORE, JUDGE — the attempt loop, and it is the WHOLE fidelity
 * contract of a package view.
 *
 * Extracted from `buildOneView` when the Try again road arrived (#1208 slice
 * 2), and extracted rather than copied for the reason working law 4 exists: a
 * second loop composing the same prompt would be a parallel copy of the thing
 * that decides what a customer's view looks like, and it would drift — a
 * retried view quietly missing her tattoos, her carried feature words or her
 * outfit, which is precisely the ceiling-capping the fidelity law forbids.
 * **A view asked for again is composed and judged by this function or it is
 * not the same view.**
 *
 * The landing is a callback INSIDE the try on purpose. It is where the commit
 * used to sit, so a throw out of it still lands in this loop's catch.
 *
 * ⚠ **A THROW AFTER THIS ATTEMPT BOUGHT ITS OWN FRAME ENDS THE SLOT (#1994).**
 * Until that card such a throw — the store, the landing, its commit — read as
 * an `unknown` failure class, which `mayStillArrive` retries on purpose, so the
 * loop asked the engine for ANOTHER paid frame because something after the
 * first one failed. See `paidFrameInHand` in the loop body for why the sheet
 * road is deliberately left retrying.
 */
export async function renderViewAttempts<T>(
  dependencies: PackageOrchestratorDependencies,
  input: BuildPackageInput,
  angle: CastViewAngle,
  land: ViewLanding<T>,
): Promise<
  | { status: "landed"; value: T; verdicts: ViewConformanceVerdict[]; tally: ViewAttemptTally }
  | { status: "fenced"; verdicts: ViewConformanceVerdict[]; tally: ViewAttemptTally }
  | { status: "failed"; reason: string; verdicts: ViewConformanceVerdict[]; tally: ViewAttemptTally }
> {
  const engine = (dependencies.identityEngine ?? castingViewEngine)();
  const judge = (dependencies.judge ?? castingViewConformanceJudge)();
  const store = dependencies.storeImage ?? defaultStoreImage;
  const drop = dependencies.deleteObject ?? storageDelete;

  let lastReason = "The view could not be generated";
  /*
    EVERY attempt's verdict, not just the last (D-114).

    This was a single `lastVerdict`, so the second attempt overwrote the first
    and a slot that failed twice recorded only its final rejection. That is the
    half of the automatic re-attempt that was genuinely missing: the judge is
    young, D-115 says it self-measures and never self-modifies, and the thing
    that makes it improvable is the record of what it rejected — including the
    draw that was thrown away before the one the customer heard about.
  */
  const verdicts: ViewConformanceVerdict[] = [];

  /*
    TWO BUDGETS ON TWO ROADS (#1208, his "yes") — see this file's header, §2.

    Counted rather than inferred from the attempt number, because a slot can
    take both roads in one build: an arrival failure followed by a rejection
    has used one of each, and an attempt number cannot say which.
  */
  let arrivalFailures = 0;
  let judgedAttempts = 0;
  /* The THIRD budget, and the only one of the three that is not also a limit:
     `attempt` is scoped to the loop below, so the `failed` return — which sits
     after it — cannot read it. Incremented at the top of the body rather than
     derived from the two above, because a `break` can leave the loop without
     either of them moving. */
  let attemptsRun = 0;
  const wait = dependencies.wait ?? waitMs;

  for (let attempt = 1; attempt <= VIEW_MAX_ATTEMPTS; attempt += 1) {
    attemptsRun = attempt;
    let stored: { key: string; url: string } | null = null;
    /*
      ⚠ **DID THIS ATTEMPT PAY FOR A FRAME THAT IS NOW IN HAND? (#1994)** Set
      the moment the per-view engine call RESOLVES, and read in the catch below.

      The `try` wraps far more than the engine call: storing the bytes, the
      judge, the refused-frame keeper, the landing and its commit. The engine's
      own faults arrive as `ProviderError`s with real classes, but a plain
      `Error` from anything AFTER it — `storagePut` goes through the S3 SDK, the
      commit through mysql2 — reached the catch as `unknown`, which
      `mayStillArrive` retries on purpose (an unmapped transport fault must not
      cost a paid view its attempts). So a picture that had ARRIVED, and been
      paid for, was asked for again because something downstream of it failed:
      up to `VIEW_ARRIVAL_ATTEMPTS` frames bought to learn one answer. Same class
      as the sheet road's finding on PR #1982, on the road it did not reach.

      What can throw after arrival, read at the code: the store (`storagePut`
      and the thumbnail beside it) and the landing (`commitSlot`, or the Try
      again road's own commit). The judge cannot — `judgeUnjudgedOnFailure`
      turns its faults into an unjudged verdict — and the keeper and every
      `drop` carry their own `.catch`. The flag does not depend on that list
      staying true: it reads WHEN the throw happened, not who threw it.

      ⚠ **ONLY THE PER-VIEW ENGINE ROAD SETS IT, AND THE SHEET ROAD IS LEFT
      RETRYING ON PURPOSE.** There the frame is the coordinator's settled panel
      — one promise per sheet — so asking again re-stores the SAME bytes and buys
      nothing. Making it terminal there would turn a passing storage hiccup into
      a refunded view for no saving at all; an arm holds that direction too.

      ⚠ **And what came before the engine resolved is untouched**: a frame that
      never arrived still spends its arrival budget exactly as #1208 ruled.
    */
    let paidFrameInHand = false;
    try {
      /*
        WHERE THE PICTURE COMES FROM — one of two roads, and the fork is a FIELD
        rather than a flag (#1904).

        His word, 2026-10-07, closing #1690: *"and then we go with the sunburst
        2.5 max quality for the sign sheet"*. A Sign renders ONE landscape sheet
        and every view is a panel cut from it, so the five pictures agree on the
        outfit by construction rather than by five independent readings of one
        brief — which is the hem-and-shoes complaint path E's plate was built to
        answer, dissolved instead of mitigated.

        ⚠ **THE SHEET IS AWAITED HERE, INSIDE THE ATTEMPT LOOP, AND NOT BEFORE
        THE VIEWS ARE DISPATCHED.** Awaiting it in `buildCastPackage` would read
        more simply and would reach the one failure mode this road has no refund
        path for: a sheet that never arrived would leave five audit rows open,
        8,500 credits taken and **not one view ever attempted**. Awaited here, a
        dead sheet is an ordinary generation failure five times over — each slice
        refunds through `failView`, nothing committed refunds the base too, and
        the Cast still activates and confesses in place. This file's header names
        that hazard in as many words, and the plate's `.catch` beside it exists
        for the same reason.

        ⚠ **AND IT IS ONE PROMISE PER SHEET, SO EVERY AWAIT OF ONE SHEET IS ONE
        RENDER.** A settled rejection re-throws instantly, so a dead sheet costs
        the arrival budget's waiting and never a second call. A view's own three
        attempts cannot buy a second sheet.

        ⚠ **ONE CONSEQUENCE OF THE SPLIT, NAMED BECAUSE IT CHANGES WHAT A
        FAILURE COSTS: a dead sheet is no longer a dead package.** With one
        sheet, a transport fault lost all five views; with two, a dead body
        sheet loses two slices and the three head views still arrive and are
        charged. Each dead slice still refunds itself, so the money is right
        either way — what changed is that a partial package is now an ordinary
        outcome rather than a total loss, and this file's header says so.

        ⚠ **AND ON THE SHEET ROAD THE PICTURE ARRIVES ALREADY JUDGED — his
        #1904 ruling of 2026-10-08, verbatim and entire: *"go with A"*.** A view
        refused for one of the three catastrophes re-renders ITS OWN SHEET once,
        silently, at our cost, and all of that sheet's views are replaced
        together — so the judgement cannot be made here. Views commit as they
        land, so one view could commit a first-render panel while its sibling
        triggered the re-render, and the two delivered views would come from
        different frames. `settleSignSheet` owns every judgement for a sheet and
        every frame it pays for; this loop CONSUMES its verdict and spends
        nothing of its own on it.
      */
      const panel = input.signSheets
        ? await settledPanelFor(input.signSheets, angle)
        : null;

      if (panel?.status === "refused") {
        /*
          THE SHEET'S OWN BUDGET IS ALREADY SPENT, so this is terminal here.

          ⚠ **No capture and no second attempt, and both absences are the
          coordinator's doing rather than a gap.** It kept this frame AND the
          one from the generation before it, keyed by sheet generation so
          neither overwrote the other (#1492); and it has already bought the one
          re-render his ruling allows. A `continue` here would ask the judge the
          same question about the same settled pixels — the measured defect
          `VIEW_JUDGED_ATTEMPTS` would otherwise produce on this road — and then
          fail anyway. So the slice refunds through `failView`, exactly as it
          did before this road existed, under the reference it has always used.
        */
        verdicts.push(...panel.verdicts);
        judgedAttempts += panel.verdicts.length;
        lastReason = refusedViewReason(panel.failedAxes, input.castName);
        log.warn(
          {
            operationId: input.operationId,
            angle,
            sheetGeneration: panel.generation,
            failedAxes: panel.failedAxes,
            method: panel.verdicts[panel.verdicts.length - 1]?.method,
          },
          "[packageOrchestrator] the sheet's panel failed conformance — the sheet had its one "
          + "re-render and this slice refunds",
        );
        break;
      }

      const image = panel
        ? panel.image
        : await composeAndGenerateOneView(input, angle, engine);
      paidFrameInHand = panel === null;

      // Bytes land in OUR storage before anything references them; a provider
      // URL is never persisted and never projected (§E, §J).
      /*
        ⚠ **A FRAME THIS ATTEMPT BOUGHT IS RE-STORED, NOT LOST (#2045).** On
        the per-view road a store that throws now breaks the loop (#1994 — the
        catch below), so without this a passing bucket fault refunded a view
        whose bytes were sitting right here. Same bytes, spaced, no engine call;
        if every try fails the throw reaches the catch exactly as before.

        ⚠ **The sheet road is left on a single store**, because there the loop
        itself already re-stores the same settled panel on its next attempt —
        wrapping it too would multiply one budget by the other.
      */
      const storeInput = {
        operationId: input.operationId,
        bytes: image.bytes,
        contentType: image.contentType,
      };
      stored = paidFrameInHand
        ? await storeArrivedFrame(store, wait, storeInput, { angle, attempt })
        : await store(storeInput);

      /*
        ⚠ **ONE JUDGEMENT PER RENDERED PANEL, AND IT WAS ALREADY MADE.** On the
        sheet road the verdict comes from the coordinator — asking again here
        would be a second read of identical pixels that cannot say anything new.
        Every verdict the panel collected is recorded, oldest first, so a panel
        refused on the first frame and passed on the second carries both
        (D-114): what the judge rejected before the draw the customer heard
        about is the thing that makes the judge improvable.
      */
      if (panel) {
        /* All but the last; the shared `verdicts.push(verdict)` below records
           the delivering one, and its `judgedAttempts` increment counts it. */
        verdicts.push(...panel.verdicts.slice(0, -1));
        judgedAttempts += panel.verdicts.length - 1;
      }
      /* `??` short-circuits, so the judge is never called on the sheet road —
         which is the whole of "one judgement per rendered panel". */
      const verdict = panel?.verdict ?? await judgeUnjudgedOnFailure(judge, {
        angle,
        anchor: input.anchor,
        candidate: { bytes: image.bytes, contentType: image.contentType },
        /* ⚠ `wardrobeLine` AND `description` WERE PASSED HERE AND ARE GONE —
           #1903. They kept the judge and the generator being told ONE outfit,
           because a judge told a different one failed the view for obeying its
           instructions. There is no wardrobe axis left to protect, and a judge
           handed an outfit sentence would start having opinions about the
           outfit. Both values are still read by the prompt above, unchanged. */
        /* The same face the generator was asked for — #1480 finding A's third
           site, so the checker is not describing a different person. This one
           stays: identity is the axis that survived.

           ⚠ **Read from the input rather than from the composition (#1904).**
           This was `viewPronouns`, a local the composition declared — which
           moved into `composeAndGenerateOneView` with it. The DERIVATION is
           copied, not the variable, and it has to be the same one: a judge given
           different pronouns from the generator is #1480 finding A exactly, and
           on the sheet road there is no per-view composition to borrow from at
           all. One expression, pinned by an arm. */
        pronouns: input.pronouns ?? pronounsForSex(null),
      });
      verdicts.push(verdict);
      // A picture came back and the judge answered about it: this attempt
      // spent from the JUDGED budget, whichever way the answer went.
      judgedAttempts += 1;

      if (verdict.unjudged) {
        /*
          D-246, amending D-92: **"we decided it was wrong" and "we could not
          tell" are different facts about a slot the customer paid for**, and
          only the first is a reason to take the picture away. The verdict has
          carried that distinction since it was written — the comment on
          `unjudged` says in as many words that the second "is the one that
          needs an alarm" — and until now both landed in the same branch.

          So it delivers, loudly. The alarm is the log line and the `unjudged`
          flag on the row; the guarantee Sign sells is not weakened, because a
          judge that DID look and DID reject still refuses below.

          ⚠ **AND SINCE #1612 PART 2 IT IS NO LONGER THE ONLY DELIVERING
          BRANCH** — a judge that looked and turned the FRAMING or the WARDROBE
          down delivers too, in the branch below. This one is still its own
          case and must stay first: it is the one where no opinion exists at
          all, and `viewConformanceRefuses` reads it before it reads an axis
          for exactly that reason.
        */
        log.error(
          { operationId: input.operationId, angle, attempt, method: verdict.method },
          "[packageOrchestrator] the view could not be judged — DELIVERING and recording it, "
          + "rather than charging nothing for a picture that may be perfect (D-246)",
        );
      } else if (viewConformanceRefuses(verdict)) {
        const failedAxes = (Object.keys(verdict.axes) as Array<keyof typeof verdict.axes>)
          .filter((axis) => !verdict.axes[axis].pass);

        {
          /*
            ⚠ **THE "DELIVER IT ANYWAY" BRANCH THAT STOOD HERE IS DELETED, AND
            IT WAS UNREACHABLE RATHER THAN MERELY UNUSED — the repair owed on
            PR #1915.**

            It was #1612 part 2's: the judge looked, the FRAMING or the WARDROBE
            did not hold, the picture was still hers, so it was delivered charged
            and marked `Unchecked · Try again`. **#1903 deleted both of those
            axes**, so the branch could not be entered: `verdict.pass` is
            `CONFORMANCE_AXES.every(pass)` and {@link viewConformanceRefuses} is
            `unjudged !== true && some(!pass)` — the same `axes[axis].pass`
            fields, read the same way — so under the old `else if
            (!verdict.pass)`, below an `if (verdict.unjudged)` that had already
            taken its own road, it was always false. Its log line still said
            *"framing or wardrobe"*, describing a refusal the product no longer
            makes.

            **Deleted rather than left standing or turned into an assertion**,
            because {@link viewConformanceRefuses}'s docblock names exactly this
            shape as the thing not to have: *"not with a `deliver anyway` branch
            bolted beside it, which is exactly the two-tier shape his ruling
            dissolved."* A dead branch beside a live rule is an invitation to
            add a fourth, non-catastrophic axis and quietly re-grow the two
            tiers.

            ⚠ **AND THE CONDITION ABOVE MOVED FROM `!verdict.pass` TO THE RULE
            ITSELF, which is the half that is not tidying.** The two were
            equivalent only because every current axis is a catastrophe; leaving
            `!verdict.pass` here would have been a SECOND expression of the
            refusal rule in a second file (working law 4), and the one that
            takes a paying customer's picture away. Now there is one rule, read
            where it is declared — and its failure direction is the safe one: a
            verdict this rule does not call a refusal DELIVERS rather than
            silently refunding.
          */
          lastReason = refusedViewReason(failedAxes, input.castName);
          /*
            KEEP THE PICTURE THE JUDGE TURNED DOWN — #1492, his own Jingu (2026-09-29).

            He retried two views several times, every attempt was refused on
            `angle`, and **the record could say "angle" and nothing else**: the
            frame is dropped one line down and the judge's note never leaves this
            process. So there was nothing for his eye to overrule (law 9 — *the
            engine lies and cannot be trusted*), and nothing for a court to read
            either. `CASTING_DIAGNOSTIC_CAPTURE_SCOPE` has stood at `users:1` on
            production for exactly this since 2026-08-08 and this road never
            called it.

            ⚠ **ONE CALL SITE SERVES BOTH ROADS, which is why it is here and not in
            either of them.** The Sign's five views and a Try again both render
            through this loop, so the Sign's refusals and the retry's arrive on the
            same terms — and the retry, which is the half he was stuck in, could
            not have been covered from `signService` at all.

            It is BEFORE the drop only for reading order; the bytes are in hand
            either way. It cannot break the render — the capture never throws, is
            dark on every account but his, and its failure is logged and dropped.
          */
          /*
            ⚠ **`.catch()`, AND IT IS NOT BELT-AND-BRACES — THE ARM THAT FOUND
            THIS NEEDED IT.** The capture is INSIDE this attempt loop's `try`, so
            a keeper that threw would be caught below as an ARRIVAL failure: it
            would spend the wrong budget (measured: three stored-and-dropped
            objects instead of two), and the judge's refusal would be reported as
            a view that never came back. The production capture promises never to
            throw — and a promise in a docblock is not a control (working law 3),
            least of all one standing between a diagnostic and a customer's money.
          */
          await (dependencies.capture ?? captureRefusedRender)({
            userId: input.userId,
            operationId: input.operationId,
            reason: `view_refused:${failedAxes.join("+")}`,
            /*
              ⚠ **THE NAME CARRIES THE ANGLE AND THE ATTEMPT, and a key that did
              not would be worse than no capture at all.** `diagnosticKey` is
              `…/<userId>/<operationId>/<name>.png` — one Sign renders five angles
              with up to two judged attempts each under ONE operation id, so a
              bare name would have the second attempt silently overwrite the
              picture of the first, and the pair that shows whether the engine is
              drawing the same wrong thing twice is exactly the pair he needs.
            */
            frames: [{ name: `view-${angle}-attempt${attempt}`, bytes: image.bytes }],
          }).catch((error: unknown) => {
            log.warn(
              { err: error, operationId: input.operationId, angle, attempt },
              "[packageOrchestrator] the refused frame was not kept — the refusal stands unchanged",
            );
          });
          await drop(stored.key).catch(() => undefined);
          stored = null;
          log.warn(
            { operationId: input.operationId, angle, attempt, failedAxes, method: verdict.method },
            "[packageOrchestrator] view failed conformance",
          );
          /*
            The judge LOOKED and said no. One regeneration, then its answer
            stands — a third draw against the same judgement is the slot machine
            D-39/D-40 named, and #1208 deliberately left this half alone.
          */
          if (judgedAttempts >= VIEW_JUDGED_ATTEMPTS) break;
          continue;
        }
      }

      const value = await land({
        stored,
        verdict,
        provenance: {
          engine: image.provenance.model,
          provider: image.provenance.provider,
          ...(image.provenance.providerRef ? { providerRef: image.provenance.providerRef } : {}),
        },
      });

      if (value === null) {
        /*
          The fence refused: this operation is no longer `running`, so the
          recovery sweep has taken over and will settle this slot. Nothing will
          ever reference these bytes.
        */
        await drop(stored.key).catch(() => undefined);
        log.warn(
          { operationId: input.operationId, angle },
          "[packageOrchestrator] slot commit lost its fence — recovery owns this view",
        );
        return { status: "fenced", verdicts, tally: { attempts: attemptsRun, arrivalFailures, judgedAttempts } };
      }

      return { status: "landed", value, verdicts, tally: { attempts: attemptsRun, arrivalFailures, judgedAttempts } };
    } catch (error) {
      /* Before the drop, and that order is the whole point: the landing could
         not say whether its row points at these bytes (#2080). The sweep
         decides; the bytes stay until it has. */
      if (error instanceof ViewLandingUndecidedError) throw error;
      if (stored) await drop(stored.key).catch(() => undefined);
      const failureClass = error instanceof ProviderError ? error.failureClass : "unknown";
      lastReason = "The view could not be generated";
      log.warn(
        { operationId: input.operationId, angle, attempt, failureClass },
        "[packageOrchestrator] view generation failed",
      );
      /*
        IS ASKING AGAIN THE WAY TO GET HER THE VIEW SHE PAID FOR?

        ⚠ **THE LOOP NO LONGER ANSWERS THAT ITSELF (#1212).** It named two
        classes by hand, which made this road the third place in the product
        holding an opinion about the same union — and a hand-written list on a
        paid road drifts silently from the classes it was written against.
        `mayStillArrive` is that question, declared beside the other two in
        `providers/types.ts` where the classes are.

        ⚠ **IT IS STILL NOT `isRetryable`, AND THAT IS THE WHOLE POINT — SEE
        THE HEADER, §2.** Deriving from the transport's contract was written,
        driven and REVERTED inside #1208: it calls `unknown` terminal so an
        unmapped fault fails closed, and this road's own arm caught the
        consequence — a paid view failing on an unmapped engine error would
        have dropped from two attempts to one, the opposite of what that card
        ordered. The new predicate keeps `unknown` retrying and says why.

        ⚠ **NOTHING A CUSTOMER MEETS ON THIS ROAD CHANGES, AND THE FIRST
        DRAFT OF THIS PARAGRAPH SAID OTHERWISE.** It claimed `cannot_say`
        going terminal turned fifteen calls into five. **Read at the bytes,
        this road cannot raise `cannot_say` at all**: the only raiser in the
        product is `refineService.ts`'s `RepaintCannotSayError`, on the repaint
        road, and it extends `Error` rather than `ProviderError` — so it could
        not reach the `instanceof ProviderError` branch above even if a view
        somehow threw it. It is on the terminal set because the CONTRACT's own
        declaration justifies it, not because a wait was saved here.

        So what THAT change was worth is the derivation and its arms, not a
        behaviour win: the loop stopped holding a private opinion about a union
        that already has a contract module, and the six classes that read like
        candidates for the terminal set were named and pinned instead of being
        rediscovered by whoever reads two string comparisons next.
        Transport and rate limits were already retried inside the adapter.

        ⚠ **AND #1301 CASHED THREE OF THOSE SIX, WHICH IS WHERE THE WAIT
        ACTUALLY LEAVES THIS LOOP.** `provider_account` is terminal now, and it
        is the one of them this road can raise: `falTransport.ts` maps 401/403 to
        it, so an exhausted balance breaks here on the FIRST call instead of on
        the third, five times across a Sign instead of fifteen with 1.5 s and 4 s
        between each. Her money is unchanged — the slice below refunds whether
        the loop gave up once or three times — so what she stops doing is
        waiting. `composite_fault` and `removal_not_delivered` joined it on the
        contract's own terms and are unreachable here; `segment_store` is held
        and `providers/types.ts` says why.
      */
      /*
        ⚠ **A SETTLED SHEET THAT DID NOT ARRIVE IS TERMINAL HERE — #1966, and
        before that card it was not.** One promise per sheet means a settled
        rejection re-throws the same error instantly to every view awaiting it,
        so this loop's three attempts were spent WAITING on an answer that
        could never change. The sheet now asks three times itself, spaced, in
        `settleSignSheet`; repeating it here would spend one budget twice and
        put ~5 s of silence in front of a refund the customer is already owed.

        It is tested before `mayStillArrive` rather than mapped into a failure
        class, because the fact is about OUR settled promise and not about the
        transport — `settledPanelFor` raises it and its own docblock says why.
      */
      if (error instanceof SignSheetUnavailableError) break;
      /*
        ⚠ **A FRAME THIS ATTEMPT ALREADY BOUGHT IS NEVER BOUGHT AGAIN (#1994).**
        Tested before `mayStillArrive` because the class says nothing useful
        here: whatever threw after the engine resolved, re-asking renders a NEW
        paid frame and not the one in hand. The slice refunds through `failView`
        exactly as for any failed view — what stops is the re-buying.

        ⚠ **A STORE THROW REACHES HERE ONLY AFTER {@link VIEW_STORE_ATTEMPTS}
        tries of the same bytes (#2045)** — `storeArrivedFrame` above.
      */
      if (paidFrameInHand) {
        log.warn(
          { operationId: input.operationId, angle, attempt, failureClass },
          "[packageOrchestrator] the view ARRIVED and a later step failed — not buying another frame",
        );
        break;
      }
      if (!mayStillArrive(failureClass)) break;
      /*
        ⚠ **THE SECOND INSTANCE OF THE CLASS THE RELAY FOUND ON THE SHEET
        ROAD (PR #1982), swept here in the same commit.**

        Four of fal's faults are raised AFTER the job reports `COMPLETED` — no
        image in the payload, a malformed data URI, a failed download, a non-ok
        result fetch — and their classes (`unknown`, `transport`, and whatever
        a status maps to) are retryable, because retryable is the right answer
        for a job that never ran. This one ran and was billed: re-asking
        renders a NEW frame rather than re-fetching the one we bought, and it
        fails the same way, so the budget buys up to three frames to learn one
        answer.

        The slice refunds either way — what the customer stops doing is waiting
        through 5.5 s of spaced retries for a refund they are already owed.
      */
      if (providerAlreadyBilled(error)) break;
      /*
        The view never arrived. Keep trying, spaced — this is our failure to
        deliver something already paid for, not a draw against a judgement.
      */
      arrivalFailures += 1;
      if (arrivalFailures >= VIEW_ARRIVAL_ATTEMPTS) break;
      await wait(arrivalBackoffMs(arrivalFailures));
    }
  }

  return { status: "failed", reason: lastReason, verdicts, tally: { attempts: attemptsRun, arrivalFailures, judgedAttempts } };
}

/**
 * COMPOSE AND RENDER ONE VIEW — the request this road has always sent, moved out
 * of the attempt loop unchanged so the sheet road can stand beside it (#1904).
 *
 * ⚠ **IT IS A MOVE AND NOT A REWRITE.** Every clause, every ordinal and every
 * comment below arrived here verbatim from inside `renderViewAttempts`'s `try`,
 * dedented and otherwise untouched; the parameters are named so that not one
 * `input.` reference had to change. The single content change is the last
 * statement, which returns the engine's promise instead of assigning a local.
 *
 * ⚠ **It was MOVED rather than wrapped in an `if`, and that choice is the
 * honest one rather than the small one.** Leaving it in place would compose a
 * prompt and discard it on the sheet road — dead work, and worse, the
 * character-cap warning below would announce features dropped from a clause
 * nobody sent. On the sheet road the cast's tattoos and feature words ride the
 * SHEET, once, where they belong: they are facts about the person and the sheet
 * paints all five panels in one frame.
 *
 * **Still the only road for a Try again**, which renders one view against its
 * delivered sibling and has no sheet (`viewRetryService.ts`).
 */
async function composeAndGenerateOneView(
  input: BuildPackageInput,
  angle: CastViewAngle,
  engine: IdentityEngine,
): Promise<ImageResult> {
  /*
    THE TATTOOS SHE REALLY HAS RIDE BESIDE THE ANCHOR, INTO EVERY VIEW — his
    ruling, and the ordinal the clause quotes is derived from the array it is
    quoting about rather than assumed, so a sentence can never point at a
    slot the request does not hold.

    ⚠ **THE ANCHOR IS REFERENCE 1 AND THE CROPS START AT 2, AND THAT IS NOT
    A NEW FACT** — it is what the arithmetic has always evaluated to. A
    plate lane sat between them until #1158 slice 4f (*"It retires with
    N2"*), reading `2 + plates.length`; its source table never held a row in
    either world and `MANNEQUIN_ROAD_DEFERRED` refused every design at its
    first door regardless, so `plates.length` was 0 on every signed Cast
    this product has ever rendered. The composed prompt is byte-identical
    across that deletion, which is asserted at the wire rather than argued
    here — `packageOrchestrator.test.ts`, "the crops start at reference 2".
  */
  const crops = input.inkCrops ?? [];
  const references: ReferenceImage[] = [
    input.anchor,
    ...crops.map((crop) => ({ bytes: crop.bytes, contentType: crop.contentType })),
  ];
  const cropClause = inkViewCropClause({
    crops,
    firstOrdinal: 2,
    pronouns: input.pronouns ?? pronounsForSex(null),
  });
  /*
    THE WARDROBE PLATE'S PANEL RIDES LAST (#1278 path E).

    ⚠ **Its ordinal is DERIVED from the array it is talking about**, exactly
    as the crops' clause derives theirs, and for the same reason one line
    up: a Cast with three tattoos has her plate at reference 5, and a
    sentence carrying a constant would point every such view at a picture of
    her elbow and call it the outfit.

    Absent — every view but the two full-length ones, and both of those on a
    Sign whose plate did not land — this pushes nothing and composes the
    empty string, so the request is byte-identical to the one this road sent
    before path E. That inertness is asserted rather than described
    (`packageOrchestrator.test.ts`).
  */
  const outfitReference = input.outfitReference ?? null;
  if (outfitReference) references.push(outfitReference.image);
  /*
    ⚠ **ONE ORDINAL, TWO READERS — #1480.** It was computed inline for the
    clause alone; the composed prompt now has to NAME the outfit's reference
    in three more places, and two authors of this number would point a Cast
    with three tattoos at a picture of her elbow and call it the outfit.
    Named once, passed to both.
  */
  const outfitReferenceOrdinal = outfitReference ? 2 + crops.length : null;
  const viewPronouns = input.pronouns ?? pronounsForSex(null);
  const plateClause = outfitReference && outfitReferenceOrdinal !== null
    ? outfitReferenceClause({
        ordinal: outfitReferenceOrdinal,
        /* ⚠ **Read off the reference, never defaulted.** This was
           `input.outfitPlateSide ?? "front"` while the side and the image
           were two optional fields that had to agree: a caller that set one
           and forgot the other got a clause claiming the picture faced the
           front. Harmless while every reference WAS the front panel of a
           front view; a 50/50 lie about which side to copy the moment a
           retry's reference became the opposite view (#1474). They are one
           object now, so there is nothing left to default. */
        side: outfitReference.side,
        kind: outfitReference.kind,
        pronouns: viewPronouns,
      })
    : "";
  /*
    THE WORDS FOR WHAT THE ANCHOR CANNOT SHOW ride in the same place the
    crops' clause does, so there is one shape for "things that travel
    beside the anchor" rather than two. Both are appended rather than
    substituted: a Cast with neither sends the composer's own output, byte
    for byte, which is the inertness both lanes are asserted on.
  */
  const composedWords = composeViewFeatureWordsClause(input.featureWords ?? []);
  const wordsClause = composedWords.clause;
  /*
    ⚠ **AND WHAT THE CHARACTER CAP PUSHED OUT IS SAID OUT LOUD** (survey
    finding opus-1231 §1, ordered fable-1607 ruling 1).

    This line read `…(…).clause` and threw `dropped` away — while the
    producer's own docblock said, in as many words, why it hands it back:
    *"a cap that silently truncates reads, from the outside, exactly like a
    feature that was never there."* The report existed and its only consumer
    discarded the half that explains. That is arm-at-the-producer's exact
    silhouette, on the road where a customer pays for frames she keeps.

    The COUNT cap already logs its declines at the Sign
    (`[signService] the features this Cast's views carry as words`); this is
    the other cap, said the same way and with the same discipline:
    **SLOTS ONLY, never the words**, because the words are the customer's own
    and this log is not a place they belong.

    It fires per view rather than once per package, deliberately: the clause
    is composed here, and a log that claimed to describe a package from
    outside the loop would be describing a composition it did not watch. The
    drop is deterministic across the six, so the repetition is honest noise
    rather than six different facts.
  */
  if (composedWords.dropped.length > 0) {
    log.warn(
      {
        operationId: input.operationId,
        angle,
        droppedSlots: composedWords.dropped.map((feature) => feature.slot),
        keptCount: (input.featureWords ?? []).length - composedWords.dropped.length,
      },
      "[packageOrchestrator] the view clause hit its character cap — these features "
      + "were dropped from the words this view carries",
    );
  }
  return engine.generateView({
    /*
      THE PLATE MOVES THE DELIVERED PICTURE'S SHAPE UNLESS IT IS PINNED —
      measured, and `PLATE_VIEW_ASPECT_RATIO`'s docblock carries the three
      readings. Absent a plate this spreads nothing, so the other three
      views send the request they always sent, byte for byte.
    */
    ...(outfitReference ? { aspectRatio: PLATE_VIEW_ASPECT_RATIO } : {}),
    prompt: [
      /*
        ⚠ **THE OUTFIT CLAUSE IS NO LONGER APPENDED AFTER THE HOUSE BLOCK —
        #1480 finding D.** It used to sit after `AUTHORITY_LINE`, the
        paragraph that says what beats what, so the one sentence naming the
        outfit's real authority was outside the ordering that decides
        authority. The composer places it with WARDROBE now, and is handed
        the ORDINAL as well, so the three sentences that still told the
        engine to work the hem out from the description stop doing so.
      */
      composePackageViewPrompt(angle, input.wardrobeLine ?? null, input.description ?? null, {
        pronouns: viewPronouns,
        outfitReferenceOrdinal,
        outfitClause: plateClause,
      }),
      cropClause,
      wordsClause,
    ]
      .filter((part) => part !== "")
      .join("\n"),
    references,
    /*
      §H.10: signed package views are the `2K` TIER.

      ⚠ **AND IT IS A TIER, NOT A PIXEL COUNT — WHICH MATTERS NOW THAT THE
      ENGINE UNDER IT HAS CHANGED (#1459).** It never was a measurement:
      Nano Banana Pro answered `2K` with 1696x2528, and this road now
      renders on Sunburst's edit door, which answers 2352x3504. What the
      word has always named is the SIGNED-VIEW tier — the one the anchor's
      `1K` is not — and `refineService.ts` says the same thing from the
      other side: *"1K: a candidate's own resolution. The 2K tier belongs
      to signed views."*

      So the `model_assets.resolution` enum keeps saying `2K` and the row
      stays honest, because the two readers below (`committedPackageAngles`,
      `unsettledPackageAngles`) are asking a ROLE question — *is this a
      full view rather than the 1K anchor?* — and the tier is what answers
      it. **Adding a value for the new size would put two labels on one
      role across a live table whose existing rows cannot be relabelled
      without a row rewrite, and a reader that missed the second label
      would read a paid, landed view as never arrived.** That is a money
      hazard for no gain.

      What carries the honest SIZE instead is the row's own provenance: the
      engine that painted is stamped on every asset
      (`provenance.engine`), so a Sunburst row and a Nano Banana Pro row
      are already told apart by the record rather than by memory.
      `server/castingV2/signViewEngineChain.test.ts` pins both halves, the
      hazard included.
    */
    resolution: "2K",
    viewAngle: angle,
  });
}

/**
 * Build one view for a SIGN: render it, then commit it under the Sign's own
 * fence and settle its slice when it never comes.
 *
 * Everything about what the picture IS lives in `renderViewAttempts`; this is
 * the Sign's half — its audit row, its fence, its per-slot refund.
 */
async function buildOneView(
  dependencies: PackageOrchestratorDependencies,
  input: BuildPackageInput,
  angle: CastViewAngle,
  auditId: number | null,
): Promise<PackageSlotOutcome> {
  const view = castPackageView(angle);
  const commit = dependencies.commitSlot ?? commitPackageSlotAsset;

  const rendered = await renderViewAttempts(dependencies, input, angle, async (landed) => {
    const assetId = await commit({
      userId: input.userId,
      operationId: input.operationId,
      modelId: input.modelId,
      angle,
      storageKey: landed.stored.key,
      storageUrl: landed.stored.url,
      identityRevisionId: input.identityRevisionId,
      identityText: input.identityText,
      /* No per-view price since #1968; `openViewAudit` carries why. */
      pointsCost: 0,
      provenance: {
        source: "castingV2.sign",
        ...landed.provenance,
        ...conformanceProvenance(landed.verdict),
      },
    });
    // The url travels with the id because the audit row wants it and the
    // landing is the only place that still holds the stored object.
    return assetId === null ? null : { assetId, url: landed.stored.url };
  });

  if (rendered.status === "fenced") {
    if (auditId) {
      await updateGeneration(auditId, {
        status: "failed",
        errorMessage: "fenced",
        completedAt: new Date(),
      }).catch(() => undefined);
    }
    return {
      angle,
      status: "failed",
      reason: "This view was settled by recovery",
      // Deliberately zero: the sweep refunds this slice under the same
      // reference, and counting it here would double it on the receipt.
      refundedCredits: 0,
      refundUnrecorded: false,
      fenced: true,
    };
  }

  if (rendered.status === "landed") {
    if (auditId) {
      await updateGeneration(auditId, {
        status: "completed",
        resultUrl: rendered.value.url,
        completedAt: new Date(),
      }).catch(() => undefined);
    }
    return { angle, status: "committed", assetId: rendered.value.assetId };
  }

  return failView(dependencies, input, angle, {
    reason: rendered.reason,
    verdicts: rendered.verdicts,
    auditId,
    label: view.label,
  });
}

/*
  ⚠ `judgeUnjudgedOnFailure` STOOD HERE AND IS NOW IN `viewConformance.ts`,
  beside `unjudgedVerdict`, because his option A gave the Sign a SECOND road
  that needs the same rule (#1904). A copy in the coordinator would have been
  the worst place in the product for working law 4 to bite: the rule is D-246,
  and getting it wrong means a judge outage refunds a whole Sign. Its docblock
  there records what the first draft of the coordinator did instead.
*/

/**
 * THE SENTENCE A REFUSED VIEW CONFESSES. No judge text is ever shown.
 *
 * ⚠ **THIS BLOCK IS THE RECORD OF HOW IT BECAME ONE SENTENCE AND IS SUPERSEDED
 * BY THE BLOCK BELOW IT, which put it back to one per catastrophe. It is kept
 * because its reasoning is right and is what makes the shape legible: a
 * sentence must be reachable, and a sentence must be true of what happened.**
 *
 * ⚠ **IT USED TO BE A FUNCTION OF FOUR SENTENCES AND THREE OF THEM DIED WITH
 * #1612 PART 2 — law 7's ruling sweep, asked at the closing commit rather than
 * later: when a rule closes a path, what was bolted to it?**
 *
 * `conformanceReason(failedAxes, verdict)` picked identity → angle → wardrobe
 * → a fallback. Since {@link viewConformanceRefuses} is the only road to a
 * refusal and it refuses on identity alone, the identity clause is the only one
 * that could ever be reached again: the angle and wardrobe sentences would have
 * sat here looking live, unreachable, describing a refusal the product no
 * longer makes. **They were the customer copy for the five wardrobe refusals
 * and three angle refusals this product made in its whole history, every one of
 * which now delivers** — the record of them is on #1612 and in git, which is
 * where a retired sentence belongs rather than in a branch nothing can enter.
 *
 * The `unjudged` clause went the same way and for a sharper reason: that road
 * has DELIVERED since D-246, so a sentence confessing it was already dead
 * before tonight.
 */
/**
 * ⚠ **AND IT WAS ONE SENTENCE FOR THREE DIFFERENT CATASTROPHES UNTIL THE REPAIR
 * OWED ON PR #1915 — a customer-visible defect the removal sweep walked past.**
 *
 * `REFUSED_VIEW_REASON` was a single string, set for EVERY refusal, and it
 * reaches the customer verbatim: the room's failed tile reads *"Front failed —
 * <this>."* followed by what came back, and the health dialog reads *"Retry
 * needed — <this>."* So the day #1903 gave this judge two more catastrophes, **a blank
 * frame and a two-person frame both started telling a customer the picture
 * "didn't hold the signed likeness"**, which is false about both of them. It was
 * the one string still bolted to the identity-only rule.
 *
 * **One sentence per catastrophe, in her words and not the road's.** Nobody
 * meets an axis name, a verdict word or a number — working law 8, and the
 * disappearing-technology law's rule that a refusal says what was refused.
 *
 * ⚠ **THE RECORD IS EXHAUSTIVE OVER {@link ConformanceAxis} ON PURPOSE.** A
 * fourth axis added to that set is a compile error here until somebody writes
 * what it would say to a customer — which is the only mechanism in this file
 * that could have stopped tonight's defect, so it is built rather than promised.
 *
 * ⚠ **AND THE THREE SENTENCES ARE YUNA'S NOW, ON HIS WORD — #1904, 2026-10-08,
 * posted with his *"go with A"*: *"The refusal wording rides with it (Yuna, 8
 * Oct, from his Notion desk)"*.** What changed beyond the words themselves:
 *
 * - **"Signed likeness" is dropped everywhere.** It was a term of art from the
 *   pipeline standing on a path a customer cannot avoid — the
 *   disappearing-technology law's own example of the machinery showing through.
 *   The Cast's NAME stands where it stood, or *"this character"* for a Cast
 *   whose owner has not named it yet ({@link UNNAMED_CAST_IN_COPY}).
 * - **Each one says what we DID** — *"so we didn't keep it"* — because a
 *   refusal that only describes the picture leaves the customer to work out
 *   whether they still have it and whether they paid for it.
 *
 * ⚠ **THEY CARRY NO TERMINAL STOP, AND THAT IS MEASURED RATHER THAN A STYLE
 * CHOICE.** Every surface that renders a reason supplies its own punctuation —
 * `ViewTabs`'s failed slot composes `${label} failed — ${reason}. ${money}` —
 * so a sentence shipped with its own full stop reads *"…we didn't keep it.."*
 * on the one surface a Sign's refusal actually lands on. The alternative,
 * taking the stop out of `ViewTabs`, breaks every OTHER reason this road
 * raises (*"The view could not be generated"*, the fallback below, the fenced
 * sentence), none of which carries one either. So the sentence is Yuna's and
 * the punctuation stays where it already lives.
 *
 * ⚠ **The money half is NOT changed here.** Her design says *"{N} credits
 * returned."* and this product currently says *"{N} credits refunded — you
 * weren't charged."* ({@link refundOutcomeText}, one helper, four surfaces).
 * That is **#1940**'s own founder-ordered card — *"credits returned" everywhere*
 * — and it reaches top-ups, plan changes and refine refunds as well as this
 * road. Folding it in here would ship half of it under a different card's name.
 */
function refusedViewReasons(name: string): Record<ConformanceAxis, string> {
  return {
    intact: "This view came out broken, so we didn't keep it",
    /*
      Covers BOTH halves of that axis honestly, which a count-shaped sentence
      could not: `people` fails on nobody at all as well as on a crowd, and
      "didn't show just <name>" is true of each.
    */
    people: `This view didn't show just ${name}, so we didn't keep it`,
    identity: `This view didn't clearly look like ${name}, so we didn't keep it`,
  };
}

/**
 * WHAT A CAST WITH NO NAME IS CALLED IN A SENTENCE A CUSTOMER READS — his
 * ruling's own words, *"or \"this character\" when it has none"*.
 *
 * ⚠ **Never the KI id and never a pronoun.** The id is the machinery showing
 * through, and a pronoun would be this road guessing about a person the
 * customer invented — the Sign already carries {@link BuildPackageInput.pronouns}
 * for the generator and the judge, and a refusal is not the place to spend it.
 */
export const UNNAMED_CAST_IN_COPY = "this character";

/**
 * ⚠ **WHICH ONE IS CONFESSED WHEN SEVERAL FAILED, AND IT IS NOT
 * {@link CONFORMANCE_AXES}' OWN ORDER — that would confess identity first.**
 *
 * A damaged frame usually drags identity down with it: nothing can be
 * recognised in a half-black picture, so the judge answers `differs` or `unsure`
 * on identity too, and identity-first would tell a customer their picture is not
 * them when what actually happened is that it did not render. **The most basic
 * fault is named first**, which is both the true one and the believable one.
 *
 * ⚠ **AND `people` MOVED AHEAD OF `identity` ON HIS WORD — #1904, 2026-10-08,
 * verbatim: *"If several fail, show one line, in this order: broken, then wrong
 * people, then not her."*** It was `intact → identity → people`. The reasoning
 * is the same one the first paragraph makes, one step further: a frame holding
 * two people, or nobody, drags identity down for exactly the reason a damaged
 * frame does — there is no single face to recognise — so *"didn't show just
 * {name}"* is the true fault and *"didn't clearly look like {name}"* is its
 * symptom. His order is this reasoning, and the clause above is why it was
 * already half-built.
 *
 * It is a PERMUTATION of the axis set rather than a subset of it, and
 * `packageOrchestrator.test.ts` derives that check from {@link CONFORMANCE_AXES}
 * rather than restating this list — an axis added to the judge and forgotten
 * here would otherwise fall silently to the fallback sentence.
 */
const REFUSAL_CONFESSION_ORDER: readonly ConformanceAxis[] = ["intact", "people", "identity"];

/**
 * ⚠ **THE FALLBACK IS NOT DECORATION — it is what a refusal says when the
 * reason is one this list does not know.** `method: "forced"` fails every axis
 * with no axis being the story, and a future road could refuse without naming
 * one. Confessing a likeness failure there would be a guess about a customer's
 * picture printed as a fact.
 */
const REFUSED_VIEW_FALLBACK = "This view didn't come out right";

/**
 * The one sentence a refused view confesses, chosen from what actually failed.
 *
 * ⚠ **`castName` IS OPTIONAL AND ITS ABSENCE IS A REAL STATE, not a caller
 * forgetting.** A Cast is signed with a name or without one — `SignInput.name`
 * is optional and *"A Cast with no name shows its KI id until its owner gives
 * it one"* — so an unnamed Cast is the ordinary case on this road, and
 * {@link UNNAMED_CAST_IN_COPY} is what it is called in a sentence. A blank or
 * whitespace-only name is treated as no name, because *"didn't clearly look
 * like  , so we didn't keep it"* is worse than the generic sentence.
 */
export function refusedViewReason(
  failedAxes: readonly string[],
  castName?: string | null,
): string {
  const reasons = refusedViewReasons(castName?.trim() || UNNAMED_CAST_IN_COPY);
  for (const axis of REFUSAL_CONFESSION_ORDER) {
    if (failedAxes.includes(axis)) return reasons[axis];
  }
  return REFUSED_VIEW_FALLBACK;
}

async function failView(
  dependencies: PackageOrchestratorDependencies,
  input: BuildPackageInput,
  angle: CastViewAngle,
  detail: {
    reason: string;
    /** Every attempt's verdict, oldest first. Empty when nothing was judged. */
    verdicts: readonly ViewConformanceVerdict[];
    auditId: number | null;
    label: string;
  },
): Promise<PackageSlotOutcome> {
  /*
    ⚠ **NOTHING IS REFUNDED HERE ANY MORE — #1968, his word of 2026-10-08.**

    This function used to begin with a `recordRefund` of one view's slice under
    `packageSlotChargeReference`, and that was the whole reason the Sign's price
    was decomposed. His reprice ends it:

      > *"Drop the 700 base + 200 per view split, since views are cut from two
      > sheets and can't be refunded one by one. A failed check re-makes the
      > whole sheet at our cost... Credits only come back if the Sign can't be
      > delivered at all."*

    Since #1957 this view is a panel cut from a landscape sheet that two or
    three other views were cut from too, and a catastrophe on any of them buys
    a whole replacement sheet at HOUSE cost (`SHEET_MAX_RENDERS`). So the frame
    behind a refused view was paid for, twice over in the worst case, and
    handing back a fifth of the Sign for it pays a customer for work we bought.

    **What a refused view still does, unchanged:** it confesses in place. The
    marker below is written exactly as before, the room draws the refusal
    sentence from it, and D-246 still means a view nobody could judge is
    DELIVERED rather than refused. Only the money line is gone.

    `refunded: 0` on the marker is therefore the truth rather than a stub — the
    room must never imply credits came back for this view, which is #1940's own
    rule pointed at this road.
  */
  if (detail.auditId) {
    await updateGeneration(detail.auditId, {
      status: "failed",
      errorMessage: detail.reason,
      completedAt: new Date(),
    }).catch(() => undefined);
  }

  await (dependencies.recordFailure ?? recordPackageSlotFailure)({
    userId: input.userId,
    operationId: input.operationId,
    modelId: input.modelId,
    angle,
    failure: {
      reason: detail.reason,
      /*
        No slice comes back for a refused view (#1968), and `refundReference` is
        OMITTED rather than blanked: its absence is what tells the room nothing
        was owed, as against a refund that was attempted and failed. The two
        read identically at `refunded: 0` otherwise, and only one of them is a
        fault worth sending somebody to support about — `refundOutcomeText`
        carries the table.
      */
      refunded: 0,
      /*
        The FINAL verdict stays where it was, under the same key, because the
        room and any dispute read that shape — widening it would be a projection
        change for a record nobody asked to see differently.

        The earlier attempts ride alongside it under their own key. A slot that
        failed twice now says so, and says what the first draw was rejected for.
      */
      ...(detail.verdicts.length > 0
        ? {
            conformance: {
              axes: detail.verdicts[detail.verdicts.length - 1].axes,
              method: detail.verdicts[detail.verdicts.length - 1].method,
            },
          }
        : {}),
      ...(detail.verdicts.length > 1
        ? {
            earlierAttempts: detail.verdicts.slice(0, -1).map((verdict) => ({
              axes: verdict.axes,
              method: verdict.method,
            })),
          }
        : {}),
    },
  });

  return {
    angle,
    status: "failed",
    reason: detail.reason,
    refundedCredits: 0,
    refundUnrecorded: false,
  };
}

/**
 * The views this Sign PROMISED, read from its own durable audit rows.
 *
 * Never the profile constant: the constant is what a NEW Sign would buy, and
 * recovery is settling an old one. A Sign charged for six views must be
 * refunded against six, whatever this deploy happens to promise.
 *
 * Falls back to today's profile only when no audit row exists at all — a crash
 * so early that no view was ever opened. The caller cross-checks that fallback
 * against `plannedCredits` and refuses to guess if the two disagree.
 */
export async function promisedPackageAngles(input: {
  userId: number;
  operationId: string;
}): Promise<{ angles: CastViewAngle[]; source: "recorded" | "profile" }> {
  const rows = await listOperationViewSteps(input.operationId);
  const angles = rows
    .map((row) => row.viewAngle)
    .filter((angle): angle is CastViewAngle =>
      (CAST_VIEW_ANGLES as readonly string[]).includes(angle ?? ""));
  /*
    CAST_VIEW_ANGLES, never the comp-card six — this is the refund work-list.
    Reading the durable promise back through a filter that predates the promise
    is the deploy-collision landmine wearing a different coat: a v3 Sign swept
    by this code would have its close-up dropped here and never refunded.
  */
  const unique = CAST_VIEW_ANGLES.filter((angle) => angles.includes(angle));
  return unique.length > 0
    ? { angles: [...unique], source: "recorded" }
    : { angles: [...CAST_PACKAGE_VIEWS], source: "profile" };
}

/** Angles that have neither landed nor been written off — recovery's work list. */
/**
 * The views that actually LANDED — a full-resolution picture on disk.
 *
 * Recovery's half of the total-loss rule, and it is deliberately read from the
 * asset rows rather than from anything a process believed. That is the property
 * that lets the adjudicator reach the same verdict as the live orchestrator
 * after the process holding the package has been killed mid-flight: promotion
 * is retained when the candidate CAS is set AND at least one view committed,
 * and both halves are recomputable from durable rows alone (D-103).
 *
 * The 1K anchor is excluded by the same `2K` test the settlement uses. It is
 * the face she already had; it is not a view the package delivered.
 */
export async function committedPackageAngles(input: {
  userId: number;
  modelId: number;
  promised?: readonly CastViewAngle[];
}): Promise<CastViewAngle[]> {
  const assets = await listCastAssets(input.userId, input.modelId);
  const landed = new Set<string>();
  for (const asset of assets) {
    if (asset.storageUrl && asset.resolution === "2K") landed.add(asset.viewType);
  }
  return (input.promised ?? CAST_PACKAGE_VIEWS).filter((angle) => landed.has(angle));
}

export async function unsettledPackageAngles(input: {
  userId: number;
  modelId: number;
  /** The promised set. Defaults to today's profile for live callers. */
  promised?: readonly CastViewAngle[];
}): Promise<CastViewAngle[]> {
  const assets = await listCastAssets(input.userId, input.modelId);
  const settled = new Set<string>();
  for (const asset of assets) {
    const status = asset.status as { state?: string } | null;
    // A filled row is a landed view; a failure marker is a written-off one. The
    // 1K anchor is filled `frontClose`, so a headshot whose 2K re-render never
    // happened still counts as unsettled only if no marker was written for it —
    // which is exactly the case recovery must refund.
    if (asset.storageUrl && asset.resolution === "2K") settled.add(asset.viewType);
    if (status?.state === "failed") settled.add(asset.viewType);
  }
  return (input.promised ?? CAST_PACKAGE_VIEWS).filter((angle) => !settled.has(angle));
}
