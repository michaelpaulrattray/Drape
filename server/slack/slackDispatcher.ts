/**
 * Centralized Slack Notification Dispatcher
 * 
 * Single entry point for ALL Slack notifications across the application.
 * Provides:
 * - Event-based API: callers emit typed events, dispatcher handles routing
 * - Deduplication: same event (by content hash) is sent at most once per time window
 * - Channel routing: events are automatically routed to the correct channel(s)
 * - Rate limiting: prevents burst spam to any single channel
 * 
 * USAGE:
 *   import { dispatch } from "./slackDispatcher";
 *   await dispatch({ type: "admin_action", ... });
 * 
 * All other Slack-sending modules (slackNotification, slackApproval, adminSecurity)
 * should route through this dispatcher instead of calling sendToChannel directly.
 */

import { createEmergencyToken } from "../db";

// ============ Channel Config ============

export type SlackChannel = "security-alerts" | "admin-actions" | "audit-log" | "billing-alerts";

const getWebhook = (channel: SlackChannel): string | undefined => {
  switch (channel) {
    case "security-alerts": return process.env.SLACK_WEBHOOK_URL;
    case "admin-actions": return process.env.SLACK_ADMIN_ACTIONS_WEBHOOK_URL;
    case "audit-log": return process.env.SLACK_AUDIT_LOG_WEBHOOK_URL;
    case "billing-alerts": return process.env.SLACK_BILLING_ALERTS_WEBHOOK_URL;
  }
};

// ============ Dedup Cache ============

const DEDUP_WINDOW_MS = 60_000; // 60 seconds
const MAX_CACHE_SIZE = 500;

interface DedupEntry {
  hash: string;
  sentAt: number;
  channel: SlackChannel;
}

const dedupCache: Map<string, DedupEntry> = new Map();

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureDedupCleanup(): void {
  if (!cleanupTimer) {
    cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of Array.from(dedupCache.entries())) {
        if (now - entry.sentAt > DEDUP_WINDOW_MS * 2) {
          dedupCache.delete(key);
        }
      }
    }, DEDUP_WINDOW_MS);
    // Don't block process exit
    if (cleanupTimer.unref) cleanupTimer.unref();
  }
}

function computeHash(channel: SlackChannel, title: string, eventType: string): string {
  // Simple hash: channel + eventType + title normalized
  const key = `${channel}:${eventType}:${title.trim().toLowerCase()}`;
  // Use a simple string hash for speed (no crypto needed for dedup)
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return String(hash);
}

function isDuplicate(channel: SlackChannel, title: string, eventType: string): boolean {
  const hash = computeHash(channel, title, eventType);
  const cacheKey = `${channel}:${hash}`;
  const existing = dedupCache.get(cacheKey);
  
  if (existing && (Date.now() - existing.sentAt) < DEDUP_WINDOW_MS) {
    console.log(`[SlackDispatcher] Dedup: skipping duplicate "${eventType}" to ${channel} (sent ${Math.round((Date.now() - existing.sentAt) / 1000)}s ago)`);
    return true;
  }
  
  // Evict oldest entries if cache is full
  if (dedupCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = dedupCache.keys().next().value;
    if (oldestKey) dedupCache.delete(oldestKey);
  }
  
  dedupCache.set(cacheKey, { hash, sentAt: Date.now(), channel });
  ensureDedupCleanup();
  return false;
}

// ============ Low-Level Send ============

async function sendToWebhook(
  channel: SlackChannel,
  payload: Record<string, unknown>
): Promise<boolean> {
  const webhookUrl = getWebhook(channel);
  
  if (!webhookUrl) {
    console.log(`[SlackDispatcher] ${channel} webhook not configured, skipping`);
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
      console.error(`[SlackDispatcher] Failed to send to ${channel}:`, response.status, errorText);
      return false;
    }
    
    console.log(`[SlackDispatcher] Message sent to ${channel}`);
    return true;
  } catch (error) {
    console.error(`[SlackDispatcher] Error sending to ${channel}:`, error);
    return false;
  }
}

// ============ Event Types ============

const SEVERITY_COLORS: Record<string, string> = {
  info: "#36a64f",
  warning: "#ff9800",
  critical: "#ff0000",
};

const SEVERITY_EMOJI: Record<string, string> = {
  info: "ℹ️",
  warning: "⚠️",
  critical: "🚨",
};

export interface SlackEvent {
  /** Unique event type for routing and dedup */
  type: string;
  /** Human-readable title */
  title: string;
  /** Description / body text */
  description: string;
  /** Severity affects color and emoji */
  severity: "info" | "warning" | "critical";
  /** Structured fields to display */
  fields?: Array<{ title: string; value: string; short?: boolean }>;
  /** Which channels to send to. If omitted, dispatcher routes based on event type. */
  channels?: SlackChannel[];
  /** Skip dedup check (for unique events like approval requests with action buttons) */
  skipDedup?: boolean;
  /** Custom blocks to use instead of auto-generated ones */
  customBlocks?: any[];
  /** Custom payload to merge (for action buttons, etc.) */
  customPayload?: Record<string, unknown>;
}

// ============ Block Builders ============

function buildStandardBlocks(event: SlackEvent): any[] {
  const { title, description, severity, fields = [] } = event;
  
  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${SEVERITY_EMOJI[severity] || ""} ${title}`,
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
      text: `<!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
    }],
  });
  
  return blocks;
}

function buildAuditBlocks(event: SlackEvent): any[] {
  const { title, description, fields = [], severity = "info" } = event;
  
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
  
  return blocks;
}

// ============ Main Dispatch Function ============

/**
 * Dispatch a Slack event to the appropriate channel(s) with deduplication.
 * 
 * This is the ONLY function that should send messages to Slack.
 * All other modules should call this instead of sendToChannel/sendToWebhook directly.
 */
export async function dispatch(event: SlackEvent): Promise<{ sent: boolean; channels: SlackChannel[] }> {
  const channels = event.channels || routeEvent(event.type);
  const sentTo: SlackChannel[] = [];
  
  for (const channel of channels) {
    // Dedup check
    if (!event.skipDedup && isDuplicate(channel, event.title, event.type)) {
      continue;
    }
    
    // Build payload
    const blocks = event.customBlocks || (channel === "audit-log" ? buildAuditBlocks(event) : buildStandardBlocks(event));
    
    const payload: Record<string, unknown> = {
      text: `${SEVERITY_EMOJI[event.severity] || ""} ${event.title}`,
      blocks,
      attachments: [{
        color: SEVERITY_COLORS[event.severity] || SEVERITY_COLORS.info,
        fallback: `${event.title}: ${event.description}`,
      }],
      ...event.customPayload,
    };
    
    const sent = await sendToWebhook(channel, payload);
    if (sent) sentTo.push(channel);
  }
  
  return { sent: sentTo.length > 0, channels: sentTo };
}

// ============ Event Routing ============

/**
 * Default channel routing based on event type.
 * Each event type maps to one or more channels.
 */
function routeEvent(eventType: string): SlackChannel[] {
  // Security alerts → #security-alerts
  if (eventType.startsWith("security_") || eventType.startsWith("abuse_")) {
    return ["security-alerts"];
  }
  
  // Critical security → both #security-alerts and #admin-actions
  if (eventType.startsWith("critical_security_")) {
    return ["security-alerts", "admin-actions"];
  }
  
  // Admin actions → #admin-actions
  if (eventType.startsWith("admin_") || eventType.startsWith("approval_")) {
    return ["admin-actions"];
  }
  
  // Audit/compliance → #audit-log
  if (eventType.startsWith("audit_") || eventType.startsWith("immutable_")) {
    return ["audit-log"];
  }
  
  // Change requests → #admin-actions
  if (eventType.startsWith("change_request_")) {
    return ["admin-actions"];
  }
  
  // Emergency → #admin-actions
  if (eventType.startsWith("emergency_")) {
    return ["admin-actions"];
  }
  
  // Billing events → #billing-alerts
  if (eventType.startsWith("billing_")) {
    return ["billing-alerts"];
  }
  
  // Default: admin-actions
  console.warn(`[SlackDispatcher] Unknown event type "${eventType}", routing to admin-actions`);
  return ["admin-actions"];
}

// ============ Convenience Helpers ============

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
  
  // Send info to #security-alerts
  const infoBlocks = buildStandardBlocks({ type: "security", title, description, severity, fields });
  
  if (severity === "critical") {
    // Add note about emergency actions
    infoBlocks.push({
      type: "context",
      elements: [{
        type: "mrkdwn",
        text: "🔔 _Emergency action buttons sent to #admin-actions channel_",
      }],
    });
  } else {
    // Add escalation button for non-critical
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
  
  // Send to #security-alerts (skip dedup for security alerts with action buttons)
  const secResult = await dispatch({
    type: `security_alert`,
    title,
    description,
    severity,
    fields,
    channels: ["security-alerts"],
    customBlocks: infoBlocks,
    skipDedup: severity === "critical", // Critical alerts always go through
  });
  
  // For critical: also send emergency actions to #admin-actions
  if (severity === "critical") {
    await dispatchEmergencyActions(title, description, fields, ipAddress, userId, userName, alertContext);
  }
  
  return secResult.sent;
}

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
    skipDedup: true, // Emergency actions always go through
  });
  
  return result.sent;
}

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
 * Sends ONE message to #admin-actions and ONE message to #audit-log.
 * Use this instead of calling dispatchAdminAction + dispatchAuditLog separately.
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

/**
 * Dispatch a billing alert. Routes to #billing-alerts.
 * Used for subscription cancellations, failed payments, large purchases,
 * chargebacks, and consumption spikes.
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
 * Used for critical billing events that need audit trail.
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

// ============ Signature Verification (unchanged) ============

export function verifySlackSignature(
  signature: string,
  timestamp: string,
  body: string
): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  
  if (!signingSecret) {
    console.warn("[SlackDispatcher] Signing secret not configured");
    return false;
  }
  
  const requestTimestamp = parseInt(timestamp, 10);
  const currentTimestamp = Math.floor(Date.now() / 1000);
  
  if (Math.abs(currentTimestamp - requestTimestamp) > 300) {
    console.warn("[SlackDispatcher] Request timestamp too old");
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

// ============ Testing Helpers ============

/**
 * Clear the dedup cache (for testing only)
 */
export function _clearDedupCache(): void {
  dedupCache.clear();
}

/**
 * Get the dedup cache size (for testing/monitoring)
 */
export function getDedupCacheSize(): number {
  return dedupCache.size;
}

/**
 * Send a raw payload to a channel (used by slackApproval for custom button layouts).
 * Still goes through dedup unless skipDedup is set.
 */
export async function sendRawToChannel(
  channel: SlackChannel,
  payload: Record<string, unknown>,
  options?: { skipDedup?: boolean; dedupKey?: string }
): Promise<boolean> {
  if (!options?.skipDedup) {
    const dedupKey = options?.dedupKey || JSON.stringify(payload).substring(0, 100);
    if (isDuplicate(channel, dedupKey, "raw_message")) {
      return false;
    }
  }
  return sendToWebhook(channel, payload);
}
