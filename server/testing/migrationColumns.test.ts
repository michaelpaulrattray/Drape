import { describe, expect, it } from "vitest";

import { effectiveColumn, effectiveEnumMembers, migrationFiles } from "./migrationColumns";

/**
 * THE READER IS PROVEN BEFORE ITS VERDICTS COUNT (working law 2).
 *
 * Two suites are about to stop asserting an enum and start asserting what this
 * reader says a column IS. That makes this file the instrument, and an
 * instrument gets a positive control and a negative control before anything is
 * believed on its word.
 *
 * Every case below is a real column of a real migration, chosen so that the
 * ANSWER ITSELF is the discriminator:
 *
 *   positive, unchanged   a column created once and never altered
 *   positive, ALTERED     a column whose CREATE and whose truth disagree — the
 *                         one case the old readers got wrong, and the only one
 *                         that separates this reader from them
 *   negative              a column that does not exist, and a table that does
 *                         not exist, each refusing in its own way
 */
describe("the migration reader can see what is there", () => {
  it("finds every migration, in replay order", () => {
    const files = migrationFiles();
    expect(files.length).toBeGreaterThan(40);
    expect([...files].sort()).toEqual(files);
    expect(files[0]).toMatch(/^0000_/);
  });

  it("reads a column that was created once and never touched again", () => {
    /* `side` is the ink road's laterality key and is deliberately still closed
       — so it is both a positive control and, by being here, a pin. */
    expect(effectiveColumn("casting_ink_designs", "side"))
      .toBe("enum('left','right','centre') NOT NULL");
  });

  it("reads a column added by a later ALTER rather than by its CREATE", () => {
    expect(effectiveColumn("casting_candidate_variants", "stepProvenance")).toBe("json");
  });
});

describe("the migration reader reports the PRESENT, not the CREATE", () => {
  /*
    THE ARM THAT SEPARATES THIS READER FROM THE ONE IT REPLACES.

    Both ink placement columns are `enum(…)` in the migration that creates them
    and `varchar(64)` after 0046. A reader that stopped at the CREATE — which is
    exactly what `inkDesignSchema.test.ts` and `inkFormDemandSchema.test.ts`
    did — answers `enum('neck','upperArm','upperChest')` here and passes a suite
    that is asserting a fence the database no longer has.
  */
  it("says the design table's placement is open", () => {
    expect(effectiveColumn("casting_ink_designs", "placement")).toBe("varchar(64) NOT NULL");
  });

  it("says the demand table's placement is open", () => {
    expect(effectiveColumn("casting_ink_form_demand", "placement")).toBe("varchar(64) NOT NULL");
  });

  it("refuses to call an opened column an enum", () => {
    /* The negative arm of the same fact: a caller that goes on asking for enum
       members after the fence is gone is TOLD, rather than handed `[]` to
       compare against a vocabulary. */
    expect(() => effectiveEnumMembers("casting_ink_designs", "placement"))
      .toThrow(/not an enum/);
  });
});

describe("the migration reader refuses rather than guessing", () => {
  it("says nothing exists for a column that does not", () => {
    expect(effectiveColumn("casting_ink_designs", "placemnt")).toBeNull();
  });

  it("throws for a table no migration mentions", () => {
    expect(() => effectiveColumn("casting_ink_designz", "placement"))
      .toThrow(/no migration mentions/);
  });

  it("throws rather than returning an empty member list for a missing column", () => {
    expect(() => effectiveEnumMembers("casting_ink_designs", "placemnt"))
      .toThrow(/does not exist after the migrations/);
  });

  it("does not read a column out of the prose that argues against it", () => {
    /*
      0043's docblock explains at length why `casting_reference_attachments` has
      no `intents` column and no `placement` column. A reader that kept comments
      would find those words and report a column that was deliberately never
      built — the failure the comment-stripping exists to prevent, asserted
      rather than described.
    */
    expect(effectiveColumn("casting_reference_attachments", "intents")).toBeNull();
    expect(effectiveColumn("casting_reference_attachments", "placement")).toBeNull();
    expect(effectiveColumn("casting_reference_attachments", "provenance"))
      .toBe("enum('synthetic','consented') NOT NULL");
  });
});
