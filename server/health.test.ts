/**
 * Tests for the deep-check health endpoint.
 *
 * Covers:
 * - checkDatabase: up/down/error scenarios
 * - deriveOverallStatus: healthy/unhealthy mapping
 * - healthHandler: HTTP status codes, rate limiting, response shape
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkDatabase, deriveOverallStatus, type HealthCheckResult } from "./health";

// ============================================================================
// deriveOverallStatus
// ============================================================================

describe("deriveOverallStatus", () => {
  it("should return 'healthy' when DB is up", () => {
    expect(deriveOverallStatus("up")).toBe("healthy");
  });

  it("should return 'unhealthy' when DB is down", () => {
    expect(deriveOverallStatus("down")).toBe("unhealthy");
  });
});

// ============================================================================
// checkDatabase (mocked)
// ============================================================================

vi.mock("./db/connection", () => ({
  getDb: vi.fn(),
}));

import { getDb } from "./db/connection";
const mockGetDb = vi.mocked(getDb);

describe("checkDatabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 'up' with latency when DB responds", async () => {
    mockGetDb.mockResolvedValue({
      execute: vi.fn().mockResolvedValue([{ 1: 1 }]),
    } as any);

    const result = await checkDatabase();

    expect(result.status).toBe("up");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
  });

  it("should return 'down' when getDb returns null", async () => {
    mockGetDb.mockResolvedValue(null);

    const result = await checkDatabase();

    expect(result.status).toBe("down");
    expect(result.latencyMs).toBe(0);
    expect(result.error).toBe("No database connection");
  });

  it("should return 'down' with error message when query throws", async () => {
    mockGetDb.mockResolvedValue({
      execute: vi.fn().mockRejectedValue(new Error("Connection refused")),
    } as any);

    const result = await checkDatabase();

    expect(result.status).toBe("down");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBe("Connection refused");
  });

  it("should return 'down' with generic message for non-Error throws", async () => {
    mockGetDb.mockResolvedValue({
      execute: vi.fn().mockRejectedValue("string error"),
    } as any);

    const result = await checkDatabase();

    expect(result.status).toBe("down");
    expect(result.error).toBe("Unknown database error");
  });

  it("should return 'down' when getDb itself throws", async () => {
    mockGetDb.mockRejectedValue(new Error("Pool destroyed"));

    const result = await checkDatabase();

    expect(result.status).toBe("down");
    expect(result.error).toBe("Pool destroyed");
  });

  it("should measure latency even on failure", async () => {
    mockGetDb.mockResolvedValue({
      execute: vi.fn().mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 10));
        throw new Error("Timeout");
      }),
    } as any);

    const result = await checkDatabase();

    expect(result.status).toBe("down");
    expect(result.latencyMs).toBeGreaterThan(0);
  });
});

// ============================================================================
// healthHandler (integration-style with mock req/res)
// ============================================================================

vi.mock("./security/rateLimit", () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

import { checkRateLimit } from "./security/rateLimit";
import { healthHandler } from "./health";
const mockCheckRateLimit = vi.mocked(checkRateLimit);

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: any) {
      res.body = data;
      return res;
    },
  };
  return res;
}

function createMockReq(ip = "127.0.0.1") {
  return {
    headers: {},
    ip,
  } as any;
}

describe("healthHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({
      allowed: true,
      remaining: 9,
      resetIn: 60_000,
    });
  });

  it("should return 200 with healthy status when DB is up", async () => {
    mockGetDb.mockResolvedValue({
      execute: vi.fn().mockResolvedValue([{ 1: 1 }]),
    } as any);

    const req = createMockReq();
    const res = createMockRes();
    await healthHandler(req, res);

    expect(res.statusCode).toBe(200);
    const body: HealthCheckResult = res.body;
    expect(body.status).toBe("healthy");
    expect(body.checks.database.status).toBe("up");
    expect(body.uptime).toBeGreaterThan(0);
    expect(body.timestamp).toBeTruthy();
  });

  it("should return 503 with unhealthy status when DB is down", async () => {
    mockGetDb.mockResolvedValue(null);

    const req = createMockReq();
    const res = createMockRes();
    await healthHandler(req, res);

    expect(res.statusCode).toBe(503);
    const body: HealthCheckResult = res.body;
    expect(body.status).toBe("unhealthy");
    expect(body.checks.database.status).toBe("down");
  });

  it("should return 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetIn: 45_000,
    });

    const req = createMockReq();
    const res = createMockRes();
    await healthHandler(req, res);

    expect(res.statusCode).toBe(429);
    expect(res.body.error).toBe("Too many health check requests");
    expect(res.body.retryAfterMs).toBe(45_000);
  });

  it("should include uptime as a positive number", async () => {
    mockGetDb.mockResolvedValue({
      execute: vi.fn().mockResolvedValue([{ 1: 1 }]),
    } as any);

    const req = createMockReq();
    const res = createMockRes();
    await healthHandler(req, res);

    expect(typeof res.body.uptime).toBe("number");
    expect(res.body.uptime).toBeGreaterThan(0);
  });

  it("should include ISO timestamp", async () => {
    mockGetDb.mockResolvedValue({
      execute: vi.fn().mockResolvedValue([{ 1: 1 }]),
    } as any);

    const req = createMockReq();
    const res = createMockRes();
    await healthHandler(req, res);

    // Verify it's a valid ISO date
    const parsed = new Date(res.body.timestamp);
    expect(parsed.toISOString()).toBe(res.body.timestamp);
  });

  it("should include DB latency in the response", async () => {
    mockGetDb.mockResolvedValue({
      execute: vi.fn().mockResolvedValue([{ 1: 1 }]),
    } as any);

    const req = createMockReq();
    const res = createMockRes();
    await healthHandler(req, res);

    expect(typeof res.body.checks.database.latencyMs).toBe("number");
    expect(res.body.checks.database.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("should call checkRateLimit with correct config prefix", async () => {
    mockGetDb.mockResolvedValue({
      execute: vi.fn().mockResolvedValue([{ 1: 1 }]),
    } as any);

    const req = createMockReq();
    const res = createMockRes();
    await healthHandler(req, res);

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      "127.0.0.1",
      expect.objectContaining({ keyPrefix: "health" })
    );
  });
});
