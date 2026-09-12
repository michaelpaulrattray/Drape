import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, describe, expect, it, vi } from "vitest";

import { runHook } from "./testing/hookDriver";
import { readListedSource } from "./testing/listedSource";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

/**
 * "AM I THE THING THAT WAS RUN?" — ASKED ONCE, OF THE PLATFORM (#668).
 *
 * Several scripts here are BOTH a library (something imports them) and a
 * command (a person runs them), so each carries a line meaning *am I the
 * entrypoint*. There were eight of them and at least four spellings, differing
 * in ways nobody chose.
 *
 * ⚠ THE FAILURE MODE WAS DOCUMENTED IN THE TREE, BY ONE OF THE FILES THAT GOT
 * IT WRONG (`subjectless-arm-census.mts`): on Windows `import.meta.url` is
 * `file:///C:/…` while `process.argv[1]` is a backslashed path, so the usual
 * comparison NEVER matches — the script then prints nothing and exits 0, **a
 * silent no-op indistinguishable from a clean run.** Eight hand-rolled path
 * comparisons is eight chances to get that wrong again, and the way it goes
 * wrong is GREEN.
 *
 * So the repair removes the idiom rather than sharing it: `import.meta.main` is
 * Node 24's own answer, with no argv and no path to spell wrong. There is
 * deliberately NO helper — a helper would leave a hop to get wrong, which is
 * the `derive-adds-a-hop` class.
 *
 * Three things have to hold, and each is a separate arm below, because the
 * static one alone would pass over a primitive that does not work under `tsx`
 * and the dynamic ones alone would pass over a ninth file added tomorrow with
 * a hand-rolled spelling:
 *
 *   1. the PRIMITIVE behaves under `tsx` — which is what runs these, not bare
 *      node — in BOTH directions;
 *   2. the POPULATION is derived from the tree, not listed here, so a new
 *      offender is caught the day it is written;
 *   3. every converted module, IMPORTED, does not run its command block. That
 *      is the negative arm and it is the one that matters: the importer that
 *      must never be made to run a checker is the test suite itself.
 */

const REPO = resolve(".");
const SCRIPTS = join(REPO, "scripts");

const scratches: string[] = [];
afterAll(() => {
  for (const dir of scratches) rmSync(dir, { recursive: true, force: true });
});

/**
 * Run a file through the repository's own `tsx`.
 *
 * ⚠ NOT `npx`, AND THE DRIVER IS WHY THIS IS KNOWN. `npx` on Windows is
 * `npx.cmd` and is not spawnable as a bare name, so the first version of this
 * threw `SpawnFailure: could not start "npx": ENOENT` — which is the hook
 * driver (#640) doing its job: a process that never started throws rather than
 * coming back as a number an arm could read as a verdict. tsx's own CLI entry
 * is invoked through this node, so the runtime under test is the one that
 * actually runs these files.
 */
const TSX_CLI = join(REPO, "node_modules", "tsx", "dist", "cli.mjs");
function tsx(file: string, args: string[] = [], cwd = REPO) {
  return runHook(process.execPath, [TSX_CLI, file, ...args], { cwd });
}

/**
 * Every `.mts` under `scripts/`, excluding disposables (a shift's own scratch
 * files, never tracked).
 *
 * ⚠ IT USED TO ADMIT ONLY FILES DECLARING `const invokedDirectly`, WHICH KEYED
 * THE POPULATION TO A NAME RATHER THAN TO THE IDIOM (PR #672 review, round 2).
 * A ninth file spelling the check `const isEntry = process.argv[1] === …` sat
 * OUTSIDE the population, so the detector never read it and the suite stayed
 * green over the exact hand-rolled comparison it exists to refuse — the
 * "caught the day it is written" claim holding only for authors who happened
 * to reuse the retired variable name. The list-stops-being-the-list class in
 * miniature.
 *
 * So the walk admits everything and `offencesIn` decides. That is safe rather
 * than merely wider: measured at the tree, NO `.mts` under `scripts/` reads
 * `process.argv[1]` outside a comment, so a file that wants argv has the
 * strict parser and a file that hand-rolls this question is an offender by
 * construction.
 */
function scriptModules(): string[] {
  const found: string[] = [];
  const walk = (dir: string, rel: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(join(dir, entry.name), childRel);
        continue;
      }
      if (!entry.name.endsWith(".mts")) continue;
      /* Disposables are a shift's own scratch files and are never tracked. */
      if (entry.name.startsWith("_") && entry.name.includes("disposable")) continue;
      /* ⚠ `readListedSource`, NOT a bare read — this walk LISTS then READS,
         and this working tree is shared by several sessions and carries
         hundreds of untracked disposables (#8). A file that leaves between the
         two throws ENOENT out of the walk, and that ENOENT refuses the deploy
         rite on a clean tree (#223, #589). A file gone at the read was not
         part of the tree at the moment of the reading, so skipping it is the
         correct answer rather than a tolerated failure. */
      if (readListedSource(join(dir, entry.name)) === null) continue;
      found.push(childRel);
    }
  };
  walk(SCRIPTS, "");
  return found.sort();
}

/**
 * The offences one module's source carries, if any.
 *
 * ⚠ FACTORED OUT SO A FIXTURE CAN DRIVE THE REAL DETECTOR. A positive control
 * that matches the pattern against an inline string proves the REGEX and not
 * the pipeline: the comment-strip below could stop reaching a declaration and
 * the arm would report a clean tree forever (working law 2, PR #672 review).
 * Everything after the read goes through here, so the control and the walk
 * cannot diverge.
 *
 * Comments are stripped first because several of these files deliberately
 * QUOTE the retired idiom to explain what changed — quoting a defect must
 * never read as committing it.
 */
/**
 * The modules that actually carry a self-invocation check.
 *
 * ⚠ NARROWER THAN `scriptModules()` ON PURPOSE, AND THE TWO MUST NOT BE
 * CONFUSED. The static scan reads every file, because an offender is defined by
 * the idiom and not by a variable name. The IMPORT arm cannot: it loads each
 * module in a child process, and `scripts/` holds paid benches, database
 * openers and campaign drivers that have no business being imported by a test
 * run. So that arm keeps this population — the files whose command block is
 * the thing under test — and pays for what it imports.
 */
function modulesDeclaringTheCheck(): string[] {
  return scriptModules().filter((rel) => {
    const src = readListedSource(join(SCRIPTS, rel));
    if (src === null) return false;
    return /\bconst invokedDirectly\b/.test(src) || /\bif \(import\.meta\.main\)/.test(src);
  });
}

function offencesIn(rel: string, source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const offences: string[] = [];
  if (/process\.argv\[1\]/.test(code)) offences.push(`${rel}: reads process.argv[1]`);
  if (/\bconst invokedDirectly\b/.test(code) && !/const invokedDirectly = import\.meta\.main;/.test(code)) {
    offences.push(`${rel}: declares invokedDirectly without import.meta.main`);
  }
  return offences;
}

describe("the self-invocation check", () => {
  it("`import.meta.main` is true when tsx RUNS a file and false when tsx IMPORTS it", () => {
    /* ⚠ THE ARM THE WHOLE CHANGE RESTS ON. Every other arm here is about which
       spelling the tree uses; this is the only one that establishes the
       spelling WORKS in the runtime that actually runs these files. `tsx`
       transpiles and loads through its own loader, and a primitive that bare
       node honours is not thereby honoured there. Driven on a real fixture in
       both directions rather than reasoned about. */
    const dir = mkdtempSync(join(tmpdir(), "drape-meta-main-"));
    scratches.push(dir);
    const subject = join(dir, "subject.mts");
    writeFileSync(
      subject,
      "export const marker = 'loaded';\nif (import.meta.main) console.log('DIRECT');\nelse console.log('IMPORTED');\n",
    );
    const importer = join(dir, "importer.mts");
    writeFileSync(importer, `import "./subject.mts";\nconsole.log("IMPORTER DONE");\n`);

    const direct = tsx(subject, [], dir);
    expect(direct.status, direct.stderr).toBe(0);
    expect(direct.stdout).toContain("DIRECT");
    expect(direct.stdout).not.toContain("IMPORTED");

    const imported = tsx(importer, [], dir);
    expect(imported.status, imported.stderr).toBe(0);
    expect(imported.stdout).toContain("IMPORTED");
    expect(imported.stdout).toContain("IMPORTER DONE");
    expect(imported.stdout, "the subject must not think it was run").not.toContain("DIRECT");
  });

  it("NOBODY asks it with argv any more — the population is derived, not listed", () => {
    /* A guard whose population is the set of files you already fixed stops
       watching the moment you fix one. So the population is EVERY `.mts` under
       scripts/ — not only the files carrying the retired variable name — and
       the offence is the idiom. See `scriptModules`: keying on the name let a
       new file spelling it `const isEntry = process.argv[1] === …` sit outside
       the population entirely. */
    const modules = scriptModules();
    /* A floor, because a walk that silently returned nothing would satisfy
       `offenders === []` forever. It is well above the nine files that carry
       the check, since the population is now the whole directory. */
    expect(modules.length, "the walk must actually be reading scripts/").toBeGreaterThan(40);

    const offenders: string[] = [];
    for (const rel of modules) {
      /* Also a listed entry — `rel` came out of the walk above, so the same
         vanish-between-list-and-read window applies here. */
      const src = readListedSource(join(SCRIPTS, rel));
      if (src === null) continue;
      offenders.push(...offencesIn(rel, src));
    }
    expect(offenders, "each of these hand-rolls a question the platform answers").toEqual([]);

    /* ⚠ THE POSITIVE CONTROL DRIVES THE DETECTOR, NOT THE REGEX (PR #672
       review, finding 2). It first matched the pattern against an inline
       string, which cannot fail if the PIPELINE loses the ability to flag a
       real file — the comment-strip eating a declaration, say — leaving
       `offenders` empty forever over a tree full of them. So the same function
       the loop above uses is driven on a fixture carrying the retired idiom,
       and must flag BOTH offences. */
    const planted = offencesIn(
      "planted.mts",
      "const invokedDirectly = process.argv[1] !== undefined\n  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);\n",
    );
    expect(planted, "the detector must still flag a real offender").toEqual([
      "planted.mts: reads process.argv[1]",
      "planted.mts: declares invokedDirectly without import.meta.main",
    ]);

    /* And the other direction, so the detector is not simply "flags
       everything": a correctly converted file yields nothing, and a file that
       only QUOTES the idiom inside a comment yields nothing either — several
       of these deliberately do, to explain what changed. */
    expect(offencesIn("clean.mts", "const invokedDirectly = import.meta.main;\n")).toEqual([]);
    expect(
      offencesIn("quoting.mts", "/* it used to read process.argv[1] here */\nconst invokedDirectly = import.meta.main;\n"),
    ).toEqual([]);
  });

  it("an old runtime is REFUSED, not silently obeyed — the failure the swap could have imported", () => {
    /* ⚠ THE SWAP'S OWN RISK, CLOSED (PR #672 review, finding 1).
       `import.meta.main` arrived in the Node 24 line; before it the expression
       is `undefined`, which is falsy in BOTH directions — so on an old runtime
       every converted command block becomes a silent no-op that exits 0. That
       is the same green-silent class #668 exists to remove, arriving through
       the runtime instead of the path spelling.

       It bites hardest where a hook runs one of these as a COMMAND: a no-op is
       not a failure, so `.githooks/atlas-stage` would print "regenerated and
       staged — this commit carries the map of its own tree" having staged
       nothing.

       Two things close it and this arm holds both. The declarative pin warns
       at install; the runtime refusal is what stops a hook mid-commit on a
       machine that never installed. */
    const pkg = JSON.parse(readListedSource(join(REPO, "package.json")) ?? "{}");
    /* ⚠ `>=24.2`, NOT `>=24` — the first pin admitted 24.0 and 24.1, where
       `import.meta.main` is undefined, so it certified the exact runtime the
       guard exists to refuse (PR #672 review, round 2). The primitive landed
       in v24.2.0 and was backported to v22.18.0; this takes the conservative
       bound because the repository runs the 24 line and CI pins it. */
    expect(pkg.engines?.node, "package.json must pin a runtime that HAS the primitive").toBe(">=24.2");

    for (const rel of ["check-architecture.mts", "generate-architecture.mts"]) {
      const src = readListedSource(join(SCRIPTS, rel));
      expect(src, `${rel} must be readable`).not.toBeNull();
      expect(
        src ?? "",
        `${rel} is run as a command by a git hook — it must REFUSE an old runtime, not no-op`,
      ).toContain('typeof import.meta.main === "undefined"');
    }
  });

  it("IMPORTED, not one of them runs its command block — the arm that matters", () => {
    /* ⚠ THE NEGATIVE ARM, AND IT USES A REAL IMPORT RATHER THAN A FIXTURE.
       The importer that must never be made to run a checker is the test suite,
       which imports several of these. If a conversion were inverted, the block
       would fire on import — `generate-architecture.mts` would regenerate the
       maps, `check-architecture.mts` would print a verdict and could exit 1 —
       and it would happen inside whatever imported it.

       So each module is imported in a child `tsx` process that prints one
       word afterwards. The module must contribute NOTHING to stdout and the
       child must exit 0: a command block that fired would print, write, or
       take the exit code with it.

       ⚠ THIS POPULATION IS THE NARROW ONE AND IT MUST STAY NARROW. The static
       scan above reads every `.mts` under scripts/; this arm IMPORTS each one,
       and scripts/ holds paid benches, database openers and campaign drivers
       that a test run has no business loading. Only the modules that actually
       carry the check belong here. */
    const modules = modulesDeclaringTheCheck();
    expect(modules.length, "the import arm must have subjects").toBeGreaterThanOrEqual(8);
    const dir = mkdtempSync(join(tmpdir(), "drape-import-only-"));
    scratches.push(dir);

    for (const rel of modules) {
      const importer = join(dir, `import-${rel.replace(/[\\/]/g, "-")}`);
      /* A bare Windows path is not a legal ESM specifier — node refuses it
         with ERR_UNSUPPORTED_ESM_URL_SCHEME ("Received protocol 'c:'"), which
         would be a failure of this ARM rather than a finding about the module. */
      const target = pathToFileURL(join(SCRIPTS, rel)).href;
      writeFileSync(importer, `await import(${JSON.stringify(target)});\nconsole.log("IMPORT-ONLY OK");\n`);
      /* ⚠ `--prove` IS PASSED ON PURPOSE, AND SABOTAGE IS WHY. Five of these
         modules gate their command block on `invokedDirectly && argv.includes
         ("--prove")`, so inverting the conversion in one of them fired the
         block and printed NOTHING — the arm passed over the exact defect it
         exists to catch. Firing is only observable when the flag the block
         waits for is present, which is also the real incident (#345): `npx tsx
         scripts/drive-self-walk.mts --prove` ran an imported module's controls
         and exited before the driver's own parse ever saw the word. */
      const run = tsx(importer, ["--prove"], REPO);
      expect(run.status, `${rel} — importing it must not fail: ${run.stderr}`).toBe(0);
      expect(run.stdout.trim(), `${rel} — importing it must print nothing of its own`).toBe(
        "IMPORT-ONLY OK",
      );
    }
  });

  it("RUN DIRECTLY, the two with blast radius still do their job", () => {
    /* ⚠ THIS ARM RUNS THE WHOLE ATLAS GENERATOR AND CARRIES ITS OWN FIGURE —
       the road `childProcessTimeout.ts` names for an arm that legitimately
       needs longer than the file's 30 s floor (`typecheckGate` 120_000,
       `architectureAtlas` its own). `check-architecture.mts` rebuilds both maps
       in memory: 17 s alone on this box, 74 s under the rite's own concurrent
       checks (foreman-20260910-1730), and it crossed the 30 s floor on three
       shifts — twice in one sitting on 2026-09-12, refusing a docs-only rite
       push each time. The floor is a per-FILE figure sized for a `git` or a
       `tsc`; a synchronous arm that overruns finishes anyway and is only then
       marked red, so a tighter number buys no hang protection here and costs a
       refused deploy. 120 s is ~7× alone and ~1.6× the worst contended reading. */
    /* The card's own bar: `generate-architecture.mts` is run by the pre-commit
       hook and by the gate's freshness check, and `check-architecture.mts` is
       that check. The negative arm above would be equally satisfied by a
       conversion that made the block NEVER fire — which is the silent-green
       failure this whole card is about — so the positive direction is driven
       on the two where it would cost the most. */
    const check = tsx(join(SCRIPTS, "check-architecture.mts"));
    expect(check.stdout + check.stderr, "the checker must actually report").toContain("[atlas:check]");
    /* ⚠ THE VERDICT IS DELIBERATELY NOT ASSERTED. This arm asks whether the
       command block FIRED, and `[atlas:check]` printing is that answer. The
       exit code answers a different question — whether the generated maps are
       fresh — which is true or false depending on where in a branch's work
       this happens to run, and a pending regeneration is not a finding about
       self-invocation. Asserting it would hand this arm an unrelated reason to
       go red, which is how a guard stops being read. Freshness has its own
       check, on the gate, against the committed tree. */
  }, 120_000);
});
