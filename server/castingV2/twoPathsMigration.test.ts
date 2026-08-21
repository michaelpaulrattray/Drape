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
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const MIGRATION_PATH = "drizzle/0051_casting_rolls_two_paths.sql";

const MIGRATION = readFileSync(new URL(`../../${MIGRATION_PATH}`, import.meta.url), "utf8");
const SCHEMA = readFileSync(new URL("../../drizzle/schema.ts", import.meta.url), "utf8");
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

  it("has NOT reached `drizzle/schema.ts`, and this arm is the staging made mechanical", () => {
    /*
      ⚠ WHEN THIS GOES RED, IT IS PROBABLY RIGHT TO DELETE IT — but only in the
      commit that adds the columns to `drizzle/schema.ts`, and only once
      `npx tsx scripts/ceremony-two-paths.mts --production` has been run on the
      founder's word. Until then a red here means the schema half has overtaken
      the ceremony, which breaks reading rolls for everybody rather than landing
      dark. Replace it with the three-way arm; do not simply remove it.
    */
    expect(SCHEMA).not.toContain("wardrobeLine");
    expect(SCHEMA).not.toMatch(/\bpath:\s*mysqlEnum/);
  });

  it("is the file the ceremony actually replays", () => {
    /* A renamed migration with a ceremony still pointing at the old name fails
       at the founder's keyboard, in the one sitting nobody wants a surprise in. */
    expect(CEREMONY).toContain(MIGRATION_PATH);
  });
});
