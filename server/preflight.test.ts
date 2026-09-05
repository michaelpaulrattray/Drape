/**
 * THE PREFLIGHT ARMS (#543).
 *
 * Two jobs, and the second is the one that matters.
 *
 * 1. The test SELECTION does what the card says — the vitest files sharing a
 *    directory with the diff — including the shapes that make a selector look
 *    green while selecting nothing: a changed file outside vitest's roots, a
 *    directory with no suite in it, an integration test that must never be
 *    picked up by `pnpm test`'s config.
 *
 * 2. ⚠ THE DRIFT ARM. `PREFLIGHT_CHECKS` is a second list shadowing the gate's
 *    steps, which is the shape working law 4 exists about. It cannot be
 *    derived (only a person knows which gate steps are cheap enough to run
 *    before a push), so instead this suite reads `.github/workflows/gate.yml`
 *    and requires every `run:` command in the gate's CHECK job to be either
 *    adopted by a preflight check or named in `EXCUSED_GATE_STEPS` with a
 *    reason. A new gate step therefore cannot appear without someone deciding
 *    which of the two it is — and a preflight check whose gate step was
 *    renamed reddens here rather than quietly testing something the gate no
 *    longer runs.
 *
 *    Its own negative control is in the suite: a synthetic workflow carrying a
 *    step neither adopted nor excused must be REPORTED, or the arm proves
 *    nothing (working law 2).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  ARGV_BUDGET_CHARS,
  EXCUSED_GATE_STEPS,
  PREFLIGHT_CHECKS,
  VITEST_ENTRY,
  chunkVitestFiles,
  formatSeconds,
  gateRunCommands,
  selectDiffAdjacentTests,
  vitestArgv,
} from "../scripts/lib/preflight.mts";

const repoRoot = path.resolve(import.meta.dirname, "..");

/** Every test file in a fixture repository shaped like this one. */
const REPO_TESTS = [
  "server/foo.test.ts",
  "server/bar.test.ts",
  "server/routes/billing.test.ts",
  "server/castingV2/roll.test.ts",
  "server/castingV2/roll.spec.ts",
  "client/src/foundation/theme.test.ts",
  "server/health.integration.test.ts",
];

describe("selectDiffAdjacentTests — the card's rule", () => {
  it("selects every suite in a changed file's own directory", () => {
    const selection = selectDiffAdjacentTests(["server/routes/billing.ts"], REPO_TESTS);
    expect(selection.files).toEqual(["server/routes/billing.test.ts"]);
    expect(selection.directories).toEqual(["server/routes"]);
    expect(selection.uncovered).toEqual([]);
  });

  it("takes the whole directory, not the file's own arm alone", () => {
    // The commonest miss: changing `server/foo.ts` and running only
    // `server/foo.test.ts` while `server/bar.test.ts` imports it.
    const selection = selectDiffAdjacentTests(["server/foo.ts"], REPO_TESTS);
    expect(selection.files).toEqual(["server/bar.test.ts", "server/foo.test.ts"]);
  });

  it("selects a changed test file's own directory too", () => {
    const selection = selectDiffAdjacentTests(["server/castingV2/roll.test.ts"], REPO_TESTS);
    expect(selection.files).toEqual(["server/castingV2/roll.spec.ts", "server/castingV2/roll.test.ts"]);
  });

  it("dedupes across several changed files in one directory", () => {
    const selection = selectDiffAdjacentTests(["server/foo.ts", "server/bar.ts"], REPO_TESTS);
    expect(selection.files).toEqual(["server/bar.test.ts", "server/foo.test.ts"]);
    expect(selection.directories).toEqual(["server"]);
  });

  it("NEVER selects an integration test — pnpm test's config excludes them and so must this", () => {
    // A `*.integration.test.ts` needs a running dev server. Selecting one turns
    // a green preflight into a red that has nothing to do with the diff, which
    // is precisely how a shift learns to stop running its own checks.
    const selection = selectDiffAdjacentTests(["server/health.ts"], REPO_TESTS);
    expect(selection.files).not.toContain("server/health.integration.test.ts");
    // …and — the arm that could actually fail — `server/` DOES hold other
    // suites, so this is a real exclusion rather than an empty directory.
    expect(selection.files).toEqual(["server/bar.test.ts", "server/foo.test.ts"]);
  });

  it("names a changed file outside vitest's roots rather than dropping it", () => {
    const selection = selectDiffAdjacentTests(
      ["scripts/preflight.mts", "docs/architecture/FEATURE_FLAGS.md", ".github/workflows/gate.yml"],
      REPO_TESTS,
    );
    expect(selection.files).toEqual([]);
    expect(selection.uncovered).toEqual([
      ".github/workflows/gate.yml",
      "docs/architecture/FEATURE_FLAGS.md",
      "scripts/preflight.mts",
    ]);
  });

  it("names a collected file whose directory holds no suite", () => {
    const selection = selectDiffAdjacentTests(["server/db/connection.ts"], REPO_TESTS);
    expect(selection.files).toEqual([]);
    expect(selection.uncovered).toEqual(["server/db/connection.ts"]);
  });

  it("reads Windows path separators, because git and the shell disagree on this machine", () => {
    const selection = selectDiffAdjacentTests(["server\\routes\\billing.ts"], REPO_TESTS);
    expect(selection.files).toEqual(["server/routes/billing.test.ts"]);
  });
});

describe("gateRunCommands — reading the workflow's own commands", () => {
  it("reads inline and block run: steps", () => {
    const workflow = [
      "jobs:",
      "  a:",
      "    steps:",
      "      - name: Inline",
      "        run: pnpm check",
      "      - name: Block",
      "        run: |",
      "          set -euo pipefail",
      "          pnpm architecture:check",
      "      - name: After",
      "        run: pnpm test",
    ].join("\n");
    expect(gateRunCommands(workflow)).toEqual([
      "pnpm check",
      "set -euo pipefail",
      "pnpm architecture:check",
      "pnpm test",
    ]);
  });

  it("ends a block at the first line back out to the step's indent", () => {
    const workflow = ["      - name: Block", "        run: |", "          echo inside", "      - name: Next", "        run: echo outside"].join("\n");
    expect(gateRunCommands(workflow)).toEqual(["echo inside", "echo outside"]);
  });
});

describe("the drift arm — preflight against the real gate", () => {
  const gateText = readFileSync(path.join(repoRoot, ".github", "workflows", "gate.yml"), "utf8");
  const gateCommands = gateRunCommands(gateText);

  /** A run command is "handled" if a check adopts it or an excuse names it. */
  function unhandled(commands: readonly string[]): string[] {
    const adopted = PREFLIGHT_CHECKS.map((c) => c.gateRun).filter((r) => r.length > 0);
    const excused = EXCUSED_GATE_STEPS.map((e) => e.gateRun);
    return commands.filter(
      (command) =>
        !adopted.some((run) => command.includes(run)) && !excused.some((run) => command.includes(run)),
    );
  }

  /**
   * The gate's `run:` blocks also carry shell plumbing — `set -euo pipefail`,
   * `if` lines, `echo`s, `gh` calls in the money/auth job. Those are not
   * checks and asking preflight to adopt them would be nonsense, so the arm
   * asks only about the commands that could plausibly be a check: an
   * invocation of this repository's own tooling.
   */
  const TOOLING = /^(pnpm|npx|npm|node|tsx)\s/;

  it("finds the gate's real check steps (a positive control — the reader must not be reading nothing)", () => {
    const tooling = gateCommands.filter((c) => TOOLING.test(c));
    expect(tooling.length).toBeGreaterThanOrEqual(5);
    expect(tooling).toContain("pnpm check");
    expect(tooling).toContain("pnpm test");
  });

  it("every tooling step in the gate is either adopted by preflight or excused with a reason", () => {
    const missing = unhandled(gateCommands.filter((c) => TOOLING.test(c)));
    expect(
      missing,
      `gate.yml runs these and preflight neither adopts nor excuses them — add a PREFLIGHT_CHECKS entry (if it is cheap and local) or an EXCUSED_GATE_STEPS entry with its reason:\n  ${missing.join("\n  ")}`,
    ).toEqual([]);
  });

  it("every adopted check still exists in the gate (the drift direction that matters)", () => {
    // A preflight check whose gate step was renamed is worse than no check: it
    // is green about something the gate no longer asks.
    for (const check of PREFLIGHT_CHECKS) {
      if (check.gateRun === "") continue;
      expect(gateCommands.some((command) => command.includes(check.gateRun)), `preflight check "${check.id}" echoes gate step \`${check.gateRun}\`, which gate.yml no longer runs`).toBe(true);
    }
  });

  it("NEGATIVE CONTROL — an unadopted, unexcused gate step IS reported", () => {
    // Without this the arm above passes when the reader is broken, which is
    // exactly how a green suite proves nothing (working law 2).
    const synthetic = ["      - name: New thing", "        run: pnpm brand:check"].join("\n");
    const commands = gateRunCommands(synthetic).filter((c) => TOOLING.test(c));
    expect(commands).toEqual(["pnpm brand:check"]);
    expect(unhandled(commands)).toEqual(["pnpm brand:check"]);
  });

  it("every excuse carries a reason (an excuse without one is just an omission)", () => {
    for (const excuse of EXCUSED_GATE_STEPS) {
      expect(excuse.gateRun.trim().length).toBeGreaterThan(0);
      expect(excuse.reason.trim().length).toBeGreaterThan(20);
    }
  });

  it("the full suite is EXCUSED, never adopted — running it is the seven minutes preflight exists to save", () => {
    expect(PREFLIGHT_CHECKS.some((c) => c.gateRun === "pnpm test")).toBe(false);
    expect(EXCUSED_GATE_STEPS.some((e) => e.gateRun === "pnpm test")).toBe(true);
  });
});

describe("the check list itself", () => {
  it("runs in the gate's own order", () => {
    expect(PREFLIGHT_CHECKS.map((c) => c.id)).toEqual([
      "typecheck",
      "architecture",
      "capability",
      "script-guards",
    ]);
  });

  it("the vitest-running check uses the node entry, so no check can reach cmd.exe's limit", () => {
    const guards = PREFLIGHT_CHECKS.find((c) => c.id === "script-guards");
    expect(guards?.command[0]).toBe("node");
    expect(guards?.command[1]).toBe(VITEST_ENTRY);
  });

  it("carries the two script guards the shift close asks for", () => {
    const guards = PREFLIGHT_CHECKS.find((c) => c.id === "script-guards");
    expect(guards?.command).toContain("server/scriptExitDiscipline.test.ts");
    expect(guards?.command).toContain("server/scriptConnectionDiscipline.test.ts");
  });

  it("passes commands as argv, never as a shell string", () => {
    // A shell string is a quoting bug waiting for a path with a space in it —
    // and this machine's checkout lives under C:\Users\Admin.
    for (const check of PREFLIGHT_CHECKS) {
      expect(check.command.length).toBeGreaterThan(1);
      for (const part of check.command) expect(part).not.toContain(" ");
    }
  });
});

describe("chunking — the command-line limit, which is a real one on this machine", () => {
  it("keeps every chunk under the budget", () => {
    const files = Array.from({ length: 1200 }, (_, i) => `server/someModuleName${i}.test.ts`);
    const chunks = chunkVitestFiles(files);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(vitestArgv(chunk).join(" ").length).toBeLessThanOrEqual(ARGV_BUDGET_CHARS);
    }
  });

  it("CHUNKS, never truncates — every selected file lands in exactly one chunk", () => {
    // The failure this arm exists for: a selector that drops the overflow is
    // green about tests it never ran, which reads as coverage.
    const files = Array.from({ length: 1200 }, (_, i) => `server/someModuleName${i}.test.ts`);
    const flat = chunkVitestFiles(files).flat();
    expect(flat).toEqual(files);
    expect(new Set(flat).size).toBe(files.length);
  });

  it("does not chunk a list that fits", () => {
    expect(chunkVitestFiles(["server/a.test.ts", "server/b.test.ts"])).toEqual([
      ["server/a.test.ts", "server/b.test.ts"],
    ]);
  });

  it("places a single path longer than the budget rather than looping forever", () => {
    const monster = `server/${"x".repeat(50)}.test.ts`;
    expect(chunkVitestFiles([monster], 10)).toEqual([[monster]]);
  });

  it("the real server/ selection blows cmd.exe's limit but fits the node entry in one run", () => {
    // The measurement that forced the node entry: 263 suites, 9,075 characters.
    // Pinned as COMPARISONS against the two real limits, never as a literal
    // count, so a suite arriving or leaving is not a maintenance chore.
    //
    // Both directions matter. Over 8,191 is why `npx` + shell:true could not
    // stay; comfortably under the budget is why the commonest diff on this
    // repository still runs as ONE vitest process rather than paying startup
    // twice for nothing.
    const files = Array.from({ length: 263 }, (_, i) => `server/someRealisticName${i}.test.ts`);
    const oneCommand = vitestArgv(files).join(" ").length;
    expect(oneCommand).toBeGreaterThan(8191);
    expect(oneCommand).toBeLessThanOrEqual(ARGV_BUDGET_CHARS);
    expect(chunkVitestFiles(files)).toHaveLength(1);
  });

  it("invokes vitest's node entry, never the npx shim", () => {
    // `npx` needs shell:true on Windows, which is what puts cmd.exe's 8,191
    // limit in the path in the first place.
    const argv = vitestArgv(["server/a.test.ts"]);
    expect(argv[0]).toBe("node");
    expect(argv[1]).toBe(VITEST_ENTRY);
    expect(argv).not.toContain("npx");
  });
});

describe("formatSeconds", () => {
  it("reads as seconds to one decimal", () => {
    expect(formatSeconds(0)).toBe("0.0s");
    expect(formatSeconds(7345)).toBe("7.3s");
  });
});
