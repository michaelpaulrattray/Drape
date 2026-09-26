/**
 * THE RELAY'S HAND VERDICT — what one is, and whether it still stands (#1065,
 * read by #1094's build phrases).
 *
 * His ruling, 2026-09-22 (terminal), verbatim: *"You are the new outside
 * reviewer the outfit reviewer is permanently dead and will not come back."*
 * Since that day a verdict is not a workflow run and not a GitHub review — it is
 * a pull-request COMMENT, by the founder's account, whose body begins with
 * `**Fable review — by hand`, posted after the head commit.
 *
 * # ⚠ WHY THIS IS IN `shared/` AND NOT WHERE IT WAS WRITTEN
 *
 * The marker and the "is this a verdict" test were declared in
 * `scripts/lib/reviewRounds.mts`, which is correct for the merge tool and
 * unreachable from everything else: `shared/` is imported by the server that
 * builds his Desk and by the client that draws it, and neither may import a
 * script. #1094's build phrase needs the same fact — *has this pull request been
 * reviewed, or is it still waiting?* — so the declaration moved here and
 * `reviewRounds.mts` RE-EXPORTS it. One spelling of the marker, three readers
 * (the merge tool, his page, the queue readers), which is working law 4 applied
 * to the string a merge decision turns on.
 */

/** The prefix every hand verdict starts with. Posted by the relay, read here. */
export const HAND_VERDICT_MARKER = "**Fable review — by hand";

/** Does this body carry the marker, at the very start (after whitespace)? */
export function isHandVerdict(body: string): boolean {
  return body.trimStart().startsWith(HAND_VERDICT_MARKER);
}

/** What a caller was able to establish about a pull request's verdict. */
export type HandVerdictFreshness = "fresh" | "stale" | "none";

/**
 * A verdict and the pull request's own clock, stamped in the same second, is
 * ONE event rather than two. Two seconds of slack absorbs GitHub stamping the
 * parent a tick after the comment; it is deliberately not larger, because the
 * next event on a busy pull request is minutes away, never seconds.
 */
export const VERDICT_ACTIVITY_SLACK_MS = 2_000;

/**
 * DOES THE VERDICT STILL STAND? — one rule, and the evidence a caller has
 * decides which bound it is read against.
 *
 * ⚠ **THE EXACT BOUND IS THE HEAD COMMIT'S DATE, AND EXACTLY ONE CALLER CAN
 * AFFORD IT.** A verdict is on a diff, not on a pull request, so a head that
 * moved has not been read (`scripts/lib/reviewRounds.mts`'s `classifyComment`,
 * which is what decides a MERGE and reads `commits` per pull request through
 * `gh pr view`). Neither his Desk nor a queue reader can pay that: the Desk is
 * unauthenticated REST on a 60-an-hour allowance, and `gh pr list --json
 * commits` over a hundred pull requests is refused by GitHub outright
 * (*"requesting up to 1,000,000 possible nodes"* — measured, 2026-09-26).
 *
 * **So the bound those callers use is the pull request's own `updatedAt`: if
 * NOTHING has happened to it since the verdict, the head cannot have moved.**
 * GitHub bumps `updated_at` on a push, a comment and a label change alike, so
 * this is a stricter test than the exact one and it fails in the safe
 * direction — it can only ever say *not yet* about a verdict that does stand,
 * never *passed* about one that does not.
 *
 * ⚠ **AND IT WAS MEASURED BEFORE IT WAS BUILT, ON THE THREE PULL REQUESTS THE
 * RELAY HAD JUST REVIEWED** (2026-09-26): #1322's newest verdict at 03:03:27Z
 * against `updated_at` 03:03:27Z, #1326's at 02:01:51Z against 02:01:51Z,
 * #1316's at 02:28:45Z against 02:28:45Z — equal to the second in all three,
 * with the head commit earlier in all three. The weaker bound answers `fresh`
 * on every real verdict on the board, which is what makes it worth shipping
 * rather than a theory about what GitHub stamps.
 *
 * Its stated limits, both in the under-claiming direction: a label change or
 * any later comment moves `updatedAt` past the verdict and the phrase falls
 * back to *waiting on review*; and a search API that has not yet indexed a push
 * can hand back an `updatedAt` older than it should be, bounded by that index's
 * lag. Neither can cost a merge — `pr-merge-in-order.mts` keeps the exact bound
 * and is the only reader whose answer opens the merge button.
 */
export function handVerdictFreshness(input: {
  /** The newest verdict comment's `created_at`, or `null` when there is none. */
  readonly verdictAt: string | null | undefined;
  /** The pull request's `updatedAt` — the newest thing that happened to it. */
  readonly activityAt: string | null | undefined;
}): HandVerdictFreshness {
  const { verdictAt, activityAt } = input;
  if (typeof verdictAt !== "string" || verdictAt === "") return "none";
  const verdict = Date.parse(verdictAt);
  if (!Number.isFinite(verdict)) return "none";
  const activity = typeof activityAt === "string" ? Date.parse(activityAt) : Number.NaN;
  /* ⚠ AN UNREADABLE CLOCK IS `stale`, NOT `fresh`. A verdict this reader cannot
     date against anything is a verdict it cannot vouch for, and the one thing
     the phrase must never do is tell him a diff has passed when nobody checked
     whether the head moved under it. */
  if (!Number.isFinite(activity)) return "stale";
  return verdict + VERDICT_ACTIVITY_SLACK_MS >= activity ? "fresh" : "stale";
}
