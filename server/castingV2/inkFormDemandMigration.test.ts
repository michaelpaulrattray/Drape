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
 * commit's schema half is deliberately absent. The three-way arm (drizzle
 * object, migration text, database) lands in the sitting that adds the column,
 * after production has taken the ceremony. **A gap stated is a gap; a gap
 * skipped is a trap** (fable-1343 §3).
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

  it("⚠ the SCHEMA HALF IS DELIBERATELY ABSENT until production has taken the ceremony", () => {
    /*
      0051's rule, one table over. Replace this arm with the three-way arm
      (drizzle object vs migration text vs database) in the sitting that adds the
      column — DO NOT simply remove it.
    */
    expect(Object.keys(castingInkFormDemand)).not.toContain("pathAtRefusal");
    for (const appended of APPENDED) {
      expect(
        [...INK_FORM_DEMAND_KINDS],
        `${appended} must not reach the code until the ceremony has run in both worlds`,
      ).not.toContain(appended);
    }
    /* And the existing vocabulary is untouched by the staging — a pin that
       passed because the whole constant had been emptied would be no pin. */
    expect([...INK_FORM_DEMAND_KINDS]).toEqual([...EXISTING]);
    expect([...INK_FORM_DEMAND_OUTCOMES]).toEqual(["refused", "delivered"]);
  });
});
