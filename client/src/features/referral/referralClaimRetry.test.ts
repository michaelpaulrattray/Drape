/**
 * #1016 — a failed automatic claim keeps the referral code for the next login
 * unless the code can never succeed. The classifier is driven directly (law
 * 3): a hook test through a mocked mutation would only prove the mock.
 *
 * The un-varied direction sits beside each arm: the ONE code that drops is
 * asserted as dropping, and the hook is held to calling this classifier at
 * the bytes, so a hook that goes back to clearing on every error fails here
 * rather than in a friend's browser.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { keepsReferralCodeAfterError } from "./referralClaimRetry";

const trpcError = (code: string) => ({ message: code, data: { code } });

describe("keepsReferralCodeAfterError (#1016)", () => {
  it("keeps the code on a network failure — no tRPC code at all", () => {
    expect(keepsReferralCodeAfterError(new TypeError("Failed to fetch"))).toBe(true);
    expect(keepsReferralCodeAfterError(undefined)).toBe(true);
    expect(keepsReferralCodeAfterError(null)).toBe(true);
    expect(keepsReferralCodeAfterError({ data: {} })).toBe(true);
  });

  it.each(["INTERNAL_SERVER_ERROR", "TIMEOUT", "TOO_MANY_REQUESTS", "FORBIDDEN", "UNAUTHORIZED"])(
    "keeps the code on %s — the next login may succeed",
    (code) => {
      expect(keepsReferralCodeAfterError(trpcError(code))).toBe(true);
    },
  );

  it("keeps the code on a code it does not know — it fails toward keeping", () => {
    expect(keepsReferralCodeAfterError(trpcError("SOMETHING_NEW"))).toBe(true);
  });

  it("⚠ DROPS the code on BAD_REQUEST — the schema refused its shape and always will", () => {
    expect(keepsReferralCodeAfterError(trpcError("BAD_REQUEST"))).toBe(false);
  });
});

describe("the hook consults it (#1016)", () => {
  const HOOK = path.join(process.cwd(), "client", "src", "features", "referral", "useReferralClaim.ts");
  const source = readFileSync(HOOK, "utf8");

  it("onError asks the classifier before clearing the key", () => {
    const onError = source.slice(source.indexOf("onError:"));
    expect(onError).toContain("keepsReferralCodeAfterError(error)");
    expect(onError).toContain("localStorage.removeItem(REFERRAL_STORAGE_KEY)");
  });

  it("and the unconditional clear is gone — the defect's own shape", () => {
    expect(source).not.toMatch(/onError:\s*\(\)\s*=>\s*\{\s*(\/\/[^\n]*\n\s*)*localStorage\.removeItem/);
  });
});
