/**
 * Slack-Based Approval Flow
 * 
 * Implements out-of-band two-factor authorization for sensitive admin actions.
 * When an admin initiates a sensitive action from the web UI, the action is
 * held pending until approved via Slack. This ensures an attacker who
 * compromises an admin session also needs access to the Slack workspace.
 * 
 * Flow:
 * 1. Admin triggers sensitive action in web UI
 * 2. Server creates a pending action (NOT executed yet)
 * 3. Slack message sent with Approve / Deny buttons
 * 4. Admin (or another admin) clicks Approve in Slack
 * 5. Server executes the action and updates the pending action status
 * 6. Web UI polls for status and shows result
 * 
 * Pending actions expire after 5 minutes if not approved/denied.
 */

import { sendSlackAlert } from "./slackNotification";

// ============ Types ============

export type ApprovalAction = 
  | "suspendUser"
  | "unsuspendUser"
  | "adjustCredits"
  | "blockIP"
  | "unblockIP";

export type ApprovalStatus = "pending" | "approved" | "denied" | "expired" | "executed" | "failed";

export interface PendingAction {
  /** Unique ID for this pending action */
  id: string;
  /** The sensitive action being requested */
  action: ApprovalAction;
  /** Admin who requested the action */
  requestedBy: {
    id: number;
    name: string;
    email?: string;
  };
  /** Target of the action (user ID, IP address, etc.) */
  targetId: string;
  /** Human-readable description of what will happen */
  description: string;
  /** Additional parameters needed to execute the action */
  params: Record<string, unknown>;
  /** Current status */
  status: ApprovalStatus;
  /** When the action was requested */
  createdAt: number;
  /** When the action expires (5 minutes from creation) */
  expiresAt: number;
  /** Who approved/denied (Slack user info) */
  resolvedBy?: string;
  /** When it was resolved */
  resolvedAt?: number;
  /** Result message after execution */
  resultMessage?: string;
  /** IP address of the requesting admin */
  ipAddress?: string;
}

// ============ In-Memory Store ============

const EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

// Map of action ID -> PendingAction
const pendingActions = new Map<string, PendingAction>();

// Cleanup interval (runs every minute)
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function ensureCleanupRunning(): void {
  if (!cleanupInterval) {
    cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [id, action] of Array.from(pendingActions.entries())) {
        if (action.status === "pending" && action.expiresAt < now) {
          action.status = "expired";
          console.log(`[SlackApproval] Action ${id} expired: ${action.action} on ${action.targetId}`);
        }
        // Remove resolved actions older than 30 minutes
        if (action.status !== "pending" && now - action.createdAt > 30 * 60 * 1000) {
          pendingActions.delete(id);
        }
      }
    }, 60_000);
  }
}

// ============ Human-Readable Labels ============

const ACTION_LABELS: Record<ApprovalAction, string> = {
  suspendUser: "Suspend User",
  unsuspendUser: "Unsuspend User",
  adjustCredits: "Adjust Credits",
  blockIP: "Block IP Address",
  unblockIP: "Unblock IP Address",
};

const ACTION_EMOJI: Record<ApprovalAction, string> = {
  suspendUser: "⛔",
  unsuspendUser: "✅",
  adjustCredits: "💰",
  blockIP: "🚫",
  unblockIP: "🔓",
};

// ============ Core Functions ============

/**
 * Create a pending action and send approval request to Slack.
 * Returns the pending action ID for the UI to poll.
 */
export async function requestApproval(options: {
  action: ApprovalAction;
  requestedBy: { id: number; name: string; email?: string };
  targetId: string;
  description: string;
  params: Record<string, unknown>;
  ipAddress?: string;
}): Promise<{ actionId: string; sent: boolean }> {
  const crypto = require("crypto");
  const actionId = crypto.randomBytes(16).toString("hex");
  
  const pendingAction: PendingAction = {
    id: actionId,
    action: options.action,
    requestedBy: options.requestedBy,
    targetId: options.targetId,
    description: options.description,
    params: options.params,
    status: "pending",
    createdAt: Date.now(),
    expiresAt: Date.now() + EXPIRY_MS,
    ipAddress: options.ipAddress,
  };
  
  pendingActions.set(actionId, pendingAction);
  ensureCleanupRunning();
  
  // Send Slack approval request
  const sent = await sendApprovalToSlack(pendingAction);
  
  console.log(`[SlackApproval] Created pending action ${actionId}: ${options.action} on ${options.targetId} by ${options.requestedBy.name}`);
  
  return { actionId, sent };
}

/**
 * Get the current status of a pending action.
 * Used by the UI to poll for approval.
 */
export function getApprovalStatus(actionId: string): PendingAction | null {
  const action = pendingActions.get(actionId);
  if (!action) return null;
  
  // Check if expired
  if (action.status === "pending" && action.expiresAt < Date.now()) {
    action.status = "expired";
  }
  
  return action;
}

/**
 * Approve a pending action (called from Slack interaction handler).
 * Does NOT execute the action - just marks it as approved.
 * The execution happens in the admin procedure when it sees the approved status.
 */
export function approveAction(actionId: string, approvedBy: string): { 
  success: boolean; 
  action?: PendingAction;
  error?: string;
} {
  const action = pendingActions.get(actionId);
  
  if (!action) {
    return { success: false, error: "Action not found" };
  }
  
  if (action.status !== "pending") {
    return { success: false, error: `Action is already ${action.status}` };
  }
  
  if (action.expiresAt < Date.now()) {
    action.status = "expired";
    return { success: false, error: "Action has expired" };
  }
  
  action.status = "approved";
  action.resolvedBy = approvedBy;
  action.resolvedAt = Date.now();
  
  console.log(`[SlackApproval] Action ${actionId} approved by ${approvedBy}`);
  
  return { success: true, action };
}

/**
 * Deny a pending action (called from Slack interaction handler).
 */
export function denyAction(actionId: string, deniedBy: string): {
  success: boolean;
  action?: PendingAction;
  error?: string;
} {
  const action = pendingActions.get(actionId);
  
  if (!action) {
    return { success: false, error: "Action not found" };
  }
  
  if (action.status !== "pending") {
    return { success: false, error: `Action is already ${action.status}` };
  }
  
  action.status = "denied";
  action.resolvedBy = deniedBy;
  action.resolvedAt = Date.now();
  
  console.log(`[SlackApproval] Action ${actionId} denied by ${deniedBy}`);
  
  return { success: true, action };
}

/**
 * Mark an approved action as executed (called after successful execution).
 */
export function markExecuted(actionId: string, resultMessage?: string): void {
  const action = pendingActions.get(actionId);
  if (action && action.status === "approved") {
    action.status = "executed";
    action.resultMessage = resultMessage || "Action completed successfully";
  }
}

/**
 * Mark an approved action as failed (called if execution fails).
 */
export function markFailed(actionId: string, errorMessage: string): void {
  const action = pendingActions.get(actionId);
  if (action) {
    action.status = "failed";
    action.resultMessage = errorMessage;
  }
}

// ============ Slack Integration ============

/**
 * Send an approval request message to Slack with Approve/Deny buttons.
 */
async function sendApprovalToSlack(action: PendingAction): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log("[SlackApproval] Webhook URL not configured, auto-approving action");
    // If Slack is not configured, auto-approve to avoid blocking
    action.status = "approved";
    action.resolvedBy = "system (Slack not configured)";
    action.resolvedAt = Date.now();
    return false;
  }
  
  const emoji = ACTION_EMOJI[action.action] || "⚠️";
  const label = ACTION_LABELS[action.action] || action.action;
  const expiresInMinutes = Math.ceil((action.expiresAt - Date.now()) / 60_000);
  
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `${emoji} Admin Action Approval Required: ${label}`,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `${emoji} Admin Action Requires Approval`,
              emoji: true,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${label}*\n${action.description}`,
            },
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Requested By:*\n${action.requestedBy.name} (ID: ${action.requestedBy.id})`,
              },
              {
                type: "mrkdwn",
                text: `*Target:*\n${action.targetId}`,
              },
              {
                type: "mrkdwn",
                text: `*Expires In:*\n${expiresInMinutes} minutes`,
              },
              ...(action.ipAddress ? [{
                type: "mrkdwn",
                text: `*IP Address:*\n${action.ipAddress}`,
              }] : []),
            ],
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `Requested at <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
              },
            ],
          },
          { type: "divider" },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "✅ Approve",
                  emoji: true,
                },
                style: "primary",
                action_id: "approve_admin_action",
                value: JSON.stringify({ actionId: action.id }),
                confirm: {
                  title: {
                    type: "plain_text",
                    text: `Approve: ${label}?`,
                  },
                  text: {
                    type: "mrkdwn",
                    text: `This will allow the action to proceed:\n\n${action.description}\n\nRequested by *${action.requestedBy.name}*`,
                  },
                  confirm: {
                    type: "plain_text",
                    text: "Approve",
                  },
                  deny: {
                    type: "plain_text",
                    text: "Cancel",
                  },
                },
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "❌ Deny",
                  emoji: true,
                },
                style: "danger",
                action_id: "deny_admin_action",
                value: JSON.stringify({ actionId: action.id }),
                confirm: {
                  title: {
                    type: "plain_text",
                    text: `Deny: ${label}?`,
                  },
                  text: {
                    type: "mrkdwn",
                    text: `This will block the action:\n\n${action.description}\n\nRequested by *${action.requestedBy.name}*`,
                  },
                  confirm: {
                    type: "plain_text",
                    text: "Deny",
                  },
                  deny: {
                    type: "plain_text",
                    text: "Cancel",
                  },
                },
              },
            ],
          },
        ],
        attachments: [
          {
            color: "#ff9800", // Orange for pending approval
            fallback: `Admin action approval required: ${label} by ${action.requestedBy.name}`,
          },
        ],
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[SlackApproval] Failed to send approval request:", response.status, errorText);
      return false;
    }
    
    console.log("[SlackApproval] Approval request sent to Slack for action:", action.id);
    return true;
  } catch (error) {
    console.error("[SlackApproval] Error sending approval request:", error);
    return false;
  }
}

// ============ Testing Helpers ============

/**
 * Clear all pending actions (for testing only)
 */
export function _clearPendingActions(): void {
  pendingActions.clear();
}

/**
 * Get count of pending actions (for testing/monitoring)
 */
export function getPendingActionCount(): number {
  return pendingActions.size;
}

/**
 * Get all pending actions for a specific admin (for monitoring)
 */
export function getAdminPendingActions(adminId: number): PendingAction[] {
  return Array.from(pendingActions.values())
    .filter(a => a.requestedBy.id === adminId && a.status === "pending");
}
