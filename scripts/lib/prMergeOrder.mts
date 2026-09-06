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
  /** How many reviewer verdicts exist for this PR right now. */
  verdictCount: number;
  /**
   * ⚠ AN ACKNOWLEDGEMENT IS PINNED TO WHAT WAS READ, NOT TO THE PR.
   *
   * The verdict count at the moment `--acknowledge <n>` was honoured, or
   * `null` when the shift did not acknowledge this PR. The first shape of this
   * field was a plain boolean fixed at process start, and the gate review of
   * PR #558 named the hole: this tool can run for 45 minutes, so a SECOND
   * verdict landing mid-run — a `needs-fable` re-add, or a review that was
   * still in flight when the shift acknowledged — was auto-waived by an
   * acknowledgement given before it existed. `--acknowledge` says "I have read
   * what is there", and a number is the only honest record of what "there"
   * meant.
   */
  acknowledgedAtVerdictCount: number | null;
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

/**
 * ⚠ THE CHECK NAMES THIS TOOL KEYS ON ARE DERIVED FROM THE WORKFLOW FILES.
 *
 * The gate review of PR #558 found the first shape mirroring them — `"review"`
 * and `"gate-checks"` as literals, with the suite header claiming an arm read
 * them from source when none did. The `review` one fails in the SILENT,
 * PERMISSIVE direction, which is the direction that costs: rename that job and
 * every run reads as "no verdict" forever, so ordinary PRs with real verdicts
 * merge unread and nothing anywhere reddens.
 *
 * A workflow's check name is the job's `name:` if it declares one, else the job
 * key. This returns every job name a workflow declares, so the caller can
 * REFUSE at startup when the name it needs is not among them — a fail-closed
 * check rather than a second copy of a string.
 */
export function extractJobNames(workflowYaml: string): string[] {
  const lines = workflowYaml.split(/\r?\n/);
  const start = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  if (start === -1) {
    throw new Error("workflow declares no top-level `jobs:` block — read it by hand");
  }
  const names: string[] = [];
  let key: string | null = null;
  let named = false;
  const flush = () => {
    if (key !== null && !named) names.push(key);
    key = null;
    named = false;
  };
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line) && line.trim() !== "") break; // back to top level
    const jobKey = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (jobKey) {
      flush();
      key = jobKey[1]!;
      continue;
    }
    const jobName = /^ {4}name:\s*(.+?)\s*$/.exec(line);
    if (jobName && key !== null && !named) {
      names.push(jobName[1]!.replace(/^["']|["']$/g, ""));
      named = true;
    }
  }
  flush();
  if (names.length === 0) throw new Error("workflow declares no jobs — read it by hand");
  return names;
}

/**
 * Refuse at startup rather than reading a renamed job as an absent one.
 * Returns a refusal reason, or `null` when the name is declared.
 */
export function refuseUnknownJobName(
  needed: string,
  declared: readonly string[],
  workflowPath: string,
): string | null {
  if (declared.includes(needed)) return null;
  return (
    `${workflowPath} declares no job named \`${needed}\` — it declares ` +
    `${declared.map((n) => `\`${n}\``).join(", ")}. This tool keys on that name, and reading a ` +
    `renamed job as an absent one fails SILENTLY in the permissive direction, so it refuses ` +
    `instead. Update the constant beside the rename.`
  );
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
  //
  //    4a. IN FLIGHT IS NOT DOWN, and it comes first. The gate finishes while
  //    a PR is still a draft; `gh pr ready` then starts the review and starts
  //    NO new gate run — so "green gate, review mid-run" is the team's routine
  //    first-round state, not a tail case, and reading it as "no verdict" is
  //    how this tool would have merged past a review by default (#558 review,
  //    finding 1).
  if (pr.review === "pending") {
    return { kind: "wait", reason: "a Fable review is IN FLIGHT — in flight is not down" };
  }
  if (pr.review === "verdict") {
    if (pr.acknowledgedAtVerdictCount === null) {
      return {
        kind: "stop",
        reason:
          "a Fable verdict exists and has not been acknowledged. A GREEN review reports that a " +
          "review was PRODUCED, never that the diff passed — its findings ride the sticky " +
          `comment. Read it, then re-run with --acknowledge ${pr.number}.`,
      };
    }
    if (pr.acknowledgedAtVerdictCount < pr.verdictCount) {
      return {
        kind: "stop",
        reason:
          `a NEWER verdict landed after your acknowledgement (${pr.verdictCount} verdicts now, ` +
          `${pr.acknowledgedAtVerdictCount} when you acknowledged). An acknowledgement is pinned ` +
          "to what was read, not to the PR. Read the newest sticky comment and re-run.",
      };
    }
  }
  // 4b. No verdict at all. Two populations are held rather than merged, and
  //     the second of them keys on `none` as well as on `no-verdict`: triage
  //     honours a `skip-review` label BEFORE it tests the money pattern, so a
  //     stale label on a PR that later gains a money file produces a money
  //     diff with a DECLINED review and no verdict anywhere (#558 review,
  //     finding 5). Where a human used to click merge, this tool now does.
  if (pr.review === "no-verdict" || pr.review === "none") {
    const acknowledged = pr.acknowledgedAtVerdictCount !== null;
    // ⚠ THIS STOP COVERS `none` AS WELL AS `no-verdict`, and the round-three
    //    review of #558 is why: the round-two fix taught the MONEY hold that
    //    lesson and left its sibling one clause away — working law 7's own
    //    shape, a class fixed at one of its two members. Two roads reach a
    //    `review.yml` PR with presence `none`: a stale `skip-review` label
    //    (triage honours it BEFORE the self-skip check), and a triage-job
    //    outage, which skips the review job through unmet `needs` and requires
    //    no label at all. Either one would have merged the reviewer's own
    //    workflow with no verdict and no hand review.
    if (touchesReviewerWorkflow(pr.files) && !acknowledged) {
      return {
        kind: "stop",
        reason:
          `it touches ${REVIEWER_WORKFLOW_PATH}, so the reviewer self-skips and NO review can ` +
          "run (#165). That is a hand-review obligation, not a rejection: review the change " +
          `yourself, then re-run with --acknowledge ${pr.number}.`,
      };
    }
    if (touchesMoney(pr.files, ctx.moneyPattern) && !acknowledged) {
      return {
        kind: "stop",
        reason:
          "it touches a money/auth surface and NO reviewer verdict exists" +
          (pr.review === "none" ? " (triage declined it — check for a stale `skip-review` label)" : "") +
          ". The standing orders merge an ordinary PR on the gate alone when the reviewer is " +
          "down, and hold a money/auth one. Get a verdict (remove then re-add `needs-fable`, " +
          `#368) or hand-review it and re-run with --acknowledge ${pr.number}.`,
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
  // ⚠ UNSTABLE is deliberately NOT a hold, and the reason is written down
  //    because the #558 review raised it as the thing that failed to rescue
  //    finding 1. It means a NON-REQUIRED check is pending or red — and in
  //    this repository the usual non-required check is `review`, which is red
  //    BY DESIGN on any PR touching the reviewer's own workflow (#165). Holding
  //    on UNSTABLE would deadlock exactly those PRs forever. The two states it
  //    stands for are both read at their own source instead: the gate directly,
  //    and the review through `pending`/`verdict` above.
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

/**
 * ⚠ THE PUSH THIS TOOL PERFORMS CAN NEVER BE A PUSH TO `main`, AND THAT IS
 * MADE STRUCTURAL HERE RATHER THAN ARGUED IN A COMMENT.
 *
 * `syncMain` runs a bare `git push` inside a worktree, which pushes that
 * worktree's CURRENT branch. Every reachable path sets that worktree from a
 * PR's own head branch, and a PR's head is never `main` — but "never by
 * construction elsewhere" is exactly the shape of reasoning the enumerated
 * push-path list exists to distrust (#263, and the founder's bar: the answer
 * must come from a search, not an assumption). So the branch is READ back
 * immediately before the push and compared against the refs
 * `.githooks/pre-push` guards, derived from the hook itself rather than
 * restated (`readProtectedRefs`, working law 4).
 *
 * The deploy rite remains the only door to main. This is the lock that keeps
 * that sentence true of this file.
 */
export function refuseProtectedPush(
  currentBranch: string,
  protectedRefs: readonly string[],
): string | null {
  if (!protectedRefs.includes(currentBranch)) return null;
  return (
    `REFUSING to push: the worktree is on \`${currentBranch}\`, which .githooks/pre-push ` +
    `guards. The deploy rite (\`npx tsx scripts/deploy-rite.mts\`) is the only road to a ` +
    `protected ref, and this tool is not it.`
  );
}

/**
 * ⚠ A DIRTY WORKTREE IS A STOP, NEVER A MERGE (#558 review, finding 4).
 *
 * The overlap rule makes these worktrees a shift's ACTIVE workspace — that is
 * the whole point of them. A merge commit folds whatever is staged into
 * itself, so merging main into a branch whose worktree carries half-finished
 * work pushes that work onto the PR silently, in a commit whose message says
 * "Merge branch main". There is no reading of the shift's intent that belongs
 * in a tool, so it names the files and stops.
 *
 * Takes `git status --porcelain` output; returns a refusal or `null`.
 */
export function refuseDirtyWorktree(porcelain: string): string | null {
  const entries = porcelain
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "");
  if (entries.length === 0) return null;
  return (
    `the worktree is not clean (${entries.length} entr${entries.length === 1 ? "y" : "ies"}): ` +
    `${entries.join("; ")}. A merge would fold uncommitted work into the merge commit and push ` +
    `it onto the PR. Commit or stash it, then re-run.`
  );
}

/**
 * ⚠ A MERGE THAT STOPPED AND A MERGE THAT NEVER STARTED LOOK IDENTICAL FROM
 * AN EXIT CODE, AND THEY NEED OPPOSITE THINGS (#558 review, finding 4).
 *
 * The atlas merge driver accepts a placeholder and leaves the regenerated map
 * STAGED with `MERGE_HEAD` written, waiting for `git commit --no-edit` — git
 * does not re-read the index after `pre-merge-commit`, so that commit is the
 * documented next step and not a workaround. A merge that REFUSED to begin —
 * local changes would be overwritten, an unborn branch — writes no `MERGE_HEAD`
 * at all, and firing a blind commit at it produced a misleading "unresolved
 * paths" message in the first shape of this tool.
 */
export type MergeOutcome = "clean" | "conflict" | "atlas-driver-stop" | "never-started";

export function classifyMergeOutcome(input: {
  exitCode: number;
  /** `git diff --name-only --diff-filter=U` output. */
  unmergedPaths: string;
  /** Whether the path `git rev-parse --git-path MERGE_HEAD` names exists. */
  mergeHeadExists: boolean;
}): MergeOutcome {
  if (input.unmergedPaths.trim() !== "") return "conflict";
  if (input.exitCode === 0) return "clean";
  return input.mergeHeadExists ? "atlas-driver-stop" : "never-started";
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

/**
 * ⚠ **A FAILURE AFTER THE IRREVERSIBLE ACT LOOKS EXACTLY LIKE A FAILURE BEFORE
 * IT, AND THAT IS THE WHOLE OF #568.**
 *
 * `gh pr merge --delete-branch` does two things under one exit code: it merges
 * the pull request on GitHub, and then it tidies up LOCALLY — switching the
 * checkout off the branch it is about to delete. In a shift's worktree that
 * second half cannot work, because the main tree holds `main` by the standing
 * orders' own rule, and git refuses:
 *
 *     fatal: 'main' is already used by worktree at 'C:/Users/Admin/Drape'
 *
 * Measured on PR #567 (shift `foreman-20260905-2329`): **the merge landed**
 * (`49acd1d1`, `MERGED 2026-09-05T14:42:16Z`) and the tool threw a raw
 * `execFileSync` dump naming the merge call. The shift had no way to tell that
 * from a merge that never happened, and only learned the truth by asking
 * `gh pr view` by hand — a report contradicting its own artifact, which is
 * working law 1's whole subject.
 *
 * So the exit code is never the receipt. **GitHub's own answer is**, and this
 * function is the reading of it: what `gh` did is one input, what the record
 * says is the other, and only their combination names a state.
 *
 * The four states, and why each is separate rather than folded into a
 * neighbour:
 *
 *   * `merged` — the ordinary road. `gh` returned, GitHub says MERGED.
 *   * `merged-then-failed` — **the #568 state.** The PR is merged and
 *     something after it failed. The caller reports the receipt and carries
 *     on; treating this as a failure is what cost the shift its diagnosis.
 *   * `not-merged` — `gh` failed and the record agrees nothing landed. A real
 *     failure, and the raw output is the useful part.
 *   * `merge-state-unknown` — the read-back itself failed, so **neither**
 *     answer is established. It is deliberately NOT folded into `not-merged`:
 *     a broken reader voting for "nothing happened" is how an instrument stops
 *     being able to fail (working law 2), and here it would send a shift to
 *     re-merge a pull request that may already be in `main`.
 *
 * ⚠ **THAT LAST NAME IS DELIBERATE AND IT USED TO BE `unreadable`** (PR #612
 * review, finding 2). The capability atlas counts any `server/*.test.ts`
 * containing a QUOTED door id as a test PINNING that door, and `unreadable` is
 * the casting studio's own interpreter-refusal door — so this suite silently
 * became its 23rd pin (22 → 23, read at the generated diff). A door pinned by a
 * merge-tool test that never drives it is an instrument arm quietly disabled:
 * delete the real pins and `unpinned-refusal` still would not fire. The
 * collector's shape-match class is the root cause and is filed separately;
 * this name is the part that belongs in this PR.
 */
export type PrMergeReceipt =
  | { kind: "merged" }
  | { kind: "merged-then-failed"; detail: string }
  | { kind: "not-merged"; detail: string }
  | { kind: "merge-state-unknown"; detail: string };

export function classifyPrMergeReceipt(input: {
  /** What `gh pr merge` threw, or `null` when it returned cleanly. */
  readonly mergeError: string | null;
  /** `state` read back from `gh pr view`, or `null` when THAT read failed. */
  readonly stateAfter: string | null;
}): PrMergeReceipt {
  if (input.stateAfter === null) {
    return {
      kind: "merge-state-unknown",
      detail: input.mergeError === null
        ? "gh pr merge returned, but the state could not be read back."
        : `gh pr merge failed AND the state could not be read back: ${input.mergeError}`,
    };
  }
  if (input.stateAfter === "MERGED") {
    return input.mergeError === null
      ? { kind: "merged" }
      : { kind: "merged-then-failed", detail: input.mergeError };
  }
  return {
    kind: "not-merged",
    detail: input.mergeError === null
      ? `gh reported no error but GitHub says state=${input.stateAfter}`
      : input.mergeError,
  };
}

/**
 * ⚠ **AND THE CLEANUP IS DONE WHERE IT IS LEGAL, WHICH MEANS NOT ASKING `gh`
 * TO TOUCH THE LOCAL CHECKOUT AT ALL (#568, recommendation 2).**
 *
 * This tool's own help has always said what it intends: *"also delete the
 * REMOTE branch on merge"*. `gh pr merge --delete-branch` does more than that —
 * it deletes the remote ref and then deletes the local branch, switching the
 * checkout to the default branch first. Neither half of that local work is
 * legal from a shift worktree, and neither is wanted: `shift-worktree remove`
 * deliberately KEEPS the local branch (its own comment says so), so a local
 * delete here would contradict the other half of the shift's tooling.
 *
 * Deleting the ref through the API does exactly the documented thing and
 * touches nothing local, so the failure above cannot occur at all. The receipt
 * classifier stays regardless — it guards the class, not this one call.
 *
 * ⚠ **A REF THAT IS ALREADY GONE IS A SUCCESS, NOT A FAILURE.** A repository
 * with *Automatically delete head branches* on removes it during the merge, and
 * a shift that ran `--delete-branch` on a second pass would then see a 422. The
 * post-condition this tool cares about is *the remote branch is not there*, and
 * both roads satisfy it. Failing on the second would turn a tidy repository
 * into an error message.
 *
 * ⚠ **AND A FAILED DELETE IS NEVER FATAL.** It happens strictly AFTER the
 * merge, so exiting non-zero on it would recreate #568's defect one call to the
 * right: a shift reading a failure over a pull request that is already in
 * `main`. It is reported and the run continues.
 */
export type RemoteBranchDeletion = "deleted" | "already-gone" | "failed";

export function classifyRemoteBranchDeletion(input: {
  readonly exitCode: number;
  /** Combined stdout+stderr from the `gh api` call. */
  readonly output: string;
}): RemoteBranchDeletion {
  if (input.exitCode === 0) return "deleted";
  /*
    ⚠ **ONLY THE UNAMBIGUOUS ANSWER COUNTS AS ALREADY-GONE, AND `404` IS NOT
    ONE** (PR #612 review, finding 3). GitHub answers an absent ref with 422
    "Reference does not exist" on the git-refs endpoint — that is the one shape
    that can only mean the branch is not there. It also answers **404 for a
    DELETE the token lacks push permission on**, which means the branch very
    much IS there, and the first shape of this function read that as tidied.

    The two errors are not symmetric. Reporting a surviving branch as deleted
    is a lie a shift acts on; reporting a deleted branch as needing a look
    costs one glance and is never fatal either way. So the ambiguous answers
    fall to `failed`, and the message below names both possibilities rather
    than asserting one.
  */
  return /reference does not exist/i.test(input.output) ? "already-gone" : "failed";
}
