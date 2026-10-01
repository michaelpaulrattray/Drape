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
export { HAND_FINDING_MARKER, HAND_VERDICT_MARKER, isHandFinding, isHandVerdict } from "../../shared/handVerdict.js";
import { isHandFinding, isHandVerdict } from "../../shared/handVerdict.js";

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

/**
 * What a single comment is, for this PR.
 *
 * ⚠ **`finding` IS THE FOURTH AND IT IS THE OPPOSITE OF A PASS (#1673).** The
 * relay's hand comment comes in two kinds — *I read this and it is fine* and *I
 * read this and here is what is wrong* — and until 2026-10-01 this reader had a
 * word for only the first. On PR #1649 the second wore the first's marker
 * (`**Fable review — by hand, FINDING … held`) and classified as a fresh
 * verdict; `shared/handVerdict.ts` carries the measurement and the convention.
 *
 * A STALE finding is a finding whose repair has already been pushed — the head
 * moved under it — so it holds nothing and is not counted toward anything. It is
 * kept apart from `not-a-verdict` only so the tally can report it.
 */
export type VerdictKind =
  | "verdict"
  | "stale-verdict"
  | "finding"
  | "stale-finding"
  | "not-a-verdict";

export function classifyComment(comment: HandVerdictReading, pr: PrIdentity): VerdictKind {
  if (comment.authorLogin !== pr.ownerLogin) return "not-a-verdict";
  const finding = isHandFinding(comment.body);
  /* `isHandVerdict` already refuses a finding wearing the verdict's marker, so
     these two can never both be true; asking the finding first is belt and
     braces at the one site where a mistake merges something. */
  if (!finding && !isHandVerdict(comment.body)) return "not-a-verdict";
  const at = new Date(comment.createdAt).getTime();
  if (at < new Date(pr.createdAt).getTime()) return "not-a-verdict";
  // A verdict posted BEFORE the current head was committed read a different
  // diff. `<` rather than `<=`: a verdict and a commit in the same second is
  // the relay pushing and posting inside one sitting, and it read the push.
  if (at < new Date(pr.headCommittedAt).getTime()) {
    return finding ? "stale-finding" : "stale-verdict";
  }
  return finding ? "finding" : "verdict";
}

export type RoundTally = {
  /** Fresh verdicts — on the current head — oldest first. */
  verdicts: readonly HandVerdictReading[];
  /** Verdicts on an earlier head. Counted for acknowledgement, never merged on. */
  stale: readonly HandVerdictReading[];
  /** Fresh findings — on the current head, repair owed — oldest first (#1673). */
  findings: readonly HandVerdictReading[];
  /**
   * Findings on an earlier head: the repair was pushed, so they hold nothing.
   *
   * ⚠ **THEY ARE DELIBERATELY NOT IN `stale`.** That list feeds
   * `verdictCount`, which is what an `--acknowledge` is pinned to — *"a word
   * said for a verdict that was read"*. A finding is not a verdict and must
   * never raise the count a shift's acknowledgement is measured against.
   */
  staleFindings: readonly HandVerdictReading[];
};

/**
 * Tally every comment for one PR. Sorted oldest-first so "the second verdict"
 * is `verdicts[1]` and never depends on GitHub's listing order.
 */
export function tallyRounds(comments: readonly HandVerdictReading[], pr: PrIdentity): RoundTally {
  const verdicts: HandVerdictReading[] = [];
  const stale: HandVerdictReading[] = [];
  const findings: HandVerdictReading[] = [];
  const staleFindings: HandVerdictReading[] = [];
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
      case "finding":
        findings.push(comment);
        break;
      case "stale-finding":
        staleFindings.push(comment);
        break;
      case "not-a-verdict":
        break;
    }
  }
  return { verdicts, stale, findings, staleFindings };
}

/**
 * THE MERGE QUESTION. Does an unread verdict, or the absence of one, stand
 * between this PR and the merge button?
 *
 *   "verdict"     a fresh hand verdict exists on the current head. Green is
 *                 never a pass: its findings are in the comment and must be
 *                 read (`--acknowledge`).
 *   "finding"     the relay's newest hand comment on this head is a FINDING —
 *                 it was read and something is wrong. A repair is owed and no
 *                 acknowledgement can stand in for it (#1673).
 *   "no-verdict"  a review is OWED (triage labelled it, or the caller's own
 *                 money reading says so) and no fresh verdict exists. Per the
 *                 standing orders an ORDINARY PR still merges on the gate
 *                 alone; a money/auth one waits for the relay's sitting, and
 *                 the caller owns that half because it knows the files.
 *   "declined"    nobody owes this diff a look — no label, and the caller's
 *                 money reading is empty. The four mechanical checks are the
 *                 whole bar, and that is the design working.
 */
export type ReviewPresence = "verdict" | "finding" | "no-verdict" | "declined";

/**
 * ⚠ **A FINDING OUTRANKS EVERYTHING, INCLUDING `reviewOwed` (#1673).** If the
 * relay has said in as many words that something is wrong, the repair is owed
 * whatever triage thought about whether this diff earned a look at all — so a
 * fresh finding on an ORDINARY pull request holds it too, even though an
 * ordinary pull request merges on the gate alone.
 *
 * ⚠ **AND THE NEWEST HAND COMMENT IS WHAT DECIDES, WHICH IS THE WHOLE ORDER
 * QUESTION.** A finding followed by a later verdict on the same head is the
 * normal road — the relay found something, it was repaired, the relay came back
 * — and it merges. A verdict followed by a later finding on the same head is the
 * relay changing its mind, and it does NOT. **A tie goes to the finding**,
 * because the two directions are not symmetric: holding a mergeable pull request
 * costs a sitting, and merging a held one is what cost six hours of the pricing
 * chain.
 */
export function reviewPresence(tally: RoundTally, reviewOwed: boolean): ReviewPresence {
  const newestVerdict = tally.verdicts[tally.verdicts.length - 1];
  const newestFinding = tally.findings[tally.findings.length - 1];
  if (newestFinding !== undefined) {
    if (newestVerdict === undefined) return "finding";
    const findingAt = new Date(newestFinding.createdAt).getTime();
    const verdictAt = new Date(newestVerdict.createdAt).getTime();
    /* An unreadable clock on either side is a tie, and a tie is a finding. */
    if (!(verdictAt > findingAt)) return "finding";
  }
  if (newestVerdict !== undefined) return "verdict";
  return reviewOwed ? "no-verdict" : "declined";
}
