/**
 * #2375 — three public endpoints had no rate limit (invariant 5: every public
 * endpoint is rate-limited; invariant 6: the refusal is a real
 * TOO_MANY_REQUESTS). Each is driven through the REAL `appRouter` with only
 * its database read mocked, from one address until it refuses, then from a
 * second address that must still be answered — so a limiter keyed on nothing
 * (or on a constant) cannot pass, and neither can one that refuses everyone.
 *
 * It also pins the two answers the card changed: `referral.validate` says
 * whether a code is real and never whose it is, and `waitlist.getStats` is
 * the real count with nothing added.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    getWaitlistCount: vi.fn(async () => 12),
    getUserByReferralCode: vi.fn(async () => ({ id: 7, name: "Ada Lovelace" })),
  };
});
vi.mock("./db/announcementQueries", async () => {
  const actual = await vi.importActual<typeof import("./db/announcementQueries")>(
    "./db/announcementQueries",
  );
  return { ...actual, getActiveBanners: vi.fn(async () => []) };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getActiveBanners } from "./db/announcementQueries";
import { getUserByReferralCode, getWaitlistCount } from "./db";
import { ANNOUNCEMENTS_READ_RATE } from "./routes/announcements";
import { VALIDATE_RATE } from "./routes/referral";
import { WAITLIST_STATS_RATE } from "./routes/waitlist";

let ipSeq = 0;
/** A fresh address per test, so the shared in-memory store never leaks a window between arms. */
function freshIp(): string {
  ipSeq += 1;
  return `203.0.113.${ipSeq}`;
}

function callerFrom(ip: string) {
  const ctx = {
    user: null,
    req: { ip, protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  } as TrpcContext;
  return appRouter.createCaller(ctx);
}

async function refusal(p: Promise<unknown>): Promise<TRPCError> {
  try {
    await p;
  } catch (err) {
    if (err instanceof TRPCError) return err;
    throw err;
  }
  throw new Error("expected a refusal, got an answer");
}

const ARMS = [
  {
    name: "announcements.getActive",
    max: ANNOUNCEMENTS_READ_RATE.maxRequests,
    call: (ip: string) => callerFrom(ip).announcements.getActive(),
    reads: getActiveBanners,
  },
  {
    name: "waitlist.getStats",
    max: WAITLIST_STATS_RATE.maxRequests,
    call: (ip: string) => callerFrom(ip).waitlist.getStats(),
    reads: getWaitlistCount,
  },
  {
    name: "referral.validate",
    max: VALIDATE_RATE.maxRequests,
    call: (ip: string) => callerFrom(ip).referral.validate({ code: "DRAPE-ABC123" }),
    reads: getUserByReferralCode,
  },
] as const;

describe("#2375 — the three public endpoints are rate-limited per address", () => {
  beforeEach(() => vi.clearAllMocks());

  for (const arm of ARMS) {
    it(`${arm.name}: answers ${arm.max} from one address, refuses the next with TOO_MANY_REQUESTS, and never reads the database for it`, async () => {
      const ip = freshIp();
      for (let i = 0; i < arm.max; i++) await arm.call(ip); // positive control: all answered
      expect(arm.reads).toHaveBeenCalledTimes(arm.max);

      const err = await refusal(arm.call(ip));
      expect(err.code).toBe("TOO_MANY_REQUESTS");
      expect(err.message).toMatch(/^Too many (requests|attempts)\. .*try again/i);
      expect(arm.reads).toHaveBeenCalledTimes(arm.max); // refused BEFORE the read
    });

    it(`${arm.name}: a second address is still answered while the first is refused`, async () => {
      const a = freshIp();
      const b = freshIp();
      for (let i = 0; i < arm.max; i++) await arm.call(a);
      await refusal(arm.call(a));
      await expect(arm.call(b)).resolves.toBeDefined();
    });
  }
});

describe("#2375 — what the two changed answers say", () => {
  it("referral.validate says whether a code is real and never whose it is", async () => {
    const answer = await callerFrom(freshIp()).referral.validate({ code: "DRAPE-ABC123" });
    expect(answer).toEqual({ valid: true });
    expect(JSON.stringify(answer)).not.toMatch(/Ada/);
  });

  it("referral.validate still says no for an unknown code", async () => {
    vi.mocked(getUserByReferralCode).mockResolvedValueOnce(null as never);
    const answer = await callerFrom(freshIp()).referral.validate({ code: "DRAPE-ZZZ999" });
    expect(answer).toEqual({ valid: false });
  });

  it("waitlist.getStats is the real count with nothing added", async () => {
    const answer = await callerFrom(freshIp()).waitlist.getStats();
    expect(answer).toEqual({ totalSignups: 12 });
  });
});
