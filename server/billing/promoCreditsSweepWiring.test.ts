/**
 * THE PROMO SWEEP IS ACTUALLY ON THE TIMER (#2185, the relay's finding 4a on
 * PR #2208 — invariant 7: a control that is not invoked does not exist).
 *
 * `runPromoCreditsExpirySweep` is a second pass inside the plan-credit sweep's
 * own six-hour timer. Its own arms drive what it does with a candidate; this
 * one drives `startPlanCreditsExpirySweep` itself, on fake timers, and proves
 * the promo candidates are asked for — so deleting the call reddens here.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const planCandidates = vi.fn().mockResolvedValue([]);
const promoCandidates = vi.fn().mockResolvedValue([]);
const expirePromo = vi.fn();

vi.mock("../db", () => ({
  getPlanCreditsExpiryCandidates: (...args: unknown[]) => planCandidates(...args),
  expirePlanCredits: vi.fn(),
}));
vi.mock("../db/billing", () => ({
  getPromoCreditsExpiryCandidates: (...args: unknown[]) => promoCandidates(...args),
  expirePromoCredits: (...args: unknown[]) => expirePromo(...args),
}));

import { runPromoCreditsExpirySweep, startPlanCreditsExpirySweep } from "./planCreditsExpiry";

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  planCandidates.mockClear();
  promoCandidates.mockClear();
  expirePromo.mockReset();
});

describe("the six-hour timer runs both sweeps", () => {
  it("⚠ the first run asks for the plan's candidates AND the promo candidates", async () => {
    vi.useFakeTimers();
    startPlanCreditsExpirySweep();
    expect(promoCandidates).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(planCandidates).toHaveBeenCalledTimes(1);
    expect(promoCandidates).toHaveBeenCalledTimes(1);
  });

  it("a failing plan sweep does not stop the promo sweep", async () => {
    vi.useFakeTimers();
    planCandidates.mockRejectedValueOnce(new Error("plan read failed"));
    startPlanCreditsExpirySweep();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(promoCandidates).toHaveBeenCalledTimes(1);
  });

  it("each due promo is handed to the expiry and the outcomes are tallied", async () => {
    const at = new Date("2027-01-08T00:00:00Z");
    expirePromo
      .mockResolvedValueOnce({ outcome: "expired", creditsRemoved: 500, newBalance: 0 })
      .mockResolvedValueOnce({ outcome: "nothing-to-expire" });
    const result = await runPromoCreditsExpirySweep({
      now: () => at,
      candidates: async () => [
        { userId: 7, expireAt: at },
        { userId: 8, expireAt: at },
      ],
      expire: (userId, expireAt, now) => expirePromo(userId, expireAt, now),
    });
    expect(expirePromo.mock.calls.map((call) => call[0])).toEqual([7, 8]);
    expect(result).toEqual({ considered: 2, outcomes: { expired: 1, "nothing-to-expire": 1 }, creditsRemoved: 500 });
  });
});
