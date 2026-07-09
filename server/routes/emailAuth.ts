/**
 * Email/Password Authentication Routes
 *
 * POST /api/auth/register — Create account with email + password + beta code
 * POST /api/auth/login    — Sign in with email + password
 *
 * These are Express routes (not tRPC) because they need to set cookies directly.
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { COOKIE_NAME, SESSION_MAX_AGE_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import * as db from "../db";
import { validateInviteCode } from "../db/validateInviteCode";
import { redeemInviteCode } from "../db/inviteCodes";
import { logAuditEvent, AUDIT_ACTIONS } from "../auditLog";
import { checkRateLimit, getClientIp } from "../security/rateLimit";
import { isDisposableEmail } from "../security/disposableEmails";
import { getUserByEmail } from "../db/users";
import { getDb } from "../db/connection";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { generateVerificationToken, sendVerificationEmail, storeVerificationToken } from "./emailVerification";

const BCRYPT_ROUNDS = 12;

const registerSchema = z.object({
  email: z.string().email("Invalid email address").max(255),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  name: z.string().min(1, "Name is required").max(100),
  betaCode: z.string().min(1, "Beta code is required").max(64),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address").max(255),
  password: z.string().min(1, "Password is required").max(128),
});

export const emailAuthRouter = Router();

/**
 * POST /api/auth/register
 * Rate limited: 5 attempts per 15 min per IP
 */
emailAuthRouter.post("/register", async (req: Request, res: Response) => {
  const clientIp = getClientIp(req);
  const userAgent = req.headers["user-agent"] || null;

  // Rate limit
  const rl = checkRateLimit(`email-register:${clientIp}`, {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
    keyPrefix: "email_register",
  });
  if (!rl.allowed) {
    res.status(429).json({ error: "Too many attempts. Please try again later." });
    return;
  }

  // Validate input
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || "Invalid input";
    res.status(400).json({ error: firstError });
    return;
  }

  const { email, password, name, betaCode } = parsed.data;

  try {
    // Block disposable emails
    if (isDisposableEmail(email)) {
      await logAuditEvent({
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        resourceType: "auth",
        metadata: { reason: "Disposable email blocked", email },
        severity: "warning",
        ipAddress: clientIp,
        userAgent,
      });
      res.status(400).json({ error: "Disposable email addresses are not allowed" });
      return;
    }

    // Check if email already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    // Validate beta code
    const codeResult = await validateInviteCode(betaCode);
    if (!codeResult.valid) {
      res.status(400).json({ error: codeResult.error || "Invalid access code" });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Generate a unique openId for this user
    const openId = `email_${uuidv4()}`;

    // Create user
    await db.upsertUser({
      openId,
      name,
      email,
      loginMethod: "email",
      lastSignedIn: new Date(),
      passwordHash,
      authProvider: "email",
    });

    // Get the newly created user
    const newUser = await db.getUserByOpenId(openId);
    if (!newUser) {
      res.status(500).json({ error: "Failed to create account" });
      return;
    }

    // Redeem the beta code
    const redeemResult = await redeemInviteCode(newUser.id, betaCode);
    if (!redeemResult.success) {
      // Edge case: code became invalid between validate and redeem
      res.status(400).json({ error: redeemResult.error || "Failed to redeem access code" });
      return;
    }

    // Dev mode: skip email verification entirely so local signups can log
    // in instantly (no Resend key needed). Mirrors the verify-email flow:
    // mark verified, set the session cookie, send the user to the studio.
    if (process.env.NODE_ENV === "development") {
      console.warn(`[EmailAuth] DEV MODE: skipping email verification for ${email}`);
      const devDb = await getDb();
      if (devDb) {
        await devDb
          .update(users)
          .set({ emailVerified: true })
          .where(eq(users.id, newUser.id));
      }

      const sessionToken = await sdk.createSessionToken(newUser.openId, {
        name: newUser.name || "",
        expiresInMs: SESSION_MAX_AGE_MS,
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_MAX_AGE_MS });

      res.status(201).json({ success: true, redirect: "/studio", needsVerification: false });
      return;
    }

    // Generate and store verification token
    const verificationToken = generateVerificationToken();
    await storeVerificationToken(newUser.id, verificationToken);

    // Send verification email
    const emailResult = await sendVerificationEmail(req, email, name, verificationToken);
    if (!emailResult.success) {
      console.error("[EmailAuth] Failed to send verification email:", emailResult.error);
      // Account is created but email failed — they can resend from the verify page
    }

    // Audit log
    await logAuditEvent({
      userId: newUser.id,
      action: AUDIT_ACTIONS.EMAIL_VERIFICATION_SENT,
      resourceType: "auth",
      resourceId: openId,
      metadata: {
        email,
        loginMethod: "email",
        newAccount: true,
        betaCode: betaCode.toUpperCase(),
      },
      severity: "info",
      ipAddress: clientIp,
      userAgent,
    });

    // Redirect to verify-email page instead of dashboard
    res.status(201).json({ success: true, redirect: "/verify-email", email, needsVerification: true });
  } catch (error) {
    console.error("[EmailAuth] Registration failed:", error);
    await logAuditEvent({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      resourceType: "auth",
      metadata: {
        reason: "Registration error",
        email,
        error: error instanceof Error ? error.message : "Unknown",
      },
      severity: "warning",
      ipAddress: clientIp,
      userAgent,
    });
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

/**
 * POST /api/auth/login
 * Rate limited: 10 attempts per 15 min per IP
 */
emailAuthRouter.post("/login", async (req: Request, res: Response) => {
  const clientIp = getClientIp(req);
  const userAgent = req.headers["user-agent"] || null;

  // Rate limit
  const rl = checkRateLimit(`email-login:${clientIp}`, {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000,
    keyPrefix: "email_login",
  });
  if (!rl.allowed) {
    res.status(429).json({ error: "Too many attempts. Please try again later." });
    return;
  }

  // Validate input
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || "Invalid input";
    res.status(400).json({ error: firstError });
    return;
  }

  const { email, password } = parsed.data;

  try {
    // Find user by email
    const user = await getUserByEmail(email);
    if (!user) {
      // Generic error to prevent email enumeration
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    // Check if account is locked/suspended
    const lockStatus = await db.isAccountLocked(user.openId);
    if (lockStatus.locked) {
      const isSuspended = !lockStatus.lockedUntil;
      await logAuditEvent({
        userId: user.id,
        action: isSuspended
          ? AUDIT_ACTIONS.LOGIN_BLOCKED_SUSPENDED
          : AUDIT_ACTIONS.LOGIN_BLOCKED_LOCKED,
        resourceType: "auth",
        resourceId: user.openId,
        metadata: { reason: lockStatus.reason, email },
        severity: "warning",
        ipAddress: clientIp,
        userAgent,
      });

      if (isSuspended) {
        res.status(403).json({ error: "suspended" });
      } else {
        const remainingMinutes = lockStatus.lockedUntil
          ? Math.ceil((lockStatus.lockedUntil.getTime() - Date.now()) / 60000)
          : 15;
        res.status(403).json({ error: "locked", minutes: remainingMinutes });
      }
      return;
    }

    // Check if user has a password (might be Google-only account)
    if (!user.passwordHash) {
      res.status(401).json({
        error: "This account uses Google sign-in. Please use Google to log in.",
      });
      return;
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      // Record failed login
      await db.recordFailedLogin(user.openId);

      await logAuditEvent({
        userId: user.id,
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        resourceType: "auth",
        resourceId: user.openId,
        metadata: { reason: "Invalid password", email },
        severity: "warning",
        ipAddress: clientIp,
        userAgent,
      });

      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    // Check if email is verified (email/password users only)
    if (user.authProvider === "email" && !user.emailVerified) {
      res.status(403).json({
        error: "email_not_verified",
        email: user.email,
        message: "Please verify your email address before signing in.",
      });
      return;
    }

    // Check if user is approved (beta gating)
    if (!user.approved && user.role !== "admin") {
      res.status(403).json({ error: "Account not approved. Please enter a valid access code." });
      return;
    }

    // Reset failed login attempts
    await db.resetFailedLogins(user.openId);

    // Update last sign-in
    await db.upsertUser({
      openId: user.openId,
      lastSignedIn: new Date(),
    });

    // Create session
    const sessionToken = await sdk.createSessionToken(user.openId, {
      name: user.name || "",
      expiresInMs: SESSION_MAX_AGE_MS,
    });

    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_MAX_AGE_MS });

    // Audit log
    await logAuditEvent({
      userId: user.id,
      action: AUDIT_ACTIONS.LOGIN_SUCCESS,
      resourceType: "auth",
      resourceId: user.openId,
      metadata: { email, loginMethod: "email" },
      severity: "info",
      ipAddress: clientIp,
      userAgent,
    });

    res.json({ success: true, redirect: "/studio" });
  } catch (error) {
    console.error("[EmailAuth] Login failed:", error);
    await logAuditEvent({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      resourceType: "auth",
      metadata: {
        reason: "Login error",
        email,
        error: error instanceof Error ? error.message : "Unknown",
      },
      severity: "warning",
      ipAddress: clientIp,
      userAgent,
    });
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});
