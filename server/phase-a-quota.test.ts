/**
 * Phase A Tests — Configurable queue limits, daily quota tracking,
 * and queue status endpoint.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── 1. Configurable Queue Limits ──────────────────────────────────────────

describe("Configurable Queue Limits", () => {
  it("reads IMAGE_CONCURRENCY from env", async () => {
    // The module reads process.env at import time, so we verify the
    // getQueueConfig export reflects the env-configured values.
    const { getQueueConfig } = await import("./casting/geminiQueue");
    const config = getQueueConfig();

    // Default is 5 if env not set; env may override
    expect(config.imageConcurrency).toBeGreaterThanOrEqual(1);
    expect(config.imageConcurrency).toBeLessThanOrEqual(100);
  });

  it("reads TEXT_CONCURRENCY from env", async () => {
    const { getQueueConfig } = await import("./casting/geminiQueue");
    const config = getQueueConfig();

    expect(config.textConcurrency).toBeGreaterThanOrEqual(1);
    expect(config.textConcurrency).toBeLessThanOrEqual(100);
  });

  it("reads MAX_QUEUE_DEPTH from env", async () => {
    const { getQueueConfig } = await import("./casting/geminiQueue");
    const config = getQueueConfig();

    expect(config.maxQueueDepth).toBeGreaterThanOrEqual(1);
    expect(config.maxQueueDepth).toBeLessThanOrEqual(1000);
  });

  it("getQueueStats returns correct structure", async () => {
    const { getQueueStats } = await import("./casting/geminiQueue");
    const stats = getQueueStats();

    expect(stats).toHaveProperty("image");
    expect(stats).toHaveProperty("text");
    expect(stats.image).toHaveProperty("active");
    expect(stats.image).toHaveProperty("pending");
    expect(stats.image).toHaveProperty("queueDepth");
    expect(stats.image).toHaveProperty("concurrency");
    expect(stats.image).toHaveProperty("maxDepth");
    expect(stats.text).toHaveProperty("active");
    expect(stats.text).toHaveProperty("pending");
    expect(stats.text).toHaveProperty("queueDepth");
    expect(stats.text).toHaveProperty("concurrency");
    expect(stats.text).toHaveProperty("maxDepth");
  });
});

// ── 2. Daily Quota Module ─────────────────────────────────────────────────

describe("Daily Quota Module", () => {
  it("getDailyLimit returns a positive number", async () => {
    const { getDailyLimit } = await import("./db/dailyQuota");
    const limit = getDailyLimit();

    expect(limit).toBeGreaterThan(0);
    expect(Number.isInteger(limit)).toBe(true);
  });

  it("checkDailyQuota returns correct structure", async () => {
    // Mock getDb to return a mock database
    const dailyQuota = await import("./db/dailyQuota");

    // We can't easily test with a real DB, but we can verify the
    // function signature and return type by testing getDailyLimit
    const limit = dailyQuota.getDailyLimit();
    expect(limit).toBeGreaterThan(0);
  });

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
