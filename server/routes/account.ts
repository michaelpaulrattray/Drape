/**
 * Account Router — account deletion (GDPR right to erasure).
 *
 * Provides a self-service endpoint for users to delete their own account
 * and all associated data. Requires confirmation via typed phrase.
 */
import { protectedProcedure, router } from "../_core/trpc";
import { deleteUserAccount } from "../db/accountDeletion";
import { storageDelete } from "../storage";
import { logAuditEvent } from "../auditLog";
import { AUDIT_ACTIONS } from "../../drizzle/schema";
import { checkRateLimit, RATE_LIMITS } from "../security/rateLimit";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const accountRouter = router({
  /**
   * Delete the authenticated user's account and all associated data.
   * Requires the user to type "DELETE MY ACCOUNT" as confirmation.
   */
  deleteAccount: protectedProcedure
    .input(
      z.object({
        confirmation: z
          .string()
          .refine((val) => val === "DELETE MY ACCOUNT", {
            message: 'You must type "DELETE MY ACCOUNT" to confirm.',
          }),
      }),
    )
    .mutation(async ({ ctx }) => {
      const userId = ctx.user.id;
      const userName = ctx.user.name || ctx.user.displayName || "unknown";
      const userEmail = ctx.user.email || "unknown";

      // Rate limit: 1 attempt per 5 minutes to prevent abuse
      checkRateLimit(`account-delete:${userId}`, {
        maxRequests: 1,
        windowMs: 300_000,
      });

      // Log the deletion request before executing
      await logAuditEvent({
        action: AUDIT_ACTIONS.ACCOUNT_DELETION_REQUESTED,
        userId,
        severity: "critical",
        metadata: {
          userName,
          userEmail,
          requestedAt: new Date().toISOString(),
        },
      });

      // Execute cascading deletion
      const result = await deleteUserAccount(userId);

      if (!result.success) {
        await logAuditEvent({
          action: AUDIT_ACTIONS.ACCOUNT_DELETION_FAILED,
          userId,
          severity: "critical",
          metadata: {
            error: result.error,
            deletedCounts: result.deletedCounts,
          },
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Account deletion failed. Please contact support.",
        });
      }

      // Clean up S3 storage (best-effort, don't block on failures)
      const s3Errors: string[] = [];
      for (const key of result.storageKeysToDelete) {
        try {
          await storageDelete(key);
        } catch (error) {
          s3Errors.push(key);
          console.warn(`[AccountDeletion] Failed to delete S3 key: ${key}`, error);
        }
      }

      // Log completion (audit log was anonymized, so use null userId)
      await logAuditEvent({
        action: AUDIT_ACTIONS.ACCOUNT_DELETION_COMPLETED,
        userId: null,
        severity: "critical",
        metadata: {
          deletedUserId: userId,
          deletedUserName: userName,
          deletedCounts: result.deletedCounts,
          s3KeysDeleted: result.storageKeysToDelete.length - s3Errors.length,
          s3KeysFailed: s3Errors.length,
          completedAt: new Date().toISOString(),
        },
      });

      return {
        success: true,
        message: "Your account and all associated data have been permanently deleted.",
      };
    }),
});
