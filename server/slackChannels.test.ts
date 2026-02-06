import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Test to validate Slack channel webhook URLs are configured.
 * Uses mocked fetch to avoid sending real messages during test runs.
 */

const originalFetch = globalThis.fetch;

describe("Slack Channel Webhook Configuration", () => {
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

  it("should be able to send a test message to admin-actions channel (mocked)", async () => {
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
    expect(globalThis.fetch).toHaveBeenCalledWith(url, expect.objectContaining({ method: "POST" }));
  }, 10000);

  it("should be able to send a test message to audit-log channel (mocked)", async () => {
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
    expect(globalThis.fetch).toHaveBeenCalledWith(url, expect.objectContaining({ method: "POST" }));
  }, 10000);
});
