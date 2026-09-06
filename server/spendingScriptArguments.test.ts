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
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ArgumentError, parseStrictArgs } from "../scripts/lib/strictArgs.mts";

const REPO = join(__dirname, "..");

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
    const spec = specIn(source);
    const declared = new Set([...spec.value, ...spec.boolean]);
    const undeclared = flagsRead(source).filter((name) => !declared.has(name));
    expect(undeclared, `${path} reads flags its spec does not declare`).toEqual([]);
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
 * AND THE POSITIVE ARMS, WHICH ARE THE ONES THAT MATTER MOST.
 *
 * A parser that refused everything would pass every refusal arm above. So the
 * real documented command lines — the ones written into these files' own
 * headers — are parsed here and must be ACCEPTED.
 */
describe("and the lines an operator really types are still accepted", () => {
  const specOf = (path: (typeof DRIVERS)[number]) => specIn(sourceOf(path));

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
    expect(() => parseStrictArgs(["--dry-run"], specIn(sourceOf(path)))).toThrow(ArgumentError);
  });

  it("refuses a near-miss on the flag that decides what gets walked", () => {
    const spec = specOf("scripts/drive-self-walk.mts");
    expect(() => parseStrictArgs(["--fesh", "roll222"], spec)).toThrow(/unknown argument --fesh/);
    expect(() => parseStrictArgs(["--candidate", "--spend"], spec))
      .toThrow(/--candidate needs a value/);
  });
});
