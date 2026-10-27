/**
 * THE PRODUCT'S OUTBOUND MAIL — one transport, one sending domain, one
 * reply-to.
 *
 * Until #1941 there was exactly one transactional email in the product (the
 * verification link) and its Resend client, its `from` and its `replyTo` lived
 * inline beside it. A second email arrived and the choice was a second copy of
 * those three facts or one module: working law 4 says the copy drifts, and this
 * repository has already paid for a drifted brand word in a customer-facing
 * refusal (`shared/brand.ts`'s own header).
 *
 * ⚠ **THE SENDING DOMAIN IS THE LOAD-BEARING FACT, NOT THE MAILBOX.** Resend
 * verifies a DOMAIN, and every address on a verified domain may send; the
 * verification email has been sending from `mail.klieglabs.com` in production
 * since before the rebrand, which is the proof that domain is verified. So a
 * new purpose gets a new local part here and needs no new registration
 * anywhere. {@link MAIL_SENDING_DOMAIN} is named once for that reason — a
 * second literal is the thing that cannot be moved when the domain does.
 *
 * ⚠ **IT REFUSES RATHER THAN PRETENDING.** With no `RESEND_API_KEY` the send
 * THROWS, exactly as it always did: a mail transport that quietly returns
 * success when it is unconfigured is invariant 7's forbidden shape, and the
 * caller's decision (retry tomorrow, or tell the customer) depends on knowing
 * the difference.
 */
import { createHash } from "node:crypto";
import { Resend } from "resend";
import { PRODUCT_NAME } from "@shared/brand";
import { formatCredits, type DisplayCredits } from "@shared/creditDisplay";

/**
 * The verified Resend sending domain. Every `from` in the product is built on
 * it, so moving the domain is one edit.
 */
const MAIL_SENDING_DOMAIN = "mail.klieglabs.com";

/** Where a customer's reply goes — declared once in `shared/` (#2456). */
import { SUPPORT_EMAIL } from "@shared/supportEmail";
export { SUPPORT_EMAIL };

/**
 * Build a `from` header for a purpose: `verify`, `billing`, …
 *
 * The display name is the product's name, derived rather than typed (#1955).
 */
export function mailSender(localPart: string): string {
  return `${PRODUCT_NAME} <${localPart}@${MAIL_SENDING_DOMAIN}>`;
}

/**
 * Escape a value on its way into an email's HTML.
 *
 * ⚠ **EVERY EMAIL IN THIS PRODUCT INTERPOLATES A NAME THE CUSTOMER TYPED, AND
 * UNTIL NOW NEITHER OF THEM ESCAPED IT** — the relay's finding on PR #1975,
 * swept to its class in the same commit (working law 7). `users.name` is
 * free text: a name holding `<`, `&` or a quote lands inside a `<p>` and a
 * `style="…"` attribute, so at best the greeting renders as rubbish and at
 * worst the surrounding markup is broken by somebody else's address book.
 * There were exactly TWO html builders in the tree (`renewalReminder.ts` and
 * `routes/emailVerification.ts`); both call this, and it lives here rather
 * than beside either so a third email cannot be written without meeting it —
 * and the third and fourth (#2481's invite and frozen notice, below) do.
 *
 * The five XML predefined entities and nothing else — an email body is HTML,
 * not a URL, and a helper that also did percent-encoding would be wrong in
 * both places. `&` goes first, or it would re-escape the escapes.
 */
export function escapeEmailHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface ProductEmail {
  /** The mailbox this comes from, local part only — `mailSender` adds the rest. */
  purpose: string;
  to: string;
  subject: string;
  html: string;
  /**
   * Resend's `Idempotency-Key` (#2493). Two sends carrying the same key within
   * Resend's 24 hours become ONE email: the second is answered with the first
   * one's id and nothing is mailed. For an email whose retry must never become
   * a second copy — the provider accepted it, the reply was lost, the caller
   * tries again. Resend's limit is 256 characters; the keys built here are a
   * fixed-length hash.
   */
  idempotencyKey?: string;
}

export type MailResult = { success: true } | { success: false; error: string };

/**
 * Send one transactional email.
 *
 * The client is built per call rather than at module load so that a key set
 * after boot is picked up, and so that importing this module never reaches for
 * configuration (`server/monitoring/errorTracker.ts` takes the same care about
 * what an import is allowed to do).
 */
export async function sendProductEmail(email: ProductEmail): Promise<MailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const { error } = await new Resend(apiKey).emails.send(
    {
      from: mailSender(email.purpose),
      replyTo: SUPPORT_EMAIL,
      to: email.to,
      subject: email.subject,
      html: email.html,
    },
    /* resend@6's `CreateEmailRequestOptions.idempotencyKey`, sent as the
       `Idempotency-Key` header (read in node_modules/resend's types, #2493). */
    email.idempotencyKey ? { idempotencyKey: email.idempotencyKey } : undefined,
  );

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Send one email and answer — never throw — whether it went.
 *
 * #2481: the two callers below must TELL somebody what happened (a toast, a
 * staff panel), so a missing key and a refused send are the same answer to
 * them: it did not go. {@link sendProductEmail} still throws on a missing key,
 * which is right for the sweep that decides to retry tomorrow; this is the
 * shape for a caller that reports instead.
 */
async function deliver(email: ProductEmail): Promise<MailResult> {
  try {
    return await sendProductEmail(email);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/* ==========================================================================
   THE TWO EMAILS THAT USED TO BE KLAVIYO'S — #2481

   His ruling, 2026-10-14: *"1) agree with you"* — move the referral invite
   and the account-frozen notice onto this transport, with Klieg wording.
   Until then both were Klaviyo events whose key production never had, so
   neither email had ever left the building, and the templates they would
   have used still said FormaStudio. The words now live here, in the bundle,
   where a rename reaches them.

   They wear the renewal reminder's shell (`billing/renewalReminder.ts`) so
   the product's mail reads as one product — EXCEPT THE LOGO, deliberately.
   That shell's image is `drape-logo-tight.png`, the retired mark (#1921,
   parked on his word behind the sign-in and landing redesign), and rendered
   it is a faint "drape" on white. The invite is the first thing a stranger
   ever reads about the product, and this card's ruling is that no retired
   brand reaches them, so these two carry the name in words and no image.
   When #1921 lands a Klieg mark, it belongs here too.
   ========================================================================== */

/** The shell these emails share: heading, body rows, footer. */
function emailShell(heading: string, rows: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #EBEBEB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #EBEBEB; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; overflow: hidden;">
          <tr>
            <td style="padding: 32px 32px 0 32px;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #0A0A0A; letter-spacing: -0.02em; line-height: 1.3;">
                ${heading}
              </h1>
            </td>
          </tr>
${rows}
          <tr>
            <td style="padding: 28px 32px 0 32px;">
              <hr style="border: none; border-top: 1px solid #E5E5E5; margin: 0;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px 32px 32px;">
              <p style="margin: 0; font-size: 12px; color: #BFBFBF; line-height: 1.5; letter-spacing: 0.02em;">
                ${PRODUCT_NAME} &mdash; Your next campaign, cast in minutes.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
}

function paragraphRow(html: string): string {
  return `          <tr>
            <td style="padding: 12px 32px 0 32px;">
              <p style="margin: 0; font-size: 15px; color: #555555; line-height: 1.6;">
                ${html}
              </p>
            </td>
          </tr>`;
}

function smallRow(html: string): string {
  return `          <tr>
            <td style="padding: 24px 32px 0 32px;">
              <p style="margin: 0; font-size: 13px; color: #999999; line-height: 1.5;">
                ${html}
              </p>
            </td>
          </tr>`;
}

function buttonRow(href: string, label: string): string {
  return `          <tr>
            <td style="padding: 24px 32px 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                <tr>
                  <td align="center">
                    <a href="${href}" target="_blank" style="display: inline-block; background-color: #0A0A0A; color: #ffffff; padding: 14px 40px; border-radius: 100px; text-decoration: none; font-size: 14px; font-weight: 500; letter-spacing: 0.01em;">
                      ${label}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

/** A subject line never carries a line break, whatever a customer typed. */
function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/** The longest referrer name an invite repeats; the rest is cut (#2481). */
export const REFERRER_NAME_MAX = 60;

/** Who the invite says it is from when the referrer never gave a name. */
export const UNNAMED_REFERRER = "A friend";

export interface ReferralInviteCopy {
  /** The referrer's user id — half of what makes the invite one email (#2493). */
  referrerId: number;
  to: string;
  /** The referrer's name as they typed it, or null. Escaped here, not by the caller. */
  referrerName: string | null;
  /** The referrer's share link, built on the product's own address. */
  referralLink: string;
  /**
   * #2478: the reward on the DISPLAY scale, the number every screen shows —
   * typed `DisplayCredits` so a raw ledger figure is a compile error at the
   * caller rather than a factor-of-five lie in the email.
   */
  rewardCredits: DisplayCredits;
}

/**
 * The idempotency key of one referrer's invite to one address (#2493).
 *
 * ⚠ **A SEND WHOSE REPLY IS LOST MUST NOT BECOME TWO EMAILS.** If Resend
 * accepted the invite and the answer never came back, the router reports "it
 * didn't go", records nothing and hands both rate-limit slots back — so the
 * retry would mail the same stranger again, with no cap. With this key the
 * retry is the SAME request to Resend, which answers with the first email's id
 * and sends nothing.
 *
 * Keyed on (referrer, address) and deliberately NOT on the day the card
 * suggested: an invite is already once per (referrer, address) for ever
 * (`hasInvitedEmail`), and Resend forgets a key after 24 hours on its own, so a
 * date in the key would add nothing but a hole at midnight — a lost reply at
 * 23:59 and a retry at 00:01 would be two keys and two emails.
 *
 * Hashed: fixed length (well under Resend's 256), and the address does not sit
 * in a header in plain text. Lowercased, as the duplicate check is.
 */
function referralInviteIdempotencyKey(referrerId: number, to: string): string {
  const digest = createHash("sha256").update(`${referrerId}:${to.trim().toLowerCase()}`).digest("hex");
  return `referral-invite/${digest}`;
}

/**
 * The invite a customer sends from Settings → Refer a friend.
 *
 * The person reading it has never heard of us, so it says who sent it, what
 * the product is in one sentence, what they get and when, and that nothing
 * happens unless they use the link. The reward is paid on the invitee's first
 * generation (`db/generations.ts` → `completeReferral`), which is "when you
 * make your first picture" in their words rather than ours.
 */
export function referralInviteEmail(copy: ReferralInviteCopy): ProductEmail {
  /* Whatever the referrer typed as their name: one line (it reaches the
     subject header), at most REFERRER_NAME_MAX characters (a name is not a
     place to write a message to a stranger), and escaped below for the body. */
  const plainName = oneLine(copy.referrerName ?? "").slice(0, REFERRER_NAME_MAX).trim() || UNNAMED_REFERRER;
  const name = escapeEmailHtml(plainName);
  const link = escapeEmailHtml(copy.referralLink);
  const rows = [
    paragraphRow(
      `${name} thinks you would like ${PRODUCT_NAME}, a studio for making short films, ads and creator content with people who stay the same from shot to shot.`,
    ),
    paragraphRow(
      `Join through their link and you get <strong style="color: #0A0A0A;">${formatCredits(copy.rewardCredits)} credits</strong> when you make your first picture.`,
    ),
    buttonRow(link, "Accept the invitation"),
    smallRow(`If the button does not work, paste this link into your browser:<br />${link}`),
    smallRow(
      `You are getting this because ${name} entered your address in ${PRODUCT_NAME}. If you were not expecting it, you can ignore this email &mdash; nothing happens unless you use the link.`,
    ),
  ].join("\n");

  return {
    purpose: "invite",
    to: copy.to,
    idempotencyKey: referralInviteIdempotencyKey(copy.referrerId, copy.to),
    subject: `${plainName} invited you to ${PRODUCT_NAME}`,
    html: emailShell(`You&rsquo;re invited to ${PRODUCT_NAME}`, rows),
  };
}

/** Send the invite; answers whether it went and never throws. */
export async function sendReferralInviteEmail(copy: ReferralInviteCopy): Promise<MailResult> {
  return deliver(referralInviteEmail(copy));
}

export interface AccountFrozenCopy {
  to: string;
  /** The customer's name as they typed it, or null. Escaped here. */
  name: string | null;
}

/**
 * The notice a customer gets when staff freeze their account.
 *
 * It says what a freeze does, read at the code rather than assumed: making
 * anything is refused (`casting/atomicCredits.ts`, `castingV2/spendGuards.ts`)
 * and so is buying (`routes/billing.ts`), while signing in is not, and nothing
 * is deleted. And it says what to do: reply, and a person answers (the
 * reply-to is {@link SUPPORT_EMAIL}).
 *
 * ⚠ **IT CARRIES NEITHER THE STAFF REASON NOR THE STAFF NAME, ON PURPOSE.** The
 * Klaviyo event sent both (`"Admin freeze: …"` / `"Manual freeze by
 * moderator: …"`, and the staff member's name). Neither freeze dialog tells
 * the person typing that a customer will read it — they ask for a reason for
 * the record — so printing it would turn an internal note into customer copy
 * without anyone deciding to. If the reason should reach the customer, the
 * dialogs say so first; that is a product decision, not this card's.
 */
/**
 * The way out of a freeze the notice offers (#452, his word 2026-09-02:
 * *"Point it at support@klieglabs.com"*) — the shared support address, as a
 * link, so it works in a mail client that ignores reply-to.
 */
const FROZEN_NOTICE_SUPPORT_LINK = `mailto:${SUPPORT_EMAIL}`;

export function accountFrozenEmail(copy: AccountFrozenCopy): ProductEmail {
  const firstName = escapeEmailHtml(oneLine(copy.name ?? "").split(" ")[0] || "there");
  const rows = [
    paragraphRow(`Hi ${firstName},`),
    paragraphRow(
      `We have paused your ${PRODUCT_NAME} account while we take a closer look at it. Until we are done, you cannot make anything new or buy credits.`,
    ),
    paragraphRow(`You can still sign in, and everything you have made is safe &mdash; nothing has been deleted.`),
    paragraphRow(
      `If you think this is a mistake, or you would like to know more, reply to this email or write to <a href="${FROZEN_NOTICE_SUPPORT_LINK}" style="color: #0A0A0A;">${SUPPORT_EMAIL}</a>, and a person will look into it with you.`,
    ),
  ].join("\n");

  return {
    purpose: "account",
    to: copy.to,
    subject: `Your ${PRODUCT_NAME} account is paused`,
    html: emailShell("Your account is paused for review", rows),
  };
}

/** Send the frozen notice; answers whether it went and never throws. */
export async function sendAccountFrozenEmail(copy: AccountFrozenCopy): Promise<MailResult> {
  return deliver(accountFrozenEmail(copy));
}

/**
 * What became of the notice, for the staff member who froze the account.
 *
 * #2481: both freeze roads sent the notice fire-and-forget and answered
 * `{ success: true }` whatever happened to it, so a panel said "Account
 * frozen" over a customer who was never told. The freeze itself is still the
 * success; this says, beside it, whether the person knows.
 */
export type FrozenNotice = "sent" | "not_sent" | "no_address";

export const FROZEN_NOTICE_STAFF_SENTENCE: Record<FrozenNotice, string> = {
  sent: "Account frozen. They have been emailed to say so.",
  not_sent: "Account frozen, but the email telling them could not be sent. Let them know another way.",
  no_address: "Account frozen. There is no email address on the account, so they have not been told.",
};

/**
 * Tell a just-frozen customer, and answer what happened — the one road both
 * freeze procedures take, so the two cannot drift apart in what they report.
 */
export async function noticeOfFreeze(target: {
  email: string | null;
  name: string | null;
}): Promise<{ notice: FrozenNotice; noticeMessage: string }> {
  if (!target.email) {
    return { notice: "no_address", noticeMessage: FROZEN_NOTICE_STAFF_SENTENCE.no_address };
  }
  const result = await sendAccountFrozenEmail({ to: target.email, name: target.name });
  const notice: FrozenNotice = result.success ? "sent" : "not_sent";
  return { notice, noticeMessage: FROZEN_NOTICE_STAFF_SENTENCE[notice] };
}
