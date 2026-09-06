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
 *     saying it has read them. The acknowledgement is PINNED to the verdict
 *     count it was given for, so a later one is not waived by an earlier word;
 *   - a money/auth diff with no verdict at all — whether the reviewer failed
 *     or triage declined it — and a diff touching `review.yml` (the reviewer
 *     self-skips on its own change, #165);
 *   - a real content conflict, a draft, or branch protection saying BLOCKED;
 *   - a worktree that is not clean: a merge commit folds staged work into
 *     itself, and these worktrees are a shift's ACTIVE workspace;
 *   - a branch with no registered worktree — it will not cut one, because a
 *     worktree it did not create is not one it should take down.
 *
 * And it WAITS, rather than merging, on a review that is still in flight. That
 * one was the gate review of its own PR (#558, finding 1): the gate finishes
 * while a PR is a draft, `gh pr ready` starts the review and starts NO new gate
 * run, so "green gate, review mid-run" is the team's ROUTINE first-round state.
 * Reading it as "the reviewer produced nothing" made merging past a review the
 * default outcome rather than the exception. IN FLIGHT IS NOT DOWN.
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
  extractJobNames,
  extractMoneyPattern,
  orderByOpened,
  classifyMergeOutcome,
  classifyPrMergeReceipt,
  classifyRemoteBranchDeletion,
  refuseDirtyWorktree,
  refuseProtectedPush,
  refuseUnknownJobName,
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
/** PR number -> the verdict count when its acknowledgement was honoured. */
const ackPinnedAt = new Map<number, number>();
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

// ---- the job names this tool keys on, CHECKED against the workflows -------
// A renamed `review` job would make every run read as "no verdict" forever and
// nothing would redden — the silent, permissive direction (#558 review,
// finding 3). So the names are asserted against what the workflows declare,
// and an absent one refuses the run.
const REVIEW_JOB_NAME = "review";
const GATE_JOB_NAME = "gate-checks";
const GATE_WORKFLOW_PATH = ".github/workflows/gate.yml";
for (const [needed, workflowPath] of [
  [REVIEW_JOB_NAME, REVIEWER_WORKFLOW_PATH],
  [GATE_JOB_NAME, GATE_WORKFLOW_PATH],
] as const) {
  const file = join(REPO_ROOT, workflowPath);
  if (!existsSync(file)) fail(`${workflowPath} is missing — cannot check job names`);
  let declared: string[];
  try {
    declared = extractJobNames(readFileSync(file, "utf8"));
  } catch (error) {
    fail(`${workflowPath}: ${(error as Error).message}`);
  }
  const refusal = refuseUnknownJobName(needed, declared, workflowPath);
  if (refusal !== null) fail(refusal);
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
    .filter((c) => c.__typename === "CheckRun" && c.name === GATE_JOB_NAME)
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
type ReviewJobReading = { status: string | null; conclusion: string | null };

/**
 * ⚠ ONLY TERMINAL STATES ARE CACHED. The first shape cached whatever it saw,
 * including `in_progress` and "no job yet", for the whole process lifetime — so
 * the 45-minute polling loop re-read the PR every 30 seconds and NEVER re-read
 * the job, and a verdict produced mid-run stayed invisible until the process
 * restarted (#558 review, finding 2). A cache that freezes a transient is
 * worse than no cache: it turns a wait into a permanent wrong answer.
 */
const reviewJobCache = new Map<number, ReviewJobReading>();

function readReviewJob(runId: number): ReviewJobReading {
  const cached = reviewJobCache.get(runId);
  if (cached !== undefined) return cached;
  const jobs = api<{ jobs: Array<{ name: string; status: string; conclusion: string | null }> }>(
    `repos/:owner/:repo/actions/runs/${runId}/jobs?per_page=100`,
  ).jobs;
  const job = jobs.find((j) => j.name === REVIEW_JOB_NAME);
  const value: ReviewJobReading = job
    ? { status: job.status, conclusion: job.conclusion }
    : { status: null, conclusion: null };
  if (value.status === "completed") reviewJobCache.set(runId, value);
  return value;
}

function readReviewRuns(headBranch: string): ReviewRunReading[] {
  const runs = api<{
    workflow_runs: Array<{ id: number; head_branch: string; created_at: string; status: string }>;
  }>(
    `repos/:owner/:repo/actions/workflows/${reviewWorkflow!.id}/runs` +
      `?branch=${encodeURIComponent(headBranch)}&per_page=100`,
  ).workflow_runs;
  return runs.map((r) => {
    // A queued run has no jobs yet; asking for them costs a call that can only
    // answer "not started", which the run's own status already says.
    const job = r.status === "completed" ? readReviewJob(r.id) : { status: null, conclusion: null };
    return {
      id: r.id,
      headBranch: r.head_branch,
      createdAt: r.created_at,
      runStatus: r.status,
      reviewJobStatus: job.status,
      reviewJobConclusion: job.conclusion,
    };
  });
}

/**
 * ⚠ THE FILE LIST IS PAGINATED, NOT TAKEN FROM `gh pr view --json files`.
 *
 * Both of this tool's holds — the money/auth one and the #165 hand-review one
 * — are only as good as this list, and a SHORT list fails in the permissive
 * direction: a `server/security/` file missing from it reads as an ordinary
 * diff. `gh pr view --json files` fetches the GraphQL connection with a fixed
 * page, and the round-three review of #558 raised the cap as a real risk that
 * it could not verify.
 *
 * ⚠ I COULD NOT MEASURE IT EITHER, AND SAY SO RATHER THAN GUESSING (law 7b):
 * the largest pull request in this repository's whole history is FIFTY files
 * (#370, read at `gh pr list --limit 200`), so no local artifact can exhibit
 * the cap. The question is therefore DISSOLVED instead of answered —
 * `gh api --paginate` is complete whatever the cap is, and costs one extra
 * call on a diff nobody here has ever produced.
 */
function readPrFiles(number: number): string[] {
  // ⚠ `filename`, not `path`. The REST payload names it `filename`; `path` is
  //    the GraphQL connection's name, and asking REST for `.path` returns one
  //    EMPTY STRING PER FILE — a list of the right length carrying nothing, so
  //    both holds read every diff as ordinary. Written the wrong way here for
  //    ten minutes and caught by DRIVING the tool, not by reading it: the
  //    dry-run printed `files=0` on a seven-file PR.
  const out = gh([
    "api",
    "--paginate",
    `repos/:owner/:repo/pulls/${number}/files`,
    "--jq",
    ".[].filename",
  ]);
  const files = out
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "");
  // Fail CLOSED. A pull request always changes at least one file, so an empty
  // list means the reading broke, and an empty list is exactly what makes both
  // holds pass. This is the guard that would have caught the line above.
  if (files.length === 0) {
    fail(
      `#${number}: read ZERO changed files. A pull request always changes at least one, so this ` +
        `reading is broken — and an empty list silently disarms both the money hold and the ` +
        `#165 hand-review hold. Refusing rather than merging.`,
    );
  }
  return files;
}

function readPr(number: number, worktrees: Map<string, string>): PrReading {
  const view = JSON.parse(
    gh([
      "pr",
      "view",
      String(number),
      "--json",
      "number,createdAt,isDraft,state,mergeable,mergeStateStatus,headRefName,statusCheckRollup",
    ]),
  ) as {
    number: number;
    createdAt: string;
    isDraft: boolean;
    state: string;
    mergeable: string;
    mergeStateStatus: string;
    headRefName: string;
    statusCheckRollup: Rollup[] | null;
  };

  const identity = {
    number: view.number,
    headRefName: view.headRefName,
    createdAt: view.createdAt,
  };
  const tally = tallyRounds(readReviewRuns(view.headRefName), identity);
  const verdictCount = tally.verdicts.length;

  // An acknowledgement is PINNED to the verdict count observed the first time
  // this PR was read — so a verdict landing later in the run is not waived by
  // a word said before it existed (#558 review, finding 6).
  if (acknowledged.has(view.number) && !ackPinnedAt.has(view.number)) {
    ackPinnedAt.set(view.number, verdictCount);
  }

  return {
    number: view.number,
    createdAt: view.createdAt,
    headRefName: view.headRefName,
    isDraft: view.isDraft,
    state: view.state,
    mergeable: view.mergeable,
    mergeStateStatus: view.mergeStateStatus,
    files: readPrFiles(view.number),
    gate: gateStateOf(view.statusCheckRollup ?? []),
    review: reviewPresence(tally),
    verdictCount,
    acknowledgedAtVerdictCount: ackPinnedAt.get(view.number) ?? null,
    worktreePath: worktrees.get(view.headRefName) ?? null,
  };
}

// ---- the acts --------------------------------------------------------------
function say(line: string): void {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${line}`);
}

/**
 * A multi-line tool dump folded onto one line, so a receipt stays one `say`.
 *
 * The whole point of #568's fix is that the important sentence is READ; a raw
 * `execFileSync` dump wrapping over six lines is how the last one was missed.
 */
function oneLine(text: string): string {
  return text.split(/\r?\n/).map((part) => part.trim()).filter((part) => part !== "").join(" | ");
}

/**
 * THE MERGE, AND THE RECEIPT IS READ BACK RATHER THAN INFERRED (#568).
 *
 * ⚠ **NOTHING HERE TRUSTS AN EXIT CODE, AND NOTHING HERE ASKS `gh` TO TOUCH
 * THE LOCAL CHECKOUT.** Both properties come from one incident: `gh pr merge
 * --delete-branch` merged PR #567 and then threw doing its own local tidy-up,
 * which cannot work from a shift worktree — so the tool reported a failure over
 * a pull request that was already in `main`. `classifyPrMergeReceipt` and
 * `classifyRemoteBranchDeletion` in `lib/prMergeOrder.mts` carry the reasoning
 * and the four states; this function is their I/O.
 */
function mergePr(pr: PrReading): void {
  /* ⚠ `--delete-branch` is deliberately NOT passed to `gh pr merge`, even when
     the flag is set. It is the local half of that flag that broke, and this
     tool's help only ever promised the remote half — which `deleteRemoteBranch`
     does below, after the receipt is printed. */
  const args = ["pr", "merge", String(pr.number), "--squash"];
  if (dryRun) {
    say(`DRY RUN — would run: gh ${args.join(" ")}`);
    if (deleteBranch) say(`DRY RUN — would then delete the remote branch ${pr.headRefName}`);
    return;
  }

  let mergeError: string | null = null;
  try {
    gh(args);
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; message?: string };
    mergeError = `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() || (e.message ?? String(error));
  }

  /* The read-back happens WHATEVER `gh` did, and its own failure is a third
     answer rather than a vote for "nothing landed". */
  let stateAfter: string | null = null;
  let receiptLine = "";
  try {
    const after = JSON.parse(
      gh(["pr", "view", String(pr.number), "--json", "state,mergedAt,mergeCommit"]),
    ) as { state: string; mergedAt: string | null; mergeCommit: { oid: string } | null };
    stateAfter = after.state;
    receiptLine =
      `#${pr.number} — ${after.state}, squash ${after.mergeCommit?.oid.slice(0, 8) ?? "?"}, ` +
      `at ${after.mergedAt ?? "?"}`;
  } catch (error) {
    receiptLine = `#${pr.number} — the state could not be read back: ${(error as Error).message}`;
  }

  const receipt = classifyPrMergeReceipt({ mergeError, stateAfter });

  /* ⚠ THE RECEIPT IS PRINTED BEFORE ANY INTERPRETATION OF IT, so a shift
     reading a crashed run still learns what happened to its pull request. */
  switch (receipt.kind) {
    case "merged":
      say(`MERGED ${receiptLine}`);
      break;
    case "merged-then-failed":
      say(`MERGED ${receiptLine}`);
      say(
        `#${pr.number}: MERGED, then a later step failed — the pull request IS in main and ` +
          `must not be re-merged. What failed: ${oneLine(receipt.detail)}`,
      );
      break;
    case "not-merged":
      say(`NOT MERGED ${receiptLine}`);
      fail(`#${pr.number}: ${oneLine(receipt.detail)}`);
      break;
    case "unreadable":
      /* ⚠ NOT folded into `not-merged`: the instruction is the opposite one.
         There, re-running is the repair; here it could merge twice or chase a
         pull request that is already in `main`. */
      say(`UNKNOWN ${receiptLine}`);
      fail(
        `#${pr.number}: ${oneLine(receipt.detail)} Check \`gh pr view ${pr.number} --json state\` ` +
          `BEFORE re-running — this tool cannot say whether the merge landed.`,
      );
      break;
  }

  if (deleteBranch) deleteRemoteBranch(pr);
}

/**
 * Delete the pull request's head branch on GitHub, and only there.
 *
 * Never fatal: it runs after the merge, so failing the process here would put
 * a shift back in #568's position — an error over a pull request that landed.
 */
function deleteRemoteBranch(pr: PrReading): void {
  const repo = gh(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]).trim();
  let code = 0;
  let output = "";
  try {
    output = gh([
      "api", "-X", "DELETE",
      `repos/${repo}/git/refs/heads/${pr.headRefName}`,
    ]);
  } catch (error) {
    const e = error as { status?: number; stdout?: string; stderr?: string; message?: string };
    code = e.status ?? 1;
    output = `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() || (e.message ?? String(error));
  }
  switch (classifyRemoteBranchDeletion({ exitCode: code, output })) {
    case "deleted":
      say(`#${pr.number}: deleted the remote branch ${pr.headRefName}`);
      break;
    case "already-gone":
      say(`#${pr.number}: the remote branch ${pr.headRefName} was already gone — nothing to delete`);
      break;
    case "failed":
      say(
        `#${pr.number}: MERGED, but the remote branch ${pr.headRefName} could not be deleted ` +
          `— ${oneLine(output)}. Delete it by hand; the merge is unaffected.`,
      );
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
type SyncResult = { kind: "synced" } | { kind: "stopped"; instruction: string };

function syncMain(pr: PrReading, worktreePath: string): SyncResult {
  if (dryRun) {
    say(`DRY RUN — would run, in ${worktreePath}: git fetch origin main; git merge origin/main; git push`);
    return { kind: "synced" };
  }

  // ⚠ A DIRTY WORKTREE IS A STOP, NOT A MERGE (#558 review, finding 4). The
  //    overlap rule makes these worktrees a shift's ACTIVE workspace, and a
  //    merge commit folds whatever is staged there into itself — so
  //    half-finished work would land on the PR silently and be pushed. Stopping
  //    is this tool's own ethos; there is no version of "guess what the shift
  //    meant by those files" that belongs here.
  const dirty = git(worktreePath, ["status", "--porcelain"]);
  if (dirty.code !== 0) fail(`#${pr.number}: git status failed in ${worktreePath}: ${dirty.out}`);
  const dirtyRefusal = refuseDirtyWorktree(dirty.out);
  if (dirtyRefusal !== null) {
    say(`#${pr.number}: NOT SYNCING ${worktreePath} — ${dirtyRefusal}`);
    return {
      kind: "stopped",
      // ⚠ NOT "resolve the unresolved paths, commit, push" — there are none,
      //    and that instruction would send the shift to commit the very
      //    half-finished work the refusal exists to keep off the PR (#558
      //    round-three review, finding 3: finding 4's own class one frame up).
      instruction: `Commit or stash your own files in ${worktreePath}, then re-run.`,
    };
  }

  const fetch = git(worktreePath, ["fetch", "origin", "main"]);
  if (fetch.code !== 0) fail(`#${pr.number}: git fetch failed in ${worktreePath}: ${fetch.out}`);

  const merge = git(worktreePath, ["merge", "origin/main", "--no-edit"]);
  const unmerged = git(worktreePath, ["diff", "--name-only", "--diff-filter=U"]);
  // `--git-path` resolves inside a LINKED worktree, where `.git` is a file and
  // the real directory lives under the main tree's `worktrees/`.
  const pathOf = git(worktreePath, ["rev-parse", "--git-path", "MERGE_HEAD"]);
  const mergeHead = pathOf.code === 0 ? resolve(worktreePath, pathOf.out.trim()) : "";

  switch (
    classifyMergeOutcome({
      exitCode: merge.code,
      unmergedPaths: unmerged.out,
      mergeHeadExists: mergeHead !== "" && existsSync(mergeHead),
    })
  ) {
    case "conflict":
      say(
        `#${pr.number}: REAL CONFLICT in ${worktreePath} — ${unmerged.out.trim().split(/\r?\n/).join(", ")}`,
      );
      return {
        kind: "stopped",
        instruction: `Resolve the conflicted paths in ${worktreePath}, commit, push, and re-run.`,
      };
    case "never-started":
      say(
        `#${pr.number}: the merge NEVER STARTED (no MERGE_HEAD) — git refused it: ` +
          merge.out.trim().split(/\r?\n/).slice(0, 4).join(" / "),
      );
      return {
        kind: "stopped",
        instruction:
          `Read what git refused in ${worktreePath} and clear it — no merge is in progress, so ` +
          "there is nothing to resolve or commit.",
      };
    case "atlas-driver-stop": {
      const commit = git(worktreePath, ["commit", "--no-edit"]);
      if (commit.code !== 0) {
        say(`#${pr.number}: the atlas driver stopped the merge and \`git commit --no-edit\` failed: ${commit.out.trim()}`);
        return {
          kind: "stopped",
          instruction: `Finish the merge by hand in ${worktreePath} (\`git commit --no-edit\`), push, and re-run.`,
        };
      }
      say(`#${pr.number}: merge completed through the atlas driver (regenerated map committed)`);
      break;
    }
    case "clean":
      break;
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
  return { kind: "synced" };
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
      if (result.kind === "stopped") {
        // The instruction comes from the case that stopped, not from a blanket
        // line one frame up (#558 round-three review, finding 3).
        say(`#${pr.number} STOP — ${result.instruction}`);
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
