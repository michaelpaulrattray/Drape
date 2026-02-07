import { moderatorProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const moderatorRouter = router({
  // View audit logs (read-only, same data as admin)
  getAuditLogs: moderatorProcedure
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
      const { getFilteredAuditLogs } = await import("../auditLog");
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

  // View abuse alerts (read-only)
  getAbuseAlerts: moderatorProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).optional().default(10),
    }).optional())
    .query(async ({ input }) => {
      const { getAbuseAlertsSummary } = await import("../auditLog");
      return await getAbuseAlertsSummary(input?.limit || 10);
    }),

  // View audit statistics (read-only)
  getAuditStats: moderatorProcedure
    .query(async () => {
      const { getAuditStatistics } = await import("../auditLog");
      return await getAuditStatistics();
    }),

  // View single audit log entry (read-only)
  getAuditLogById: moderatorProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const { getAuditLogById } = await import("../auditLog");
      return await getAuditLogById(input.id);
    }),

  // View user details (read-only, no mutations)
  getUserDetails: moderatorProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const { getUserById, getUserCredits } = await import("../db");
      const user = await getUserById(input.userId);
      if (!user) return null;
      
      const userCredits = await getUserCredits(input.userId);
      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          suspendedAt: user.suspendedAt,
          suspendedReason: user.suspendedReason,
          lockedUntil: user.lockedUntil,
          failedLoginAttempts: user.failedLoginAttempts,
          createdAt: user.createdAt,
          lastSignedIn: user.lastSignedIn,
        },
        credits: userCredits ? { balance: userCredits.balance } : null,
      };
    }),

  // View user activity (read-only)
  getUserActivity: moderatorProcedure
    .input(z.object({
      userId: z.number(),
      limit: z.number().min(1).max(100).optional().default(50),
      offset: z.number().min(0).optional().default(0),
    }))
    .query(async ({ input }) => {
      const { getFilteredAuditLogs } = await import("../auditLog");
      return await getFilteredAuditLogs({
        userId: input.userId,
        limit: input.limit,
        offset: input.offset,
      });
    }),

  // View blocked IPs (read-only)
  listBlockedIPs: moderatorProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).optional().default(50),
      offset: z.number().min(0).optional().default(0),
    }).optional())
    .query(async ({ input }) => {
      const { getBlockedIps } = await import("../db");
      const result = await getBlockedIps(
        input?.limit || 50,
        input?.offset || 0
      );
      return {
        ips: result.ips.map(ip => ({
          id: ip.id,
          ipAddress: ip.ipAddress,
          reason: ip.reason,
          blockedBy: ip.blockedBy,
          expiresAt: ip.expiresAt?.toISOString() || null,
          createdAt: ip.createdAt.toISOString(),
        })),
        total: result.total,
      };
    }),

  // View user list (read-only, for investigation)
  listUsers: moderatorProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).optional().default(20),
      offset: z.number().min(0).optional().default(0),
      search: z.string().optional(),
      status: z.enum(["active", "suspended", "locked", "all"]).optional().default("all"),
      role: z.enum(["user", "admin", "moderator", "all"]).optional().default("all"),
      sortBy: z.enum(["createdAt", "lastSignedIn", "name"]).optional().default("createdAt"),
      sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
    }).optional())
    .query(async ({ input }) => {
      const { listAllUsers } = await import("../db");
      const result = await listAllUsers({
        limit: input?.limit || 20,
        offset: input?.offset || 0,
        search: input?.search,
        status: input?.status || "all",
        role: input?.role || "all",
        sortBy: input?.sortBy || "createdAt",
        sortOrder: input?.sortOrder || "desc",
      });
      return {
        users: result.users.map(user => ({
          ...user,
          suspendedAt: user.suspendedAt?.toISOString() || null,
          lockedUntil: user.lockedUntil?.toISOString() || null,
          createdAt: user.createdAt.toISOString(),
          lastSignedIn: user.lastSignedIn.toISOString(),
        })),
        total: result.total,
      };
    }),

  // View user full details (read-only, for investigation)
  getUserFullDetails: moderatorProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const { getUserFullDetails } = await import("../db");
      const result = await getUserFullDetails(input.userId);
      if (!result) return null;
      return {
        user: {
          ...result.user,
          suspendedAt: result.user.suspendedAt?.toISOString() || null,
          lockedUntil: result.user.lockedUntil?.toISOString() || null,
          createdAt: result.user.createdAt.toISOString(),
          lastSignedIn: result.user.lastSignedIn.toISOString(),
        },
        credits: result.credits,
        stats: result.stats,
      };
    }),

  // View user statistics (read-only)
  getUserStats: moderatorProcedure
    .query(async () => {
      const { getUserStatistics } = await import("../db");
      return await getUserStatistics();
    }),

  // View user credit transaction history (read-only, for complaint investigation)
  getUserCreditHistory: moderatorProcedure
    .input(z.object({
      userId: z.number(),
      limit: z.number().min(1).max(100).optional().default(50),
      offset: z.number().min(0).optional().default(0),
      type: z.enum(["generation", "purchase", "bonus", "refund", "signup", "topup", "subscription", "admin_add", "admin_deduct", "all"]).optional().default("all"),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const { getDetailedCreditHistory } = await import("../db");
      return await getDetailedCreditHistory(input.userId, {
        limit: input.limit,
        offset: input.offset,
        type: input.type === "all" ? undefined : input.type,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
      });
    }),

  // View user generation history (read-only, for complaint investigation)
  getUserGenerationHistory: moderatorProcedure
    .input(z.object({
      userId: z.number(),
      limit: z.number().min(1).max(100).optional().default(50),
      offset: z.number().min(0).optional().default(0),
      status: z.enum(["pending", "processing", "completed", "failed", "all"]).optional().default("all"),
      type: z.enum(["masterPrompt", "castingImage", "fullBody", "multiView", "iteration", "upscale", "all"]).optional().default("all"),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const { getDetailedGenerationHistory } = await import("../db");
      return await getDetailedGenerationHistory(input.userId, {
        limit: input.limit,
        offset: input.offset,
        status: input.status === "all" ? undefined : input.status,
        type: input.type === "all" ? undefined : input.type,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
      });
    }),

  // ============ Change Requests (structured write operations for moderators) ============

  // Submit a structured change request for admin review
  createChangeRequest: moderatorProcedure
    .input(z.object({
      type: z.enum(["refund_credits", "add_credits", "flag_account", "note_incident", "suspend_user", "unsuspend_user", "block_ip", "stripe_refund", "other"]),
      priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
      targetUserId: z.number(),
      targetUserName: z.string().optional(),
      title: z.string().min(5).max(512),
      description: z.string().min(10).max(5000),
      evidenceSummary: z.string().max(5000).optional(),
      relatedAuditLogId: z.number().optional(),
      creditAmount: z.number().min(1).optional(),
      creditReason: z.string().max(512).optional(),
      ipAddress: z.string().max(45).optional(),
      stripeSessionId: z.string().max(128).optional(),
      refundType: z.enum(["full", "proportional"]).optional(),
      originalAmountCents: z.number().min(1).optional(),
      originalCredits: z.number().min(1).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { createChangeRequest } = await import("../db");
      const { sendAdminActionNotification, sendAuditLogEntry } = await import("../slack/slackNotification");
      const { logAuditEvent } = await import("../auditLog");
      const { AUDIT_ACTIONS } = await import("../../drizzle/schema");

      const moderatorName = ctx.user.name || ctx.user.email || `Moderator ${ctx.user.id}`;

      // Validate credit-related fields
      if ((input.type === "refund_credits" || input.type === "add_credits") && !input.creditAmount) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Credit amount is required for credit-related requests" });
      }
      if (input.type === "block_ip" && !input.ipAddress) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "IP address is required for block IP requests" });
      }
      if (input.type === "stripe_refund") {
        if (!input.stripeSessionId) throw new TRPCError({ code: "BAD_REQUEST", message: "Stripe session ID is required for refund requests" });
        if (!input.refundType) throw new TRPCError({ code: "BAD_REQUEST", message: "Refund type (full/proportional) is required" });
        if (!input.originalAmountCents) throw new TRPCError({ code: "BAD_REQUEST", message: "Original purchase amount is required" });
        if (!input.originalCredits) throw new TRPCError({ code: "BAD_REQUEST", message: "Original credit amount is required" });
      }

      // Create the change request in the database
      const result = await createChangeRequest({
        type: input.type,
        priority: input.priority,
        submittedById: ctx.user.id,
        submittedByName: moderatorName,
        targetUserId: input.targetUserId,
        targetUserName: input.targetUserName || null,
        title: input.title,
        description: input.description,
        evidenceSummary: input.evidenceSummary || null,
        relatedAuditLogId: input.relatedAuditLogId || null,
        creditAmount: input.creditAmount || null,
        creditReason: input.creditReason || null,
        ipAddress: input.ipAddress || null,
        stripeSessionId: input.stripeSessionId || null,
        refundType: input.refundType || null,
        originalCredits: input.originalCredits || null,
        // Calculate refund amount based on type — stored for admin review
        ...(input.type === "stripe_refund" && input.refundType === "full" ? {
          refundAmountCents: input.originalAmountCents || null,
          creditsToDeduct: input.originalCredits || null,
        } : {}),
      });

      if (!result.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error || "Failed to create change request" });
      }

      // Type labels for Slack messages
      const typeLabels: Record<string, string> = {
        refund_credits: "Refund Credits",
        add_credits: "Add Credits",
        flag_account: "Flag Account",
        note_incident: "Note Incident",
        suspend_user: "Suspend User",
        unsuspend_user: "Unsuspend User",
         block_ip: "Block IP",
        stripe_refund: "Stripe Refund",
        other: "Other",
      };
      const priorityEmoji: Record<string, string> = {
        low: "\u2b1c",
        normal: "\ud83d\udfe6",
        high: "\ud83d\udfe7",
        urgent: "\ud83d\udfe5",
      };

      // Send notification to #admin-actions
      const fields: Array<{ title: string; value: string; short?: boolean }> = [
        { title: "Request ID", value: `#${result.requestId}`, short: true },
        { title: "Type", value: typeLabels[input.type] || input.type, short: true },
        { title: "Priority", value: `${priorityEmoji[input.priority] || ""} ${input.priority.charAt(0).toUpperCase() + input.priority.slice(1)}`, short: true },
        { title: "Submitted By", value: `${moderatorName} (Moderator)`, short: true },
        { title: "Target User", value: input.targetUserName ? `${input.targetUserName} (ID: ${input.targetUserId})` : `User ID: ${input.targetUserId}`, short: true },
        { title: "Title", value: input.title },
        { title: "Description", value: input.description.length > 200 ? input.description.substring(0, 200) + "..." : input.description },
      ];

      if (input.creditAmount) {
        fields.push({ title: "Credit Amount", value: `${input.creditAmount} credits`, short: true });
      }
      if (input.ipAddress) {
        fields.push({ title: "IP Address", value: input.ipAddress, short: true });
      }
      if (input.evidenceSummary) {
        fields.push({ title: "Evidence", value: input.evidenceSummary.length > 200 ? input.evidenceSummary.substring(0, 200) + "..." : input.evidenceSummary });
      }

      const slackSeverity = input.priority === "urgent" ? "critical" as const : input.priority === "high" ? "warning" as const : "info" as const;

      const slackSent = await sendAdminActionNotification({
        title: `\ud83d\udccb New Change Request #${result.requestId}: ${typeLabels[input.type]}`,
        description: `*${moderatorName}* submitted a change request requiring admin review.\n\n*${input.title}*`,
        severity: slackSeverity,
        fields,
      });

      // Log to #audit-log
      await sendAuditLogEntry({
        title: "Change Request Created",
        description: `${moderatorName} created change request #${result.requestId}: ${typeLabels[input.type]} for user ${input.targetUserId}`,
        fields: [
          { title: "Request ID", value: `#${result.requestId}`, short: true },
          { title: "Type", value: typeLabels[input.type], short: true },
          { title: "Moderator", value: moderatorName, short: true },
          { title: "Target User", value: String(input.targetUserId), short: true },
        ],
        severity: "info",
      });

      // Log to database audit log
      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.CHANGE_REQUEST_CREATED,
        resourceType: "change_request",
        resourceId: String(result.requestId),
        metadata: {
          requestId: result.requestId,
          type: input.type,
          priority: input.priority,
          targetUserId: input.targetUserId,
          targetUserName: input.targetUserName,
          title: input.title,
          creditAmount: input.creditAmount,
          ipAddress: input.ipAddress,
          slackSent,
        },
        severity: slackSeverity === "critical" ? "critical" : slackSeverity === "warning" ? "warning" : "info",
        req: ctx.req,
      });

      return {
        success: true,
        requestId: result.requestId,
        slackSent,
        message: slackSent
          ? "Change request submitted and admin team notified via Slack"
          : "Change request submitted but Slack notification could not be sent",
      };
    }),

  // Get change requests submitted by the current moderator
  getMyChangeRequests: moderatorProcedure
    .input(z.object({
      status: z.enum(["pending", "approved", "denied", "cancelled", "expired", "all"]).optional().default("all"),
      limit: z.number().min(1).max(100).optional().default(50),
      offset: z.number().min(0).optional().default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const { getChangeRequestsByModerator } = await import("../db");
      return await getChangeRequestsByModerator(ctx.user.id, {
        status: input?.status === "all" ? undefined : input?.status,
        limit: input?.limit || 50,
        offset: input?.offset || 0,
      });
    }),
});
