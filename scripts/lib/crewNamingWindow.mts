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

/** The `gh pr list` arguments for the merged-pull-request read. */
export function mergedPullRequestArgs(
  since: { readonly date: string } | null,
  pageBound: number,
): string[] {
  const shared = ["--limit", String(pageBound), "--json", "number,title,body,mergedAt"];
  /* `is:merged` rides INSIDE the search rather than trusting `--state merged`
     to survive alongside it: one flag, one meaning, and the search form is the
     one whose semantics are documented. */
  return since
    ? ["pr", "list", "--search", `is:merged merged:>=${since.date}`, ...shared]
    : ["pr", "list", "--state", "merged", ...shared];
}

/**
 * Whether a card was filed before the reader could see, and therefore cannot be
 * judged this run.
 *
 * `horizonAt` is null in the ordinary case — the whole derived window came back
 * and every open card is inside it. It is set only when the page bound was hit,
 * and is then the oldest merge the reader actually holds.
 *
 * ⚠ A card with an UNREADABLE filing date is NOT out of reach. It is already
 * handled by the rule (an unreadable date cannot satisfy "merged after filed"),
 * and reporting it here would move a card from *not flagged* to *unjudged* on
 * the strength of a parse failure that has nothing to do with the horizon.
 */
export function isOutOfNamingReach(filedAt: number, horizonAt: number | null): boolean {
  if (horizonAt === null) return false;
  if (!Number.isFinite(filedAt)) return false;
  return filedAt < horizonAt;
}
