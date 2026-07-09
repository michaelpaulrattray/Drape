/**
 * Email Verification Unit Tests
 *
 * Token generation only. The HTTP tests that require a running server live
 * in emailVerification.integration.test.ts (run with `pnpm test:integration`).
 */
import { describe, it, expect } from "vitest";

describe("generateVerificationToken", () => {
  it("generates a 96-character hex string", async () => {
    const { generateVerificationToken } = await import("./emailVerification");
    const token = generateVerificationToken();
    expect(token).toHaveLength(96);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  it("generates unique tokens", async () => {
    const { generateVerificationToken } = await import("./emailVerification");
    const tokens = new Set(Array.from({ length: 10 }, () => generateVerificationToken()));
    expect(tokens.size).toBe(10);
  });
});
