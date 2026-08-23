/**
 * THE DATABASE HOLDS WHAT THE CODE SAYS IT DOES — and six paragraphs of
 * CLAUDE.md have been promising that with nothing behind them.
 *
 * Six flags carry a sentence of the form *"the table must exist before this is
 * flipped on — production takes it by the ceremony script"*. Each is a promise
 * about a HAND-RUN act, and the boot guards deliberately do not check it:
 * `CASTING_INK_STUDIO_SCOPE`'s own paragraph calls its table *"a named
 * prerequisite of the FLIP rather than a boot guard"* and gives the reason —
 * the writer catches its own failure, so a missing table costs a TALLY and
 * never a customer's answer. Quiet, and only in the record.
 *
 * `scripts/deploy-rite.mts` now compares the declared schema to
 * `information_schema` on every push. This file keeps that reader honest.
 *
 * # WHAT IT FOUND ON ITS FIRST RUN, IN BOTH WORLDS
 *
 * 60 tables declared, 59 present — the same one absent from dev and production
 * alike: `casting_cast_segments`. Migration `0027` was written and never applied
 * anywhere, and **nothing reads or writes the table**: the only mentions in the
 * whole tree are its declaration and its two inferred types. Its own migration
 * header says *"nothing reads or writes it until the Sign promotion merges — so
 * this may land ahead of its code."* The migration landed; the code never came.
 *
 * Dormant rather than broken, so it is ENUMERATED rather than deleted or
 * silently skipped — and the list only shrinks, exactly as the capability
 * atlas's `KNOWN_DEBTS` does.
 *
 * # ⚠ THE READER WAS WRONG ON ITS FIRST DRAFT, AND ONLY A SECOND RESOLVER SAID SO
 *
 * The column match required the string on the same LINE as the key. Two of the
 * 874 columns are declared as `mysqlEnum(\n  "name",\n  SOME_CONST,\n)` because
 * the constant made the line long — `coverageBasis` and `selectionReason` — and
 * both were lost, silently, into a shorter list that read exactly like a
 * complete one. It was caught by driving this reader against an independent
 * ts-morph one, not by reasoning; they agree at 60 tables and 874 columns now.
 * The specimens are pinned below by name.
 *
 * # ⚠ WHAT THIS ARM CANNOT DO
 *
 * It never opens a database — `vitest.setup.ts` strips `DATABASE_URL` precisely
 * so a unit test cannot touch a live one. So nothing here knows what production
 * actually holds; only the rite does, because only the rite is already reading
 * it. What this proves is that the reader reads, the verdict discriminates, and
 * the exception list is not carrying a row it has outlived. A clean run is a
 * floor.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  DECLARED_BUT_UNMIGRATED,
  conformanceVerdict,
  declaredSchemaFrom,
  liveSchemaFrom,
} from "../scripts/lib/schemaConformance.mts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA = declaredSchemaFrom(
  readFileSync(path.join(repoRoot, "drizzle", "schema.ts"), "utf8"),
);

describe("the declared-schema reader", () => {
  it("⚠ CONTROL — it read the real schema, not an empty one", () => {
    /* POSITIVE CONTROL. Every assertion below is vacuously true over an empty
       read, and an empty read makes a database look perfectly conforming. */
    expect(SCHEMA.size).toBeGreaterThan(50);
    expect([...SCHEMA.keys()]).toContain("casting_candidates");
    expect(SCHEMA.get("casting_candidates")?.size).toBeGreaterThan(5);
  });

  it("⚠ reads a column whose name is on the NEXT line", () => {
    /* THE DEFECT, by its two real specimens. A line-anchored match loses both
       and reports a complete-looking list. */
    expect(
      SCHEMA.get("model_snapshot_feature_selections"),
      "mysqlEnum with its name wrapped onto the following line",
    ).toContain("selectionReason");
    expect(SCHEMA.get("casting_evidence_candidate_feature_targets")).toContain("coverageBasis");
  });

  it("takes the DATABASE name from the string, never the TypeScript key", () => {
    const declared = declaredSchemaFrom(
      `export const t = mysqlTable("thing", { camelKey: varchar("snake_name", { length: 8 }) });`,
    );
    expect([...declared.get("thing")!]).toEqual(["snake_name"]);
  });

  it("does not take a key out of a nested options object", () => {
    /* NEGATIVE CONTROL for the depth counter: an options object's own keys are
       not columns, and a reader that collected them would invent findings. */
    const declared = declaredSchemaFrom(
      `export const t = mysqlTable("thing", {
         real: varchar("real", { length: 8 }),
         other: decimal("other", { precision: nested("not_a_column") }),
       });`,
    );
    expect([...declared.get("thing")!].sort()).toEqual(["other", "real"]);
  });

  it("refuses rather than returning an empty declaration", () => {
    expect(() => declaredSchemaFrom("export const nothing = 1;")).toThrow(/no mysqlTable/);
  });

  it("refuses an unbalanced shape rather than returning a short column list", () => {
    expect(() => declaredSchemaFrom(`export const t = mysqlTable("thing", { a: varchar("a",`)).toThrow(
      /unbalanced/,
    );
  });
});

describe("the conformance verdict, proven able to say no", () => {
  const declared = declaredSchemaFrom(
    `export const a = mysqlTable("alpha", { one: varchar("one", { length: 1 }), two: varchar("two", { length: 1 }) });
     export const b = mysqlTable("beta", { one: varchar("one", { length: 1 }) });`,
  );
  const whole = liveSchemaFrom([
    { t: "alpha", c: "one" },
    { t: "alpha", c: "two" },
    { t: "beta", c: "one" },
  ]);

  it("⚠ CONTROL — a conforming database produces no problem, over a real population", () => {
    const verdict = conformanceVerdict(declared, whole);
    expect(verdict.problems).toEqual([]);
    expect(verdict.declaredTables).toBe(2);
    expect(verdict.liveTables).toBe(3 - 1);
  });

  it("reports a declared table the database does not have", () => {
    const verdict = conformanceVerdict(declared, liveSchemaFrom([{ t: "alpha", c: "one" }, { t: "alpha", c: "two" }]));
    expect(verdict.missingTables).toEqual(["beta"]);
    expect(verdict.problems[0]).toContain("has not been run here");
  });

  it("reports a declared column the existing table does not have", () => {
    /* The direction `migration-before-code` is about: a new COLUMN on a table
       that already exists is in every INSERT, and the table being present is
       exactly what makes it look fine. */
    const verdict = conformanceVerdict(declared, liveSchemaFrom([{ t: "alpha", c: "one" }, { t: "beta", c: "one" }]));
    expect(verdict.missingColumns).toEqual(["alpha.two"]);
    expect(verdict.problems[0]).toContain("in every INSERT");
  });

  it("says nothing about a table on the database the code does not declare", () => {
    /* NEGATIVE CONTROL. `__drizzle_migrations` is real and is not ours to
       declare; a verdict that reported it would cry wolf on every run. */
    const verdict = conformanceVerdict(
      declared,
      liveSchemaFrom([...whole].flatMap(([t, cs]) => [...cs].map((c) => ({ t, c }))).concat([{ t: "__drizzle_migrations", c: "id" }])),
    );
    expect(verdict.problems).toEqual([]);
  });
});

describe("the unmigrated exception list only shrinks", () => {
  it("tolerates an enumerated table, and ONLY an enumerated one", () => {
    const declared = declaredSchemaFrom(
      `export const a = mysqlTable("casting_cast_segments", { one: varchar("one", { length: 1 }) });
       export const b = mysqlTable("some_other_table", { one: varchar("one", { length: 1 }) });`,
    );
    const verdict = conformanceVerdict(declared, liveSchemaFrom([]));
    expect(verdict.missingTables, "the enumerated one is tolerated").toEqual(["some_other_table"]);
  });

  it("⚠ ERRORS when an enumerated table turns out to be PRESENT", () => {
    /* The rule that keeps the list from outliving its reason: a debt that has
       been paid is an error until its line is deleted. Without this the
       exception is permanent by default. */
    const declared = declaredSchemaFrom(
      `export const a = mysqlTable("casting_cast_segments", { one: varchar("one", { length: 1 }) });`,
    );
    const verdict = conformanceVerdict(declared, liveSchemaFrom([{ t: "casting_cast_segments", c: "one" }]));
    expect(verdict.staleExceptions).toEqual(["casting_cast_segments"]);
    expect(verdict.problems[0]).toContain("the list only shrinks");
  });

  it("⚠ every enumerated table is still DECLARED by the code, with a real reason", () => {
    /* An exception for a table the schema no longer declares can never fire and
       can never be removed by the rule above — it would simply sit there. */
    for (const [table, reason] of Object.entries(DECLARED_BUT_UNMIGRATED)) {
      expect([...SCHEMA.keys()], `${table} is enumerated and no longer declared`).toContain(table);
      expect(reason.length, `${table}'s reason is too thin to be one`).toBeGreaterThan(40);
    }
  });

  it("⚠ and the one entry is the specimen, pinned by name", () => {
    expect(Object.keys(DECLARED_BUT_UNMIGRATED)).toEqual(["casting_cast_segments"]);
  });
});
