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

export const slackApprovalRouter = router({
  // Request Slack approval for a sensitive admin action
  requestApproval: adminProcedure
    .input(z.object({
      action: z.enum(["suspendUser", "unsuspendUser", "adjustCredits", "blockIP", "unblockIP", "cr_suspendUser", "cr_unsuspendUser", "cr_refundCredits", "cr_addCredits", "cr_blockIP", "cr_stripeRefund"]),
      targetId: z.string(),
      description: z.string().min(1).max(1000),
      params: z.record(z.string(), z.unknown()).optional().default({}),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await requestSlackApproval({
        action: input.action,
        requestedBy: {
          id: ctx.user.id,
          name: ctx.user.name || ctx.user.email || `Admin ${ctx.user.id}`,
          email: ctx.user.email || undefined,
        },
        targetId: input.targetId,
        description: input.description,
        params: input.params,
        ipAddress: getClientIp(ctx.req),
      });
      
      return {
        actionId: result.actionId,
        slackSent: result.sent,
        expiresIn: 300, // 5 minutes
      };
    }),

  // Check the status of a pending approval
  checkApprovalStatus: adminProcedure
    .input(z.object({
      actionId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const status = getSlackApprovalStatus(input.actionId);
      
      if (!status) {
        return {
          status: "not_found" as const,
          message: "Approval request not found or has been cleaned up",
        };
      }
      
      // Only the requesting admin can check status
      if (status.requestedBy.id !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only check status of your own approval requests",
        });
      }
      
      return {
        status: status.status,
        action: status.action,
        targetId: status.targetId,
        resolvedBy: status.resolvedBy,
        resolvedAt: status.resolvedAt,
        resultMessage: status.resultMessage,
        expiresAt: status.expiresAt,
      };
    }),

  // Execute an approved action
  executeApproved: adminProcedure
    .input(z.object({
      actionId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const status = getSlackApprovalStatus(input.actionId);
      
      if (!status) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Approval request not found",
        });
      }
      
      if (status.requestedBy.id !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only execute your own approved actions",
        });
      }
      
      if (status.status !== "approved") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot execute action with status: ${status.status}`,
        });
      }
      
      // Execute the approved action based on its type
      try {
        const result = await executeApprovedAdminAction(status, ctx);
        markSlackActionExecuted(input.actionId, result.message);
        return { success: true, message: result.message };
      } catch (error: any) {
        markSlackActionFailed(input.actionId, error.message || "Execution failed");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to execute approved action",
        });
      }
    }),
});
