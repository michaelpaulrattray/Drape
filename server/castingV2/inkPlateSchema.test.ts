import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { INK_TEMPLATE_KINDS } from "../../shared/inkTemplateKinds";

/**
 * THE PLATE TABLE'S DDL, CHECKED AGAINST THE THINGS IT IS A COPY OF.
 *
 * `drizzle/schema.ts` derives `templateKind` from the TypeScript constant, so
 * the drift this guards is in the hand-written migration beside it: a SQL enum
 * typed out by a person is a parallel copy of a source of truth (working law 4),
 * and the drift would be silent until a value nobody spelled the same way was
 * rejected by the database.
 *
 * The rest of this file pins the CONDITIONS the table carries — the ones that
 * are decisions rather than columns, and that a later edit could undo without
 * anything else noticing.
 */
const MIGRATION = readFileSync(
  path.resolve(__dirname, "../../drizzle/0037_casting_ink_plates.sql"),
  "utf8",
);

/**
 * The statements with every comment stripped.
 *
 * The prose in this migration EXPLAINS the decisions — including the ones about
 * columns that deliberately do not exist — so a test that searched the whole
 * file would be reading the argument for a column as evidence of the column.
 * That is the "assert at the wire" habit one layer down: what the database is
 * told is the DDL, not the reasoning above it.
 */
/**
 * The prompt digest's own migration (0038), read the same way.
 *
 * A separate file because it is a separate landing: 0037 creates the table and
 * this alters it, and the ordering is what the ceremony script asserts.
 */
const ALTER = readFileSync(
  path.resolve(__dirname, "../../drizzle/0038_casting_ink_plate_prompt_digest.sql"),
  "utf8",
)
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith("--"))
  .join(" ");

const DDL = MIGRATION
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith("--"))
  .join(" ");

function enumMembers(column: string): string[] {
  const match = new RegExp(`\`${column}\` enum\\(([^)]*)\\)`).exec(MIGRATION);
  if (!match) throw new Error(`no enum column \`${column}\` in the migration`);
  return match[1]!.split(",").map((value) => value.trim().replace(/^'|'$/g, ""));
}

describe("the plate table's enum matches the vocabulary it came from", () => {
  it("templateKind is exactly the blank forms that exist", () => {
    expect(enumMembers("templateKind")).toEqual([...INK_TEMPLATE_KINDS]);
  });

  it("finds a real column rather than passing on a typo", () => {
    /* The control: the reader above answers nothing at all for a column name
       that does not exist, and a test that cannot fail on a misspelling is a
       test of its own regex. */
    expect(() => enumMembers("templateKid")).toThrow(/no enum column/);
  });
});

describe("the conditions this table carries, asserted in its own text", () => {
  it("keeps the engine as a string, so recording a court's LOSER needs no migration", () => {
    /*
      The court's whole job is to compare two engines. An enum would have to be
      migrated to file the specimen that lost, which is exactly the row somebody
      would then not file.
    */
    expect(MIGRATION).toMatch(/`engine` varchar\(\d+\) NOT NULL/);
    expect(MIGRATION).not.toMatch(/`engine` enum/);
  });

  it("is unique per (design, engine) rather than per design", () => {
    /*
      One design plated on BOTH engines is two legal rows — that is the court.
      A unique key on `designId` alone would make the court unbuildable, and no
      unique key at all would make `alreadyPlated` exact only in the comments.
    */
    const unique = /CREATE UNIQUE INDEX `uq_casting_ink_plates_design_engine` ON `casting_ink_plates` \(`designId`,`engine`\)/;
    expect(MIGRATION).toMatch(unique);
  });

  it("holds our own copy of the bytes and says so", () => {
    expect(MIGRATION).toMatch(/`storageKey` varchar\(\d+\) NOT NULL/);
    expect(MIGRATION).toMatch(/`digest` varchar\(64\) NOT NULL/);
  });

  it("records the template digest, so a plate says which artwork it stands on", () => {
    /*
      The suite's pin protects every plate minted AFTER a swap and says nothing
      about the ones minted before — and a plate persists and is shown to an
      engine on every later render. On the row, that is a query rather than an
      eye.
    */
    expect(MIGRATION).toMatch(/`templateDigest` varchar\(64\) NOT NULL/);
  });

  it("records the PROMPT digest too, because the words moved once already", () => {
    /*
      The other half of the input, added by migration 0038 after the wrap court
      (2026-08-18). The plate prompt described a one-view form while every
      committed template is a turnaround, and the two plates minted either side
      of the rewrite are indistinguishable in the table: same design, same
      engine, same template digest, wildly different pictures.

      NULLABLE deliberately — the rows minted before the column existed have no
      honest value, and a backfill would have guessed which words they stood on.
      Asserted as the ABSENCE of NOT NULL rather than trusted, with a positive
      control beside it so the absence is an absence in the DDL.
    */
    expect(ALTER).toMatch(/`promptDigest` varchar\(64\)/);
    expect(ALTER).not.toMatch(/`promptDigest` varchar\(64\) NOT NULL/);
    /* The control: the file really did load and really does hold the statement,
       so "no NOT NULL" is a reading rather than an empty string. */
    expect(ALTER).toMatch(/ALTER TABLE `casting_ink_plates` ADD `promptDigest`/);
  });

  it("carries NO candidateId, because the sweep reaches it through its design", () => {
    /*
      NOT an omission — the load-bearing half of the retention contract. A
      mirrored parent id is a second source of truth that drifts (law 4), and its
      absence is what fixes the delete order as plates-then-designs. If a later
      edit adds the column for convenience, this reddens and the order assertion
      in `candidateRetention.test.ts` is the thing to read next.
    */
    expect(DDL).not.toMatch(/`candidateId`/);
    expect(DDL).toMatch(/`designId` int NOT NULL/);
    /* The control: the stripper really did leave the statements behind, so the
       absence above is an absence in the DDL rather than an empty string. */
    expect(DDL).toMatch(/CREATE TABLE `casting_ink_plates`/);
  });

  it("scopes its owner on the row rather than only through a join", () => {
    /* Invariant 1: ownership decided in the statement that reads or writes. */
    expect(MIGRATION).toMatch(/`userId` int NOT NULL/);
  });
});
