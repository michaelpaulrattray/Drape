/**
 * THE POSSIBLY-FIXED READING'S WINDOW — driven (issue #507).
 *
 * The flag itself (#494) has arms in `server/crewQueuePossiblyDone.test.ts`.
 * This is the other question, the one the reviewer found on PR #498: **which
 * merged pull requests the rule is handed in the first place.**
 *
 * The window was a bare `--limit 500` with a refusal on top. The refusal was
 * right; the constant was not. 182 merged pull requests when it shipped, **217
 * today**, several a day — so within months every run refuses, every category
 * is written UNFLAGGED, and his panel reads *"nothing is ever stale"* forever
 * with the only trace in a shift log.
 *
 * Three things are asserted here, and the last two are the ones with teeth:
 *
 *   1. the window is a DATE derived from the oldest open card, so it tracks the
 *      queue rather than the history and cannot expire;
 *   2. the page bound underneath it cannot be raised past the point where
 *      truncation stops being detectable;
 *   3. and a truncated read NAMES every card it could not judge, rather than
 *      writing them unflagged or guessing which ones it can still judge.
 *
 * ⚠ The arguments are asserted at the WIRE (working law 5) — the array actually
 * handed to `execFileSync`, not a constant standing near it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { judgementIsBlind, mergedPullRequestArgs, SEARCH_RESULT_CEILING } from "../scripts/lib/crewNamingWindow.mts";

const PAGE_BOUND = 1000;
const COUNTER = join(__dirname, "..", "scripts", "crew-count-queue.mts");

describe("the merged-pull-request window is derived from the oldest open card", () => {
  it("asks GitHub only for merges since that card was filed", () => {
    const args = mergedPullRequestArgs({ date: "2026-08-25" }, PAGE_BOUND);
    expect(args).toEqual([
      "pr", "list", "--search", "is:merged merged:>=2026-08-25",
      "--limit", "1000", "--json", "number,title,body,mergedAt",
    ]);
  });

  it("keeps `is:merged` inside the search rather than beside it", () => {
    /* `--state merged` and `--search` together is the shape whose interaction
       nobody should have to remember. One flag, one meaning. */
    const args = mergedPullRequestArgs({ date: "2026-08-25" }, PAGE_BOUND);
    expect(args).not.toContain("--state");
    expect(args[args.indexOf("--search") + 1]).toContain("is:merged");
  });

  it("widens to the WHOLE history when the date cannot be read, never narrows", () => {
    /* The direction is the whole point: a narrowed window drops qualifying
       merges and reports the result as "nothing flagged", which is silent. */
    const args = mergedPullRequestArgs(null, PAGE_BOUND);
    expect(args).toEqual(["pr", "list", "--state", "merged", "--limit", "1000", "--json", "number,title,body,mergedAt"]);
    expect(args).not.toContain("--search");
  });

  it("carries the page bound it was given", () => {
    expect(mergedPullRequestArgs({ date: "2026-01-01" }, 7)).toContain("7");
  });

  /**
   * ⚠ AND REFUSES ONE ABOVE GITHUB'S SEARCH CEILING (reviewer finding 2 on
   * PR #588).
   *
   * Truncation is detected by `rows.length >= bound`. The search API returns at
   * most 1000 rows whatever `--limit` says, so a bound above that can NEVER
   * fire the comparison: the read is silently short and every card outside the
   * invisible reach is written unflagged with no out-of-reach row and no log
   * line. That is #507's exact shape, one constant-edit away — and the arm
   * above, read alone, looks like permission to make it.
   */
  it("refuses a search-path bound above the search API's own ceiling", () => {
    expect(() => mergedPullRequestArgs({ date: "2026-01-01" }, SEARCH_RESULT_CEILING + 1))
      .toThrow(/search ceiling/);
    expect(() => mergedPullRequestArgs({ date: "2026-01-01" }, SEARCH_RESULT_CEILING)).not.toThrow();
  });

  it("does not refuse it on the whole-history path, which is not a search", () => {
    /* The control: a refusal that fired on both roads would be green for the
       wrong reason, and the list API is not subject to the search ceiling. */
    expect(() => mergedPullRequestArgs(null, SEARCH_RESULT_CEILING * 5)).not.toThrow();
  });
});

/**
 * A TRUNCATED READ JUDGES NOTHING, AND SAYS SO CARD BY CARD.
 *
 * ⚠ The first shape of this kept a per-card horizon — the oldest merge in the
 * page it held — and judged every card filed after that date normally. The
 * reviewer caught it on PR #588 and was right: that is only sound if the rows
 * held are the most-recent-by-MERGE slice, and neither road promises it.
 * GitHub search has no merged-date sort and returns best-match order; the
 * `--state merged` fallback orders by CREATED date, so a pull request created
 * long ago and merged yesterday can be among the rows dropped. Its card, filed
 * after the horizon, would have been judged normally and written NOT FLAGGED —
 * the silent direction, reintroduced inside the escape hatch built to close it.
 */
describe("a truncated read reports every card, and judges none", () => {
  it("an untruncated read judges normally — the ordinary run", () => {
    /* The control the arm below depends on: a predicate that always said true
       would pass every out-of-reach arm ever written. */
    expect(judgementIsBlind(false)).toBe(false);
  });

  it("a truncated read judges nothing", () => {
    expect(judgementIsBlind(true)).toBe(true);
  });
});

/**
 * AND THE COUNTER REALLY USES THEM.
 *
 * Two pure functions with green arms prove nothing if the script still carries
 * its own copy — this repository's own working law 4, and the exact shape the
 * reviewer caught one card earlier (#494/#498 finding 1: a second list one line
 * from its source).
 */
describe("crew-count-queue reads through this module", () => {
  const source = readFileSync(COUNTER, "utf8");

  it("imports both, and builds no arguments of its own", () => {
    expect(source).toContain("mergedPullRequestArgs(since, MERGED_PR_PAGE_BOUND)");
    expect(source).toContain("judgementIsBlind(namings.truncated)");
    /* The old hand-built form. Its absence is asserted rather than assumed. */
    expect(source).not.toContain('"--state", "merged", "--limit"');
  });

  it("no longer names a fixed window, and the page bound is not a refusal", () => {
    expect(source).not.toContain("MERGED_PR_WINDOW");
    expect(source).toContain("MERGED_PR_PAGE_BOUND");
    /* And the bound is the ceiling itself rather than a second copy of 1000 —
       working law 4, on the one number whose drift makes truncation silent. */
    expect(source).toContain("MERGED_PR_PAGE_BOUND = SEARCH_RESULT_CEILING");
    /* The sentence that used to make every category unflagged forever. */
    expect(source).not.toContain("REFUSING the possibly-fixed reading");
  });

  it("names every out-of-reach card in the log a shift reads", () => {
    expect(source).toContain("OUT OF REACH");
  });

  it("the source reader is really looking at the counter", () => {
    /* An absence check over the wrong file is green for the wrong reason. */
    expect(source).toContain("crew_queue_counts");
    expect(source.length).toBeGreaterThan(10_000);
  });
});
