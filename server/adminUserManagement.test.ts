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

import {
  listAllUsers,
  getUserStatistics,
  adjustUserCredits,
  getUserById,
} from "./db";
import { logAuditEvent, getFilteredAuditLogs } from "./auditLog";

/**
 * THE FOUR ADMIN READS — driven through the real procedures (#697).
 *
 * ⚠ FIFTEEN ARMS STOOD HERE AND NOT ONE COULD FAIL. Five describes — `listAllUsers`,
 * `getUserStatistics`, `getUserFullDetails`, `adjustUserCredits`, `getUserActivity` —
 * each called the MOCKED db helper itself and asserted the mock's own return
 * (shape 2 of the class): `vi.mocked(listAllUsers).mockResolvedValue(X); const r =
 * await listAllUsers(...); expect(r).toEqual(X)`. Nothing under `server/routes`
 * ran. Every filter the arms named ("should filter by role") was a string typed
 * into a mock call and read back out of it. This file mocks `./db`, so the
 * card's own reader should have flagged it and did not — recorded on #697.
 *
 * What is DRIVEN now, and where:
 *   · the PROJECTIONS of `listUsers` and `getUserFullDetails` are
 *     `adminUserProjection.test.ts`'s subject (#700) — not repeated here;
 *   · the FILTERS of `listUsers` — that what an admin types reaches the db
 *     helper, and that the declared defaults and bounds hold — are here;
 *   · `getUserStats` and `getUserActivity`, which had no driven caller
 *     anywhere in the repository, are here: the gate, the pass-through, the
 *     declared bounds, and a positive control each;
 *   · `adjustCredits` keeps its own driven describe at the foot of the file.
 *
 * The db helpers themselves are the far end and are not driven: they need a
 * database `vitest.setup.ts` strips on purpose. Stated, not papered over.
 */
describe("the admin READS — driven, not recited (#697)", () => {
  const ADMIN = {
    user: { id: 2, role: "admin", email: "admin@example.com", name: "Admin", openId: null, suspendedAt: null },
    req: { headers: {}, socket: {} },
  } as never;
  const MODERATOR = {
    user: { id: 10, role: "moderator", email: "mod@x", name: "Mod", openId: null, suspendedAt: null },
    req: { headers: {}, socket: {} },
  } as never;

  async function admin() {
    const { usersRouter } = await import("./routes/admin/users");
    return usersRouter.createCaller(ADMIN);
  }
  async function moderator() {
    const { usersRouter } = await import("./routes/admin/users");
    return usersRouter.createCaller(MODERATOR);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listAllUsers).mockResolvedValue({ users: [], total: 0 } as never);
    vi.mocked(getUserStatistics).mockResolvedValue({ total: 3, active: 2, suspended: 1, frozen: 0, admins: 1, moderators: 0 } as never);
    vi.mocked(getFilteredAuditLogs).mockResolvedValue({ logs: [], total: 0 } as never);
  });

  describe("admin.listUsers — the filters reach the helper", () => {
    it("with NO input, the declared defaults reach the helper (20 / 0 / all / all / createdAt desc)", async () => {
      await (await admin()).listUsers();
      expect(listAllUsers).toHaveBeenCalledWith({
        limit: 20, offset: 0, search: undefined, status: "all", role: "all", sortBy: "createdAt", sortOrder: "desc",
      });
    });

    it("every filter an admin types is passed through by name — search, status, role, sort, page", async () => {
      await (await admin()).listUsers({
        limit: 50, offset: 100, search: "ada", status: "suspended", role: "moderator", sortBy: "name", sortOrder: "asc",
      });
      expect(listAllUsers).toHaveBeenCalledWith({
        limit: 50, offset: 100, search: "ada", status: "suspended", role: "moderator", sortBy: "name", sortOrder: "asc",
      });
    });

    it("the page size is bounded 1..100 and a status or role outside the declared set is refused — before the helper", async () => {
      const caller = await admin();
      await expect(caller.listUsers({ limit: 101 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(caller.listUsers({ limit: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(caller.listUsers({ offset: -1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(caller.listUsers({ status: "banned" } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(caller.listUsers({ role: "owner" } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(listAllUsers).not.toHaveBeenCalled();
      // POSITIVE CONTROL — the boundary itself is accepted.
      await expect(caller.listUsers({ limit: 100 })).resolves.toBeDefined();
    });

    it("the helper's TOTAL rides through untouched — the pager's number is the database's", async () => {
      vi.mocked(listAllUsers).mockResolvedValue({ users: [], total: 4321 } as never);
      await expect((await admin()).listUsers()).resolves.toMatchObject({ users: [], total: 4321 });
    });

    it("a MODERATOR is refused the whole read — adminProcedure, driven", async () => {
      await expect((await moderator()).listUsers()).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(listAllUsers).not.toHaveBeenCalled();
    });
  });

  describe("admin.getUserStats — the dashboard numbers", () => {
    it("hands the helper's summary back whole, and calls it once", async () => {
      await expect((await admin()).getUserStats()).resolves.toEqual({
        total: 3, active: 2, suspended: 1, frozen: 0, admins: 1, moderators: 0,
      });
      expect(getUserStatistics).toHaveBeenCalledTimes(1);
    });

    it("a MODERATOR is refused — adminProcedure, driven", async () => {
      await expect((await moderator()).getUserStats()).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(getUserStatistics).not.toHaveBeenCalled();
    });
  });

  describe("admin.getUserActivity — one account's audit rows", () => {
    it("scopes the audit read to the named user, with the declared defaults (50 / 0)", async () => {
      await (await admin()).getUserActivity({ userId: 42 });
      expect(getFilteredAuditLogs).toHaveBeenCalledWith({ userId: 42, limit: 50, offset: 0 });
    });

    it("passes a typed page through, and refuses one outside 1..100 before the read", async () => {
      const caller = await admin();
      await caller.getUserActivity({ userId: 42, limit: 10, offset: 30 });
      expect(getFilteredAuditLogs).toHaveBeenCalledWith({ userId: 42, limit: 10, offset: 30 });
      await expect(caller.getUserActivity({ userId: 42, limit: 101 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(caller.getUserActivity({ userId: 42, offset: -1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(getFilteredAuditLogs).toHaveBeenCalledTimes(1);
    });

    it("hands the reader's rows and total back whole", async () => {
      const rows = [{ id: 9, action: "ACCOUNT_SUSPENDED", userId: 2, resourceId: "42" }];
      vi.mocked(getFilteredAuditLogs).mockResolvedValue({ logs: rows, total: 1 } as never);
      await expect((await admin()).getUserActivity({ userId: 42 })).resolves.toEqual({ logs: rows, total: 1 });
    });

    it("a MODERATOR is refused — adminProcedure, driven", async () => {
      await expect((await moderator()).getUserActivity({ userId: 42 })).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(getFilteredAuditLogs).not.toHaveBeenCalled();
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

  it("a successful adjustment writes the AUDIT ROW — what the deleted mock-asserting arm was reaching for", async () => {
    const caller = (await router()).createCaller(ADMIN_CTX);
    await caller.adjustCredits({ userId: 1, amount: 100, reason: "Bonus credits" });
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: "credits",
        resourceId: "1",
        metadata: expect.objectContaining({ amount: 100, reason: "Bonus credits" }),
      }),
    );
  });
});
