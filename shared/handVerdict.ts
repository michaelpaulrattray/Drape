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

/**
 * ⚠ **THE RELAY'S OTHER HAND COMMENT: A FINDING, WHICH IS NOT A PASS (#1673).**
 *
 * Measured on PR #1649, 2026-10-01. The relay posted
 * `**Fable review — by hand, FINDING (head …) — held; …` — the marker, and then
 * the word that says the opposite of a pass. `isHandVerdict` read the prefix
 * and stopped, so **the comment classified as a fresh verdict**: the build board
 * printed *"passed and merging — PR #1649"* on every pass from 23:46Z to 05:48Z
 * while the pull request sat held, unrepaired and then DIRTY, and every P1 card
 * that builds on #1600 waited behind a card the record called done. Six hours.
 *
 * **The convention from today, and the reader honours BOTH spellings so an old
 * comment cannot flip its meaning under a later rule:**
 *
 * - a VERDICT is headed `**Fable review — by hand** (head …)`;
 * - a FINDING is headed `**Relay finding — HELD** (head …)` and never carries
 *   the verdict marker.
 *
 * The second half of the reader — a verdict-marked comment whose header line
 * also says HELD or FINDING — exists for the comments already on the record,
 * which were written before the convention and must keep reading as what they
 * are. #1649's own has since been re-headed by hand; the one that caused this is
 * the shape, not the instance.
 */
export const HAND_FINDING_MARKER = "**Relay finding";

/**
 * Words that, in a hand comment's HEADER LINE, mean a repair is owed.
 *
 * ⚠ **THE HEADER LINE AND NOWHERE ELSE, AND THAT IS THE WHOLE CONTROL.** A
 * genuine verdict's BODY discusses its findings at length — that is what a
 * verdict is for, and `--acknowledge` exists because its findings must be read.
 * A reader scanning the whole comment for the word *finding* would classify
 * every real verdict as a hold and nothing would ever merge, which is the
 * failure this clause is most likely to be rewritten into.
 */
const FINDING_WORDS: readonly string[] = ["HELD", "FINDING"];

/** The first non-empty line of a comment — what both readers below anchor on. */
function headerLine(body: string): string {
  for (const line of body.split(/\r?\n/)) {
    if (line.trim() !== "") return line;
  }
  return "";
}

/**
 * Is this hand comment a FINDING — a held review with a repair owed (#1673)?
 *
 * ⚠ **IT IS ASKED BEFORE `isHandVerdict` EVERYWHERE, AND `isHandVerdict` NOW
 * REFUSES ITS OWN MARKER WHEN THIS IS TRUE.** The two must be mutually
 * exclusive at the declaration rather than at each call site: three readers ask
 * this question (the merge tool, his Desk, the queue readers) and a caller that
 * forgot the order would merge on a hold. Working law 4 pointed at a pair of
 * predicates instead of a list.
 */
export function isHandFinding(body: string): boolean {
  const head = headerLine(body);
  const trimmed = head.trimStart();
  if (trimmed.startsWith(HAND_FINDING_MARKER)) return true;
  if (!trimmed.startsWith(HAND_VERDICT_MARKER)) return false;
  const upper = head.toUpperCase();
  return FINDING_WORDS.some((word) => upper.includes(word));
}

/**
 * Does this body carry the marker, at the very start (after whitespace)?
 *
 * ⚠ **THE ANCHOR IS DELIBERATE AND IT IS NOT THE DEFECT #1559 FIXED (#1568).**
 * That card repaired two readers of a card body that ordinary markdown defeated,
 * and its sweep found this one with the same shape. It was left alone because
 * **the failure direction is the opposite one**: a released card misread costs a
 * seat's time, while this reader decides whether a pull request has been
 * reviewed. **A false negative holds a reviewed pull request. A false positive
 * MERGES AN UNREVIEWED MONEY/AUTH ONE.** On a merge gate, refusing what it is
 * not sure about is the correct direction.
 *
 * So a verdict written as `## Review of PR #1234` and then the marker is NOT a
 * verdict here, on purpose. The repair for one is to repost the comment with the
 * marker first — the standing orders fix that form, one writer, one shape — and
 * never to loosen this line.
 *
 * ⚠ If it is ever widened anyway, two things travel with it: the population is
 * `shared/crewMarkdownLead.ts`'s `blockOpeningLines` (which already refuses a
 * wrapped paragraph's continuation line), and the AUTHOR GATE stays on both
 * roads — `classifyComment` and `crewCardCommentFact`. Both conditions, and the
 * refusals above, are driven in `server/handVerdictReader.test.ts`.
 */
export function isHandVerdict(body: string): boolean {
  if (!body.trimStart().startsWith(HAND_VERDICT_MARKER)) return false;
  /* ⚠ **A FINDING IS NOT A VERDICT, EVEN WEARING THE VERDICT'S MARKER (#1673).**
     This is the line PR #1649 needed: the header carried the marker and then the
     word `FINDING`, and six hours of the board said *passed and merging* over a
     held pull request. The exclusion lives HERE rather than at each of the three
     call sites, so a reader that has never heard of findings cannot answer yes
     to one. */
  return !isHandFinding(body);
}

/**
 * What a caller was able to establish about a pull request's review.
 *
 * ⚠ **`finding` IS THE FOURTH (#1673): the relay looked and something is
 * WRONG.** It is a distinct answer from `none` (nobody looked) and from `stale`
 * (somebody looked at a different diff), and the board phrase differs on all
 * three. A `stale` FINDING is reported as `stale`, not as `finding`, and that
 * is not a shortcut: the pull request's clock moving past a finding is the
 * repair being pushed, which is exactly when the hold should lift and the row
 * should go back to waiting on review.
 */
export type HandVerdictFreshness = "fresh" | "finding" | "stale" | "none";

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
