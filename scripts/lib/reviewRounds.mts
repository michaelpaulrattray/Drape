/**
 * IS THERE A VERDICT ON THIS PULL REQUEST, AND IS IT FRESH? (#1065 — the relay
 * IS the reviewer; #543 item 3 is the question this still answers.)
 *
 * ⚠ THE REVIEWER IS A PERSON NOW, NOT A WORKFLOW RUN. His ruling, verbatim
 * (2026-09-22, terminal): *"You are the new outside reviewer the outfit
 * reviewer is permanently dead and will not come back."* Until that day this
 * module tallied `review.yml` workflow runs and read the conclusion of a job
 * named `review` — a design whose whole difficulty was telling "the action
 * ran and judged" from "the action ran and died" (#219, #434, #165, #566).
 * That difficulty is gone with the action. What is left is simpler and it is
 * the road every one of 2026-09-22's eleven merges actually took:
 *
 *   A VERDICT IS A PULL-REQUEST COMMENT, BY THE FOUNDER'S ACCOUNT, WHOSE BODY
 *   BEGINS WITH `**Fable review — by hand`, POSTED AFTER THE HEAD COMMIT.
 *
 * Three consequences, each of which an arm in `server/prMergeOrder.test.ts`
 * pins:
 *
 *   - A push after the verdict makes it STALE. A verdict is on a diff, not on
 *     a PR; a head that moved has not been read. Stale verdicts still count
 *     toward `verdictCount` (an acknowledgement is pinned to what was read,
 *     #558 finding 6) but they do not satisfy the merge.
 *   - A comment by any other account is NOT a verdict, whatever it says. The
 *     relay posts as the founder's account and so does every shift, so this
 *     reader cannot tell a shift from the relay — the standing orders carry
 *     the line "a shift never posts a hand verdict", and the retro reads for
 *     it. The author check is the floor, not the fence.
 *   - "Declined" is no longer a run's job being `skipped`; it is triage's own
 *     verdict, carried on the PR as the `needs-fable` label: a diff that earns
 *     a review is labelled at open (money/auth, ≥50 code lines, or an
 *     escalation), and a diff without the label owes nobody a look — the four
 *     mechanical checks are the whole bar. The caller computes the money half
 *     itself as well (working law 4: the money rule is read from ONE file),
 *     so a money diff someone un-labelled is still held.
 *
 * `pending` and `absent` are RETIRED states. There is no machine in flight to
 * wait on, and nothing that can fail to be created; a PR either carries a
 * fresh verdict or it does not.
 *
 * Pure: readings in, verdicts out. Every `gh` call lives in the CLI, so the
 * whole decision is driveable without a network (law 3).
 */

/**
 * ⚠ **THE MARKER AND THE TEST MOVED TO `shared/handVerdict.ts` (#1094) AND ARE
 * RE-EXPORTED HERE, NOT RE-DECLARED.** His Desk needs the same fact — *has this
 * pull request been reviewed?* — and `shared/` is the only place the server and
 * the client may both read. Every existing importer of this module keeps its
 * import path; there is one spelling of the marker.
 */
export { HAND_VERDICT_MARKER, isHandVerdict } from "../../shared/handVerdict.js";
import { isHandVerdict } from "../../shared/handVerdict.js";

/** One issue comment on the PR, reduced to what the decision uses. */
export type HandVerdictReading = {
  id: number;
  /** GitHub login of the comment's author. */
  authorLogin: string;
  /** ISO, GitHub's `created_at`. */
  createdAt: string;
  body: string;
};

export type PrIdentity = {
  number: number;
  headRefName: string;
  /** ISO. A comment older than the PR cannot be a verdict on it. */
  createdAt: string;
  /** ISO, the committer date of the PR's CURRENT head commit. */
  headCommittedAt: string;
  /** The one account whose comments count: the repository owner's. */
  ownerLogin: string;
};

/** What a single comment is, for this PR. */
export type VerdictKind = "verdict" | "stale-verdict" | "not-a-verdict";

export function classifyComment(comment: HandVerdictReading, pr: PrIdentity): VerdictKind {
  if (comment.authorLogin !== pr.ownerLogin) return "not-a-verdict";
  if (!isHandVerdict(comment.body)) return "not-a-verdict";
  const at = new Date(comment.createdAt).getTime();
  if (at < new Date(pr.createdAt).getTime()) return "not-a-verdict";
  // A verdict posted BEFORE the current head was committed read a different
  // diff. `<` rather than `<=`: a verdict and a commit in the same second is
  // the relay pushing and posting inside one sitting, and it read the push.
  if (at < new Date(pr.headCommittedAt).getTime()) return "stale-verdict";
  return "verdict";
}

export type RoundTally = {
  /** Fresh verdicts — on the current head — oldest first. */
  verdicts: readonly HandVerdictReading[];
  /** Verdicts on an earlier head. Counted for acknowledgement, never merged on. */
  stale: readonly HandVerdictReading[];
};

/**
 * Tally every comment for one PR. Sorted oldest-first so "the second verdict"
 * is `verdicts[1]` and never depends on GitHub's listing order.
 */
export function tallyRounds(comments: readonly HandVerdictReading[], pr: PrIdentity): RoundTally {
  const verdicts: HandVerdictReading[] = [];
  const stale: HandVerdictReading[] = [];
  const ordered = [...comments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  for (const comment of ordered) {
    switch (classifyComment(comment, pr)) {
      case "verdict":
        verdicts.push(comment);
        break;
      case "stale-verdict":
        stale.push(comment);
        break;
      case "not-a-verdict":
        break;
    }
  }
  return { verdicts, stale };
}

/**
 * THE MERGE QUESTION. Does an unread verdict, or the absence of one, stand
 * between this PR and the merge button?
 *
 *   "verdict"     a fresh hand verdict exists on the current head. Green is
 *                 never a pass: its findings are in the comment and must be
 *                 read (`--acknowledge`).
 *   "no-verdict"  a review is OWED (triage labelled it, or the caller's own
 *                 money reading says so) and no fresh verdict exists. Per the
 *                 standing orders an ORDINARY PR still merges on the gate
 *                 alone; a money/auth one waits for the relay's sitting, and
 *                 the caller owns that half because it knows the files.
 *   "declined"    nobody owes this diff a look — no label, and the caller's
 *                 money reading is empty. The four mechanical checks are the
 *                 whole bar, and that is the design working.
 */
export type ReviewPresence = "verdict" | "no-verdict" | "declined";

export function reviewPresence(tally: RoundTally, reviewOwed: boolean): ReviewPresence {
  if (tally.verdicts.length > 0) return "verdict";
  return reviewOwed ? "no-verdict" : "declined";
}
