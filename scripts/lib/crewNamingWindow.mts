/**
 * WHICH MERGED PULL REQUESTS THE POSSIBLY-FIXED READING ASKS FOR (#507).
 *
 * The reading itself lives in `scripts/crew-count-queue.mts`; the rule it
 * applies lives in `shared/crewQueuePossiblyDone.ts`. This module is the third
 * thing, and #507 is about exactly it: **which pull requests get handed to the
 * rule at all.**
 *
 * # THE DEFECT, AND ITS EXPIRY DATE
 *
 * The window used to be a bare `--limit 500` with a refusal on top: if 500 rows
 * came back, the whole reading returned null and every category was written
 * UNFLAGGED. That refusal was RIGHT — a limit shorter than the population turns
 * the reading into a silent floor. The constant was the problem. The history
 * was 182 merged pull requests when it shipped and is **217 now**, and this
 * repository merges several a day.
 *
 * So in a few months every run refuses, every category is unflagged forever,
 * and from his panel that is indistinguishable from *"nothing is ever stale"* —
 * the most reassuring wrong answer this panel can print, and the exact failure
 * the panel exists to end. Found by the reviewer on PR #498, filed before it
 * could be rediscovered as *"the flag stopped working"*.
 *
 * # THE WINDOW IS DERIVED, SO IT CANNOT EXPIRE
 *
 * The rule only ever qualifies a pull request that merged **after the card was
 * filed**. Nothing merged before the OLDEST OPEN CARD can change any verdict,
 * and old cards close — so the oldest open card's filing date is a bound that
 * tracks the queue instead of the history. Working law 4: derived, never a
 * number somebody has to maintain.
 *
 * ⚠ **IT IS DELIBERATELY A SHADE TOO WIDE, AND ONLY EVER IN THAT DIRECTION.**
 * `merged:>=` takes a DATE and truncates to the start of that day, so the query
 * reaches slightly further back than the rule needs. Losing a qualifying merge
 * would report as *"nothing flagged"*, which is the silent direction; fetching
 * a few extra pull requests costs nothing and changes no verdict.
 *
 * ⚠ **AND A DATE THAT CANNOT BE READ WIDENS THE WINDOW TO THE WHOLE HISTORY,
 * never narrows it** — the same reason.
 */

/**
 * GitHub's Search API returns at most this many results, whatever `--limit`
 * says. It is not our number and we cannot raise it.
 *
 * It matters because truncation here is detected by `rows.length >= bound`: set
 * the bound above the ceiling and that comparison can never fire, the read is
 * silently short, and every card outside the invisible reach is written
 * unflagged with no horizon and no log line — #507's exact shape, one
 * constant-edit away. So the search path REFUSES a bound above it rather than
 * trusting a future editor to know (reviewer finding 2 on PR #588).
 */
export const SEARCH_RESULT_CEILING = 1000;

/** The `gh pr list` arguments for the merged-pull-request read. */
export function mergedPullRequestArgs(
  since: { readonly date: string } | null,
  pageBound: number,
): string[] {
  if (since && pageBound > SEARCH_RESULT_CEILING) {
    throw new Error(
      `a search-path page bound of ${pageBound} is above GitHub's ${SEARCH_RESULT_CEILING}-result search `
      + "ceiling, so truncation could never be detected and the reading would be a silent floor.",
    );
  }
  const shared = ["--limit", String(pageBound), "--json", "number,title,body,mergedAt"];
  /* `is:merged` rides INSIDE the search rather than trusting `--state merged`
     to survive alongside it: one flag, one meaning, and the search form is the
     one whose semantics are documented. */
  return since
    ? ["pr", "list", "--search", `is:merged merged:>=${since.date}`, ...shared]
    : ["pr", "list", "--state", "merged", ...shared];
}

/**
 * WHETHER THIS RUN CAN JUDGE ANY CARD AT ALL.
 *
 * ⚠ **The first shape of this took a per-card horizon and it was UNSOUND**
 * (reviewer finding 1 on PR #588). It computed the oldest merge in the page it
 * held and judged every card filed after that date normally — which is only
 * true if the rows held are the most-recent-by-MERGE slice. Neither road
 * promises that: GitHub search has no merged-date sort and returns best-match
 * order, and the `--state merged` fallback orders by CREATED date, so a PR
 * created long ago and merged yesterday can be one of the rows dropped. A
 * qualifying merge newer than the horizon would then be absent, its card judged
 * normally, and written **not flagged** — the silent direction this whole card
 * exists to close, reintroduced inside its own escape hatch.
 *
 * So there is no partial reading. A truncated page means the reader does not
 * know WHICH pull requests it is missing, and every offered card is reported
 * out of reach by name. That is not the old refusal wearing a hat: the old one
 * wrote every category unflagged, which reads as *"nothing is stale"*; this
 * names each card it could not judge, in the log a shift acts on.
 */
export function judgementIsBlind(truncated: boolean): boolean {
  return truncated;
}
