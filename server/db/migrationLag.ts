/**
 * IS THIS DATABASE BEHIND THE CODE THAT IS ABOUT TO RUN AGAINST IT?
 *
 * # The incident (2026-08-09, fable-125's order)
 *
 * The segments panel could not be rendered locally because the dev database
 * threw `Unknown column 'v.parentVariantId'`. Production had had that column
 * since the ceremony — dev was one migration behind, while holding the
 * `casting_segments` table it belongs to. So `listLineageSegments`' recursive
 * walk, the whole carried-segment path, and the panel endpoint were **all
 * untestable locally**, and would have thrown on the first local refine that
 * tried to carry anything.
 *
 * Nobody noticed until somebody happened to render. That is the class:
 *
 * > **A test surface that reports green by not running.**
 *
 * The suite was green the whole time, honestly, because `vitest.setup.ts`
 * strips `DATABASE_URL` on purpose and no unit test can reach a database. The
 * gap is not in the suite; it is between the suite and the machine.
 *
 * # Why this reads the LEDGER rather than the schema
 *
 * Drizzle decides what to apply by comparing each journal entry's `when`
 * against the newest `created_at` in `__drizzle_migrations`. Reading the same
 * two things it reads means this cannot disagree with the migrator about what
 * is outstanding — a checker with its own opinion of "applied" would eventually
 * be confidently wrong in the other direction (law 4).
 *
 * It reports and never refuses. A developer whose database is behind needs to
 * be told which migrations to run, at the moment they sit down; a boot that
 * refuses would turn a five-second fix into a blocked morning, and this is a
 * convenience check rather than a security control.
 */
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("db/migrationLag");

export type JournalEntry = { tag: string; when: number };

/**
 * Which migrations the journal holds that this database has not applied.
 *
 * Ordered, because migrations are: everything newer than the newest applied
 * one is outstanding, which is exactly the migrator's own rule. An EMPTY ledger
 * means none of them have run, which is a legitimate state (a fresh database)
 * and is reported as every entry outstanding rather than as "up to date".
 */
export function unappliedMigrations(input: {
  entries: readonly JournalEntry[];
  /** `created_at` values from `__drizzle_migrations`. */
  applied: readonly number[];
}): string[] {
  const newest = input.applied.length === 0 ? -1 : Math.max(...input.applied.map(Number));
  return input.entries
    .filter((entry) => Number(entry.when) > newest)
    .map((entry) => entry.tag);
}

/**
 * Say so, once, at boot — and name the migrations rather than the count.
 *
 * "3 migrations behind" sends someone to look them up; naming them is the whole
 * value, because the next thing they type is the one that fixes it.
 */
export function reportMigrationLag(input: {
  entries: readonly JournalEntry[];
  applied: readonly number[];
  environment: string;
}): string[] {
  const outstanding = unappliedMigrations(input);
  if (outstanding.length === 0) return [];
  log.error(
    { environment: input.environment, outstanding },
    `[migrations] this database is ${outstanding.length} migration(s) behind the code`
    + " — run `pnpm db:push`. Paths that touch these tables will fail rather than skip.",
  );
  return outstanding;
}

/**
 * The dev-boot consumer — a control that is not invoked does not exist.
 *
 * Reads the journal off disk and the ledger out of the database, and says
 * nothing at all when they agree. Every failure mode here is a shrug: no
 * database, no journal, no ledger table (a database that has never been
 * migrated by drizzle is not this check's business to diagnose).
 */
export async function checkDevMigrationLag(): Promise<string[]> {
  if (!process.env.DATABASE_URL) return [];
  const { readFile } = await import("node:fs/promises");
  const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8")) as {
    entries?: JournalEntry[];
  };
  if (!Array.isArray(journal.entries) || journal.entries.length === 0) return [];

  const { getDb } = await import("./connection");
  const db = await getDb();
  if (!db) return [];
  const { sql } = await import("drizzle-orm");
  const result = await db.execute(sql`SELECT created_at FROM __drizzle_migrations`);
  const rows = (Array.isArray(result) ? result[0] : (result as { rows?: unknown }).rows ?? result);
  const applied = (Array.isArray(rows) ? rows : [])
    .map((row) => Number((row as { created_at?: unknown }).created_at))
    .filter((value) => Number.isFinite(value));

  return reportMigrationLag({
    entries: journal.entries,
    applied,
    environment: process.env.NODE_ENV ?? "development",
  });
}
