import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database functions
vi.mock("./db", () => ({
  getUserPoints: vi.fn(),
  getPointTransactions: vi.fn(),
  deductPoints: vi.fn(),
  addPoints: vi.fn(),
}));

import { getUserPoints, getPointTransactions, deductPoints, addPoints } from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-123",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
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

describe("points.getBalance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user points balance", async () => {
    const mockPoints = {
      id: 1,
      userId: 1,
      balance: 100,
      planTier: "free" as const,
      planExpiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(getUserPoints).mockResolvedValue(mockPoints);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.points.getBalance();

    expect(result).toEqual({
      balance: 100,
      planTier: "free",
      planExpiresAt: null,
    });
    expect(getUserPoints).toHaveBeenCalledWith(1);
  });

  it("throws error when points record not found", async () => {
    vi.mocked(getUserPoints).mockResolvedValue(null);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.points.getBalance()).rejects.toThrow("Points record not found");
  });
});

describe("points.getTransactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns transaction history", async () => {
    const mockTransactions = [
      {
        id: 1,
        userId: 1,
        amount: 100,
        type: "signup" as const,
        description: "Welcome bonus",
        referenceId: null,
        balanceAfter: 100,
        createdAt: new Date(),
      },
    ];

    vi.mocked(getPointTransactions).mockResolvedValue(mockTransactions);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.points.getTransactions({ limit: 20 });

    expect(result).toEqual(mockTransactions);
    expect(getPointTransactions).toHaveBeenCalledWith(1, 20);
  });
});

describe("points.deduct", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deducts points successfully", async () => {
    vi.mocked(deductPoints).mockResolvedValue({ success: true, newBalance: 90 });

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.points.deduct({
      amount: 10,
      type: "generation",
      description: "Model generation",
    });

    expect(result).toEqual({ success: true, newBalance: 90 });
    expect(deductPoints).toHaveBeenCalledWith(1, 10, "generation", "Model generation", undefined);
  });

  it("throws error when insufficient points", async () => {
    vi.mocked(deductPoints).mockResolvedValue({ success: false, error: "Insufficient points" });

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.points.deduct({
        amount: 1000,
        type: "generation",
        description: "Model generation",
      })
    ).rejects.toThrow("Insufficient points");
  });
});

describe("points.checkBalance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when user has enough points", async () => {
    const mockPoints = {
      id: 1,
      userId: 1,
      balance: 100,
      planTier: "free" as const,
      planExpiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(getUserPoints).mockResolvedValue(mockPoints);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.points.checkBalance({ required: 50 });

    expect(result).toEqual({
      hasEnough: true,
      balance: 100,
      required: 50,
    });
  });

  it("returns false when user has insufficient points", async () => {
    const mockPoints = {
      id: 1,
      userId: 1,
      balance: 30,
      planTier: "free" as const,
      planExpiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(getUserPoints).mockResolvedValue(mockPoints);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.points.checkBalance({ required: 50 });

    expect(result).toEqual({
      hasEnough: false,
      balance: 30,
      required: 50,
    });
  });
});
