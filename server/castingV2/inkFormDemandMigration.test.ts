/**
 * THE TALLY'S WIDENING — the part that can be proven before the ceremony
 * (migration 0052, design `CASTING_V2_TWO_PATHS_DESIGN.md` §9, countersigned
 * fable-1334 question 2).
 *
 * This file is `twoPathsMigration.test.ts` one table over, and it is staged for
 * the same reason: `pathAtRefusal` is a new column on a table the code READS, so
 * the moment `drizzle/schema.ts` names it, every read of
 * `casting_ink_form_demand` asks for it — flag or no flag. Against a database
 * that has not taken 0052 that is an error on the one table somebody reads a
 * demand signal out of.
 *
 * So: **ceremony → the schema and the writer land dark → the flip**, and this
 * commit's schema half was deliberately absent. The three-way arm (drizzle
 * object, migration text, database) lands in the sitting that adds the column,
 * after production has taken the ceremony. **A gap stated is a gap; a gap
 * skipped is a trap** (fable-1343 §3).
 *
 * ✅ **THAT SITTING IS THIS ONE (2026-08-23).** Production took the ceremony on
 * his word (relayed fable-1458), and it was read back at `information_schema`
 * in BOTH worlds before a line of the schema half moved — not taken from the
 * ceremony's own report, because a report is a claim and the columns are the
 * fact:
 *
 * ```
 * PRODUCTION  hayabusa.proxy.rlwy.net:23768/railway
 *   kind          enum('torsoNonbinary','torsoUnstated','surfaceCovered','surfaceCoverageUnread') NOT NULL
 *   pathAtRefusal enum('wardrobe','basics') NULL          rows: 0
 * DEV         hayabusa.proxy.rlwy.net:52008/railway
 *   kind          enum('torsoNonbinary','torsoUnstated','surfaceCovered','surfaceCoverageUnread') NOT NULL
 *   pathAtRefusal enum('wardrobe','basics') NULL          rows: 0
 * ```
 *
 * `rows: 0` in both is what says the enum widening rewrote nothing, which is a
 * claim the migration makes about itself and is checked here from outside it.
 *
 * Everything above stays exactly as it was written, because it is the argument
 * for the STAGING and the staging happened — what changed is the tense. The one
 * arm that had to go is the absence pin, and it went where its own comment sent
 * it rather than into a deletion: *"replace this arm with the three-way arm — DO
 * NOT simply remove it."*
 *
 * # What is left is the migration TEXT, and it is where the quiet failures live
 *
 * TWO of them, and one is unique to this migration:
 *
 * **An enum's ORDER is its data.** MySQL stores an enum as an INDEX, not as the
 * word, so appending members is safe and reordering or renaming them rewrites
 * what every stored row MEANS with no error anywhere. This is the only migration
 * in the folder that MODIFIES an existing enum, and a version of it listing the
 * four members alphabetically would turn every `torsoUnstated` row into
 * `surfaceCovered` silently.
 *
 * **A DEFAULT on `pathAtRefusal` would be a permanent stamp.** Every row that
 * exists is a torso-form refusal from before the paths existed; MySQL fills
 * every existing row with a column's default when one is given.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { INK_FORM_DEMAND_KINDS, INK_FORM_DEMAND_OUTCOMES } from "../../shared/inkFormDemand";
import { castingInkFormDemand } from "../../drizzle/schema";
import { CASTING_PATHS } from "../../shared/castingPaths";
import { effectiveColumn } from "../testing/migrationColumns";

const MIGRATION_PATH = "drizzle/0052_ink_form_demand_paths.sql";
const MIGRATION = readFileSync(new URL(`../../${MIGRATION_PATH}`, import.meta.url), "utf8");
/** The statements, with the file's own reasoning stripped off. */
const SQL = MIGRATION.split(/\r?\n/).filter((line) => !line.trim().startsWith("--")).join("\n");

/** The two members that already exist, in the order they already exist in. */
const EXISTING = ["torsoNonbinary", "torsoUnstated"] as const;
/** The two this migration appends. */
const APPENDED = ["surfaceCovered", "surfaceCoverageUnread"] as const;

describe("the tally's widening, before the ceremony", () => {
  it("⚠ APPENDS the two new kinds and leaves the existing two FIRST, in order", () => {
    /*
      The assertion that protects data already stored. An enum is an index in
      MySQL, so this is not style: put the four members in any other order and
      every historical row silently changes meaning.
    */
    const enumClause = /MODIFY COLUMN `kind` enum\(([^)]*)\)/.exec(SQL);
    expect(enumClause, "the migration must MODIFY `kind`").not.toBeNull();
    const members = enumClause![1]!.split(",").map((one) => one.trim().replace(/^'|'$/g, ""));
    expect(members.slice(0, EXISTING.length)).toEqual([...EXISTING]);
    expect(members).toEqual([...EXISTING, ...APPENDED]);
  });

  it("keeps `kind` NOT NULL — a demand row with no kind counts nothing", () => {
    expect(SQL).toMatch(/MODIFY COLUMN `kind` enum\([^)]*\) NOT NULL/);
  });

  it("⚠ adds `pathAtRefusal` with NO DEFAULT — a default stamps every historical refusal", () => {
    /*
      Every row that exists today is a torso-form refusal on a cast with no path,
      and MySQL fills every existing row with a column's default. `NULL DEFAULT
      'wardrobe'` would claim they all happened on a path that did not exist.
    */
    expect(SQL).toContain("ADD COLUMN `pathAtRefusal` enum('wardrobe','basics') NULL");
    expect(SQL).not.toMatch(/pathAtRefusal[^;]*DEFAULT/i);
  });

  it("names the two paths the product declares, never a third spelling", () => {
    for (const path of CASTING_PATHS) expect(SQL).toContain(`'${path}'`);
    const pathClause = /ADD COLUMN `pathAtRefusal` enum\(([^)]*)\)/.exec(SQL);
    const members = pathClause![1]!.split(",").map((one) => one.trim().replace(/^'|'$/g, ""));
    expect(members).toEqual([...CASTING_PATHS]);
  });

  it("is PURELY ADDITIVE — nothing dropped, nothing renamed, no row rewritten", () => {
    expect(SQL).not.toMatch(/\bDROP\b/i);
    expect(SQL).not.toMatch(/\bRENAME\b/i);
    expect(SQL).not.toMatch(/\bUPDATE\b/i);
    expect(SQL).not.toMatch(/\bDELETE\b/i);
  });

  it("the migration text, the code's constant and the DDL spell ONE list", () => {
    /*
      THE ARM THE ABSENCE PIN BECAME. It asserted that `INK_FORM_DEMAND_KINDS`
      did NOT carry the two new members and that the drizzle object had no
      `pathAtRefusal`; both are now true the other way round, and deleting it
      would have left the widening as the one part of this feature with no pin
      at all, at the exact moment it became writable.

      Compared PAIRWISE rather than all against the constant: a rename that moved
      only two of the three is exactly what this catches. And a coordinated
      rename of all three would satisfy every derived comparison, which is why
      the four words are written out as literals as well.
    */
    expect([...INK_FORM_DEMAND_KINDS]).toEqual([...EXISTING, ...APPENDED]);
    const enumClause = /MODIFY COLUMN `kind` enum\(([^)]*)\)/.exec(SQL);
    const members = enumClause![1]!.split(",").map((one) => one.trim().replace(/^'|'$/g, ""));
    expect(members).toEqual([...INK_FORM_DEMAND_KINDS]);
    expect([...INK_FORM_DEMAND_KINDS])
      .toEqual(["torsoNonbinary", "torsoUnstated", "surfaceCovered", "surfaceCoverageUnread"]);
    /* And the OUTCOMES are untouched by any of this — said out loud, because a
       widening that quietly moved a neighbouring enum on the same table is the
       whole class this file exists for. */
    expect([...INK_FORM_DEMAND_OUTCOMES]).toEqual(["refused", "delivered"]);
  });
});

/**
 * THE COLUMN ITSELF, CHECKED THREE WAYS RATHER THAN TRUSTED ONCE — 0051's own
 * shape, one table over (`twoPathsMigration.test.ts`).
 *
 * ```
 * the drizzle object    read at runtime off `castingInkFormDemand` — the thing
 *                       every INSERT the product makes is actually built from
 * the migration text    read through `effectiveColumn`, which replays the whole
 *                       SEQUENCE rather than the file that created the column
 * the database          the read-back quoted in this file's header
 * ```
 *
 * **The third leg is a quoted fact and not a live read, and that is stated
 * rather than papered over.** `vitest.setup.ts` strips `DATABASE_URL` on
 * purpose, so a suite here cannot ask the real database anything; an arm gated
 * on `TEST_DATABASE_URL` would skip on every machine that runs this suite,
 * which is a control that cannot fire wearing a control's name.
 *
 * **`createdAt` appears below as the NEGATIVE CONTROL and it is not
 * decoration.** Every assertion here is of the form *this column has no NOT NULL
 * and no DEFAULT* — a shape that passes for free if the property being read is
 * undefined, misspelled, or a field drizzle stopped populating. `createdAt` sits
 * in the same table with both of those true, so the reader is made to say so out
 * loud in the same arm. An absent reading is not a neutral omission; it reads as
 * a green one.
 */
describe("`pathAtRefusal`, checked three ways rather than trusted once", () => {
  const column = castingInkFormDemand.pathAtRefusal;

  it("reads column metadata at all — `createdAt` proves the instrument can say NO", () => {
    expect(castingInkFormDemand.createdAt.notNull).toBe(true);
    expect(castingInkFormDemand.createdAt.hasDefault).toBe(true);
    /* And an enum's members are readable off this object at all, so the
       spelling arm below cannot be passing on a shape it never found. */
    expect(castingInkFormDemand.kind.enumValues).toEqual([...INK_FORM_DEMAND_KINDS]);
  });

  it("the drizzle object leaves it nullable and undefaulted", () => {
    /*
      The half the migration-text arms above cannot see. The DDL and the drizzle
      object are two independent claims about one column, and it is the drizzle
      object that decides what the product WRITES: `.notNull()` here over a
      nullable column is a runtime insert failure on a TELEMETRY path — which
      lands in a `catch` and counts nothing, silently, which is this table's own
      worst failure mode — and `.default()` here is a path claim invented by the
      ORM for a refusal nobody made.
    */
    expect(column.notNull).toBe(false);
    expect(column.hasDefault).toBe(false);
  });

  it("spells the same two words in the object, the constant and the DDL", () => {
    /* Three spellings compared pairwise, and the literals kept, for
       `twoPathsMigration.test.ts`'s reason: a coordinated rename of all three
       would pass every derived comparison while silently replacing his two
       words. */
    expect(column.enumValues).toEqual([...CASTING_PATHS]);
    expect(enumMembersOfEffective("pathAtRefusal")).toEqual([...CASTING_PATHS]);
    expect([...CASTING_PATHS]).toEqual(["wardrobe", "basics"]);
  });

  it("agrees with the DDL read through the whole SEQUENCE, nullability and all", () => {
    /*
      `effectiveColumn` rather than this migration's own text, deliberately: a
      later `MODIFY` is part of what the column IS, and a reader that stops at
      the statement which created it is reading history and reporting the
      present. That is the exact failure `server/testing/migrationColumns.ts`
      was written after.
    */
    expect(effectiveColumn("casting_ink_form_demand", "pathAtRefusal"))
      .toBe(`enum(${CASTING_PATHS.map((value) => `'${value}'`).join(",")}) NULL`);
  });
});

/** The enum members of a column's EFFECTIVE DDL, after every migration. */
function enumMembersOfEffective(column: string): string[] {
  const ddl = effectiveColumn("casting_ink_form_demand", column);
  const match = /enum\(([^)]*)\)/.exec(ddl ?? "");
  expect(match, `\`${column}\` is not an enum in the effective DDL`).not.toBeNull();
  return match![1]!.split(",").map((value) => value.trim().replace(/^'|'$/g, ""));
}
