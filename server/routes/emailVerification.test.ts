/**
 * Email Verification Unit Tests
 *
 * Token generation only. The HTTP tests that require a running server live
 * in emailVerification.integration.test.ts (run with `pnpm test:integration`).
 */
import { describe, it, expect, vi } from "vitest";

/* The link is signed with JWT_SECRET (#2401); plant a stand-in only where the
   real one is absent (CI), before the module graph loads. */
vi.hoisted(() => {
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = "drape-test-link-secret-not-a-real-credential";
});

import { allowColdImports } from "../testing/suiteClocks";

/* This file's tests are dominated by cold module loading, not by logic —
   see `suiteClocks.ts` for the flake this ends and why the raise is
   here rather than global (fable-233 §5). */
allowColdImports();

describe("generateVerificationToken", () => {
  it("generates a signed link naming its account, within the column's 128 characters (#2401)", async () => {
    const { generateVerificationToken } = await import("./emailVerification");
    const token = generateVerificationToken(42);
    expect(token.length).toBeLessThanOrEqual(128);
    expect(/^42\.[0-9a-f]{64}\.[0-9a-f]{32}$/.test(token)).toBe(true);
  });

  it("generates unique tokens", async () => {
    const { generateVerificationToken } = await import("./emailVerification");
    const tokens = new Set(Array.from({ length: 10 }, () => generateVerificationToken(42)));
    expect(tokens.size).toBe(10);
  });
});
