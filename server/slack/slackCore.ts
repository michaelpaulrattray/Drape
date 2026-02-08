/**
 * Slack Core - Channel config, dedup cache, low-level send,
 * block builders, main dispatch function, event routing,
 * signature verification, and testing helpers.
 */

// ============ Channel Config ============

export type SlackChannel = "security-alerts" | "admin-actions" | "audit-log" | "billing-alerts" | "system-alerts";

const getWebhook = (channel: SlackChannel): string | undefined => {
  switch (channel) {
    case "security-alerts": return process.env.SLACK_WEBHOOK_URL;
    case "admin-actions": return process.env.SLACK_ADMIN_ACTIONS_WEBHOOK_URL;
    case "audit-log": return process.env.SLACK_AUDIT_LOG_WEBHOOK_URL;
    case "billing-alerts": return process.env.SLACK_BILLING_ALERTS_WEBHOOK_URL;
    case "system-alerts": return process.env.SLACK_SYSTEM_ALERTS_WEBHOOK_URL;
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
  const key = `${channel}:${eventType}:${title.trim().toLowerCase()}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return String(hash);
}

export function isDuplicate(channel: SlackChannel, title: string, eventType: string): boolean {
  const hash = computeHash(channel, title, eventType);
  const cacheKey = `${channel}:${hash}`;
  const existing = dedupCache.get(cacheKey);
  
  if (existing && (Date.now() - existing.sentAt) < DEDUP_WINDOW_MS) {
    console.log(`[SlackDispatcher] Dedup: skipping duplicate "${eventType}" to ${channel} (sent ${Math.round((Date.now() - existing.sentAt) / 1000)}s ago)`);
    return true;
  }
  
  if (dedupCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = dedupCache.keys().next().value;
    if (oldestKey) dedupCache.delete(oldestKey);
  }
  
  dedupCache.set(cacheKey, { hash, sentAt: Date.now(), channel });
  ensureDedupCleanup();
  return false;
}

// ============ Low-Level Send ============

export async function sendToWebhook(
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

export { SEVERITY_EMOJI };

export interface SlackEvent {
  type: string;
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  fields?: Array<{ title: string; value: string; short?: boolean }>;
  channels?: SlackChannel[];
  skipDedup?: boolean;
  customBlocks?: any[];
  customPayload?: Record<string, unknown>;
}

// ============ Block Builders ============

export function buildStandardBlocks(event: SlackEvent): any[] {
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
  const { title, description, fields = [] } = event;
  
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
 * This is the ONLY function that should send messages to Slack.
 */
export async function dispatch(event: SlackEvent): Promise<{ sent: boolean; channels: SlackChannel[] }> {
  const channels = event.channels || routeEvent(event.type);
  const sentTo: SlackChannel[] = [];
  
  for (const channel of channels) {
    if (!event.skipDedup && isDuplicate(channel, event.title, event.type)) {
      continue;
    }
    
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

function routeEvent(eventType: string): SlackChannel[] {
  if (eventType.startsWith("critical_security_")) {
    return ["security-alerts", "admin-actions"];
  }
  if (eventType.startsWith("security_") || eventType.startsWith("abuse_")) {
    return ["security-alerts"];
  }
  if (eventType.startsWith("admin_") || eventType.startsWith("approval_")) {
    return ["admin-actions"];
  }
  if (eventType.startsWith("audit_") || eventType.startsWith("immutable_")) {
    return ["audit-log"];
  }
  if (eventType.startsWith("change_request_")) {
    return ["admin-actions"];
  }
  if (eventType.startsWith("emergency_")) {
    return ["admin-actions"];
  }
  if (eventType.startsWith("billing_")) {
    return ["billing-alerts"];
  }
  if (eventType.startsWith("system_health_")) {
    return ["system-alerts"];
  }
  console.warn(`[SlackDispatcher] Unknown event type "${eventType}", routing to admin-actions`);
  return ["admin-actions"];
}

// ============ Signature Verification ============

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

export function _clearDedupCache(): void {
  dedupCache.clear();
}

export function getDedupCacheSize(): number {
  return dedupCache.size;
}

/**
 * Send a raw payload to a channel (used by slackApproval for custom button layouts).
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
