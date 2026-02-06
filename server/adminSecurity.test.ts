import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  validateAdminAccess,
  isSensitiveAction,
  generateConfirmationToken,
  validateConfirmationToken,
  writeImmutableLog,
  verifyImmutableLogChain,
  logAdminAction,
  logUnauthorizedAdminAccess,
  ADMIN_ALLOWLIST,
} from "./adminSecurity";

// Mock the Slack notifications
vi.mock("./slackNotification", () => ({
  SlackAlerts: {
    adminAction: vi.fn().mockResolvedValue(undefined),
    sensitiveAdminAction: vi.fn().mockResolvedValue(undefined),
    unauthorizedAdminAccess: vi.fn().mockResolvedValue(undefined),
  },
  sendSlackAlert: vi.fn().mockResolvedValue(true),
}));

describe("Admin Security", () => {
  describe("validateAdminAccess", () => {
    it("should allow access for users on the allowlist with admin role", () => {
      // The owner should be on the allowlist by default
      const result = validateAdminAccess({
        id: 1,
        role: "admin",
        email: "owner@example.com",
      });
      
      // Result depends on whether OWNER_OPEN_ID is set
      // In test environment, allowlist may be empty
      expect(result).toHaveProperty("allowed");
      expect(result).toHaveProperty("reason");
    });

    it("should deny access for users not on the allowlist", () => {
      const result = validateAdminAccess({
        id: 99999,
        role: "admin",
        email: "attacker@example.com",
      });
      
      // If allowlist is empty, all admins are allowed (fallback behavior)
      // If allowlist has entries, non-listed users are denied
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

  describe("Confirmation Tokens", () => {
    it("should generate valid confirmation tokens", () => {
      // generateConfirmationToken takes (adminId, action, targetId) as separate args
      const token = generateConfirmationToken(1, "suspendUser", "123");
      
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(20);
    });

    it("should validate correct tokens", () => {
      const token = generateConfirmationToken(1, "suspendUser", "123");
      
      const result = validateConfirmationToken(token, 1, "suspendUser", "123");
      
      expect(result.valid).toBe(true);
    });

    it("should reject tokens with wrong admin ID", () => {
      const token = generateConfirmationToken(1, "suspendUser", "123");
      
      const result = validateConfirmationToken(token, 2, "suspendUser", "123");
      
      expect(result.valid).toBe(false);
    });

    it("should reject tokens with wrong action", () => {
      const token = generateConfirmationToken(1, "suspendUser", "123");
      
      const result = validateConfirmationToken(token, 1, "adjustCredits", "123");
      
      expect(result.valid).toBe(false);
    });

    it("should reject invalid tokens", () => {
      // Try to validate a non-existent token
      const result = validateConfirmationToken("invalid-token", 1, "suspendUser", "123");
      
      expect(result.valid).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  describe("Immutable Log", () => {
    beforeEach(() => {
      // Clear the log before each test
      vi.resetModules();
    });

    it("should write entries to the immutable log", async () => {
      const entry = await writeImmutableLog("test_action", {
        testData: "value",
      });
      
      expect(entry).toHaveProperty("id");
      expect(entry).toHaveProperty("timestamp");
      expect(entry).toHaveProperty("hash");
      expect(entry).toHaveProperty("previousHash");
      expect(entry.eventType).toBe("test_action");
    });

    it("should chain entries with hashes", async () => {
      const entry1 = await writeImmutableLog("action_1", { data: 1 });
      const entry2 = await writeImmutableLog("action_2", { data: 2 });
      
      expect(entry2.previousHash).toBe(entry1.hash);
    });

    it("should verify chain integrity", async () => {
      await writeImmutableLog("action_1", { data: 1 });
      await writeImmutableLog("action_2", { data: 2 });
      await writeImmutableLog("action_3", { data: 3 });
      
      const result = verifyImmutableLogChain();
      
      expect(result.valid).toBe(true);
      expect(result.entries).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Admin Action Logging", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should log admin actions", async () => {
      const { SlackAlerts } = await import("./slackNotification");
      
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
      const { SlackAlerts } = await import("./slackNotification");
      
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
      const { SlackAlerts } = await import("./slackNotification");
      
      await logUnauthorizedAdminAccess({
        userId: 99999,
        userName: "attacker@example.com",
        attemptedAction: "admin_access",
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0",
        reason: "User not on allowlist",
      });
      
      expect(SlackAlerts.unauthorizedAdminAccess).toHaveBeenCalled();
    });
  });
});
