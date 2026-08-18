/**
 * What the ink design table looks like in the world this process was wrapped
 * for — the two facts migration 0035 needs before it is written: the server
 * version (whether a JSON column may carry a DEFAULT) and how many rows an
 * added NOT NULL column would have to account for.
 *
 *   npx tsx scripts/read-ink-table-state-disposable.mts
 */
import "dotenv/config";
import { openDatabase } from "./lib/dbConnection.mts";

const connection = await openDatabase();
const [version] = await connection.query<Array<{ v: string }>>("SELECT VERSION() AS v");
const [rows] = await connection.query<Array<{ n: number }>>(
  "SELECT COUNT(*) AS n FROM casting_ink_designs",
);
console.log(`mysql ${version[0]!.v} · casting_ink_designs holds ${rows[0]!.n} row(s)`);
await connection.end();
process.exit(0);
