import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { codeOnly, withoutComments } from "./withoutComments";

/**
 * A ONE-COMMIT REPOSITORY FOR THE ARMS THAT DRIVE THE RITE'S WORKTREE RECIPE
 * (#2212).
 *
 * ⚠ **WHY THIS EXISTS: AN ARM THAT CHECKS OUT A WORKTREE OF THE WHOLE
 * REPOSITORY IS NOT #548'S CLASS, AND #943'S 30 s FLOOR WAS NEVER SIZED FOR
 * IT.** `CHILD_PROCESS_TEST_TIMEOUT_MS` was set from a `tsx` child's worst case
 * (9 s) at about 3×. One `git worktree add` of this repository — 3,838 files —
 * was timed on an idle machine on 2026-10-10 at **29.6 s into `%TEMP%`** and
 * 17.4 s into the home directory, and **2.5 s** an hour later on the same
 * machine; the arms that check one out measured **55–83 s standalone** that
 * day. The cost of the checkout is set by the repository's size and by whatever
 * is scanning `%TEMP%` at that minute, NOT by the code under test — so no floor
 * derived from it holds, and the rite refused a correct tree five runs in a row
 * on exactly those arms.
 *
 * **None of them needed the repository.** Every one proves the runner's
 * plumbing — the verdict mapping, the could-not-run refusal, that a throw
 * propagates, that the tree was real and was torn down — and every one stubs
 * the vitest or `pnpm check` it would run inside. A repository of one tracked
 * file drives the SAME `inWorktreeOf`: a real `git worktree add --detach`, a
 * real junction, a real teardown and prune. Measured here: ~0.4 s for the
 * repository and its first worktree together.
 *
 * It also takes these arms off the shared repository's worktree registry,
 * which is where #652's sibling-prune race and #967's `.git/worktrees/tree1`
 * failure both lived.
 *
 * `server/scriptGuards.test.ts` refuses a suite that hands the real root to the
 * recipe again, so the next arm written beside these inherits the fixture
 * rather than the stopwatch.
 */
export type ThrowawayRepo = {
  /** The repository's working directory — the `root` the recipe is handed. */
  root: string;
  /** Its one commit. */
  sha: string;
  /** Its common git directory, where its worktree admin entries live. */
  commonDir: string;
  /** Deletes it. Safe to call twice. */
  remove: () => void;
};

export const makeThrowawayRepo = (prefix = "rite-fixture-repo-"): ThrowawayRepo => {
  const root = mkdtempSync(path.join(os.tmpdir(), prefix));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
  try {
    git("init", "--quiet");
    git("config", "user.email", "suite@fixture.test");
    git("config", "user.name", "suite");
    /* `inWorktreeOf` junctions `<root>/node_modules` into every tree it makes,
       so the fixture carries one — a real, empty, untracked directory. */
    mkdirSync(path.join(root, "node_modules"));
    writeFileSync(path.join(root, "package.json"), '{ "name": "rite-fixture" }\n');
    git("add", "package.json");
    git("commit", "--quiet", "-m", "fixture");
    const sha = git("rev-parse", "HEAD").trim();
    const commonDir = path.resolve(root, git("rev-parse", "--git-common-dir").trim());
    return { root, sha, commonDir, remove: () => rmSync(root, { recursive: true, force: true }) };
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
};

/**
 * The three entrances to the rite's worktree recipe. Each checks out `root` at
 * a commit — `inWorktreeOf` directly, the other two through it.
 */
export const WORKTREE_RECIPE_CALLS = ["inWorktreeOf", "runScriptGuardsOnCommit", "runTypecheckOnCommit"] as const;

/**
 * Every place in a suite's source that hands THIS repository's own root to the
 * worktree recipe — the shape #2212 removed, read so it cannot come back.
 *
 * Two readings of one source, each for the half it can see. The CALL is read
 * from `codeOnly` — comments and literal contents gone — so a string that only
 * spells a call (a control's fixture, a source-reading arm's anchor) is never
 * a finding. The ROOT is recognised by its DECLARATION, which needs the literal
 * it is built from, so that is read from `withoutComments`: an identifier bound
 * to `path.resolve(import.meta.dirname | __dirname, "..")` (`"../.."` for a
 * nested suite).
 *
 * ⚠ ITS LIMITS, STATED: an INLINE `path.resolve(<dirname>, <literal>)` as the
 * first argument is read as the real root whatever its literal says, because
 * the call reading cannot see literals — bind a fixture to a name instead. And
 * a root reached any other way (`process.cwd()`, a helper's return value, a
 * re-binding) is not seen, so a clean reading is a floor; the population arm
 * beside it proves the reader is at least looking at the files that call the
 * recipe.
 */
export const realRootRecipeCalls = (source: string): string[] => {
  const DIRNAME = String.raw`(?:import\s*\.\s*meta\s*\.\s*dirname|__dirname)`;
  const RESOLVE = String.raw`(?:path\s*\.\s*)?(?:resolve|join)\s*\(\s*`;
  const declared = new RegExp(
    String.raw`\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*${RESOLVE}${DIRNAME}\s*,\s*["'](?:\.\.\/)*\.\.["']\s*\)`,
    "g",
  );
  const roots = Array.from(withoutComments(source).matchAll(declared), (m) => m[1]!.replace(/\$/g, "\\$"));
  const inline = String.raw`${RESOLVE}${DIRNAME}\s*,\s*\)`;
  const firstArg = roots.length > 0 ? String.raw`(?:${inline}|(?:${roots.join("|")})(?![\w$]))` : inline;
  const call = new RegExp(String.raw`\b(?:${WORKTREE_RECIPE_CALLS.join("|")})\s*\(\s*${firstArg}`, "g");
  return Array.from(codeOnly(source).matchAll(call), (m) => m[0]);
};
