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
  COLLECTED_PATTERNS,
  chunkVitestFiles,
  formatSeconds,
  gateCommandMatches,
  gateRunCommands,
  isCollectedTest,
  aliasPrefixes,
  buildSubjectIndex,
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
});

/*
  #565 — THE SUITES THAT ARE ABOUT THE CHANGE, NOT ONLY THE ONES BESIDE IT.

  Preflight went green on PR #563 and the gate reddened seven minutes later on
  `client/src/foundation/token-guard.test.ts` — the guard that owns hex literals
  in `client/src/features/castingV2`, living in a different tree. Adjacency
  finds the suites NEXT TO a change; it cannot find the suites ABOUT it.
*/
describe("buildSubjectIndex — a guard's file and its subject are different things", () => {
  const REAL_PATHS = new Set([
    "client", "client/src", "client/src/foundation", "client/src/features",
    "client/src/features/castingV2", "client/src/features/castingV2/parts",
    "client/src/foundation/token-guard.test.ts",
    "client/src/features/castingV2/Roll.tsx",
    "scripts", "scripts/lib", "scripts/lib/preflight.mts", "scripts/lib/other.mts",
    "server", "server/preflight.test.ts",
  ]);

  it("⚠ THE CARD'S OWN SPECIMEN — a tree named RELATIVE to the suite's ancestor resolves", () => {
    /*
      Written the card's way — literals spelled from a repo root — this finds
      NOTHING, and that was measured before a line was written. `token-guard`
      writes "features/castingV2", relative to `client/src`. The resolution
      takes no list of roots: a literal is tried against the DECLARING FILE'S
      OWN ancestors, so it is derived from where the suite sits.
    */
    const index = buildSubjectIndex(
      [["client/src/foundation/token-guard.test.ts", 'const GUARDED_PATHS = ["features/castingV2", "features/billing"];']],
      REAL_PATHS,
    );
    expect(index.get("client/src/features/castingV2")).toEqual([
      "client/src/foundation/token-guard.test.ts",
    ]);
  });

  it("⚠ A FILE LITERAL STAYS A FILE — importing a neighbour is not being about it", () => {
    /*
      The first shape widened a file literal to its directory, and driving it
      showed why that is wrong: every suite importing anything from
      `scripts/lib` became a subject of every OTHER module there, and a
      two-file change selected 71 suites against 4 for the precise reading.
    */
    const index = buildSubjectIndex(
      [["server/preflight.test.ts", 'import { x } from "../scripts/lib/other.mts";']],
      REAL_PATHS,
    );
    expect(index.get("scripts/lib/other.mts")).toEqual(["server/preflight.test.ts"]);
    expect(index.get("scripts/lib")).toBeUndefined();
  });

  it("⚠ A RELATIVE LITERAL IS NORMALIZED — without it the suite that OWNS the file is the one it misses", () => {
    /*
      Found by driving preflight on this very change: `server/preflight.test.ts`
      reaches its subject as "../scripts/lib/preflight.mts", so the candidate is
      the literal string `server/../scripts/lib/preflight.mts` — not a path in
      the set, matching nothing.
    */
    const index = buildSubjectIndex(
      [["server/preflight.test.ts", 'from "../scripts/lib/preflight.mts"']],
      REAL_PATHS,
    );
    expect(index.get("scripts/lib/preflight.mts")).toEqual(["server/preflight.test.ts"]);
  });

  it("NEGATIVE CONTROLS — a literal that is not a path in this tree, and a suite's own home", () => {
    const index = buildSubjectIndex([[
      "client/src/foundation/token-guard.test.ts",
      [
        'fetch("https://example.com/api/thing");',
        'expect(msg).toBe("not/a/real/path");',
        'const own = "client/src/foundation";',
        'const self = "client/src/foundation/token-guard.test.ts";',
      ].join("\n"),
    ]], REAL_PATHS);
    /* A suite is never its own subject — adjacency already covers its home. */
    expect(index.get("client/src/foundation")).toBeUndefined();
    expect(index.get("client/src/foundation/token-guard.test.ts")).toBeUndefined();
    /* And nothing invented from a URL or a prose string. */
    expect([...index.keys()]).toEqual([]);
  });

  /*
    #616 REVIEW, FINDING 1 — two more spellings of "a suite ABOUT the change",
    both silent, both in the fewer-tests direction. The class here is a suite
    reaching its subject by a spelling the index cannot read, and the review
    named both with specimens that were verified at the tree before this was
    written.
  */
  const ALIASES = [["@/", "client/src/"], ["@shared/", "shared/"]] as const;

  it("⚠ AN EXTENSIONLESS IMPORT RESOLVES — the behaviour differed by spelling inside ONE file", () => {
    /*
      `server/architectureCreditCosts.test.ts` — CLAUDE.md's own price-list
      guard — imports its cost modules extensionless and `generate-architecture.mts`
      with an extension; only the second resolved, so a change to a cost module
      did not select the suite guarding its prices. 108 suites in `server/`
      alone carry cross-directory extensionless imports.
    */
    const index = buildSubjectIndex(
      [["server/architectureCreditCosts.test.ts", 'from "./casting/castingCreditCosts";']],
      new Set(["server", "server/casting", "server/casting/castingCreditCosts.ts"]),
    );
    expect(index.get("server/casting/castingCreditCosts.ts")).toEqual([
      "server/architectureCreditCosts.test.ts",
    ]);
  });

  it("⚠ THE LITERAL AS WRITTEN WINS — an implied extension never shadows a real directory", () => {
    /* Both exist: the directory must be the subject, not the same-named file. */
    const index = buildSubjectIndex(
      [["server/x.test.ts", 'const dir = "shared/thing";']],
      new Set(["server", "shared", "shared/thing", "shared/thing.ts"]),
    );
    expect(index.get("shared/thing")).toEqual(["server/x.test.ts"]);
    expect(index.get("shared/thing.ts")).toBeUndefined();
  });

  it("⚠ AN ALIAS IMPORT RESOLVES — and the obvious pattern for it does not work", () => {
    /*
      The review's specimen: `client/src/features/operations/outcomeShown.test.ts`
      imports "@/features/castingV2/failureCopy" and asserts on that module's
      copy, reaching it by no other literal. #565's scenario in a different
      spelling.

      ⚠ The first repair here allowed `@?` before the first segment — which
      still demands a word character before the slash, so a BARE `@/` matched
      nothing and the specimen was still absent when driven. That is why the
      first segment alternates.
    */
    const index = buildSubjectIndex(
      [["client/src/features/operations/outcomeShown.test.ts", 'from "@/features/castingV2/failureCopy";']],
      new Set([
        "client", "client/src", "client/src/features", "client/src/features/castingV2",
        "client/src/features/castingV2/failureCopy.ts",
        "client/src/features/operations",
      ]),
      ALIASES,
    );
    expect(index.get("client/src/features/castingV2/failureCopy.ts")).toEqual([
      "client/src/features/operations/outcomeShown.test.ts",
    ]);
  });

  it("⚠ AN ALIAS IS ABSOLUTE — it is never also tried against the suite's ancestors", () => {
    /*
      Otherwise `@/features/x` inside `client/src/features/operations/` would
      also be read as `client/src/features/operations/@/features/x`, and a
      repository that happened to hold such a path would get a false subject.
    */
    const index = buildSubjectIndex(
      [["client/src/features/operations/x.test.ts", 'from "@/features/thing";']],
      new Set([
        "client/src/features/operations",
        "client/src/features/operations/@/features/thing",
      ]),
      ALIASES,
    );
    expect([...index.keys()]).toEqual([]);
  });

  it("aliasPrefixes DERIVES the map from tsconfig, and survives a file it cannot read", () => {
    expect(aliasPrefixes('{"compilerOptions":{"paths":{"@/*":["./client/src/*"],"@shared/*":["./shared/*"]}}}'))
      .toEqual([["@/", "client/src/"], ["@shared/", "shared/"]]);
    /* A pattern that is not a prefix mapping is skipped rather than guessed. */
    expect(aliasPrefixes('{"compilerOptions":{"paths":{"exact":["./x.ts"]}}}')).toEqual([]);
    /* Unreadable or absent config loses the alias spelling and nothing else. */
    expect(aliasPrefixes("not json at all")).toEqual([]);
    expect(aliasPrefixes("{}")).toEqual([]);
  });

  it("a literal climbing above the repo root resolves to nothing rather than clamping", () => {
    const index = buildSubjectIndex(
      [["server/preflight.test.ts", 'from "../../../etc/passwd"']],
      REAL_PATHS,
    );
    expect([...index.keys()]).toEqual([]);
  });
});

describe("selectDiffAdjacentTests — subjects, the #565 half", () => {
  const REPO_TESTS_WITH_GUARD = [
    ...REPO_TESTS,
    "client/src/foundation/token-guard.test.ts",
  ];
  const SUBJECTS = new Map<string, string[]>([
    ["client/src/features/castingV2", ["client/src/foundation/token-guard.test.ts"]],
    ["scripts/lib/preflight.mts", ["server/foo.test.ts"]],
  ]);

  it("⚠ THE INCIDENT — a change in a guarded tree now selects the guard that owns it", () => {
    const selection = selectDiffAdjacentTests(
      ["client/src/features/castingV2/Roll.tsx"],
      REPO_TESTS_WITH_GUARD,
      SUBJECTS,
    );
    expect(selection.files).toContain("client/src/foundation/token-guard.test.ts");
    expect(selection.subjectFiles).toEqual(["client/src/foundation/token-guard.test.ts"]);
  });

  it("a guard that names a TREE owns a change several directories down", () => {
    const selection = selectDiffAdjacentTests(
      ["client/src/features/castingV2/parts/deep/Thing.tsx"],
      REPO_TESTS_WITH_GUARD,
      SUBJECTS,
    );
    expect(selection.subjectFiles).toEqual(["client/src/foundation/token-guard.test.ts"]);
  });

  it("⚠ THE BIGGER HALF — a root with NO suites beside it stops selecting nothing at all", () => {
    /*
      Measured: a one-file change under `shared/` or `scripts/lib/` selected
      nothing, because neither root holds a suite. Every such file went straight
      to `uncovered` and the whole diff-tests step was silently empty — and
      `scripts/lib/` is where this team's own instruments live.
    */
    const bare = selectDiffAdjacentTests(["scripts/lib/preflight.mts"], REPO_TESTS_WITH_GUARD);
    expect(bare.files).toEqual([]);
    expect(bare.uncovered).toEqual(["scripts/lib/preflight.mts"]);

    const withSubjects = selectDiffAdjacentTests(
      ["scripts/lib/preflight.mts"],
      REPO_TESTS_WITH_GUARD,
      SUBJECTS,
    );
    expect(withSubjects.files).toEqual(["server/foo.test.ts"]);
    /* Covered now — so it must NOT still be reported as covered by nothing. */
    expect(withSubjects.uncovered).toEqual([]);
  });

  it("⚠ NEVER puts a file vitest does not collect on the command line", () => {
    /*
      The index is built from the collected list, but a stale or hand-made one
      must not be able to add an integration test — passed beside real files it
      matches nothing and preflight goes GREEN about a test it never ran.
    */
    const selection = selectDiffAdjacentTests(
      ["server/health.ts"],
      REPO_TESTS,
      new Map([["server", ["server/health.integration.test.ts", "docs/notes.md"]]]),
    );
    expect(selection.files).not.toContain("server/health.integration.test.ts");
    expect(selection.files).not.toContain("docs/notes.md");
    expect(selection.subjectFiles).toEqual([]);
  });

  it("POSITIVE CONTROL — passing no index leaves the original behaviour byte for byte", () => {
    const before = selectDiffAdjacentTests(["server/foo.ts"], REPO_TESTS);
    expect(before.files).toEqual(["server/bar.test.ts", "server/foo.test.ts"]);
    expect(before.subjectFiles).toEqual([]);
    expect(before.uncovered).toEqual([]);
  });

  it("⚠ AN UNTRACKED NEW TEST FILE SELECTS ITSELF (review finding 1)", () => {
    // The shape that was silently green: a shift writes `server/thing.test.ts`
    // as the arm for its own fix and has not `git add`ed it yet. `server/` has
    // 263 tracked neighbours, so the directory read as covered — and the one
    // file in the diff that was the point of the change never ran.
    //
    // The caller unions the untracked listing into `repoTests`; this pins the
    // selection half — a suite in that list is selected like any other.
    const selection = selectDiffAdjacentTests(
      ["server/brandNew.test.ts"],
      [...REPO_TESTS, "server/brandNew.test.ts"],
    );
    expect(selection.files).toContain("server/brandNew.test.ts");
    expect(selection.uncovered).toEqual([]);
  });

  it("a brand-new suite in a FRESH directory is selected, not filed as uncovered", () => {
    // The other half of the same finding: before the fix this printed under
    // "no neighbouring suite" while BEING the suite.
    const selection = selectDiffAdjacentTests(
      ["server/newarea/thing.ts", "server/newarea/thing.test.ts"],
      [...REPO_TESTS, "server/newarea/thing.test.ts"],
    );
    expect(selection.files).toEqual(["server/newarea/thing.test.ts"]);
    expect(selection.uncovered).toEqual([]);
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

  it("REFUSES a folded `run: >` block rather than reading it as the command \">\"", () => {
    const folded = ["      - name: Folded", "        run: >", "          pnpm something"].join("\n");
    expect(() => gateRunCommands(folded)).toThrow(/folded/);
    // The real gate has none, which is why this is a guard and not a parser.
    expect(() => gateRunCommands(readFileSync(path.join(repoRoot, ".github", "workflows", "gate.yml"), "utf8"))).not.toThrow();
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
    return commands.filter(
      (command) =>
        !adopted.some((run) => gateCommandMatches(command, run, "command")) &&
        !EXCUSED_GATE_STEPS.some((e) => gateCommandMatches(command, e.gateRun, e.match)),
    );
  }

  /**
   * The gate's `run:` blocks also carry shell plumbing — `set -euo pipefail`,
   * `if` lines, `echo`s, `gh` calls in the money/auth job. Those are not
   * checks and asking preflight to adopt them would be nonsense, so the arm
   * asks only about the commands that could plausibly be a check: an
   * invocation of this repository's own tooling.
   */
  //
  // ⚠ THE SECOND CLAUSE IS THE FIX FOR ROUND 2'S FINDING 1, AND IT MATTERS
  // BECAUSE `sh scripts/*.sh` IS THE GATE'S HOUSE STYLE FOR EXACTLY THE CHECKS
  // THAT MATTER MOST. Two of the gate's four security instruments run that way
  // (`sh scripts/secret-scan.sh`, `sh scripts/workflow-lint.sh`), so a prefix
  // list of five package managers left the whole shape outside the population:
  // a new `run: sh scripts/new-guard.sh` step would have arrived with nobody
  // adopting or excusing it, which is precisely the event this arm exists to
  // make impossible. Any command naming a repository script counts now —
  // the gate's plumbing (`jq`, `gh`, `echo`, `set -euo pipefail`) never does.
  const TOOLING = /^(pnpm|npx|npm|node|tsx)\s|scripts\//;

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
      expect(
        gateCommands.some((command) => gateCommandMatches(command, check.gateRun, "command")),
        `preflight check "${check.id}" echoes gate step \`${check.gateRun}\`, which gate.yml no longer runs`,
      ).toBe(true);
    }
  });

  it("⚠ EVERY EXCUSE STILL MATCHES A REAL GATE STEP — two of them did not (review finding 3)", () => {
    // An excuse that matches nothing excuses nothing, and sits here looking
    // load-bearing. The `gitleaks` and `actionlint` entries named binaries that
    // appear in no gate `run:` line at all — the gate runs those two through
    // `sh scripts/secret-scan.sh` and `sh scripts/workflow-lint.sh`.
    //
    // Read against EVERY gate command, not the tooling-filtered population,
    // precisely because those two steps are shell scripts.
    for (const excuse of EXCUSED_GATE_STEPS) {
      expect(
        gateCommands.some((command) => gateCommandMatches(command, excuse.gateRun, excuse.match)),
        `the excuse \`${excuse.gateRun}\` matches no command in gate.yml — it excuses nothing. Name the step the gate actually runs, or delete the entry.`,
      ).toBe(true);
    }
  });

  it("⚠ A NEW `pnpm test:*` STEP IS NOT SWALLOWED BY THE `pnpm test` EXCUSE (review finding 2)", () => {
    // The substring road failed open here: "pnpm test:integration".includes(
    // "pnpm test") is true, so a genuinely new gate step would have been
    // excused by the seven-minutes reason with nobody deciding about it.
    const synthetic = ["      - name: New", "        run: pnpm test:integration"].join("\n");
    const commands = gateRunCommands(synthetic).filter((c) => TOOLING.test(c));
    expect(commands).toEqual(["pnpm test:integration"]);
    expect(unhandled(commands)).toEqual(["pnpm test:integration"]);
  });

  it("word-boundary matching still accepts a handled command with arguments", () => {
    // The other direction, and it matters as much: a refusal that fires on
    // healthy input is how a guard gets switched off.
    expect(gateCommandMatches("pnpm check", "pnpm check")).toBe(true);
    expect(gateCommandMatches("pnpm install --frozen-lockfile", "pnpm install --frozen-lockfile")).toBe(true);
    expect(gateCommandMatches("pnpm test --reporter=dot", "pnpm test")).toBe(true);
    expect(gateCommandMatches("pnpm test:integration", "pnpm test")).toBe(false);
    expect(gateCommandMatches("pnpm checkers", "pnpm check")).toBe(false);
    expect(gateCommandMatches('GITLEAKS="$(sh scripts/secret-scan.sh fetch)"', "scripts/secret-scan.sh", "token")).toBe(true);
  });

  it("⚠ NEGATIVE CONTROL — a new `sh scripts/*.sh` gate step IS reported (round 2, finding 1)", () => {
    // The shape that used to slip through entirely. Without this arm the
    // widening above is untested and the drift arm's promise stays narrower
    // than its own header claims.
    const synthetic = ["      - name: New guard", "        run: sh scripts/new-guard.sh"].join("\n");
    const commands = gateRunCommands(synthetic).filter((c) => TOOLING.test(c));
    expect(commands).toEqual(["sh scripts/new-guard.sh"]);
    expect(unhandled(commands)).toEqual(["sh scripts/new-guard.sh"]);
  });

  it("the widening does not drag the gate's shell plumbing into the population", () => {
    // The other direction: a filter that admits everything makes the arm
    // unpassable and gets deleted, which is worse than one that admits too
    // little. These are real lines from gate.yml's own run blocks.
    const plumbing = ["set -euo pipefail", 'echo "pr=$PR"', "gh pr view 1 --json mergeable", "git fetch origin main"];
    for (const line of plumbing) expect(TOOLING.test(line), line).toBe(false);
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

  it("a token excuse says WHY it is a substring, because that is the failing-open shape", () => {
    for (const excuse of EXCUSED_GATE_STEPS) {
      if (excuse.match !== "token") continue;
      expect(excuse.reason, `${excuse.gateRun} is a token excuse and must say why`).toContain("token because");
    }
  });

  it("the full suite is EXCUSED, never adopted — running it is the seven minutes preflight exists to save", () => {
    expect(PREFLIGHT_CHECKS.some((c) => c.gateRun === "pnpm test")).toBe(false);
    expect(EXCUSED_GATE_STEPS.some((e) => e.gateRun === "pnpm test")).toBe(true);
  });
});

describe("the SECOND mirror — the collected roots, against vitest.config.ts itself", () => {
  /**
   * ⚠ THIS ARM EXISTS BECAUSE THE MIRROR WAS WRONG AT BIRTH (round 2, finding
   * 2). The suffix list was flat — `.test.ts` and `.spec.ts` under both roots —
   * while the config has no `client/src` `.spec.ts` entry. Nothing fired,
   * because the tree holds no `.spec.ts` files at all; the day someone wrote
   * `client/src/features/x/y.spec.ts`, preflight would have selected a file
   * vitest never collects and gone GREEN about a test it never ran.
   *
   * The gate list already had a drift arm and this one did not, which is the
   * whole lesson: working law 4 applies to every mirror in a file, not the one
   * you were thinking about.
   */
  const configText = readFileSync(path.join(repoRoot, "vitest.config.ts"), "utf8");

  /** The `include:` array's string literals, read out of the config's own bytes. */
  function configIncludes(text: string): string[] {
    const match = /include:\s*\[([^\]]*)\]/.exec(text);
    if (!match) throw new Error("could not find vitest's include array — this arm cannot measure anything");
    return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  }

  it("finds the config's include patterns (a positive control)", () => {
    const includes = configIncludes(configText);
    expect(includes.length).toBeGreaterThan(0);
    expect(includes).toContain("server/**/*.test.ts");
  });

  it("COLLECTED_PATTERNS is exactly the config's include list, root for root and suffix for suffix", () => {
    const fromConfig = configIncludes(configText)
      .map((pattern) => {
        const parsed = /^(.*?)\*\*\/\*(\.\w+\.ts)$/.exec(pattern);
        return parsed ? { root: parsed[1], suffix: parsed[2] } : null;
      })
      .filter((p): p is { root: string; suffix: string } => p !== null);

    expect(fromConfig.length, "no include pattern parsed — the arm would pass on nothing").toBeGreaterThan(0);
    expect([...COLLECTED_PATTERNS].sort((a, b) => `${a.root}${a.suffix}`.localeCompare(`${b.root}${b.suffix}`))).toEqual(
      fromConfig.sort((a, b) => `${a.root}${a.suffix}`.localeCompare(`${b.root}${b.suffix}`)),
    );
  });

  it("a client-side .spec.ts is NOT collectable — the exact file the flat list would have selected", () => {
    expect(isCollectedTest("client/src/features/x/y.spec.ts")).toBe(false);
    // …while the three real shapes are.
    expect(isCollectedTest("server/foo.test.ts")).toBe(true);
    expect(isCollectedTest("server/foo.spec.ts")).toBe(true);
    expect(isCollectedTest("client/src/foundation/theme.test.ts")).toBe(true);
  });

  it("still excludes integration tests, which the config excludes by name", () => {
    expect(isCollectedTest("server/health.integration.test.ts")).toBe(false);
    expect(configText).toContain("integration.test.ts");
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
