import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  getOrCreateReferralCode,
  claimReferral,
  redeemReferralCode,
  getReferralStats,
  getReferralHistory,
  getUserByReferralCode,
  recordEmailInvite,
  isValidReferralCodeFormat,
} from "../db";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { REFERRAL_REWARD_CREDITS } from "../../drizzle/schema";
import { checkRateLimit, getClientIp } from "../security/rateLimit";
import { isDisposableEmail } from "../security/disposableEmails";
import { sendReferralInviteEmail } from "../klaviyo";

/** Rate limit configs */
const INVITE_RATE = { maxRequests: 10, windowMs: 24 * 60 * 60 * 1000, keyPrefix: "ref-invite" };
const REDEEM_RATE = { maxRequests: 5, windowMs: 60 * 60 * 1000, keyPrefix: "ref-redeem" };

export const referralRouter = router({
  /**
   * Get the current user's referral code and link.
   * Auto-generates a code if one doesn't exist.
   */
  getMyCode: protectedProcedure.query(async ({ ctx }) => {
    const ip = getClientIp(ctx.req);
    const code = await getOrCreateReferralCode(ctx.user.id, ip);
    if (!code) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to generate referral code",
      });
    }

    const baseUrl = ctx.req.headers.origin || "https://formastudio.ai";
    const referralLink = `${baseUrl}?ref=${code}`;

    return {
      code,
      referralLink,
      rewardCredits: REFERRAL_REWARD_CREDITS,
    };
  }),

  /**
   * Get referral statistics for the current user.
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const stats = await getReferralStats(ctx.user.id);
    return {
      ...stats,
      rewardCredits: REFERRAL_REWARD_CREDITS,
    };
  }),

  /**
   * Get referral history (invitation list) for the current user.
   * Scoped to current user only (authorization enforced).
   */
  getHistory: protectedProcedure.query(async ({ ctx }) => {
    const history = await getReferralHistory(ctx.user.id);
    return history;
  }),

  /**
   * Send an email invitation (records the invite, email delivery is future).
   * Rate limited: 10/day per user.
   */
  sendInvite: protectedProcedure
    .input(
      z.object({
        email: z.string().email().max(320),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ip = getClientIp(ctx.req);

      // Rate limit: 10 invites per day
      const rateCheck = checkRateLimit(`${ctx.user.id}`, INVITE_RATE);
      if (!rateCheck.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Invite limit reached. Try again in ${Math.ceil(rateCheck.resetIn / 60000)} minutes.`,
        });
      }

      // Block self-invite
      if (ctx.user.email && input.email.toLowerCase() === ctx.user.email.toLowerCase()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot invite yourself",
        });
      }

      // Block disposable email domains
      if (isDisposableEmail(input.email)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Please use a permanent email address",
        });
      }

      const result = await recordEmailInvite(ctx.user.id, input.email, ip);
      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error || "Failed to send invite",
        });
      }

      // Send email via Klaviyo (non-blocking — invite is recorded regardless)
      const baseUrl = ctx.req.headers.origin || "https://formastudio.ai";
      const code = await getOrCreateReferralCode(ctx.user.id, ip);
      const referralLink = code ? `${baseUrl}?ref=${code}` : baseUrl;

      sendReferralInviteEmail({
        inviteeEmail: input.email,
        referrerName: ctx.user.name || "A FormaStudio user",
        referralLink,
        rewardCredits: REFERRAL_REWARD_CREDITS,
      }).catch((err) => {
        console.error("[Referral] Klaviyo email delivery failed:", err);
      });

      return { sent: true };
    }),

  /**
   * Redeem a referral code (explicit action from Redeem modal).
   * Rate limited: 5/hour per user.
   * Validation: code format, self-referral, one-time per user.
   */
  redeem: protectedProcedure
    .input(
      z.object({
        code: z.string().min(1).max(20).transform((v) => v.toUpperCase()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ip = getClientIp(ctx.req);

      // Rate limit: 5 redemptions per hour
      const rateCheck = checkRateLimit(`${ctx.user.id}`, REDEEM_RATE);
      if (!rateCheck.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Too many attempts. Try again in ${Math.ceil(rateCheck.resetIn / 60000)} minutes.`,
        });
      }

      // Validate code format
      if (!isValidReferralCodeFormat(input.code)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid referral code format. Expected: FORMA-XXXXXX",
        });
      }

      const result = await redeemReferralCode(ctx.user.id, input.code, ip);
      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error || "Failed to redeem code",
        });
      }

      return { redeemed: true, rewardCredits: REFERRAL_REWARD_CREDITS };
    }),

  /**
   * Claim a referral code during/after signup.
   * Called by the frontend after OAuth callback when ?ref= param was captured.
   */
  claim: protectedProcedure
    .input(z.object({ referralCode: z.string().min(1).max(20) }))
    .mutation(async ({ ctx, input }) => {
      const ip = getClientIp(ctx.req);
      const result = await claimReferral(ctx.user.id, input.referralCode, ip);
      return { claimed: result.success };
    }),

  /**
   * Validate a referral code (public — used on landing page before signup).
   */
  validate: publicProcedure
    .input(z.object({ code: z.string().min(1).max(20) }))
    .query(async ({ input }) => {
      const user = await getUserByReferralCode(input.code);
      return {
        valid: !!user,
        referrerName: user?.name ? user.name.split(" ")[0] : null,
      };
    }),
});
