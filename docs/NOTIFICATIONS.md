# Security Notifications Guide

This document covers the security notification system in FormaStudio, including Slack alerts with interactive emergency actions.

## Overview

FormaStudio uses a multi-channel notification system for security alerts:

| Channel | Purpose | Response Time |
|---------|---------|---------------|
| **Slack** | Real-time alerts with action buttons | Immediate |
| **In-App** | Owner notifications via Manus platform | Near-immediate |
| **Audit Logs** | Persistent record of all events | Historical |

## Slack Integration

### Setup Requirements

1. **Create a Slack App** at [api.slack.com/apps](https://api.slack.com/apps)
2. **Enable Incoming Webhooks** and add to your security channel
3. **Enable Interactivity** with Request URL: `https://[your-domain]/api/slack/interactions`
4. **Configure Secrets:**
   - `SLACK_WEBHOOK_URL` - Incoming webhook URL
   - `SLACK_SIGNING_SECRET` - For verifying button interactions (optional but recommended)

### Alert Types

The system sends Slack alerts for:

**Abuse Detection Alerts:**

| Alert Type | Severity | Trigger |
|------------|----------|---------|
| Credits Exploit | Critical | 10+ insufficient credits errors in 5 minutes |
| Rapid Deletion | Warning | 5+ model deletions in 10 minutes |
| Billing Anomaly | Critical | 5+ billing events in 60 minutes |
| Credential Stuffing | Critical | 10+ failed logins from same IP in 5 minutes |
| Global Attack | Critical | 50+ failed logins system-wide in 5 minutes |
| IP Blocked | Info | Admin blocks an IP address |
| User Suspended | Warning | Admin suspends a user |

**Admin Activity Alerts:**

| Alert Type | Severity | Trigger |
|------------|----------|---------|
| Admin Action | Info | Any admin operation (listUsers, getAuditLogs, etc.) |
| Sensitive Admin Action | Warning | High-risk operations (suspend, credit adjustment, IP blocking) |
| Unauthorized Admin Access | Critical | Attempt to access admin features without proper authorization |

### Interactive Buttons

Critical alerts include emergency action buttons:

- **Block IP** - Immediately block the offending IP address
- **Suspend User** - Immediately suspend the user account

These buttons use secure, single-use tokens that expire after 24 hours.

## Implementation

### Sending Alerts

```typescript
import { SlackAlerts, sendSlackAlert } from "./server/slackNotification";

// Pre-built alert types
await SlackAlerts.creditsExploit(userId, userName, eventCount);
await SlackAlerts.rapidDeletion(userId, userName, deletionCount);
await SlackAlerts.billingAnomaly(userId, userName, alertTitle, description);
await SlackAlerts.credentialStuffing(ipAddress, attemptCount);
await SlackAlerts.globalAttackDetected(failedLoginCount, topIps);

// Custom alerts
await sendSlackAlert({
  title: "Custom Security Alert",
  description: "Description of the issue",
  severity: "critical", // or "warning", "info"
  fields: [
    { title: "Field 1", value: "Value 1", short: true },
    { title: "Field 2", value: "Value 2", short: true },
  ],
  userId: 123,
  userName: "user@example.com",
  ipAddress: "192.168.1.1",
});
```

### Emergency Tokens

Emergency tokens enable one-click actions from Slack:

```typescript
import { createEmergencyToken } from "./server/db";

// Create a token for blocking an IP
const token = await createEmergencyToken(
  "block_ip",           // action type
  "192.168.1.1",        // target (IP address)
  { alertTitle: "..." } // metadata
);

// Token is valid for 24 hours and can only be used once
```

### Handling Button Clicks

The `/api/slack/interactions` endpoint:

1. Verifies the Slack signature (if `SLACK_SIGNING_SECRET` is set)
2. Validates the emergency token
3. Executes the action (block IP or suspend user)
4. Sends confirmation back to Slack
5. Logs the action to audit system

## Security Considerations

### Token Security

- Tokens are UUID v4 (cryptographically random)
- Single-use: consumed immediately on first use
- Time-limited: 24-hour expiration
- Action-specific: token is bound to specific action and target

### Signature Verification

When `SLACK_SIGNING_SECRET` is configured:

```typescript
// Verification happens automatically in the handler
const isValid = verifySlackSignature(
  req.headers["x-slack-signature"],
  req.headers["x-slack-request-timestamp"],
  rawBody
);
```

### Audit Trail

All emergency actions are logged:

```typescript
await logAuditEvent({
  action: AUDIT_ACTIONS.EMERGENCY_ACTION_EXECUTED,
  resourceType: "ip", // or "user"
  resourceId: targetId,
  metadata: {
    action: "block_ip",
    executedBy: slackUser,
    source: "slack_button",
  },
  severity: "warning",
});
```

## Troubleshooting

### Alerts Not Sending

1. Verify `SLACK_WEBHOOK_URL` is set correctly
2. Check server logs for webhook errors
3. Ensure the webhook URL is for the correct channel

### Buttons Not Working

1. Verify `SLACK_SIGNING_SECRET` matches your Slack app
2. Check that the Request URL is accessible from Slack
3. Verify the endpoint returns 200 status quickly (within 3 seconds)

### Token Expired/Invalid

- Tokens expire after 24 hours
- Tokens can only be used once
- Use the admin dashboard for actions after token expiration

## Best Practices

1. **Monitor the security channel** - Set up Slack notifications for the channel
2. **Act quickly on critical alerts** - Use the emergency buttons for immediate response
3. **Review audit logs** - Investigate the full context before permanent actions
4. **Test regularly** - Verify the integration works before you need it

## Related Documentation

- [AUDIT_LOGGING.md](./AUDIT_LOGGING.md) - Audit logging system
- [RATE_LIMITING.md](./RATE_LIMITING.md) - Rate limiting and IP blocking
- [AUTHENTICATION.md](./AUTHENTICATION.md) - User suspension and lockout
