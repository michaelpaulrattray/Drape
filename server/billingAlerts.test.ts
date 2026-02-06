import { describe, it, expect } from "vitest";

describe("Billing Alerts Webhook", () => {
  it("should have SLACK_BILLING_ALERTS_WEBHOOK_URL configured", () => {
    const url = process.env.SLACK_BILLING_ALERTS_WEBHOOK_URL;
    expect(url).toBeDefined();
    expect(url).toBeTruthy();
    expect(url).toMatch(/^https:\/\/hooks\.slack\.com\/services\//);
  });
});
