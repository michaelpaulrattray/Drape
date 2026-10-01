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
 * 5. Sets session cookie and redirects to /app or /login?error=...
 */
import { createHash, timingSafeEqual } from "node:crypto";

import { Router, type Request, type Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { v4 as uuidv4 } from "uuid";
import { SignJWT, jwtVerify } from "jose";
import { parse as parseCookieHeader } from "cookie";
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

/**
 * ⚠ **THE STATE NONCE IS BOUND TO THE BROWSER THAT STARTED THE FLOW (#1681) —
 * WITHOUT THIS THE SIGNATURE PROVES NOTHING THE ATTACK CARES ABOUT.**
 *
 * The `state` token is signed, and it was checked. But the nonce inside it was
 * compared to **nothing the browser holds**, so a token minted in one browser
 * was accepted in another — and that is the whole of login-CSRF by LINK:
 *
 *   1. the attacker starts a Google sign-in on our site and stops at the
 *      callback, keeping its `code` and its `state`;
 *   2. they send the victim that callback URL;
 *   3. the victim's browser follows it — a **top-level GET**, so #1659's
 *      cross-site guard correctly does not judge it, and a GET cannot be
 *      refused on `Origin` without breaking the legitimate round-trip from
 *      accounts.google.com;
 *   4. the signature verifies, because the attacker minted it with our key via
 *      our own entry route;
 *   5. we sign the victim into the ATTACKER's account. Everything she does
 *      next — uploads, casts, card details typed into their billing — lands in
 *      an account they control.
 *
 * The repair is the standard one and it is the only thing that works on a GET:
 * **the start of the flow puts a secret in the browser, and the callback
 * refuses unless the state's nonce matches it.** The attacker can mint a state
 * all day; they cannot make the victim's browser hold its fingerprint, because
 * only a `Set-Cookie` from this origin can do that.
 *
 * Four decisions, each with its reason, because each one is load-bearing:
 *
 *  - **A FINGERPRINT, NOT THE NONCE.** The cookie carries `sha256(nonce)`, so
 *    the cookie alone is not a state's preimage. It costs nothing and it means
 *    a leaked jar is not a mintable flow.
 *  - **`SameSite=Lax`, NOT `Strict`.** The callback is a cross-site top-level
 *    navigation from Google. `Strict` would withhold the cookie on exactly the
 *    request that needs it and **break every Google sign-in** — the failure
 *    would look like this gate working. `Lax` sends it on a top-level GET and
 *    withholds it on cross-site POSTs and subresources, which is the whole
 *    point (#1653's own reasoning, one route along).
 *  - **`HttpOnly`, and the path is `/api/auth/google`.** No script needs it and
 *    nothing outside this flow should ever be sent it. The path prefix covers
 *    `/api/auth/google/callback` by the cookie spec's own segment matching.
 *  - **`timingSafeEqual`.** The comparison is a secret against a secret.
 *
 * ⚠ **TWO COSTS, STATED RATHER THAN DISCOVERED.** A customer MID-FLOW when this
 * deploys has a state and no cookie, so her callback is refused once and she
 * signs in on the retry — a ten-minute window, and the page already answers an
 * unmapped code with *"Authentication Error … Please try again."* And two
 * sign-in flows started in one browser leave only the second's cookie, so the
 * first tab's callback is refused. Both are the standard shape of this
 * mitigation; neither loses anything but a retry.
 */
const STATE_COOKIE_NAME = "g_oauth_state";
const STATE_COOKIE_PATH = "/api/auth/google";

const nonceFingerprint = (nonce: string): string =>
  createHash("sha256").update(nonce, "utf8").digest("hex");

/**
 * Did the flow this `state` belongs to START in the browser that is presenting
 * it? Fails CLOSED on every absence — no cookie, an empty one, a nonce that is
 * not a string — because this is a gate in front of two session mints and
 * invariant 7's rule is that a control refuses when its input is missing.
 */
function startedInThisBrowser(req: Request, nonce: unknown): boolean {
  if (typeof nonce !== "string" || nonce.length === 0) return false;
  const held = parseCookieHeader(req.headers.cookie ?? "")[STATE_COOKIE_NAME];
  if (typeof held !== "string" || held.length === 0) return false;
  const expected = Buffer.from(nonceFingerprint(nonce), "utf8");
  const presented = Buffer.from(held, "utf8");
  /* `timingSafeEqual` throws on a length mismatch, so the length is compared
     first — and a wrong length is already a wrong answer. */
  return expected.length === presented.length && timingSafeEqual(expected, presented);
}

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

  /* THE OTHER HALF OF THE STATE (#1681). The signature says this token is ours;
     this cookie says the browser presenting it is the one we minted it for.
     Written BEFORE the redirect, so the browser has it when Google sends it
     back. See `startedInThisBrowser` above for why Lax and why a fingerprint. */
  res.cookie(STATE_COOKIE_NAME, nonceFingerprint(statePayload.nonce), {
    ...getSessionCookieOptions(req),
    path: STATE_COOKIE_PATH,
    maxAge: STATE_MAX_AGE_MS,
  });

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

  /*
    ⚠ AND THE SIGNATURE IS ONLY HALF THE GATE (#1681) — the nonce must match the
    one THIS browser was given when the flow started. It is checked HERE, before
    the code is exchanged, so a crafted callback never reaches Google and never
    reaches either session mint. Invariant 9: the gate moves INSIDE the two
    existing issuance sites rather than adding a sixth.

    It answers with the same `invalid_state` as a bad signature, deliberately:
    the customer's answer is the same ("try again"), and nothing is written —
    no audit row and no `Set-Cookie`, which is what the arms assert. The state
    cookie is NOT cleared on this road: clearing it would be a Set-Cookie a
    crafted request could use to drop a real pending flow of hers.
  */
  if (!startedInThisBrowser(req, statePayload.nonce)) {
    res.redirect("/login?error=invalid_state");
    return;
  }
  /* Matched, so it is spent — one state, one callback. Cleared before anything
     else can fail, so a thrown token exchange cannot leave it replayable. */
  res.clearCookie(STATE_COOKIE_NAME, { ...getSessionCookieOptions(req), path: STATE_COOKIE_PATH });

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

    const { email, name, sub: googleId } = payload;

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
        // Keep profile media on Drape-owned storage. Google profile-photo
        // hosts are intentionally outside the production image policy; the
        // client supplies a stable first-party visual until the user uploads.
        avatarUrl: existingUser.avatarUrl || null,
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

      res.redirect("/app");
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
        avatarUrl: null,
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

      res.redirect("/app");
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
