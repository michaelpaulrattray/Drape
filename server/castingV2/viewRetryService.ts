/**
 * TRY AGAIN — one view of a signed Cast, asked for again (#1208 slice 2,
 * #1220 slice 2).
 *
 * **His rule, verbatim (2026-09-25): *"you pay 50 for each view you keep."***
 *
 * One tile, one button, two prices, and the price is the only thing that
 * differs between the two roads:
 *
 * - A view that FAILED was refunded, so it has cost nothing. Asking again is
 *   an ordinary paid view. His words: *"If they recieved a refund of
 *   50credits trying again deducts another 50cr. its not completely free"*.
 * - A view that arrived UNJUDGED was charged and kept — nobody looked at it
 *   (D-246), and the honest price for that is nothing. His words: *"go with
 *   the free try again"*.
 *
 * Which of the two a slot is on is NOT decided here. `castSlotRetryOffer`
 * decides it, from the same projection the room is shown, so the price on the
 * button and the price at the till are one reading (working law 4). A second
 * opinion in this file is how a customer comes to press a free button and be
 * charged.
 *
 * # The money order, and it is the house's
 *
 *   admit (free) → claim → running → pinned deduct → render → land → settle
 *
 * **Charged at dispatch, refunded when it does not arrive** — `retryService`'s
 * order, `signService`'s order, the package's order. The customer-visible
 * outcome is his sentence exactly (you pay only for views you keep); what this
 * ordering buys is that a view can never be delivered to somebody whose
 * balance moved while it rendered. Everything before the claim is free and
 * says why.
 *
 * # What the picture is
 *
 * Composed and judged by `renderViewAttempts` — the Sign's own loop, called
 * rather than copied. A retried view carries her delivered ink crops, her
 * carried feature words and her snapshotted outfit because that function does;
 * a second composition here would drift, and the drift would be a customer's
 * tattoos quietly missing from the one view they paid twice to get right.
 */
import { TRPCError } from "@trpc/server";

import type { CastViewAngle } from "../../shared/boardTypes";
import { recordRefund } from "../casting/atomicCredits";
import {
  beginDirectOperation,
  completeDirectOperationFailure,
  completeDirectOperationSuccess,
  failClaimedDirectOperation,
} from "../casting/directOperation";
import {
  castViewRetryClaimPayload,
  castViewSlotOperationLockKey,
  operationChargeReference,
} from "../casting/operationContract";
import { deductCredits } from "../db/credits";
import {
  commitRetriedViewAsset,
  listRunningViewRetryAngles,
  readCastViewRenderSource,
} from "../db/castingV2ViewRetry";
import {
  getCastLineage,
  getOwnedCastByPublicId,
  listCastAssets,
  listCastPromisedAngles,
} from "../db/castingV2Sign";
import { markGenerationOperationRunning } from "../db/generationOperations";
import { createModuleLogger } from "../logging/logger";
import { storageDelete, storageReadBytes } from "../storage";
import { castPronouns } from "./castPronouns";
import { castSlotRetryOffer, projectSignedCast } from "./castProjection";
import { CAST_PACKAGE_VIEW_PRICE, castPackageView } from "./castViewPackage";
import {
  renderViewAttempts,
  type PackageOrchestratorDependencies,
} from "./packageOrchestrator";
import { carriedFeatureWords, carriedInkCrops } from "./signService";
import { conformanceProvenance } from "./viewConformance";
import { assertNotFrozen } from "./spendGuards";
import { castWardrobeLine, castWardrobeSource } from "./wardrobeLine";

const log = createModuleLogger("castingV2/viewRetryService");

export type ViewRetryServiceDependencies = PackageOrchestratorDependencies & {
  begin?: typeof beginDirectOperation;
  markRunning?: typeof markGenerationOperationRunning;
  deduct?: typeof deductCredits;
  commitRetried?: typeof commitRetriedViewAsset;
  readSource?: typeof readCastViewRenderSource;
  readAnchorBytes?: typeof storageReadBytes;
  /** What the room would show right now — the authority on what may be asked
   *  for again, injected so a test drives the decision rather than a fixture
   *  of it. */
  readSlots?: (userId: number, castPublicId: string) => Promise<CastSlotsRead | null>;
};

export type CastSlotsRead = {
  modelId: number;
  slots: ReturnType<typeof projectSignedCast>["slots"];
};

export type ViewRetryInput = {
  userId: number;
  clientRequestId: string;
  castId: string;
  angle: CastViewAngle;
};

export type ViewRetryResult = {
  castId: string;
  angle: CastViewAngle;
  outcome: "ready" | "failed";
  /** The picture, when one arrived. Null on a failure — the room re-reads. */
  url: string | null;
  chargedCredits: number;
  refundedCredits: number;
  /** Truthful even when it went wrong: a refund that did not record is never
   *  reported as "you weren't charged". */
  refundRecorded: boolean;
};

export const VIEW_RETRY_NOTHING_TO_ASK_MESSAGE =
  "That view isn't one you can ask for again. Nothing was charged.";

/**
 * A SECOND PRESS ON A VIEW ALREADY BEING MADE — free, and it says which of the
 * two refusals it is (#1235).
 *
 * The refusal itself is not decided here: the slot is `building` while its
 * retry runs, `castSlotRetryOffer` answers nothing for anything that is not
 * finished, and the entrance falls into the same free exit it has always had.
 * What this constant changes is the SENTENCE, because the two facts are
 * different for the person reading them — "you cannot ask for that one" is
 * wrong about a view that is being made right now, and a customer who has just
 * pressed a button is owed the reason it did nothing.
 *
 * ⚠ **His third report is why it exists at all**: leave the room mid-retry and
 * come back, and until #1235 the tile offered the button again — a second press
 * claimed under a new request id, deducted a second 50, and rendered a second
 * picture into one slot. Nothing refused it, because nothing asked.
 */
export const VIEW_RETRY_ALREADY_ASKING_MESSAGE =
  "That view is already being asked for. Nothing was charged.";

/**
 * What the room would show for this Cast right now.
 *
 * The SAME reads and the SAME projection `getCast` runs, minus the siblings —
 * because the authority on "may this view be asked for again" has to be the
 * thing the customer is looking at. Deriving it any other way is the parallel
 * copy working law 4 forbids, on a surface where the copy's drift is a wrong
 * price.
 */
async function readCastSlots(userId: number, castPublicId: string): Promise<CastSlotsRead | null> {
  const model = await getOwnedCastByPublicId(userId, castPublicId);
  if (!model) return null;
  const [assets, lineage, promisedAngles, retryingAngles] = await Promise.all([
    listCastAssets(userId, model.id),
    getCastLineage(userId, model),
    listCastPromisedAngles(userId, model.id),
    /* WHAT IS ALREADY BEING ASKED FOR (#1235). The room reads this too, from
       the same statement, which is what makes a slot's Try again disappear and
       this entrance refuse for the same reason at the same moment. */
    listRunningViewRetryAngles({ userId, modelId: model.id, castId: castPublicId }),
  ]);
  const projection = projectSignedCast({ model, assets, lineage, promisedAngles, retryingAngles });
  return { modelId: model.id, slots: projection.slots };
}

export async function retryCastView(
  dependencies: ViewRetryServiceDependencies,
  input: ViewRetryInput,
): Promise<ViewRetryResult> {
  await assertNotFrozen(input.userId);

  /* ---- admission: every refusal here is free and before the claim ---- */

  const read = await (dependencies.readSlots ?? readCastSlots)(input.userId, input.castId);
  if (!read) throw new TRPCError({ code: "NOT_FOUND", message: "Cast not found" });

  const slot = read.slots.find((candidate) => candidate.angle === input.angle);
  if (!slot) {
    throw new TRPCError({ code: "NOT_FOUND", message: VIEW_RETRY_NOTHING_TO_ASK_MESSAGE });
  }
  /*
    THE OFFER IS RE-READ HERE, NOT TRUSTED FROM THE CLIENT.

    The button carried a price; this is the server asking the same function the
    same question at the moment the money would move. A slot that has since
    been filled — by a sweep, by another tab — offers nothing, and the answer
    is a free refusal rather than a second picture nobody asked for.
  */
  const offer = castSlotRetryOffer(slot, CAST_PACKAGE_VIEW_PRICE);
  if (!offer) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      /* ONE refusal, two sentences. The slot's own state decided the refusal a
         line above; this only reads back WHY, so a customer who pressed twice
         is told what is happening rather than that it is impossible (#1235). */
      message: slot.retrying === true
        ? VIEW_RETRY_ALREADY_ASKING_MESSAGE
        : VIEW_RETRY_NOTHING_TO_ASK_MESSAGE,
    });
  }
  const price = offer.priceCredits;

  const source = await (dependencies.readSource ?? readCastViewRenderSource)(
    input.userId,
    read.modelId,
  );
  if (!source) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "This Cast can't be asked for another view right now. Nothing was charged.",
    });
  }

  /*
    HER FACE, FETCHED BEFORE THE CLAIM — so a Cast whose anchor object has gone
    away is a free refusal rather than a charged render with nothing to hold
    the likeness.
  */
  let anchor: { bytes: Buffer; contentType: string };
  try {
    const bytes = await (dependencies.readAnchorBytes ?? storageReadBytes)(
      source.anchorStorageKey,
    );
    anchor = { bytes: bytes.bytes, contentType: bytes.contentType };
  } catch {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "This Cast's signed face isn't available right now, so the view can't be rebuilt. Nothing was charged.",
    });
  }

  const pronouns = castPronouns(source.technicalSchema);
  const wardrobeLine = castWardrobeLine(source.technicalSchema);
  /* The line dresses and judges the retried view; the SOURCE is for the ink
     ride check alone — a `brief` line keeps the ride on the house prior
     (#1222), so a retry carries her tattoos exactly as the original views did. */
  const wardrobeSource = castWardrobeSource(source.technicalSchema);

  /* ---- the claim ---- */

  /* THE ONE PLACE THIS KEY IS BUILT on this road — the claim locks it and the
     running transition re-proves it, so a second spelling of the same key would
     be a lock nobody holds. */
  const slotLockKey = castViewSlotOperationLockKey(read.modelId, input.angle);

  const gate = await (dependencies.begin ?? beginDirectOperation)({
    userId: input.userId,
    clientRequestId: input.clientRequestId,
    kind: "castingV2.viewRetry",
    /* Bound at the claim, BEFORE any money moves, so the sweep can always ask
       whether a picture landed for this Cast. */
    modelId: read.modelId,
    /*
      ONE SLOT, ONE TRY AGAIN — the mutual exclusion, at the wire (#1257).

      The admission read above is the FIRST answer to "is one already running",
      and it is the one a customer normally meets. It is a read, so it leaves a
      window: between it and this claim the entrance also reads her render
      source and fetches her signed face out of storage — realistically a few
      hundred milliseconds, not a few. Two presses landing inside that window
      both pass the read and both buy the view.

      `generation_operation_locks.lockKey` is a primary key, so the INSERT is
      the exclusion and there is no window at all. Per SLOT rather than per
      Cast, because asking for her profile while her close-up renders is a
      thing the product does on purpose.
    */
    lockKey: slotLockKey,
    /* The same sentence the admission refusal gives, so the customer who loses
       the race and the customer who pressed twice slowly are told one thing. */
    lockBusyMessage: VIEW_RETRY_ALREADY_ASKING_MESSAGE,
    /* THE ONE PLACE THIS SHAPE IS WRITTEN — the busy read hashes the same
       builder to recognise this very claim as running (#1235). A literal here
       would be a mirror of it, and its drift would reopen the double charge
       silently. */
    payload: castViewRetryClaimPayload({ castId: input.castId, angle: input.angle }),
  });
  if (gate.type === "replay") {
    // Idempotency, not an error: the same request id returns the view it
    // already bought rather than buying a second one.
    return gate.result as ViewRetryResult;
  }
  const operationId = gate.operationId;

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
    return completeDirectOperationFailure({
      userId: input.userId,
      operationId,
      error,
      chargedCredits: 0,
      refundedCredits: 0,
    });
  }

  /* ---- the pinned deduct, and only when there is a price ---- */

  if (price > 0) {
    const charge = await (dependencies.deduct ?? deductCredits)(
      input.userId,
      price,
      "generation",
      "Cast view: try again (pending)",
      operationChargeReference(operationId),
      { toolKind: "image", engineUsed: "castingV2" },
    );
    if (!charge.success) {
      /*
        Nothing was dispatched, so nothing is owed back — and the slot is
        exactly what it was a second ago. The sentence carries the price,
        because a paid button that refuses has to say what it costs.
      */
      return completeDirectOperationFailure({
        userId: input.userId,
        operationId,
        error: new TRPCError({
          code: "BAD_REQUEST",
          message: charge.error || `Not enough credits. Asking for this view again costs ${price} credits.`,
        }),
        chargedCredits: 0,
        refundedCredits: 0,
      });
    }
  }

  /* ---- the render: the Sign's own loop, with our landing ---- */

  const view = castPackageView(input.angle);
  const drop = dependencies.deleteObject ?? storageDelete;
  const commit = dependencies.commitRetried ?? commitRetriedViewAsset;

  let rendered: Awaited<ReturnType<typeof renderViewAttempts<{ assetId: number; url: string }>>>;
  try {
    /*
      WHAT TRAVELS BESIDE THE ANCHOR, RE-DERIVED BY THE SIGN'S OWN TWO READERS.

      Her delivered ink crops and her carried feature words are what make a view
      of THIS woman rather than of the waist-up photograph. Both are called
      here — never re-implemented — because a retried view that silently lost
      her tattoos would be the fidelity law's exact failure, and it would land
      in the one place a customer is already unhappy.

      A Cast whose source candidate is gone carries neither, which is the same
      answer a Cast that never had them gets: the composer sends byte-identical
      words either way.
    */
    const [inkCrops, featureWords] = await Promise.all([
      source.candidatePublicId === null
        ? Promise.resolve({ crops: [] as const })
        : carriedInkCrops({}, {
            userId: input.userId,
            candidatePublicId: source.candidatePublicId,
            anchorDeltas: source.anchorDeltas,
            pronouns,
            operationId,
            wardrobeLine,
            wardrobeSource,
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
    rendered = await renderViewAttempts(
      dependencies,
      {
        userId: input.userId,
        operationId,
        modelId: read.modelId,
        identityRevisionId: source.identityRevisionId,
        identityText: source.identityText,
        anchor,
        inkCrops: inkCrops.crops,
        pronouns,
        featureWords,
        wardrobeLine,
        /* The SAME words the original five views were composed from (#1278 part
           1). Without this a Try again renders a different prompt from the slot
           it replaces, which is the half that outlives its keyed sibling. */
        description: source.briefText,
      },
      input.angle,
      /* The landing's shape is INFERRED from `renderViewAttempts`'s own
         `ViewLanding`, never re-declared here. It used to be spelled out
         locally with `verdict: { axes: unknown; ... }` — a weaker copy of the
         real type, which is working law 4's shape and is exactly why a third
         conformance field could be added to one writer and missed here. */
      async (landed) => {
        const assetId = await commit({
          userId: input.userId,
          operationId,
          modelId: read.modelId,
          angle: input.angle,
          storageKey: landed.stored.key,
          storageUrl: landed.stored.url,
          identityRevisionId: source.identityRevisionId,
          identityText: source.identityText,
          pointsCost: price,
          provenance: {
            source: "castingV2.viewRetry",
            /* The fork variable the sweep reads. Written with the picture, in
               the same statement, so a landed view can never look unpaid. */
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
      the sweep rather than sealing a receipt this process cannot stand behind
      — it reads the ledger and the asset rows and reaches the right answer
      without trusting anything believed here.
    */
    log.error(
      { operationId, castId: input.castId, angle: input.angle, err: error },
      "[viewRetryService] the retried view threw past its loop — the sweep owns it",
    );
    throw error;
  }

  /* ---- settle ---- */

  if (rendered.status === "landed") {
    log.info(
      { operationId, castId: input.castId, angle: input.angle, price },
      "[viewRetryService] a view asked for again arrived",
    );
    const result: ViewRetryResult = {
      castId: input.castId,
      angle: input.angle,
      outcome: "ready",
      url: rendered.value.url,
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

  /*
    FENCED: this operation is no longer running, so a sweep owns its money and
    its bytes were already dropped by the loop. Nothing is refunded here —
    refunding under a reference the sweep is about to use is how one failure
    becomes two refunds.
  */
  if (rendered.status === "fenced") {
    log.warn(
      { operationId, castId: input.castId, angle: input.angle },
      "[viewRetryService] the retried view lost its fence — recovery owns it",
    );
    return completeDirectOperationFailure({
      userId: input.userId,
      operationId,
      error: new TRPCError({
        code: "CONFLICT",
        message: "That view was settled while it rendered. Refresh the Cast — nothing extra was charged.",
      }),
      chargedCredits: price,
      refundedCredits: 0,
    });
  }

  /*
    It did not arrive. The slot is exactly what it was — no new failure marker,
    because the confession that is already there is still true and, on the
    unjudged road, the picture the customer HAS must not be replaced by one.
  */
  let refunded = 0;
  let refundRecorded = true;
  if (price > 0) {
    const refund = await (dependencies.refund ?? recordRefund)(
      input.userId,
      price,
      `Cast view: ${view.label} didn't arrive when asked again`,
      operationChargeReference(operationId),
    );
    refunded = refund.recorded && !refund.duplicate ? refund.amount : 0;
    refundRecorded = refund.recorded;
    if (!refund.recorded) {
      log.error(
        { operationId, castId: input.castId, angle: input.angle, reference: refund.reference },
        "[viewRetryService] the retry refund did not record — the owner remains charged",
      );
    }
  }

  const result: ViewRetryResult = {
    castId: input.castId,
    angle: input.angle,
    outcome: "failed",
    url: null,
    chargedCredits: price,
    refundedCredits: refunded,
    refundRecorded,
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
