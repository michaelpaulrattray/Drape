/**
 * DID A REVIEW ACTUALLY PRODUCE A VERDICT, AND HOW MANY TIMES? (#543 items 3
 * and 5.)
 *
 * Two different shift questions share one reading, so they cannot drift into
 * two answers (working law 4):
 *
 *   item 3 — "may this PR be merged, or is there a verdict nobody has read?"
 *   item 5 — "is this the second and final review round for this PR?"
 *
 * ⚠ THE OBVIOUS SOURCES WERE BOTH PROBED AND BOTH FAIL, WHICH IS WHY THIS
 * MODULE EXISTS RATHER THAN A ONE-LINE `gh` FILTER (measured 2026-09-05):
 *
 *   1. `gh pr view --json statusCheckRollup` reports the checks on the PR's
 *      CURRENT HEAD COMMIT only. The reviewer runs once, at `opened` or
 *      `ready_for_review`, and every fix round after it moves the head — so a
 *      PR that was reviewed twice shows NO `review` check at all once its
 *      last fix lands. Read at PR #550, which had two verdicts and an empty
 *      review rollup on its merge commit. Reading verdicts off the rollup
 *      answers "was the head commit reviewed", which is not the question.
 *   2. A workflow run's `pull_requests` array is the documented association
 *      and is EMPTY on every one of the last 100 `review.yml` runs in this
 *      repository. GitHub populates it only in some cases; ours is not one.
 *
 *   So the association is by HEAD BRANCH, bounded below by the PR's own
 *   creation time. Its one limit, stated rather than discovered: a REUSED
 *   branch name would over-count, which the time bound reduces to "the same
 *   branch name re-opened as a second PR while the first still exists". The
 *   team's `team/<slug>` naming makes that improbable and not impossible.
 *
 * ⚠ AND A RUN'S CONCLUSION DOES NOT ANSWER "WAS THERE A VERDICT" EITHER. A
 * `review.yml` run concludes `success` both when the reviewer read the diff
 * and when TRIAGE DECLINED it (docs-only, under 50 code lines) — the two
 * outcomes this repository's `review` check most needs told apart (#219: the
 * check reports whether a verdict EXISTS, never whether the diff passed). The
 * only thing that separates them is the run's JOB list, so that is what is
 * read:
 *
 *   review job `success`              → A VERDICT EXISTS. Green is not a pass:
 *                                       the findings ride the sticky comment.
 *   review job `skipped`              → triage declined; no review was earned.
 *   review job `failure`/`cancelled`  → NO VERDICT (#165 self-skip, #219 the
 *                                       allowance running out, #434 a
 *                                       superseded run). Nothing was judged.
 *   no review job at all              → NO VERDICT, reported as such.
 *
 * Pure: it takes readings and returns verdicts. Every `gh` call lives in the
 * CLIs, so the whole decision is driveable without a network (law 3).
 */

/** One `review.yml` workflow run, reduced to what the decision uses. */
export type ReviewRunReading = {
  id: number;
  /** GitHub's `head_branch` on the run. */
  headBranch: string;
  /** ISO, GitHub's `created_at`. */
  createdAt: string;
  /**
   * The conclusion of the job NAMED `review` in that run, or `null` when the
   * run holds no such job. `skipped` is a real value here and means triage
   * declined — it is not the same as absent.
   */
  reviewJobConclusion: string | null;
};

export type PrIdentity = {
  number: number;
  headRefName: string;
  /** ISO. A run older than the PR cannot be a round of it. */
  createdAt: string;
};

/** What a single run was, for this PR. */
export type RoundKind = "verdict" | "declined" | "no-verdict" | "not-this-pr";

export function classifyRun(run: ReviewRunReading, pr: PrIdentity): RoundKind {
  if (run.headBranch !== pr.headRefName) return "not-this-pr";
  if (new Date(run.createdAt).getTime() < new Date(pr.createdAt).getTime()) return "not-this-pr";
  switch (run.reviewJobConclusion) {
    case "success":
      return "verdict";
    case "skipped":
      return "declined";
    case null:
      return "no-verdict";
    default:
      // failure, cancelled, timed_out, action_required — every one of them is
      // "nothing was judged", and each has its own recorded cause
      // (#165 self-skip, #219 the allowance, #434 a superseded run).
      return "no-verdict";
  }
}

export type RoundTally = {
  /** Runs that produced a reviewer verdict, oldest first. */
  verdicts: readonly ReviewRunReading[];
  /** Runs whose review job ran and failed to produce one. */
  noVerdicts: readonly ReviewRunReading[];
  /** Runs triage declined. */
  declined: readonly ReviewRunReading[];
};

/**
 * Tally every run for one PR. Sorted oldest-first so "the second verdict" is
 * `verdicts[1]` and never depends on GitHub's listing order.
 */
export function tallyRounds(runs: readonly ReviewRunReading[], pr: PrIdentity): RoundTally {
  const verdicts: ReviewRunReading[] = [];
  const noVerdicts: ReviewRunReading[] = [];
  const declined: ReviewRunReading[] = [];
  const ordered = [...runs].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  for (const run of ordered) {
    switch (classifyRun(run, pr)) {
      case "verdict":
        verdicts.push(run);
        break;
      case "no-verdict":
        noVerdicts.push(run);
        break;
      case "declined":
        declined.push(run);
        break;
      case "not-this-pr":
        break;
    }
  }
  return { verdicts, noVerdicts, declined };
}

/**
 * THE MERGE QUESTION (item 3). Does an unread verdict stand between this PR
 * and the merge button?
 *
 *   "verdict"     at least one reviewer verdict exists. The standing orders
 *                 are explicit that a GREEN review is not a pass — its
 *                 findings ride the sticky comment and must be read.
 *   "no-verdict"  the reviewer was owed a look and produced none. Per the
 *                 standing orders this does NOT hold a PR whose gate is
 *                 green — EXCEPT on a money/auth diff, and the caller owns
 *                 that half because it is the caller that knows the files.
 *   "none"        triage declined, or the reviewer was never invoked. The
 *                 four mechanical checks are the whole bar.
 */
export type ReviewPresence = "verdict" | "no-verdict" | "none";

export function reviewPresence(tally: RoundTally): ReviewPresence {
  if (tally.verdicts.length > 0) return "verdict";
  if (tally.noVerdicts.length > 0) return "no-verdict";
  return "none";
}

/**
 * THE CAP (item 5, founder-ordered #543): the second review round is the last.
 *
 * The measurement behind it: over the last 25 merged PRs the reviewer ran 1.3
 * times per PR, but 7 of 25 took two or more rounds — and that tail is the
 * whole gap between the 27-minute median wait and the 42-minute mean. A third
 * round means the change is not understood: stop, card it with the reviewer's
 * words, and move on.
 *
 * ⚠ IT COUNTS VERDICTS, NEVER ATTEMPTS, AND THAT IS THE DESIGN DECISION IN
 * THIS FUNCTION. A run that produced no verdict — the allowance running out
 * (#219), a cancelled run (#434), the reviewer refusing its own change (#165)
 * — judged nothing. Counting it would let an OUTAGE spend one of the two
 * rounds a shift is allowed, which is the opposite of what the cap is for.
 */
export type RoundNotice =
  | { kind: "silent"; verdictsSoFar: number }
  | { kind: "final-round"; verdictsSoFar: number; message: string };

export const FINAL_ROUND_MESSAGE =
  "This is the second and final review round; a further push is not reviewed " +
  "automatically — card it. A third look is deliberate: remove and re-add the " +
  "`needs-fable` label (it is a one-shot button, #368). The cap is #543's: " +
  "read the whole verdict and take EVERY finding in ONE push.";

/**
 * `verdictsIncludingThisRun` is the count AFTER this run's own verdict is
 * added — the notice is posted by the run that produced the second one.
 */
export function decideRoundNotice(verdictsIncludingThisRun: number): RoundNotice {
  if (verdictsIncludingThisRun >= 2) {
    return {
      kind: "final-round",
      verdictsSoFar: verdictsIncludingThisRun,
      message: FINAL_ROUND_MESSAGE,
    };
  }
  return { kind: "silent", verdictsSoFar: verdictsIncludingThisRun };
}
