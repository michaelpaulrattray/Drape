/**
 * Tests for the Correlation ID middleware.
 *
 * Verifies:
 *  - Auto-generation of correlation IDs when no header is present
 *  - Propagation of valid incoming X-Request-ID headers
 *  - Rejection of invalid/malicious correlation IDs
 *  - Response header echoing
 *  - Helper extraction function
 */
import { describe, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { correlationIdMiddleware, getCorrelationId } from "./correlationId";

function createMockReq(headers: Record<string, string> = {}): Request {
  return {
    headers: Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
    ),
  } as unknown as Request;
}

function createMockRes(): Response {
  return {
    setHeader: vi.fn(),
  } as unknown as Response;
}

describe("correlationIdMiddleware", () => {
  it("generates a correlation ID when no header is provided", () => {
    const req = createMockReq();
    const res = createMockRes();
    const next: NextFunction = vi.fn();

    correlationIdMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    const cid = (req as any).correlationId;
    expect(cid).toBeDefined();
    expect(cid).toMatch(/^req_[0-9a-f]{12}$/);
    expect(res.setHeader).toHaveBeenCalledWith("X-Request-ID", cid);
  });

  it("propagates a valid incoming X-Request-ID header", () => {
    const req = createMockReq({ "X-Request-ID": "upstream-trace-abc123" });
    const res = createMockRes();
    const next: NextFunction = vi.fn();

    correlationIdMiddleware(req, res, next);

    expect((req as any).correlationId).toBe("upstream-trace-abc123");
    expect(res.setHeader).toHaveBeenCalledWith("X-Request-ID", "upstream-trace-abc123");
    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects an invalid correlation ID and generates a new one", () => {
    const req = createMockReq({ "X-Request-ID": "<script>alert('xss')</script>" });
    const res = createMockRes();
    const next: NextFunction = vi.fn();

    correlationIdMiddleware(req, res, next);

    const cid = (req as any).correlationId;
    expect(cid).toMatch(/^req_[0-9a-f]{12}$/);
    expect(cid).not.toContain("<script>");
    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects an overly long correlation ID (>64 chars)", () => {
    const longId = "a".repeat(100);
    const req = createMockReq({ "X-Request-ID": longId });
    const res = createMockRes();
    const next: NextFunction = vi.fn();

    correlationIdMiddleware(req, res, next);

    const cid = (req as any).correlationId;
    expect(cid).toMatch(/^req_[0-9a-f]{12}$/);
    expect(next).toHaveBeenCalledOnce();
  });

  it("accepts correlation IDs with dashes and underscores", () => {
    const req = createMockReq({ "X-Request-ID": "trace_abc-123_def" });
    const res = createMockRes();
    const next: NextFunction = vi.fn();

    correlationIdMiddleware(req, res, next);

    expect((req as any).correlationId).toBe("trace_abc-123_def");
    expect(next).toHaveBeenCalledOnce();
  });

  it("generates unique IDs across multiple requests", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const req = createMockReq();
      const res = createMockRes();
      const next: NextFunction = vi.fn();
      correlationIdMiddleware(req, res, next);
      ids.add((req as any).correlationId);
    }
    // All 100 should be unique
    expect(ids.size).toBe(100);
  });
});

describe("getCorrelationId", () => {
  it("returns the correlation ID from the request", () => {
    const req = createMockReq();
    (req as any).correlationId = "req_test123456ab";
    expect(getCorrelationId(req)).toBe("req_test123456ab");
  });

  it("returns 'unknown' when no correlation ID is set", () => {
    const req = createMockReq();
    expect(getCorrelationId(req)).toBe("unknown");
  });
});
