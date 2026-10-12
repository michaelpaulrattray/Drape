/**
 * Email Verification Routes
 *
 * POST /api/auth/resend-verification — Resend verification email
 * GET  /api/auth/verify-email        — Verify email token + auto-login
 *
 * Uses Resend for transactional email delivery.
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { ASSETS_BASE_URL, COOKIE_NAME, SESSION_MAX_AGE_MS } from "@shared/const";
import { PRODUCT_NAME } from "@shared/brand";
import { escapeEmailHtml, sendProductEmail, type ProductEmail } from "../mail";
import { getSessionCookieOptions } from "../_core/cookies";
import { ENV } from "../_core/env";
import { sdk } from "../_core/sdk";
import { getDb } from "../db/connection";
import { users } from "../../drizzle/schema";
import { getUserByEmail } from "../db/users";
import { logAuditEvent, AUDIT_ACTIONS } from "../auditLog";
import { checkRateLimit, getClientIp } from "../security/rateLimit";
import { createModuleLogger } from "../logging/logger";
import { refuseCrossSiteAuthRequest } from "../security/crossSiteExpressGuard";

const log = createModuleLogger("emailVerification");

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export const emailVerificationRouter = Router();

/**
 * ⚠ **NO STATE-CHANGING REQUEST HERE MAY COME FROM ANOTHER SITE EITHER — #1659.**
 *
 * This router's SESSION MINT is `GET /verify-email`, which a form cannot carry,
 * so it is not the login-CSRF road — and the guard lets every `GET` through
 * untouched, which it must: arriving on a verification link from an email client
 * is a cross-site navigation and is a customer, not an attack.
 *
 * It is mounted because of the OTHER route: `POST /resend-verification` is a
 * state-changing auth route, and the rule `authCrossSiteGuard.test.ts` derives is
 * *every mint-site module with a non-GET route carries this guard* — a rule with
 * no exception list, rather than a list somebody has to keep. It costs nothing
 * real: that endpoint's only caller is our own `VerifyEmail` page, same-origin,
 * and nothing legitimate POSTs to it from anywhere else.
 */
emailVerificationRouter.use(refuseCrossSiteAuthRequest);

/**
 * WHY A LINK NAMES ITS OWN ACCOUNT, SIGNED — #2401.
 *
 * Asking for a new verification email REPLACES the stored token, so the link in
 * the older email finds no row. Until this card that miss took the shared
 * `invalid_token` exit — "Authentication Error / An error occurred during sign
 * in" — for a customer who had done nothing wrong but open the wrong email.
 *
 * The older token is gone from the table, so the only way to know whose link it
 * was is for the link to say so: `<openId>.<nonce>.<mac>`, where the mac is an
 * HMAC over the openId and nonce under the session secret (the Google road
 * reuses the same secret for its state, `googleAuth.ts`). The mac is what keeps
 * this from being an oracle: a hand-typed `<openId>.<anything>` fails it and
 * gets the same `invalid_token` an unknown token always got, so only a link this
 * product actually emailed can learn that it was replaced.
 *
 * ⚠ THE openId, NEVER `users.id` (the relay's finding on PR #2415). Emails are
 * forwarded, scanned and logged, and an auto-increment id in a link says how
 * many accounts exist. Every email account's openId is `email_<uuid>`
 * (`emailAuth.ts`), random and non-sequential, and only email accounts are sent
 * these links. An openId outside `[A-Za-z0-9_-]` cannot contain the `.`
 * separator, so the split is unambiguous; anything else gets a plain token.
 *
 * ⚠ It NEVER makes the older link work. The row lookup below is still equality
 * on the whole current token; a link that misses it can at most be told which
 * calm note to show — replaced, or already verified — and mints no session and
 * verifies nothing. Tokens issued before this shipped are plain hex, carry no
 * account, and keep the generic answer if they miss; they expire within 24 hours.
 *
 * ⚠ LENGTH: `emailVerificationToken` is varchar(128). openId (42 for
 * `email_<uuid>`, at most 62 here) + 32-hex nonce (16 bytes, 128 bits) + 32-hex
 * mac + two dots is 108 for every email account and never more than 128. An
 * openId longer than 62 is given a plain token rather than a truncated one.
 */
const LINK_MAC_LABEL = "drape:email-verification-link:v1";
const SIGNABLE_OPEN_ID = /^[A-Za-z0-9_-]{1,62}$/;

function linkMac(openId: string, nonce: string): string | null {
  /* An empty secret would make every mac forgeable; refuse to sign or read. */
  if (!ENV.cookieSecret) return null;
  return createHmac("sha256", ENV.cookieSecret)
    .update(`${LINK_MAC_LABEL}:${openId}:${nonce}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Generate a cryptographically secure verification token for one account.
 */
export function generateVerificationToken(openId: string): string {
  const nonce = randomBytes(16).toString("hex");
  const mac = SIGNABLE_OPEN_ID.test(openId) ? linkMac(openId, nonce) : null;
  /* Without a secret, or for an openId that cannot be carried, there is nothing
     to sign: a plain token still verifies, it just cannot be recognised later
     as replaced. */
  if (mac === null) return randomBytes(48).toString("hex");
  return `${openId}.${nonce}.${mac}`;
}

/**
 * The account (its openId) a verification link was issued for, IF this product
 * signed it. `null` for anything else — a legacy hex token, a typo, a forgery.
 */
export function issuedLinkAccount(token: string): string | null {
  const match = /^([A-Za-z0-9_-]{1,62})\.([0-9a-f]{32})\.([0-9a-f]{32})$/.exec(token);
  if (!match) return null;
  const openId = match[1]!;
  const expected = linkMac(openId, match[2]!);
  if (expected === null) return null;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(match[3]!, "utf8");
  return a.length === b.length && timingSafeEqual(a, b) ? openId : null;
}

/**
 * Build the verification URL from the request origin
 */
function buildVerifyUrl(req: Request, token: string): string {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = forwardedProto
    ? (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto.split(",")[0]).trim()
    : req.protocol;
  const origin = `${proto}://${req.get("host")}`;
  return `${origin}/api/auth/verify-email?token=${token}`;
}

/**
 * THE VERIFICATION EMAIL'S BODY, as a pure builder.
 *
 * Extracted from {@link sendVerificationEmail} by the relay's finding on
 * PR #1975: the finding was about an unescaped name in the renewal notice, and
 * this email had the same defect — but it could not be DRIVEN, because its
 * html was an argument to the transport inside an async function that needs an
 * Express request and a mail provider. A fix without a failing reproduction is
 * half a fix (the standing orders), so the body is now a function of its three
 * facts and the suite reads it. Nothing about the markup changed.
 */
export function verificationEmail(to: string, name: string, verifyUrl: string): ProductEmail {
  const logoUrl = `${ASSETS_BASE_URL}/drape-logo-tight.png`;
  /* ⚠ ESCAPED — the sibling of the relay's finding on PR #1975, swept here in
     the same commit (working law 7). `users.name` is free text, and this
     greeting has been dropping it into HTML unescaped since the email shipped;
     see `escapeEmailHtml`'s header for the class. */
  const firstName = escapeEmailHtml(name ? name.split(" ")[0] : "there");

  return {
    purpose: "verify",
    to,
    subject: `Verify your email — ${PRODUCT_NAME}`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #EBEBEB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #EBEBEB; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; overflow: hidden;">
          <!-- Logo -->
          <tr>
            <td style="padding: 32px 32px 0 32px;">
              <img src="${logoUrl}" alt="Drape" height="24" style="display: block; height: 24px; width: auto;" />
            </td>
          </tr>
          <!-- Heading -->
          <tr>
            <td style="padding: 28px 32px 0 32px;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #0A0A0A; letter-spacing: -0.02em; line-height: 1.3;">
                Verify your email
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 12px 32px 0 32px;">
              <p style="margin: 0; font-size: 15px; color: #555555; line-height: 1.6;">
                Hi ${firstName},
              </p>
              <p style="margin: 12px 0 0 0; font-size: 15px; color: #555555; line-height: 1.6;">
                You're one step away from studio-grade AI model creation. Verify your email to activate your account.
              </p>
            </td>
          </tr>
          <!-- CTA Button -->
          <tr>
            <td style="padding: 28px 32px 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                <tr>
                  <td align="center">
                    <a href="${verifyUrl}" target="_blank" style="display: inline-block; background-color: #0A0A0A; color: #ffffff; padding: 14px 40px; border-radius: 100px; text-decoration: none; font-size: 14px; font-weight: 500; letter-spacing: 0.01em;">
                      Verify Email
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Expiry note -->
          <tr>
            <td style="padding: 24px 32px 0 32px;">
              <p style="margin: 0; font-size: 13px; color: #999999; line-height: 1.5;">
                This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Fallback URL -->
          <tr>
            <td style="padding: 16px 32px 0 32px;">
              <p style="margin: 0; font-size: 12px; color: #BFBFBF; line-height: 1.5;">
                Or copy and paste this URL into your browser:
              </p>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #999999; line-height: 1.5; word-break: break-all;">
                ${verifyUrl}
              </p>
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding: 28px 32px 0 32px;">
              <hr style="border: none; border-top: 1px solid #E5E5E5; margin: 0;" />
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px 32px 32px;">
              <p style="margin: 0; font-size: 12px; color: #BFBFBF; line-height: 1.5; letter-spacing: 0.02em;">
                Klieg — Your next campaign, cast in minutes.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  };
}

/**
 * Send a verification email via Resend
 */
export async function sendVerificationEmail(
  req: Request,
  email: string,
  name: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const verifyUrl = buildVerifyUrl(req, token);

  const result = await sendProductEmail(verificationEmail(email, name, verifyUrl));

  if (!result.success) {
    log.error({ err: result.error }, "[EmailVerification] Failed to send verification email");
    return { success: false, error: result.error };
  }

  return { success: true };
}

/**
 * Store verification token in the database for a user
 */
export async function storeVerificationToken(
  userId: number,
  token: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(users)
    .set({
      emailVerificationToken: token,
      emailVerificationExpiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS),
    })
    .where(eq(users.id, userId));
}

/**
 * POST /api/auth/resend-verification
 * Rate limited: 3 per hour per email
 */
emailVerificationRouter.post("/resend-verification", async (req: Request, res: Response) => {
  const clientIp = getClientIp(req);
  const userAgent = req.headers["user-agent"] || null;

  // Rate limit
  const rl = checkRateLimit(`resend-verification:${clientIp}`, {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    keyPrefix: "resend_verification",
  });
  if (!rl.allowed) {
    res.status(429).json({ error: "Too many attempts. Please try again later." });
    return;
  }

  const schema = z.object({
    email: z.string().email().max(255),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  const { email } = parsed.data;

  try {
    const user = await getUserByEmail(email);
    if (!user) {
      // Don't reveal whether the email exists
      res.json({ success: true, message: "If an account exists, a verification email has been sent." });
      return;
    }

    /*
      Already verified: nothing is sent, and the answer SAYS so in a field the
      page reads (#2370). It used to carry only a `message`, which the verify page
      never read — so it showed "Verification email resent" and started a
      60-second countdown for an email that did not exist. The page keys on
      `alreadyVerified`, never on the wording of `message`.

      Not a new disclosure: this branch already answered a different sentence
      from the unknown-address branch above, so the wire said the same thing
      before the flag existed.
    */
    if (user.emailVerified) {
      res.json({ success: true, alreadyVerified: true, message: "Email is already verified. You can sign in." });
      return;
    }

    // Generate new token — this REPLACES the one in any earlier email (#2401)
    const token = generateVerificationToken(user.openId);
    await storeVerificationToken(user.id, token);

    // Send email
    const result = await sendVerificationEmail(req, email, user.name || "", token);
    if (!result.success) {
      log.error({ err: result.error }, "[EmailVerification] Resend failed");
      res.status(500).json({ error: "Failed to send verification email. Please try again." });
      return;
    }

    await logAuditEvent({
      userId: user.id,
      action: AUDIT_ACTIONS.EMAIL_VERIFICATION_RESENT,
      resourceType: "auth",
      resourceId: user.openId,
      metadata: { email },
      severity: "info",
      ipAddress: clientIp,
      userAgent,
    });

    res.json({ success: true, message: "Verification email sent." });
  } catch (error) {
    log.error({ err: error }, "[EmailVerification] Resend verification failed");
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

/**
 * GET /api/auth/verify-email?token=xxx
 * Verifies the token, marks email as verified, creates session, redirects to dashboard
 */
emailVerificationRouter.get("/verify-email", async (req: Request, res: Response) => {
  const clientIp = getClientIp(req);
  const userAgent = req.headers["user-agent"] || null;

  const { token } = req.query;

  if (!token || typeof token !== "string") {
    res.redirect("/login?error=invalid_token");
    return;
  }

  try {
    const db = await getDb();
    if (!db) {
      res.redirect("/login?error=server_error");
      return;
    }

    // Find user by verification token
    const result = await db
      .select()
      .from(users)
      .where(eq(users.emailVerificationToken, token))
      .limit(1);

    if (result.length === 0) {
      /*
        AN OLDER LINK (#2401). The customer asked for a new email and opened the
        previous one. The signed id says whose link it was; the row says what to
        tell them. Neither branch mints a session or writes to the row — a
        replaced link is told which email to use, and nothing else.
      */
      const issuedFor = issuedLinkAccount(token);
      if (issuedFor !== null) {
        const owner = await db
          .select()
          .from(users)
          .where(eq(users.openId, issuedFor))
          .limit(1);
        if (owner.length > 0) {
          const account = owner[0]!;
          await logAuditEvent({
            userId: account.id,
            action: AUDIT_ACTIONS.EMAIL_VERIFICATION_FAILED,
            resourceType: "auth",
            resourceId: account.openId,
            metadata: { reason: account.emailVerified ? "Replaced token, already verified" : "Replaced token" },
            severity: "info",
            ipAddress: clientIp,
            userAgent,
          });
          res.redirect(
            account.emailVerified ? "/login?error=already_verified" : "/login?error=verification_link_replaced",
          );
          return;
        }
      }

      await logAuditEvent({
        action: AUDIT_ACTIONS.EMAIL_VERIFICATION_FAILED,
        resourceType: "auth",
        metadata: { reason: "Invalid token" },
        severity: "warning",
        ipAddress: clientIp,
        userAgent,
      });
      res.redirect("/login?error=invalid_token");
      return;
    }

    const user = result[0];

    /*
      ALREADY VERIFIED — a second click, or a click after a mail scanner (Outlook
      Safe Links and the like) has already opened the link for the customer.
      A calm note on the sign-in page, and NO session: this exit mints nothing,
      so invariant 9's gates are untouched.

      ⚠ Reachable only because the success path below KEEPS the token (#2370).
      Until then it cleared it, so a repeat click found no row and took the
      `invalid_token` exit — "Authentication Error" for a customer who had done
      everything right — and this branch was dead code. It also sent
      `?message=`, which the sign-in page never read; it is an `error` code now,
      so `ERROR_MESSAGES` carries its note and `loginRefusalNotes.test.ts` holds
      the pair together.
    */
    if (user.emailVerified) {
      res.redirect("/login?error=already_verified");
      return;
    }

    // Check token expiry
    if (user.emailVerificationExpiresAt && user.emailVerificationExpiresAt < new Date()) {
      await logAuditEvent({
        userId: user.id,
        action: AUDIT_ACTIONS.EMAIL_VERIFICATION_FAILED,
        resourceType: "auth",
        resourceId: user.openId,
        metadata: { reason: "Token expired", email: user.email },
        severity: "warning",
        ipAddress: clientIp,
        userAgent,
      });
      res.redirect("/login?error=token_expired");
      return;
    }

    /*
      Mark the email verified and KEEP the token (#2370). A used token is what
      lets a repeat click resolve to "already verified" rather than "invalid".
      It can reach nothing else now: the already-verified exit above is checked
      first and mints no session, before the expiry check is ever read. A
      resend never replaces it for a verified account (that branch returns
      before a new token is made), so it stays with the row.
    */
    await db
      .update(users)
      .set({ emailVerified: true })
      .where(eq(users.id, user.id));

    // Create session (auto-login)
    const sessionToken = await sdk.createSessionToken(user.openId, {
      name: user.name || "",
      expiresInMs: SESSION_MAX_AGE_MS,
    });

    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_MAX_AGE_MS });

    // Audit log
    await logAuditEvent({
      userId: user.id,
      action: AUDIT_ACTIONS.EMAIL_VERIFIED,
      resourceType: "auth",
      resourceId: user.openId,
      metadata: { email: user.email },
      severity: "info",
      ipAddress: clientIp,
      userAgent,
    });

    // Redirect to the app lobby
    res.redirect("/app");
  } catch (error) {
    log.error({ err: error }, "[EmailVerification] Verification failed");
    res.redirect("/login?error=server_error");
  }
});
