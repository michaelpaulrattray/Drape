# Admin Security Guide

This document covers the advanced security measures protecting admin functionality in FormaStudio.

## Overview

Admin access is protected by multiple layers of security:

1. **Role-Based Access Control** - Database-backed admin role
2. **Admin Allowlist** - Hardcoded list of allowed admin users
3. **Real-Time Enforcement** - Checks on every API call
4. **Activity Alerts** - Slack notifications for all admin actions
5. **Immutable Audit Log** - Hash-chained, append-only security log

## Admin Allowlist

Even if an attacker gains database access and changes a user's role to `admin`, they won't have admin privileges unless they're on the allowlist.

### Configuration

The allowlist is defined in `server/adminSecurity.ts`:

```typescript
const ADMIN_ALLOWLIST: (number | string)[] = [
  // Add allowed admin user IDs or emails here
  // Example: 1, "admin@formastudio.app", 2
  process.env.OWNER_OPEN_ID ? parseInt(process.env.OWNER_OPEN_ID) : null,
  process.env.OWNER_NAME || null,
].filter(Boolean);
```

### Adding New Admins

1. Add the user's ID or email to `ADMIN_ALLOWLIST` in `server/adminSecurity.ts`
2. Update the user's role to `admin` in the database
3. Deploy the changes

### How It Works

```typescript
// In server/_core/trpc.ts
const validation = validateAdminAccess({
  id: ctx.user.id,
  role: ctx.user.role,
  email: ctx.user.email,
});

if (!validation.allowed) {
  // Log unauthorized access attempt
  await logUnauthorizedAdminAccess({...});
  throw new TRPCError({ code: "FORBIDDEN" });
}
```

## Admin Activity Alerts

All admin actions are logged and sent to Slack for real-time monitoring.

### Alert Types

| Action | Severity | Slack Alert |
|--------|----------|-------------|
| View audit logs | Info | Standard |
| View user list | Info | Standard |
| Suspend user | Warning | Sensitive |
| Adjust credits | Warning | Sensitive |
| Block IP | Warning | Sensitive |
| Delete model | Warning | Sensitive |

### Sensitive Actions

Sensitive actions trigger enhanced alerts with more details:

```typescript
const SENSITIVE_ACTIONS = [
  "suspendUser",
  "adjustCredits",
  "blockIP",
  "deleteModel",
  "changePlan",
  "cancelSubscription",
];
```

## Immutable Audit Log

Critical security events are written to a hash-chained, append-only log that cannot be tampered with.

### How It Works

1. Each entry includes the hash of the previous entry
2. Entries are backed up to Slack as permanent record
3. Chain integrity can be verified at any time

### Logged Events

- User suspensions
- IP blocks
- Credit adjustments
- Unauthorized admin access attempts

### Verification

```typescript
import { verifyImmutableLogChain } from "./adminSecurity";

const result = verifyImmutableLogChain();
// { valid: true, entries: 42 }
// or { valid: false, entries: 42, brokenAt: 15 }
```

## Unauthorized Access Detection

When someone attempts to access admin functionality without proper authorization:

1. The attempt is logged with critical severity
2. A Slack alert is sent immediately
3. The request is rejected with FORBIDDEN error
4. The user's IP and user agent are recorded

### Alert Example

```
🚨 CRITICAL: Unauthorized Admin Access Attempt

User ID: 123
User Name: attacker@example.com
Attempted Action: admin_access
IP Address: 192.168.1.100

This user has admin role in database but is NOT on the allowlist.
```

## Best Practices

### For System Administrators

1. **Keep the allowlist minimal** - Only add users who absolutely need admin access
2. **Monitor Slack alerts** - Review admin activity regularly
3. **Verify the immutable log** - Run periodic integrity checks
4. **Review unauthorized attempts** - Investigate any access attempts

### For Developers

1. **Never bypass the allowlist** - All admin routes must use `adminProcedure`
2. **Log all admin actions** - Use `logAdminAction()` for new admin features
3. **Write to immutable log** - Use `writeImmutableLog()` for critical actions
4. **Test with non-admin users** - Verify access controls work correctly

## Security Checklist

- [ ] All admin procedures use `adminProcedure` middleware
- [ ] Allowlist is configured with correct user IDs/emails
- [ ] Slack webhook is configured for alerts
- [ ] Immutable log is being written for critical actions
- [ ] Unauthorized access attempts are being logged

## Related Documentation

- [Authentication](./AUTHENTICATION.md) - User authentication and session management
- [Audit Logging](./AUDIT_LOGGING.md) - General audit logging system
- [Notifications](./NOTIFICATIONS.md) - Slack notification system
- [Rate Limiting](./RATE_LIMITING.md) - Rate limiting and IP blocking
