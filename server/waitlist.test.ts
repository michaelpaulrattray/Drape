import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database functions
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
    addToWaitlist: vi.fn(),
    getWaitlistCount: vi.fn(),
  };
});

import { addToWaitlist, getWaitlistCount } from "./db";

const mockAddToWaitlist = addToWaitlist as ReturnType<typeof vi.fn>;
const mockGetWaitlistCount = getWaitlistCount as ReturnType<typeof vi.fn>;

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("waitlist.join", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully adds a new email to the waitlist", async () => {
    mockAddToWaitlist.mockResolvedValue({ success: true, position: 42 });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.waitlist.join({
      email: "test@example.com",
      name: "Test User",
    });

    expect(result).toEqual({
      success: true,
      position: 42,
      alreadyRegistered: false,
    });

    expect(mockAddToWaitlist).toHaveBeenCalledWith({
      email: "test@example.com",
      name: "Test User",
      company: null,
      role: null,
      source: "landing_page",
      referralCode: null,
    });
  });

  it("handles already registered emails", async () => {
    mockAddToWaitlist.mockResolvedValue({
      success: true,
      position: 15,
      error: "already_registered",
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.waitlist.join({
      email: "existing@example.com",
    });

    expect(result).toEqual({
      success: true,
      position: 15,
      alreadyRegistered: true,
    });
  });

  it("normalizes email to lowercase", async () => {
    mockAddToWaitlist.mockResolvedValue({ success: true, position: 1 });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await caller.waitlist.join({
      email: "TEST@EXAMPLE.COM",
    });

    expect(mockAddToWaitlist).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "test@example.com",
      })
    );
  });

  it("rejects invalid email format", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.waitlist.join({
        email: "not-an-email",
      })
    ).rejects.toThrow();
  });
});

describe("waitlist.getStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns waitlist statistics with display count", async () => {
    mockGetWaitlistCount.mockResolvedValue(100);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.waitlist.getStats();

    expect(result).toEqual({
      totalSignups: 100,
      displayCount: 947, // 100 + 847 base
    });
  });

  it("handles zero signups", async () => {
    mockGetWaitlistCount.mockResolvedValue(0);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.waitlist.getStats();

    expect(result).toEqual({
      totalSignups: 0,
      displayCount: 847,
    });
  });
});
