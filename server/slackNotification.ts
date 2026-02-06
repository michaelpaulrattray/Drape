/**
 * Slack Notification Service
 * 
 * Sends security alerts to Slack with interactive buttons for emergency actions.
 * Buttons allow admins to block IPs or suspend users directly from Slack.
 * 
 * SETUP:
 * 1. Create a Slack App at https://api.slack.com/apps
 * 2. Enable Incoming Webhooks and add to your channel
 * 3. Enable Interactivity with Request URL: https://[your-domain]/api/slack/interactions
 * 4. Set SLACK_WEBHOOK_URL secret
 * 5. Set SLACK_SIGNING_SECRET secret (for verifying button callbacks)
 */

import { createEmergencyToken } from "./db";
import { ENV } from "./_core/env";

// Slack webhook URL from environment
const getSlackWebhookUrl = () => process.env.SLACK_WEBHOOK_URL;
const getSlackSigningSecret = () => process.env.SLACK_SIGNING_SECRET;

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

/**
 * Send a security alert to Slack with optional emergency action buttons
 */
export async function sendSlackAlert(options: SlackAlertOptions): Promise<boolean> {
  const webhookUrl = getSlackWebhookUrl();
  
  if (!webhookUrl) {
    console.log("[Slack] Webhook URL not configured, skipping notification");
    return false;
  }

  try {
    const { title, description, severity, fields = [], ipAddress, userId, userName, alertContext } = options;
    
    // Build the message blocks
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

    // Add fields if provided
    if (fields.length > 0) {
      blocks.push({
        type: "section",
        fields: fields.map(f => ({
          type: "mrkdwn",
          text: `*${f.title}*\n${f.value}`,
        })),
      });
    }

    // Add timestamp
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Detected at <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
        },
      ],
    });

    // Create emergency action buttons if IP or user provided
    const actionButtons: any[] = [];

    if (ipAddress) {
      // Create emergency token for IP blocking
      const tokenResult = await createEmergencyToken("block_ip", ipAddress, {
        ...alertContext,
        alertTitle: title,
      });

      if (tokenResult) {
        const baseUrl = process.env.VITE_APP_URL || ENV.oAuthServerUrl?.replace('/api', '') || '';
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
            title: {
              type: "plain_text",
              text: "Block IP Address?",
            },
            text: {
              type: "mrkdwn",
              text: `This will immediately block IP *${ipAddress}* from accessing the system. This action is logged.`,
            },
            confirm: {
              type: "plain_text",
              text: "Block IP",
            },
            deny: {
              type: "plain_text",
              text: "Cancel",
            },
          },
        });
      }
    }

    if (userId) {
      // Create emergency token for user suspension
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
            title: {
              type: "plain_text",
              text: "Suspend User Account?",
            },
            text: {
              type: "mrkdwn",
              text: `This will immediately suspend ${userName ? `*${userName}*` : `user ID *${userId}*`}'s account. They will be logged out and unable to access the system. This action is logged.`,
            },
            confirm: {
              type: "plain_text",
              text: "Suspend User",
            },
            deny: {
              type: "plain_text",
              text: "Cancel",
            },
          },
        });
      }
    }

    // Add action buttons if any
    if (actionButtons.length > 0) {
      blocks.push({
        type: "divider",
      });
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

    // Send to Slack
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: `${SEVERITY_EMOJI[severity]} ${title}`, // Fallback for notifications
        blocks,
        attachments: [
          {
            color: SEVERITY_COLORS[severity],
            fallback: `${title}: ${description}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Slack] Failed to send alert:", response.status, errorText);
      return false;
    }

    console.log("[Slack] Alert sent successfully:", title);
    return true;
  } catch (error) {
    console.error("[Slack] Error sending alert:", error);
    return false;
  }
}

/**
 * Verify Slack request signature
 * Used to validate incoming requests from Slack interactive components
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

  // Check timestamp is within 5 minutes
  const requestTimestamp = parseInt(timestamp, 10);
  const currentTimestamp = Math.floor(Date.now() / 1000);
  
  if (Math.abs(currentTimestamp - requestTimestamp) > 300) {
    console.warn("[Slack] Request timestamp too old");
    return false;
  }

  // Compute expected signature
  const crypto = require("crypto");
  const sigBasestring = `v0:${timestamp}:${body}`;
  const expectedSignature = "v0=" + crypto
    .createHmac("sha256", signingSecret)
    .update(sigBasestring)
    .digest("hex");

  // Constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

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

/**
 * Pre-built alert templates for common security events
 */
export const SlackAlerts = {
  /**
   * Alert for credential stuffing attack detection
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
   * Alert when IP is blocked (confirmation)
   */
  ipBlocked: async (
    ipAddress: string,
    reason: string,
    blockedBy: string
  ): Promise<boolean> => {
    return sendSlackAlert({
      title: "IP Address Blocked",
      description: `IP address *${ipAddress}* has been blocked.`,
      severity: "info",
      fields: [
        { title: "IP Address", value: ipAddress, short: true },
        { title: "Blocked By", value: blockedBy, short: true },
        { title: "Reason", value: reason, short: false },
      ],
    });
  },

  /**
   * Alert when user is suspended (confirmation)
   */
  userSuspended: async (
    userId: number,
    userName: string,
    reason: string,
    suspendedBy: string
  ): Promise<boolean> => {
    return sendSlackAlert({
      title: "User Account Suspended",
      description: `User *${userName}* (ID: ${userId}) has been suspended.`,
      severity: "info",
      fields: [
        { title: "User", value: userName, short: true },
        { title: "Suspended By", value: suspendedBy, short: true },
        { title: "Reason", value: reason, short: false },
      ],
    });
  },
};
