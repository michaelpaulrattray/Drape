/**
 * Direct admin action handlers — admin-initiated actions approved via Slack.
 * These do NOT involve change requests from moderators.
 */

import { logAuditEvent, AUDIT_ACTIONS } from "../../auditLog";
import { getClientIp } from "../../rateLimit";
import { logAdminAction, writeImmutableLog } from "../../adminSecurity";
import { type PendingAction } from "../../slackApproval";
import { type AdminActionContext } from "./index";

export async function executeDirectAction(
  pendingAction: PendingAction,
  ctx: AdminActionContext
): Promise<{ message: string }> {
  const params = pendingAction.params;
  const adminName = ctx.user.name || ctx.user.email || `Admin ${ctx.user.id}`;

  switch (pendingAction.action) {
    case "suspendUser": {
      const { suspendUser, getUserById } = await import("../../db");
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
      const { unsuspendUser, getUserById } = await import("../../db");
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
      const { blockIp } = await import("../../db");
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
      const { unblockIp } = await import("../../db");
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
      const { adjustUserCredits, getUserById } = await import("../../db");
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

    default:
      throw new Error(`Unknown direct action type: ${pendingAction.action}`);
  }
}
