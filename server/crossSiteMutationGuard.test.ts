import path from "node:path";
import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";

import { judgeRequestOrigin } from "./security/crossSiteGuard";
import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";
import { readListedSource } from "./testing/listedSource";
import { withoutComments } from "./testing/withoutComments";

/* Reading source off the real tree inside vitest's 5s default goes red under
   load on somebody's machine rather than in CI (#741), so the class's timeout
   is declared at file level. This suite joined that population the moment it
   swapped a hand-rolled comment regex for `readListedSource` — which is the
   whole shape of "a fix can move a suite into another guard": the first fix was
   right and it needed this line to be finished. */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

/**
 * THE CROSS-SITE REFUSAL, DRIVEN — #1653.
 *
 * The defect: the production session cookie was issued `SameSite=None`, so a
 * browser attached it to requests made by other sites, and `/api/trpc` refused
 * nothing on that basis. `billing.createPortalSession`,
 * `billing.cancelSubscription` and `auth.logout` take **no input**, so a forged
 * POST needs no body — and a POST with no body and no `Content-Type` is a CORS
 * *simple* request, which means there is no preflight to fail.
 *
 * # Why the arms are in two halves, and why the second half is the one that counts
 *
 * The pure half drives `judgeRequestOrigin` over every branch, which is cheap
 * and complete. ⚠ **It is also exactly the shape that can go green while the
 * product is wide open**, because a perfect judgement nobody calls is invariant
 * 7 — and this repository has four recorded instances of precisely that. So the
 * second half calls the REAL `appRouter` and asserts on the REAL procedures,
 * and its decisive arm is not the error code: it is that **`auth.logout`'s
 * cookie was never cleared**. The side effect is the attack, so the side effect
 * not happening is the proof (working law 3: drive the guard directly).
 *
 * The positive control beside it is the half that makes the refusal mean
 * something — the same call from our own origin still runs and still clears the
 * cookie. Without it, every arm here would pass just as well over a guard that
 * refused everything, which is a product nobody can use.
 */

/* ─── the pure judgement ─── */

describe("judgeRequestOrigin — the browser's own answer, when it gives one", () => {
  it("REFUSES a request the browser itself calls cross-site", () => {
    const verdict = judgeRequestOrigin({ "sec-fetch-site": "cross-site", host: "klieglabs.com" });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toContain("Sec-Fetch-Site");
  });

  it("allows same-origin, and needs no hostname to do it", () => {
    // The point of this signal: no allowlist, no constant, nothing to keep in
    // step with whichever domain the service is answering on today.
    expect(judgeRequestOrigin({ "sec-fetch-site": "same-origin" }).allowed).toBe(true);
    expect(judgeRequestOrigin({ "sec-fetch-site": "none" }).allowed).toBe(true);
  });

  it("reads the header case-insensitively", () => {
    expect(judgeRequestOrigin({ "sec-fetch-site": "Cross-Site", host: "a.com" }).allowed).toBe(false);
  });

  it("⚠ still refuses a SAME-SITE sibling subdomain, because that is a real vector", () => {
    /* `Sec-Fetch-Site: same-site` means a different origin under the same
       registrable domain. A cookie is attached by DESTINATION, not by the
       origin doing the asking — so a page on `evil.klieglabs.com` POSTing to
       `klieglabs.com` carries OUR cookie. Signal 1 waves it through; signal 2
       is why it is refused, and it is why the two are not an `else`. */
    const verdict = judgeRequestOrigin({
      "sec-fetch-site": "same-site",
      origin: "https://evil.klieglabs.com",
      host: "klieglabs.com",
    });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toContain("evil.klieglabs.com");
  });
});

describe("judgeRequestOrigin — Origin against the request's own host", () => {
  it("REFUSES a foreign origin when the browser sent no Sec-Fetch-Site", () => {
    // The Safari-below-16.4 road: no fetch metadata, so the comparison is all
    // there is. An attacker's page cannot suppress `Origin`.
    const verdict = judgeRequestOrigin({ origin: "https://attacker.example", host: "klieglabs.com" });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toContain("attacker.example");
  });

  it("allows our own origin — on the Railway domain, which is where customers actually are", () => {
    /* ⚠ THE ARM THAT WOULD HAVE CAUGHT THE OBVIOUS WRONG FIX. An allowlist
       built from `PRODUCTION_APP_ORIGIN` (`https://klieglabs.com`) would refuse
       this, and this is the host the live service answers on — a total outage
       on every mutation in the product. */
    const verdict = judgeRequestOrigin({
      origin: "https://drape-production-0232.up.railway.app",
      host: "drape-production-0232.up.railway.app",
    });
    expect(verdict.allowed).toBe(true);
  });

  it("allows localhost with its port, and refuses a different port on the same host", () => {
    expect(
      judgeRequestOrigin({ origin: "http://localhost:3000", host: "localhost:3000" }).allowed,
    ).toBe(true);
    // A separate origin by the same-origin rule, and a real one: a stray vite
    // dev server on 5173 is not this app.
    expect(
      judgeRequestOrigin({ origin: "http://localhost:5173", host: "localhost:3000" }).allowed,
    ).toBe(false);
  });

  it("matches the host case-insensitively", () => {
    expect(judgeRequestOrigin({ origin: "https://KliegLabs.com", host: "klieglabs.com" }).allowed).toBe(true);
  });

  it("accepts the host a trusted proxy forwarded", () => {
    // Railway rewrites `Host`; `configureTrustedProxy` is why express trusts
    // one hop, and the check has to agree with it or every request is refused.
    const verdict = judgeRequestOrigin({
      origin: "https://klieglabs.com",
      host: "drape.railway.internal",
      "x-forwarded-host": "klieglabs.com",
    });
    expect(verdict.allowed).toBe(true);
  });

  it("takes the FIRST hop of a forwarded host list", () => {
    expect(
      judgeRequestOrigin({
        origin: "https://klieglabs.com",
        host: "internal",
        "x-forwarded-host": "klieglabs.com, proxy.internal",
      }).allowed,
    ).toBe(true);
  });

  it("reads the FIRST value of a repeated header, so a smuggled second one buys nothing", () => {
    // A repeated header arrives as an array. A check that treated it as a
    // string would compare against `undefined` on exactly the request shaped to
    // confuse it, and `undefined` is the allow road.
    const verdict = judgeRequestOrigin({
      origin: ["https://attacker.example", "https://klieglabs.com"],
      host: "klieglabs.com",
    });
    expect(verdict.allowed).toBe(false);
  });
});

describe("judgeRequestOrigin — the edges, and which way each one fails", () => {
  it("ALLOWS a request carrying neither header — the non-browser road, deliberately", () => {
    /* CSRF is a browser-only attack: a caller that sends no `Origin` is not a
       browser and has no ambient cookie to borrow. Refusing this would break
       every non-browser caller and every HTTP test in the tree to buy nothing. */
    const verdict = judgeRequestOrigin({ host: "klieglabs.com" });
    expect(verdict.allowed).toBe(true);
    expect(judgeRequestOrigin({}).allowed).toBe(true);
  });

  it("REFUSES an opaque `Origin: null` — a sandboxed iframe or a data: document", () => {
    const verdict = judgeRequestOrigin({ origin: "null", host: "klieglabs.com" });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toContain("opaque");
  });

  it("REFUSES an Origin that is not a URL, rather than letting the parse failure read as a match", () => {
    expect(judgeRequestOrigin({ origin: "not a url", host: "klieglabs.com" }).allowed).toBe(false);
  });

  it("REFUSES an Origin with no Host to compare it against — fail CLOSED", () => {
    // There is nothing to match, so the only two answers are "refuse" and "the
    // absence of the comparison allowed it". The second is the fail-open shape
    // this repository has paid for before.
    const verdict = judgeRequestOrigin({ origin: "https://klieglabs.com" });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toContain("no Host");
  });

  it("treats an empty Origin as absent rather than as a mismatch", () => {
    expect(judgeRequestOrigin({ origin: "", host: "klieglabs.com" }).allowed).toBe(true);
  });
});

/* ─── driven through the REAL router and the REAL procedures ─── */

/**
 * A signed-in, approved customer — the COMPLETE row, on `auth.me.test.ts`'s
 * pattern rather than a cast.
 *
 * ⚠ The nearby `auth.logout.test.ts` fixture declares ten fields and compiles,
 * which is misleading: that file is one of the 88 named exclusions in
 * `tsconfig.server-tests.json`, so nothing typechecks it. This suite is inside
 * the checked set and stays there — the exclusion list only ever shrinks
 * (`server/serverTestsTypecheckProject.test.ts`), and a new security suite
 * buying its way onto it would be the wrong direction entirely.
 */
function aCustomer(): User {
  const now = new Date("2026-10-01T00:00:00.000Z");
  return {
    id: 1,
    openId: "cross-site-fixture",
    name: "A Customer",
    displayName: null,
    email: "fixture@example.com",
    avatarUrl: null,
    avatarKey: null,
    bannerUrl: null,
    bannerKey: null,
    bio: null,
    loginMethod: "email",
    approved: true,
    role: "user",
    storageUsed: 0,
    storageLimit: 1024,
    suspendedAt: null,
    suspendedReason: null,
    suspendedBy: null,
    frozenAt: null,
    frozenReason: null,
    frozenBy: null,
    referralCode: "CROSS-SITE",
    referredByUserId: null,
    accessCode: null,
    approvedAt: now,
    passwordHash: "fixture-hash",
    authProvider: "email",
    emailVerified: true,
    emailVerificationToken: null,
    emailVerificationExpiresAt: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    canvasIntroSeen: true,
    followHintSeen: true,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}

/** A signed-in customer's context, with the headers the request arrived with. */
function contextFrom(headers: Record<string, string>) {
  const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];
  const ctx = {
    user: aCustomer(),
    req: { protocol: "https", headers } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
    correlationId: "cross-site-fixture",
  } as TrpcContext;
  return { caller: appRouter.createCaller(ctx), clearedCookies };
}

/** The forged request: a page on another site, a POST, her cookie attached. */
const FORGED = {
  host: "drape-production-0232.up.railway.app",
  origin: "https://attacker.example",
  "sec-fetch-site": "cross-site",
};

/** The same request from her own tab — the positive control. */
const OURS = {
  host: "drape-production-0232.up.railway.app",
  origin: "https://drape-production-0232.up.railway.app",
  "sec-fetch-site": "same-origin",
};

describe("a forged cross-site mutation, through the real appRouter (#1653)", () => {
  it("⚠ REFUSES auth.logout AND DOES NOT CLEAR THE COOKIE — the side effect is the attack", async () => {
    const { caller, clearedCookies } = contextFrom(FORGED);

    await expect(caller.auth.logout()).rejects.toMatchObject({ code: "FORBIDDEN" });
    /* This is the arm that matters. An error code proves a middleware threw; an
       uncleared cookie proves the product did not act on a stranger's
       instruction. */
    expect(clearedCookies).toEqual([]);
  });

  it("and the SAME call from our own origin still logs her out (the positive control)", async () => {
    // Without this, every arm in this file would pass over a guard that refused
    // everything — which is a product nobody can sign out of either.
    const { caller, clearedCookies } = contextFrom(OURS);

    await expect(caller.auth.logout()).resolves.toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
  });

  it("REFUSES billing.cancelSubscription before it reads her subscription", async () => {
    const { caller } = contextFrom(FORGED);
    await expect(caller.billing.cancelSubscription()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("REFUSES billing.createPortalSession the same way", async () => {
    const { caller } = contextFrom(FORGED);
    await expect(caller.billing.createPortalSession()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("gets PAST the guard on the two billing calls from our own origin", async () => {
    /* The positive control for the two arms above, and it cannot assert success:
       both procedures read the database, and `vitest.setup.ts` strips
       `DATABASE_URL` so no suite can reach one. What it CAN prove is the thing
       in question — that the refusal above was the guard and not the absence of
       a subscription — by showing the failure is no longer `FORBIDDEN` with the
       guard's own cause on it. */
    const { caller } = contextFrom(OURS);
    const outcome = await caller.billing.cancelSubscription().then(
      () => null,
      (error: unknown) => error,
    );
    const code = outcome instanceof TRPCError ? outcome.code : undefined;
    const cause = outcome instanceof TRPCError ? String(outcome.cause?.message ?? "") : "";
    expect(cause).not.toContain("cross-site mutation refused");
    expect(code).not.toBe("FORBIDDEN");
  });

  it("does NOT refuse a caller with no HTTP request at all — the ceremony road", async () => {
    /* ⚠ THE ARM FOR THE DEFECT `pnpm preflight` CAUGHT IN THIS CHANGE. The
       first draft read `ctx.req.headers` outright, and every suite and ceremony
       that builds a context by hand — `createCaller` with no `req`, which
       `scripts/ceremony-r7-founder-evidence.mts` does twice — got a TypeError
       out of a security control. Four directories of mutation suites went red.
       A caller that is not an HTTP request has no browser and so no cookie to
       borrow, which is the same ground on which a headerless request is
       allowed. */
    const ctx = {
      user: aCustomer(),
      /* `{ headers: {}, socket: {} }` is the shape most fixtures in this tree
         actually use (`server/changeRequests.test.ts` and twenty others), so
         the arm is written against the real population rather than an invented
         one. `auth.logout` reads `req.protocol` itself, which is undefined
         here and fine — only a missing `req` crashed it. */
      req: { headers: {}, socket: {} } as unknown as TrpcContext["req"],
      res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
      correlationId: "no-request-fixture",
    } as unknown as TrpcContext;
    await expect(appRouter.createCaller(ctx).auth.logout()).resolves.toEqual({ success: true });
  });

  it("does NOT refuse a cross-site QUERY — the stated non-scope", async () => {
    /* CORS already stops an attacker reading a response, so a forged read
       changes nothing and leaks nothing. Refusing queries would be a behaviour
       change with no finding behind it, and this arm is what keeps a later
       tightening from being a silent one. */
    const { caller } = contextFrom(FORGED);
    await expect(caller.credits.getCosts()).resolves.toBeDefined();
  });

  it("refuses a cross-site mutation on a PUBLIC procedure too", async () => {
    // `publicProcedure` is the base every other builder derives from, so the
    // check reaches the public mutations as well — `newsletter.subscribe` and
    // `waitlist.join` are state-changing even without a session.
    const { caller } = contextFrom(FORGED);
    await expect(caller.newsletter.subscribe({ email: "a@example.com" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("says what was refused and what to do, and names no machinery", async () => {
    // The disappearing-technology law's wording clause: a refusal on a path
    // someone walks carries no header name, no procedure id, no pipeline term.
    const { caller } = contextFrom(FORGED);
    const message = await caller.auth.logout().then(
      () => "",
      (error: unknown) => (error instanceof TRPCError ? error.message : ""),
    );
    expect(message).toContain("try again");
    expect(message).not.toMatch(/Origin|Sec-Fetch|cookie|SameSite|tRPC/i);
  });
});

/* ─── the composition, which is what makes the refusal structural ─── */

describe("every procedure in the product is built on the guarded base", () => {
  /* `readListedSource` and `withoutComments` are the house readers, used rather
     than a regex of this suite's own: #1629 measured eight hand-rolled
     line-comment strippers reading 283 files SHORT, because a bare `//`
     truncates at the scheme inside a URL string, and
     `server/commentStripperShape.test.ts` reddens on a new one. It caught this
     suite's first draft, which is the guard working exactly as intended. */
  const read = (...parts: string[]) => readListedSource(path.join(__dirname, ...parts)) ?? "";
  const trpcSource = read("_core", "trpc.ts");
  const cookieSource = read("_core", "cookies.ts");

  it("spells `t.procedure` exactly once — the one guarded base", () => {
    /* ⚠ THIS IS THE ARM THAT STOPS THE QUIET REGRESSION. A sixth builder
       declared as `t.procedure.use(…)` would be a namespace of unguarded
       mutations, and nothing else in the tree could see it: the procedures
       would work, every other suite would stay green, and the hole would be
       back. Comments naming the symbol are stripped so the docblock that
       explains this rule cannot satisfy it. */
    const code = withoutComments(trpcSource);
    const uses = [...code.matchAll(/\bt\.procedure\b/g)];
    expect(uses).toHaveLength(1);
    expect(code).toMatch(/const baseProcedure = t\.procedure\.use\(refuseCrossSiteMutation\)/);
  });

  it("derives all five exported builders from it", () => {
    const builders = [...trpcSource.matchAll(/export const (\w+Procedure) = (\w+)/g)].map(
      (match) => [match[1], match[2]] as const,
    );
    // Derived from the source rather than listed here: a sixth export arrives
    // in this population automatically instead of being quietly uncovered.
    expect(builders.length).toBeGreaterThanOrEqual(5);
    for (const [name, base] of builders) {
      expect(base, `${name} must be built on baseProcedure`).toBe("baseProcedure");
    }
  });

  it("the session cookie never says `none` again", () => {
    // #1653's primary repair, pinned at the source as well as on the wire (the
    // wire arms are in `routes/googleAuth.test.ts` and `auth.logout.test.ts`).
    const code = withoutComments(cookieSource);
    expect(code).toMatch(/sameSite:\s*"lax"/);
    expect(code).not.toMatch(/"none"/);
  });
});
