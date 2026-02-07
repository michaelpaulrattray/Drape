import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { 
  getUserCredits, getCreditTransactions, deductCredits, addCredits,
} from "../db";
import { CREDIT_COSTS } from "../aiService";
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

  deduct: protectedProcedure
    .input(z.object({
      amount: z.number().positive(),
      type: z.enum(["generation", "purchase", "bonus", "refund", "signup", "topup", "subscription"]),
      description: z.string(),
      referenceId: z.string().optional(),
      engineUsed: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await deductCredits(
        ctx.user.id,
        input.amount,
        input.type,
        input.description,
        input.referenceId,
        input.engineUsed
      );
      
      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error || "Failed to deduct credits",
        });
      }
      
      return { success: true, newBalance: result.newBalance };
    }),

  add: protectedProcedure
    .input(z.object({
      amount: z.number().positive(),
      type: z.enum(["generation", "purchase", "bonus", "refund", "signup", "topup", "subscription"]),
      description: z.string(),
      referenceId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await addCredits(
        ctx.user.id,
        input.amount,
        input.type,
        input.description,
        input.referenceId
      );
      
      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error || "Failed to add credits",
        });
      }
      
      return { success: true, newBalance: result.newBalance };
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
