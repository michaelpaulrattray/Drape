/**
 * BOTH REFERRAL REWARDS ARE GRANTED AS CREDITS THAT NEVER EXPIRE (#2185, his
 * ruling 2026-10-10: "Referral credits (proposed) Never expire, same as
 * top-ups.") — asserted on the call each one actually makes.
 *
 * The ledger type stays `bonus`, which is also what a plan change's prorated
 * credits are written as, and an unstated `bonus` is the plan's
 * (`grantBucket`). So the source stated at these two calls is the whole
 * difference between a reward that lasts and one that expires with the plan;
 * `server/creditExpiryRules.test.ts` drives what the bucket then does.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const addCredits = vi.fn().mockResolvedValue({ success: true, newBalance: 1 });
vi.mock("./credits", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  addCredits: (...args: unknown[]) => addCredits(...args),
}));
vi.mock("../auditLog", () => ({ logAuditEvent: vi.fn().mockResolvedValue(undefined) }));

const REFERRAL = { id: 31, referrerUserId: 5, referredUserId: 9, referredCredited: false, sameIpFlag: false };
let selectRows: unknown[] = [];

/** Any chain of builder calls, awaited, answers `selectRows`. */
function chain(): unknown {
  return new Proxy(function () {}, {
    get: (_t, prop) =>
      prop === "then"
        ? (resolve: (v: unknown) => void) => resolve(selectRows)
        : () => chain(),
    apply: () => chain(),
  });
}
// The root is not itself awaitable — an awaited thenable would BE the rows.
vi.mock("./connection", () => ({ getDb: async () => ({ select: () => chain(), update: () => chain() }) }));

import { completeReferral, creditReferrerOnPaidAction } from "./referrals";

beforeEach(() => {
  addCredits.mockClear();
  selectRows = [REFERRAL];
});

describe("referral rewards land in the bucket that never expires", () => {
  it("⚠ the referred friend's welcome bonus states its source", async () => {
    expect(await completeReferral(9)).toBe(true);
    expect(addCredits).toHaveBeenCalledTimes(1);
    const call = addCredits.mock.calls[0];
    expect(call[2]).toBe("bonus");
    expect(call[4]).toBe("referral-referred-31");
    expect(call[5]).toEqual({ bonusSource: "referral" });
  });

  it("⚠ the referrer's bonus states its source", async () => {
    // The lifetime-cap read answers the same rows; a referral row carries no
    // `creditsAwarded`, so the earned total is not a number and the cap does
    // not bite — the grant is reached.
    expect(await creditReferrerOnPaidAction(9)).toBe(true);
    expect(addCredits).toHaveBeenCalledTimes(1);
    const call = addCredits.mock.calls[0];
    expect(call[0]).toBe(5);
    expect(call[4]).toBe("referral-referrer-31");
    expect(call[5]).toEqual({ bonusSource: "referral" });
  });

  it("negative control: no referral on record grants nothing", async () => {
    selectRows = [];
    expect(await completeReferral(9)).toBe(false);
    expect(addCredits).not.toHaveBeenCalled();
  });
});
