/**
 * Slack Interactions Handler
 * 
 * Handles button clicks from Slack interactive messages across all three channels:
 * 
 * From #security-alerts:
 *   - escalate_to_admin → Sends emergency action buttons to #admin-actions
 * 
 * From #admin-actions:
 *   - block_ip → Emergency IP blocking via token
 *   - suspend_user → Emergency user suspension via token
 *   - approve_admin_action → Approve a pending sensitive action
 *   - deny_admin_action → Deny a pending sensitive action
 * 
 * All completed actions are logged to #audit-log.
 */

import { Request, Response } from "express";
import {
  verifySlackSignature,
  SlackAlerts,
  sendEmergencyActionsToAdminChannel,
  sendAuditLogEntry,
} from "./slackNotification";
import { consumeEmergencyToken, blockIp, getUserById } from "./db";
import { logAuditEvent, AUDIT_ACTIONS } from "./auditLog";
import { approveAction, denyAction } from "./slackApproval";

interface SlackInteractionPayload {
  type: string;
  user: {
    id: string;
    username: string;
    name: string;
  };
  actions: Array<{
    action_id: string;
    value: string;
  }>;
  response_url: string;
}

/**
 * Handle incoming Slack interaction (button click)
 */
export async function handleSlackInteraction(req: Request, res: Response): Promise<void> {
  try {
    // Parse the payload from Slack
    const payloadString = req.body?.payload;

    if (!payloadString) {
      console.error("[SlackInteraction] Missing payload");
      res.status(400).json({ error: "Missing payload" });
      return;
    }

    // STRICT: Always require signature verification for security
    const signingSecret = process.env.SLACK_SIGNING_SECRET;

    if (!signingSecret) {
      console.error("[SlackInteraction] SLACK_SIGNING_SECRET not configured - rejecting request");
      res.status(500).json({ error: "Slack integration not properly configured" });
      return;
    }

    const signature = req.headers["x-slack-signature"] as string;
    const timestamp = req.headers["x-slack-request-timestamp"] as string;

    if (!signature || !timestamp) {
      console.error("[SlackInteraction] Missing signature or timestamp headers");
      res.status(401).json({ error: "Missing authentication headers" });
      return;
    }

    // Reconstruct the raw body for verification
    const rawBody = `payload=${encodeURIComponent(payloadString)}`;

    if (!verifySlackSignature(signature, timestamp, rawBody)) {
      console.error("[SlackInteraction] Invalid signature");
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    const payload: SlackInteractionPayload = JSON.parse(payloadString);

    // Respond immediately to avoid Slack timeout
    res.status(200).json({ text: "Processing..." });

    // Process the action
    const action = payload.actions?.[0];
    if (!action) {
      await sendSlackResponse(payload.response_url, {
        text: "❌ No action found in request",
        replace_original: false,
      });
      return;
    }

    const actionData = JSON.parse(action.value);
    const slackUser = `${payload.user.name} (${payload.user.username})`;

    switch (action.action_id) {
      // Emergency actions (from #admin-actions)
      case "block_ip":
        await handleBlockIpAction(actionData, slackUser, payload.response_url);
        break;
      case "suspend_user":
        await handleSuspendUserAction(actionData, slackUser, payload.response_url);
        break;

      // Approval flow (from #admin-actions)
      case "approve_admin_action":
        await handleApproveAction(actionData, slackUser, payload.response_url);
        break;
      case "deny_admin_action":
        await handleDenyAction(actionData, slackUser, payload.response_url);
        break;

      // Escalation (from #security-alerts)
      case "escalate_to_admin":
        await handleEscalation(actionData, slackUser, payload.response_url);
        break;

      default:
        await sendSlackResponse(payload.response_url, {
          text: `❌ Unknown action: ${action.action_id}`,
          replace_original: false,
        });
    }
  } catch (error) {
    console.error("[SlackInteraction] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ============ Escalation Handler ============

/**
 * Handle "Escalate to Admin" button click from #security-alerts.
 * Sends emergency action buttons to #admin-actions channel.
 */
async function handleEscalation(
  escalationData: {
    title: string;
    description: string;
    severity: string;
    fields: Array<{ title: string; value: string; short?: boolean }>;
    ipAddress?: string;
    userId?: number;
    userName?: string;
    alertContext?: Record<string, unknown>;
  },
  slackUser: string,
  responseUrl: string
): Promise<void> {
  const { title, description, fields, ipAddress, userId, userName, alertContext } = escalationData;

  // Send emergency actions to #admin-actions
  const sent = await sendEmergencyActionsToAdminChannel(
    `[Escalated] ${title}`,
    `${description}\n\n_Escalated by ${slackUser}_`,
    fields || [],
    ipAddress,
    userId,
    userName,
    alertContext
  );

  if (sent) {
    // Confirm escalation in #security-alerts
    await sendSlackResponse(responseUrl, {
      text: `✅ *Escalated to Admin*\n\nAlert "${title}" has been escalated to #admin-actions with emergency action buttons.\n\n_Escalated by ${slackUser}_`,
      replace_original: false,
    });

    // Log escalation to #audit-log
    await sendAuditLogEntry({
      title: "Alert Escalated to Admin",
      description: `${slackUser} escalated alert: ${title}`,
      fields: [
        { title: "Original Alert", value: title, short: true },
        { title: "Escalated By", value: slackUser, short: true },
        ...(ipAddress ? [{ title: "IP Address", value: ipAddress, short: true }] : []),
        ...(userId ? [{ title: "User ID", value: String(userId), short: true }] : []),
      ],
    });
  } else {
    await sendSlackResponse(responseUrl, {
      text: `❌ *Escalation Failed*\n\nCould not send to #admin-actions. The admin-actions webhook may not be configured.`,
      replace_original: false,
    });
  }

  // Log the escalation
  await logAuditEvent({
    userId: null,
    action: AUDIT_ACTIONS.ADMIN_ACTION,
    resourceType: "escalation",
    resourceId: title,
    metadata: {
      escalatedBy: slackUser,
      originalAlert: title,
      ipAddress,
      userId,
      source: "slack_escalation",
    },
    severity: "info",
  });
}

// ============ Emergency Action Handlers ============

/**
 * Handle IP blocking action from Slack button in #admin-actions
 */
async function handleBlockIpAction(
  actionData: { token: string; ip: string },
  slackUser: string,
  responseUrl: string
): Promise<void> {
  const { token, ip } = actionData;

  // Consume the emergency token
  const tokenData = await consumeEmergencyToken(token, slackUser);

  if (!tokenData) {
    await sendSlackResponse(responseUrl, {
      text: `❌ *Action Failed*\nThe emergency token has expired or already been used. Please use the admin dashboard to block this IP.`,
      replace_original: false,
    });
    return;
  }

  // Verify the token is for the correct action and target
  if (tokenData.action !== "block_ip" || tokenData.targetId !== ip) {
    await sendSlackResponse(responseUrl, {
      text: `❌ *Action Failed*\nToken mismatch. Please use the admin dashboard.`,
      replace_original: false,
    });
    return;
  }

  // Block the IP
  const reason = `Emergency block via Slack by ${slackUser}. Original alert: ${(tokenData.metadata as any)?.alertTitle || "Security Alert"}`;
  const result = await blockIp(ip, reason, 0, null);

  if (!result.success) {
    await sendSlackResponse(responseUrl, {
      text: `❌ *Action Failed*\nFailed to block IP ${ip}. Please try again from the admin dashboard.`,
      replace_original: false,
    });
    return;
  }

  // Log the action
  await logAuditEvent({
    userId: null,
    action: AUDIT_ACTIONS.EMERGENCY_ACTION_EXECUTED,
    resourceType: "ip",
    resourceId: ip,
    metadata: {
      action: "block_ip",
      executedBy: slackUser,
      source: "slack_button",
      channel: "admin-actions",
      originalAlert: tokenData.metadata,
    },
    severity: "warning",
  });

  // Send confirmation in #admin-actions
  await sendSlackResponse(responseUrl, {
    text: `✅ *IP Blocked Successfully*\n\n*IP Address:* ${ip}\n*Blocked By:* ${slackUser}\n*Reason:* ${reason}\n\nThe IP has been permanently blocked.`,
    replace_original: false,
  });

  // Send confirmations to #admin-actions and #audit-log
  await SlackAlerts.ipBlocked(ip, reason, slackUser);
}

/**
 * Handle user suspension action from Slack button in #admin-actions
 */
async function handleSuspendUserAction(
  actionData: { token: string; userId: number; userName?: string },
  slackUser: string,
  responseUrl: string
): Promise<void> {
  const { token, userId, userName } = actionData;

  // Consume the emergency token
  const tokenData = await consumeEmergencyToken(token, slackUser);

  if (!tokenData) {
    await sendSlackResponse(responseUrl, {
      text: `❌ *Action Failed*\nThe emergency token has expired or already been used. Please use the admin dashboard to suspend this user.`,
      replace_original: false,
    });
    return;
  }

  if (tokenData.action !== "suspend_user" || tokenData.targetId !== String(userId)) {
    await sendSlackResponse(responseUrl, {
      text: `❌ *Action Failed*\nToken mismatch. Please use the admin dashboard.`,
      replace_original: false,
    });
    return;
  }

  // Suspend the user
  const { suspendUser } = await import("./db");
  const reason = `Emergency suspension via Slack by ${slackUser}. Original alert: ${(tokenData.metadata as any)?.alertTitle || "Security Alert"}`;
  const success = await suspendUser(userId, reason, 0);

  if (!success) {
    await sendSlackResponse(responseUrl, {
      text: `❌ *Action Failed*\nFailed to suspend user ${userName || userId}. Please try again from the admin dashboard.`,
      replace_original: false,
    });
    return;
  }

  // Log the action
  await logAuditEvent({
    userId: null,
    action: AUDIT_ACTIONS.EMERGENCY_ACTION_EXECUTED,
    resourceType: "user",
    resourceId: String(userId),
    metadata: {
      action: "suspend_user",
      executedBy: slackUser,
      source: "slack_button",
      channel: "admin-actions",
      userName,
      originalAlert: tokenData.metadata,
    },
    severity: "warning",
  });

  // Send confirmation in #admin-actions
  await sendSlackResponse(responseUrl, {
    text: `✅ *User Suspended Successfully*\n\n*User:* ${userName || `ID: ${userId}`}\n*Suspended By:* ${slackUser}\n*Reason:* ${reason}\n\nThe user has been suspended and will be logged out immediately.`,
    replace_original: false,
  });

  // Send confirmations to #admin-actions and #audit-log
  await SlackAlerts.userSuspended(userId, userName || `User ${userId}`, reason, slackUser);
}

// ============ Approval Handlers ============

/**
 * Handle approval of a pending admin action from Slack button in #admin-actions
 */
async function handleApproveAction(
  actionData: { actionId: string },
  slackUser: string,
  responseUrl: string
): Promise<void> {
  const { actionId } = actionData;

  const result = approveAction(actionId, slackUser);

  if (!result.success) {
    await sendSlackResponse(responseUrl, {
      text: `❌ *Approval Failed*\n${result.error}`,
      replace_original: false,
    });
    return;
  }

  const action = result.action!;

  // Log the approval
  await logAuditEvent({
    userId: null,
    action: AUDIT_ACTIONS.ADMIN_ACTION,
    resourceType: "approval",
    resourceId: actionId,
    metadata: {
      approvedAction: action.action,
      targetId: action.targetId,
      requestedBy: action.requestedBy.name,
      approvedBy: slackUser,
      source: "slack_approval",
    },
    severity: "warning",
  });

  // Confirm in #admin-actions
  await sendSlackResponse(responseUrl, {
    text: `✅ *Action Approved*\n\n*Action:* ${action.action}\n*Target:* ${action.targetId}\n*Requested By:* ${action.requestedBy.name}\n*Approved By:* ${slackUser}\n\nThe action will now be executed.`,
    replace_original: false,
  });

  // Log to #audit-log
  await sendAuditLogEntry({
    title: "Admin Action Approved",
    description: `${slackUser} approved: ${action.action} on ${action.targetId}`,
    fields: [
      { title: "Action", value: action.action, short: true },
      { title: "Target", value: action.targetId, short: true },
      { title: "Requested By", value: action.requestedBy.name, short: true },
      { title: "Approved By", value: slackUser, short: true },
    ],
  });
}

/**
 * Handle denial of a pending admin action from Slack button in #admin-actions
 */
async function handleDenyAction(
  actionData: { actionId: string },
  slackUser: string,
  responseUrl: string
): Promise<void> {
  const { actionId } = actionData;

  const result = denyAction(actionId, slackUser);

  if (!result.success) {
    await sendSlackResponse(responseUrl, {
      text: `❌ *Denial Failed*\n${result.error}`,
      replace_original: false,
    });
    return;
  }

  const action = result.action!;

  // Log the denial
  await logAuditEvent({
    userId: null,
    action: AUDIT_ACTIONS.ADMIN_ACTION,
    resourceType: "approval",
    resourceId: actionId,
    metadata: {
      deniedAction: action.action,
      targetId: action.targetId,
      requestedBy: action.requestedBy.name,
      deniedBy: slackUser,
      source: "slack_denial",
    },
    severity: "warning",
  });

  // Confirm in #admin-actions
  await sendSlackResponse(responseUrl, {
    text: `❌ *Action Denied*\n\n*Action:* ${action.action}\n*Target:* ${action.targetId}\n*Requested By:* ${action.requestedBy.name}\n*Denied By:* ${slackUser}\n\nThe action has been blocked and will not be executed.`,
    replace_original: false,
  });

  // Log to #audit-log
  await sendAuditLogEntry({
    title: "Admin Action Denied",
    description: `${slackUser} denied: ${action.action} on ${action.targetId}`,
    fields: [
      { title: "Action", value: action.action, short: true },
      { title: "Target", value: action.targetId, short: true },
      { title: "Requested By", value: action.requestedBy.name, short: true },
      { title: "Denied By", value: slackUser, short: true },
    ],
    severity: "warning",
  });
}

// ============ Utility ============

/**
 * Send a response back to Slack via response_url
 */
async function sendSlackResponse(
  responseUrl: string,
  message: {
    text: string;
    replace_original?: boolean;
    response_type?: "in_channel" | "ephemeral";
  }
): Promise<void> {
  try {
    await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...message,
        response_type: message.response_type || "ephemeral",
      }),
    });
  } catch (error) {
    console.error("[SlackInteraction] Failed to send response:", error);
  }
}
