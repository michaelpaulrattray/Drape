/**
 * Google OAuth Authentication Routes
 *
 * GET  /api/auth/google          — Redirect to Google consent screen
 * GET  /api/auth/google/callback  — Handle Google OAuth callback
 *
 * Flow:
 * 1. Frontend calls GET /api/auth/google?betaCode=XXX (for new users) or GET /api/auth/google (returning)
 * 2. Server generates state token (with betaCode if provided), redirects to Google
 * 3. Google redirects back to /api/auth/google/callback with code + state
 * 4. Server exchanges code for tokens, verifies ID token, creates/links user
 * 5. Sets session cookie and redirects to /dashboard or /login?error=...
 */
import { Router, type Request, type Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { v4 as uuidv4 } from "uuid";
import { SignJWT, jwtVerify } from "jose";
import { COOKIE_NAME, SESSION_MAX_AGE_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { ENV } from "../_core/env";
import * as db from "../db";
import { validateInviteCode } from "../db/validateInviteCode";
import { redeemInviteCode } from "../db/inviteCodes";
import { logAuditEvent, AUDIT_ACTIONS } from "../auditLog";
import { checkRateLimit, getClientIp } from "../security/rateLimit";
import { isDisposableEmail } from "../security/disposableEmails";
import { getUserByEmail } from "../db/users";

const STATE_SECRET = ENV.cookieSecret; // Reuse JWT secret for state signing
const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

export const googleAuthRouter = Router();

function getGoogleClient(req: Request): OAuth2Client {
  // Detect actual protocol — proxy terminates SSL so req.protocol may be "http"
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = forwardedProto
    ? (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto.split(",")[0]).trim()
    : req.protocol;
  const origin = `${proto}://${req.get("host")}`;
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${origin}/api/auth/google/callback`
  );
}

/**
 * GET /api/auth/google
 * Initiates Google OAuth flow. Optional ?betaCode=XXX for new user registration.
 */
googleAuthRouter.get("/google", async (req: Request, res: Response) => {
  const clientIp = getClientIp(req);

  // Rate limit
  const rl = checkRateLimit(`google-auth:${clientIp}`, {
    maxRequests: 20,
    windowMs: 15 * 60 * 1000,
    keyPrefix: "google_auth",
  });
  if (!rl.allowed) {
    res.redirect("/login?error=rate_limited");
    return;
  }

  const betaCode = (req.query.betaCode as string) || "";

  // Create signed state token with betaCode and CSRF nonce
  const statePayload = {
    nonce: uuidv4(),
    betaCode,
    iat: Date.now(),
  };
  const secretKey = new TextEncoder().encode(STATE_SECRET);
  const stateToken = await new SignJWT(statePayload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("10m")
    .sign(secretKey);

  const client = getGoogleClient(req);
  const origin = `${req.protocol}://${req.get("host")}`;
  console.log(`[GoogleAuth] Origin detected: ${origin}`);
  console.log(`[GoogleAuth] Redirect URI: ${origin}/api/auth/google/callback`);
  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "email", "profile"],
    state: stateToken,
    prompt: "select_account",
  });
  console.log(`[GoogleAuth] Full auth URL: ${authUrl}`);

  res.redirect(authUrl);
});

/**
 * GET /api/auth/google/callback
 * Handles the Google OAuth callback after user consents.
 */
googleAuthRouter.get("/google/callback", async (req: Request, res: Response) => {
  const clientIp = getClientIp(req);
  const userAgent = req.headers["user-agent"] || null;
  const code = req.query.code as string;
  const stateToken = req.query.state as string;
  const error = req.query.error as string;

  // User denied consent
  if (error) {
    res.redirect("/login?error=google_denied");
    return;
  }

  if (!code || !stateToken) {
    res.redirect("/login?error=invalid_callback");
    return;
  }

  // Verify state token (CSRF protection)
  let statePayload: { nonce: string; betaCode: string; iat: number };
  try {
    const secretKey = new TextEncoder().encode(STATE_SECRET);
    const { payload } = await jwtVerify(stateToken, secretKey);
    statePayload = payload as unknown as typeof statePayload;
  } catch {
    res.redirect("/login?error=invalid_state");
    return;
  }

  try {
    const client = getGoogleClient(req);

    // Exchange code for tokens
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) {
      res.redirect("/login?error=no_id_token");
      return;
    }

    // Verify ID token
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      res.redirect("/login?error=invalid_token");
      return;
    }

    const { email, name, sub: googleId, picture } = payload;

    // Block disposable emails
    if (isDisposableEmail(email)) {
      await logAuditEvent({
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        resourceType: "auth",
        metadata: { reason: "Disposable email blocked (Google)", email },
        severity: "warning",
        ipAddress: clientIp,
        userAgent,
      });
      res.redirect("/login?error=disposable_email");
      return;
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(email);

    if (existingUser) {
      // --- RETURNING USER ---

      // Check if account is locked/suspended
      const lockStatus = await db.isAccountLocked(existingUser.openId);
      if (lockStatus.locked) {
        const isSuspended = !lockStatus.lockedUntil;
        await logAuditEvent({
          userId: existingUser.id,
          action: isSuspended
            ? AUDIT_ACTIONS.LOGIN_BLOCKED_SUSPENDED
            : AUDIT_ACTIONS.LOGIN_BLOCKED_LOCKED,
          resourceType: "auth",
          resourceId: existingUser.openId,
          metadata: { reason: lockStatus.reason, email },
          severity: "warning",
          ipAddress: clientIp,
          userAgent,
        });
        res.redirect(`/login?error=${isSuspended ? "suspended" : "locked"}`);
        return;
      }

      // Check if user is approved (beta gating)
      if (!existingUser.approved && existingUser.role !== "admin") {
        // If they provided a beta code, try to redeem it
        if (statePayload.betaCode) {
          const codeResult = await validateInviteCode(statePayload.betaCode);
          if (codeResult.valid) {
            await redeemInviteCode(existingUser.id, statePayload.betaCode);
          } else {
            res.redirect("/login?error=not_approved");
            return;
          }
        } else {
          res.redirect("/login?error=not_approved");
          return;
        }
      }

      // Update user info (link Google if they were email-only)
      await db.upsertUser({
        openId: existingUser.openId,
        name: existingUser.name || name || "",
        avatarUrl: existingUser.avatarUrl || picture || null,
        loginMethod: "google",
        lastSignedIn: new Date(),
        ...(existingUser.authProvider === "email" ? {} : { authProvider: "google" }),
      });

      // Reset failed logins
      await db.resetFailedLogins(existingUser.openId);

      // Create session
      const sessionToken = await sdk.createSessionToken(existingUser.openId, {
        name: existingUser.name || name || "",
        expiresInMs: SESSION_MAX_AGE_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_MAX_AGE_MS });

      await logAuditEvent({
        userId: existingUser.id,
        action: AUDIT_ACTIONS.LOGIN_SUCCESS,
        resourceType: "auth",
        resourceId: existingUser.openId,
        metadata: { email, loginMethod: "google", returningUser: true },
        severity: "info",
        ipAddress: clientIp,
        userAgent,
      });

      res.redirect("/dashboard");
    } else {
      // --- NEW USER ---

      // Beta code required for new accounts
      if (!statePayload.betaCode) {
        res.redirect("/login?error=no_code");
        return;
      }

      // Validate beta code
      const codeResult = await validateInviteCode(statePayload.betaCode);
      if (!codeResult.valid) {
        res.redirect("/login?error=invalid_code");
        return;
      }

      // Create user
      const openId = `google_${googleId}`;
      await db.upsertUser({
        openId,
        name: name || "",
        email,
        avatarUrl: picture || null,
        loginMethod: "google",
        lastSignedIn: new Date(),
        authProvider: "google",
      });

      const newUser = await db.getUserByOpenId(openId);
      if (!newUser) {
        res.redirect("/login?error=create_failed");
        return;
      }

      // Redeem beta code
      const redeemResult = await redeemInviteCode(newUser.id, statePayload.betaCode);
      if (!redeemResult.success) {
        res.redirect("/login?error=code_redeem_failed");
        return;
      }

      // Create session
      const sessionToken = await sdk.createSessionToken(openId, {
        name: name || "",
        expiresInMs: SESSION_MAX_AGE_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_MAX_AGE_MS });

      await logAuditEvent({
        userId: newUser.id,
        action: AUDIT_ACTIONS.LOGIN_SUCCESS,
        resourceType: "auth",
        resourceId: openId,
        metadata: {
          email,
          loginMethod: "google",
          newAccount: true,
          betaCode: statePayload.betaCode.toUpperCase(),
        },
        severity: "info",
        ipAddress: clientIp,
        userAgent,
      });

      res.redirect("/dashboard");
    }
  } catch (error) {
    console.error("[GoogleAuth] Callback failed:", error);
    await logAuditEvent({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      resourceType: "auth",
      metadata: {
        reason: "Google OAuth callback error",
        error: error instanceof Error ? error.message : "Unknown",
      },
      severity: "warning",
      ipAddress: clientIp,
      userAgent,
    });
    res.redirect("/login?error=google_error");
  }
});
