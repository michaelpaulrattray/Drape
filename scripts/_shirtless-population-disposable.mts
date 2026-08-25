/**
 * DISPOSABLE — how many stored rolls carry the OLD male Basics line?
 *
 * The swap "shirtless" → "bare chested" (fable-1659 §1) changes what
 * `basicsWardrobeLine("male")` returns, and `BASICS_LINES` in
 * `inkSurfaceCoverage.ts` is DERIVED from that function. Every roll already
 * stamped with the old sentence therefore stops matching and falls to
 * `unknown` coverage unless the retired line is kept in the known set.
 * This counts that population. Read-only.
 */
import { openDatabase } from "./lib/dbConnection.mts";

const production = process.argv.includes("--production");
if (!production) await import("dotenv/config");
const url = production ? process.env.MYSQL_PUBLIC_URL : process.env.DATABASE_URL;
if (!url) throw new Error(production ? "no MYSQL_PUBLIC_URL" : "no DATABASE_URL");
const parsed = new URL(url);
console.log(`world: ${production ? "PRODUCTION" : "DEV"} · ${parsed.hostname}:${parsed.port}`);

const conn = await openDatabase(url);
const [rows] = await conn.query<any[]>(
  `SELECT wardrobeLine, path, COUNT(*) AS rolls, MIN(id) AS firstRoll, MAX(id) AS lastRoll
     FROM casting_rolls
    WHERE wardrobeLine IS NOT NULL
    GROUP BY wardrobeLine, path
    ORDER BY rolls DESC`,
);
console.log(`\nstored wardrobe lines (${rows.length} distinct):`);
for (const r of rows) {
  console.log(`  ${String(r.rolls).padStart(4)}  path=${String(r.path ?? "-").padEnd(9)} #${r.firstRoll}-${r.lastRoll}  ${r.wardrobeLine}`);
}
await conn.end();
process.exit(0);
