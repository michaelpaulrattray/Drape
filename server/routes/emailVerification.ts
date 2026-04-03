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
import { randomBytes } from "crypto";
import { Resend } from "resend";
import { eq } from "drizzle-orm";
import { COOKIE_NAME, SESSION_MAX_AGE_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { getDb } from "../db/connection";
import { users } from "../../drizzle/schema";
import { getUserByEmail } from "../db/users";
import { logAuditEvent, AUDIT_ACTIONS } from "../auditLog";
import { checkRateLimit, getClientIp } from "../security/rateLimit";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("emailVerification");

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export const emailVerificationRouter = Router();

/**
 * Generate a cryptographically secure verification token
 */
export function generateVerificationToken(): string {
  return randomBytes(48).toString("hex"); // 96-char hex string
}

/**
 * Get the Resend client (lazy init)
 */
function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  return new Resend(apiKey);
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
 * Send a verification email via Resend
 */
export async function sendVerificationEmail(
  req: Request,
  email: string,
  name: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const verifyUrl = buildVerifyUrl(req, token);
  const resend = getResendClient();

  const { error } = await resend.emails.send({
    from: "Drape <onboarding@resend.dev>", // Uses Resend's shared domain for now
    to: email,
    subject: "Verify your email for Drape",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 24px; font-weight: 600; color: #111; margin-bottom: 8px;">Verify your email</h1>
        <p style="font-size: 16px; color: #555; line-height: 1.5; margin-bottom: 24px;">
          Hi ${name || "there"},<br><br>
          Thanks for signing up for Drape. Please verify your email address to complete your account setup.
        </p>
        <a href="${verifyUrl}" 
           style="display: inline-block; background: #111; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">
          Verify Email
        </a>
        <p style="font-size: 13px; color: #999; margin-top: 24px; line-height: 1.5;">
          This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
        </p>
        <p style="font-size: 13px; color: #999; margin-top: 16px;">
          Or copy and paste this URL into your browser:<br>
          <span style="color: #666; word-break: break-all;">${verifyUrl}</span>
        </p>
      </div>
    `,
  });

  if (error) {
    log.error({ err: error }, "[EmailVerification] Failed to send verification email");
    return { success: false, error: error.message };
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

    // Already verified
    if (user.emailVerified) {
      res.json({ success: true, message: "Email is already verified. You can sign in." });
      return;
    }

    // Generate new token
    const token = generateVerificationToken();
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

    // Check if already verified
    if (user.emailVerified) {
      res.redirect("/login?message=already_verified");
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

    // Mark email as verified and clear token
    await db
      .update(users)
      .set({
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      })
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

    // Redirect to dashboard
    res.redirect("/dashboard");
  } catch (error) {
    log.error({ err: error }, "[EmailVerification] Verification failed");
    res.redirect("/login?error=server_error");
  }
});
