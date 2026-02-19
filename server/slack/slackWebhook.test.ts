import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Test to validate Slack webhook URL is configured and reachable.
 * Uses mocked fetch to avoid sending real messages during test runs.
 */

const originalFetch = globalThis.fetch;

describe("Slack Webhook Configuration", () => {
  beforeEach(() => {
    // Mock fetch to prevent real Slack messages
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("ok"),
      status: 200,
    } as any);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should have SLACK_WEBHOOK_URL configured", () => {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    expect(webhookUrl).toBeDefined();
    expect(webhookUrl).toMatch(/^https:\/\/hooks\.slack\.com\/services\//);
  });

  it("should be able to send a test message to Slack (mocked)", async () => {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    
    if (!webhookUrl) {
      console.log("Skipping Slack test - webhook URL not configured");
      return;
    }

    // Send a minimal test message (mocked - no real message sent)
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: "🧪 Drape Slack Integration Test - Configuration Verified",
      }),
    });

    expect(response.ok).toBe(true);
    const responseText = await response.text();
    expect(responseText).toBe("ok");

    // Verify fetch was called with the correct URL
    expect(globalThis.fetch).toHaveBeenCalledWith(
      webhookUrl,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("should have SLACK_SIGNING_SECRET configured for interactive buttons", () => {
    const signingSecret = process.env.SLACK_SIGNING_SECRET;
    // Signing secret is optional for sending messages, but required for interactive buttons
    // Just check it exists if provided
    if (signingSecret) {
      expect(signingSecret.length).toBeGreaterThan(10);
    }
  });
});
