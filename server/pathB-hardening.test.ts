/**
 * Path B Production Hardening Tests
 *
 * Tests for:
 *  1. Database transactions (withTransaction helper)
 *  2. GDPR data export (exportUserData + account.exportData endpoint)
 *  3. Context correlation ID propagation
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ============================================================================
// 1. withTransaction helper tests
// ============================================================================

describe("withTransaction", () => {
  it("should be exported from connection module", async () => {
    const mod = await import("./db/connection");
    expect(mod.withTransaction).toBeDefined();
    expect(typeof mod.withTransaction).toBe("function");
  });

  it("should throw when database is not available", async () => {
    // withTransaction checks getDb() internally. When DATABASE_URL is unset
    // (as in test env), getDb() returns null, triggering the error.
    // We unset DATABASE_URL to ensure getDb returns null.
    const origUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    // Dynamic import to avoid module cache issues
    const { withTransaction } = await import("./db/connection");

    await expect(withTransaction(async () => {})).rejects.toThrow(
      "database not available"
    );

    // Restore
    if (origUrl) process.env.DATABASE_URL = origUrl;
  });
});

// ============================================================================
// 2. GDPR Data Export module tests
// ============================================================================

describe("GDPR Data Export", () => {
  it("should export the exportUserData function", async () => {
    const mod = await import("./db/gdprExport");
    expect(mod.exportUserData).toBeDefined();
    expect(typeof mod.exportUserData).toBe("function");
  });

  it("should export the GdprExportData type interface", async () => {
    // Type-level check — if this compiles, the type is exported correctly
    const mod = await import("./db/gdprExport");
    const fn: (userId: number) => Promise<import("./db/gdprExport").GdprExportData | null> =
      mod.exportUserData;
    expect(fn).toBeDefined();
  });

  it("should return null when database is not available", async () => {
    // Mock getDb to return null
    vi.doMock("./db/connection", () => ({
      getDb: vi.fn().mockResolvedValue(null),
      withTransaction: vi.fn(),
    }));

    // Re-import to pick up mock
    const { exportUserData } = await import("./db/gdprExport");
    const result = await exportUserData(999);
    expect(result).toBeNull();

    vi.doUnmock("./db/connection");
  });
});

// ============================================================================
// 3. GDPR Export endpoint (account.exportData) tests
// ============================================================================

describe("account.exportData endpoint", () => {
  it("should be registered as a query on the account router", async () => {
    const { appRouter } = await import("./routers");
    // Verify the procedure exists on the router
    const procedures = Object.keys((appRouter as any)._def.procedures);
    expect(procedures).toContain("account.exportData");
  }, 15_000);

  it("should require authentication (protectedProcedure)", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      user: null,
      req: { headers: {} } as any,
      res: {} as any,
      correlationId: "req_test123",
    });

    // Should throw UNAUTHORIZED for unauthenticated users
    await expect(caller.account.exportData()).rejects.toThrow();
  });
});

// ============================================================================
// 4. AUDIT_ACTIONS includes DATA_EXPORT_REQUESTED
// ============================================================================

describe("AUDIT_ACTIONS", () => {
  it("should include DATA_EXPORT_REQUESTED action", async () => {
    const { AUDIT_ACTIONS } = await import("../drizzle/schema");
    expect(AUDIT_ACTIONS.DATA_EXPORT_REQUESTED).toBe("account.data_export_requested");
  });
});

// ============================================================================
// 5. Context includes correlationId
// ============================================================================

describe("TrpcContext correlationId", () => {
  it("should include correlationId in the context type", async () => {
    // Verify createContext produces a correlationId
    const { createContext } = await import("./_core/context");
    expect(createContext).toBeDefined();

    // Create a mock request with correlationId already set (as middleware would)
    const mockReq = {
      headers: {},
      correlationId: "req_abc123def456",
    } as any;
    const mockRes = {} as any;

    const ctx = await createContext({ req: mockReq, res: mockRes, info: {} as any });
    expect(ctx.correlationId).toBe("req_abc123def456");
  });

  it("should default to 'unknown' when middleware hasn't run", async () => {
    const { createContext } = await import("./_core/context");
    const mockReq = { headers: {} } as any;
    const mockRes = {} as any;

    const ctx = await createContext({ req: mockReq, res: mockRes, info: {} as any });
    expect(ctx.correlationId).toBe("unknown");
  });
});

// ============================================================================
// 6. Transaction-wrapped functions exist and are callable
// ============================================================================

describe("Transaction-wrapped DB functions", () => {
  it("credits module exports initializeUserCredits", async () => {
    const mod = await import("./db/credits");
    expect(mod.initializeUserCredits).toBeDefined();
    expect(typeof mod.initializeUserCredits).toBe("function");
  });

  it("credits module exports deductCredits", async () => {
    const mod = await import("./db/credits");
    expect(mod.deductCredits).toBeDefined();
    expect(typeof mod.deductCredits).toBe("function");
  });

  it("credits module exports addCredits", async () => {
    const mod = await import("./db/credits");
    expect(mod.addCredits).toBeDefined();
    expect(typeof mod.addCredits).toBe("function");
  });

  it("billing module exports refreshMonthlyCredits", async () => {
    const mod = await import("./db/billing");
    expect(mod.refreshMonthlyCredits).toBeDefined();
    expect(typeof mod.refreshMonthlyCredits).toBe("function");
  });

  it("admin module exports adjustUserCredits", async () => {
    const mod = await import("./db/admin");
    expect(mod.adjustUserCredits).toBeDefined();
    expect(typeof mod.adjustUserCredits).toBe("function");
  });

  it("models module exports deleteModel", async () => {
    const mod = await import("./db/models");
    expect(mod.deleteModel).toBeDefined();
    expect(typeof mod.deleteModel).toBe("function");
  });

  it("models module exports deleteModelWithAssetKeys", async () => {
    const mod = await import("./db/models");
    expect(mod.deleteModelWithAssetKeys).toBeDefined();
    expect(typeof mod.deleteModelWithAssetKeys).toBe("function");
  });

  it("inviteCodes module exports redeemInviteCode", async () => {
    const mod = await import("./db/inviteCodes");
    expect(mod.redeemInviteCode).toBeDefined();
    expect(typeof mod.redeemInviteCode).toBe("function");
  });

  it("accountDeletion module exports deleteUserAccount", async () => {
    const mod = await import("./db/accountDeletion");
    expect(mod.deleteUserAccount).toBeDefined();
    expect(typeof mod.deleteUserAccount).toBe("function");
  });

  it("gdprExport module exports exportUserData", async () => {
    const mod = await import("./db/gdprExport");
    expect(mod.exportUserData).toBeDefined();
    expect(typeof mod.exportUserData).toBe("function");
  });

  it("barrel index re-exports withTransaction", async () => {
    const mod = await import("./db/index");
    expect(mod.withTransaction).toBeDefined();
    expect(typeof mod.withTransaction).toBe("function");
  });

  it("barrel index re-exports exportUserData", async () => {
    const mod = await import("./db/index");
    expect(mod.exportUserData).toBeDefined();
    expect(typeof mod.exportUserData).toBe("function");
  });
});
