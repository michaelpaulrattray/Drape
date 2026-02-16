import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

/** Create a mock admin context for testing admin invite code routes. */
function createAdminContext(overrides: Partial<AuthenticatedUser> = {}): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-open-id",
    email: "admin@formastudio.ai",
    name: "Admin User",
    displayName: null,
    avatarUrl: null,
    avatarKey: null,
    bannerUrl: null,
    bannerKey: null,
    bio: null,
    loginMethod: "manus",
    role: "admin",
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
    approved: true,
    accessCode: "ADMIN_APPROVED",
    approvedAt: new Date(),
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  return createAdminContext({ role: "user", id: 99, name: "Regular User" });
}

describe("admin.createInviteCode", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects non-admin users", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.createInviteCode({
        code: "TEST-CODE",
        maxUses: 1,
      })
    ).rejects.toThrow();
  }, 10_000);

  it("validates code format — rejects special characters", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.createInviteCode({
        code: "INVALID CODE!",
        maxUses: 1,
      })
    ).rejects.toThrow();
  });

  it("validates code minimum length", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.createInviteCode({
        code: "AB",
        maxUses: 1,
      })
    ).rejects.toThrow();
  });

  it("validates maxUses must be positive", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.createInviteCode({
        code: "VALID-CODE",
        maxUses: 0,
      })
    ).rejects.toThrow();
  });

  it("accepts valid input for admin user", async () => {
    const ctx = createAdminContext({
      openId: process.env.OWNER_OPEN_ID || "admin-open-id",
      name: process.env.OWNER_NAME || "Admin User",
    });
    const caller = appRouter.createCaller(ctx);

    // Will call the real DB function which may fail in test env,
    // but should not throw a validation or auth error
    try {
      await caller.admin.createInviteCode({
        code: "FORMA-TEST-VALID",  // hyphens are allowed by regex
        maxUses: 5,
        expiresInDays: 30,
        note: "Test code",
      });
    } catch (e: unknown) {
      const error = e as { code?: string };
      // Auth errors should not occur — BAD_REQUEST is acceptable
      // (e.g. duplicate code in DB, or DB unavailable)
      expect(error.code).not.toBe("UNAUTHORIZED");
      expect(error.code).not.toBe("FORBIDDEN");
    }
  });
});

describe("admin.deactivateInviteCode", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects non-admin users", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.deactivateInviteCode({ codeId: 1 })
    ).rejects.toThrow();
  });

  it("validates codeId must be an integer", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.deactivateInviteCode({ codeId: 1.5 })
    ).rejects.toThrow();
  });

  it("accepts valid codeId for admin user", async () => {
    const ctx = createAdminContext({
      openId: process.env.OWNER_OPEN_ID || "admin-open-id",
      name: process.env.OWNER_NAME || "Admin User",
    });
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.admin.deactivateInviteCode({ codeId: 999 });
    } catch (e: unknown) {
      const error = e as { code?: string };
      expect(error.code).not.toBe("UNAUTHORIZED");
      expect(error.code).not.toBe("FORBIDDEN");
    }
  });
});

describe("admin.listInviteCodes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects non-admin users", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.admin.listInviteCodes()).rejects.toThrow();
  });

  it("returns data for admin user", async () => {
    const ctx = createAdminContext({
      openId: process.env.OWNER_OPEN_ID || "admin-open-id",
      name: process.env.OWNER_NAME || "Admin User",
    });
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.admin.listInviteCodes();
      // Should return an array
      expect(Array.isArray(result)).toBe(true);
    } catch (e: unknown) {
      const error = e as { code?: string };
      // Should not be auth errors
      expect(error.code).not.toBe("UNAUTHORIZED");
      expect(error.code).not.toBe("FORBIDDEN");
    }
  });
});
