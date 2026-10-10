/**
 * A REAL FAILED WRITE THAT CARRIES THE CUSTOMER'S WORDS — the fixture the
 * query-value suites share (#2218, #2222).
 *
 * drizzle's own mysql2 driver runs a real `UPDATE … SET persona = <sentinel>`
 * against a client whose query rejects with an error shaped the way mysql2
 * shapes one — `sql` formatted by mysql2's own `format` (values inlined, as
 * `connection.query` does), and a `Duplicate entry '<sentinel>'` message as the
 * MySQL server writes it. Drizzle then wraps it exactly as it does in
 * production (`mysql-core/session.js`, `queryWithCache`).
 */
import { eq } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { int, mysqlTable, text } from "drizzle-orm/mysql-core";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";

export const SENTINEL = "SENTINEL-the-customer-wrote-this-7f3a";

const casts = mysqlTable("casts", { id: int("id").primaryKey(), persona: text("persona") });

/** A real DrizzleQueryError from a real drizzle UPDATE, carrying the sentinel. */
export async function failedWrite(
  serverMessage = `Duplicate entry '${SENTINEL}' for key 'casts.persona'`,
): Promise<DrizzleQueryError> {
  const client = {
    query: async (query: { sql: string } | string, params: unknown[]) => {
      const sqlText = typeof query === "string" ? query : query.sql;
      const driverError = new Error(serverMessage) as Error & Record<string, unknown>;
      driverError.code = "ER_DUP_ENTRY";
      driverError.errno = 1062;
      driverError.sqlState = "23000";
      driverError.sqlMessage = driverError.message;
      driverError.sql = mysql.format(sqlText, params as never[]);
      throw driverError;
    },
  };
  const db = drizzle({ client: client as never });
  try {
    await db.update(casts).set({ persona: SENTINEL }).where(eq(casts.id, 1));
  } catch (error) {
    if (error instanceof DrizzleQueryError) return error;
    throw error;
  }
  throw new Error("the fixture's write did not fail");
}
