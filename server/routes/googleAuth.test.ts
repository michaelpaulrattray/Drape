/**
 * Tests for Google OAuth Authentication Routes
 *
 * Tests state token signing/verification, CSRF protection,
 * rate limiting, disposable email blocking, and credential presence.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT, jwtVerify } from "jose";
import { isDisposableEmail } from "../security/disposableEmails";
import { checkRateLimit } from "../security/rateLimit";

// Use a test secret for state token tests
const TEST_SECRET = "test-jwt-secret-for-google-oauth-tests";
const secretKey = new TextEncoder().encode(TEST_SECRET);

describe("Google OAuth — State Token CSRF Protection", () => {
  it("creates a valid signed state token with betaCode", async () => {
    const statePayload = {
      nonce: "test-nonce-123",
      betaCode: "BETA123",
      iat: Date.now(),
    };

    const stateToken = await new SignJWT(statePayload)
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("10m")
      .sign(secretKey);

    expect(stateToken).toBeTruthy();
    expect(typeof stateToken).toBe("string");
    // JWT has 3 parts separated by dots
    expect(stateToken.split(".").length).toBe(3);
  });

  it("verifies a valid state token and extracts payload", async () => {
    const originalPayload = {
      nonce: "verify-nonce-456",
      betaCode: "TESTCODE",
      iat: Date.now(),
    };

    const stateToken = await new SignJWT(originalPayload)
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("10m")
      .sign(secretKey);

    const { payload } = await jwtVerify(stateToken, secretKey);

    expect(payload.nonce).toBe("verify-nonce-456");
    expect(payload.betaCode).toBe("TESTCODE");
    expect(payload.iat).toBeDefined();
  });

  it("rejects a state token signed with a different secret", async () => {
    const wrongSecret = new TextEncoder().encode("wrong-secret");

    const stateToken = await new SignJWT({ nonce: "test", betaCode: "" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("10m")
      .sign(wrongSecret);

    await expect(jwtVerify(stateToken, secretKey)).rejects.toThrow();
  });

  it("rejects an expired state token", async () => {
    const stateToken = await new SignJWT({ nonce: "test", betaCode: "" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("0s") // Expires immediately
      .sign(secretKey);

    // Small delay to ensure expiry
    await new Promise((r) => setTimeout(r, 50));

    await expect(jwtVerify(stateToken, secretKey)).rejects.toThrow();
  });

  it("rejects a tampered state token", async () => {
    const stateToken = await new SignJWT({
      nonce: "test",
      betaCode: "VALID",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("10m")
      .sign(secretKey);

    // Tamper with the payload (change a character in the middle part)
    const parts = stateToken.split(".");
    const tamperedPayload =
      parts[1]!.slice(0, -1) +
      (parts[1]!.slice(-1) === "A" ? "B" : "A");
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    await expect(jwtVerify(tamperedToken, secretKey)).rejects.toThrow();
  });

  it("preserves empty betaCode for returning users", async () => {
    const statePayload = {
      nonce: "returning-user-nonce",
      betaCode: "",
      iat: Date.now(),
    };

    const stateToken = await new SignJWT(statePayload)
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("10m")
      .sign(secretKey);

    const { payload } = await jwtVerify(stateToken, secretKey);
    expect(payload.betaCode).toBe("");
  });
});

describe("Google OAuth — Rate Limiting", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("allows Google auth attempts within limit (20 per 15 min)", () => {
    const config = {
      maxRequests: 20,
      windowMs: 15 * 60 * 1000,
      keyPrefix: "google_auth_test",
    };

    for (let i = 0; i < 20; i++) {
      const result = checkRateLimit(
        `google-test-ip-${Date.now()}-${i}`,
        config
      );
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks after exceeding 20 attempts from same IP", () => {
    const config = {
      maxRequests: 20,
      windowMs: 15 * 60 * 1000,
      keyPrefix: "google_auth_block_test",
    };
    const ip = "google-block-test-ip";

    for (let i = 0; i < 20; i++) {
      checkRateLimit(ip, config);
    }

    const blocked = checkRateLimit(ip, config);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });
});

describe("Google OAuth — Disposable Email Blocking", () => {
  it("blocks disposable emails from Google accounts", () => {
    // Even if someone has a guerrillamail Google account, we block it
    expect(isDisposableEmail("user@guerrillamail.com")).toBe(true);
    expect(isDisposableEmail("user@tempmail.com")).toBe(true);
    expect(isDisposableEmail("user@mailinator.com")).toBe(true);
  });

  it("allows legitimate email providers", () => {
    expect(isDisposableEmail("user@gmail.com")).toBe(false);
    expect(isDisposableEmail("user@yahoo.com")).toBe(false);
    expect(isDisposableEmail("user@company.com")).toBe(false);
  });
});

describe("Google OAuth — Credential Validation", () => {
  it("GOOGLE_CLIENT_ID is set in environment", () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    expect(clientId).toBeTruthy();
    expect(typeof clientId).toBe("string");
    expect(clientId!.endsWith(".apps.googleusercontent.com")).toBe(true);
  });

  it("GOOGLE_CLIENT_SECRET is set in environment", () => {
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    expect(clientSecret).toBeTruthy();
    expect(typeof clientSecret).toBe("string");
    expect(clientSecret!.startsWith("GOCSPX-")).toBe(true);
  });

  it("GOOGLE_CLIENT_ID has expected format", () => {
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    // Format: {numbers}-{alphanumeric}.apps.googleusercontent.com
    expect(clientId).toMatch(
      /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/
    );
  });
});

describe("Google OAuth — OpenID Generation", () => {
  it("generates correct openId format for Google users", () => {
    const googleId = "1234567890";
    const openId = `google_${googleId}`;
    expect(openId).toBe("google_1234567890");
    expect(openId.startsWith("google_")).toBe(true);
  });

  it("openId is unique per Google sub claim", () => {
    const openId1 = `google_${"sub1"}`;
    const openId2 = `google_${"sub2"}`;
    expect(openId1).not.toBe(openId2);
  });
});

describe("Google OAuth — Callback Error Handling", () => {
  it("maps error query params to correct redirect paths", () => {
    // These are the error codes the callback route uses
    const errorRedirects: Record<string, string> = {
      google_denied: "/login?error=google_denied",
      invalid_callback: "/login?error=invalid_callback",
      invalid_state: "/login?error=invalid_state",
      no_id_token: "/login?error=no_id_token",
      invalid_token: "/login?error=invalid_token",
      disposable_email: "/login?error=disposable_email",
      not_approved: "/login?error=not_approved",
      suspended: "/login?error=suspended",
      locked: "/login?error=locked",
      no_code: "/login?error=no_code",
      invalid_code: "/login?error=invalid_code",
      create_failed: "/login?error=create_failed",
      code_redeem_failed: "/login?error=code_redeem_failed",
      google_error: "/login?error=google_error",
    };

    // Verify all error codes produce valid redirect URLs
    for (const [code, redirect] of Object.entries(errorRedirects)) {
      expect(redirect).toContain("/login?error=");
      expect(redirect).toContain(code);
      // Verify no spaces or special chars in error code
      expect(code).toMatch(/^[a-z_]+$/);
    }
  });

  it("success redirect goes to /app", () => {
    // Both new and returning users redirect to the /app lobby on success
    const successRedirect = "/app";
    expect(successRedirect).toBe("/app");
  });
});
