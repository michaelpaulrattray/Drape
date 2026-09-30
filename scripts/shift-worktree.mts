/**
 * `shift-worktree` — cut and take down a shift's worktree, once, correctly
 * (#543 build item 2, founder-ordered and urgent 2026-09-05).
 *
 *     npx tsx scripts/shift-worktree.mts add <slug>
 *     npx tsx scripts/shift-worktree.mts remove <slug> [--force]
 *     npx tsx scripts/shift-worktree.mts list
 *     … any of the above with --dry-run
 *
 * `add` creates `../drape-shift-<slug>` on `team/<slug>` from `origin/main`,
 * junctions `node_modules` at the main tree's, copies `.env`, and checks the
 * checkout is not CRLF-smudged. `remove` takes the junction out FIRST, proves
 * it is gone, then unregisters the worktree and deletes the directory.
 *
 * ⚠ READ THE HEADER OF `lib/shiftWorktree.mts` BEFORE CHANGING THE REMOVAL
 * PATH — it carries a measured table, not a rumour. The short version: three
 * of four deletion forms unlink the junction harmlessly, and `rm -rf <link>/`
 * with a trailing slash **empties the MAIN tree's dependency install**, the one
 * every other worktree, the dev server and the founder's own session are using.
 * That is the form a shift types by hand, which is why the junction comes out
 * first here and why its refusal is the only one `--force` cannot override.
 *
 * ⚠ **AND `remove`'s UNPUSHED REFUSAL ASKS THE PULL REQUEST SINCE #1540.**
 * `delete_branch_on_merge` went on 2026-09-29 (#1434) and a squash merge does not
 * make a branch's commits ancestors of `main` — so **every merged branch began
 * reading exactly like a branch whose work would be destroyed**, and the message
 * argued for `--force` on the common path while the guard's real case hid in the
 * noise. Ancestry cannot answer it; the pull request can, and it is the same
 * reading `pr-merge-in-order` already makes. The read is taken ONLY when
 * something is unpushed, so `remove` stays offline on the happy path, and a read
 * that cannot be taken leaves the refusal standing and says so.
 *
 * ⚠ **AND IT ASKS ABOUT THE COMMITS, NOT ABOUT THE BRANCH NAME** — the gap found
 * at this card's own review. *"A merged pull request names this branch"* is not
 * *"these commits shipped"*: a seat keeps working on the same branch after its
 * PR merges, and one commit later the friendly new message would have waved that
 * commit through without `--force`. So the merged PR's recorded head is fetched
 * (`refs/pull/<N>/head`, which GitHub keeps after the branch is deleted) and the
 * removal proceeds only when HEAD is an ANCESTOR of it. HEAD past that head
 * refuses and names how many commits came after the merge.
 *
 * ⚠ **AND SINCE #1613 `remove` READS THE BRANCH RATHER THAN SPELLING IT.**
 * `team/<slug>` is what `add` CREATES, and it is true of nothing else: make a
 * worktree on a branch that already exists — which a seat continuing a released
 * card is told to do — and the directory name and the branch name part company.
 * Found by using the tool: `remove` printed `branch team/worktree-merged-1540`,
 * a branch that does not exist, four lines above deleting a directory. Every
 * consequential count was always taken in the worktree against `HEAD` and
 * `@{u}`, so no work was ever at risk; what broke was the merged-PR read
 * above — asked about a branch no pull request had used, it could only ever
 * answer *no merged pull request*, so the friendly outcome #1540 exists to
 * produce was dead for that whole class of worktree. `WorktreePlan` no longer
 * carries a branch at all; `branchToCreate` is called once, by `add`. Where the
 * branch cannot be read (an unregistered leftover, a detached HEAD) the answer
 * is UNREADABLE and never the convention — printed as such, and folded into the
 * refusal `decideRemoval` already had.
 *
 * EXIT CODES:
 *     0  done (or, with --dry-run, would be done)
 *     1  refused on the TREE'S STATE — unpushed commits with no merged pull
 *        request, uncommitted work, a dangerous slug, a branch that already
 *        exists. Nothing was changed.
 *     2  refused on the CALL or failed mid-act — an unknown flag, a missing
 *        argument, a git command that failed, a directory something holds
 *        open. Nothing was changed EXCEPT where the message says otherwise.
 *
 * Both are refusals in plain English; the split is about whether the tool or
 * the tree is the thing to fix, and the two are kept distinct because a script
 * reading these codes must be able to tell "your branch is dirty" from "you
 * typed something I do not understand".
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

import {
  branchForRemoval,
  branchReadFailed,
  branchToCreate,
  decideRemoval,
  entryForPath,
  junctionMustBeGone,
  looksCrlfSmudged,
  parseWorktreeList,
  planFor,
  prReadFailed,
  removalStateFromShipReading,
  shipReadingFor,
  validateSlug,
  worktreeListArgs,
  type RemovalState,
  type ShipReading,
} from "./lib/shiftWorktree.mts";
/* The one reading that authorises a recursive delete on this machine, shared
   with the rite's own teardown rather than re-declared here (#654, law 7). */
import { stillOnDisk } from "./lib/riteWorktree.mts";

function refuse(message: string): never {
  console.error(`shift-worktree: REFUSING — ${message}`);
  process.exit(1);
}

function fail(message: string): never {
  console.error(`shift-worktree: ${message}`);
  process.exit(2);
}

// ---- arguments ------------------------------------------------------------
// An unknown flag is refused rather than ignored (#288's lesson, and it matters
// more here than anywhere: a misspelt `--dry-run` on a REMOVE would delete.)
const argv = process.argv.slice(2);
const command = argv[0];
let slug = "";
let force = false;
let dryRun = false;

for (let i = 1; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === "--force") force = true;
  else if (arg === "--dry-run") dryRun = true;
  else if (arg.startsWith("--")) fail(`unknown flag ${arg} (known: --force, --dry-run)`);
  else if (slug === "") slug = arg;
  else fail(`unexpected argument ${arg}`);
}

if (!command || !["add", "remove", "list"].includes(command)) {
  fail("usage: shift-worktree <add|remove|list> [slug] [--force] [--dry-run]");
}

const repoRoot = path.resolve(import.meta.dirname, "..").replace(/\\/g, "/");
const parentDir = path.dirname(repoRoot).replace(/\\/g, "/");

function run(file: string, args: string[], cwd = repoRoot): { status: number; out: string; err: string } {
  const result = spawnSync(file, args, { cwd, encoding: "utf8" });
  if (result.error) fail(`could not run ${file}: ${result.error.message}`);
  return { status: result.status ?? 1, out: result.stdout ?? "", err: result.stderr ?? "" };
}

function git(args: string[], cwd = repoRoot) {
  return run("git", args, cwd);
}

/**
 * ⚠ **`run` EXITS WHEN A BINARY IS MISSING, AND THAT IS WRONG FOR THE ONE
 * OPTIONAL READ THIS TOOL MAKES (#1540).**
 *
 * `run`'s `fail` on `result.error` is right for `git` and for `cmd`: this tool
 * cannot do its job without them, so stopping is the honest answer. It is wrong
 * for `gh`, whose answer merely makes a refusal message better — routed through
 * `run`, a machine with no `gh` on PATH could not remove a worktree AT ALL, and
 * the feature meant to stop the guard crying wolf would have taken the guard
 * down with it. So this one returns a non-zero status instead, which
 * `readMergedPullRequest` turns into `unreadable` and the verdict then treats as
 * "nobody asked".
 */
function runOptional(file: string, args: string[]): { status: number; out: string; err: string } {
  const result = spawnSync(file, args, { cwd: repoRoot, encoding: "utf8" });
  if (result.error) return { status: -1, out: "", err: result.error.message };
  return { status: result.status ?? 1, out: result.stdout ?? "", err: result.stderr ?? "" };
}

function say(action: string) {
  console.log(`  ${dryRun ? "would" : "did "}  ${action}`);
}

// ---- list -----------------------------------------------------------------
if (command === "list") {
  const listed = git(["worktree", "list"]);
  if (listed.status !== 0) fail(`git worktree list failed: ${listed.err.trim()}`);
  console.log(listed.out.trimEnd());
  process.exit(0);
}

const check = validateSlug(slug);
if (!check.ok) refuse(check.reason);
const plan = planFor(slug, repoRoot, parentDir);
/* ⚠ THE CONVENTION, AND `add`'s ALONE (#1613). It is not on `plan`, so nothing
   on the removal path below can reach it by a property access — which is the
   whole repair, because tightening five call sites would have left the derived
   name one edit away from coming back. */
const newBranch = branchToCreate(slug);

// ---- add ------------------------------------------------------------------
if (command === "add") {
  // ⚠ REFUSE BEFORE THE FIRST MUTATION, NOT HALFWAY THROUGH (round 2,
  // findings 1 and 2). `add` performs four acts; each of these would have let
  // it fail after some of them, leaving a half-made worktree for the shift to
  // work out.
  if (process.platform !== "win32") {
    refuse("`add` junctions node_modules with `cmd /c mklink`, which only exists on Windows");
  }
  if (existsSync(plan.path)) refuse(`${plan.path} already exists`);

  // The tool's two halves must not contradict each other: `remove` deliberately
  // says "the branch still exists locally", and `git worktree add -b` refuses a
  // branch that exists. Removing a slug on Monday and re-adding it on Wednesday
  // is an ordinary thing to do, and it used to end in a raw git error with no
  // remedy named.
  //
  // NOT `-B`, which silently resets an existing branch — that is precisely the
  // destruction this tool exists to prevent, and it would throw away commits
  // the `remove` guards had just refused to destroy.
  if (git(["rev-parse", "--verify", "--quiet", `refs/heads/${newBranch}`]).status === 0) {
    refuse(
      `the branch ${newBranch} already exists locally (a previous \`remove\` keeps it on purpose). Delete it with \`git branch -D ${newBranch}\` if it holds nothing you want, or choose another slug.`,
    );
  }

  console.log(`shift-worktree add ${slug}`);
  console.log(`  path   ${plan.path}`);
  console.log(`  branch ${newBranch} (from origin/main)`);
  console.log("");

  if (!dryRun) {
    const fetched = git(["fetch", "origin", "main"]);
    if (fetched.status !== 0) fail(`git fetch failed: ${fetched.err.trim()}`);
  }
  say("fetch origin/main");

  if (!dryRun) {
    const added = git(["worktree", "add", plan.path, "-b", newBranch, "origin/main"]);
    if (added.status !== 0) fail(`git worktree add failed: ${added.err.trim()}`);
  }
  say(`create the worktree on ${newBranch}`);

  // The junction, not a copy: the install is over a gigabyte and every shift
  // would pay it twice a night under the overlap rule.
  if (!dryRun) {
    const linked = run("cmd", ["/c", "mklink", "/J", plan.nodeModulesLink.replace(/\//g, "\\"), `${repoRoot.replace(/\//g, "\\")}\\node_modules`]);
    if (linked.status !== 0) fail(`could not junction node_modules: ${(linked.err || linked.out).trim()}`);
  }
  say("junction node_modules -> the main tree's");

  if (!dryRun) {
    if (!existsSync(plan.envSource)) fail(`${plan.envSource} does not exist — a worktree without it cannot run the app`);
    copyFileSync(plan.envSource, plan.envTarget);
  }
  say("copy .env");

  // The CRLF read is cheap and the alternative is an hour of chasing eight
  // suites that assert on substrings.
  if (!dryRun) {
    const sample = path.join(plan.path, "package.json");
    if (existsSync(sample) && looksCrlfSmudged(readFileSync(sample, "utf8"))) {
      console.log("");
      console.log("  ⚠ THIS CHECKOUT IS CRLF-SMUDGED. About eight substring suites will fail for");
      console.log("    no reason you can see. Normalise to LF before trusting a red.");
    }
  }
  say("check line endings");

  console.log("");
  console.log(dryRun ? "--dry-run: nothing was changed." : `Ready: cd ${plan.path}`);
  process.exit(0);
}

// ---- remove ---------------------------------------------------------------
// ⚠ THE MIRROR OF THE LEFTOVER CASE, AND THE SAME CLASS (round 2, finding 3).
// Round 1 made "directory present, git has let go" reachable; this is
// "git still holds a registration, directory already gone". Refusing left the
// stale entry for the shift to `git worktree prune` by hand — the tool
// dead-ending on its own lifecycle, which is the shape worth fixing rather than
// the two instances.
if (!existsSync(plan.path)) {
  const stale = git(worktreeListArgs());
  const staleEntry = stale.status === 0 ? entryForPath(parseWorktreeList(stale.out), plan.path) : null;
  if (staleEntry === null) refuse(`${plan.path} does not exist`);
  console.log(`shift-worktree remove ${slug}`);
  console.log(`  the directory is already gone, but git still has it registered — pruning.`);
  if (!dryRun) git(["worktree", "prune"]);
  say("prune the stale registration");
  console.log("");
  /* ⚠ THE BRANCH IS READ OFF THE STALE ENTRY, NOT SPELLED (#1613). The listing
     still names it, so this line can be true; before, it named `team/<slug>`
     and was fiction for any worktree made on an existing branch. */
  const staleBranch = branchForRemoval(staleEntry);
  console.log(
    dryRun
      ? "--dry-run: nothing was changed."
      : branchReadFailed(staleBranch)
        ? `Pruned. Which branch it was on could not be read — ${staleBranch.unreadable}.`
        : `Pruned. The branch ${staleBranch.branch} still exists locally.`,
  );
  process.exit(0);
}

// Read the state BEFORE deciding anything, and read it from the worktree
// itself — asking the main tree about another worktree's branch is how a
// helper comes to be confidently wrong about whose work it is deleting.
// ⚠ ONE LISTING ANSWERS BOTH QUESTIONS, AND ITS PARSER LIVES IN THE LIBRARY
// (#1613). This file held TWO hand-rolled copies of the `worktree <path>` line
// test and was about to need a third for the branch — working law 4. The exact
// match rather than a substring (review finding 3) and the backslash
// normalisation are `parseWorktreeList`'s, with the reasons on it. The status is
// still checked here: a failed listing must not read as "not registered", which
// is a state with a different consequence.
const listed = git(worktreeListArgs());
if (listed.status !== 0) fail(`git worktree list failed: ${listed.err.trim()}`);
const entry = entryForPath(parseWorktreeList(listed.out), plan.path);
const registered = entry !== null;
/* ⚠ THE BRANCH THIS WORKTREE IS ACTUALLY ON — every later use is this, never
   `team/<slug>`. An unregistered leftover and a detached HEAD both come back
   unreadable rather than falling back to the convention (#1613). */
const branchRead = branchForRemoval(entry);

/**
 * ⚠ THE LEFTOVER CASE IS REACHABLE AND MUST NOT DEAD-END (review finding 1).
 *
 * A directory that git no longer knows about — the documented git 2.55
 * "unregisters and leaves the directory behind" outcome, or this script's own
 * run failing at the delete after the unregister succeeded — has a `.git` file
 * pointing at a pruned entry, so BOTH git probes below fail. Exiting on that
 * would send the shift back to hand-typing a recursive delete, which is the one
 * hazard this tool exists to remove, and it would do so on the second run of
 * the tool itself.
 *
 * So an unregistered path is treated as litter: there is no branch state to
 * protect because git has already let go of it.
 */
let unpushedCommits = 0;
let dirtyFiles: string[] = [];

if (registered) {
  const unpushed = git(["log", "--oneline", "@{u}..HEAD"], plan.path);
  if (unpushed.status === 0) {
    unpushedCommits = unpushed.out.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
    // ⚠ AND THE UPSTREAM MAY BE `origin/main` RATHER THAN THIS BRANCH (review
    // finding 4). `git worktree add -b team/x <path> origin/main` sets the new
    // branch's upstream to origin/main, so before a `push -u` every commit
    // reads as unpushed even when `origin/team/x` already has them. That
    // over-refuses, which is the safe direction — but a guard that refuses on
    // healthy input trains the `--force` habit, so ask the remote branch too
    // and take the smaller honest count.
    // ⚠ AND AGAINST THE BRANCH IT IS ON, NOT AGAINST `team/<slug>` (#1613).
    // `origin/team/<slug>` is a ref that does not exist for a worktree made on
    // an existing branch, so this command simply failed and the correction it
    // exists for could never happen. With the branch unreadable there is
    // nothing to ask, and the `@{u}` count stands — which over-refuses, the
    // safe direction, rather than guessing a ref.
    if (unpushedCommits > 0 && !branchReadFailed(branchRead)) {
      const againstOwnRemote = git(["log", "--oneline", `origin/${branchRead.branch}..HEAD`], plan.path);
      if (againstOwnRemote.status === 0) {
        unpushedCommits = againstOwnRemote.out.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
      }
    }
  } else {
    // No upstream at all — every commit since main is unpushed, which is the
    // MOST dangerous case and must never read as zero.
    const sinceMain = git(["log", "--oneline", "origin/main..HEAD"], plan.path);
    if (sinceMain.status === 0) {
      unpushedCommits = sinceMain.out.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
    } else {
      fail("could not tell whether this branch has unpushed commits — refusing to guess about deleting work");
    }
  }

  const status = git(["status", "--porcelain"], plan.path);
  if (status.status !== 0) fail(`git status in the worktree failed: ${status.err.trim()}`);
  dirtyFiles = status.out
    .split(/\r?\n/)
    .map((l) => l.slice(3).trim())
    .filter((l) => l.length > 0);
}

/**
 * ⚠ ASKED ONLY WHEN IT COULD CHANGE THE ANSWER (#1540).
 *
 * `remove` has always worked offline and still does: with nothing unpushed there
 * is no refusal to clear, so no network call is made and the happy path is
 * exactly as fast and as offline as it was. The read happens on the one path
 * where the ref graph cannot tell a merged branch from lost work — and when it
 * cannot be taken, the refusal stands and SAYS it could not be taken, which is
 * today's behaviour plus one honest sentence rather than a new dependency.
 */
const ship: ShipReading | null = unpushedCommits > 0
  ? shipReadingFor(
      /* ⚠ THE BRANCH READ, NOT THE CONVENTION (#1613) — and this is the site
         that actually broke. `gh pr list --head team/<slug>` named a branch no
         pull request had ever used, so the answer was always "no merged pull
         request" and #1540's friendly outcome was dead for every worktree made
         on an existing branch. An unreadable branch becomes an unreadable
         READING rather than a confident "nobody merged this". */
      branchRead,
      (args) => runOptional("gh", args),
      /* Through `git`, in the WORKTREE, because HEAD is the branch tip and the
         rest of this block already reads it there. `git` may `fail` on a missing
         binary and that is right: this tool cannot work without git. A fetch
         that merely FAILS (offline, no such ref) is a non-zero status and
         becomes `unreadable`, which refuses. */
      (args) => git(args, plan.path),
    )
  : null;

/* The fold lives in the library, not here, so the arms drive the real mapping
   rather than a copy — and so the fail-closed choice inside it has one owner. */
const state: RemovalState = {
  unpushedCommits,
  dirtyFiles,
  registered,
  junctionPresent: stillOnDisk(plan.nodeModulesLink),
  ...removalStateFromShipReading(ship),
};

console.log(`shift-worktree remove ${slug}`);
console.log(`  path       ${plan.path}`);
/* ⚠ THE BRANCH IT IS ON, OR WHY THAT COULD NOT BE READ (#1613). This line sits
   four lines above a recursive delete, and a shift reads it to decide whether to
   pass `--force`; it printed `team/<slug>` and named a non-existent branch on the
   run that found the defect. */
console.log(`  branch     ${branchReadFailed(branchRead) ? `UNREADABLE — ${branchRead.unreadable}` : branchRead.branch}`);
console.log(`  unpushed   ${state.unpushedCommits} commit(s)`);
console.log(`  uncommitted ${state.dirtyFiles.length} file(s)`);
/* ⚠ PRINTED ONLY WHEN IT WAS ASKED (#1540) — a `merged  —` line on every clean
   removal would read as "checked, and it never merged", which is the confident
   wrong sentence this card is about wearing different clothes. */
if (state.unpushedCommits > 0) {
  console.log(`  merged     ${
    typeof state.mergedPullRequest === "number"
      ? `yes, PR #${state.mergedPullRequest} — and its head contains HEAD, so those commits shipped`
      : prReadFailed(state.mergedPullRequest)
        ? `NOT READ (${state.mergedPullRequest.unreadable})`
        : state.unshippedPastMerge !== null
          ? `PR #${state.unshippedPastMerge.pr} merged this branch, but ${state.unshippedPastMerge.commits} commit(s) came AFTER it and did not ship`
          : "no merged pull request names this branch"
  }`);
}
console.log("");

const verdict = decideRemoval(state, force);
if (!verdict.proceed) refuse(verdict.reason);
for (const warning of verdict.warnings) console.log(`  ⚠ ${warning}`);

// ⚠ THE JUNCTION, FIRST, AND PROVEN GONE BEFORE ANYTHING RECURSIVE RUNS.
if (state.junctionPresent) {
  if (!dryRun) {
    const unlinked = run("cmd", ["/c", "rmdir", plan.nodeModulesLink.replace(/\//g, "\\")]);
    if (unlinked.status !== 0) {
      refuse(
        `could not remove the node_modules junction (${(unlinked.err || unlinked.out).trim()}). Nothing else was touched — a recursive delete past a live junction would empty the main tree's node_modules.`,
      );
    }
  }
  say("remove the node_modules junction");
}

// The proof, not the assumption. `rmdir` on a junction removes the LINK; if
// something went wrong and the path is still there, the next step would walk
// into the real install.
//
// ⚠ `stillOnDisk` and not `existsSync` (#654, law 7 sweep). This comment has
// always said "if the path is still there", and `existsSync` FOLLOWS the link
// — so a junction whose target had gone read as absent while the link was
// still standing in the directory about to be removed. The reading now sees
// the link itself, which is what the sentence claims.
if (!dryRun) {
  const stillThere = junctionMustBeGone(stillOnDisk(plan.nodeModulesLink));
  if (!stillThere.ok) refuse(stillThere.reason);
}
say("prove the junction is gone");

// Two acts, because one is not enough on this machine: git 2.55 on Windows
// reports `Invalid argument`, unregisters the worktree and leaves the
// directory (reproduced 4/4).
if (state.registered) {
  if (!dryRun) git(["worktree", "remove", "--force", plan.path]);
  say("unregister the worktree (its failure is expected on this machine)");
}

if (!dryRun) {
  // ⚠ CAUGHT, BECAUSE AN UNCAUGHT THROW HERE EXITS 1 — THE "REFUSED, NOTHING
  // WAS CHANGED" CODE — AFTER THE JUNCTION IS GONE AND THE WORKTREE IS
  // UNREGISTERED (review finding 2). `force: true` only suppresses a missing
  // path; a file held open on Windows still throws EBUSY/EPERM. Anything
  // reading the documented exit codes would call a partial removal a clean
  // no-op, which is the worst of the three things it could think.
  try {
    rmSync(plan.path, { recursive: true, force: true });
  } catch (error) {
    fail(
      `could not delete ${plan.path}: ${error instanceof Error ? error.message : String(error)}. The junction is already removed and the worktree unregistered — close whatever holds the directory and run remove again.`,
    );
  }
  if (existsSync(plan.path)) fail(`${plan.path} is still present — something holds it open`);
  git(["worktree", "prune"]);
}
say("delete the directory and prune");

console.log("");
console.log(
  dryRun
    ? "--dry-run: nothing was changed."
    : branchReadFailed(branchRead)
      ? `Removed. Which branch it was on could not be read — ${branchRead.unreadable}.`
      : `Removed. The branch ${branchRead.branch} still exists locally.`,
);
process.exit(0);
