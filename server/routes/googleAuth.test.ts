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
/*
  THE FREE GRANT'S QUIET CAP IS REAL HERE; ONLY ITS STORAGE IS STAGED (#1603).

  ⚠ Six of this file's NEW-USER arms went red the moment the cap landed, and
  that is the honest signal rather than a nuisance: `mayGrantFreeCredits` FAILS
  CLOSED when it cannot count (invariant 7), so the new-account branch correctly
  started redirecting. Mocking `../security/freeGrantLimit` would have turned all
  six green again and silently taken the new gate out of the only suite that
  drives this callback as a browser.

  So the real policy runs — the real comparison, the real device cookie, the real
  redirect code — with the count staged at zero, and those six arms are now also
  a positive control that an honest Google signup passes it.
*/
vi.mock("../db/quietLimits", () => ({
  countFreeGrantClaims: vi.fn(),
  recordFreeGrantClaim: vi.fn(),
  countFaceScanAgainstDay: vi.fn(),
}));

import { COOKIE_NAME, SESSION_MAX_AGE_MS } from "@shared/const";

import { ENV, NUMERIC_ENV_VARS } from "../_core/env";
import { countFreeGrantClaims, recordFreeGrantClaim } from "../db/quietLimits";
import { FREE_GRANT_REFUSAL_ERROR_CODE } from "@shared/freeGrantRefusal";
import { DEVICE_COOKIE_NAME } from "../security/deviceKey";
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

/**
 * A FLOW THAT REALLY STARTED IN THIS BROWSER (#1681).
 *
 * The state nonce is now bound to a cookie the ENTRY route sets, so a hand-made
 * state is a FORGED callback — which is exactly what `aState` above is kept for,
 * and what the attack arm uses. Everything that must get PAST the gate goes
 * through here instead: it drives the real `/api/auth/google`, reads the state
 * out of the argument the route handed Google's own client, and carries back the
 * cookie the route set in that same answer.
 *
 * ⚠ **NOTHING HERE RE-IMPLEMENTS THE BINDING** (working law 4). The cookie's
 * name, its value and its attributes are all the route's own; this helper never
 * hashes anything, which is why it cannot pass by agreeing with a mistake. It
 * finds the cookie by construction rather than by name: `/api/auth/google` sets
 * exactly ONE cookie and it is not the session, and the arm below pins that.
 */
async function aStartedFlow(betaCode = ""): Promise<{ state: string; cookie: string }> {
  const query = betaCode === "" ? "" : `?betaCode=${encodeURIComponent(betaCode)}`;
  const started = await get(`/api/auth/google${query}`);
  const state = (google.generateAuthUrl.mock.calls.at(-1)?.[0] as { state?: string } | undefined)?.state;
  const jar = started.cookies.filter((cookie) => !cookie.startsWith(`${COOKIE_NAME}=`));
  if (!state || jar.length !== 1) {
    throw new Error(
      `the entry route did not start one flow (state=${String(state)}, cookies=${jar.length}) — `
      + "the harness is broken, not the product",
    );
  }
  return { state, cookie: jar[0]!.split(";")[0]! };
}

/**
 * The callback as a BROWSER reaches it: the state the route itself minted and
 * the cookie it set alongside it, in one call so an arm reads as one act.
 */
async function callback(
  query: string,
  options: { betaCode?: string; headers?: Record<string, string> } = {},
): Promise<DrivenResponse> {
  const flow = await aStartedFlow(options.betaCode ?? "");
  return get(`/api/auth/google/callback?${query}&state=${flow.state}`, {
    cookie: flow.cookie,
    ...(options.headers ?? {}),
  });
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
  /* The quiet cap's storage, staged clean; the cap itself is the real one. */
  vi.mocked(countFreeGrantClaims).mockResolvedValue({ device: 0, network: 0 });
  vi.mocked(recordFreeGrantClaim).mockResolvedValue(undefined);
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
  ─────────────────────────────────────────────────────────────────────────
  THE STATE IS BOUND TO A BROWSER, NOT JUST SIGNED (#1681)
  ─────────────────────────────────────────────────────────────────────────

  Every arm above proves the state is OURS. None of them proved it was THIS
  BROWSER's, and that is the whole of login-CSRF by link: the attacker starts a
  sign-in here, keeps the callback URL, and sends it to the victim. The
  signature verifies — they minted it with our key through our own entry route —
  and before this the victim was signed into THEIR account.

  ⚠ IT IS A TOP-LEVEL GET, SO NOTHING ELSE IN THE TREE CAN SEE IT. #1659's
  cross-site guard judges state-changing methods and correctly lets a GET
  through, and a GET cannot be refused on `Origin` without breaking the real
  round-trip from accounts.google.com. The cookie is the only thing an attacker
  cannot put in the victim's browser.

  The first arm IS the attack, driven end to end over real HTTP.
*/

describe("GET /api/auth/google/callback — the state nonce is bound to the browser (#1681)", () => {
  it("⚠ THE ATTACK: a real, valid state from ANOTHER browser is refused, and nothing happens", async () => {
    /* The attacker's own flow, started here — so the token is genuinely ours,
       genuinely signed, genuinely unexpired, and carries a real nonce. What the
       victim's browser does not have is the cookie that flow put in the
       ATTACKER's jar. */
    const attackersFlow = await aStartedFlow();
    vi.clearAllMocks();
    google.getToken.mockResolvedValue({ tokens: { id_token: "google-id-token-stand-in" } });

    const response = await get(
      `/api/auth/google/callback?code=attackers-auth-code&state=${attackersFlow.state}`,
    );

    expect(response.location).toBe("/login?error=invalid_state");
    /* Refused BEFORE Google is spoken to — a crafted link costs nothing. */
    expect(google.getToken).not.toHaveBeenCalled();
    expect(google.verifyIdToken).not.toHaveBeenCalled();
    /* And nothing was written: no session, no audit row, no Set-Cookie at all.
       The last one is deliberate — clearing the state cookie here would let a
       crafted request drop a real pending flow of hers. */
    expect(sdk.createSessionToken).not.toHaveBeenCalled();
    expect(auditRows()).toHaveLength(0);
    expect(response.cookies).toEqual([]);
  });

  it("⚠ and ANOTHER flow's cookie does not help — the nonce has to be that flow's", async () => {
    /* The sharper form: the attacker gets the victim to hold a state cookie by
       sending her through the entry route first. It is still the wrong nonce. */
    const first = await aStartedFlow();
    const second = await aStartedFlow();
    expect(first.state).not.toBe(second.state);
    expect(first.cookie).not.toBe(second.cookie);

    const response = await get(
      `/api/auth/google/callback?code=auth-code&state=${first.state}`,
      { cookie: second.cookie },
    );

    expect(response.location).toBe("/login?error=invalid_state");
    expect(google.getToken).not.toHaveBeenCalled();
  });

  it("NEGATIVE CONTROL: the real round-trip still signs a person in", async () => {
    /*
      Without this the arms above pass by refusing EVERYTHING, which is the
      failure mode of a fail-closed gate and the one that would take Google
      sign-in off the product entirely. Start → cookie → callback with the
      matching nonce, over real HTTP against the real router.
    */
    vi.mocked(getUserByEmail).mockResolvedValue(anAccount() as never);

    const flow = await aStartedFlow();
    const response = await get(
      `/api/auth/google/callback?code=auth-code&state=${flow.state}`,
      { cookie: flow.cookie },
    );

    expect(response.location).toBe("/app");
    expect(sdk.createSessionToken).toHaveBeenCalledWith("google_existing", expect.anything());
    expect(sessionCookie(response)).toBeDefined();
  });

  it("the entry route sets ONE cookie, and it is the binding — not the session", async () => {
    const started = await get("/api/auth/google");

    expect(started.cookies).toHaveLength(1);
    expect(sessionCookie(started), "the entry route must never mint a session").toBeUndefined();

    const binding = started.cookies[0]!;
    expect(binding, "no script needs it").toContain("HttpOnly");
    /*
      ⚠ `Lax` AND NOT `Strict`, AND THIS ARM IS THE REASON IT STAYS THAT WAY.
      The callback is a cross-site top-level navigation from Google. `Strict`
      withholds the cookie on exactly that request, so it would break every
      Google sign-in — and the breakage would look like this gate working.
    */
    expect(binding).toContain("SameSite=Lax");
    expect(binding).not.toContain("SameSite=Strict");
    expect(binding).not.toContain("SameSite=None");
    /* Scoped to this flow's own path, and the prefix covers the callback. */
    expect(binding).toContain("Path=/api/auth/google");
    /* Ten minutes, the same window the state token itself carries. */
    expect(binding).toMatch(/Max-Age=600\b/);
    /* Plain HTTP here, so not Secure — the same rule the session cookie
       follows, and the reason a dev login works at all. */
    expect(binding).not.toContain("Secure");
  });

  it("is Secure behind an HTTPS proxy, like the session cookie", async () => {
    const started = await get("/api/auth/google", { "x-forwarded-proto": "https" });

    expect(started.cookies[0]).toContain("Secure");
    expect(started.cookies[0]).toContain("SameSite=Lax");
  });

  it("carries a FINGERPRINT of the nonce, never the nonce itself", async () => {
    /*
      The cookie is not a state's preimage, so a leaked jar is not a mintable
      flow. Derived from the state the route minted rather than from a hash this
      file computes — it reads the nonce out of the token and asserts the cookie
      is NOT it, and is a 64-character hex digest.
    */
    const flow = await aStartedFlow();
    const nonce = JSON.parse(
      Buffer.from(flow.state.split(".")[1]!, "base64url").toString("utf8"),
    ).nonce as string;
    const value = flow.cookie.split("=")[1]!;

    expect(nonce.length).toBeGreaterThan(0);
    expect(value).not.toBe(nonce);
    expect(value).toMatch(/^[0-9a-f]{64}$/);
  });

  it("spends the cookie on a matched callback — one state, one callback", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(anAccount() as never);
    const flow = await aStartedFlow();
    const bindingName = flow.cookie.split("=")[0]!;

    const response = await get(
      `/api/auth/google/callback?code=auth-code&state=${flow.state}`,
      { cookie: flow.cookie },
    );

    const cleared = response.cookies.find((cookie) => cookie.startsWith(`${bindingName}=`));
    expect(cleared, "the binding cookie is not cleared after it is used").toBeDefined();
    /* Express clears by expiring it in the past; either spelling counts. */
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/);
    expect(cleared, "cleared on the path it was set on, or the browser keeps it")
      .toContain("Path=/api/auth/google");
  });
});

/*
  ─── GET /api/auth/google/callback — what Google answered ───
*/

describe("GET /api/auth/google/callback — the answers from Google the route refuses", () => {
  it("refuses a token exchange that came back without an ID token", async () => {
    google.getToken.mockResolvedValue({ tokens: { access_token: "no-id-token-here" } });

    const response = await callback("code=auth-code");

    expect(response.location).toBe("/login?error=no_id_token");
    expect(google.verifyIdToken).not.toHaveBeenCalled();
    expect(sessionCookie(response)).toBeUndefined();
  });

  it("verifies the ID token against THIS product's client id as the audience", async () => {
    await callback("code=auth-code");

    expect(google.verifyIdToken).toHaveBeenCalledTimes(1);
    const [options] = google.verifyIdToken.mock.calls[0] as [Record<string, unknown>];
    expect(options.idToken).toBe("google-id-token-stand-in");
    expect(options.audience).toBe(process.env.GOOGLE_CLIENT_ID);
  });

  it("refuses a verified token carrying no email", async () => {
    google.verifyIdToken.mockResolvedValue({ getPayload: () => aGooglePayload({ email: undefined }) });

    const response = await callback("code=auth-code");

    expect(response.location).toBe("/login?error=invalid_token");
    expect(getUserByEmail).not.toHaveBeenCalled();
  });

  it("refuses a verified token with no payload at all", async () => {
    google.verifyIdToken.mockResolvedValue({ getPayload: () => undefined });

    const response = await callback("code=auth-code");

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

    const response = await callback("code=auth-code");

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

    const response = await callback("code=auth-code");

    expect(response.location).toBe("/app");
  });

  it("turns a thrown token exchange into google_error and an audited failure, never a stack trace", async () => {
    google.getToken.mockRejectedValue(new Error("invalid_grant"));

    const response = await callback("code=auth-code");

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

  /*
    ⚠ THE HONEST-USER ARM, AND IT IS THE MOST IMPORTANT ONE #1603 ADDED HERE.

    A returning customer already HAS her account and her credits. The free-grant
    cap must never touch this branch — if it did, the second person in a household
    or anybody in an office that had already used its allowance would be locked out
    of an account she owns, by a control whose whole stated purpose is that honest
    users never notice it.

    It holds by construction rather than by a condition: the gate is inside the
    `else` that creates a new account, and the grant itself only fires when
    `upsertUser` finds no credits row (`db/users.ts`). This arm is what makes that
    construction a FACT rather than a reading of the source — the count is staged
    far past both caps and she signs in anyway.
  */
  it("lets a returning customer in even when the free-grant caps are exhausted", async () => {
    vi.mocked(countFreeGrantClaims).mockResolvedValue({
      device: NUMERIC_ENV_VARS.FREE_GRANT_MAX_PER_DEVICE * 10,
      network: NUMERIC_ENV_VARS.FREE_GRANT_MAX_PER_NETWORK * 10,
    });

    const response = await callback("code=auth-code");

    expect(response.location).toBe("/app");
    expect(sessionCookie(response)).toBeDefined();
    /* And the cap was never even consulted on this road — her sign-in does not
       depend on a counting query succeeding. */
    expect(countFreeGrantClaims).not.toHaveBeenCalled();
    expect(recordFreeGrantClaim).not.toHaveBeenCalled();
  });

  it("refuses a SUSPENDED account, audits it as suspended, and mints nothing", async () => {
    vi.mocked(db.isAccountLocked).mockResolvedValue({
      locked: true, lockedUntil: null, reason: "Suspended by an admin",
    } as never);

    const response = await callback("code=auth-code");

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

    const response = await callback("code=auth-code");

    expect(response.location).toBe("/login?error=locked");
    expect(sessionCookie(response)).toBeUndefined();
    expect(auditRows()[0]).toMatchObject({ action: AUDIT_ACTIONS.LOGIN_BLOCKED_LOCKED });
  });

  it("refuses an UNAPPROVED account that brought no beta code, and mints nothing", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(anAccount({ approved: false }) as never);

    const response = await callback("code=auth-code");

    expect(response.location).toBe("/login?error=not_approved");
    expect(sessionCookie(response)).toBeUndefined();
    expect(sdk.createSessionToken).not.toHaveBeenCalled();
    expect(redeemInviteCode).not.toHaveBeenCalled();
  });

  it("refuses an UNAPPROVED account whose beta code the checker rejects", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(anAccount({ approved: false }) as never);
    vi.mocked(validateInviteCode).mockResolvedValue({ valid: false, reason: "Already used" });

    const response = await callback("code=auth-code", { betaCode: "BETA123" });

    expect(response.location).toBe("/login?error=not_approved");
    expect(redeemInviteCode).not.toHaveBeenCalled();
    expect(sessionCookie(response)).toBeUndefined();
  });

  it("REDEEMS a valid beta code on the spot for an unapproved account, then signs them in", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(anAccount({ approved: false }) as never);

    const response = await callback("code=auth-code", { betaCode: "BETA123" });

    expect(redeemInviteCode).toHaveBeenCalledWith(7, "BETA123");
    expect(response.location).toBe("/app");
    expect(sessionCookie(response)).toBeDefined();
  });

  it("lets an ADMIN through the approval gate without a code — the enumerated exemption", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(
      anAccount({ approved: false, role: "admin" }) as never,
    );

    const response = await callback("code=auth-code");

    expect(response.location).toBe("/app");
    expect(sessionCookie(response)).toBeDefined();
    expect(validateInviteCode).not.toHaveBeenCalled();
  });

  it("MINTS the session for an approved returning account, on their own openId", async () => {
    const response = await callback("code=auth-code");

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
    await callback("code=auth-code");

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

    await callback("code=auth-code");

    const [written] = vi.mocked(db.upsertUser).mock.calls[0] as [Record<string, unknown>];
    expect(written).not.toHaveProperty("authProvider");
    expect(written.loginMethod).toBe("google");
  });

  it("marks a google-provider account as google and stamps the sign-in time", async () => {
    await callback("code=auth-code");

    const [written] = vi.mocked(db.upsertUser).mock.calls[0] as [Record<string, unknown>];
    expect(written.authProvider).toBe("google");
    expect(written.lastSignedIn).toBeInstanceOf(Date);
  });
});

/*
  ─── THE NEW USER — invariant 9's fourth session mint, and its gates ───
*/

describe("GET /api/auth/google/callback — NEW user: approval holds by construction", () => {
  /*
    ───────────────────────────────────────────────────────────────────────
    THE FREE GRANT'S QUIET CAP ON THIS ROAD (#1603, P1-4), driven as a browser.

    This is the second of the product's two new-account roads, and the cap had to
    land on both: the Google callback creates the row with the same `upsertUser`
    call, so the grant fires inside it exactly as it does on the email road.

    ⚠ A refusal REDIRECTS rather than answering a body, because there is nothing
    here to read one — and the code it redirects with is the shared constant, so
    it cannot drift from the key the login page's error map is built on. A code
    with no entry there renders a blank page to a refused customer.
    ───────────────────────────────────────────────────────────────────────
  */
  it("refuses a capped NEW signup, and creates no account", async () => {
    vi.mocked(countFreeGrantClaims).mockResolvedValue({
      device: 0,
      network: NUMERIC_ENV_VARS.FREE_GRANT_MAX_PER_NETWORK,
    });

    const response = await callback("code=auth-code", { betaCode: "BETA123" });

    expect(response.location).toBe(`/login?error=${FREE_GRANT_REFUSAL_ERROR_CODE}`);
    /* `upsertUser` is the call that creates the row and grants inside it. */
    expect(db.upsertUser).not.toHaveBeenCalled();
    expect(redeemInviteCode).not.toHaveBeenCalled();
    expect(sessionCookie(response)).toBeUndefined();
  });

  it("sets the device cookie and records the claim on a signup it allows", async () => {
    const response = await callback("code=auth-code", { betaCode: "BETA123" });

    expect(response.cookies.some((cookie) => cookie.startsWith(`${DEVICE_COOKIE_NAME}=`))).toBe(true);
    expect(recordFreeGrantClaim).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddress: expect.any(String) }),
    );
  });

  it("refuses to create an account with no beta code", async () => {
    const response = await callback("code=auth-code");

    expect(response.location).toBe("/login?error=no_code");
    expect(db.upsertUser).not.toHaveBeenCalled();
    expect(sdk.createSessionToken).not.toHaveBeenCalled();
  });

  it("refuses to create an account on a beta code the checker rejects", async () => {
    vi.mocked(validateInviteCode).mockResolvedValue({ valid: false, reason: "Expired" });

    const response = await callback("code=auth-code", { betaCode: "BETA123" });

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

    await callback("code=auth-code", { betaCode: "BETA123" });

    expect(order).toEqual(["validate", "upsert"]);
  });

  it("creates the account under google_<sub> and mints the session on that same openId", async () => {
    const response = await callback("code=auth-code", { betaCode: "BETA123" });

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

    const response = await callback("code=auth-code", { betaCode: "BETA123" });

    expect(response.location).toBe("/login?error=create_failed");
    expect(redeemInviteCode).not.toHaveBeenCalled();
    expect(sessionCookie(response)).toBeUndefined();
  });

  it("REDEEMS the code before the mint, and refuses the session when the redeem fails", async () => {
    vi.mocked(redeemInviteCode).mockResolvedValue({ success: false, error: "Already redeemed" });

    const response = await callback("code=auth-code", { betaCode: "BETA123" });

    expect(response.location).toBe("/login?error=code_redeem_failed");
    expect(sdk.createSessionToken).not.toHaveBeenCalled();
    expect(sessionCookie(response)).toBeUndefined();
  });

  it("audits the new account with the code upper-cased and newAccount set", async () => {
    await callback("code=auth-code", { betaCode: "beta123" });

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
      await callback("code=auth-code"),
    );

    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("Secure");
  });

  /**
   * ⚠ THIS ARM SAID `SameSite=None` UNTIL 2026-10-01 AND THAT WAS THE DEFECT,
   * PINNED (#1653, the founder's engineering agent's monthly audit).
   *
   * `None` tells the browser to attach the session cookie to requests made BY
   * OTHER SITES, so any page a signed-in customer visited could POST
   * `billing.cancelSubscription` in her name — all three no-input mutations are
   * CORS *simple* requests, so there was no preflight to fail. Nothing in the
   * tree ever needed `None`: this very callback is a **top-level GET**, which
   * `Lax` allows, and it is the road the clause claiming otherwise was about.
   *
   * It is the arm for the production road specifically — the localhost arm
   * above was already `Lax` and could never have caught this.
   */
  it("is Secure and SameSite=Lax behind an HTTPS proxy — never None (#1653)", async () => {
    const cookie = sessionCookie(
      await callback("code=auth-code", { headers: { "x-forwarded-proto": "https" } }),
    );

    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("SameSite=None");
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
    await callback("code=auth-code", { betaCode: "BETA123" });
    const [asNew] = vi.mocked(db.upsertUser).mock.calls[0] as [Record<string, unknown>];
    expect(asNew.avatarUrl).toBeNull();

    vi.clearAllMocks();
    vi.mocked(getUserByEmail).mockResolvedValue(anAccount({ avatarUrl: null }) as never);
    vi.mocked(db.isAccountLocked).mockResolvedValue({ locked: false } as never);
    vi.mocked(sdk.createSessionToken).mockResolvedValue("session-token-stand-in");
    await callback("code=auth-code");
    const [asReturning] = vi.mocked(db.upsertUser).mock.calls[0] as [Record<string, unknown>];
    expect(asReturning.avatarUrl).toBeNull();
  });
});
