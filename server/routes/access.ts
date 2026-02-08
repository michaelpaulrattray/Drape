/**
 * Access Code Router — invite code validation for pre-launch gating.
 *
 * Endpoints:
 *   - access.redeem: Protected — validates an invite code and approves the user
 *   - access.status: Protected — checks if the current user is approved
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { redeemInviteCode } from "../db/inviteCodes";
import { logAuditEvent, AUDIT_ACTIONS } from "../auditLog";
import { checkRateLimit } from "../security/rateLimit";

export const accessRouter = router({
  /**
   * Redeem an invite/access code to unlock the dashboard.
   * Rate limited: 5 attempts per 15 minutes per user.
   */
  redeem: protectedProcedure
    .input(
      z.object({
        code: z.string().min(1, "Access code is required").max(64),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Rate limit: 5 attempts per 15 minutes
      const rl = checkRateLimit(`access-redeem:${ctx.user.id}`, {
        maxRequests: 5,
        windowMs: 15 * 60 * 1000,
        keyPrefix: "access_redeem",
      });
      if (!rl.allowed) {
        return { success: false, error: "Too many attempts. Please try again later." };
      }

      const result = await redeemInviteCode(ctx.user.id, input.code);

      // Audit log regardless of outcome
      await logAuditEvent({
        userId: ctx.user.id,
        action: result.success
          ? AUDIT_ACTIONS.LOGIN_SUCCESS
          : AUDIT_ACTIONS.LOGIN_FAILED,
        resourceType: "auth",
        resourceId: `invite-code:${input.code.toUpperCase()}`,
        metadata: {
          success: result.success,
          error: result.error,
          code: input.code.toUpperCase(),
        },
        severity: result.success ? "info" : "warning",
      });

      return result;
    }),

  /**
   * Check if the current user is approved (has access).
   */
  status: protectedProcedure.query(({ ctx }) => {
    return {
      approved: ctx.user.approved ?? false,
      isAdmin: ctx.user.role === "admin",
    };
  }),
});
