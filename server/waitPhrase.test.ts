/**
 * "TRY AGAIN IN 1 MINUTES" — #1993, the class sweep behind #1962's frame.
 *
 * `Math.ceil(resetIn / 60000)` answers 1 for the whole last minute of every
 * window, so a hand-built "${n} minutes" says "1 minutes" for a fifth of a
 * five-minute refusal and for all of it when the customer comes back late.
 * Five sentences built that clause by hand; three were wrong three ways
 * ("1 minutes", "minute(s)", "1 seconds" / "0 seconds"). They all read
 * `waitPhrase` (`shared/waitPhrase.ts`) now.
 *
 * The card's own bar is that this is proven by DRIVING at the boundaries, not
 * by grepping for the string, so:
 *   1. the helper is driven at 0, 1 ms, exactly one unit, one unit + 1 ms, and
 *      the seconds→minutes crossover;
 *   2. every sentence-builder is driven through its real function — and the
 *      referral refusals and the lockout refusal through the REAL tRPC
 *      procedures, under a fake clock parked inside the last minute, which is
 *      the case that shipped broken;
 *   3. a derived sweep refuses a new hand-built unit clause anywhere in the
 *      product, with its reader driven both ways first (law 2).
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { waitPhrase, waitPhraseFromMinutes } from "../shared/waitPhrase";

vi.mock("./klaviyo", () => ({
  sendReferralInviteEmail: vi.fn(),
  createOrUpdateProfile: vi.fn(),
  trackEvent: vi.fn(),
}));
/* The `../db` barrel re-exports these from `./referrals`; mocking the declaring
   module intercepts them (the same list `referral-enhancements.test.ts` keeps). */
vi.mock("./db/referrals", () => ({
  expireStalePendingReferrals: vi.fn(),
  getOrCreateReferralCode: vi.fn(),
  getUserByReferralCode: vi.fn(),
  claimReferral: vi.fn(),
  redeemReferralCode: vi.fn(),
  completeReferral: vi.fn(),
  creditReferrerOnPaidAction: vi.fn(),
  getReferralCreditsEarned: vi.fn(),
  getReferralStats: vi.fn(),
  getReferralHistory: vi.fn(),
  recordEmailInvite: vi.fn(),
  isValidReferralCodeFormat: vi.fn(),
}));

import { referralRouter } from "./routes/referral";
import { exportRefusalMessage } from "./routes/account";
import { accountLockedMessage } from "./_core/trpc";
import { checkRateLimit, rateLimitError } from "./security/rateLimit";
import { readListedSource } from "./testing/listedSource";
import { withoutComments } from "./testing/withoutComments";
import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";

/* #741 — the sweep below walks server/, shared/ and client/src/. */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const MIN = 60_000;

/** Every way a wait clause has been wrong in this product. */
function expectSpoken(sentence: string) {
  expect(sentence).not.toMatch(/\b1 (minutes|seconds|hours)\b/);
  expect(sentence).not.toMatch(/\b0 (minute|second|hour)/);
  expect(sentence).not.toContain("(s)");
  expect(sentence).not.toMatch(/NaN|undefined|Infinity/);
}

describe("waitPhrase — the clause, driven at its boundaries", () => {
  it("minutes: one unit is a word, never '1'", () => {
    expect(waitPhrase(1)).toBe("in a minute");
    expect(waitPhrase(30_000)).toBe("in a minute");
    expect(waitPhrase(MIN)).toBe("in a minute");
    expect(waitPhrase(MIN + 1)).toBe("in 2 minutes");
    expect(waitPhrase(5 * MIN)).toBe("in 5 minutes");
    expect(waitPhrase(60 * MIN)).toBe("in 60 minutes");
  });

  it("a wait is never zero — an expired or garbage remainder is still one unit", () => {
    expect(waitPhrase(0)).toBe("in a minute");
    expect(waitPhrase(-5_000)).toBe("in a minute");
    expect(waitPhrase(Number.NaN)).toBe("in a minute");
    expect(waitPhrase(0, "second")).toBe("in a second");
    expect(waitPhrase(-1, "second")).toBe("in a second");
  });

  it("seconds under a minute, minutes from there", () => {
    expect(waitPhrase(1, "second")).toBe("in a second");
    expect(waitPhrase(1_000, "second")).toBe("in a second");
    expect(waitPhrase(1_001, "second")).toBe("in 2 seconds");
    expect(waitPhrase(14_000, "second")).toBe("in 14 seconds");
    expect(waitPhrase(59_000, "second")).toBe("in 59 seconds");
    expect(waitPhrase(59_001, "second")).toBe("in a minute");
    expect(waitPhrase(MIN, "second")).toBe("in a minute");
    expect(waitPhrase(MIN + 1, "second")).toBe("in 2 minutes");
  });

  it("from whole minutes (the login page's road)", () => {
    expect(waitPhraseFromMinutes(1)).toBe("in a minute");
    expect(waitPhraseFromMinutes(15)).toBe("in 15 minutes");
    expect(waitPhraseFromMinutes(0)).toBe("in a minute");
    expect(waitPhraseFromMinutes(Number("not-a-number"))).toBe("in a minute");
  });
});

describe("every sentence that names a wait reads the clause", () => {
  const samples = [0, 1, 999, 1_000, 1_001, 30_000, 59_999, MIN, MIN + 1, 2 * MIN, 5 * MIN, 61 * MIN];

  it("the GDPR export refusal", () => {
    expect(exportRefusalMessage(30_000)).toBe(
      "You can export your data once every 5 minutes. Try again in a minute.",
    );
    expect(exportRefusalMessage(4 * MIN)).toContain("Try again in 4 minutes.");
    for (const ms of samples) expectSpoken(exportRefusalMessage(ms));
  });

  it("the account-lockout refusal — no more 'minute(s)'", () => {
    expect(accountLockedMessage(30_000)).toBe(
      "Your account is temporarily locked. Please try again in a minute.",
    );
    expect(accountLockedMessage(15 * MIN)).toBe(
      "Your account is temporarily locked. Please try again in 15 minutes.",
    );
    for (const ms of samples) expectSpoken(accountLockedMessage(ms));
  });

  it("the shared rate-limit refusal — no more '1 seconds' or '0 seconds'", () => {
    expect(rateLimitError(1_000)).toBe("Too many requests. Please try again in a second.");
    expect(rateLimitError(0)).toBe("Too many requests. Please try again in a second.");
    expect(rateLimitError(14_000)).toBe("Too many requests. Please try again in 14 seconds.");
    expect(rateLimitError(90_000)).toBe("Too many requests. Please try again in 2 minutes.");
    for (const ms of samples) expectSpoken(rateLimitError(ms));
  });
});

/* ── At the wire: the real procedures, the real middleware ───────────────── */

const ORIGIN = "https://klieglabs.com";
let nextUserId = 71_000;

function callerFor(overrides: Record<string, unknown> = {}) {
  const user = {
    id: nextUserId++,
    email: "waiter@example.com",
    name: "Wait Tester",
    approved: true,
    suspendedAt: null,
    lockedUntil: null,
    ...overrides,
  };
  const caller = referralRouter.createCaller({
    user,
    req: { ip: "203.0.113.9", headers: { origin: ORIGIN, host: new URL(ORIGIN).host } },
  } as never);
  return { user, caller };
}

async function refusalOf(run: () => Promise<unknown>): Promise<{ code: string; message: string }> {
  try {
    await run();
  } catch (error) {
    const e = error as { code?: string; message?: string };
    return { code: e.code ?? "", message: e.message ?? "" };
  }
  throw new Error("the procedure did not refuse");
}

/* The buckets `routes/referral.ts` declares — read off the module's own text so
   a changed window cannot leave this arm exhausting the wrong bucket. */
function bucket(name: "INVITE_RATE" | "REDEEM_RATE") {
  const src = readListedSource(join(__dirname, "routes", "referral.ts"))!;
  const m = src.match(new RegExp(`const ${name} = \\{ maxRequests: (\\d+), windowMs: ([\\d *]+), keyPrefix: "([^"]+)" \\}`));
  if (!m) throw new Error(`${name} is not declared where this arm expects it`);
  const windowMs = m[2].split("*").map((n) => Number(n.trim())).reduce((a, b) => a * b, 1);
  return { maxRequests: Number(m[1]), windowMs, keyPrefix: m[3] };
}

describe("at the wire — the refusals a customer is actually handed", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /* THE CASE THAT SHIPPED BROKEN: the window's last minute. */
  for (const [label, name, run] of [
    ["sendInvite", "INVITE_RATE", (c: ReturnType<typeof callerFor>["caller"]) => c.sendInvite({ email: "friend@example.com" })],
    ["redeem", "REDEEM_RATE", (c: ReturnType<typeof callerFor>["caller"]) => c.redeem({ code: "ABCDEFGH" })],
    ["claim", "REDEEM_RATE", (c: ReturnType<typeof callerFor>["caller"]) => c.claim({ referralCode: "ABCDEFGH" })],
  ] as const) {
    it(`referral.${label} inside its last minute says "in a minute", and earlier says the count`, async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      const start = new Date("2026-10-08T12:00:00Z").getTime();
      vi.setSystemTime(start);
      const rate = bucket(name);
      const { user, caller } = callerFor();
      for (let i = 0; i < rate.maxRequests; i++) checkRateLimit(`${user.id}`, rate);

      /* Positive control first: well inside the window, the count is spoken. */
      vi.setSystemTime(start + rate.windowMs - 10 * MIN + 1);
      const early = await refusalOf(() => run(caller));
      expect(early.code).toBe("TOO_MANY_REQUESTS");
      expect(early.message).toMatch(/Try again in 10 minutes\.$/);

      vi.setSystemTime(start + rate.windowMs - 30_000);
      const late = await refusalOf(() => run(caller));
      expect(late.code).toBe("TOO_MANY_REQUESTS");
      expect(late.message).toMatch(/Try again in a minute\.$/);
      expectSpoken(late.message);
    });
  }

  it("the lockout middleware refuses with a spoken wait", async () => {
    const { caller } = callerFor({ lockedUntil: new Date(Date.now() + 30_000) });
    const refused = await refusalOf(() => caller.redeem({ code: "ABCDEFGH" }));
    expect(refused.code).toBe("FORBIDDEN");
    expect(refused.message).toBe("Your account is temporarily locked. Please try again in a minute.");

    const { caller: later } = callerFor({ lockedUntil: new Date(Date.now() + 14 * MIN + 5_000) });
    const longer = await refusalOf(() => later.redeem({ code: "ABCDEFGH" }));
    expect(longer.message).toBe("Your account is temporarily locked. Please try again in 15 minutes.");
  });
});

/* ── The sweep: no hand-built unit clause anywhere in the product ─────────── */

const REPO_ROOT = join(__dirname, "..");
const HELPER = "shared/waitPhrase.ts";

/**
 * ONE PINNED EXEMPTION, AND IT IS A DEBT RATHER THAN A RULING.
 * `exportRefusalMessage` in `server/routes/account.ts` (#1962) is the worked
 * example this helper was taken from and is already grammatical (driven above);
 * it is left on its own copy only because card #1989 was editing that file when
 * this landed. Switching it onto `waitPhrase` is a one-line follow-up, and the
 * exemption is keyed on the exact line so any OTHER hand-built clause in that
 * file still reddens — and the arm below reddens once the line is gone, so the
 * exemption cannot outlive its reason.
 */
const PENDING_FOLLOW_UP = new Set([
  "server/routes/account.ts  const when = minutes === 1 ? \"in a minute\" : `in ${minutes} minutes`;",
]);

/**
 * A template literal that interpolates a value and then names a time unit
 * ("${n} minutes", "${n} minute(s)", "${n} second${…}") — the shape every one
 * of the five sentences had. Applied to comment-stripped source.
 */
export function buildsAUnitClause(line: string): boolean {
  return /\$\{[^}]*\}\s*(minute|second|hour)s?\b|\b(minute|second|hour)\(s\)/.test(line);
}

function sources(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    const stat = statSync(full, { throwIfNoEntry: false });
    if (!stat) continue;
    if (stat.isDirectory()) {
      sources(full, found);
      continue;
    }
    if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) continue;
    found.push(full);
  }
  return found;
}

describe("no sentence builds its own wait clause", () => {
  it("CAN FAIL — the reader driven on every shape that shipped, and on the repairs", () => {
    expect(buildsAUnitClause("message: `Too many attempts. Try again in ${Math.ceil(rateCheck.resetIn / 60000)} minutes.`,")).toBe(true);
    expect(buildsAUnitClause("message: `Your account is temporarily locked. Please try again in ${remainingMinutes} minute(s).`,")).toBe(true);
    expect(buildsAUnitClause("return `Too many requests. Please try again in ${seconds} seconds.`;")).toBe(true);
    expect(buildsAUnitClause("setError(`Account temporarily locked. Try again in ${data.minutes || 15} minutes.`);")).toBe(true);
    expect(buildsAUnitClause("message: `Too many attempts. Try again ${waitPhrase(rateCheck.resetIn)}.`,")).toBe(false);
    expect(buildsAUnitClause("windowMs: 60 * 1000,      // 1 minute")).toBe(false);
  });

  it("server/, shared/ and client/src/ hold none outside the helper", () => {
    const roots = ["server", "shared", join("client", "src")].map((r) => join(REPO_ROOT, r));
    const files = roots.flatMap((r) => sources(r));
    expect(files.length, "the walk found almost nothing — it is pointed at the wrong place").toBeGreaterThan(500);
    const found: string[] = [];
    const pendingSeen = new Set<string>();
    for (const file of files) {
      const rel = relative(REPO_ROOT, file).split(sep).join("/");
      if (rel === HELPER) continue;
      const text = readListedSource(file);
      if (text === null) continue;
      withoutComments(text).split(/\r?\n/).forEach((line, i) => {
        if (!buildsAUnitClause(line)) return;
        if (PENDING_FOLLOW_UP.has(`${rel}  ${line.trim()}`)) {
          pendingSeen.add(`${rel}  ${line.trim()}`);
          return;
        }
        found.push(`${rel}:${i + 1}  ${line.trim()}`);
      });
    }
    expect(
      [...PENDING_FOLLOW_UP].filter((key) => !pendingSeen.has(key)),
      "an exemption whose line is gone — delete it from PENDING_FOLLOW_UP",
    ).toEqual([]);
    expect(
      found,
      "say the wait with `waitPhrase` from shared/waitPhrase.ts — a hand-built clause says"
        + " \"1 minutes\" for the whole last minute of every window (#1993)",
    ).toEqual([]);
  });
});
