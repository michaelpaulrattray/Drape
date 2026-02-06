/**
 * Slack Interactions Handler
 * 
 * Handles button clicks from Slack interactive messages.
 * Executes emergency actions (block IP, suspend user) using secure tokens.
 */

import { Request, Response } from "express";
import { verifySlackSignature, SlackAlerts } from "./slackNotification";
import { consumeEmergencyToken, blockIp, getUserById } from "./db";
import { logAuditEvent, AUDIT_ACTIONS } from "./auditLog";

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

    if (action.action_id === "block_ip") {
      await handleBlockIpAction(actionData, slackUser, payload.response_url);
    } else if (action.action_id === "suspend_user") {
      await handleSuspendUserAction(actionData, slackUser, payload.response_url);
    } else {
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

/**
 * Handle IP blocking action from Slack button
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
  
  // Use system user ID (0) for emergency actions
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
    userId: null, // System action
    action: AUDIT_ACTIONS.EMERGENCY_ACTION_EXECUTED,
    resourceType: "ip",
    resourceId: ip,
    metadata: {
      action: "block_ip",
      executedBy: slackUser,
      source: "slack_button",
      originalAlert: tokenData.metadata,
    },
    severity: "warning",
  });

  // Send confirmation to Slack
  await sendSlackResponse(responseUrl, {
    text: `✅ *IP Blocked Successfully*\n\n*IP Address:* ${ip}\n*Blocked By:* ${slackUser}\n*Reason:* ${reason}\n\nThe IP has been permanently blocked. You can manage blocked IPs in the admin dashboard.`,
    replace_original: false,
  });

  // Also send a confirmation alert
  await SlackAlerts.ipBlocked(ip, reason, slackUser);
}

/**
 * Handle user suspension action from Slack button
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

  // Verify the token is for the correct action and target
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
  
  const success = await suspendUser(userId, reason, 0); // System user ID

  if (!success) {
    await sendSlackResponse(responseUrl, {
      text: `❌ *Action Failed*\nFailed to suspend user ${userName || userId}. Please try again from the admin dashboard.`,
      replace_original: false,
    });
    return;
  }

  // Log the action
  await logAuditEvent({
    userId: null, // System action
    action: AUDIT_ACTIONS.EMERGENCY_ACTION_EXECUTED,
    resourceType: "user",
    resourceId: String(userId),
    metadata: {
      action: "suspend_user",
      executedBy: slackUser,
      source: "slack_button",
      userName,
      originalAlert: tokenData.metadata,
    },
    severity: "warning",
  });

  // Send confirmation to Slack
  await sendSlackResponse(responseUrl, {
    text: `✅ *User Suspended Successfully*\n\n*User:* ${userName || `ID: ${userId}`}\n*Suspended By:* ${slackUser}\n*Reason:* ${reason}\n\nThe user has been suspended and will be logged out immediately. You can manage suspended users in the admin dashboard.`,
    replace_original: false,
  });

  // Also send a confirmation alert
  await SlackAlerts.userSuspended(userId, userName || `User ${userId}`, reason, slackUser);
}

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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...message,
        response_type: message.response_type || "ephemeral",
      }),
    });
  } catch (error) {
    console.error("[SlackInteraction] Failed to send response:", error);
  }
}
