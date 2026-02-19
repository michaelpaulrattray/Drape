import { COOKIE_NAME, SESSION_MAX_AGE_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { logAuditEvent, AUDIT_ACTIONS } from "../auditLog";
import { getClientIp, recordGlobalFailedLogin, shouldSendGlobalAttackAlert, markGlobalAttackAlertSent } from "../security/rateLimit";
import { notifyOwner } from "./notification";
import { isDisposableEmail } from "../security/disposableEmails";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    const clientIp = getClientIp(req);
    const userAgent = req.headers["user-agent"] || null;

    if (!code || !state) {
      // Log failed login attempt (missing params)
      await logAuditEvent({
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        resourceType: "auth",
        metadata: { reason: "Missing code or state parameter" },
        severity: "warning",
        ipAddress: clientIp,
        userAgent,
      });

      // Record for global attack detection
      const attackStatus = recordGlobalFailedLogin();
      if (attackStatus.underAttack && shouldSendGlobalAttackAlert()) {
        markGlobalAttackAlertSent();
        await notifyOwner({
          title: `🚨 ${attackStatus.severity === 'critical' ? 'CRITICAL' : 'WARNING'}: Possible Attack Detected`,
          content: `${attackStatus.failedCount} failed login attempts detected in the last 5 minutes. This may indicate a credential stuffing or brute force attack. Review audit logs for details.`,
        });
        await logAuditEvent({
          action: AUDIT_ACTIONS.ABUSE_GLOBAL_ATTACK,
          resourceType: "system",
          metadata: { 
            failedCount: attackStatus.failedCount,
            severity: attackStatus.severity,
          },
          severity: "critical",
          ipAddress: clientIp,
          userAgent,
        });
      }

      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        await logAuditEvent({
          action: AUDIT_ACTIONS.LOGIN_FAILED,
          resourceType: "auth",
          metadata: { reason: "Missing openId from OAuth provider" },
          severity: "warning",
          ipAddress: clientIp,
          userAgent,
        });
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      // Block disposable email domains from creating accounts
      if (userInfo.email && isDisposableEmail(userInfo.email)) {
        await logAuditEvent({
          action: AUDIT_ACTIONS.LOGIN_FAILED,
          resourceType: "auth",
          resourceId: userInfo.openId,
          metadata: {
            reason: "Disposable email domain blocked",
            email: userInfo.email,
          },
          severity: "warning",
          ipAddress: clientIp,
          userAgent,
        });
        res.redirect(302, "/login?error=disposable_email");
        return;
      }

      // Check if account is locked or suspended BEFORE creating session
      const lockStatus = await db.isAccountLocked(userInfo.openId);
      if (lockStatus.locked) {
        const isSuspended = !lockStatus.lockedUntil;
        
        await logAuditEvent({
          action: isSuspended ? AUDIT_ACTIONS.LOGIN_BLOCKED_SUSPENDED : AUDIT_ACTIONS.LOGIN_BLOCKED_LOCKED,
          resourceType: "auth",
          resourceId: userInfo.openId,
          metadata: { 
            reason: lockStatus.reason,
            email: userInfo.email,
            lockedUntil: lockStatus.lockedUntil?.toISOString(),
          },
          severity: "warning",
          ipAddress: clientIp,
          userAgent,
        });

        if (isSuspended) {
          res.redirect(302, "/login?error=suspended");
        } else {
          const remainingMinutes = lockStatus.lockedUntil 
            ? Math.ceil((lockStatus.lockedUntil.getTime() - Date.now()) / 60000)
            : 15;
          res.redirect(302, `/login?error=locked&minutes=${remainingMinutes}`);
        }
        return;
      }

      // Parse cookies for beta code check
      const { parse: parseCookie } = await import("cookie");
      const cookies = parseCookie(req.headers.cookie || "");
      const betaCode = cookies.forma_beta_code;

      // Check if user already exists BEFORE creating account
      const existingUser = await db.getUserByOpenId(userInfo.openId);

      if (!existingUser) {
        // ── NEW USER: must have a valid beta code to create account ──
        if (!betaCode) {
          // No code, no account — bounce back
          await logAuditEvent({
            action: AUDIT_ACTIONS.LOGIN_FAILED,
            resourceType: "auth",
            resourceId: userInfo.openId,
            metadata: {
              email: userInfo.email,
              reason: "New user without beta code — account creation blocked",
            },
            severity: "warning",
            ipAddress: clientIp,
            userAgent,
          });
          res.redirect(302, "/login?error=no_code");
          return;
        }

        // Validate the beta code before creating the account
        const { validateInviteCode } = await import("../db/validateInviteCode");
        const validation = await validateInviteCode(betaCode);
        if (!validation.valid) {
          res.clearCookie("forma_beta_code", { path: "/" });
          await logAuditEvent({
            action: AUDIT_ACTIONS.LOGIN_FAILED,
            resourceType: "auth",
            resourceId: `invite-code:${betaCode.toUpperCase()}`,
            metadata: {
              email: userInfo.email,
              error: validation.error,
              reason: "Invalid beta code — account creation blocked",
            },
            severity: "warning",
            ipAddress: clientIp,
            userAgent,
          });
          res.redirect(302, "/login?error=invalid_code");
          return;
        }

        // Code is valid — create the account
        await db.upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: new Date(),
        });

        // Get the newly created user and redeem the code
        const newUser = await db.getUserByOpenId(userInfo.openId);
        if (newUser) {
          const { redeemInviteCode } = await import("../db/inviteCodes");
          const redeemResult = await redeemInviteCode(newUser.id, betaCode);
          res.clearCookie("forma_beta_code", { path: "/" });

          if (redeemResult.success) {
            await logAuditEvent({
              userId: newUser.id,
              action: AUDIT_ACTIONS.LOGIN_SUCCESS,
              resourceType: "auth",
              resourceId: userInfo.openId,
              metadata: {
                email: userInfo.email,
                loginMethod: userInfo.loginMethod ?? userInfo.platform,
                approved: true,
                betaCode: betaCode.toUpperCase(),
                newAccount: true,
              },
              severity: "info",
              ipAddress: clientIp,
              userAgent,
            });
          } else {
            // Edge case: code became invalid between validate and redeem
            await logAuditEvent({
              userId: newUser.id,
              action: AUDIT_ACTIONS.LOGIN_FAILED,
              resourceType: "auth",
              resourceId: `invite-code:${betaCode.toUpperCase()}`,
              metadata: { error: redeemResult.error },
              severity: "warning",
              ipAddress: clientIp,
              userAgent,
            });
            res.redirect(302, "/login?error=invalid_code");
            return;
          }
        }
      } else {
        // ── EXISTING USER: update login info ──
        await db.upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: new Date(),
        });

        // Clear any stale beta code cookie
        if (betaCode) {
          res.clearCookie("forma_beta_code", { path: "/" });
        }

        // If existing user is not approved and not admin, reject
        if (!existingUser.approved && existingUser.role !== 'admin') {
          // Try to redeem beta code if present
          if (betaCode) {
            const { redeemInviteCode } = await import("../db/inviteCodes");
            const redeemResult = await redeemInviteCode(existingUser.id, betaCode);
            if (redeemResult.success) {
              await logAuditEvent({
                userId: existingUser.id,
                action: AUDIT_ACTIONS.LOGIN_SUCCESS,
                resourceType: "auth",
                resourceId: userInfo.openId,
                metadata: {
                  email: userInfo.email,
                  approved: true,
                  betaCode: betaCode.toUpperCase(),
                },
                severity: "info",
                ipAddress: clientIp,
                userAgent,
              });
              // Fall through to session creation
            } else {
              res.redirect(302, "/login?error=invalid_code");
              return;
            }
          } else {
            // Existing unapproved user, no code — bounce
            res.redirect(302, "/login?error=no_code");
            return;
          }
        }
      }

      // Reset failed login attempts on successful login
      await db.resetFailedLogins(userInfo.openId);

      // Get fresh user for session
      const user = await db.getUserByOpenId(userInfo.openId);

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: SESSION_MAX_AGE_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_MAX_AGE_MS });

      // Log successful login
      await logAuditEvent({
        userId: user?.id,
        action: AUDIT_ACTIONS.LOGIN_SUCCESS,
        resourceType: "auth",
        resourceId: userInfo.openId,
        metadata: { 
          email: userInfo.email,
          loginMethod: userInfo.loginMethod ?? userInfo.platform,
        },
        severity: "info",
        ipAddress: clientIp,
        userAgent,
      });

      res.redirect(302, "/dashboard");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      
      // Log failed login
      await logAuditEvent({
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        resourceType: "auth",
        metadata: { 
          reason: "OAuth callback error",
          error: error instanceof Error ? error.message : "Unknown error",
        },
        severity: "warning",
        ipAddress: clientIp,
        userAgent,
      });

      // Record for global attack detection
      const attackStatus = recordGlobalFailedLogin();
      if (attackStatus.underAttack && shouldSendGlobalAttackAlert()) {
        markGlobalAttackAlertSent();
        await notifyOwner({
          title: `🚨 ${attackStatus.severity === 'critical' ? 'CRITICAL' : 'WARNING'}: Possible Attack Detected`,
          content: `${attackStatus.failedCount} failed login attempts detected in the last 5 minutes. This may indicate a credential stuffing or brute force attack. Review audit logs for details.`,
        });
        await logAuditEvent({
          action: AUDIT_ACTIONS.ABUSE_GLOBAL_ATTACK,
          resourceType: "system",
          metadata: { 
            failedCount: attackStatus.failedCount,
            severity: attackStatus.severity,
          },
          severity: "critical",
          ipAddress: clientIp,
          userAgent,
        });
      }

      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
