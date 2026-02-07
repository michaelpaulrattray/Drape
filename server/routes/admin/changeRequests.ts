import { adminProcedure, router } from "../../_core/trpc";
import { getClientIp } from "../../rateLimit";
import { executeApprovedAdminAction } from "../../lib/adminActions";
import {
  requestApproval as requestSlackApproval,
  getApprovalStatus as getSlackApprovalStatus,
  markExecuted as markSlackActionExecuted,
  markFailed as markSlackActionFailed,
} from "../../slackApproval";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const changeRequestsRouter = router({
  // List change requests with optional filters
  listChangeRequests: adminProcedure
    .input(z.object({
      status: z.enum(["pending", "approved", "denied", "cancelled", "expired", "pending_execution", "all"]).optional().default("pending"),
      type: z.string().optional(),
      priority: z.string().optional(),
      limit: z.number().min(1).max(100).optional().default(50),
      offset: z.number().min(0).optional().default(0),
    }).optional())
    .query(async ({ input }) => {
      const { listChangeRequests } = await import("../../db");
      return await listChangeRequests({
        status: input?.status === "all" ? undefined : input?.status,
        type: input?.type,
        priority: input?.priority,
        limit: input?.limit || 50,
        offset: input?.offset || 0,
      });
    }),

  // Get a single change request by ID
  getChangeRequest: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const { getChangeRequestById } = await import("../../db");
      const request = await getChangeRequestById(input.id);
      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Change request not found" });
      }
      return request;
    }),

  // Approve or deny a change request
  reviewChangeRequest: adminProcedure
    .input(z.object({
      id: z.number(),
      action: z.enum(["approved", "denied"]),
      reviewNotes: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { getChangeRequestById, updateChangeRequestStatus } = await import("../../db");
      const { sendAdminActionNotification } = await import("../../slackNotification");
      const { logAuditEvent } = await import("../../auditLog");
      const { AUDIT_ACTIONS } = await import("../../../drizzle/schema");
      const { writeImmutableLog } = await import("../../adminSecurity");

      const adminName = ctx.user.name || ctx.user.email || `Admin ${ctx.user.id}`;

      // Fetch the request first
      const request = await getChangeRequestById(input.id);
      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Change request not found" });
      }
      if (request.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Change request is already ${request.status}` });
      }

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
      // Sensitive types that require Slack approval before execution
      const SENSITIVE_TYPES = ["suspend_user", "unsuspend_user", "block_ip", "refund_credits", "add_credits", "stripe_refund"];
      const isSensitive = SENSITIVE_TYPES.includes(request.type);

      // Map change request types to Slack approval action types
      const CR_TO_APPROVAL_ACTION: Record<string, string> = {
        suspend_user: "cr_suspendUser",
        unsuspend_user: "cr_unsuspendUser",
        refund_credits: "cr_refundCredits",
        add_credits: "cr_addCredits",
        block_ip: "cr_blockIP",
        stripe_refund: "cr_stripeRefund",
      };

      const actionVerb = input.action === "approved" ? "Approved" : "Denied";
      const actionEmoji = input.action === "approved" ? "\u2705" : "\u274c";

      // ─── Sensitive type + approval → route through Slack ─────────────
      if (input.action === "approved" && isSensitive) {
        // Set status to pending_execution (admin approved, awaiting Slack confirmation)
        const result = await updateChangeRequestStatus(input.id, {
          status: "pending_execution",
          reviewedById: ctx.user.id,
          reviewedByName: adminName,
          reviewNotes: input.reviewNotes,
        });

        if (!result.success) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error || "Failed to update change request" });
        }

        // Build params for the Slack approval action
        const approvalParams: Record<string, unknown> = {
          changeRequestId: input.id,
          reason: request.title,
        };
        if (request.creditAmount) approvalParams.creditAmount = request.creditAmount;
        if (request.creditReason) approvalParams.creditReason = request.creditReason;
        if (request.ipAddress) approvalParams.reason = `${request.title} (IP: ${request.ipAddress})`;

        // Determine targetId for the approval action
        const targetId = request.type === "block_ip" && request.ipAddress
          ? request.ipAddress
          : String(request.targetUserId);

        // Request Slack approval
        const approvalResult = await requestSlackApproval({
          action: CR_TO_APPROVAL_ACTION[request.type] as any,
          requestedBy: {
            id: ctx.user.id,
            name: adminName,
            email: ctx.user.email || undefined,
          },
          targetId,
          description: `Change Request #${input.id}: ${typeLabels[request.type] || request.type}\n\n*Title:* ${request.title}\n*Target:* ${request.targetUserName || `User ${request.targetUserId}`}${request.creditAmount ? `\n*Amount:* ${request.creditAmount} credits` : ""}${request.ipAddress ? `\n*IP:* ${request.ipAddress}` : ""}\n*Submitted By:* ${request.submittedByName || `User ${request.submittedById}`}`,
          params: approvalParams,
          ipAddress: getClientIp(ctx.req),
        });

        // Store the Slack approval ID on the change request
        await updateChangeRequestStatus(input.id, {
          status: "pending_execution",
          slackApprovalId: approvalResult.actionId,
        }, "pending_execution");

        // Audit logging
        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.CHANGE_REQUEST_APPROVED,
          resourceType: "change_request",
          resourceId: String(input.id),
          metadata: {
            requestId: input.id,
            type: request.type,
            decision: "approved_pending_slack",
            reviewNotes: input.reviewNotes,
            slackApprovalId: approvalResult.actionId,
            slackSent: approvalResult.sent,
            submittedById: request.submittedById,
            targetUserId: request.targetUserId,
            creditAmount: request.creditAmount,
          },
          severity: "info",
          req: ctx.req,
        });

        // Notify #admin-actions about the pending Slack approval
        await sendAdminActionNotification({
          title: `\u23f3 Change Request #${input.id} Approved \u2014 Awaiting Slack Confirmation`,
          description: `*${adminName}* approved change request #${input.id} (${typeLabels[request.type] || request.type}).\n\nExecution is held pending Slack confirmation.${!approvalResult.sent ? "\n\n\u26a0\ufe0f Slack not configured \u2014 action was auto-approved and will execute when polled." : ""}`,
          severity: "info",
          fields: [
            { title: "Request ID", value: `#${input.id}`, short: true },
            { title: "Type", value: typeLabels[request.type] || request.type, short: true },
            { title: "Reviewed By", value: adminName, short: true },
            { title: "Status", value: "\u23f3 Awaiting Slack Approval", short: true },
            { title: "Submitted By", value: request.submittedByName || `User ${request.submittedById}`, short: true },
            { title: "Target User", value: request.targetUserName ? `${request.targetUserName} (ID: ${request.targetUserId})` : `User ID: ${request.targetUserId}`, short: true },
          ],
        });

        // writeImmutableLog already sends to #audit-log via the dispatcher
        await writeImmutableLog(
          "change_request_approved_pending_slack",
          {
            adminId: ctx.user.id,
            adminName,
            targetId: String(request.targetUserId),
            action: `Approved change request #${input.id} (${request.type}) - pending Slack confirmation`,
            requestId: input.id,
            type: request.type,
            title: request.title,
            creditAmount: request.creditAmount,
            reviewNotes: input.reviewNotes,
            slackApprovalId: approvalResult.actionId,
          },
        );

        return {
          success: true,
          action: "approved" as const,
          message: `Change request #${input.id} approved \u2014 awaiting Slack confirmation before execution`,
          slackApprovalId: approvalResult.actionId,
          slackSent: approvalResult.sent,
          pendingExecution: true,
          executionResult: { executed: false },
        };
      }

      // ─── Non-sensitive approval or denial → immediate processing ─────
      const result = await updateChangeRequestStatus(input.id, {
        status: input.action,
        reviewedById: ctx.user.id,
        reviewedByName: adminName,
        reviewNotes: input.reviewNotes,
      });

      if (!result.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error || "Failed to update change request" });
      }

      // Notify #admin-actions
      await sendAdminActionNotification({
        title: `${actionEmoji} Change Request #${input.id} ${actionVerb}`,
        description: `*${adminName}* ${actionVerb.toLowerCase()} change request #${input.id} (${typeLabels[request.type] || request.type}).\n\n*Original Title:* ${request.title}${input.reviewNotes ? `\n*Review Notes:* ${input.reviewNotes}` : ""}`,
        severity: input.action === "approved" ? "info" : "warning",
        fields: [
          { title: "Request ID", value: `#${input.id}`, short: true },
          { title: "Type", value: typeLabels[request.type] || request.type, short: true },
          { title: "Reviewed By", value: adminName, short: true },
          { title: "Decision", value: `${actionEmoji} ${actionVerb}`, short: true },
          { title: "Submitted By", value: request.submittedByName || `User ${request.submittedById}`, short: true },
          { title: "Target User", value: request.targetUserName ? `${request.targetUserName} (ID: ${request.targetUserId})` : `User ID: ${request.targetUserId}`, short: true },
        ],
      });

      // Database audit log
      const auditAction = input.action === "approved"
        ? AUDIT_ACTIONS.CHANGE_REQUEST_APPROVED
        : AUDIT_ACTIONS.CHANGE_REQUEST_DENIED;

      await logAuditEvent({
        userId: ctx.user.id,
        action: auditAction,
        resourceType: "change_request",
        resourceId: String(input.id),
        metadata: {
          requestId: input.id,
          type: request.type,
          decision: input.action,
          reviewNotes: input.reviewNotes,
          submittedById: request.submittedById,
          targetUserId: request.targetUserId,
          creditAmount: request.creditAmount,
        },
        severity: "info",
        req: ctx.req,
      });

      // Write to immutable log for compliance
      await writeImmutableLog(
        `change_request_${input.action}`,
        {
          adminId: ctx.user.id,
          adminName,
          targetId: String(request.targetUserId),
          action: `${actionVerb} change request #${input.id} (${request.type})`,
          requestId: input.id,
          type: request.type,
          title: request.title,
          creditAmount: request.creditAmount,
          reviewNotes: input.reviewNotes,
        },
      );

      // Non-sensitive approvals still don't auto-execute (flag_account, note_incident, other)
      return {
        success: true,
        action: input.action,
        message: `Change request #${input.id} has been ${actionVerb.toLowerCase()}`,
        executionResult: { executed: false },
      };
    }),

  // Check Slack approval status for a pending_execution change request
  checkChangeRequestSlackStatus: adminProcedure
    .input(z.object({
      changeRequestId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const { getChangeRequestById } = await import("../../db");
      const request = await getChangeRequestById(input.changeRequestId);
      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Change request not found" });
      }

      if (request.status !== "pending_execution" || !request.slackApprovalId) {
        return {
          status: request.status,
          slackStatus: null,
          message: request.status === "approved" ? "Already executed" : `Request is ${request.status}`,
        };
      }

      const slackStatus = getSlackApprovalStatus(request.slackApprovalId);
      if (!slackStatus) {
        return {
          status: "pending_execution",
          slackStatus: "not_found",
          message: "Slack approval request not found or expired",
        };
      }

      return {
        status: "pending_execution",
        slackStatus: slackStatus.status,
        resolvedBy: slackStatus.resolvedBy,
        resolvedAt: slackStatus.resolvedAt,
        expiresAt: slackStatus.expiresAt,
        message: slackStatus.status === "approved"
          ? "Slack approved \u2014 ready to execute"
          : slackStatus.status === "denied"
          ? "Slack denied \u2014 action will not execute"
          : slackStatus.status === "expired"
          ? "Slack approval expired"
          : "Awaiting Slack approval",
      };
    }),

  // Execute a change request after Slack approval
  executeChangeRequestAfterSlack: adminProcedure
    .input(z.object({
      changeRequestId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { getChangeRequestById, updateChangeRequestStatus } = await import("../../db");
      const request = await getChangeRequestById(input.changeRequestId);
      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Change request not found" });
      }
      if (request.status !== "pending_execution" || !request.slackApprovalId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Change request is not pending Slack execution" });
      }

      const slackStatus = getSlackApprovalStatus(request.slackApprovalId);
      if (!slackStatus || slackStatus.status !== "approved") {
        // If Slack denied or expired, update the change request accordingly
        if (slackStatus?.status === "denied") {
          await updateChangeRequestStatus(input.changeRequestId, { status: "denied", reviewNotes: `${request.reviewNotes || ""}\n[Slack denied by ${slackStatus.resolvedBy}]` }, "pending_execution");
          return { success: false, message: "Slack approval was denied" };
        }
        if (slackStatus?.status === "expired") {
          await updateChangeRequestStatus(input.changeRequestId, { status: "expired" }, "pending_execution");
          return { success: false, message: "Slack approval expired" };
        }
        throw new TRPCError({ code: "BAD_REQUEST", message: `Slack approval status: ${slackStatus?.status || "not found"}` });
      }

      // Execute via the existing executeApprovedAdminAction dispatcher
      try {
        const execResult = await executeApprovedAdminAction(slackStatus, ctx);
        markSlackActionExecuted(request.slackApprovalId, execResult.message);
        return { success: true, message: execResult.message };
      } catch (error: any) {
        markSlackActionFailed(request.slackApprovalId, error.message || "Execution failed");
        // Still mark the change request as approved (execution failed but admin intent was clear)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to execute approved change request",
        });
      }
    }),
});
