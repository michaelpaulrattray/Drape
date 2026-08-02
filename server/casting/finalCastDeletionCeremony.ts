/**
 * The permanent-deletion ceremony, as ONE implementation with two doors.
 *
 * D-64 gave this its shape — a direct operation for the receipt, the model lock
 * so nothing else touches her mid-delete, manifests so objects are handed to the
 * bounded worker rather than deleted inline, and a tombstone rather than a hole.
 * `executeFinalCastDeletion` is the authority; this is the ceremony AROUND it:
 * claim, lock, run, seal.
 *
 * It lives here rather than inside `routes/models.ts` because Casting V2 needs
 * the same ceremony from a different door — the roster knows a Cast by her
 * public `KI-…` id, never by a numeric model id. Two routes calling one
 * function is an extension; two routes each with their own copy of the claim and
 * seal is the parallel deletion path the founder ruled against (D-107), and the
 * copy that drifts is always the one nobody is looking at.
 */
import { TRPCError } from "@trpc/server";

import {
  beginDirectOperation,
  completeDirectOperationFailure,
  failClaimedDirectOperation,
} from "./directOperation";
import { modelOperationLockKey } from "./operationContract";
import {
  executeFinalCastDeletion,
  summarizeFinalCastDeletion,
  type FinalCastDeletionSummary,
} from "./finalCastDeletion";
/*
  Both through the `db` barrel, deliberately — that is the module `routes/models`
  imported from before this ceremony was extracted, and the seam every existing
  test mocks. Reaching past it to `db/models` would leave those suites exercising
  a real database read while reporting green.
*/
import { getModelById, markGenerationOperationRunning } from "../db";

export type FinalCastDeletionCeremonyResult = {
  success: true;
  counts: FinalCastDeletionSummary;
};

/**
 * Claim the operation, take the lock, run the authority, seal the receipt.
 *
 * A replay returns the counts the first attempt sealed — deletion is permanent,
 * so a retried request must never look like a second deletion that found
 * nothing left to remove.
 */
export async function runFinalCastDeletionCeremony(input: {
  userId: number;
  modelId: number;
  clientRequestId: string;
  audit?: { ipAddress?: string | null; userAgent?: string | null };
}): Promise<FinalCastDeletionCeremonyResult> {
  const lockKey = modelOperationLockKey(input.modelId);
  const gate = await beginDirectOperation({
    userId: input.userId,
    clientRequestId: input.clientRequestId,
    kind: "model.delete",
    modelId: input.modelId,
    payload: { modelId: input.modelId },
    lockKey,
  });

  if (gate.type === "replay") {
    const counts = summarizeFinalCastDeletion(gate.result);
    if (!counts) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `The saved deletion result needs support review. Operation ${gate.operationId}.`,
      });
    }
    return { success: true, counts };
  }

  const lockedModel = await getModelById(input.modelId);
  if (!lockedModel || lockedModel.userId !== input.userId || lockedModel.status === "archived") {
    const error = !lockedModel || lockedModel.status === "archived"
      ? new TRPCError({ code: "NOT_FOUND", message: "Model not found" })
      : new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
    return failClaimedDirectOperation({
      userId: input.userId,
      operationId: gate.operationId,
      error,
    }) as never;
  }

  await markGenerationOperationRunning({
    userId: input.userId,
    operationId: gate.operationId,
    modelId: input.modelId,
    expectedIdentityRevisionId: lockedModel.identityRevisionId,
    plannedCredits: 0,
    requiredLockKey: lockKey,
    phase: "finalizing",
    heartbeat: false,
  });

  try {
    const result = await executeFinalCastDeletion({
      userId: input.userId,
      modelId: input.modelId,
      operationId: gate.operationId,
      audit: input.audit,
    });
    const counts = summarizeFinalCastDeletion(result);
    if (!counts) throw new Error("Deletion completed without a valid public summary");
    return { success: true, counts };
  } catch (error) {
    return completeDirectOperationFailure({
      userId: input.userId,
      operationId: gate.operationId,
      error,
      chargedCredits: 0,
      refundedCredits: 0,
    }) as never;
  }
}
