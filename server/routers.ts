import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getUserPoints, getPointTransactions, deductPoints, addPoints } from "./db";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  points: router({
    // Get current user's points balance
    getBalance: protectedProcedure.query(async ({ ctx }) => {
      const userPoints = await getUserPoints(ctx.user.id);
      if (!userPoints) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Points record not found",
        });
      }
      return {
        balance: userPoints.balance,
        planTier: userPoints.planTier,
        planExpiresAt: userPoints.planExpiresAt,
      };
    }),

    // Get transaction history
    getTransactions: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(20) }).optional())
      .query(async ({ ctx, input }) => {
        const transactions = await getPointTransactions(ctx.user.id, input?.limit ?? 20);
        return transactions;
      }),

    // Deduct points (for internal use during generations)
    deduct: protectedProcedure
      .input(z.object({
        amount: z.number().positive(),
        type: z.enum(["generation", "purchase", "bonus", "refund", "signup"]),
        description: z.string(),
        referenceId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await deductPoints(
          ctx.user.id,
          input.amount,
          input.type,
          input.description,
          input.referenceId
        );
        
        if (!result.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: result.error || "Failed to deduct points",
          });
        }
        
        return { success: true, newBalance: result.newBalance };
      }),

    // Add points (for purchases, bonuses, refunds)
    add: protectedProcedure
      .input(z.object({
        amount: z.number().positive(),
        type: z.enum(["generation", "purchase", "bonus", "refund", "signup"]),
        description: z.string(),
        referenceId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await addPoints(
          ctx.user.id,
          input.amount,
          input.type,
          input.description,
          input.referenceId
        );
        
        if (!result.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: result.error || "Failed to add points",
          });
        }
        
        return { success: true, newBalance: result.newBalance };
      }),

    // Check if user has enough points
    checkBalance: protectedProcedure
      .input(z.object({ required: z.number().positive() }))
      .query(async ({ ctx, input }) => {
        const userPoints = await getUserPoints(ctx.user.id);
        if (!userPoints) {
          return { hasEnough: false, balance: 0, required: input.required };
        }
        return {
          hasEnough: userPoints.balance >= input.required,
          balance: userPoints.balance,
          required: input.required,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
