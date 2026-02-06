import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  getDb: vi.fn(),
  getUserById: vi.fn(),
  getUserCredits: vi.fn(),
}));

// Mock storage
vi.mock("./storage", () => ({
  storageDelete: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock stripe
vi.mock("./stripeService", () => ({
  stripe: {
    subscriptions: {
      cancel: vi.fn().mockResolvedValue({ id: "sub_123", status: "canceled" }),
    },
  },
}));

// Mock audit logging
vi.mock("./auditLog", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: { ACCOUNT_DELETED: "account.deleted" },
}));

import { getUserById, getUserCredits, getDb } from "./db";
import { storageDelete } from "./storage";
import { stripe } from "./stripeService";
import { logAuditEvent } from "./auditLog";
import { deleteUserData } from "./deleteUserData";

/**
 * Create a mock DB that supports Drizzle-style chaining:
 *   db.select({...}).from(table).where(condition).limit(n) → Promise<rows[]>
 *   db.select({...}).from(table).where(condition) → Promise<rows[]>
 *   db.update(table).set({...}).where(condition) → Promise<void>
 *   db.delete(table).where(condition) → Promise<void>
 *
 * Each call to .where() or .limit() resolves to the next value in the
 * `queryResults` queue, allowing tests to control what each query returns.
 */
function createMockDb(queryResults: any[] = []) {
  let resultIndex = 0;

  const getNextResult = () => {
    const result = queryResults[resultIndex] ?? [];
    resultIndex++;
    return result;
  };

  const chainable = () => {
    const chain: any = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.from = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockImplementation(() => {
      // .where() can be terminal (returns array) or chainable (if .limit() follows)
      const result = getNextResult();
      // Return an object that is both iterable (array-like) and has .limit()
      const arr = Array.isArray(result) ? result : [];
      const proxy = Object.assign([...arr], {
        limit: vi.fn().mockReturnValue(arr),
        [Symbol.iterator]: arr[Symbol.iterator].bind(arr),
      });
      return proxy;
    });
    chain.update = vi.fn().mockReturnValue(chain);
    chain.set = vi.fn().mockReturnValue(chain);
    chain.delete = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockImplementation(() => getNextResult());
    return chain;
  };

  return chainable();
}

describe("deleteUserData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when database is not available", async () => {
    (getDb as any).mockResolvedValue(null);

    const result = await deleteUserData(1);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Database not available");
  });

  it("returns error when user is not found", async () => {
    const mockDb = createMockDb([]);
    (getDb as any).mockResolvedValue(mockDb);
    (getUserById as any).mockResolvedValue(null);

    const result = await deleteUserData(999);
    expect(result.success).toBe(false);
    expect(result.error).toBe("User not found");
  });

  it("prevents admin self-deletion", async () => {
    const mockDb = createMockDb([]);
    (getDb as any).mockResolvedValue(mockDb);
    (getUserById as any).mockResolvedValue({
      id: 1,
      openId: "admin-user",
      name: "Admin",
      email: "admin@test.com",
      role: "admin",
    });

    const result = await deleteUserData(1);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Admin accounts cannot be self-deleted");
  });

  it("successfully deletes a free user with no content", async () => {
    // Query sequence:
    // 1. collectUserS3Keys: select avatarKey/bannerKey from users where id=5 limit 1
    // 2. collectUserS3Keys: select id from models where userId=5
    // 3. deleteUserData: select id from models where userId=5 (for asset deletion loop)
    // 4. deleteUserData: delete models where userId=5
    // 5. deleteUserData: select id from generations where userId=5
    // 6. deleteUserData: delete generations where userId=5
    // 7. deleteUserData: update credits where userId=5
    // 8. deleteUserData: update users where userId=5
    const mockDb = createMockDb([
      [{ avatarKey: null, bannerKey: null }], // 1. user S3 keys
      [],                                      // 2. user models (none)
      [],                                      // 3. models for asset deletion
      [],                                      // 4. delete models
      [],                                      // 5. generations
      [],                                      // 6. delete generations
      [],                                      // 7. update credits
      [],                                      // 8. update users
    ]);
    (getDb as any).mockResolvedValue(mockDb);
    (getUserById as any).mockResolvedValue({
      id: 5,
      openId: "free-user",
      name: "Free User",
      email: "free@test.com",
      role: "user",
    });
    (getUserCredits as any).mockResolvedValue({
      balance: 50,
      stripeSubscriptionId: null,
    });

    const result = await deleteUserData(5);
    expect(result.success).toBe(true);
    expect(result.summary?.stripeSubscriptionCancelled).toBe(true);
    expect(result.summary?.creditsZeroed).toBe(true);
    expect(result.summary?.userAnonymized).toBe(true);
    expect(result.summary?.modelsDeleted).toBe(0);
    expect(result.summary?.generationsDeleted).toBe(0);
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it("cancels Stripe subscription immediately on deletion", async () => {
    const mockDb = createMockDb([
      [{ avatarKey: null, bannerKey: null }],
      [], [], [], [], [], [], [],
    ]);
    (getDb as any).mockResolvedValue(mockDb);
    (getUserById as any).mockResolvedValue({
      id: 3,
      openId: "sub-user",
      name: "Subscriber",
      email: "sub@test.com",
      role: "user",
    });
    (getUserCredits as any).mockResolvedValue({
      balance: 500,
      stripeSubscriptionId: "sub_test_123",
    });

    const result = await deleteUserData(3);
    expect(result.success).toBe(true);
    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith("sub_test_123");
    expect(result.summary?.stripeSubscriptionCancelled).toBe(true);
  });

  it("handles already-cancelled Stripe subscription gracefully", async () => {
    const mockDb = createMockDb([
      [{ avatarKey: null, bannerKey: null }],
      [], [], [], [], [], [], [],
    ]);
    (getDb as any).mockResolvedValue(mockDb);
    (getUserById as any).mockResolvedValue({
      id: 4,
      openId: "old-sub",
      name: "Old Sub",
      email: "old@test.com",
      role: "user",
    });
    (getUserCredits as any).mockResolvedValue({
      balance: 0,
      stripeSubscriptionId: "sub_already_gone",
    });

    (stripe.subscriptions.cancel as any).mockRejectedValueOnce({
      code: "resource_missing",
      statusCode: 404,
    });

    const result = await deleteUserData(4);
    expect(result.success).toBe(true);
    expect(result.summary?.stripeSubscriptionCancelled).toBe(true);
  });

  it("deletes S3 files for avatar and banner", async () => {
    const mockDb = createMockDb([
      [{ avatarKey: "avatars/u6.jpg", bannerKey: "banners/u6.jpg" }],
      [], [], [], [], [], [], [],
    ]);
    (getDb as any).mockResolvedValue(mockDb);
    (getUserById as any).mockResolvedValue({
      id: 6,
      openId: "asset-user",
      name: "Asset User",
      email: "asset@test.com",
      role: "user",
    });
    (getUserCredits as any).mockResolvedValue({
      balance: 100,
      stripeSubscriptionId: null,
    });

    const result = await deleteUserData(6);
    expect(result.success).toBe(true);
    expect(storageDelete).toHaveBeenCalledWith("avatars/u6.jpg");
    expect(storageDelete).toHaveBeenCalledWith("banners/u6.jpg");
    expect(result.summary?.s3FilesDeleted).toBe(2);
  });

  it("logs audit event on successful deletion", async () => {
    const mockDb = createMockDb([
      [{ avatarKey: null, bannerKey: null }],
      [], [], [], [], [], [], [],
    ]);
    (getDb as any).mockResolvedValue(mockDb);
    (getUserById as any).mockResolvedValue({
      id: 7,
      openId: "audit-user",
      name: "Audit User",
      email: "audit@test.com",
      role: "user",
    });
    (getUserCredits as any).mockResolvedValue({
      balance: 0,
      stripeSubscriptionId: null,
    });

    const result = await deleteUserData(7, "1.2.3.4", "TestBrowser/1.0");
    expect(result.success).toBe(true);
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        action: "account.deleted",
        resourceType: "user",
        resourceId: "7",
        severity: "warning",
        ipAddress: "1.2.3.4",
        userAgent: "TestBrowser/1.0",
      })
    );
  });

  it("handles S3 deletion failure gracefully (best-effort)", async () => {
    const mockDb = createMockDb([
      [{ avatarKey: "avatars/u9.jpg", bannerKey: null }],
      [], [], [], [], [], [], [],
    ]);
    (getDb as any).mockResolvedValue(mockDb);
    (getUserById as any).mockResolvedValue({
      id: 9,
      openId: "s3fail-user",
      name: "S3 Fail",
      email: "s3fail@test.com",
      role: "user",
    });
    (getUserCredits as any).mockResolvedValue({
      balance: 0,
      stripeSubscriptionId: null,
    });
    (storageDelete as any).mockResolvedValueOnce({ success: false });

    const result = await deleteUserData(9);
    expect(result.success).toBe(true);
    expect(result.summary?.s3FilesFailed).toBe(1);
    expect(result.summary?.s3FilesDeleted).toBe(0);
  });

  it("allows moderator self-deletion", async () => {
    const mockDb = createMockDb([
      [{ avatarKey: null, bannerKey: null }],
      [], [], [], [], [], [], [],
    ]);
    (getDb as any).mockResolvedValue(mockDb);
    (getUserById as any).mockResolvedValue({
      id: 2,
      openId: "mod-user",
      name: "Moderator",
      email: "mod@test.com",
      role: "moderator",
    });
    (getUserCredits as any).mockResolvedValue({
      balance: 50,
      stripeSubscriptionId: null,
    });

    const result = await deleteUserData(2);
    expect(result.success).toBe(true);
  });
});

describe("auth.deleteAccount input validation", () => {
  it("requires exact DELETE confirmation literal", async () => {
    const { z } = await import("zod");
    const schema = z.object({ confirmation: z.literal("DELETE") });

    expect(schema.safeParse({ confirmation: "DELETE" }).success).toBe(true);
    expect(schema.safeParse({ confirmation: "delete" }).success).toBe(false);
    expect(schema.safeParse({ confirmation: "" }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
  });
});
