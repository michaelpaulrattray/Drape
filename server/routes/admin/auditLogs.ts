import { adminProcedure, router } from "../../_core/trpc";
import { z } from "zod";

export const auditLogsRouter = router({
  // Get paginated audit logs with filters
  getAuditLogs: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).optional().default(20),
      offset: z.number().min(0).optional().default(0),
      severity: z.enum(["info", "warning", "critical", "all"]).optional().default("all"),
      actionCategory: z.enum(["billing", "model", "security", "abuse", "all"]).optional().default("all"),
      userId: z.number().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const { getFilteredAuditLogs } = await import("../../auditLog");
      return await getFilteredAuditLogs({
        limit: input?.limit || 20,
        offset: input?.offset || 0,
        severity: input?.severity === "all" ? undefined : input?.severity,
        actionCategory: input?.actionCategory === "all" ? undefined : input?.actionCategory,
        userId: input?.userId,
        startDate: input?.startDate ? new Date(input.startDate) : undefined,
        endDate: input?.endDate ? new Date(input.endDate) : undefined,
      });
    }),

  // Get abuse alerts summary
  getAbuseAlerts: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).optional().default(10),
    }).optional())
    .query(async ({ input }) => {
      const { getAbuseAlertsSummary } = await import("../../auditLog");
      return await getAbuseAlertsSummary(input?.limit || 10);
    }),

  // Get audit log statistics
  getAuditStats: adminProcedure
    .query(async () => {
      const { getAuditStatistics } = await import("../../auditLog");
      return await getAuditStatistics();
    }),

  // Get single audit log details
  getAuditLogById: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const { getAuditLogById } = await import("../../auditLog");
      return await getAuditLogById(input.id);
    }),

  // Export audit logs as CSV
  exportAuditLogs: adminProcedure
    .input(z.object({
      severity: z.enum(["info", "warning", "critical", "all"]).optional().default("all"),
      actionCategory: z.enum(["billing", "model", "security", "abuse", "all"]).optional().default("all"),
      userId: z.number().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      maxRecords: z.number().min(1).max(10000).optional().default(1000),
    }).optional())
    .mutation(async ({ input }) => {
      const { getFilteredAuditLogs } = await import("../../auditLog");
      
      const result = await getFilteredAuditLogs({
        limit: input?.maxRecords || 1000,
        offset: 0,
        severity: input?.severity === "all" ? undefined : input?.severity,
        actionCategory: input?.actionCategory === "all" ? undefined : input?.actionCategory,
        userId: input?.userId,
        startDate: input?.startDate ? new Date(input.startDate) : undefined,
        endDate: input?.endDate ? new Date(input.endDate) : undefined,
      });

      // Generate CSV content
      const headers = ["ID", "Timestamp", "User ID", "Action", "Severity", "Resource Type", "Resource ID", "IP Address", "User Agent"];
      const rows = result.logs.map(log => [
        log.id,
        new Date(log.createdAt).toISOString(),
        log.userId || "",
        log.action,
        log.severity,
        log.resourceType || "",
        log.resourceId || "",
        log.ipAddress || "",
        (log.userAgent || "").replace(/,/g, ";"), // Escape commas in user agent
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
      ].join("\n");

      return {
        csv: csvContent,
        filename: `audit-logs-${new Date().toISOString().split("T")[0]}.csv`,
        recordCount: result.logs.length,
      };
    }),
});
