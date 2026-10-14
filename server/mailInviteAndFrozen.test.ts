/*
 * #2481 — THE REFERRAL INVITE AND THE FROZEN-ACCOUNT NOTICE, ON RESEND.
 *
 * His ruling, 2026-10-14: *"1) agree with you"* — both emails move off Klaviyo
 * (whose key production never had, so neither had ever been delivered) onto
 * the transport that already sends verification and renewal mail, with Klieg
 * wording. These arms read what the TRANSPORT is handed (working law 5): the
 * real builders and the real `sendProductEmail` run, and only Resend's client
 * is a stand-in, so nothing leaves the process.
 *
 * What the routers do with the answer is driven elsewhere, through the real
 * procedures: `referral-enhancements.test.ts` (the toast's `sent: true` is
 * only ever the truth) and `accountFreeze.test.ts` (both freeze roads report
 * the notice's fate to staff).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { resendSend } = vi.hoisted(() => ({
  resendSend: vi.fn(async (_payload: unknown) => ({ data: { id: "email_1" } as null | { id: string }, error: null as null | { message: string } })),
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resendSend };
  },
}));

import { PRODUCT_NAME } from "@shared/brand";
import { SUPPORT_EMAIL } from "@shared/supportEmail";
import type { DisplayCredits } from "@shared/creditDisplay";
import {
  FROZEN_NOTICE_STAFF_SENTENCE,
  REFERRER_NAME_MAX,
  UNNAMED_REFERRER,
  accountFrozenEmail,
  mailSender,
  noticeOfFreeze,
  referralInviteEmail,
  sendAccountFrozenEmail,
  sendProductEmail,
  sendReferralInviteEmail,
} from "./mail";

type Wire = { from: string; replyTo: string; to: string; subject: string; html: string };
const onTheWire = (): Wire[] => resendSend.mock.calls.map((call) => (call as unknown as [Wire])[0]);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("RESEND_API_KEY", "re_test_not_a_real_key");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const INVITE = {
  to: "friend@example.com",
  referrerName: "Sam Rivera",
  referralLink: "https://klieglabs.com?ref=KLIEG-ABC123",
  rewardCredits: 2500 as DisplayCredits,
};

/*
 * The brand words a customer must never read again — in the words AND in any
 * address the email loads. No logo is stripped first: these two emails carry
 * none (the shell's `drape-logo-tight.png` is #1921's retired mark), so the
 * whole HTML is read and an image coming back with the old name reddens here.
 */
const STALE_BRAND = /formastudio|forma studio|drape|manuscdn/i;
const readable = (email: { subject: string; html: string }) => `${email.subject}
${email.html}`;

describe("the referral invite", () => {
  it("goes out on Resend, from the product's own sending domain, replies to support", async () => {
    await expect(sendReferralInviteEmail(INVITE)).resolves.toEqual({ success: true });
    const [wire] = onTheWire();
    expect(onTheWire()).toHaveLength(1);
    expect(wire.from).toBe(mailSender("invite"));
    expect(wire.replyTo).toBe(SUPPORT_EMAIL);
    expect(wire.to).toBe("friend@example.com");
  });

  it("names who sent it and the product in the subject", () => {
    expect(referralInviteEmail(INVITE).subject).toBe(`Sam Rivera invited you to ${PRODUCT_NAME}`);
  });

  it("says what they get, with the figure it was handed, and links the referrer's link", () => {
    const { html } = referralInviteEmail(INVITE);
    expect(html).toContain("2,500 credits");
    expect(html).toContain('href="https://klieglabs.com?ref=KLIEG-ABC123"');
  });

  it("carries no retired brand — the control proves the check can see one", () => {
    expect(readable(referralInviteEmail(INVITE))).not.toMatch(STALE_BRAND);
    // Positive control on the reader: the old template's own subject line.
    expect("Sam invited you to FormaStudio — claim your 2500 credits").toMatch(STALE_BRAND);
  });

  it("an unnamed referrer is a friend, never a blank or a placeholder", () => {
    const email = referralInviteEmail({ ...INVITE, referrerName: null });
    expect(email.subject).toBe(`${UNNAMED_REFERRER} invited you to ${PRODUCT_NAME}`);
    expect(email.html).toContain(UNNAMED_REFERRER);
    expect(email.html).not.toMatch(/null|undefined/);
  });

  it("escapes a name the referrer typed, in the body, and keeps it to one line in the subject", () => {
    const email = referralInviteEmail({ ...INVITE, referrerName: 'Eve <img src=x onerror="x">\nBcc: a@b.c' });
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("Eve &lt;img src=x");
    expect(email.subject).not.toMatch(/[\r\n]/);
  });
});

describe("a name is not a place to write to a stranger (#2481)", () => {
  it("the referrer's name is cut to its limit in the subject and the body", () => {
    const long = `Sam ${"x".repeat(200)} visit evil.example now`;
    const email = referralInviteEmail({ ...INVITE, referrerName: long });
    expect(email.subject).not.toContain("evil.example");
    expect(email.html).not.toContain("evil.example");
    expect(email.subject.length).toBeLessThanOrEqual(REFERRER_NAME_MAX + ` invited you to ${PRODUCT_NAME}`.length);
    // Control: a name within the limit is carried whole.
    expect(referralInviteEmail({ ...INVITE, referrerName: "Sam Rivera" }).subject).toContain("Sam Rivera");
  });
});

describe("the frozen-account notice", () => {
  const FROZEN = { to: "frozen@example.com", name: "Pat Lee" };

  it("goes out on Resend to the frozen customer", async () => {
    await expect(sendAccountFrozenEmail(FROZEN)).resolves.toEqual({ success: true });
    const [wire] = onTheWire();
    expect(wire.to).toBe("frozen@example.com");
    expect(wire.from).toBe(mailSender("account"));
    expect(wire.subject).toBe(`Your ${PRODUCT_NAME} account is paused`);
  });

  it("greets them by first name, says what is paused and that nothing is lost", () => {
    const { html } = accountFrozenEmail(FROZEN);
    expect(html).toContain("Hi Pat,");
    expect(html).toContain("cannot make anything new or buy credits");
    expect(html).toContain("nothing has been deleted");
  });

  it("offers the way out his word named (#452) as a link", () => {
    expect(SUPPORT_EMAIL).toBe("support@klieglabs.com");
    expect(accountFrozenEmail(FROZEN).html).toContain(`href="mailto:${SUPPORT_EMAIL}"`);
  });

  it("carries no retired brand", () => {
    expect(readable(accountFrozenEmail(FROZEN))).not.toMatch(STALE_BRAND);
  });

  it("escapes the customer's name", () => {
    expect(accountFrozenEmail({ ...FROZEN, name: "<b>Pat</b>" }).html).toContain("Hi &lt;b&gt;Pat&lt;/b&gt;,");
  });

  it("a nameless customer is greeted as 'there'", () => {
    expect(accountFrozenEmail({ ...FROZEN, name: null }).html).toContain("Hi there,");
  });
});

describe("the answer is the truth about whether it went", () => {
  it("a send the transport refuses answers success: false", async () => {
    resendSend.mockResolvedValueOnce({ data: null, error: { message: "domain not verified" } });
    await expect(sendReferralInviteEmail(INVITE)).resolves.toEqual({ success: false, error: "domain not verified" });
  });

  it("no key answers success: false and never throws — while the bare transport DOES throw (the control)", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(sendProductEmail(referralInviteEmail(INVITE))).rejects.toThrow(/RESEND_API_KEY/);
    await expect(sendReferralInviteEmail(INVITE)).resolves.toMatchObject({ success: false });
    await expect(sendAccountFrozenEmail({ to: "a@b.c", name: null })).resolves.toMatchObject({ success: false });
    expect(resendSend).not.toHaveBeenCalled();
  });

  it("noticeOfFreeze: no address means no send, and staff are told so", async () => {
    await expect(noticeOfFreeze({ email: null, name: "Pat" })).resolves.toEqual({
      notice: "no_address",
      noticeMessage: FROZEN_NOTICE_STAFF_SENTENCE.no_address,
    });
    expect(resendSend).not.toHaveBeenCalled();
  });

  it("noticeOfFreeze: a refused send is 'not_sent', and the three staff sentences are distinct", async () => {
    resendSend.mockResolvedValueOnce({ data: null, error: { message: "x" } });
    await expect(noticeOfFreeze({ email: "a@b.c", name: null })).resolves.toMatchObject({ notice: "not_sent" });
    expect(new Set(Object.values(FROZEN_NOTICE_STAFF_SENTENCE)).size).toBe(3);
  });
});
