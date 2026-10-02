/**
 * `janitor-local-branches` — which local `team/*` refs are dead, and the road to
 * delete them with every row recoverable (#1797, Janitor patrol #12).
 *
 *     npx tsx scripts/janitor-local-branches.mts                 # read + manifest
 *     npx tsx scripts/janitor-local-branches.mts --delete        # and delete
 *     npx tsx scripts/janitor-local-branches.mts --delete --dry-run
 *     npx tsx scripts/janitor-local-branches.mts --manifest <p>  # where it goes
 *
 * ⚠ **THE CRITERION LIVES IN `lib/localBranchSweep.mts` AND ITS HEADER IS THE
 * READING — open it before changing anything here.** The short version: the last
 * criterion keyed on *the branches this run deleted remotely*, so when
 * `delete_branch_on_merge` went on and GitHub took the remote side over, the
 * local sweep's input went to near zero and local refs lost their only sweeper.
 * 115 → 295 in three days while the remote fell to 66. Nothing broke; a
 * criterion stopped selecting anything.
 *
 * ⚠ **AND `git branch --merged` IS THE WRONG READER HERE.** Every merge in this
 * repository is a squash, so a branch's own commits never become ancestors of
 * `main`: 95 of the 242 remote-less locals are ancestors and **147 are not**,
 * and that 147 is finished work. Trusting `--no-merged` keeps 147 dead branches;
 * trusting `--merged` and inverting it **deletes work this machine alone holds.**
 *
 * EXIT CODES:
 *     0  read, classified, manifest written (and, with `--delete`, deleted)
 *     1  REFUSED — a reading that cannot be trusted, so nothing was classified
 *        and nothing was deleted. Named in the message.
 *     2  refused on the CALL, or failed mid-act — an unknown flag, a git or gh
 *        command that failed. Nothing was changed EXCEPT where it says so.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/* ⚠ ONE PARSER FOR "WHAT IS THIS WORKTREE ON", SHARED WITH `shift-worktree`
   (working law 4). A second copy of the porcelain reader is exactly the drift
   #1613 was filed about, and it matters more here: a hold this reader missed is
   a branch deleted out from under a seat that is working on it. It also carries
   #1796's discipline for free — a DETACHED worktree (every review worktree)
   holds no branch, and `branchForRemoval` answers that rather than guessing. */
import {
  branchForRemoval,
  branchReadFailed,
  parseWorktreeList,
  worktreeListArgs,
} from "./lib/shiftWorktree.mts";
import {
  classifyLocalBranches,
  forEachRefArgs,
  lsRemotePullHeadsArgs,
  manifestText,
  parseLocalBranches,
  parsePullHeads,
  parsePullRequests,
  refusalForReadings,
  restPullsArgs,
  restoreRoads,
  survivorsOfReRead,
  sweepTally,
} from "./lib/localBranchSweep.mts";

function refuse(message: string): never {
  console.error(`janitor-local-branches: REFUSING — ${message}`);
  process.exit(1);
}

function fail(message: string): never {
  console.error(`janitor-local-branches: ${message}`);
  process.exit(2);
}

const repoRoot = path.resolve(import.meta.dirname, "..").replace(/\\/g, "/");

const argv = process.argv.slice(2);
let doDelete = false;
let dryRun = false;
let manifestPath = `${repoRoot}/output/local-branch-manifest.txt`;

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === "--delete") doDelete = true;
  else if (arg === "--dry-run") dryRun = true;
  else if (arg === "--manifest") {
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) fail("--manifest needs a path");
    manifestPath = value;
    i += 1;
  } else fail(`unknown flag ${arg} (known: --delete, --dry-run, --manifest)`);
}

function run(file: string, args: string[]): { status: number; out: string; err: string } {
  const result = spawnSync(file, args, { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.error) fail(`could not run ${file}: ${result.error.message}`);
  return { status: result.status ?? 1, out: result.stdout ?? "", err: result.stderr ?? "" };
}

const git = (args: string[]) => run("git", args);

/**
 * WHICH BRANCHES A REGISTERED WORKTREE HOLDS — read, never assumed.
 *
 * A listing that FAILS is a refusal and never an empty set: an empty hold set
 * reads as "nothing is checked out anywhere", which on this machine is false of
 * 23 worktrees and would offer a working seat's branch for deletion.
 */
function heldBranches(): Set<string> {
  const listed = git(worktreeListArgs());
  if (listed.status !== 0) fail(`git worktree list failed: ${listed.err.trim()}`);
  const held = new Set<string>();
  for (const entry of parseWorktreeList(listed.out)) {
    const read = branchForRemoval(entry);
    /* A detached worktree holds no branch — that is every review worktree
       (#1796), and it is a real answer rather than a failed read. */
    if (!branchReadFailed(read)) held.add(read.branch);
  }
  return held;
}

// ---- the three readings ---------------------------------------------------

const refs = git(forEachRefArgs());
if (refs.status !== 0) fail(`git for-each-ref failed: ${refs.err.trim()}`);
const branches = parseLocalBranches(refs.out);

const held = heldBranches();

/* Reader B — the git protocol. */
const remoteHeads = git(lsRemotePullHeadsArgs());
if (remoteHeads.status !== 0) fail(`git ls-remote failed: ${remoteHeads.err.trim()}`);
const pullHeads = parsePullHeads(remoteHeads.out);

/* Reader A — GitHub REST, a different stack entirely, which is the point. */
const pulls = run("gh", restPullsArgs());
if (pulls.status !== 0) {
  fail(`gh api failed: ${(pulls.err || pulls.out).trim().split(/\r?\n/)[0] ?? "no reason given"}`);
}
/**
 * ⚠ ONE COMPLETE JSON ARRAY PER LINE — MEASURED, NOT ASSUMED, AND THE FIRST CUT
 * OF THIS ASSUMED WRONG.
 *
 * `gh api --paginate` with a `--jq` that projects an array runs the filter once
 * PER PAGE and emits each result on its own line: read against this repository
 * on 2026-10-02, 81,707 bytes over **10 lines, every one starting `[{`**, and
 * zero `][` boundaries anywhere. So this is JSON Lines of arrays, and the pages
 * are neither one document nor a bare concatenation.
 *
 * The first cut split on a `]` alone on a line, which never occurs — the whole
 * stream then parsed as one document, failed, came back as an empty list, and
 * `refusalForReadings` refused the run. **That failed SAFE and was still wrong**,
 * which is the only reason it was caught in one reading rather than silently
 * reporting 298 keeps: a reader whose failure mode is a refusal tells you it is
 * broken, and one whose failure mode is a tidy table does not.
 */
const pullRequests = pulls.out
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.length > 0)
  .flatMap((line) => parsePullRequests(line));

const refusal = refusalForReadings({ branches, pullRequests, pullHeads });
if (refusal !== null) refuse(refusal);

// ---- classify and write the manifest BEFORE anything is deleted -----------

const rows = classifyLocalBranches({ branches, held, pullRequests, pullHeads });
const tally = sweepTally(rows);
const stamp = new Date().toISOString();

console.log("janitor-local-branches");
console.log(`  local ${branches.length} team/* branch(es) · reader A ${pullRequests.length} pull request(s) · reader B ${pullHeads.size} pull head(s)`);
console.log(`  held by a worktree: ${held.size}`);
console.log(`  deletable ${tally.deletable} · keep ${tally.keep} · held ${tally.held}`);
console.log("");

mkdirSync(path.dirname(manifestPath), { recursive: true });
writeFileSync(manifestPath, manifestText(rows, stamp), "utf8");
console.log(`  manifest written: ${manifestPath}`);

const deletable = rows.filter((row) => row.verdict === "deletable");

if (!doDelete) {
  console.log("");
  console.log(
    deletable.length === 0
      ? "Nothing is deletable on this reading. Pass --delete when there is."
      : `Read only. Pass --delete to remove the ${deletable.length} deletable ref(s); every row's restore roads are in the manifest.`,
  );
  console.log("");
  console.log("⚠ The deletable set is a FLOOR, not a complete answer: a ref whose tip");
  console.log("  differs from its pull head is kept whichever side it differs on, because");
  console.log("  a sha alone cannot establish its provenance.");
  process.exit(0);
}

// ---- the deletion ---------------------------------------------------------

if (deletable.length === 0) {
  console.log("");
  console.log("--delete: nothing is deletable on this reading, so nothing was deleted.");
  process.exit(0);
}

/**
 * ⚠ THE HOLD AND THE TIPS ARE RE-READ IMMEDIATELY BEFORE THE DELETE, AND THIS
 * IS NOT BELT-AND-BRACES — IT FIRED ON RUN 11 INSIDE ONE SITTING.
 *
 * A seat moved a worktree's branch mid-run, so the held set at classification
 * time was not the held set at deletion time (`team/pin-reader-blocks-1498` left
 * it, `team/shared-bare-door-id-1506` joined). Four builder seats now run in one
 * pass, so the window is wider than it was. Run 11 re-read every tip the same
 * way before pushing — 29 unchanged, 0 moved, 0 gone — and this is that
 * discipline in code rather than in a patrol's hands, which is the whole point
 * of this card.
 */
const heldNow = heldBranches();
const refsNow = git(forEachRefArgs());
if (refsNow.status !== 0) fail(`git for-each-ref failed on the re-read: ${refsNow.err.trim()}`);
const tipsNow = new Map(parseLocalBranches(refsNow.out).map((row) => [row.branch, row.tip]));

/* The filter lives in the library so the arms drive the real one rather than a
   copy of it (working law 4) — and so the skip-rather-than-re-classify choice
   has a single owner with its reason on it. */
const { proceed, moved, joined } = survivorsOfReRead({ deletable, heldNow, tipsNow });

console.log("");
console.log(`  re-read before deleting: ${proceed.length} unchanged, ${moved.length} moved or gone, ${joined.length} newly held`);
for (const row of moved) {
  console.log(`    SKIPPED (moved)     ${row.branch} (${row.was.slice(0, 12)} -> ${row.now === null ? "gone" : row.now.slice(0, 12)})`);
}
for (const line of joined) console.log(`    SKIPPED (now held)  ${line}`);

let deleted = 0;
const failures: string[] = [];
for (const row of proceed) {
  /* ⚠ `-D` AND NOT `-d`, WITH THE WHOLE SAFETY ARGUMENT UPSTREAM OF IT. `-d`
     refuses a branch git does not consider merged, which under squash merging is
     EVERY branch here — so it would refuse the entire deletable set and teach
     whoever runs this to reach for `-D` by hand, with no criterion at all. The
     protection is the classification and the two restore roads, not git's own
     ancestry opinion, which this card exists to say is the wrong reader. */
  /* ⚠ THE DRY RUN STOPS HERE AND NOWHERE EARLIER, ON PURPOSE. It takes the real
     re-read and the real filter above, so what it prints is what `--delete`
     would do rather than a second account of it — a dry run that short-circuits
     before the re-read would be a different road wearing the same name, which
     is how a rehearsal comes to pass while the real act fails. */
  if (dryRun) {
    deleted += 1;
    continue;
  }
  const result = git(["branch", "-D", row.branch]);
  if (result.status !== 0) {
    failures.push(`${row.branch}: ${(result.err || result.out).trim().split(/\r?\n/)[0] ?? "no reason given"}`);
    continue;
  }
  deleted += 1;
}

console.log("");
console.log(`  ${dryRun ? "WOULD delete" : "deleted"} ${deleted} local ref(s)`);
for (const line of failures) console.log(`    FAILED  ${line}`);
console.log("");
console.log(
  dryRun
    ? `  --dry-run: nothing was changed. Their restore roads are in ${manifestPath} either way.`
    : `  every one is restorable, two roads per row, in ${manifestPath}`,
);
if (proceed.length > 0) {
  console.log(`  e.g. ${restoreRoads(proceed[0])[0]}`);
}

if (failures.length > 0) {
  fail(`${failures.length} deletion(s) failed — the manifest still holds their restore roads`);
}
process.exit(0);
