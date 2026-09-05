/**
 * `pnpm preflight` — ask the branch the gate's cheap questions BEFORE the first
 * push (#543, founder-ordered and urgent 2026-09-05: *"investigate our current
 * process and optimize it as urgent."*).
 *
 *     pnpm preflight                 # the whole list, stopping at the first red
 *     pnpm preflight --list          # what it would run, and why, spending nothing
 *     pnpm preflight --no-tests      # the three atlas/type checks and the guards only
 *     pnpm preflight --base origin/main
 *
 * WHAT IT IS FOR, in one line: the gate ran **3.1 times per merged PR** at ~7
 * minutes each, and a shift was idle for every one of those minutes. Nearly all
 * of that is a first run failing on a question the branch could have answered
 * locally in under a minute.
 *
 * ⚠ A GREEN PREFLIGHT IS A FLOOR, NOT A PROMISE — and the ways it can honestly
 * differ from the gate are written down rather than discovered: see
 * `EXCUSED_GATE_STEPS` in `lib/preflight.mts` (gitleaks, actionlint/zizmor,
 * semgrep, the full suite, the design-law browser controls). It runs no
 * network, no database and no browser; it is safe on any tree at any time.
 *
 * EXIT CODES — the finding is the exit code, so the shift's heartbeat can carry it:
 *     0  every check green
 *     1  a check went red (its name and output are above the summary)
 *     2  tool error — preflight could not run a check at all
 *
 * Read-only apart from what the checks themselves write: `pnpm architecture:check`
 * and `pnpm capability:check` are checkers, not generators, and vitest writes
 * nothing to the tree.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

import {
  PREFLIGHT_CHECKS,
  chunkVitestFiles,
  formatSeconds,
  selectDiffAdjacentTests,
  vitestArgv,
  type PreflightCheck,
} from "./lib/preflight.mts";

function fail(message: string): never {
  console.error(`preflight: ${message}`);
  process.exit(2);
}

// ---- arguments ------------------------------------------------------------
// Refusing an unknown flag rather than ignoring it: a `--dry-run` that did not
// exist was ignored once on this team and stamped a running shift's row
// terminal (#288). Every writer and reader here refuses what it does not know.
const argv = process.argv.slice(2);
let base = "origin/main";
let runTests = true;
let listOnly = false;

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === "--list") listOnly = true;
  else if (arg === "--no-tests") runTests = false;
  else if (arg === "--base") {
    const value = argv[i + 1];
    if (!value) fail("--base needs a git ref");
    base = value;
    i += 1;
  } else if (arg.startsWith("--base=")) base = arg.slice("--base=".length);
  else fail(`unknown flag ${arg} (known: --list, --no-tests, --base <ref>)`);
}

const repoRoot = path.resolve(import.meta.dirname, "..");

function git(args: string[]): string {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) {
    fail(`git ${args.join(" ")} failed: ${(result.stderr || result.stdout || "").trim()}`);
  }
  return result.stdout;
}

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

// ---- the diff -------------------------------------------------------------
// Three sources, because a shift's tree is rarely all in one state: what the
// branch has committed since it left main, what is staged, and what is merely
// written. A file in ANY of them is part of what the first push will carry.
//
// The merge base rather than a plain `base..HEAD`: a branch cut before main
// moved would otherwise select the whole of main's drift as "the diff".
function changedFiles(): { files: string[]; baseUsed: string | null } {
  const hasBase = spawnSync("git", ["rev-parse", "--verify", "--quiet", `${base}^{commit}`], {
    cwd: repoRoot,
    encoding: "utf8",
  }).status === 0;

  const collected = new Set<string>();
  let baseUsed: string | null = null;

  if (hasBase) {
    const mergeBase = spawnSync("git", ["merge-base", base, "HEAD"], { cwd: repoRoot, encoding: "utf8" });
    if (mergeBase.status === 0 && mergeBase.stdout.trim()) {
      baseUsed = mergeBase.stdout.trim();
      for (const file of lines(git(["diff", "--name-only", baseUsed, "HEAD"]))) collected.add(file);
    }
  }
  for (const file of lines(git(["diff", "--name-only", "HEAD"]))) collected.add(file);
  for (const file of lines(git(["diff", "--name-only", "--cached"]))) collected.add(file);
  // Untracked files are part of the push only once added, but a new test file
  // written this shift is exactly the thing worth running, and a shift that
  // forgot to `git add` it learns that here rather than at the gate.
  for (const file of lines(git(["ls-files", "--others", "--exclude-standard"]))) collected.add(file);

  return { files: [...collected].sort(), baseUsed };
}

/**
 * Every tracked file, filtered in code rather than by pathspec.
 *
 * ⚠ THE PATHSPEC ROAD IS A TRAP AND PREFLIGHT CAUGHT IT ON ITSELF. The first
 * draft asked git for `server/**\/*.test.ts`; git's default pathspec is
 * wildmatch WITHOUT pathname semantics, so `*` already matches `/` and the
 * literal slash after `**` makes the pattern require at least one
 * subdirectory. `server/foo.test.ts` — 263 of the repository's files — matched
 * NOTHING, and this script's own new arm reported "no neighbouring suite"
 * while sitting in the most-populated test directory in the tree. It failed
 * silently and in the direction that runs fewer tests, which is the only
 * direction that matters here.
 *
 * Listing once and filtering in TypeScript costs one process and cannot have
 * a glob dialect.
 */
function repoTestFiles(): string[] {
  const isSuite = (file: string) => {
    const unix = file.replace(/\\/g, "/");
    if (!unix.startsWith("server/") && !unix.startsWith("client/src/")) return false;
    return unix.endsWith(".test.ts") || unix.endsWith(".spec.ts");
  };
  // ⚠ THE UNTRACKED LISTING IS NOT OPTIONAL, AND LEAVING IT OUT WAS A SIBLING
  // OF THE PATHSPEC BUG ABOVE (review finding 1 on PR #549 — the sweep this
  // file's own two defects should have caught and did not).
  //
  // `changedFiles()` deliberately collects untracked files, on the stated
  // ground that a new test file written this shift is exactly the thing worth
  // running. But a file can only be SELECTED if it appears here, so while this
  // was `git ls-files` alone a brand-new `server/thing.test.ts` was the one
  // file in the diff that could never run — and because `server/` holds 263
  // tracked neighbours the directory read as covered and preflight reported
  // green. Silent, and in the fewer-tests direction, which is the only one
  // that matters here.
  return [
    ...lines(git(["ls-files"])),
    ...lines(git(["ls-files", "--others", "--exclude-standard"])),
  ].filter(isSuite);
}

const { files: changed, baseUsed } = changedFiles();
const selection = selectDiffAdjacentTests(changed, repoTestFiles());

const checks: PreflightCheck[] = [...PREFLIGHT_CHECKS];
if (runTests && selection.files.length > 0) {
  // Chunked, never truncated — see `chunkVitestFiles`. On this repository a
  // one-file change under `server/` selects 263 suites and a single command
  // line of 9,075 characters, which is past cmd.exe's limit; the node entry
  // plus these chunks keep every invocation comfortably inside CreateProcess's.
  const chunks = chunkVitestFiles(selection.files);
  const where = `${selection.files.length} file${selection.files.length === 1 ? "" : "s"} in ${selection.directories.length} dir${selection.directories.length === 1 ? "" : "s"}`;
  chunks.forEach((chunk, index) => {
    const part = chunks.length === 1 ? "" : ` — part ${index + 1}/${chunks.length}`;
    checks.push({
      id: chunks.length === 1 ? "diff-tests" : `diff-tests-${index + 1}`,
      label: `Diff-adjacent tests (${where})${part}`,
      command: vitestArgv(chunk),
      gateRun: "",
    });
  });
}

// ---- the report -----------------------------------------------------------
console.log("PREFLIGHT — the gate's cheap checks, before the first push (#543)");
console.log(`  base ${base}${baseUsed ? ` (merge-base ${baseUsed.slice(0, 8)})` : " — not found, working tree only"}`);
console.log(`  ${changed.length} changed file${changed.length === 1 ? "" : "s"}`);
if (selection.directories.length > 0) {
  console.log(`  test directories: ${selection.directories.join(", ")}`);
}
if (selection.uncovered.length > 0) {
  // Named rather than silently dropped: "preflight ran no tests" and "preflight
  // ran the tests there are" look identical from the outside otherwise.
  const shown = selection.uncovered.slice(0, 6).join(", ");
  const more = selection.uncovered.length > 6 ? ` (+${selection.uncovered.length - 6} more)` : "";
  console.log(`  no neighbouring suite: ${shown}${more}`);
}
if (runTests && selection.files.length === 0) {
  console.log("  no diff-adjacent tests — the gate still runs the whole suite");
}
console.log("");

if (listOnly) {
  for (const check of checks) console.log(`  · ${check.label}\n      ${check.command.join(" ")}`);
  console.log("\n--list: nothing was run.");
  process.exit(0);
}

// ---- run ------------------------------------------------------------------
type Result = { readonly check: PreflightCheck; readonly ms: number; readonly ok: boolean };
const results: Result[] = [];
let firstRed: Result | null = null;

for (const check of checks) {
  process.stdout.write(`  … ${check.label}\n`);
  const startedAt = Date.now();
  const [command, ...args] = check.command;
  // `pnpm` is a .cmd shim on Windows and needs a shell; `node` does not, and
  // must NOT get one — a shell routes the command through cmd.exe and its
  // 8,191-character limit, which the 263-file test selection blows past.
  //
  // On the shell road the command goes as ONE string rather than command+args:
  // node deprecated the latter (DEP0190) because a shell concatenates without
  // escaping. Every part of every command here is a literal from
  // `lib/preflight.mts` with no spaces in it — pinned by an arm — so the
  // concatenation is exact, and doing it ourselves is what says so.
  const useShell = process.platform === "win32" && command !== "node";
  const run = useShell
    ? spawnSync(check.command.join(" "), { cwd: repoRoot, stdio: "inherit", shell: true })
    : spawnSync(command, args, { cwd: repoRoot, stdio: "inherit" });
  const ms = Date.now() - startedAt;
  if (run.error) fail(`could not run ${check.command.join(" ")}: ${run.error.message}`);
  const ok = run.status === 0;
  const result: Result = { check, ms, ok };
  results.push(result);
  console.log(`  ${ok ? "OK  " : "RED "} ${check.label} — ${formatSeconds(ms)}\n`);
  if (!ok) {
    // Stop at the first red: the card's rule, and the right one — a shift fixes
    // one thing at a time and every later check runs against a tree that is
    // already known-broken.
    firstRed = result;
    break;
  }
}

// ---- summary --------------------------------------------------------------
const total = results.reduce((sum, result) => sum + result.ms, 0);
console.log("─".repeat(64));
for (const result of results) console.log(`  ${result.ok ? "OK  " : "RED "} ${result.check.label} — ${formatSeconds(result.ms)}`);
const skipped = checks.length - results.length;
if (skipped > 0) console.log(`  ---  ${skipped} check${skipped === 1 ? "" : "s"} not reached`);
console.log(`  total ${formatSeconds(total)}`);

if (firstRed) {
  console.log("");
  console.log(`PREFLIGHT RED on ${firstRed.check.id}. Fix it, then run again — the gate would have`);
  console.log("spent ~7 minutes to tell you the same thing, and this is the run the");
  console.log("3.1-runs-per-PR figure exists to remove.");
  if (firstRed.check.id === "architecture" || firstRed.check.id === "capability") {
    // ⚠ THE COMMONEST HONEST RED, AND IT IS ABOUT ORDER RATHER THAN CORRECTNESS.
    // `.githooks/atlas-stage` regenerates both maps AT COMMIT TIME (#501), so a
    // tree with uncommitted source changes is stale here by construction. Left
    // unexplained this reddens on almost every pre-commit run and teaches the
    // shift that preflight's atlas check means nothing.
    console.log("");
    console.log("If you have not committed yet, this is expected rather than wrong: the commit");
    console.log("hook regenerates both maps (#501). Commit first, then run preflight — the map");
    console.log("it checks is the one your commit actually carries.");
  }
  if (firstRed.check.id.startsWith("diff-tests")) {
    // ⚠ SAID OUT LOUD BECAUSE A TOOL THAT REDDENS AT RANDOM IS A TOOL A SHIFT
    // LEARNS TO IGNORE (#548, found by this script on its own branch). A few
    // suites drive real child processes inside vitest's 5s default timeout;
    // under the parallel load of a large selection they lose the race and fail
    // with `Test timed out in 5000ms` — a different set each run. Naming the
    // one command that tells the two apart costs a line and saves the trust.
    console.log("");
    console.log("If a named suite passes when you run it ALONE, that red is #548 — a");
    console.log("load-sensitive timeout in a suite that spawns child processes, not your");
    console.log("change. Check with:  node node_modules/vitest/vitest.mjs run <that file>");
  }
  process.exit(1);
}

console.log("");
console.log("PREFLIGHT GREEN — a floor, not a promise: the gate still runs the full suite,");
console.log("gitleaks, actionlint/zizmor, semgrep and the design-law controls (each excused");
console.log("with its reason in scripts/lib/preflight.mts).");
process.exit(0);
