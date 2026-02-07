import { protectedProcedure, router } from "../_core/trpc";
import { getCreditHistory, getUsageStats, getDailyUsage } from "../db";
import { z } from "zod";

export const usageRouter = router({
  // Get credit transaction history with pagination
  getHistory: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).optional().default(20),
      offset: z.number().min(0).optional().default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const result = await getCreditHistory(
        ctx.user.id,
        input?.limit || 20,
        input?.offset || 0
      );
      return result;
    }),

  // Get usage statistics summary
  getStats: protectedProcedure
    .input(z.object({
      days: z.number().min(1).max(365).optional().default(30),
    }).optional())
    .query(async ({ ctx, input }) => {
      const stats = await getUsageStats(ctx.user.id, input?.days || 30);
      return stats;
    }),

  // Get daily usage data for charts
  getDailyUsage: protectedProcedure
    .input(z.object({
      days: z.number().min(1).max(90).optional().default(30),
    }).optional())
    .query(async ({ ctx, input }) => {
      const dailyData = await getDailyUsage(ctx.user.id, input?.days || 30);
      return dailyData;
    }),
});
