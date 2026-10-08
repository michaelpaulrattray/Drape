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
import { Resend } from "resend";
import { PRODUCT_NAME } from "@shared/brand";

/**
 * The verified Resend sending domain. Every `from` in the product is built on
 * it, so moving the domain is one edit.
 */
export const MAIL_SENDING_DOMAIN = "mail.klieglabs.com";

/**
 * Where a customer's reply goes. The same address the login page already
 * gives a suspended account and the plan ladder gives an Enterprise enquiry —
 * it is the one human door this product has.
 */
export const SUPPORT_EMAIL = "support@klieglabs.com";

/**
 * Build a `from` header for a purpose: `verify`, `billing`, …
 *
 * The display name is the product's name, derived rather than typed (#1955).
 */
export function mailSender(localPart: string): string {
  return `${PRODUCT_NAME} <${localPart}@${MAIL_SENDING_DOMAIN}>`;
}

export interface ProductEmail {
  /** The mailbox this comes from, local part only — `mailSender` adds the rest. */
  purpose: string;
  to: string;
  subject: string;
  html: string;
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

  const { error } = await new Resend(apiKey).emails.send({
    from: mailSender(email.purpose),
    replyTo: SUPPORT_EMAIL,
    to: email.to,
    subject: email.subject,
    html: email.html,
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}
