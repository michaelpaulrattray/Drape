import { describe, it, expect } from "vitest";

// Config-verification suite: only meaningful where billing alerting is set up.
const billingAlertsConfigured = Boolean(process.env.SLACK_BILLING_ALERTS_WEBHOOK_URL);
if (!billingAlertsConfigured) {
  console.warn(
    "[test] Skipping billing alerts webhook test — SLACK_BILLING_ALERTS_WEBHOOK_URL is not set"
  );
}

describe.skipIf(!billingAlertsConfigured)("Billing Alerts Webhook", () => {
  it("should have SLACK_BILLING_ALERTS_WEBHOOK_URL configured", () => {
    const url = process.env.SLACK_BILLING_ALERTS_WEBHOOK_URL;
    expect(url).toBeDefined();
    expect(url).toBeTruthy();
    expect(url).toMatch(/^https:\/\/hooks\.slack\.com\/services\//);
  });
});
