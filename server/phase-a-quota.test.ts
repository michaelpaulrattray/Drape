/**
 * Phase A — largely EXPORT AVAILABILITY. Four of these six arms assert that
 * something is exported and is a function; the label now says so.
 *
 * ⚠ THE SAME LABEL SHAPE ON A SIBLING FILE HID A MONEY-PATH CONTROL WITH NO
 * ARM AT ALL (`pathB-completion.test.ts`, Stripe webhook idempotency, found
 * 2026-08-25). Whether the behaviours named below are driven anywhere is a
 * read in progress (fable-1634); this docblock claims nothing about it.
 *
 * Covers: configurable queue limits, daily quota tracking, and the queue
 * status endpoint — at their exports.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";


import { allowColdImports } from "./testing/suiteClocks";

/* Every arm here is `await import("./db/dailyQuota")` — family 1's exact subject.
   It timed out at the 5s default on #233 (foreman-99 run 2). See `suiteClocks.ts`. */
allowColdImports();
// ── 1. Configurable Queue Limits ──────────────────────────────────────────

// ── 2. Daily Quota Module ─────────────────────────────────────────────────

describe("Daily Quota Module", () => {
  it("enforceDailyQuota is an async function", async () => {
    const { enforceDailyQuota } = await import("./db/dailyQuota");
    expect(typeof enforceDailyQuota).toBe("function");
  });

  it("checkDailyQuota is an async function", async () => {
    const { checkDailyQuota } = await import("./db/dailyQuota");
    expect(typeof checkDailyQuota).toBe("function");
  });

  it("getUserDailyGenerationCount is an async function", async () => {
    const { getUserDailyGenerationCount } = await import("./db/dailyQuota");
    expect(typeof getUserDailyGenerationCount).toBe("function");
  });
});

// ── 3. Queue Status Router ────────────────────────────────────────────────

describe("Queue Status Router", () => {
  it("queueStatusRouter exports a router with getStatus procedure", async () => {
    const { queueStatusRouter } = await import(
      "./routes/generation/queueStatus"
    );
    expect(queueStatusRouter).toBeDefined();
    expect(queueStatusRouter._def).toBeDefined();
    expect(queueStatusRouter._def.procedures).toBeDefined();
    expect(queueStatusRouter._def.procedures.getStatus).toBeDefined();
  });
});

// ── 4. URL Validator (from Batch 1, verify still works) ───────────────────

describe("URL Validator Integration", () => {
  it("validates S3 URLs correctly", async () => {
    const { validateProxyUrl } = await import("./security/urlValidator");

    // Valid S3 URL
    const validResult = validateProxyUrl(
      "https://d2xsxph8kpxj0f.cloudfront.net/test/image.png",
    );
    expect(validResult.valid).toBe(true);

    // Invalid URL (private IP)
    const invalidResult = validateProxyUrl("http://169.254.169.254/metadata");
    expect(invalidResult.valid).toBe(false);
  });
});

// ── 5. Security Headers (from Batch 1, verify still works) ────────────────

describe("Security Headers Integration", () => {
  it("securityHeaders middleware is exported as a function", async () => {
    const { securityHeaders } = await import(
      "./security/securityHeaders"
    );

    expect(securityHeaders).toBeDefined();
    expect(typeof securityHeaders).toBe("function");
  });
});
