/**
 * Database Connection — shared drizzle instance with pool configuration.
 * All domain modules import getDb() from here.
 */

import { drizzle } from "drizzle-orm/mysql2";

let _db: ReturnType<typeof drizzle> | null = null;

export type DbInstance = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle({
        connection: {
          uri: process.env.DATABASE_URL,
          connectionLimit: 20,    // Max concurrent connections
          queueLimit: 50,         // Max queued connection requests before rejection
          waitForConnections: true,
          enableKeepAlive: true,
          keepAliveInitialDelay: 30000, // 30s keep-alive ping
        },
      });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
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
export async function withTransaction<T>(
  callback: (tx: Parameters<Parameters<DbInstance["transaction"]>[0]>[0]) => Promise<T>
): Promise<T> {
  const db = await getDb();
  if (!db) {
    throw new Error("[Database] Cannot start transaction: database not available");
  }

  return db.transaction(callback);
}
