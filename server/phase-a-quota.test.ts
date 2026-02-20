/**
 * Phase A Tests — Configurable queue limits, daily quota tracking,
 * and queue status endpoint.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

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
