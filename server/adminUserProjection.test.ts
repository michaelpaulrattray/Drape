/*
 * THE ADMIN HALF OF #700 — the two reads that build their response from a
 * spread of a database row, driven through the REAL `usersRouter`.
 *
 * ⚠ WHY A NEW FILE RATHER THAN AN ARM IN `adminUserManagement.test.ts`:
 * that file is a live instance of #681's shape 2. It mocks `./db`, then calls
 * the mock ITSELF and asserts its own fixture —
 *
 *     vi.mocked(getUserFullDetails).mockResolvedValue({ user: { id: 1, … } });
 *     const result = await getUserFullDetails(1);
 *     expect(result?.user.id).toBe(1);
 *
 * No line of `usersRouter` runs in that, so the admin projection has never
 * been exercised anywhere in this repository. Delete the procedure and those
 * arms stay green. They are left alone here (that file is #697's population,
 * and this shift is not rewriting it) — but nothing in it can stand as this
 * fix's proof, so the proof is written where it can fail.
 *
 * THE FIXTURE SEEDS THE FORBIDDEN SIX ON PURPOSE. An assertion that a staff
 * wire omits `passwordHash` is worthless over a row that never held one — the
 * PR #698 round-2 lesson. Seeded, a spread regression reddens; the sabotage
 * receipt is `scripts/_700-sabotage-disposable.mts`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./auditLog", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: {},
}));
vi.mock("./klaviyo", () => ({ sendAccountFrozenEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./security/adminSecurity", () => ({
  logAdminAction: vi.fn().mockResolvedValue(undefined),
  writeImmutableLog: vi.fn().mockResolvedValue(undefined),
  validateAdminAccess: vi.fn().mockReturnValue({ allowed: true }),
  logUnauthorizedAdminAccess: vi.fn().mockResolvedValue(undefined),
}));

/* The six a staff wire must never carry, seeded into both rows below. */
const FORBIDDEN = {
  passwordHash: "seeded-forbidden-hash",
  apiKey: "seeded-forbidden-key",
  stripeCustomerId: "cus_seededforbidden",
  masterPrompt: "seeded forbidden master prompt",
  technicalSchema: { seeded: "forbidden" },
  preferences: { seeded: "forbidden" },
};

vi.mock("./db", () => ({
  /* Mirrors `listAllUsers`' own select (`server/db/admin.ts`) field for field. */
  listAllUsers: vi.fn().mockResolvedValue({
    users: [
      {
        id: 42,
        openId: "open-42",
        name: "Test User",
        email: "test@example.com",
        avatarUrl: "https://example.test/a.png",
        role: "user",
        suspendedAt: null,
        suspendedReason: null,
        frozenAt: null,
        lockedUntil: null,
        createdAt: new Date("2025-06-01"),
        lastSignedIn: new Date("2026-01-15"),
        passwordHash: "seeded-forbidden-hash",
        apiKey: "seeded-forbidden-key",
        stripeCustomerId: "cus_seededforbidden",
        masterPrompt: "seeded forbidden master prompt",
        technicalSchema: { seeded: "forbidden" },
        preferences: { seeded: "forbidden" },
      },
    ],
    total: 1,
  }),
  /* Mirrors `getUserFullDetails`' own returned object. */
  getUserFullDetails: vi.fn().mockResolvedValue({
    user: {
      id: 42,
      openId: "open-42",
      name: "Test User",
      displayName: "Testy",
      email: "test@example.com",
      avatarUrl: "https://example.test/a.png",
      bannerUrl: null,
      bio: null,
      role: "user",
      storageUsed: 1024,
      storageLimit: 104857600,
      suspendedAt: null,
      suspendedReason: null,
      suspendedBy: null,
      frozenAt: null,
      frozenReason: null,
      frozenBy: null,
      lockedUntil: null,
      failedLoginAttempts: 0,
      createdAt: new Date("2025-06-01"),
      lastSignedIn: new Date("2026-01-15"),
      passwordHash: "seeded-forbidden-hash",
      apiKey: "seeded-forbidden-key",
      stripeCustomerId: "cus_seededforbidden",
      masterPrompt: "seeded forbidden master prompt",
      technicalSchema: { seeded: "forbidden" },
      preferences: { seeded: "forbidden" },
    },
    credits: { balance: 500 },
    stats: { totalModels: 5, totalGenerations: 50 },
  }),
}));

const { usersRouter } = await import("./routes/admin/users");

/* `adminProcedure` checks role/allowlist FIRST and suspension SECOND, so
   `suspendedAt` is part of the caller rather than an afterthought. */
const ADMIN = {
  id: 1,
  role: "admin",
  suspendedAt: null,
  email: "a@example.com",
  name: "Admin",
  openId: "open-1",
};
const caller = () => usersRouter.createCaller({ user: ADMIN } as never);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("#700 — the admin user reads project explicitly", () => {
  it("listUsers hands back the projection the ROUTER builds, whole", async () => {
    const result = await caller().listUsers();
    /* Asserted WHOLE, not as six `not.toContain` checks: a column added to
       `listAllUsers`' select upstream must redden here too, which is the half
       a forbidden-list can never see. */
    expect(result.users[0]).toEqual({
      id: 42,
      openId: "open-42",
      name: "Test User",
      email: "test@example.com",
      avatarUrl: "https://example.test/a.png",
      role: "user",
      suspendedReason: null,
      suspendedAt: null,
      frozenAt: null,
      lockedUntil: null,
      createdAt: "2025-06-01T00:00:00.000Z",
      lastSignedIn: "2026-01-15T00:00:00.000Z",
    });
    expect(result.total).toBe(1);
  });

  it("getUserFullDetails hands back the projection the ROUTER builds, whole", async () => {
    const result = await caller().getUserFullDetails({ userId: 42 });
    expect(result).not.toBeNull();
    expect(result!.user).toEqual({
      id: 42,
      openId: "open-42",
      name: "Test User",
      displayName: "Testy",
      email: "test@example.com",
      avatarUrl: "https://example.test/a.png",
      bannerUrl: null,
      bio: null,
      role: "user",
      storageUsed: 1024,
      storageLimit: 104857600,
      suspendedReason: null,
      suspendedBy: null,
      frozenReason: null,
      frozenBy: null,
      failedLoginAttempts: 0,
      suspendedAt: null,
      frozenAt: null,
      lockedUntil: null,
      createdAt: "2025-06-01T00:00:00.000Z",
      lastSignedIn: "2026-01-15T00:00:00.000Z",
    });
    /* Positive control: the projection above passes trivially over an empty
       object, so pin that credits and stats rode through untouched. */
    expect(result!.credits).toEqual({ balance: 500 });
    expect(result!.stats).toEqual({ totalModels: 5, totalGenerations: 50 });
  });

  it("a user who does not exist comes back as NULL — the router's own branch", async () => {
    const { getUserFullDetails } = await import("./db");
    (getUserFullDetails as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    await expect(caller().getUserFullDetails({ userId: 99999 })).resolves.toBeNull();
  });

  it("the forbidden six are absent from BOTH reads — invariant 8, stated as itself", async () => {
    const list = await caller().listUsers();
    const full = await caller().getUserFullDetails({ userId: 42 });
    for (const key of Object.keys(FORBIDDEN)) {
      expect(Object.keys(list.users[0])).not.toContain(key);
      expect(Object.keys(full!.user)).not.toContain(key);
    }
    /* Positive control for the two loops above: they pass over empty objects. */
    expect(list.users[0].id).toBe(42);
    expect(full!.user.email).toBe("test@example.com");
  });
});

describe("#700 — the middleware still refuses, driven not recited", () => {
  it("an unauthenticated caller is UNAUTHORIZED, not an empty list", async () => {
    const anon = usersRouter.createCaller({ user: null } as never);
    await expect(anon.listUsers()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
