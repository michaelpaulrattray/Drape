import { readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { ERROR_MESSAGES } from "../client/src/pages/Login";
import { FREE_GRANT_REFUSAL_ERROR_CODE } from "../shared/freeGrantRefusal";
import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";
import { readListedSource } from "./testing/listedSource";
import { withoutComments } from "./testing/withoutComments";

/* It sweeps the route tree off the real disk, and under the parallel run that
   cost multiplies against vitest's 5,000 ms default. File level, never per arm:
   a number typed onto one `it(…)` is not inherited by its neighbour (#741). */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

/**
 * ⚠ **EVERY REFUSAL THAT SENDS SOMEBODY BACK TO THE SIGN-IN PAGE HAS A DECIDED
 * ANSWER THERE — #1709, 2026-10-01.**
 *
 * # What this is the back half of
 *
 * `Login.tsx` read its query string with `useLocation().split("?")[1]`, which in
 * wouter 3 is the pathname — so `errorType` was always `null` and the whole
 * `ERROR_MESSAGES` map was **unreachable code**. Every note the product had
 * written for a turned-away customer had never once rendered. That is fixed
 * (`useSearch`, PR #1712) and `server/queryStringReads.test.ts` guards the
 * idiom that caused it.
 *
 * **This guards the other way the same customer ends up told nothing**: the map
 * is reachable, and the code the server sent is not in it. `ErrorBanner` falls
 * back to a generic *"An error occurred during sign in. Please try again."* —
 * which renders, so nothing looks broken, and says neither what was refused nor
 * what to do. A map with no reader and a code with no entry are the same
 * customer-facing outcome reached from two directions, and only one of them had
 * an arm.
 *
 * # Why it reads the map by IMPORTING it, and that is the whole lesson
 *
 * One key in that object is COMPUTED — `[FREE_GRANT_REFUSAL_ERROR_CODE]`, so
 * the redirect and the lookup cannot drift. A reader that regexed `Login.tsx`
 * for `^  \w+:` sees ten keys and **not** that one, and would report
 * `signup_unavailable` as having no note.
 *
 * ⚠ **That is not hypothetical: it is what happened while this file was being
 * written.** A grep said the code had no entry, the shared module's own docblock
 * said a code with no entry *"renders no banner at all, which is a refused
 * customer shown nothing"*, and the finding was one minute from being filed as a
 * live defect on a signup road. **Driving the page disproved it** — the real
 * sentence renders, title and all. A shape-match standing in for a declaration
 * the code already makes is the Atlas's own worst class, and this guard would
 * have been born with it.
 *
 * So: the client side is the DECLARATION, imported. The server side is a parse,
 * because a redirect is a string and there is nothing to import — and it is
 * therefore the half that carries the floor arms.
 */

const ROUTES = path.resolve(__dirname, "routes");

/**
 * Identifiers a redirect may interpolate, resolved to their real values by
 * importing the module that declares them.
 *
 * ⚠ **An identifier NOT on this list is a RED, never a skip** (invariant 7's
 * shape: a reader that quietly drops what it cannot resolve reports a clean
 * sheet). Adding a constant-keyed redirect means adding it here, which is one
 * line and is the moment somebody confirms the login page knows the code.
 */
const RESOLVABLE: Readonly<Record<string, string>> = {
  FREE_GRANT_REFUSAL_ERROR_CODE,
};

/**
 * ⚠ **THE CODES THAT REACH THE SIGN-IN PAGE WITH NO NOTE OF THEIR OWN, AND
 * THEREFORE GET THE GENERIC BANNER — DECLARED, NOT DISCOVERED.**
 *
 * Measured at the tree on 2026-10-01. Every one of these renders *"Authentication
 * Error / An error occurred during sign in. Please try again."* — a customer is
 * told something went wrong and not what, or what to do about it.
 *
 * **It is a list rather than a failure because writing eight refusal sentences is
 * a copy decision and #1709 says so in its own body** (*"Nothing about the
 * wording of any of the notes … somebody's design decision rather than this
 * fix"*). What the list buys is that the gap is VISIBLE and bounded: a new
 * server code cannot join it silently, because a code that is in neither the map
 * nor this list reddens, and whoever adds it decides which it is.
 *
 * ⚠ Three of these — `code_redeem_failed`, `invalid_callback`, `create_failed` —
 * are named in #1709's own body as codes the repair made visible. They are not:
 * they have never had a note, so the repair made them render a GENERIC banner
 * rather than nothing. The card is right that they were unreachable and wrong
 * that they now say anything useful, which is exactly the distinction this file
 * exists to keep.
 */
const GENERIC_ON_PURPOSE: ReadonlyArray<string> = [
  /* OAuth plumbing — a customer can do nothing about any of these, and naming
     the mechanism would be the technology showing through. */
  "invalid_state",
  "invalid_token",
  "invalid_callback",
  "no_id_token",
  "server_error",
  /* Sign-up roads that failed after the code was accepted. Worth real copy; see
     the note above on why it is not written here. */
  "code_redeem_failed",
  "create_failed",
  "token_expired",
];

function routeSources(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    /* A listing can name a file that is gone by the time it is stat-ed (#223). */
    const stat = statSync(full, { throwIfNoEntry: false });
    if (stat === undefined) continue;
    if (stat.isDirectory()) {
      found.push(...routeSources(full));
      continue;
    }
    if (!entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) continue;
    found.push(full);
  }
  return found;
}

/** Every `?error=` code a server route sends to the sign-in page. */
function serverCodes(): { codes: Set<string>; unresolved: string[] } {
  const codes = new Set<string>();
  const unresolved: string[] = [];
  for (const file of routeSources(ROUTES)) {
    const listed = readListedSource(file);
    if (listed === null) continue;
    /* ⚠ PROSE IS NOT A REDIRECT, and this cost a red the first time it ran:
       `googleAuth.ts`'s own header says *"redirects to /app or /login?error=..."*
       and the parse read `...` as a code with no note. A guard that reports a
       docblock as a customer-facing defect is a guard nobody will trust the
       next time it is right. */
    const source = withoutComments(listed);
    /* Two shapes, and the interpolation may contain SPACES — the
       `${isSuspended ? "suspended" : "locked"}` ternary is a real redirect and a
       character class that stops at whitespace captured `${isSuspended`. */
    for (const match of source.matchAll(/\/login\?error=(\$\{[^}]*\}|[A-Za-z_][A-Za-z0-9_]*)/g)) {
      const raw = match[1]!;
      if (!raw.includes("$")) {
        codes.add(raw);
        continue;
      }
      /* An interpolation: take every quoted literal inside it (the
         `isSuspended ? "suspended" : "locked"` shape) and otherwise resolve the
         bare identifier. */
      const literals = [...raw.matchAll(/["']([a-z_]+)["']/gi)].map((m) => m[1]!);
      if (literals.length > 0) {
        literals.forEach((literal) => codes.add(literal));
        continue;
      }
      const ident = raw.replace(/[${}]/g, "").trim();
      const resolved = RESOLVABLE[ident];
      if (resolved === undefined) unresolved.push(`${path.basename(file)}: ${raw}`);
      else codes.add(resolved);
    }
  }
  return { codes, unresolved };
}

describe("every sign-in refusal has a decided answer on the page it lands on (#1709)", () => {
  /**
   * ⚠ THE FLOOR, FIRST. For a guard whose verdict is "every code is accounted
   * for", **finding no codes IS passing** — a parse pointed at the wrong
   * directory, or one whose pattern stopped matching, is indistinguishable from
   * a fully covered product. Both shapes the parse must read are named, so it
   * cannot go half-blind either.
   */
  it("reads the redirects, including both shapes it has to understand", () => {
    const { codes } = serverCodes();
    expect(codes.size, "the parse found almost no redirects — check the pattern, not the tree")
      .toBeGreaterThan(12);
    expect(codes, "the parse cannot see a plain literal redirect").toContain("suspended");
    expect(
      codes,
      "the parse cannot see a redirect built from a shared constant — the one shape a regex"
      + " over the client map got wrong, measured by driving the page",
    ).toContain(FREE_GRANT_REFUSAL_ERROR_CODE);
    expect(codes, "the parse cannot see a code inside a ternary interpolation").toContain("locked");
  });

  it("refuses an interpolated code it cannot resolve, rather than dropping it", () => {
    const { unresolved } = serverCodes();
    expect(
      unresolved,
      "a redirect interpolates an identifier this guard cannot resolve. Add it to RESOLVABLE"
      + " with the module that declares it — a code silently dropped here is a code nobody"
      + " checked the login page knows.",
    ).toEqual([]);
  });

  it("every code the server sends has a note, or is a declared generic", () => {
    const { codes } = serverCodes();
    const known = new Set([...Object.keys(ERROR_MESSAGES), ...GENERIC_ON_PURPOSE]);
    const orphans = [...codes].filter((code) => !known.has(code)).sort();
    expect(
      orphans,
      "a refusal sends somebody to the sign-in page with a code it has no note for, so they"
      + " are shown a generic \"An error occurred\" that names neither what was refused nor"
      + " what to do. Give it an entry in ERROR_MESSAGES, or add it to GENERIC_ON_PURPOSE"
      + " with the reason it has none. #1709.",
    ).toEqual([]);
  });

  /**
   * The list only ever shrinks, and a stale entry is as misleading as a missing
   * one: a code that has since been given a note, or deleted from the server,
   * must leave this list rather than sit on it implying a gap that is closed.
   */
  it("no declared generic is stale", () => {
    const { codes } = serverCodes();
    const notes = new Set(Object.keys(ERROR_MESSAGES));
    for (const code of GENERIC_ON_PURPOSE) {
      expect(
        notes.has(code),
        `"${code}" has a note now — take it off GENERIC_ON_PURPOSE`,
      ).toBe(false);
      expect(
        codes.has(code),
        `"${code}" is on GENERIC_ON_PURPOSE and no server route sends it any more`,
      ).toBe(true);
    }
  });

  /**
   * ⚠ The fallback itself must exist, because every line above assumes it. If
   * `ERROR_MESSAGES.error` went away, the declared generics would render
   * NOTHING rather than a plain sentence, and this file would still be green.
   */
  it("the generic the declared list relies on is still there", () => {
    expect(ERROR_MESSAGES).toHaveProperty("error");
    expect((ERROR_MESSAGES as { error: { message: string } }).error.message.length)
      .toBeGreaterThan(10);
  });
});
