import { COOKIE_NAME, SESSION_MAX_AGE_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { logAuditEvent, AUDIT_ACTIONS } from "../auditLog";
import { getClientIp, recordGlobalFailedLogin, shouldSendGlobalAttackAlert, markGlobalAttackAlertSent } from "../rateLimit";
import { notifyOwner } from "./notification";

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

      // Upsert user and reset failed login attempts on successful login
      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      // Reset failed login attempts on successful login
      await db.resetFailedLogins(userInfo.openId);

      // Get user for audit log
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
