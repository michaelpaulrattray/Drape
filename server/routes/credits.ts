import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { 
  getUserCredits, getCreditTransactions,
} from "../db";
import { CREDIT_COSTS } from "../casting/aiService";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const creditsRouter = router({
  getBalance: protectedProcedure.query(async ({ ctx }) => {
    const userCredits = await getUserCredits(ctx.user.id);
    if (!userCredits) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Credits record not found",
      });
    }
    return {
      balance: userCredits.balance,
      planTier: userCredits.planTier,
      planExpiresAt: userCredits.planExpiresAt,
      creditsPurchased: userCredits.creditsPurchased,
      creditsUsed: userCredits.creditsUsed,
      rolloverCredits: userCredits.rolloverCredits,
    };
  }),

  getTransactions: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      const transactions = await getCreditTransactions(ctx.user.id, input?.limit ?? 20);
      return transactions;
    }),

  checkBalance: protectedProcedure
    .input(z.object({ required: z.number().positive() }))
    .query(async ({ ctx, input }) => {
      const userCredits = await getUserCredits(ctx.user.id);
      if (!userCredits) {
        return { hasEnough: false, balance: 0, required: input.required };
      }
      return {
        hasEnough: userCredits.balance >= input.required,
        balance: userCredits.balance,
        required: input.required,
      };
    }),
    
  // Get credit costs for UI display
  getCosts: publicProcedure.query(() => {
    return CREDIT_COSTS;
  }),
});

// Legacy alias for backward compatibility
export const pointsRouter = router({
  getBalance: protectedProcedure.query(async ({ ctx }) => {
    const userCredits = await getUserCredits(ctx.user.id);
    if (!userCredits) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Credits record not found",
      });
    }
    return {
      balance: userCredits.balance,
      planTier: userCredits.planTier,
      planExpiresAt: userCredits.planExpiresAt,
    };
  }),
  getTransactions: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      return await getCreditTransactions(ctx.user.id, input?.limit ?? 20);
    }),
  checkBalance: protectedProcedure
    .input(z.object({ required: z.number().positive() }))
    .query(async ({ ctx, input }) => {
      const userCredits = await getUserCredits(ctx.user.id);
      if (!userCredits) {
        return { hasEnough: false, balance: 0, required: input.required };
      }
      return {
        hasEnough: userCredits.balance >= input.required,
        balance: userCredits.balance,
        required: input.required,
      };
    }),
});
