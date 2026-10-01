/**
 * THE SIGN-IN ROUTE REFUSES A CROSS-SITE FORM POST — #1659, driven over real
 * HTTP against the real router.
 *
 * # What is being proven, and why it needs a real socket
 *
 * The attack is a plain HTML form on somebody else's page POSTing **the
 * attacker's** credentials to our sign-in route. The customer's browser stores
 * the `Set-Cookie` that comes back, and she is now signed into his account with
 * everything she makes landing where he can read it.
 *
 * Three things have to be true at once for that to be the shape, and only a real
 * request can show them together:
 *
 *  1. the body is `application/x-www-form-urlencoded` — a CORS **simple**
 *     content type, so there is no preflight to fail and `req.body` is populated
 *     by the same `express.urlencoded()` `server/_core/index.ts` registers;
 *  2. the browser's own `Origin` / `Sec-Fetch-Site` headers are what distinguish
 *     it from a legitimate sign-in, and a unit call cannot carry them;
 *  3. the thing that must NOT come back is a `Set-Cookie`, which is a response
 *     header rather than a return value.
 *
 * So the app below is assembled the way the product assembles it — both body
 * parsers, then the real `emailAuthRouter` at `/api/auth` — and every arm is a
 * `fetch` through a listening server.
 *
 * # ⚠ THE REFUSAL IS PROVEN BY WHAT DID NOT HAPPEN, NOT ONLY BY THE STATUS
 *
 * A 403 is also what a suspended account gets, and what a locked one gets. So
 * the arms assert the ORDER: `getUserByEmail` was never asked, no audit row was
 * written and no session was minted. **"Refused before the password is checked"
 * is the done-when, and a status code cannot say it.** It is also what keeps a
 * login route from becoming a cross-site oracle for whether a password is right.
 *
 * # ⚠ AND `Host` CANNOT BE FORGED FROM HERE, WHICH IS WHY THE ARMS LOOK LIKE THIS
 *
 * The first draft set `host: "klieglabs.com"` beside each `Origin` and read
 * convincingly. **`Host` is on fetch's forbidden-header list, so every one of
 * those values was silently dropped** and the real `Host` was `127.0.0.1:<port>`.
 * The refusal arms passed anyway — `evil.example` is not the loopback either —
 * but they were passing for a reason the test did not state, and the two
 * same-origin controls went RED and said so.
 *
 * So a same-origin arm asks for the server's OWN origin (`ownOrigin` below)
 * rather than a hostname it made up. The limitation is the control's own best
 * argument: a browser cannot lie about `Host` or `Origin` either, and a caller
 * that CAN — curl — is carrying nobody else's cookie.
 *
 * The far ends are mocked the way `emailAuth.test.ts` mocks them — the db, the
 * mailer, the session mint, the audit log. The subject is always the route.
 */
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { baseUrlOf, listenOnFetchablePort } from "../testing/fetchablePort";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

vi.mock("../db", () => ({
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn(),
  isAccountLocked: vi.fn().mockResolvedValue({ locked: false }),
  recordFailedLogin: vi.fn().mockResolvedValue(undefined),
  resetFailedLogins: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../db/users", () => ({ getUserByEmail: vi.fn() }));
vi.mock("../db/validateInviteCode", () => ({ validateInviteCode: vi.fn() }));
vi.mock("../db/inviteCodes", () => ({ redeemInviteCode: vi.fn() }));
vi.mock("../db/connection", () => ({ getDb: vi.fn() }));
vi.mock("./emailVerification", () => ({
  generateVerificationToken: vi.fn(() => "verification-token-stand-in"),
  storeVerificationToken: vi.fn().mockResolvedValue(undefined),
  sendVerificationEmail: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("../security/loginAttackAlert", () => ({ noteFailedLogin: vi.fn() }));
vi.mock("../_core/sdk", () => ({
  sdk: { createSessionToken: vi.fn().mockResolvedValue("session-token-stand-in") },
}));
vi.mock("../auditLog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../auditLog")>()),
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../security/rateLimit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../security/rateLimit")>()),
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 9, resetIn: 0 })),
}));

import bcrypt from "bcryptjs";
import { COOKIE_NAME } from "@shared/const";

import { logAuditEvent } from "../auditLog";
import { getUserByEmail } from "../db/users";
import { sdk } from "../_core/sdk";
import {
  CROSS_SITE_REFUSAL_MESSAGE,
  refuseCrossSiteAuthRequest,
} from "../security/crossSiteExpressGuard";
import { emailAuthRouter } from "./emailAuth";

const PASSWORD = "SecurePass1";
const CUSTOMER = {
  id: 7,
  openId: "email_customer",
  name: "A Customer",
  email: "customer@example.com",
  authProvider: "email",
  emailVerified: true,
  approved: true,
  role: "user",
  passwordHash: bcrypt.hashSync(PASSWORD, 4),
};

type Driven = { status: number; json: Record<string, unknown>; cookies: string[] };

/**
 * A real form POST through a real listening server.
 *
 * ⚠ **Both body parsers are registered, in the product's order**
 * (`server/_core/index.ts`, where `express.json()` and `express.urlencoded()` are
 * both mounted before the auth router), because the whole premise of this card is
 * that a form-encoded body reaches the handler. An app carrying only
 * `express.json()` would make every arm below pass for the wrong reason: the body
 * would be empty, the schema would reject it, and a 400 would look like a
 * refusal.
 */
async function formPost(
  path: string,
  fields: Record<string, string>,
  headers: Record<string, string> | ((ownOrigin: string) => Record<string, string>),
): Promise<Driven> {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use("/api/auth", emailAuthRouter);
  const server = await listenOnFetchablePort((port) => app.listen(port, "127.0.0.1"));
  try {
    const ownOrigin = baseUrlOf(server);
    const response = await fetch(`${ownOrigin}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": "drape-test-agent",
        ...(typeof headers === "function" ? headers(ownOrigin) : headers),
      },
      body: new URLSearchParams(fields).toString(),
    });
    const text = await response.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      /* not json — the arms that care assert on the status and the cookie */
    }
    const cookies = typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie") ?? ""].filter(Boolean);
    return { status: response.status, json, cookies };
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())));
  }
}

function sessionMinted(driven: Driven): boolean {
  return driven.cookies.some((cookie) => cookie.startsWith(`${COOKIE_NAME}=`));
}

/** The attacker's own credentials — the point of the attack is that they are valid. */
const ATTACKER_FORM = { email: "attacker@evil.example", password: "AttackerPass1" };

beforeEach(() => {
  vi.mocked(getUserByEmail).mockResolvedValue(CUSTOMER as never);
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("a cross-site form POST cannot sign anybody in", () => {
  it("refuses /login when the Origin is another site, and mints nothing", async () => {
    const driven = await formPost("/api/auth/login", ATTACKER_FORM, {
      /* No `host` here: fetch would drop it. The mismatch is against the
         server's real host, which is the comparison production makes too. */
      origin: "https://evil.example",
    });
    expect(driven.status).toBe(403);
    expect(sessionMinted(driven)).toBe(false);
    /* The one sentence a person reads, and it is #1653's word for word. */
    expect(driven.json.error).toBe(CROSS_SITE_REFUSAL_MESSAGE);
  });

  it("refuses it BEFORE the password is checked — the done-when a status cannot say", async () => {
    await formPost("/api/auth/login", ATTACKER_FORM, {
      /* No `host` here: fetch would drop it. The mismatch is against the
         server's real host, which is the comparison production makes too. */
      origin: "https://evil.example",
    });
    /* No lookup, so no timing signal and no enumeration oracle either. */
    expect(getUserByEmail).not.toHaveBeenCalled();
    expect(sdk.createSessionToken).not.toHaveBeenCalled();
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  it("refuses it when the browser says so itself, with no Origin to read", async () => {
    /* `Sec-Fetch-Site` is on the forbidden-header list, so no page can forge it.
       It is the first of the two signals and must stand alone. */
    const driven = await formPost("/api/auth/login", ATTACKER_FORM, {
      "sec-fetch-site": "cross-site",
    });
    expect(driven.status).toBe(403);
    expect(sessionMinted(driven)).toBe(false);
    expect(getUserByEmail).not.toHaveBeenCalled();
  });

  it("refuses an opaque Origin — a sandboxed iframe or a redirected cross-origin POST", async () => {
    const driven = await formPost("/api/auth/login", ATTACKER_FORM, {
      origin: "null",
    });
    expect(driven.status).toBe(403);
    expect(sessionMinted(driven)).toBe(false);
  });

  it("refuses /register too — the router's other mint site, and it is dev-only", async () => {
    /* Covered because the guard is mounted on the ROUTER rather than on the two
       handlers: this arm is what would redden if somebody moved it onto one. */
    const driven = await formPost(
      "/api/auth/register",
      { email: "new@example.com", password: PASSWORD, name: "New", betaCode: "BETA123" },
      { origin: "https://evil.example" },
    );
    expect(driven.status).toBe(403);
    expect(sessionMinted(driven)).toBe(false);
  });
});

describe("THE POSITIVE CONTROL — a real sign-in still works", () => {
  /**
   * ⚠ **THE ARMS THAT MATTER MOST ON THIS CARD.** The card's own first line says
   * a mistake in a login route locks every customer out of the product, so a
   * guard that refused everything would satisfy every arm above and be a total
   * outage. Each of these is a sign-in that MUST land.
   */
  it("signs in a form POST from our own origin, cookie and all", async () => {
    const driven = await formPost(
      "/api/auth/login",
      { email: CUSTOMER.email, password: PASSWORD },
      (ownOrigin) => ({ origin: ownOrigin }),
    );
    expect(driven.status).toBe(200);
    expect(driven.json.success).toBe(true);
    expect(sessionMinted(driven)).toBe(true);
    expect(sdk.createSessionToken).toHaveBeenCalledTimes(1);
  });

  it("signs in when the browser reports same-origin and sends no Origin", async () => {
    const driven = await formPost(
      "/api/auth/login",
      { email: CUSTOMER.email, password: PASSWORD },
      { "sec-fetch-site": "same-origin" },
    );
    expect(driven.status).toBe(200);
    expect(sessionMinted(driven)).toBe(true);
  });

  it("signs in a caller with neither header — curl, a native app, every HTTP test", async () => {
    /* `judgeRequestOrigin` allows the headerless case deliberately: it is not a
       browser, so it has no ambient cookie to borrow, and it still had to send
       the right password. Refusing it would break every non-browser caller to
       buy nothing. */
    const driven = await formPost(
      "/api/auth/login",
      { email: CUSTOMER.email, password: PASSWORD },
      {},
    );
    expect(driven.status).toBe(200);
    expect(sessionMinted(driven)).toBe(true);
  });

  it("signs in when the Origin carries a port, as it does in development", async () => {
    /* The dev server is one process on one port, so a browser's Origin and the
       Host it addressed are the same string INCLUDING the port — and this suite's
       own server is that shape. An arm typing `localhost:3000` would have been
       asserting about a port nothing was listening on. */
    const driven = await formPost(
      "/api/auth/login",
      { email: CUSTOMER.email, password: PASSWORD },
      (ownOrigin) => {
        expect(new URL(ownOrigin).port, "the drive must carry a port for this arm to mean anything").not.toBe("");
        return { origin: ownOrigin };
      },
    );
    expect(driven.status).toBe(200);
    expect(sessionMinted(driven)).toBe(true);
  });

  it("signs in behind Railway's proxy, where X-Forwarded-Host is the real host", async () => {
    /* `configureTrustedProxy` is why express trusts one hop; the judge reads the
       forwarded host as one of ours. Without this arm the guard could pass every
       test above and refuse every sign-in in production. */
    const driven = await formPost(
      "/api/auth/login",
      { email: CUSTOMER.email, password: PASSWORD },
      {
        origin: "https://drape-production-0232.up.railway.app",
        "x-forwarded-host": "drape-production-0232.up.railway.app",
      },
    );
    expect(driven.status).toBe(200);
    expect(sessionMinted(driven)).toBe(true);
  });
});

/**
 * ⚠ **THE POPULATION IS READ OFF THE TREE, NOT TRANSCRIBED — the card's own
 * done-when: *"the arm names which of the five mint sites it covers and which are
 * GET-only, so the population is read rather than assumed."***
 *
 * A guard mounted on two routers by hand is a guard whose coverage is a claim.
 * These arms derive it: find every module that writes a session cookie, read the
 * HTTP verbs it declares, and hold the rule
 *
 *   **a mint-site module that declares a non-GET route carries this guard**
 *
 * — with **no exception list**, which is the whole reason `emailVerificationRouter`
 * is mounted as well. A rule with an exception list is a rule somebody has to
 * maintain, and `CLAUDE.md`'s own record of this repository is that such lists
 * rot. A third auth router added next year with a POST on it reddens here.
 *
 * The regex for a mint is `sessionIssuanceSites.test.ts`'s, deliberately: that
 * suite is invariant 9's counter and its reading is the one the record uses. This
 * file asks a different question of the same population.
 */
describe("every auth router that can be form-driven carries the guard", () => {
  const routesDir = path.join(repoRoot, "server/routes");

  /** `module` → { mints, verbs } for every route module that writes a session cookie. */
  function mintSiteModules(): Record<string, { mints: number; verbs: Set<string> }> {
    const found: Record<string, { mints: number; verbs: Set<string> }> = {};
    for (const entry of readdirSync(routesDir)) {
      if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) continue;
      const source = readFileSync(path.join(routesDir, entry), "utf8");
      const mints = [...source.matchAll(/\bres\.cookie\(\s*COOKIE_NAME\b/g)].length;
      if (mints === 0) continue;
      const verbs = new Set(
        [...source.matchAll(/\w*Router\.(get|post|put|patch|delete)\(/gi)]
          .map((match) => match[1]!.toUpperCase()),
      );
      found[entry] = { mints, verbs };
    }
    return found;
  }

  it("finds the three mint-site modules invariant 9 names, and no fourth", () => {
    /* Named rather than counted: a fourth module minting a session is a new
       issuance site, which CLAUDE.md calls an enumerated decision. */
    expect(Object.keys(mintSiteModules()).sort())
      .toEqual(["emailAuth.ts", "emailVerification.ts", "googleAuth.ts"]);
  });

  it("mounts the guard on exactly the mint-site modules that declare a non-GET route", () => {
    for (const [module, { verbs }] of Object.entries(mintSiteModules())) {
      const source = readFileSync(path.join(routesDir, module), "utf8");
      const mounted = source.includes("refuseCrossSiteAuthRequest");
      const formDrivable = [...verbs].some((verb) => verb !== "GET");
      expect(
        mounted,
        formDrivable
          ? `${module} declares ${[...verbs].join("/")} and does NOT carry the cross-site guard`
          : `${module} is GET-only (${[...verbs].join("/")}) and carries the guard — a cross-site`
            + ` GET is a customer arriving on a link, and refusing it breaks the Google entry`,
      ).toBe(formDrivable);
    }
  });

  it("mounts it on the ROUTER rather than on a handler, so a new route inherits it", () => {
    /* `router.use(...)` above the declarations is the control; the same call
       written inside two `.post()` handlers would pass every behaviour arm in
       this file and silently miss the third route somebody adds. */
    for (const module of ["emailAuth.ts", "emailVerification.ts"]) {
      const source = readFileSync(path.join(routesDir, module), "utf8");
      expect(source, `${module} must mount the guard on its router`)
        .toMatch(/\w*Router\.use\(refuseCrossSiteAuthRequest\)/);
    }
  });

  it("the Google router stays GET-only, which is why a form cannot reach its mint", () => {
    const { verbs, mints } = mintSiteModules()["googleAuth.ts"]!;
    expect([...verbs].sort()).toEqual(["GET"]);
    expect(mints).toBe(2);
  });
});

/**
 * ⚠ **A CROSS-SITE `GET` MUST STILL BE SERVED, AND THIS BLOCK EXISTS BECAUSE
 * SABOTAGE FOUND IT MISSING.** Adding `"GET"` to `JUDGED_METHODS` passed every
 * other arm in this file green — and it is the worst change anybody could make
 * here:
 *
 *  - **the Google entry dies.** A *Sign in with Google* link clicked from
 *    anywhere is a top-level navigation the browser reports as `cross-site`;
 *    `googleAuthRouter` is GET-only and that is a customer arriving.
 *  - **every verification email dies.** `GET /verify-email` is reached by
 *    clicking a link in a mail client, which is as cross-site as it gets — and it
 *    is one of invariant 9's five mint sites, so refusing it would make accounts
 *    unverifiable.
 *
 * The subject here is the middleware's method filter, so it is driven on a bare
 * router rather than through the verification machinery: the question is *which
 * methods are judged*, and a route's own internals cannot make that clearer.
 */
describe("the method filter — a cross-site GET is a customer, not an attack", () => {
  async function driveBare(method: "GET" | "POST"): Promise<number> {
    const app = express();
    const router = express.Router();
    router.use(refuseCrossSiteAuthRequest);
    router.get("/probe", (_req, res) => { res.json({ ok: true }); });
    router.post("/probe", (_req, res) => { res.json({ ok: true }); });
    app.use("/api/auth", router);
    const server = await listenOnFetchablePort((port) => app.listen(port, "127.0.0.1"));
    try {
      const response = await fetch(`${baseUrlOf(server)}/api/auth/probe`, {
        method,
        /* The browser's own word, and the one signal a page cannot forge. If the
           guard judged this method, this header alone would refuse it. */
        headers: { "sec-fetch-site": "cross-site" },
      });
      return response.status;
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())));
    }
  }

  it("serves a cross-site GET — the Google entry and every verification link", async () => {
    expect(await driveBare("GET")).toBe(200);
  });

  it("refuses the same request as a POST, so the filter is the only difference", async () => {
    /* The pair is the point: one request shape, one header, two verbs, two
       answers. Either arm alone could pass for the wrong reason. */
    expect(await driveBare("POST")).toBe(403);
  });
});
