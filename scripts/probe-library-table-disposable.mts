/**
 * READ-ONLY: which database am I looking at, and what shape is the reference
 * library in there?
 *
 * **It prints the world first, and that is the point.** This script was written
 * believing `.env`'s `DATABASE_URL` and the database `railway run --service
 * MySQL` hands you were the same server. They are not — the campaign's own
 * ledger reads 102 rows under one and 4 under the other — and a probe that does
 * not say which world it read is a fact with no address.
 *
 *   npx tsx scripts/probe-library-table-disposable.mts                    # .env
 *   railway.cmd run --service MySQL -- npx tsx scripts/probe-library-table-disposable.mts
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const key = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
const url = process.env[key];
if (!url) throw new Error("no database URL");
const parsed = new URL(url);

const connection = await mysql.createConnection({ uri: url, timezone: "Z" } as mysql.ConnectionOptions);
try {
  const [where] = await connection.query<any[]>("SELECT DATABASE() AS d, VERSION() AS v");
  console.log(`via ${key}  host ${parsed.hostname}:${parsed.port}  database ${where[0].d}  mysql ${where[0].v}`);
  for (const table of [
    "casting_reference_library",
    "casting_segments",
    "casting_cast_segments",
    "casting_candidate_variants",
  ]) {
    const [rows] = await connection.query<any[]>("SHOW TABLES LIKE ?", [table]);
    if (rows.length === 0) {
      console.log(`${table.padEnd(28)} ABSENT`);
      continue;
    }
    const [columns] = await connection.query<any[]>(`SHOW COLUMNS FROM \`${table}\``);
    const [count] = await connection.query<any[]>(`SELECT COUNT(*) AS n FROM \`${table}\``);
    console.log(`${table.padEnd(28)} PRESENT — ${count[0].n} row(s), ${columns.length} columns`);
    if (table === "casting_reference_library") {
      const refused = columns.map((column: any) => column.Field).filter((name: string) => name.startsWith("refused"));
      console.log(`  refused* columns: ${refused.length === 0 ? "NONE — 0029 has not run here" : refused.join(", ")}`);
    }
  }
} finally {
  await connection.end();
}

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
