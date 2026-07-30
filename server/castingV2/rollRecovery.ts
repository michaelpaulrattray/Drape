import { and, eq, inArray } from "drizzle-orm";

import { castingCandidates, castingRolls } from "../../drizzle/schema";
import { getDb } from "../db/connection";
import { recordRefund, refundReferenceFor } from "../casting/atomicCredits";
import { operationChargeReference } from "../casting/operationContract";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("castingV2/rollRecovery");

/**
 * Bespoke recovery adjudicator for `castingV2.roll` (plan §E, §F, §H.6).
 *
 * Follows the `recoverEvidencePackageSyncOperation` precedent: the sweep finds
 * an operation whose lease expired mid-flight and asks this to decide what
 * actually happened, using the candidate rows as durable truth rather than
 * anything the crashed process believed.
 *
 * TWO LAWS SHAPE EVERYTHING HERE.
 *
 * 1. Recovery adjudicates and refunds; it never re-drives provider work. A
 *    candidate that did not land does not get regenerated — it gets refunded.
 *    Regenerating would spend money nobody asked for, on a request whose owner
 *    has long since closed the tab.
 *
 * 2. Landed is durable truth. `imageKey` is written to our own storage before
 *    a candidate becomes `ready`, so a `ready` row means the user has the
 *    image and keeps it. Anything else owes them their credits back.
 *
 * WHY THE PROVIDER QUERY EXISTS AT ALL. §H.6 says ambiguous dispatched
 * outcomes are verified against the provider "where queryable". Verified
 * 2026-07-31 on fal: a request stays queryable after completion even under
 * `sync_mode`, so the branch is real rather than dead code. But it does not
 * change the user's outcome — we have no image to give them either way, so the
 * refund happens regardless. What it changes is our accounting honesty: it
 * distinguishes "the provider never did the work" from "the provider did the
 * work and we lost it", and only the second means we ate the COGS. That
 * distinction is recorded, not billed.
 */

export type RollRecoveryOutcome =
  | { type: "durable_success"; ready: number }
  | { type: "partial"; ready: number; refunded: number; refundedCredits: number }
  | { type: "paid_failure"; refunded: number; refundedCredits: number }
  | { type: "recovery_required"; reason: string; chargedCredits: number; refundedCredits: number };

type CandidateRow = typeof castingCandidates.$inferSelect;

/** A candidate has landed when its bytes are in OUR storage, not a provider's. */
function hasLanded(candidate: CandidateRow): boolean {
  return candidate.status === "ready" && Boolean(candidate.imageKey);
}

/**
 * The per-candidate refund reference.
 *
 * Derived through the shared helper from a deterministic per-slice charge key,
 * never assembled by string concatenation at two call sites — writer and
 * recovery must produce byte-identical references or the ledger's uniqueness
 * cannot make retries idempotent. Mirrors `mintPackage`'s `:slot:<angle>`
 * shape.
 */
export function candidateRefundReference(operationId: string, candidatePublicId: string): string {
  return refundReferenceFor(`${operationChargeReference(operationId)}:candidate:${candidatePublicId}`);
}

/**
 * Asks the provider what became of a dispatched request.
 *
 * Injected rather than imported so recovery can be tested without a network,
 * and so the sweep never accidentally reaches for a provider that is down.
 */
export type ProviderProbe = (input: {
  provider: string | null;
  providerRef: string | null;
}) => Promise<"delivered" | "not_delivered" | "unknown">;

export async function recoverCastingV2RollOperation(
  operation: { id: string; userId: number; chargedCredits: number; refundedCredits: number },
  options: { probe?: ProviderProbe } = {},
): Promise<RollRecoveryOutcome> {
  const db = await getDb();
  if (!db) {
    return {
      type: "recovery_required",
      reason: "database unavailable during recovery",
      chargedCredits: operation.chargedCredits,
      refundedCredits: operation.refundedCredits,
    };
  }

  const [roll] = await db
    .select()
    .from(castingRolls)
    .where(eq(castingRolls.operationId, operation.id))
    .limit(1);

  if (!roll) {
    /*
      The operation exists but no roll does. That means the crash happened
      between claiming the operation and committing the rows — and because the
      charge only ever happens AFTER those rows are durable, there is nothing
      to refund. Reporting a paid failure here would invent a refund for money
      that was never taken.
    */
    return { type: "paid_failure", refunded: 0, refundedCredits: 0 };
  }

  const candidates = await db
    .select()
    .from(castingCandidates)
    .where(and(eq(castingCandidates.rollId, roll.id), eq(castingCandidates.userId, operation.userId)));

  const landed = candidates.filter(hasLanded);
  const owed = candidates.filter((candidate) => !hasLanded(candidate));

  if (owed.length === 0) {
    // Everything landed; the crash was after the last candidate. Nothing owed.
    await db
      .update(castingRolls)
      .set({ status: "complete" })
      .where(and(eq(castingRolls.id, roll.id), inArray(castingRolls.status, ["pending", "generating"])));
    return { type: "durable_success", ready: landed.length };
  }

  let refundedCredits = 0;
  let refundedCount = 0;
  let unrecorded = 0;

  for (const candidate of owed) {
    // Ask the provider only for work we actually dispatched. A `queued`
    // candidate never reached them, so there is nothing to ask about.
    let delivered: "delivered" | "not_delivered" | "unknown" = "not_delivered";
    if (candidate.status === "dispatched") {
      delivered = options.probe
        ? await options
            .probe({ provider: candidate.provider, providerRef: candidate.providerRef })
            .catch(() => "unknown" as const)
        : "unknown";
    }

    const slice = candidate.pointsCost;
    if (slice > 0) {
      const outcome = await recordRefund(
        operation.userId,
        slice,
        "Casting candidate did not arrive",
        `${operationChargeReference(operation.id)}:candidate:${candidate.publicId}`,
      );
      if (outcome.recorded) {
        refundedCredits += outcome.amount;
      } else {
        /*
          A refund that failed to record is never reported as "you weren't
          charged" (the atomicCredits law). Count it so the operation lands in
          recovery_required rather than quietly claiming conservation.
        */
        unrecorded += 1;
        log.error(
          { operationId: operation.id, candidate: candidate.publicId, reference: outcome.reference },
          "[rollRecovery] refund slice did not record — user remains charged",
        );
      }
    }
    refundedCount += 1;

    await db
      .update(castingCandidates)
      .set({
        status: "failed",
        failureClass: delivered === "delivered" ? "provider_delivered_unlanded" : "unrecovered",
      })
      .where(
        and(
          eq(castingCandidates.id, candidate.id),
          eq(castingCandidates.userId, operation.userId),
          // CAS: never overwrite a status a live process reached first.
          inArray(castingCandidates.status, ["queued", "dispatched"]),
        ),
      );

    if (delivered === "delivered") {
      log.warn(
        { operationId: operation.id, candidate: candidate.publicId },
        "[rollRecovery] provider delivered work we never landed — refunded anyway, COGS absorbed",
      );
    }
  }

  await db
    .update(castingRolls)
    .set({ status: landed.length > 0 ? "partial" : "failed" })
    .where(and(eq(castingRolls.id, roll.id), inArray(castingRolls.status, ["pending", "generating"])));

  if (unrecorded > 0) {
    return {
      type: "recovery_required",
      reason: `${unrecorded} refund slice(s) failed to record`,
      chargedCredits: operation.chargedCredits,
      refundedCredits,
    };
  }

  return landed.length > 0
    ? { type: "partial", ready: landed.length, refunded: refundedCount, refundedCredits }
    : { type: "paid_failure", refunded: refundedCount, refundedCredits };
}
