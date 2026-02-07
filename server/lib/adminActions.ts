/**
 * Execute an approved admin action from the Slack approval flow.
 * This function dispatches to the appropriate action handler based on the pending action type.
 * 
 * Extracted from server/routers.ts during the router refactor.
 */

import { logAuditEvent, AUDIT_ACTIONS } from "../auditLog";
import { getClientIp } from "../rateLimit";
import { logAdminAction, writeImmutableLog } from "../adminSecurity";
import { type PendingAction } from "../slackApproval";

export type AdminActionContext = {
  user: { id: number; name: string | null; email: string | null; role: string };
  req: any;
  res: any;
};

export async function executeApprovedAdminAction(
  pendingAction: PendingAction,
  ctx: AdminActionContext
): Promise<{ message: string }> {
  const params = pendingAction.params;
  const adminName = ctx.user.name || ctx.user.email || `Admin ${ctx.user.id}`;
  
  switch (pendingAction.action) {
    case "suspendUser": {
      const { suspendUser, getUserById } = await import("../db");
      const userId = Number(pendingAction.targetId);
      const reason = (params.reason as string) || "Approved via Slack";
      
      const targetUser = await getUserById(userId);
      if (!targetUser) throw new Error("User not found");
      if (targetUser.role === "admin") throw new Error("Cannot suspend admin accounts");
      
      const result = await suspendUser(userId, reason, ctx.user.id);
      if (!result.success) throw new Error(result.error || "Failed to suspend user");
      
      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.ACCOUNT_SUSPENDED,
        resourceType: "user",
        resourceId: userId.toString(),
        metadata: {
          targetUserId: userId,
          targetUserEmail: targetUser.email,
          reason,
          suspendedBy: ctx.user.id,
          approvedViaSlack: true,
          approvedBy: pendingAction.resolvedBy,
        },
        severity: "critical",
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || null,
      });
      
      await logAdminAction({
        adminId: ctx.user.id,
        adminName,
        action: "suspendUser",
        targetType: "user",
        targetId: userId.toString(),
        details: `Suspended user ${targetUser.email || targetUser.name} (Slack-approved by ${pendingAction.resolvedBy}) - Reason: ${reason}`,
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || undefined,
      });
      
      await writeImmutableLog("user_suspended", {
        adminId: ctx.user.id,
        adminName,
        targetUserId: userId,
        targetUserEmail: targetUser.email,
        reason,
        slackApprovedBy: pendingAction.resolvedBy,
      });
      
      return { message: `User ${targetUser.email || targetUser.name} suspended successfully` };
    }
    
    case "unsuspendUser": {
      const { unsuspendUser, getUserById } = await import("../db");
      const userId = Number(pendingAction.targetId);
      
      const targetUser = await getUserById(userId);
      if (!targetUser) throw new Error("User not found");
      if (!targetUser.suspendedAt) throw new Error("User is not suspended");
      
      const result = await unsuspendUser(userId);
      if (!result.success) throw new Error(result.error || "Failed to unsuspend user");
      
      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.ACCOUNT_UNSUSPENDED,
        resourceType: "user",
        resourceId: userId.toString(),
        metadata: {
          targetUserId: userId,
          targetUserEmail: targetUser.email,
          previousReason: targetUser.suspendedReason,
          unsuspendedBy: ctx.user.id,
          approvedViaSlack: true,
          approvedBy: pendingAction.resolvedBy,
        },
        severity: "info",
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || null,
      });
      
      await logAdminAction({
        adminId: ctx.user.id,
        adminName,
        action: "unsuspendUser",
        targetType: "user",
        targetId: userId.toString(),
        details: `Unsuspended user ${targetUser.email || targetUser.name} (Slack-approved by ${pendingAction.resolvedBy})`,
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || undefined,
      });
      
      await writeImmutableLog("user_unsuspended", {
        adminId: ctx.user.id,
        adminName,
        targetUserId: userId,
        targetUserEmail: targetUser.email,
        slackApprovedBy: pendingAction.resolvedBy,
      });
      
      return { message: `User ${targetUser.email || targetUser.name} unsuspended successfully` };
    }
    
    case "blockIP": {
      const { blockIp } = await import("../db");
      const ipAddress = pendingAction.targetId;
      const reason = (params.reason as string) || "Approved via Slack";
      const expiresInHours = params.expiresInHours as number | undefined;
      
      const expiresAt = expiresInHours
        ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
        : null;
      
      const result = await blockIp(ipAddress, reason, ctx.user.id, expiresAt);
      if (!result.success) throw new Error("Failed to block IP address");
      
      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.IP_BLOCKED,
        resourceType: "ip",
        resourceId: ipAddress,
        metadata: {
          reason,
          expiresAt: expiresAt?.toISOString() || "permanent",
          approvedViaSlack: true,
          approvedBy: pendingAction.resolvedBy,
        },
        severity: "warning",
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || null,
      });
      
      await logAdminAction({
        adminId: ctx.user.id,
        adminName,
        action: "blockIP",
        targetType: "ip",
        targetId: ipAddress,
        details: `Blocked IP ${ipAddress} (Slack-approved by ${pendingAction.resolvedBy}) - Reason: ${reason}`,
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || undefined,
      });
      
      await writeImmutableLog("ip_blocked", {
        adminId: ctx.user.id,
        adminName,
        ipAddress,
        reason,
        expiresAt: expiresAt?.toISOString() || "permanent",
        slackApprovedBy: pendingAction.resolvedBy,
      });
      
      return { message: `IP ${ipAddress} blocked successfully` };
    }
    
    case "unblockIP": {
      const { unblockIp } = await import("../db");
      const ipAddress = pendingAction.targetId;
      
      const success = await unblockIp(ipAddress);
      if (!success) throw new Error("Failed to unblock IP address");
      
      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.IP_UNBLOCKED,
        resourceType: "ip",
        resourceId: ipAddress,
        metadata: {
          approvedViaSlack: true,
          approvedBy: pendingAction.resolvedBy,
        },
        severity: "info",
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || null,
      });
      
      await logAdminAction({
        adminId: ctx.user.id,
        adminName,
        action: "unblockIP",
        targetType: "ip",
        targetId: ipAddress,
        details: `Unblocked IP ${ipAddress} (Slack-approved by ${pendingAction.resolvedBy})`,
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || undefined,
      });
      
      await writeImmutableLog("ip_unblocked", {
        adminId: ctx.user.id,
        adminName,
        ipAddress,
        slackApprovedBy: pendingAction.resolvedBy,
      });
      
      return { message: `IP ${ipAddress} unblocked successfully` };
    }
    
    case "adjustCredits": {
      const { adjustUserCredits, getUserById } = await import("../db");
      const userId = Number(pendingAction.targetId);
      const amount = params.amount as number;
      const reason = (params.reason as string) || "Approved via Slack";
      
      if (typeof amount !== "number") throw new Error("Invalid credit amount");
      
      const targetUser = await getUserById(userId);
      if (!targetUser) throw new Error("User not found");
      
      const result = await adjustUserCredits(userId, amount, reason, ctx.user.id);
      if (!result.success) throw new Error(result.error || "Failed to adjust credits");
      
      await logAuditEvent({
        userId: ctx.user.id,
        action: amount > 0 ? AUDIT_ACTIONS.CREDITS_ADDED : AUDIT_ACTIONS.CREDITS_DEDUCTED,
        resourceType: "credits",
        resourceId: userId.toString(),
        metadata: {
          targetUserId: userId,
          targetUserEmail: targetUser.email,
          amount,
          reason,
          newBalance: result.newBalance,
          adjustedBy: ctx.user.id,
          approvedViaSlack: true,
          approvedBy: pendingAction.resolvedBy,
        },
        severity: "warning",
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || null,
      });
      
      await logAdminAction({
        adminId: ctx.user.id,
        adminName,
        action: "adjustCredits",
        targetType: "user",
        targetId: userId.toString(),
        details: `${amount > 0 ? "Added" : "Deducted"} ${Math.abs(amount)} credits for ${targetUser.email || targetUser.name} (Slack-approved by ${pendingAction.resolvedBy}) - Reason: ${reason} - New balance: ${result.newBalance}`,
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || undefined,
      });
      
      await writeImmutableLog("credits_adjusted", {
        adminId: ctx.user.id,
        adminName,
        targetUserId: userId,
        targetUserEmail: targetUser.email,
        amount,
        reason,
        newBalance: result.newBalance,
        slackApprovedBy: pendingAction.resolvedBy,
      });
      
      return { message: `${amount > 0 ? "Added" : "Deducted"} ${Math.abs(amount)} credits. New balance: ${result.newBalance}` };
    }
    
    // ─── Change Request Approval Actions ───────────────────────────────
    case "cr_suspendUser": {
      const { suspendUser, getUserById, updateChangeRequestStatus } = await import("../db");
      const userId = Number(pendingAction.targetId);
      const changeRequestId = params.changeRequestId as number;
      const reason = (params.reason as string) || "Suspended via approved change request";
      
      const targetUser = await getUserById(userId);
      if (!targetUser) throw new Error("User not found");
      if (targetUser.role === "admin") throw new Error("Cannot suspend admin accounts");
      
      const result = await suspendUser(userId, reason, ctx.user.id);
      if (!result.success) throw new Error(result.error || "Failed to suspend user");
      
      // Update change request status to approved (from pending_execution)
      await updateChangeRequestStatus(changeRequestId, { status: "approved" }, "pending_execution");
      
      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.ACCOUNT_SUSPENDED,
        resourceType: "user",
        resourceId: userId.toString(),
        metadata: {
          targetUserId: userId,
          targetUserEmail: targetUser.email,
          reason,
          changeRequestId,
          approvedViaSlack: true,
          approvedBy: pendingAction.resolvedBy,
        },
        severity: "critical",
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || null,
      });
      
      await writeImmutableLog("user_suspended", {
        adminId: ctx.user.id,
        adminName,
        targetUserId: userId,
        targetUserEmail: targetUser.email,
        reason,
        changeRequestId,
        slackApprovedBy: pendingAction.resolvedBy,
      });
      
      return { message: `User ${targetUser.email || targetUser.name} suspended via change request #${changeRequestId}` };
    }
    
    case "cr_unsuspendUser": {
      const { unsuspendUser, getUserById, updateChangeRequestStatus } = await import("../db");
      const userId = Number(pendingAction.targetId);
      const changeRequestId = params.changeRequestId as number;
      
      const targetUser = await getUserById(userId);
      if (!targetUser) throw new Error("User not found");
      if (!targetUser.suspendedAt) throw new Error("User is not suspended");
      
      const result = await unsuspendUser(userId);
      if (!result.success) throw new Error(result.error || "Failed to unsuspend user");
      
      await updateChangeRequestStatus(changeRequestId, { status: "approved" }, "pending_execution");
      
      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.ACCOUNT_UNSUSPENDED,
        resourceType: "user",
        resourceId: userId.toString(),
        metadata: {
          targetUserId: userId,
          targetUserEmail: targetUser.email,
          changeRequestId,
          approvedViaSlack: true,
          approvedBy: pendingAction.resolvedBy,
        },
        severity: "info",
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || null,
      });
      
      await writeImmutableLog("user_unsuspended", {
        adminId: ctx.user.id,
        adminName,
        targetUserId: userId,
        targetUserEmail: targetUser.email,
        changeRequestId,
        slackApprovedBy: pendingAction.resolvedBy,
      });
      
      return { message: `User ${targetUser.email || targetUser.name} unsuspended via change request #${changeRequestId}` };
    }
    
    case "cr_refundCredits": {
      const { addCredits, getUserById, updateChangeRequestStatus } = await import("../db");
      const userId = Number(pendingAction.targetId);
      const changeRequestId = params.changeRequestId as number;
      const amount = params.creditAmount as number;
      const reason = (params.creditReason as string) || "Refund via approved change request";
      
      if (typeof amount !== "number" || amount <= 0) throw new Error("Invalid credit amount");
      
      const targetUser = await getUserById(userId);
      if (!targetUser) throw new Error("User not found");
      
      const creditResult = await addCredits(userId, amount, "refund", `Refund via change request #${changeRequestId}: ${reason}`, `cr-${changeRequestId}`);
      if (!creditResult.success) throw new Error(creditResult.error || "Failed to refund credits");
      
      await updateChangeRequestStatus(changeRequestId, { status: "approved" }, "pending_execution");
      
      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.CREDITS_REFUNDED,
        resourceType: "credits",
        resourceId: userId.toString(),
        metadata: {
          amount,
          reason,
          changeRequestId,
          newBalance: creditResult.newBalance,
          approvedViaSlack: true,
          approvedBy: pendingAction.resolvedBy,
        },
        severity: "info",
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || null,
      });
      
      await writeImmutableLog("credits_refunded", {
        adminId: ctx.user.id,
        adminName,
        targetUserId: userId,
        targetUserEmail: targetUser.email,
        amount,
        reason,
        changeRequestId,
        newBalance: creditResult.newBalance,
        slackApprovedBy: pendingAction.resolvedBy,
      });
      
      return { message: `Refunded ${amount} credits to ${targetUser.email || targetUser.name} via change request #${changeRequestId}` };
    }
    
    case "cr_addCredits": {
      const { addCredits, getUserById, updateChangeRequestStatus } = await import("../db");
      const userId = Number(pendingAction.targetId);
      const changeRequestId = params.changeRequestId as number;
      const amount = params.creditAmount as number;
      const reason = (params.creditReason as string) || "Credits added via approved change request";
      
      if (typeof amount !== "number" || amount <= 0) throw new Error("Invalid credit amount");
      
      const targetUser = await getUserById(userId);
      if (!targetUser) throw new Error("User not found");
      
      const creditResult = await addCredits(userId, amount, "bonus", `Credits added via change request #${changeRequestId}: ${reason}`, `cr-${changeRequestId}`);
      if (!creditResult.success) throw new Error(creditResult.error || "Failed to add credits");
      
      await updateChangeRequestStatus(changeRequestId, { status: "approved" }, "pending_execution");
      
      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.CREDITS_ADDED,
        resourceType: "credits",
        resourceId: userId.toString(),
        metadata: {
          amount,
          reason,
          changeRequestId,
          newBalance: creditResult.newBalance,
          approvedViaSlack: true,
          approvedBy: pendingAction.resolvedBy,
        },
        severity: "info",
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || null,
      });
      
      await writeImmutableLog("credits_added", {
        adminId: ctx.user.id,
        adminName,
        targetUserId: userId,
        targetUserEmail: targetUser.email,
        amount,
        reason,
        changeRequestId,
        newBalance: creditResult.newBalance,
        slackApprovedBy: pendingAction.resolvedBy,
      });
      
      return { message: `Added ${amount} credits to ${targetUser.email || targetUser.name} via change request #${changeRequestId}` };
    }
    
    case "cr_blockIP": {
      const { blockIp, updateChangeRequestStatus } = await import("../db");
      const ipAddress = pendingAction.targetId;
      const changeRequestId = params.changeRequestId as number;
      const reason = (params.reason as string) || "Blocked via approved change request";
      
      const result = await blockIp(ipAddress, reason, ctx.user.id, null);
      if (!result.success) throw new Error("Failed to block IP address");
      
      await updateChangeRequestStatus(changeRequestId, { status: "approved" }, "pending_execution");
      
      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.IP_BLOCKED,
        resourceType: "ip",
        resourceId: ipAddress,
        metadata: {
          reason,
          changeRequestId,
          approvedViaSlack: true,
          approvedBy: pendingAction.resolvedBy,
        },
        severity: "warning",
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || null,
      });
      
      await writeImmutableLog("ip_blocked", {
        adminId: ctx.user.id,
        adminName,
        ipAddress,
        reason,
        changeRequestId,
        slackApprovedBy: pendingAction.resolvedBy,
      });
      
      return { message: `IP ${ipAddress} blocked via change request #${changeRequestId}` };
    }
    
    case "cr_stripeRefund": {
      const { getUserById: getUser, getUserCredits: getCredits, updateChangeRequestStatus: updateCR } = await import("../db");
      const { issueStripeRefund, calculateProportionalRefund } = await import("../stripeService");
      const userId = Number(pendingAction.targetId);
      const changeRequestId = params.changeRequestId as number;
      const stripeSessionId = params.stripeSessionId as string;
      const refundType = (params.refundType as string) || "proportional";
      const originalCredits = params.originalCredits as number;
      const originalAmountCents = params.originalAmountCents as number;

      if (!stripeSessionId) throw new Error("Missing Stripe session ID for refund");
      if (!originalCredits || !originalAmountCents) throw new Error("Missing original purchase details");

      const targetUser = await getUser(userId);
      if (!targetUser) throw new Error("User not found");

      const userCredits = await getCredits(userId);
      const currentBalance = userCredits?.balance ?? 0;

      let refundAmountCents: number;
      let creditsToDeduct: number;

      if (refundType === "full") {
        refundAmountCents = originalAmountCents;
        creditsToDeduct = Math.min(originalCredits, currentBalance);
      } else {
        const calc = calculateProportionalRefund(originalAmountCents, originalCredits, currentBalance);
        refundAmountCents = calc.refundAmountCents;
        creditsToDeduct = calc.creditsToDeduct;
      }

      const refundResult = await issueStripeRefund(stripeSessionId, refundAmountCents, `Change request #${changeRequestId}`);
      if (!refundResult.success) {
        throw new Error(`Stripe refund failed: ${refundResult.error}`);
      }

      if (creditsToDeduct > 0) {
        const { adjustUserCredits } = await import("../db");
        const deductResult = await adjustUserCredits(userId, -creditsToDeduct, `Stripe refund via CR #${changeRequestId}`, ctx.user.id);
        if (!deductResult.success) {
          console.error(`[Refund] Credit deduction failed after Stripe refund ${refundResult.refundId}: ${deductResult.error}`);
        }
      }

      await updateCR(changeRequestId, {
        status: "approved",
        reviewNotes: `Stripe refund ${refundResult.refundId}: $${(refundAmountCents / 100).toFixed(2)} (${refundType}). ${creditsToDeduct} credits deducted.`,
      }, "pending_execution");

      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.STRIPE_REFUND_ISSUED,
        resourceType: "billing",
        resourceId: refundResult.refundId || stripeSessionId,
        metadata: {
          targetUserId: userId,
          targetUserEmail: targetUser.email,
          stripeSessionId,
          stripeRefundId: refundResult.refundId,
          refundType,
          refundAmountCents,
          originalAmountCents,
          originalCredits,
          creditsDeducted: creditsToDeduct,
          newBalance: currentBalance - creditsToDeduct,
          changeRequestId,
          approvedViaSlack: true,
          approvedBy: pendingAction.resolvedBy,
        },
        severity: "critical",
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || null,
      });

      await writeImmutableLog("stripe_refund_issued", {
        adminId: ctx.user.id,
        adminName,
        targetUserId: userId,
        targetUserEmail: targetUser.email,
        stripeRefundId: refundResult.refundId,
        refundAmountCents,
        refundType,
        creditsDeducted: creditsToDeduct,
        changeRequestId,
        slackApprovedBy: pendingAction.resolvedBy,
      });

      return { message: `Stripe refund of $${(refundAmountCents / 100).toFixed(2)} issued (${refundType}). ${creditsToDeduct} credits deducted. Refund ID: ${refundResult.refundId}` };
    }

    default:
      throw new Error(`Unknown action type: ${pendingAction.action}`);
  }
}
