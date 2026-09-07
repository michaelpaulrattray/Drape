import { execFileSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { listScriptGuardSuites, ORIGIN_SUITE, PUSH_PATH_SUITES, runScriptGuardsOnCommit } from "../scripts/lib/scriptGuards.mts";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

/* This suite drives a real child process, so it declares the class's timeout
   rather than racing vitest's 5 s default under a parallel run (#548). */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

/**
 * The rite's script-guard step (#152) — the derivation and the verdict, driven
 * without a real vitest run. The real run is driven at the artifacts on the PR
 * that lands it: HEAD green, and a commit carrying a breaching script red.
 */
const ROOT = path.resolve(import.meta.dirname, "..");

/**
 * The worktrees git currently knows about, resolved, read from the repository
 * rather than from the file system. This is the property the teardown really
 * owes (#652): a leaked REGISTRATION makes every later `git worktree add`
 * pick a fresh admin name and leaves the repository carrying a tree that is
 * not there, which is what breaks a subsequent run.
 */
const registeredWorktrees = (): string[] =>
  execFileSync("git", ["worktree", "list", "--porcelain"], { cwd: ROOT, encoding: "utf8" })
    .split(/\r?\n/)
    .filter((line) => line.startsWith("worktree "))
    .map((line) => path.resolve(line.slice("worktree ".length)));

describe("the script-guard suite list is derived from the suites", () => {
  it("finds the origin case at the real tree, and more than it alone", () => {
    const suites = listScriptGuardSuites(ROOT);
    expect(suites).toContain(ORIGIN_SUITE);
    /* Six siblings were counted the day this was written; the floor is well
       under that so a retired guard does not redden this, and well above one
       so a derivation that only finds its own origin case does. */
    expect(suites.length).toBeGreaterThanOrEqual(3);
    expect(suites.every((suite) => suite.startsWith("server/") && suite.endsWith(".test.ts"))).toBe(true);
    expect(suites.some((suite) => suite.endsWith(".integration.test.ts"))).toBe(false);
  });

  it("REFUSES rather than running a shorter list when the derivation loses the origin case", () => {
    expect(() => listScriptGuardSuites(ROOT, () => "")).toThrow(/lost its origin case/);
    expect(() => listScriptGuardSuites(ROOT, () => "server/scriptWorldGuard.test.ts\n")).toThrow(/lost its origin case/);
  });

  it("drops integration suites and normalises separators", () => {
    const suites = listScriptGuardSuites(ROOT, () => [
      "server\\scriptExitDiscipline.test.ts",
      "server/foo.integration.test.ts",
      "server/scriptWorldGuard.test.ts",
      "",
    ].join("\n"));
    /* ⚠ THIS ARM MOVED, and it moved because the function's contract changed —
       said out loud rather than edited quietly. `PUSH_PATH_SUITES` (#263) is
       merged in after the derivation, so the list is now "what the grep found,
       plus what somebody named". The arm still pins the derivation's own work:
       the integration suite is dropped and the backslash normalised. */
    expect(suites).toEqual([
      ...PUSH_PATH_SUITES,
      "server/scriptExitDiscipline.test.ts",
      "server/scriptWorldGuard.test.ts",
    ].sort());
  });

  it("the named push-path suites are added, deduplicated, and cannot rescue a broken grep", () => {
    expect(PUSH_PATH_SUITES.length).toBeGreaterThan(0);
    /* Named AND found by the grep: it appears once, not twice. */
    const both = listScriptGuardSuites(ROOT, () => [ORIGIN_SUITE, ...PUSH_PATH_SUITES].join("\n"));
    expect(both.filter((s) => s === PUSH_PATH_SUITES[0])).toHaveLength(1);
    /* The origin floor is checked on the DERIVED list alone, so the named list
       cannot keep a dead derivation looking alive. */
    expect(() => listScriptGuardSuites(ROOT, () => PUSH_PATH_SUITES.join("\n"))).toThrow(/lost its origin case/);
  });
});

describe("the verdict is the runner's exit status on the pushed tree", () => {
  it("runs the suites in a detached worktree of the commit, and tears it down on both arms", () => {
    const seen: { cwd: string; suites: string[]; registeredDuring: boolean }[] = [];
    const vitest = (status: number) => (cwd: string, suites: string[]) => {
      /* Read INSIDE the body, which is the only moment the tree is supposed to
         exist. Without this the absence assertion below is green on nothing —
         a runner that never made a worktree would satisfy it too. */
      seen.push({ cwd, suites, registeredDuring: registeredWorktrees().includes(path.resolve(cwd)) });
      return { status, output: "line 1\n\nline 2\n" };
    };
    const green = runScriptGuardsOnCommit(ROOT, "HEAD", { suites: [ORIGIN_SUITE], vitest: vitest(0) });
    expect(green.ok).toBe(true);
    const red = runScriptGuardsOnCommit(ROOT, "HEAD", { suites: [ORIGIN_SUITE], vitest: vitest(1) });
    expect(red.ok).toBe(false);
    expect(red.printed).toBe("line 1\nline 2");
    /* The runner was handed a tree that is NOT the working directory, and it
       was a real registered worktree while it ran. */
    expect(seen).toHaveLength(2);
    for (const call of seen) {
      expect(path.resolve(call.cwd)).not.toBe(ROOT);
      expect(call.suites).toEqual([ORIGIN_SUITE]);
      expect(call.registeredDuring, "the body ran inside a real worktree of this repository").toBe(true);
    }
    /*
      THE PROMISE IS THE REGISTRATION, NOT THE DIRECTORY (#652).

      This line used to be `expect(seen.some((call) => existsSync(call.cwd)))
      .toBe(false)` and it failed roughly one run in three when the five
      worktree-creating suites ran together — an assertion failure at ~6s, not
      a timeout, so #548's clock fix could never have touched it. A guard that
      reddens at random on a branch that did not touch it is a guard a shift
      learns to ignore, and it reddened two `pnpm preflight` runs the night it
      was filed.

      It was asserting a stronger property than this platform gives. Driven
      before the assertion moved, five concurrent probes of `inWorktreeOf`,
      58 trees: DIRECTORY left behind **4**, REGISTRATION left behind **0** —
      and all four leftovers read `registered=false`. The mechanism is visible
      in git's own stderr: a concurrent `git worktree prune` from a sibling
      suite unregisters a tree whose directory is still there, so this
      teardown's own `git worktree remove --force` then says *"is not a working
      tree"*, throws into the swallowing `catch`, and leaves the directory.
      The registration was gone either way.

      So the two properties genuinely come apart, and only one of them is this
      guard's business: a leaked registration breaks the next run, a leftover
      temp directory is litter. The litter is real — 24 `drape-rite-*` trees
      were standing in `%TEMP%` when this was measured — and it is filed as
      its own card rather than asserted here, because a test cannot fix a
      teardown by failing about it.
    */
    expect(registeredWorktrees()).not.toContain(path.resolve(seen[0].cwd));
    expect(registeredWorktrees()).not.toContain(path.resolve(seen[1].cwd));
    /*
      SIXTY SECONDS, BECAUSE THE SUBJECT IS REAL GIT (#216, second finding).
      This `it()` checks out TWO detached worktrees of HEAD and tears them down.
      Alone on this bench it takes 4823ms against vitest's 5000ms default — a
      177ms margin — so it reddened the Janitor's full `pnpm test` and passed
      alone immediately after, which costs a shift a diagnosis for a red it did
      not cause. The number here is NOT that margin, though: measured inside a
      full 680-file run on 2026-08-29 the same arm took **20547ms**, so a budget
      chosen from the solo timing would have been the same bug again. 60s is the
      house figure for tree-and-git suites (`atlasMergeDriver`, `preCommitGate`,
      whose own arms reach 48.9s under that load). Making the test cheaper is
      the wrong repair: the worktree checkout IS the thing it proves.
    */
  }, 60_000);

  it("throws when the commit cannot be checked out — blind refuses, never allows", () => {
    expect(() => runScriptGuardsOnCommit(ROOT, "no-such-commit-0000", {
      suites: [ORIGIN_SUITE], vitest: () => ({ status: 0, output: "" }),
    })).toThrow();
  });
});
