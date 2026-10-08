/**
 * REDO THE WHOLE PACKAGE — every view of a signed Cast rendered again, for a
 * customer who simply does not like what arrived (#1903 slice 2).
 *
 * **His ruling, verbatim (2026-10-07):** *"maybe we should allow retry by
 * default incase they didnt like the outfit that was invented or whatever but
 * it costs per retry and regens all views not just one"*.
 *
 * **His price, 2026-10-08 (terminal), verbatim:** *"on this card make both
 * sign and redo/regenerate 650 credis"* — a flat **650 display = 3,250
 * ledger**, declared once as {@link CASTING_V2_PACKAGE_REDO_PRICE_CREDITS}.
 * ⚠ This header said ***"350"*** and described a per-slice charge until
 * 2026-10-09; that was his first answer, asked and given the same sitting as
 * the ruling above, and his finance team's reprice superseded it. Both halves
 * of the old design are gone and the paragraphs below record what replaced
 * them, because the per-slice shape is still the obvious one to reach for.
 *
 * **No fault has to be found first, and that is the feature.** Every other road
 * to a second render on this Cast is a remedy — a view that failed was
 * refunded, a view nobody checked is owed a free look. This one answers a
 * question no machine can: *is this the person I was trying to cast?* So there
 * is no eligibility to compute, no verdict to consult and no free branch; the
 * only questions are whether she is ready to be asked (below) and whether the
 * customer can afford it.
 *
 * # One press, five operations, and the money is ALL on the press
 *
 * ⚠ **THE FIVE SLOT ROWS PLAN 0 AND SETTLE 0/0.** The press is the only row
 * with money on it, and it takes the whole 3,250 in a single deduct. The
 * reason is arithmetic rather than taste: the recovery sweep refunds an
 * unsettled row's `plannedCredits`, so a slot holding the flat price would
 * hand back a WHOLE redo whenever that slot happened to be the one left
 * unsettled — with its four siblings delivered.
 *
 * **What comes back, and it is the only thing that does:** nothing, unless
 * **zero** views were delivered. One view is a delivered press — she asked for
 * her views again, she received work, and the fifth slot kept the picture she
 * already had, so a redo never leaves a hole. His word, on #1968: *"Credits
 * only come back if the Sign can't be delivered at all."* The rule itself is
 * {@link flatPressRefundOwed} and lives in one module for both roads.
 *
 * ⚠ **THIS SECTION DESCRIBED THE OPPOSITE UNTIL 2026-10-09, and the shape it
 * described is the one to resist.** It read: *"the unit that can fail has to be
 * the unit that is charged: 1,750 ledger = 5 × 350, each view its own
 * refundable slice"* — true of the per-slice price, and the reason a per-slot
 * refund branch stayed wired in the sweep long after it could be reached. His
 * reprice made the views un-refundable one by one because they are cut from
 * two sheets: a refused panel re-makes its whole sheet at the house's cost,
 * which is what the flat price buys.
 *
 * ⚠ **WHAT THAT COSTS, named rather than discovered: in a partial failure the
 * package is briefly MIXED** — four views in the new outfit beside one in the
 * old — which is the one thing a redo exists to avoid. That is unchanged by
 * the reprice; what changed is that the odd slot out is no longer refunded, so
 * nothing a customer reads may imply credits came back for it.
 *
 * # The money order, and it is the house's with one addition
 *
 *   admit (free) → **claim ALL FIVE (free)** → per view: running → pinned
 *   deduct → render → land → settle
 *
 * ⚠ **THE FIVE CLAIMS HAPPEN BEFORE ANY MONEY MOVES, AND THAT IS THE ONE
 * STRUCTURAL ADDITION THIS ROAD MAKES.** A claim is free — it takes the slot
 * lock and writes a row — so claiming the whole set first turns "somebody else
 * is already asking for her profile" into a refusal that has charged nothing,
 * instead of a redo that charged for two views and then met a busy slot. Both
 * the admission read and the locks are needed: the read is the sentence a
 * customer meets, and the lock is the thing that is actually true at the
 * moment the money would move.
 *
 * # What the picture is
 *
 * Composed and judged by `renderViewAttempts` — the Sign's own loop, called
 * rather than copied, for the reason working law 4 exists and the reason the
 * Try again road gives: a second composition would drift, and the drift would
 * be a customer's tattoos quietly missing from the views they paid twice for.
 * The outfit comes from **one fresh wardrobe plate** on the Sign's own plate
 * road, which is what makes his *"regens all views"* mean one outfit across all
 * five rather than five inventions.
 *
 * ⚠ **THE PLATE IS A FRESH INVENTION HERE AND THAT IS THE OPPOSITE OF THE TRY
 * AGAIN ROAD'S RULE (#1474), DELIBERATELY.** A single-view retry is dressed by
 * its DELIVERED SIBLING, because the outfit of record already exists and a
 * fresh plate would put the one slot the customer disliked into a different
 * outfit from the four they kept. A redo is the case where there IS no outfit
 * of record worth keeping — disliking the invented outfit is the example in his
 * own ruling — so copying the delivered sibling would re-deliver the very thing
 * being redone. The two roads disagree because they are answering opposite
 * questions, and his rule behind #1474 is untouched: no plate is stored, no
 * wardrobe card is written, nothing is reused.
 *
 * # Her identity never moves
 *
 * The master is the reference every time (his card: *"The identity stays fixed
 * across a redo"*), and it is the same anchor row the Sign and the Try again
 * read — `readCastViewRenderSource`, fetched before the first claim so a Cast
 * whose anchor object has gone away is a free refusal rather than five charged
 * renders with nothing to hold the likeness.
 */
import { TRPCError } from "@trpc/server";

import type { CastViewAngle } from "../../shared/boardTypes";
import { displayPrice, formatCredits } from "../../shared/creditDisplay";
import { recordRefund } from "../casting/atomicCredits";
import { CASTING_V2_PACKAGE_REDO_PRICE_CREDITS } from "../casting/castingCreditCosts";
import { flatPressRefundOwed } from "../casting/flatPressCharge";
import {
  beginDirectOperation,
  completeDirectOperationSuccess,
  failClaimedDirectOperation,
} from "../casting/directOperation";
import {
  castViewRetryClaimPayload,
  castViewSlotOperationLockKey,
  derivedClientRequestId,
  modelOperationLockKey,
  operationChargeReference,
} from "../casting/operationContract";
import {
  commitRetriedViewAsset,
  pressViewLanded,
  readCastViewRenderSource,
} from "../db/castingV2ViewRetry";
import { getUserCredits } from "../db/credits";
import { deductCredits } from "../db/credits";
import {
  handoffGenerationOperationToRecovery,
  markGenerationOperationRunning,
} from "../db/generationOperations";
import { createModuleLogger } from "../logging/logger";
import { storageReadBytes } from "../storage";
import { castPronouns } from "./castPronouns";
import { castPackageView } from "./castViewPackage";
import {
  renderViewAttempts,
  type PackageOrchestratorDependencies,
} from "./packageOrchestrator";
import {
  renderSignSheet,
  signSheetPlan,
  type SignSheetKind,
} from "./signSheet";
import { settleSignSheet, type SettledSignSheet } from "./signSheetCoordinator";
import { carriedFeatureWords, carriedInkCrops } from "./signService";
import { castingSignSheetEngine, castingViewConformanceJudge } from "./signEngine";
import { assertNotFrozen } from "./spendGuards";
import { conformanceProvenance } from "./viewConformance";
import { castPackageRedoOffer } from "./castProjection";
import { readCastSlots, type CastSlotsRead } from "./viewRetryService";
import { castWardrobeLine, castWardrobeSource } from "./wardrobeLine";

const log = createModuleLogger("castingV2/packageRedoService");

export type PackageRedoServiceDependencies = PackageOrchestratorDependencies & {
  begin?: typeof beginDirectOperation;
  markRunning?: typeof markGenerationOperationRunning;
  deduct?: typeof deductCredits;
  commitRetried?: typeof commitRetriedViewAsset;
  /**
   * HAND THE LEASE TO THE SWEEP — injected so an arm can PROVE it happened.
   *
   * #1903's review finding 1 was an exit that sealed a receipt instead of
   * making this call, and the defect is invisible from the outside: the
   * returned result is identical either way. Only the operation ROW differs,
   * and a unit suite has no database. So the seam is the control: an arm drives
   * the fenced read and asserts this was called with the right operation, which
   * is the one observable that distinguishes the repair from the bug.
   */
  handoffToRecovery?: typeof handoffGenerationOperationToRecovery;
  readSource?: typeof readCastViewRenderSource;
  /**
   * DID ANY VIEW OF THIS PRESS LAND — asked of the ROWS before the only refund
   * this road can make, so a total loss is a fact rather than this process's
   * belief (the security review's third finding on PR #1924).
   */
  pressLanded?: typeof pressViewLanded;
  readAnchorBytes?: typeof storageReadBytes;
  /**
   * THE BALANCE, AND ONLY THE BALANCE.
   *
   * Narrower than `typeof getUserCredits` on purpose: that function returns the
   * whole credits row — nineteen columns including the plan tier and the Stripe
   * customer id — and a seam typed as the row forces every arm that wants to
   * say *this customer is one credit short* to build a plan, two dates and a
   * subscription. The entrance reads one number, so the seam asks for one
   * number, and `getUserCredits` satisfies it structurally.
   */
  readBalance?: (userId: number) => Promise<{ balance: number } | null>;
  /** What the room would show right now — the authority on whether she may be
   *  asked at all, injected so a test drives the decision rather than a fixture
   *  of it. */
  readSlots?: (userId: number, castPublicId: string) => Promise<CastSlotsRead | null>;
};

export type PackageRedoInput = {
  userId: number;
  clientRequestId: string;
  castId: string;
};

export type PackageRedoResult = {
  castId: string;
  /** Views that arrived and replaced what was in their slot. */
  committed: CastViewAngle[];
  /**
   * Views that did not arrive. Their slice went back and the picture the
   * customer already had is still there — nothing is left empty by a redo.
   */
  failed: CastViewAngle[];
  chargedCredits: number;
  refundedCredits: number;
  /**
   * FALSE only when a refund we owed could not be written. Truthful even when
   * it went wrong: a refund that did not record is never reported as "you
   * weren't charged" (the refund law this product has had since D-64).
   */
  refundRecorded: boolean;
};

/** One sentence, three reasons it can be said, and none of them has charged. */
export const PACKAGE_REDO_NOT_READY_MESSAGE =
  "This Cast is still being made. You can ask for all the views again once it's done. Nothing was charged.";
export const PACKAGE_REDO_BUSY_MESSAGE =
  "Some of these views are already being made. Wait for those to finish, then ask again. Nothing was charged.";
export const PACKAGE_REDO_UNAVAILABLE_MESSAGE =
  "This Cast can't be asked for new views right now. Nothing was charged.";
export const PACKAGE_REDO_FACE_MISSING_MESSAGE =
  "This Cast's signed face isn't available right now, so the views can't be rebuilt. Nothing was charged.";

/*
  ⚠ **NO PRICE IS RE-EXPORTED FROM THIS FILE, AND THE FIRST DRAFT DID.**

  The tempting shape is a `packageRedoPrice` here, "said once, read by the
  entrance and the projection" — and it is working law 4 inverted: it would be a
  SECOND name for `CASTING_V2_PACKAGE_REDO_VIEW_PRICE_CREDITS`, in the module
  that spends, for the projection to import. Both roads read the declaration
  itself, and the thing that actually keeps the button and the till together is
  that both call `castPackageRedoOffer` over the same slots.
*/

export async function redoCastPackage(
  dependencies: PackageRedoServiceDependencies,
  input: PackageRedoInput,
): Promise<PackageRedoResult> {
  await assertNotFrozen(input.userId);

  /* ---- admission: every refusal here is free and before any claim ---- */

  const read = await (dependencies.readSlots ?? readCastSlots)(input.userId, input.castId);
  if (!read) throw new TRPCError({ code: "NOT_FOUND", message: "Cast not found" });

  /*
    THE OFFER IS RE-READ HERE, NOT TRUSTED FROM THE CLIENT.

    The button carried a price; this is the server asking the SAME function the
    same question at the moment the money would move — `castPackageRedoOffer`,
    over the projection the room is shown. A second reading in this file is how
    a customer comes to press a priced button and be charged something else.

    The offer answers WHETHER and HOW MUCH; the sentences below answer WHY, read
    off the same two facts the offer walked. Both refusals are free and before
    any claim.
  */
  const offer = castPackageRedoOffer(read, CASTING_V2_PACKAGE_REDO_PRICE_CREDITS);
  if (!offer) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: read.slots.some((slot) => slot.retrying === true)
        /* Something of hers is already being made — the Sign's own claims, or a
           Try again. It is the SENTENCE; the slot locks below are the fact. */
        ? PACKAGE_REDO_BUSY_MESSAGE
        : read.status !== "ready"
          ? PACKAGE_REDO_NOT_READY_MESSAGE
          : PACKAGE_REDO_UNAVAILABLE_MESSAGE,
    });
  }

  /*
    THE VIEWS SHE ACTUALLY HAS, never the five today's profile sells.

    A package is a historical record and the projection already honours it —
    `castProjection` renders the slots this Cast owns, two of which own a
    retired `walk`. ⚠ **The PRICE no longer depends on this list** (his flat
    650 of 2026-10-08), but the RENDER still does: a Cast that owns six slots
    has six redone, and the sheet plan below is built from her own list rather
    than from today's five.
  */
  const angles = read.slots.map((slot) => slot.angle);

  const source = await (dependencies.readSource ?? readCastViewRenderSource)(
    input.userId,
    read.modelId,
  );
  if (!source) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: PACKAGE_REDO_UNAVAILABLE_MESSAGE });
  }

  /*
    HER FACE, FETCHED BEFORE THE FIRST CLAIM — so a Cast whose anchor object has
    gone away is a free refusal rather than a charged press with nothing to hold
    the likeness. The same statement the Try again road makes, for the same
    reason, one view multiplied by her whole package.
  */
  let anchor: { bytes: Buffer; contentType: string };
  try {
    const bytes = await (dependencies.readAnchorBytes ?? storageReadBytes)(source.anchorStorageKey);
    anchor = { bytes: bytes.bytes, contentType: bytes.contentType };
  } catch {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: PACKAGE_REDO_FACE_MISSING_MESSAGE });
  }

  /*
    CAN THEY AFFORD IT? — a free refusal, before any claim, and under the flat
    price this is one number rather than five slices that must not be bought
    separately. The quote is the whole price, which is also the only price
    there is.
  */
  const balance = await (dependencies.readBalance ?? getUserCredits)(input.userId);
  if (!balance || balance.balance < offer.priceCredits) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Not enough credits. Asking for all the views again costs ${formatCredits(displayPrice(offer.priceCredits))} credits.`,
    });
  }

  const begin = dependencies.begin ?? beginDirectOperation;

  /* ---- the press: one row, all the money, and the cast-level lock ---- */

  /*
    ⚠ **THE PRESS IS CLAIMED FIRST AND IT IS THE ONLY ROW THAT CARRIES CREDITS**
    (his flat price, 2026-10-08; the shape the relay settled on PR #1924).

    A flat price cannot be charged five times, and it cannot ride one of the
    five slot rows either: the recovery sweep refunds an unsettled operation's
    planned credits, so a slot holding the whole 3,250 would hand back a whole
    redo whenever THAT slot was the one left unsettled — even with four
    siblings delivered. The press row is the money, the slot rows are the
    pictures, and the sweep can tell them apart by kind.

    It holds the CAST-LEVEL lock (`model:<id>`) while the five slots hold their
    own per-slot keys. One operation holds exactly one key —
    `generation_operation_locks` is unique on `operationId` — which is why the
    five slot locks need five operations, and why the press could not simply
    take them all. What its own key buys is a second press refusing HERE,
    before a slot is taken or a credit moves.

    A SECOND PRESS OF THE SAME BUTTON replays here, before any slot is claimed
    and before any money moves, and is handed back what the first press bought.
  */
  const press = await begin({
    userId: input.userId,
    clientRequestId: input.clientRequestId,
    kind: "castingV2.packageRedoPress",
    /* Bound at the claim, BEFORE any money moves, so the sweep can always ask
       whether a picture landed for this Cast. */
    modelId: read.modelId,
    payload: { castId: input.castId, angles },
    plannedCredits: offer.priceCredits,
    /*
      ⚠ **THE CAST-LEVEL LOCK, AND THIS ROW HELD NONE UNTIL `operationLockWire`
      ASKED FOR ONE.** The rule it enforces is that an operation binding a
      `modelId` holds a lock, and the press binds one because the sweep needs it
      to ask whether any view landed.

      The design note this replaces argued a cast-level key would NOT collide
      with the per-slot keys and was therefore the wrong choice — true, and it
      was an argument against using `model:` INSTEAD of the slot keys. Held
      BESIDE them it buys something real: a second press on the same Cast now
      refuses at this claim, before a slot is taken or a credit moves, rather
      than halfway through claiming five locks.
    */
    lockKey: modelOperationLockKey(read.modelId),
    lockBusyMessage: PACKAGE_REDO_BUSY_MESSAGE,
  });
  if (press.type === "replay") return press.result as PackageRedoResult;
  const pressOperationId = press.operationId;

  /* ---- the claims: all of them, and all of them free ---- */

  const claimed: Array<{ angle: CastViewAngle; operationId: string }> = [];
  try {
    for (const angle of angles) {
      const gate = await begin({
        userId: input.userId,
        /* DERIVED, never minted: the same press replays the same slot
           operations rather than buying a second package (#1903). */
        clientRequestId: derivedClientRequestId(input.clientRequestId, angle),
        kind: "castingV2.packageRedo",
        modelId: read.modelId,
        /*
          ONE SLOT, ONE ASK — the SAME key the Try again takes (#1257).

          This is the whole mutual exclusion between the two roads, and it is
          structural rather than a read: `generation_operation_locks.lockKey` is
          a primary key, so a slot being replaced by one road cannot be claimed
          by the other.
        */
        lockKey: castViewSlotOperationLockKey(read.modelId, angle),
        lockBusyMessage: PACKAGE_REDO_BUSY_MESSAGE,
        payload: castViewRetryClaimPayload({ castId: input.castId, angle }),
        /*
          ⚠ **ZERO, AND THAT IS THE FLAT PRICE'S WHOLE SHAPE.** A slot row
          carries no credits because a slot can no longer be refunded on its
          own: his rule is one price with no per-view refund, and credits come
          back only when nothing could be delivered at all. The sweep reads
          this field to decide what an unsettled row owes — zero is the true
          answer for a slot, and the press row is where the 3,250 lives.
        */
        plannedCredits: 0,
      });
      if (gate.type === "replay") continue;
      claimed.push({ angle, operationId: gate.operationId });
    }
  } catch (error) {
    /*
      ONE CLAIM REFUSED, SO NONE OF THEM HAPPENS — and nothing has been charged,
      because the deduct is below this block. The rows already taken are failed
      free, their locks released, and the press is failed with them.
    */
    for (const { operationId } of claimed) {
      await failClaimedDirectOperation({
        userId: input.userId,
        operationId,
        error: new TRPCError({ code: "CONFLICT", message: PACKAGE_REDO_BUSY_MESSAGE }),
      }).catch(() => undefined);
    }
    await failClaimedDirectOperation({
      userId: input.userId,
      operationId: pressOperationId,
      error: new TRPCError({ code: "CONFLICT", message: PACKAGE_REDO_BUSY_MESSAGE }),
    }).catch(() => undefined);
    throw error;
  }

  /* ---- the press goes running, THEN the one charge ---- */

  /*
    ⚠ **A CLAIMED ROW CANNOT BE SETTLED, AND THIS WAS MISSING UNTIL THE
    SECURITY REVIEW ON PR #1924 ASKED FOR IT.**
    `finalizeGenerationOperationSuccess` updates `WHERE status = 'running'`
    (`server/db/generationOperations.ts`), so a press left `claimed` cannot be
    sealed: its receipt would affect no rows, fall into
    `markRecoveryAfterReceiptFailure`, and park a perfectly good redo for
    support review with the customer's credits in an unsettled state.
    Every slot row below already makes this transition; the press needs it for
    the same reason and one step earlier, because it is the row that is about
    to be charged.

    It passes no `requiredLockKey` here — the press's lock is taken at its
    CLAIM above (`modelOperationLockKey`), which is what refuses a second
    press on one Cast before a slot is taken or a credit moves. ⚠ **This
    paragraph read *"the press holds no lock by design"* until 2026-10-09 and
    was false of its own commit**: the sentence survived from the shape that
    was proposed, and the press took the cast-level lock in the same change
    that added this transition. The lock table being unique on the operation
    id is still why the five slot locks need five operations — it is just not
    a reason for the press to hold none.

    The HEARTBEAT is the point here: a press lives as long as both sheets
    take, which is minutes, and a lease that lapsed under it would hand a live
    redo to the sweep. ⚠ **And a lapsed press lease is no longer a money
    defect as well as a wait** — the slot commit re-proves the press `running`
    inside its own statement (#1903 review finding 1), so a press the sweep
    settled cannot also receive its views.
  */
  try {
    await (dependencies.markRunning ?? markGenerationOperationRunning)({
      userId: input.userId,
      operationId: pressOperationId,
      plannedCredits: offer.priceCredits,
      phase: "generating",
      heartbeat: true,
    });
  } catch (error) {
    /* Nothing is charged yet, so every row unwinds free. */
    log.warn(
      { operationId: pressOperationId, castId: input.castId, err: error },
      "[packageRedoService] the press never started — nothing charged",
    );
    for (const { operationId } of claimed) {
      await failClaimedDirectOperation({ userId: input.userId, operationId, error })
        .catch(() => undefined);
    }
    await failClaimedDirectOperation({ userId: input.userId, operationId: pressOperationId, error })
      .catch(() => undefined);
    throw error;
  }

  const chargeReference = operationChargeReference(pressOperationId);
  const charge = await (dependencies.deduct ?? deductCredits)(
    input.userId,
    offer.priceCredits,
    "generation",
    "Cast package redo (pending)",
    chargeReference,
    { toolKind: "image", engineUsed: "castingV2" },
  );
  if (!charge.success) {
    /*
      The whole price was proved affordable at the admission, so reaching here
      means the balance moved underneath us. Nothing was dispatched: every row
      is failed free and the customer's balance is untouched.
    */
    log.warn(
      { operationId: pressOperationId, castId: input.castId, price: offer.priceCredits },
      "[packageRedoService] the press could not be charged — nothing is rendered",
    );
    for (const { operationId } of claimed) {
      await failClaimedDirectOperation({
        userId: input.userId,
        operationId,
        error: new TRPCError({ code: "BAD_REQUEST", message: PACKAGE_REDO_UNAVAILABLE_MESSAGE }),
      }).catch(() => undefined);
    }
    await failClaimedDirectOperation({
      userId: input.userId,
      operationId: pressOperationId,
      error: new TRPCError({
        code: "BAD_REQUEST",
        message: charge.error
          || `Not enough credits. Asking for all the views again costs ${formatCredits(displayPrice(offer.priceCredits))} credits.`,
      }),
    }).catch(() => undefined);
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: charge.error
        || `Not enough credits. Asking for all the views again costs ${formatCredits(displayPrice(offer.priceCredits))} credits.`,
    });
  }

  /* ---- the sheets: the Sign's own road, not the plate's ---- */

  /*
    ⚠ **A REDO RENDERS THE WAY A SIGN RENDERS, WHICH IT DID NOT UNTIL NOW** —
    the relay's finding on PR #1924, and it is the reason his 650 is the right
    price rather than a loss.

    The road this replaces rendered one wardrobe plate and then five separate
    per-view requests: about $0.90 of engine time where a Sign costs about
    $0.22, with front and back free to disagree because nothing cut them from
    one frame, and with no re-make when a view was refused. #1957 retired that
    road for the Sign; this is the same retirement for the redo.

    What arrives instead is `signSheetPlan` + `settleSignSheet`: two sheets
    rendered in parallel at `quality: "high"`, every panel judged before any of
    them can commit, and ONE house-cost re-make of a sheet whose panel met a
    catastrophe — his #1904 option A, inherited rather than re-implemented.

    ⚠ **The engines are built INSIDE the promise**, as the Sign builds them:
    `castingSignSheetEngine(kind)` throws on a missing `FAL_KEY`, and eagerly in
    the argument list that throw would be synchronous here — after the rows
    exist and the credits are gone, with nothing to refund it. Inside, it is a
    sheet that never arrived, every slot fails, and the press refunds whole.
  */
  const [inkCrops, featureWords] = await Promise.all([
    source.candidatePublicId === null
      ? Promise.resolve({ crops: [] as const })
      : carriedInkCrops({}, {
          userId: input.userId,
          candidatePublicId: source.candidatePublicId,
          anchorDeltas: source.anchorDeltas,
          pronouns: castPronouns(source.technicalSchema),
          operationId: pressOperationId,
          wardrobeLine: castWardrobeLine(source.technicalSchema),
          wardrobeSource: castWardrobeSource(source.technicalSchema),
        }),
    source.candidateId === null
      ? Promise.resolve([])
      : carriedFeatureWords({}, {
          userId: input.userId,
          candidateId: source.candidateId,
          selectedVariantId: source.selectedVariantId,
          operationId: pressOperationId,
        }),
  ]);

  const signSheets = Object.fromEntries(
    signSheetPlan(angles).map((plan) => [
      plan.kind,
      Promise.resolve().then(() => settleSignSheet({
        kind: plan.kind,
        panelOrder: plan.panelOrder,
        render: () => renderSignSheet({
          engine: (dependencies.signSheetEngine ?? castingSignSheetEngine)(plan.kind),
          anchor,
          wardrobeLine: castWardrobeLine(source.technicalSchema),
          description: source.briefText,
          pronouns: castPronouns(source.technicalSchema),
          panelOrder: plan.panelOrder,
          inkCrops: inkCrops.crops,
          featureWords,
          operationId: pressOperationId,
        }),
        judge: (dependencies.judge ?? castingViewConformanceJudge)(),
        anchor,
        pronouns: castPronouns(source.technicalSchema),
        userId: input.userId,
        operationId: pressOperationId,
        ...(dependencies.capture ? { capture: dependencies.capture } : {}),
      })),
    ]),
  ) as Record<SignSheetKind, Promise<SettledSignSheet>>;

  /* ---- the slots, concurrently, each cutting its own panel ---- */

  /*
    ⚠ **`allSettled`, NEVER `all` — #1903's REVIEW FINDING 2.**

    `redoOneView` re-throws when a view goes wrong past its render loop, on
    purpose: the lease goes to the sweep rather than this process sealing a
    receipt it cannot stand behind. Under `Promise.all` that one rejection
    became the whole press's rejection, so a customer whose other views
    rendered and landed was told *"Those views couldn't be asked for again"*
    while the pictures sat on the Cast.
  */
  const settled = await Promise.allSettled(claimed.map(({ angle, operationId }) =>
    redoOneView(dependencies, {
      input,
      read,
      source,
      anchor,
      angle,
      operationId,
      pressOperationId,
      signSheets,
    })));

  const committed: CastViewAngle[] = [];
  const failed: CastViewAngle[] = [];
  settled.forEach((slice, index) => {
    const { angle } = claimed[index]!;
    if (slice.status === "fulfilled" && slice.value === "committed") {
      committed.push(angle);
      return;
    }
    if (slice.status === "rejected") {
      log.error(
        { operationId: claimed[index]!.operationId, castId: input.castId, angle, err: slice.reason },
        "[packageRedoService] a redone view threw past its own settlement — the sweep owns that slice",
      );
    }
    failed.push(angle);
  });

  /* ---- settle the press: his rule, and the only refund on this road ---- */

  /*
    ⚠ **CREDITS COME BACK ONLY WHEN NOTHING COULD BE DELIVERED AT ALL** — his
    word of 2026-10-08, the same sentence that governs the Sign: *"Credits only
    come back if the Sign can't be delivered at all."*

    One view that arrived is a delivered redo. A customer who asked for all her
    views again and received four of them has had the work done; the fifth kept
    the picture she already had, because a redo never leaves a hole. The house
    paid for both sheets either way, which is what the flat price is for.

    The decision itself is {@link flatPressRefundOwed} rather than an `if` here,
    because the recovery sweep has to reach the SAME answer from the rows alone
    and #1968's Sign will ask it too.
  */
  /*
    ⚠ **AND BEFORE IT REFUNDS, IT ASKS THE ROWS** — the security review's
    third finding on PR #1924, and it is working law 1 on a money path: a
    report is a claim, the asset rows are the fact.

    `committed` is what THIS PROCESS believes. A slot that committed its
    picture and then threw past its own settlement — a receipt that would not
    write is the measured route — is counted `failed` here, correctly, because
    this process cannot say otherwise. If that happened to every slot, the
    belief would be "nothing arrived" while five new pictures sat on the Cast,
    and the refund would hand back a redo the customer received.

    So the total-loss branch is confirmed against `pressViewLanded`, the same
    reader the sweep uses, before any credit moves. It is asked ONLY on the
    zero-delivered road, which is rare: a delivered redo pays for no extra
    read.
  */
  let delivered = committed.length;
  if (delivered === 0) {
    try {
      const anythingLanded = await (dependencies.pressLanded ?? pressViewLanded)({
        userId: input.userId,
        modelId: read.modelId,
        pressOperationId,
      });
      if (anythingLanded) {
        delivered = 1;
        log.warn(
          { operationId: pressOperationId, castId: input.castId },
          "[packageRedoService] no slot reported a delivery but a picture is on the Cast — the charge stands",
        );
      }
    } catch (error) {
      /*
        The read failed. ⚠ REFUND ANYWAY, which is the direction this road
        has to fail in: the customer is owed their credits unless a picture
        exists, and a refund that is written twice is caught by the ledger's
        own reference (the sweep READS a refund it finds rather than
        re-issuing it), while a refund never written is money kept for nothing.
      */
      log.error(
        { operationId: pressOperationId, castId: input.castId, err: error },
        "[packageRedoService] could not confirm the delivery before refunding — refunding on this process's own reading",
      );
    }
  }

  const owed = flatPressRefundOwed({
    chargedCredits: offer.priceCredits,
    delivered,
  });
  let refundedCredits = 0;
  let refundRecorded = true;
  if (owed > 0) {
    const refund = await (dependencies.refund ?? recordRefund)(
      input.userId,
      owed,
      "No views arrived when you asked for all of them again",
      chargeReference,
    );
    refundedCredits = refund.recorded && !refund.duplicate ? refund.amount : 0;
    refundRecorded = refund.recorded;
    if (!refund.recorded) {
      log.error(
        { operationId: pressOperationId, castId: input.castId, reference: refund.reference },
        "[packageRedoService] the redo refund did not record — the owner remains charged",
      );
    }
  }

  const result: PackageRedoResult = {
    castId: input.castId,
    committed,
    failed,
    chargedCredits: offer.priceCredits,
    refundedCredits,
    refundRecorded,
  };
  await completeDirectOperationSuccess({
    userId: input.userId,
    operationId: pressOperationId,
    result,
    chargedCredits: offer.priceCredits,
    refundedCredits,
  });
  log.info(
    {
      operationId: pressOperationId,
      castId: input.castId,
      committed: committed.length,
      failed: failed.length,
      refundedCredits,
    },
    "[packageRedoService] a redo settled",
  );
  return result;
}

/**
 * ONE SLOT OF A REDO — running, cut the panel, land, settle.
 *
 * ⚠ **IT MOVES NO MONEY ANY MORE, and that is the flat price's whole shape.**
 * It used to deduct its own slice and refund it when the view did not arrive.
 * Under his rule of 2026-10-08 a slot has no slice: the press charged once, and
 * credits come back only when NOTHING was delivered — a decision no single slot
 * can make, because it cannot see its siblings. So this function answers one
 * question and returns one word.
 *
 * Its own function because every exit has to settle its own operation: the
 * slots run concurrently and none of them may leave another's row unsettled.
 */
async function redoOneView(
  dependencies: PackageRedoServiceDependencies,
  context: {
    input: PackageRedoInput;
    read: CastSlotsRead;
    source: NonNullable<Awaited<ReturnType<typeof readCastViewRenderSource>>>;
    anchor: { bytes: Buffer; contentType: string };
    angle: CastViewAngle;
    operationId: string;
    /** The row that holds the money — written into the picture's provenance so
     *  the sweep can ask whether ANY view of this press landed. */
    pressOperationId: string;
    signSheets: Record<SignSheetKind, Promise<SettledSignSheet>>;
  },
): Promise<"committed" | "failed"> {
  const { input, read, source, anchor, angle, operationId, pressOperationId } = context;
  const slotLockKey = castViewSlotOperationLockKey(read.modelId, angle);

  try {
    await (dependencies.markRunning ?? markGenerationOperationRunning)({
      userId: input.userId,
      operationId,
      /* Zero for the slot, as at the claim: the press is where the credits are. */
      plannedCredits: 0,
      phase: "generating",
      heartbeat: true,
      /* Re-proved at the transition, the way every other lock-taking road does
         it: the render starts on the next statement, so "do we still hold the
         slot" is asked once more immediately before it. */
      requiredLockKey: slotLockKey,
    });
  } catch (error) {
    log.warn(
      { operationId, castId: input.castId, angle, err: error },
      "[packageRedoService] this view never started",
    );
    await failClaimedDirectOperation({ userId: input.userId, operationId, error })
      .catch(() => undefined);
    return "failed";
  }

  const commit = dependencies.commitRetried ?? commitRetriedViewAsset;
  let rendered: Awaited<ReturnType<typeof renderViewAttempts<{ assetId: number; url: string }>>>;
  try {
    rendered = await renderViewAttempts(
      dependencies,
      {
        userId: input.userId,
        operationId,
        modelId: read.modelId,
        identityRevisionId: source.identityRevisionId,
        identityText: source.identityText,
        anchor,
        pronouns: castPronouns(source.technicalSchema),
        wardrobeLine: castWardrobeLine(source.technicalSchema),
        /* The SAME words the original views were composed from (#1278 part 1).
           Without this a redo renders a different prompt from the slots it
           replaces. */
        description: source.briefText,
        /*
          ⚠ **THE PICTURE IS A PANEL, NOT A REQUEST.** With the sheets in hand
          this loop calls no image engine at all: it cuts this angle's panel out
          of its already-judged sheet. The ink crops and the feature words rode
          into the SHEET's composition above, once for every panel on it, rather
          than per view — which is what makes the five views of a redo agree
          with each other.
        */
        signSheets: context.signSheets,
        /* ⚠ NO `castName`: `CastSlotsRead` does not carry one, so a refusal on
           this road says "this character" exactly as it did before the sheets
           arrived. Widening that read to make one refusal sentence warmer is a
           change to the room's projection, not part of this repair. */
      },
      angle,
      async (landed) => {
        const assetId = await commit({
          userId: input.userId,
          operationId,
          modelId: read.modelId,
          angle,
          storageKey: landed.stored.key,
          storageUrl: landed.stored.url,
          identityRevisionId: source.identityRevisionId,
          identityText: source.identityText,
          /* The picture cost nothing of its own: the press paid once. */
          pointsCost: 0,
          /*
            ⚠ **THE FENCE, AND IT IS WHY THIS ID IS PASSED TWICE (#1903 review
            finding 1).** Named here, the commit's own statement refuses to
            land this picture unless the press row holding the money is still
            `running` — so a press the sweep has already refunded cannot also
            receive its views. In `provenance` below it is the sweep's fork
            variable, read back off the asset rows hours later. Two different
            jobs for one id, and the fence must be the typed one.
          */
          pressOperationId,
          provenance: {
            /* THE ROAD, and it is the only field that says which one this was. */
            source: "castingV2.packageRedo",
            /*
              The fork variable the sweep reads for ONE SLOT, deliberately the
              same key the Try again writes: `retriedViewLanded` asks "did a
              picture land under this operation", which is the right question on
              both roads.
            */
            retryOperationId: operationId,
            /*
              ⚠ **AND THE PRESS, WHICH IS WHAT THE FLAT PRICE NEEDED.** The
              money is on the press row, so the sweep's question about MONEY is
              *did any view of this press land* — and this field is the only
              thing that can answer it from the asset rows alone.
              `pressViewLanded` reads exactly this.
            */
            pressOperationId,
            ...landed.provenance,
            ...conformanceProvenance(landed.verdict),
          },
        });
        return assetId === null ? null : { assetId, url: landed.stored.url };
      },
    );
  } catch (error) {
    /*
      A throw past the render loop is a view nobody settled. Hand the lease to
      the sweep rather than sealing a receipt this process cannot stand behind.
    */
    log.error(
      { operationId, castId: input.castId, angle, err: error },
      "[packageRedoService] the redone view threw past its loop — the sweep owns it",
    );
    throw error;
  }

  if (rendered.status === "landed") {
    log.info(
      { operationId, castId: input.castId, angle },
      "[packageRedoService] a redone view arrived",
    );
    await completeDirectOperationSuccess({
      userId: input.userId,
      operationId,
      result: { castId: input.castId, angle, outcome: "ready" },
      chargedCredits: 0,
      refundedCredits: 0,
    });
    return "committed";
  }

  if (rendered.status === "fenced") {
    /*
      FENCED — this operation is no longer ours: its bytes were dropped by the
      loop. Hand the lease to the sweep and let it read the asset rows, which is
      where #1903's first review finding landed. ⚠ It settles no receipt here,
      and under the flat price it owes no refund either way: the press is the
      only row that can give credits back.
    */
    log.warn(
      { operationId, castId: input.castId, angle },
      "[packageRedoService] the redone view lost its fence — handing the lease to the sweep",
    );
    await (dependencies.handoffToRecovery ?? handoffGenerationOperationToRecovery)({
      userId: input.userId,
      operationId,
    })
      .catch((handoffError: unknown) => {
        log.warn(
          { operationId, castId: input.castId, angle, err: handoffError },
          "[packageRedoService] the recovery handoff did not write — the lease lapses on its own",
        );
      });
    return "failed";
  }

  /*
    It did not arrive. The slot is exactly what it was — the picture the
    customer already had is still in it, which is the whole reason a redo cannot
    leave a hole. ⚠ **No refund here**: whether anything is owed is a question
    about the PRESS, decided once all the slots have settled.
  */
  await completeDirectOperationSuccess({
    userId: input.userId,
    operationId,
    result: { castId: input.castId, angle, outcome: "failed" },
    chargedCredits: 0,
    refundedCredits: 0,
  });
  return "failed";
}
