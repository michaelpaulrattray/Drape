import { z } from "zod";
import { moderatorProcedure, router } from "../_core/trpc";
import { getDetailedCreditHistory, getDetailedGenerationHistory } from "../db/moderatorQueries";

export const moderatorReconciliationRouter = router({
  /**
   * Fetches a reconciliation summary comparing credits deducted
   * vs successful generations for a user within an optional date range.
   *
   * Summaries are computed from the returned (date-filtered) rows,
   * NOT from the unfiltered `.summary` fields on the query helpers.
   */
  getUserReconciliation: moderatorProcedure
    .input(
      z.object({
        userId: z.number(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const { userId, startDate, endDate } = input;

      const parsedStart = startDate ? new Date(startDate) : undefined;
      const parsedEnd = endDate ? new Date(endDate + "T23:59:59") : undefined;

      // Fetch credit transactions (date-filtered, high limit for full picture)
      const creditData = await getDetailedCreditHistory(userId, {
        limit: 10000,
        offset: 0,
        startDate: parsedStart,
        endDate: parsedEnd,
      });

      // Fetch generation records (date-filtered, high limit)
      const genData = await getDetailedGenerationHistory(userId, {
        limit: 10000,
        offset: 0,
        startDate: parsedStart,
        endDate: parsedEnd,
      });

      // ── Compute credit summaries from filtered rows ──
      let totalCreditsEarned = 0;
      let totalCreditsSpent = 0;
      const creditsByType: Record<string, { count: number; totalAmount: number }> = {};

      for (const txn of creditData.transactions) {
        if (txn.amount > 0) totalCreditsEarned += txn.amount;
        else totalCreditsSpent += Math.abs(txn.amount);

        if (!creditsByType[txn.type]) {
          creditsByType[txn.type] = { count: 0, totalAmount: 0 };
        }
        creditsByType[txn.type].count++;
        creditsByType[txn.type].totalAmount += txn.amount;
      }

      // ── Compute generation summaries from filtered rows ──
      let completedCount = 0;
      let failedCount = 0;
      let pendingCount = 0;
      let totalGenCreditsUsed = 0;
      let creditsOnFailed = 0;
      let creditsOnCompleted = 0;
      let creditsOnPending = 0;
      const gensByType: Record<string, { count: number; totalCost: number }> = {};

      for (const gen of genData.generations) {
        totalGenCreditsUsed += gen.pointsCost;

        if (gen.status === "completed") {
          completedCount++;
          creditsOnCompleted += gen.pointsCost;
        } else if (gen.status === "failed") {
          failedCount++;
          creditsOnFailed += gen.pointsCost;
        } else {
          pendingCount++;
          creditsOnPending += gen.pointsCost;
        }

        const t = gen.type;
        if (!gensByType[t]) gensByType[t] = { count: 0, totalCost: 0 };
        gensByType[t].count++;
        gensByType[t].totalCost += gen.pointsCost;
      }

      const totalGenerations = genData.generations.length;
      const failureRate = totalGenerations > 0
        ? Math.round((failedCount / totalGenerations) * 10000) / 100
        : 0;

      // ── Discrepancy detection ──
      const generationCreditTxn = creditsByType["generation"] || { count: 0, totalAmount: 0 };
      const creditDeductedForGenerations = Math.abs(generationCreditTxn.totalAmount);
      const discrepancy = creditDeductedForGenerations - totalGenCreditsUsed;
      const hasDiscrepancy = Math.abs(discrepancy) > 0;

      const genTypeBreakdown = Object.entries(gensByType).map(([type, data]) => ({
        type,
        totalCount: data.count,
        totalCost: data.totalCost,
      }));

      return {
        credits: {
          totalEarned: totalCreditsEarned,
          totalSpent: totalCreditsSpent,
          byType: creditsByType,
          generationDeductions: creditDeductedForGenerations,
        },
        generations: {
          total: totalGenerations,
          completed: completedCount,
          failed: failedCount,
          pending: pendingCount,
          totalCreditsUsed: totalGenCreditsUsed,
          creditsOnFailed,
          creditsOnCompleted,
          creditsOnPending,
          failureRate,
          byType: genTypeBreakdown,
        },
        reconciliation: {
          creditDeductedForGenerations,
          generationRecordedCost: totalGenCreditsUsed,
          discrepancy,
          hasDiscrepancy,
          creditsLostToFailures: creditsOnFailed,
          summary: hasDiscrepancy
            ? `Discrepancy of ${Math.abs(discrepancy).toLocaleString()} credits detected between credit transactions and generation records.`
            : creditsOnFailed > 0
              ? `No discrepancy found, but ${creditsOnFailed.toLocaleString()} credits were spent on ${failedCount} failed generation(s).`
              : "No discrepancies found. All credits align with generation records.",
        },
      };
    }),
});
