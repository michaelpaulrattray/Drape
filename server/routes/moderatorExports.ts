import { moderatorProcedure, router } from "../_core/trpc";
import { z } from "zod";

function escapeCsv(val: string): string {
  if (val.includes('"') || val.includes(',') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export const moderatorExportsRouter = router({
  exportAuditLogsCsv: moderatorProcedure
    .input(z.object({
      severity: z.enum(["info", "warning", "critical", "all"]).optional().default("all"),
      actionCategory: z.enum(["billing", "model", "security", "abuse", "all"]).optional().default("all"),
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

      const header = "ID,Timestamp,Type,Amount,Balance After,Description,Reference ID,Engine Used";
      const rows = result.transactions.map((tx) => {
        const ts = new Date(tx.createdAt).toISOString();
        return [
          tx.id, ts, tx.type, tx.amount, tx.balanceAfter,
          tx.description ? escapeCsv(tx.description) : "",
          tx.referenceId ?? "", tx.engineUsed ?? "",
        ].join(",");
      });

      return { csv: [header, ...rows].join("\n"), total: result.transactions.length };
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

      const header = "ID,Timestamp,Type,Status,Credits Cost,Model Name,Model ID,Result URL,Error Message,Completed At";
      const rows = result.generations.map((gen) => {
        const ts = new Date(gen.createdAt).toISOString();
        const completedTs = gen.completedAt ? new Date(gen.completedAt).toISOString() : "";
        return [
          gen.id, ts, gen.type, gen.status, gen.pointsCost,
          gen.modelName ? escapeCsv(gen.modelName) : "",
          gen.modelId ?? "",
          gen.resultUrl ? escapeCsv(gen.resultUrl) : "",
          gen.errorMessage ? escapeCsv(gen.errorMessage) : "",
          completedTs,
        ].join(",");
      });

      return {
        csv: [header, ...rows].join("\n"),
        total: result.generations.length,
        summary: result.summary,
      };
    }),
});
