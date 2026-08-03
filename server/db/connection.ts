/**
 * Database Connection — shared drizzle instance with pool configuration.
 * All domain modules import getDb() from here.
 */

import { drizzle } from "drizzle-orm/mysql2";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("db/connection");

let _db: ReturnType<typeof drizzle> | null = null;

export type DbInstance = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle({
        connection: {
          uri: process.env.DATABASE_URL,
          /*
            ONE TIME FRAME, STATED (D-112).

            Every DATETIME in this database is UTC, and this makes the driver
            say so out loud instead of leaving it to be inferred.

            **Measured before it was set, and the measurement corrected what was
            believed:** the app's own path was already right. Drizzle's typed
            column mapper writes and reads UTC, so a JS `Date` and a
            `defaultNow()` on the same row have always landed in the same frame
            — the earlier claim that "the two writers land ten hours apart" was
            wrong, and came from probing `db.execute()` with a raw parameter,
            which is a path the product does not use for typed columns.

            What IS wrong is the RAW driver default. `mysql.createConnection`
            with no `timezone` parses a DATETIME as LOCAL, so on a machine at
            UTC+10 every timestamp read that way is ten hours early. That is the
            investigation tooling, and it is where the two near-miss false
            timelines came from.

            Setting it here was measured for harm as well as for cure: with
            `timezone: "Z"` the typed round-trip stays correct (no double
            application), the bytes on disk stay UTC, and a raw read through the
            same setting becomes correct. Nothing re-interprets, because nothing
            was ever written in local time.
          */
          timezone: "Z",
          connectionLimit: 20,    // Max concurrent connections
          queueLimit: 50,         // Max queued connection requests before rejection
          waitForConnections: true,
          enableKeepAlive: true,
          keepAliveInitialDelay: 30000, // 30s keep-alive ping
        },
      });
    } catch (error) {
      log.warn({ err: error }, "[Database] Failed to connect:");
      _db = null;
    }
  }
  return _db;
}

/**
 * Execute a callback inside a database transaction.
 *
 * The callback receives the transaction handle (`tx`) which MUST be used
 * instead of `db` for all reads and writes within the transaction.
 *
 * If the callback throws, the transaction is automatically rolled back.
 * If it returns normally, the transaction is committed.
 *
 * @example
 * ```ts
 * const result = await withTransaction(async (tx) => {
 *   await tx.update(credits).set({ balance: 100 }).where(eq(credits.userId, 1));
 *   await tx.insert(creditTransactions).values({ ... });
 *   return { success: true };
 * });
 * ```
 */
/** The transaction handle `withTransaction` callbacks receive — exported so
 *  cross-module atomic landings (identity commit + board stamp, Batch C final
 *  correction 3) can type their write callbacks. */
export type TransactionHandle = Parameters<Parameters<DbInstance["transaction"]>[0]>[0];

export async function withTransaction<T>(
  callback: (tx: TransactionHandle) => Promise<T>
): Promise<T> {
  const db = await getDb();
  if (!db) {
    throw new Error("[Database] Cannot start transaction: database not available");
  }

  return db.transaction(callback);
}
