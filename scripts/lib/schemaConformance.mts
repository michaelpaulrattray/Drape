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

export type ConformanceVerdict = {
  readonly declaredTables: number;
  readonly liveTables: number;
  /** Declared, absent, and NOT enumerated above. */
  readonly missingTables: string[];
  /** Declared on a table that exists, absent from it. */
  readonly missingColumns: string[];
  /** Enumerated as unmigrated and now PRESENT — the list must shrink. */
  readonly staleExceptions: string[];
  readonly problems: string[];
};

export function conformanceVerdict(declared: DeclaredSchema, live: LiveSchema): ConformanceVerdict {
  const missingTables: string[] = [];
  const missingColumns: string[] = [];
  const staleExceptions: string[] = [];

  for (const [table, columns] of [...declared].sort(([a], [b]) => a.localeCompare(b))) {
    const present = live.get(table);
    if (!present) {
      if (!(table in DECLARED_BUT_UNMIGRATED)) missingTables.push(table);
      continue;
    }
    if (table in DECLARED_BUT_UNMIGRATED) staleExceptions.push(table);
    for (const column of [...columns].sort()) {
      if (!present.has(column)) missingColumns.push(`${table}.${column}`);
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
    ...staleExceptions.map(
      (table) =>
        `${table}: listed in DECLARED_BUT_UNMIGRATED and the database HAS it now — delete that line, the list only shrinks`,
    ),
  ];

  return {
    declaredTables: declared.size,
    liveTables: live.size,
    missingTables,
    missingColumns,
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

export function declaredSchemaFrom(source: string): DeclaredSchema {
  const declared = new Map<string, Set<string>>();
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
  }

  if (declared.size === 0) {
    throw new Error(
      "no mysqlTable declaration found — re-point this reader rather than letting it report a conforming schema over nothing",
    );
  }
  return declared;
}
