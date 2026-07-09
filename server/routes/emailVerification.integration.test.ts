/**
 * Email Verification Integration Tests — require a running server.
 *
 * Start the app first (`pnpm dev`), then run `pnpm test:integration`.
 * Target defaults to http://localhost:3000; override with VITE_API_URL.
 *
 * Covers:
 * - POST /api/auth/resend-verification (validation, enumeration safety)
 * - GET /api/auth/verify-email (token handling)
 * - POST /api/auth/register and /api/auth/login response shapes
 */
import { describe, it, expect, beforeAll } from "vitest";

const BASE = process.env.VITE_API_URL || "http://localhost:3000";

/** Unique forwarded IP per request to avoid rate-limit collisions between tests */
function uniqueIp(): string {
  return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

beforeAll(async () => {
  try {
    await fetch(`${BASE}/api/health`);
  } catch {
    throw new Error(
      `No server reachable at ${BASE} — start it with \`pnpm dev\` before running integration tests.`
    );
  }
});

describe("POST /api/auth/resend-verification", () => {
  it("rejects invalid email format", async () => {
    const res = await fetch(`${BASE}/api/auth/resend-verification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": uniqueIp(),
      },
      body: JSON.stringify({ email: "not-an-email" }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("rejects missing email", async () => {
    const res = await fetch(`${BASE}/api/auth/resend-verification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": uniqueIp(),
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("returns success for non-existent email (no enumeration)", async () => {
    const res = await fetch(`${BASE}/api/auth/resend-verification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": uniqueIp(),
      },
      body: JSON.stringify({ email: "nonexistent-test-xyz@example.com" }),
    });
    // Should return 200 with generic message to prevent email enumeration
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});

describe("GET /api/auth/verify-email", () => {
  it("redirects to login with error for missing token", async () => {
    const res = await fetch(`${BASE}/api/auth/verify-email`, {
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    const location = res.headers.get("location") || "";
    expect(location).toContain("/login?error=invalid_token");
  });

  it("redirects to login with error for empty token", async () => {
    const res = await fetch(`${BASE}/api/auth/verify-email?token=`, {
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    const location = res.headers.get("location") || "";
    expect(location).toContain("/login?error=invalid_token");
  });

  it("redirects to login with error for invalid token", async () => {
    const res = await fetch(
      `${BASE}/api/auth/verify-email?token=invalid_token_abc123`,
      { redirect: "manual" }
    );
    expect(res.status).toBe(302);
    const location = res.headers.get("location") || "";
    expect(location).toContain("/login?error=invalid_token");
  });
});

describe("POST /api/auth/register (email verification integration)", () => {
  it("returns error response format for invalid beta code", async () => {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "TestPass123",
        name: "Test User",
        betaCode: "INVALID-CODE",
      }),
    });
    // Should fail with invalid code, but the response format is what we're checking
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});

describe("POST /api/auth/login (email verification enforcement)", () => {
  it("returns generic error for non-existent user", async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "nonexistent-verification-test@example.com",
        password: "SomePass123",
      }),
    });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Invalid email or password");
  });
});
