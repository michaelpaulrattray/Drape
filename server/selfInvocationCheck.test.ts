import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, describe, expect, it, vi } from "vitest";

import { runHook, runHookAsync, runWithLimit } from "./testing/hookDriver";
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

/** The same drive, overlappable — see the import arm's own note (#943). */
function tsxAsync(file: string, args: string[] = [], cwd = REPO) {
  return runHookAsync(process.execPath, [TSX_CLI, file, ...args], { cwd });
}

/**
 * The tracked `.mts` files under `scripts/`, as a set of paths relative to it.
 *
 * ⚠ `git ls-files`, NOT `readdirSync` — AND THAT IS THE WHOLE OF #979. The walk
 * below used to admit everything on the disk and then drop a shift's scratch by
 * FILENAME: `name.startsWith("_") && name.includes("disposable")`. Measured on a
 * real shift tree the morning the card was worked: 998 `.mts` under `scripts/`,
 * 522 of them tracked, and **124 of the 476 untracked ones do not start with an
 * underscore** — three distinct naming shapes are in live use and only one of
 * them carries it. Every one of those 124 was swept, and the suite was green
 * only because none of them happened to carry the idiom. That is luck, not a
 * guard, and the next scratch file named without the underscore is a coin toss.
 *
 * ⚠ THE 124 ARE DELIBERATELY NOT NAMED HERE. `disposable-age`'s reader matches
 * on BASENAME, so a live scratch filename quoted in a tracked file's prose pins
 * that file against the age sweep for good — which is the defect #981 was
 * opened to undo, committed by the docblocks explaining it. The count is the
 * evidence; the names would be a side effect.
 *
 * The repository already knows which files it contains. A guard asking a
 * filename to stand in for that is a second list shadowing `git ls-files` —
 * working law 4 — and the house has already written down why the decision
 * decays (`sourceSweepSuites.ts`: *"an exception keyed on a FILENAME is the
 * thing that stops a guard watching the moment somebody fixes one file"*).
 *
 * ⚠ IT REFUSES RATHER THAN RETURNING A SHORT LIST, and that is the whole safety
 * of it. The arm that consumes this asserts an EMPTY offender list, so a filter
 * that failed open — no git, a wrong cwd, a swallowed throw — would not make
 * this suite noisy, it would make it BLIND, and a blind sweep passes. That is
 * invariant 7's shape and it is the direction this file cannot afford to fail
 * in. Both refusals are the ones #976 wrote for the same reason.
 *
 * Paths are returned WITH `/` separators and WITHOUT the `scripts/` prefix, so
 * they are the same `rel` the walk below produces on either platform.
 */
function trackedScriptModules(): Set<string> {
  const listing = runHook("git", ["ls-files", "-z", "--", "scripts"], { cwd: REPO });
  if (listing.status !== 0) {
    throw new Error(
      `git ls-files failed (status ${listing.status}) — the swept population cannot be `
        + `decided, and an undecided population would silently pass the offender arm.\n${listing.stderr}`,
    );
  }
  const names = listing.stdout
    .split("\0")
    .filter((name) => name.endsWith(".mts"))
    .map((name) => name.slice("scripts/".length));
  if (names.length === 0) {
    throw new Error(
      "git ls-files returned no .mts under scripts/ — refusing rather than sweeping an "
        + "empty population, which would pass the offender arm below.",
    );
  }
  return new Set(names);
}

const TRACKED = trackedScriptModules();

/**
 * Every `.mts` the REPOSITORY CONTAINS under `scripts/`.
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
 * So the walk admits every tracked file and `offencesIn` decides. That is safe
 * rather than merely wider: measured at the tree, NO `.mts` under `scripts/`
 * reads `process.argv[1]` outside a comment, so a file that wants argv has the
 * strict parser and a file that hand-rolls this question is an offender by
 * construction.
 *
 * ⚠ `tracked` IS A PARAMETER, NOT A CLOSED-OVER CONSTANT, for one reason: an
 * arm below narrows it deliberately to prove the filter is CONSULTED. A filter
 * nothing can be seen to change is invariant 7's shape (#976's model).
 */
function scriptModules(tracked: Set<string> = TRACKED): string[] {
  const found: string[] = [];
  const walk = (dir: string, rel: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(join(dir, entry.name), childRel);
        continue;
      }
      if (!entry.name.endsWith(".mts")) continue;
      /* The repository's own answer to "is this file ours?" — see above. */
      if (!tracked.has(childRel)) continue;
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
       the check, since the population is now the whole tracked directory. */
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

  /*
    THE FILTER'S OWN POSITIVE CONTROL (#979, working law 2). The offender arm
    above asserts an EMPTY list, so a filter that silently dropped everything —
    or one that was never consulted at all — reads as a pass there. This is the
    only arm that can tell those apart, and it fires on a clean CI checkout
    exactly as it does on a shift's dirty tree, which the arm below it cannot.

    The subject is `disposable-age.mts`: tracked, and named here safely because
    it is a tracked TOOL rather than a piece of scratch — the pinning hazard the
    population docblock warns about applies to untracked scratch basenames only.
  */
  it("the tracked listing is CONSULTED — narrowing it narrows the population", () => {
    const wide = scriptModules();
    const narrow = scriptModules(new Set(["disposable-age.mts"]));

    expect(wide.length, "the wide walk should read the whole tracked tree").toBeGreaterThan(100);
    expect(
      narrow,
      "narrowing the tracked listing to one file changed nothing — the filter is not wired in",
    ).toEqual(["disposable-age.mts"]);
  });

  /*
    ⚠ ITS LIMIT IS STATED RATHER THAN DISCOVERED, and it is the same limit
    #976's twin carries: on a clean checkout git reports no untracked files and
    this arm is VACUOUS — which is precisely the state CI runs in, and precisely
    why #979's hole was invisible to the gate for as long as it existed. It has
    teeth only on a shift's own tree, where the population it excludes was 476
    files the morning it was written. The arm above is the one that holds
    everywhere; this one is the direct statement of the defect.
  */
  it("reads nothing git calls untracked — the #979 hole, stated directly", () => {
    const listing = runHook("git", ["ls-files", "--others", "--exclude-standard", "-z", "--", "scripts"], {
      cwd: REPO,
    });
    expect(listing.status, `git ls-files --others failed:\n${listing.stderr}`).toBe(0);

    const untracked = new Set(
      listing.stdout
        .split("\0")
        .filter((name) => name.endsWith(".mts"))
        .map((name) => name.slice("scripts/".length)),
    );
    const sweptAnyway = scriptModules().filter((rel) => untracked.has(rel));

    expect(
      sweptAnyway,
      `the walk read files the repository does not contain:\n${sweptAnyway.join("\n")}`,
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

  it("IMPORTED, not one of them runs its command block — the arm that matters", async () => {
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

    /* ⚠ THE CHILDREN OVERLAP NOW, AND #943 IS WHY — read that card before
       making this sequential again to "keep it simple". One `tsx` start is
       most of a second on this machine, and eight of them in a row put this
       arm at 5.9 s on an IDLE box against the class's 30 s cap. The deploy
       rite runs the script guards before it pushes; under its own concurrent
       load this arm crossed the cap and REFUSED a correct tree, with a message
       that reads like a real violation and a printed repair naming a script
       that does not exist.

       Raising the cap was the wrong repair: it would make the arm stop failing
       and stop being informative, because a genuine hang is the thing the cap
       exists to catch. Overlapping cuts the real time instead. The children are
       independent by construction — one temporary importer each, one module
       each, nothing shared but the read-only repository — so ordering was never
       carrying anything.

       FOUR, not `Promise.all`: eight `tsx` starts at once on a machine already
       running the rest of the suite trades one starvation problem for another,
       and starvation is this card's whole subject. */
    const IN_FLIGHT = 4;

    const jobs = modules.map((rel) => {
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
      return async () => ({ rel, run: await tsxAsync(importer, ["--prove"], REPO) });
    });

    /* Every child is awaited and every verdict is read — the results come back
       in the modules' own order, so a failure names the right file. */
    for (const { rel, run } of await runWithLimit(jobs, IN_FLIGHT)) {
      expect(run.status, `${rel} — importing it must not fail: ${run.stderr}`).toBe(0);
      expect(run.stdout.trim(), `${rel} — importing it must print nothing of its own`).toBe(
        "IMPORT-ONLY OK",
      );
    }
  });

  it("RUN DIRECTLY, the one with blast radius fires its command block", () => {
    /* The card's own bar: `generate-architecture.mts` is run by the pre-commit
       hook and by the gate's freshness check, and `check-architecture.mts` is
       that check. The negative arm above would be equally satisfied by a
       conversion that made the block NEVER fire — which is the silent-green
       failure this whole card is about — so the positive direction is driven
       on the one where it would cost the most.

       ⚠ IT PASSES `--fired`, AND THAT IS WHAT TOOK IT OFF THE RITE'S CRITICAL
       PATH (#839). Until then this arm ran the WHOLE atlas check — 1,021
       modules through the TypeScript compiler — to read `[atlas:check]` off
       the output: 17 s alone, 57–74 s under the deploy rite's concurrent
       checks, over 120 s on a contended evening. It refused three docs-only
       deploys in one sitting and crossed the 30 s file floor on three shifts,
       and PR #838's own 120 s figure was crossed by the very next rite. The
       question here is "was the block reached?", and the build was incidental
       to answering it. `--fired` makes the block print its marker and return
       before `checkArchitecture()` is called: the block still has to FIRE for
       the marker to appear, an import still cannot produce it (the arm above
       holds that), and the timeout goes back to the file's floor. The
       sabotage arm below is what proves the shorter road still discriminates. */
    const check = tsx(join(SCRIPTS, "check-architecture.mts"), ["--fired"]);
    expect(check.stdout, "the command block must report that it fired").toContain("[atlas:check] fired");
    /* Under `--fired` nothing is checked, so the exit code is no longer the
       freshness verdict (which this arm never asserted, because a pending
       regeneration is not a finding about self-invocation) — it is the strict
       parser's word on the vocabulary, and a refusal here would mean the flag
       this arm relies on stopped existing. */
    expect(check.status, check.stderr).toBe(0);
    /* And it must not have built anything: the OK/FAILED verdict lines are the
       build's, and their absence is what makes this arm cheap rather than a
       second copy of the freshness check. */
    expect(check.stdout + check.stderr).not.toMatch(/\[atlas:check\] (OK|FAILED)/);
  });

  it("CAN FAIL — an inverted gate is caught on BOTH roads, driven on a sabotaged copy", async () => {
    /* ⚠ WORKING LAW 2, POINTED AT THE CHEAP ROAD (#839's bar). The arm above
       no longer runs the build, so the obvious question is whether it still
       tells a firing block from a dead one. Driven rather than reasoned: the
       real file is copied to a scratch directory with its gate INVERTED —
       `if (invokedDirectly)` → `if (!invokedDirectly)` — and its two relative
       imports rewritten to the real modules by file URL, so the copy runs the
       real parser and the real generator's module graph, and the only thing
       that differs is the gate.

       Then the two arms' own assertions are put to it:
         - RUN DIRECTLY with `--fired`: the block never fires, so the marker
           never prints — the arm above would redden.
         - IMPORTED with `--prove`: the block fires on import, the strict parser
           refuses `--prove` as a word it does not know, and the child exits 1
           with `REFUSING:` — the import arm would redden. This is the sharper
           half: before `--fired` an inverted gate on import would have built
           the maps quietly for a minute and then printed a verdict, and the
           import arm caught it only by the verdict's text. */
    const real = readListedSource(join(SCRIPTS, "check-architecture.mts"));
    expect(real, "the subject must be readable").not.toBeNull();
    const gate = "if (invokedDirectly) {";
    expect((real ?? "").split(gate).length - 1, "exactly one command-block gate to invert").toBe(1);
    const scriptsUrl = pathToFileURL(SCRIPTS + "/").href;
    const sabotaged = (real ?? "")
      .replace(gate, "if (!invokedDirectly) {")
      .replace(/from "\.\//g, `from "${scriptsUrl}`);
    expect(sabotaged, "the import rewrite must have reached both relative imports").not.toMatch(/from "\.\//);

    /* ⚠ INSIDE THE REPOSITORY'S OWN `node_modules/.cache`, NOT THE OS TEMP DIR.
       The copy keeps its bare `ajv` import, and node resolves a bare specifier
       by walking UP from the importing file — from `%TEMP%` that walk never
       reaches this repository and the child dies on ERR_MODULE_NOT_FOUND
       before the gate is ever asked (measured: the first version of this arm
       did exactly that). `.cache` is where tooling scratch conventionally
       lives, it is gitignored by construction, and the walk from it reaches
       the real `node_modules` one hop up. */
    const cache = join(REPO, "node_modules", ".cache");
    mkdirSync(cache, { recursive: true });
    const dir = mkdtempSync(join(cache, "drape-inverted-gate-"));
    scratches.push(dir);
    const subject = join(dir, "check-architecture.mts");
    writeFileSync(subject, sabotaged);

    const direct = tsx(subject, ["--fired"], dir);
    expect(direct.status, direct.stderr).toBe(0);
    expect(direct.stdout, "an inverted gate must NOT print the fired marker on a direct run").not.toContain(
      "[atlas:check]",
    );

    const importer = join(dir, "importer.mts");
    writeFileSync(importer, `await import(${JSON.stringify(pathToFileURL(subject).href)});\nconsole.log("IMPORT-ONLY OK");\n`);
    /* ⚠ `tsxAsync`, DELIBERATELY — this half must run the SAME driver the
       import arm runs (#943). Proving the assertions discriminate through the
       sync twin would leave the async one unproven on the road that matters:
       a twin that dropped a child's stdout would let the import arm pass over
       a firing block while this arm still reddened, which is a guard whose
       honesty rests on an instrument it does not use. */
    const imported = await tsxAsync(importer, ["--prove"], dir);
    expect(imported.status, "an inverted gate fires on import and the parser refuses --prove").toBe(1);
    expect(imported.stderr).toContain("REFUSING: unknown argument --prove");
    expect(imported.stdout).not.toContain("IMPORT-ONLY OK");
  });
});
