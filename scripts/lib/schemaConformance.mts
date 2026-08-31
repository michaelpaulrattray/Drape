/**
 * DOES THE DATABASE HOLD WHAT THE CODE SAYS IT DOES?
 *
 * `CLAUDE.md` says of six flags, in six separate paragraphs, that a table *"must
 * exist before this is flipped on — production takes it by the ceremony
 * script"*. Every one of those is a promise about a hand-run act, and it is a
 * promise **nothing has ever checked.** The boot guards deliberately do not:
 * `CASTING_INK_STUDIO_SCOPE`'s own paragraph says its table is *"a named
 * prerequisite of the FLIP rather than a boot guard"*, and gives the reason —
 * the writer catches its own failure, so a missing table costs a TALLY and
 * never a customer's answer. That is exactly the shape of a mistake nobody
 * finds: quiet, and only in the record.
 *
 * So this compares the tables and columns `drizzle/schema.ts` DECLARES against
 * what `information_schema` holds. Derived on both sides — the code side at the
 * declaration (never a scrape of the migration files, which are a second list),
 * the database side from the database.
 *
 * # What it found on its first run, in BOTH worlds
 *
 * 60 tables declared, 59 present, and the same one absent from dev and
 * production alike: `casting_cast_segments`. Migration `0027` was written and
 * never applied anywhere, and **nothing reads or writes the table** — the only
 * mentions in the tree are its own declaration and its two inferred types. Its
 * migration says so in its own header: *"nothing reads or writes it until the
 * Sign promotion merges — so this may land ahead of its code."* The migration
 * landed ahead of code that never came.
 *
 * Dormant rather than broken, and it is enumerated below rather than deleted or
 * quietly skipped, because the day the Sign promotion merges it stops being
 * dormant in two worlds at once.
 *
 * # Why the exception list only shrinks
 *
 * Same rule as the capability atlas's `KNOWN_DEBTS`: a row that becomes present
 * is an ERROR until its line is deleted. An exception nobody has to remove is
 * an exception that outlives its reason.
 *
 * # ⚠ WHAT IT DOES NOT SEE — PRESENCE, NEVER SHAPE
 *
 * It compares NAMES. A column that exists satisfies it whatever its type,
 * width, nullability or default — so a `varchar(220)` where the code now wants
 * 800, or a `NOT NULL` the code reads as optional, passes this reader without
 * a word.
 *
 * That is a real limit rather than a theoretical one, and it was found by
 * needing the answer (2026-08-25): §10 item 3e raises the refine cap, the
 * column that stores a customer's sentence is `varchar(220)`, and **the rite's
 * `OK` had to be set aside and `information_schema` read directly** to learn
 * it. A reader whose verdict is quoted as *"every table, column and named
 * index the code declares is there"* will be read as covering the shape of
 * them unless it says otherwise — which is what this paragraph is for.
 *
 * Widening it to compare types is a bigger job than it looks (drizzle's
 * declaration and MySQL's `COLUMN_TYPE` disagree in spelling on several kinds,
 * so a naive comparison would raise noise on rows that are correct) and it is
 * deliberately not attempted here. **Until it is, a claim about a column's
 * WIDTH is taken at the database and not off this verdict.**
 */

export type DeclaredSchema = ReadonlyMap<string, ReadonlySet<string>>;
export type LiveSchema = ReadonlyMap<string, ReadonlySet<string>>;

/**
 * Tables the code declares that the database is KNOWN not to hold, each with
 * the reason it is tolerated. Only ever gets shorter.
 */
export const DECLARED_BUT_UNMIGRATED: Readonly<Record<string, string>> = {
  casting_cast_segments:
    "migration 0027, never applied in either world. Nothing reads or writes it — "
    + "the only mentions in the tree are its own declaration and its two inferred "
    + "types — and its migration header says it may land ahead of its code, which "
    + "it did. Delete this line the day the Sign promotion merges, and run 0027 "
    + "in BOTH worlds first (a production migration is a founder ceremony).",
};

/**
 * COLUMNS the code declares on a table that EXISTS, which the database is known
 * not to hold yet — each with the reason it is tolerated. Only ever shorter.
 *
 * ⚠ **THE TABLE LIST ABOVE COULD NOT EXPRESS THIS, AND THAT GAP HAD TEETH.** A
 * column added to a live table is a founder ceremony exactly as a table is, but
 * until it runs the rite exits 1 on the mismatch — so the FIRST additive column
 * in this repository's history would have blocked every other shift's
 * doc/briefing push until he woke up and ran one command. Enumerating it keeps
 * the rite honest (it still says the column is absent) without making one
 * shift's pending ceremony everyone else's outage.
 *
 * Keyed `table.column`, and it carries the same shrink rule as the table list:
 * the day the column appears, this line and its pin in
 * `server/schemaConformance.test.ts` are deleted in the SAME commit.
 */
export const DECLARED_COLUMNS_BUT_UNMIGRATED: Readonly<Record<string, string>> = {
  "crew_queue_counts.excluded":
    "migration 0058 (#324) — what the switch count left out, and why. Production "
    + "takes it by scripts/ceremony-crew-queue-count-exclusions.mts, which is a "
    + "founder act. Both sides already run without it: the writer asks SHOW COLUMNS "
    + "and falls back to today's count-only INSERT, and the reader catches "
    + "ER_BAD_FIELD_ERROR and re-reads without it, so the Crew tab cannot fall to a "
    + "blank page meanwhile. Delete this line and its pin in "
    + "server/schemaConformance.test.ts the day the ceremony runs, in ONE commit.",
};

export type ConformanceVerdict = {
  readonly declaredTables: number;
  readonly liveTables: number;
  /** Declared, absent, and NOT enumerated above. */
  readonly missingTables: string[];
  /** Declared on a table that exists, absent from it, and NOT enumerated above. */
  readonly missingColumns: string[];
  /** A named index the schema declares and the database does not hold. */
  readonly missingIndexes: string[];
  /** Enumerated as unmigrated and now PRESENT — the list must shrink. */
  readonly staleExceptions: string[];
  readonly problems: string[];
};

/*
  ⚠ `columnExceptions` is injectable, and the reason is a defect this guard had
  the day its list first emptied (2026-08-31, #285's ceremony).

  Two arms — "tolerates the enumerated column while the ceremony has not run"
  and "ERRORS when the enumerated column turns out to be PRESENT" — tested the
  MECHANISM using whatever real entry happened to be in
  `DECLARED_COLUMNS_BUT_UNMIGRATED`. So the mechanism could only be tested while
  the list was non-empty, and **the guard could not reach its own correct
  resting state**: deleting the last exception, exactly as every ceremony's
  closing line orders, turned two passing arms red.

  A test of the rule must not depend on live data the rule is about. The
  parameter defaults to the real list, so every production caller is unchanged.
*/
export function conformanceVerdict(
  declared: DeclaredSchema,
  live: LiveSchema,
  indexes?: { declared: ReadonlyMap<string, string>; live: ReadonlySet<string> },
  columnExceptions: Readonly<Record<string, string>> = DECLARED_COLUMNS_BUT_UNMIGRATED,
): ConformanceVerdict {
  const missingTables: string[] = [];
  const missingColumns: string[] = [];
  const missingIndexes: string[] = [];
  const staleExceptions: string[] = [];

  /* An index on a table that is enumerated as unmigrated is not a second
     finding — the three on `casting_cast_segments` would otherwise triple one
     known absence into four. The TABLE is the thing that is missing. */
  for (const [name, table] of indexes?.declared ?? []) {
    if (table in DECLARED_BUT_UNMIGRATED) continue;
    if (!indexes!.live.has(name)) missingIndexes.push(`${table}.${name}`);
  }

  for (const [table, columns] of [...declared].sort(([a], [b]) => a.localeCompare(b))) {
    const present = live.get(table);
    if (!present) {
      if (!(table in DECLARED_BUT_UNMIGRATED)) missingTables.push(table);
      continue;
    }
    if (table in DECLARED_BUT_UNMIGRATED) staleExceptions.push(table);
    for (const column of [...columns].sort()) {
      const qualified = `${table}.${column}`;
      if (!present.has(column)) {
        if (!(qualified in columnExceptions)) missingColumns.push(qualified);
        continue;
      }
      /* Present AND enumerated as unmigrated — the ceremony has run and the
         exception outlived its reason. Same shrink rule as a stale table. */
      if (qualified in columnExceptions) staleExceptions.push(qualified);
    }
  }

  const problems = [
    ...missingTables.map(
      (table) =>
        `${table}: declared in drizzle/schema.ts and ABSENT from the database — a migration this code depends on has not been run here`,
    ),
    ...missingColumns.map(
      (column) =>
        `${column}: the table exists and this column does not — a column on a written table is in every INSERT`,
    ),
    ...missingIndexes.map(
      (index) =>
        `${index}: a named index the schema declares and this database does not hold — an index-only ceremony that never ran leaves the table looking perfectly conforming`,
    ),
    ...staleExceptions.map(
      (name) =>
        `${name}: listed as unmigrated and the database HAS it now — delete that line, the list only shrinks`,
    ),
  ];

  return {
    declaredTables: declared.size,
    liveTables: live.size,
    missingTables,
    missingColumns,
    missingIndexes,
    staleExceptions,
    problems,
  };
}

/** `information_schema.COLUMNS` rows, folded into a live schema. */
export function liveSchemaFrom(rows: ReadonlyArray<{ t: string; c: string }>): LiveSchema {
  const live = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!live.has(row.t)) live.set(row.t, new Set());
    live.get(row.t)!.add(row.c);
  }
  return live;
}

/**
 * The tables and columns `drizzle/schema.ts` declares, read at the AST.
 *
 * ⚠ THE COLUMN NAME IS THE STRING, NEVER THE KEY. Drizzle writes
 * `someKey: varchar("actual_column_name", …)`, and the two differ often enough
 * in this schema that reading the key would produce a confident list of columns
 * the database has never heard of — a reader wrong in the direction that
 * invents findings.
 *
 * Takes the source TEXT rather than a `Project`, so the arm can drive it over
 * fixtures without a tsconfig or a file system.
 */
/**
 * The columns of ONE table's shape object.
 *
 * ⚠ **MULTILINE, AND NOT BY TASTE.** The first version required the string on
 * the same LINE as the key, and lost exactly two columns of the 874 —
 * `coverageBasis` and `selectionReason`, both declared as
 * `mysqlEnum(\n  "name",\n  SOME_CONST,\n)` because the constant made the line
 * long. That is the same trap `server/claudeMdFlagEnumeration.test.ts` warns
 * about in its own header, met again one file over; it was caught by driving
 * this reader against an independent ts-morph one rather than by reasoning.
 *
 * Depth is tracked so that a nested options object cannot contribute a key,
 * and it is computed per CHARACTER rather than per line, because the whole
 * point is that a declaration may span lines.
 */
function columnsOf(body: string): Set<string> {
  const depthAt: number[] = new Array(body.length);
  let depth = 0;
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (character === "}" || character === "]") depth -= 1;
    depthAt[index] = depth;
    if (character === "{" || character === "[") depth += 1;
  }

  const columns = new Set<string>();
  const column = /([A-Za-z_$][\w$]*)\s*:\s*[A-Za-z_$][\w$]*\s*\(\s*"([^"]+)"/g;
  for (const hit of body.matchAll(column)) {
    if (depthAt[hit.index!] !== 0) continue;
    columns.add(hit[2]!);
  }
  return columns;
}

/**
 * The named indexes each table declares — index name to its table.
 *
 * ⚠ **THE COLUMN READER ALONE HAS A HOLE AND THIS IS IT.** Two migrations in
 * this repo change nothing a `COLUMNS` query can see: `0006_sticky_eternals` and
 * `0050_ink_delivery_keyed_on_delivery`, which swaps a unique index and widens a
 * column to NULL. `0050` is one of the twenty-six applied by hand-run CEREMONY
 * rather than by `drizzle-kit` — the journal stops at `0026` — so it is exactly
 * the kind of act with no ledger anywhere, and a table-and-column check would
 * have called a database conforming with the wrong uniqueness on it. Measured at
 * both databases 2026-08-23 before this was written: `0050` HAD run in both, so
 * this closes the hole rather than reporting one.
 *
 * NULLABILITY is still outside the reading and is stated rather than left to be
 * discovered: `0050`'s third statement widens `designId` to NULL, and nothing
 * here would notice if that half alone were missed.
 */
export function declaredIndexesFrom(source: string): ReadonlyMap<string, string> {
  return parseSchema(source).indexes;
}

export function declaredSchemaFrom(source: string): DeclaredSchema {
  return parseSchema(source).tables;
}

function parseSchema(source: string): {
  tables: Map<string, Set<string>>;
  indexes: Map<string, string>;
} {
  const declared = new Map<string, Set<string>>();
  const indexes = new Map<string, string>();
  /* Each `mysqlTable("name", { … })` and the object literal that follows it.
     Brace-counted rather than lazily matched: a nested object in a column's
     options (drizzle takes them) ends a lazy match early and silently drops
     every column after it. */
  const opener = /mysqlTable\(\s*"([^"]+)"\s*,\s*\{/g;
  for (const hit of source.matchAll(opener)) {
    const table = hit[1]!;
    let depth = 1;
    let index = hit.index! + hit[0].length;
    const start = index;
    while (index < source.length && depth > 0) {
      const character = source[index];
      if (character === "{") depth += 1;
      else if (character === "}") depth -= 1;
      index += 1;
    }
    if (depth !== 0) {
      throw new Error(
        `mysqlTable("${table}") has an unbalanced object literal — the schema reader would silently return a short column list`,
      );
    }
    const body = source.slice(start, index - 1);
    declared.set(table, columnsOf(body));

    /* The THIRD argument, where drizzle declares named indexes:
       `(table) => ([ uniqueIndex("uq_…").on(…), index("ix_…").on(…) ])`.
       Scanned to the end of the `mysqlTable(` call by PAREN depth, because the
       shape object above was consumed by brace depth and stops short of it. */
    let parens = 1;
    let tail = index;
    while (tail < source.length && parens > 0) {
      const character = source[tail];
      if (character === "(") parens += 1;
      else if (character === ")") parens -= 1;
      tail += 1;
    }
    for (const hit of source.slice(index, tail).matchAll(/\b(?:uniqueIndex|index)\(\s*"([^"]+)"/g)) {
      indexes.set(hit[1]!, table);
    }
  }

  if (declared.size === 0) {
    throw new Error(
      "no mysqlTable declaration found — re-point this reader rather than letting it report a conforming schema over nothing",
    );
  }
  return { tables: declared, indexes };
}
