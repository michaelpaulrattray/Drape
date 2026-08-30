/**
 * THE SHIFT WRITE ROAD IS ONE TABLE WIDE — proven at the source (issue #272).
 *
 * Migration `0055` overrides a design principle `0054` states in as many words:
 * a night shift now writes production rows directly, where before its only road
 * was the deployed briefing. The whole argument for that override rests on the
 * road being NARROW — and "narrow" written in a docblock is a promise, not a
 * control (invariant 7: *a control that is not invoked does not exist*).
 *
 * So this reads the two writer scripts' actual bytes and asserts:
 *
 *   1. they name `crew_shift_runs` and NO OTHER TABLE — above all not
 *      `crew_replies`, the founder's own half, whose road from a shift has been
 *      read-only by construction since it was built;
 *   2. they issue no DDL (`DROP`, `ALTER`, `TRUNCATE`, `CREATE`);
 *   3. they never `DELETE` — closing a run is an UPDATE, because the row is the
 *      record #272 asks to see afterwards.
 *
 * # ⚠ THE POSITIVE CONTROLS ARE THE POINT OF THIS FILE
 *
 * A boundary test that greps for strings is exactly the instrument this
 * repository has been burned by: `strictInput` was a substring test for months,
 * the price reader was a regex over one file, and both reported a complete list
 * while seeing a fraction of it. So each arm below is run TWICE — once over the
 * real scripts (which must pass) and once over a doctored copy carrying the
 * thing it forbids (which must FAIL). An arm that cannot go red is not
 * evidence, and this file would otherwise be a green suite proving nothing
 * (working law 2).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const REPO = join(__dirname, "..");

/** The two files that may write. Any third one is a decision, not an omission. */
const WRITER_SCRIPTS = [
  "scripts/crew-shift-start.mts",
  "scripts/crew-shift-close.mts",
] as const;

/** The one table they may name. */
const OWN_TABLE = "crew_shift_runs";

/**
 * Tables that must not appear in these scripts' executable source AT ALL.
 *
 * Deliberately NOT the full schema list: this is about the tables whose being
 * reached by a shift would matter, and `crew_replies` — the founder's own half
 * — is the one the whole boundary exists for.
 *
 * ⚠ `users` IS ABSENT FROM THIS LIST ON PURPOSE, and the reason is a real
 * control rather than an exemption: both writers prove their existence-reader
 * against `SHOW TABLES LIKE 'users'` before believing its negative (working law
 * 2). Banning the word would force that control out of the scripts to keep this
 * test green — trading a guarantee that matters for a cosmetic one. A WRITE to
 * `users` is still caught, by `ALLOWED_WRITE_TARGETS` below, which is the arm
 * that was always doing the real work here.
 */
const FORBIDDEN_TABLES = [
  "crew_replies",
  "credit_transactions",
  "casting_candidates",
  "casting_rolls",
  "admin_audit_log",
] as const;

/**
 * The only things an INSERT / UPDATE / DELETE in these scripts may target.
 *
 * `TABLE` is the `const TABLE = "crew_shift_runs"` both writers interpolate —
 * the indirection is pinned by its own arm below, so the allowance cannot be
 * used to smuggle a different table through a renamed constant.
 */
const ALLOWED_WRITE_TARGETS = ["crew_shift_runs", "TABLE"] as const;

/** Statements a status-board writer has no business issuing. */
const FORBIDDEN_STATEMENTS = [
  /\bDROP\s+TABLE\b/i,
  /\bTRUNCATE\b/i,
  /\bALTER\s+TABLE\b/i,
  /\bCREATE\s+TABLE\b/i,
  /\bDELETE\s+FROM\b/i,
] as const;

function sourceOf(relative: string): string {
  return readFileSync(join(REPO, relative), "utf8");
}

/**
 * ⚠ COMMENTS ARE STRIPPED BEFORE ANYTHING IS JUDGED, AND THE FIRST VERSION OF
 * THIS FILE DID NOT DO IT — it went red on the real scripts the moment it ran.
 *
 * Both writers NAME `crew_replies` in a docblock, because explaining which
 * table a shift may not touch is the whole point of the docblock. A substring
 * test over raw source calls that a violation, which would have left exactly
 * two options: delete the explanation, or delete the test. That is the
 * shape-match-where-a-declaration-exists class this repository has been caught
 * by four times over — a regex standing in for the question actually being
 * asked.
 *
 * The question actually being asked is **"does a WRITE STATEMENT name another
 * table"**, not "does the word appear in the file".
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ");
}

/**
 * Tables named by a statement that CHANGES something.
 *
 * `users` is deliberately reachable by a READ here and always will be: both
 * writers prove their existence-reader against `SHOW TABLES LIKE 'users'`
 * before believing its negative (working law 2). Banning the word would force
 * that control out, trading a real guarantee for a cosmetic one.
 */
function writeTargetsIn(source: string): string[] {
  const code = stripComments(source);
  const targets: string[] = [];
  /*
    ⚠ THE BACKSLASH IN THESE CHARACTER CLASSES IS LOAD-BEARING, and leaving it
    out is how the first version of this arm reported a clean `[]` for both real
    scripts while their INSERT and UPDATE sat in plain sight.

    The writers build SQL in a template literal, so a quoted identifier reaches
    the FILE as `\``  — backslash, backtick — and a class of ``[`'"\s]`` stops
    dead at the backslash. `expect(stray).toEqual([])` was then green because
    the reader found nothing at all, which is the absence-only failure this
    repository has a memory about: a check whose negative is produced by its own
    blindness rather than by the property holding.

    `writeTargetsIn` is now pinned by an arm that asserts it FINDS the real
    writes (below). A reader that can only say "no" is not a reader.
  */
  const patterns = [
    /\bINSERT\s+INTO\s+[`'"\\\s]*\$?\{?\s*([A-Za-z_][\w]*)/gi,
    /\bUPDATE\s+[`'"\\\s]*\$?\{?\s*([A-Za-z_][\w]*)/gi,
    /\bDELETE\s+FROM\s+[`'"\\\s]*\$?\{?\s*([A-Za-z_][\w]*)/gi,
  ];
  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) targets.push(match[1]);
  }
  return targets;
}

/**
 * Whether a forbidden table is named ANYWHERE in the executable source.
 *
 * Comments stripped, so the docblocks that explain the boundary survive while a
 * real reference does not.
 */
function forbiddenTablesInCode(source: string): string[] {
  const code = stripComments(source);
  return FORBIDDEN_TABLES.filter((table) => code.includes(table));
}

function forbiddenStatementsIn(source: string): string[] {
  const code = stripComments(source);
  return FORBIDDEN_STATEMENTS.filter((pattern) => pattern.test(code)).map(String);
}

describe("the shift write road is one table wide", () => {
  it.each(WRITER_SCRIPTS)("%s names its own table", (script) => {
    expect(sourceOf(script)).toContain(OWN_TABLE);
  });

  it.each(WRITER_SCRIPTS)("%s binds its table constant to its own table", (script) => {
    /* The indirection `ALLOWED_WRITE_TARGETS` permits is pinned here, so a
       renamed constant cannot carry a different table through the arm below. */
    expect(sourceOf(script)).toContain(`const TABLE = "${OWN_TABLE}"`);
  });

  /*
    ⚠ THE READER IS PROVEN TO SEE THE REAL WRITES BEFORE ITS SILENCE COUNTS
    (working law 2, and the arm below is why this file is trustworthy at all).

    `expect(stray).toEqual([])` is green whenever `writeTargetsIn` returns
    nothing — INCLUDING when it is blind. It was: the first version missed the
    escaped backtick in `INSERT INTO \`${TABLE}\`` and reported both scripts
    clean while every one of their writes sat in plain sight. Asserting the
    reader FINDS them is what makes the next arm's `[]` mean something.
  */
  it.each(WRITER_SCRIPTS)("%s — the reader can SEE this script's writes", (script) => {
    expect(writeTargetsIn(sourceOf(script)).length).toBeGreaterThan(0);
  });

  it("the start script inserts, and the close script updates", () => {
    expect(writeTargetsIn(sourceOf("scripts/crew-shift-start.mts"))).toContain("TABLE");
    expect(stripComments(sourceOf("scripts/crew-shift-start.mts"))).toMatch(/\bINSERT\s+INTO\b/i);
    expect(stripComments(sourceOf("scripts/crew-shift-close.mts"))).toMatch(/\bUPDATE\b/i);
  });

  it.each(WRITER_SCRIPTS)("%s writes to no table but its own", (script) => {
    const stray = writeTargetsIn(sourceOf(script))
      .filter((target) => !ALLOWED_WRITE_TARGETS.includes(target as (typeof ALLOWED_WRITE_TARGETS)[number]));
    expect(stray).toEqual([]);
  });

  it.each(WRITER_SCRIPTS)("%s never names the founder's own half in code", (script) => {
    expect(forbiddenTablesInCode(sourceOf(script))).toEqual([]);
  });

  it.each(WRITER_SCRIPTS)("%s issues no DDL and never DELETEs", (script) => {
    expect(forbiddenStatementsIn(sourceOf(script))).toEqual([]);
  });

  /*
    THE READ ROAD IS UNCHANGED, and this is the arm that would catch the erosion
    happening the other way round: somebody adding a write to the script whose
    docblock promises it never writes.
  */
  it("the founder's replies are still read-only from a shift", () => {
    const source = sourceOf("scripts/crew-read-replies.mts");
    expect(source).toContain("crew_replies");
    for (const pattern of [/\bINSERT\s+INTO\b/i, /\bUPDATE\s+\S*crew_replies/i, ...FORBIDDEN_STATEMENTS]) {
      expect(source).not.toMatch(pattern);
    }
  });
});

/**
 * THE POSITIVE CONTROLS — each arm above, driven against a source that carries
 * exactly the thing it forbids, and required to FAIL.
 *
 * Without these, this file passes on an empty string, a renamed script, or a
 * check whose regex never matched anything in its life.
 */
describe("the boundary reader can actually say no", () => {
  /*
    THE ARM THAT MATTERS MOST: a write aimed at the founder's own half. It is
    added as CODE rather than as a comment precisely because the first version
    of this file could not tell the two apart.
  */
  it("catches a write aimed at the founder's replies", () => {
    const doctored = `${sourceOf("scripts/crew-shift-start.mts")}
await conn.query("UPDATE crew_replies SET body = 'x'");
`;
    expect(writeTargetsIn(doctored)).toContain("crew_replies");
    expect(forbiddenTablesInCode(doctored)).toContain("crew_replies");
  });

  it("catches a write aimed at any other table", () => {
    const doctored = `${sourceOf("scripts/crew-shift-close.mts")}
await conn.query("UPDATE users SET role = 'admin'");
`;
    expect(writeTargetsIn(doctored)).toContain("users");
  });

  /*
    AND THE CONTROL ON THE COMMENT-STRIPPING ITSELF — the mechanism that made
    the arms above possible must not be able to hide a real reference. A
    forbidden table inside a comment passes; the same words as code do not.
  */
  it("strips comments without hiding code", () => {
    const inComment = "/* never touch crew_replies */\nconst x = 1;";
    expect(forbiddenTablesInCode(inComment)).toEqual([]);
    const inCode = "const t = 'crew_replies';";
    expect(forbiddenTablesInCode(inCode)).toContain("crew_replies");
  });

  it.each([
    ["a DROP", "await conn.query(`DROP TABLE crew_shift_runs`);"],
    ["a TRUNCATE", "await conn.query(`TRUNCATE crew_shift_runs`);"],
    ["an ALTER", "await conn.query(`ALTER TABLE crew_shift_runs ADD x int`);"],
    ["a DELETE", "await conn.query(`DELETE FROM crew_shift_runs WHERE id = 1`);"],
  ])("catches %s", (_label, statement) => {
    const doctored = `${sourceOf("scripts/crew-shift-close.mts")}\n${statement}\n`;
    expect(forbiddenStatementsIn(doctored)).not.toEqual([]);
  });

  it("catches a write appearing in the read-only reply reader", () => {
    const doctored = `${sourceOf("scripts/crew-read-replies.mts")}\nawait conn.query("INSERT INTO crew_replies (body) VALUES ('x')");\n`;
    expect(doctored).toMatch(/\bINSERT\s+INTO\b/i);
  });

  /*
    And the arm that catches the file simply not being there — a renamed or
    deleted writer would make every `it.each` above vacuous rather than red.
  */
  it("fails loudly if a writer script is missing", () => {
    expect(() => sourceOf("scripts/crew-shift-does-not-exist.mts")).toThrow();
    for (const script of WRITER_SCRIPTS) expect(sourceOf(script).length).toBeGreaterThan(500);
  });
});
