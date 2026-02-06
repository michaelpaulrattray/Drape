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

## Related Documentation

For additional security context, see [AUTHENTICATION.md](./AUTHENTICATION.md) for protecting endpoints before rate limiting applies, [ATOMIC_CREDITS.md](./ATOMIC_CREDITS.md) for credit-based rate limiting on generation endpoints, and [AUDIT_LOGGING.md](./AUDIT_LOGGING.md) for logging rate limit violations.
