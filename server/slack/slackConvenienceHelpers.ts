/**
 * Slack Convenience Helpers - High-level dispatch functions for
 * security alerts, emergency actions, audit logs, admin actions,
 * and billing alerts.
 */

import { createEmergencyToken } from "../db";
import { dispatch, buildStandardBlocks } from "./slackCore";

// ============================================================================
// SECURITY ALERTS
// ============================================================================

/**
 * Send a security alert. Routes to #security-alerts.
 * For critical alerts, also sends emergency actions to #admin-actions.
 */
export async function dispatchSecurityAlert(options: {
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  fields?: Array<{ title: string; value: string; short?: boolean }>;
  ipAddress?: string;
  userId?: number;
  userName?: string;
  alertContext?: Record<string, unknown>;
}): Promise<boolean> {
  const { title, description, severity, fields = [], ipAddress, userId, userName, alertContext } = options;
  
  const infoBlocks = buildStandardBlocks({ type: "security", title, description, severity, fields });
  
  if (severity === "critical") {
    infoBlocks.push({
      type: "context",
      elements: [{
        type: "mrkdwn",
        text: "🔔 _Emergency action buttons sent to #admin-actions channel_",
      }],
    });
  } else {
    const escalationData: Record<string, unknown> = { title, description, severity, fields };
    if (ipAddress) escalationData.ipAddress = ipAddress;
    if (userId) escalationData.userId = userId;
    if (userName) escalationData.userName = userName;
    if (alertContext) escalationData.alertContext = alertContext;
    
    infoBlocks.push({ type: "divider" });
    infoBlocks.push({
      type: "actions",
      elements: [{
        type: "button",
        text: { type: "plain_text", text: "📤 Escalate to Admin", emoji: true },
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
  
  const secResult = await dispatch({
    type: `security_alert`,
    title,
    description,
    severity,
    fields,
    channels: ["security-alerts"],
    customBlocks: infoBlocks,
    skipDedup: severity === "critical",
  });
  
  if (severity === "critical") {
    await dispatchEmergencyActions(title, description, fields, ipAddress, userId, userName, alertContext);
  }
  
  return secResult.sent;
}

// ============================================================================
// EMERGENCY ACTIONS
// ============================================================================

/**
 * Send emergency action buttons to #admin-actions.
 */
export async function dispatchEmergencyActions(
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
      text: { type: "plain_text", text: `🚨 Emergency Action Required`, emoji: true },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*${title}*\n${description}` },
    },
  ];
  
  if (fields.length > 0) {
    blocks.push({
      type: "section",
      fields: fields.map(f => ({ type: "mrkdwn", text: `*${f.title}*\n${f.value}` })),
    });
  }
  
  blocks.push({
    type: "context",
    elements: [{
      type: "mrkdwn",
      text: `Escalated at <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
    }],
  });
  
  const actionButtons: any[] = [];
  
  if (ipAddress) {
    const tokenResult = await createEmergencyToken("block_ip", ipAddress, {
      ...alertContext,
      alertTitle: title,
    });
    if (tokenResult) {
      actionButtons.push({
        type: "button",
        text: { type: "plain_text", text: `🚫 Block IP ${ipAddress}`, emoji: true },
        style: "danger",
        action_id: "block_ip",
        value: JSON.stringify({ token: tokenResult.token, ip: ipAddress }),
        confirm: {
          title: { type: "plain_text", text: "Block IP Address?" },
          text: { type: "mrkdwn", text: `This will immediately block IP *${ipAddress}* from accessing the system. This action is logged.` },
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
        text: { type: "plain_text", text: `⛔ Suspend User ${userName || userId}`, emoji: true },
        style: "danger",
        action_id: "suspend_user",
        value: JSON.stringify({ token: tokenResult.token, userId, userName }),
        confirm: {
          title: { type: "plain_text", text: "Suspend User Account?" },
          text: { type: "mrkdwn", text: `This will immediately suspend ${userName ? `*${userName}*` : `user ID *${userId}*`}'s account. This action is logged.` },
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
      text: { type: "mrkdwn", text: "*Emergency Actions* (valid for 24 hours)" },
    });
    blocks.push({ type: "actions", elements: actionButtons });
  }
  
  const result = await dispatch({
    type: "emergency_actions",
    title: `Emergency Action Required: ${title}`,
    description,
    severity: "critical",
    channels: ["admin-actions"],
    customBlocks: blocks,
    skipDedup: true,
  });
  
  return result.sent;
}

// ============================================================================
// AUDIT LOG
// ============================================================================

/**
 * Dispatch an audit log entry. Routes to #audit-log only.
 */
export async function dispatchAuditLog(options: {
  title: string;
  description: string;
  fields?: Array<{ title: string; value: string; short?: boolean }>;
  severity?: "info" | "warning" | "critical";
}): Promise<boolean> {
  const result = await dispatch({
    type: "audit_log_entry",
    title: options.title,
    description: options.description,
    severity: options.severity || "info",
    fields: options.fields,
    channels: ["audit-log"],
  });
  return result.sent;
}

// ============================================================================
// ADMIN ACTIONS
// ============================================================================

/**
 * Dispatch an admin action notification. Routes to #admin-actions only.
 */
export async function dispatchAdminAction(options: {
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  fields?: Array<{ title: string; value: string; short?: boolean }>;
}): Promise<boolean> {
  const result = await dispatch({
    type: "admin_action_notification",
    title: options.title,
    description: options.description,
    severity: options.severity,
    fields: options.fields,
    channels: ["admin-actions"],
  });
  return result.sent;
}

/**
 * Dispatch a combined admin action + audit log event.
 */
export async function dispatchAdminActionWithAudit(options: {
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  fields?: Array<{ title: string; value: string; short?: boolean }>;
  auditTitle?: string;
  auditDescription?: string;
  auditFields?: Array<{ title: string; value: string; short?: boolean }>;
}): Promise<boolean> {
  const adminResult = await dispatch({
    type: "admin_action_with_audit",
    title: options.title,
    description: options.description,
    severity: options.severity,
    fields: options.fields,
    channels: ["admin-actions"],
  });
  
  const auditResult = await dispatch({
    type: "admin_action_with_audit",
    title: options.auditTitle || options.title,
    description: options.auditDescription || options.description,
    severity: options.severity,
    fields: options.auditFields || options.fields,
    channels: ["audit-log"],
  });
  
  return adminResult.sent || auditResult.sent;
}

// ============================================================================
// BILLING ALERTS
// ============================================================================

/**
 * Dispatch a billing alert. Routes to #billing-alerts.
 */
export async function dispatchBillingAlert(options: {
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  fields?: Array<{ title: string; value: string; short?: boolean }>;
}): Promise<boolean> {
  const result = await dispatch({
    type: "billing_alert",
    title: options.title,
    description: options.description,
    severity: options.severity,
    fields: options.fields,
    channels: ["billing-alerts"],
  });
  return result.sent;
}

/**
 * Dispatch a billing alert to both #billing-alerts and #audit-log.
 */
export async function dispatchBillingAlertWithAudit(options: {
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  fields?: Array<{ title: string; value: string; short?: boolean }>;
  auditTitle?: string;
  auditDescription?: string;
  auditFields?: Array<{ title: string; value: string; short?: boolean }>;
}): Promise<boolean> {
  const billingResult = await dispatch({
    type: "billing_alert_with_audit",
    title: options.title,
    description: options.description,
    severity: options.severity,
    fields: options.fields,
    channels: ["billing-alerts"],
  });
  
  const auditResult = await dispatch({
    type: "billing_alert_with_audit",
    title: options.auditTitle || options.title,
    description: options.auditDescription || options.description,
    severity: options.severity,
    fields: options.auditFields || options.fields,
    channels: ["audit-log"],
  });
  
  return billingResult.sent || auditResult.sent;
}
