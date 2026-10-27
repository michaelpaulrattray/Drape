/**
 * Access Code Router — invite code validation for pre-launch gating.
 *
 * Endpoints:
 *   - access.validate: Public — checks if an invite code is valid (no auth required, no consumption)
 *   - access.redeem: Protected — validates an invite code and approves the user
 *   - access.status: Protected — checks if the current user is approved
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, publicProcedure, onboardingProcedure } from "../_core/trpc";
import { redeemInviteCode } from "../db/inviteCodes";
import { validateInviteCode } from "../db/validateInviteCode";
import { logAuditEvent, AUDIT_ACTIONS } from "../auditLog";
import { checkRateLimit, getClientIp } from "../security/rateLimit";
import { ACCESS_CODE_MAX_LENGTH } from "../../shared/inputLimits";
import { waitPhrase } from "@shared/waitPhrase";

/**
 * The sentence both procedures throw when the limiter says no (#2371).
 *
 * Until #2371 both answered a refusal as an ordinary 200 carrying an `error`
 * field, which invariant 6 forbids: the client could not tell "too many tries"
 * from "this code is not valid", there was no wait to show, and nothing keyed
 * on the status ever fired. Now a real TOO_MANY_REQUESTS, in the shape
 * `routes/referral.ts` already uses, and it says when to come back.
 */
function accessCodeRefusalMessage(resetIn: number): string {
  return `Too many attempts. Try again ${waitPhrase(resetIn)}.`;
}

export const accessRouter = router({
  /**
   * Validate an invite code WITHOUT consuming it.
   * Public — no auth required. Used on login page before OAuth.
   * Rate limited: 10 attempts per 5 minutes per IP.
   */
  validate: publicProcedure
    // .strict() — invariant 4 on a public surface (ruled fable-1435 §2). Safe at
    // the wire, checked rather than assumed: `client/src/pages/Login.tsx` is the
    // only caller and it sends `{ code }` alone.
    .input(
      z.object({
        code: z.string().min(1, "Access code is required").max(ACCESS_CODE_MAX_LENGTH),
      }).strict()
    )
    .mutation(async ({ ctx, input }) => {
      const clientIp = getClientIp(ctx.req);
      const rl = checkRateLimit(`access-validate:${clientIp}`, {
        maxRequests: 10,
        windowMs: 5 * 60 * 1000,
        keyPrefix: "access_validate",
      });
      if (!rl.allowed) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: accessCodeRefusalMessage(rl.resetIn) });
      }

      const result = await validateInviteCode(input.code);
      return result;
    }),

  /**
   * Redeem an invite/access code to unlock the dashboard.
   * Rate limited: 5 attempts per 15 minutes per user.
   */
  redeem: onboardingProcedure
    .input(
      z.object({
        code: z.string().min(1, "Access code is required").max(ACCESS_CODE_MAX_LENGTH),
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
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: accessCodeRefusalMessage(rl.resetIn) });
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
  status: onboardingProcedure.query(({ ctx }) => {
    return {
      approved: ctx.user.approved ?? false,
      isAdmin: ctx.user.role === "admin",
    };
  }),
});
