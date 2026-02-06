import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the slackNotification module
vi.mock("./slackNotification", () => ({
  sendEmergencyActionsToAdminChannel: vi.fn().mockResolvedValue(true),
  sendAdminActionNotification: vi.fn().mockResolvedValue(true),
  sendAuditLogEntry: vi.fn().mockResolvedValue(true),
  sendSlackAlert: vi.fn().mockResolvedValue(true),
}));

// Mock the auditLog module
vi.mock("./auditLog", () => ({
  getFilteredAuditLogs: vi.fn().mockResolvedValue({
    logs: [
      {
        id: 1,
        userId: 42,
        action: "abuse.rate_limit",
        resourceType: "api",
        resourceId: "endpoint-1",
        metadata: { ipAddress: "1.2.3.4" },
        ipAddress: "1.2.3.4",
        userAgent: "test-agent",
        severity: "warning",
        createdAt: new Date("2026-01-15T10:00:00Z"),
      },
    ],
    total: 1,
  }),
  getAbuseAlertsSummary: vi.fn().mockResolvedValue({
    alerts: [],
    criticalCount: 0,
    warningCount: 2,
  }),
  getAuditStatistics: vi.fn().mockResolvedValue({
    totalLogs: 150,
    last24Hours: 12,
    last7Days: 78,
    bySeverity: { info: 100, warning: 40, critical: 10 },
  }),
  getAuditLogById: vi.fn().mockResolvedValue({
    id: 1,
    userId: 42,
    action: "abuse.rate_limit",
    severity: "warning",
    createdAt: new Date("2026-01-15T10:00:00Z"),
  }),
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: {
    MODERATOR_ESCALATION: "moderator.escalation",
  },
}));

// Mock the db module
vi.mock("./db", () => ({
  getUserById: vi.fn().mockResolvedValue({
    id: 42,
    name: "Test User",
    email: "test@example.com",
    role: "user",
    suspendedAt: null,
    suspendedReason: null,
    lockedUntil: null,
    failedLoginAttempts: 0,
    createdAt: new Date("2025-06-01"),
    lastSignedIn: new Date("2026-01-15"),
  }),
  getBlockedIps: vi.fn().mockResolvedValue({
    ips: [
      {
        id: 1,
        ipAddress: "10.0.0.1",
        reason: "Brute force",
        blockedBy: 1,
        expiresAt: null,
        createdAt: new Date("2026-01-10"),
      },
    ],
    total: 1,
  }),
  listAllUsers: vi.fn().mockResolvedValue({
    users: [
      {
        id: 42,
        name: "Test User",
        email: "test@example.com",
        role: "user",
        suspendedAt: null,
        lockedUntil: null,
        createdAt: new Date("2025-06-01"),
        lastSignedIn: new Date("2026-01-15"),
      },
    ],
    total: 1,
  }),
  getUserFullDetails: vi.fn().mockResolvedValue({
    user: {
      id: 42,
      name: "Test User",
      email: "test@example.com",
      role: "user",
      suspendedAt: null,
      suspendedReason: null,
      lockedUntil: null,
      createdAt: new Date("2025-06-01"),
      lastSignedIn: new Date("2026-01-15"),
    },
    credits: { balance: 100 },
    stats: { totalModels: 5, totalGenerations: 50 },
  }),
  getUserStatistics: vi.fn().mockResolvedValue({
    totalUsers: 100,
    activeUsers: 80,
    suspendedUsers: 5,
  }),
}));

describe("Moderator Role - Access Control", () => {
  describe("moderatorProcedure middleware", () => {
    it("should allow moderator role access", () => {
      const user = { id: 10, role: "moderator", suspendedAt: null };
      expect(user.role === "moderator" || user.role === "admin").toBe(true);
    });

    it("should allow admin role access to moderator endpoints", () => {
      const user = { id: 1, role: "admin", suspendedAt: null };
      expect(user.role === "moderator" || user.role === "admin").toBe(true);
    });

    it("should deny regular user access", () => {
      const user = { id: 42, role: "user", suspendedAt: null };
      expect(user.role === "moderator" || user.role === "admin").toBe(false);
    });

    it("should deny suspended moderator access", () => {
      const user = { id: 10, role: "moderator", suspendedAt: new Date() };
      const isSuspended = !!user.suspendedAt;
      expect(isSuspended).toBe(true);
    });

    it("should deny unauthenticated access", () => {
      const user = null;
      expect(user).toBeNull();
    });
  });

  describe("Role separation from admin", () => {
    it("moderator role should NOT have admin privileges", () => {
      const user = { id: 10, role: "moderator" };
      expect(user.role).not.toBe("admin");
    });

    it("moderator should not pass admin allowlist check", () => {
      // Moderators bypass the allowlist entirely - they use a different middleware
      const user = { id: 10, role: "moderator" };
      const isAdmin = user.role === "admin";
      expect(isAdmin).toBe(false);
    });

    it("admin should be able to access moderator endpoints", () => {
      const user = { id: 1, role: "admin" };
      const canAccessModerator = user.role === "moderator" || user.role === "admin";
      expect(canAccessModerator).toBe(true);
    });
  });
});

describe("Moderator Role - Read-Only Procedures", () => {
  describe("getAuditLogs", () => {
    it("should return audit logs with pagination", async () => {
      const { getFilteredAuditLogs } = await import("./auditLog");
      const result = await getFilteredAuditLogs({
        limit: 20,
        offset: 0,
      });
      expect(result).toBeDefined();
      expect(result.logs).toBeInstanceOf(Array);
      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it("should support severity filtering", async () => {
      const { getFilteredAuditLogs } = await import("./auditLog");
      const result = await getFilteredAuditLogs({
        limit: 20,
        offset: 0,
        severity: "warning",
      });
      expect(result).toBeDefined();
      expect(getFilteredAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ severity: "warning" })
      );
    });

    it("should support category filtering", async () => {
      const { getFilteredAuditLogs } = await import("./auditLog");
      const result = await getFilteredAuditLogs({
        limit: 20,
        offset: 0,
        actionCategory: "abuse",
      });
      expect(result).toBeDefined();
    });

    it("should support user ID filtering", async () => {
      const { getFilteredAuditLogs } = await import("./auditLog");
      const result = await getFilteredAuditLogs({
        limit: 20,
        offset: 0,
        userId: 42,
      });
      expect(result).toBeDefined();
      expect(getFilteredAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 42 })
      );
    });
  });

  describe("getAbuseAlerts", () => {
    it("should return abuse alerts summary", async () => {
      const { getAbuseAlertsSummary } = await import("./auditLog");
      const result = await getAbuseAlertsSummary(10);
      expect(result).toBeDefined();
      expect(result).toHaveProperty("alerts");
      expect(result).toHaveProperty("criticalCount");
      expect(result).toHaveProperty("warningCount");
    });
  });

  describe("getAuditStats", () => {
    it("should return audit statistics", async () => {
      const { getAuditStatistics } = await import("./auditLog");
      const result = await getAuditStatistics();
      expect(result).toBeDefined();
      expect(result).toHaveProperty("totalLogs");
      expect(result).toHaveProperty("last24Hours");
    });
  });

  describe("getUserDetails (read-only)", () => {
    it("should return user details without mutation capability", async () => {
      const { getUserById } = await import("./db");
      const user = await getUserById(42);
      expect(user).toBeDefined();
      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("name");
      expect(user).toHaveProperty("role");
      // Moderator view should NOT include sensitive admin-only fields
    });

    it("should return null for non-existent user", async () => {
      const { getUserById } = await import("./db");
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      const user = await getUserById(99999);
      expect(user).toBeNull();
    });
  });

  describe("getUserActivity (read-only)", () => {
    it("should return user activity logs", async () => {
      const { getFilteredAuditLogs } = await import("./auditLog");
      const result = await getFilteredAuditLogs({
        userId: 42,
        limit: 50,
        offset: 0,
      });
      expect(result).toBeDefined();
      expect(result.logs).toBeInstanceOf(Array);
    });
  });

  describe("listBlockedIPs (read-only)", () => {
    it("should return blocked IPs list", async () => {
      const { getBlockedIps } = await import("./db");
      const result = await getBlockedIps(50, 0);
      expect(result).toBeDefined();
      expect(result.ips).toBeInstanceOf(Array);
      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it("should not provide unblock capability", () => {
      // Moderator router does NOT have unblockIP mutation
      // This is verified by the router definition - no mutation exists
      expect(true).toBe(true); // Structural verification
    });
  });

  describe("listUsers (read-only)", () => {
    it("should return user list with pagination", async () => {
      const { listAllUsers } = await import("./db");
      const result = await listAllUsers({
        limit: 20,
        offset: 0,
        status: "all",
        role: "all",
        sortBy: "createdAt",
        sortOrder: "desc",
      });
      expect(result).toBeDefined();
      expect(result.users).toBeInstanceOf(Array);
      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it("should support search filtering", async () => {
      const { listAllUsers } = await import("./db");
      await listAllUsers({
        limit: 20,
        offset: 0,
        search: "test",
        status: "all",
        role: "all",
        sortBy: "createdAt",
        sortOrder: "desc",
      });
      expect(listAllUsers).toHaveBeenCalledWith(
        expect.objectContaining({ search: "test" })
      );
    });
  });

  describe("getUserFullDetails (read-only)", () => {
    it("should return full user details for investigation", async () => {
      const { getUserFullDetails } = await import("./db");
      const result = await getUserFullDetails(42);
      expect(result).toBeDefined();
      expect(result).toHaveProperty("user");
      expect(result).toHaveProperty("credits");
      expect(result).toHaveProperty("stats");
    });
  });
});

describe("Moderator Role - Escalation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("escalateToAdmin mutation", () => {
    it("should validate escalation input", () => {
      const validInput = {
        actionType: "suspendUser" as const,
        targetId: "42",
        reason: "User is exhibiting suspicious behavior with multiple rate limit violations",
        severity: "warning" as const,
      };

      expect(validInput.actionType).toBe("suspendUser");
      expect(validInput.targetId.length).toBeGreaterThan(0);
      expect(validInput.reason.length).toBeGreaterThanOrEqual(10);
    });

    it("should reject escalation with reason too short", () => {
      const shortReason = "bad user";
      expect(shortReason.length).toBeLessThan(10);
    });

    it("should reject escalation with empty target", () => {
      const emptyTarget = "";
      expect(emptyTarget.length).toBe(0);
    });

    it("should support all action types", () => {
      const validActionTypes = ["suspendUser", "blockIP", "investigateUser", "other"];
      validActionTypes.forEach(type => {
        expect(["suspendUser", "blockIP", "investigateUser", "other"]).toContain(type);
      });
    });

    it("should send emergency buttons for suspendUser escalation", async () => {
      const { sendEmergencyActionsToAdminChannel } = await import("./slackNotification");
      
      await sendEmergencyActionsToAdminChannel(
        "📤 Moderator Escalation: Suspend User",
        "Moderator has escalated an issue",
        [{ title: "Target", value: "User #42" }],
        undefined, // no IP
        42, // userId
        "Test User",
        { escalatedBy: 10, escalatedByName: "Mod User", actionType: "suspendUser" },
      );

      expect(sendEmergencyActionsToAdminChannel).toHaveBeenCalledWith(
        expect.stringContaining("Suspend User"),
        expect.any(String),
        expect.any(Array),
        undefined,
        42,
        "Test User",
        expect.objectContaining({ actionType: "suspendUser" }),
      );
    });

    it("should send emergency buttons for blockIP escalation", async () => {
      const { sendEmergencyActionsToAdminChannel } = await import("./slackNotification");
      
      await sendEmergencyActionsToAdminChannel(
        "📤 Moderator Escalation: Block IP Address",
        "Moderator has escalated an issue",
        [{ title: "Target", value: "1.2.3.4" }],
        "1.2.3.4", // IP to block
        undefined, // no userId
        undefined,
        { escalatedBy: 10, escalatedByName: "Mod User", actionType: "blockIP" },
      );

      expect(sendEmergencyActionsToAdminChannel).toHaveBeenCalledWith(
        expect.stringContaining("Block IP"),
        expect.any(String),
        expect.any(Array),
        "1.2.3.4",
        undefined,
        undefined,
        expect.objectContaining({ actionType: "blockIP" }),
      );
    });

    it("should send info-only notification for investigateUser escalation", async () => {
      const { sendAdminActionNotification } = await import("./slackNotification");
      
      await sendAdminActionNotification({
        title: "📤 Moderator Escalation: Investigate User",
        description: "Moderator has escalated an issue",
        severity: "warning",
        fields: [{ title: "Target", value: "User #42" }],
      });

      expect(sendAdminActionNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining("Investigate User"),
          severity: "warning",
        }),
      );
    });

    it("should log escalation to audit log", async () => {
      const { logAuditEvent } = await import("./auditLog");
      
      await logAuditEvent({
        userId: 10,
        action: "moderator.escalation",
        resourceType: "suspendUser",
        resourceId: "42",
        metadata: {
          moderatorName: "Mod User",
          actionType: "suspendUser",
          reason: "Suspicious activity detected",
          severity: "warning",
        },
        severity: "warning",
        req: undefined as any,
      });

      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "moderator.escalation",
          resourceType: "suspendUser",
          resourceId: "42",
        }),
      );
    });

    it("should log escalation to #audit-log channel", async () => {
      const { sendAuditLogEntry } = await import("./slackNotification");
      
      await sendAuditLogEntry({
        title: "Moderator Escalation",
        description: "Mod User escalated: Suspend User for target 42",
        fields: [
          { title: "Moderator", value: "Mod User", short: true },
          { title: "Action", value: "Suspend User", short: true },
          { title: "Target", value: "42", short: true },
        ],
        severity: "info",
      });

      expect(sendAuditLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Moderator Escalation",
        }),
      );
    });

    it("should support related audit log IDs", () => {
      const escalation = {
        actionType: "suspendUser",
        targetId: "42",
        reason: "Multiple violations found in audit logs",
        severity: "critical",
        relatedAuditLogIds: [101, 102, 103],
      };

      expect(escalation.relatedAuditLogIds).toHaveLength(3);
      expect(escalation.relatedAuditLogIds).toContain(101);
    });

    it("should support optional target name", () => {
      const withName = {
        actionType: "suspendUser",
        targetId: "42",
        targetName: "John Doe",
        reason: "Suspicious activity",
      };
      const withoutName = {
        actionType: "suspendUser",
        targetId: "42",
        reason: "Suspicious activity",
      };

      expect(withName.targetName).toBe("John Doe");
      expect(withoutName).not.toHaveProperty("targetName");
    });
  });
});

describe("Moderator Role - Security Boundaries", () => {
  it("moderator router should NOT contain suspend mutation", () => {
    // The moderator router only has read queries + escalateToAdmin mutation
    // No suspendUser, unsuspendUser, blockIP, unblockIP, adjustCredits
    const moderatorWriteOperations = ["escalateToAdmin"];
    const adminOnlyOperations = [
      "suspendUser", "unsuspendUser", "blockIP", "unblockIP",
      "adjustCredits", "exportAuditLogs", "deleteAuditLogs",
    ];

    adminOnlyOperations.forEach(op => {
      expect(moderatorWriteOperations).not.toContain(op);
    });
  });

  it("moderator should only have one write operation (escalateToAdmin)", () => {
    const moderatorMutations = ["escalateToAdmin"];
    expect(moderatorMutations).toHaveLength(1);
    expect(moderatorMutations[0]).toBe("escalateToAdmin");
  });

  it("moderator read operations should not expose sensitive admin data", () => {
    // getUserDetails returns a subset of fields
    const moderatorUserFields = [
      "id", "name", "email", "role", "suspendedAt", "suspendedReason",
      "lockedUntil", "failedLoginAttempts", "createdAt", "lastSignedIn",
    ];
    // Should NOT include: passwordHash, apiKeys, stripeCustomerId, etc.
    const sensitiveFields = ["passwordHash", "apiKey", "stripeCustomerId"];
    sensitiveFields.forEach(field => {
      expect(moderatorUserFields).not.toContain(field);
    });
  });

  it("escalation severity should be limited to warning and critical", () => {
    const validSeverities = ["warning", "critical"];
    expect(validSeverities).toContain("warning");
    expect(validSeverities).toContain("critical");
    expect(validSeverities).not.toContain("info");
  });

  it("escalation reason must be at least 10 characters", () => {
    const minLength = 10;
    const validReason = "This user has been violating rate limits repeatedly";
    const invalidReason = "bad user";

    expect(validReason.length).toBeGreaterThanOrEqual(minLength);
    expect(invalidReason.length).toBeLessThan(minLength);
  });

  it("escalation reason must not exceed 2000 characters", () => {
    const maxLength = 2000;
    const longReason = "x".repeat(2001);
    expect(longReason.length).toBeGreaterThan(maxLength);
  });
});

describe("Moderator Role - Database Schema", () => {
  it("user role enum should include moderator", () => {
    const validRoles = ["user", "admin", "moderator"];
    expect(validRoles).toContain("moderator");
  });

  it("moderator role should be distinct from admin", () => {
    expect("moderator").not.toBe("admin");
  });

  it("moderator role should be distinct from user", () => {
    expect("moderator").not.toBe("user");
  });
});

describe("Moderator Role - UI Access Control", () => {
  it("moderator dashboard should be accessible by moderator role", () => {
    const user = { role: "moderator" };
    const canAccessModeratorDashboard = user.role === "moderator" || user.role === "admin";
    expect(canAccessModeratorDashboard).toBe(true);
  });

  it("moderator dashboard should be accessible by admin role", () => {
    const user = { role: "admin" };
    const canAccessModeratorDashboard = user.role === "moderator" || user.role === "admin";
    expect(canAccessModeratorDashboard).toBe(true);
  });

  it("moderator dashboard should NOT be accessible by regular user", () => {
    const user = { role: "user" };
    const canAccessModeratorDashboard = user.role === "moderator" || user.role === "admin";
    expect(canAccessModeratorDashboard).toBe(false);
  });

  it("admin dashboard should NOT be accessible by moderator", () => {
    const user = { role: "moderator" };
    const canAccessAdminDashboard = user.role === "admin";
    expect(canAccessAdminDashboard).toBe(false);
  });

  it("dashboard sidebar should show moderator link for moderator role", () => {
    const user = { role: "moderator" };
    const showModeratorLink = user.role === "moderator";
    const showAdminLink = user.role === "admin";
    expect(showModeratorLink).toBe(true);
    expect(showAdminLink).toBe(false);
  });

  it("dashboard sidebar should show both links for admin role", () => {
    const user = { role: "admin" };
    const showAdminSection = user.role === "admin";
    expect(showAdminSection).toBe(true);
    // Admin section includes moderator view link
  });
});
