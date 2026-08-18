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
import { checkUserRateLimit, rateLimitError } from "./rateLimit";

// The limit lives beside the route it governs — one object, one reader.
const GENERATE_IMAGE_LIMIT = { windowMs: 60_000, maxRequests: 20, keyPrefix: 'user_gen' };

generateImage: protectedProcedure
  .input(z.object({ prompt: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // Per-user rate limit (regardless of IP)
    const rateCheck = checkUserRateLimit(ctx.user.id, GENERATE_IMAGE_LIMIT);
    if (!rateCheck.allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: rateLimitError(rateCheck.resetIn),
      });
    }
    
    return await generateCastingImage(input.prompt);
  }),
```

### Where a per-user limit lives

**There is no shared table of per-user limits, deliberately** (removed 2026-08-17).
One existed and nothing read it — a second set of numbers on security code whose
only effect would have been a future reader tightening it and shipping nothing.

Each route declares its own limit object next to the handler it governs, and
passes it to `checkUserRateLimit`. The live examples are
`IMAGE_PROXY_RATE_LIMIT` (`routes/imageProxy.ts`), `EVIDENCE_REFERENCE_LIMIT` /
`INK_WORKFLOW_LIMIT` / `INK_RESOLUTION_LIMIT` (`routes/evidence.ts`) and
`CHARACTER_SHEET_RATE_LIMIT` (`routes/characterSheet.ts`). The IP-keyed buckets
are the shared `RATE_LIMITS` table in `security/rateLimit.ts`.

### Combining IP and User Limits

For maximum protection, combine both IP-based and per-user rate limiting:

```typescript
// Check IP-based limit first (catches bot networks)
const ipCheck = checkRateLimit(getClientIp(ctx.req), RATE_LIMITS.generation);
if (!ipCheck.allowed) {
  throw new TRPCError({ code: "TOO_MANY_REQUESTS", ... });
}

// Then check per-user limit (catches distributed attacks from one account)
const userCheck = checkUserRateLimit(ctx.user.id, GENERATE_IMAGE_LIMIT);
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
| Warning | 50 failed logins in 5 min | Slack alert to #security-alerts, once per window |
| Critical | 100 failed logins in 5 min | The same alert, marked CRITICAL |

### Implementation

**Wired 2026-08-19** by founder ruling (*"wire and explain in plain english"*).
Before that date this section carried a worked example of wiring that had never
been done, and the three helpers it named had no call site anywhere in the
product — so an auditor reading this page saw a live control where there was
none. What is written below is what the code does.

The call site is `server/security/loginAttackAlert.ts`, and the login route
calls it from **both** failed-login exits (`server/routes/emailAuth.ts`):

```typescript
import { noteFailedLogin } from "../security/loginAttackAlert";

// at the unknown-email exit AND at the wrong-password exit
void noteFailedLogin();
```

Three things about that, each of which is a decision rather than a detail:

- **Both exits, including the one where the email is not a real account.**
  Credential stuffing works from a leaked list, so most of its attempts name
  addresses we have never seen. An alarm wired only to the wrong-password
  branch would sleep through the commonest attack there is. The count is global
  and carries no email, so the enumeration defence (one generic sentence at both
  exits) is untouched.
- **Fire-and-forget, and every failure inside is swallowed.** A Slack outage may
  not turn "your password was wrong" into a 500, and may not make a login slow.
- **The window is marked as alerted BEFORE the send, not after.** Two failures
  arriving while a slow send is in flight would otherwise both find an unmarked
  window and both alert — under a real attack that is a flood, and a flood is
  how an alarm gets muted by the person it is alarming. A lost Slack message
  costs one alert; the other ordering costs the channel.

### The honest limit of this control

`globalAttackWindow` lives **in memory, in one process, and resets on every
deploy** — and this product deploys several times a day.

So it catches a **fast, loud** attack (50 failures inside five minutes) and
would **miss a slow, patient one** that spreads its attempts across a deploy.
That is worth having and it is not worth overselling. Anyone assessing this
control should read this paragraph as part of it.

### Alert deduplication

One notification per attack window. `markGlobalAttackAlertSent()` marks the
window; `shouldSendGlobalAttackAlert()` returns false until the window resets.
Driven directly in `server/security/loginAttackAlert.test.ts`, including the
concurrent case — that test exists because the sequential ones all stayed green
when the mark/send ordering was deliberately reversed.

### Two symbols this page used to document that do not exist

Removed 2026-08-19 rather than left to be searched for:

- **`isSystemUnderAttack`** — a "Checking Attack Status" section documented this
  import with a return shape including `windowRemaining`. There is no such
  export in `server/security/rateLimit.ts` and there never has been.
- **`AUDIT_ACTIONS.ABUSE_GLOBAL_ATTACK`** — the thresholds table promised an
  `abuse.global_attack_detected` audit event. No such action is defined and
  nothing writes one. The alert goes to Slack; the audit log is not part of this
  control, and the table above now says so.

## IP Blocking

**Section removed 2026-07-25.** It previously documented IP blocking as operational, including an "Automatic IP Checking" subsection. It is not. The `blockIp` / `isIpBlocked` helpers in `server/db/ipBlocking.ts` exist and the admin controls do write to the database, but nothing consults the block list during a request. See H2 in `docs/specs/SECURITY_AUDIT_2026-07-25.md`. Re-document this only once enforcement is genuinely wired into the request path.

## Related Documentation

For additional security context, see [AUTHENTICATION.md](./AUTHENTICATION.md) for protecting endpoints before rate limiting applies and account lockout configuration, [ATOMIC_CREDITS.md](./ATOMIC_CREDITS.md) for credit-based rate limiting on generation endpoints, [AUDIT_LOGGING.md](./AUDIT_LOGGING.md) for logging rate limit violations and abuse detection events, and [NOTIFICATIONS.md](./NOTIFICATIONS.md) for Slack alerts and emergency actions.
