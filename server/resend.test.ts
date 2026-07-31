/**
 * Validates that a Resend key is configured and can connect to the Resend API.
 *
 * **Live-credential suite — opt in with `TEST_RESEND_API_KEY`.** It no longer
 * reads `RESEND_API_KEY`, because `vitest.setup.ts` neutralizes that one: this
 * suite attempts a real send on every run, and a default `pnpm test` must
 * never reach a provider on the founder's account. Set the test-scoped
 * variable when you actually mean to check the credential.
 */
import { describe, it, expect } from "vitest";
import { Resend } from "resend";

const apiKey = process.env.TEST_RESEND_API_KEY;

if (!apiKey) {
  console.log("[resend.test] skipped — set TEST_RESEND_API_KEY to check the live credential");
}

describe.skipIf(!apiKey)("Resend API Key Validation", () => {
  it("the key is well formed", () => {
    expect(typeof apiKey).toBe("string");
    expect(apiKey!.startsWith("re_")).toBe(true);
  });

  it("API key is valid and has send permissions", async () => {
    const resend = new Resend(apiKey);
    // The key is restricted to sending only — verify by attempting a send
    // with an invalid "from" address. A valid key returns a validation error,
    // an invalid key returns a 401/403 auth error.
    const { error } = await resend.emails.send({
      from: "test@resend.dev",
      to: "test@example.com",
      subject: "API key validation test",
      text: "This is a test",
    });
    // With the free tier (no verified domain), we expect a validation error
    // about the sender domain — NOT an auth error. This proves the key is valid.
    if (error) {
      // Auth errors mean invalid key
      expect(error.name).not.toBe("restricted_api_key");
      expect(error.name).not.toBe("missing_api_key");
      expect(error.name).not.toBe("invalid_api_key");
    }
    // If no error, the email was actually sent (unlikely in test but fine)
  });
});
