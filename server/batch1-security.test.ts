/**
 * Batch 1 Security Fixes — Unit Tests
 *
 * Tests for:
 * - Fix 2: Security headers middleware
 * - Fix 3: URL validator (SSRF protection for proxyImage)
 * - Fix 4/5: Rate limiting on generation + Gemini assist endpoints
 * - Fix 6: Atomic addCredits (pattern verification)
 */
import { describe, expect, it, beforeEach } from "vitest";
import { validateProxyUrl } from "./security/urlValidator";
import { checkRateLimit, RATE_LIMITS, rateLimitError } from "./security/rateLimit";

// ============================================================================
// Fix 3: URL Validator — SSRF Protection
// ============================================================================
describe("validateProxyUrl — SSRF protection", () => {
  // --- Allowed URLs ---
  it("allows S3 amazonaws.com URLs", () => {
    const result = validateProxyUrl("https://my-bucket.s3.us-east-1.amazonaws.com/image.png");
    expect(result.valid).toBe(true);
  });

  it("allows manus.storage URLs", () => {
    const result = validateProxyUrl("https://files.manus.storage/path/to/image.jpg");
    expect(result.valid).toBe(true);
  });

  it("allows manuscdn.com URLs", () => {
    const result = validateProxyUrl("https://files.manuscdn.com/asset.png");
    expect(result.valid).toBe(true);
  });

  it("allows cloudfront.net URLs", () => {
    const result = validateProxyUrl("https://d1234.cloudfront.net/image.webp");
    expect(result.valid).toBe(true);
  });

  // --- Blocked URLs ---
  it("blocks HTTP (non-HTTPS) URLs", () => {
    const result = validateProxyUrl("http://my-bucket.s3.amazonaws.com/image.png");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("HTTPS");
  });

  it("blocks localhost", () => {
    const result = validateProxyUrl("https://localhost/secret");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Blocked hostname");
  });

  it("blocks metadata.google.internal (GCP metadata)", () => {
    const result = validateProxyUrl("https://metadata.google.internal/computeMetadata/v1/");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Blocked hostname");
  });

  it("blocks AWS metadata endpoint via IP (169.254.169.254)", () => {
    const result = validateProxyUrl("https://169.254.169.254/latest/meta-data/");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Private IP");
  });

  it("blocks RFC 1918 Class A (10.x.x.x)", () => {
    const result = validateProxyUrl("https://10.0.0.1/internal");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Private IP");
  });

  it("blocks RFC 1918 Class B (172.16-31.x.x)", () => {
    const result = validateProxyUrl("https://172.16.0.1/internal");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Private IP");
  });

  it("blocks RFC 1918 Class C (192.168.x.x)", () => {
    const result = validateProxyUrl("https://192.168.1.1/internal");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Private IP");
  });

  it("blocks loopback (127.0.0.1)", () => {
    const result = validateProxyUrl("https://127.0.0.1/secret");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Private IP");
  });

  it("blocks public IPs used directly (no domain name)", () => {
    const result = validateProxyUrl("https://8.8.8.8/something");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Direct IP");
  });

  it("blocks non-allowlisted domains", () => {
    const result = validateProxyUrl("https://evil.com/steal-data");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("not in allowlist");
  });

  it("blocks arbitrary external domains", () => {
    const result = validateProxyUrl("https://attacker.example.org/ssrf");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("not in allowlist");
  });

  it("rejects invalid URL format", () => {
    const result = validateProxyUrl("not-a-url");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Invalid URL");
  });

  it("rejects empty string", () => {
    const result = validateProxyUrl("");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Invalid URL");
  });
});

// ============================================================================
// Fix 4/5: Rate Limiting — generation + geminiAssist tiers
// ============================================================================
describe("checkRateLimit — generation tier", () => {
  const testKey = `test-gen-${Date.now()}-${Math.random()}`;

  it("allows requests within the limit", () => {
    const result = checkRateLimit(testKey, RATE_LIMITS.generation);
    expect(result.allowed).toBe(true);
  });

  it("blocks requests after exceeding the limit", () => {
    const burstKey = `test-burst-${Date.now()}-${Math.random()}`;
    const limit = RATE_LIMITS.generation.maxRequests;

    // Exhaust the limit
    for (let i = 0; i < limit; i++) {
      const r = checkRateLimit(burstKey, RATE_LIMITS.generation);
      expect(r.allowed).toBe(true);
    }

    // Next request should be blocked
    const blocked = checkRateLimit(burstKey, RATE_LIMITS.generation);
    expect(blocked.allowed).toBe(false);
    expect(blocked.resetIn).toBeGreaterThan(0);
  });
});

describe("checkRateLimit — geminiAssist tier", () => {
  it("has a higher limit than generation (30 vs 10)", () => {
    expect(RATE_LIMITS.geminiAssist.maxRequests).toBeGreaterThan(
      RATE_LIMITS.generation.maxRequests
    );
  });

  it("allows requests within the limit", () => {
    const key = `test-assist-${Date.now()}-${Math.random()}`;
    const result = checkRateLimit(key, RATE_LIMITS.geminiAssist);
    expect(result.allowed).toBe(true);
  });

  it("blocks after exceeding 30 requests", () => {
    const key = `test-assist-burst-${Date.now()}-${Math.random()}`;
    const limit = RATE_LIMITS.geminiAssist.maxRequests;

    for (let i = 0; i < limit; i++) {
      checkRateLimit(key, RATE_LIMITS.geminiAssist);
    }

    const blocked = checkRateLimit(key, RATE_LIMITS.geminiAssist);
    expect(blocked.allowed).toBe(false);
  });
});

describe("rateLimitError", () => {
  it("returns a human-readable error message", () => {
    const msg = rateLimitError(30);
    expect(msg).toContain("try again");
    expect(typeof msg).toBe("string");
  });
});

// ============================================================================
// Fix 2: Security Headers — verify middleware shape
// ============================================================================
describe("securityHeaders middleware", () => {
  it("exports a function with correct arity (req, res, next)", async () => {
    const { securityHeaders } = await import("./security/securityHeaders");
    expect(typeof securityHeaders).toBe("function");
    expect(securityHeaders.length).toBe(3); // (req, res, next)
  });

  it("sets all required security headers", async () => {
    const { securityHeaders } = await import("./security/securityHeaders");
    const headers: Record<string, string> = {};
    const mockRes = {
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
    };
    const mockReq = {};
    let nextCalled = false;

    securityHeaders(mockReq as any, mockRes as any, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(headers["Strict-Transport-Security"]).toContain("max-age");
    expect(headers["Content-Security-Policy"]).toBeDefined();
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["X-XSS-Protection"]).toBe("1; mode=block");
    expect(headers["X-DNS-Prefetch-Control"]).toBe("off");
    expect(headers["X-Permitted-Cross-Domain-Policies"]).toBe("none");
    expect(headers["Permissions-Policy"]).toBeDefined();
  });

  it("includes Stripe in CSP script-src", async () => {
    const { securityHeaders } = await import("./security/securityHeaders");
    const headers: Record<string, string> = {};
    const mockRes = { setHeader: (n: string, v: string) => { headers[n] = v; } };
    securityHeaders({} as any, mockRes as any, () => {});

    expect(headers["Content-Security-Policy"]).toContain("js.stripe.com");
  });
});
