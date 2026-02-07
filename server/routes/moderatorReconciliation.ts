import { z } from "zod";
import { moderatorProcedure, router } from "../_core/trpc";
import { getDetailedCreditHistory, getDetailedGenerationHistory, getUsersWithDiscrepancies } from "../db/moderatorQueries";
import { freezeUser, unfreezeUser } from "../db";
import { logAuditEvent, AUDIT_ACTIONS } from "../auditLog";
import { SlackAlerts } from "../slack/slackNotification";
import { getDb } from "../db/connection";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

/** Auto-freeze threshold: users with discrepancy >= this are frozen automatically. */
const AUTO_FREEZE_THRESHOLD = 200;

/** Build a human-readable summary explaining the reconciliation result. */
function buildSummary(ctx: {
  hasDiscrepancy: boolean;
  discrepancy: number;
  failedCount: number;
  totalRefunds: number;
  creditsOnFailed: number;
}): string {
  const { hasDiscrepancy, discrepancy, failedCount, totalRefunds, creditsOnFailed } = ctx;

  if (!hasDiscrepancy) {
    if (failedCount > 0) {
      return `No discrepancy. ${totalRefunds.toLocaleString()} credits refunded for ${failedCount} failed generation(s).`;
    }
    return "No discrepancies found. All credits align with generation records.";
  }

  const absDisc = Math.abs(discrepancy).toLocaleString();

  // Check if failed generations without refunds explain the gap
  const unrefundedFailureCost = creditsOnFailed - totalRefunds;
  if (failedCount > 0 && unrefundedFailureCost > 0 && Math.abs(discrepancy - unrefundedFailureCost) <= 1) {
    return `Discrepancy of ${absDisc} credits — likely caused by ${failedCount} failed generation(s) without matching refunds (pre-atomic-credits or refund failure).`;
  }

  if (failedCount > 0 && totalRefunds === 0) {
    return `Discrepancy of ${absDisc} credits. ${failedCount} failed generation(s) found with no refund transactions — credits may have been deducted before automatic refunds were enabled.`;
  }

  if (failedCount > 0 && unrefundedFailureCost > 0) {
    return `Discrepancy of ${absDisc} credits. Partial refunds detected: ${totalRefunds.toLocaleString()} credits refunded but ${creditsOnFailed.toLocaleString()} expected for ${failedCount} failed generation(s).`;
  }

  return `Discrepancy of ${absDisc} credits detected between net credit cost and generation records.`;
}

export const moderatorReconciliationRouter = router({
  /** Returns users whose credit discrepancy exceeds the given threshold. */
  getFlaggedUsers: moderatorProcedure
    .input(
      z.object({
        threshold: z.number().min(1).default(50),
      })
    )
    .query(async ({ input }) => {
      const result = await getUsersWithDiscrepancies(input.threshold);

      // Auto-freeze: freeze users with discrepancy >= AUTO_FREEZE_THRESHOLD who aren't already frozen
      if (result.users.length > 0) {
        const db = await getDb();
        if (db) {
          for (const flagged of result.users) {
            if (Math.abs(flagged.discrepancy) >= AUTO_FREEZE_THRESHOLD) {
              const [user] = await db
                .select({ frozenAt: users.frozenAt, name: users.name })
                .from(users)
                .where(eq(users.id, flagged.userId))
                .limit(1);

              if (user && !user.frozenAt) {
                const reason = `Auto-frozen: credit discrepancy of ${Math.abs(flagged.discrepancy)} credits detected (threshold: ${AUTO_FREEZE_THRESHOLD})`;
                await freezeUser(flagged.userId, reason, "system");
                await SlackAlerts.accountAutoFrozen(
                  flagged.userId,
                  flagged.userName || `User ${flagged.userId}`,
                  Math.abs(flagged.discrepancy),
                  AUTO_FREEZE_THRESHOLD
                );
                await logAuditEvent({
                  userId: flagged.userId,
                  action: AUDIT_ACTIONS.ACCOUNT_AUTO_FROZEN,
                  resourceType: "user",
                  resourceId: String(flagged.userId),
                  metadata: {
                    discrepancy: flagged.discrepancy,
                    threshold: AUTO_FREEZE_THRESHOLD,
                    trigger: "discrepancy_scan",
                  },
                });
              }
            }
          }
        }
      }

      return result;
    }),

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
      let creditsOnCompleted = 0;
      let creditsOnFailed = 0;
      let creditsOnPending = 0;
      const gensByType: Record<string, { count: number; totalCost: number }> = {};

      for (const gen of genData.generations) {
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
      const grossGenerationDeductions = Math.abs(generationCreditTxn.totalAmount);

      const refundCreditTxn = creditsByType["refund"] || { count: 0, totalAmount: 0 };
      const totalRefunds = Math.max(0, refundCreditTxn.totalAmount);

      const netGenerationCost = grossGenerationDeductions - totalRefunds;
      const discrepancy = netGenerationCost - creditsOnCompleted - creditsOnPending;
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
          grossGenerationDeductions,
          totalRefunds,
          netGenerationCost,
        },
        generations: {
          total: totalGenerations,
          completed: completedCount,
          failed: failedCount,
          pending: pendingCount,
          creditsOnCompleted,
          creditsOnFailed,
          creditsOnPending,
          failureRate,
          byType: genTypeBreakdown,
        },
        reconciliation: {
          grossGenerationDeductions,
          totalRefunds,
          netGenerationCost,
          completedGenerationCost: creditsOnCompleted,
          pendingGenerationCost: creditsOnPending,
          discrepancy,
          hasDiscrepancy,
          summary: buildSummary({
            hasDiscrepancy,
            discrepancy,
            failedCount,
            totalRefunds,
            creditsOnFailed,
          }),
        },
      };
    }),

  /** Moderator manual freeze: for immediate action on abuse, exploits, or suspicious activity. */
  freezeAccount: moderatorProcedure
    .input(z.object({
      userId: z.number(),
      reason: z.string().min(1, "Reason is required").max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [user] = await db
        .select({ frozenAt: users.frozenAt, name: users.name, email: users.email, role: users.role })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      if (user.frozenAt) throw new TRPCError({ code: "BAD_REQUEST", message: "User is already frozen" });
      if (user.role === "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Cannot freeze admin accounts" });

      const reason = `Manual freeze by moderator: ${input.reason}`;
      await freezeUser(input.userId, reason, String(ctx.user.id));

      await SlackAlerts.accountAutoFrozen(
        input.userId,
        user.name || `User ${input.userId}`,
        0, // no discrepancy — manual freeze
        0
      );

      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.ACCOUNT_AUTO_FROZEN,
        resourceType: "user",
        resourceId: String(input.userId),
        metadata: {
          targetUserName: user.name,
          targetUserEmail: user.email,
          reason: input.reason,
          frozenBy: ctx.user.id,
          frozenByName: ctx.user.name,
          trigger: "moderator_manual",
        },
      });

      return { success: true };
    }),

  /** Moderator direct-unfreeze: lighter than suspension, mods can resolve directly. */
  unfreezeAccount: moderatorProcedure
    .input(z.object({
      userId: z.number(),
      notes: z.string().min(1, "Review notes are required").max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [user] = await db
        .select({ frozenAt: users.frozenAt, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      if (!user.frozenAt) throw new TRPCError({ code: "BAD_REQUEST", message: "User is not frozen" });

      const result = await unfreezeUser(input.userId);
      if (!result.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error || "Failed to unfreeze" });
      }

      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.ACCOUNT_UNFROZEN,
        resourceType: "user",
        resourceId: String(input.userId),
        metadata: {
          targetUserName: user.name,
          targetUserEmail: user.email,
          reviewNotes: input.notes,
          unfrozenBy: ctx.user.id,
          unfrozenByName: ctx.user.name,
        },
      });

      return { success: true };
    }),
});
