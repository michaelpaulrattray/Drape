/**
 * REDO THE WHOLE PACKAGE — every view of a signed Cast rendered again, for a
 * customer who simply does not like what arrived (#1903 slice 2).
 *
 * **His ruling, verbatim (2026-10-07):** *"maybe we should allow retry by
 * default incase they didnt like the outfit that was invented or whatever but
 * it costs per retry and regens all views not just one"*. And his price, asked
 * and answered the same sitting: ***"350"*** display credits.
 *
 * **No fault has to be found first, and that is the feature.** Every other road
 * to a second render on this Cast is a remedy — a view that failed was
 * refunded, a view nobody checked is owed a free look. This one answers a
 * question no machine can: *is this the person I was trying to cast?* So there
 * is no eligibility to compute, no verdict to consult and no free branch; the
 * only questions are whether she is ready to be asked (below) and whether the
 * customer can afford it.
 *
 * # One press, five operations, and the reason is the refund
 *
 * His card keeps the catastrophic refund rule unchanged, and that rule gives
 * back **one view**. So the unit that can fail has to be the unit that is
 * charged: **1,750 ledger = 5 × 350**, each view its own refundable slice at
 * 70 display — a whole display number, which is the property the Sign's own
 * decomposition was chosen for. A view that does not arrive refunds its slice
 * and leaves the picture the customer already holds in that slot, so a redo
 * never lands a hole.
 *
 * ⚠ **WHAT THAT COSTS, named rather than discovered: in a partial failure the
 * package is briefly MIXED** — four views in the new outfit beside one in the
 * old — which is the one thing a redo exists to avoid. The alternative is
 * all-or-nothing, which spends house money on renders nobody receives and
 * hands the customer nothing new for a charge they then watch come back.
 * Per-slice is the lesser of the two and it is the pattern every other
 * multi-output road here already takes.
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
import { CASTING_V2_PACKAGE_REDO_VIEW_PRICE_CREDITS } from "../casting/castingCreditCosts";
import {
  beginDirectOperation,
  completeDirectOperationSuccess,
  failClaimedDirectOperation,
} from "../casting/directOperation";
import {
  castViewRetryClaimPayload,
  castViewSlotOperationLockKey,
  derivedClientRequestId,
  operationChargeReference,
} from "../casting/operationContract";
import { commitRetriedViewAsset, readCastViewRenderSource } from "../db/castingV2ViewRetry";
import { getUserCredits } from "../db/credits";
import { deductCredits } from "../db/credits";
import { markGenerationOperationRunning } from "../db/generationOperations";
import { createModuleLogger } from "../logging/logger";
import { storageReadBytes } from "../storage";
import { castPronouns } from "./castPronouns";
import { castPackageView } from "./castViewPackage";
import {
  PLATE_ANGLES,
  plateSideFor,
  renderOutfitPlate,
  type OutfitPlate,
} from "./outfitPlate";
import {
  renderViewAttempts,
  type PackageOrchestratorDependencies,
} from "./packageOrchestrator";
import { carriedFeatureWords, carriedInkCrops } from "./signService";
import { castingOutfitPlateEngine } from "./signEngine";
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
  readSource?: typeof readCastViewRenderSource;
  readAnchorBytes?: typeof storageReadBytes;
  /**
   * THE BALANCE, AND ONLY THE BALANCE.
   *
   * Narrower than `typeof getUserCredits` on purpose: that function returns the
   * whole credits row — nineteen columns including the plan tier and the Stripe
   * customer id — and a seam typed as the row forces every arm that wants to
   * say *this customer has 349 credits* to build a plan, two dates and a
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
  "This Cast is still being made. You can ask for all her views again once she's finished. Nothing was charged.";
export const PACKAGE_REDO_BUSY_MESSAGE =
  "Some of her views are already being made. Wait for those to finish, then ask again. Nothing was charged.";
export const PACKAGE_REDO_UNAVAILABLE_MESSAGE =
  "This Cast can't be asked for new views right now. Nothing was charged.";
export const PACKAGE_REDO_FACE_MISSING_MESSAGE =
  "This Cast's signed face isn't available right now, so her views can't be rebuilt. Nothing was charged.";

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
    a customer comes to press a 350-credit button and be charged something else.

    The offer answers WHETHER and HOW MUCH; the sentences below answer WHY, read
    off the same two facts the offer walked. Both refusals are free and before
    any claim.
  */
  const offer = castPackageRedoOffer(read, CASTING_V2_PACKAGE_REDO_VIEW_PRICE_CREDITS);
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
    retired `walk`. The offer priced those same slots, so the charge below and
    the number on the button are the same arithmetic over the same list.
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
    gone away is a free refusal rather than five charged renders with nothing to
    hold the likeness. The same statement the Try again road makes, for the same
    reason, one view multiplied by five.
  */
  let anchor: { bytes: Buffer; contentType: string };
  try {
    const bytes = await (dependencies.readAnchorBytes ?? storageReadBytes)(source.anchorStorageKey);
    anchor = { bytes: bytes.bytes, contentType: bytes.contentType };
  } catch {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: PACKAGE_REDO_FACE_MISSING_MESSAGE });
  }

  /*
    CAN THEY AFFORD THE WHOLE THING? — a free refusal, before any claim.

    ⚠ **This read exists because the charge is five deducts and a redo must not
    be able to buy PART of a package.** Without it, a customer holding 210
    display credits would get three new views, a failure on the fourth, and a
    mixed package they did not ask for. With it, the only way to reach that
    state is a balance that moves between this statement and the deducts — and
    nothing else can be spending against this Cast, because the five slot locks
    are ours by then.

    **The number quoted is the whole price**, not a slice: a customer told "you
    need 70 credits" for a 350-credit button would top up and be refused again.
  */
  const balance = await (dependencies.readBalance ?? getUserCredits)(input.userId);
  if (!balance || balance.balance < offer.priceCredits) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Not enough credits. Asking for all her views again costs ${formatCredits(displayPrice(offer.priceCredits))} credits.`,
    });
  }

  /* ---- the claims: all of them, and all of them free ---- */

  const begin = dependencies.begin ?? beginDirectOperation;
  const claimed: Array<{ angle: CastViewAngle; operationId: string }> = [];
  const replayed: PackageRedoResult[] = [];
  try {
    for (const angle of angles) {
      const gate = await begin({
        userId: input.userId,
        /* DERIVED, never minted: the same press replays the same five
           operations rather than buying a second package (#1903). */
        clientRequestId: derivedClientRequestId(input.clientRequestId, angle),
        kind: "castingV2.packageRedo",
        /* Bound at the claim, BEFORE any money moves, so the sweep can always
           ask whether a picture landed for this Cast. */
        modelId: read.modelId,
        /*
          ONE SLOT, ONE ASK — the SAME key the Try again takes (#1257).

          This is the whole mutual exclusion between the two roads, and it is
          structural rather than a read: `generation_operation_locks.lockKey` is
          a primary key, so a slot being replaced by one road cannot be claimed
          by the other. A cast-level `model:` key would have been the tempting
          choice for a whole-package operation and it would NOT have collided
          with the per-slot keys at all — two roads could then have rendered the
          same slot concurrently, and the later commit would silently throw away
          a picture the customer paid for.
        */
        lockKey: castViewSlotOperationLockKey(read.modelId, angle),
        lockBusyMessage: PACKAGE_REDO_BUSY_MESSAGE,
        /* THE SAME SHAPE THE TRY AGAIN CLAIMS WITH — "this Cast, this view" is
           exactly what this operation is about, and the busy read hashes this
           builder per angle for both kinds. The KIND is what distinguishes the
           roads, never the payload. */
        payload: castViewRetryClaimPayload({ castId: input.castId, angle }),
        /* What this slice costs, written where the row is born (#1767). Never
           zero on this road: a redo is never free, which is his own clause. */
        plannedCredits: CASTING_V2_PACKAGE_REDO_VIEW_PRICE_CREDITS,
      });
      if (gate.type === "replay") {
        replayed.push(gate.result as PackageRedoResult);
        continue;
      }
      claimed.push({ angle, operationId: gate.operationId });
    }
  } catch (error) {
    /*
      ONE CLAIM REFUSED, SO NONE OF THEM HAPPENS.

      Nothing has been charged — a claim moves no money — so the rows already
      taken are failed free and their locks released, and the customer meets the
      refusal with their balance untouched. Each settle is awaited and its own
      throw swallowed: `failClaimedDirectOperation` always throws (it is the
      road that reports a failure to a caller), and the error that matters here
      is the FIRST one, not the five receipts.
    */
    for (const { operationId } of claimed) {
      await failClaimedDirectOperation({
        userId: input.userId,
        operationId,
        error: new TRPCError({
          code: "CONFLICT",
          message: PACKAGE_REDO_BUSY_MESSAGE,
        }),
      }).catch(() => undefined);
    }
    throw error;
  }

  /*
    EVERY ANGLE WAS A REPLAY — the same press arriving twice. Return what it
    bought the first time rather than a second package.
  */
  if (claimed.length === 0 && replayed.length > 0) {
    return mergeRedoResults(input.castId, replayed);
  }

  /* ---- one fresh plate, for the two views that wear one ---- */

  /*
    THE PLATE STARTS NOW AND ONLY THE FULL-LENGTH PAIR WAITS FOR IT — the Sign's
    own schedule (#1278 path E), because this is the Sign's own road.

    ⚠ **The engine is built INSIDE the promise, not in the argument list.**
    `castingOutfitPlateEngine()` throws on a missing `FAL_KEY` — the door's own
    refusal, and the right one — and built eagerly that throw would be
    synchronous here, after five rows exist and before anything could refuse or
    refund them. Wrapped, it lands in the catch and the redo renders
    master-only, which is what a missing plate is supposed to cost.
  */
  const plateOperationId = claimed[0]?.operationId ?? input.clientRequestId;
  const plate: Promise<OutfitPlate | null> = Promise.resolve()
    .then(() => renderOutfitPlate({
      engine: (dependencies.outfitPlateEngine ?? castingOutfitPlateEngine)(),
      /* #1471, his ruling: the plate EDITS the master. The same anchor the
         views render from, so the plate cannot come to be of a different
         picture than the views it dresses. */
      anchor,
      wardrobeLine: castWardrobeLine(source.technicalSchema),
      description: source.briefText,
      pronouns: castPronouns(source.technicalSchema),
      operationId: plateOperationId,
    }))
    .catch((error: unknown) => {
      log.warn(
        {
          operationId: plateOperationId,
          castId: input.castId,
          err: error instanceof Error ? error.message : String(error),
        },
        "[packageRedoService] the wardrobe plate threw — the full-length views render from the master alone",
      );
      return null;
    });

  /* ---- the renders, concurrently, each settling its own slice ---- */

  const outcomes = await Promise.all(claimed.map(({ angle, operationId }) =>
    redoOneView(dependencies, {
      input,
      read,
      source,
      anchor,
      angle,
      operationId,
      plate,
      packagePrice: offer.priceCredits,
    })));

  return mergeRedoResults(input.castId, [...replayed, ...outcomes]);
}

/**
 * Fold the per-view settlements into the one receipt the room is handed.
 *
 * Exported shape, private arithmetic: `refundRecorded` is ANDed because the
 * client's sentence turns on it, and one unwritten refund has to make the whole
 * receipt say so rather than being averaged away by four that worked.
 */
function mergeRedoResults(
  castId: string,
  parts: readonly PackageRedoResult[],
): PackageRedoResult {
  return {
    castId,
    committed: parts.flatMap((part) => part.committed),
    failed: parts.flatMap((part) => part.failed),
    chargedCredits: parts.reduce((sum, part) => sum + part.chargedCredits, 0),
    refundedCredits: parts.reduce((sum, part) => sum + part.refundedCredits, 0),
    refundRecorded: parts.every((part) => part.refundRecorded),
  };
}

/**
 * ONE VIEW OF A REDO — running, deduct, render, land, settle.
 *
 * Its own function because every exit has to settle its own operation and its
 * own slice: five of these run concurrently and none of them may be able to
 * leave another's money unsettled.
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
    plate: Promise<OutfitPlate | null>;
    /** The WHOLE package price, for the one sentence that must quote it: a
     *  customer told "you need 70 credits" for a 350-credit button would top up
     *  and be refused again. */
    packagePrice: number;
  },
): Promise<PackageRedoResult> {
  const { input, read, source, anchor, angle, operationId } = context;
  const price = CASTING_V2_PACKAGE_REDO_VIEW_PRICE_CREDITS;
  const view = castPackageView(angle);
  const slotLockKey = castViewSlotOperationLockKey(read.modelId, angle);

  /** This slice failed and nothing is owed back — it never charged. */
  const freeFailure = (): PackageRedoResult => ({
    castId: input.castId,
    committed: [],
    failed: [angle],
    chargedCredits: 0,
    refundedCredits: 0,
    refundRecorded: true,
  });

  try {
    await (dependencies.markRunning ?? markGenerationOperationRunning)({
      userId: input.userId,
      operationId,
      plannedCredits: price,
      phase: "generating",
      heartbeat: true,
      /* Re-proved at the transition, the way every other lock-taking road does
         it: the money moves on the next statement, so "do we still hold the
         slot" is asked once more immediately before it. */
      requiredLockKey: slotLockKey,
    });
  } catch (error) {
    log.warn(
      { operationId, castId: input.castId, angle, err: error },
      "[packageRedoService] this view never started — nothing charged for it",
    );
    await failClaimedDirectOperation({ userId: input.userId, operationId, error })
      .catch(() => undefined);
    return freeFailure();
  }

  /* ---- the pinned deduct ---- */

  const charge = await (dependencies.deduct ?? deductCredits)(
    input.userId,
    price,
    "generation",
    `Cast package redo: ${view.label} (pending)`,
    operationChargeReference(operationId),
    { toolKind: "image", engineUsed: "castingV2" },
  );
  if (!charge.success) {
    /*
      Nothing was dispatched for this view, so nothing is owed back for it. The
      whole price was proved affordable at the admission, so reaching here means
      the balance moved underneath us — the other slices stand on their own and
      this one is simply not rendered.
    */
    log.warn(
      { operationId, castId: input.castId, angle, price },
      "[packageRedoService] the slice could not be charged — this view is not rendered",
    );
    await failClaimedDirectOperation({
      userId: input.userId,
      operationId,
      error: new TRPCError({
        code: "BAD_REQUEST",
        message: charge.error
          || `Not enough credits. Asking for all her views again costs ${formatCredits(displayPrice(context.packagePrice))} credits.`,
      }),
    }).catch(() => undefined);
    return freeFailure();
  }

  /* ---- the render: the Sign's own loop, with our landing ---- */

  const commit = dependencies.commitRetried ?? commitRetriedViewAsset;
  let rendered: Awaited<ReturnType<typeof renderViewAttempts<{ assetId: number; url: string }>>>;
  try {
    /*
      WHAT TRAVELS BESIDE THE ANCHOR, RE-DERIVED BY THE SIGN'S OWN TWO READERS.

      Her delivered ink crops and her carried feature words are what make a view
      of THIS woman rather than of the waist-up photograph. Both are called here
      — never re-implemented — because a redone view that silently lost her
      tattoos would be the fidelity law's exact failure, on a road the customer
      has just paid to put right.
    */
    const [inkCrops, featureWords] = await Promise.all([
      source.candidatePublicId === null
        ? Promise.resolve({ crops: [] as const })
        : carriedInkCrops({}, {
            userId: input.userId,
            candidatePublicId: source.candidatePublicId,
            anchorDeltas: source.anchorDeltas,
            pronouns: castPronouns(source.technicalSchema),
            operationId,
            wardrobeLine: castWardrobeLine(source.technicalSchema),
            wardrobeSource: castWardrobeSource(source.technicalSchema),
          }),
      source.candidateId === null
        ? Promise.resolve([])
        : carriedFeatureWords({}, {
            userId: input.userId,
            candidateId: source.candidateId,
            selectedVariantId: source.selectedVariantId,
            operationId,
          }),
    ]);

    /*
      THE PLATE PANEL CUT FOR THIS VIEW, or nothing at all.

      Only the two full-length views wear one, and a plate that did not land
      leaves them rendering master-only — the input every view composed before
      path E existed, field for field.
    */
    const plateAngle = (PLATE_ANGLES as readonly CastViewAngle[]).includes(angle)
      ? (angle as (typeof PLATE_ANGLES)[number])
      : null;
    const settledPlate = plateAngle === null ? null : await context.plate;
    const side = plateAngle === null ? null : plateSideFor(plateAngle);

    rendered = await renderViewAttempts(
      dependencies,
      {
        ...(settledPlate !== null && side !== null
          ? { outfitReference: { image: settledPlate[side], side, kind: "plate" as const } }
          : {}),
        userId: input.userId,
        operationId,
        modelId: read.modelId,
        identityRevisionId: source.identityRevisionId,
        identityText: source.identityText,
        anchor,
        inkCrops: inkCrops.crops,
        pronouns: castPronouns(source.technicalSchema),
        featureWords,
        wardrobeLine: castWardrobeLine(source.technicalSchema),
        /* The SAME words the original five views were composed from (#1278 part
           1). Without this a redo renders a different prompt from the slots it
           replaces. */
        description: source.briefText,
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
          pointsCost: price,
          provenance: {
            /* THE ROAD, and it is the only field that says which one this was.
               The kind on the operation row is its sibling; between them a
               later reader can always separate a redo from a customer asking
               for one view again. */
            source: "castingV2.packageRedo",
            /*
              The fork variable the sweep reads, and it is deliberately the
              SAME key the Try again writes: `retriedViewLanded` asks "did a
              picture land under this operation", which is the right question
              on both roads. Renaming it would mean rewriting the provenance of
              every view ever retried to teach the adjudicator one new word.
            */
            retryOperationId: operationId,
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
      the sweep rather than sealing a receipt this process cannot stand behind —
      it reads the ledger and the asset rows and reaches the right answer
      without trusting anything believed here.
    */
    log.error(
      { operationId, castId: input.castId, angle, err: error },
      "[packageRedoService] the redone view threw past its loop — the sweep owns it",
    );
    throw error;
  }

  /* ---- settle ---- */

  if (rendered.status === "landed") {
    log.info(
      { operationId, castId: input.castId, angle, price },
      "[packageRedoService] a redone view arrived",
    );
    const result: PackageRedoResult = {
      castId: input.castId,
      committed: [angle],
      failed: [],
      chargedCredits: price,
      refundedCredits: 0,
      refundRecorded: true,
    };
    await completeDirectOperationSuccess({
      userId: input.userId,
      operationId,
      result,
      chargedCredits: price,
      refundedCredits: 0,
    });
    return result;
  }

  if (rendered.status === "fenced") {
    /*
      FENCED: this operation is no longer running, so a sweep owns its money and
      its bytes were already dropped by the loop. Nothing is refunded here —
      refunding under a reference the sweep is about to use is how one failure
      becomes two refunds. The receipt says charged-and-not-refunded because
      that is the true state of the ledger at this instant.
    */
    log.warn(
      { operationId, castId: input.castId, angle },
      "[packageRedoService] the redone view lost its fence — recovery owns it",
    );
    const result: PackageRedoResult = {
      castId: input.castId,
      committed: [],
      failed: [angle],
      chargedCredits: price,
      refundedCredits: 0,
      /* Not a refund that failed to write — a refund this exit deliberately
         does not attempt. Said as `true` would claim the money is back. */
      refundRecorded: false,
    };
    await completeDirectOperationSuccess({
      userId: input.userId,
      operationId,
      result,
      chargedCredits: price,
      refundedCredits: 0,
    });
    return result;
  }

  /*
    It did not arrive. The slot is exactly what it was — the picture the
    customer already had is still in it, which is the whole reason a redo cannot
    leave a hole, and this slice goes back.
  */
  const refund = await (dependencies.refund ?? recordRefund)(
    input.userId,
    price,
    `Cast package redo: ${view.label} didn't arrive`,
    operationChargeReference(operationId),
  );
  const refunded = refund.recorded && !refund.duplicate ? refund.amount : 0;
  if (!refund.recorded) {
    log.error(
      { operationId, castId: input.castId, angle, reference: refund.reference },
      "[packageRedoService] the redo refund did not record — the owner remains charged",
    );
  }
  const result: PackageRedoResult = {
    castId: input.castId,
    committed: [],
    failed: [angle],
    chargedCredits: price,
    refundedCredits: refunded,
    refundRecorded: refund.recorded,
  };
  await completeDirectOperationSuccess({
    userId: input.userId,
    operationId,
    result,
    chargedCredits: price,
    refundedCredits: refunded,
  });
  return result;
}
