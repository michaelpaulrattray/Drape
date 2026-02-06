/**
 * Slack Notification Service - Three-Channel Architecture
 * 
 * Routes messages to the correct Slack channel based on type:
 * 
 * #security-alerts (SLACK_WEBHOOK_URL)
 *   - Abuse detection, rate limits, unauthorized access, suspicious activity
 *   - Moderators + Admins can see these
 *   - Contains "Escalate to Admin" button (no direct action buttons)
 *   - Critical alerts also send action buttons to #admin-actions simultaneously
 * 
 * #admin-actions (SLACK_ADMIN_ACTIONS_WEBHOOK_URL)
 *   - Approval requests for sensitive actions (Approve/Deny buttons)
 *   - Emergency action buttons (Block IP, Suspend User) for critical alerts
 *   - Admin activity confirmations
 *   - Admins only
 * 
 * #audit-log (SLACK_AUDIT_LOG_WEBHOOK_URL)
 *   - Immutable log entries
 *   - Completed action confirmations
 *   - Compliance trail
 *   - Admins only (read-only record)
 * 
 * SETUP:
 * 1. Create a Slack App at https://api.slack.com/apps
 * 2. Enable Incoming Webhooks and add to your channels
 * 3. Enable Interactivity with Request URL: https://[your-domain]/api/slack/interactions
 * 4. Set SLACK_WEBHOOK_URL (security-alerts channel)
 * 5. Set SLACK_ADMIN_ACTIONS_WEBHOOK_URL (admin-actions channel)
 * 6. Set SLACK_AUDIT_LOG_WEBHOOK_URL (audit-log channel)
 * 7. Set SLACK_SIGNING_SECRET (for verifying button callbacks)
 */

import { createEmergencyToken } from "./db";
import { ENV } from "./_core/env";

// ============ Channel Webhook Getters ============

/** #security-alerts - Moderators + Admins see threat info */
const getSecurityAlertsWebhook = () => process.env.SLACK_WEBHOOK_URL;

/** #admin-actions - Admins only, has action buttons */
const getAdminActionsWebhook = () => process.env.SLACK_ADMIN_ACTIONS_WEBHOOK_URL;

/** #audit-log - Admins only, read-only compliance trail */
const getAuditLogWebhook = () => process.env.SLACK_AUDIT_LOG_WEBHOOK_URL;

/** Slack signing secret for verifying interaction callbacks */
const getSlackSigningSecret = () => process.env.SLACK_SIGNING_SECRET;

// ============ Types ============

export type SlackChannel = "security-alerts" | "admin-actions" | "audit-log";

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

// Color mapping for severity levels
const SEVERITY_COLORS = {
  info: "#36a64f",      // Green
  warning: "#ff9800",   // Orange
  critical: "#ff0000",  // Red
};

// Emoji mapping for severity
const SEVERITY_EMOJI = {
  info: "ℹ️",
  warning: "⚠️",
  critical: "🚨",
};

// ============ Core Send Functions ============

/**
 * Send a message to a specific Slack channel.
 * Low-level function used by all channel-specific senders.
 */
export async function sendToChannel(
  channel: SlackChannel,
  payload: Record<string, unknown>
): Promise<boolean> {
  const webhookMap: Record<SlackChannel, string | undefined> = {
    "security-alerts": getSecurityAlertsWebhook(),
    "admin-actions": getAdminActionsWebhook(),
    "audit-log": getAuditLogWebhook(),
  };

  const webhookUrl = webhookMap[channel];

  if (!webhookUrl) {
    console.log(`[Slack] ${channel} webhook not configured, skipping`);
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Slack] Failed to send to ${channel}:`, response.status, errorText);
      return false;
    }

    console.log(`[Slack] Message sent to ${channel}`);
    return true;
  } catch (error) {
    console.error(`[Slack] Error sending to ${channel}:`, error);
    return false;
  }
}

// ============ Security Alerts Channel (#security-alerts) ============

/**
 * Send a security alert to #security-alerts.
 * 
 * For NON-CRITICAL alerts: Info only + "Escalate to Admin" button
 * For CRITICAL alerts: Info in #security-alerts + action buttons in #admin-actions
 */
export async function sendSlackAlert(options: SlackAlertOptions): Promise<boolean> {
  const { title, description, severity, fields = [], ipAddress, userId, userName, alertContext } = options;

  // Build info blocks (no action buttons for security-alerts)
  const infoBlocks = buildInfoBlocks(title, description, severity, fields);

  // For non-critical: add "Escalate to Admin" button
  // For critical: add a note that action buttons were sent to admin channel
  if (severity === "critical") {
    infoBlocks.push({
      type: "context",
      elements: [{
        type: "mrkdwn",
        text: "🔔 _Emergency action buttons sent to #admin-actions channel_",
      }],
    });

    // Send action buttons to #admin-actions simultaneously
    await sendEmergencyActionsToAdminChannel(
      title, description, fields, ipAddress, userId, userName, alertContext
    );
  } else {
    // Add escalation button for moderators
    const escalationData: Record<string, unknown> = {
      title,
      description,
      severity,
      fields,
    };
    if (ipAddress) escalationData.ipAddress = ipAddress;
    if (userId) escalationData.userId = userId;
    if (userName) escalationData.userName = userName;
    if (alertContext) escalationData.alertContext = alertContext;

    infoBlocks.push({ type: "divider" });
    infoBlocks.push({
      type: "actions",
      elements: [{
        type: "button",
        text: {
          type: "plain_text",
          text: "📤 Escalate to Admin",
          emoji: true,
        },
        action_id: "escalate_to_admin",
        value: JSON.stringify(escalationData),
        confirm: {
          title: { type: "plain_text", text: "Escalate to Admin?" },
          text: {
            type: "mrkdwn",
            text: `This will send an alert with emergency action buttons to the *#admin-actions* channel.\n\n*Alert:* ${title}`,
          },
          confirm: { type: "plain_text", text: "Escalate" },
          deny: { type: "plain_text", text: "Cancel" },
        },
      }],
    });
  }

  // Send to #security-alerts
  return sendToChannel("security-alerts", {
    text: `${SEVERITY_EMOJI[severity]} ${title}`,
    blocks: infoBlocks,
    attachments: [{
      color: SEVERITY_COLORS[severity],
      fallback: `${title}: ${description}`,
    }],
  });
}

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
  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `🚨 Emergency Action Required`,
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${title}*\n${description}`,
      },
    },
  ];

  if (fields.length > 0) {
    blocks.push({
      type: "section",
      fields: fields.map(f => ({
        type: "mrkdwn",
        text: `*${f.title}*\n${f.value}`,
      })),
    });
  }

  blocks.push({
    type: "context",
    elements: [{
      type: "mrkdwn",
      text: `Escalated at <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
    }],
  });

  // Build emergency action buttons
  const actionButtons: any[] = [];

  if (ipAddress) {
    const tokenResult = await createEmergencyToken("block_ip", ipAddress, {
      ...alertContext,
      alertTitle: title,
    });

    if (tokenResult) {
      actionButtons.push({
        type: "button",
        text: {
          type: "plain_text",
          text: `🚫 Block IP ${ipAddress}`,
          emoji: true,
        },
        style: "danger",
        action_id: "block_ip",
        value: JSON.stringify({
          token: tokenResult.token,
          ip: ipAddress,
        }),
        confirm: {
          title: { type: "plain_text", text: "Block IP Address?" },
          text: {
            type: "mrkdwn",
            text: `This will immediately block IP *${ipAddress}* from accessing the system. This action is logged.`,
          },
          confirm: { type: "plain_text", text: "Block IP" },
          deny: { type: "plain_text", text: "Cancel" },
        },
      });
    }
  }

  if (userId) {
    const tokenResult = await createEmergencyToken("suspend_user", String(userId), {
      ...alertContext,
      alertTitle: title,
      userName,
    });

    if (tokenResult) {
      actionButtons.push({
        type: "button",
        text: {
          type: "plain_text",
          text: `⛔ Suspend User ${userName || userId}`,
          emoji: true,
        },
        style: "danger",
        action_id: "suspend_user",
        value: JSON.stringify({
          token: tokenResult.token,
          userId,
          userName,
        }),
        confirm: {
          title: { type: "plain_text", text: "Suspend User Account?" },
          text: {
            type: "mrkdwn",
            text: `This will immediately suspend ${userName ? `*${userName}*` : `user ID *${userId}*`}'s account. This action is logged.`,
          },
          confirm: { type: "plain_text", text: "Suspend User" },
          deny: { type: "plain_text", text: "Cancel" },
        },
      });
    }
  }

  if (actionButtons.length > 0) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Emergency Actions* (valid for 24 hours)",
      },
    });
    blocks.push({
      type: "actions",
      elements: actionButtons,
    });
  }

  return sendToChannel("admin-actions", {
    text: `🚨 Emergency Action Required: ${title}`,
    blocks,
    attachments: [{
      color: "#ff0000",
      fallback: `Emergency: ${title} - ${description}`,
    }],
  });
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
  const { title, description, severity, fields = [] } = options;
  const blocks = buildInfoBlocks(title, description, severity, fields);

  return sendToChannel("admin-actions", {
    text: `${SEVERITY_EMOJI[severity]} ${title}`,
    blocks,
    attachments: [{
      color: SEVERITY_COLORS[severity],
      fallback: `${title}: ${description}`,
    }],
  });
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
  const { title, description, fields = [], severity = "info" } = options;
  
  const blocks: any[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${title}*\n${description}`,
      },
    },
  ];

  if (fields.length > 0) {
    blocks.push({
      type: "section",
      fields: fields.map(f => ({
        type: "mrkdwn",
        text: `*${f.title}*\n${f.value}`,
      })),
    });
  }

  blocks.push({
    type: "context",
    elements: [{
      type: "mrkdwn",
      text: `Logged at <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
    }],
  });

  return sendToChannel("audit-log", {
    text: `📋 ${title}`,
    blocks,
    attachments: [{
      color: SEVERITY_COLORS[severity],
      fallback: `Audit: ${title}: ${description}`,
    }],
  });
}

// ============ Shared Block Builders ============

/**
 * Build standard info blocks (header, description, fields, timestamp).
 * No action buttons - those are added by the caller based on channel.
 */
function buildInfoBlocks(
  title: string,
  description: string,
  severity: "info" | "warning" | "critical",
  fields: Array<{ title: string; value: string; short?: boolean }>
): any[] {
  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${SEVERITY_EMOJI[severity]} ${title}`,
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: description,
      },
    },
  ];

  if (fields.length > 0) {
    blocks.push({
      type: "section",
      fields: fields.map(f => ({
        type: "mrkdwn",
        text: `*${f.title}*\n${f.value}`,
      })),
    });
  }

  blocks.push({
    type: "context",
    elements: [{
      type: "mrkdwn",
      text: `Detected at <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
    }],
  });

  return blocks;
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
  const signingSecret = getSlackSigningSecret();

  if (!signingSecret) {
    console.warn("[Slack] Signing secret not configured");
    return false;
  }

  const requestTimestamp = parseInt(timestamp, 10);
  const currentTimestamp = Math.floor(Date.now() / 1000);

  if (Math.abs(currentTimestamp - requestTimestamp) > 300) {
    console.warn("[Slack] Request timestamp too old");
    return false;
  }

  const crypto = require("crypto");
  const sigBasestring = `v0:${timestamp}:${body}`;
  const expectedSignature = "v0=" + crypto
    .createHmac("sha256", signingSecret)
    .update(sigBasestring)
    .digest("hex");

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
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
   * → #admin-actions (confirmation) + #audit-log (record)
   */
  ipBlocked: async (
    ipAddress: string,
    reason: string,
    blockedBy: string
  ): Promise<boolean> => {
    // Send confirmation to #admin-actions
    await sendAdminActionNotification({
      title: "IP Address Blocked",
      description: `IP address *${ipAddress}* has been blocked.`,
      severity: "info",
      fields: [
        { title: "IP Address", value: ipAddress, short: true },
        { title: "Blocked By", value: blockedBy, short: true },
        { title: "Reason", value: reason, short: false },
      ],
    });

    // Send to #audit-log
    return sendAuditLogEntry({
      title: "IP Address Blocked",
      description: `IP *${ipAddress}* blocked by ${blockedBy}`,
      fields: [
        { title: "IP Address", value: ipAddress, short: true },
        { title: "Blocked By", value: blockedBy, short: true },
        { title: "Reason", value: reason, short: false },
      ],
    });
  },

  /**
   * Confirmation when user is suspended
   * → #admin-actions (confirmation) + #audit-log (record)
   */
  userSuspended: async (
    userId: number,
    userName: string,
    reason: string,
    suspendedBy: string
  ): Promise<boolean> => {
    // Send confirmation to #admin-actions
    await sendAdminActionNotification({
      title: "User Account Suspended",
      description: `User *${userName}* (ID: ${userId}) has been suspended.`,
      severity: "info",
      fields: [
        { title: "User", value: userName, short: true },
        { title: "Suspended By", value: suspendedBy, short: true },
        { title: "Reason", value: reason, short: false },
      ],
    });

    // Send to #audit-log
    return sendAuditLogEntry({
      title: "User Account Suspended",
      description: `User *${userName}* (ID: ${userId}) suspended by ${suspendedBy}`,
      fields: [
        { title: "User", value: userName, short: true },
        { title: "User ID", value: String(userId), short: true },
        { title: "Suspended By", value: suspendedBy, short: true },
        { title: "Reason", value: reason, short: false },
      ],
      severity: "warning",
    });
  },

  /**
   * Admin action performed (routine)
   * → #admin-actions
   */
  adminAction: async (
    adminName: string,
    adminId: number,
    action: string,
    targetType: string,
    targetId: string,
    details?: string
  ): Promise<boolean> => {
    return sendAdminActionNotification({
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
   * → #admin-actions (warning) + #audit-log (record)
   */
  sensitiveAdminAction: async (
    adminName: string,
    adminId: number,
    action: string,
    targetType: string,
    targetId: string,
    details?: string
  ): Promise<boolean> => {
    // Send to #admin-actions
    await sendAdminActionNotification({
      title: "⚠️ Sensitive Admin Action",
      description: `Admin *${adminName}* performed a sensitive action that requires attention.`,
      severity: "warning",
      fields: [
        { title: "Admin", value: `${adminName} (ID: ${adminId})`, short: true },
        { title: "Action", value: action, short: true },
        { title: "Target", value: `${targetType}: ${targetId}`, short: true },
        ...(details ? [{ title: "Details", value: details, short: false }] : []),
      ],
    });

    // Also log to #audit-log
    return sendAuditLogEntry({
      title: "Sensitive Admin Action",
      description: `Admin *${adminName}* (ID: ${adminId}) performed: ${action}`,
      fields: [
        { title: "Admin", value: `${adminName} (ID: ${adminId})`, short: true },
        { title: "Action", value: action, short: true },
        { title: "Target", value: `${targetType}: ${targetId}`, short: true },
        ...(details ? [{ title: "Details", value: details, short: false }] : []),
      ],
      severity: "warning",
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
    // This is always critical, so sendSlackAlert will auto-send to both channels
    const result = await sendSlackAlert({
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
    await sendAuditLogEntry({
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
};
