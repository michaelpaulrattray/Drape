import { describe, it, expect } from "vitest";

/**
 * Test to validate Slack webhook URL is configured and reachable
 */
describe("Slack Webhook Configuration", () => {
  it("should have SLACK_WEBHOOK_URL configured", () => {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    expect(webhookUrl).toBeDefined();
    expect(webhookUrl).toMatch(/^https:\/\/hooks\.slack\.com\/services\//);
  });

  it("should be able to send a test message to Slack", async () => {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    
    if (!webhookUrl) {
      console.log("Skipping Slack test - webhook URL not configured");
      return;
    }

    // Send a minimal test message
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: "🧪 FormaStudio Slack Integration Test - Configuration Verified",
      }),
    });

    // Slack returns "ok" as text on success
    expect(response.ok).toBe(true);
    const responseText = await response.text();
    expect(responseText).toBe("ok");
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
