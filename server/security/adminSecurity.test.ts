import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  validateAdminAccess,
  isSensitiveAction,
  writeImmutableLog,
  logAdminAction,
  logUnauthorizedAdminAccess,
} from "./adminSecurity";

// Mock the Slack notifications
vi.mock("../slack/slackNotification", () => ({
  SlackAlerts: {
    adminAction: vi.fn().mockResolvedValue(undefined),
    sensitiveAdminAction: vi.fn().mockResolvedValue(undefined),
    unauthorizedAdminAccess: vi.fn().mockResolvedValue(undefined),
  },
  sendSlackAlert: vi.fn().mockResolvedValue(true),
  sendAuditLogEntry: vi.fn().mockResolvedValue(true),
}));

describe("Admin Security", () => {
  describe("validateAdminAccess", () => {
    it("should allow access for users on the allowlist with admin role", () => {
      const result = validateAdminAccess({
        id: 1,
        role: "admin",
        email: "owner@example.com",
      });
      
      expect(result).toHaveProperty("allowed");
      expect(result).toHaveProperty("reason");
    });

    it("should deny access for users not on the allowlist", () => {
      const result = validateAdminAccess({
        id: 99999,
        role: "admin",
        email: "attacker@example.com",
      });
      
      expect(result).toHaveProperty("allowed");
    });

    it("should deny access for non-admin users", () => {
      const result = validateAdminAccess({
        id: 1,
        role: "user",
        email: "user@example.com",
      });
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("admin role");
    });
  });

  describe("isSensitiveAction", () => {
    it("should identify sensitive actions", () => {
      expect(isSensitiveAction("suspendUser")).toBe(true);
      expect(isSensitiveAction("adjustCredits")).toBe(true);
      expect(isSensitiveAction("blockIP")).toBe(true);
      expect(isSensitiveAction("deleteModel")).toBe(true);
    });

    it("should identify non-sensitive actions", () => {
      expect(isSensitiveAction("listUsers")).toBe(false);
      expect(isSensitiveAction("getAuditLogs")).toBe(false);
      expect(isSensitiveAction("viewDashboard")).toBe(false);
    });
  });

  describe("Admin Action Logging", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should log admin actions", async () => {
      const { SlackAlerts } = await import("../slack/slackNotification");
      
      await logAdminAction({
        adminId: 1,
        adminName: "Test Admin",
        action: "listUsers",
        targetType: "system",
        targetId: "all",
        details: "Listed all users",
      });
      
      expect(SlackAlerts.adminAction).toHaveBeenCalled();
    });

    it("should use sensitive alert for sensitive actions", async () => {
      const { SlackAlerts } = await import("../slack/slackNotification");
      
      await logAdminAction({
        adminId: 1,
        adminName: "Test Admin",
        action: "suspendUser",
        targetType: "user",
        targetId: "123",
        details: "Suspended user for abuse",
      });
      
      expect(SlackAlerts.sensitiveAdminAction).toHaveBeenCalled();
    });
  });

  describe("Unauthorized Access Logging", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should log unauthorized access attempts", async () => {
      const { SlackAlerts } = await import("../slack/slackNotification");
      
      await logUnauthorizedAdminAccess({
        userId: 99999,
        userName: "attacker@example.com",
        attemptedAction: "admin_access",
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0",
      });
      
      expect(SlackAlerts.unauthorizedAdminAccess).toHaveBeenCalled();
    });
  });
});
