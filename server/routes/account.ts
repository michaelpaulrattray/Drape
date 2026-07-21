/**
 * Account Router — account deletion (GDPR right to erasure).
 *
 * Provides a self-service endpoint for users to delete their own account
 * and all associated data. Requires confirmation via typed phrase.
 */
import { protectedProcedure, router } from "../_core/trpc";
import { deleteUserData } from "../security/deleteUserData";
import { exportUserData } from "../db/gdprExport";
import { logAuditEvent } from "../auditLog";
import { AUDIT_ACTIONS } from "../../drizzle/schema";
import { checkRateLimit, RATE_LIMITS } from "../security/rateLimit";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("routes/account");

export const accountRouter = router({
  /**
   * Export all personal data for the authenticated user (GDPR Article 20).
   * Returns a structured JSON object with all user data.
   * Rate limited to 1 request per 5 minutes.
   */
  exportData: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    // Rate limit: 1 export per 5 minutes
    checkRateLimit(`data-export:${userId}`, {
      maxRequests: 1,
      windowMs: 300_000,
    });

    await logAuditEvent({
      action: AUDIT_ACTIONS.DATA_EXPORT_REQUESTED,
      userId,
      severity: "info",
      metadata: { requestedAt: new Date().toISOString() },
    });

    const data = await exportUserData(userId);
    if (!data) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User data not found.",
      });
    }

    return data;
  }),

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
          requestedAt: new Date().toISOString(),
        },
      });

      // Execute cascading deletion
      const result = await deleteUserData(
        userId,
        ctx.req.ip,
        ctx.req.headers["user-agent"] as string | undefined,
      );

      if (!result.success) {
        await logAuditEvent({
          action: AUDIT_ACTIONS.ACCOUNT_DELETION_FAILED,
          userId,
          severity: "critical",
          metadata: {
            error: result.error,
          },
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Account deletion failed. Please contact support.",
        });
      }

      // Log completion (audit log was anonymized, so use null userId)
      await logAuditEvent({
        action: AUDIT_ACTIONS.ACCOUNT_DELETION_COMPLETED,
        userId: null,
        severity: "critical",
        metadata: {
          deletedUserId: userId,
          cleanupBatchId: result.summary?.cleanupBatchId ?? null,
          cleanupObjects: result.summary?.storageFilesQueued ?? 0,
          completedAt: new Date().toISOString(),
        },
      });

      return {
        success: true,
        message: "Your account and all associated data have been permanently deleted.",
      };
    }),
});
