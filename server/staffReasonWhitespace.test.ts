import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  IP_BLOCK_REASON_MAX_LENGTH,
  ROLE_CHANGE_REASON_MAX_LENGTH,
  SUSPEND_REASON_MAX_LENGTH,
} from "../shared/inputLimits";

/**
 * STAFF REASONS REFUSE WHITESPACE-ONLY — suspend, role change, IP block (#816).
 *
 * The class (#816, from PR #814's reviewer): a staff free-text reason declared
 * `z.string().min(1)` and never trimmed, so `" "` passed the non-empty check
 * and landed blank on the record, the audit row and the immutable log. The
 * four freeze roads were fixed in #818; these three were its law-7 sweep,
 * filed rather than folded in because NONE of them had a driven arm to carry
 * a reproduction — `suspendUser` and `blockIP` had no `createCaller` anywhere
 * in the suite, and `changeUserRole`'s driven arms (`roleManagement.test.ts`)
 * never sent a blank.
 *
 * Every arm here goes through the real router: the admin gate passes through,
 * only the far end (the db writer, the three log writers, the customer email)
 * is stubbed. The cap arms read the SHARED constant, because a hand-typed 500
 * beside `shared/inputLimits.ts` is the drift that file's header names — and
 * the three routers hand-typed it until this card.
 *
 * Each of the three "refuses whitespace-only" arms was RED on the unfixed
 * product (`.min(1)` without `.trim()`), and each "trims before the writer"
 * arm was red too — the writer received the padded string. Green after.
 */

const mockSuspendUser = vi.fn().mockResolvedValue({ success: true });
const mockUpdateUserRole = vi.fn().mockResolvedValue({ success: true, previousRole: "user" });
const mockBlockIp = vi.fn().mockResolvedValue({ success: true });
const mockUnblockIp = vi.fn().mockResolvedValue({ success: true, removed: 1 });
const mockGetUserById = vi.fn();

vi.mock("./db", () => ({
  suspendUser: (...args: any[]) => mockSuspendUser(...args),
  updateUserRole: (...args: any[]) => mockUpdateUserRole(...args),
  blockIp: (...args: any[]) => mockBlockIp(...args),
  unblockIp: (...args: any[]) => mockUnblockIp(...args),
  getUserById: (...args: any[]) => mockGetUserById(...args),
}));

vi.mock("./db/connection", () => ({ getDb: vi.fn() }));

vi.mock("./auditLog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./auditLog")>();
  return { ...actual, logAuditEvent: vi.fn().mockResolvedValue(undefined) };
});

vi.mock("./klaviyo", () => ({
  sendAccountFrozenEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./security/adminSecurity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./security/adminSecurity")>();
  return {
    ...actual,
    logAdminAction: vi.fn().mockResolvedValue(undefined),
    writeImmutableLog: vi.fn().mockResolvedValue(undefined),
  };
});

import { logAuditEvent } from "./auditLog";
import { logAdminAction, writeImmutableLog } from "./security/adminSecurity";
import { usersRouter } from "./routes/admin/users";
import { rolesRouter } from "./routes/admin/roles";
import { ipBlockingRouter } from "./routes/admin/ipBlocking";

const ADMIN = {
  user: { id: 2, role: "admin", email: "admin2@example.com", name: "Admin", openId: null, suspendedAt: null, lockedUntil: null },
  req: { protocol: "https", headers: {}, socket: {} },
  res: { clearCookie: vi.fn() },
} as never;

const TARGET = { id: 42, role: "user", email: "target@example.com", name: "Target" };

/** A padded reason: the trimmed core is what every writer must receive. */
const PADDED = "  Abusive to other customers \t\n";
const CORE = "Abusive to other customers";

beforeEach(() => {
  vi.clearAllMocks();
  mockSuspendUser.mockResolvedValue({ success: true });
  mockUpdateUserRole.mockResolvedValue({ success: true, previousRole: "user" });
  mockBlockIp.mockResolvedValue({ success: true });
  mockUnblockIp.mockResolvedValue({ success: true, removed: 1 });
  mockGetUserById.mockResolvedValue(TARGET);
});

// ── admin.users.suspendUser ─────────────────────────────────────────────────

describe("admin.users.suspendUser — the reason", () => {
  const caller = () => usersRouter.createCaller(ADMIN);

  it("refuses a whitespace-only reason before the writer, the audit row and the immutable log", async () => {
    await expect(caller().suspendUser({ userId: 42, reason: " \t " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mockSuspendUser).not.toHaveBeenCalled();
    expect(logAuditEvent).not.toHaveBeenCalled();
    expect(logAdminAction).not.toHaveBeenCalled();
    expect(writeImmutableLog).not.toHaveBeenCalled();
  });

  it("trims surrounding whitespace before the writer, the audit row, the admin log and the immutable log", async () => {
    await expect(caller().suspendUser({ userId: 42, reason: PADDED })).resolves.toEqual({ success: true });
    expect(mockSuspendUser).toHaveBeenCalledWith(42, CORE, 2);
    expect(logAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ reason: CORE }) }));
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({ details: expect.stringContaining(`Reason: ${CORE}`) }));
    expect(writeImmutableLog).toHaveBeenCalledWith("user_suspended", expect.objectContaining({ reason: CORE }));
  });

  it(`caps the reason at SUSPEND_REASON_MAX_LENGTH (${SUSPEND_REASON_MAX_LENGTH}) — the shared constant, not a hand-typed number`, async () => {
    await expect(caller().suspendUser({ userId: 42, reason: "x".repeat(SUSPEND_REASON_MAX_LENGTH) })).resolves.toBeDefined();
    await expect(caller().suspendUser({ userId: 42, reason: "x".repeat(SUSPEND_REASON_MAX_LENGTH + 1) })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mockSuspendUser).toHaveBeenCalledTimes(1);
  });
});

// ── admin.roles.changeUserRole ──────────────────────────────────────────────

describe("rolesRouter.changeUserRole — the reason", () => {
  const caller = () => rolesRouter.createCaller(ADMIN);

  it("refuses a whitespace-only reason before the writer and the logs", async () => {
    await expect(caller().changeUserRole({ userId: 42, newRole: "moderator", reason: "   " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mockUpdateUserRole).not.toHaveBeenCalled();
    expect(logAuditEvent).not.toHaveBeenCalled();
    expect(logAdminAction).not.toHaveBeenCalled();
    expect(writeImmutableLog).not.toHaveBeenCalled();
  });

  it("trims surrounding whitespace before the audit row, the admin log and the immutable log", async () => {
    await expect(caller().changeUserRole({ userId: 42, newRole: "moderator", reason: PADDED })).resolves.toBeDefined();
    expect(mockUpdateUserRole).toHaveBeenCalledWith(42, "moderator", 2);
    expect(logAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ reason: CORE }) }));
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({ details: expect.stringContaining(`Reason: ${CORE}`) }));
    expect(writeImmutableLog).toHaveBeenCalledWith("role_changed", expect.objectContaining({ reason: CORE }));
  });

  it(`caps the reason at ROLE_CHANGE_REASON_MAX_LENGTH (${ROLE_CHANGE_REASON_MAX_LENGTH})`, async () => {
    await expect(
      caller().changeUserRole({ userId: 42, newRole: "moderator", reason: "x".repeat(ROLE_CHANGE_REASON_MAX_LENGTH) }),
    ).resolves.toBeDefined();
    await expect(
      caller().changeUserRole({ userId: 42, newRole: "moderator", reason: "x".repeat(ROLE_CHANGE_REASON_MAX_LENGTH + 1) }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockUpdateUserRole).toHaveBeenCalledTimes(1);
  });
});

// ── admin.ipBlocking.blockIP ────────────────────────────────────────────────

describe("ipBlockingRouter.blockIP — the reason and the address", () => {
  const caller = () => ipBlockingRouter.createCaller(ADMIN);

  it("refuses a whitespace-only reason before the writer and the logs", async () => {
    await expect(caller().blockIP({ ipAddress: "203.0.113.9", reason: "\n\n" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mockBlockIp).not.toHaveBeenCalled();
    expect(logAuditEvent).not.toHaveBeenCalled();
    expect(logAdminAction).not.toHaveBeenCalled();
    expect(writeImmutableLog).not.toHaveBeenCalled();
  });

  it("refuses a whitespace-only ADDRESS — a block on ' ' is a row that can never match a request", async () => {
    await expect(caller().blockIP({ ipAddress: "   ", reason: "credential stuffing" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mockBlockIp).not.toHaveBeenCalled();
  });

  it("trims the reason AND the address before the writer, the audit row, the admin log and the immutable log", async () => {
    await expect(caller().blockIP({ ipAddress: " 203.0.113.9 ", reason: PADDED })).resolves.toEqual({ success: true });
    expect(mockBlockIp).toHaveBeenCalledWith("203.0.113.9", CORE, 2, null);
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: "203.0.113.9", metadata: expect.objectContaining({ reason: CORE }) }),
    );
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ targetId: "203.0.113.9", details: expect.stringContaining(`Reason: ${CORE}`) }),
    );
    expect(writeImmutableLog).toHaveBeenCalledWith(
      "ip_blocked",
      expect.objectContaining({ ipAddress: "203.0.113.9", reason: CORE }),
    );
  });

  it(`caps the reason at IP_BLOCK_REASON_MAX_LENGTH (${IP_BLOCK_REASON_MAX_LENGTH})`, async () => {
    await expect(caller().blockIP({ ipAddress: "203.0.113.9", reason: "x".repeat(IP_BLOCK_REASON_MAX_LENGTH) })).resolves.toBeDefined();
    await expect(
      caller().blockIP({ ipAddress: "203.0.113.9", reason: "x".repeat(IP_BLOCK_REASON_MAX_LENGTH + 1) }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockBlockIp).toHaveBeenCalledTimes(1);
  });

  it("unblockIP refuses a whitespace-only address and trims a padded one — so a block made through this road can be lifted through it", async () => {
    await expect(caller().unblockIP({ ipAddress: " 	" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockUnblockIp).not.toHaveBeenCalled();
    await expect(caller().unblockIP({ ipAddress: " 203.0.113.9 " })).resolves.toEqual({ success: true });
    expect(mockUnblockIp).toHaveBeenCalledWith("203.0.113.9");
    expect(logAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ resourceId: "203.0.113.9" }));
  });

  it("unblockIP refuses NOT_FOUND when the address matched no row — and writes no log claiming otherwise (PR #820 review)", async () => {
    mockUnblockIp.mockResolvedValue({ success: true, removed: 0 });
    await expect(caller().unblockIP({ ipAddress: "198.51.100.4" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mockUnblockIp).toHaveBeenCalledWith("198.51.100.4");
    expect(logAuditEvent).not.toHaveBeenCalled();
    expect(logAdminAction).not.toHaveBeenCalled();
    expect(writeImmutableLog).not.toHaveBeenCalled();
  });

  it("the four edited schemas are strict — an undeclared key is refused, not dropped (PR #820 review, invariant 4)", async () => {
    await expect(usersRouter.createCaller(ADMIN).suspendUser({ userId: 42, reason: "abuse", extra: 1 } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(rolesRouter.createCaller(ADMIN).changeUserRole({ userId: 42, newRole: "moderator", reason: "trusted", extra: 1 } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller().blockIP({ ipAddress: "203.0.113.9", reason: "stuffing", extra: 1 } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller().unblockIP({ ipAddress: "203.0.113.9", extra: 1 } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockSuspendUser).not.toHaveBeenCalled();
    expect(mockUpdateUserRole).not.toHaveBeenCalled();
    expect(mockBlockIp).not.toHaveBeenCalled();
    expect(mockUnblockIp).not.toHaveBeenCalled();
  });
});
