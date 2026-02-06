import { describe, it, expect, vi } from "vitest";
import { securityHeaders } from "./securityHeaders";
import type { Request, Response, NextFunction } from "express";

function createMockRes(): Response {
  const headers: Record<string, string> = {};
  return {
    setHeader: vi.fn((key: string, value: string) => {
      headers[key] = value;
    }),
    _headers: headers,
  } as unknown as Response;
}

function createMockReq(path = "/"): Request {
  return { path } as unknown as Request;
}

describe("Security Headers Middleware", () => {
  it("should call next() to continue the middleware chain", () => {
    const req = createMockReq();
    const res = createMockRes();
    const next: NextFunction = vi.fn();

    securityHeaders(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("should set Strict-Transport-Security header", () => {
    const req = createMockReq();
    const res = createMockRes();
    const next: NextFunction = vi.fn();

    securityHeaders(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  });

  it("should set Content-Security-Policy header with required directives", () => {
    const req = createMockReq();
    const res = createMockRes();
    const next: NextFunction = vi.fn();

    securityHeaders(req, res, next);

    const cspCall = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: string[]) => call[0] === "Content-Security-Policy"
    );
    expect(cspCall).toBeDefined();

    const csp = cspCall![1] as string;

    // Verify essential directives are present
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' https://js.stripe.com");
    expect(csp).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
    expect(csp).toContain("font-src 'self' https://fonts.gstatic.com");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("should allow S3/CDN images in CSP", () => {
    const req = createMockReq();
    const res = createMockRes();
    const next: NextFunction = vi.fn();

    securityHeaders(req, res, next);

    const cspCall = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: string[]) => call[0] === "Content-Security-Policy"
    );
    const csp = cspCall![1] as string;

    expect(csp).toContain("https://*.amazonaws.com");
    expect(csp).toContain("https://*.manus.storage");
  });

  it("should allow Stripe in CSP script-src, connect-src, and frame-src", () => {
    const req = createMockReq();
    const res = createMockRes();
    const next: NextFunction = vi.fn();

    securityHeaders(req, res, next);

    const cspCall = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: string[]) => call[0] === "Content-Security-Policy"
    );
    const csp = cspCall![1] as string;

    expect(csp).toContain("script-src 'self' https://js.stripe.com");
    expect(csp).toContain("https://api.stripe.com");
    expect(csp).toContain("frame-src 'self' https://js.stripe.com https://hooks.stripe.com");
  });

  it("should set X-Frame-Options to DENY", () => {
    const req = createMockReq();
    const res = createMockRes();
    const next: NextFunction = vi.fn();

    securityHeaders(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith("X-Frame-Options", "DENY");
  });

  it("should set X-Content-Type-Options to nosniff", () => {
    const req = createMockReq();
    const res = createMockRes();
    const next: NextFunction = vi.fn();

    securityHeaders(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
  });

  it("should set Referrer-Policy to strict-origin-when-cross-origin", () => {
    const req = createMockReq();
    const res = createMockRes();
    const next: NextFunction = vi.fn();

    securityHeaders(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      "Referrer-Policy",
      "strict-origin-when-cross-origin"
    );
  });

  it("should set exactly 5 security headers", () => {
    const req = createMockReq();
    const res = createMockRes();
    const next: NextFunction = vi.fn();

    securityHeaders(req, res, next);

    expect(res.setHeader).toHaveBeenCalledTimes(5);
  });
});
