/**
 * THE CSP AND THE FRAME POLICY, DRIVEN IN BOTH REGIMES ON PURPOSE (#726).
 *
 * `securityHeaders.ts` captures two things at MODULE LOAD:
 *
 *   const isDev = process.env.NODE_ENV === "development";
 *   const r2PublicOrigin = (process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, "");
 *
 * and every directive that differs between dev and production is decided by the
 * first. Until this repair the suite never mentioned `NODE_ENV`, `R2_PUBLIC_URL`,
 * `vi.stubEnv` or `vi.resetModules` — it ran in whichever regime the machine
 * happened to be in, and its assertions had been softened, or split on the same
 * variable the product splits on, until they agreed with it:
 *
 *   · `it("should set X-Frame-Options to DENY in production")` whose body read
 *     `if (process.env.NODE_ENV === "development")` and asserted the OPPOSITE —
 *     an arm named for a regime, deciding for itself which one it was in;
 *   · `const expectedCount = isDev ? 8 : 9`, deriving its expectation from the
 *     same fact the product derives its behaviour from, so the two could never
 *     disagree;
 *   · three comments explaining what dev mode does, beside assertions written
 *     loosely enough to pass either way.
 *
 * ⚠ **AND THE CARD'S HEADLINE WAS WRONG IN THE OPPOSITE DIRECTION, WHICH IS
 * WORTH MORE THAN THE REPAIR.** #726 says *"the production regime is the one
 * nobody drives, and it is the only one that ships"*. Driven rather than
 * reasoned, before a line was rewritten: **vitest runs with `NODE_ENV="test"`**,
 * so `isDev` was already `false` and the suite has been exercising the
 * PRODUCTION branch all along. It is **dev** that nothing reached. The defect
 * the card names is real and the direction it names is not: the fault was never
 * *which* regime went undriven, it was that **the suite did not choose** — and a
 * machine with `NODE_ENV=development` in its environment would have flipped
 * every one of those arms to asserting the relaxation, silently.
 *
 * ⚠ **`r2PublicOrigin` DIFFERS BETWEEN THIS MACHINE AND CI TODAY, AND NOTHING
 * NOTICED.** `vitest.setup.ts` loads `.env`, so locally the bucket origin is
 * real; `gate.yml` sets no such variable and CI has no `.env`, so there it is
 * the empty string. The same suite therefore measured two different `img-src`
 * directives depending on where it ran, and asserted nothing about either.
 *
 * The repair is the one #724 used on `adminSecurity.test.ts`: a loader that
 * stubs the variables and re-imports through `vi.resetModules()`, and every
 * regime-dependent claim split into a dev arm and a production arm that each
 * assert their own regime and would fail in the other. Proven by sabotage of
 * the PRODUCT — `scripts/_726-securityheaders-sabotage-disposable.mts`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

/* The two PURE halves of the CSP, imported statically on purpose: they take the
   regime and the DSN as arguments, so unlike the middleware they do not read the
   module-load environment and need no `vi.resetModules()` dance. The arms that
   assert the SHIPPED header still go through `loadHeaders`. */
import { buildConnectSrc, sentryIngestOrigin } from "./securityHeaders";

/** The bucket origin the arms use — a real shape, never the machine's own. */
const BUCKET = "https://pub-0123456789abcdef.r2.dev";

/**
 * Loads the middleware fresh under a named regime.
 *
 * ⚠ **`vi.clearAllMocks()` IS NOT DECORATION AND #724 LEARNED IT THE HARD WAY.**
 * `vi.resetModules()` resets the module registry; it does NOT give you fresh
 * spies. Calls accumulate across arms, so an arm asserting a header was NOT set
 * can pass or fail on what the PREVIOUS arm did. Every arm here builds its own
 * `res`, which makes it moot — and the reset stays, because the next arm added
 * to this file will not know that.
 */
async function loadHeaders(env: {
  readonly nodeEnv: string;
  readonly r2?: string;
  readonly sentryDsn?: string;
}) {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", env.nodeEnv);
  vi.stubEnv("R2_PUBLIC_URL", env.r2 ?? "");
  /* ⚠ DEFAULTED EXPLICITLY, for the reason this file's header gives about
     `R2_PUBLIC_URL` (#509 part 1b). `vitest.setup.ts` loads `.env`, so a machine
     with a real `VITE_SENTRY_DSN` in it would measure a DIFFERENT `connect-src`
     from CI, which has no `.env` — the same suite silently asserting two
     different policies depending on where it runs. Every arm states its own. */
  vi.stubEnv("VITE_SENTRY_DSN", env.sentryDsn ?? "");
  const module = await import("./securityHeaders");
  return module;
}

/** Every header the middleware set, in one call, keyed by name. */
function headersFrom(middleware: (req: Request, res: Response, next: NextFunction) => void) {
  const headers: Record<string, string> = {};
  const setHeader = vi.fn((key: string, value: string) => {
    headers[key] = value;
  });
  const res = { setHeader } as unknown as Response;
  const next: NextFunction = vi.fn();
  middleware({ path: "/" } as unknown as Request, res, next);
  return { headers, calls: setHeader.mock.calls.length, next };
}

const PRODUCTION = { nodeEnv: "production", r2: BUCKET } as const;
const DEVELOPMENT = { nodeEnv: "development", r2: BUCKET } as const;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the PRODUCTION regime — the only one that ships", () => {
  let headers: Record<string, string>;
  let calls: number;

  beforeEach(async () => {
    const { securityHeaders } = await loadHeaders(PRODUCTION);
    ({ headers, calls } = headersFrom(securityHeaders));
  });

  it("refuses framing outright — X-Frame-Options DENY", () => {
    expect(headers["X-Frame-Options"]).toBe("DENY");
  });

  it("⚠ and says the same thing in the CSP, which is the directive browsers actually honour", () => {
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(headers["Content-Security-Policy"]).not.toContain("frame-ancestors *");
  });

  it("⚠ carries NO 'unsafe-inline' and NO 'unsafe-eval' in script-src — the dev relaxation must not ship", () => {
    const scriptSrc = /script-src [^;]*/.exec(headers["Content-Security-Policy"]!)?.[0] ?? "";
    expect(scriptSrc).not.toContain("unsafe-inline");
    expect(scriptSrc).not.toContain("unsafe-eval");
    /* The one inline script the app ships is allowed BY HASH instead — without
       it every cold load flashes the wrong theme. */
    expect(scriptSrc).toMatch(/'sha256-[A-Za-z0-9+/=]+'/);
  });

  it("opens no WebSocket origin — the HMR allowance is dev-only", () => {
    expect(headers["Content-Security-Policy"]).not.toContain("ws://");
  });

  it("sets all NINE headers", () => {
    expect(calls).toBe(9);
  });
});

describe("the DEVELOPMENT regime — relaxed deliberately, and now driven", () => {
  let headers: Record<string, string>;
  let calls: number;

  beforeEach(async () => {
    const { securityHeaders } = await loadHeaders(DEVELOPMENT);
    ({ headers, calls } = headersFrom(securityHeaders));
  });

  it("skips X-Frame-Options entirely", () => {
    expect(headers["X-Frame-Options"]).toBeUndefined();
  });

  it("allows framing in the CSP too", () => {
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors *");
  });

  it("allows the inline and eval scripts Vite's HMR needs", () => {
    const scriptSrc = /script-src [^;]*/.exec(headers["Content-Security-Policy"]!)?.[0] ?? "";
    expect(scriptSrc).toContain("'unsafe-inline'");
    expect(scriptSrc).toContain("'unsafe-eval'");
  });

  it("allows the HMR WebSocket", () => {
    expect(headers["Content-Security-Policy"]).toContain("ws://localhost:*");
  });

  it("sets EIGHT headers — one fewer, and it is the framing one", () => {
    expect(calls).toBe(8);
  });
});

/**
 * THE BUCKET ORIGIN — the half that is not about `NODE_ENV` at all.
 *
 * `CLAUDE.md` names this origin explicitly: served image URLs are public bucket
 * URLs persisted in database rows, and `img-src` is what lets the app render
 * them. A suite that never set the variable could not tell a policy carrying
 * the bucket from one carrying an empty string — and on CI it WAS the empty
 * string, because there is no `.env` there.
 */
describe("the R2 bucket reaches img-src, and a blank variable degrades cleanly", () => {
  it("puts the configured origin into img-src", async () => {
    const { securityHeaders } = await loadHeaders(PRODUCTION);
    const { headers } = headersFrom(securityHeaders);
    const imgSrc = /img-src [^;]*/.exec(headers["Content-Security-Policy"]!)?.[0] ?? "";
    expect(imgSrc).toContain(BUCKET);
  });

  it("strips a trailing slash rather than emitting a broken origin", async () => {
    const { securityHeaders } = await loadHeaders({ nodeEnv: "production", r2: `${BUCKET}///` });
    const { headers } = headersFrom(securityHeaders);
    const imgSrc = /img-src [^;]*/.exec(headers["Content-Security-Policy"]!)?.[0] ?? "";
    expect(imgSrc).toContain(`${BUCKET} `);
    expect(imgSrc).not.toContain(`${BUCKET}/`);
  });

  it("⚠ CONTROL — a blank variable leaves no empty entry and no doubled space", async () => {
    const { securityHeaders } = await loadHeaders({ nodeEnv: "production", r2: "" });
    const { headers } = headersFrom(securityHeaders);
    const imgSrc = /img-src [^;]*/.exec(headers["Content-Security-Policy"]!)?.[0] ?? "";
    /* This is the state CI has been running in all along. It is fine — but
       nothing said so, and "fine" was a coincidence of a `.replace` rather than
       a fact anybody had checked. */
    expect(imgSrc).not.toMatch(/\s{2,}/);
    expect(imgSrc).not.toContain("undefined");
    expect(imgSrc).toContain("'self' data: blob: https://*.amazonaws.com");
  });
});

/**
 * The regime-independent headers. These were the arms that were always sound —
 * they are kept, and moved under a heading that says they make no claim about
 * which regime they ran in, because they hold in both.
 */
describe("the headers that do not depend on the regime", () => {
  for (const [name, regime] of [["production", PRODUCTION], ["development", DEVELOPMENT]] as const) {
    describe(`in ${name}`, () => {
      let headers: Record<string, string>;
      let next: NextFunction;

      beforeEach(async () => {
        const { securityHeaders } = await loadHeaders(regime);
        ({ headers, next } = headersFrom(securityHeaders));
      });

      it("calls next() to continue the chain", () => {
        expect(next).toHaveBeenCalledOnce();
      });

      it("forces HTTPS for a year, including subdomains", () => {
        expect(headers["Strict-Transport-Security"]).toBe("max-age=31536000; includeSubDomains");
      });

      it("sets the five fixed hardening headers", () => {
        expect(headers["X-Content-Type-Options"]).toBe("nosniff");
        expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
        expect(headers["X-XSS-Protection"]).toBe("1; mode=block");
        expect(headers["X-DNS-Prefetch-Control"]).toBe("off");
        expect(headers["X-Permitted-Cross-Domain-Policies"]).toBe("none");
      });

      it("closes the sensitive browser APIs and leaves payment for Stripe", () => {
        expect(headers["Permissions-Policy"]).toContain("camera=()");
        expect(headers["Permissions-Policy"]).toContain("microphone=()");
        expect(headers["Permissions-Policy"]).toContain("geolocation=()");
        expect(headers["Permissions-Policy"]).toContain("payment=(self)");
      });

      it("carries the CSP's fixed directives", () => {
        const csp = headers["Content-Security-Policy"]!;
        expect(csp).toContain("default-src 'self'");
        expect(csp).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
        expect(csp).toContain("font-src 'self' https://fonts.gstatic.com");
        expect(csp).toContain("object-src 'none'");
        expect(csp).toContain("base-uri 'self'");
        expect(csp).toContain("form-action 'self'");
      });

      it("lets Stripe load, connect and frame", () => {
        const csp = headers["Content-Security-Policy"]!;
        expect(csp).toMatch(/script-src[^;]*https:\/\/js\.stripe\.com/);
        expect(csp).toContain("https://api.stripe.com");
        expect(csp).toContain("frame-src 'self' https://js.stripe.com https://hooks.stripe.com");
      });

      it("keeps the Manus remnant hosts and none of the retired one", () => {
        const csp = headers["Content-Security-Policy"]!;
        /* CLAUDE.md's one intentional remnant: old database rows still point at
           these, and they go when the storage URLs are migrated. */
        expect(csp).toContain("https://files.manuscdn.com");
        expect(csp).toContain("https://*.cloudfront.net");
        expect(csp).toContain("https://*.amazonaws.com");
        expect(csp).not.toContain("manus.storage");
      });
    });
  }
});

/**
 * THE ERROR TRACKER'S INGEST HOST (#509 part 1b).
 *
 * The browser SDK posts its envelopes to the origin inside `VITE_SENTRY_DSN`. If
 * `connect-src` does not name that origin the browser blocks every send, and the
 * only evidence is a CSP violation in a console nobody is reading — an error
 * tracker that reports nothing while every other reading says it is wired.
 *
 * ⚠ **Both halves of the pair are driven, and the SECOND is the one that matters
 * more**: the host appears when a DSN is set, and NOTHING is added when it is
 * absent or unparseable. A policy that widens on a typo is worse than one that
 * blocks, because the typo also stops the reporter from starting — so the
 * widening would buy an attacker a destination and buy the product nothing.
 */
describe("connect-src carries the tracker's ingest origin, derived from the DSN", () => {
  const DSN = "https://publickey@o4507.ingest.de.sentry.io/4507";
  const INGEST = "https://o4507.ingest.de.sentry.io";

  it("derives the origin, and only the origin, from a real DSN", () => {
    expect(sentryIngestOrigin(DSN)).toBe(INGEST);
    /* The public key and the project path must not reach a CSP directive. */
    expect(sentryIngestOrigin(DSN)).not.toContain("publickey");
    expect(sentryIngestOrigin(DSN)).not.toContain("4507/");
  });

  it("⚠ answers null for absent, blank, unparseable and non-https values", () => {
    expect(sentryIngestOrigin(undefined)).toBeNull();
    expect(sentryIngestOrigin("")).toBeNull();
    expect(sentryIngestOrigin("   ")).toBeNull();
    expect(sentryIngestOrigin("not a url at all")).toBeNull();
    expect(sentryIngestOrigin("o4507.ingest.de.sentry.io/4507")).toBeNull();
    expect(sentryIngestOrigin("http://o4507.ingest.de.sentry.io/4507")).toBeNull();
    expect(sentryIngestOrigin("javascript:alert(1)")).toBeNull();
    expect(sentryIngestOrigin("data:text/html,x")).toBeNull();
  });

  it("builds the directive with the host in production, and adds nothing without a DSN", () => {
    expect(buildConnectSrc(false, DSN)).toBe(`connect-src 'self' https://api.stripe.com ${INGEST}`);
    expect(buildConnectSrc(false, undefined)).toBe("connect-src 'self' https://api.stripe.com");
    expect(buildConnectSrc(false, "nonsense")).toBe("connect-src 'self' https://api.stripe.com");
  });

  it("keeps the dev WebSocket allowance beside it, and only in dev", () => {
    expect(buildConnectSrc(true, DSN)).toBe(
      `connect-src 'self' https://api.stripe.com ${INGEST} ws://localhost:* ws://127.0.0.1:*`,
    );
    expect(buildConnectSrc(false, DSN)).not.toContain("ws://");
  });

  it("⚠ reaches the SHIPPED header, not only the helper", async () => {
    const { securityHeaders } = await loadHeaders({ ...PRODUCTION, sentryDsn: DSN });
    const { headers } = headersFrom(securityHeaders);
    const connect = /connect-src [^;]*/.exec(headers["Content-Security-Policy"]!)?.[0] ?? "";
    expect(connect).toContain(INGEST);
    expect(connect).toContain("'self'");
    expect(connect).toContain("https://api.stripe.com");
  });

  it("⚠ and the shipped header names no Sentry host when no DSN is set", async () => {
    const { securityHeaders } = await loadHeaders(PRODUCTION);
    const { headers } = headersFrom(securityHeaders);
    expect(headers["Content-Security-Policy"]).not.toContain("sentry.io");
  });
});
