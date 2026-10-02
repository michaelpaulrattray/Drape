/**
 * WHICH LOCAL `team/*` BRANCHES ARE DEAD — the criterion, in code, because the
 * last one lived in a patrol's hands and was starved without anybody noticing
 * (#1797, Janitor patrol #12).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ⚠ **WHAT WENT WRONG, AND IT IS A READER PROBLEM RATHER THAN NEGLECT.**
 *
 * Run 11's local sweep stated its own criterion: *"the remote manifest as the
 * criterion (run 9's rule) plus the worktree hold plus the local tip must equal
 * the merged head."* That is to say it deleted the local counterparts of **the
 * branches that same run had just deleted remotely**.
 *
 * Then `delete_branch_on_merge` went ON (#1434), GitHub took over the remote
 * side, and **the local sweep's input went to near zero.** Nothing broke; a
 * criterion simply stopped selecting anything, and local refs lost their only
 * sweeper. Measured across three days: the remote fell to 66 while the local
 * side ran **115 → 295**, the two counts moving in opposite directions for one
 * reason. The remote being automated is what starved the local side.
 *
 * So the criterion here **never asks what this run deleted.** It asks the PULL
 * REQUEST, which is a fact about the work rather than a by-product of a sweep,
 * and cannot be taken away by automating something else.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ⚠ **`git branch --merged` IS THE WRONG READER FOR THIS REPOSITORY, AND IT IS
 * THE TRAP THE CARD EXISTS TO NAME.**
 *
 * Every pull request here is **squash**-merged, which creates a new commit whose
 * parent is `main` — the branch's own commits never become ancestors of `main`.
 * Driven on the real refs on 2026-10-02: of the 242 remote-less locals, **95 are
 * ancestors of `main` and 147 are not**, and that 147 is overwhelmingly
 * *finished, squash-merged work*.
 *
 * - A sweep trusting `--no-merged` keeps **147 dead branches**.
 * - A sweep trusting `--merged` and inverting it **deletes work this machine
 *   alone holds.** Run 11 kept 23 refs for exactly that reason and was right to.
 *
 * Neither spelling appears in this module, and an arm in
 * `server/localBranchSweep.test.ts` holds that — a text arm, because this is the
 * one mistake whose consequence is unrecoverable.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ⚠ **TWO READERS SHARING NO RESOLVER, WHICH IS THE CARD'S OWN REQUIREMENT.**
 *
 * - **Reader A — GitHub REST**, `pulls?state=all`: which pull request named this
 *   branch, and was it MERGED.
 * - **Reader B — the git protocol**, `ls-remote origin 'refs/pull/*\/head'`: that
 *   pull request's recorded head sha.
 *
 * A branch is deletable only when BOTH answer, and they answer through entirely
 * different stacks — an HTTP API and git's own wire protocol. One reader that was
 * wrong in both halves is the failure this shape rules out, and it is the same
 * discipline the architecture atlas's second readers use.
 *
 * ⚠ **`refs/pull/<n>/head` IS NOT A BRANCH AND SURVIVES THE DELETION**, which is
 * what makes every row here recoverable: GitHub keeps it after
 * `delete_branch_on_merge` removes the branch. So reader B is simultaneously the
 * criterion and the restore road, and `restoreRoads` writes both out per row.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ⚠ **THE TIP MUST EQUAL THE PULL HEAD, AND THAT IS DELIBERATELY STRICTER THAN
 * ANCESTRY.**
 *
 * An equal sha means every commit the local ref holds is on the remote's pull
 * ref — a pure sha comparison, needing no fetch of 245 refs and no ancestry
 * graph. A tip that DIFFERS is the case run 11 kept 23 of, and it covers both
 * directions at once: a tip PAST the pull head is a seat that kept working on a
 * merged branch (the #1540 case, commits nowhere else), and a tip BEHIND it is a
 * ref whose provenance this reader cannot establish from a sha alone. Both are
 * KEEP. **The deletable set is therefore a floor, and this module says so in its
 * own output rather than leaving it to be assumed.**
 */

/** One local branch, as `for-each-ref` gives it. */
export type LocalBranch = { readonly branch: string; readonly tip: string };

/** One pull request, as reader A gives it. */
export type PullRequestRow = {
  readonly number: number;
  readonly headRefName: string;
  /** `null` for an open or closed-unmerged pull request. */
  readonly mergedAt: string | null;
};

export type SweepVerdict = "deletable" | "keep" | "held";

export type SweepRow = {
  readonly branch: string;
  readonly tip: string;
  readonly verdict: SweepVerdict;
  /** Why, in one sentence, for the manifest a human reads before deleting. */
  readonly reason: string;
  /** The merged pull request that cleared it, when one did. */
  readonly pr: number | null;
};

/**
 * ⚠ THE POPULATION IS `team/*` AND NOTHING ELSE, AND `main` IS NOT MERELY
 * ABSENT — IT IS UNREPRESENTABLE.
 *
 * Run 11 asserted `main` absent from its delete list explicitly, which was right
 * and is a check on a list that could have contained it. Filtering at the
 * prefix means it never enters: `main`, a founder's own branch, a `release/*`
 * cut by the relay and a detached HEAD are all outside this tool's reach by
 * construction rather than by a later assertion.
 */
export const SWEEP_PREFIX = "team/";

export function isSweepable(branch: string): boolean {
  return branch.startsWith(SWEEP_PREFIX) && branch.length > SWEEP_PREFIX.length;
}

/** `for-each-ref`'s call, as an array, so an arm asserts what is SENT. */
export function forEachRefArgs(): string[] {
  return ["for-each-ref", "--format=%(refname:short) %(objectname)", "refs/heads/"];
}

/** Reader B's call — the git protocol, every pull request's recorded head. */
export function lsRemotePullHeadsArgs(): string[] {
  return ["ls-remote", "origin", "refs/pull/*/head"];
}

/**
 * Reader A's call — GitHub REST, every pull request whatever its state.
 *
 * ⚠ **`state=all` AND NOT `state=merged`**, which is not a state REST has: the
 * reader must be able to tell *open*, *closed unmerged* and *merged* apart,
 * because the middle one is work that was REJECTED and is now nowhere, and it is
 * the case most worth keeping. Collapsing it into "not merged" would be right by
 * accident; naming it is what makes the manifest's reason true.
 */
export function restPullsArgs(): string[] {
  return [
    "api",
    "--paginate",
    "repos/{owner}/{repo}/pulls?state=all&per_page=100",
    "--jq",
    "[.[] | {number: .number, headRefName: .head.ref, mergedAt: .merged_at}]",
  ];
}

/** The local refs, with their tips. Non-`team/` refs never enter. */
export function parseLocalBranches(out: string): LocalBranch[] {
  const rows: LocalBranch[] = [];
  for (const line of out.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const gap = trimmed.lastIndexOf(" ");
    if (gap <= 0) continue;
    const branch = trimmed.slice(0, gap).trim();
    const tip = trimmed.slice(gap + 1).trim();
    if (!isSweepable(branch)) continue;
    if (!/^[0-9a-f]{40}$/.test(tip)) continue;
    rows.push({ branch, tip });
  }
  return rows;
}

/**
 * Reader B's answer: pull request number → the head sha GitHub records for it.
 *
 * ⚠ A LINE THIS CANNOT PARSE IS DROPPED, NOT GUESSED — and dropping one can
 * only ever move a branch toward KEEP, because a pull request with no recorded
 * head can never clear the sha comparison. That is the safe direction, and it is
 * the only direction a parse failure here is allowed to push.
 */
export function parsePullHeads(out: string): Map<number, string> {
  const heads = new Map<number, string>();
  for (const line of out.split(/\r?\n/)) {
    const match = /^([0-9a-f]{40})\s+refs\/pull\/(\d+)\/head$/.exec(line.trim());
    if (match === null) continue;
    heads.set(Number(match[2]), match[1]);
  }
  return heads;
}

/**
 * Reader A's answer, parsed defensively.
 *
 * ⚠ **AN UNPARSEABLE ANSWER IS AN EMPTY LIST AND THE CALLER MUST REFUSE ON IT,
 * NOT CLASSIFY.** An empty pull-request list makes every branch read as *no pull
 * request names this* — which is KEEP, so it fails safe for the DELETION. But it
 * also silently reports 298 keeps as a finished reading, and a sweep that cannot
 * see a single pull request has not measured anything. `refusalForReadings`
 * below is where that is turned into a refusal.
 */
export function parsePullRequests(json: string): PullRequestRow[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const rows: PullRequestRow[] = [];
  for (const entry of raw) {
    if (entry === null || typeof entry !== "object") continue;
    const row = entry as { number?: unknown; headRefName?: unknown; mergedAt?: unknown };
    if (!Number.isSafeInteger(row.number) || (row.number as number) <= 0) continue;
    if (typeof row.headRefName !== "string" || row.headRefName.length === 0) continue;
    rows.push({
      number: row.number as number,
      headRefName: row.headRefName,
      mergedAt: typeof row.mergedAt === "string" ? row.mergedAt : null,
    });
  }
  return rows;
}

/**
 * THE NEWEST MERGED PULL REQUEST PER BRANCH — the same choice
 * `readMergedPullRequest` makes, and for the same reason.
 *
 * A branch can be named by several pull requests (reopened, or merged twice).
 * What the sweep needs is *did this ship*, and the latest merge is the one that
 * answers it.
 */
export function newestMergedByBranch(rows: readonly PullRequestRow[]): Map<string, PullRequestRow> {
  const best = new Map<string, PullRequestRow>();
  for (const row of rows) {
    if (row.mergedAt === null) continue;
    const held = best.get(row.headRefName);
    if (held === undefined || String(row.mergedAt) > String(held.mergedAt)) {
      best.set(row.headRefName, row);
    }
  }
  return best;
}

/** Every branch any pull request named, merged or not — for the KEEP reasons. */
export function branchesNamedByAnyPr(rows: readonly PullRequestRow[]): Set<string> {
  return new Set(rows.map((row) => row.headRefName));
}

export type ClassifyInput = {
  readonly branches: readonly LocalBranch[];
  /** Branches a registered worktree has checked out. */
  readonly held: ReadonlySet<string>;
  /** Reader A. */
  readonly pullRequests: readonly PullRequestRow[];
  /** Reader B. */
  readonly pullHeads: ReadonlyMap<number, string>;
};

/**
 * THE CRITERION. Four ways to KEEP, one way to be deletable.
 *
 * ⚠ **THE HOLD IS ASKED FIRST AND IS NOT OVERRIDABLE BY ANYTHING BELOW IT.**
 * Run 10 added that criterion after a surprise and run 11 was bitten inside its
 * own sitting: a seat moved a worktree's branch mid-run, so the held set at
 * classification time was not the held set at deletion time. The CLI therefore
 * re-reads it immediately before deleting, and the reason this function takes
 * the set rather than reading it is so the CLI can hand it two different
 * readings and compare them.
 */
export function classifyLocalBranches(input: ClassifyInput): SweepRow[] {
  const merged = newestMergedByBranch(input.pullRequests);
  const named = branchesNamedByAnyPr(input.pullRequests);
  const rows: SweepRow[] = [];

  for (const { branch, tip } of input.branches) {
    if (input.held.has(branch)) {
      rows.push({
        branch,
        tip,
        verdict: "held",
        reason: "a registered worktree is checked out on it",
        pr: null,
      });
      continue;
    }

    const mergedPr = merged.get(branch);
    if (mergedPr === undefined) {
      /* ⚠ TWO DIFFERENT REASONS, KEPT APART. "No pull request ever named this"
         may be unpushed work; "a pull request named it and did NOT merge" is
         work that was rejected and is now nowhere. Both KEEP, and a manifest a
         human reads before deleting is owed the difference. */
      rows.push({
        branch,
        tip,
        verdict: "keep",
        reason: named.has(branch)
          ? "a pull request named it and none of them merged — rejected work, and this ref may be its only copy"
          : "no pull request has ever named it — this ref may be the only copy of its commits",
        pr: null,
      });
      continue;
    }

    const head = input.pullHeads.get(mergedPr.number);
    if (head === undefined) {
      /* Reader A says it merged and reader B cannot show the head. Two readers
         disagreeing is never a deletion — it is a finding. */
      rows.push({
        branch,
        tip,
        verdict: "keep",
        reason:
          `PR #${mergedPr.number} merged it, but the git protocol has no refs/pull/${mergedPr.number}/head`
          + " — the two readers disagree, so there is no restore road to delete against",
        pr: mergedPr.number,
      });
      continue;
    }

    if (head !== tip) {
      rows.push({
        branch,
        tip,
        verdict: "keep",
        reason:
          `PR #${mergedPr.number} merged it, but this local tip is not its recorded head (${head.slice(0, 12)})`
          + " — either commits were made after the merge, or this ref's provenance cannot be read from a sha",
        pr: mergedPr.number,
      });
      continue;
    }

    rows.push({
      branch,
      tip,
      verdict: "deletable",
      reason:
        `PR #${mergedPr.number} merged it and this tip IS its recorded head, which GitHub keeps at`
        + ` refs/pull/${mergedPr.number}/head`,
      pr: mergedPr.number,
    });
  }

  return rows;
}

/**
 * ⚠ THE RUN REFUSES RATHER THAN REPORTING A READING IT DID NOT TAKE.
 *
 * Both readers failing, or either coming back empty, produces a report in which
 * every branch reads KEEP. That is safe for the deletion and **dishonest as a
 * measurement** — it is the "clean null that could not have produced a positive"
 * this repository has been bitten by, and the whole #1797 defect is a criterion
 * that silently stopped selecting anything. So an empty reading is a refusal with
 * the reason named, never a tidy table of keeps.
 */
export function refusalForReadings(input: {
  readonly branches: readonly LocalBranch[];
  readonly pullRequests: readonly PullRequestRow[];
  readonly pullHeads: ReadonlyMap<number, string>;
}): string | null {
  if (input.branches.length === 0) {
    return `no local ${SWEEP_PREFIX}* branch was read — either this tree has none, or for-each-ref answered with a shape this reader does not know`;
  }
  if (input.pullRequests.length === 0) {
    return "reader A (GitHub REST) returned no pull request at all — every branch would read KEEP for a reason that was never established";
  }
  if (input.pullHeads.size === 0) {
    return "reader B (the git protocol) returned no refs/pull/*/head — with no restore road readable, nothing may be deleted against it";
  }
  return null;
}

export type ReReadOutcome = {
  /** Rows still safe to delete: unheld, and still at the tip that was classified. */
  readonly proceed: SweepRow[];
  /** Rows whose tip moved or vanished between classification and deletion. */
  readonly moved: { readonly branch: string; readonly was: string; readonly now: string | null }[];
  /** Rows a worktree has taken since classification. */
  readonly joined: string[];
};

/**
 * WHAT SURVIVES THE RE-READ TAKEN IMMEDIATELY BEFORE DELETING — and this is not
 * belt-and-braces, IT FIRED ON RUN 11 INSIDE ONE SITTING.
 *
 * A seat moved a worktree's branch mid-run, so the held set at classification
 * time was not the held set at deletion time: `team/pin-reader-blocks-1498` left
 * it and `team/shared-bare-door-id-1506` joined it. **Four builder seats now run
 * in one pass, so the window is wider than it was when that happened once.** Run
 * 11 re-read every tip the same way before pushing — 29 unchanged, 0 moved, 0
 * gone — and this is that discipline in code rather than in a patrol's hands,
 * which is the whole point of #1797.
 *
 * ⚠ **A TIP THAT MOVED IS SKIPPED AND NOT RE-CLASSIFIED.** Re-classifying would
 * mean asking the two readers again mid-deletion about a branch somebody is
 * plainly working on right now; skipping costs one stale ref until the next run
 * and cannot cost a commit. A tip that has GONE is skipped by the same test, for
 * the same reason, and is reported rather than silently counted as done.
 */
export function survivorsOfReRead(input: {
  readonly deletable: readonly SweepRow[];
  readonly heldNow: ReadonlySet<string>;
  readonly tipsNow: ReadonlyMap<string, string>;
}): ReReadOutcome {
  const proceed: SweepRow[] = [];
  const moved: ReReadOutcome["moved"] = [];
  const joined: string[] = [];
  for (const row of input.deletable) {
    /* The hold is asked FIRST here too, for the reason `classifyLocalBranches`
       asks it first: a seat's live tree is not a stale ref whatever its tip
       says. */
    if (input.heldNow.has(row.branch)) {
      joined.push(row.branch);
      continue;
    }
    const now = input.tipsNow.get(row.branch) ?? null;
    if (now !== row.tip) {
      moved.push({ branch: row.branch, was: row.tip, now });
      continue;
    }
    proceed.push(row);
  }
  return { proceed, moved, joined };
}

/**
 * THE TWO RESTORE ROADS PER ROW, which is what makes this recoverable rather
 * than merely careful — run 11's own discipline, in code.
 *
 * The first works from this machine while the object is still in the local
 * repository; the second works from anywhere, forever, because
 * `refs/pull/<n>/head` is not a branch and survives the branch deletion.
 */
export function restoreRoads(row: SweepRow): string[] {
  const roads = [`git push origin ${row.tip}:refs/heads/${row.branch}`];
  if (row.pr !== null) {
    roads.push(`git fetch origin refs/pull/${row.pr}/head && git branch ${row.branch} FETCH_HEAD`);
  }
  return roads;
}

/** The counts a run reports, derived from the rows rather than tallied by hand. */
export function sweepTally(rows: readonly SweepRow[]): Record<SweepVerdict, number> {
  const tally: Record<SweepVerdict, number> = { deletable: 0, keep: 0, held: 0 };
  for (const row of rows) tally[row.verdict] += 1;
  return tally;
}

/**
 * THE MANIFEST — written BEFORE anything is deleted, which is the founder's rule
 * for a deletion card and the one thing that makes a wrong verdict survivable.
 */
export function manifestText(rows: readonly SweepRow[], stamp: string): string {
  const tally = sweepTally(rows);
  const lines: string[] = [
    `# local team/* branch sweep — ${stamp}`,
    "#",
    `# ${rows.length} branch(es): ${tally.deletable} deletable, ${tally.keep} keep, ${tally.held} held`,
    "#",
    "# The criterion: a registered worktree's hold, then a MERGED pull request",
    "# (GitHub REST), then that pull request's recorded head read over the git",
    "# protocol, which must EQUAL the local tip. `git branch --merged` is not",
    "# consulted and must not be: every merge here is a squash, so a branch's own",
    "# commits never become ancestors of main (#1797).",
    "#",
    "# Every deletable row carries two restore roads. The second one works",
    "# forever: refs/pull/<n>/head is not a branch and survives the deletion.",
    "",
  ];
  for (const verdict of ["deletable", "keep", "held"] as const) {
    const of = rows.filter((row) => row.verdict === verdict);
    lines.push(`## ${verdict.toUpperCase()} — ${of.length}`);
    lines.push("");
    for (const row of of) {
      lines.push(`${row.branch}`);
      lines.push(`  tip    ${row.tip}`);
      lines.push(`  why    ${row.reason}`);
      if (verdict === "deletable") {
        for (const road of restoreRoads(row)) lines.push(`  restore ${road}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}
