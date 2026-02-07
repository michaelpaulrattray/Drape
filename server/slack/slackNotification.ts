/**
 * Slack Notification Service - Three-Channel Architecture
 * 
 * This module provides the PUBLIC API for sending Slack notifications.
 * All sends are routed through the centralized slackDispatcher.ts which handles:
 * - Deduplication (same event sent at most once per 60s window)
 * - Channel routing
 * - Rate limiting
 * 
 * Channels:
 *   #security-alerts (SLACK_WEBHOOK_URL)
 *   #admin-actions (SLACK_ADMIN_ACTIONS_WEBHOOK_URL)
 *   #audit-log (SLACK_AUDIT_LOG_WEBHOOK_URL)
 *   #billing-alerts (SLACK_BILLING_ALERTS_WEBHOOK_URL)
 * 
 * SETUP:
 * 1. Create a Slack App at https://api.slack.com/apps
 * 2. Enable Incoming Webhooks and add to your channels
 * 3. Enable Interactivity with Request URL: https://[your-domain]/api/slack/interactions
 * 4. Set SLACK_WEBHOOK_URL (security-alerts channel)
 * 5. Set SLACK_ADMIN_ACTIONS_WEBHOOK_URL (admin-actions channel)
 * 6. Set SLACK_AUDIT_LOG_WEBHOOK_URL (audit-log channel)
 * 7. Set SLACK_BILLING_ALERTS_WEBHOOK_URL (billing-alerts channel)
 * 8. Set SLACK_SIGNING_SECRET (for verifying button callbacks)
 */

import {
  dispatch,
  dispatchSecurityAlert,
  dispatchAdminAction,
  dispatchAuditLog,
  dispatchAdminActionWithAudit,
  dispatchBillingAlert,
  dispatchBillingAlertWithAudit,
  dispatchEmergencyActions,
  sendRawToChannel,
  verifySlackSignature as _verifySlackSignature,
} from "./slackDispatcher";
import type { SlackChannel as DispatcherChannel } from "./slackDispatcher";

// ============ Re-exported Types ============

export type SlackChannel = DispatcherChannel;

export interface SlackAlertOptions {
  /** Alert title */
  title: string;
  /** Alert description */
  description: string;
  /** Severity level affects color */
  severity: "info" | "warning" | "critical";
  /** Additional fields to display */
  fields?: Array<{ title: string; value: string; short?: boolean }>;
  /** IP address to offer blocking (creates button) */
  ipAddress?: string;
  /** User ID to offer suspension (creates button) */
  userId?: number;
  /** Username for display */
  userName?: string;
  /** Additional context for emergency actions */
  alertContext?: Record<string, unknown>;
}

// ============ Core Send Functions (delegate to dispatcher) ============

/**
 * Send a message to a specific Slack channel.
 * Low-level function — prefer the higher-level helpers when possible.
 * Routes through the dispatcher for dedup.
 */
export async function sendToChannel(
  channel: SlackChannel,
  payload: Record<string, unknown>
): Promise<boolean> {
  return sendRawToChannel(channel, payload, { skipDedup: false });
}

// ============ Security Alerts Channel (#security-alerts) ============

/**
 * Send a security alert to #security-alerts.
 * For CRITICAL alerts: also sends emergency action buttons to #admin-actions.
 */
export async function sendSlackAlert(options: SlackAlertOptions): Promise<boolean> {
  return dispatchSecurityAlert(options);
}

// ============ Emergency Actions ============

/**
 * Send emergency action buttons to #admin-actions channel.
 * Called automatically for critical alerts, or via escalation button.
 */
export async function sendEmergencyActionsToAdminChannel(
  title: string,
  description: string,
  fields: Array<{ title: string; value: string; short?: boolean }>,
  ipAddress?: string,
  userId?: number,
  userName?: string,
  alertContext?: Record<string, unknown>
): Promise<boolean> {
  return dispatchEmergencyActions(title, description, fields, ipAddress, userId, userName, alertContext);
}

// ============ Admin Actions Channel (#admin-actions) ============

/**
 * Send an admin action notification to #admin-actions.
 * Used for non-emergency admin activity (routine actions, confirmations).
 */
export async function sendAdminActionNotification(options: {
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  fields?: Array<{ title: string; value: string; short?: boolean }>;
}): Promise<boolean> {
  return dispatchAdminAction(options);
}

// ============ Audit Log Channel (#audit-log) ============

/**
 * Send an audit log entry to #audit-log.
 * Used for immutable log entries and completed action confirmations.
 */
export async function sendAuditLogEntry(options: {
  title: string;
  description: string;
  fields?: Array<{ title: string; value: string; short?: boolean }>;
  severity?: "info" | "warning" | "critical";
}): Promise<boolean> {
  return dispatchAuditLog(options);
}

// ============ Signature Verification ============

/**
 * Verify Slack request signature.
 * Used to validate incoming requests from Slack interactive components.
 */
export function verifySlackSignature(
  signature: string,
  timestamp: string,
  body: string
): boolean {
  return _verifySlackSignature(signature, timestamp, body);
}

// ============ Test Helper ============

/**
 * Send a test alert to verify Slack integration
 */
export async function sendTestSlackAlert(): Promise<boolean> {
  return sendSlackAlert({
    title: "Test Alert - FormaStudio Security",
    description: "This is a test alert to verify your Slack integration is working correctly.",
    severity: "info",
    fields: [
      { title: "Status", value: "✅ Connected", short: true },
      { title: "Environment", value: process.env.NODE_ENV || "development", short: true },
    ],
  });
}

// ============ Pre-built Alert Templates ============

export const SlackAlerts = {
  /**
   * Alert for credential stuffing attack detection
   * → #security-alerts (info) + #admin-actions (buttons if critical)
   */
  credentialStuffing: async (
    failedCount: number,
    topIp: string,
    uniqueIps: number
  ): Promise<boolean> => {
    return sendSlackAlert({
      title: "Possible Credential Stuffing Attack",
      description: `Detected ${failedCount} failed login attempts from ${uniqueIps} unique IP addresses in the last 5 minutes.`,
      severity: failedCount >= 100 ? "critical" : "warning",
      fields: [
        { title: "Failed Attempts", value: String(failedCount), short: true },
        { title: "Unique IPs", value: String(uniqueIps), short: true },
        { title: "Top Offending IP", value: topIp, short: true },
      ],
      ipAddress: topIp,
      alertContext: {
        attackType: "credential_stuffing",
        failedCount,
        uniqueIps,
      },
    });
  },

  /**
   * Alert for credits exploit attempt
   * → #security-alerts (info) + #admin-actions (buttons - always critical)
   */
  creditsExploit: async (
    userId: number,
    userName: string,
    attemptCount: number,
    ipAddress?: string
  ): Promise<boolean> => {
    return sendSlackAlert({
      title: "Credits Exploit Attempt Detected",
      description: `User *${userName}* (ID: ${userId}) has made ${attemptCount} failed credit deduction attempts, possibly trying to exploit the system.`,
      severity: "critical",
      fields: [
        { title: "User", value: userName, short: true },
        { title: "User ID", value: String(userId), short: true },
        { title: "Attempts", value: String(attemptCount), short: true },
        ...(ipAddress ? [{ title: "IP Address", value: ipAddress, short: true }] : []),
      ],
      userId,
      userName,
      ipAddress,
      alertContext: {
        attackType: "credits_exploit",
        attemptCount,
      },
    });
  },

  /**
   * Alert for rapid model deletion
   * → #security-alerts only (warning, not critical)
   */
  rapidDeletion: async (
    userId: number,
    userName: string,
    deletionCount: number
  ): Promise<boolean> => {
    return sendSlackAlert({
      title: "Rapid Model Deletion Detected",
      description: `User *${userName}* (ID: ${userId}) has deleted ${deletionCount} models in a short time period.`,
      severity: "warning",
      fields: [
        { title: "User", value: userName, short: true },
        { title: "Deletions", value: String(deletionCount), short: true },
      ],
      userId,
      userName,
      alertContext: {
        attackType: "rapid_deletion",
        deletionCount,
      },
    });
  },

  /**
   * Alert for billing anomaly
   * → #security-alerts only (warning)
   */
  billingAnomaly: async (
    userId: number,
    userName: string,
    anomalyType: string,
    details: string
  ): Promise<boolean> => {
    return sendSlackAlert({
      title: "Billing Anomaly Detected",
      description: `Unusual billing activity detected for user *${userName}* (ID: ${userId}).`,
      severity: "warning",
      fields: [
        { title: "User", value: userName, short: true },
        { title: "Anomaly Type", value: anomalyType, short: true },
        { title: "Details", value: details, short: false },
      ],
      userId,
      userName,
      alertContext: {
        attackType: "billing_anomaly",
        anomalyType,
      },
    });
  },

  /**
   * Confirmation when IP is blocked
   * → #admin-actions + #audit-log (single combined dispatch)
   */
  ipBlocked: async (
    ipAddress: string,
    reason: string,
    blockedBy: string
  ): Promise<boolean> => {
    return dispatchAdminActionWithAudit({
      title: "IP Address Blocked",
      description: `IP address *${ipAddress}* has been blocked.`,
      severity: "info",
      fields: [
        { title: "IP Address", value: ipAddress, short: true },
        { title: "Blocked By", value: blockedBy, short: true },
        { title: "Reason", value: reason, short: false },
      ],
      auditTitle: "IP Address Blocked",
      auditDescription: `IP *${ipAddress}* blocked by ${blockedBy}`,
      auditFields: [
        { title: "IP Address", value: ipAddress, short: true },
        { title: "Blocked By", value: blockedBy, short: true },
        { title: "Reason", value: reason, short: false },
      ],
    });
  },

  /**
   * Confirmation when user is suspended
   * → #admin-actions + #audit-log (single combined dispatch)
   */
  userSuspended: async (
    userId: number,
    userName: string,
    reason: string,
    suspendedBy: string
  ): Promise<boolean> => {
    return dispatchAdminActionWithAudit({
      title: "User Account Suspended",
      description: `User *${userName}* (ID: ${userId}) has been suspended.`,
      severity: "warning",
      fields: [
        { title: "User", value: userName, short: true },
        { title: "Suspended By", value: suspendedBy, short: true },
        { title: "Reason", value: reason, short: false },
      ],
      auditTitle: "User Account Suspended",
      auditDescription: `User *${userName}* (ID: ${userId}) suspended by ${suspendedBy}`,
      auditFields: [
        { title: "User", value: userName, short: true },
        { title: "User ID", value: String(userId), short: true },
        { title: "Suspended By", value: suspendedBy, short: true },
        { title: "Reason", value: reason, short: false },
      ],
    });
  },

  /**
   * Admin action performed (routine)
   * → #admin-actions only
   */
  adminAction: async (
    adminName: string,
    adminId: number,
    action: string,
    targetType: string,
    targetId: string,
    details?: string
  ): Promise<boolean> => {
    return dispatchAdminAction({
      title: "Admin Action Performed",
      description: `Admin *${adminName}* performed an action.`,
      severity: "info",
      fields: [
        { title: "Admin", value: `${adminName} (ID: ${adminId})`, short: true },
        { title: "Action", value: action, short: true },
        { title: "Target", value: `${targetType}: ${targetId}`, short: true },
        ...(details ? [{ title: "Details", value: details, short: false }] : []),
      ],
    });
  },

  /**
   * Sensitive admin action performed
   * → #admin-actions + #audit-log (single combined dispatch)
   */
  sensitiveAdminAction: async (
    adminName: string,
    adminId: number,
    action: string,
    targetType: string,
    targetId: string,
    details?: string
  ): Promise<boolean> => {
    return dispatchAdminActionWithAudit({
      title: "⚠️ Sensitive Admin Action",
      description: `Admin *${adminName}* performed a sensitive action that requires attention.`,
      severity: "warning",
      fields: [
        { title: "Admin", value: `${adminName} (ID: ${adminId})`, short: true },
        { title: "Action", value: action, short: true },
        { title: "Target", value: `${targetType}: ${targetId}`, short: true },
        ...(details ? [{ title: "Details", value: details, short: false }] : []),
      ],
      auditTitle: "Sensitive Admin Action",
      auditDescription: `Admin *${adminName}* (ID: ${adminId}) performed: ${action}`,
      auditFields: [
        { title: "Admin", value: `${adminName} (ID: ${adminId})`, short: true },
        { title: "Action", value: action, short: true },
        { title: "Target", value: `${targetType}: ${targetId}`, short: true },
        ...(details ? [{ title: "Details", value: details, short: false }] : []),
      ],
    });
  },

  /**
   * Unauthorized admin access attempt
   * → #security-alerts (critical) + #admin-actions (with buttons) + #audit-log
   */
  unauthorizedAdminAccess: async (
    userId: number,
    userName: string,
    attemptedAction: string,
    ipAddress?: string
  ): Promise<boolean> => {
    // This is always critical, so dispatchSecurityAlert will auto-send to both channels
    const result = await dispatchSecurityAlert({
      title: "🚨 Unauthorized Admin Access Attempt",
      description: `User *${userName}* (ID: ${userId}) attempted to access admin functionality without proper authorization.`,
      severity: "critical",
      fields: [
        { title: "User", value: `${userName} (ID: ${userId})`, short: true },
        { title: "Attempted Action", value: attemptedAction, short: true },
        ...(ipAddress ? [{ title: "IP Address", value: ipAddress, short: true }] : []),
      ],
      userId,
      userName,
      ipAddress,
      alertContext: {
        attackType: "unauthorized_admin_access",
        attemptedAction,
      },
    });

    // Also log to #audit-log
    await dispatchAuditLog({
      title: "Unauthorized Admin Access Attempt",
      description: `User *${userName}* (ID: ${userId}) attempted: ${attemptedAction}`,
      fields: [
        { title: "User", value: `${userName} (ID: ${userId})`, short: true },
        { title: "Attempted Action", value: attemptedAction, short: true },
        ...(ipAddress ? [{ title: "IP Address", value: ipAddress, short: true }] : []),
      ],
      severity: "critical",
    });

    return result;
  },

  /**
   * Alert when a chargeback/dispute is filed
   * → #billing-alerts + #audit-log (critical — direct financial impact)
   */
  chargebackFiled: async (
    disputeId: string,
    chargeId: string,
    amount: number,
    currency: string,
    reason: string,
    userId?: number,
    userName?: string
  ): Promise<boolean> => {
    const amountFormatted = `$${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
    const userInfo = userName ? `*${userName}* (ID: ${userId})` : "Unknown user";

    const result = await dispatchBillingAlertWithAudit({
      title: "\u26a0\ufe0f Chargeback / Dispute Filed",
      description: `A chargeback has been filed for ${amountFormatted}. User: ${userInfo}.`,
      severity: "critical",
      fields: [
        { title: "Dispute ID", value: disputeId, short: true },
        { title: "Charge ID", value: chargeId, short: true },
        { title: "Amount", value: amountFormatted, short: true },
        { title: "Reason", value: reason || "Not specified", short: true },
        ...(userName ? [{ title: "User", value: `${userName} (ID: ${userId})`, short: true }] : []),
      ],
      auditTitle: "Chargeback / Dispute Filed",
      auditDescription: `Dispute ${disputeId} filed for ${amountFormatted}. User: ${userInfo}. Reason: ${reason || "N/A"}.`,
      auditFields: [
        { title: "Dispute ID", value: disputeId, short: true },
        { title: "Charge ID", value: chargeId, short: true },
        { title: "Amount", value: amountFormatted, short: true },
        { title: "Reason", value: reason || "Not specified", short: true },
        ...(userName ? [{ title: "User", value: `${userName} (ID: ${userId})`, short: true }] : []),
      ],
    });

    return result;
  },

  /**
   * Alert when a chargeback/dispute is resolved
   * → #billing-alerts + #audit-log
   */
  chargebackResolved: async (
    disputeId: string,
    chargeId: string,
    amount: number,
    currency: string,
    status: string,
    userId?: number,
    userName?: string
  ): Promise<boolean> => {
    const amountFormatted = `$${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
    const userInfo = userName ? `*${userName}* (ID: ${userId})` : "Unknown user";
    const won = status === "won";
    const statusEmoji = won ? "\u2705" : "\u274c";

    return dispatchBillingAlertWithAudit({
      title: `${statusEmoji} Chargeback / Dispute ${won ? "Won" : "Lost"}`,
      description: `Dispute ${disputeId} for ${amountFormatted} has been ${status}. User: ${userInfo}.`,
      severity: won ? "info" : "critical",
      fields: [
        { title: "Dispute ID", value: disputeId, short: true },
        { title: "Outcome", value: status.toUpperCase(), short: true },
        { title: "Amount", value: amountFormatted, short: true },
        ...(userName ? [{ title: "User", value: `${userName} (ID: ${userId})`, short: true }] : []),
      ],
      auditTitle: `Chargeback / Dispute ${won ? "Won" : "Lost"}`,
      auditDescription: `Dispute ${disputeId} for ${amountFormatted} resolved: ${status}. User: ${userInfo}.`,
      auditFields: [
        { title: "Dispute ID", value: disputeId, short: true },
        { title: "Outcome", value: status.toUpperCase(), short: true },
        { title: "Amount", value: amountFormatted, short: true },
        ...(userName ? [{ title: "User", value: `${userName} (ID: ${userId})`, short: true }] : []),
      ],
    });
  },

  // ============ NEW Billing Alerts (Feb 2026) ============

  /**
   * Alert when a subscription is cancelled
   * → #billing-alerts
   */
  subscriptionCancelled: async (
    userId: number,
    userName: string,
    plan: string,
    reason?: string
  ): Promise<boolean> => {
    return dispatchBillingAlert({
      title: "Subscription Cancelled",
      description: `User *${userName}* (ID: ${userId}) cancelled their *${plan}* subscription.`,
      severity: "warning",
      fields: [
        { title: "User", value: `${userName} (ID: ${userId})`, short: true },
        { title: "Plan", value: plan, short: true },
        ...(reason ? [{ title: "Reason", value: reason, short: false }] : []),
      ],
    });
  },

  /**
   * Alert when a payment fails
   * → #billing-alerts
   */
  paymentFailed: async (
    userId: number,
    userName: string,
    amount: number,
    currency: string,
    failureReason?: string
  ): Promise<boolean> => {
    const amountFormatted = `$${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
    return dispatchBillingAlert({
      title: "Payment Failed",
      description: `Payment of ${amountFormatted} failed for user *${userName}* (ID: ${userId}).`,
      severity: "warning",
      fields: [
        { title: "User", value: `${userName} (ID: ${userId})`, short: true },
        { title: "Amount", value: amountFormatted, short: true },
        ...(failureReason ? [{ title: "Failure Reason", value: failureReason, short: false }] : []),
      ],
    });
  },

  /**
   * Alert when a large credit purchase is made (above threshold)
   * → #billing-alerts
   */
  largeCreditPurchase: async (
    userId: number,
    userName: string,
    credits: number,
    amountCents: number,
    currency: string
  ): Promise<boolean> => {
    const amountFormatted = `$${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`;
    return dispatchBillingAlert({
      title: "Large Credit Purchase",
      description: `User *${userName}* (ID: ${userId}) purchased *${credits.toLocaleString()} credits* for ${amountFormatted}.`,
      severity: "info",
      fields: [
        { title: "User", value: `${userName} (ID: ${userId})`, short: true },
        { title: "Credits", value: credits.toLocaleString(), short: true },
        { title: "Amount", value: amountFormatted, short: true },
      ],
    });
  },

  /**
   * Alert when unusual credit consumption spike is detected
   * → #billing-alerts + #audit-log
   */
  consumptionSpike: async (
    userId: number,
    userName: string,
    recentUsage: number,
    averageUsage: number,
    period: string
  ): Promise<boolean> => {
    const multiplier = averageUsage > 0 ? (recentUsage / averageUsage).toFixed(1) : "N/A";
    return dispatchBillingAlertWithAudit({
      title: "Unusual Credit Consumption Spike",
      description: `User *${userName}* (ID: ${userId}) consumed *${recentUsage.toLocaleString()} credits* in the last ${period}, which is *${multiplier}x* their average.`,
      severity: "warning",
      fields: [
        { title: "User", value: `${userName} (ID: ${userId})`, short: true },
        { title: "Recent Usage", value: `${recentUsage.toLocaleString()} credits`, short: true },
        { title: "Average Usage", value: `${averageUsage.toLocaleString()} credits`, short: true },
        { title: "Multiplier", value: `${multiplier}x normal`, short: true },
        { title: "Period", value: period, short: true },
      ],
      auditTitle: "Credit Consumption Spike Detected",
      auditDescription: `User ${userName} (ID: ${userId}) consumed ${recentUsage} credits in ${period} (${multiplier}x average).`,
    });
  },

  /**
   * Alert when a Stripe refund is issued via change request
   * → #billing-alerts + #audit-log
   */
  stripeRefundIssued: async (data: {
    userId: number;
    userName: string;
    refundAmountCents: number;
    refundType: string;
    creditsDeducted: number;
    stripeRefundId: string;
    changeRequestId: number;
    approvedBy: string;
  }): Promise<boolean> => {
    return dispatchBillingAlertWithAudit({
      title: "Stripe Refund Issued",
      description: `Refund of *$${(data.refundAmountCents / 100).toFixed(2)}* issued for *${data.userName}* (ID: ${data.userId}).`,
      severity: "warning",
      fields: [
        { title: "User", value: `${data.userName} (ID: ${data.userId})`, short: true },
        { title: "Refund Amount", value: `$${(data.refundAmountCents / 100).toFixed(2)}`, short: true },
        { title: "Refund Type", value: data.refundType, short: true },
        { title: "Credits Deducted", value: `${data.creditsDeducted}`, short: true },
        { title: "Stripe Refund ID", value: data.stripeRefundId, short: true },
        { title: "Change Request", value: `#${data.changeRequestId}`, short: true },
        { title: "Approved By", value: data.approvedBy, short: true },
      ],
      auditTitle: "Stripe Refund Issued",
      auditDescription: `Refund of $${(data.refundAmountCents / 100).toFixed(2)} (${data.refundType}) issued for ${data.userName}. ${data.creditsDeducted} credits deducted. CR #${data.changeRequestId}.`,
    });
  },
  /**
   * Alert when credit purchase velocity limit is hit
   * → #billing-alerts
   */
  velocityLimitHit: async (
    userId: number,
    userName: string,
    limitType: string,
    currentCount: number,
    maxAllowed: number
  ): Promise<boolean> => {
    return dispatchBillingAlert({
      title: "Credit Purchase Velocity Limit Hit",
      description: `User *${userName}* (ID: ${userId}) hit the *${limitType}* purchase velocity limit.`,
      severity: "warning",
      fields: [
        { title: "User", value: `${userName} (ID: ${userId})`, short: true },
        { title: "Limit Type", value: limitType, short: true },
        { title: "Attempts", value: `${currentCount}/${maxAllowed}`, short: true },
      ],
    });
  },

  /**
   * Alert when an account is auto-frozen due to credit discrepancy
   * → #billing-alerts (critical)
   */
  accountAutoFrozen: async (
    userId: number,
    userName: string,
    discrepancy: number,
    threshold: number
  ): Promise<boolean> => {
    return dispatchBillingAlert({
      title: "🧊 Account Auto-Frozen: Credit Discrepancy",
      description: `User *${userName}* (ID: ${userId}) has been automatically frozen due to a credit discrepancy of *${discrepancy} credits* (threshold: ${threshold}).`,
      severity: "critical",
      fields: [
        { title: "User", value: `${userName} (ID: ${userId})`, short: true },
        { title: "Discrepancy", value: `${discrepancy} credits`, short: true },
        { title: "Threshold", value: `${threshold} credits`, short: true },
        { title: "Action Required", value: "Moderator review needed", short: true },
      ],
    });
  },
};
