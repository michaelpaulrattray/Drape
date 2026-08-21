/**
 * THE MIGRATION RITE'S SKELETON (fable-486 §e, founder-approved 2026-08-14).
 *
 * Nine sites, run twenty-odd times, and every ceremony script is a hand-copy of
 * the one before it. The parts that are copied are exactly the parts that must
 * not drift, because each is a refusal that exists for an incident:
 *
 *  - **name the world.** Dev and production are both Railway MySQL, same host,
 *    same database name, differing only by PORT (`:52008` and `:23768`). A
 *    ceremony that guessed would migrate the wrong one and report success.
 *  - **never `.env` for production.** dotenv is imported only on the dev path,
 *    so a production run cannot silently pick up a dev URL from a file.
 *  - **prove the reader before believing its answer** (working law 2). "SHOW
 *    TABLES LIKE" returning nothing is the whole basis for deciding to create —
 *    and it is also what a wrong database looks like.
 *  - **replay the migration file, never retype the DDL.** A ceremony that
 *    re-types its own SQL is a second copy of the schema, and it drifts from the
 *    one every test ran against.
 *  - **run twice safely.** The second run is the independent confirmation, so
 *    ALREADY APPLIED is a first-class outcome and never a failure.
 *
 * What stays in each ceremony is what is actually different: which table, which
 * migration file, and what evidence to print afterwards.
 */
import { readFile } from "node:fs/promises";

import { openDatabase } from "./dbConnection.mts";

export type CeremonyWorld = {
  world: "dev" | "production";
  /** `host:port` — the only thing that tells the two apart. Safe to print. */
  where: string;
  connection: Awaited<ReturnType<typeof openDatabase>>;
};

/**
 * The world, named by the caller and never guessed.
 *
 * Refuses on: no `--dev`/`--production`; a missing URL for the world asked for;
 * and the two URLs being the same string, which is one world wearing two names.
 */
export async function openCeremonyWorld(argv: readonly string[]): Promise<CeremonyWorld> {
  const world = argv.includes("--production")
    ? "production" as const
    : argv.includes("--dev") ? "dev" as const : null;
  if (world === null) {
    console.error("REFUSING: name the world — --dev or --production. This script does not guess.");
    process.exit(1);
  }

  /* dotenv ONLY on the dev path: a production ceremony must not be able to read
     a URL out of a file. */
  if (world === "dev") await import("dotenv/config");
  const url = world === "production" ? process.env.MYSQL_PUBLIC_URL : process.env.DATABASE_URL;
  if (!url) {
    console.error(world === "production"
      ? "REFUSING: MYSQL_PUBLIC_URL is not set. Run under `railway.cmd run --service MySQL`."
      : "REFUSING: DATABASE_URL is not set in .env.");
    process.exit(1);
  }
  if (world === "production" && process.env.DATABASE_URL === url) {
    console.error("REFUSING: MYSQL_PUBLIC_URL and DATABASE_URL are the same string — that is one world, not two.");
    process.exit(1);
  }

  const parsed = new URL(url);
  const where = `${parsed.hostname}:${parsed.port || "3306"}`;
  console.log(`world: ${world.toUpperCase()} · ${where}`);
  return { world, where, connection: await openDatabase(url) };
}

/**
 * THE POSITIVE CONTROL, before any absence counts as evidence.
 *
 * The same reader, pointed at a table that certainly exists in both worlds. If
 * it cannot see THAT, a negative answer about the ceremony's own table is not
 * evidence of anything.
 */
export async function proveTheReader(
  connection: CeremonyWorld["connection"],
  control = "casting_candidates",
): Promise<void> {
  const [rows] = await connection.query<any[]>("SHOW TABLES LIKE ?", [control]);
  if (rows.length !== 1) {
    throw new Error(`the existence reader cannot see \`${control}\` — wrong database, or a reader that cannot say yes`);
  }
}

/** Whether a table is here at all, asked only once the reader has been proven. */
export async function tableExists(
  connection: CeremonyWorld["connection"],
  table: string,
): Promise<boolean> {
  const [rows] = await connection.query<any[]>("SHOW TABLES LIKE ?", [table]);
  return rows.length === 1;
}

/** A column's live DDL type, or null when the column is absent. */
export async function columnType(
  connection: CeremonyWorld["connection"],
  table: string,
  column: string,
): Promise<string | null> {
  const [rows] = await connection.query<any[]>(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
  return rows.length === 1 ? String(rows[0].Type) : null;
}

/**
 * Every column of one named index, in the order the index holds them.
 *
 * ONE OWNER, because two ceremonies now read the same table's keys and a second
 * copy of this drifts from the first (law 4). It came from
 * `ceremony-ink-delivery-rekey.mts`, where it was written, and moved here the
 * day `ceremony-ink-delivery-crops.mts` needed the same reading.
 *
 * The ORDER is the half a `COUNT(*)` would miss: an index over the same columns
 * in a different order is a different rule wearing the same name.
 */
export async function indexColumns(
  connection: CeremonyWorld["connection"],
  table: string,
  name: string,
): Promise<{ present: boolean; unique: boolean; columns: string[] }> {
  const [rows] = await connection.query<any[]>(
    `SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`,
    [name],
  );
  return {
    present: rows.length > 0,
    unique: rows.length > 0 && rows.every((row) => row.Non_unique === 0),
    columns: [...rows]
      .sort((a, b) => a.Seq_in_index - b.Seq_in_index)
      .map((row) => row.Column_name as string),
  };
}

/**
 * The migration file itself, replayed statement by statement.
 *
 * Never the DDL retyped into the ceremony: that is a second copy of the schema
 * and it drifts from the one every test ran against.
 */
export async function replayMigration(
  connection: CeremonyWorld["connection"],
  file: string,
): Promise<number> {
  const sql = await readFile(file, "utf8");
  const statements = sql.split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
  if (statements.length === 0) throw new Error(`${file} contains no statements — wrong path?`);
  for (const statement of statements) await connection.query(statement);
  return statements.length;
}

/**
 * READ, APPLY, READ BACK — and a second run is a confirmation, not a failure.
 *
 * `isApplied` is asked first and again afterwards, because the ALTER's silence
 * is not evidence that it did anything (D-235's asymmetry, at the one door
 * where a migration would otherwise be believed on its own say-so).
 */
export async function applyOnce(input: {
  what: string;
  isApplied: () => Promise<boolean>;
  apply: () => Promise<unknown>;
}): Promise<"already" | "applied"> {
  if (await input.isApplied()) {
    console.log(`ALREADY APPLIED — ${input.what}`);
    return "already";
  }
  await input.apply();
  if (!await input.isApplied()) {
    throw new Error(`the migration ran and ${input.what} is still not true — stop and investigate`);
  }
  console.log(`APPLIED — ${input.what}`);
  return "applied";
}

/**
 * The ending every ceremony shares: close the connection, say which way it
 * ended, and hand back the exit code.
 *
 * It RETURNS the code rather than exiting, so the `process.exit` stays visible
 * as the script's own last statement — the repo's exit-discipline guard reads
 * the terminal statement, and a helper that exited on the caller's behalf would
 * be a script that looks like it runs off the end of the file.
 */
export async function closeCeremony(world: CeremonyWorld, failure?: unknown): Promise<0 | 1> {
  if (failure) console.error(`FAILED: ${failure instanceof Error ? failure.message : String(failure)}`);
  await world.connection.end();
  return failure ? 1 : 0;
}
