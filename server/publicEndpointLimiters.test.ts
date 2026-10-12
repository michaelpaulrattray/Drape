/**
 * #2409 — EVERY PUBLIC tRPC ENDPOINT IS DRIVEN UNTIL IT REFUSES.
 *
 * CLAUDE.md, access-control invariant 5: *"Public endpoints are an enumerated
 * allowlist. Each is rate-limited …"*. The LIST half is pinned by
 * `server/architecturePublicEndpoints.test.ts`. The "each is rate-limited" half
 * was pinned by nothing: three public endpoints had no limiter until #2404, and
 * a fourteenth public procedure with no limiter would have shipped green.
 *
 * THE POPULATION IS DERIVED, never typed here (working law 4). It is the
 * Atlas's `public-endpoint` findings, read the same way the allowlist guard
 * reads them, and that guard already ties those findings to CLAUDE.md's
 * sentence AND to a second reader over the router sources. So a new public
 * procedure lands in this population without anyone remembering this file.
 *
 * EACH MEMBER IS DRIVEN, NOT GREPPED. A call goes through the REAL `appRouter`
 * (`createCaller`, the real middleware chain), from one address, until it is
 * refused with `TOO_MANY_REQUESTS` or a ceiling of calls passes. Then a SECOND
 * address must still be let in. So the guard can tell four things apart:
 *
 *   limited             refused within the ceiling, per address    — passes
 *   unlimited           never refused within the ceiling           — red
 *   refuses everyone    the very first call is refused             — red
 *   not per address     a fresh address is refused too             — red
 *
 * Only the outside world is stubbed: the Klaviyo sync, and `fetch` as a net
 * under it. The database is the unit-test one (`vitest.setup.ts` strips
 * `DATABASE_URL`), so a call past the limiter may answer or may fail on the
 * missing database. Either way it was LET IN, and letting in is the only thing
 * this guard asks about. Every limiter in the tree runs before its read.
 *
 * ⚠ SIX PUBLIC ENDPOINTS HAVE NO LIMITER TODAY, measured by this guard on its
 * first run. They are `KNOWN_UNLIMITED` below, each with what it does per call.
 * This card adds the guard and changes no product code, so they are listed and
 * not fixed. The list ONLY SHRINKS: a debt that starts refusing reddens until
 * its line is deleted, so it cannot stay on the list after it is paid.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TRPCError } from "@trpc/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("./klaviyo", async () => {
  const actual = await vi.importActual<typeof import("./klaviyo")>("./klaviyo");
  return {
    ...actual,
    newsletterSignup: vi.fn(async () => ({ success: true, isNew: true })),
  };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { publicProcedure, router } from "./_core/trpc";
import { checkRateLimit, getClientIp } from "./security/rateLimit";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * How many calls one address may make before an endpoint counts as unlimited.
 * The most generous limiter today is `announcements.getActive` at 120 a minute;
 * this leaves room for a deliberately generous one without letting "no limiter
 * at all" pass. A limiter set above it reads as unlimited and the message says
 * so, which is the honest answer: past this, the limit protects nothing.
 */
const DRIVE_CEILING = 400;

/**
 * KNOWN DEBTS: public endpoints that do not call a limiter today. Each was read
 * at its source on 2026-10-12. The card allows `auth.me`/`auth.logout` as
 * exceptions only if the reader agrees; none of the six is ruled an exception
 * here. They wait for that decision, on the card.
 */
const KNOWN_UNLIMITED: Record<string, string> = {
  "auth.me": "returns the session's own projection; no read beyond the per-request session lookup (server/routes/auth.ts)",
  "auth.logout": "clears the session cookie; no read (server/routes/auth.ts)",
  "billing.getPlans": "maps constants into the plan ladder; no read (server/routes/billing.ts)",
  "credits.getCosts": "returns the CREDIT_COSTS constant (server/routes/credits.ts)",
  "generation.costs": "returns the CREDIT_COSTS constant (server/routes/generation/castingExport.ts)",
  "system.health": "returns { ok: true } (server/_core/systemRouter.ts)",
};

/**
 * HOW to call each member — never WHICH members there are. The population comes
 * from the Atlas; this only supplies a valid input, and the arm below refuses a
 * member with no entry (a new public endpoint) and an entry with no member (a
 * retired one), so this table cannot quietly stand in for the population.
 */
const INPUTS: Record<string, unknown> = {
  "access.validate": { code: "NOT-A-REAL-CODE" },
  "announcements.getActive": undefined,
  "auth.logout": undefined,
  "auth.me": undefined,
  "billing.getPlans": undefined,
  "creationCheck.lookup": { kliegId: "KLG-0000-0000" },
  "credits.getCosts": undefined,
  "generation.costs": undefined,
  "newsletter.subscribe": { email: "limiter-guard@example.com" },
  "referral.validate": { code: "DRAPE-ABC123" },
  "system.health": { timestamp: 0 },
  "waitlist.getStats": undefined,
  "waitlist.join": { email: "limiter-guard@example.com" },
};

/** The Atlas's own extraction, one finding per public procedure — the allowlist guard's source. */
function atlasPublicEndpoints(): string[] {
  const atlas = JSON.parse(
    readFileSync(path.join(repoRoot, "docs/architecture/drape-architecture.json"), "utf8"),
  ) as { findings: { kind: string; subject: string }[] };
  return atlas.findings
    .filter((finding) => finding.kind === "public-endpoint")
    .map((finding) => finding.subject.replace(/^route:/, ""))
    .sort();
}

let ipSeq = 0;
/** A fresh documentation-range address per drive, so no arm inherits another's window. */
function freshIp(): string {
  ipSeq += 1;
  return `198.51.${Math.floor(ipSeq / 250)}.${(ipSeq % 250) + 1}`;
}

function contextFrom(ip: string): TrpcContext {
  return {
    user: null,
    req: { ip, protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as unknown as TrpcContext["res"],
  } as TrpcContext;
}

type Call = (ip: string) => Promise<unknown>;

/** A callable id walked down the real caller: `waitlist.join` → caller.waitlist.join(input). */
function callThroughAppRouter(id: string, input: unknown): Call {
  return (ip) => {
    let node: unknown = appRouter.createCaller(contextFrom(ip));
    for (const segment of id.split(".")) {
      node = (node as Record<string, unknown>)[segment];
      if (node === undefined) throw new Error(`appRouter has no ${id} — the Atlas and the router disagree`);
    }
    return (node as (i: unknown) => Promise<unknown>)(input);
  };
}

/** True when the call was refused for rate; false when it was let in, whatever it then answered. */
async function refusedForRate(call: Call, ip: string): Promise<boolean> {
  try {
    await call(ip);
    return false;
  } catch (err) {
    return err instanceof TRPCError && err.code === "TOO_MANY_REQUESTS";
  }
}

type Verdict =
  | { kind: "limited"; letIn: number }
  | { kind: "unlimited" }
  | { kind: "refuses-everyone" }
  | { kind: "not-per-address"; letIn: number };

/** Drive one address to refusal, then ask a second address. */
async function judge(call: Call): Promise<Verdict> {
  const ip = freshIp();
  if (await refusedForRate(call, ip)) return { kind: "refuses-everyone" };
  for (let letIn = 1; letIn < DRIVE_CEILING; letIn++) {
    if (await refusedForRate(call, ip)) {
      return (await refusedForRate(call, freshIp()))
        ? { kind: "not-per-address", letIn }
        : { kind: "limited", letIn };
    }
  }
  return { kind: "unlimited" };
}

beforeAll(() => {
  /* A net under the Klaviyo mock: nothing in this file may reach the network. */
  vi.stubGlobal("fetch", vi.fn(async () => {
    throw new Error("publicEndpointLimiters.test.ts made a network call");
  }));
});
afterAll(() => vi.unstubAllGlobals());

describe("the judge, proven able to fail (working law 2)", () => {
  /* Built from the SAME `publicProcedure` the product uses, so the real middleware runs. */
  const LIMIT = { windowMs: 60_000, maxRequests: 3, keyPrefix: "limiter_guard_control" };
  const controls = router({
    unlimited: publicProcedure.query(() => ({ ok: true })),
    limited: publicProcedure.query(({ ctx }) => {
      if (!checkRateLimit(getClientIp(ctx.req), LIMIT).allowed) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many requests." });
      }
      return { ok: true };
    }),
    constantKey: publicProcedure.query(() => {
      if (!checkRateLimit("everyone", { ...LIMIT, keyPrefix: "limiter_guard_constant" }).allowed) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many requests." });
      }
      return { ok: true };
    }),
    refusesAll: publicProcedure.query(() => {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many requests." });
    }),
    wrongCode: publicProcedure.query(() => {
      throw new TRPCError({ code: "FORBIDDEN", message: "no" });
    }),
  });
  const control = (name: keyof typeof controls._def.procedures): Call => (ip) =>
    (controls.createCaller(contextFrom(ip))[name] as () => Promise<unknown>)();

  it("NEGATIVE CONTROL: a public procedure with no limiter reads as unlimited", async () => {
    expect(await judge(control("unlimited"))).toEqual({ kind: "unlimited" });
  });

  it("POSITIVE CONTROL: a per-address limiter reads as limited, after exactly its budget", async () => {
    expect(await judge(control("limited"))).toEqual({ kind: "limited", letIn: 3 });
  });

  it("a limiter keyed on a constant is caught by the second address", async () => {
    expect((await judge(control("constantKey"))).kind).toBe("not-per-address");
  });

  it("a procedure that refuses everyone is not mistaken for a limiter", async () => {
    expect(await judge(control("refusesAll"))).toEqual({ kind: "refuses-everyone" });
  });

  it("another refusal code is not mistaken for a rate refusal", async () => {
    /* The guard counts TOO_MANY_REQUESTS only (invariant 6), so a 403 or a
       200 carrying an error field cannot pass for a limiter. */
    expect(await judge(control("wrongCode"))).toEqual({ kind: "unlimited" });
  });
});

describe("every public tRPC endpoint refuses with TOO_MANY_REQUESTS once over its limit (invariant 5)", () => {
  const population = atlasPublicEndpoints();

  it("the population is whole, and the call table neither adds to it nor misses a member", () => {
    /* Population first: an empty list would make every arm below vacuous. */
    expect(population.length).toBeGreaterThan(8);
    expect(
      Object.keys(INPUTS).sort(),
      "a public endpoint has no entry in INPUTS (add how to call it — the guard then drives it), or INPUTS names one the Atlas no longer finds public (delete it)",
    ).toEqual(population);
    for (const id of Object.keys(KNOWN_UNLIMITED)) {
      expect(population, `KNOWN_UNLIMITED names ${id}, which is no longer a public endpoint — delete the line`).toContain(id);
    }
  });

  for (const id of population) {
    if (id in KNOWN_UNLIMITED) {
      it(`${id}: a KNOWN DEBT — still unlimited, so the line stays (${KNOWN_UNLIMITED[id]})`, async () => {
        const verdict = await judge(callThroughAppRouter(id, INPUTS[id]));
        expect(
          verdict,
          `${id} now refuses — the debt is paid, so delete its KNOWN_UNLIMITED line and it joins the guarded population`,
        ).toEqual({ kind: "unlimited" });
      });
      continue;
    }
    it(`${id}: refuses one address within ${DRIVE_CEILING} calls and still lets a second address in`, async () => {
      const verdict = await judge(callThroughAppRouter(id, INPUTS[id]));
      expect(
        verdict.kind,
        `${id} is public and does not behave like a per-address limit (${JSON.stringify(verdict)}). Invariant 5 says every public endpoint is rate-limited.`,
      ).toBe("limited");
    });
  }
});
