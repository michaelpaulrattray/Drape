import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  CASTING_REFERENCE_CROP_INTENTS,
  CASTING_REFERENCE_CROP_SOURCES,
} from "../../drizzle/schema";
import { INK_PROVENANCES } from "../../shared/inkProvenance";
import {
  REFERENCE_INTENTS,
  referenceIntentIngestionForm,
} from "../../shared/referenceIntents";

/**
 * THE DDL AND THE VOCABULARY ARE ONE FACT, SO THEY ARE CHECKED AGAINST EACH
 * OTHER RATHER THAN BOTH BEING TRUSTED — the ink design table's own protection
 * (`inkDesignSchema.test.ts`), applied to migration 0040.
 *
 * There is one extra axis here that the ink table does not have. `intent` is not
 * an authored constant at all: it is COMPUTED from the ingestion map's crop-form
 * members. So two different drifts are possible and both are checked —
 *
 *   the migration drifting from the constant   (a hand-typed SQL enum)
 *   the constant drifting from the MAP         (the cast in `drizzle/schema.ts`
 *                                               asserts a tuple the filter is
 *                                               only believed to produce)
 *
 * The second is the one a reader would not think to look for, and it is the one
 * that decides whether the founder's ruling or a stale tuple governs the column.
 */
const MIGRATION = readFileSync(
  path.resolve(__dirname, "../../drizzle/0040_casting_reference_crops.sql"),
  "utf8",
);

function enumMembers(column: string): string[] {
  const match = new RegExp(String.raw`\`${column}\` enum\(([^)]*)\)`).exec(MIGRATION);
  if (!match) throw new Error(`no enum column \`${column}\` in the migration`);
  return match[1]!.split(",").map((value) => value.trim().replace(/^'|'$/g, ""));
}

describe("the reference crop table's enums match the vocabularies they came from", () => {
  it("intent is exactly the CROP-form features of the ingestion map", () => {
    /* The founder's ruling is the map; this column is its shadow, and the two
       are compared rather than both trusted. Hair and eye colour today. */
    const fromTheMap = REFERENCE_INTENTS.filter(
      (key) => referenceIntentIngestionForm(key) === "crop",
    );
    expect([...CASTING_REFERENCE_CROP_INTENTS]).toEqual([...fromTheMap]);
    expect(enumMembers("intent")).toEqual([...fromTheMap]);
  });

  it("source names the fourth source and nothing else", () => {
    /* One member on purpose. A second is a migration and a decision, which is
       the right price for a new way for somebody else's pixels to reach a
       render — so a silently grown list is what this catches. */
    expect([...CASTING_REFERENCE_CROP_SOURCES]).toEqual(["uploadedReference"]);
    expect(enumMembers("source")).toEqual([...CASTING_REFERENCE_CROP_SOURCES]);
  });

  it("provenance is exactly the two a reference may be", () => {
    expect(enumMembers("provenance")).toEqual([...INK_PROVENANCES]);
  });

  it("finds a real column rather than passing on a typo", () => {
    /* The control: the reader above answers nothing at all for a column name
       that does not exist, and a test that cannot fail on a misspelling is a
       test of its own regex. */
    expect(() => enumMembers("intnet")).toThrow(/no enum column/);
  });
});

describe("the fence this table meets by construction, asserted in its own text", () => {
  it("keeps NO geometry locating the cut inside the uploaded photograph", () => {
    /*
      THE ABSENCE IS THE DESIGN. A bbox or a frame size would place this cut
      inside a picture of a real person that we deliberately do not keep — and
      an absence nobody checks is an absence that ends quietly, on the day
      somebody adds a column because the library has one.

      The ceremony asserts the same absence against the live table, because this
      only proves the FILE never asked for them.
    */
    for (const column of ["bboxX", "bboxY", "bboxW", "bboxH", "frameWidth", "frameHeight"]) {
      expect(MIGRATION).not.toMatch(new RegExp(`\`${column}\``));
    }
  });

  it("holds our own copy of the CUT and never a pointer", () => {
    /* The condition inherited from the ink store: L10 closed as MOOT on the
       grounds that a reference holds its own bytes, and an attachment by
       pointer is the one thing that reopens the deferred-delete question. */
    expect(MIGRATION).toMatch(/`storageKey` varchar\(512\) NOT NULL/);
    expect(MIGRATION).not.toMatch(/`sourceUrl`|`remoteUrl`|`href`/);
  });

  it("scopes its owner on the row rather than through a join", () => {
    /* Invariant 1: ownership decided in the statement that reads or writes. */
    expect(MIGRATION).toMatch(/`userId` int NOT NULL/);
  });

  it("carries provenance as NOT NULL, so no row can exist without a claim", () => {
    expect(MIGRATION).toMatch(/`provenance` enum\([^)]*\) NOT NULL/);
  });

  it("carries the guard reading as NOT NULL, so no row can exist unguarded", () => {
    /* Every stored cut passed the completeness guard; a nullable reading would
       let an unguarded row look like a guarded one whose number went missing. */
    expect(MIGRATION).toMatch(/`guardKind` varchar\(48\) NOT NULL/);
    expect(MIGRATION).toMatch(/`guardCoverage` int NOT NULL/);
  });
});
