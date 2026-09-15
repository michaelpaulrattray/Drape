/**
 * THE GOOGLE SIGN-IN ROUTES, DRIVEN (#883 — the law-7 sibling of #697/PR #882).
 *
 * ⚠ WHAT THIS FILE USED TO BE, because it is why the arms below are shaped the
 * way they are. Under a docblock claiming it covered "state token
 * signing/verification, CSRF protection, rate limiting, disposable email
 * blocking, and credential presence", it imported the route module NOWHERE.
 * **Seventeen of its eighteen arms could not fail about this product:**
 *
 *   · six  built and verified their OWN `SignJWT`/`jwtVerify` tokens with a
 *     local `TEST_SECRET`. They prove `jose` works. The route's own state mint
 *     and its verify were never called, so deleting the CSRF check entirely
 *     left all six green.
 *   · two  drove `checkRateLimit` against the test's own config literals under
 *     `keyPrefix: "google_auth_test"` — a key the product never uses. The same
 *     shape deleted from `emailAuth.test.ts` in PR #882.
 *   · two  `isDisposableEmail("user@guerrillamail.com") === true` — the
 *     helper's own unit arms, already covered twelve times over in
 *     `referral-enhancements.test.ts`. Nothing proved THIS ROUTE ASKS IT.
 *   · three `expect(process.env.GOOGLE_CLIENT_ID).toBeDefined()` — assertions
 *     about the shape of this machine's `.env`, skipped in CI, saying nothing
 *     about what the route does with the credential. They are replaced by arms
 *     that assert the route HANDS that credential to the OAuth client and to
 *     `verifyIdToken`'s audience, which is what they were gesturing at.
 *   · two  built `google_${sub}` in the test and asserted the string just
 *     built; two  built a map of error→redirect in the test and asserted the
 *     map. Both are now assertions about redirects the handler really issued.
 *
 * The one honest arm — the `readFileSync` source guard over the profile-media
 * boundary — is KEPT unchanged, and a driven arm now stands beside it.
 *
 * ⚠ **INVARIANT 9 LIVES IN THIS FILE** (CLAUDE.md): two of the product's five
 * session-issuance sites are this route's RETURNING-USER mint and its NEW-USER
 * mint. `sessionIssuanceSites.test.ts` COUNTS them by reading this route's
 * source text; until now nothing drove either, so every gate in front of them —
 * suspension, lockout, approval, the admin exemption, the beta code validated
 * and redeemed before the mint — was described in three places and proven in
 * none.
 *
 * ─── WHAT IS MOCKED, AND THE ONE DECISION THIS FILE MAKES ───
 *
 * #883 named one open question: `/api/auth/google/callback` talks to Google
 * (a token exchange and an ID-token verification) and neither is behind a seam
 * today. **The seam taken is `google-auth-library` itself, mocked as the FAR
 * END the handler lands on — exactly as the db, the session mint and the audit
 * log are.** The route is not touched: this is a test-only change, and a
 * product route growing a dependency purely so a test can reach it would be
 * the larger claim of the two.
 *
 * `isDisposableEmail` is deliberately NOT mocked — the arm sends a real
 * guerrillamail address at the real helper, which is the only shape that
 * proves the ask. `AUDIT_ACTIONS` and `getClientIp` stay real for the same
 * reason: an arm asserting the route wrote `LOGIN_BLOCKED_SUSPENDED` must
 * assert the product's own constant, not a string this file invented.
 * `ENV.cookieSecret` is read from the product's own `ENV` rather than copied,
 * so the state tokens below are signed with the secret the route verifies
 * against, whatever it is (law 4 — derive, never mirror).
 */
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { baseUrlOf, listenOnFetchablePort } from "../testing/fetchablePort";

/* `ENV` freezes `process.env.JWT_SECRET` at import, and the route captures
   `ENV.cookieSecret` into its module-level `STATE_SECRET` the same way. A
   checkout with no `.env` (CI) would leave both empty and the state mint would
   throw on a zero-length HMAC key — so a stand-in is planted BEFORE the module
   graph loads, and only where the real one is absent. On a machine that has
   one, these arms sign with the product's real configured secret. */
vi.hoisted(() => {
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = "drape-test-state-secret-not-a-real-credential";
  }
  if (!process.env.GOOGLE_CLIENT_ID) {
    process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
  }
  if (!process.env.GOOGLE_CLIENT_SECRET) {
    process.env.GOOGLE_CLIENT_SECRET = "GOCSPX-test-client-secret";
  }
});

/* THE FAR END: Google itself. Every `new OAuth2Client(...)` the route makes is
   recorded with its constructor arguments, so the arms can assert which
   credential and which redirect URI the product handed it. */
const google = vi.hoisted(() => ({
  constructions: [] as unknown[][],
  generateAuthUrl: vi.fn(() => "https://accounts.google.com/o/oauth2/v2/auth?stand-in=1"),
  getToken: vi.fn(),
  verifyIdToken: vi.fn(),
}));

vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    constructor(...args: unknown[]) {
      google.constructions.push(args);
    }
    generateAuthUrl = google.generateAuthUrl;
    getToken = google.getToken;
    verifyIdToken = google.verifyIdToken;
  },
}));

vi.mock("../db", () => ({
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn(),
  isAccountLocked: vi.fn().mockResolvedValue({ locked: false }),
  resetFailedLogins: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../db/users", () => ({ getUserByEmail: vi.fn() }));
vi.mock("../db/validateInviteCode", () => ({ validateInviteCode: vi.fn() }));
vi.mock("../db/inviteCodes", () => ({ redeemInviteCode: vi.fn() }));
vi.mock("../_core/sdk", () => ({
  sdk: { createSessionToken: vi.fn().mockResolvedValue("session-token-stand-in") },
}));
vi.mock("../auditLog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../auditLog")>()),
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../security/rateLimit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../security/rateLimit")>()),
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 19, resetIn: 0 })),
}));

import { COOKIE_NAME, SESSION_MAX_AGE_MS } from "@shared/const";

import { ENV } from "../_core/env";
import * as db from "../db";
import { AUDIT_ACTIONS, logAuditEvent } from "../auditLog";
import { redeemInviteCode } from "../db/inviteCodes";
import { getUserByEmail } from "../db/users";
import { validateInviteCode } from "../db/validateInviteCode";
import { sdk } from "../_core/sdk";
import { checkRateLimit } from "../security/rateLimit";
import { googleAuthRouter } from "./googleAuth";

/*
  ─────────────────────────────────────────────────────────────────────────
  THE HARNESS — a real `express()` carrying the real router, and a real HTTP
  request through it. Redirects are NOT followed: the redirect IS the product's
  answer on this route, so `redirect: "manual"` keeps the 302 and its
  `location` where the arms can read them.
  ─────────────────────────────────────────────────────────────────────────
*/

type DrivenResponse = {
  status: number;
  location: string | null;
  cookies: string[];
};

async function get(
  path: string,
  headers: Record<string, string> = {},
): Promise<DrivenResponse> {
  const app = express();
  app.use("/api/auth", googleAuthRouter);
  const server = await listenOnFetchablePort((port) => app.listen(port, "127.0.0.1"));
  try {
    const response = await fetch(`${baseUrlOf(server)}${path}`, {
      redirect: "manual",
      headers: { "user-agent": "drape-test-agent", ...headers },
    });
    const cookies = typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie") ?? ""].filter(Boolean);
    return { status: response.status, location: response.headers.get("location"), cookies };
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())));
  }
}

function sessionCookie(response: DrivenResponse): string | undefined {
  return response.cookies.find((cookie) => cookie.startsWith(`${COOKIE_NAME}=`));
}

/** Every audit row the handler wrote, in the order it wrote them. */
function auditRows(): Array<Record<string, unknown>> {
  return vi.mocked(logAuditEvent).mock.calls
    .map(([options]) => options as unknown as Record<string, unknown>);
}

const stateKey = () => new TextEncoder().encode(ENV.cookieSecret);

/** A state token the route will accept, signed with the secret the route reads. */
async function aState(
  betaCode = "",
  options: { secret?: Uint8Array; expiresAt?: number } = {},
): Promise<string> {
  const token = new SignJWT({ nonce: "nonce-stand-in", betaCode, iat: Date.now() })
    .setProtectedHeader({ alg: "HS256" });
  token.setExpirationTime(options.expiresAt ?? Math.floor(Date.now() / 1000) + 600);
  return token.sign(options.secret ?? stateKey());
}

const GOOGLE_SUB = "1234567890";

/** What Google says about the person, once the ID token is verified. */
function aGooglePayload(overrides: Record<string, unknown> = {}) {
  return {
    email: "person@example.com",
    name: "A Person",
    sub: GOOGLE_SUB,
    picture: "https://lh3.googleusercontent.com/a/third-party-photo",
    ...overrides,
  };
}

function anAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    openId: "google_existing",
    email: "person@example.com",
    name: "A Person",
    avatarUrl: null,
    authProvider: "google",
    approved: true,
    role: "user",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  google.constructions.length = 0;
  google.generateAuthUrl.mockReturnValue("https://accounts.google.com/o/oauth2/v2/auth?stand-in=1");
  google.getToken.mockResolvedValue({ tokens: { id_token: "google-id-token-stand-in" } });
  google.verifyIdToken.mockResolvedValue({ getPayload: () => aGooglePayload() });
  vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 19, resetIn: 0 });
  vi.mocked(db.isAccountLocked).mockResolvedValue({ locked: false } as never);
  vi.mocked(db.upsertUser).mockResolvedValue(undefined as never);
  vi.mocked(db.resetFailedLogins).mockResolvedValue(undefined as never);
  vi.mocked(db.getUserByOpenId).mockImplementation((async (openId: string) => ({
    id: 42, openId, email: "person@example.com", name: "A Person",
  })) as never);
  vi.mocked(getUserByEmail).mockResolvedValue(null as never);
  vi.mocked(validateInviteCode).mockResolvedValue({ valid: true });
  vi.mocked(redeemInviteCode).mockResolvedValue({ success: true });
  vi.mocked(sdk.createSessionToken).mockResolvedValue("session-token-stand-in");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/*
  ─── GET /api/auth/google — the consent redirect, and the state mint ───
*/

describe("GET /api/auth/google — the doors, in the order the handler asks them", () => {
  it("refuses a rate-limited caller before it builds anything, and never reaches Google", async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, resetIn: 60_000 });

    const response = await get("/api/auth/google?betaCode=BETA123");

    expect(response.status).toBe(302);
    expect(response.location).toBe("/login?error=rate_limited");
    expect(google.constructions).toHaveLength(0);
    expect(google.generateAuthUrl).not.toHaveBeenCalled();
  });

  it("asks the limiter for TWENTY per fifteen minutes, under the google-auth key", async () => {
    /* The two deleted arms recited these numbers into a key of their own
       invention. This is the number the product actually spends. */
    await get("/api/auth/google");

    expect(checkRateLimit).toHaveBeenCalledTimes(1);
    const [key, config] = vi.mocked(checkRateLimit).mock.calls[0]!;
    expect(key).toMatch(/^google-auth:/);
    expect(config).toEqual({ maxRequests: 20, windowMs: 15 * 60 * 1000, keyPrefix: "google_auth" });
  });

  it("sends the caller to the URL Google's own client built, carrying the state token", async () => {
    google.generateAuthUrl.mockReturnValue("https://accounts.google.com/o/oauth2/v2/auth?built=by-google");

    const response = await get("/api/auth/google");

    expect(response.status).toBe(302);
    expect(response.location).toBe("https://accounts.google.com/o/oauth2/v2/auth?built=by-google");
    const [options] = google.generateAuthUrl.mock.calls[0] as [Record<string, unknown>];
    expect(options.scope).toEqual(["openid", "email", "profile"]);
    expect(options.prompt).toBe("select_account");
    expect(options.state).toBeTruthy();
  });

  it("mints a state token THIS PRODUCT can verify, carrying the beta code and a nonce", async () => {
    await get("/api/auth/google?betaCode=BETA123");

    const [options] = google.generateAuthUrl.mock.calls[0] as [{ state: string }];
    /* Verified with the route's OWN secret, read out of `ENV` rather than
       copied — a token this product cannot verify is the failure worth
       catching, and the deleted arms could not see it. */
    const { jwtVerify } = await import("jose");
    const { payload } = await jwtVerify(options.state, stateKey());
    expect(payload.betaCode).toBe("BETA123");
    expect(payload.nonce).toBeTruthy();
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000) + 500);
    expect(payload.exp).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 600);
  });

  it("carries an EMPTY beta code for a returning user who supplied none", async () => {
    await get("/api/auth/google");

    const [options] = google.generateAuthUrl.mock.calls[0] as [{ state: string }];
    const { jwtVerify } = await import("jose");
    const { payload } = await jwtVerify(options.state, stateKey());
    expect(payload.betaCode).toBe("");
  });

  it("hands Google the configured client credential and a callback on this origin", async () => {
    /* This replaces the three deleted `process.env.GOOGLE_CLIENT_ID` arms:
       what matters is not that the variable exists on this machine but that
       the route gives it to the client it builds. */
    await get("/api/auth/google");

    expect(google.constructions).toHaveLength(1);
    const [clientId, clientSecret, redirectUri] = google.constructions[0]!;
    expect(clientId).toBe(process.env.GOOGLE_CLIENT_ID);
    expect(clientSecret).toBe(process.env.GOOGLE_CLIENT_SECRET);
    expect(String(redirectUri)).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/api\/auth\/google\/callback$/);
  });

  it("builds the callback on the PROXY's protocol, not the one express saw", async () => {
    /* Production terminates SSL at the proxy, so `req.protocol` is http and a
       redirect URI built from it would not match the one registered with
       Google. The route reads `x-forwarded-proto`; nothing proved it. */
    await get("/api/auth/google", { "x-forwarded-proto": "https,http" });

    const [, , redirectUri] = google.constructions[0]!;
    expect(String(redirectUri)).toMatch(/^https:\/\/127\.0\.0\.1:\d+\/api\/auth\/google\/callback$/);
  });
});

/*
  ─── GET /api/auth/google/callback — the CSRF gate ───
*/

describe("GET /api/auth/google/callback — the state token is a CSRF gate, not a decoration", () => {
  it("refuses a state token signed with another secret, and never exchanges the code", async () => {
    const forged = await aState("BETA123", {
      secret: new TextEncoder().encode("not-this-product's-secret-at-all"),
    });

    const response = await get(`/api/auth/google/callback?code=auth-code&state=${forged}`);

    expect(response.location).toBe("/login?error=invalid_state");
    expect(google.getToken).not.toHaveBeenCalled();
    expect(getUserByEmail).not.toHaveBeenCalled();
    expect(sessionCookie(response)).toBeUndefined();
  });

  it("refuses an EXPIRED state token", async () => {
    const stale = await aState("", { expiresAt: Math.floor(Date.now() / 1000) - 10 });

    const response = await get(`/api/auth/google/callback?code=auth-code&state=${stale}`);

    expect(response.location).toBe("/login?error=invalid_state");
    expect(google.getToken).not.toHaveBeenCalled();
  });

  it("refuses a state token whose PAYLOAD was edited under its original signature", async () => {
    /* â  THIS ARM WAS WEAKER THAN IT READ, AND THE SABOTAGE BAR CAUGHT IT.
       Its first shape flipped the last character of the payload segment, which
       corrupts the base64 so the JSON no longer parses. That made it green even
       with the signature check REMOVED â the replacement threw inside the same
       try/catch and produced the same refusal, so the arm was proving that
       `JSON.parse` can fail rather than that the route verifies a signature.
       This is the real attack instead: a valid token, its beta code rewritten,
       its ORIGINAL signature left attached. Only a signature check can refuse
       it, which is exactly the claim. */
    const valid = await aState("BETA123");
    const [header, payload, signature] = valid.split(".");
    const edited = Buffer
      .from(JSON.stringify({
        ...JSON.parse(Buffer.from(payload!, "base64url").toString()),
        betaCode: "SOMEONE-ELSES-CODE",
      }))
      .toString("base64url");

    const response = await get(
      `/api/auth/google/callback?code=auth-code&state=${header}.${edited}.${signature}`,
    );

    expect(response.location).toBe("/login?error=invalid_state");
    expect(google.getToken).not.toHaveBeenCalled();
    expect(getUserByEmail).not.toHaveBeenCalled();
  });

  it("sends a person who refused consent back with google_denied, touching nothing", async () => {
    const response = await get("/api/auth/google/callback?error=access_denied");

    expect(response.location).toBe("/login?error=google_denied");
    expect(google.getToken).not.toHaveBeenCalled();
    expect(auditRows()).toHaveLength(0);
  });

  it("refuses a callback with no code, and one with no state", async () => {
    const withoutCode = await get(`/api/auth/google/callback?state=${await aState()}`);
    expect(withoutCode.location).toBe("/login?error=invalid_callback");

    const withoutState = await get("/api/auth/google/callback?code=auth-code");
    expect(withoutState.location).toBe("/login?error=invalid_callback");

    expect(google.getToken).not.toHaveBeenCalled();
  });
});

/*
  ─── GET /api/auth/google/callback — what Google answered ───
*/

describe("GET /api/auth/google/callback — the answers from Google the route refuses", () => {
  it("refuses a token exchange that came back without an ID token", async () => {
    google.getToken.mockResolvedValue({ tokens: { access_token: "no-id-token-here" } });

    const response = await get(`/api/auth/google/callback?code=auth-code&state=${await aState()}`);

    expect(response.location).toBe("/login?error=no_id_token");
    expect(google.verifyIdToken).not.toHaveBeenCalled();
    expect(sessionCookie(response)).toBeUndefined();
  });

  it("verifies the ID token against THIS product's client id as the audience", async () => {
    await get(`/api/auth/google/callback?code=auth-code&state=${await aState()}`);

    expect(google.verifyIdToken).toHaveBeenCalledTimes(1);
    const [options] = google.verifyIdToken.mock.calls[0] as [Record<string, unknown>];
    expect(options.idToken).toBe("google-id-token-stand-in");
    expect(options.audience).toBe(process.env.GOOGLE_CLIENT_ID);
  });

  it("refuses a verified token carrying no email", async () => {
    google.verifyIdToken.mockResolvedValue({ getPayload: () => aGooglePayload({ email: undefined }) });

    const response = await get(`/api/auth/google/callback?code=auth-code&state=${await aState()}`);

    expect(response.location).toBe("/login?error=invalid_token");
    expect(getUserByEmail).not.toHaveBeenCalled();
  });

  it("refuses a verified token with no payload at all", async () => {
    google.verifyIdToken.mockResolvedValue({ getPayload: () => undefined });

    const response = await get(`/api/auth/google/callback?code=auth-code&state=${await aState()}`);

    expect(response.location).toBe("/login?error=invalid_token");
  });

  it("ASKS the disposable-email helper about the Google address, and audits the refusal", async () => {
    /* The two deleted arms proved the helper knows guerrillamail. This proves
       the route hands it the address Google returned. The helper is the REAL
       one — `googleAuth.ts:153` is its third call site and the last undriven
       one (PR #739 drove the referral one, PR #882 the register one). */
    google.verifyIdToken.mockResolvedValue({
      getPayload: () => aGooglePayload({ email: "throwaway@guerrillamail.com" }),
    });

    const response = await get(`/api/auth/google/callback?code=auth-code&state=${await aState()}`);

    expect(response.location).toBe("/login?error=disposable_email");
    expect(getUserByEmail).not.toHaveBeenCalled();
    expect(db.upsertUser).not.toHaveBeenCalled();
    expect(sessionCookie(response)).toBeUndefined();

    expect(auditRows()).toHaveLength(1);
    expect(auditRows()[0]).toMatchObject({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      resourceType: "auth",
      severity: "warning",
      metadata: { reason: "Disposable email blocked (Google)", email: "throwaway@guerrillamail.com" },
    });
  });

  it("lets an ordinary Google address past the disposable check", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(anAccount() as never);

    const response = await get(`/api/auth/google/callback?code=auth-code&state=${await aState()}`);

    expect(response.location).toBe("/app");
  });

  it("turns a thrown token exchange into google_error and an audited failure, never a stack trace", async () => {
    google.getToken.mockRejectedValue(new Error("invalid_grant"));

    const response = await get(`/api/auth/google/callback?code=auth-code&state=${await aState()}`);

    expect(response.location).toBe("/login?error=google_error");
    expect(sessionCookie(response)).toBeUndefined();
    expect(auditRows()[0]).toMatchObject({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      resourceType: "auth",
      severity: "warning",
      metadata: { reason: "Google OAuth callback error", error: "invalid_grant" },
    });
  });
});

/*
  ─── THE RETURNING USER — invariant 9's third session mint, and its gates ───
*/

describe("GET /api/auth/google/callback — RETURNING user: the gates in front of the session mint", () => {
  beforeEach(() => {
    vi.mocked(getUserByEmail).mockResolvedValue(anAccount() as never);
  });

  it("refuses a SUSPENDED account, audits it as suspended, and mints nothing", async () => {
    vi.mocked(db.isAccountLocked).mockResolvedValue({
      locked: true, lockedUntil: null, reason: "Suspended by an admin",
    } as never);

    const response = await get(`/api/auth/google/callback?code=auth-code&state=${await aState()}`);

    expect(response.location).toBe("/login?error=suspended");
    expect(sessionCookie(response)).toBeUndefined();
    expect(sdk.createSessionToken).not.toHaveBeenCalled();
    expect(db.upsertUser).not.toHaveBeenCalled();
    expect(auditRows()[0]).toMatchObject({
      action: AUDIT_ACTIONS.LOGIN_BLOCKED_SUSPENDED,
      resourceId: "google_existing",
      severity: "warning",
      metadata: { reason: "Suspended by an admin" },
    });
  });

  it("refuses a LOCKED-OUT account as locked, and the two refusals do not read as each other", async () => {
    vi.mocked(db.isAccountLocked).mockResolvedValue({
      locked: true, lockedUntil: new Date(Date.now() + 900_000), reason: "Too many failed attempts",
    } as never);

    const response = await get(`/api/auth/google/callback?code=auth-code&state=${await aState()}`);

    expect(response.location).toBe("/login?error=locked");
    expect(sessionCookie(response)).toBeUndefined();
    expect(auditRows()[0]).toMatchObject({ action: AUDIT_ACTIONS.LOGIN_BLOCKED_LOCKED });
  });

  it("refuses an UNAPPROVED account that brought no beta code, and mints nothing", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(anAccount({ approved: false }) as never);

    const response = await get(`/api/auth/google/callback?code=auth-code&state=${await aState("")}`);

    expect(response.location).toBe("/login?error=not_approved");
    expect(sessionCookie(response)).toBeUndefined();
    expect(sdk.createSessionToken).not.toHaveBeenCalled();
    expect(redeemInviteCode).not.toHaveBeenCalled();
  });

  it("refuses an UNAPPROVED account whose beta code the checker rejects", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(anAccount({ approved: false }) as never);
    vi.mocked(validateInviteCode).mockResolvedValue({ valid: false, reason: "Already used" });

    const response = await get(`/api/auth/google/callback?code=auth-code&state=${await aState("BETA123")}`);

    expect(response.location).toBe("/login?error=not_approved");
    expect(redeemInviteCode).not.toHaveBeenCalled();
    expect(sessionCookie(response)).toBeUndefined();
  });

  it("REDEEMS a valid beta code on the spot for an unapproved account, then signs them in", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(anAccount({ approved: false }) as never);

    const response = await get(`/api/auth/google/callback?code=auth-code&state=${await aState("BETA123")}`);

    expect(redeemInviteCode).toHaveBeenCalledWith(7, "BETA123");
    expect(response.location).toBe("/app");
    expect(sessionCookie(response)).toBeDefined();
  });

  it("lets an ADMIN through the approval gate without a code — the enumerated exemption", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(
      anAccount({ approved: false, role: "admin" }) as never,
    );

    const response = await get(`/api/auth/google/callback?code=auth-code&state=${await aState("")}`);

    expect(response.location).toBe("/app");
    expect(sessionCookie(response)).toBeDefined();
    expect(validateInviteCode).not.toHaveBeenCalled();
  });

  it("MINTS the session for an approved returning account, on their own openId", async () => {
    const response = await get(`/api/auth/google/callback?code=auth-code&state=${await aState()}`);

    expect(response.location).toBe("/app");
    expect(sdk.createSessionToken).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sdk.createSessionToken).mock.calls[0]![0]).toBe("google_existing");

    const cookie = sessionCookie(response);
    expect(cookie).toBeDefined();
    expect(cookie).toContain("session-token-stand-in");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain(`Max-Age=${Math.floor(SESSION_MAX_AGE_MS / 1000)}`);
  });

  it("clears the failed-login count on a successful sign-in, and audits the success", async () => {
    await get(`/api/auth/google/callback?code=auth-code&state=${await aState()}`);

    expect(db.resetFailedLogins).toHaveBeenCalledWith("google_existing");
    expect(auditRows()).toHaveLength(1);
    expect(auditRows()[0]).toMatchObject({
      action: AUDIT_ACTIONS.LOGIN_SUCCESS,
      resourceType: "auth",
      resourceId: "google_existing",
      metadata: { email: "person@example.com", loginMethod: "google", returningUser: true },
    });
  });

  it("does NOT convert an email-provider account to google on a Google sign-in", async () => {
    /* An account that registered with a password and later used the Google
       button keeps `authProvider: "email"` — the login handler in
       `emailAuth.ts` refuses a password sign-in on a google-provider row, so
       flipping this would lock them out of the door they came in by. */
    vi.mocked(getUserByEmail).mockResolvedValue(anAccount({ authProvider: "email" }) as never);

    await get(`/api/auth/google/callback?code=auth-code&state=${await aState()}`);

    const [written] = vi.mocked(db.upsertUser).mock.calls[0] as [Record<string, unknown>];
    expect(written).not.toHaveProperty("authProvider");
    expect(written.loginMethod).toBe("google");
  });

  it("marks a google-provider account as google and stamps the sign-in time", async () => {
    await get(`/api/auth/google/callback?code=auth-code&state=${await aState()}`);

    const [written] = vi.mocked(db.upsertUser).mock.calls[0] as [Record<string, unknown>];
    expect(written.authProvider).toBe("google");
    expect(written.lastSignedIn).toBeInstanceOf(Date);
  });
});

/*
  ─── THE NEW USER — invariant 9's fourth session mint, and its gates ───
*/

describe("GET /api/auth/google/callback — NEW user: approval holds by construction", () => {
  it("refuses to create an account with no beta code", async () => {
    const response = await get(`/api/auth/google/callback?code=auth-code&state=${await aState("")}`);

    expect(response.location).toBe("/login?error=no_code");
    expect(db.upsertUser).not.toHaveBeenCalled();
    expect(sdk.createSessionToken).not.toHaveBeenCalled();
  });

  it("refuses to create an account on a beta code the checker rejects", async () => {
    vi.mocked(validateInviteCode).mockResolvedValue({ valid: false, reason: "Expired" });

    const response = await get(`/api/auth/google/callback?code=auth-code&state=${await aState("BETA123")}`);

    expect(response.location).toBe("/login?error=invalid_code");
    expect(db.upsertUser).not.toHaveBeenCalled();
    expect(sessionCookie(response)).toBeUndefined();
  });

  it("validates the beta code BEFORE it writes anybody", async () => {
    const order: string[] = [];
    vi.mocked(validateInviteCode).mockImplementation((async () => {
      order.push("validate");
      return { valid: true };
    }) as never);
    vi.mocked(db.upsertUser).mockImplementation((async () => {
      order.push("upsert");
    }) as never);

    await get(`/api/auth/google/callback?code=auth-code&state=${await aState("BETA123")}`);

    expect(order).toEqual(["validate", "upsert"]);
  });

  it("creates the account under google_<sub> and mints the session on that same openId", async () => {
    const response = await get(`/api/auth/google/callback?code=auth-code&state=${await aState("BETA123")}`);

    const [written] = vi.mocked(db.upsertUser).mock.calls[0] as [Record<string, unknown>];
    expect(written.openId).toBe(`google_${GOOGLE_SUB}`);
    expect(written.email).toBe("person@example.com");
    expect(written.authProvider).toBe("google");

    /* A session minted for anyone but the account just created is the defect
       worth catching here — so the openId is read back out of what the handler
       handed the database, never asserted from a literal. */
    expect(vi.mocked(sdk.createSessionToken).mock.calls[0]![0]).toBe(written.openId);
    expect(response.location).toBe("/app");
    expect(sessionCookie(response)).toBeDefined();
  });

  it("stops with create_failed when the account it just wrote cannot be read back", async () => {
    vi.mocked(db.getUserByOpenId).mockResolvedValue(undefined as never);

    const response = await get(`/api/auth/google/callback?code=auth-code&state=${await aState("BETA123")}`);

    expect(response.location).toBe("/login?error=create_failed");
    expect(redeemInviteCode).not.toHaveBeenCalled();
    expect(sessionCookie(response)).toBeUndefined();
  });

  it("REDEEMS the code before the mint, and refuses the session when the redeem fails", async () => {
    vi.mocked(redeemInviteCode).mockResolvedValue({ success: false, error: "Already redeemed" });

    const response = await get(`/api/auth/google/callback?code=auth-code&state=${await aState("BETA123")}`);

    expect(response.location).toBe("/login?error=code_redeem_failed");
    expect(sdk.createSessionToken).not.toHaveBeenCalled();
    expect(sessionCookie(response)).toBeUndefined();
  });

  it("audits the new account with the code upper-cased and newAccount set", async () => {
    await get(`/api/auth/google/callback?code=auth-code&state=${await aState("beta123")}`);

    expect(auditRows()).toHaveLength(1);
    expect(auditRows()[0]).toMatchObject({
      action: AUDIT_ACTIONS.LOGIN_SUCCESS,
      resourceId: `google_${GOOGLE_SUB}`,
      metadata: { loginMethod: "google", newAccount: true, betaCode: "BETA123" },
    });
  });
});

/*
  ─── THE SESSION COOKIE ITSELF ───
*/

describe("GET /api/auth/google/callback — the cookie the mint sets", () => {
  beforeEach(() => {
    vi.mocked(getUserByEmail).mockResolvedValue(anAccount() as never);
  });

  it("is SameSite=Lax and not Secure on plain-HTTP localhost", async () => {
    /* CLAUDE.md's standing gotcha: `sameSite: "none"` without `Secure` is
       dropped by the browser, so a dev login silently never signs in. */
    const cookie = sessionCookie(
      await get(`/api/auth/google/callback?code=auth-code&state=${await aState()}`),
    );

    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("Secure");
  });

  it("is Secure and SameSite=None behind an HTTPS proxy", async () => {
    const cookie = sessionCookie(
      await get(`/api/auth/google/callback?code=auth-code&state=${await aState()}`, {
        "x-forwarded-proto": "https",
      }),
    );

    expect(cookie).toContain("SameSite=None");
    expect(cookie).toContain("Secure");
  });
});

/*
  ─── THE PROFILE-MEDIA BOUNDARY ───
*/

describe("Google OAuth — profile media boundary", () => {
  it("never persists Google's third-party picture URL", () => {
    const source = readFileSync(
      resolve(process.cwd(), "server/routes/googleAuth.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/\bpicture\b/);
    expect(source).toContain("avatarUrl: existingUser.avatarUrl || null");
    expect(source).toContain("avatarUrl: null");
  });

  it("and the driven proof: Google's photo reaches neither a new account nor a returning one", async () => {
    /* The guard above is a read of the source; this is the same claim made by
       a request. Google's payload in these arms really does carry a
       `picture` — the fixture supplies one precisely so this can fail. */
    await get(`/api/auth/google/callback?code=auth-code&state=${await aState("BETA123")}`);
    const [asNew] = vi.mocked(db.upsertUser).mock.calls[0] as [Record<string, unknown>];
    expect(asNew.avatarUrl).toBeNull();

    vi.clearAllMocks();
    vi.mocked(getUserByEmail).mockResolvedValue(anAccount({ avatarUrl: null }) as never);
    vi.mocked(db.isAccountLocked).mockResolvedValue({ locked: false } as never);
    vi.mocked(sdk.createSessionToken).mockResolvedValue("session-token-stand-in");
    await get(`/api/auth/google/callback?code=auth-code&state=${await aState()}`);
    const [asReturning] = vi.mocked(db.upsertUser).mock.calls[0] as [Record<string, unknown>];
    expect(asReturning.avatarUrl).toBeNull();
  });
});
