/**
 * WHAT THE NET ACTUALLY STORED FOR RUN-14 — every check, every `saw`.
 *
 * The table says `hairWorn` 1 of 3 with two advisory rows, and an advisory row
 * is a DOUBLE-READ OWED (fable-030), not a shrug. This prints the stored rows so
 * the frames can be opened against what the reader claims to have seen — and,
 * for the first time, against a pin the build chose from a closed list rather
 * than wrote in free text.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/read-run14-checks-disposable.mts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";

import { openDatabase, utc } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const databaseUrl = process.env[databaseKey];
if (!databaseUrl) throw new Error("no database URL — run under `railway run --service MySQL`");

const walk = JSON.parse(readFileSync("output/walk/2026-08-08T15-45-12-636Z/walk.json", "utf8"));
const candidate: string = walk.candidate;

const connection = await openDatabase(databaseUrl);
const [rows] = await connection.query<any[]>(
  `SELECT v.id, v.publicId, v.status, v.instructions, v.internalPrompt, v.createdAt
     FROM casting_candidate_variants v
     JOIN casting_candidates c ON c.id = v.candidateId
    WHERE c.publicId = ? ORDER BY v.id ASC`,
  [candidate],
);
await connection.end();

for (const row of rows) {
  const internal = typeof row.internalPrompt === "string"
    ? JSON.parse(row.internalPrompt) : row.internalPrompt;
  const asked = JSON.parse(JSON.stringify(row.instructions ?? []));
  console.log(`\n── variant ${row.publicId} (${row.status})  ${utc(row.createdAt)}`);
  console.log(`   asked: ${JSON.stringify(asked)}`);
  const captions = internal?.captions ?? {};
  if (captions.hairWorn) console.log(`   PIN hairWorn: "${captions.hairWorn}"`);
  else console.log(`   PIN hairWorn: (none)`);
  const checks = internal?.verification?.checks ?? internal?.verification ?? null;
  if (!Array.isArray(checks)) { console.log(`   checks: ${JSON.stringify(checks)?.slice(0, 200)}`); continue; }
  for (const check of checks) {
    console.log(
      `   ${String(check.facet).padEnd(20)} verified=${String(check.verified).padEnd(5)} `
      + `read=${String(check.read).padEnd(5)} binding=${String(check.binding).padEnd(5)} `
      + `saw: ${check.saw ?? "—"}`,
    );
    console.log(`      asked: ${String(check.asked).slice(0, 120)}`);
  }
}

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
