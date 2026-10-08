/**
 * Account-erasure coordinator.
 *
 * A render still being executed refuses the whole thing first (#1954).
 * External subscription cancellation happens next. Database erasure and the
 * exact-owned storage manifest then commit through deleteUserAccount's single
 * transaction. No request thread calls storageDelete; R7-5D's leased worker
 * owns the durable cleanup batch after commit.
 */
import { getUserCredits, getUserById } from "../db";
import {
  ACCOUNT_DELETION_RENDER_IN_FLIGHT,
  deleteUserAccount,
} from "../db/accountDeletion";
import { findRenderInFlightForUser } from "../db/generationOperations";
import { spokenError } from "../_core/spokenError";
import { stripe } from "../stripe/stripeService";
import { logAuditEvent } from "../auditLog";
import { AUDIT_ACTIONS } from "../../drizzle/schema";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("security/deleteUserData");

export interface DeleteUserResult {
  success: boolean;
  error?: string;
  summary?: {
    stripeSubscriptionCancelled: boolean;
    storageFilesQueued: number;
    cleanupBatchId: string | null;
    modelsDeleted: number;
    generationsDeleted: number;
    creditsZeroed: boolean;
    userAnonymized: boolean;
  };
}

/**
 * The one refusal this coordinator throws — #1954.
 *
 * THROWN rather than returned, and the reason is that both routes flatten a
 * returned failure. `routes/account.ts` replaces `result.error` with its own
 * *"Account deletion failed. Please contact support."*, and
 * `routes/auth.ts` passes the text through under
 * `INTERNAL_SERVER_ERROR` — a code `client/src/lib/failureSentence.ts` does
 * not trust, so the client swaps it for *"That account could not be
 * deleted."* Either way the person is told something broke. A throw from here
 * arrives at tRPC intact, carries `CONFLICT`, and needs no change at either
 * route or on the client.
 *
 * `CONFLICT` is the code the sibling refusal already uses for exactly this
 * shape — `finalCastDeletion.ts` refusing a Cast with work in progress — and
 * it is one of the codes the client's rule trusts. `spokenError` marks it as a
 * sentence written for a person as well, which is the newer and stronger half
 * of that rule (`shared/spokenError.ts`): the marker is checked before the
 * code list, so this sentence reaches her even if the list is ever edited.
 */
function renderStillFinishing() {
  return spokenError({ code: "CONFLICT", message: ACCOUNT_DELETION_RENDER_IN_FLIGHT });
}

async function cancelStripeSubscriptionImmediate(
  subscriptionId: string | null | undefined,
): Promise<boolean> {
  if (!subscriptionId) return true;
  try {
    await stripe.subscriptions.cancel(subscriptionId);
    return true;
  } catch (error: any) {
    if (error?.code === "resource_missing" || error?.statusCode === 404) return true;
    log.error({ err: error }, "[DeleteUser] Failed to cancel Stripe subscription");
    return false;
  }
}

export async function deleteUserData(
  userId: number,
  ipAddress?: string | null,
  userAgent?: string | null,
): Promise<DeleteUserResult> {
  const user = await getUserById(userId);
  if (!user) return { success: false, error: "User not found" };
  if (user.role === "admin") {
    return { success: false, error: "Admin accounts cannot be self-deleted. Contact support." };
  }

  /*
    IS A RENDER STILL BEING EXECUTED? — ASKED BEFORE THE SUBSCRIPTION IS
    CANCELLED, AND THAT ORDER IS THE WHOLE REASON THIS READ EXISTS (#1954).

    The control is the LOCKING read inside `deleteUserAccount`'s transaction,
    which is race-free; this one is a plain check-then-act read and a claim can
    land in the microsecond after it. It is here anyway because the next
    statement cancels a paying customer's Stripe subscription immediately and
    irreversibly. Refusing only at the transaction would leave somebody who
    asked to be erased with their account intact and their plan gone — a money
    harm on the one road where the refusal is expected to be retried.

    So: the cheap read stops the irreversible act, and the locking read stops
    the leak. Both throw the same sentence, from the same constant.
  */
  const inFlightBeforeStripe = await findRenderInFlightForUser(userId);
  if (inFlightBeforeStripe) {
    log.info(
      { userId, operationId: inFlightBeforeStripe.operationId, kind: inFlightBeforeStripe.kind },
      "[DeleteUser] refused before cancelling the subscription — a render is still finishing",
    );
    throw renderStillFinishing();
  }

  const userCredits = await getUserCredits(userId);
  const subscriptionId = userCredits?.stripeSubscriptionId;
  const stripeSubscriptionCancelled = await cancelStripeSubscriptionImmediate(subscriptionId);
  if (!stripeSubscriptionCancelled) {
    return {
      success: false,
      error: "Account deletion stopped because the active subscription could not be cancelled. Contact support.",
    };
  }

  const result = await deleteUserAccount(userId);
  /*
    THE REFUSAL, NOT A FAULT — and it is read BEFORE `success` is (#1954).

    A claim that committed after the pre-flight read above is caught by the
    locking read inside the transaction, which deletes nothing and reports
    `refusal` rather than throwing. It has to be answered before the
    `!result.success` branch below, because that branch writes a FAILED audit
    row and tells the customer to contact support — and neither is true here:
    nothing failed, and there is nothing for support to do.
  */
  if (result.refusal === "render_in_flight") {
    throw renderStillFinishing();
  }
  if (!result.success) {
    await logAuditEvent({
      userId,
      action: AUDIT_ACTIONS.ACCOUNT_DELETED,
      resourceType: "user",
      resourceId: String(userId),
      metadata: { failed: true, deletedCounts: result.deletedCounts },
      severity: "critical",
      ipAddress,
      userAgent,
    }).catch(() => undefined);
    return { success: false, error: "Account deletion failed. Please contact support." };
  }

  const summary: NonNullable<DeleteUserResult["summary"]> = {
    stripeSubscriptionCancelled,
    storageFilesQueued: result.cleanupObjects,
    cleanupBatchId: result.cleanupBatchId,
    modelsDeleted: result.deletedCounts.models,
    generationsDeleted: result.deletedCounts.generations,
    creditsZeroed: result.deletedCounts.credits > 0,
    userAnonymized: result.deletedCounts.user > 0,
  };
  await logAuditEvent({
    userId: null,
    action: AUDIT_ACTIONS.ACCOUNT_DELETED,
    resourceType: "user",
    resourceId: String(userId),
    metadata: { summary, hadSubscription: !!subscriptionId },
    severity: "warning",
    ipAddress,
    userAgent,
  });
  return { success: true, summary };
}
