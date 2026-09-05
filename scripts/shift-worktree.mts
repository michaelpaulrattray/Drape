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
 * EXIT CODES:
 *     0  done (or, with --dry-run, would be done)
 *     1  refused — the reason is printed and nothing was changed
 *     2  tool error
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

import {
  decideRemoval,
  junctionMustBeGone,
  looksCrlfSmudged,
  planFor,
  validateSlug,
  type RemovalState,
} from "./lib/shiftWorktree.mts";

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

// ---- add ------------------------------------------------------------------
if (command === "add") {
  if (existsSync(plan.path)) refuse(`${plan.path} already exists`);

  console.log(`shift-worktree add ${slug}`);
  console.log(`  path   ${plan.path}`);
  console.log(`  branch ${plan.branch} (from origin/main)`);
  console.log("");

  if (!dryRun) {
    const fetched = git(["fetch", "origin", "main"]);
    if (fetched.status !== 0) fail(`git fetch failed: ${fetched.err.trim()}`);
  }
  say("fetch origin/main");

  if (!dryRun) {
    const added = git(["worktree", "add", plan.path, "-b", plan.branch, "origin/main"]);
    if (added.status !== 0) fail(`git worktree add failed: ${added.err.trim()}`);
  }
  say(`create the worktree on ${plan.branch}`);

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
if (!existsSync(plan.path)) refuse(`${plan.path} does not exist`);

// Read the state BEFORE deciding anything, and read it from the worktree
// itself — asking the main tree about another worktree's branch is how a
// helper comes to be confidently wrong about whose work it is deleting.
const registered = git(["worktree", "list", "--porcelain"]).out.replace(/\\/g, "/").includes(plan.path);

let unpushedCommits = 0;
const unpushed = git(["log", "--oneline", "@{u}..HEAD"], plan.path);
if (unpushed.status === 0) {
  unpushedCommits = unpushed.out.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
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
const dirtyFiles = status.out
  .split(/\r?\n/)
  .map((l) => l.slice(3).trim())
  .filter((l) => l.length > 0);

const state: RemovalState = {
  unpushedCommits,
  dirtyFiles,
  registered,
  junctionPresent: existsSync(plan.nodeModulesLink),
};

console.log(`shift-worktree remove ${slug}`);
console.log(`  path       ${plan.path}`);
console.log(`  branch     ${plan.branch}`);
console.log(`  unpushed   ${state.unpushedCommits} commit(s)`);
console.log(`  uncommitted ${state.dirtyFiles.length} file(s)`);
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
if (!dryRun) {
  const stillThere = junctionMustBeGone(existsSync(plan.nodeModulesLink));
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
  rmSync(plan.path, { recursive: true, force: true });
  if (existsSync(plan.path)) fail(`${plan.path} is still present — something holds it open`);
  git(["worktree", "prune"]);
}
say("delete the directory and prune");

console.log("");
console.log(dryRun ? "--dry-run: nothing was changed." : `Removed. The branch ${plan.branch} still exists locally.`);
process.exit(0);
