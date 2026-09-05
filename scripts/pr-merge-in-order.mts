/**
 * MERGE THE SHIFT'S OPEN PRs IN THE ORDER THEY WERE OPENED (#543 item 3,
 * founder-ordered, urgent).
 *
 *     npx tsx scripts/pr-merge-in-order.mts --pr 551 --pr 552
 *     npx tsx scripts/pr-merge-in-order.mts --prs 551,552 --dry-run
 *     npx tsx scripts/pr-merge-in-order.mts --pr 551 --acknowledge 551
 *
 * His order was *"investigate our current process and optimize it as urgent"*.
 * The investigation measured the shift idle for 52% of its mean — 27 minutes
 * median waiting on a gate with nothing on the bench — and the answer written
 * into the standing orders is OVERLAP: cut a second worktree and take the next
 * card while the first PR's gate runs. This is the tool that answer needs. The
 * card's own sentence: *"the overlap rule without this is a shift juggling
 * four terminals."*
 *
 * WHAT IT DOES, ONE PR AT A TIME, IN THE ORDER THEY WERE OPENED:
 *   - waits in the FOREGROUND for `gate-checks` (the only waiting a headless
 *     shift may do — ending a turn to wait for a notification kills the
 *     session, four seats lost in one morning);
 *   - squash-merges when the gate is green, nothing is unread and GitHub says
 *     it is mergeable, and prints the merge commit as the receipt;
 *   - when an earlier PR lands and a later one goes CONFLICTING or BEHIND,
 *     merges main into it IN ITS OWN REGISTERED WORKTREE and pushes, then goes
 *     back to waiting on its new gate run.
 *
 * ⚠ WHAT IT REFUSES TO DO IS THE POINT. It never judges. It stops, names the
 * PR and says why, whenever the next step is a decision:
 *   - a red gate (it never retries one, and never merges past one);
 *   - a Fable verdict nobody has read — GREEN IS NOT A PASS (#219), the
 *     findings ride the sticky comment, and `--acknowledge <n>` is the shift
 *     saying it has read them;
 *   - a money/auth diff with no verdict at all, and a diff touching
 *     `review.yml` (the reviewer self-skips on its own change, #165);
 *   - a real content conflict, a draft, or branch protection saying BLOCKED;
 *   - a branch with no registered worktree — it will not cut one, because a
 *     worktree it did not create is not one it should take down.
 *
 * EXIT CODES — the finding is the exit code, like `gate-stall-check`:
 *     0  every named PR is merged (or was already)
 *     2  STOPPED on something needing a person. The line above says which PR
 *        and what to do. NOT a failure of the shift and not a retry.
 *     3  gave up waiting (--timeout). The gate may still be alive; read it.
 *     1  tool error
 *
 * Writes exactly three kinds of thing and nothing else: `gh pr merge --squash`
 * on a PR you named, and `git merge origin/main` + `git push` inside a
 * worktree GitHub says is behind. `--dry-run` prints every one of them and
 * performs none. No database, no production, no deploy — the rite is still the
 * only road to main for a doc push.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  type GateState,
  type MergeAction,
  type PrReading,
  REVIEWER_WORKFLOW_PATH,
  decideMergeAction,
  describeAction,
  extractMoneyPattern,
  orderByOpened,
  refuseProtectedPush,
  sharesFiles,
} from "./lib/prMergeOrder.mts";
import { gitTreeReader, readProtectedRefs } from "./lib/pushPaths.mts";
import {
  type ReviewRunReading,
  reviewPresence,
  tallyRounds,
} from "./lib/reviewRounds.mts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REVIEW_WORKFLOW_FILE = "review.yml";

function fail(message: string): never {
  console.error(`pr-merge-in-order: ${message}`);
  process.exit(1);
}

function gh(args: string[]): string {
  return execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function api<T>(path: string): T {
  return JSON.parse(gh(["api", path])) as T;
}

type GitResult = { code: number; out: string };

function git(cwd: string, args: string[]): GitResult {
  try {
    const out = execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out };
  } catch (error) {
    const e = error as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

// ---- arguments ------------------------------------------------------------
// Refusing an unknown flag rather than ignoring it: a `--dry-run` that did not
// exist was silently ignored by a crew writer and stamped a LIVE production row
// terminal (#288/#289). A tool that MERGES gets that rule with no argument.
const argv = process.argv.slice(2);
const prNumbers: number[] = [];
const acknowledged = new Set<number>();
let dryRun = false;
let intervalMs = 30_000;
let timeoutMs = 45 * 60_000;
let deleteBranch = false;

const parsePr = (raw: string, flag: string): number => {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) fail(`${flag} wants a positive PR number, got ${raw}`);
  return n;
};

for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i]!;
  const next = () => argv[(i += 1)] ?? fail(`${a} needs a value`);
  switch (a) {
    case "--pr":
      prNumbers.push(parsePr(next(), "--pr"));
      break;
    case "--prs":
      for (const part of next().split(",")) {
        const trimmed = part.trim();
        if (trimmed !== "") prNumbers.push(parsePr(trimmed, "--prs"));
      }
      break;
    case "--acknowledge":
      acknowledged.add(parsePr(next(), "--acknowledge"));
      break;
    case "--dry-run":
      dryRun = true;
      break;
    case "--delete-branch":
      deleteBranch = true;
      break;
    case "--interval":
      intervalMs = Number(next()) * 1000;
      break;
    case "--timeout":
      timeoutMs = Number(next()) * 60_000;
      break;
    case "--help":
    case "-h":
      console.log(
        [
          "pr-merge-in-order — wait, sync and squash-merge the shift's PRs in the order opened",
          "",
          "  --pr <n>            a PR to merge (repeatable)",
          "  --prs <a,b,c>       the same, comma-separated",
          "  --acknowledge <n>   'I have read #n's review verdict' (repeatable)",
          "  --dry-run           print every merge, sync and push; perform none",
          "  --delete-branch     also delete the remote branch on merge (off by default)",
          "  --interval <s>      poll every s seconds (default 30)",
          "  --timeout <min>     give up waiting after min minutes (default 45)",
          "",
          "exit 2 = STOPPED on something needing a person; the line says which PR and why.",
        ].join("\n"),
      );
      process.exit(0);
      break;
    default:
      fail(`unknown flag ${a} — refusing rather than ignoring it (#289's class)`);
  }
}

if (prNumbers.length === 0) fail("name at least one PR: --pr <n> or --prs <a,b,c>");
if (!Number.isFinite(intervalMs) || intervalMs < 5_000) fail("--interval must be >= 5 seconds");
if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) fail("--timeout must be a positive number of minutes");
const uniquePrs = [...new Set(prNumbers)];

// ---- the money rule, extracted from the reviewer's own workflow ------------
const reviewYmlPath = join(REPO_ROOT, ".github", "workflows", REVIEW_WORKFLOW_FILE);
if (!existsSync(reviewYmlPath)) fail(`${REVIEWER_WORKFLOW_PATH} is missing — cannot read the money rule`);
let moneyPattern: string;
try {
  moneyPattern = extractMoneyPattern(readFileSync(reviewYmlPath, "utf8"));
} catch (error) {
  fail((error as Error).message);
}

// ---- the refs this tool may never push, DERIVED from the hook -------------
let PROTECTED_REFS: string[];
try {
  PROTECTED_REFS = readProtectedRefs(gitTreeReader(REPO_ROOT));
} catch (error) {
  fail(`cannot read the protected refs from .githooks/pre-push: ${(error as Error).message}`);
}

// ---- the reviewer workflow's id, DERIVED ----------------------------------
const workflows = api<{ workflows: Array<{ id: number; path: string }> }>(
  "repos/:owner/:repo/actions/workflows?per_page=100",
).workflows;
const reviewWorkflow = workflows.find((w) => w.path === REVIEWER_WORKFLOW_PATH);
if (!reviewWorkflow) fail(`no workflow at ${REVIEWER_WORKFLOW_PATH} — it has been renamed or removed`);

// ---- worktrees -------------------------------------------------------------
/** branch ref -> absolute worktree path, from git's own porcelain listing. */
function readWorktrees(): Map<string, string> {
  const map = new Map<string, string>();
  const listing = git(REPO_ROOT, ["worktree", "list", "--porcelain"]);
  if (listing.code !== 0) fail(`git worktree list failed: ${listing.out}`);
  let path: string | null = null;
  for (const line of listing.out.split(/\r?\n/)) {
    if (line.startsWith("worktree ")) path = line.slice("worktree ".length).trim();
    else if (line.startsWith("branch ") && path !== null) {
      map.set(line.slice("branch ".length).trim().replace(/^refs\/heads\//, ""), path);
    } else if (line.trim() === "") path = null;
  }
  return map;
}

// ---- readings --------------------------------------------------------------
type Rollup = {
  __typename?: string;
  name?: string;
  status?: string;
  conclusion?: string | null;
  startedAt?: string;
  workflowName?: string;
};

/**
 * `gate-checks` on the PR's CURRENT head commit. The name is the gate's own
 * job name; `resolve` and `founder-gate` are its siblings and are not the bar
 * (`founder-gate` labels and never blocks, by the founder's 2026-08-25 ruling).
 */
function gateStateOf(rollup: readonly Rollup[]): GateState {
  const runs = rollup
    .filter((c) => c.__typename === "CheckRun" && c.name === "gate-checks")
    .sort((a, b) => new Date(a.startedAt ?? 0).getTime() - new Date(b.startedAt ?? 0).getTime());
  const newest = runs[runs.length - 1];
  if (!newest) return "absent";
  if (newest.status !== "COMPLETED") return "running";
  return newest.conclusion === "SUCCESS" ? "green" : "red";
}

/**
 * Every `review.yml` run, with the conclusion of the job NAMED `review` in it.
 * The jobs call is what separates "the reviewer read the diff" from "triage
 * declined it" — a run concludes `success` either way (#219). Cached per run
 * id because the loop re-reads on every poll.
 */
const reviewJobCache = new Map<number, string | null>();

function reviewJobConclusion(runId: number): string | null {
  const cached = reviewJobCache.get(runId);
  if (cached !== undefined) return cached;
  const jobs = api<{ jobs: Array<{ name: string; conclusion: string | null }> }>(
    `repos/:owner/:repo/actions/runs/${runId}/jobs?per_page=100`,
  ).jobs;
  const job = jobs.find((j) => j.name === "review");
  const value = job ? (job.conclusion ?? "in_progress") : null;
  reviewJobCache.set(runId, value);
  return value;
}

function readReviewRuns(headBranch: string): ReviewRunReading[] {
  const runs = api<{
    workflow_runs: Array<{ id: number; head_branch: string; created_at: string }>;
  }>(
    `repos/:owner/:repo/actions/workflows/${reviewWorkflow!.id}/runs` +
      `?branch=${encodeURIComponent(headBranch)}&per_page=100`,
  ).workflow_runs;
  return runs.map((r) => ({
    id: r.id,
    headBranch: r.head_branch,
    createdAt: r.created_at,
    reviewJobConclusion: reviewJobConclusion(r.id),
  }));
}

function readPr(number: number, worktrees: Map<string, string>): PrReading {
  const view = JSON.parse(
    gh([
      "pr",
      "view",
      String(number),
      "--json",
      "number,createdAt,isDraft,state,mergeable,mergeStateStatus,headRefName,files,statusCheckRollup",
    ]),
  ) as {
    number: number;
    createdAt: string;
    isDraft: boolean;
    state: string;
    mergeable: string;
    mergeStateStatus: string;
    headRefName: string;
    files: Array<{ path: string }>;
    statusCheckRollup: Rollup[] | null;
  };

  const identity = {
    number: view.number,
    headRefName: view.headRefName,
    createdAt: view.createdAt,
  };
  const tally = tallyRounds(readReviewRuns(view.headRefName), identity);

  return {
    number: view.number,
    createdAt: view.createdAt,
    headRefName: view.headRefName,
    isDraft: view.isDraft,
    state: view.state,
    mergeable: view.mergeable,
    mergeStateStatus: view.mergeStateStatus,
    files: view.files.map((f) => f.path),
    gate: gateStateOf(view.statusCheckRollup ?? []),
    review: reviewPresence(tally),
    acknowledged: acknowledged.has(view.number),
    worktreePath: worktrees.get(view.headRefName) ?? null,
  };
}

// ---- the acts --------------------------------------------------------------
function say(line: string): void {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${line}`);
}

function mergePr(pr: PrReading): void {
  const args = ["pr", "merge", String(pr.number), "--squash"];
  if (deleteBranch) args.push("--delete-branch");
  if (dryRun) {
    say(`DRY RUN — would run: gh ${args.join(" ")}`);
    return;
  }
  gh(args);
  const after = JSON.parse(
    gh(["pr", "view", String(pr.number), "--json", "state,mergedAt,mergeCommit"]),
  ) as { state: string; mergedAt: string | null; mergeCommit: { oid: string } | null };
  // The receipt is read back from GitHub rather than assumed from an exit code:
  // a report is a claim, the artifact is the fact (working law 1).
  say(
    `MERGED #${pr.number} — ${after.state}, squash ${after.mergeCommit?.oid.slice(0, 8) ?? "?"}, ` +
      `at ${after.mergedAt ?? "?"}`,
  );
  if (after.state !== "MERGED") {
    fail(`#${pr.number}: gh reported no error but GitHub says state=${after.state}`);
  }
}

/**
 * Merge main into a branch inside its own worktree.
 *
 * The two generated maps carry `merge=atlas`, whose driver accepts a
 * placeholder and queues a regeneration that `pre-merge-commit`/`pre-commit`
 * perform on the MERGED tree — so an automatic merge stops with the map staged
 * and asks for `git commit --no-edit` (git does not re-read the index after
 * `pre-merge-commit`). That is the expected shape here, NOT a conflict, and
 * telling the two apart is the whole job of this function: unmerged paths mean
 * a real content conflict and a person.
 */
function syncMain(pr: PrReading, worktreePath: string): "synced" | "conflict" {
  if (dryRun) {
    say(`DRY RUN — would run, in ${worktreePath}: git fetch origin main; git merge origin/main; git push`);
    return "synced";
  }
  const fetch = git(worktreePath, ["fetch", "origin", "main"]);
  if (fetch.code !== 0) fail(`#${pr.number}: git fetch failed in ${worktreePath}: ${fetch.out}`);

  const merge = git(worktreePath, ["merge", "origin/main", "--no-edit"]);
  const unmerged = git(worktreePath, ["diff", "--name-only", "--diff-filter=U"]);
  if (unmerged.out.trim() !== "") {
    say(
      `#${pr.number}: REAL CONFLICT in ${worktreePath} — ${unmerged.out.trim().split(/\r?\n/).join(", ")}`,
    );
    return "conflict";
  }
  if (merge.code !== 0) {
    // No unmerged paths and a non-zero merge is the atlas driver's shape: the
    // map was regenerated and staged by the hook, and git wants the commit.
    const commit = git(worktreePath, ["commit", "--no-edit"]);
    if (commit.code !== 0) {
      say(`#${pr.number}: git merge stopped and git commit --no-edit failed: ${commit.out.trim()}`);
      return "conflict";
    }
    say(`#${pr.number}: merge completed through the atlas driver (regenerated map committed)`);
  }

  // Read the branch back from the worktree itself, immediately before pushing:
  // the refusal must key on what git is about to push, never on what this tool
  // believes it set up.
  const head = git(worktreePath, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (head.code !== 0) fail(`#${pr.number}: cannot read HEAD in ${worktreePath}: ${head.out}`);
  const refusal = refuseProtectedPush(head.out.trim(), PROTECTED_REFS);
  if (refusal !== null) fail(`#${pr.number}: ${refusal}`);

  const push = git(worktreePath, ["push"]);
  if (push.code !== 0) fail(`#${pr.number}: git push failed in ${worktreePath}: ${push.out}`);
  say(`#${pr.number}: main merged in and pushed — a new gate run will start`);
  return "synced";
}

const sleep = (n: number) => new Promise<void>((r) => setTimeout(r, n));

// ---- the plan --------------------------------------------------------------
const worktrees = readWorktrees();
let readings = uniquePrs.map((n) => readPr(n, worktrees));
readings = orderByOpened(readings);

console.log(`pr-merge-in-order — ${readings.length} PR(s), in the order they were opened${dryRun ? " (DRY RUN)" : ""}`);
for (const pr of readings) {
  console.log(
    `  #${pr.number}  ${pr.headRefName}  opened ${pr.createdAt}  gate=${pr.gate}  review=${pr.review}  ` +
      `${pr.mergeable}/${pr.mergeStateStatus}  files=${pr.files.length}` +
      `${pr.worktreePath ? "" : "  (no worktree)"}`,
  );
}
// The shared-file prediction, printed once so the syncs that follow are not a
// surprise. In this repository the generated maps make this nearly always
// non-empty, which is exactly why the overlap rule needs this tool at all.
for (let i = 0; i < readings.length; i += 1) {
  for (let j = i + 1; j < readings.length; j += 1) {
    const shared = sharesFiles(readings[i]!.files, readings[j]!.files);
    if (shared.length > 0) {
      console.log(
        `  note: #${readings[j]!.number} shares ${shared.length} file(s) with #${readings[i]!.number} ` +
          `(${shared.slice(0, 3).join(", ")}${shared.length > 3 ? ", …" : ""}) — expect a sync after #${readings[i]!.number} lands`,
      );
    }
  }
}
console.log("");

// ---- the loop --------------------------------------------------------------
const deadline = Date.now() + timeoutMs;
let exitCode = 0;

outer: for (const first of readings) {
  // Re-read rather than trusting the plan's snapshot: the PR before this one
  // has just landed on main, so a reading taken before that merge says CLEAN
  // about a branch that is now BEHIND. Acting on the snapshot is how this tool
  // would merge a stale branch (working law 1 — the plan is a claim).
  let pr = dryRun ? first : readPr(first.number, readWorktrees());
  for (;;) {
    const action: MergeAction = decideMergeAction(pr, { moneyPattern });
    say(describeAction(pr, action));

    if (action.kind === "merge") {
      mergePr(pr);
      break;
    }
    if (action.kind === "skip") break;
    if (action.kind === "stop") {
      exitCode = 2;
      break outer;
    }
    if (action.kind === "sync-main") {
      const result = syncMain(pr, action.worktreePath);
      if (result === "conflict") {
        say(
          `#${pr.number} STOP — the merge left unresolved paths. Resolve them in ` +
            `${action.worktreePath}, commit, push, and re-run.`,
        );
        exitCode = 2;
        break outer;
      }
      if (dryRun) break;
    }
    if (dryRun) {
      // A dry run prints the plan; it must never sit in a polling loop that
      // can only be broken by an act it has promised not to perform.
      say(`DRY RUN — would keep polling #${pr.number} every ${intervalMs / 1000}s from here.`);
      break;
    }
    if (Date.now() >= deadline) {
      say(
        `GAVE UP — waited ${(timeoutMs / 60_000).toFixed(0)} minutes on #${pr.number}. That is not a ` +
          `stall verdict: run \`gate-stall-check --pr ${pr.number}\` to tell a live run from a dead one (#368).`,
      );
      exitCode = 3;
      break outer;
    }
    await sleep(intervalMs);
    pr = readPr(pr.number, readWorktrees());
  }
}

if (exitCode === 0) console.log("\nAll named PRs are merged.");
process.exit(exitCode);
