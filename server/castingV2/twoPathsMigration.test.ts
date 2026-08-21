/**
 * THE TWO PATHS' MIGRATION — the part that can be proven before the ceremony.
 *
 * The `*Schema.test.ts` family in this folder compares THREE things: the drizzle
 * object, the migration text, and — at the ceremony — what the database
 * accepted. **Two of the three are unavailable to this file by design, and
 * saying so is the point of the docblock.**
 *
 * `casting_rolls` is a table the whole studio already SELECTs, and drizzle names
 * its columns in the statement. So the moment `drizzle/schema.ts` gains these
 * two, every read of that table in the product asks for them — flag or no flag.
 * Against a production database that has not taken migration 0051 that is not a
 * dark landing; it is roll history failing to load for everybody. Hence the
 * order (design §3.2): **ceremony → code lands dark → court → his eyes → flip**,
 * and hence a commit whose schema half is deliberately absent.
 *
 * What is left is the migration TEXT, and it happens to be where the one failure
 * that could go quiet lives:
 *
 * **A DEFAULT would be a permanent, silent loss.** `NULL` on these columns means
 * *cast before the paths existed*. MySQL fills every existing row with a
 * column's DEFAULT when one is given, so `NULL DEFAULT 'wardrobe'` would stamp
 * all 44 dev rolls and every production roll with a claim that they were cast on
 * a path that did not exist when they were cast — and there is no repair
 * afterwards, because the distinction it destroys is the only evidence of which
 * rolls predate the feature. Nothing about the resulting table looks unhealthy.
 *
 * The three-way arm — drizzle object, text, database — lands in the sitting that
 * adds the columns to `drizzle/schema.ts`, after production has taken the
 * ceremony. A gap stated is a gap; a gap skipped is a trap (fable-1343 §3).
 *
 * ✅ **THAT SITTING IS THIS ONE (2026-08-22).** Production took the ceremony on
 * his word (fable-1356 §2: `rows: 206 · path set on 0 · line set on 0`), the
 * schema half has landed, and the three-way arm is at the foot of this file.
 * Everything above stays exactly as it was written, because it is the argument
 * for the STAGING and the staging happened — what changed is the tense. The one
 * arm that had to go is the absence pin, and it went where its own comment sent
 * it rather than into a deletion: *"replace it with the three-way arm; do not
 * simply remove it."*
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { CASTING_ROLL_STATUSES, castingRolls, type CastingRoll } from "../../drizzle/schema";
import { CASTING_PATHS, WARDROBE_LINE_MAX_LENGTH, type CastingPath } from "../../shared/castingPaths";
import { effectiveColumn } from "../testing/migrationColumns";

const MIGRATION_PATH = "drizzle/0051_casting_rolls_two_paths.sql";

const MIGRATION = readFileSync(new URL(`../../${MIGRATION_PATH}`, import.meta.url), "utf8");
const CEREMONY = readFileSync(new URL("../../scripts/ceremony-two-paths.mts", import.meta.url), "utf8");

/** The statements alone, split the way `replayMigration` splits them. */
const STATEMENTS = MIGRATION.split("--> statement-breakpoint")
  .map((statement) =>
    statement
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n")
      .trim())
  .filter(Boolean);

/**
 * The statement that adds one named column.
 *
 * Each arm below reads only the statements it is about, so a foreign statement
 * appearing in this file reddens the arm whose subject that IS — *adds exactly
 * two columns and nothing else* — and reddens nothing else. Driven: an added
 * `DROP INDEX` first took two arms down, and an arm that moves for another
 * arm's defect cannot tell you which defect you have.
 */
function addColumn(name: string): string {
  const found = STATEMENTS.filter((statement) => statement.includes(`\`${name}\``));
  expect(found, `no single statement adds \`${name}\``).toHaveLength(1);
  return found[0];
}

describe("migration 0051 — the two paths", () => {
  it("adds exactly two columns to `casting_rolls`, and nothing else", () => {
    /*
      PURELY ADDITIVE is the claim the design makes to justify landing this
      ahead of the code, so it is asserted rather than described: no DROP, no
      MODIFY, no index, no UPDATE. A migration that also re-typed a column would
      be a different risk arriving under this one's approval.
    */
    expect(STATEMENTS).toHaveLength(2);
    for (const statement of STATEMENTS) {
      expect(statement).toContain("ALTER TABLE `casting_rolls` ADD COLUMN");
      expect(statement).not.toMatch(/\b(DROP|MODIFY|CHANGE|RENAME|UPDATE|DELETE)\b/i);
    }
    expect(STATEMENTS[0]).toContain("`path`");
    expect(STATEMENTS[1]).toContain("`wardrobeLine`");
  });

  it("carries NEITHER a DEFAULT NOR a NOT NULL on either column", () => {
    /*
      The one failure a text arm can actually catch, and the one whose cost is
      unrecoverable — see the docblock. `NOT NULL` is refused for the same
      reason from the other side: a roll cast before the paths existed has no
      honest value to hold, and MySQL's answer to a NOT NULL column added to a
      populated table is to invent one.
    */
    for (const column of ["path", "wardrobeLine"]) {
      const statement = addColumn(column);
      expect(statement).not.toMatch(/\bDEFAULT\b/i);
      expect(statement).not.toMatch(/\bNOT\s+NULL\b/i);
      expect(statement).toMatch(/\bNULL\s*;?\s*$/i);
    }
  });

  it("spells `path` as a closed, code-owned enum of his two words", () => {
    /*
      An enum here is NOT 0046 repeated. That migration widened two placement
      columns enum → varchar on the ground that the value is A CUSTOMER'S OWN
      WORD on a vocabulary nobody can enumerate; this value is code-owned and
      closed by his ruling, the same kind as `status` on this very table. Under
      `STRICT_TRANS_TABLES` the fence is the feature: a third path arriving
      without a migration ERRORS rather than being written as a word no reader
      handles.

      Pinned as literals rather than against a shared constant because no code
      names these words yet — the coupling arm, in `inkPlacementCoupling.test.ts`'s
      shape, lands with `drizzle/schema.ts`.
    */
    expect(addColumn("path")).toContain("enum('wardrobe','basics')");
    expect(addColumn("wardrobeLine")).toContain("varchar(240)");
  });

  it("is the file the ceremony actually replays", () => {
    /* A renamed migration with a ceremony still pointing at the old name fails
       at the founder's keyboard, in the one sitting nobody wants a surprise in. */
    expect(CEREMONY).toContain(MIGRATION_PATH);
  });
});

/**
 * THE THREE-WAY ARM — the absence arm's own replacement, landed in the commit
 * its comment named (2026-08-22, after `--production` ran on his word,
 * fable-1356 §2).
 *
 * The retired arm asserted that `drizzle/schema.ts` did NOT name these columns,
 * and it was staging made mechanical: until production had taken 0051, a schema
 * half naming a column the database lacks is not a dark landing, it is roll
 * history failing to load for everybody. Its instruction was explicit —
 * *"replace it with the three-way arm; do not simply remove it"* — because
 * deleting it would have left the two columns as the ONE part of this feature
 * with no pin at all, at the exact moment they became writable.
 *
 * # The three ways, and which instrument holds each
 *
 * ```
 * the drizzle object    read at runtime off `castingRolls` — the thing every
 *                       SELECT in the product is actually built from
 * the migration text    read through `effectiveColumn`, which replays the whole
 *                       SEQUENCE rather than the file that created the column
 * the database          the ceremony's own read-back, quoted below
 * ```
 *
 * **The third leg is a quoted fact and not a live read, and that is stated
 * rather than papered over.** `vitest.setup.ts` strips `DATABASE_URL` on
 * purpose, so a suite here cannot ask the real database anything; an arm gated
 * on `TEST_DATABASE_URL` would skip on every machine that runs this suite,
 * which is a control that cannot fire wearing a control's name. What holds that
 * leg is `scripts/ceremony-two-paths.mts` — idempotent, re-runnable, and it
 * asserts the read-back itself:
 *
 * ```
 * dev  2026-08-22   path enum('wardrobe','basics') NULL no default ·
 *                   wardrobeLine varchar(240) NULL no default ·
 *                   rows: 44 · path set on 0 · line set on 0
 * prod 2026-08-22   path enum('wardrobe','basics') NULL no default ·
 *                   wardrobeLine varchar(240) NULL no default ·
 *                   rows: 206 · path set on 0 · line set on 0
 * ```
 *
 * # Why `status` appears in a suite about two other columns
 *
 * As the NEGATIVE CONTROL, and it is not decoration. Every assertion below is
 * of the form *this column has no NOT NULL and no DEFAULT* — a shape that
 * passes for free if the property being read is undefined, misspelled, or a
 * field drizzle stopped populating. `status` sits in the same table with both
 * of those true, so the reader is made to say so out loud in the same arm. An
 * absent reading is not a neutral omission; it reads as a green one.
 */
describe("the two columns, checked three ways rather than trusted once", () => {
  const pathColumn = castingRolls.path;
  const lineColumn = castingRolls.wardrobeLine;

  it("reads column metadata at all — `status` proves the instrument can say NO", () => {
    /*
      The positive control for the reader itself. If `notNull`/`hasDefault` were
      undefined on a drizzle column, every arm below would pass while asserting
      nothing whatever about the two columns it names.
    */
    expect(castingRolls.status.notNull).toBe(true);
    expect(castingRolls.status.hasDefault).toBe(true);
    expect(castingRolls.status.enumValues).toEqual([...CASTING_ROLL_STATUSES]);
  });

  it("the drizzle object leaves both columns nullable and undefaulted", () => {
    /*
      This is the half the migration text arm above cannot see. The DDL and the
      drizzle object are two independent claims about one column, and it is the
      drizzle object that decides what the product WRITES: `.notNull()` here
      over a nullable column is a runtime insert failure, and `.default()` here
      is a value invented by the ORM for rolls nobody asked about — the same
      permanent loss the migration refuses, arriving through the other door.
    */
    for (const column of [pathColumn, lineColumn]) {
      expect(column.notNull).toBe(false);
      expect(column.hasDefault).toBe(false);
    }
  });

  it("spells the same two words in the object, the constant and the DDL", () => {
    /*
      The coupling arm, in `inkPlacementCoupling.test.ts`'s shape and for its
      reason: two narrowings that are each true only because the other is. The
      migration's own comment deferred this — *"pinned as literals rather than
      against a shared constant because no code names these words yet"* — and
      code names them now, so the deferral is discharged here rather than left
      as the drift it was predicting.

      Three spellings compared pairwise, not all against the constant: a rename
      that moved only two of the three is exactly what this catches.
    */
    expect(pathColumn.enumValues).toEqual([...CASTING_PATHS]);
    expect(enumMembersOfEffective("path")).toEqual([...CASTING_PATHS]);
    /* And the literals stay, because a coordinated rename of all three would
       pass every assertion above while silently replacing his two words. */
    expect([...CASTING_PATHS]).toEqual(["wardrobe", "basics"]);
  });

  it("agrees with the DDL on the line's width, read through the whole sequence", () => {
    /*
      `effectiveColumn` rather than this migration's own text, deliberately: a
      later `MODIFY` is part of what the column IS, and a reader that stops at
      the statement which created it is reading history and reporting the
      present. That is the exact failure `server/testing/migrationColumns.ts`
      was written after — two ink suites asserting a fence 0046 had removed.
    */
    /*
      `length` is on the varchar column at runtime and NOT on drizzle's public
      type, so it is reached through a named cast rather than an inline `as any`
      — the cast is the claim being made, and it should be readable as one. If a
      drizzle upgrade ever stops populating it this reads `undefined` and the
      arm goes red, which is the correct direction for a pin to fail.
    */
    const varcharLength = (lineColumn as unknown as { length?: number }).length;
    expect(varcharLength).toBe(WARDROBE_LINE_MAX_LENGTH);
    expect(effectiveColumn("casting_rolls", "wardrobeLine"))
      .toBe(`varchar(${WARDROBE_LINE_MAX_LENGTH}) NULL`);
    expect(effectiveColumn("casting_rolls", "path"))
      .toBe(`enum(${CASTING_PATHS.map((value) => `'${value}'`).join(",")}) NULL`);
  });
});

/** The enum members of a column's EFFECTIVE DDL, after every migration. */
function enumMembersOfEffective(column: string): string[] {
  const ddl = effectiveColumn("casting_rolls", column);
  const match = /enum\(([^)]*)\)/.exec(ddl ?? "");
  expect(match, `\`${column}\` is not an enum in the effective DDL`).not.toBeNull();
  return match![1]!.split(",").map((value) => value.trim().replace(/^'|'$/g, ""));
}

/*
  THE TYPE ARM — mutual assignability, which is type equality written twice.

  It fails under `pnpm check` and vitest cannot see it, which is why it sits
  beside arms that fail the other way round. Narrow the column past the
  vocabulary, or widen it to `string`, and one of these two stops compiling on
  the commit that did it.

  `| null` is part of the claim rather than an inconvenience worked around: the
  absence is not a member (`shared/castingPaths.ts`), so a row's path is
  honestly `CastingPath | null` and any reader that has to spell that is a
  reader being told there is a question here it must answer.
*/
const _rowPathIsTheVocabulary: CastingPath | null = null as unknown as CastingRoll["path"];
const _vocabularyIsTheRowPath: CastingRoll["path"] = null as unknown as CastingPath | null;
void _rowPathIsTheVocabulary;
void _vocabularyIsTheRowPath;
