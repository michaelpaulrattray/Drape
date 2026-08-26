/**
 * THE DISCREPANCY SCAN IS A READ — driven through the real router.
 *
 * Until 2026-08-26 `moderatorReconciliation.getFlaggedUsers` — a tRPC QUERY
 * that runs whenever the moderator dashboard's flagged card loads — froze
 * every listed account at |discrepancy| >= 2000. Its formula was two rulings
 * out of date, so it froze the founder's own account for 22 hours (#119).
 *
 * Founder ruling, Crew reply #5, verbatim:
 *   "List-only. A control that can freeze a paying customer should have a
 *    person's name on it."
 *
 * This suite is the test the model cannot rescue (working law 3): the scan is
 * handed a user 50× over the old freeze threshold and the freeze spy must
 * stay silent. The POSITIVE control is the moderator's own Freeze button,
 * which must reach the same spy — so silence on the scan is a fact about the
 * scan and not about a spy that cannot see.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { freezeUser, getUsersWithDiscrepancies, targetRow } = vi.hoisted(() => ({
  freezeUser: vi.fn(async () => ({ success: true })),
  getUsersWithDiscrepancies: vi.fn(),
  /** A drizzle-shaped double's one row — the SELECT the manual freeze makes. */
  targetRow: { frozenAt: null as Date | null, name: "Target", email: "target@example.com", role: "user" },
}));

vi.mock("./db", () => ({
  freezeUser,
  unfreezeUser: vi.fn(async () => ({ success: true })),
}));

vi.mock("./db/moderatorQueries", () => ({
  getUsersWithDiscrepancies,
  getDetailedCreditHistory: vi.fn(),
  getDetailedGenerationHistory: vi.fn(),
}));

vi.mock("./db/discrepancyQueries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db/discrepancyQueries")>();
  return { ...actual, getUserRecordCosts: vi.fn(async () => ({ unlinkedCost: 0, operationCost: 0 })) };
});

vi.mock("./auditLog", () => ({
  logAuditEvent: vi.fn(async () => undefined),
  AUDIT_ACTIONS: { ACCOUNT_AUTO_FROZEN: "account.auto_frozen", ACCOUNT_FROZEN: "account.frozen", ACCOUNT_UNFROZEN: "account.unfrozen" },
}));

vi.mock("./slack/slackNotification", () => ({
  SlackAlerts: { accountFrozenByStaff: vi.fn(async () => undefined) },
}));

vi.mock("./klaviyo", () => ({
  sendAccountFrozenEmail: vi.fn(async () => undefined),
}));

vi.mock("./db/connection", () => ({
  getDb: vi.fn(async () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [targetRow],
        }),
      }),
    }),
  })),
}));

import { moderatorReconciliationRouter } from "./routes/moderatorReconciliation";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function moderatorContext(): TrpcContext {
  const user = {
    id: 7,
    openId: "mod-open-id",
    email: "mod@example.com",
    name: "Mod",
    displayName: null,
    avatarUrl: null,
    avatarKey: null,
    bannerUrl: null,
    bannerKey: null,
    bio: null,
    loginMethod: "email",
    approved: true,
    role: "moderator",
    storageUsed: 0,
    storageLimit: 104857600,
    suspendedAt: null,
    suspendedReason: null,
    suspendedBy: null,
    frozenAt: null,
    frozenReason: null,
    frozenBy: null,
    referralCode: null,
    referredByUserId: null,
    accessCode: null,
    approvedAt: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as unknown as AuthenticatedUser;
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

const FAR_OVER_THE_OLD_THRESHOLD = 100_000;

describe("moderatorReconciliation.getFlaggedUsers is list-only", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    targetRow.frozenAt = null;
    targetRow.role = "user";
  });

  it("lists a user 50× over the old freeze threshold and freezes nobody", async () => {
    const scan = {
      users: [
        {
          userId: 1,
          userName: "Founder",
          email: "founder@example.com",
          grossDeductions: 112_655,
          totalRefunds: 9_750,
          netCost: 102_905,
          completedCost: 94_470,
          pendingCost: 930,
          failedCost: 10_730,
          unlinkedCost: 0,
          operationCost: 12_655,
          expectedCost: 12_655,
          discrepancy: FAR_OVER_THE_OLD_THRESHOLD,
          totalGenerations: 1_993,
          failedGenerations: 63,
        },
      ],
      scannedCount: 4,
    };
    getUsersWithDiscrepancies.mockResolvedValueOnce(scan);

    const caller = moderatorReconciliationRouter.createCaller(moderatorContext());
    const result = await caller.getFlaggedUsers({ threshold: 50 });

    expect(getUsersWithDiscrepancies).toHaveBeenCalledWith(50);
    expect(result).toEqual(scan);
    expect(freezeUser).not.toHaveBeenCalled();
  });

  it("POSITIVE CONTROL — the moderator's own Freeze button reaches the same spy, with the moderator's id on it", async () => {
    const caller = moderatorReconciliationRouter.createCaller(moderatorContext());
    await caller.freezeAccount({ userId: 42, reason: "repeated chargebacks" });

    expect(freezeUser).toHaveBeenCalledTimes(1);
    expect(freezeUser).toHaveBeenCalledWith(42, "Manual freeze by moderator: repeated chargebacks", "7");
  });

  it("the manual freeze still refuses an admin account", async () => {
    targetRow.role = "admin";
    const caller = moderatorReconciliationRouter.createCaller(moderatorContext());
    await expect(caller.freezeAccount({ userId: 1, reason: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(freezeUser).not.toHaveBeenCalled();
  });
});
