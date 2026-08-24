import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  listAllUsers: vi.fn(),
  getUserStatistics: vi.fn(),
  getUserFullDetails: vi.fn(),
  adjustUserCredits: vi.fn(),
  getUserById: vi.fn(),
}));

// Mock the audit log module. `AUDIT_ACTIONS` passes through — the action NAME
// an audit row carries is the product's, and a stub would let it drift.
vi.mock("./auditLog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./auditLog")>();
  return {
    ...actual,
    logAuditEvent: vi.fn().mockResolvedValue(true),
    getFilteredAuditLogs: vi.fn(),
  };
});

// ⚠ adminSecurity PASSES THROUGH (3g's D): the arms at the foot of this file
// drive the real admin gate, and stubbing a gate an arm drives is the defect
// this row removes.
vi.mock("./security/adminSecurity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./security/adminSecurity")>();
  return {
    ...actual,
    logAdminAction: vi.fn().mockResolvedValue(undefined),
    writeImmutableLog: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("./slack/slackNotification", () => ({
  sendAdminActionNotification: vi.fn().mockResolvedValue(true),
  sendAuditLogEntry: vi.fn().mockResolvedValue(true),
  sendSlackAlert: vi.fn().mockResolvedValue(true),
  SlackAlerts: {
    unauthorizedAdminAccess: vi.fn().mockResolvedValue(undefined),
    sensitiveAdminAction: vi.fn().mockResolvedValue(undefined),
    securityAlert: vi.fn().mockResolvedValue(undefined),
  },
}));

import {
  listAllUsers,
  getUserStatistics,
  getUserFullDetails,
  adjustUserCredits,
  getUserById,
} from "./db";
import { logAuditEvent, getFilteredAuditLogs } from "./auditLog";

describe("Admin User Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listAllUsers", () => {
    it("should return paginated users with default options", async () => {
      const mockUsers = [
        {
          id: 1,
          openId: "test-open-id-1",
          name: "Test User 1",
          email: "test1@example.com",
          avatarUrl: null,
          role: "user" as const,
          suspendedAt: null,
          suspendedReason: null,
          lockedUntil: null,
          createdAt: new Date(),
          lastSignedIn: new Date(),
        },
        {
          id: 2,
          openId: "test-open-id-2",
          name: "Test User 2",
          email: "test2@example.com",
          avatarUrl: null,
          role: "admin" as const,
          suspendedAt: null,
          suspendedReason: null,
          lockedUntil: null,
          createdAt: new Date(),
          lastSignedIn: new Date(),
        },
      ];

      vi.mocked(listAllUsers).mockResolvedValue({
        users: mockUsers,
        total: 2,
      });

      const result = await listAllUsers({});
      expect(result.users).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("should filter by search term", async () => {
      vi.mocked(listAllUsers).mockResolvedValue({
        users: [
          {
            id: 1,
            openId: "test-open-id-1",
            name: "John Doe",
            email: "john@example.com",
            avatarUrl: null,
            role: "user" as const,
            suspendedAt: null,
            suspendedReason: null,
            lockedUntil: null,
            createdAt: new Date(),
            lastSignedIn: new Date(),
          },
        ],
        total: 1,
      });

      const result = await listAllUsers({ search: "john" });
      expect(result.users).toHaveLength(1);
      expect(result.users[0].name).toBe("John Doe");
    });

    it("should filter by status (suspended)", async () => {
      vi.mocked(listAllUsers).mockResolvedValue({
        users: [
          {
            id: 1,
            openId: "test-open-id-1",
            name: "Suspended User",
            email: "suspended@example.com",
            avatarUrl: null,
            role: "user" as const,
            suspendedAt: new Date(),
            suspendedReason: "Violation of terms",
            lockedUntil: null,
            createdAt: new Date(),
            lastSignedIn: new Date(),
          },
        ],
        total: 1,
      });

      const result = await listAllUsers({ status: "suspended" });
      expect(result.users).toHaveLength(1);
      expect(result.users[0].suspendedAt).not.toBeNull();
    });

    it("should filter by role", async () => {
      vi.mocked(listAllUsers).mockResolvedValue({
        users: [
          {
            id: 1,
            openId: "admin-open-id",
            name: "Admin User",
            email: "admin@example.com",
            avatarUrl: null,
            role: "admin" as const,
            suspendedAt: null,
            suspendedReason: null,
            lockedUntil: null,
            createdAt: new Date(),
            lastSignedIn: new Date(),
          },
        ],
        total: 1,
      });

      const result = await listAllUsers({ role: "admin" });
      expect(result.users).toHaveLength(1);
      expect(result.users[0].role).toBe("admin");
    });

    it("should return empty array when no users found", async () => {
      vi.mocked(listAllUsers).mockResolvedValue({
        users: [],
        total: 0,
      });

      const result = await listAllUsers({ search: "nonexistent" });
      expect(result.users).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe("getUserStatistics", () => {
    it("should return user statistics summary", async () => {
      vi.mocked(getUserStatistics).mockResolvedValue({
        totalUsers: 100,
        activeUsers: 85,
        suspendedUsers: 10,
        lockedUsers: 5,
        newUsersThisMonth: 15,
        adminCount: 3,
      });

      const stats = await getUserStatistics();
      expect(stats.totalUsers).toBe(100);
      expect(stats.activeUsers).toBe(85);
      expect(stats.suspendedUsers).toBe(10);
      expect(stats.lockedUsers).toBe(5);
      expect(stats.newUsersThisMonth).toBe(15);
      expect(stats.adminCount).toBe(3);
    });

    it("should return zero values when database is empty", async () => {
      vi.mocked(getUserStatistics).mockResolvedValue({
        totalUsers: 0,
        activeUsers: 0,
        suspendedUsers: 0,
        lockedUsers: 0,
        newUsersThisMonth: 0,
        adminCount: 0,
      });

      const stats = await getUserStatistics();
      expect(stats.totalUsers).toBe(0);
    });
  });

  describe("getUserFullDetails", () => {
    it("should return full user details with credits and stats", async () => {
      vi.mocked(getUserFullDetails).mockResolvedValue({
        user: {
          id: 1,
          openId: "test-open-id",
          name: "Test User",
          displayName: "Test",
          email: "test@example.com",
          avatarUrl: null,
          bannerUrl: null,
          bio: null,
          role: "user" as const,
          storageUsed: 1024,
          storageLimit: 10240,
          suspendedAt: null,
          suspendedReason: null,
          suspendedBy: null,
          lockedUntil: null,
          failedLoginAttempts: 0,
          createdAt: new Date(),
          lastSignedIn: new Date(),
        },
        credits: {
          balance: 500,
          planTier: "pro",
          creditsPurchased: 1000,
          creditsUsed: 500,
          rolloverCredits: 100,
          subscriptionStatus: "active",
        },
        stats: {
          totalModels: 5,
          totalGenerations: 50,
        },
      });

      const result = await getUserFullDetails(1);
      expect(result).not.toBeNull();
      expect(result?.user.id).toBe(1);
      expect(result?.credits?.balance).toBe(500);
      expect(result?.stats.totalModels).toBe(5);
    });

    it("should return null for non-existent user", async () => {
      vi.mocked(getUserFullDetails).mockResolvedValue(null);

      const result = await getUserFullDetails(99999);
      expect(result).toBeNull();
    });
  });

  describe("adjustUserCredits", () => {
    it("should add credits successfully", async () => {
      vi.mocked(adjustUserCredits).mockResolvedValue({
        success: true,
        newBalance: 600,
      });

      const result = await adjustUserCredits(1, 100, "Bonus credits", 2);
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(600);
    });

    it("should deduct credits successfully", async () => {
      vi.mocked(adjustUserCredits).mockResolvedValue({
        success: true,
        newBalance: 400,
      });

      const result = await adjustUserCredits(1, -100, "Manual adjustment", 2);
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(400);
    });

    it("should fail when trying to deduct more than balance", async () => {
      vi.mocked(adjustUserCredits).mockResolvedValue({
        success: false,
        error: "Cannot reduce balance below zero",
      });

      const result = await adjustUserCredits(1, -10000, "Large deduction", 2);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Cannot reduce balance below zero");
    });

    it("should fail for non-existent user", async () => {
      vi.mocked(adjustUserCredits).mockResolvedValue({
        success: false,
        error: "User credits record not found",
      });

      const result = await adjustUserCredits(99999, 100, "Test", 2);
      expect(result.success).toBe(false);
      expect(result.error).toBe("User credits record not found");
    });
  });

  describe("getUserActivity", () => {
    it("should return user's audit log entries", async () => {
      vi.mocked(getFilteredAuditLogs).mockResolvedValue({
        logs: [
          {
            id: 1,
            userId: 1,
            action: "auth.login",
            resourceType: null,
            resourceId: null,
            metadata: {},
            severity: "info",
            ipAddress: "127.0.0.1",
            userAgent: "Mozilla/5.0",
            createdAt: new Date(),
          },
          {
            id: 2,
            userId: 1,
            action: "model.created",
            resourceType: "model",
            resourceId: "123",
            metadata: {},
            severity: "info",
            ipAddress: "127.0.0.1",
            userAgent: "Mozilla/5.0",
            createdAt: new Date(),
          },
        ],
        total: 2,
      });

      const result = await getFilteredAuditLogs({ userId: 1, limit: 50 });
      expect(result.logs).toHaveLength(2);
      expect(result.logs[0].userId).toBe(1);
    });

    it("should return empty array for user with no activity", async () => {
      vi.mocked(getFilteredAuditLogs).mockResolvedValue({
        logs: [],
        total: 0,
      });

      const result = await getFilteredAuditLogs({ userId: 99999, limit: 50 });
      expect(result.logs).toHaveLength(0);
    });
  });

  describe("Credit adjustment audit logging", () => {
    it("should log credit addition to audit system", async () => {
      vi.mocked(getUserById).mockResolvedValue({
        id: 1,
        openId: "test-open-id",
        name: "Test User",
        email: "test@example.com",
        avatarUrl: null,
        bannerUrl: null,
        bio: null,
        displayName: null,
        role: "user",
        storageUsed: 0,
        storageLimit: 10240,
        suspendedAt: null,
        suspendedReason: null,
        suspendedBy: null,
        lockedUntil: null,
        failedLoginAttempts: 0,
        createdAt: new Date(),
        lastSignedIn: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(adjustUserCredits).mockResolvedValue({
        success: true,
        newBalance: 600,
      });

      // Simulate the audit log call that would happen in the router
      await logAuditEvent({
        userId: 2, // admin ID
        action: "credits.admin_added",
        resourceType: "credits",
        resourceId: "1",
        metadata: {
          targetUserId: 1,
          amount: 100,
          reason: "Bonus credits",
          newBalance: 600,
        },
        severity: "warning",
      });

      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "credits.admin_added",
          resourceType: "credits",
        })
      );
    });
  });
});

/*
 * 3g's D read (2026-08-25): NOTHING drove `admin.adjustCredits`. What stood
 * for it was an arm commented "Simulate the audit log call that would happen
 * in the router" that called the mocked `logAuditEvent` ITSELF and then
 * asserted it had been called — the test asserting its own call.
 *
 * `pathB-hardening.test.ts` mentions `adjustUserCredits`, but what it asserts
 * is `typeof mod.adjustUserCredits === "function"`: an export-existence arm,
 * not a drive. So the coverage was nil.
 *
 * This is a MONEY procedure — it moves credits into or out of any account —
 * and the arms below drive it: the gate, the missing target, the declared
 * bounds, and a positive control so the refusals are not refusing everyone.
 */
describe("admin.adjustCredits — DRIVEN", () => {
  const ADMIN_CTX = {
    user: {
      id: 2, role: "admin", email: "admin@example.com", name: "Admin",
      openId: null, suspendedAt: null,
    },
    req: { headers: {}, socket: {} },
  } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adjustUserCredits).mockResolvedValue({ success: true, newBalance: 600 } as never);
    vi.mocked(getUserById).mockResolvedValue({ id: 1, role: "user", email: "u@x", name: "User" } as never);
  });

  async function router() {
    const { usersRouter } = await import("./routes/admin/users");
    return usersRouter;
  }

  it("a MODERATOR is refused — it is adminProcedure, driven not recited", async () => {
    const caller = (await router()).createCaller({
      user: { id: 10, role: "moderator", email: "mod@x", name: "Mod", openId: null, suspendedAt: null },
      req: { headers: {}, socket: {} },
    } as never);
    await expect(
      caller.adjustCredits({ userId: 1, amount: 100, reason: "Bonus credits" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    // A refused caller must not have moved money.
    expect(adjustUserCredits).not.toHaveBeenCalled();
  });

  it("refuses a target that does not exist, and moves nothing", async () => {
    vi.mocked(getUserById).mockResolvedValue(null as never);
    const caller = (await router()).createCaller(ADMIN_CTX);
    await expect(
      caller.adjustCredits({ userId: 999, amount: 100, reason: "Bonus credits" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(adjustUserCredits).not.toHaveBeenCalled();
  });

  it("FROM THE DIFF — refuses an amount outside the declared ±100,000, and a reason outside 1..500", async () => {
    const caller = (await router()).createCaller(ADMIN_CTX);
    for (const bad of [
      { userId: 1, amount: 100001, reason: "too much" },
      { userId: 1, amount: -100001, reason: "too much the other way" },
      { userId: 1, amount: 100, reason: "" },
      { userId: 1, amount: 100, reason: "x".repeat(501) },
    ]) {
      await expect(caller.adjustCredits(bad as never)).rejects.toBeDefined();
    }
    expect(adjustUserCredits).not.toHaveBeenCalled();
    // The boundaries themselves are accepted, so the arm is not refusing all.
    await expect(
      caller.adjustCredits({ userId: 1, amount: 100000, reason: "x".repeat(500) }),
    ).resolves.toBeDefined();
  });

  it("POSITIVE CONTROL — an admin adjusting an ordinary account SUCCEEDS, with the amount and actor passed through", async () => {
    const caller = (await router()).createCaller(ADMIN_CTX);
    await expect(
      caller.adjustCredits({ userId: 1, amount: 100, reason: "Bonus credits" }),
    ).resolves.toBeDefined();
    expect(adjustUserCredits).toHaveBeenCalledWith(1, 100, "Bonus credits", 2);
  });
});
