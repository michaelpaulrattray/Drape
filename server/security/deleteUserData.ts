/**
 * Account-erasure coordinator.
 *
 * External subscription cancellation happens first. Database erasure and the
 * exact-owned storage manifest then commit through deleteUserAccount's single
 * transaction. No request thread calls storageDelete; R7-5D's leased worker
 * owns the durable cleanup batch after commit.
 */
import { getUserCredits, getUserById } from "../db";
import { deleteUserAccount } from "../db/accountDeletion";
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
