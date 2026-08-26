import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { listScriptGuardSuites, ORIGIN_SUITE, runScriptGuardsOnCommit } from "../scripts/lib/scriptGuards.mts";

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
    expect(suites).toEqual(["server/scriptExitDiscipline.test.ts", "server/scriptWorldGuard.test.ts"]);
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
  });

  it("throws when the commit cannot be checked out — blind refuses, never allows", () => {
    expect(() => runScriptGuardsOnCommit(ROOT, "no-such-commit-0000", {
      suites: [ORIGIN_SUITE], vitest: () => ({ status: 0, output: "" }),
    })).toThrow();
  });
});
