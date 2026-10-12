import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
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

    // `toEqual` refuses any extra key: no `position`, no `alreadyRegistered` (#2450).
    expect(result).toEqual({ success: true });

    expect(mockAddToWaitlist).toHaveBeenCalledWith({
      email: "test@example.com",
      name: "Test User",
      company: null,
      role: null,
      source: "landing_page",
      referralCode: null,
    });
  });

  it("an email already on the list gets the same answer as a new one (#2450)", async () => {
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

    expect(result).toEqual({ success: true });
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

/**
 * #2450 — `waitlist.join` answered `alreadyRegistered: true` (and the address's
 * old row id as `position`) for an email already on the list, and `false` (with
 * the newest id) for a fresh one: an address oracle on a public endpoint.
 * Driven through tRPC's real request handler over the real `appRouter`, with
 * only the database helper stubbed — it answers `already_registered` for an
 * address it holds, exactly as `server/db/waitlist.ts` does.
 */
describe("waitlist.join gives every address the same answer on the wire (#2450)", () => {
  let ipSeq = 0;

  function stubList(existing: Map<string, number>) {
    let nextId = 900;
    mockAddToWaitlist.mockImplementation(async ({ email }: { email: string }) => {
      const held = existing.get(email);
      if (held !== undefined) return { success: true, position: held, error: "already_registered" };
      return { success: true, position: ++nextId };
    });
  }

  async function join(email: string): Promise<{ status: number; body: unknown }> {
    ipSeq += 1;
    const response = await fetchRequestHandler({
      endpoint: "/api/trpc",
      req: new Request("http://localhost/api/trpc/waitlist.join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: { email } }),
      }),
      router: appRouter,
      createContext: (): TrpcContext =>
        ({
          user: null,
          // A fresh address per call, so the per-IP limit never decides an arm.
          req: { headers: {}, socket: {}, ip: `198.51.100.${ipSeq}` } as unknown as TrpcContext["req"],
          res: {} as unknown as TrpcContext["res"],
          correlationId: "waitlist-test",
        }) as TrpcContext,
    });
    return { status: response.status, body: (await response.json())?.result?.data?.json };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("a new address and one already on the list get the same status and the same body", async () => {
    stubList(new Map([["known@example.com", 7]]));
    const fresh = await join("fresh@example.com");
    const known = await join("known@example.com");
    expect(fresh.status).toBe(200);
    expect(known.status).toBe(200);
    expect(known.body).toEqual(fresh.body);
    expect(fresh.body).toEqual({ success: true });
  });

  it("the database really told the two apart — the control that makes the sameness mean something", async () => {
    stubList(new Map([["known@example.com", 7]]));
    await join("fresh@example.com");
    await join("known@example.com");
    const answers = await Promise.all(mockAddToWaitlist.mock.results.map((r) => r.value));
    expect(answers[0]).toEqual({ success: true, position: 901 });
    expect(answers[1]).toEqual({ success: true, position: 7, error: "already_registered" });
  });

  it("a database failure is still a refusal, not a pretend success — the negative control", async () => {
    mockAddToWaitlist.mockResolvedValue({ success: false, error: "Failed to join waitlist" });
    const failed = await join("anyone@example.com");
    expect(failed.status).toBe(500);
    expect(failed.body).toBeUndefined();
  });
});

describe("waitlist.getStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the real signup count and nothing padded (#2375)", async () => {
    mockGetWaitlistCount.mockResolvedValue(100);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.waitlist.getStats();

    // Exactly the count: the `displayCount: count + 847` padding is gone, and
    // `toEqual` refuses any extra key coming back beside it.
    expect(result).toEqual({ totalSignups: 100 });
  });

  it("handles zero signups", async () => {
    mockGetWaitlistCount.mockResolvedValue(0);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.waitlist.getStats();

    expect(result).toEqual({ totalSignups: 0 });
  });
});
