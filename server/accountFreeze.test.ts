import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { FREEZE_REASON_MAX_LENGTH, UNFREEZE_NOTES_MAX_LENGTH } from "../shared/inputLimits";

/**
 * THE ACCOUNT FREEZE — driven through the four real procedures (#697).
 *
 * ⚠ TWENTY-FOUR OF THIS FILE'S THIRTY-THREE ARMS COULD NOT FAIL, and the
 * card's reader saw four of them. The four it flagged called the MOCKED
 * `freezeUser` / `unfreezeUser` themselves and asserted the mock's own return
 * (shape 2). The twenty it could not see were this, under headings that named
 * the moderator workflow, the manual freeze, the admin freeze and the banner:
 *
 *     const user = { role: "admin" };
 *     const canFreeze = user.role !== "admin";
 *     expect(canFreeze).toBe(false);
 *
 * — a rule typed into the test and asserted against itself (shape 1). Nothing
 * was imported and nothing was called. The product could refuse nobody, prefix
 * nothing, and write no audit row, and every one of them stayed green.
 *
 * Measured before the repair (`scripts/_697-accountfreeze-sabotage-disposable.mts
 * --before`): the admin-target refusal, the already-frozen refusal, the
 * not-frozen refusal, both reason prefixes and both audit rows were each
 * removed from the product in turn, and the old suite reddened on NONE of them.
 *
 * What was DRIVEN before this repair, read at the tree rather than assumed:
 * the moderator's `freezeAccount` had two arms in
 * `discrepancyScanListOnly.test.ts` (the positive control and the admin-target
 * refusal) — not mirrored here. `unfreezeAccount`, `admin.users.freezeUser` and
 * `admin.users.unfreezeUser` had NO driven caller anywhere in the repository.
 *
 * Three things are deliberately absent:
 *   · The three "banner display" arms are DELETED, not rewritten. Their subject
 *     was `!!user.frozenAt` on a literal; the banner is a client component and
 *     this file is a server suite.
 *   · The role gates are driven ONCE per router (a user against the moderator
 *     road, a moderator against the admin road) — enough to prove each
 *     procedure is declared on the gate it claims; the gates themselves are
 *     `moderator.test.ts`'s and `adminUserManagement.test.ts`'s subject.
 *   · `server/db/security.ts`'s `freezeUser` / `unfreezeUser` writers are the
 *     far end here and are not driven: they need a database `vitest.setup.ts`
 *     strips on purpose. Stated rather than papered over.
 */

// ── The far end: the writers, the audit log, the notice, the admin log ──
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

// `AUDIT_ACTIONS` passes through — the action NAME an audit row carries is the
// product's, and a stubbed table would let the arms below drift from it.
vi.mock("./auditLog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./auditLog")>();
  return { ...actual, logAuditEvent: vi.fn().mockResolvedValue(undefined) };
});

vi.mock("./klaviyo", () => ({
  sendAccountFrozenEmail: vi.fn().mockResolvedValue(undefined),
}));

// The admin gate PASSES THROUGH (the moderator-refused arm drives it); only the
// two log writers are stubbed.
vi.mock("./security/adminSecurity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./security/adminSecurity")>();
  return {
    ...actual,
    logAdminAction: vi.fn().mockResolvedValue(undefined),
    writeImmutableLog: vi.fn().mockResolvedValue(undefined),
  };
});

// The moderator router's other imports — none of them on the freeze road.
vi.mock("./db/moderatorQueries", () => ({
  getUsersWithDiscrepancies: vi.fn(),
  getDetailedCreditHistory: vi.fn(),
  getDetailedGenerationHistory: vi.fn(),
}));
vi.mock("./db/discrepancyQueries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db/discrepancyQueries")>();
  return { ...actual, getUserRecordCosts: vi.fn(async () => ({ unlinkedCost: 0, operationCost: 0 })) };
});

import { logAuditEvent, AUDIT_ACTIONS } from "./auditLog";
import { sendAccountFrozenEmail } from "./klaviyo";
import { logAdminAction } from "./security/adminSecurity";
import { getDb } from "./db/connection";
import { moderatorReconciliationRouter } from "./routes/moderatorReconciliation";
import { usersRouter } from "./routes/admin/users";

/** A staff context. The admin gate reads role, email and openId; both gates read suspendedAt. */
function staffContext(role: "user" | "moderator" | "admin", id: number, name: string) {
  return {
    user: { id, role, email: `${role}${id}@example.com`, name, openId: null, suspendedAt: null, lockedUntil: null },
    req: { protocol: "https", headers: {}, socket: {} },
    res: { clearCookie: vi.fn() },
  } as never;
}
const MODERATOR = staffContext("moderator", 7, "Mod");
const ADMIN = staffContext("admin", 2, "Admin");
const PLAIN_USER = staffContext("user", 10, "User");

/** The moderator road reads its target with drizzle: `db.select().from().where().limit()` → rows. */
function dbReturning(rows: unknown[]) {
  const chain = { limit: async () => rows };
  return { select: () => ({ from: () => ({ where: () => chain }) }) };
}

const TARGET = { id: 42, frozenAt: null as Date | null, frozenReason: null as string | null, name: "Target", email: "target@example.com" as string | null, role: "user" };
const FROZEN_AT = new Date("2026-08-01T00:00:00Z");

/** One refusal, and the proof that nothing was written on the way to it. */
async function refused(call: Promise<unknown>, code: string) {
  await expect(call).rejects.toMatchObject({ code });
  expect(mockFreezeUser).not.toHaveBeenCalled();
  expect(mockUnfreezeUser).not.toHaveBeenCalled();
  expect(logAuditEvent).not.toHaveBeenCalled();
}

describe("moderatorReconciliation.freezeAccount — DRIVEN", () => {
  const caller = () => moderatorReconciliationRouter.createCaller(MODERATOR);
  beforeEach(() => {
    vi.clearAllMocks();
    mockFreezeUser.mockResolvedValue({ success: true });
    vi.mocked(getDb).mockResolvedValue(dbReturning([{ ...TARGET }]) as never);
  });

  it("a plain USER is refused FORBIDDEN — it is moderatorProcedure, driven not recited", async () => {
    const user = moderatorReconciliationRouter.createCaller(PLAIN_USER);
    await refused(user.freezeAccount({ userId: 42, reason: "x" }), "FORBIDDEN");
  });

  it("refuses a target that is already frozen, BAD_REQUEST, and writes nothing", async () => {
    vi.mocked(getDb).mockResolvedValue(dbReturning([{ ...TARGET, frozenAt: FROZEN_AT }]) as never);
    await refused(caller().freezeAccount({ userId: 42, reason: "again" }), "BAD_REQUEST");
  });

  it("refuses a target that does not exist, NOT_FOUND", async () => {
    vi.mocked(getDb).mockResolvedValue(dbReturning([]) as never);
    await refused(caller().freezeAccount({ userId: 999, reason: "x" }), "NOT_FOUND");
  });

  it("FROM THE DIFF — refuses an empty reason and one over FREEZE_REASON_MAX_LENGTH, before the database is read", async () => {
    for (const reason of ["", "a".repeat(FREEZE_REASON_MAX_LENGTH + 1)]) {
      await expect(caller().freezeAccount({ userId: 42, reason })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(getDb).not.toHaveBeenCalled();
    expect(mockFreezeUser).not.toHaveBeenCalled();
    // The bound is inclusive — the control that keeps the arm above from refusing everything.
    await expect(caller().freezeAccount({ userId: 42, reason: "a".repeat(FREEZE_REASON_MAX_LENGTH) })).resolves.toEqual({ success: true });
  });

  it("refuses a WHITESPACE-ONLY reason — a blank on record is not a reason (#816)", async () => {
    await expect(caller().freezeAccount({ userId: 42, reason: "   \n\t " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(getDb).not.toHaveBeenCalled();
    expect(mockFreezeUser).not.toHaveBeenCalled();
  });

  it("trims the reason it stores — surrounding whitespace never reaches the record or the notice (#816)", async () => {
    await caller().freezeAccount({ userId: 42, reason: "  repeated chargebacks  " });
    expect(mockFreezeUser).toHaveBeenCalledWith(42, "Manual freeze by moderator: repeated chargebacks", "7");
    expect(logAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ reason: "repeated chargebacks" }) }));
  });

  it("the audit row names the moderator, the target and the trigger — and carries the reason UNPREFIXED", async () => {
    await caller().freezeAccount({ userId: 42, reason: "repeated chargebacks" });
    expect(logAuditEvent).toHaveBeenCalledTimes(1);
    expect(logAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      action: AUDIT_ACTIONS.ACCOUNT_FROZEN,
      resourceType: "user",
      resourceId: "42",
      metadata: expect.objectContaining({
        reason: "repeated chargebacks",
        frozenBy: 7,
        frozenByName: "Mod",
        trigger: "moderator_manual",
        targetUserEmail: "target@example.com",
      }),
    }));
  });

  it("the notice to the customer carries the PREFIXED reason and the moderator's name", async () => {
    await caller().freezeAccount({ userId: 42, reason: "repeated chargebacks" });
    expect(sendAccountFrozenEmail).toHaveBeenCalledTimes(1);
    expect(sendAccountFrozenEmail).toHaveBeenCalledWith({
      userEmail: "target@example.com",
      userName: "Target",
      freezeReason: "Manual freeze by moderator: repeated chargebacks",
      frozenBy: "Mod",
    });
  });

  it("no email address, no notice — and the freeze still lands", async () => {
    vi.mocked(getDb).mockResolvedValue(dbReturning([{ ...TARGET, email: null }]) as never);
    await expect(caller().freezeAccount({ userId: 42, reason: "x" })).resolves.toEqual({ success: true });
    expect(sendAccountFrozenEmail).not.toHaveBeenCalled();
    expect(mockFreezeUser).toHaveBeenCalledWith(42, "Manual freeze by moderator: x", "7");
  });
});

describe("moderatorReconciliation.unfreezeAccount — DRIVEN, and nothing drove it before", () => {
  const caller = () => moderatorReconciliationRouter.createCaller(MODERATOR);
  beforeEach(() => {
    vi.clearAllMocks();
    mockUnfreezeUser.mockResolvedValue({ success: true });
    vi.mocked(getDb).mockResolvedValue(dbReturning([{ ...TARGET, frozenAt: FROZEN_AT }]) as never);
  });

  it("refuses a target that is NOT frozen, BAD_REQUEST, and writes nothing", async () => {
    vi.mocked(getDb).mockResolvedValue(dbReturning([{ ...TARGET }]) as never);
    await refused(caller().unfreezeAccount({ userId: 42, notes: "reviewed" }), "BAD_REQUEST");
  });

  it("refuses a target that does not exist, NOT_FOUND", async () => {
    vi.mocked(getDb).mockResolvedValue(dbReturning([]) as never);
    await refused(caller().unfreezeAccount({ userId: 999, notes: "reviewed" }), "NOT_FOUND");
  });

  it("FROM THE DIFF — refuses empty notes and notes over UNFREEZE_NOTES_MAX_LENGTH, before the database is read", async () => {
    for (const notes of ["", "a".repeat(UNFREEZE_NOTES_MAX_LENGTH + 1)]) {
      await expect(caller().unfreezeAccount({ userId: 42, notes })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(getDb).not.toHaveBeenCalled();
    expect(mockUnfreezeUser).not.toHaveBeenCalled();
    await expect(caller().unfreezeAccount({ userId: 42, notes: "a".repeat(UNFREEZE_NOTES_MAX_LENGTH) })).resolves.toEqual({ success: true });
  });

  it("refuses WHITESPACE-ONLY notes, and trims the notes it records (#816)", async () => {
    await expect(caller().unfreezeAccount({ userId: 42, notes: " \t " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockUnfreezeUser).not.toHaveBeenCalled();
    await caller().unfreezeAccount({ userId: 42, notes: "  reviewed  " });
    expect(logAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ reviewNotes: "reviewed" }) }));
  });

  it("POSITIVE — unfreezes by id, and the audit row carries the review notes and the moderator", async () => {
    await expect(caller().unfreezeAccount({ userId: 42, notes: "discrepancy explained" })).resolves.toEqual({ success: true });
    expect(mockUnfreezeUser).toHaveBeenCalledTimes(1);
    expect(mockUnfreezeUser).toHaveBeenCalledWith(42);
    expect(logAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      action: AUDIT_ACTIONS.ACCOUNT_UNFROZEN,
      resourceType: "user",
      resourceId: "42",
      metadata: expect.objectContaining({ reviewNotes: "discrepancy explained", unfrozenBy: 7, unfrozenByName: "Mod" }),
    }));
  });

  it("a database refusal surfaces as INTERNAL_SERVER_ERROR and writes no audit row", async () => {
    mockUnfreezeUser.mockResolvedValueOnce({ success: false, error: "User not found" });
    await expect(caller().unfreezeAccount({ userId: 42, notes: "reviewed" })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(logAuditEvent).not.toHaveBeenCalled();
  });
});

describe("admin.users.freezeUser — DRIVEN, and nothing drove it before", () => {
  const caller = () => usersRouter.createCaller(ADMIN);
  beforeEach(() => {
    vi.clearAllMocks();
    mockFreezeUser.mockResolvedValue({ success: true });
    mockGetUserById.mockResolvedValue({ id: 1, role: "user", email: "u@example.com", name: "User", frozenAt: null, frozenReason: null });
  });

  it("a MODERATOR is refused FORBIDDEN — it is adminProcedure, driven not recited", async () => {
    const mod = usersRouter.createCaller(MODERATOR);
    await expect(mod.freezeUser({ userId: 1, reason: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mockFreezeUser).not.toHaveBeenCalled();
    // The gate records the ATTEMPT — that is the one audit row a refusal may write,
    // and it is never the freeze's own.
    for (const call of vi.mocked(logAuditEvent).mock.calls) {
      expect(call[0].action).not.toBe(AUDIT_ACTIONS.ACCOUNT_FROZEN);
    }
  });

  it("refuses a target that does not exist, NOT_FOUND", async () => {
    mockGetUserById.mockResolvedValue(null);
    await refused(caller().freezeUser({ userId: 999, reason: "x" }), "NOT_FOUND");
  });

  it("refuses a target that is already frozen, BAD_REQUEST", async () => {
    mockGetUserById.mockResolvedValue({ id: 1, role: "user", email: "u@example.com", name: "User", frozenAt: FROZEN_AT });
    await refused(caller().freezeUser({ userId: 1, reason: "again" }), "BAD_REQUEST");
  });

  it("refuses to freeze ANOTHER admin, FORBIDDEN — and freezes nothing", async () => {
    mockGetUserById.mockResolvedValue({ id: 3, role: "admin", email: "other@example.com", name: "Other", frozenAt: null });
    await refused(caller().freezeUser({ userId: 3, reason: "x" }), "FORBIDDEN");
  });

  it("an admin may freeze THEMSELVES — the one admin target the rule allows", async () => {
    mockGetUserById.mockResolvedValue({ id: 2, role: "admin", email: "admin2@example.com", name: "Admin", frozenAt: null });
    await expect(caller().freezeUser({ userId: 2, reason: "stepping away" })).resolves.toEqual({ success: true });
    expect(mockFreezeUser).toHaveBeenCalledWith(2, "Admin freeze: stepping away", "2");
  });

  it("FROM THE DIFF — refuses an empty reason and one over FREEZE_REASON_MAX_LENGTH, before the target is read", async () => {
    for (const reason of ["", "a".repeat(FREEZE_REASON_MAX_LENGTH + 1)]) {
      await expect(caller().freezeUser({ userId: 1, reason })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(mockGetUserById).not.toHaveBeenCalled();
    expect(mockFreezeUser).not.toHaveBeenCalled();
    await expect(caller().freezeUser({ userId: 1, reason: "a".repeat(FREEZE_REASON_MAX_LENGTH) })).resolves.toEqual({ success: true });
  });

  it("refuses a WHITESPACE-ONLY reason, and trims the reason it stores (#816)", async () => {
    await expect(caller().freezeUser({ userId: 1, reason: "   " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockFreezeUser).not.toHaveBeenCalled();
    await caller().freezeUser({ userId: 1, reason: "  Billing investigation  " });
    expect(mockFreezeUser).toHaveBeenCalledWith(1, "Admin freeze: Billing investigation", "2");
  });

  it("the stored reason is PREFIXED 'Admin freeze:', and the audit row carries it unprefixed at WARNING under the admin trigger", async () => {
    await caller().freezeUser({ userId: 1, reason: "Billing investigation" });
    expect(mockFreezeUser).toHaveBeenCalledTimes(1);
    expect(mockFreezeUser).toHaveBeenCalledWith(1, "Admin freeze: Billing investigation", "2");
    expect(logAuditEvent).toHaveBeenCalledTimes(1);
    expect(logAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      userId: 2,
      action: AUDIT_ACTIONS.ACCOUNT_FROZEN,
      resourceType: "user",
      resourceId: "1",
      severity: "warning",
      metadata: expect.objectContaining({
        targetUserId: 1,
        targetUserEmail: "u@example.com",
        reason: "Billing investigation",
        frozenBy: 2,
        frozenByName: "Admin",
        trigger: "admin_manual",
      }),
    }));
  });

  it("the admin action log names the act and the target", async () => {
    await caller().freezeUser({ userId: 1, reason: "Billing investigation" });
    expect(logAdminAction).toHaveBeenCalledTimes(1);
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({
      adminId: 2,
      action: "freezeUser",
      targetType: "user",
      targetId: "1",
    }));
  });

  it("the notice to the customer carries the prefixed reason and the admin's name", async () => {
    await caller().freezeUser({ userId: 1, reason: "Billing investigation" });
    expect(sendAccountFrozenEmail).toHaveBeenCalledTimes(1);
    expect(sendAccountFrozenEmail).toHaveBeenCalledWith({
      userEmail: "u@example.com",
      userName: "User",
      freezeReason: "Admin freeze: Billing investigation",
      frozenBy: "Admin",
    });
  });
});

describe("admin.users.unfreezeUser — DRIVEN, and nothing drove it before", () => {
  const caller = () => usersRouter.createCaller(ADMIN);
  beforeEach(() => {
    vi.clearAllMocks();
    mockUnfreezeUser.mockResolvedValue({ success: true });
    mockGetUserById.mockResolvedValue({ id: 1, role: "user", email: "u@example.com", name: "User", frozenAt: FROZEN_AT, frozenReason: "Admin freeze: Billing investigation" });
  });

  it("refuses a target that is NOT frozen, BAD_REQUEST, and writes nothing", async () => {
    mockGetUserById.mockResolvedValue({ id: 1, role: "user", email: "u@example.com", name: "User", frozenAt: null, frozenReason: null });
    await refused(caller().unfreezeUser({ userId: 1, notes: "reviewed" }), "BAD_REQUEST");
  });

  it("refuses a target that does not exist, NOT_FOUND", async () => {
    mockGetUserById.mockResolvedValue(null);
    await refused(caller().unfreezeUser({ userId: 999, notes: "reviewed" }), "NOT_FOUND");
  });

  it("FROM THE DIFF — refuses empty notes, WHITESPACE-ONLY notes and notes over UNFREEZE_NOTES_MAX_LENGTH; trims what it records (#816)", async () => {
    for (const notes of ["", " \n ", "a".repeat(UNFREEZE_NOTES_MAX_LENGTH + 1)]) {
      await expect(caller().unfreezeUser({ userId: 1, notes })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(mockUnfreezeUser).not.toHaveBeenCalled();
    await expect(caller().unfreezeUser({ userId: 1, notes: "  cleared  " })).resolves.toEqual({ success: true });
    expect(logAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ reviewNotes: "cleared" }) }));
  });

  it("POSITIVE — unfreezes any frozen user, and the audit row carries the notes AND the reason it had been frozen for", async () => {
    await expect(caller().unfreezeUser({ userId: 1, notes: "cleared with billing" })).resolves.toEqual({ success: true });
    expect(mockUnfreezeUser).toHaveBeenCalledWith(1);
    expect(logAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      userId: 2,
      action: AUDIT_ACTIONS.ACCOUNT_UNFROZEN,
      resourceId: "1",
      severity: "info",
      metadata: expect.objectContaining({
        reviewNotes: "cleared with billing",
        previousReason: "Admin freeze: Billing investigation",
        unfrozenBy: 2,
      }),
    }));
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({ action: "unfreezeUser", targetId: "1" }));
  });

  it("a database refusal surfaces as INTERNAL_SERVER_ERROR and writes no audit row", async () => {
    mockUnfreezeUser.mockResolvedValueOnce({ success: false, error: "User not found" });
    await expect(caller().unfreezeUser({ userId: 1, notes: "reviewed" })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(logAuditEvent).not.toHaveBeenCalled();
    expect(logAdminAction).not.toHaveBeenCalled();
  });
});

describe("Account Freeze System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  /*
   * ⚠ "Auto-freeze trigger logic" STOOD HERE — six arms over a LOCAL
   * `shouldAutoFreeze(discrepancy, alreadyFrozen)` and a local `2000`. There is
   * no such function in the product, and now there is no such behaviour: the
   * discrepancy scan freezes nobody.
   *
   * It was removed on 2026-08-26 (#119) after it froze the founder's own
   * account for 22 hours on a formula that was two rulings out of date.
   * Founder ruling, Crew reply #5, verbatim:
   *
   *     "List-only. A control that can freeze a paying customer should have a
   *      person's name on it."
   *
   * So the arms below assert the ABSENCE at the source, which is the only
   * place an absence can be asserted — and with a positive control, because a
   * `not.toContain` over the wrong text is green about everything.
   */
  describe("The discrepancy scan freezes nobody — founder ruling (#119)", () => {
    const routeSource = fs.readFileSync(
      path.join(__dirname, "routes", "moderatorReconciliation.ts"),
      "utf8",
    );

    /** The `getFlaggedUsers` procedure body: from its key to the next one. */
    function getFlaggedUsersBody(): string {
      const start = routeSource.indexOf("getFlaggedUsers:");
      const end = routeSource.indexOf("getUserReconciliation:");
      expect(start).toBeGreaterThan(-1);
      expect(end).toBeGreaterThan(start);
      return routeSource.slice(start, end);
    }

    it("getFlaggedUsers does not freeze anyone — it is a READ", () => {
      expect(getFlaggedUsersBody()).not.toContain("freezeUser(");
    });

    it("POSITIVE CONTROL — the file still freezes, by a moderator's hand", () => {
      // Without this, the arm above passes on a file that was renamed, moved,
      // or emptied. `freezeAccount` is the manual road and it stays.
      expect(routeSource).toContain("freezeUser(");
      expect(routeSource).toContain("freezeAccount:");
      expect(routeSource).toContain("Manual freeze by moderator:");
    });

    it("POSITIVE CONTROL — the extracted slice is the procedure, not an empty string", () => {
      const body = getFlaggedUsersBody();
      expect(body.length).toBeGreaterThan(50);
      expect(body).toContain("getUsersWithDiscrepancies");
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
});
