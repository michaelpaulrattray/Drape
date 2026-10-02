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

import type { ModelAsset } from "../../drizzle/schema";
import type { CastViewAngle } from "../../shared/boardTypes";
import { displayPrice, formatCredits } from "../../shared/creditDisplay";
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
  listSpentFreeViewRetryAngles,
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
import { castSlotRetryOffer, landedViewAsset, projectSignedCast } from "./castProjection";
import { CASTING_V2_VIEW_RETRY_PRICE_CREDITS } from "../casting/castingCreditCosts";
import { castPackageView } from "./castViewPackage";
import {
  renderViewAttempts,
  type PackageOrchestratorDependencies,
  type ViewAttemptTally,
} from "./packageOrchestrator";
import { castingOutfitPlateEngine } from "./signEngine";
import {
  PLATE_ANGLES,
  plateSideFor,
  renderOutfitPlate,
  siblingPlateAngleFor,
  type OutfitReference,
  type OutfitReferenceKind,
} from "./outfitPlate";
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
  /**
   * THE DELIVERED SIBLING'S BYTES — its own seam, not the anchor's (#1474).
   *
   * Separate so an arm can make her face readable and her sibling view
   * unreadable at the same time, which is exactly the fallback that matters:
   * an object that has gone away must drop this retry to a fresh plate, not
   * refuse a render the customer can still be given.
   */
  readOutfitBytes?: typeof storageReadBytes;
  /** What the room would show right now — the authority on what may be asked
   *  for again, injected so a test drives the decision rather than a fixture
   *  of it. */
  readSlots?: (userId: number, castPublicId: string) => Promise<CastSlotsRead | null>;
};

export type CastSlotsRead = {
  modelId: number;
  slots: ReturnType<typeof projectSignedCast>["slots"];
  /**
   * THE VIEWS WHOSE ONE FREE TRY AGAIN IS ALREADY SPENT (#1601 item 4).
   *
   * Carried out of the read rather than re-queried at the till, for the reason
   * this whole type exists: the offer the room was shown and the offer the money
   * moves against have to come from ONE reading. The entrance re-asks
   * `castSlotRetryOffer` — it does not trust the client's price — and this is the
   * third fact that answer needs, so it travels with the slots that are the
   * other two.
   */
  freeRetrySpentAngles: readonly CastViewAngle[];
  /**
   * THE STORAGE KEY OF EACH DELIVERED FULL-LENGTH VIEW THAT HAS ONE (#1474).
   *
   * ⚠ **It comes out of the SAME read the slots do, and through the same
   * selection law.** `landedViewAsset` is `slotEvidence` asked for one angle —
   * the function the room itself uses to decide which picture a slot shows — so
   * the view a retry copies its garments out of cannot come to differ from the
   * view the customer is looking at. A second "newest filled one" written in SQL
   * here would be working law 4's parallel copy, on the one claim this whole
   * change rests on.
   *
   * An angle is ABSENT from the map — never present and null — where its slot
   * has never landed, or where its row carries a URL and no key: bytes cannot be
   * fetched without a key, and a retry then mints a plate exactly as it did
   * before this existed.
   */
  deliveredOutfitKeys: Partial<Record<(typeof PLATE_ANGLES)[number], string>>;
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
 * THE STORAGE KEY OF EACH DELIVERED FULL-LENGTH VIEW (#1474) — pure, so it can
 * be driven.
 *
 * ⚠ **It is exported for one reason and the reason is a measured one.** The
 * impure half of this read cannot be reached by the unit suite — it needs five
 * database readers — so if the mapping lived inside it, the only thing standing
 * behind *"a `backFull` retry is handed the FRONT view's key"* would be
 * TypeScript, and TypeScript cannot see a transposition: both sides are
 * `string`. A swapped pair would dress a retry from the very picture the
 * customer pressed Try again to be rid of, and every arm would still be green.
 * That is exactly the hollow-fake shape #1471 found one seam over.
 *
 * `landedViewAsset` is the room's own selection law (working law 4); an angle
 * whose row carries a URL and no key is left out, because bytes cannot be
 * fetched without a key and a retry then mints a plate as it always did.
 */
export function deliveredOutfitKeysFrom(
  assets: readonly ModelAsset[],
): Partial<Record<(typeof PLATE_ANGLES)[number], string>> {
  const keys: Partial<Record<(typeof PLATE_ANGLES)[number], string>> = {};
  for (const angle of PLATE_ANGLES) {
    const key = landedViewAsset(assets, angle)?.storageKey ?? null;
    if (key !== null && key !== "") keys[angle] = key;
  }
  return keys;
}

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
  const [assets, lineage, promisedAngles, retryingAngles, freeRetrySpentAngles] = await Promise.all([
    listCastAssets(userId, model.id),
    getCastLineage(userId, model),
    listCastPromisedAngles(userId, model.id),
    /* WHAT IS ALREADY BEING ASKED FOR (#1235). The room reads this too, from
       the same statement, which is what makes a slot's Try again disappear and
       this entrance refuse for the same reason at the same moment. */
    listRunningViewRetryAngles({ userId, modelId: model.id, castId: castPublicId }),
    /* WHOSE FREE ASK IS ALREADY SPENT (#1601 item 4). Read here and not at the
       till for the same reason the line above is: one reading behind the button
       and the charge. */
    listSpentFreeViewRetryAngles({ userId, modelId: model.id, castId: castPublicId }),
  ]);
  const projection = projectSignedCast({
    model, assets, lineage, promisedAngles, retryingAngles, freeRetrySpentAngles,
  });
  return {
    modelId: model.id,
    slots: projection.slots,
    freeRetrySpentAngles,
    /* #1474 — derived from the assets this function already read, never from a
       second query. */
    deliveredOutfitKeys: deliveredOutfitKeysFrom(assets),
  };
}

/**
 * WAS THE DELIVERED PICTURE JUDGED? (#1608)
 *
 * The LAST verdict is the delivered one: `renderViewAttempts` keeps every
 * attempt's verdict oldest-first (D-114), and the earlier entries describe draws
 * that were thrown away. Reading the first would answer about a picture the
 * customer never saw.
 *
 * ⚠ **`unjudged` IS NOT A FAILURE** — it is *nobody looked*, which this road
 * DELIVERS on purpose (the founder's ruling behind `judgeUnjudgedOnFailure`), so
 * it is a property of a view the customer is holding. An empty array means the
 * judge never answered at all, which is the same honest `false`.
 */
function judgedOf(verdicts: readonly { unjudged?: boolean }[]): boolean {
  const delivered = verdicts.at(-1);
  return delivered === undefined ? false : delivered.unjudged !== true;
}

/**
 * THE SETTLED LINE — one per Try again, at the settle point (#1608).
 *
 * ⚠ **ONE LINE PER SETTLE, NEVER PER ATTEMPT**, which is the card's own wording
 * and the reason this is a function rather than three `log.info` calls: the three
 * settle exits below (arrived · fenced · did not arrive) must emit the SAME shape
 * or the field nobody thought about is missing from exactly the road that was
 * about to be measured. A per-attempt line already exists inside
 * `renderViewAttempts` and answers a different question.
 *
 * # What it is for
 *
 * Cid reads the double-render rate after month one against Squall's 30–60%
 * estimate. That rate is `attempts > 1` over all settles, so `attempts` is the
 * load-bearing field and `ViewAttemptTally`'s header says why it cannot be
 * `verdicts.length`.
 *
 * ⚠ **IT CHANGES NOTHING.** No prompt, no price, no refund, no charge, no
 * dispatch — it reads what the settle already holds and says it once. #1608 is
 * `monitoring only` and the suites it names are unchanged.
 *
 * ⚠ **AND THERE IS DELIBERATELY NO IN-PROCESS COUNTER BESIDE IT — see the card.**
 * A module-level tally is this repository's own house shape (`faceScanService.ts`),
 * and it is the wrong instrument for this question twice over: it resets on every
 * deploy, and under deploy-on-merge a month-long rate would be summed over
 * whatever happened since the last merge; and a counter with no reader is
 * invariant 7 exactly — #1542's `errorTrackerStatus()` computed the deciding fact
 * for months with no non-test caller. The log line is what a month is actually
 * read from, and #1608's own done-when asks for the line.
 */
function logRetrySettled(input: {
  readonly operationId: string;
  readonly castId: string;
  readonly angle: string;
  readonly outcome: ViewRetryResult["outcome"] | "fenced";
  readonly price: number;
  readonly chargedCredits: number;
  readonly refundedCredits: number;
  readonly refundRecorded: boolean;
  readonly outfit: OutfitReferenceKind | "none";
  readonly tally: ViewAttemptTally;
  /** Whether the DELIVERED picture was judged. `null` when none was delivered. */
  readonly judged: boolean | null;
}): void {
  log.info(
    {
      operationId: input.operationId,
      castId: input.castId,
      angle: input.angle,
      outcome: input.outcome,
      /* The free retry and the paid one are the same road and must be told
         apart in the reading, or the rate mixes two populations. */
      paid: input.price > 0,
      chargedCredits: input.chargedCredits,
      refundedCredits: input.refundedCredits,
      refundRecorded: input.refundRecorded,
      attempts: input.tally.attempts,
      arrivalFailures: input.tally.arrivalFailures,
      judgedAttempts: input.tally.judgedAttempts,
      doubleRendered: input.tally.attempts > 1,
      outfit: input.outfit,
      judged: input.judged,
    },
    "[viewRetryService] retry settled",
  );
}

/**
 * DRESS A RETRIED FULL-LENGTH VIEW — the delivered sibling, else a fresh plate,
 * else her master alone (#1474).
 *
 * Three rungs, and each one down is strictly the road the product already shipped:
 *
 * 1. **The delivered sibling.** `backFull` is dressed by the delivered
 *    `frontFull` and the other way about. This is the outfit of record — a
 *    picture the customer has already been given and paid for — so the retried
 *    slot comes back in the outfit its four siblings are wearing instead of a
 *    newly invented one.
 * 2. **A fresh plate**, exactly as before this existed, when no sibling has
 *    landed: a first Try again on a Sign where the other full-length view failed,
 *    or a Cast old enough to predate path E.
 * 3. **Nothing**, when the plate does not land either — master-only, which is
 *    the road the product shipped before path E and is a complete delivery.
 *
 * ⚠ **NOT ONE OF THE THREE MAY FAIL THE RETRY.** The customer has been charged
 * for a view, not for a reference photograph they will never see, so every fault
 * on this path — a vanished storage object, a refusing door, a missing
 * credential — drops one rung and renders. That is `renderOutfitPlate`'s own rule
 * 3 extended to the rung above it.
 */
async function dressRetriedFullLengthView(input: {
  dependencies: ViewRetryServiceDependencies;
  angle: (typeof PLATE_ANGLES)[number];
  deliveredOutfitKeys: Partial<Record<(typeof PLATE_ANGLES)[number], string>>;
  anchor: { bytes: Buffer; contentType: string };
  wardrobeLine: string | null;
  description: string | null;
  operationId: number | string | null;
}): Promise<OutfitReference | null> {
  const siblingAngle = siblingPlateAngleFor(input.angle);
  const siblingKey = input.deliveredOutfitKeys[siblingAngle];
  if (siblingKey !== undefined) {
    try {
      const read = await (input.dependencies.readOutfitBytes ?? storageReadBytes)(siblingKey);
      log.info(
        { operationId: input.operationId, angle: input.angle, siblingAngle },
        "[viewRetryService] the retried view wears its delivered sibling's outfit — no plate rendered",
      );
      return {
        image: { bytes: read.bytes, contentType: read.contentType },
        /* ⚠ THE SIBLING'S OWN SIDE, which is the OPPOSITE of the view being
           rendered. A `backFull` retry is dressed by a picture facing FRONT, and
           the clause has to say so or it tells the engine to copy garments from a
           side its reference does not show. */
        side: plateSideFor(siblingAngle),
        kind: "delivered",
      };
    } catch (error) {
      /* The row says a picture is there and the bucket disagrees. Not a refusal:
         drop to a plate, which is what a Cast with no sibling gets anyway. */
      log.warn(
        {
          operationId: input.operationId,
          angle: input.angle,
          siblingAngle,
          err: error instanceof Error ? error.message : String(error),
        },
        "[viewRetryService] the delivered sibling view could not be read — falling back to a fresh plate",
      );
    }
  }
  const plate = await Promise.resolve()
    .then(() => renderOutfitPlate({
      /* Built INSIDE the promise for the reason `packageOrchestrator` spells
         out: the door throws on a missing credential, and eagerly that throw is
         synchronous — it would fail a retry the customer has already been
         charged for, over a reference picture they were never going to see. */
      engine: (input.dependencies.outfitPlateEngine ?? castingOutfitPlateEngine)(),
      /* #1471 — the same anchor this retry is about to render the view from,
         fetched above before the claim. */
      anchor: input.anchor,
      wardrobeLine: input.wardrobeLine,
      description: input.description,
      operationId: input.operationId,
    }))
    .catch(() => null);
  if (plate === null) return null;
  const side = plateSideFor(input.angle);
  /* A plate panel is cut FOR this view, so here the view's side and the
     picture's side are the same thing — the coincidence the old two-field shape
     rested on, and the reason it broke when the sibling road arrived. */
  return { image: plate[side], side, kind: "plate" };
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
  const offer = castSlotRetryOffer(
    slot,
    CASTING_V2_VIEW_RETRY_PRICE_CREDITS,
    /* THE THIRD FACT, from the SAME read the slot came out of (#1601 item 4) —
       never a second query here, which would be a reading the room never had. */
    read.freeRetrySpentAngles.includes(input.angle),
  );
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
    /*
      WHAT THIS TRY AGAIN COSTS, WRITTEN WHERE THE ROW IS BORN (#1767) — and on
      THIS road it is not housekeeping, it is the defect itself.

      `plannedCredits = 0` is how the product recognises a FREE Try again
      (`spentFreeViewRetryFilter`). Until this line the column was written one
      statement below, so a PAID retry whose `markRunning` threw settled as
      `failed` carrying the schema default — indistinguishable from the free ask
      the customer had not used. She then found her one free Try again on that
      view already spent and was asked to pay 370 credits for it.

      The figure is the same `price` the running transition writes, read off the
      offer forty-five lines above; nothing here chooses a number.
    */
    plannedCredits: price,
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
          message: charge.error || `Not enough credits. Asking for this view again costs ${formatCredits(displayPrice(price))} credits.`,
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
  /* HOISTED for the settled line (#1608), not for the render. `outfitReference`
     is computed inside the try below and the settle point sits after the catch,
     so the one fact the line needs about the wardrobe — was a fresh plate minted
     (`plate`), or did this view copy its delivered sibling (`delivered`, the
     #1474 road) — would otherwise be out of scope. The union is DERIVED from
     `OutfitReferenceKind` rather than respelled: the first draft of this line
     wrote `"sibling"` for the sibling road from the prose, and the typechecker
     caught it — the declaration's own word is `delivered`. `"none"` is the
     master-only road, which is a real third answer and not a missing value. */
  let outfitKind: OutfitReferenceKind | "none" = "none";
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
    /*
      WHAT A RETRIED FULL-LENGTH VIEW IS DRESSED BY — AND IT IS THE DELIVERED
      SIBLING FIRST, NOT A FRESH PLATE (#1474).

      ⚠ **This block argued the other way until #1474 and the argument was one
      step short of its own conclusion.** It read: *"a retried view that renders
      master-only, beside four siblings that wore a plate, is the hem-and-shoes
      lottery he reported"* — true, and the right worry. But a FRESH plate is a
      fresh invention, so it re-runs that same lottery on the one slot the
      customer has already said they dislike: the retried back can come back in
      a mini beside a delivered front in a midi. **The outfit of record exists at
      retry time and it is a picture the customer is already holding** — the
      other full-length view.

      ⚠ **HIS RULE STILL HOLDS AND IS NOT BEING TRADED.** *"New wardrobe later
      → new plate, don't reuse an old one"* is about not keeping a PLATE, and
      nothing here keeps one: no plate is stored, no wardrobe card is written,
      and the reference is a delivered VIEW rather than a cached reference. A
      refine that changes what she wears produces new views at the next Sign,
      and a retry then copies those.

      ⚠ **AND IT COSTS LESS, WHICH IS A CONSEQUENCE RATHER THAN THE REASON.**
      The sibling road spends no house money and waits on no second render — the
      plate was measured at 55.9–70.8 s (#1471) and this is one storage read.
      The customer's price is the view's 50 credits, unchanged either way.
    */
    const plateAngle = (PLATE_ANGLES as readonly string[]).includes(input.angle)
      ? (input.angle as (typeof PLATE_ANGLES)[number])
      : null;
    const outfitReference = plateAngle === null
      ? null
      : await dressRetriedFullLengthView({
          dependencies,
          angle: plateAngle,
          deliveredOutfitKeys: read.deliveredOutfitKeys,
          anchor,
          wardrobeLine,
          description: source.briefText,
          operationId,
        });
    outfitKind = outfitReference === null ? "none" : outfitReference.kind;
    rendered = await renderViewAttempts(
      dependencies,
      {
        ...(outfitReference ? { outfitReference } : {}),
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
    logRetrySettled({
      operationId,
      castId: input.castId,
      angle: input.angle,
      outcome: "ready",
      price,
      chargedCredits: price,
      refundedCredits: 0,
      refundRecorded: true,
      outfit: outfitKind,
      tally: rendered.tally,
      /* The DELIVERED picture's own verdict is the last one — earlier entries
         describe draws that were thrown away. `unjudged` is "nobody looked",
         which #1278's road delivers on purpose, so it is a fact about this
         view rather than a failure. */
      judged: judgedOf(rendered.verdicts),
    });
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
    logRetrySettled({
      operationId,
      castId: input.castId,
      angle: input.angle,
      outcome: "fenced",
      price,
      chargedCredits: price,
      refundedCredits: 0,
      /* Nothing is refunded on this road BY DESIGN — the sweep owns the money —
         so `refundRecorded` says false rather than claiming a refund this exit
         never attempted. */
      refundRecorded: false,
      outfit: outfitKind,
      tally: rendered.tally,
      judged: judgedOf(rendered.verdicts),
    });
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
  logRetrySettled({
    operationId,
    castId: input.castId,
    angle: input.angle,
    outcome: "failed",
    price,
    chargedCredits: price,
    refundedCredits: refunded,
    refundRecorded,
    outfit: outfitKind,
    tally: rendered.tally,
    /* No picture was delivered, so there is nothing to have judged. `null` is
       the third answer and is not `false` — a view that arrived unjudged and a
       view that never arrived are the two facts this field exists to separate. */
    judged: null,
  });
  await completeDirectOperationSuccess({
    userId: input.userId,
    operationId,
    result,
    chargedCredits: price,
    refundedCredits: refunded,
  });
  return result;
}
