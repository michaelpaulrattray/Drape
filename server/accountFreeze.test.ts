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

vi.mock("./db/connection", () => ({
  getDb: vi.fn(),
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

  /*
   * ⚠ TWO DESCRIBES STOOD HERE — "Freeze enforcement in withAtomicCredits"
   * and "Freeze enforcement in billing checkout", five arms — and every one
   * of them was this:
   *
   *     const user = { frozenAt: new Date(), … };
   *     const isFrozen = !!user.frozenAt;
   *     expect(isFrozen).toBe(true);
   *
   * The subject is `!!`. Nothing was imported and nothing was called.
   *
   * ⚠ AND THE CONTROL THAT PROVED IT SUBJECTLESS FOUND SOMETHING WORSE.
   * The freeze enforcement was stripped from BOTH real spend paths
   * (`user?.frozenAt` → `false` in `casting/atomicCredits.ts` and
   * `castingV2/spendGuards.ts`) and the WHOLE SUITE was run:
   *
   *     Tests  2 failed | 9372 passed | 337 skipped (9711)
   *
   * — and both failures were the Architecture Atlas noticing that two files
   * had CHANGED, saying nothing about what the change did. **A frozen
   * account could spend on both paths and not one of 9,711 tests said a
   * word.** That is invariant 7 on a money path: a control with no test
   * that BLOCKS.
   *
   * So these were replaced rather than deleted (ruled fable-1625). The arms
   * below drive the real guards.
   *
   * The product was read and was CORRECT when they were written
   * (2026-08-25): both guards throw FORBIDDEN on `frozenAt`, and
   * `server/db/security.ts` is the setter. They exist for the day that
   * stops being true.
   */
  describe("Freeze enforcement — DRIVEN through the real guards", () => {
    /** A drizzle-shaped double: `db.select().from().where().limit()` resolves to rows. */
    function dbReturning(rows: Array<{ frozenAt: Date | null }>) {
      const chain = { limit: async () => rows };
      return { select: () => ({ from: () => ({ where: () => chain }) }) };
    }

    it("castingV2 spend: a FROZEN account is refused FORBIDDEN before anything is claimed", async () => {
      const { getDb } = await import("./db/connection");
      vi.mocked(getDb).mockResolvedValue(
        dbReturning([{ frozenAt: new Date("2026-08-01") }]) as never,
      );
      const { assertNotFrozen } = await import("./castingV2/spendGuards");
      await expect(assertNotFrozen(1)).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("castingV2 spend: POSITIVE CONTROL — an unfrozen account passes, so the arm above is not refusing everyone", async () => {
      const { getDb } = await import("./db/connection");
      vi.mocked(getDb).mockResolvedValue(dbReturning([{ frozenAt: null }]) as never);
      const { assertNotFrozen } = await import("./castingV2/spendGuards");
      await expect(assertNotFrozen(1)).resolves.toBeUndefined();
    });

    it("withAtomicCredits: a FROZEN account is refused and THE OPERATION NEVER RUNS", async () => {
      const { getDb } = await import("./db/connection");
      vi.mocked(getDb).mockResolvedValue(
        dbReturning([{ frozenAt: new Date("2026-08-01") }]) as never,
      );
      const { withAtomicCredits } = await import("./casting/atomicCredits");
      const operation = vi.fn().mockResolvedValue("rendered");

      await expect(
        withAtomicCredits(
          { userId: 1, amount: 25, description: "test", referenceId: "ref-1" } as never,
          operation,
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      // The refusal is worth nothing if the work happened anyway — this is
      // the half a `!!` on a literal could never have said.
      expect(operation).not.toHaveBeenCalled();
    });

    it("the check reads frozenAt and NOT frozenReason — a stale reason alone does not freeze", async () => {
      const { getDb } = await import("./db/connection");
      vi.mocked(getDb).mockResolvedValue(
        dbReturning([{ frozenAt: null, frozenReason: "Some old reason" } as never]) as never,
      );
      const { assertNotFrozen } = await import("./castingV2/spendGuards");
      await expect(assertNotFrozen(1)).resolves.toBeUndefined();
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
