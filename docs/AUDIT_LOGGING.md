# Audit Logging

This guide explains the audit logging system in FormaStudio, which tracks security-sensitive operations, detects abuse patterns, and sends notifications when suspicious activity is detected.

## Overview

The audit logging system provides a centralized record of security-relevant events. Every sensitive operation—billing changes, model deletions, and security events—is logged to the `audit_logs` database table with contextual information including user ID, IP address, user agent, and operation-specific metadata.

Beyond simple logging, the system includes automatic abuse detection that monitors for suspicious patterns and notifies the application owner when critical thresholds are exceeded.

## When to Use Audit Logging

Audit logging should be added to any operation that meets one or more of these criteria:

| Category | Examples | Severity |
|----------|----------|----------|
| Financial operations | Subscription changes, credit purchases, refunds | Critical |
| Data deletion | Model deletion, account deletion | Warning |
| Security events | Failed authentication, rate limit violations | Warning/Critical |
| Administrative actions | Role changes, user suspension | Critical |
| Sensitive data access | Exporting user data, accessing billing info | Info |

## Basic Usage

Import the audit logging helper and action constants:

```typescript
import { logAuditEvent, AUDIT_ACTIONS } from "./auditLog";
```

Log an event after a sensitive operation completes:

```typescript
deleteModel: protectedProcedure
  .input(z.object({ modelId: z.number() }))
  .mutation(async ({ ctx, input }) => {
    const model = await getModelById(input.modelId);
    // ... validation ...
    
    await deleteModel(input.modelId);
    
    // Log the deletion
    await logAuditEvent({
      userId: ctx.user.id,
      action: AUDIT_ACTIONS.MODEL_DELETED,
      resourceType: "model",
      resourceId: input.modelId.toString(),
      metadata: {
        modelName: model.name,
        agencyId: model.agencyId,
      },
      req: ctx.req,
    });
    
    return { success: true };
  }),
```

## Available Actions

The `AUDIT_ACTIONS` constant defines all supported action types:

### Billing Events

| Action | Description |
|--------|-------------|
| `SUBSCRIPTION_CREATED` | New subscription checkout initiated |
| `SUBSCRIPTION_CANCELED` | Subscription cancellation requested |
| `SUBSCRIPTION_UPDATED` | Plan upgrade or downgrade |
| `CREDITS_PURCHASED` | Credit top-up checkout initiated |
| `CREDITS_DEDUCTED` | Credits deducted for generation |
| `CREDITS_REFUNDED` | Credits refunded due to failure |

### Model Events

| Action | Description |
|--------|-------------|
| `MODEL_CREATED` | New AI model created |
| `MODEL_DELETED` | AI model deleted |
| `MODEL_MINTED` | Model exported with agency ID |

### Security Events

| Action | Description |
|--------|-------------|
| `LOGIN_SUCCESS` | Successful authentication |
| `LOGIN_FAILED` | Failed authentication attempt |
| `RATE_LIMIT_EXCEEDED` | Rate limit violation |
| `INSUFFICIENT_CREDITS` | Credit check failed |

### Abuse Detection

| Action | Description |
|--------|-------------|
| `ABUSE_DETECTED` | Abuse pattern triggered |
| `ABUSE_PATTERN_CREDITS` | Credit exploit attempt detected |
| `ABUSE_PATTERN_DELETION` | Rapid deletion pattern detected |
| `ABUSE_PATTERN_BILLING` | Billing anomaly detected |

## Event Options

The `logAuditEvent` function accepts these options:

```typescript
interface AuditEventOptions {
  userId?: number | null;        // User performing the action
  action: AuditAction;           // Action type from AUDIT_ACTIONS
  resourceType?: string;         // Type of affected resource
  resourceId?: string;           // ID of affected resource
  metadata?: Record<string, unknown>;  // Additional context
  severity?: "info" | "warning" | "critical";  // Event severity
  req?: Request;                 // Request object for IP/UA extraction
}
```

Always include the `req` parameter when available to capture IP address and user agent for security investigations.

## Severity Levels

Choose the appropriate severity level based on the operation's security impact:

| Severity | Use Case | Triggers Notification |
|----------|----------|----------------------|
| `info` | Normal operations, successful actions | No |
| `warning` | Potentially concerning actions, cancellations | No |
| `critical` | Security-sensitive operations, abuse detection | Yes (for abuse) |

## Abuse Detection

The audit logging system includes automatic abuse detection that monitors for suspicious patterns. When a pattern threshold is exceeded, the system logs an `ABUSE_DETECTED` event and, for critical patterns, sends a notification to the application owner.

### Configured Patterns

| Pattern | Trigger | Window | Threshold | Severity |
|---------|---------|--------|-----------|----------|
| Credits Exploit Attempt | `INSUFFICIENT_CREDITS` | 5 min | 10 events | Critical |
| Rapid Model Deletion | `MODEL_DELETED` | 10 min | 5 events | Warning |
| Billing Anomaly | Subscription events | 60 min | 5 events | Critical |
| Rate Limit Abuse | `RATE_LIMIT_EXCEEDED` | 15 min | 20 events | Warning |

### How It Works

After each audit event is logged, the system checks if the event matches any abuse pattern. If the user has exceeded the threshold for that pattern within the time window, the system:

1. Logs an `ABUSE_DETECTED` event with pattern details
2. For critical patterns, sends a notification via `notifyOwner`
3. Continues normal operation (does not block the user)

The notification includes the user ID, pattern name, event count, and recommended actions for investigation.

### Adding Custom Patterns

To add a new abuse pattern, update the `ABUSE_PATTERNS` array in `server/auditLog.ts`:

```typescript
const ABUSE_PATTERNS: AbusePattern[] = [
  // ... existing patterns ...
  {
    name: "Suspicious Export Activity",
    actions: [AUDIT_ACTIONS.MODEL_MINTED],
    windowMinutes: 30,
    threshold: 10,
    severity: "warning",
    description: "Unusually high export activity detected",
  },
];
```

## Querying Audit Logs

The audit logging module provides helper functions for querying logs:

```typescript
// Get recent logs for a specific user
const userLogs = await getUserAuditLogs(userId, 50);

// Get logs for a specific action type
const deletionLogs = await getAuditLogsByAction(AUDIT_ACTIONS.MODEL_DELETED, 100);

// Get all critical security events
const criticalLogs = await getCriticalAuditLogs(100);
```

For more complex queries, access the `audit_logs` table directly through Drizzle ORM.

## Database Schema

The `audit_logs` table stores all audit events:

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT | Auto-incrementing primary key |
| `userId` | INT | User who performed the action (nullable) |
| `action` | VARCHAR(64) | Action type from AUDIT_ACTIONS |
| `resourceType` | VARCHAR(32) | Type of affected resource |
| `resourceId` | VARCHAR(64) | ID of affected resource |
| `metadata` | JSON | Additional context data |
| `ipAddress` | VARCHAR(45) | Client IP address |
| `userAgent` | TEXT | Client user agent string |
| `severity` | ENUM | info, warning, or critical |
| `createdAt` | TIMESTAMP | When the event occurred |

## Best Practices

### Log After Success

Log audit events after the operation succeeds, not before:

```typescript
// ✅ CORRECT: Log after successful operation
await deleteModel(modelId);
await logAuditEvent({ action: AUDIT_ACTIONS.MODEL_DELETED, ... });

// ❌ WRONG: Logging before operation could log failed attempts
await logAuditEvent({ action: AUDIT_ACTIONS.MODEL_DELETED, ... });
await deleteModel(modelId);  // This might fail!
```

### Include Relevant Metadata

Include enough context to understand the event without querying other tables:

```typescript
// ✅ GOOD: Includes relevant context
await logAuditEvent({
  action: AUDIT_ACTIONS.SUBSCRIPTION_UPDATED,
  metadata: {
    previousPlan: "starter",
    newPlan: "pro",
    isUpgrade: true,
    creditAdjustment: 250,
  },
});

// ❌ POOR: Missing context
await logAuditEvent({
  action: AUDIT_ACTIONS.SUBSCRIPTION_UPDATED,
  metadata: { changed: true },
});
```

### Don't Block on Logging Failures

The `logAuditEvent` function catches and logs errors internally rather than throwing. This ensures that logging failures don't break the main operation. However, monitor your logs for `[AuditLog] Failed to log event` messages to catch persistent issues.

## Related Documentation

For additional security context, see [AUTHENTICATION.md](./AUTHENTICATION.md) for understanding user context in audit logs, [RATE_LIMITING.md](./RATE_LIMITING.md) for rate limit events that trigger audit logging, and [ATOMIC_CREDITS.md](./ATOMIC_CREDITS.md) for credit-related audit events.
