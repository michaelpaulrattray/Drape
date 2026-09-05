/**
 * MERGE THE SHIFT'S OPEN PRs IN THE ORDER THEY WERE OPENED — the decision
 * half (#543 item 3, founder-ordered and urgent).
 *
 * WHY IT EXISTS. His order was *"investigate our current process and optimize
 * it as urgent"*, and the investigation found the shift idle for 52% of its
 * mean: 27 minutes median, 42 mean, waiting on a gate with nothing else on the
 * bench. The answer written into the standing orders is OVERLAP — cut a second
 * worktree and take the next card while the first PR's gate runs. That answer
 * creates its own problem, which this module is: two or three PRs in flight at
 * once, each needing its gate watched, each needing main merged in when an
 * earlier one lands, and all of them needing to merge in a fixed order. The
 * card's own words: *"the overlap rule without this is a shift juggling four
 * terminals."*
 *
 * ⚠ WHAT IT DELIBERATELY DOES NOT DO: JUDGE. It never reads a review's
 * findings, never decides a red gate was spurious, never retries anything, and
 * never merges past a verdict a human has not read. Where judgement is
 * required it STOPS and says which PR and why, in the words the shift then
 * uses. The whole value is in removing the WAITING and the BOOKKEEPING, and
 * the moment a tool that merges starts deciding, its cost stops being bounded.
 *
 * THE ORDER OF THE BRANCHES IN `decideMergeAction` IS THE CONTRACT, the way
 * `gateStall.mts`'s is: every cheap, certain refusal is answered before any
 * expensive or ambiguous one, so no clock and no GitHub eventual-consistency
 * window can turn a refusal into a merge.
 *
 * Pure — readings in, actions out, no `gh`, no `git`, no network (law 3). The
 * CLI beside it does the I/O.
 */
import { type ReviewPresence } from "./reviewRounds.mts";

/** What `gate-checks` says on the PR's CURRENT head commit. */
export type GateState = "green" | "red" | "running" | "absent";

export type PrReading = {
  number: number;
  /** ISO. The order opened, which is the merge order. */
  createdAt: string;
  headRefName: string;
  isDraft: boolean;
  /** GitHub's `state`: OPEN | MERGED | CLOSED. */
  state: string;
  /** GitHub's `mergeable`: MERGEABLE | CONFLICTING | UNKNOWN. */
  mergeable: string;
  /** GitHub's `mergeStateStatus`: CLEAN | BEHIND | BLOCKED | DIRTY | UNSTABLE | UNKNOWN. */
  mergeStateStatus: string;
  /** Every path the PR touches, for the shared-file prediction below. */
  files: readonly string[];
  gate: GateState;
  review: ReviewPresence;
  /** The shift passed `--acknowledge <n>`: it has read this PR's verdict. */
  acknowledged: boolean;
  /**
   * The registered `git worktree` holding this branch, or `null`. Merging main
   * into a branch needs a checkout, and this tool refuses to create one — a
   * worktree it did not cut is not one it should take down.
   */
  worktreePath: string | null;
};

export type MergeAction =
  /** Squash-merge it now. */
  | { kind: "merge" }
  /** Nothing to do here; move to the next PR. */
  | { kind: "skip"; reason: string }
  /** Poll again; something is legitimately in flight. */
  | { kind: "wait"; reason: string }
  /** `git merge origin/main` in the named worktree, commit, push. */
  | { kind: "sync-main"; reason: string; worktreePath: string }
  /** A human decision is required. Print it and exit; never guess. */
  | { kind: "stop"; reason: string };

/**
 * The self-skip case (#165): a PR whose diff touches the reviewer's own
 * workflow can never earn a green review — claude-code-action refuses to run
 * on it, the review job fails honestly, and `gate.yml` labels the PR
 * `review-skipped` with a hand-review obligation. That obligation is a
 * judgement, so this tool stops on it and takes `--acknowledge` as the answer.
 */
export const REVIEWER_WORKFLOW_PATH = ".github/workflows/review.yml";

/**
 * ⚠ THE MONEY/AUTH PATTERN IS EXTRACTED FROM `review.yml`, NEVER COPIED.
 *
 * A second copy of a rule always drifts from the first (working law 4), and
 * this particular rule decides whether a PR with no reviewer verdict may
 * merge — the exact place a silent drift costs the most. `review.yml` declares
 * it once, on a line of the form:
 *
 *     MONEY='^server/routes/(billing|credits|auth|…)|…'
 *
 * The extraction REFUSES rather than returning a default when the shape moves,
 * because a pattern that quietly matches nothing would let every money PR
 * through as ordinary. `server/prMergeOrder.test.ts` runs it against the real
 * workflow file, so a rename reddens the suite instead of the gate.
 */
export function extractMoneyPattern(reviewYmlText: string): string {
  const match = /^\s*MONEY='([^']+)'\s*$/m.exec(reviewYmlText);
  if (!match) {
    throw new Error(
      `could not find the MONEY='…' line in ${REVIEWER_WORKFLOW_PATH}. It is the ` +
        `single declaration of which diffs are money/auth diffs, and this tool ` +
        `refuses to guess at one rather than mirror it (working law 4).`,
    );
  }
  return match[1]!;
}

/** Does this PR touch a money/auth surface, by the reviewer's own pattern? */
export function touchesMoney(files: readonly string[], moneyPattern: string): boolean {
  const re = new RegExp(moneyPattern);
  return files.some((f) => re.test(f));
}

export function touchesReviewerWorkflow(files: readonly string[]): boolean {
  return files.includes(REVIEWER_WORKFLOW_PATH);
}

/** The merge order is the order opened; the number breaks a same-second tie. */
export function orderByOpened(prs: readonly PrReading[]): PrReading[] {
  return [...prs].sort((a, b) => {
    const d = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return d !== 0 ? d : a.number - b.number;
  });
}

/**
 * Whether a later PR will need main merged into it once an earlier one lands.
 *
 * ⚠ IN THIS REPOSITORY THE ANSWER IS ALMOST ALWAYS YES, AND THAT IS BY
 * DESIGN, NOT A BUG IN THE PREDICTOR. The pre-commit hook regenerates both
 * generated maps on any commit touching a path they are built from (#501), so
 * two concurrent branches nearly always both carry
 * `docs/architecture/drape-architecture.json`. That is exactly why PR #550
 * went CONFLICTING the moment #549 merged. The predictor is here so the tool
 * can say WHY before GitHub has finished recomputing `mergeable`; the
 * artifact — `mergeable: CONFLICTING` / `mergeStateStatus: BEHIND` — is what
 * actually triggers the sync, because a report is a claim and the artifact is
 * the fact (working law 1).
 */
export function sharesFiles(a: readonly string[], b: readonly string[]): string[] {
  const set = new Set(a);
  return b.filter((f) => set.has(f)).sort();
}

export type MergeContext = {
  /** From `extractMoneyPattern`, so the money rule cannot drift. */
  moneyPattern: string;
};

/**
 * THE DECISION. Branch order is the contract — read the module header.
 */
export function decideMergeAction(pr: PrReading, ctx: MergeContext): MergeAction {
  // 1. Already resolved. Nothing here can be waited on or acted on.
  if (pr.state === "MERGED") return { kind: "skip", reason: "already merged" };
  if (pr.state !== "OPEN") {
    return { kind: "skip", reason: `state is ${pr.state}, not OPEN — nothing to merge` };
  }

  // 2. A draft is the shift itself saying the diff is not finished, and it is
  //    also what suppresses the reviewer. Marking it ready is a judgement
  //    (it spends a review round), so it is never done from here.
  if (pr.isDraft) {
    return {
      kind: "stop",
      reason:
        "it is a DRAFT. Marking a PR ready spends a review round, so it is the shift's " +
        `act: \`gh pr ready ${pr.number}\` when the diff is finished, then re-run.`,
    };
  }

  // 3. The gate, before anything that costs a network round trip or a clock.
  if (pr.gate === "running") {
    return { kind: "wait", reason: "gate-checks is running" };
  }
  if (pr.gate === "red") {
    return {
      kind: "stop",
      reason:
        "gate-checks FAILED. This tool never retries a gate and never merges past one — " +
        "read the run, fix it, push. `pnpm preflight` catches the cheap causes before the push.",
    };
  }
  if (pr.gate === "absent") {
    return {
      kind: "wait",
      reason:
        "no gate-checks run on this head commit yet. " +
        `\`gate-stall-check --pr ${pr.number} --watch\` is the reading that tells a slow ` +
        "start from one that will never arrive (#368).",
    };
  }

  // 4. The reviewer. Green is not a pass (#219): a verdict exists to be READ,
  //    and reading it is the one thing here that is not mechanical.
  if (pr.review === "verdict" && !pr.acknowledged) {
    return {
      kind: "stop",
      reason:
        "a Fable verdict exists and has not been acknowledged. A GREEN review reports that a " +
        "review was PRODUCED, never that the diff passed — its findings ride the sticky " +
        `comment. Read it, then re-run with --acknowledge ${pr.number}.`,
    };
  }
  if (pr.review === "no-verdict") {
    if (touchesReviewerWorkflow(pr.files) && !pr.acknowledged) {
      return {
        kind: "stop",
        reason:
          `it touches ${REVIEWER_WORKFLOW_PATH}, so the reviewer self-skips and NO review can ` +
          "run (#165). That is a hand-review obligation, not a rejection: review the change " +
          `yourself, then re-run with --acknowledge ${pr.number}.`,
      };
    }
    if (touchesMoney(pr.files, ctx.moneyPattern) && !pr.acknowledged) {
      return {
        kind: "stop",
        reason:
          "it touches a money/auth surface and NO reviewer verdict exists. The standing orders " +
          "merge an ordinary PR on the gate alone when the reviewer is down, and hold a " +
          "money/auth one. Get a verdict (remove then re-add `needs-fable`, #368) or " +
          `hand-review it and re-run with --acknowledge ${pr.number}.`,
      };
    }
  }

  // 5. Mergeability. UNKNOWN is GitHub still computing, which it always is for
  //    a few seconds after a merge lands on main — waiting is the correct
  //    reading of it, and treating it as clean is how a tool merges a conflict.
  if (pr.mergeable === "CONFLICTING" || pr.mergeStateStatus === "DIRTY") {
    return syncOrStop(
      pr,
      "it is CONFLICTING with main — in this repository that is nearly always the two " +
        "generated maps, which the merge driver and the pre-commit hook resolve on the " +
        "merged tree (#100/#501)",
    );
  }
  if (pr.mergeStateStatus === "BEHIND") {
    return syncOrStop(pr, "it is BEHIND main and the branch must be updated before it merges");
  }
  if (pr.mergeable === "UNKNOWN" || pr.mergeStateStatus === "UNKNOWN") {
    return {
      kind: "wait",
      reason: "GitHub has not finished computing mergeability (mergeable=UNKNOWN)",
    };
  }
  if (pr.mergeStateStatus === "BLOCKED") {
    return {
      kind: "stop",
      reason:
        "branch protection reports BLOCKED with the gate green — a required check is still " +
        "missing or a review is required. Read the PR's own checks page; this tool will not " +
        "merge past branch protection.",
    };
  }

  return { kind: "merge" };
}

function syncOrStop(pr: PrReading, why: string): MergeAction {
  if (pr.worktreePath === null) {
    return {
      kind: "stop",
      reason:
        `${why}, but no registered git worktree holds ${pr.headRefName}, so there is nowhere ` +
        "to merge main in. This tool never cuts a worktree it would then have to take down: " +
        `\`npx tsx scripts/shift-worktree.mts add ${pr.headRefName.replace(/^team\//, "")}\`, ` +
        "merge main there, push, and re-run.",
    };
  }
  return { kind: "sync-main", reason: why, worktreePath: pr.worktreePath };
}

/** One line, in the words the mailbox entry and the briefing use. */
export function describeAction(pr: PrReading, action: MergeAction): string {
  switch (action.kind) {
    case "merge":
      return `#${pr.number} MERGE — gate green, nothing unread, mergeable.`;
    case "skip":
      return `#${pr.number} SKIP — ${action.reason}.`;
    case "wait":
      return `#${pr.number} WAIT — ${action.reason}.`;
    case "sync-main":
      return `#${pr.number} SYNC MAIN — ${action.reason}. Worktree: ${action.worktreePath}`;
    case "stop":
      return `#${pr.number} STOP — ${action.reason}`;
  }
}
