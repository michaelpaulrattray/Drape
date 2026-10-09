/**
 * `shift-worktree` — cut and take down a shift's worktree, once, correctly
 * (#543 build item 2, founder-ordered and urgent 2026-09-05).
 *
 *     npx tsx scripts/shift-worktree.mts add <slug>
 *     npx tsx scripts/shift-worktree.mts remove <slug> [--force]
 *     npx tsx scripts/shift-worktree.mts add --pr <n>            (a review)
 *     npx tsx scripts/shift-worktree.mts remove --pr <n> [--force]
 *     npx tsx scripts/shift-worktree.mts list
 *     … any of the above with --dry-run
 *
 * `add` creates `../drape-shift-<slug>` on `team/<slug>` from `origin/main`,
 * junctions `node_modules` at the main tree's, copies `.env`, and checks the
 * checkout is not CRLF-smudged. `remove` takes the junction out FIRST, proves
 * it is gone, then unregisters the worktree and deletes the directory.
 *
 * ⚠ **AND `--pr <n>` IS THE REVIEW ROAD, WHICH HAD A CUT STEP AND NO REMOVAL
 * STEP AT ALL UNTIL #1796.** Reviewing a pull request by hand meant typing
 * `git worktree add -b team/<slug> … && mklink /J … && cp .env` and nothing
 * afterwards — so **nineteen zero-file `drape-review-<n>` shells accumulated in
 * three days**, each holding a live junction into the main tree's
 * `node_modules`, and two more appeared inside the hour the Janitor swept them.
 * Nobody skipped a step: the road had no second half to skip. The fix is this
 * mode rather than a sweep, because a per-instance sweep against a per-review
 * producer is the shape that let the stale-poller count reach 183.
 *
 * A review worktree differs from a shift's in exactly two ways, and both are
 * deliberate: it is **DETACHED at `refs/pull/<n>/head`**, so it creates no local
 * branch (the hand road's branch-per-review is the second contributor #1797
 * measures, local `team/*` refs 115 → 295 in three days) and GitHub keeps that
 * ref forever, which is the restore road for anything the removal destroys; and
 * its removal asks `decideReviewRemoval` about that ref instead of asking
 * `decideRemoval` about a branch, which on a detached HEAD would report the
 * pull request's own commits as work about to vanish and refuse every review.
 * **Everything destructive — junction out first, proven gone, unregister,
 * delete — is the same code on both roads.**
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
 * ⚠ **AND SINCE #1823 IT ASKS ABOUT IGNORED FILES, BECAUSE `git status` DOES NOT
 * LIST THEM AND `output/` IS IGNORED.** The dirty read was `git status
 * --porcelain` from the day this tool was written, so a worktree holding a
 * court's entire artifact set was indistinguishable from one holding nothing.
 * Measured 2026-10-03 on `drape-shift-sign-engine-court-1394`: the sweep was told
 * `uncommitted 0 file(s)` over **1.357 GB in 188 files** — 155 renders and the
 * eye strips a founder verdict was given on. Nothing was lost, because the sweep
 * moved it by hand first; what is honest is that **every worktree removal this
 * program has performed ran on that verdict**, and nobody knows what the earlier
 * ones took.
 *
 * The reading is one call (`--ignored=matching`, which collapses a wholly-ignored
 * directory and never descends into the `node_modules` junction), and what it
 * finds is split by a NAMED set of paths worth keeping — `output/`,
 * `.calibration/`, `.theme-shots/`, `.playwright-mcp/`. The rest (`node_modules/`,
 * `.vite`, `dist`, `.env`) is counted and never refused on: a guard that fires on
 * a build cache is a guard that gets `--force`d by habit. The kept set earns the
 * same overridable refusal uncommitted work does, with its bytes in the sentence,
 * and the `ignored` line prints on EVERY run — silence about a population cannot
 * be told apart from an empty one, which is exactly what the report that lost the
 * court looked like.
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
  classifyIgnored,
  decideRemoval,
  decideReviewRemoval,
  entryForPath,
  ignoredReadingLine,
  installedLockfilePath,
  judgeSharedInstall,
  junctionMustBeGone,
  looksCrlfSmudged,
  parseWorktreeList,
  parseWorktreeStatus,
  planFor,
  prHeadFetchIntoRefArgs,
  prReadFailed,
  readHeadAgainstPrHead,
  removalStateFromShipReading,
  reviewCheckoutRef,
  reviewPlanFor,
  reviewWorktreeAddArgs,
  sharedInstallWarning,
  shipReadingFor,
  validatePrNumber,
  validateSlug,
  worktreeListArgs,
  worktreeStatusArgs,
  type KeptIgnoredPath,
  type RemovalState,
  type ReviewRemovalVerdict,
  type ShipReading,
  type WorktreePlan,
} from "./lib/shiftWorktree.mts";
/* The two disk readings that stand beside this recursive delete, shared with the
   rite's own teardown rather than re-declared here (#654 and #1823, law 7). */
import { measureTree, stillOnDisk } from "./lib/riteWorktree.mts";

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
let prArg: string | null = null;
let force = false;
let dryRun = false;

for (let i = 1; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === "--force") force = true;
  else if (arg === "--dry-run") dryRun = true;
  else if (arg === "--pr") {
    /* ⚠ A FLAG IS NEVER SWALLOWED AS THE VALUE. `remove --pr --dry-run` taking
       `--dry-run` as the number would leave `dryRun` false on the one command
       that deletes; refusing says so before anything is read. */
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      fail("--pr needs a pull request number, as in `--pr 1794`");
    }
    prArg = value;
    i += 1;
  } else if (arg.startsWith("--pr=")) prArg = arg.slice("--pr=".length);
  else if (arg.startsWith("--")) fail(`unknown flag ${arg} (known: --pr, --force, --dry-run)`);
  else if (slug === "") slug = arg;
  else fail(`unexpected argument ${arg}`);
}

if (!command || !["add", "remove", "list"].includes(command)) {
  fail("usage: shift-worktree <add|remove|list> [slug|--pr <n>] [--force] [--dry-run]");
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

/* ⚠ TWO PLANS, ONE REMOVAL (#1796). A shift's worktree is named by its slug and
   a REVIEW worktree by the pull request it is for; everything downstream of this
   point reads `plan`, so the destructive sequence has one owner whichever road
   got here. `reviewPr` is non-null for exactly the review road and nothing else
   derives it. */
let plan: WorktreePlan;
let reviewPr: number | null = null;
if (prArg !== null) {
  if (slug !== "") {
    fail(`--pr ${prArg} and the slug \`${slug}\` name two different worktrees — give one or the other`);
  }
  const read = validatePrNumber(prArg);
  if (!read.ok) refuse(read.reason);
  reviewPr = read.pr;
  plan = reviewPlanFor(reviewPr, repoRoot, parentDir);
} else {
  const check = validateSlug(slug);
  if (!check.ok) refuse(check.reason);
  plan = planFor(slug, repoRoot, parentDir);
}

// ---- add ------------------------------------------------------------------
if (command === "add") {
  // ⚠ REFUSE BEFORE THE FIRST MUTATION, NOT HALFWAY THROUGH (round 2,
  // findings 1 and 2). `add` performs four acts; each of these would have let
  // it fail after some of them, leaving a half-made worktree for the shift to
  // work out.
  if (process.platform !== "win32") {
    refuse("`add` junctions node_modules with `cmd /c mklink`, which only exists on Windows");
  }
  /* ⚠ THE REVIEW REMEDY IS NAMED, BECAUSE THE UNNAMED ONE IS WHAT PRODUCED
     `drape-review-1794b` (#1796). One pull request reviewed twice met a
     directory in the way, and the second attempt invented a suffix by hand —
     a directory the tool can then never address. There is exactly one path per
     pull request, and the way past an occupied one is to take it down. */
  if (existsSync(plan.path)) {
    refuse(
      reviewPr === null
        ? `${plan.path} already exists`
        : `${plan.path} already exists — either PR #${reviewPr} is already cut for review, or a shell was left behind.`
          + ` Take it down with \`npx tsx scripts/shift-worktree.mts remove --pr ${reviewPr}\` and cut it again.`
          + " Do NOT make a second directory for one pull request.",
    );
  }

  if (reviewPr === null) {
    /* ⚠ THE CONVENTION, AND `add`'s ALONE (#1613). It is declared inside this
       arm, so nothing on the removal path below can reach it at all — which is
       the whole repair, because tightening five call sites would have left the
       derived name one edit away from coming back. A REVIEW worktree is detached
       and has no branch, so this arm is also the only place one is made. */
    const newBranch = branchToCreate(slug);

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
  } else {
    /* ⚠ DETACHED, AT `refs/pull/<N>/head`, AND NEITHER HALF IS INCIDENTAL
       (#1796). No local branch is created, so a review stops feeding the 295
       local `team/*` refs #1797 measures; and the ref it checks out is the one
       GitHub keeps forever, which is what lets `remove` prove the directory
       holds nothing of ours without asking about a branch that does not exist. */
    console.log(`shift-worktree add --pr ${reviewPr}`);
    console.log(`  path   ${plan.path}`);
    console.log(`  head   ${reviewCheckoutRef(reviewPr)} (detached — a review worktree has no branch)`);
    console.log("");

    if (!dryRun) {
      const fetched = git(prHeadFetchIntoRefArgs(reviewPr));
      if (fetched.status !== 0) {
        fail(
          `could not fetch ${reviewCheckoutRef(reviewPr)}: ${(fetched.err || fetched.out).trim().split(/\r?\n/)[0] ?? "no reason given"}.`
          + ` Is #${reviewPr} a pull request on this repository?`,
        );
      }
    }
    say(`fetch ${reviewCheckoutRef(reviewPr)}`);

    if (!dryRun) {
      const added = git(reviewWorktreeAddArgs(reviewPr, plan.path));
      if (added.status !== 0) fail(`git worktree add failed: ${added.err.trim()}`);
    }
    say(`create the worktree detached at PR #${reviewPr}'s head`);
  }

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

  /* ⚠ THE SHARED INSTALL IS READ HERE, FOR THE SAME REASON THE LINE ENDINGS
     ARE: both are a cheap read that replaces an hour of chasing a red that
     names files you never touched. One `node_modules` serves every tree on
     this machine and can only satisfy the ones installed from its lockfile, so
     a dependency bump on main reddens every worktree cut after it (#2148 —
     cookie 2.0.1's `parseCookie` against an install holding cookie 1.0.2, three
     errors in two auth files, nobody's diff). It REPORTS and never installs:
     the repair is a mutation under every other tree and under any running dev
     server, so it belongs to whoever can see the machine. */
  if (!dryRun) {
    const readOrNull = (p: string): string | null => {
      try {
        return readFileSync(p, "utf8");
      } catch {
        return null;
      }
    };
    const others = parseWorktreeList(git(worktreeListArgs()).out)
      .filter((entry) => entry.path !== plan.path)
      .map((entry) => ({ path: entry.path, lock: readOrNull(`${entry.path}/pnpm-lock.yaml`) }));
    const reading = judgeSharedInstall({
      installedLock: readOrNull(installedLockfilePath(repoRoot)),
      treeLock: readOrNull(`${plan.path}/pnpm-lock.yaml`),
      otherTrees: others,
    });
    if (reading.kind === "skew") {
      console.log("");
      for (const line of sharedInstallWarning(reading, repoRoot)) console.log(`  ${line}`);
    } else if (reading.kind === "unreadable") {
      console.log(`  (shared install not checked — ${reading.why})`);
    }
  }
  say("check the shared install matches this tree's lockfile");

  console.log("");
  console.log(dryRun ? "--dry-run: nothing was changed." : `Ready: cd ${plan.path}`);
  /* ⚠ `add` NAMES ITS OWN TAKEDOWN, AND THAT IS THE WHOLE OF #1796 IN ONE LINE.
     The hand-rolled review road had a cut step and no removal step, so nineteen
     shells accumulated in three days — not because anyone skipped a documented
     step, but because the road never had a second half to skip. A road that
     prints its own closing command cannot be half a road, and the class is the
     same for a shift's worktree, so both arms print it. */
  console.log(
    `When you are done: npx tsx scripts/shift-worktree.mts remove ${reviewPr === null ? slug : `--pr ${reviewPr}`}`,
  );
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
  console.log(`shift-worktree remove ${reviewPr === null ? slug : `--pr ${reviewPr}`}`);
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
      /* ⚠ A REVIEW WORKTREE'S DETACHED HEAD IS NOT A FAILED READ (#1796) — the
         sentence below would call the normal state "could not be read". */
      : reviewPr !== null
        ? "Pruned. A review worktree leaves no branch behind."
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
/* ⚠ THE POPULATION `dirtyFiles` CANNOT SEE (#1823). An UNREGISTERED leftover gets
   empty lists here for the same reason it gets no branch state — `git status`
   inside a path whose worktree entry has been pruned cannot run — and that is the
   one honest hole in this repair: nineteen such shells were the subject of #1796,
   and litter is what they are. A directory git has let go of is measured by the
   hand sweep that finds it, not by this tool. */
let keptIgnored: KeptIgnoredPath[] = [];
let disposableIgnored: string[] = [];

if (registered) {
  /* ⚠ THE UNPUSHED COUNT IS A SHIFT-WORKTREE QUESTION AND IS NOT PUT TO A REVIEW
     WORKTREE (#1796). A detached HEAD has no upstream, so every probe below
     would fall through to `origin/main..HEAD` and report the PULL REQUEST'S OWN
     commits as unpushed work about to vanish — a refusal on the happy path of
     every single review, which trains the `--force` habit that is the only thing
     standing between a real find and a deleted directory. The review road asks
     `decideReviewRemoval` instead, about the REF rather than about a branch. */
  if (reviewPr === null) {
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
  }

  /* ⚠ ONE STATUS READ, AND IT NOW ASKS ABOUT IGNORED FILES TOO (#1823). The call
     this line made for its whole life — `git status --porcelain` — cannot see an
     ignored path, and `output/` is ignored, so a worktree holding 1.357 GB of a
     founder-judged court reported `uncommitted 0 file(s)`. The args and the split
     both live in the library so an arm asserts what is SENT (working law 5) and
     drives the split rather than a copy of it. */
  const status = git(worktreeStatusArgs(), plan.path);
  if (status.status !== 0) fail(`git status in the worktree failed: ${status.err.trim()}`);
  const read = parseWorktreeStatus(status.out);
  dirtyFiles = [...read.dirty];
  const ignored = classifyIgnored(read.ignored);
  disposableIgnored = [...ignored.disposable];
  /* ⚠ ONLY THE KEPT SET IS WALKED, AND THAT IS WHERE THE WHOLE COST WOULD BE.
     `node_modules/` is in `disposableIgnored` and measuring it would walk the main
     checkout's install — over a gigabyte — to print a number no verdict reads. */
  keptIgnored = ignored.kept.map((relative) => {
    const bare = relative.replace(/^"|"$/g, "").replace(/\/+$/, "");
    return { path: relative, ...measureTree(path.join(plan.path, bare)) };
  });
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

/**
 * ⚠ THE REVIEW ROAD'S OWN READING, AND IT IS TAKEN ABOUT THE REF (#1796).
 *
 * `shipReadingFor` above cannot serve a review worktree — it asks which pull
 * request names this BRANCH, and a review worktree is detached on purpose. The
 * pull request number is not inferred here; it is the one the reviewer typed, so
 * the reading goes straight to the comparison both roads share.
 *
 * ⚠ **AN UNREGISTERED SHELL IS NOT ASKED AND MUST NOT BE.** That is the state of
 * all nineteen directories this card was filed about: git has let go of them, so
 * there is no HEAD to compare and nothing to protect. `decideRemoval` already
 * warns that it is removing a directory only, which is the honest sentence —
 * asking git about a pruned worktree would come back `unreadable` and REFUSE the
 * cleanup of litter, i.e. refuse the one case the card exists to make easy.
 */
const reviewVerdict: ReviewRemovalVerdict | null =
  reviewPr !== null && registered
    ? decideReviewRemoval(
        readHeadAgainstPrHead(reviewPr, (args) => git(args, plan.path)),
        reviewPr,
        force,
      )
    : null;

/* The fold lives in the library, not here, so the arms drive the real mapping
   rather than a copy — and so the fail-closed choice inside it has one owner. */
const state: RemovalState = {
  unpushedCommits,
  dirtyFiles,
  keptIgnored,
  disposableIgnored,
  registered,
  junctionPresent: stillOnDisk(plan.nodeModulesLink),
  ...removalStateFromShipReading(ship),
};

console.log(`shift-worktree remove ${reviewPr === null ? slug : `--pr ${reviewPr}`}`);
console.log(`  path       ${plan.path}`);
if (reviewPr === null) {
  /* ⚠ THE BRANCH IT IS ON, OR WHY THAT COULD NOT BE READ (#1613). This line sits
     four lines above a recursive delete, and a shift reads it to decide whether to
     pass `--force`; it printed `team/<slug>` and named a non-existent branch on the
     run that found the defect. */
  console.log(`  branch     ${branchReadFailed(branchRead) ? `UNREADABLE — ${branchRead.unreadable}` : branchRead.branch}`);
  console.log(`  unpushed   ${state.unpushedCommits} commit(s)`);
} else {
  /* ⚠ NOT A BRANCH LINE, BECAUSE THERE IS NO BRANCH (#1796). Printing
     `branch UNREADABLE — detached HEAD` over a review worktree would read as a
     fault on the happy path, four lines above a recursive delete. */
  console.log(`  head       ${reviewCheckoutRef(reviewPr)} (detached — a review worktree has no branch)`);
}
console.log(`  uncommitted ${state.dirtyFiles.length} file(s)`);
/* ⚠ BESIDE `uncommitted`, AND ON EVERY RUN — the line the report that lost the
   #1394 court did not have (#1823). A reader cannot tell silence about a
   population from an empty one, and `uncommitted 0 file(s)` standing alone was a
   true number about the wrong population. The sentence has ONE owner in the
   library so the arms drive what is actually printed. */
console.log(`  ignored    ${ignoredReadingLine(state)}`);
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

/* ⚠ THE REVIEW VERDICT IS ASKED FIRST, AND `decideRemoval` STILL RUNS (#1796).
   Two verdicts rather than one widened one, because `decideRemoval` is the
   function that authorises a recursive delete and its arms are the coverage this
   repository has already paid for — it is handed `unpushedCommits: 0` on this
   road and judges exactly what it is still competent to judge (uncommitted work,
   the missing registration, the force warnings). What a review worktree holds
   that no remote has is this one's question, and only this one's. */
if (reviewVerdict !== null) {
  if (!reviewVerdict.proceed) refuse(reviewVerdict.reason);
  console.log(`  ${reviewVerdict.note}`);
}

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
    /* ⚠ AND IT SAYS WHAT A REVIEW LEAVES, WHICH IS NOTHING (#1796/#1797). The
       slug road's sentence exists because `remove` keeps the branch on purpose;
       a review road that printed it would be describing a branch it never made.
       Local `team/*` refs went 115 → 295 in three days partly because the
       hand-rolled review road cut one per review, so "no branch" is the fact
       worth saying out loud rather than the absence of a fact. */
    : reviewPr !== null
      ? "Removed. A review worktree leaves no branch behind, and refs/pull/"
        + `${reviewPr}/head still holds the commits.`
      : branchReadFailed(branchRead)
        ? `Removed. Which branch it was on could not be read — ${branchRead.unreadable}.`
        : `Removed. The branch ${branchRead.branch} still exists locally.`,
);
process.exit(0);
