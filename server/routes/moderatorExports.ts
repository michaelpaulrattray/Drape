import { moderatorProcedure, router } from "../_core/trpc";
import { z } from "zod";
import {
  displayBalance,
  displayMovement,
  displayPrice,
  staffLedgerProse,
} from "../../shared/creditDisplay";

function escapeCsv(val: string): string {
  if (val.includes('"') || val.includes(',') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

/**
 * The credit-history CSV, as a pure function so its figures can be driven (#2027).
 *
 * Every credit column names its scale. The ledger columns are the books and
 * match the audit log; the credits columns are what the customer and the
 * moderator's Credits tab read. Until #2027 the file said `Amount` and
 * `Balance After` over ledger figures and printed each stored description with
 * its composed ledger figures bare — on the same road as a request form that
 * takes the customer's figure (#2010), so a copied number granted five times
 * over. A description is restated through `staffLedgerProse`; the stored row
 * is untouched.
 */
export function creditHistoryCsv(
  transactions: readonly {
    id: number;
    createdAt: Date | string;
    type: string;
    amount: number;
    balanceAfter: number;
    description?: string | null;
    referenceId?: string | null;
    engineUsed?: string | null;
  }[],
): string {
  const header =
    "ID,Timestamp,Type,Amount (credits),Amount (ledger),Balance After (credits),Balance After (ledger),Description,Reference ID,Engine Used";
  const rows = transactions.map((tx) => {
    const ts = new Date(tx.createdAt).toISOString();
    return [
      tx.id, ts, tx.type,
      displayMovement(tx.amount), tx.amount,
      displayBalance(tx.balanceAfter), tx.balanceAfter,
      tx.description ? escapeCsv(staffLedgerProse(tx.description)) : "",
      tx.referenceId ?? "", tx.engineUsed ?? "",
    ].join(",");
  });
  return [header, ...rows].join("\n");
}

/**
 * The generation-history CSV (#2027): the cost names its scale both ways, as
 * the Generations tab's COST fact does. A charge rounds UP (`displayPrice`).
 */
export function generationHistoryCsv(
  generations: readonly {
    id: number;
    createdAt: Date | string;
    completedAt?: Date | string | null;
    type: string;
    status: string;
    pointsCost: number;
    modelName?: string | null;
    modelId?: number | string | null;
    hasResult: boolean;
    errorMessage?: string | null;
  }[],
): string {
  // "Has Result" replaced the image-link column: a CSV of permanent public
  // links to a customer's work is the staff image boundary at its worst —
  // it walks out of the building. Support needs to know an image was
  // produced, not to hold it (CLAUDE.md, "Metadata only is a boundary").
  const header =
    "ID,Timestamp,Type,Status,Cost (credits),Cost (ledger),Model Name,Model ID,Has Result,Error Message,Completed At";
  const rows = generations.map((gen) => {
    const ts = new Date(gen.createdAt).toISOString();
    const completedTs = gen.completedAt ? new Date(gen.completedAt).toISOString() : "";
    return [
      gen.id, ts, gen.type, gen.status,
      displayPrice(gen.pointsCost), gen.pointsCost,
      gen.modelName ? escapeCsv(gen.modelName) : "",
      gen.modelId ?? "",
      gen.hasResult ? "yes" : "no",
      gen.errorMessage ? escapeCsv(gen.errorMessage) : "",
      completedTs,
    ].join(",");
  });
  return [header, ...rows].join("\n");
}

export const moderatorExportsRouter = router({
  exportAuditLogsCsv: moderatorProcedure
    .input(z.object({
      severity: z.enum(["info", "warning", "critical", "all"]).optional().default("all"),
      actionCategory: z.enum(["billing", "model", "security", "moderator", "abuse", "all"]).optional().default("all"),
      userId: z.number().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const { getFilteredAuditLogs, logAuditEvent } = await import("../auditLog");
      const result = await getFilteredAuditLogs({
        limit: 5000,
        offset: 0,
        severity: input?.severity === "all" ? undefined : input?.severity,
        actionCategory: input?.actionCategory === "all" ? undefined : input?.actionCategory,
        userId: input?.userId,
        startDate: input?.startDate ? new Date(input.startDate) : undefined,
        endDate: input?.endDate ? new Date(input.endDate) : undefined,
      });

      const { AUDIT_ACTIONS } = await import("../../drizzle/schema");
      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.AUDIT_LOG_EXPORTED,
        resourceType: "audit_log",
        metadata: { totalExported: result.logs.length, filters: input },
        severity: "info",
      });

      const header = "ID,Timestamp,Severity,Action,User ID,IP Address,Resource Type,Resource ID,Metadata";
      const rows = result.logs.map((log) => {
        const ts = new Date(log.createdAt).toISOString();
        const meta = log.metadata ? escapeCsv(JSON.stringify(log.metadata)) : "";
        return [
          log.id, ts, log.severity, escapeCsv(log.action),
          log.userId ?? "", log.ipAddress ?? "",
          log.resourceType ?? "", log.resourceId ?? "", meta,
        ].join(",");
      });

      return { csv: [header, ...rows].join("\n"), total: result.logs.length };
    }),

  exportUserCreditHistoryCsv: moderatorProcedure
    .input(z.object({
      userId: z.number(),
      type: z.enum(["generation", "purchase", "bonus", "refund", "signup", "topup", "subscription", "admin_add", "admin_deduct", "all"]).optional().default("all"),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { getDetailedCreditHistory } = await import("../db");
      const { logAuditEvent } = await import("../auditLog");
      const { AUDIT_ACTIONS } = await import("../../drizzle/schema");

      const result = await getDetailedCreditHistory(input.userId, {
        limit: 5000,
        offset: 0,
        type: input.type === "all" ? undefined : input.type,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
      });

      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.CREDIT_HISTORY_EXPORTED,
        resourceType: "credit_history",
        metadata: { targetUserId: input.userId, totalExported: result.transactions.length, filters: input },
        severity: "info",
      });

      return { csv: creditHistoryCsv(result.transactions), total: result.transactions.length };
    }),

  exportUserGenerationHistoryCsv: moderatorProcedure
    .input(z.object({
      userId: z.number(),
      status: z.enum(["pending", "processing", "completed", "failed", "all"]).optional().default("all"),
      type: z.enum(["masterPrompt", "castingImage", "fullBody", "multiView", "iteration", "upscale", "all"]).optional().default("all"),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { getDetailedGenerationHistory } = await import("../db");
      const { logAuditEvent } = await import("../auditLog");
      const { AUDIT_ACTIONS } = await import("../../drizzle/schema");

      const result = await getDetailedGenerationHistory(input.userId, {
        limit: 5000,
        offset: 0,
        status: input.status === "all" ? undefined : input.status,
        type: input.type === "all" ? undefined : input.type,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
      });

      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.GENERATION_HISTORY_EXPORTED,
        resourceType: "generation_history",
        metadata: {
          targetUserId: input.userId,
          totalExported: result.generations.length,
          filters: input,
          summary: result.summary,
        },
        severity: "info",
      });

      return {
        csv: generationHistoryCsv(result.generations),
        total: result.generations.length,
        summary: result.summary,
      };
    }),
});
