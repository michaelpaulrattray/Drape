/**
 * Validates that the RESEND_API_KEY is configured and can connect to the Resend API.
 */
import { describe, it, expect } from "vitest";
import { Resend } from "resend";

describe("Resend API Key Validation", () => {
  it("RESEND_API_KEY is set in environment", () => {
    const apiKey = process.env.RESEND_API_KEY;
    expect(apiKey).toBeTruthy();
    expect(typeof apiKey).toBe("string");
    expect(apiKey!.startsWith("re_")).toBe(true);
  });

  it("API key is valid and has send permissions", async () => {
    const resend = new Resend(process.env.RESEND_API_KEY);
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
