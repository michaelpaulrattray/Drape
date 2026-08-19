import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { INK_PLACEMENTS } from "../../shared/inkPlacementVocabulary";
import { INK_FORM_DEMAND_KINDS, INK_FORM_DEMAND_OUTCOMES } from "../../shared/inkFormDemand";
import { effectiveColumn, effectiveEnumMembers } from "../testing/migrationColumns";

/**
 * THE MISSING-FORM DEMAND TABLE'S DDL, CHECKED AGAINST WHAT IT IS A COPY OF.
 *
 * `drizzle/schema.ts` derives all three enums from TypeScript constants, so the
 * drift this guards is in the hand-written migration beside it: a SQL enum typed
 * out by a person is a parallel copy of a source of truth (working law 4), and
 * the drift is silent until MySQL truncates a value nobody spelled the same way
 * to the empty string.
 *
 * The second half is the one that matters more. **This table's short column list
 * IS its privacy boundary** — the refusal it counts is about a Cast's BUILD, so
 * an attributed row would hand one bit of that Cast's `technicalSchema` to every
 * staff member who can read it. A column added here later, for the best of
 * reasons, undoes the whole argument for the table existing. So the absence is
 * asserted rather than explained.
 */
const MIGRATION = readFileSync(
  path.resolve(__dirname, "../../drizzle/0041_casting_ink_form_demand.sql"),
  "utf8",
);

/**
 * The statements with every comment stripped.
 *
 * The prose in this migration explains the decision — INCLUDING the columns that
 * deliberately do not exist, by name — so a test that searched the whole file
 * would read the argument against a column as evidence of the column.
 */
const DDL = MIGRATION
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith("--"))
  .join(" ");

/**
 * The members a column accepts AFTER EVERY MIGRATION, not after the one that
 * created it.
 *
 * This read `DDL` — 0041 alone — and that is exactly the reading 0046
 * falsified for `placement`. `kind` and `outcome` are unaltered today, so
 * pointing them at the sequence changes no answer now; it changes what happens
 * the day one of them IS altered, which is the only day the difference could
 * ever matter.
 *
 * `DDL` stays for the arms about this table's PRIVACY BOUNDARY — the columns
 * that deliberately do not exist — which is a fact about 0041's own text and
 * not about a column's shape.
 */
function enumMembers(column: string): string[] {
  return effectiveEnumMembers("casting_ink_form_demand", column);
}

describe("the missing-form demand table matches the vocabularies it came from", () => {
  it("kind is exactly the two reasons a torso form can be absent", () => {
    expect(enumMembers("kind")).toEqual([...INK_FORM_DEMAND_KINDS]);
  });

  it("placement is OPEN, because this counter's whole job is to record the ask", () => {
    /*
      IT WAS THE WHOLE INK VOCABULARY AND THIS ARM SAID SO. Migration 0046
      opened it to `varchar(64)`, and the reason is this table's own sentence in
      fable-1078: it *"keeps counting placements as information, never as
      refusal grounds."*

      A closed column made that impossible in the quietest way available. The
      writer here CATCHES ITS OWN FAILURE by design — a missing table costs the
      tally and never a customer's answer — so a placement the column could not
      hold was not an error anyone would see. It was dropped into a `catch`, and
      the counter went on reading healthy while counting nothing, on exactly the
      asks it exists to hear about.

      Read from the migration SEQUENCE, not from 0041: pointed at the CREATE,
      this arm would still be green and still be wrong.
    */
    expect(effectiveColumn("casting_ink_form_demand", "placement")).toBe("varchar(64) NOT NULL");
    expect(INK_PLACEMENTS).toEqual(["neck", "upperArm", "upperChest"]);
  });

  it("outcome keeps room for the day the third form ships", () => {
    /* Only `refused` is reachable today. `delivered` is what makes these rows
       still answer a question after the form exists, instead of needing a
       migration to answer the one they were built for. */
    expect(enumMembers("outcome")).toEqual([...INK_FORM_DEMAND_OUTCOMES]);
    expect(INK_FORM_DEMAND_OUTCOMES).toContain("delivered");
  });

  it("finds a real column rather than passing on a typo", () => {
    /* The control: the reader above answers nothing at all for a column name
       that does not exist, and a test that cannot fail on a misspelling is a
       test of its own regex. */
    expect(() => enumMembers("placemnet")).toThrow(/does not exist after the migrations/);
  });
});

describe("the column list, which is the privacy boundary", () => {
  it("carries no account, no cast, no design and no key", () => {
    /*
      Absent from the ROW, not omitted from a projection (invariant 8). This
      table is built to be read by staff, and the fact it records is a fact
      about somebody's body — so there must be nobody to attribute it to.
    */
    for (const forbidden of ["userId", "candidateId", "designId", "storageKey", "instruction", "sex"]) {
      expect(DDL, `\`${forbidden}\` must not be a column here`)
        .not.toMatch(new RegExp(`\`${forbidden}\``));
    }
  });

  it("can actually SEE a column — the control on the line above", () => {
    /* Without this, the absence test passes just as happily against an empty
       string, a mis-read file, or a regex that matches nothing. */
    for (const present of ["kind", "placement", "outcome", "createdAt"]) {
      expect(DDL).toMatch(new RegExp(`\`${present}\``));
    }
  });

  it("names those columns in its own reasoning, which is why the reader strips comments", () => {
    /* The prose above the DDL argues about `userId` by name. If the reader ever
       stops stripping comments, the absence test above starts failing for a
       reason that has nothing to do with the table — so the trap is pinned. */
    expect(MIGRATION).toMatch(/userId/);
  });
});
