/**
 * THE GUARD ON THE THING THAT WRITES TO THE PRODUCTION DATABASE UNATTENDED.
 *
 * `scripts/lib/ceremonyAutoApply.mts` decides, on every push, which migration
 * statements the deploy rite may send to production without anybody watching.
 * That makes its classifier the highest-consequence pure function in this
 * repository, and the bar here is the one CLAUDE.md sets for a backstop: it is
 * driven DIRECTLY, over the REAL migration set as well as fixtures, and every
 * arm has a control that could have failed.
 *
 * # WHAT EACH SECTION IS FOR
 *
 * 1. **The classifier**, arm by arm, including the two multi-clause `ALTER`
 *    statements that actually exist in `drizzle/` and mix a `DROP` or a
 *    `MODIFY` in with an `ADD`. Those are the specimens a naive
 *    "does it contain ADD" rule applies, and they are fixtures here for
 *    exactly that reason.
 * 2. **The parser**, over the real files, because two of this build's three
 *    defects were parse defects rather than classification ones and neither
 *    was reachable from a hand-written fixture.
 * 3. **The planner**, with a positive control (it selects the right statement),
 *    a negative control (it selects nothing when nothing is missing), and the
 *    two remainder roads told apart.
 * 4. **The applier**, whose executor is injected — including the arm that
 *    matters most, where every statement returns without error and the object
 *    is STILL ABSENT on the read-back.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  type MissingObjects,
  type ParsedStatement,
  applyPlan,
  classifyStatement,
  planApply,
  statementsFrom,
} from "../scripts/lib/ceremonyAutoApply.mts";

const MIGRATIONS = "drizzle";

/** Every migration file, in the order the rite reads them. */
function realFiles(): Array<{ name: string; sql: string }> {
  return readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({
      name: `drizzle/${name}`,
      sql: readFileSync(path.join(MIGRATIONS, name), "utf8"),
    }));
}

const REAL = statementsFrom(realFiles());

describe("the classifier — what may run unattended", () => {
  it("⚠ CONTROL — the real migration set produced statements at all", () => {
    /* Every arm below is about a population. A parser that returned nothing
       would make each of them vacuously true, which is the shape that has cost
       this repository four green-while-proving-nothing instruments. */
    expect(REAL.length).toBeGreaterThan(200);
    expect(realFiles().length).toBeGreaterThan(50);
  });

  it("accepts CREATE TABLE and names the table", () => {
    const statement = classifyStatement("CREATE TABLE `widgets` (\n\t`id` int NOT NULL\n);", "f.sql");
    expect(statement.kind).toBe("additive");
    expect(statement.createsTables).toEqual(["widgets"]);
  });

  it("accepts CREATE INDEX and CREATE UNIQUE INDEX, and names the index", () => {
    expect(classifyStatement("CREATE INDEX `ix_a` ON `t` (`c`);", "f.sql").createsIndexes).toEqual(["ix_a"]);
    expect(classifyStatement("CREATE UNIQUE INDEX `uq_a` ON `t` (`c`);", "f.sql").createsIndexes).toEqual(["uq_a"]);
  });

  it("accepts an ALTER whose every clause is an ADD, and names the columns", () => {
    const statement = classifyStatement(
      "ALTER TABLE `t`\n\tADD COLUMN `a` int,\n\tADD COLUMN `b` varchar(8);",
      "f.sql",
    );
    expect(statement.kind).toBe("additive");
    expect(statement.addsColumns).toEqual(["t.a", "t.b"]);
  });

  it("⚠ REFUSES an ALTER that mixes a DROP in with an ADD — drizzle/0012's real shape", () => {
    /* THE SPECIMEN THAT WOULD HAVE GOT THROUGH. A rule asking whether the
       statement contains an ADD applies this one, and it drops a live unique
       index on `storage_cleanup_items` on the way past. */
    const statement = classifyStatement(
      "ALTER TABLE `storage_cleanup_items`\n"
      + "\tDROP INDEX `uq_storage_cleanup_items_batch_key`,\n"
      + "\tADD CONSTRAINT `uq_storage_cleanup_items_batch_key` UNIQUE(`batchId`,`storageBackend`,`storageKey`);",
      "drizzle/0012.sql",
    );
    expect(statement.kind).toBe("destructive");
    expect(statement.reason).toContain("DROP INDEX");
    expect(statement.addsColumns).toEqual([]);
    expect(statement.createsIndexes).toEqual([]);
  });

  it("⚠ REFUSES an ALTER that mixes a MODIFY in with two ADDs — drizzle/0014's real shape", () => {
    const statement = classifyStatement(
      "ALTER TABLE `model_identity_feature_versions`\n"
      + "  MODIFY COLUMN `sourceAssetId` int,\n"
      + "  ADD `acceptedAssetId` int,\n"
      + "  ADD CONSTRAINT `uq_x` UNIQUE(`acceptedAssetId`);",
      "drizzle/0014.sql",
    );
    expect(statement.kind).toBe("destructive");
    expect(statement.reason).toContain("MODIFY COLUMN");
  });

  it("refuses a bare DROP, RENAME, TRUNCATE, DELETE, UPDATE and INSERT", () => {
    for (const sql of [
      "DROP TABLE `t`;",
      "DROP INDEX `i` ON `t`;",
      "RENAME TABLE `a` TO `b`;",
      "TRUNCATE TABLE `t`;",
      "DELETE FROM `t` WHERE `id` = 1;",
      "UPDATE `t` SET `a` = 1;",
      "INSERT INTO `t` (`a`) VALUES (1);",
    ]) {
      expect(classifyStatement(sql, "f.sql").kind, sql).toBe("destructive");
    }
  });

  it("⚠ refuses a shape it has never seen, rather than guessing", () => {
    /* The default is refusal. A migration idiom nobody anticipated stops the
       run; it does not run because nothing recognised it as dangerous. */
    expect(classifyStatement("SET FOREIGN_KEY_CHECKS = 0;", "f.sql").kind).toBe("destructive");
    expect(classifyStatement("CALL some_procedure();", "f.sql").kind).toBe("destructive");
    expect(classifyStatement("CREATE VIEW `v` AS SELECT 1;", "f.sql").kind).toBe("destructive");
  });

  it("⚠ is not fooled by the word ADD inside a comment or a string literal", () => {
    const commented = classifyStatement(
      "-- we ADD nothing here, this is a note\nDROP TABLE `t`;",
      "f.sql",
    );
    expect(commented.kind).toBe("destructive");
    const literal = classifyStatement(
      "ALTER TABLE `t` MODIFY COLUMN `k` enum('ADD','ADD COLUMN') NOT NULL;",
      "f.sql",
    );
    expect(literal.kind).toBe("destructive");
  });

  it("⚠ splits ALTER clauses on TOP-LEVEL commas only", () => {
    /* A comma inside `enum('a','b')` or `UNIQUE(x,y)` is not a clause break.
       Splitting on every comma turns `ADD CONSTRAINT c UNIQUE(a,b)` into a
       second clause beginning `b)`, which no rule recognises — so a perfectly
       additive statement would be refused, and the failure would be invisible
       because refusing is the safe direction. */
    const statement = classifyStatement(
      "ALTER TABLE `t` ADD CONSTRAINT `uq_t` UNIQUE(`a`,`b`), ADD `c` enum('x','y') NOT NULL;",
      "f.sql",
    );
    expect(statement.kind).toBe("additive");
    expect(statement.createsIndexes).toEqual(["uq_t"]);
    expect(statement.addsColumns).toEqual(["t.c"]);
  });

  it("reads a named CONSTRAINT declared INSIDE a CREATE TABLE as an incidental index", () => {
    const statement = classifyStatement(
      "CREATE TABLE `t` (\n\t`id` int NOT NULL,\n"
      + "\tCONSTRAINT `t_id` PRIMARY KEY(`id`),\n"
      + "\tCONSTRAINT `uq_t_pub` UNIQUE(`publicId`)\n);",
      "f.sql",
    );
    expect(statement.incidentalIndexes).toEqual(["t_id", "uq_t_pub"]);
    /* Incidental, NOT required: they arrive with the table whether anything
       asked for them or not, so they must never disqualify it. */
    expect(statement.createsIndexes).toEqual([]);
  });
});

describe("the parser — over the real files, because both parse defects lived there", () => {
  it("⚠ does not split a CREATE TABLE on a semicolon that is inside a COMMENT", () => {
    /* THE DEFECT, FOUND BY DRIVING BEFORE WIRING (#322). `drizzle/0049` line
       112 is prose inside the table body ending in a semicolon — "the identity
       source stays `casting_ink_designs`;". Splitting the raw text on `;` cut
       the table in half, and the reader then REFUSED a statement it should
       have applied. It failed closed, which is the design working, and it was
       still a defect. */
    const table = REAL.find((statement) => statement.createsTables.includes("casting_ink_delivery_crops"));
    expect(table, "0049's table was not parsed as one statement").toBeDefined();
    expect(table!.kind).toBe("additive");
    expect(table!.sql).toContain("CONSTRAINT `casting_ink_delivery_crops_id` PRIMARY KEY");
  });

  it("⚠ does not lose a statement boundary by stripping the breakpoint marker", () => {
    /* `--> statement-breakpoint` is ITSELF a `--` line, so stripping comments
       before splitting on it deletes every boundary drizzle wrote.

       ⚠ THIS IS A FIXTURE AND IT HAS TO BE, which the sabotage driver found by
       failing to redden the real-file assertion that stood here first. Every
       statement drizzle emits ends in a semicolon, so over `drizzle/*.sql` the
       later `;` split rescues the collapse and a count over the real set stays
       comfortably above any floor — the arm passed whichever order the code
       used, which is an arm that tests nothing.

       Two tables, one breakpoint, no semicolons: strip first and the second
       table is silently gone. */
    const parsed = statementsFrom([{
      name: "fixture.sql",
      sql: "-- a note\nCREATE TABLE `a` (`id` int NOT NULL)\n--> statement-breakpoint\nCREATE TABLE `b` (`id` int NOT NULL)\n",
    }]);
    expect(parsed.map((statement) => statement.createsTables).flat()).toEqual(["a", "b"]);
  });

  it("⚠ the real set still parses into a large, mostly additive population", () => {
    /* A floor rather than a count — a migration added tomorrow must not redden
       this — and it is a CONTROL for the arms above rather than a property in
       its own right. Said plainly because the arm above used to be worded as
       if it were the property. */
    expect(REAL.filter((statement) => statement.kind === "additive").length).toBeGreaterThan(200);
  });

  it("⚠ every statement in the real set is classified, and the two classes are both populated", () => {
    /* An all-additive reading would mean the refusal road has never been
       exercised by real data; an all-destructive one would mean the applier is
       dead. Both numbers are floors, deliberately, so a migration added
       tomorrow does not redden this. */
    expect(REAL.every((statement) => statement.kind === "additive" || statement.kind === "destructive")).toBe(true);
    expect(REAL.filter((s) => s.kind === "destructive").length).toBeGreaterThan(20);
    expect(REAL.filter((s) => s.kind === "additive").length).toBeGreaterThan(200);
  });

  it("⚠ no additive statement in the real set carries a destructive verb anywhere in its body", () => {
    /* The end-to-end statement of the rule, asserted over the whole real
       population rather than over the fixtures above. If this ever fails, a
       statement is about to be sent to production that a person would not have
       sent. */
    for (const statement of REAL.filter((s) => s.kind === "additive")) {
      const body = statement.sql.replace(/'[^']*'/g, "''");
      expect(/\bDROP\b|\bRENAME\b|\bTRUNCATE\b|\bMODIFY\b|\bCHANGE COLUMN\b|\bDELETE\b/i.test(body), statement.sql.slice(0, 120)).toBe(false);
    }
  });
});

describe("the planner — what tonight's run would actually send", () => {
  const nothingMissing: MissingObjects = { tables: [], columns: [], indexes: [] };

  it("⚠ NEGATIVE CONTROL — a conforming database plans nothing", () => {
    const plan = planApply(nothingMissing, REAL);
    expect(plan.apply).toEqual([]);
    expect(plan.refuse).toEqual([]);
    expect(plan.unresolved).toEqual([]);
  });

  it("⚠ POSITIVE CONTROL — the real pending pair plans exactly four statements, table before index", () => {
    /* Read off production on 2026-09-01, before the first live run: two tables
       absent, and four objects with them. The order is the assertion that
       matters — a CREATE INDEX before its CREATE TABLE fails. */
    const plan = planApply(
      {
        tables: ["casting_cast_segments", "crew_card_intents"],
        columns: [],
        indexes: [
          "uq_casting_cast_segments_public",
          "uq_casting_cast_segments_identity",
          "idx_casting_cast_segments_cast",
          "uq_crew_card_intents_issue",
        ],
      },
      REAL,
    );
    expect(plan.refuse).toEqual([]);
    expect(plan.unresolved).toEqual([]);
    expect(plan.apply.map((s) => s.file)).toEqual([
      "drizzle/0027_casting_v2_cast_segments.sql",
      "drizzle/0027_casting_v2_cast_segments.sql",
      "drizzle/0059_crew_card_intents.sql",
      "drizzle/0059_crew_card_intents.sql",
    ]);
    expect(plan.apply[0].createsTables).toEqual(["casting_cast_segments"]);
    expect(plan.apply[1].createsIndexes).toEqual(["idx_casting_cast_segments_cast"]);
    expect(plan.apply[2].createsTables).toEqual(["crew_card_intents"]);
    expect(plan.apply[3].createsIndexes).toEqual(["uq_crew_card_intents_issue"]);
  });

  it("⚠ REFUSES rather than applies when the only DDL for a missing object is destructive", () => {
    /* `uq_storage_cleanup_items_batch_key` is dropped and re-added inside one
       multi-clause ALTER in 0012. Asking for it must produce a NAMED refusal,
       not silence and not an application. */
    const plan = planApply(
      { tables: [], columns: [], indexes: ["uq_storage_cleanup_items_batch_key"] },
      REAL,
    );
    expect(plan.apply).toEqual([]);
    expect(plan.unresolved).toEqual([]);
    expect(plan.refuse).toHaveLength(1);
    expect(plan.refuse[0].object).toBe("index uq_storage_cleanup_items_batch_key");
    expect(plan.refuse[0].statement.reason).toContain("DROP INDEX");
  });

  it("⚠ tells UNRESOLVED apart from REFUSED — they send a shift to different places", () => {
    const plan = planApply(
      { tables: ["a_table_nothing_in_this_repository_creates"], columns: [], indexes: [] },
      REAL,
    );
    expect(plan.apply).toEqual([]);
    expect(plan.refuse).toEqual([]);
    expect(plan.unresolved).toEqual(["table a_table_nothing_in_this_repository_creates"]);
  });

  it("⚠ will not half-run an ALTER whose other column the database already holds", () => {
    /* DDL is not partial. `ALTER TABLE t ADD a, ADD b` where `b` is present is
       a duplicate-column error that aborts the whole statement — so a
       statement that only PARTLY answers the gap is NAMED, never sent. */
    const statements = statementsFrom([
      { name: "x.sql", sql: "ALTER TABLE `t` ADD `a` int, ADD `b` int;" },
    ]);
    const plan = planApply({ tables: [], columns: ["t.a"], indexes: [] }, statements);
    expect(plan.apply).toEqual([]);
    expect(plan.refuse).toHaveLength(1);
    expect(plan.refuse[0].statement.reason).toContain("DDL is not partial");
    expect(plan.refuse[0].statement.reason).toContain("column t.b");
  });

  it("⚠ a CREATE TABLE is NOT disqualified by its own inline constraints", () => {
    /* The mirror of the arm above, and the reason `incidentalIndexes` exists:
       a table's `CONSTRAINT x UNIQUE(…)` arrives with it whether anything asked
       for it or not. Requiring those to be in the missing set would refuse
       every CREATE TABLE this repository has. */
    const statements = statementsFrom([
      { name: "x.sql", sql: "CREATE TABLE `t` (\n`id` int NOT NULL,\nCONSTRAINT `t_id` PRIMARY KEY(`id`)\n);" },
    ]);
    const plan = planApply({ tables: ["t"], columns: [], indexes: [] }, statements);
    expect(plan.apply).toHaveLength(1);
    expect(plan.refuse).toEqual([]);
  });

  it("selects a statement ONCE even when it answers several missing objects", () => {
    const statements = statementsFrom([
      { name: "x.sql", sql: "ALTER TABLE `t` ADD `a` int, ADD `b` int;" },
    ]);
    const plan = planApply({ tables: [], columns: ["t.a", "t.b"], indexes: [] }, statements);
    expect(plan.apply).toHaveLength(1);
  });
});

describe("the applier — the executor is injected so the failure roads can be driven", () => {
  const statements = statementsFrom([
    { name: "x.sql", sql: "CREATE TABLE `t` (\n`id` int NOT NULL\n);" },
    { name: "x.sql", sql: "CREATE INDEX `ix_t` ON `t` (`id`);" },
  ]);
  const plan = planApply({ tables: ["t"], columns: [], indexes: ["ix_t"] }, statements);
  const clean = async (): Promise<MissingObjects> => ({ tables: [], columns: [], indexes: [] });

  it("⚠ CONTROL — the plan under test is not empty", () => {
    expect(plan.apply).toHaveLength(2);
  });

  it("sends every statement in order and reports them", async () => {
    const sent: string[] = [];
    const outcome = await applyPlan(plan, async (sql) => { sent.push(sql.slice(0, 12)); }, clean);
    expect(sent).toEqual(["CREATE TABLE", "CREATE INDEX"]);
    expect(outcome.applied).toHaveLength(2);
    expect(outcome.failure).toBeNull();
    expect(outcome.stillAbsent).toEqual([]);
  });

  it("⚠ STOPS at the first failure and does not attempt what comes after it", async () => {
    /* A CREATE INDEX after a CREATE TABLE that did not happen fails for a
       second, less legible reason. One clear error beats a cascade of derived
       ones — and the statements that DID land are still reported, because a
       partial migration a shift does not know about is the worst outcome here. */
    const sent: string[] = [];
    const outcome = await applyPlan(
      plan,
      async (sql) => { sent.push(sql.slice(0, 12)); throw new Error("ER_TABLE_EXISTS_ERROR"); },
      clean,
    );
    expect(sent).toEqual(["CREATE TABLE"]);
    expect(outcome.applied).toEqual([]);
    expect(outcome.failure?.message).toBe("ER_TABLE_EXISTS_ERROR");
  });

  it("⚠ THE ARM THAT MATTERS — every statement returns cleanly and the object is STILL ABSENT", async () => {
    /* Working law 1. A driver that returned without throwing says the statement
       was ACCEPTED; only the read-back says the object is THERE. Without this
       arm a migration that silently did nothing would be reported as applied,
       which is precisely the green-claim-with-no-fact-under-it this project has
       been bitten by. */
    const outcome = await applyPlan(
      plan,
      async () => {},
      async () => ({ tables: ["t"], columns: [], indexes: ["ix_t"] }),
    );
    expect(outcome.applied).toHaveLength(2);
    expect(outcome.failure).toBeNull();
    expect(outcome.stillAbsent).toEqual(["table t", "index ix_t"]);
  });

  it("⚠ does not report an unrelated absence as a failure of THIS migration", async () => {
    /* NEGATIVE CONTROL for the arm above. The read-back names everything the
       database still lacks; only the objects this plan claimed to create are
       this plan's problem. */
    const outcome = await applyPlan(
      plan,
      async () => {},
      async () => ({ tables: ["some_other_table"], columns: [], indexes: [] }),
    );
    expect(outcome.stillAbsent).toEqual([]);
  });

  it("an empty plan sends nothing and reads back clean", async () => {
    let calls = 0;
    const outcome = await applyPlan(
      { apply: [], refuse: [], unresolved: [] },
      async () => { calls += 1; },
      clean,
    );
    expect(calls).toBe(0);
    expect(outcome.applied).toEqual([]);
    expect(outcome.stillAbsent).toEqual([]);
  });
});

describe("the rite is the only caller, and it is wired", () => {
  /*
    INVARIANT 7 — a control that is not invoked does not exist. This file's
    subject decides a production write; if the rite ever stops calling it, every
    arm above stays green while nothing runs. Four of this page's own mechanisms
    shipped with no caller (#286), which is why the wiring is asserted rather
    than assumed.
  */
  const RITE = readFileSync("scripts/deploy-rite.mts", "utf8");

  it("⚠ the deploy rite imports the planner and the applier", () => {
    expect(RITE).toContain('from "./lib/ceremonyAutoApply.mts"');
    expect(RITE).toContain("autoApplyMigrations");
    expect(RITE).toContain("migrationFilesFrom");
  });

  it("⚠ it CALLS the applier on the request path, not merely imports it", () => {
    /* An import is not a call site — the sensitive-action gate sat on
       CLAUDE.md's un-wired list for four days on exactly that confusion. */
    expect(RITE).toContain("await autoApply(connection,");
    expect(RITE).toContain("execute: async (sql) => { await connection.query(sql); },");
  });

  it("⚠ `--dry` plans and prints and writes NOTHING — and it is guarded TWICE", () => {
    /* A rehearsal that migrated production would be the worst possible reading
       of the word, and `--dry` is what every operator reaches for first.

       ⚠ THE FIRST GUARD IS THE RITE'S OWN SHAPE and it is the one that actually
       fires today: `DRY RUN — stopping before the watch` exits the process
       several hundred lines ABOVE the migration step, so a `--dry` run never
       reaches it at all. That is protection by ORDERING, which is exactly the
       kind that a later reshuffle removes without anyone noticing — so the
       order is asserted here rather than relied on, and the migration step
       carries its own `DRY` branch as the second guard. */
    expect(RITE.indexOf("DRY RUN — stopping before the watch"))
      .toBeLessThan(RITE.indexOf("5a-bis"));
    expect(RITE).toContain("dry: DRY,");
  });

  it("⚠ a refusal or a failure becomes a PROBLEM, which is what costs the run its exit code", () => {
    /* The rite exits on `schema.problems.length`. A refusal that only printed
       would be a warning nobody reads on the one road where the consequence is
       a production database. */
    expect(RITE).toContain("...migration.problems");
  });
});
