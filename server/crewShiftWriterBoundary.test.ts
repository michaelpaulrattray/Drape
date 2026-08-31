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

/**
 * The files that may write, each with the ONE table it may write.
 *
 * A third entry is a decision, not an omission — and the pairing is what makes
 * this test say something: `crew-count-queue.mts` writing `crew_shift_runs`, or
 * `crew-shift-start.mts` writing the counts, would each be a boundary breach
 * that a single shared allowlist could not see.
 */
const WRITER_SCRIPTS = [
  { path: "scripts/crew-shift-start.mts", table: "crew_shift_runs" },
  { path: "scripts/crew-shift-close.mts", table: "crew_shift_runs" },
  { path: "scripts/crew-count-queue.mts", table: "crew_queue_counts" },
] as const;

/**
 * The shift-run READER, and the reason it is pinned here rather than trusted
 * (issue #288).
 *
 * `crew_shift_runs` had two commands and both of them wrote. An operator who
 * wanted to LOOK reached for the closest thing — the close script, with
 * `--dry-run` appended — and a running shift's row was stamped terminal on
 * production. `crew-shift-state.mts` is the reader that absence created the
 * pressure for, and its entire value is that it CANNOT write: a read command
 * that could write would be a third writer, reached for by people who believe
 * they are only looking.
 *
 * It sits in its own list rather than in `WRITER_SCRIPTS` because the assertion
 * is the opposite one — not *"writes only its own table"* but *"writes
 * nothing"* — and folding it in would have meant weakening the arm that says
 * a writer's reader can see its writes.
 */
const READER_SCRIPTS = ["scripts/crew-shift-state.mts"] as const;

/** Kept for the arms that ask about the shift-run road specifically. */
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
 * Tables a shift may READ but must never WRITE — the founder's own half of the
 * store.
 *
 * ⚠ `crew_work_switches` is the sharpest entry this file has ever had, and the
 * reason is worth stating: **a shift that could write his switches could switch
 * its own permission on.** The whole point of #277 is that background work is
 * opt-in and the switch is HIS. So the shift-side reader
 * (`scripts/crew-work-switches.mts`) and the gate inside
 * `crew-shift-start.mts` both SELECT from it, which is allowed and necessary,
 * and any INSERT/UPDATE/DELETE aimed at it is a breach.
 *
 * This is the same relationship shifts have with `crew_replies` — except that
 * one is enforced by the table never appearing in their code at all, and this
 * one has to permit the read. Hence a second list rather than a wider first one.
 */
const READ_ONLY_TABLES = ["crew_work_switches"] as const;

/**
 * The only things an INSERT / UPDATE / DELETE in these scripts may target.
 *
 * `TABLE` is the `const TABLE = "crew_shift_runs"` both writers interpolate —
 * the indirection is pinned by its own arm below, so the allowance cannot be
 * used to smuggle a different table through a renamed constant.
 */
const ALLOWED_WRITE_TARGETS = ["crew_shift_runs", "crew_queue_counts", "TABLE"] as const;

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

    ⚠ AND THE `UPDATE` PATTERN CARRIES A NEGATIVE LOOKBEHIND FOR
    `ON DUPLICATE KEY `, WHICH IS NOT A CONVENIENCE. MySQL's upsert ends
    `... ON DUPLICATE KEY UPDATE openCount = VALUES(openCount)`, so a bare
    \bUPDATE\s+(\w+) reads the COLUMN NAME as a table and reported
    `crew-count-queue.mts` as writing a table called `openCount`. Left
    unhandled, the only ways to green are to widen the allowlist with a column
    name — which would blind the arm to a genuine second table — or to stop
    using upserts. Both are the tail wagging the dog.

    The lookbehind is itself controlled below: a real `UPDATE <table>` in the
    same file must still be found.
  */
  const patterns = [
    /\bINSERT\s+INTO\s+[`'"\\\s]*\$?\{?\s*([A-Za-z_][\w]*)/gi,
    /(?<!ON DUPLICATE KEY )\bUPDATE\s+[`'"\\\s]*\$?\{?\s*([A-Za-z_][\w]*)/gi,
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
  it.each(WRITER_SCRIPTS)("$path binds its table constant to its own table", ({ path, table }) => {
    /* The indirection `ALLOWED_WRITE_TARGETS` permits is pinned here, so a
       renamed constant cannot carry a different table through the arm below —
       and it is pinned PER SCRIPT, so the counter cannot borrow the shift-run
       road's allowance. */
    expect(sourceOf(path)).toContain(`const TABLE = "${table}"`);
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
  it.each(WRITER_SCRIPTS)("$path — the reader can SEE this script's writes", ({ path }) => {
    expect(writeTargetsIn(sourceOf(path)).length).toBeGreaterThan(0);
  });

  it("the start script inserts, and the close script updates", () => {
    expect(writeTargetsIn(sourceOf("scripts/crew-shift-start.mts"))).toContain("TABLE");
    expect(stripComments(sourceOf("scripts/crew-shift-start.mts"))).toMatch(/\bINSERT\s+INTO\b/i);
    expect(stripComments(sourceOf("scripts/crew-shift-close.mts"))).toMatch(/\bUPDATE\b/i);
  });

  it.each(WRITER_SCRIPTS)("$path writes to no table but its own", ({ path }) => {
    const stray = writeTargetsIn(sourceOf(path))
      .filter((target) => !ALLOWED_WRITE_TARGETS.includes(target as (typeof ALLOWED_WRITE_TARGETS)[number]));
    expect(stray).toEqual([]);
  });

  it.each(WRITER_SCRIPTS)("$path never names the founder's own half in code", ({ path }) => {
    expect(forbiddenTablesInCode(sourceOf(path))).toEqual([]);
  });

  it.each(WRITER_SCRIPTS)("$path issues no DDL and never DELETEs", ({ path }) => {
    expect(forbiddenStatementsIn(sourceOf(path))).toEqual([]);
  });

  /*
    ⚠ THE #277 ARM, AND THE ONE THAT MATTERS MOST ON THIS PAGE: a shift that
    could write his switches could switch its own permission on. Reading is
    allowed and necessary — the gate inside `crew-shift-start.mts` SELECTs from
    it — so this asks about WRITES specifically rather than banning the name.
  */
  it.each([...WRITER_SCRIPTS.map((w) => w.path), "scripts/crew-work-switches.mts"])(
    "%s never WRITES a founder-owned, read-only table",
    (path) => {
      const targets = writeTargetsIn(sourceOf(path));
      for (const table of READ_ONLY_TABLES) expect(targets).not.toContain(table);
    },
  );

  /*
    And the shift-side switch reader is read-only WHOLE — no writes at all, the
    same property `crew-read-replies.mts` states about his replies.
  */
  it("the switch reader never writes anything", () => {
    const source = sourceOf("scripts/crew-work-switches.mts");
    expect(source).toContain("crew_work_switches");
    expect(writeTargetsIn(source)).toEqual([]);
    expect(forbiddenStatementsIn(source)).toEqual([]);
  });

  /*
    ⚠ THE SHIFT READER WRITES NOTHING AT ALL (#288) — not "writes only its own
    table", which is the writers' bar. This one's whole reason for existing is
    that an operator can run it while wanting to look, so a write inside it
    would be reached for by exactly the people least expecting one.
  */
  it.each(READER_SCRIPTS)("%s reads the shift runs and writes nothing", (path) => {
    const source = sourceOf(path);
    expect(source).toContain(OWN_TABLE);
    expect(writeTargetsIn(source)).toEqual([]);
    expect(forbiddenStatementsIn(source)).toEqual([]);
    expect(forbiddenTablesInCode(source)).toEqual([]);
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

  /*
    THE LOOKBEHIND'S OWN CONTROL. It exists to stop `ON DUPLICATE KEY UPDATE
    <column>` reading as a table — and it must not, in doing so, hide a real
    UPDATE that happens to sit in a file containing an upsert.
  */
  it("the ON DUPLICATE KEY lookbehind hides the column and NOT a real UPDATE", () => {
    const upsertOnly = "await conn.query(`INSERT INTO `x` (a) VALUES (?) ON DUPLICATE KEY UPDATE a = VALUES(a)`);";
    expect(writeTargetsIn(upsertOnly)).not.toContain("a");
    expect(writeTargetsIn(upsertOnly)).toContain("x");

    const both = `${upsertOnly}
await conn.query("UPDATE crew_replies SET body = 'x'");`;
    expect(writeTargetsIn(both)).toContain("crew_replies");
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

  /*
    THE READER'S OWN CONTROL. `expect(writeTargetsIn(source)).toEqual([])` is
    green on a file with no SQL in it at all — including a `crew-shift-state`
    that was gutted, renamed or never really read the table. So the arm above is
    driven twice: once against a doctored copy carrying a write (must be seen),
    and once against the real file asserting it genuinely SELECTs.
  */
  it.each(READER_SCRIPTS)("catches a write smuggled into %s", (path) => {
    const doctored = `${sourceOf(path)}
await conn.query("UPDATE crew_shift_runs SET outcome = 'shipped'");
`;
    expect(writeTargetsIn(doctored)).toContain("crew_shift_runs");
    expect(writeTargetsIn(sourceOf(path))).toEqual([]);
    expect(stripComments(sourceOf(path))).toMatch(/\bSELECT\b/i);
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
    for (const script of WRITER_SCRIPTS) expect(sourceOf(script.path).length).toBeGreaterThan(500);
  });
});
