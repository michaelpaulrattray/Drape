import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import {
  declaresTsxEntry,
  SHELL_RESOLVED_LAUNCHERS,
  shellLessPathLaunches,
  shellLessPathLaunchesIn,
  TSX_ENTRY_MODULE,
} from "./testing/shellLessPathLaunches";

/* This suite runs `git ls-files` and then parses every tracked source file, so
   it does exactly the kind of work it polices and is in #548's population by
   the hop through `shellLessPathLaunches.ts`. Either class floor lifts a file
   off vitest's 5 s default, which is the whole property. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

/**
 * A SUITE THAT TAKES THE SHELL OFF A CHILD'S PATH MUST NOT LAUNCH THROUGH
 * `npx` (#2227), and the population is DERIVED from the tree rather than
 * listed.
 *
 * The class, its two measured instances and the reason this is a parser rather
 * than a text match are all in `testing/shellLessPathLaunches.ts`. This file
 * proves only that the rule holds over the whole tree, and — the half that
 * matters more — that the reading which says so CAN FAIL.
 *
 * ⚠ **THERE IS NO LIST OF TWO FILENAMES HERE, AND THAT IS THE POINT.** A guard
 * keyed on the files you have already fixed stops watching the moment you fix
 * one; both instances are repaired today, so a list-shaped guard would have
 * been born dead. The arms below drive the two instances' REAL PRE-REPAIR BYTES
 * out of git instead, which is the only way a guard over a repaired population
 * can show it would have caught anything.
 */
const ROOT = resolve(import.meta.dirname, "..");

/** Instance 2's failing bytes: the commit before its within-PR repair. */
const INSTANCE_TWO_BEFORE = "3a038d5d5";
/** …and the repair itself, so the pair is a before and an after. */
const INSTANCE_TWO_AFTER = "bdbac55c9";

function bytesAt(commit: string, file: string): string {
  return execFileSync("git", ["show", `${commit}:${file}`], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

/* ONE walk of the tree for every arm in this file that needs one — it parses
   every tracked source file, so a second reading would double the cost to
   answer a question the first already answered. */
const reading = shellLessPathLaunches(ROOT);

describe("a stripped PATH never launches through a shell-resolved launcher (#2227)", () => {
  it("read a real population — a clean answer over no files is not an answer", () => {
    /* The deriver throws on an empty `git ls-files`; these are the other half,
       and they are the arms that catch a parser that quietly stopped walking.
       Working law 2: verify the instrument before believing its finding. */
    expect(reading.files).toBeGreaterThan(1_000);
    expect(
      reading.launches,
      "the walk saw no shell-resolved launch anywhere in the tree, which means " +
        "it is not reading calls rather than that the tree is clean",
    ).toBeGreaterThan(10);
  });

  it("no suite hands a shell-less env to one of them", () => {
    const named = reading.sites.map((site) => `${site.file}:${site.line} — ${site.launcher} (env: ${site.via})`);
    expect(
      named,
      `${SHELL_RESOLVED_LAUNCHERS.join("/")} are resolved through a shell, and a PATH ` +
        "stripped to node's own directory does not carry one — so this launch fails " +
        "before the script under test starts, and the arm reports its launcher's " +
        "failure as the subject's verdict. It passes on Windows and reddens on the " +
        "runner. Launch node itself by its absolute path instead, with tsx by its " +
        "file:\n" +
        '  import { TSX_CLI } from "./testing/tsxCli";\n' +
        "  runHook(process.execPath, [TSX_CLI, SCRIPT, ...args], { env })",
    ).toEqual([]);
  });
});

describe("the reading can fail — driven on the bytes that actually failed", () => {
  it("instance 2's real pre-repair bytes are caught, and its repair is clean", () => {
    /*
      THE ARM THAT GIVES THIS GUARD ITS ONLY REAL EVIDENCE. Both subjects are
      repaired on main, so every arm above is green on an empty population —
      which is indistinguishable from a reader that finds nothing ever. These
      bytes come out of git rather than being retyped, because a retyped fixture
      proves the reader reads the fixture.

      `3a038d5d5` is PR #2213's shape before `bdbac55c9` repaired it:
      `runHook("npx", [...], { env: { ...process.env, PATH: dirname(process.execPath), … } })`
      — the stripped env INLINE in the launcher's own options. Exit 254 on run
      38047540460.
    */
    const file = "server/patrolClocks.test.ts";
    const before = shellLessPathLaunchesIn(file, bytesAt(INSTANCE_TWO_BEFORE, file));
    expect(before.map((site) => `${site.launcher}:${site.via}`)).toEqual(["npx:inline"]);

    const after = shellLessPathLaunchesIn(file, bytesAt(INSTANCE_TWO_AFTER, file));
    expect(after, "the repair that closed instance 2 must read clean").toEqual([]);
  });

  it("instance 1's spelling is caught too — the env by REFERENCE, not inline", () => {
    /*
      ⚠ TWO SPELLINGS, AND ONE ARM CANNOT COVER BOTH. Instance 2 built the
      stripped env inside the call; instance 1 (`spawn sh ENOENT`, run
      36219309593) builds `const env` first and hands over `{ env }`, which is a
      different question for the reader — a name to look up rather than an
      object to inspect.

      Instance 1's arm arrived on main ALREADY REPAIRED, inside the PR that
      added it, so there is no commit holding its failing bytes. The failing
      form is therefore reconstructed from the LIVE file by putting the launcher
      back, and the reconstruction is asserted to have changed something: a
      `replace` that matched nothing would leave the repaired file, which reads
      clean, and the arm would pass for the wrong reason.
    */
    const file = "server/nextUpEscalation.test.ts";
    const repaired = readFileSync(resolve(ROOT, file), "utf8");
    expect(shellLessPathLaunchesIn(file, repaired), "the live file must read clean").toEqual([]);

    const broken = repaired.replace(
      /runHook\(\s*\n(\s*)process\.execPath,\s*\n\s*\[TSX_CLI, SCRIPT,/,
      (_whole: string, indent: string) => `runHook(\n${indent}"npx",\n${indent}["tsx", SCRIPT,`,
    );
    expect(broken, "the reconstruction matched nothing, so this arm proves nothing").not.toEqual(repaired);
    expect(shellLessPathLaunchesIn(file, broken).map((site) => `${site.launcher}:${site.via}`)).toEqual(["npx:env"]);
  });

  it("every spelling it claims to read, it reads", () => {
    const flags = (source: string) => shellLessPathLaunchesIn("fixture.ts", source).length;

    expect(flags('runHook("npx", ["tsx", "s"], { env: { ...process.env, PATH: nodeDir } });')).toBe(1);
    expect(flags('const env = { ...process.env, PATH: nodeDir };\nrunHook("npx", ["tsx"], { env });')).toBe(1);
    expect(flags('const env = { ...process.env };\nenv.PATH = nodeDir;\nrunHook("npx", ["tsx"], { env });')).toBe(1);
    /* The Windows twin alone, and a quoted key — both live spellings. */
    expect(flags('const env = { ...process.env, Path: nodeDir };\nrunHook("npx", ["tsx"], { env });')).toBe(1);
    expect(flags('const env = { ...process.env, "PATH": nodeDir };\nrunHook("npx", ["tsx"], { env });')).toBe(1);
    /* The env need not be called `env`, and need not be a bare identifier. */
    expect(flags('const hostile = { ...process.env, PATH: nodeDir };\nrunHook("npx", ["t"], { env: hostile });')).toBe(1);
    expect(flags('process.env.PATH = "";\nexecFileSync("npx", ["tsx"], { env: process.env });')).toBe(1);
    /* `npm` and `pnpm` are the same shim shape. No live instance — which is why
       a fixture is the only place this half can be proven at all. */
    expect(flags('const env = { ...process.env, PATH: nodeDir };\nspawnSync("pnpm", ["check"], { env });')).toBe(1);
    expect(flags('const env = { ...process.env, PATH: nodeDir };\nspawnSync("npm", ["run", "x"], { env });')).toBe(1);
  });

  it("and the things it must NOT read, it does not", () => {
    const flags = (source: string) => shellLessPathLaunchesIn("fixture.ts", source).length;

    /* A PATH built FROM the real one still carries the shell. Both spellings
       are live in the tree — `founderActivity.test.ts` prepends to it,
       `scriptWorldGuard.test.ts` passes it straight through. */
    expect(flags('const env = { ...process.env, PATH: `${dir};${process.env.PATH ?? ""}` };\nrunHook("npx", ["t"], { env });')).toBe(0);
    expect(flags('const env = { PATH: process.env.PATH ?? "" };\nrunHook("npx", ["t"], { env });')).toBe(0);
    expect(flags('const env = { PATH: process.env["PATH"] };\nrunHook("npx", ["t"], { env });')).toBe(0);

    /*
      ⚠ THE FOUR THAT DECIDE WHETHER THIS GUARD IS WORTH HAVING, because each is
      a live shape in one of the two subject files and a file-level reading
      indicts all four.
    */
    /* 1 — the ordinary helper: `npx` under the INHERITED env, 24 green arms. */
    expect(flags('const env = { ...process.env, PATH: dirname(process.execPath) };\nrunHook("npx", ["t"], { shell: true });')).toBe(0);
    /* 2 — the repair itself: the stripped env handed to node, never to npx. */
    expect(flags('const env = { ...process.env, PATH: dirname(process.execPath) };\nrunHook(process.execPath, [TSX_CLI, "s"], { env });')).toBe(0);
    /* 3 — a stripped inline env in a call that launches nothing at all
       (`deployWatchDecision.test.ts` passes one to a pure function). */
    expect(flags('expect(foreignServiceContext({ PATH: "x" }, "Drape")).toBeNull();')).toBe(0);
    /* 4 — a bare binary under a stripped env is the SUBJECT of these arms,
       proven unreachable on purpose. A guard that flagged it would be indicting
       the test for testing. */
    expect(flags('const env = { ...process.env, PATH: dirname(process.execPath) };\nrunHook("git", ["--version"], { env });')).toBe(0);

    /* And prose about the class is not the class — the comment every repaired
       instance now carries says the word `npx` right next to a stripped env. */
    expect(flags('/* npx would need sh, which this PATH withholds */\nconst env = { ...process.env, PATH: nodeDir };\nrunHook(process.execPath, [TSX_CLI], { env });')).toBe(0);
  });
});

describe("the remedy is declared once (#2227)", () => {
  it("no suite declares tsx's entry for itself", () => {
    /*
      It was declared twice, each with a comment saying it matched the other —
      working law 4 with the drift not yet arrived. The guard's failure message
      above points at the shared module, so advice that pointed at a path string
      would make the next suite a third copy.

      Taken off the SAME tree reading as the arms above rather than from a
      second `git ls-files` of its own: two listings of one tree answering
      questions about the same files is the mirror shape, and the first draft of
      this arm had one.
    */
    expect(
      reading.tsxEntryDeclarers,
      `tsx's own entry is declared in \`${TSX_ENTRY_MODULE}\`. Import \`TSX_CLI\` from ` +
        "there rather than resolving the path again — a second copy of one fact is the " +
        "shape working law 4 is about.",
    ).toEqual([]);
  });

  it("the declaration reader reads a DECLARATION, not the path in prose", () => {
    /*
      ⚠ THE ARM THAT KEEPS THIS HONEST, and the tree holds its own counterexample:
      `scripts/lib/devServerTrees.mts` draws tsx's entry inside a process-tree
      diagram and `server/devServerTrees.test.ts` carries whole command lines
      containing it. A substring test indicts both for describing a command
      line, which is why the question is asked of the parse.
    */
    expect(declaresTsxEntry("f.ts", 'const TSX = resolve("node_modules/tsx/dist/cli.mjs");')).toBe(true);
    expect(declaresTsxEntry("f.ts", '/* node node_modules/tsx/dist/cli.mjs x.ts */\nconst a = 1;')).toBe(false);
    expect(declaresTsxEntry("f.ts", 'const line = "node node_modules/tsx/dist/cli.mjs x.ts";')).toBe(false);
    /* And the live counterexamples themselves, by name. */
    for (const file of ["scripts/lib/devServerTrees.mts", "server/devServerTrees.test.ts"]) {
      const source = readFileSync(resolve(ROOT, file), "utf8");
      expect(source, `${file} no longer carries the path — this control is spent`).toContain(
        "node_modules/tsx/dist/cli.mjs",
      );
      expect(declaresTsxEntry(file, source), `${file} describes the path, it does not declare it`).toBe(false);
    }
  });
});
