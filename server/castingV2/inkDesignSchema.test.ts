import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { INK_PLACEMENTS } from "../../shared/inkPlacementVocabulary";
import { effectiveColumn, effectiveEnumMembers } from "../testing/migrationColumns";
import { INK_SIDES } from "../../shared/inkReleasedPlacements";
import { INK_PROVENANCES } from "../../shared/inkProvenance";

/**
 * THE DDL AND THE VOCABULARY ARE ONE FACT, SO THEY ARE CHECKED AGAINST EACH
 * OTHER RATHER THAN BOTH BEING TRUSTED.
 *
 * `drizzle/schema.ts` derives these columns from the TypeScript constants, so
 * the drift this guards is in the hand-written migration beside it: a SQL enum
 * typed out by a person is a parallel copy of a source of truth (working law 4),
 * and the drift would be silent until a value nobody spelled the same way was
 * rejected by the database at 2 a.m.
 *
 * `casting_open_kind_properties` took the same protection by ceremony — the
 * enum's members read back and compared against `BODY_ANCHOR_REGIONS`. This is
 * that check, moved to where it runs on every commit instead of once.
 */
const MIGRATION = readFileSync(
  path.resolve(__dirname, "../../drizzle/0034_casting_ink_designs.sql"),
  "utf8",
);

/**
 * The members a column accepts AFTER EVERY MIGRATION, not after the one that
 * created it.
 *
 * This read `MIGRATION` — 0034 alone — and that is precisely the reading 0046
 * falsified for `placement`. `side` and `provenance` are unaltered today, so
 * pointing them at the sequence changes no answer now; it changes what happens
 * the day one of them IS altered, which is the only day the difference could
 * ever matter. A pin fixed after it has already failed once is a pin that will
 * fail the same way somewhere else.
 *
 * `MIGRATION` stays for the arms below it, which are about the PROSE and the
 * decisions 0034 recorded rather than about the shape of a column.
 */
function enumMembers(column: string): string[] {
  return effectiveEnumMembers("casting_ink_designs", column);
}

describe("the ink design table's enums match the vocabularies they came from", () => {
  it("placement is OPEN, and the vocabulary is no longer its fence", () => {
    /*
      IT WAS `enum('neck','upperArm','upperChest')` AND THIS ARM SAID SO.
      Migration 0046 opened it to `varchar(64)` on fable-1078's ruling that a
      reference-tattoo ask is never refused on placement — the customer's own
      words name where the design goes, `sleeve` included.

      The arm is re-aimed rather than deleted, and it is read from the SEQUENCE
      rather than from this file: left pointed at 0034 it would have gone on
      passing while asserting a fence the database no longer has, which is a
      suite that cannot fail when its subject is removed — the disease this
      campaign has already paid to learn, planted here by our own hand.

      `INK_PLACEMENTS` did not shrink; it stopped being this column's contents
      and went on being the answer to *is this surface in the photograph*.
    */
    expect(effectiveColumn("casting_ink_designs", "placement")).toBe("varchar(64) NOT NULL");
    expect(INK_PLACEMENTS).toEqual(["neck", "upperArm", "upperChest"]);
  });

  it("side is exactly the three the recipe can say", () => {
    expect(enumMembers("side")).toEqual([...INK_SIDES]);
  });

  it("provenance is exactly the two a reference may be", () => {
    expect(enumMembers("provenance")).toEqual([...INK_PROVENANCES]);
  });

  it("finds a real column rather than passing on a typo", () => {
    /* The control: the reader above would answer nothing at all for a column
       name that does not exist, and a test that cannot fail on a misspelling is
       a test of its own regex. */
    expect(() => enumMembers("placemnt")).toThrow(/does not exist after the migrations/);
  });
});

describe("the conditions this table carries, asserted in its own text", () => {
  it("holds our own copy of the bytes and says so", () => {
    /*
      COPY, NEVER POINTER. `POST_SIGN_ROADMAP.md` §7's L10 closed as MOOT on the
      grounds that a reference holds its own bytes; an attachment by pointer is
      the one thing that reopens the deferred-delete question, and there is
      still no `notBefore` anywhere in `server/`. Pinned here because the column
      that would break it is a `url` somebody adds in a hurry.
    */
    expect(MIGRATION).toMatch(/`storageKey` varchar\(512\) NOT NULL/);
    expect(MIGRATION).not.toMatch(/`sourceUrl`|`remoteUrl`|`href`/);
  });

  it("scopes its owner on the row rather than through a join", () => {
    expect(MIGRATION).toMatch(/`userId` int NOT NULL/);
  });

  it("carries provenance as NOT NULL, so no row can exist without a claim", () => {
    expect(MIGRATION).toMatch(/`provenance` enum\([^)]*\) NOT NULL/);
  });
});
