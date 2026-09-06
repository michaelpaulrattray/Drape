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
 * Two things are asserted here, and the second is the one with teeth:
 *
 *   1. the window is a DATE derived from the oldest open card, so it tracks the
 *      queue rather than the history and cannot expire;
 *   2. hitting the page bound underneath it reports an OUT-OF-REACH horizon —
 *      a card the reader could not judge is NAMED, never silently unflagged.
 *
 * ⚠ The arguments are asserted at the WIRE (working law 5) — the array actually
 * handed to `execFileSync`, not a constant standing near it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { isOutOfNamingReach, mergedPullRequestArgs } from "../scripts/lib/crewNamingWindow.mts";

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

  it("carries the page bound it was given, so the caller owns that number", () => {
    expect(mergedPullRequestArgs({ date: "2026-01-01" }, 7)).toContain("7");
  });
});

describe("a card the reader could not see is OUT OF REACH, not unflagged", () => {
  const HORIZON = Date.parse("2026-06-01T00:00:00Z");
  const filed = (iso: string) => Date.parse(iso);

  it("no horizon means every card is judgeable — the ordinary run", () => {
    /* The control the arms below depend on: a predicate that always said true
       would pass every out-of-reach arm ever written. */
    expect(isOutOfNamingReach(filed("2020-01-01T00:00:00Z"), null)).toBe(false);
  });

  it("a card filed before the horizon is reported", () => {
    expect(isOutOfNamingReach(filed("2026-05-31T23:59:59Z"), HORIZON)).toBe(true);
  });

  it("a card filed at or after the horizon is judged normally", () => {
    expect(isOutOfNamingReach(HORIZON, HORIZON)).toBe(false);
    expect(isOutOfNamingReach(filed("2026-06-02T00:00:00Z"), HORIZON)).toBe(false);
  });

  it("an unreadable filing date is NOT called out of reach", () => {
    /* It is already handled by the rule, and moving a card from *not flagged*
       to *unjudged* on a parse failure would blame the horizon for something
       that has nothing to do with it. */
    expect(isOutOfNamingReach(Number.NaN, HORIZON)).toBe(false);
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
    expect(source).toContain("isOutOfNamingReach(row.at, namings.horizonAt)");
    /* The old hand-built form. Its absence is asserted rather than assumed. */
    expect(source).not.toContain('"--state", "merged", "--limit"');
  });

  it("no longer names a fixed window, and the page bound is not a refusal", () => {
    expect(source).not.toContain("MERGED_PR_WINDOW");
    expect(source).toContain("MERGED_PR_PAGE_BOUND");
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
