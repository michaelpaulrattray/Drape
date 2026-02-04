import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database functions
vi.mock("./db", () => ({
  getUserCredits: vi.fn(),
  getCreditTransactions: vi.fn(),
  deductCredits: vi.fn(),
  addCredits: vi.fn(),
}));

import { getUserCredits, getCreditTransactions, deductCredits, addCredits } from "./db";

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

describe("credits.getBalance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user credits balance", async () => {
    const mockCredits = {
      id: 1,
      userId: 1,
      balance: 100,
      totalEarned: 100,
      totalSpent: 0,
      planTier: "free" as const,
      planExpiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(getUserCredits).mockResolvedValue(mockCredits);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.credits.getBalance();

    expect(result).toEqual({
      balance: 100,
      planTier: "free",
      planExpiresAt: null,
    });
    expect(getUserCredits).toHaveBeenCalledWith(1);
  });

  it("throws error when credits record not found", async () => {
    vi.mocked(getUserCredits).mockResolvedValue(null);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.credits.getBalance()).rejects.toThrow("Credits record not found");
  });
});

describe("credits.getTransactions", () => {
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

    vi.mocked(getCreditTransactions).mockResolvedValue(mockTransactions);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.credits.getTransactions({ limit: 20 });

    expect(result).toEqual(mockTransactions);
    expect(getCreditTransactions).toHaveBeenCalledWith(1, 20);
  });
});

describe("credits.deduct", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deducts credits successfully", async () => {
    vi.mocked(deductCredits).mockResolvedValue({ success: true, newBalance: 90 });

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.credits.deduct({
      amount: 10,
      type: "generation",
      description: "Model generation",
    });

    expect(result).toEqual({ success: true, newBalance: 90 });
    expect(deductCredits).toHaveBeenCalledWith(1, 10, "generation", "Model generation", undefined, undefined);
  });

  it("throws error when insufficient credits", async () => {
    vi.mocked(deductCredits).mockResolvedValue({ success: false, error: "Insufficient credits" });

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.credits.deduct({
        amount: 1000,
        type: "generation",
        description: "Model generation",
      })
    ).rejects.toThrow("Insufficient credits");
  });
});

describe("credits.checkBalance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when user has enough credits", async () => {
    const mockCredits = {
      id: 1,
      userId: 1,
      balance: 100,
      totalEarned: 100,
      totalSpent: 0,
      planTier: "free" as const,
      planExpiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(getUserCredits).mockResolvedValue(mockCredits);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.credits.checkBalance({ required: 50 });

    expect(result).toEqual({
      hasEnough: true,
      balance: 100,
      required: 50,
    });
  });

  it("returns false when user has insufficient credits", async () => {
    const mockCredits = {
      id: 1,
      userId: 1,
      balance: 30,
      totalEarned: 100,
      totalSpent: 70,
      planTier: "free" as const,
      planExpiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(getUserCredits).mockResolvedValue(mockCredits);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.credits.checkBalance({ required: 50 });

    expect(result).toEqual({
      hasEnough: false,
      balance: 30,
      required: 50,
    });
  });
});
