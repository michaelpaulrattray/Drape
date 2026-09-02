import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { listScriptGuardSuites, ORIGIN_SUITE, PUSH_PATH_SUITES, runScriptGuardsOnCommit } from "../scripts/lib/scriptGuards.mts";

/**
 * The rite's script-guard step (#152) — the derivation and the verdict, driven
 * without a real vitest run. The real run is driven at the artifacts on the PR
 * that lands it: HEAD green, and a commit carrying a breaching script red.
 */
const ROOT = path.resolve(import.meta.dirname, "..");

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
    const seen: { cwd: string; suites: string[] }[] = [];
    const vitest = (status: number) => (cwd: string, suites: string[]) => {
      seen.push({ cwd, suites });
      return { status, output: "line 1\n\nline 2\n" };
    };
    const green = runScriptGuardsOnCommit(ROOT, "HEAD", { suites: [ORIGIN_SUITE], vitest: vitest(0) });
    expect(green.ok).toBe(true);
    const red = runScriptGuardsOnCommit(ROOT, "HEAD", { suites: [ORIGIN_SUITE], vitest: vitest(1) });
    expect(red.ok).toBe(false);
    expect(red.printed).toBe("line 1\nline 2");
    /* The runner was handed a tree that is NOT the working directory, and that
       tree is gone afterwards — a leftover worktree is the litter class. */
    expect(seen).toHaveLength(2);
    for (const call of seen) {
      expect(path.resolve(call.cwd)).not.toBe(ROOT);
      expect(call.suites).toEqual([ORIGIN_SUITE]);
    }
    expect(seen.some((call) => existsSync(call.cwd))).toBe(false);
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
