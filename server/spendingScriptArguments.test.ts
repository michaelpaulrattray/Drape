/**
 * THE SPENDING DRIVERS REFUSE A WORD THEY DO NOT KNOW (issue #345).
 *
 * #288 fixed this class at its two crew instances. This is the half of the
 * law-7 sweep that argues for itself: the three scripts in the tree that drive
 * a PAID transport all read their flags the old way —
 *
 *   const index = process.argv.indexOf(`--${name}`);
 *
 * — a reader that cannot fail on a word it was never asked about. `--dry-run`,
 * `--rehearse` misspelt, `--Spend`: every one of them was silently discarded
 * and the driver did the real thing on the defaults. The record has this class
 * firing three times already, twice on spending scripts (a `--help` a sweep did
 * not know started a 42-cell run) and once on production (#288).
 *
 * # WHAT IS ACTUALLY AT RISK HERE, AND IT IS NOT ONLY MONEY
 *
 *   - `drive-finding-replay.mts` charges 125 credits to the founder's own
 *     account, and its `--out` guard is the only thing standing between a
 *     second walk and overwritten evidence that cannot be re-bought.
 *   - `drive-self-walk.mts` charges 25 credits a step, and a dropped `--fresh`
 *     silently walks an already-edited face — measuring a chain of edits and
 *     reporting it as the product.
 *   - `machinist-ledger-read.mts` spends nothing and writes nothing; a dropped
 *     `--days` there is a WRONG READING on the ledger the founder judges the
 *     team's own numbers by, printed confidently with no sign anything was
 *     ignored.
 *
 * # WHY THE VOCABULARIES ARE DERIVED AND NOT RETYPED
 *
 * Working law 4. Tightening a parser is only safe if the declared vocabulary
 * really is every flag the file reads — a flag missed there turns a documented,
 * working command into a refusal, which is the one way this fix could cost more
 * than it saves. So each spec is read out of the script and compared against
 * every argument the same script actually asks for; a `--newthing` added later
 * without its spec entry reddens here instead of refusing at the keyboard.
 *
 * The extractor gets its own negative control, because a reader that quietly
 * finds nothing agrees with every expectation ever written about it.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ArgumentError, parseStrictArgs } from "../scripts/lib/strictArgs.mts";
import { readIfPresent, statIfPresent } from "../scripts/lib/listedEntry.mts";
import {
  drivesAPaidTransport, paidScriptsReadingFlagsByName, scriptFilesUnder,
  spendWordsRefusedByTheirOwnParse, unguardedSpendGates,
} from "../scripts/lib/stopline.mts";

const REPO = join(__dirname, "..");

/**
 * ⚠ THIS LIST WAS THE THREE FILES THE CARD NAMED, AND THAT IS WHY IT WENT GREEN
 * OVER TWELVE MORE (#345, second pass).
 *
 * A population keyed on the known instances stops watching everything else the
 * moment the instances are fixed — `fix-drops-subject-from-guard`, and this is
 * a measured instance of it rather than a worry. While these three arms were
 * green, **eight calibration courts drove fal region reads and masked edits
 * with the old reader**, and four more read a bare `includes("--repaint")` or
 * `includes("--dry")`. The guard could not have found one of them: they were
 * never in its population.
 *
 * The named three stay as the SPEC-level population — they are the files whose
 * declared vocabulary is checked against what they read, which needs the
 * `arg()` shim shape they share. The class-level question (*does any paid
 * script still read flags by name?*) is asked of a DERIVED population below,
 * where a new paid driver joins by existing rather than by being remembered.
 */
const DRIVERS = [
  "scripts/drive-finding-replay.mts",
  "scripts/drive-self-walk.mts",
  "scripts/machinist-ledger-read.mts",
] as const;

const sourceOf = (relative: string) => readFileSync(join(REPO, relative), "utf8");

/**
 * The file with its BLOCK COMMENTS removed, so an absence check reads what the
 * script DOES and not what it says about itself.
 *
 * #360's lesson, in a second place: this suite's first run reddened on all
 * three drivers because the docblocks written the same hour quote the old
 * reader by name while explaining why it is gone. A guard that cannot tell a
 * quotation from an occurrence forces the prose to go quiet about the very
 * thing it is guarding.
 *
 * ⚠ Its limit, stated rather than discovered: `//` line comments are left
 * alone. Stripping to end-of-line would swallow anything after a `https://`
 * inside a string literal — a false NEGATIVE, which is the direction that
 * matters here.
 */
const codeOf = (relative: string) => sourceOf(relative).replace(/\/\*[\s\S]*?\*\//g, "");

type Spec = { value: string[]; boolean: string[] };

/** The `value:` / `boolean:` arrays out of a script's own parse call. */
function specIn(source: string): Spec {
  const call = /parseStrictArgsOrRefuse\(\s*process\.argv\.slice\(2\),\s*\{([\s\S]*?)\}\s*\)/.exec(source);
  if (!call) throw new Error("no parseStrictArgsOrRefuse call found — the script stopped parsing strictly");
  const list = (name: string) => {
    const match = new RegExp(`${name}:\\s*\\[([^\\]]*)\\]`).exec(call[1]!);
    if (!match) throw new Error(`no ${name}: [...] in the spec`);
    return [...match[1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
  };
  return { value: list("value"), boolean: list("boolean") };
}

/**
 * Every flag the file ASKS FOR: `arg("x")` (the shim over the parse each of
 * these files keeps, so the diff stayed small) and `ARGS.flag("x")`.
 */
function flagsRead(source: string): string[] {
  const asked = new Set<string>();
  for (const match of source.matchAll(/\barg\("([a-zA-Z][\w-]*)"/g)) asked.add(match[1]!);
  for (const match of source.matchAll(/\bARGS\.(?:value|flag)\("([a-zA-Z][\w-]*)"/g)) asked.add(match[1]!);
  return [...asked].sort();
}

describe("the paid drivers declare a vocabulary, and it is the one they read", () => {
  it.each(DRIVERS)("%s parses strictly and never by name", (path) => {
    expect(sourceOf(path)).toContain("parseStrictArgsOrRefuse");
    /* The old reader is what made every instance of this class possible, so
       its absence is asserted rather than assumed — at the CODE, so the
       docblocks above it stay free to quote the shape they replaced. */
    expect(codeOf(path)).not.toMatch(/process\.argv\.indexOf\(/);
  });

  it("the comment stripper leaves the code and takes the prose", () => {
    /* Both directions, because a stripper that returned "" would pass every
       absence arm above. */
    expect(codeOf("scripts/drive-finding-replay.mts")).toContain("parseStrictArgsOrRefuse");
    expect(sourceOf("scripts/drive-finding-replay.mts")).toMatch(/process\.argv\.indexOf\(/);
  });

  it.each(DRIVERS)("%s declares every flag it asks for", (path) => {
    const source = sourceOf(path);
    /* ⚠ THE SPEC IS READ FROM THE CODE, NOT THE FILE (reviewer finding 1 on
       PR #587) — the same #360 class the absence check above already dodges,
       one function away. `RegExp.exec` returns the FIRST textual match, and
       these files' docblocks sit above their calls: a docblock that quoted an
       old `parseStrictArgsOrRefuse(...)` shape would be validated instead of
       the real one, and this arm would stay green while a documented command
       refused at somebody's keyboard. `flagsRead` keeps reading the whole file
       on purpose — over-including there means MORE flags must be declared,
       which is the safe direction. */
    const spec = specIn(codeOf(path));
    const declared = new Set([...spec.value, ...spec.boolean]);
    const undeclared = flagsRead(source).filter((name) => !declared.has(name));
    expect(undeclared, `${path} reads flags its spec does not declare`).toEqual([]);
  });

  /**
   * AND THE OTHER DIRECTION, WHICH IS THE INCIDENT ITSELF (reviewer finding 2,
   * second cycle on PR #587).
   *
   * The arm above is read subset-of declared: it guards *a documented command
   * starts refusing*. **Declared-but-unread is `#288` verbatim** — a flag the
   * parser cheerfully accepts and the script then ignores, which is exactly
   * what `--dry-run` did to a running shift's row on production.
   *
   * So: declared minus read must be `["spend"]` for the two spenders and
   * nothing at all for the ledger. `spend` is the one legitimate exception in
   * the tree — the freeze reads it off raw argv rather than through the parse —
   * and the exception is only allowed to a file that really calls that door.
   */
  const SPEND_IS_READ_BY_THE_FREEZE = [
    "scripts/drive-finding-replay.mts",
    "scripts/drive-self-walk.mts",
  ] as const;

  it.each(DRIVERS)("%s reads every flag it declares", (path) => {
    const source = sourceOf(path);
    const spec = specIn(codeOf(path));
    const read = new Set(flagsRead(source));
    const unread = [...spec.value, ...spec.boolean].filter((name) => !read.has(name)).sort();
    const allowed = (SPEND_IS_READ_BY_THE_FREEZE as readonly string[]).includes(path) ? ["spend"] : [];
    expect(unread, `${path} declares flags nothing reads`).toEqual(allowed);
    /* The exception is earned, not assumed: a file may only leave `spend`
       unread through the parse if it really asks the freeze. */
    if (allowed.length > 0) expect(source).toContain("spendAuthorized(");
  });

  it.each(DRIVERS)("%s asks for at least one flag, so the arm above can fail", (path) => {
    expect(flagsRead(sourceOf(path)).length).toBeGreaterThan(0);
  });

  /* THE CONTROLS. Both readers above are green when they read nothing at all,
     which is the shape that makes a source-reading arm worthless. */
  it("the spec reader refuses a script that stopped parsing strictly", () => {
    expect(() => specIn("const x = 1;")).toThrow(/no parseStrictArgsOrRefuse call/);
    expect(() => specIn('parseStrictArgsOrRefuse(process.argv.slice(2), { value: ["a"] })'))
      .toThrow(/no boolean/);
  });

  it("the flag reader really sees an undeclared flag", () => {
    const fake = 'parseStrictArgsOrRefuse(process.argv.slice(2), { value: ["days"], boolean: [] });\n'
      + 'const a = arg("days"); const b = arg("smuggled"); const c = ARGS.flag("alsoSmuggled");';
    const declared = new Set(Object.values(specIn(fake)).flat());
    expect(flagsRead(fake)).toEqual(["alsoSmuggled", "days", "smuggled"]);
    expect(flagsRead(fake).filter((name) => !declared.has(name))).toEqual(["alsoSmuggled", "smuggled"]);
  });
});

/**
 * THE FREEZE'S OWN SPENDER LIST, CHECKED WHERE CI CAN SEE IT (#345, found on
 * the way).
 *
 * `stopline.mts --prove` names the scripts that can charge the founder's
 * account and asserts each uses the strict `spendAuthorized` door. Driving it
 * to verify the change above found it CRASHING: two of its four named spenders
 * were deleted by the litter purge on 2026-08-25 (`989e70a0`), the reader
 * `readFileSync`'d them straight, and the throw landed before its last two
 * arms ever ran — **including the derived roster, the one arm that can find a
 * new spender with no freeze on it.** Twelve days, no failing test, no error
 * anybody read: nothing in CI drives `--prove`, so its stack trace was only
 * ever seen by a shift that happened to run it.
 *
 * The prover reports a missing name now instead of dying on it. This arm is the
 * other half — the same reading, in a suite the gate actually runs, so a third
 * deletion is a red on the PR that makes it rather than a control that goes
 * quiet. It deliberately does NOT re-implement the prover: it checks only that
 * the list the prover walks still points at files, which is the exact fact
 * whose absence cost the twelve days.
 */
describe("the stop-the-line's named account spenders still exist", () => {
  const rosterIn = (source: string) => {
    const block = /const ACCOUNT_SPENDERS = \[([\s\S]*?)\];/.exec(source);
    if (!block) throw new Error("no ACCOUNT_SPENDERS list in stopline.mts");
    return [...block[1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
  };
  const roster = rosterIn(sourceOf("scripts/lib/stopline.mts"));

  it("the roster reader found a non-empty list, so the arm below can fail", () => {
    expect(() => rosterIn("const x = 1;")).toThrow(/no ACCOUNT_SPENDERS/);
    expect(roster.length).toBeGreaterThan(0);
  });

  it.each(roster)("%s is still in the tree", (relative) => {
    expect(existsSync(join(REPO, relative)), `${relative} is named as an account spender and is gone`).toBe(true);
  });

  it("every named spender routes through the strict door", () => {
    for (const relative of roster) {
      /* Existence is the arm above's job; reading a missing file here would
         report a stack trace where that arm already says the real thing. */
      if (!existsSync(join(REPO, relative))) continue;
      const source = readFileSync(join(REPO, relative), "utf8");
      expect(source, relative).toContain("spendAuthorized(");
      expect(source, relative).not.toContain("fixtureSpendAuthorized(");
    }
  });
});

/**
 * THE DERIVED ROSTER, WHERE CI CAN SEE IT (reviewer finding 3 on PR #587).
 *
 * The prover's arm 9 is the one that can find a NEW spender with no freeze on
 * it, and after the crash repair it still ran only at a keyboard — so the
 * diagnosis *"nothing in CI drives `--prove`"* outlived its own fix. A script
 * hand-rolling `"--spend"` without importing `stopline` went green throughout
 * the dark fortnight and would have kept going green.
 *
 * The sweep is hoisted out of the controls block and imported here rather than
 * re-implemented (working law 4): one reading, two callers.
 */
describe("no script in the tree can spend without the freeze", () => {
  const SCRIPTS = join(REPO, "scripts");

  it("sweeps a real population — a clean answer over no files is not an answer", () => {
    expect(scriptFilesUnder(SCRIPTS).length).toBeGreaterThan(100);
  });

  it("every `--spend` gate routes through the stop-the-line", () => {
    expect(unguardedSpendGates(SCRIPTS, REPO)).toEqual([]);
  });

  it("sees the NEW idiom this repair made canonical, not just the literal", () => {
    /* Reviewer finding 1, second cycle: after #345 the house style for a
       spender is a strict spec, where the word is `boolean: ["spend"]` read as
       `ARGS.flag("spend")` and the `--spend` literal never appears. The next
       paid driver gets copied from `drive-self-walk.mts`; a roster that could
       only see the literal would not have been looking at it. */
    const scratch = mkdtempSync(join(tmpdir(), "spendidiom-"));
    try {
      writeFileSync(join(scratch, "new-idiom.mts"),
        'const ARGS = parseStrictArgsOrRefuse(process.argv.slice(2), { value: [], boolean: ["spend"] });\n'
        + 'const SPEND = ARGS.flag("spend");\n');
      expect(unguardedSpendGates(scratch, scratch)).toEqual(["new-idiom.mts"]);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  it("skips a file that IMPORTS the freeze, and only one that imports it", () => {
    /* The skip was `source.includes("lib/stopline.m")` — a mention standing in
       for an import, the #360 class inside the control this PR pinned into CI.
       A rogue file whose comment merely names the module was skipped. */
    const scratch = mkdtempSync(join(tmpdir(), "spendmention-"));
    try {
      writeFileSync(join(scratch, "mentions-only.mts"),
        '/* Unlike lib/stopline.mts, this one decides for itself. */\n'
        + 'const SPEND = process.argv.includes("--spend");\n');
      writeFileSync(join(scratch, "static-import.mts"),
        'import { spendAuthorized } from "./lib/stopline.mts";\n'
        + 'const SPEND = spendAuthorized("x") && process.argv.includes("--spend");\n');
      writeFileSync(join(scratch, "dynamic-import.mts"),
        'const { spendAuthorized } = await import("../lib/stopline.mts");\n'
        + 'const SPEND = spendAuthorized("x") && process.argv.includes("--spend");\n');
      expect(unguardedSpendGates(scratch, scratch)).toEqual(["mentions-only.mts"]);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  it("and it really would report one — the positive control", () => {
    /* Driven against a throwaway tree rather than by trusting the green above:
       a sweep that returned [] unconditionally passes the arm before this one. */
    const scratch = mkdtempSync(join(tmpdir(), "spendsweep-"));
    try {
      writeFileSync(join(scratch, "rogue.mts"), 'const SPEND = process.argv.includes("--spend");\n');
      writeFileSync(
        join(scratch, "guarded.mts"),
        'import { spendAuthorized } from "./lib/stopline.mts";\nconst S = spendAuthorized("x");\n',
      );
      writeFileSync(join(scratch, "quiet.mts"), "export const nothing = 1;\n");
      expect(unguardedSpendGates(scratch, scratch)).toEqual(["rogue.mts"]);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});

/**
 * AND A `--prove` BLOCK BELONGS TO ITS OWN FILE (reviewer finding 2, swept).
 *
 * `if (process.argv.includes("--prove"))` at module scope reads the IMPORTER's
 * command line. `npx tsx scripts/drive-self-walk.mts --prove --spend` therefore
 * ran an imported module's self-controls and exited before the walk's strict
 * parse ever saw the unknown word — the driver neither walked nor refused. One
 * word bypassing a refusal, which is the very class this PR closes.
 *
 * The reviewer found it on `stopline.mts`. The sweep found four more, all the
 * same shape; all five are guarded and all five are pinned here, because the
 * repair is invisible at the call site and a sixth module would be written the
 * old way by anyone copying an existing one.
 */
describe("a self-prove block runs only for the file that was invoked", () => {
  const PROVERS = [
    "scripts/lib/stopline.mts",
    "scripts/lib/imageBytes.mts",
    "scripts/lib/outsider.mts",
    "scripts/lib/verdictContradiction.mts",
    "scripts/lib/worldGuard.mts",
  ] as const;

  it.each(PROVERS)("%s guards its controls on direct invocation", (path) => {
    const source = sourceOf(path);
    expect(source).toMatch(/invokedDirectly && process\.argv\.includes\("--prove"\)/);
    expect(source).toMatch(/import\.meta\.url/);
  });

  it("no module in scripts/lib takes --prove off the importer's argv", () => {
    /* Derived, so a SIXTH module written the old way reddens here — the list
       above would not have caught the four this sweep found. */
    const unguarded = scriptFilesUnder(join(REPO, "scripts", "lib"))
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        if (!source.includes('process.argv.includes("--prove")')) return false;
        return !source.includes('invokedDirectly && process.argv.includes("--prove")');
      })
      .map((file) => file.slice(REPO.length + 1));
    expect(unguarded).toEqual([]);
  });

  it("the reader really finds the prove blocks it is judging", () => {
    /* Without this the arm above is green over a population of zero. */
    const provers = scriptFilesUnder(join(REPO, "scripts", "lib"))
      .filter((file) => readFileSync(file, "utf8").includes('process.argv.includes("--prove")'));
    expect(provers.length).toBe(PROVERS.length);
  });
});

/**
 * AND THE POSITIVE ARMS, WHICH ARE THE ONES THAT MATTER MOST.
 *
 * A parser that refused everything would pass every refusal arm above. So the
 * real documented command lines — the ones written into these files' own
 * headers — are parsed here and must be ACCEPTED.
 */
describe("and the lines an operator really types are still accepted", () => {
  const specOf = (path: (typeof DRIVERS)[number]) => specIn(codeOf(path));

  it("accepts the finding replay's controls-only run", () => {
    const args = parseStrictArgs(
      ["--controls", "--bucket", "https://pub-990e39d8.r2.dev"],
      specOf("scripts/drive-finding-replay.mts"),
    );
    expect(args.flag("controls")).toBe(true);
    expect(args.value("bucket")).toBe("https://pub-990e39d8.r2.dev");
  });

  it("accepts the finding replay's dry run, and the 125-credit walk", () => {
    const spec = specOf("scripts/drive-finding-replay.mts");
    const dry = [
      "--bucket", "https://pub-990e39d8.r2.dev",
      "--base", "https://drape-production-0232.up.railway.app",
      "--token", "eyJhbGciOi.jwt.sig", "--candidate", "abc123",
    ];
    expect(() => parseStrictArgs(dry, spec)).not.toThrow();
    expect(() => parseStrictArgs([...dry, "--world", "production", "--spend"], spec)).not.toThrow();
    expect(() => parseStrictArgs([...dry, "--rehearse", "--overwrite", "--out", "output/x"], spec)).not.toThrow();
  });

  it("accepts the self walk's dry run and its spend, including --fresh", () => {
    const spec = specOf("scripts/drive-self-walk.mts");
    const line = [
      "--base", "https://drape-production-0232.up.railway.app",
      "--token", "eyJhbGciOi.jwt.sig",
      "--publicBase", "https://pub-990e39d8.r2.dev",
    ];
    expect(() => parseStrictArgs([...line, "--candidate", "abc123"], spec)).not.toThrow();
    expect(() => parseStrictArgs([...line, "--fresh", "roll222", "--spend"], spec)).not.toThrow();
  });

  it("accepts the ledger's default run and its two flags", () => {
    const spec = specOf("scripts/machinist-ledger-read.mts");
    expect(() => parseStrictArgs([], spec)).not.toThrow();
    expect(parseStrictArgs(["--days", "30", "--pr-limit", "400"], spec).value("days")).toBe("30");
  });

  /* THE INCIDENT SHAPE, on each driver: the safest-sounding word an operator
     can type, on a command line that used to run the real thing anyway. */
  it.each(DRIVERS)("%s refuses --dry-run instead of ignoring it", (path) => {
    expect(() => parseStrictArgs(["--dry-run"], specIn(codeOf(path)))).toThrow(ArgumentError);
  });

  it("refuses a near-miss on the flag that decides what gets walked", () => {
    const spec = specOf("scripts/drive-self-walk.mts");
    expect(() => parseStrictArgs(["--fesh", "roll222"], spec)).toThrow(/unknown argument --fesh/);
    expect(() => parseStrictArgs(["--candidate", "--spend"], spec))
      .toThrow(/--candidate needs a value/);
  });
});

/*
  #589 — THE VANISH-RACE, both directions (#223's class in this module's own
  walker). `scriptWorldGuard.test.ts` plants and unlinks a real file in the
  real scripts directory while suites run in parallel; the walk above saw it at
  readdir and threw at stat, which REFUSED the deploy rite on a clean tree
  twice on 2026-09-06. The tolerance is ENOENT only — a helper that swallowed
  EISDIR or EACCES would turn every sweep green by making it blind, so the
  refusing direction is driven too.

  The helpers moved to `scripts/lib/listedEntry.mts` (#591) so `stopline.mts`
  and `productionMention.mts` — the two `scripts/` walkers — share ONE copy of
  the rule. These arms follow them; they are still the only thing that drives
  the tolerance in either direction.
*/
describe("a file that vanishes between list and read is skipped, and nothing else is", () => {
  it("statIfPresent and readIfPresent answer null for a path that is gone", () => {
    const gone = join(tmpdir(), `_589-never-existed-${process.pid}.mts`);
    expect(statIfPresent(gone)).toBeNull();
    expect(readIfPresent(gone)).toBeNull();
  });

  it("readIfPresent still THROWS on a directory — the tolerance is ENOENT only", () => {
    const dir = mkdtempSync(join(tmpdir(), "_589-eisdir-"));
    try {
      expect(() => readIfPresent(dir)).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the walk still finds a real population — the tolerance did not blind it", () => {
    const dir = mkdtempSync(join(tmpdir(), "_589-walk-"));
    try {
      writeFileSync(join(dir, "a.mts"), "export {};");
      writeFileSync(join(dir, "b.ts"), "export {};");
      expect(scriptFilesUnder(dir)).toHaveLength(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

/**
 * NO PAID SCRIPT IN THE TREE READS ITS FLAGS BY NAME — THE DERIVED POPULATION
 * (#345, second pass).
 *
 * The arms at the top of this file guard three files by name. This one asks the
 * CLASS question of every script that drives a billing transport, so a new paid
 * driver is covered by existing rather than by somebody remembering to add it.
 *
 * # The rule is the COMPLEMENT of the defect, deliberately
 *
 * `#345` measured its own population with `grep "process\.argv\.indexOf("`, and
 * that grep cannot see two other spellings of the identical mistake: a bare
 * `process.argv.includes("--repaint")` as a file's only reader, and a positional
 * `process.argv[2]`. Both discard an unknown word in exactly the same silence,
 * and four paid scripts were carrying the first one. So the reader does not
 * match the defect — it asserts that **the only mention of `process.argv` in a
 * paid script is the strict parse call**, which a fourth spelling cannot slip
 * past.
 */
describe("no paid script reads its flags by name", () => {
  const SCRIPTS = join(REPO, "scripts");

  /**
   * ⚠ THE TWO EXEMPTIONS ARE INTERFACE DIFFERENCES, NOT UNFIXED INSTANCES, AND
   * EACH CARRIES ITS REASON HERE RATHER THAN IN A COMMIT MESSAGE.
   *
   * `parseStrictArgs` reads `--name value` and refuses both a `--name=value`
   * pair and a bare positional word. These two scripts have the other two
   * shapes as their DOCUMENTED command lines, so converting them is a change to
   * how an operator invokes them — a separate decision from tightening a
   * parser, and one that belongs on its own card (#602) rather than inside this
   * sweep.
   *
   * Both fail SAFE today, which is why they could wait: `calibrate-providers`
   * defaults to a dry run and spends only on an explicit `--execute`, and
   * `tilt-instrument` falls back to a fixed specimen path. Neither can be made
   * to spend by a word being swallowed — the property the twelve repaired files
   * did NOT have.
   */
  const INTERFACE_EXEMPT = [
    "scripts/calibrate-providers.mts",
    "scripts/calibration/tilt-instrument.mts",
  ] as const;

  it("sweeps a real population — a clean answer over no files is not an answer", () => {
    const paid = scriptFilesUnder(SCRIPTS).filter((file) => drivesAPaidTransport(readFileSync(file, "utf8")));
    expect(paid.length).toBeGreaterThan(15);
  });

  /**
   * THE ONE-HOP SPECIMEN STAYS IN THE POPULATION (PR #603's review, finding 1).
   *
   * `hair-arrangement-court` reaches OpenRouter through `presentationState`
   * rather than by importing a transport, so the first draft of the classifier
   * could not see it — and it was carrying the defect. It is covered now only
   * because `presentationState` is named in the transport list.
   *
   * ⚠ Without this arm, deleting that name would redden NOTHING: the file is
   * repaired, so it is silent whether it is swept or not. The arm pins the
   * membership rather than the symptom, which is the only way a fixed specimen
   * can go on guarding the reader that found it.
   */
  it("keeps the one-hop specimen in the swept population", () => {
    const source = sourceOf("scripts/calibration/hair-arrangement-court.mts");
    expect(drivesAPaidTransport(source), "the one-hop spender fell out of the population").toBe(true);
  });

  it("every paid script parses strictly", () => {
    expect(paidScriptsReadingFlagsByName(SCRIPTS, REPO, INTERFACE_EXEMPT)).toEqual([]);
  });

  it("the exemptions are still real files, and still paid", () => {
    /* An exemption naming a deleted or de-fanged file is a hole that reads as
       an allowance — the `ACCOUNT_SPENDERS` crash above, one describe block
       away, is what that costs. */
    for (const relative of INTERFACE_EXEMPT) {
      expect(existsSync(join(REPO, relative)), `${relative} is exempted and gone`).toBe(true);
      expect(drivesAPaidTransport(sourceOf(relative)), `${relative} is exempted and no longer paid`).toBe(true);
    }
  });

  it("the exemptions are the ONLY things standing between this arm and a red", () => {
    /* The positive control the arm above cannot be trusted without: with the
       exemptions withdrawn, the sweep must name exactly those two. A reader
       that had quietly stopped finding anything would pass "every paid script
       parses strictly" and this is what catches it. */
    expect(paidScriptsReadingFlagsByName(SCRIPTS, REPO)).toEqual([...INTERFACE_EXEMPT]);
  });

  it("really sees each of the three spellings, and clears a strict file", () => {
    const scratch = mkdtempSync(join(tmpdir(), "paidflags-"));
    try {
      const paid = 'import { createFalRegionReader } from "../../server/castingV2/falRegionReader";\n';
      writeFileSync(join(scratch, "byindex.mts"), paid + 'const at = process.argv.indexOf("--n");\n');
      writeFileSync(join(scratch, "byincludes.mts"), paid + 'const r = process.argv.includes("--repaint");\n');
      writeFileSync(join(scratch, "bypositional.mts"), paid + 'const s = process.argv[2];\n');
      writeFileSync(join(scratch, "strict.mts"),
        paid + 'const ARGS = parseStrictArgsOrRefuse(process.argv.slice(2), { value: ["n"], boolean: [] });\n');
      /* And a file reading argv by name that is NOT paid — the sweep is about
         spenders, and one that flagged every reporter would be a different
         (and much noisier) control than the one claimed. */
      writeFileSync(join(scratch, "unpaid.mts"), 'const at = process.argv.indexOf("--n");\n');
      expect(paidScriptsReadingFlagsByName(scratch, scratch)).toEqual([
        "byincludes.mts", "byindex.mts", "bypositional.mts",
      ]);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  it("reads the CODE, so a docblock may quote the reader it replaced", () => {
    /* #360's class, and it is load-bearing here: every one of the twelve files
       repaired under this card names the old shape in the prose explaining why
       it is gone. A guard that could not tell a quotation from an occurrence
       would force that prose to go quiet. */
    const scratch = mkdtempSync(join(tmpdir(), "paidquote-"));
    try {
      writeFileSync(join(scratch, "quoting.mts"),
        'import { createFalRegionReader } from "../../server/castingV2/falRegionReader";\n'
        + '/* The reader here was `process.argv.indexOf("--" + name)`, which could not fail. */\n'
        + 'const ARGS = parseStrictArgsOrRefuse(process.argv.slice(2), { value: [], boolean: [] });\n');
      expect(paidScriptsReadingFlagsByName(scratch, scratch)).toEqual([]);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});

/**
 * A SCRIPT'S OWN STRICT PARSE MUST NOT REFUSE ITS OWN `--spend` (PR #603's
 * review, round 2 — a regression this card introduced and nearly shipped).
 *
 * Both spend doors read `--spend` off `process.argv` through a default
 * parameter, so a script that also parses strictly has TWO readers of one
 * command line and the parse runs first. `composite-anchored-arm.mts` declared
 * `boolean: []`, so its documented paid line — and the dry run's own *"re-run
 * with --spend"* epilogue — both led into `REFUSING: unknown argument --spend`.
 * Its only paint path was unreachable.
 *
 * ⚠ **No other arm in this file could have caught it.** The class arm bans
 * argv reads OUTSIDE the parse and this one is inside `stopline.mts`; the
 * vocabulary arms cover only the three named `DRIVERS`. It fails safe in money
 * terms — nothing can spend — which is exactly why it is silent: no error, no
 * spend, every suite green, and a documented command that simply does not work.
 */
describe("no script's strict parse refuses its own spend word", () => {
  const SCRIPTS = join(REPO, "scripts");

  it("every spend-gated script that parses strictly declares the word", () => {
    expect(spendWordsRefusedByTheirOwnParse(SCRIPTS, REPO)).toEqual([]);
  });

  it("really sees a script that dropped it, and clears one that kept it", () => {
    /* The positive control: the arm above is green over an empty sweep, which
       is the shape that makes a source reader worthless. */
    const scratch = mkdtempSync(join(tmpdir(), "spendword-"));
    try {
      const gate = 'const SPEND = fixtureSpendAuthorized(`paint the fixtures`);\n';
      writeFileSync(join(scratch, "dropped.mts"),
        'const ARGS = parseStrictArgsOrRefuse(process.argv.slice(2), { value: ["chains"], boolean: [] });\n' + gate);
      writeFileSync(join(scratch, "declared.mts"),
        'const ARGS = parseStrictArgsOrRefuse(process.argv.slice(2), { value: [], boolean: ["spend"] });\n' + gate);
      /* Not this defect: no strict parse at all, so nothing refuses the word. */
      writeFileSync(join(scratch, "noparse.mts"), gate);
      /* Not this defect either: it passes its own argv, so it chose its reader. */
      writeFileSync(join(scratch, "ownargv.mts"),
        'const ARGS = parseStrictArgsOrRefuse(process.argv.slice(2), { value: [], boolean: [] });\n'
        + 'const SPEND = spendAuthorized("x", myOwnArgv);\n');
      expect(spendWordsRefusedByTheirOwnParse(scratch, scratch)).toEqual(["dropped.mts"]);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});
