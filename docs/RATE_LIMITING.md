# Rate Limiting

This guide explains the rate limiting implementation in FormaStudio, which prevents API abuse, protects against denial-of-service attacks, and ensures fair resource usage across all users.

## Overview

FormaStudio uses an in-memory sliding window rate limiter implemented in `server/rateLimit.ts`. The system tracks request counts per identifier (IP address or user ID) within configurable time windows and rejects requests that exceed the configured limits.

Rate limiting serves several important purposes. It prevents spam bots from flooding signup forms with fake entries. It protects expensive AI generation endpoints from abuse. It ensures fair access to shared resources across all users. It mitigates the impact of compromised accounts or API keys.

## How It Works

The rate limiter uses a sliding window algorithm that provides a balance between accuracy and memory efficiency.

When a request arrives, the system looks up the identifier (IP or user ID) in the rate limit store. If no entry exists or the previous window has expired, a new window starts with a count of 1. If an entry exists within the current window, the count is incremented. If the count exceeds the maximum allowed requests, the request is rejected with a `TOO_MANY_REQUESTS` error.

The sliding window approach means that limits reset gradually rather than all at once, preventing the "thundering herd" problem where many requests queue up waiting for a window reset.

## Pre-Configured Limits

FormaStudio defines several rate limit configurations in `RATE_LIMITS` for different endpoint categories:

| Category | Window | Max Requests | Use Case |
|----------|--------|--------------|----------|
| `newsletter` | 1 hour | 5 per IP | Newsletter signup form |
| `waitlist` | 1 hour | 5 per IP | Waitlist signup form |
| `generation` | 1 minute | 10 per user | AI image generation |
| `modelCreate` | 1 minute | 5 per user | Creating new models |
| `billing` | 1 minute | 3 per user | Checkout and billing operations |

These limits are designed to allow legitimate usage while preventing abuse. A real user would rarely hit these limits during normal operation.

## Implementation

### Basic Rate Limiting

To add rate limiting to an endpoint, use the `checkRateLimit` function:

```typescript
import { checkRateLimit, getClientIp, RATE_LIMITS, rateLimitError } from "./rateLimit";
import { TRPCError } from "@trpc/server";

signup: publicProcedure
  .input(z.object({ email: z.string().email() }))
  .mutation(async ({ ctx, input }) => {
    // Get client IP for rate limiting
    const clientIp = getClientIp(ctx.req);
    
    // Check rate limit
    const rateCheck = checkRateLimit(clientIp, RATE_LIMITS.newsletter);
    if (!rateCheck.allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: rateLimitError(rateCheck.resetIn),
      });
    }
    
    // Process the signup
    await addToNewsletter(input.email);
    return { success: true };
  }),
```

### User-Based Rate Limiting

For authenticated endpoints, use the user ID instead of IP address:

```typescript
generateImage: protectedProcedure
  .input(z.object({ prompt: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // Rate limit by user ID
    const rateCheck = checkRateLimit(
      ctx.user.id.toString(),
      RATE_LIMITS.generation
    );
    if (!rateCheck.allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: rateLimitError(rateCheck.resetIn),
      });
    }
    
    // Generate the image
    return await generateCastingImage(input.prompt);
  }),
```

### Combined Rate Limiting

Some endpoints benefit from both IP-based and user-based rate limiting:

```typescript
createModel: protectedProcedure
  .input(z.object({ name: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const clientIp = getClientIp(ctx.req);
    
    // Check IP-based limit (prevents one IP from creating many accounts)
    const ipCheck = checkRateLimit(clientIp, {
      ...RATE_LIMITS.modelCreate,
      keyPrefix: 'model-ip',
    });
    if (!ipCheck.allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: rateLimitError(ipCheck.resetIn),
      });
    }
    
    // Check user-based limit
    const userCheck = checkRateLimit(
      ctx.user.id.toString(),
      RATE_LIMITS.modelCreate
    );
    if (!userCheck.allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: rateLimitError(userCheck.resetIn),
      });
    }
    
    return await createModel(ctx.user.id, input.name);
  }),
```

## Custom Rate Limits

For endpoints with unique requirements, create a custom configuration:

```typescript
const customLimit: RateLimitConfig = {
  windowMs: 5 * 60 * 1000,  // 5 minutes
  maxRequests: 20,          // 20 requests per 5 minutes
  keyPrefix: 'custom',
};

const rateCheck = checkRateLimit(identifier, customLimit);
```

When designing custom limits, consider the legitimate use case (how often would a real user need this?), the cost of the operation (expensive operations need stricter limits), and the abuse potential (public endpoints need stricter limits than authenticated ones).

## Memory Management

The rate limiter stores entries in memory, which provides fast lookups but requires cleanup to prevent memory leaks. A background interval runs every 5 minutes and removes entries older than 1 hour.

For most deployments, this approach works well. However, if you're running multiple server instances behind a load balancer, each instance maintains its own rate limit store. This means effective limits are multiplied by the number of instances. For strict rate limiting across instances, consider using Redis or another shared store.

## Response Headers

While not currently implemented, you may want to add rate limit headers to responses for client visibility:

```typescript
// Example: Adding rate limit headers
ctx.res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
ctx.res.setHeader('X-RateLimit-Remaining', rateCheck.remaining.toString());
ctx.res.setHeader('X-RateLimit-Reset', Math.ceil(rateCheck.resetIn / 1000).toString());
```

## Error Messages

The `rateLimitError` helper generates user-friendly error messages:

```typescript
rateLimitError(30000);  // "Too many requests. Please try again in 30 seconds."
rateLimitError(120000); // "Too many requests. Please try again in 2 minutes."
```

These messages inform users when they can retry without revealing internal rate limit configuration details.

## Testing Rate Limits

When testing rate-limited endpoints, you can temporarily increase limits or mock the rate limiter:

```typescript
// In tests, you might want to mock checkRateLimit
vi.mock("./rateLimit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 99, resetIn: 60000 })),
  getClientIp: vi.fn(() => "127.0.0.1"),
  RATE_LIMITS: { /* ... */ },
  rateLimitError: vi.fn((ms) => `Rate limited for ${ms}ms`),
}));
```

## Monitoring and Alerts

Rate limit rejections can indicate abuse attempts. Consider logging rejections for monitoring:

```typescript
if (!rateCheck.allowed) {
  console.warn(`[RateLimit] Rejected ${identifier} for ${config.keyPrefix}`);
  // Optionally: await logAuditEvent({ action: 'rate_limit_exceeded', ... });
  throw new TRPCError({ code: "TOO_MANY_REQUESTS", ... });
}
```

For production systems, integrate with your monitoring solution to alert on unusual patterns of rate limit rejections.

## Per-User Rate Limiting

Standard IP-based rate limiting can be bypassed by distributed attacks where the same user sends requests from multiple IP addresses (using VPNs, proxies, or botnets). Per-user rate limiting addresses this by tracking requests per authenticated user regardless of their IP address.

### When to Use Per-User Limits

Use per-user rate limiting for authenticated endpoints where abuse could come from a single compromised or malicious account operating across multiple IPs. This is especially important for expensive operations like AI generation, billing actions, and bulk data operations.

### Implementation

Use the `checkUserRateLimit` function instead of `checkRateLimit` for authenticated endpoints:

```typescript
import { checkUserRateLimit, USER_RATE_LIMITS, rateLimitError } from "./rateLimit";

generateImage: protectedProcedure
  .input(z.object({ prompt: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // Per-user rate limit (regardless of IP)
    const rateCheck = checkUserRateLimit(
      ctx.user.id,
      USER_RATE_LIMITS.userGeneration
    );
    if (!rateCheck.allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: rateLimitError(rateCheck.resetIn),
      });
    }
    
    return await generateCastingImage(input.prompt);
  }),
```

### Pre-Configured Per-User Limits

The `USER_RATE_LIMITS` object provides configurations for common authenticated operations:

| Category | Window | Max Requests | Use Case |
|----------|--------|--------------|----------|
| `apiGeneral` | 1 minute | 60 per user | General API calls |
| `userGeneration` | 1 minute | 20 per user | AI generation requests |
| `userBilling` | 1 minute | 5 per user | Billing and checkout actions |

### Combining IP and User Limits

For maximum protection, combine both IP-based and per-user rate limiting:

```typescript
// Check IP-based limit first (catches bot networks)
const ipCheck = checkRateLimit(getClientIp(ctx.req), RATE_LIMITS.generation);
if (!ipCheck.allowed) {
  throw new TRPCError({ code: "TOO_MANY_REQUESTS", ... });
}

// Then check per-user limit (catches distributed attacks from one account)
const userCheck = checkUserRateLimit(ctx.user.id, USER_RATE_LIMITS.userGeneration);
if (!userCheck.allowed) {
  throw new TRPCError({ code: "TOO_MANY_REQUESTS", ... });
}
```

## Global Attack Detection

Beyond individual rate limits, FormaStudio monitors for system-wide attack patterns. This detects coordinated attacks that might stay under individual limits but collectively indicate malicious activity.

### How It Works

The global attack detection system tracks failed login attempts across all users and IPs within a sliding 5-minute window. When the total exceeds configured thresholds, the system triggers alerts and logs security events.

### Thresholds

| Level | Threshold | Action |
|-------|-----------|--------|
| Warning | 50 failed logins in 5 min | Log `abuse.global_attack_detected` event |
| Critical | 100 failed logins in 5 min | Log event + notify owner via `notifyOwner` |

### Implementation

The OAuth callback automatically records failed logins and checks for attack patterns:

```typescript
import { 
  recordGlobalFailedLogin, 
  shouldSendGlobalAttackAlert, 
  markGlobalAttackAlertSent 
} from "./rateLimit";

// After a failed login attempt
const attackStatus = recordGlobalFailedLogin();

if (attackStatus.underAttack && shouldSendGlobalAttackAlert()) {
  markGlobalAttackAlertSent();
  
  await notifyOwner({
    title: `🚨 ${attackStatus.severity === 'critical' ? 'CRITICAL' : 'WARNING'}: Possible Attack Detected`,
    content: `${attackStatus.failedCount} failed login attempts detected in the last 5 minutes.`,
  });
  
  await logAuditEvent({
    action: AUDIT_ACTIONS.ABUSE_GLOBAL_ATTACK,
    severity: "critical",
    metadata: { failedCount: attackStatus.failedCount },
  });
}
```

### Checking Attack Status

You can check the current attack status programmatically:

```typescript
import { isSystemUnderAttack } from "./rateLimit";

const status = isSystemUnderAttack();
// Returns: { underAttack: boolean, severity: 'none' | 'warning' | 'critical', failedCount: number, windowRemaining: number }

if (status.underAttack) {
  console.warn(`System under ${status.severity} attack: ${status.failedCount} failed logins`);
}
```

### Alert Deduplication

To prevent alert fatigue, the system only sends one notification per attack window. The `markGlobalAttackAlertSent()` function marks that an alert has been sent, and `shouldSendGlobalAttackAlert()` returns false until the window resets.

## IP Blocking

For persistent threats, FormaStudio supports blocking specific IP addresses entirely. Blocked IPs cannot access any endpoint, including public pages.

### Blocking an IP

Admins can block IPs through the admin dashboard or programmatically:

```typescript
import { blockIp, unblockIp, isIpBlocked } from "./db";

// Block an IP permanently
await blockIp(
  "192.168.1.100",           // IP address
  "Repeated abuse attempts", // Reason
  ctx.user.id,               // Admin who blocked
  null                       // No expiry (permanent)
);

// Block an IP temporarily (24 hours)
await blockIp(
  "192.168.1.100",
  "Suspicious activity",
  ctx.user.id,
  new Date(Date.now() + 24 * 60 * 60 * 1000) // Expires in 24 hours
);

// Check if an IP is blocked
const blocked = await isIpBlocked("192.168.1.100");
if (blocked) {
  // Reject the request
}

// Unblock an IP
await unblockIp("192.168.1.100");
```

### Automatic IP Checking

The `checkIpBlocked` function in `rateLimit.ts` is designed to be called early in the request pipeline:

```typescript
import { checkIpBlocked, getClientIp } from "./rateLimit";

// In middleware or at the start of procedures
const clientIp = getClientIp(ctx.req);
const blockResult = await checkIpBlocked(clientIp);

if (!blockResult.allowed) {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Access denied",
  });
}
```

### Admin Interface

The admin audit logs page (`/admin/audit-logs`) includes a "Blocked IPs" tab where admins can:

- View all currently blocked IPs
- See block reason and expiration
- Manually block new IPs with custom duration
- Unblock IPs when threats are resolved

Admins can also block IPs directly from audit log entries by clicking the "Block IP" button when viewing log details.

### Emergency Blocking via Slack

When Slack notifications are configured, critical security alerts include a "Block IP" button that allows immediate blocking without accessing the admin dashboard. This is useful during active attacks when the dashboard may be slow or inaccessible.

See [NOTIFICATIONS.md](./NOTIFICATIONS.md) for Slack integration setup.

### Database Schema

Blocked IPs are stored in the `blocked_ips` table:

| Column | Type | Description |
|--------|------|-------------|
| `id` | int | Primary key |
| `ipAddress` | varchar | The blocked IP address |
| `reason` | text | Why the IP was blocked |
| `blockedBy` | int | Admin user ID who blocked |
| `expiresAt` | datetime | When the block expires (null = permanent) |
| `createdAt` | datetime | When the block was created |

### Audit Trail

All IP blocking actions are logged:

- `security.ip_blocked` - When an IP is blocked
- `security.ip_unblocked` - When an IP is unblocked
- `security.emergency_action_executed` - When blocked via Slack button

## Related Documentation

For additional security context, see [AUTHENTICATION.md](./AUTHENTICATION.md) for protecting endpoints before rate limiting applies and account lockout configuration, [ATOMIC_CREDITS.md](./ATOMIC_CREDITS.md) for credit-based rate limiting on generation endpoints, [AUDIT_LOGGING.md](./AUDIT_LOGGING.md) for logging rate limit violations and abuse detection events, and [NOTIFICATIONS.md](./NOTIFICATIONS.md) for Slack alerts and emergency actions.
