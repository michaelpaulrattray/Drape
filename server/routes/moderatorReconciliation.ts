import { z } from "zod";
import { moderatorProcedure, router } from "../_core/trpc";
import { getDetailedCreditHistory, getDetailedGenerationHistory, getUsersWithDiscrepancies } from "../db/moderatorQueries";
import { computeDiscrepancy, getUserRecordCosts, type DiscrepancyReading } from "../db/discrepancyQueries";
import { freezeUser, unfreezeUser } from "../db";
import { logAuditEvent, AUDIT_ACTIONS } from "../auditLog";
import { SlackAlerts } from "../slack/slackNotification";
import { sendAccountFrozenEmail } from "../klaviyo";
import { getDb } from "../db/connection";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createModuleLogger } from "../logging/logger";
import { FREEZE_REASON_MAX_LENGTH, UNFREEZE_NOTES_MAX_LENGTH } from "../../shared/inputLimits";
const log = createModuleLogger("routes/moderatorReconciliation");

/**
 * Build a human-readable summary explaining the reconciliation result.
 *
 * The rule it explains is `computeDiscrepancy` (`server/db/discrepancyQueries.ts`,
 * header): charges against the records that recorded them. An unrefunded
 * failure is NOT a discrepancy — failures refund only catastrophically by
 * founder ruling — so it is named here as information, never as a cause.
 */
export function buildSummary(ctx: {
  reading: DiscrepancyReading;
  failedCount: number;
  pendingCount: number;
}): string {
  const { reading, failedCount, pendingCount } = ctx;
  const hasDiscrepancy = Math.abs(reading.discrepancy) > 0;
  const anomalyNote = reading.refundAnomaly
    ? ` ⚠ Refunds (${reading.totalRefunds.toLocaleString()}) exceed every generation charge ever made (${reading.grossDeductions.toLocaleString()}) — this account has been credited more than it was charged; read the refund rows.`
    : "";

  const failureNote =
    failedCount > 0
      ? reading.unrefundedFailureCost > 0
        ? ` ${failedCount} failed generation(s): ${reading.failedCost.toLocaleString()} credits, ${reading.totalRefunds.toLocaleString()} refunded — failures refund only catastrophically by ruling, so the unrefunded ${reading.unrefundedFailureCost.toLocaleString()} is expected.`
        : ` ${failedCount} failed generation(s): ${reading.failedCost.toLocaleString()} credits, against ${reading.totalRefunds.toLocaleString()} refunded overall (not all of it for failures) — failures refund only catastrophically by ruling, so a smaller refund figure here would also be expected.`
      : "";

  if (!hasDiscrepancy) {
    return `No discrepancy. ${reading.grossDeductions.toLocaleString()} credits charged, ${reading.expectedCost.toLocaleString()} recorded.${anomalyNote}${failureNote}`;
  }

  const absDisc = Math.abs(reading.discrepancy).toLocaleString();
  const direction = reading.discrepancy > 0 ? "charged more than the records show" : "charged less than the records show";
  const pendingNote =
    pendingCount > 0
      ? ` ${pendingCount} generation(s) still in flight — a charge can precede its record by minutes, so re-read once they settle.`
      : "";

  return `Discrepancy of ${absDisc} credits — ${direction} (${reading.grossDeductions.toLocaleString()} charged against ${reading.expectedCost.toLocaleString()} recorded).${anomalyNote}${pendingNote}${failureNote}`;
}

export const moderatorReconciliationRouter = router({
  /**
   * Returns users whose credit discrepancy exceeds the given threshold.
   *
   * A READ AND NOTHING ELSE. Until 2026-08-26 this query auto-froze every
   * listed account at |discrepancy| >= 2000 — and its formula was two rulings
   * out of date, so it froze the founder's own account for 22 hours (#119).
   * His word (Crew reply #5): "List-only. A control that can freeze a paying
   * customer should have a person's name on it." Freezing is `freezeAccount`
   * below, with the moderator's id in the audit row.
   */
  getFlaggedUsers: moderatorProcedure
    .input(
      z.object({
        threshold: z.number().min(1).default(50),
      })
    )
    .query(async ({ input }) => {
      return getUsersWithDiscrepancies(input.threshold);
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

      // The record side of the rule, scoped the same way the scan scopes it.
      const recordCosts = await getUserRecordCosts(userId, { startDate: parsedStart, endDate: parsedEnd });

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

      // ── Discrepancy detection — THE RULE, not a copy of it ──
      const generationCreditTxn = creditsByType["generation"] || { count: 0, totalAmount: 0 };
      const refundCreditTxn = creditsByType["refund"] || { count: 0, totalAmount: 0 };

      const reading = computeDiscrepancy({
        grossDeductions: Math.abs(generationCreditTxn.totalAmount),
        totalRefunds: refundCreditTxn.totalAmount,
        completedCost: creditsOnCompleted,
        pendingCost: creditsOnPending,
        failedCost: creditsOnFailed,
        unlinkedCost: recordCosts.unlinkedCost,
        operationCost: recordCosts.operationCost,
      });
      const hasDiscrepancy = Math.abs(reading.discrepancy) > 0;

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
          grossGenerationDeductions: reading.grossDeductions,
          totalRefunds: reading.totalRefunds,
          netGenerationCost: reading.netCost,
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
          grossGenerationDeductions: reading.grossDeductions,
          totalRefunds: reading.totalRefunds,
          netGenerationCost: reading.netCost,
          completedGenerationCost: reading.completedCost,
          pendingGenerationCost: reading.pendingCost,
          failedGenerationCost: reading.failedCost,
          unrefundedFailureCost: reading.unrefundedFailureCost,
          unlinkedRecordCost: reading.unlinkedCost,
          operationRecordCost: reading.operationCost,
          expectedCost: reading.expectedCost,
          discrepancy: reading.discrepancy,
          refundAnomaly: reading.refundAnomaly,
          hasDiscrepancy,
          summary: buildSummary({ reading, failedCount, pendingCount }),
        },
      };
    }),

  /** Moderator manual freeze: for immediate action on abuse, exploits, or suspicious activity. */
  freezeAccount: moderatorProcedure
    .input(z.object({
      userId: z.number(),
      reason: z.string().min(1, "Reason is required").max(FREEZE_REASON_MAX_LENGTH),
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

      await SlackAlerts.accountFrozenByStaff(
        input.userId,
        user.name || `User ${input.userId}`,
        ctx.user.name || `Moderator ${ctx.user.id}`,
        input.reason
      );

      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.ACCOUNT_FROZEN,
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

      // Send freeze notification email (non-blocking)
      if (user.email) {
        sendAccountFrozenEmail({
          userEmail: user.email,
          userName: user.name || `User ${input.userId}`,
          freezeReason: reason,
          frozenBy: ctx.user.name || `Moderator ${ctx.user.id}`,
        }).catch((err) => log.error("[Klaviyo] Manual freeze email failed:", err));
      }

      return { success: true };
    }),

  /** Moderator direct-unfreeze: lighter than suspension, mods can resolve directly. */
  unfreezeAccount: moderatorProcedure
    .input(z.object({
      userId: z.number(),
      notes: z.string().min(1, "Review notes are required").max(UNFREEZE_NOTES_MAX_LENGTH),
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
