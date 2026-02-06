import { describe, it, expect } from "vitest";

describe("Slack Channel Webhook Configuration", () => {
  it("should have SLACK_ADMIN_ACTIONS_WEBHOOK_URL configured", () => {
    const url = process.env.SLACK_ADMIN_ACTIONS_WEBHOOK_URL;
    expect(url).toBeDefined();
    expect(url).toMatch(/^https:\/\/hooks\.slack\.com\/services\//);
  });

  it("should have SLACK_AUDIT_LOG_WEBHOOK_URL configured", () => {
    const url = process.env.SLACK_AUDIT_LOG_WEBHOOK_URL;
    expect(url).toBeDefined();
    expect(url).toMatch(/^https:\/\/hooks\.slack\.com\/services\//);
  });

  it("should have SLACK_WEBHOOK_URL configured for security alerts", () => {
    const url = process.env.SLACK_WEBHOOK_URL;
    expect(url).toBeDefined();
    expect(url).toMatch(/^https:\/\/hooks\.slack\.com\/services\//);
  });

  it("should have three distinct webhook URLs", () => {
    const securityUrl = process.env.SLACK_WEBHOOK_URL;
    const adminUrl = process.env.SLACK_ADMIN_ACTIONS_WEBHOOK_URL;
    const auditUrl = process.env.SLACK_AUDIT_LOG_WEBHOOK_URL;
    
    // All three should be different channels
    expect(adminUrl).not.toBe(securityUrl);
    expect(auditUrl).not.toBe(securityUrl);
    expect(auditUrl).not.toBe(adminUrl);
  });

  it("should be able to send a test message to admin-actions channel", async () => {
    const url = process.env.SLACK_ADMIN_ACTIONS_WEBHOOK_URL;
    if (!url) return;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "🔧 Channel verification: #admin-actions webhook connected to FormaStudio",
      }),
    });

    expect(response.ok).toBe(true);
  }, 10000);

  it("should be able to send a test message to audit-log channel", async () => {
    const url = process.env.SLACK_AUDIT_LOG_WEBHOOK_URL;
    if (!url) return;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "📋 Channel verification: #audit-log webhook connected to FormaStudio",
      }),
    });

    expect(response.ok).toBe(true);
  }, 10000);
});
