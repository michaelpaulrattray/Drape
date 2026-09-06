/**
 * ADDITIVE MIGRATIONS APPLY THEMSELVES; A DESTRUCTIVE ONE STOPS AND NAMES
 * ITSELF (founder order, 2026-08-31, issue #322, verbatim):
 *
 *   *"can you change the rules and allow for auto migration and ceremonies so
 *   it doesnt need to ask me to run commands ever again"*
 *
 * He ran three ceremonies by hand in twenty-four hours and each one held a
 * finished feature still. #285 sat built-and-unmerged for a night waiting on
 * one command. So the rule he removed is the one reserving production-database
 * migrations to him, and this file is the machinery that replaces it.
 *
 * # THE ONE DECISION THIS FILE MAKES, AND IT FAILS CLOSED
 *
 * A statement is APPLIED only if it is one of exactly three shapes:
 *
 *   * `CREATE TABLE …`
 *   * `CREATE [UNIQUE] INDEX …`
 *   * `ALTER TABLE … ADD …` where **EVERY** clause is an `ADD`
 *
 * Everything else is REFUSED and NAMED — never applied, never silently
 * skipped. The asymmetry is the whole design and it is not caution about the
 * code: an additive migration nobody wanted is a dead table, and a `DROP`
 * nobody wanted is data gone from a commercial product's production database
 * that no test can restore.
 *
 * # ⚠ THE CARD'S OWN PREMISE WAS WRONG AT THE BYTES, AND IT ARGUES *FOR* THE
 * FAIL-CLOSED SHAPE RATHER THAN AGAINST IT
 *
 * #322 says of the migration set: *"`CREATE TABLE` and `ALTER TABLE … ADD
 * COLUMN`. **No `DROP`, no `RENAME`, no type narrowing, no row rewrite
 * anywhere in the set.**"* Read at `drizzle/*.sql` on 2026-09-01 that is not
 * true: there are **3 `DROP INDEX`** statements and **19 `MODIFY COLUMN`**
 * ones, and two migrations mix the classes inside a single multi-clause
 * `ALTER TABLE` — `0012` is `DROP INDEX …, ADD CONSTRAINT …` and `0014` is
 * `MODIFY COLUMN …, ADD …, ADD CONSTRAINT …`.
 *
 * So a classifier that asked only *"does this statement contain an ADD"* would
 * have applied a `DROP INDEX` on its first real encounter. Every clause of an
 * `ALTER` must be additive for the statement to be additive; one destructive
 * clause makes the whole statement destructive. Both of those migrations are
 * long applied and neither is reachable by the planner below — they are kept
 * as the guard's fixtures precisely because they are the shape that would have
 * got through.
 *
 * The `MODIFY COLUMN` family is almost entirely enum WIDENING, which is
 * additive in spirit. It is still refused. Telling a widening from a narrowing
 * needs the current enum members compared with the target's, and a classifier
 * that is sometimes right about `MODIFY` is worse than one that is never
 * asked: the refusal costs one command, and it names the statement so that
 * command is never a guess.
 *
 * # NO SECOND LIST — THE PLAN IS DERIVED FROM BOTH ENDS
 *
 * Working law 4. There is no manifest of "ceremonies to run" anywhere: the
 * WANT comes from `drizzle/schema.ts` (what the code declares), the HAVE comes
 * from `information_schema` (what the service holds), and the DDL comes from
 * the migration files themselves — replayed rather than retyped, which is the
 * rule `scripts/ceremony-crew-card-intents.mts` already states in its own
 * body: *"a ceremony that re-types its own DDL is a second copy of the schema
 * and it drifts from the one every test ran against."*
 *
 * A missing object with **no** statement anywhere in `drizzle/` is neither
 * applied nor ignored — it is reported as UNRESOLVED, because "the code
 * declares a table and nothing in the repository creates it" is a finding.
 */

/** The three shapes that may run unattended. Anything else is refused. */
import {
  conformanceVerdict,
  declaredIndexesFrom,
  declaredSchemaFrom,
  liveSchemaFrom,
} from "./schemaConformance.mts";

export type StatementKind = "additive" | "destructive";

export type ParsedStatement = {
  /** The SQL as it will be sent, comments and the breakpoint marker stripped. */
  readonly sql: string;
  /** The migration file it came from, for the receipt and for any refusal. */
  readonly file: string;
  readonly kind: StatementKind;
  /**
   * Why it is destructive, in words a person can act on. Empty for additive.
   * Never a bare verb: the refusal has to be enough to run the command by hand.
   */
  readonly reason: string;
  /** Tables this statement CREATES. */
  readonly createsTables: readonly string[];
  /** `table.column` pairs this statement ADDs. */
  readonly addsColumns: readonly string[];
  /** Named indexes this statement CREATEs. */
  readonly createsIndexes: readonly string[];
  /**
   * Named constraints declared INSIDE a `CREATE TABLE` body. They arrive with
   * the table whether anything wanted them or not, which is why they are held
   * apart from `createsIndexes` — see `planApply`'s all-absent rule.
   */
  readonly incidentalIndexes: readonly string[];
};

/**
 * What the database lacks, in the three shapes the conformance reader speaks.
 * Columns are `table.column`; indexes are bare names, as
 * `information_schema.STATISTICS` holds them.
 */
export type MissingObjects = {
  readonly tables: readonly string[];
  readonly columns: readonly string[];
  readonly indexes: readonly string[];
};

export type ApplyPlan = {
  /** In file order, then statement order — a table before its own indexes. */
  readonly apply: readonly ParsedStatement[];
  /** A missing object whose only DDL is destructive. Named, never run. */
  readonly refuse: readonly { readonly object: string; readonly statement: ParsedStatement }[];
  /** A missing object with no DDL anywhere in `drizzle/`. */
  readonly unresolved: readonly string[];
};

/*
  A `--` line comment can contain anything, including the word DROP and an
  apostrophe, and `drizzle/0059` opens with ninety lines of them. Stripping
  them before classification is not cosmetic: the classifier reads verbs.
*/
function stripComments(sql: string): string {
  return sql
    .split(/\r?\n/)
    .map((line) => (line.trimStart().startsWith("--") ? "" : line))
    .join("\n");
}

/**
 * The clauses of an `ALTER TABLE`, split on top-level commas only — a comma
 * inside `enum('a','b')` or inside a `UNIQUE(x,y)` list is not a clause break,
 * and treating it as one splits `ADD CONSTRAINT x UNIQUE(a,b)` into a clause
 * beginning `b)` that no rule recognises.
 */
function alterClauses(body: string): string[] {
  const clauses: string[] = [];
  let depth = 0;
  let quoted = false;
  let current = "";
  for (const character of body) {
    if (character === "'") quoted = !quoted;
    if (!quoted && character === "(") depth += 1;
    if (!quoted && character === ")") depth -= 1;
    if (!quoted && depth === 0 && character === ",") {
      clauses.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  clauses.push(current);
  return clauses.map((clause) => clause.trim()).filter(Boolean);
}

/**
 * CLASSIFY ONE STATEMENT. The default is `destructive`: a shape this function
 * does not recognise is refused, so a migration idiom nobody anticipated stops
 * the run rather than running.
 */
export function classifyStatement(rawSql: string, file: string): ParsedStatement {
  const sql = stripComments(rawSql).trim().replace(/;\s*$/, "");
  const flat = sql.replace(/\s+/g, " ").trim();
  const destructive = (reason: string): ParsedStatement => ({
    sql, file, kind: "destructive", reason,
    createsTables: [], addsColumns: [], createsIndexes: [], incidentalIndexes: [],
  });

  const createTable = /^CREATE TABLE (?:IF NOT EXISTS )?`([^`]+)`/i.exec(flat);
  if (createTable) {
    /*
      A named `CONSTRAINT x UNIQUE(…)` inside the body IS an index, and
      `information_schema.STATISTICS` will hold it under that name once the
      table exists. `0027` declares two of them and one `CREATE INDEX`, so a
      reader that only counted the separate statement would report two of the
      table's own indexes as objects nothing in the repository creates.
    */
    const incidentalIndexes = [...flat.matchAll(/CONSTRAINT `([^`]+)` (?:UNIQUE|PRIMARY KEY|KEY|INDEX)(?![A-Za-z])/gi)]
      .map((match) => match[1]);
    return {
      sql, file, kind: "additive", reason: "",
      createsTables: [createTable[1]], addsColumns: [], createsIndexes: [], incidentalIndexes,
    };
  }

  const createIndex = /^CREATE (?:UNIQUE )?INDEX `([^`]+)` ON `([^`]+)`/i.exec(flat);
  if (createIndex) {
    return {
      sql, file, kind: "additive", reason: "",
      createsTables: [], addsColumns: [], createsIndexes: [createIndex[1]], incidentalIndexes: [],
    };
  }

  const alter = /^ALTER TABLE `([^`]+)`\s*(.*)$/i.exec(flat);
  if (alter) {
    const table = alter[1];
    const clauses = alterClauses(alter[2]);
    if (clauses.length === 0) return destructive("an ALTER TABLE with no clause this reader can see");
    const addsColumns: string[] = [];
    const createsIndexes: string[] = [];
    for (const clause of clauses) {
      /*
        ⚠ EVERY clause must be an ADD. `0012` is `DROP INDEX …, ADD CONSTRAINT
        …` and `0014` is `MODIFY COLUMN …, ADD …, ADD CONSTRAINT …`; a rule
        asking whether the statement CONTAINS an ADD applies both of them.
      */
      if (!/^ADD\b/i.test(clause)) {
        const verb = /^([A-Z]+(?: [A-Z]+)?)/i.exec(clause)?.[1]?.toUpperCase() ?? "an unreadable clause";
        return destructive(
          `\`${table}\`: the clause \`${clause}\` is ${verb}, not ADD — `
          + "a DROP, RENAME, MODIFY or row rewrite is never applied unattended",
        );
      }
      const constraint = /^ADD (?:CONSTRAINT )?`([^`]+)` (?:UNIQUE|PRIMARY KEY|KEY|INDEX)\b/i.exec(clause);
      if (constraint) { createsIndexes.push(constraint[1]); continue; }
      const column = /^ADD (?:COLUMN )?`([^`]+)`/i.exec(clause);
      if (column) { addsColumns.push(`${table}.${column[1]}`); continue; }
      return destructive(`\`${table}\`: the ADD clause \`${clause}\` names nothing this reader can identify`);
    }
    return { sql, file, kind: "additive", reason: "", createsTables: [], addsColumns, createsIndexes, incidentalIndexes: [] };
  }

  const verb = /^([A-Z]+(?: [A-Z]+)?)/i.exec(flat)?.[1]?.toUpperCase() ?? "an unreadable statement";
  return destructive(
    `${verb} is not one of CREATE TABLE, CREATE INDEX or ALTER TABLE … ADD — `
    + "this reader refuses every shape it does not positively recognise",
  );
}

/**
 * Every statement in every migration file, in file order. `files` arrives
 * already sorted by the caller, because `0009` must precede `0010` and a
 * default string sort over full paths gives that only by luck.
 */
export function statementsFrom(
  files: readonly { readonly name: string; readonly sql: string }[],
): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  for (const file of files) {
    /*
      ⚠ THE ORDER OF THESE THREE SPLITS IS LOAD-BEARING AND THE MIDDLE ONE WAS
      WRONG FIRST — found by driving the planner over the real set before it was
      wired to anything (#322).

      Breakpoints come first because `--> statement-breakpoint` is ITSELF a `--`
      line: stripping comments before splitting on it deletes every boundary
      drizzle wrote. Comments come SECOND, before the `;` split, because
      `drizzle/0049` line 112 is a prose comment INSIDE a `CREATE TABLE` body
      that happens to end in a semicolon — *"the identity source stays
      `casting_ink_designs`;"*. Splitting the raw text on `;` cut that table in
      half, and the reader then refused a statement it should have applied.

      It failed CLOSED, which is the design working; it was still a defect, and
      it is the guard's fixture now.
    */
    for (const chunk of file.sql.split("--> statement-breakpoint")) {
      const bare = stripComments(chunk);
      if (bare.trim() === "") continue;
      /*
        A chunk may still hold several statements: drizzle emits a table and its
        indexes with no breakpoint between them in the files it did not generate
        itself. No statement in this set carries a semicolon inside a string
        literal, and the guard asserts that rather than trusting it.
      */
      for (const piece of bare.split(/;\s*(?:\r?\n|$)/)) {
        if (piece.trim() === "") continue;
        statements.push(classifyStatement(piece, file.name));
      }
    }
  }
  return statements;
}

/**
 * WHAT TO RUN TONIGHT. Given what the database lacks and every statement the
 * repository holds, decide the three answers: apply, refuse, or say plainly
 * that nothing here creates it.
 *
 * A statement is selected once even when it discharges several missing objects
 * at a time — a `CREATE TABLE` carrying its own `PRIMARY KEY` answers both a
 * missing table and a missing index — and it keeps its file order, so a table
 * is always created before the `CREATE INDEX` that lands on it.
 */
export function planApply(missing: MissingObjects, statements: readonly ParsedStatement[]): ApplyPlan {
  const wanted = new Map<string, string[]>();
  const want = (object: string) => { if (!wanted.has(object)) wanted.set(object, []); };
  for (const table of missing.tables) want(`table ${table}`);
  for (const column of missing.columns) want(`column ${column}`);
  for (const index of missing.indexes) want(`index ${index}`);

  /* What the statement CANNOT be run unless it is absent. */
  const requiredBy = (statement: ParsedStatement): string[] => [
    ...statement.createsTables.map((table) => `table ${table}`),
    ...statement.addsColumns.map((column) => `column ${column}`),
    ...statement.createsIndexes.map((index) => `index ${index}`),
  ];
  /* Plus what simply arrives with it. A table's inline constraints come with
     the table; nobody chooses them, so they cannot disqualify it. */
  const answersOf = (statement: ParsedStatement): string[] => [
    ...requiredBy(statement),
    ...statement.incidentalIndexes.map((index) => `index ${index}`),
  ];

  const apply: ParsedStatement[] = [];
  const refuse: { object: string; statement: ParsedStatement }[] = [];
  const answered = new Set<string>();

  for (const statement of statements) {
    /*
      A DESTRUCTIVE statement names no targets — it is classified before it is
      read for what it creates, so it cannot answer anything. That is deliberate
      and it is why the refusal below scans the raw SQL instead: a missing
      object whose only DDL is a multi-clause ALTER must be REPORTED as refused
      rather than falling through to "nothing creates it", which would send a
      shift looking for a migration that is sitting right there.
    */
    if (statement.kind === "destructive") continue;
    const answers = answersOf(statement);
    if (!answers.some((object) => wanted.has(object) && !answered.has(object))) continue;
    /*
      ⚠ EVERY OBJECT THE STATEMENT CREATES MUST BE ABSENT, NOT MERELY ONE OF
      THEM. DDL is not partial: `ALTER TABLE t ADD a, ADD b` where `b` already
      exists is a duplicate-column error that aborts the whole statement, and a
      `CREATE TABLE` selected because one of its inline indexes is missing
      would fail on the table it is standing in. A statement that only PARTLY
      answers the gap is left to the refusal road below, where it is named with
      the object it could not be run for — never half-run, never silently
      dropped.
    */
    if (requiredBy(statement).some((object) => !wanted.has(object))) continue;
    apply.push(statement);
    for (const object of answers) answered.add(object);
  }

  /*
    THE REMAINDER IS TRIAGED, NEVER LUMPED. An object nobody creates and an
    object whose only DDL is a `DROP INDEX` send a shift to two different
    places, and reporting both as "nothing creates it" would send it looking for
    a migration that is sitting right there in the tree.
  */
  const unresolved: string[] = [];
  for (const object of [...wanted.keys()].filter((name) => !answered.has(name))) {
    const name = object.slice(object.indexOf(" ") + 1);
    const bare = name.includes(".") ? name.slice(name.indexOf(".") + 1) : name;
    const mentions = (statement: ParsedStatement) => statement.sql.includes(`\`${bare}\``);

    const blocker = statements.find((statement) => statement.kind === "destructive" && mentions(statement));
    if (blocker) { refuse.push({ object, statement: blocker }); continue; }

    /* Additive, and skipped above because it also creates something present. */
    const partial = statements.find((statement) => statement.kind === "additive" && mentions(statement));
    if (partial) {
      const already = answersOf(partial).filter((other) => !wanted.has(other));
      refuse.push({
        object,
        statement: {
          ...partial,
          reason:
            `the only statement that creates it also creates ${already.join(", ")}, `
            + "which this database already holds — DDL is not partial, so it is named rather than half-run",
        },
      });
      continue;
    }
    unresolved.push(object);
  }

  return { apply, refuse, unresolved };
}

export type ApplyOutcome = {
  /** Statements sent, in the order they were sent. */
  readonly applied: readonly ParsedStatement[];
  /** The first statement that threw, with the driver's message. Stops the run. */
  readonly failure: { readonly statement: ParsedStatement; readonly message: string } | null;
  /** Objects still absent after everything ran — working law 1, read back. */
  readonly stillAbsent: readonly string[];
};

/**
 * RUN THE PLAN AND READ IT BACK. The executor is injected so the guard can
 * drive every arm — including the failure arm — without a database, and so
 * this file cannot open a connection of its own to the wrong world.
 *
 * ⚠ **IT STOPS AT THE FIRST FAILURE RATHER THAN CONTINUING.** The statements
 * are ordered, and a `CREATE INDEX` after a `CREATE TABLE` that did not happen
 * would fail for a second, less legible reason. One clear error beats a cascade
 * of derived ones.
 *
 * ⚠ **AND `stillAbsent` IS THE VERDICT, NOT `applied`.** A statement that
 * returned without throwing says the driver accepted it; only the reader says
 * the object is there. Working law 1, and it is the same rule every ceremony
 * script in this repository already follows in its own closing paragraph.
 */
export async function applyPlan(
  plan: ApplyPlan,
  execute: (sql: string) => Promise<void>,
  readBack: () => Promise<MissingObjects>,
): Promise<ApplyOutcome> {
  const applied: ParsedStatement[] = [];
  for (const statement of plan.apply) {
    try {
      await execute(statement.sql);
      applied.push(statement);
    } catch (cause) {
      return {
        applied,
        failure: { statement, message: (cause as Error).message },
        stillAbsent: [],
      };
    }
  }
  const after = await readBack();
  const wanted = new Set(plan.apply.flatMap((statement) => [
    ...statement.createsTables.map((table) => `table ${table}`),
    ...statement.addsColumns.map((column) => `column ${column}`),
    ...statement.createsIndexes.map((index) => `index ${index}`),
    ...statement.incidentalIndexes.map((index) => `index ${index}`),
  ]));
  const stillAbsent = [
    ...after.tables.map((table) => `table ${table}`),
    ...after.columns.map((column) => `column ${column}`),
    ...after.indexes.map((index) => `index ${index}`),
  ].filter((object) => wanted.has(object));
  return { applied, failure: null, stillAbsent };
}

export type MigrationReport = {
  /** Receipt lines, in the order they should be printed. */
  readonly lines: readonly string[];
  /** Anything that costs the run its exit code. */
  readonly problems: readonly string[];
  /**
   * The subset of `problems` that mean the WRITE PATH itself failed — a
   * statement that errored, or an object still absent after its statement ran.
   * A REFUSED destructive statement and an unresolved declaration are problems
   * but not blockers: they describe a ceremony that is waiting, not a write
   * that went wrong. The pre-deploy road (#508) exits 1 only on these, because
   * a waiting ceremony must not wedge every subsequent deploy while a failed
   * write must never let the new build take traffic.
   */
  readonly blocking: readonly string[];
  readonly applied: number;
};

/**
 * The bridge from a conformance verdict's field names to the planner's — the
 * one mapping both deploy roads share (`table.index` on the way out of the
 * verdict; bare on the way into the planner, because that is how the database
 * names them). It existed inline in the rite; the pre-deploy command (#508)
 * is a second caller, and two copies of a `.slice` like this drift
 * (working law 4).
 */
export function missingObjectsFrom(verdict: {
  readonly missingTables: readonly string[];
  readonly missingColumns: readonly string[];
  readonly missingIndexes: readonly string[];
}): MissingObjects {
  return {
    tables: verdict.missingTables,
    columns: verdict.missingColumns,
    indexes: verdict.missingIndexes.map((name) => name.slice(name.indexOf(".") + 1)),
  };
}

/**
 * THE ONE READING BOTH DEPLOY ROADS PLAN THEIR WRITES FROM (review of #584,
 * finding 1). The rite and the pre-deploy command each held their own copy of
 * this closure — the two `information_schema` queries, the empty-COLUMNS
 * guard, the raw-vs-tolerated verdict pair — and the copy that decided a
 * production write was the newer one. Two copies of a reading drift (working
 * law 4), so the reading lives here and the callers inject only how to run a
 * query.
 *
 * The empty-COLUMNS refusal is working law 2, and since #322 this reader
 * DECIDES A WRITE rather than only reporting: an empty result is the whole
 * basis for deciding to CREATE, and it is also exactly what a wrong database
 * or a silently failed query looks like.
 *
 * Two verdicts from one pair of queries, deliberately: `missing` comes from
 * the RAW comparison (empty exception lists — an enumerated table is
 * precisely the one the applier most needs to see), while `verdict` is the
 * tolerated one the receipts print.
 */
export async function readSchemaGap(
  schemaSource: string,
  query: (sql: string) => Promise<any[]>,
): Promise<{
  verdict: ReturnType<typeof conformanceVerdict>;
  missing: MissingObjects;
  declaredIndexCount: number;
}> {
  const declared = declaredSchemaFrom(schemaSource);
  const declaredIndexes = declaredIndexesFrom(schemaSource);
  const rows = await query(
    `SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()`,
  );
  const indexRows = await query(
    `SELECT DISTINCT INDEX_NAME AS n FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()`,
  );
  if (rows.length === 0) throw new Error("information_schema returned no columns at all");
  const live = liveSchemaFrom(rows as Array<{ t: string; c: string }>);
  const indexes = {
    declared: declaredIndexes,
    live: new Set((indexRows as Array<{ n: string }>).map((row) => row.n)),
  };
  const raw = conformanceVerdict(declared, live, indexes, {}, {});
  return {
    verdict: conformanceVerdict(declared, live, indexes),
    missing: missingObjectsFrom(raw),
    declaredIndexCount: declaredIndexes.size,
  };
}

/** What a statement does, in one line, for the receipt. Never the whole DDL. */
function summarise(statement: ParsedStatement): string {
  return [
    ...statement.createsTables.map((table) => `CREATE TABLE \`${table}\``),
    ...statement.addsColumns.map((column) => `ADD \`${column}\``),
    ...statement.createsIndexes.map((index) => `INDEX \`${index}\``),
  ].join(", ");
}

/**
 * THE WHOLE STEP, IN ONE FUNCTION THE GUARD CAN DRIVE.
 *
 * ⚠ It lives here rather than inside `deploy-rite.mts` for one reason and it is
 * a hard-won one: the rite's own `--dry` exits several hundred lines ABOVE the
 * schema step, so a rehearsal never reaches the migration and there is no way
 * to drive this end to end from the rite at all. Left in the rite, the only
 * proof of the glue would be a grep over its source — and the first real run
 * would be a production write nobody had ever executed.
 *
 * With it here, `scripts/_322-rehearse-disposable.mts` runs the EXACT code path
 * against dev, and the guard drives every branch with an injected executor.
 * The rite becomes one call.
 *
 * `readFile` and `listDir` are injected for the same reason.
 */
export async function autoApplyMigrations(options: {
  readonly missing: MissingObjects;
  readonly readBack: () => Promise<MissingObjects>;
  readonly execute: (sql: string) => Promise<void>;
  readonly listMigrations: () => readonly { readonly name: string; readonly sql: string }[];
  readonly dry: boolean;
}): Promise<MigrationReport> {
  const { missing, readBack, execute, listMigrations, dry } = options;
  const outstanding = missing.tables.length + missing.columns.length + missing.indexes.length;
  if (outstanding === 0) {
    return { lines: ["nothing pending — the service holds everything the code declares"], problems: [], blocking: [], applied: 0 };
  }

  const files = listMigrations();
  /*
    A DDL SOURCE THAT CAME UP EMPTY WOULD READ EXACTLY LIKE "NOTHING TO DO" —
    every missing object would fall through to UNRESOLVED and the run would fail
    for the wrong reason, pointing a shift at the schema instead of at the
    reader. It refuses rather than returning a short list; the class the Atlas's
    four collectors were fixed for.
  */
  if (files.length === 0) throw new Error("drizzle/ holds no .sql files — the DDL source could not be read");

  const plan = planApply(missing, statementsFrom(files));
  const lines: string[] = [];
  const problems: string[] = [];

  for (const { object, statement } of plan.refuse) {
    problems.push(
      `${object}: REFUSED — ${statement.reason}. Run it yourself when you want it: `
      + `the statement is in ${statement.file}.`,
    );
  }
  for (const object of plan.unresolved) {
    problems.push(`${object}: declared in drizzle/schema.ts and NOTHING in drizzle/*.sql creates it`);
  }

  if (plan.apply.length === 0) {
    lines.push(`${outstanding} pending · 0 applied · ${plan.refuse.length} refused · ${plan.unresolved.length} unresolved`);
    return { lines, problems, blocking: [], applied: 0 };
  }

  if (dry) {
    for (const statement of plan.apply) lines.push(`would apply: ${statement.file} — ${summarise(statement)}`);
    lines.push(
      `${outstanding} pending · ${plan.apply.length} would apply · ${plan.refuse.length} refused `
      + "(--dry: nothing was written)",
    );
    return { lines, problems, blocking: [], applied: 0 };
  }

  const outcome = await applyPlan(plan, execute, readBack);
  const blocking: string[] = [];
  for (const statement of outcome.applied) lines.push(`applied: ${statement.file} — ${summarise(statement)}`);
  if (outcome.failure) {
    blocking.push(
      `${outcome.failure.statement.file}: the migration FAILED — ${outcome.failure.message}. `
      + `${outcome.applied.length} statement(s) before it did land; nothing after it was attempted.`,
    );
  }
  for (const object of outcome.stillAbsent) {
    blocking.push(`${object}: the statement creating it ran without error and the object is STILL ABSENT — stop and investigate`);
  }
  problems.push(...blocking);
  lines.push(
    `${outstanding} pending · ${outcome.applied.length} applied · ${plan.refuse.length} refused `
    + `· ${plan.unresolved.length} unresolved · ${outcome.stillAbsent.length} still absent after the read-back`,
  );
  return { lines, problems, blocking, applied: outcome.applied.length };
}

/** The real `drizzle/` listing, in the order the applier must replay it. */
export function migrationFilesFrom(
  readDir: (dir: string) => string[],
  readFile: (file: string) => string,
): Array<{ name: string; sql: string }> {
  return readDir("drizzle")
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({ name: `drizzle/${name}`, sql: readFile(`drizzle/${name}`) }));
}
