import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { untrackedScriptFiles } from "../scripts/typecheck-scripts.mjs";

/**
 * THE SCRIPTS TYPECHECK'S POPULATION IS WHAT THE REPOSITORY HAS (#1231).
 *
 * `check:scripts` is one of the two checks a shift is told to run before it
 * closes, and it was RED on a clean `main` tree for at least four consecutive
 * shifts — 17 errors in six files, none of them the reporting shift's work.
 * `tsconfig.scripts.json` includes `scripts/**​/*`, and a tsconfig cannot tell a
 * committed file from a scratch file, so another seat's unfinished disposable
 * was part of the project.
 *
 * ⚠ **It failed only LOCALLY, which is why it survived four reports.** CI clones
 * the repository and never sees an untracked file, so the gate was green the
 * whole time and the red landed on whoever opened the tree next. #335's sentence
 * is the cost: *"a shift cannot use `pnpm check` as a clean baseline when it is
 * already red, which is how a shift comes to read its own breakage as noise, or
 * stop running it."*
 *
 * The fix is the population rule, not a deletion: the project is the scripts
 * this repository has committed. Nobody's file is removed — #1231's own six are
 * other seats' working files in the founder's tree.
 *
 * # What each arm here is for
 *
 * The rule lives in a runner, so the ways it can rot are: nothing invoking it;
 * the rule quietly becoming a filename pattern; or the runner reporting an empty
 * untracked set and thereby excluding nothing while looking identical to a clean
 * tree. The git behaviour itself is driven against REAL temporary repositories,
 * in both directions, because a tracked and an untracked file look the same on
 * disk and only git can tell them apart.
 */

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

/** A throwaway repository, so the shared worktree's index is never touched. */
function scratchRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "drape-1231-"));
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "seat@example.com");
  git(dir, "config", "user.name", "seat");
  /* No hooks: this repository's `core.hooksPath` is relative, and a scratch repo
     has none of them. */
  git(dir, "config", "core.hooksPath", path.join(dir, ".no-hooks"));
  return dir;
}

describe("the scripts typecheck runs over the scripts the repository has", () => {
  it("something invokes the runner — a rule nothing calls is not a rule", () => {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["check:scripts"]).toContain("scripts/typecheck-scripts.mts");
    /* And `pnpm check` fans out over `check:` names, so the NAME is the wiring. */
    expect(pkg.scripts.check).toContain("/^check:/");
  });

  it("⚠ the population is TRACKED, never a filename pattern", () => {
    /*
      The tempting one-liner was `"exclude": ["scripts/**​/*-disposable.mts"]`, and
      it is refused here with the measurement that refused it: a disposable being
      COMMITTED is the normal end of its life in this repository — its docblock
      is the receipt for a measurement — so the convention names most of the
      tree rather than the scratch.
    */
    const tracked = git(repoRoot, "ls-files", "--", "scripts")
      .split("\n").map((line) => line.trim()).filter(Boolean);
    const disposables = tracked.filter((file) => file.endsWith("-disposable.mts"));

    expect(tracked.length, "the tracked scripts tree came back empty").toBeGreaterThan(400);
    /* Over a third of the committed tree — excluding the convention would drop
       it. The floor is a third rather than the measured 51% so a normal sweep of
       old disposables does not redden this. */
    expect(disposables.length / tracked.length).toBeGreaterThan(1 / 3);

    const config = readFileSync(path.join(repoRoot, "tsconfig.scripts.json"), "utf8");
    expect(config, "the pattern was put into the project after all").not.toContain("-disposable");
  });

  it("⚠ names the untracked, and ONLY the untracked — driven at a real repository", () => {
    const dir = scratchRepo();
    try {
      writeFileSync(path.join(dir, ".gitignore"), "ignored.mts\n", "utf8");
      git(dir, "add", ".gitignore");
      const scripts = path.join(dir, "scripts");
      mkdirSync(scripts, { recursive: true });
      writeFileSync(path.join(scripts, "committed-disposable.mts"), "export const a = 1;\n", "utf8");
      git(dir, "add", "scripts/committed-disposable.mts");
      git(dir, "commit", "-q", "-m", "a committed disposable");

      writeFileSync(path.join(scripts, "scratch-disposable.mts"), "export const b = 2;\n", "utf8");
      writeFileSync(path.join(scripts, "ignored.mts"), "export const c = 3;\n", "utf8");
      /* A file outside `scripts/` must not be reported either — the runner's
         pathspec is what stops it excluding half the repository. */
      writeFileSync(path.join(dir, "loose.mts"), "export const d = 4;\n", "utf8");

      const untracked = untrackedScriptFiles(dir);

      expect(untracked, "the scratch file was not seen, or something else was")
        .toEqual(["scripts/scratch-disposable.mts"]);
      /* Each exclusion stated as its own assertion, so a failure names WHICH
         rule broke rather than printing a diff of two arrays. */
      expect(untracked, "a COMMITTED disposable was excluded — half the tree would go")
        .not.toContain("scripts/committed-disposable.mts");
      expect(untracked, "an ignored file was reported; it was never in the project")
        .not.toContain("scripts/ignored.mts");
      expect(untracked, "a file outside scripts/ was reported").not.toContain("loose.mts");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("⚠ a committed file that is DELETED on disk is not mistaken for scratch", () => {
    /*
      The other direction, and it is the one a naive `git status` reading gets
      wrong: `--others` lists files git does not know about. A tracked file
      removed from the working tree is a DELETION, not scratch, and excluding it
      would quietly narrow the project on any tree mid-rename.
    */
    const dir = scratchRepo();
    try {
      const scripts = path.join(dir, "scripts");
      mkdirSync(scripts, { recursive: true });
      writeFileSync(path.join(scripts, "gone.mts"), "export const a = 1;\n", "utf8");
      git(dir, "add", "scripts/gone.mts");
      git(dir, "commit", "-q", "-m", "a script");
      rmSync(path.join(scripts, "gone.mts"));

      expect(untrackedScriptFiles(dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("⚠ the derived project keeps the chain's own exclude", () => {
    /*
      THE BUG THIS ARM IS THE RECEIPT FOR, found by running the runner rather
      than by reading it. An extending tsconfig REPLACES `exclude` — it does not
      merge — so the first shape of this runner wrote
      `["node_modules","build","dist", …untracked]`, silently dropped
      `**​/*.test.ts` from `tsconfig.json`, pulled every server test file into the
      scripts project and printed 414 errors in 113 seconds. It read exactly like
      the defect it was written to fix.

      Pinned at the two ends rather than at the runner's own line: the chain must
      still carry the test exclusion, and the runner must still derive its list
      from the chain instead of restating one.
    */
    const root = JSON.parse(readFileSync(path.join(repoRoot, "tsconfig.json"), "utf8")) as {
      exclude: string[];
    };
    expect(root.exclude).toContain("**/*.test.ts");

    const runner = readFileSync(path.join(repoRoot, "scripts", "typecheck-scripts.mts"), "utf8");
    expect(runner).toContain("...inheritedExclude(\"tsconfig.scripts.json\")");
    /* A literal list beside the derivation would be the mirror coming back. */
    expect(runner, "the derived exclude restates the chain instead of reading it")
      .not.toMatch(/exclude:\s*\[\s*"node_modules"/);
  });

  it("the generated project is never committable", () => {
    /* An interrupted run leaves the derived config on disk; it names this
       clone's scratch, so committing it would ship one tree's local state as
       everybody's project. */
    const ignore = readFileSync(path.join(repoRoot, ".gitignore"), "utf8");
    expect(ignore).toContain("tsconfig.scripts.tracked.json");
  });
});
