/*
 * #2493 — THE INVITE LIMITS HOLD FOR THE DAY THEY SAY, AND A LOST REPLY NEVER
 * BECOMES A SECOND EMAIL.
 *
 * Both found by Squall on PR #2492 and driven here through the real
 * `referral.sendInvite` procedure, the real rate limiter (its sweep included)
 * and the real `server/mail.ts` transport. Only Resend's client and the
 * referral database helpers are stand-ins.
 *
 * 1 · `rateLimit.ts`'s sweep deleted every entry whose window began more than
 *     an HOUR ago, whatever its window was — so "10 invites a day" and "3 a day
 *     per address" reset after about an hour. The arms advance the clock past
 *     an hour AND past a sweep and prove the cap still refuses; the positive
 *     arm proves it lifts once the day has really passed.
 *
 * 2 · If Resend accepted the invite and its reply never arrived, the router
 *     said "it didn't go", recorded nothing and handed the slots back — so the
 *     retry mailed the same stranger again. The stand-in below is a mailbox
 *     that behaves as Resend documents the `Idempotency-Key` header: a key it
 *     has seen is answered with the first email's id and nothing is sent. It
 *     counts EMAILS DELIVERED, not calls, and its own control proves it can
 *     count two.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Wire = { to: string; subject: string; html: string };
type Options = { idempotencyKey?: string } | undefined;

const mailbox = vi.hoisted(() => ({
  /** Emails that really reached a recipient. */
  delivered: [] as Array<{ to: string }>,
  /** Idempotency keys Resend has seen, mapped to the email id it answered. */
  seen: new Map<string, string>(),
  /** When true, the NEXT send is delivered but its reply is lost on the way back. */
  loseNextReply: false,
  calls: [] as Array<{ payload: { to: string }; options: { idempotencyKey?: string } | undefined }>,
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (payload: { to: string }, options?: { idempotencyKey?: string }) => {
        mailbox.calls.push({ payload, options });
        const key = options?.idempotencyKey;
        if (key && mailbox.seen.has(key)) {
          return { data: { id: mailbox.seen.get(key)! }, error: null };
        }
        mailbox.delivered.push({ to: payload.to });
        const id = `email_${mailbox.delivered.length}`;
        if (key) mailbox.seen.set(key, id);
        if (mailbox.loseNextReply) {
          mailbox.loseNextReply = false;
          // What resend@6 returns when the fetch itself fails (its `fetchRequest` catch).
          return { data: null, error: { name: "application_error", message: "Unable to fetch data. The request could not be resolved." } };
        }
        return { data: { id }, error: null };
      },
    };
  },
}));

vi.mock("./db/referrals", () => ({
  expireStalePendingReferrals: vi.fn(),
  getOrCreateReferralCode: vi.fn(async () => "KLIEG-ABC123"),
  getUserByReferralCode: vi.fn(),
  claimReferral: vi.fn(),
  redeemReferralCode: vi.fn(),
  completeReferral: vi.fn(),
  creditReferrerOnPaidAction: vi.fn(),
  getReferralCreditsEarned: vi.fn(),
  getReferralStats: vi.fn(),
  getReferralHistory: vi.fn(),
  recordEmailInvite: vi.fn(async () => ({ success: true })),
  hasInvitedEmail: vi.fn(async () => false),
  isValidReferralCodeFormat: vi.fn(),
}));

const HOUR = 60 * 60 * 1000;
const ORIGIN = "https://klieglabs.com";

let referralRouter: typeof import("./routes/referral").referralRouter;
let INVITE_NOT_SENT_SENTENCE: string;

let nextUserId = 24930;
let nextFriend = 0;

function caller(id = nextUserId++) {
  return referralRouter.createCaller({
    user: { id, email: `referrer-${id}@example.com`, name: "Referrer", approved: true, suspendedAt: null, lockedUntil: null },
    req: { ip: "203.0.113.93", headers: { origin: ORIGIN, host: new URL(ORIGIN).host } },
  } as never);
}

const friend = () => `friend-2493-${nextFriend++}@example.com`;

beforeEach(async () => {
  /* Fake timers BEFORE the limiter is imported, so its 5-minute sweep is
     scheduled on the fake clock and advancing time really runs it. */
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-14T09:00:00Z"));
  vi.resetModules();
  ({ referralRouter, INVITE_NOT_SENT_SENTENCE } = await import("./routes/referral"));
  vi.stubEnv("RESEND_API_KEY", "re_test_not_a_real_key");
  mailbox.delivered.length = 0;
  mailbox.calls.length = 0;
  mailbox.seen.clear();
  mailbox.loseNextReply = false;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("the 'a day' invite limits hold for a day (#2493 part 1)", () => {
  it("an address that has had 3 invites is still refused after an hour and a sweep", async () => {
    const address = friend();
    for (let i = 0; i < 3; i++) {
      await expect(caller().sendInvite({ email: address })).resolves.toEqual({ sent: true });
    }
    // The control: the cap is really reached right now.
    await expect(caller().sendInvite({ email: address })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });

    vi.advanceTimersByTime(HOUR + 10 * 60 * 1000); // past the old one-hour cutoff and two sweeps

    await expect(caller().sendInvite({ email: address })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(mailbox.delivered.filter((m) => m.to === address)).toHaveLength(3);
  });

  it("a referrer who has sent 10 is still refused after an hour and a sweep", async () => {
    const id = nextUserId++;
    for (let i = 0; i < 10; i++) {
      await expect(caller(id).sendInvite({ email: friend() })).resolves.toEqual({ sent: true });
    }
    await expect(caller(id).sendInvite({ email: friend() })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });

    vi.advanceTimersByTime(HOUR + 10 * 60 * 1000);

    await expect(caller(id).sendInvite({ email: friend() })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("the positive arm: once the day has really passed, both limits lift", async () => {
    const id = nextUserId++;
    const address = friend();
    for (let i = 0; i < 3; i++) await caller().sendInvite({ email: address });
    for (let i = 0; i < 10; i++) await caller(id).sendInvite({ email: friend() });

    vi.advanceTimersByTime(24 * HOUR + 10 * 60 * 1000);

    await expect(caller().sendInvite({ email: address })).resolves.toEqual({ sent: true });
    await expect(caller(id).sendInvite({ email: friend() })).resolves.toEqual({ sent: true });
  });
});

describe("a lost reply never becomes a second email (#2493 part 2)", () => {
  it("the mailbox's control: two different invites are two emails", async () => {
    const id = nextUserId++;
    await caller(id).sendInvite({ email: friend() });
    await caller(id).sendInvite({ email: friend() });
    expect(mailbox.delivered).toHaveLength(2);
  });

  it("sent, reply lost, retried: the customer is told the truth and the stranger gets ONE email", async () => {
    const id = nextUserId++;
    const address = friend();

    mailbox.loseNextReply = true;
    await expect(caller(id).sendInvite({ email: address })).rejects.toMatchObject({ message: INVITE_NOT_SENT_SENTENCE });
    expect(mailbox.delivered).toHaveLength(1); // it DID go, though nobody was told

    await expect(caller(id).sendInvite({ email: address })).resolves.toEqual({ sent: true });
    expect(mailbox.delivered).toHaveLength(1);

    // At the wire: both attempts carried the same key.
    const keys = mailbox.calls.map((c) => c.options?.idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
  });

  it("the key is the pair, not a constant: another referrer may still invite the same address", async () => {
    const address = friend();
    await expect(caller().sendInvite({ email: address })).resolves.toEqual({ sent: true });
    await expect(caller().sendInvite({ email: address.toUpperCase() })).resolves.toEqual({ sent: true });
    expect(mailbox.delivered).toHaveLength(2);
    const [a, b] = mailbox.calls.map((c) => (c.options as Options)?.idempotencyKey);
    expect(a).not.toBe(b);
  });

  it("the key never carries the address in plain text and fits Resend's 256 characters", async () => {
    const address = friend();
    await caller().sendInvite({ email: address });
    const key = String(mailbox.calls[0].options?.idempotencyKey);
    expect(key).not.toContain(address);
    expect(key.length).toBeLessThanOrEqual(256);
    expect((mailbox.calls[0].payload as Wire).to).toBe(address);
  });
});
