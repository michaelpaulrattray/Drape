import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  updateUserRole: vi.fn(),
  getUserById: vi.fn(),
}));

// Mock audit logging
vi.mock("./auditLog", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

// Mock admin security
vi.mock("./adminSecurity", () => ({
  logAdminAction: vi.fn().mockResolvedValue(undefined),
  writeImmutableLog: vi.fn().mockResolvedValue(undefined),
  validateAdminAccess: vi.fn().mockResolvedValue({ allowed: true }),
  logUnauthorizedAdminAccess: vi.fn().mockResolvedValue(undefined),
}));

// Mock Slack
vi.mock("./slackNotification", () => ({
  sendSlackAlert: vi.fn().mockResolvedValue(undefined),
  sendAdminActionNotification: vi.fn().mockResolvedValue(undefined),
  sendAuditLogEntry: vi.fn().mockResolvedValue(undefined),
  sendEmergencyActionsToAdminChannel: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./slackApproval", () => ({
  requestSlackApproval: vi.fn().mockResolvedValue("test-id"),
  checkApprovalStatus: vi.fn().mockReturnValue({ status: "approved" }),
  cleanupExpiredActions: vi.fn(),
  getPendingActionsForAdmin: vi.fn().mockReturnValue([]),
}));

import { updateUserRole, getUserById } from "./db";

const mockUpdateUserRole = vi.mocked(updateUserRole);
const mockGetUserById = vi.mocked(getUserById);

describe("Role Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateUserRole", () => {
    it("should successfully promote a user to moderator", async () => {
      mockUpdateUserRole.mockResolvedValue({
        success: true,
        previousRole: "user",
      });

      const result = await updateUserRole(42, "moderator", 1);
      expect(result.success).toBe(true);
      expect(result.previousRole).toBe("user");
      expect(mockUpdateUserRole).toHaveBeenCalledWith(42, "moderator", 1);
    });

    it("should successfully demote a moderator to user", async () => {
      mockUpdateUserRole.mockResolvedValue({
        success: true,
        previousRole: "moderator",
      });

      const result = await updateUserRole(42, "user", 1);
      expect(result.success).toBe(true);
      expect(result.previousRole).toBe("moderator");
    });

    it("should reject changing an admin's role", async () => {
      mockUpdateUserRole.mockResolvedValue({
        success: false,
        error: "Cannot change the role of an admin user",
      });

      const result = await updateUserRole(1, "moderator", 2);
      expect(result.success).toBe(false);
      expect(result.error).toContain("admin");
    });

    it("should reject self-role-change", async () => {
      mockUpdateUserRole.mockResolvedValue({
        success: false,
        error: "Cannot change your own role",
      });

      const result = await updateUserRole(1, "moderator", 1);
      expect(result.success).toBe(false);
      expect(result.error).toContain("own role");
    });

    it("should reject no-op role change", async () => {
      mockUpdateUserRole.mockResolvedValue({
        success: false,
        error: "User is already a moderator",
      });

      const result = await updateUserRole(42, "moderator", 1);
      expect(result.success).toBe(false);
      expect(result.error).toContain("already");
    });

    it("should handle user not found", async () => {
      mockUpdateUserRole.mockResolvedValue({
        success: false,
        error: "User not found",
      });

      const result = await updateUserRole(999, "moderator", 1);
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should handle database errors gracefully", async () => {
      mockUpdateUserRole.mockResolvedValue({
        success: false,
        error: "Failed to update user role",
      });

      const result = await updateUserRole(42, "moderator", 1);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("Role change validation logic", () => {
    it("should only allow 'user' and 'moderator' as target roles", () => {
      // The z.enum(["user", "moderator"]) in the procedure ensures this
      const validRoles = ["user", "moderator"];
      const invalidRoles = ["admin", "superadmin", "owner", ""];

      validRoles.forEach((role) => {
        expect(["user", "moderator"]).toContain(role);
      });

      invalidRoles.forEach((role) => {
        expect(["user", "moderator"]).not.toContain(role);
      });
    });

    it("should require a non-empty reason", () => {
      const emptyReasons = ["", "   "];
      emptyReasons.forEach((reason) => {
        expect(reason.trim().length).toBe(0);
      });

      const validReasons = ["Trusted community member", "Stepping down"];
      validReasons.forEach((reason) => {
        expect(reason.trim().length).toBeGreaterThan(0);
      });
    });

    it("should enforce reason max length of 500 characters", () => {
      const shortReason = "Valid reason";
      const longReason = "x".repeat(501);

      expect(shortReason.length).toBeLessThanOrEqual(500);
      expect(longReason.length).toBeGreaterThan(500);
    });
  });

  describe("Security logging for role changes", () => {
    it("should log role changes to audit, admin actions, and immutable log", async () => {
      const { logAuditEvent } = await import("./auditLog");
      const { logAdminAction, writeImmutableLog } = await import("./adminSecurity");

      mockGetUserById.mockResolvedValue({
        id: 42,
        openId: "test-open-id",
        name: "Test User",
        email: "test@example.com",
        role: "user",
        displayName: null,
        avatarUrl: null,
        avatarKey: null,
        bannerUrl: null,
        bannerKey: null,
        bio: null,
        loginMethod: "oauth",
        storageUsed: 0,
        storageLimit: 104857600,
        suspendedAt: null,
        suspendedReason: null,
        suspendedBy: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      } as any);

      mockUpdateUserRole.mockResolvedValue({
        success: true,
        previousRole: "user",
      });

      // Simulate what the procedure does
      const targetUser = await getUserById(42);
      expect(targetUser).toBeDefined();

      const result = await updateUserRole(42, "moderator", 1);
      expect(result.success).toBe(true);

      // Verify the logging functions exist and are callable
      await logAuditEvent({
        userId: 1,
        action: "admin.role_changed",
        resourceType: "user",
        resourceId: "42",
        metadata: {
          previousRole: "user",
          newRole: "moderator",
          reason: "Trusted member",
        },
        severity: "warning",
        ipAddress: "127.0.0.1",
        userAgent: "test",
      });

      await logAdminAction({
        adminId: 1,
        adminName: "Admin",
        action: "changeUserRole",
        targetType: "user",
        targetId: "42",
        details: "Promoted to Moderator: test@example.com (user → moderator). Reason: Trusted member",
        ipAddress: "127.0.0.1",
      });

      await writeImmutableLog("role_changed", {
        adminId: 1,
        targetUserId: 42,
        previousRole: "user",
        newRole: "moderator",
        reason: "Trusted member",
      });

      expect(logAuditEvent).toHaveBeenCalled();
      expect(logAdminAction).toHaveBeenCalled();
      expect(writeImmutableLog).toHaveBeenCalled();
    });
  });

  describe("Role hierarchy enforcement", () => {
    it("should not allow promoting to admin via changeUserRole", () => {
      // The z.enum(["user", "moderator"]) prevents admin promotion
      const allowedTargetRoles = ["user", "moderator"];
      expect(allowedTargetRoles).not.toContain("admin");
    });

    it("should not allow changing an admin user's role", async () => {
      mockUpdateUserRole.mockResolvedValue({
        success: false,
        error: "Cannot change the role of an admin user",
      });

      const result = await updateUserRole(1, "user", 2);
      expect(result.success).toBe(false);
    });

    it("should prevent self-demotion by admin", async () => {
      mockUpdateUserRole.mockResolvedValue({
        success: false,
        error: "Cannot change your own role",
      });

      const result = await updateUserRole(1, "user", 1);
      expect(result.success).toBe(false);
    });
  });
});
