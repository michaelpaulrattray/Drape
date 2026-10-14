/*
 * #2478 — THE REFERRAL INVITE EMAIL CARRIES THE NUMBER EVERY SCREEN SHOWS.
 *
 * `referral.sendInvite` handed `REFERRAL_REWARD_CREDITS` (12,500 on the ledger)
 * straight to the email as `reward_credits`, while the two screens that read
 * the same constant (`ReferralBlock`, `RedeemCodeModal`) convert it to 2,500
 * at the render. An email has no client to convert for it, so the router must.
 *
 * Asserted AT THE WIRE (working law 5): the real router runs, the real
 * `sendReferralInviteEmail` and its real email builder run, and the arm reads
 * the figure out of the subject and HTML handed to the transport. Only the
 * transport and the referral database helpers are stand-ins.
 *
 * ⚠ **THE WIRE MOVED UNDER THIS FILE — #2481, his ruling 2026-10-14.** Until
 * then the transport was a Klaviyo event, the arms read `reward_credits` out of
 * its JSON, and a third describe read the Klaviyo template script to prove the
 * figure was COPY (it printed in the subject line). The email is now Resend's
 * and its words are in `server/mail.ts`, so the copy question answers itself at
 * the wire: the figure is in the body the customer opens, and the arms read it
 * there. The Klaviyo template is no longer reached by any code, so its
 * describe is gone rather than left proving something about a road nobody takes.
 *
 * The second describe is the other half of #2478's "done when": the three
 * procedures whose readers DO convert keep the ledger figure, so a repair at
 * the constant (which would make those screens say 500) reddens here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { resendSend } = vi.hoisted(() => ({
  resendSend: vi.fn(async (_payload: unknown) => ({ data: { id: "email_1" }, error: null })),
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resendSend };
  },
}));

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
  hasInvitedEmail: vi.fn(),
  isValidReferralCodeFormat: vi.fn(),
}));

import { referralRouter } from "./routes/referral";
import {
  getOrCreateReferralCode,
  getReferralStats,
  hasInvitedEmail,
  isValidReferralCodeFormat,
  recordEmailInvite,
  redeemReferralCode,
} from "./db/referrals";
import { REFERRAL_REWARD_CREDITS } from "../drizzle/schema";
import { displayBalance, formatCredits, type DisplayCredits } from "../shared/creditDisplay";

const ORIGIN = "https://klieglabs.com";

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

/* A fresh address per arm: #2481 gave each address its own daily budget. */
let nextFriend = 0;
let FRIEND = "";

beforeEach(() => {
  FRIEND = `friend-${nextFriend++}@example.com`;
  vi.clearAllMocks();
  vi.stubEnv("RESEND_API_KEY", "re_test_not_a_real_key");
  vi.mocked(getOrCreateReferralCode).mockResolvedValue("KLIEG-ABC123");
  vi.mocked(hasInvitedEmail).mockResolvedValue(false);
  vi.mocked(recordEmailInvite).mockResolvedValue({ success: true } as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** The ONE email the invite handed the transport. */
function theInviteOnTheWire(): { to: string; subject: string; html: string } {
  expect(resendSend).toHaveBeenCalledTimes(1);
  return (resendSend.mock.calls[0] as unknown as [{ to: string; subject: string; html: string }])[0];
}

const DISPLAY = formatCredits(displayBalance(REFERRAL_REWARD_CREDITS));
const LEDGER = formatCredits(REFERRAL_REWARD_CREDITS as DisplayCredits);

describe("referral invite email — the reward on the wire is the display figure (#2478)", () => {
  it("the two scales differ for this constant, so the arms below can tell them apart", () => {
    // The control on the instrument: if they were equal, every arm here would
    // pass whichever figure was sent.
    expect(DISPLAY).not.toBe(LEDGER);
  });

  it("prints the display figure in the email the customer opens", async () => {
    await expect(caller().sendInvite({ email: FRIEND })).resolves.toEqual({ sent: true });

    const email = theInviteOnTheWire();
    expect(email.to).toBe(FRIEND);
    expect(email.html).toContain(`${DISPLAY} credits`);
  });

  it("never prints the ledger figure", async () => {
    await caller().sendInvite({ email: FRIEND });

    expect(theInviteOnTheWire().html).not.toContain(LEDGER);
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
