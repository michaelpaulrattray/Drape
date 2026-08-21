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

/**
 * THE SPELLINGS THIS READER WAS BLIND TO UNTIL 2026-08-22 — and the reason
 * every arm above passed while it was.
 *
 * MySQL spells the same three operations two ways each, `COLUMN` optional, and
 * this repository's migrations use both: 51 `ADD \`col\`` against 17 `ADD
 * COLUMN`, and — the other way round — 2 `MODIFY \`col\`` against 26 `MODIFY
 * COLUMN`. The reader matched only the first of each pair.
 *
 * **The two `MODIFY \`col\`` statements are both in migration 0046, which is
 * the file this reader was written against**, and every case in the suite above
 * was picked from a column it could already read. So the controls inherited the
 * instrument's blind spot instead of exposing it — the specimen joining the
 * vocabulary it is supposed to be tested against.
 *
 * These arms are chosen the other way round: each one names a column the reader
 * REFUSED to answer about before the fix, so removing the fix reddens them.
 */
describe("the migration reader understands both of MySQL's spellings", () => {
  it("reads a MODIFY COLUMN, which is 26 of this repo's 28 MODIFYs", () => {
    expect(effectiveColumn("boards", "startedWith"))
      .toBe("enum('casting','wardrobe','blank') NOT NULL");
  });

  it("reads an ADD COLUMN", () => {
    expect(effectiveColumn("casting_rolls", "path")).toBe("enum('wardrobe','basics') NULL");
  });

  it("reads EVERY column of one ALTER that adds eleven of them", () => {
    /*
      0029 adds eleven columns in a single statement, and this is the arm about
      clause splitting rather than about spelling. The old reader ran its regex
      over the whole statement with the `s` flag, so the FIRST column's answer
      would have swallowed the DDL of all ten that follow it — a wrong answer
      rather than a refusal, which is the one failure mode this file exists to
      prevent.

      The first and the LAST are both asserted on purpose: a splitter that drops
      its final segment passes an arm that only checks the first.
    */
    expect(effectiveColumn("casting_reference_library", "refusedContentKey")).toBe("varchar(512)");
    expect(effectiveColumn("casting_reference_library", "refusedCoverage")).toBe("int");
    expect(effectiveColumn("casting_reference_library", "refusedFrameHeight")).toBe("int");
  });

  it("does not let an enum's own commas split a clause", () => {
    /*
      The negative control for the splitter. `enum('generated','carried',…)` is
      one clause containing six commas; a naive `split(",")` hands the
      classifier `MODIFY COLUMN \`selectionReason\` enum('generated'` and this
      arm goes red with a truncated answer rather than a thrown one.
    */
    expect(effectiveColumn("model_package_snapshot_slots", "selectionReason"))
      .toMatch(/^enum\('generated','carried',.*'evidence_accept'\) NOT NULL$/);
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
