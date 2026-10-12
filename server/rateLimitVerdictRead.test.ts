/**
 * EVERY `checkRateLimit` CALL READS ITS VERDICT — the class sweep behind #1962.
 *
 * ## The defect, and why a comment was the only thing enforcing it
 *
 * `checkRateLimit` RETURNS `{ allowed, remaining, resetIn }`. It does not
 * throw. So a call whose result is discarded updates a counter and permits
 * everything — a control that is not invoked (invariant 7), wearing a comment
 * that says it is. `account.deleteAccount`'s read *"1 attempt per 5 minutes to
 * prevent abuse"* and enforced nothing, which is the card.
 *
 * ⚠ **THE INSTANCE WAS NOT THE WORST ONE.** Counted at the code before anything
 * was edited: **exactly two of the thirty call sites under `server/` discarded
 * their verdict, and both were in `server/routes/account.ts`** — the retiring
 * `deleteAccount`, and `exportData`, which is LIVE and is the GDPR export, the
 * most expensive projection the product assembles. The card named the dead one.
 *
 * ## Why this is a guard and not a hand count
 *
 * A grep is true of the tree it ran on and says nothing about tomorrow's, and
 * this defect is invisible in review: the call is there, the comment is there,
 * and the only tell is a missing `const`. The population is derived from the
 * source so a thirty-first call site is in scope the moment it exists.
 *
 * ⚠ **AND THE READER IS DRIVEN BOTH WAYS BEFORE ITS SILENCE COUNTS** (law 2).
 * A reader that never finds a bare call admits everything; one that never finds
 * a bound call refuses the whole tree. Both arms are below, on the exact text
 * that shipped broken and the exact text that fixed it.
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { exportRefusalMessage } from "./routes/account";

import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";
import { readListedSource } from "./testing/listedSource";
import { withoutComments } from "./testing/withoutComments";

/* #741 — this walks every source file under `server/`, which multiplies well
   past vitest's 5 s default when 275 test files share one disk. */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const SERVER_ROOT = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const REPO_ROOT = join(SERVER_ROOT, "..");

/** The module that DEFINES the helper answers to nothing here. */
const DEFINITION = "server/security/rateLimit.ts";

/**
 * Does this statement keep the verdict?
 *
 * A call whose text is preceded by an assignment, a return, a condition or a
 * property is read; a call that opens its own statement is not. The test is on
 * what comes BEFORE the call, because that is where the binding is — the shapes
 * in this tree are `const rl = checkRateLimit(`, `if (!checkRateLimit(`,
 * `return checkRateLimit(` and the bare `checkRateLimit(`.
 */
export function bindsTheVerdict(sourceLine: string): boolean {
  const index = sourceLine.lastIndexOf("checkRateLimit(");
  if (index < 0) return false;
  const before = sourceLine.slice(0, index).trimEnd();
  if (before.endsWith(".")) return false; // a property access, e.g. a mock's name
  /* Anything at all in front of the call on its own line is a binding: `=`,
     `(`, `!`, `return`, `await`, `=>`. Nothing in front of it is the bug. */
  return before.length > 0;
}

function serverSources(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full, { throwIfNoEntry: false });
    if (!stat) continue;
    if (stat.isDirectory()) {
      serverSources(full, found);
      continue;
    }
    if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) continue;
    found.push(full);
  }
  return found;
}

interface CallSite {
  where: string;
  line: string;
  binds: boolean;
}

function callSites(): CallSite[] {
  const sites: CallSite[] = [];
  for (const file of serverSources(SERVER_ROOT)) {
    const rel = relative(REPO_ROOT, file).split(sep).join("/");
    if (rel === DEFINITION) continue;
    const source = readListedSource(file);
    if (source === null) continue;
    const lines = withoutComments(source).split(/\r?\n/);
    lines.forEach((line, index) => {
      if (!line.includes("checkRateLimit(")) return;
      sites.push({ where: `${rel}:${index + 1}`, line: line.trim(), binds: bindsTheVerdict(line) });
    });
  }
  return sites;
}

describe("#1962 — the rate-limit verdict is read, never dropped", () => {
  it("CAN FAIL — the reader driven on the two shapes that actually shipped", () => {
    /* The exact text `account.exportData` carried while its limit did nothing. */
    expect(bindsTheVerdict("    checkRateLimit(`data-export:${userId}`, {")).toBe(false);
    /* And the repair. */
    expect(bindsTheVerdict("    const rl = checkRateLimit(`data-export:${userId}`, {")).toBe(true);
    /* The three other binding shapes in the tree, so a narrowing of the reader
       cannot pass by calling them all violations. */
    expect(bindsTheVerdict("  const rate = checkRateLimit(`user:${input.userId}`, RATE_LIMITS.generation);")).toBe(true);
    expect(bindsTheVerdict("      if (!checkRateLimit(key, config).allowed) return;")).toBe(true);
    expect(bindsTheVerdict("  return checkRateLimit(`user:${userId}`, config);")).toBe(true);
    /* A line that merely names the symbol is not a call site at all. */
    expect(bindsTheVerdict("import { checkRateLimit } from '../security/rateLimit';")).toBe(false);
  });

  it("every call site under server/ keeps its verdict", () => {
    const sites = callSites();

    /* THE FLOOR. A walk that found nothing reports nothing, which is
       byte-identical to a clean tree (law 2). Twenty-nine call sites stood here
       the day this was written, outside the definition. */
    expect(sites.length, "the walk found almost no call sites — it is pointed at the wrong place")
      .toBeGreaterThan(20);

    const dropped = sites.filter((site) => !site.binds).map((site) => `${site.where}  ${site.line}`);
    expect(
      dropped,
      "a rate limit here updates a counter and permits everything: `checkRateLimit` RETURNS"
        + " `{ allowed }` and never throws, so the verdict must be bound and acted on."
        + " Bind it and throw a real TOO_MANY_REQUESTS (invariant 6), the shape"
        + " `server/routes/referral.ts` uses.",
    ).toEqual([]);
  });

  it("the GDPR export refuses rather than permitting, and says when", () => {
    /*
      The one live instance, pinned at its own text rather than left to the
      sweep above — the sweep proves the verdict is READ, and this proves what
      is DONE with it. A verdict bound to a variable nobody branches on would
      satisfy the sweep exactly.
    */
    const source = withoutComments(readListedSource(join(SERVER_ROOT, "routes", "account.ts"))!);
    const reader = source.slice(source.indexOf("exportData:"));
    expect(reader).toContain("const rl = checkRateLimit(");
    expect(reader).toContain("if (!rl.allowed)");
    expect(reader).toContain('code: "TOO_MANY_REQUESTS"');
    expect(reader, "a refusal that does not say when leaves the customer guessing").toContain("resetIn");
  });
});

/**
 * ⚠ **THESE ARMS EXIST BECAUSE A FRAME SAID SOMETHING THE CODE DID NOT.**
 * #1962's law-6 render photographed the refusal in both themes and it read
 * *"Try again in 1 minutes."* — `Math.ceil` answers 1 for the whole last
 * minute of every window, so that is the common case rather than an edge one.
 * Working law 6, paying for itself: nothing in the suite could have said so.
 */
describe("#1962 — the export's refusal is a sentence, at every boundary", () => {
  it("says 'in a minute' for anything inside the last minute", () => {
    expect(exportRefusalMessage(1)).toBe(
      "You can export your data once every 5 minutes. Try again in a minute.",
    );
    expect(exportRefusalMessage(60_000)).toBe(
      "You can export your data once every 5 minutes. Try again in a minute.",
    );
  });

  it("pluralises from two minutes up", () => {
    expect(exportRefusalMessage(60_001)).toContain("in 2 minutes.");
    expect(exportRefusalMessage(300_000)).toContain("in 5 minutes.");
  });

  it("never says 'in 0 minutes' — a window with milliseconds left is still a wait", () => {
    /*
      `resetIn` can arrive as 0 or negative on a window that expired between
      the check and the throw. "Try again in 0 minutes" is worse than useless:
      it tells her to retry now, and the retry is refused.
    */
    expect(exportRefusalMessage(0)).toContain("in a minute.");
    expect(exportRefusalMessage(-5_000)).toContain("in a minute.");
  });

  it("never says the ungrammatical form the frame caught", () => {
    for (const ms of [0, 1, 30_000, 60_000, 60_001, 120_000, 299_999, 300_000]) {
      expect(exportRefusalMessage(ms)).not.toContain("1 minutes");
      expect(exportRefusalMessage(ms)).not.toContain("minute(s)");
    }
  });
});

/**
 * ⚠ **A VERDICT CAN BE READ AND STILL ANSWERED AS A SUCCESS** (#2371).
 *
 * The sweep above proves every call binds its verdict. It says nothing about
 * what the refused branch DOES, and both access-code procedures read theirs and
 * then `return`ed `{ valid: false, error: "Too many attempts…" }` — an HTTP 200
 * that invariant 6 forbids, which a client cannot tell from "this code is not
 * valid" and which carries no wait. So the class arm: for every
 * `const X = checkRateLimit(` the refused branch `if (!X.allowed) { … }` must
 * carry a real refusal — `TOO_MANY_REQUESTS` (tRPC) or `status(429)` (Express).
 *
 * One enumerated exception, with its reason: the Google sign-in START is a
 * top-level browser navigation that no script reads a status from, so it
 * redirects to `/login?error=rate_limited`, which the sign-in page explains.
 */
const REFUSAL_EXCEPTIONS: Record<string, string> = {
  "server/routes/googleAuth.ts":
    "a top-level navigation: the refusal is a redirect to /login?error=rate_limited",
};

/** The refused branches in one file's (comment-free) source, and whether each really refuses. */
export function refusedBranches(source: string): { binding: string; refuses: boolean; body: string }[] {
  const found: { binding: string; refuses: boolean; body: string }[] = [];
  const binding = /const\s+(\w+)\s*=\s*checkRateLimit\(/g;
  let match: RegExpExecArray | null;
  while ((match = binding.exec(source)) !== null) {
    const name = match[1];
    const guard = new RegExp(String.raw`if\s*\(\s*!\s*${name}\.allowed\s*\)\s*\{`, "g");
    guard.lastIndex = match.index;
    const opened = guard.exec(source);
    if (!opened) {
      found.push({ binding: name, refuses: false, body: "(no `if (!" + name + ".allowed) {` branch follows)" });
      continue;
    }
    let depth = 1;
    let i = opened.index + opened[0].length;
    const start = i;
    while (i < source.length && depth > 0) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") depth--;
      i++;
    }
    const body = source.slice(start, i - 1);
    found.push({ binding: name, refuses: /TOO_MANY_REQUESTS|status\(\s*429\s*\)/.test(body), body: body.trim() });
  }
  return found;
}

describe("#2371 — a refused branch refuses, never answers 200", () => {
  it("CAN FAIL — the reader driven on the exact text that shipped and its repair", () => {
    /* `access.validate` as it stood until #2371. */
    const shipped = [
      "      const rl = checkRateLimit(`access-validate:${clientIp}`, {",
      "        maxRequests: 10,",
      "      });",
      "      if (!rl.allowed) {",
      '        return { valid: false, error: "Too many attempts. Please try again later." };',
      "      }",
    ].join("\n");
    expect(refusedBranches(shipped)).toHaveLength(1);
    expect(refusedBranches(shipped)[0].refuses).toBe(false);
    /* The repair, and the two other refusal shapes in the tree. */
    expect(refusedBranches(shipped.replace(/return \{[^}]*\};/, "throw new TRPCError({ code: \"TOO_MANY_REQUESTS\", message: m });"))[0].refuses).toBe(true);
    expect(refusedBranches('const r = checkRateLimit(k, c);\nif (!r.allowed) {\n  throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: m });\n}')[0].refuses).toBe(true);
    expect(refusedBranches('const r = checkRateLimit(k, c);\nif (!r.allowed) {\n  res.status(429).json({ error: m });\n  return;\n}')[0].refuses).toBe(true);
    /* A binding with no refused branch at all is not a pass. */
    expect(refusedBranches("const r = checkRateLimit(k, c);\nreturn r.remaining;")[0].refuses).toBe(false);
  });

  it("every refused branch under server/ answers a real refusal (invariant 6)", () => {
    const branches: { where: string; refuses: boolean; body: string }[] = [];
    for (const file of serverSources(SERVER_ROOT)) {
      const rel = relative(REPO_ROOT, file).split(sep).join("/");
      if (rel === DEFINITION) continue;
      const source = readListedSource(file);
      if (source === null || !source.includes("checkRateLimit(")) continue;
      for (const branch of refusedBranches(withoutComments(source))) {
        branches.push({ where: rel, refuses: branch.refuses || rel in REFUSAL_EXCEPTIONS, body: branch.body });
      }
    }
    /* THE FLOOR — the same population the sweep above counts. */
    expect(branches.length, "the reader found almost no refused branches — it is reading the wrong shape")
      .toBeGreaterThan(20);
    /* Every exception must still be a real call site, or it is excusing nothing. */
    for (const where of Object.keys(REFUSAL_EXCEPTIONS)) {
      expect(branches.some((b) => b.where === where), `${where} is excused but has no refused branch`).toBe(true);
    }
    const answered200 = branches.filter((b) => !b.refuses).map((b) => `${b.where}  ${b.body.slice(0, 120)}`);
    expect(
      answered200,
      "a rate-limit refusal answered as an ordinary result: throw a real TOO_MANY_REQUESTS"
        + " (or answer 429 on an Express route) — invariant 6, the shape `server/routes/referral.ts` uses.",
    ).toEqual([]);
  });
});
