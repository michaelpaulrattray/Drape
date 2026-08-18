import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { INK_PLACEMENTS } from "../../shared/inkPlacementVocabulary";
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

function enumMembers(column: string): string[] {
  const match = new RegExp(`\`${column}\` enum\\(([^)]*)\\)`).exec(MIGRATION);
  if (!match) throw new Error(`no enum column \`${column}\` in the migration`);
  return match[1]!.split(",").map((value) => value.trim().replace(/^'|'$/g, ""));
}

describe("the ink design table's enums match the vocabularies they came from", () => {
  it("placement is exactly the measured survivors", () => {
    expect(enumMembers("placement")).toEqual([...INK_PLACEMENTS]);
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
    expect(() => enumMembers("placemnt")).toThrow(/no enum column/);
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
