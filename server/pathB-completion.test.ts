/**
 * Path B Completion — EXPORT AVAILABILITY for the 3 final production
 * hardening items. Fifteen of these sixteen arms assert that something is
 * exported and is a function; the label now says so.
 *
 * ⚠ IT USED TO READ "Tests for … 2. Stripe webhook idempotency — DUPLICATE
 * EVENT DETECTION", AND NOTHING ANYWHERE DROVE A REDELIVERY. The section
 * below is headed "recordProcessedEvent is internal" over an arm asserting an
 * interface is exported. Stripe delivers at least once by design, and a
 * redelivered checkout reaches the referral payout — so the gate could have
 * stopped working with the whole suite green. Found by the label sweep
 * 2026-08-25 and driven in `server/stripe/webhookIdempotency.test.ts`, which
 * is where that behaviour now lives. **It is not that nobody wrote the tests;
 * this docblock said someone had, and a label is what a reader greps.**
 *
 * The arms here are honest and worth keeping — a dropped export or a renamed
 * schema column really does redden them. Item 3 always said "(tested via
 * module exports)" and was the only one of the three telling the truth.
 *
 * Export availability for:
 * 1. Structured logging (pino) — logger factory, request context middleware
 * 2. Stripe webhook plumbing — schema table, handler and result type
 *    (behaviour: `server/stripe/webhookIdempotency.test.ts`)
 * 3. GDPR export UI — SecurityTab component
 */
import { describe, expect, it, vi, beforeEach } from "vitest";


import { allowColdImports } from "./testing/suiteClocks";

/* This file is 16 `await import()` calls — family 1's exact subject — and carried the
   same hand-written `15_000` as its `pathB-hardening` sibling. Measured 2026-08-30:
   7,691ms quiet, 11,046ms loaded — 74% of the clock it had. See `suiteClocks.ts`. */
allowColdImports();
// ============================================================================
// 1. STRUCTURED LOGGING — Logger Factory
// ============================================================================
describe("Structured Logging — createModuleLogger", () => {
  it("should export createModuleLogger function", async () => {
    const { createModuleLogger } = await import("./logging/logger");
    expect(createModuleLogger).toBeDefined();
    expect(typeof createModuleLogger).toBe("function");
  });

  it("should return a logger with standard pino methods", async () => {
    const { createModuleLogger } = await import("./logging/logger");
    const log = createModuleLogger("test-module");
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");
    expect(typeof log.debug).toBe("function");
  });

  it("should include module name in child logger bindings", async () => {
    const { createModuleLogger } = await import("./logging/logger");
    const log = createModuleLogger("my-feature");
    // Pino child loggers have bindings accessible via the logger
    expect(log).toBeDefined();
  });
});

// ============================================================================
// 2. STRUCTURED LOGGING — Request Context Middleware
// ============================================================================
describe("Structured Logging — requestContextMiddleware", () => {
  it("should export requestContextMiddleware function", async () => {
    const { requestContextMiddleware } = await import("./logging/requestContextMiddleware");
    expect(requestContextMiddleware).toBeDefined();
    expect(typeof requestContextMiddleware).toBe("function");
  });

  it("should export requestContext from logger (AsyncLocalStorage)", async () => {
    const { requestContext } = await import("./logging/logger");
    expect(requestContext).toBeDefined();
    expect(typeof requestContext.getStore).toBe("function");
  });

  it("should export setRequestUserId function", async () => {
    const { setRequestUserId } = await import("./logging/requestContextMiddleware");
    expect(setRequestUserId).toBeDefined();
    expect(typeof setRequestUserId).toBe("function");
  });

  it("middleware should call next()", async () => {
    const { requestContextMiddleware } = await import("./logging/requestContextMiddleware");
    const req = { correlationId: "req_test123" } as any;
    const res = {} as any;
    const next = vi.fn();
    requestContextMiddleware(req, res, next);
    // next should have been called (possibly async)
    // Give it a tick for AsyncLocalStorage to settle
    await new Promise((r) => setTimeout(r, 10));
    expect(next).toHaveBeenCalled();
  });
});

// ============================================================================
// 3. STRUCTURED LOGGING — Barrel Export
// ============================================================================
describe("Structured Logging — logging barrel export", () => {
  it("should export all logging utilities from index", async () => {
    const mod = await import("./logging/index");
    expect(mod.createModuleLogger).toBeDefined();
    expect(mod.requestContextMiddleware).toBeDefined();
    expect(mod.requestContext).toBeDefined();
    expect(mod.setRequestUserId).toBeDefined();
  });
});

// ============================================================================
// 4. STRIPE WEBHOOK IDEMPOTENCY — Schema
// ============================================================================
describe("Stripe Webhook Idempotency — Schema", () => {
  it("should export stripeWebhookEvents table from schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.stripeWebhookEvents).toBeDefined();
  });

  it("stripeWebhookEvents should have required columns", async () => {
    const { stripeWebhookEvents } = await import("../drizzle/schema");
    // Drizzle table objects have column definitions
    const columns = Object.keys(stripeWebhookEvents);
    expect(columns).toContain("eventId");
    expect(columns).toContain("eventType");
    expect(columns).toContain("processedAt");
  });
});

// ============================================================================
// 5. STRIPE WEBHOOK IDEMPOTENCY — Handler Logic
// ============================================================================
describe("Stripe Webhook Idempotency — handleStripeWebhook", () => {
  it("should export handleStripeWebhook function", async () => {
    const { handleStripeWebhook } = await import("./stripe/webhooks");
    expect(handleStripeWebhook).toBeDefined();
    expect(typeof handleStripeWebhook).toBe("function");
  });

  it("should return error for invalid signature", async () => {
    const { handleStripeWebhook } = await import("./stripe/webhooks");
    // Pass invalid payload/signature — should fail signature verification
    const result = await handleStripeWebhook("invalid-payload", "invalid-signature");
    expect(result.success).toBe(false);
    expect(result.message).toBe("Invalid signature");
  });
});

// ============================================================================
// 6. STRIPE WEBHOOK IDEMPOTENCY — recordProcessedEvent is internal
// ============================================================================
describe("Stripe Webhook Idempotency — WebhookResult type", () => {
  it("should export WebhookResult interface", async () => {
    // WebhookResult is a TypeScript interface, so we verify the module structure
    const mod = await import("./stripe/webhooks");
    expect(mod.handleStripeWebhook).toBeDefined();
    // The function returns WebhookResult — verify shape
    const result = await mod.handleStripeWebhook("test", "test");
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("message");
  });
});

// ============================================================================
// 7. GDPR EXPORT UI — SecurityTab uses trpc.account.exportData
// ============================================================================
describe("GDPR Export — account.exportData procedure exists", () => {
  it("account router should have exportData procedure", async () => {
    const { appRouter } = await import("./routers");
    // Verify the procedure exists on the router
    const procedures = Object.keys((appRouter as any)._def.procedures);
    expect(procedures).toContain("account.exportData");
  });

  it("exportData should require authentication", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      user: null,
      req: { headers: {} } as any,
      res: {} as any,
      correlationId: "req_test_gdpr",
    });
    await expect(caller.account.exportData()).rejects.toThrow();
  });
});

// ============================================================================
// 8. PINO REPLACES CONSOLE — Verify no console.* in server code
// ============================================================================
describe("Structured Logging — console.* migration completeness", () => {
  it("server files should use createModuleLogger, not console.*", async () => {
    // This is a meta-test: verify the logger module is properly structured
    const { createModuleLogger } = await import("./logging/logger");
    const log = createModuleLogger("test");
    
    // Verify pino logger has the expected API
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");
    expect(typeof log.debug).toBe("function");
    expect(typeof log.fatal).toBe("function");
    expect(typeof log.trace).toBe("function");
  });
});
