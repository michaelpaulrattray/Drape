/**
 * HOW MUCH IS THERE TO RETRO-MINT — the sizing read for fable-737 §1.
 *
 * Read-only. Counts slots the library holds against the candidates that exist,
 * so "backfill every pre-promotion feature" stops being an adjective.
 */
import "dotenv/config";
import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

const key = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([key]);
const url = process.env[key];
if (!url) throw new Error("no database URL");
const db = await openDatabase(url);

const [candidates] = await db.query<any[]>(
  `SELECT COUNT(*) AS n FROM casting_candidates WHERE userId = 1`);
const [variants] = await db.query<any[]>(
  `SELECT COUNT(*) AS n FROM casting_candidate_variants v
     JOIN casting_candidates c ON c.id = v.candidateId WHERE c.userId = 1`);
const [rows] = await db.query<any[]>(
  `SELECT role, tier, COUNT(*) AS n FROM casting_reference_library
    WHERE userId = 1 GROUP BY role, tier ORDER BY n DESC`);
const [slots] = await db.query<any[]>(
  `SELECT slot, COUNT(*) AS n, COUNT(DISTINCT candidateId) AS faces
     FROM casting_reference_library WHERE userId = 1
    GROUP BY slot ORDER BY n DESC`);
const [withLib] = await db.query<any[]>(
  `SELECT COUNT(DISTINCT candidateId) AS n FROM casting_reference_library WHERE userId = 1`);

console.log(`candidates (user 1)        ${candidates[0].n}`);
console.log(`variants   (user 1)        ${variants[0].n}`);
console.log(`candidates WITH a library  ${withLib[0].n}`);
console.log(`\nlibrary rows by role/tier:`);
for (const r of rows) console.log(`  ${String(r.role).padEnd(8)} ${String(r.tier).padEnd(8)} ${r.n}`);
console.log(`\nby slot:`);
for (const s of slots) console.log(`  ${String(s.slot).padEnd(18)} rows ${String(s.n).padEnd(4)} faces ${s.faces}`);
await db.end();
process.exit(0);
