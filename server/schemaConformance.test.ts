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
  DECLARED_COLUMNS_BUT_UNMIGRATED,
  conformanceVerdict,
  declaredIndexesFrom,
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

describe("the named-index reader — the hole a column check alone leaves", () => {
  /*
    Two migrations in this repo change nothing a COLUMNS query can see:
    `0006_sticky_eternals` and `0050_ink_delivery_keyed_on_delivery`, which swaps
    a unique index and widens a column to NULL. `0050` is one of the twenty-six
    applied by hand-run CEREMONY rather than by drizzle-kit — the journal stops
    at 0026 — so it is exactly the act with no ledger anywhere, and a
    table-and-column check would call a database conforming with the WRONG
    uniqueness on it. Measured at both databases before this was written: 0050
    HAD run in both. This closes the hole rather than reporting one.
  */
  const INDEXES = declaredIndexesFrom(
    readFileSync(path.join(repoRoot, "drizzle", "schema.ts"), "utf8"),
  );

  it("⚠ CONTROL — it read a real index population, including 0050's own", () => {
    expect(INDEXES.size).toBeGreaterThan(100);
    expect(
      INDEXES.get("uq_casting_ink_delivery_crops_delivery"),
      "the index migration 0050 creates, and the table it belongs to",
    ).toBe("casting_ink_delivery_crops");
    expect(
      [...INDEXES.keys()],
      "and the one it DROPS must not be declared — the schema is the after state",
    ).not.toContain("uq_casting_ink_delivery_crops_design");
  });

  it("reads indexes out of the THIRD argument, not the column shape", () => {
    const indexes = declaredIndexesFrom(
      `export const t = mysqlTable("thing", {
         one: varchar("one", { length: 1 }),
       }, (table) => ([
         uniqueIndex("uq_thing_one").on(table.one),
         index("ix_thing_one").on(table.one),
       ]));`,
    );
    expect([...indexes]).toEqual([
      ["uq_thing_one", "thing"],
      ["ix_thing_one", "thing"],
    ]);
  });

  it("reports a declared index the database does not hold", () => {
    const declared = declaredSchemaFrom(`export const t = mysqlTable("thing", { one: varchar("one", { length: 1 }) });`);
    const verdict = conformanceVerdict(declared, liveSchemaFrom([{ t: "thing", c: "one" }]), {
      declared: new Map([["uq_thing_one", "thing"]]),
      live: new Set<string>(),
    });
    expect(verdict.missingIndexes).toEqual(["thing.uq_thing_one"]);
    expect(verdict.problems[0]).toContain("looking perfectly conforming");
  });

  it("does not report an index on a table already enumerated as unmigrated", () => {
    /* Otherwise the three indexes on `casting_cast_segments` would turn ONE
       known absence into FOUR findings, and a receipt full of noise is a
       receipt nobody reads. The TABLE is the thing that is missing. */
    const declared = declaredSchemaFrom(
      `export const t = mysqlTable("casting_cast_segments", { one: varchar("one", { length: 1 }) });`,
    );
    const verdict = conformanceVerdict(declared, liveSchemaFrom([]), {
      declared: new Map([["uq_casting_cast_segments_public", "casting_cast_segments"]]),
      live: new Set<string>(),
    });
    expect(verdict.missingIndexes).toEqual([]);
    expect(verdict.problems).toEqual([]);
  });

  it("says nothing about an index the database has that the code does not declare", () => {
    /* NEGATIVE CONTROL: MySQL names every primary key `PRIMARY`, and there are
       153 live index names against 145 declared. A verdict that reported the
       difference would cry wolf on every run. */
    const declared = declaredSchemaFrom(`export const t = mysqlTable("thing", { one: varchar("one", { length: 1 }) });`);
    const verdict = conformanceVerdict(declared, liveSchemaFrom([{ t: "thing", c: "one" }]), {
      declared: new Map(),
      live: new Set(["PRIMARY", "some_index_nobody_declared"]),
    });
    expect(verdict.problems).toEqual([]);
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

  it("⚠ and the entries are pinned by name — joining this list is a deliberate act", () => {
    /* `crew_replies` joined 2026-08-25 (issue #41) and LEFT the same night:
       the founder's ceremony applied it on production and `1bc462de` deleted
       its exception line as that line's own docblock ordered — but not this
       pin, so main went red until the next shift caught it. The pin and the
       list move in the SAME commit, always; that is what "deliberate act"
       costs. */
    expect(Object.keys(DECLARED_BUT_UNMIGRATED)).toEqual([
      "casting_cast_segments",
      /* THREE JOINED AND LEFT ON 2026-08-30, all within the evening, and the
         list is back to the one table that has never been migrated anywhere.
         The founder ran both ceremonies himself: `crew_shift_runs` (#272,
         migration 0055 — the live shift row; 14 columns), then
         `crew_work_switches` + `crew_queue_counts` (#277, migration 0056 —
         his background-work panel, one command for the pair).

         Each departure deleted its exception line AND this pin in ONE commit,
         which is what the `crew_replies` note above exists to enforce. It was
         proven rather than assumed: removing the first line alone reddened
         this very assertion within the minute, so the pin did its job on the
         first opportunity it had after the incident that wrote the note. */
    ]);
  });
});


/*
 * ─── THE COLUMN-LEVEL EXCEPTION (#285) ──────────────────────────────────────
 *
 * ⚠ **THE TABLE LIST COULD NOT EXPRESS THIS, AND THE GAP HAD TEETH.** A column
 * added to a live table is a founder ceremony exactly as a table is, but until
 * that ceremony runs the rite exits 1 on the mismatch — so the FIRST additive
 * column in this repository's history would have blocked every other shift's
 * doc and briefing push until he woke up and ran one command. The exception
 * keeps the rite honest (it still reports the column as absent in its line)
 * without making one shift's pending ceremony everyone else's outage.
 *
 * It carries the table list's shrink rule, and these arms are what make that
 * true rather than intended.
 */
describe("a column may be enumerated as unmigrated, and only shrinks too", () => {
  const declaredWithTitles = () => declaredSchemaFrom(
    `export const a = mysqlTable("crew_queue_counts", {
       categoryKey: varchar("categoryKey", { length: 32 }),
       titles: text("titles"),
     });`,
  );

  it("⚠ CONTROL — an UNenumerated missing column is still reported", () => {
    /* Without this, every arm below could pass on a verdict that had simply
       stopped looking at columns at all. */
    const declared = declaredSchemaFrom(
      `export const a = mysqlTable("crew_queue_counts", {
         categoryKey: varchar("categoryKey", { length: 32 }),
         somethingElse: text("somethingElse"),
       });`,
    );
    const verdict = conformanceVerdict(declared, liveSchemaFrom([{ t: "crew_queue_counts", c: "categoryKey" }]));
    expect(verdict.missingColumns).toEqual(["crew_queue_counts.somethingElse"]);
  });

  /* ⚠ A FIXTURE, not the live list. These two arms used whatever real entry
     happened to be enumerated, so the mechanism could only be tested while the
     list was non-empty — and the guard could not reach its own resting state:
     deleting the last exception, which every ceremony's closing line orders,
     turned both red. Found the morning #285's ceremony emptied it. */
  const FIXTURE = { "crew_queue_counts.titles": "a fixture, not a real exception" };

  it("tolerates the enumerated column while the ceremony has not run", () => {
    const verdict = conformanceVerdict(
      declaredWithTitles(),
      liveSchemaFrom([{ t: "crew_queue_counts", c: "categoryKey" }]),
      undefined,
      FIXTURE,
    );
    expect(verdict.missingColumns).toEqual([]);
    expect(verdict.problems).toEqual([]);
  });

  it("⚠ ERRORS when the enumerated column turns out to be PRESENT", () => {
    /* The day his ceremony runs, the exception has outlived its reason and is
       an error until its line is deleted — the same rule the table list has,
       and the one `crew_replies` reddened main for forgetting. */
    const verdict = conformanceVerdict(
      declaredWithTitles(),
      liveSchemaFrom([
        { t: "crew_queue_counts", c: "categoryKey" },
        { t: "crew_queue_counts", c: "titles" },
      ]),
      undefined,
      FIXTURE,
    );
    expect(verdict.staleExceptions).toEqual(["crew_queue_counts.titles"]);
    expect(verdict.problems[0]).toContain("the list only shrinks");
  });

  it("⚠ every enumerated column is still DECLARED by the code, on a table it names", () => {
    for (const [qualified, reason] of Object.entries(DECLARED_COLUMNS_BUT_UNMIGRATED)) {
      const [table, column] = qualified.split(".");
      const columns = SCHEMA.get(table!);
      expect(columns, `${qualified} is enumerated and its table is not declared`).toBeDefined();
      expect([...columns!], `${qualified} is enumerated and no longer declared`).toContain(column);
      expect(reason.length, `${qualified}'s reason is too thin to be one`).toBeGreaterThan(40);
    }
  });

  it("⚠ and the entries are pinned by name — joining this list is a deliberate act", () => {
    /* The pin and the list move in the SAME commit, always. `crew_replies`
       reddened main because a ceremony deleted an exception line and not its
       pin; the reverse — a line added without its pin — is how an exception
       becomes permanent by arriving quietly. */
    /* `crew_queue_counts.titles` (#285, migration 0057) joined 2026-08-30 and
       LEFT the next morning: he confirmed the merge, the ceremony reported
       ALREADY APPLIED on production (`titles: text · nullable`, 5 rows, 0 with
       titles — deliberately not back-filled, because the titles and the count
       are ONE reading), and its line and this pin were deleted together in
       that commit. The list is empty, which is the state it should spend most
       of its life in. */
    /* `crew_queue_counts.excluded` (#324, migration 0058) joined 2026-08-31 and
       LEFT the same night: he approved the ceremony on his own page (reply #57,
       "I approve you to run it whenever you want"), it reported APPLIED against
       production (`excluded: text · nullable`, 5 rows, 0 with exclusions —
       deliberately not back-filled, because a row holding a TOTAL beside an
       invented exclusion would subtract twice), `crew-count-queue.mts` rewrote
       all five rows in one pass, and its line and this pin were deleted
       together in that commit. The list is empty, which is the state it should
       spend most of its life in. */
    expect(Object.keys(DECLARED_COLUMNS_BUT_UNMIGRATED)).toEqual([]);
  });
});
