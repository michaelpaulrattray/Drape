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
    // In dev mode, script-src includes 'unsafe-inline' 'unsafe-eval' for Vite HMR
    expect(csp).toContain("https://js.stripe.com");
    expect(csp).toMatch(/script-src 'self'/);
    expect(csp).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
    expect(csp).toContain("font-src 'self' https://fonts.gstatic.com");
    expect(csp).toContain("object-src 'none'");
    // In dev mode, frame-ancestors allows all for preview iframe; in prod it's 'none'
    expect(csp).toMatch(/frame-ancestors/);
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
    // Legacy manuscdn stays until final storage cutover; manus.storage is gone
    expect(csp).toContain("https://files.manuscdn.com");
    expect(csp).not.toContain("manus.storage");
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

    // In dev mode, script-src includes 'unsafe-inline' 'unsafe-eval' for Vite HMR
    expect(csp).toMatch(/script-src 'self'.*https:\/\/js\.stripe\.com/);
    expect(csp).toContain("https://api.stripe.com");
    expect(csp).toContain("frame-src 'self' https://js.stripe.com https://hooks.stripe.com");
  });

  it("should set X-Frame-Options to DENY in production", () => {
    const req = createMockReq();
    const res = createMockRes();
    const next: NextFunction = vi.fn();

    securityHeaders(req, res, next);

    // In dev mode, X-Frame-Options is skipped to allow Manus preview iframe
    if (process.env.NODE_ENV === "development") {
      expect(res.setHeader).not.toHaveBeenCalledWith("X-Frame-Options", "DENY");
    } else {
      expect(res.setHeader).toHaveBeenCalledWith("X-Frame-Options", "DENY");
    }
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

  it("should set the correct number of security headers", () => {
    const req = createMockReq();
    const res = createMockRes();
    const next: NextFunction = vi.fn();

    securityHeaders(req, res, next);

    // Headers: HSTS, CSP, X-Frame-Options, X-Content-Type-Options,
    //          Referrer-Policy, X-XSS-Protection, X-DNS-Prefetch-Control,
    //          X-Permitted-Cross-Domain-Policies, Permissions-Policy
    // In dev mode (NODE_ENV=development): X-Frame-Options is skipped → 8 headers
    // In test/production: all 9 headers set
    // Vitest runs with NODE_ENV=test, so X-Frame-Options IS set
    const isDev = process.env.NODE_ENV === "development";
    const expectedCount = isDev ? 8 : 9;
    expect(res.setHeader).toHaveBeenCalledTimes(expectedCount);
  });
});
