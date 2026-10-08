import { COOKIE_NAME, SESSION_MAX_AGE_MS } from "@shared/const";
import { HttpError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

// Utility function
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

/**
 * THE SESSION WAS READ, AND REFUSED — #1990.
 *
 * `authenticateRequest` can fail two ways that used to look identical to its
 * callers: the request carries no usable session (no cookie, a bad or expired
 * one, or a user who is genuinely not in the database), or the server could
 * not FINISH asking (the database was unreachable, the pool was saturated, the
 * activity write threw). The first is a verdict about the visitor; the second
 * is a verdict about us.
 *
 * Only the first is thrown as this class. Everything else that escapes
 * `authenticateRequest` is an infrastructure failure, and a caller that reads
 * it as "anonymous" signs a customer out because the database blinked — which
 * is exactly what `createContext` did until this class existed.
 *
 * It is still an `HttpError` with status 403, so every Express caller that
 * catches the old `ForbiddenError` shape keeps the behaviour it had.
 */
export class SessionRejectedError extends HttpError {
  constructor(message: string) {
    super(403, message);
    this.name = "SessionRejectedError";
  }
}

export function isSessionRejected(error: unknown): error is SessionRejectedError {
  return error instanceof SessionRejectedError;
}

type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

class SDKServer {
  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }

    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }

  /**
   * Create a session token for a user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(user.openId);
   */
  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || "",
      },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? SESSION_MAX_AGE_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<{ openId: string; appId: string; name: string } | null> {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name } = payload as Record<string, unknown>;

      if (
        !isNonEmptyString(openId) ||
        !isNonEmptyString(appId) ||
        !isNonEmptyString(name)
      ) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }

      return {
        openId,
        appId,
        name,
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  async authenticateRequest(
    req: Request,
    options: { recordActivity?: boolean } = {},
  ): Promise<User> {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);

    if (!session) {
      throw new SessionRejectedError("Invalid session cookie");
    }

    /*
      `getUserByOpenId` answers `undefined` both for a user who is not there
      and for a database it could not get a handle on. Only the first is a
      verdict about this session, so the second is asked first and thrown as
      what it is — an unavailable database, never "User not found" (#1990).
    */
    if (!(await db.getDb())) {
      throw new Error("[Auth] Database unavailable while verifying a session");
    }

    const user = await db.getUserByOpenId(session.openId);

    if (!user) {
      throw new SessionRejectedError("User not found");
    }

    if (options.recordActivity !== false) {
      await db.upsertUser({
        openId: user.openId,
        lastSignedIn: new Date(),
      });
    }

    return user;
  }
}

export const sdk = new SDKServer();
