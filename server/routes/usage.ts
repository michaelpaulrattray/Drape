import { protectedProcedure, router } from "../_core/trpc";
import { getCreditHistory, getUsageStats, getDailyUsage, getCycleSpend } from "../db";
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

  /**
   * WHAT THIS ACCOUNT HAS SPENT THIS BILLING CYCLE — #624, his approved
   * option (a): *"(a), fix it, not urgent."*
   *
   * The three surfaces that quote a cycle's spend (the Usage pane, Change plan
   * and Add credits) used to reassemble it out of `getDailyUsage`, which
   * answers in whole UTC days and caps at 90 of them. A real billing period
   * begins at a mid-day INSTANT, so the reassembly counted up to a day of the
   * previous cycle — and on an annual plan it could not cover the period at
   * all. This answers the question they are actually asking.
   *
   * ⚠ **IT TAKES NO INPUT, AND THAT IS THE CONTROL.** The window is the
   * account's own `currentPeriodStart` read on the server; a client-supplied
   * boundary on a surface that recommends a plan is a number the customer's
   * browser gets to choose. Enforcement invariant 3 — the user comes from
   * `ctx.user.id` — and there is nothing else to send.
   */
  getCycleSpend: protectedProcedure.query(async ({ ctx }) => {
    return getCycleSpend(ctx.user.id);
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
