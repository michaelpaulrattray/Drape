/*
 * #2478 — THE REFERRAL INVITE EMAIL CARRIES THE NUMBER EVERY SCREEN SHOWS.
 *
 * `referral.sendInvite` handed `REFERRAL_REWARD_CREDITS` (12,500 on the ledger)
 * straight to Klaviyo as `reward_credits`, while the two screens that read the
 * same constant (`ReferralBlock`, `RedeemCodeModal`) convert it to 2,500 at the
 * render. An email has no client to convert for it, so the router must.
 *
 * Asserted AT THE WIRE (working law 5): the real router runs, the real
 * `sendReferralInviteEmail` runs, and the arm reads `reward_credits` out of the
 * JSON body of the outgoing POST to Klaviyo's events endpoint. Only `fetch`
 * and the referral database helpers are stand-ins.
 *
 * The second describe is the other half of the card's "done when": the three
 * procedures whose readers DO convert keep the ledger figure, so a repair at
 * the constant (which would make those screens say 500) reddens here.
 *
 * Not proven, because it cannot be from this repository: whether the Klaviyo
 * template prints `reward_credits` at all.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db/referrals", () => ({
  expireStalePendingReferrals: vi.fn(),
  getOrCreateReferralCode: vi.fn(),
  getUserByReferralCode: vi.fn(),
  claimReferral: vi.fn(),
  redeemReferralCode: vi.fn(),
  completeReferral: vi.fn(),
  creditReferrerOnPaidAction: vi.fn(),
  getReferralCreditsEarned: vi.fn(),
  getReferralStats: vi.fn(),
  getReferralHistory: vi.fn(),
  recordEmailInvite: vi.fn(),
  isValidReferralCodeFormat: vi.fn(),
}));

import { referralRouter } from "./routes/referral";
import {
  getOrCreateReferralCode,
  getReferralStats,
  isValidReferralCodeFormat,
  recordEmailInvite,
  redeemReferralCode,
} from "./db/referrals";
import { REFERRAL_REWARD_CREDITS } from "../drizzle/schema";
import { displayBalance } from "../shared/creditDisplay";

const ORIGIN = "https://klieglabs.com";
const EVENTS_URL = "https://a.klaviyo.com/api/events";

/* A fresh id per caller: the invite and redeem rate limits are keyed on the
   user id in module-level maps no export can clear. */
let nextUserId = 24780;

function caller() {
  return referralRouter.createCaller({
    user: {
      id: nextUserId++,
      email: "referrer@example.com",
      name: "Referrer",
      approved: true,
      suspendedAt: null,
      lockedUntil: null,
    },
    req: { ip: "203.0.113.24", headers: { origin: ORIGIN, host: new URL(ORIGIN).host } },
  } as never);
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("KLAVIYO_PRIVATE_KEY", "pk_test_not_a_real_key");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue({ ok: true, status: 202, json: async () => ({}) });
  vi.mocked(getOrCreateReferralCode).mockResolvedValue("KLIEG-ABC123");
  vi.mocked(recordEmailInvite).mockResolvedValue({ success: true } as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** The `properties` of the ONE event POST the invite produced. The send is
 *  fire-and-forget inside the procedure, so this waits for it to land. */
async function inviteEventProperties(): Promise<Record<string, unknown>> {
  await vi.waitFor(() => {
    expect(fetchMock.mock.calls.filter(([url]) => url === EVENTS_URL)).toHaveLength(1);
  });
  const [, init] = fetchMock.mock.calls.find(([url]) => url === EVENTS_URL)!;
  const body = JSON.parse((init as { body: string }).body);
  expect(body.data.attributes.metric.data.attributes.name).toBe("Referral Invite Sent");
  return body.data.attributes.properties;
}

describe("referral invite email — the reward on the wire is the display figure (#2478)", () => {
  it("the two scales differ for this constant, so the arms below can tell them apart", () => {
    // The control on the instrument: if they were equal, every arm here would
    // pass whichever figure was sent.
    expect(displayBalance(REFERRAL_REWARD_CREDITS)).not.toBe(REFERRAL_REWARD_CREDITS);
  });

  it("sends reward_credits on the display scale, the number the app shows", async () => {
    await expect(caller().sendInvite({ email: "friend@example.com" })).resolves.toEqual({ sent: true });

    const properties = await inviteEventProperties();
    expect(properties.reward_credits).toBe(displayBalance(REFERRAL_REWARD_CREDITS));
  });

  it("never sends the ledger figure", async () => {
    await caller().sendInvite({ email: "friend@example.com" });

    const properties = await inviteEventProperties();
    expect(properties.reward_credits).not.toBe(REFERRAL_REWARD_CREDITS);
  });
});

describe("the three screens that convert for themselves still receive the ledger figure", () => {
  it("getMyCode (ReferralBlock converts at the render)", async () => {
    const result = await caller().getMyCode();
    expect(result.rewardCredits).toBe(REFERRAL_REWARD_CREDITS);
  });

  it("getStats (ReferralBlock converts at the render)", async () => {
    vi.mocked(getReferralStats).mockResolvedValue({} as never);
    const result = await caller().getStats();
    expect(result.rewardCredits).toBe(REFERRAL_REWARD_CREDITS);
  });

  it("redeem (RedeemCodeModal converts at the render)", async () => {
    vi.mocked(isValidReferralCodeFormat).mockReturnValue(true);
    vi.mocked(redeemReferralCode).mockResolvedValue({ success: true } as never);
    const result = await caller().redeem({ code: "KLIEG-ABC123" });
    expect(result.rewardCredits).toBe(REFERRAL_REWARD_CREDITS);
  });
});
