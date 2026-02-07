import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  getOrCreateReferralCode,
  claimReferral,
  getReferralStats,
  getUserByReferralCode,
} from "../db";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { REFERRAL_REWARD_CREDITS } from "../../drizzle/schema";

export const referralRouter = router({
  /**
   * Get the current user's referral code and link.
   * Auto-generates a code if one doesn't exist.
   */
  getMyCode: protectedProcedure.query(async ({ ctx }) => {
    const code = await getOrCreateReferralCode(ctx.user.id);
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
   * Claim a referral code during/after signup.
   * Called by the frontend after OAuth callback when ?ref= param was captured.
   */
  claim: protectedProcedure
    .input(z.object({ referralCode: z.string().min(1).max(20) }))
    .mutation(async ({ ctx, input }) => {
      const success = await claimReferral(ctx.user.id, input.referralCode);
      if (!success) {
        // Silently fail — could be self-referral, duplicate, or invalid code
        return { claimed: false };
      }
      return { claimed: true };
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
        referrerName: user?.name ? user.name.split(" ")[0] : null, // First name only
      };
    }),
});
