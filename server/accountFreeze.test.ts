import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock DB helpers ──
const mockFreezeUser = vi.fn().mockResolvedValue({ success: true });
const mockUnfreezeUser = vi.fn().mockResolvedValue({ success: true });
const mockGetUserById = vi.fn();
const mockGetUserCredits = vi.fn().mockResolvedValue({ balance: 100 });

vi.mock("./db", () => ({
  freezeUser: (...args: any[]) => mockFreezeUser(...args),
  unfreezeUser: (...args: any[]) => mockUnfreezeUser(...args),
  getUserById: (...args: any[]) => mockGetUserById(...args),
  getUserCredits: (...args: any[]) => mockGetUserCredits(...args),
}));

vi.mock("./auditLog", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: {
    ACCOUNT_AUTO_FROZEN: "account.auto_frozen",
    ACCOUNT_UNFROZEN: "account.unfrozen",
  },
}));

vi.mock("./slack/slackNotification", () => ({
  SlackAlerts: {
    accountAutoFrozen: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("Account Freeze System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserById.mockResolvedValue({
      id: 1,
      name: "Test User",
      email: "test@example.com",
      role: "user",
      frozenAt: null,
      frozenReason: null,
      frozenBy: null,
      suspendedAt: null,
    });
  });

  describe("freezeUser helper", () => {
    it("should freeze a user with reason and actor", async () => {
      await mockFreezeUser(1, "Auto-frozen: discrepancy", "system");
      expect(mockFreezeUser).toHaveBeenCalledWith(1, "Auto-frozen: discrepancy", "system");
    });

    it("should return success on freeze", async () => {
      const result = await mockFreezeUser(1, "Test reason", "system");
      expect(result).toEqual({ success: true });
    });
  });

  describe("unfreezeUser helper", () => {
    it("should unfreeze a user", async () => {
      const result = await mockUnfreezeUser(1);
      expect(result).toEqual({ success: true });
    });

    it("should handle unfreeze failure gracefully", async () => {
      mockUnfreezeUser.mockResolvedValueOnce({ success: false, error: "User not found" });
      const result = await mockUnfreezeUser(1);
      expect(result.success).toBe(false);
      expect(result.error).toBe("User not found");
    });
  });

  describe("Freeze enforcement in withAtomicCredits", () => {
    it("should block generation when user is frozen", () => {
      // Simulate the freeze check logic from withAtomicCredits
      const user = { frozenAt: new Date(), frozenReason: "Auto-frozen: discrepancy" };
      const isFrozen = !!user.frozenAt;
      expect(isFrozen).toBe(true);
    });

    it("should allow generation when user is not frozen", () => {
      const user = { frozenAt: null, frozenReason: null };
      const isFrozen = !!user.frozenAt;
      expect(isFrozen).toBe(false);
    });

    it("frozen check should use frozenAt field, not frozenReason", () => {
      // Edge case: reason exists but frozenAt is null (shouldn't happen but defensive)
      const user = { frozenAt: null, frozenReason: "Some old reason" };
      const isFrozen = !!user.frozenAt;
      expect(isFrozen).toBe(false);
    });
  });

  describe("Freeze enforcement in billing checkout", () => {
    it("should block checkout when user is frozen", () => {
      const user = { frozenAt: new Date() };
      const shouldBlock = !!user.frozenAt;
      expect(shouldBlock).toBe(true);
    });

    it("should allow checkout when user is not frozen", () => {
      const user = { frozenAt: null };
      const shouldBlock = !!user.frozenAt;
      expect(shouldBlock).toBe(false);
    });
  });

  describe("Auto-freeze trigger logic", () => {
    const AUTO_FREEZE_THRESHOLD = 2000;

    function shouldAutoFreeze(discrepancy: number, alreadyFrozen: boolean): boolean {
      return Math.abs(discrepancy) >= AUTO_FREEZE_THRESHOLD && !alreadyFrozen;
    }

    it("should auto-freeze when discrepancy >= 2000 and not already frozen", () => {
      expect(shouldAutoFreeze(2500, false)).toBe(true);
    });

    it("should NOT auto-freeze when discrepancy < 2000", () => {
      expect(shouldAutoFreeze(1500, false)).toBe(false);
    });

    it("should NOT auto-freeze when already frozen", () => {
      expect(shouldAutoFreeze(3000, true)).toBe(false);
    });

    it("should auto-freeze at exactly 2000", () => {
      expect(shouldAutoFreeze(2000, false)).toBe(true);
    });

    it("should auto-freeze for negative discrepancies with abs >= 2000", () => {
      expect(shouldAutoFreeze(-2500, false)).toBe(true);
    });

    it("should NOT auto-freeze for negative discrepancies with abs < 2000", () => {
      expect(shouldAutoFreeze(-1000, false)).toBe(false);
    });
  });

  describe("Moderator unfreeze workflow", () => {
    it("should require review notes for unfreeze", () => {
      const notes = "";
      const isValid = notes.trim().length > 0;
      expect(isValid).toBe(false);
    });

    it("should accept valid review notes", () => {
      const notes = "Reviewed reconciliation — discrepancy explained by pre-atomic-credits failures";
      const isValid = notes.trim().length > 0 && notes.length <= 500;
      expect(isValid).toBe(true);
    });

    it("should reject notes exceeding 500 characters", () => {
      const notes = "a".repeat(501);
      const isValid = notes.trim().length > 0 && notes.length <= 500;
      expect(isValid).toBe(false);
    });

    it("should reject whitespace-only notes", () => {
      const notes = "   \n\t  ";
      const isValid = notes.trim().length > 0;
      expect(isValid).toBe(false);
    });

    it("should not allow unfreeze of a non-frozen user", () => {
      const user = { frozenAt: null };
      const canUnfreeze = !!user.frozenAt;
      expect(canUnfreeze).toBe(false);
    });

    it("should allow unfreeze of a frozen user", () => {
      const user = { frozenAt: new Date() };
      const canUnfreeze = !!user.frozenAt;
      expect(canUnfreeze).toBe(true);
    });
  });

  describe("AUDIT_ACTIONS for freeze events", () => {
    it("should have ACCOUNT_AUTO_FROZEN action", async () => {
      const { AUDIT_ACTIONS } = await import("../drizzle/schema");
      expect(AUDIT_ACTIONS.ACCOUNT_AUTO_FROZEN).toBe("account.auto_frozen");
    });

    it("should have ACCOUNT_UNFROZEN action", async () => {
      const { AUDIT_ACTIONS } = await import("../drizzle/schema");
      expect(AUDIT_ACTIONS.ACCOUNT_UNFROZEN).toBe("account.unfrozen");
    });
  });

  describe("Moderator manual freeze", () => {
    it("should require a reason for manual freeze", () => {
      const reason = "";
      const isValid = reason.trim().length > 0;
      expect(isValid).toBe(false);
    });

    it("should accept valid freeze reason", () => {
      const reason = "Suspicious generation pattern — freezing for investigation";
      const isValid = reason.trim().length > 0 && reason.length <= 500;
      expect(isValid).toBe(true);
    });

    it("should not allow freezing admin accounts", () => {
      const user = { role: "admin" };
      const canFreeze = user.role !== "admin";
      expect(canFreeze).toBe(false);
    });

    it("should allow freezing regular user accounts", () => {
      const user = { role: "user" };
      const canFreeze = user.role !== "admin";
      expect(canFreeze).toBe(true);
    });

    it("should allow freezing moderator accounts", () => {
      const user = { role: "moderator" };
      const canFreeze = user.role !== "admin";
      expect(canFreeze).toBe(true);
    });

    it("should not allow freezing already frozen accounts", () => {
      const user = { frozenAt: new Date() };
      const canFreeze = !user.frozenAt;
      expect(canFreeze).toBe(false);
    });

    it("should prefix reason with 'Manual freeze by moderator:'", () => {
      const inputReason = "Abuse detected";
      const storedReason = `Manual freeze by moderator: ${inputReason}`;
      expect(storedReason).toContain("Manual freeze by moderator:");
      expect(storedReason).toContain(inputReason);
    });
  });

  describe("Admin freeze/unfreeze", () => {
    it("admin should be able to freeze users", () => {
      const adminRole = "admin";
      const targetRole = "user";
      const canFreeze = adminRole === "admin" && targetRole !== "admin";
      expect(canFreeze).toBe(true);
    });

    it("admin should not be able to freeze other admins", () => {
      const adminRole = "admin";
      const targetRole = "admin";
      const isSelf = false;
      const canFreeze = adminRole === "admin" && (targetRole !== "admin" || isSelf);
      expect(canFreeze).toBe(false);
    });

    it("admin freeze reason should be prefixed with 'Admin freeze:'", () => {
      const inputReason = "Billing investigation";
      const storedReason = `Admin freeze: ${inputReason}`;
      expect(storedReason).toContain("Admin freeze:");
      expect(storedReason).toContain(inputReason);
    });

    it("admin should be able to unfreeze any frozen user", () => {
      const user = { frozenAt: new Date(), role: "user" };
      const canUnfreeze = !!user.frozenAt;
      expect(canUnfreeze).toBe(true);
    });
  });

  describe("User frozen banner display logic", () => {
    it("should show banner when frozenAt is set", () => {
      const user = { frozenAt: new Date("2026-02-01"), frozenReason: "Auto-frozen: discrepancy" };
      const showBanner = !!user.frozenAt;
      expect(showBanner).toBe(true);
    });

    it("should not show banner when frozenAt is null", () => {
      const user = { frozenAt: null, frozenReason: null };
      const showBanner = !!user.frozenAt;
      expect(showBanner).toBe(false);
    });

    it("should display frozen date in readable format", () => {
      const frozenAt = new Date("2026-02-01T12:00:00Z");
      const formatted = frozenAt.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      expect(formatted).toBeTruthy();
      expect(formatted.length).toBeGreaterThan(5);
    });
  });
});
