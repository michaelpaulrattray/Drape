/**
 * The recovery adjudicator for `castingV2.refine` (M8 §12).
 *
 * The Sign adjudicator is long because a Sign creates authority — a Cast, a
 * spent candidate, six view slots — and each of those needs its own answer.
 * This one is short for the opposite reason, and the shortness is the design
 * rather than an omission:
 *
 *   **Did the variant land?**
 *
 * Ready means the user has the picture they paid for, and the operation
 * completes with the charge kept. Anything else means they have nothing, and
 * the whole 25 goes back — one image, one unit, no partial state to reason
 * about.
 *
 * # Why it cannot use the generic path
 *
 * The standard adjudicator reads the operation's own `modelId` to find what was
 * built. A refine builds a VARIANT, which that column has never heard of, so
 * the generic path would call a landed refinement a total loss — and refund a
 * picture the user is looking at, which is the one direction that costs the
 * business rather than the customer. The variant's own status is the fork.
 *
 * # Read prior refunds; never re-issue one to find out
 *
 * Idempotent references make a duplicate refund a no-op, which works right up
 * until the day one of them is not a duplicate. The ledger is read.
 */
import { and, eq, inArray } from "drizzle-orm";

import { creditTransactions } from "../../drizzle/schema";
import { recordRefund, refundReferenceFor } from "../casting/atomicCredits";
import { operationChargeReference } from "../casting/operationContract";
import {
  finalizeClaimedGenerationOperationFailure,
  finalizeGenerationOperationFailure,
  finalizeGenerationOperationSuccess,
  markGenerationOperationRecoveryRequired,
} from "../db/generationOperations";
import { failVariant, findVariantByOperation } from "../db/castingV2Variants";
import { refineRefundDescription } from "./refineRefundLedger";
import { getDb } from "../db/connection";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("castingV2/refineRecovery");

/**
 * WHAT A CUSTOMER IS TOLD WHEN THE SWEEP TAKES A PAID REFINE OVER — one story
 * in two beats, and NAMED so nothing can watch it by spelling.
 *
 * # Why it is written this way
 *
 * Since 2026-08-17 this sentence can reach the customer as a toast: the bridge
 * now speaks for a terminal refine failure that no surface answered
 * (`client/src/features/operations/outcomeShown.ts`, ruled fable-828 §3). On a
 * swept row it FOLLOWS the viewer's own live narration — "this one didn't make
 * it", with "your credits come back on their own"
 * (`CandidateViewer.tsx`, `STAGE_WORDS.settling` and `SETTLING_NOTE`) — so it
 * is written in that line's own words, in the completed tense, as its outcome.
 * The two are never on screen at once: the settling narration needs the row in
 * the pending list, and this write is what takes it out.
 *
 * # Why it is a named constant
 *
 * It read *"That refinement didn't come through. Your credits have been
 * returned."* until then, and TWO things watched that spelling from outside:
 * `cannotSayCopy.test.ts` guards that no cannot-say reason falls back to the
 * malfunction line, and the 2026-08-17 latency reading used it as the only
 * available discriminator for sweep-settled operations. Editing the literal in
 * place would have left the first guard passing over a string nothing writes —
 * a test that cannot fail — and silently retired the second. Both now read
 * this name.
 */
export const RECOVERED_REFINE_SENTENCE = "That one didn't make it. Your credits are back.";

export type RefineRecoveryOutcome =
  | { type: "durable_success"; chargedCredits: number; refundedCredits: number }
  | { type: "paid_failure"; chargedCredits: number; refundedCredits: number }
  /** Terminal, and nothing was taken — "paid" is what accounting reads. */
  | { type: "free_failure"; reason: string }
  | { type: "recovery_required"; reason: string; chargedCredits: number; refundedCredits: number };

export type RecoverableRefineOperation = {
  id: string;
  userId: number;
  status: "claimed" | "running";
  chargedCredits: number;
  refundedCredits: number;
};

export type RefineRecoveryDependencies = {
  findVariant?: typeof findVariantByOperation;
  refund?: typeof recordRefund;
  failVariantRow?: typeof failVariant;
  finalizeSuccess?: typeof finalizeGenerationOperationSuccess;
  finalizeFailure?: typeof finalizeGenerationOperationFailure;
  finalizeClaimedFailure?: typeof finalizeClaimedGenerationOperationFailure;
  park?: typeof markGenerationOperationRecoveryRequired;
};

type ChargeTruth =
  | { kind: "charged"; credits: number }
  | { kind: "not_charged" }
  | { kind: "ambiguous"; reason: string };

async function readLedger(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  operation: { id: string; userId: number },
): Promise<{ charge: ChargeTruth; alreadyRefunded: number }> {
  const chargeReference = operationChargeReference(operation.id);
  const refundReference = refundReferenceFor(chargeReference);
  const rows = await db
    .select()
    .from(creditTransactions)
    .where(and(
      eq(creditTransactions.userId, operation.userId),
      inArray(creditTransactions.referenceId, [chargeReference, refundReference]),
    ));

  const chargeRows = rows.filter((row) => row.referenceId === chargeReference);
  const alreadyRefunded = rows
    .filter((row) => row.referenceId === refundReference && row.type === "refund" && row.amount > 0)
    .reduce((sum, row) => sum + row.amount, 0);

  if (chargeRows.length === 0) return { charge: { kind: "not_charged" }, alreadyRefunded };
  if (chargeRows.length > 1) {
    return {
      charge: { kind: "ambiguous", reason: "duplicate charge rows for one refine" },
      alreadyRefunded,
    };
  }
  return { charge: { kind: "charged", credits: Math.abs(chargeRows[0].amount) }, alreadyRefunded };
}

export async function recoverCastingV2RefineOperation(
  operation: RecoverableRefineOperation,
  options: RefineRecoveryDependencies = {},
): Promise<RefineRecoveryOutcome> {
  const db = await getDb();
  if (!db) {
    return {
      type: "recovery_required",
      reason: "database unavailable during recovery",
      chargedCredits: operation.chargedCredits,
      refundedCredits: operation.refundedCredits,
    };
  }

  const ledger = await readLedger(db, operation);
  if (ledger.charge.kind === "ambiguous") {
    await (options.park ?? markGenerationOperationRecoveryRequired)({
      userId: operation.userId,
      operationId: operation.id,
      publicMessage: `This refinement needs support review. Operation ${operation.id}.`,
      chargedCredits: operation.chargedCredits,
      refundedCredits: operation.refundedCredits,
    }).catch((error) => {
      log.error({ operationId: operation.id, err: error }, "[refineRecovery] could not park");
    });
    return {
      type: "recovery_required",
      reason: ledger.charge.reason,
      chargedCredits: operation.chargedCredits,
      refundedCredits: operation.refundedCredits,
    };
  }

  const variant = await (options.findVariant ?? findVariantByOperation)(
    operation.userId,
    operation.id,
  );

  /*
    THE FORK. A ready variant means the picture exists and is selected — the
    landing writes both in one transaction — so the user has what they bought
    and the charge stands. Everything else is a total loss.
  */
  if (variant?.status === "ready") {
    if (ledger.charge.kind === "not_charged") {
      /*
        A delivered refinement nobody was charged for. Rare, and it must not be
        silently kept: it means the charge and the landing disagree, which is
        exactly the class this sweep exists to surface rather than paper over.
      */
      await (options.park ?? markGenerationOperationRecoveryRequired)({
        userId: operation.userId,
        operationId: operation.id,
        publicMessage: `This refinement needs support review. Operation ${operation.id}.`,
        chargedCredits: 0,
        refundedCredits: ledger.alreadyRefunded,
      }).catch(() => undefined);
      return {
        type: "recovery_required",
        reason: "a landed refinement carries no charge",
        chargedCredits: 0,
        refundedCredits: ledger.alreadyRefunded,
      };
    }
    await (options.finalizeSuccess ?? finalizeGenerationOperationSuccess)({
      userId: operation.userId,
      operationId: operation.id,
      result: { variantId: variant.publicId } as never,
      chargedCredits: ledger.charge.credits,
      refundedCredits: ledger.alreadyRefunded,
    });
    return {
      type: "durable_success",
      chargedCredits: ledger.charge.credits,
      refundedCredits: ledger.alreadyRefunded,
    };
  }

  /* ---- nothing was delivered ---- */

  if (variant) {
    /*
      Terminal, so a later sweep cannot pick this row up and refund it twice —
      AND the return value is the race detector, not a formality.

      `failVariant`'s predicate is `queued/dispatched`. It returning false means
      the row moved while this sweep was deciding, which in practice means a
      live process that outlived its lease landed the refinement between the
      read above and this write. Refunding now would hand the user the picture
      AND the 25 back. So the row is re-read and, if it landed, this becomes
      the success arm it should have been.
    */
    const fenced = await (options.failVariantRow ?? failVariant)({
      userId: operation.userId,
      variantId: variant.id,
      failureClass: "recovered",
    });
    if (!fenced) {
      const current = await (options.findVariant ?? findVariantByOperation)(
        operation.userId,
        operation.id,
      );
      if (current?.status === "ready") {
        log.warn(
          { operationId: operation.id },
          "[refineRecovery] a live refine landed mid-sweep — keeping the charge",
        );
        if (ledger.charge.kind !== "charged") {
          /*
            A delivered refinement with no charge behind it — the SAME anomaly
            the primary ready arm parks, so it gets the same verdict here.

            Unreachable by construction (the charge strictly precedes dispatch),
            but two arms reaching two different conclusions about one impossible
            state is how an impossible state eventually gets a wrong answer.
            Falling through would have told this user "you were not charged"
            about a picture they are looking at.
          */
          await (options.park ?? markGenerationOperationRecoveryRequired)({
            userId: operation.userId,
            operationId: operation.id,
            publicMessage: `This refinement needs support review. Operation ${operation.id}.`,
            chargedCredits: 0,
            refundedCredits: ledger.alreadyRefunded,
          }).catch(() => undefined);
          return {
            type: "recovery_required",
            reason: "a landed refinement carries no charge",
            chargedCredits: 0,
            refundedCredits: ledger.alreadyRefunded,
          };
        }
        {
          await (options.finalizeSuccess ?? finalizeGenerationOperationSuccess)({
            userId: operation.userId,
            operationId: operation.id,
            result: { variantId: current.publicId } as never,
            chargedCredits: ledger.charge.credits,
            refundedCredits: ledger.alreadyRefunded,
          });
          return {
            type: "durable_success",
            chargedCredits: ledger.charge.credits,
            refundedCredits: ledger.alreadyRefunded,
          };
        }
      }
    }
  }

  if (ledger.charge.kind === "not_charged") {
    /*
      The crash landed before the deduct. Terminal, and NOT a paid failure —
      "paid" is what downstream accounting reads to decide money moved, and
      saying it here would invent a charge that never happened.
    */
    const finalize = operation.status === "claimed"
      ? (options.finalizeClaimedFailure ?? finalizeClaimedGenerationOperationFailure)
      : null;
    if (finalize) {
      await finalize({
        userId: operation.userId,
        operationId: operation.id,
        errorCode: "PRECONDITION_FAILED",
        publicMessage: "That refinement didn't run. You were not charged.",
      });
    } else {
      await (options.finalizeFailure ?? finalizeGenerationOperationFailure)({
        userId: operation.userId,
        operationId: operation.id,
        errorCode: "PRECONDITION_FAILED",
        publicMessage: "That refinement didn't run. You were not charged.",
        chargedCredits: 0,
        refundedCredits: 0,
      });
    }
    return { type: "free_failure", reason: "no charge was taken" };
  }

  const owed = ledger.charge.credits - ledger.alreadyRefunded;
  let refunded = ledger.alreadyRefunded;
  if (owed > 0) {
    const refund = await (options.refund ?? recordRefund)(
      operation.userId,
      owed,
      /* The eighth member of a family whose other seven live in
         `refineService.ts`, and the reason neither could be read back off the
         ledger until #111: one vocabulary, one author, both writers composing
         through it. Same bytes. */
      refineRefundDescription("recovered"),
      operationChargeReference(operation.id),
    );
    if (!refund.recorded) {
      /*
        The refund did not record. Parking rather than reporting a clean
        failure is the only honest move: the receipt would otherwise claim
        money came back that did not.
      */
      await (options.park ?? markGenerationOperationRecoveryRequired)({
        userId: operation.userId,
        operationId: operation.id,
        publicMessage: `This refinement needs support review. Operation ${operation.id}.`,
        chargedCredits: ledger.charge.credits,
        refundedCredits: ledger.alreadyRefunded,
      }).catch(() => undefined);
      return {
        type: "recovery_required",
        reason: "the refund did not record",
        chargedCredits: ledger.charge.credits,
        refundedCredits: ledger.alreadyRefunded,
      };
    }
    refunded += owed;
  }

  await (options.finalizeFailure ?? finalizeGenerationOperationFailure)({
    userId: operation.userId,
    operationId: operation.id,
    errorCode: "INTERNAL_SERVER_ERROR",
    publicMessage: RECOVERED_REFINE_SENTENCE,
    chargedCredits: ledger.charge.credits,
    refundedCredits: refunded,
  });
  return {
    type: "paid_failure",
    chargedCredits: ledger.charge.credits,
    refundedCredits: refunded,
  };
}
