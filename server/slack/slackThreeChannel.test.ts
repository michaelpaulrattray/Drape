import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  sendSlackAlert,
  sendAdminActionNotification,
  sendAuditLogEntry,
  sendEmergencyActionsToAdminChannel,
  SlackAlerts,
} from "./slackNotification";

// Mock createEmergencyToken from db
vi.mock("../db", () => ({
  createEmergencyToken: vi.fn().mockResolvedValue({ token: "test-token-123" }),
}));

// Mock fetch globally
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  text: () => Promise.resolve("ok"),
});
vi.stubGlobal("fetch", mockFetch);

describe("Three-Channel Slack Routing", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/security-alerts";
    process.env.SLACK_ADMIN_ACTIONS_WEBHOOK_URL = "https://hooks.slack.com/admin-actions";
    process.env.SLACK_AUDIT_LOG_WEBHOOK_URL = "https://hooks.slack.com/audit-log";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("Security Alert Routing", () => {
    it("should send non-critical alerts to #security-alerts with escalation button", async () => {
      await sendSlackAlert({
        title: "Rate Limit Warning",
        description: "User hit rate limit",
        severity: "warning",
        ipAddress: "1.2.3.4",
      });

      // Should send to security-alerts
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://hooks.slack.com/security-alerts",
        expect.any(Object)
      );

      // Verify escalation button is present
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const actionsBlock = body.blocks.find((b: any) => b.type === "actions");
      expect(actionsBlock).toBeDefined();
      expect(actionsBlock.elements[0].action_id).toBe("escalate_to_admin");
    });

    it("should NOT include emergency action buttons in #security-alerts for non-critical", async () => {
      await sendSlackAlert({
        title: "Suspicious Activity",
        description: "Unusual pattern detected",
        severity: "warning",
        ipAddress: "1.2.3.4",
        userId: 42,
        userName: "SuspiciousUser",
      });

      // Only one call to security-alerts (no admin-actions call)
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      
      // Should have escalation button, NOT block_ip or suspend_user
      const actionsBlock = body.blocks.find((b: any) => b.type === "actions");
      expect(actionsBlock.elements[0].action_id).toBe("escalate_to_admin");
      expect(actionsBlock.elements).toHaveLength(1);
    });

    it("should send critical alerts to BOTH #security-alerts and #admin-actions", async () => {
      await sendSlackAlert({
        title: "Brute Force Attack",
        description: "Active brute force detected",
        severity: "critical",
        ipAddress: "1.2.3.4",
        userId: 42,
        userName: "Attacker",
      });

      // Should send to both channels
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);

      // First call should be to admin-actions (emergency buttons)
      const adminActionsCall = mockFetch.mock.calls.find(
        (call: any[]) => call[0] === "https://hooks.slack.com/admin-actions"
      );
      expect(adminActionsCall).toBeDefined();

      // Second call should be to security-alerts (info only)
      const securityAlertsCall = mockFetch.mock.calls.find(
        (call: any[]) => call[0] === "https://hooks.slack.com/security-alerts"
      );
      expect(securityAlertsCall).toBeDefined();
    });

    it("should include emergency action buttons in #admin-actions for critical alerts", async () => {
      await sendSlackAlert({
        title: "Critical Attack",
        description: "Active attack",
        severity: "critical",
        ipAddress: "10.0.0.1",
      });

      // Find the admin-actions call
      const adminCall = mockFetch.mock.calls.find(
        (call: any[]) => call[0] === "https://hooks.slack.com/admin-actions"
      );
      expect(adminCall).toBeDefined();

      const body = JSON.parse(adminCall![1].body);
      const actionsBlock = body.blocks.find((b: any) => b.type === "actions");
      expect(actionsBlock).toBeDefined();

      // Should have block_ip button
      const blockIpButton = actionsBlock.elements.find(
        (e: any) => e.action_id === "block_ip"
      );
      expect(blockIpButton).toBeDefined();
    });
  });

  describe("Admin Action Notifications", () => {
    it("should send admin action notifications to #admin-actions", async () => {
      await sendAdminActionNotification({
        title: "User Suspended",
        description: "Admin suspended a user",
        severity: "info",
        fields: [{ title: "User", value: "TestUser", short: true }],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://hooks.slack.com/admin-actions",
        expect.any(Object)
      );
    });
  });

  describe("Audit Log Entries", () => {
    it("should send audit log entries to #audit-log", async () => {
      await sendAuditLogEntry({
        title: "Action Completed",
        description: "IP 1.2.3.4 was blocked",
        fields: [{ title: "IP", value: "1.2.3.4", short: true }],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://hooks.slack.com/audit-log",
        expect.any(Object)
      );
    });

    it("should include timestamp in audit log entries", async () => {
      await sendAuditLogEntry({
        title: "Test Entry",
        description: "Test",
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const contextBlock = body.blocks.find((b: any) => b.type === "context");
      expect(contextBlock).toBeDefined();
      expect(contextBlock.elements[0].text).toContain("Logged at");
    });
  });

  describe("SlackAlerts Templates - Channel Routing", () => {
    it("ipBlocked should send to #admin-actions and #audit-log", async () => {
      await SlackAlerts.ipBlocked("1.2.3.4", "Abuse", "AdminUser");

      const adminCall = mockFetch.mock.calls.find(
        (call: any[]) => call[0] === "https://hooks.slack.com/admin-actions"
      );
      const auditCall = mockFetch.mock.calls.find(
        (call: any[]) => call[0] === "https://hooks.slack.com/audit-log"
      );

      expect(adminCall).toBeDefined();
      expect(auditCall).toBeDefined();
    });

    it("userSuspended should send to #admin-actions and #audit-log", async () => {
      await SlackAlerts.userSuspended(42, "TestUser", "Abuse", "AdminUser");

      const adminCall = mockFetch.mock.calls.find(
        (call: any[]) => call[0] === "https://hooks.slack.com/admin-actions"
      );
      const auditCall = mockFetch.mock.calls.find(
        (call: any[]) => call[0] === "https://hooks.slack.com/audit-log"
      );

      expect(adminCall).toBeDefined();
      expect(auditCall).toBeDefined();
    });

    it("adminAction should send to #admin-actions only", async () => {
      await SlackAlerts.adminAction("Admin", 1, "view_users", "system", "all");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://hooks.slack.com/admin-actions",
        expect.any(Object)
      );
    });

    it("sensitiveAdminAction should send to #admin-actions and #audit-log", async () => {
      await SlackAlerts.sensitiveAdminAction("Admin", 1, "suspend_user", "user", "42");

      const adminCall = mockFetch.mock.calls.find(
        (call: any[]) => call[0] === "https://hooks.slack.com/admin-actions"
      );
      const auditCall = mockFetch.mock.calls.find(
        (call: any[]) => call[0] === "https://hooks.slack.com/audit-log"
      );

      expect(adminCall).toBeDefined();
      expect(auditCall).toBeDefined();
    });

    it("unauthorizedAdminAccess should send to all three channels", async () => {
      await SlackAlerts.unauthorizedAdminAccess(99, "Hacker", "delete_all", "1.2.3.4");

      const securityCall = mockFetch.mock.calls.find(
        (call: any[]) => call[0] === "https://hooks.slack.com/security-alerts"
      );
      const adminCall = mockFetch.mock.calls.find(
        (call: any[]) => call[0] === "https://hooks.slack.com/admin-actions"
      );
      const auditCall = mockFetch.mock.calls.find(
        (call: any[]) => call[0] === "https://hooks.slack.com/audit-log"
      );

      expect(securityCall).toBeDefined();
      expect(adminCall).toBeDefined();
      expect(auditCall).toBeDefined();
    });

    it("credentialStuffing (warning) should only go to #security-alerts", async () => {
      await SlackAlerts.credentialStuffing(50, "1.2.3.4", 10);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://hooks.slack.com/security-alerts",
        expect.any(Object)
      );
    });

    it("credentialStuffing (critical) should go to #security-alerts and #admin-actions", async () => {
      await SlackAlerts.credentialStuffing(150, "1.2.3.4", 50);

      const securityCall = mockFetch.mock.calls.find(
        (call: any[]) => call[0] === "https://hooks.slack.com/security-alerts"
      );
      const adminCall = mockFetch.mock.calls.find(
        (call: any[]) => call[0] === "https://hooks.slack.com/admin-actions"
      );

      expect(securityCall).toBeDefined();
      expect(adminCall).toBeDefined();
    });
  });

  describe("Emergency Actions to Admin Channel", () => {
    it("should create emergency tokens for IP blocking", async () => {
      const { createEmergencyToken } = await import("../db");

      await sendEmergencyActionsToAdminChannel(
        "Test Alert",
        "Test description",
        [],
        "1.2.3.4",
        undefined,
        undefined,
        undefined
      );

      expect(createEmergencyToken).toHaveBeenCalledWith(
        "block_ip",
        "1.2.3.4",
        expect.any(Object)
      );
    });

    it("should create emergency tokens for user suspension", async () => {
      const { createEmergencyToken } = await import("../db");

      await sendEmergencyActionsToAdminChannel(
        "Test Alert",
        "Test description",
        [],
        undefined,
        42,
        "TestUser",
        undefined
      );

      expect(createEmergencyToken).toHaveBeenCalledWith(
        "suspend_user",
        "42",
        expect.objectContaining({ userName: "TestUser" })
      );
    });
  });
});
