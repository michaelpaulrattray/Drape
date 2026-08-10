/**
 * THE ADVISORY ROWS OF RUN-13, WITH WHAT THE READER SAID IT SAW.
 *
 * The walk closed with `hairWorn` at 25% — three advisory misses on four
 * renders — and fable-030's rule is a MANUAL double-read of every advisory row,
 * every one, not a sample. A row classified advisory when the asked thing is
 * genuinely absent is a false pass, and the misclassification is its own defect.
 *
 * So this pulls what was asked and what the reader reported, per render, so the
 * frames can be opened against it.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/read-run13-checks-disposable.mts
 */
import "dotenv/config";

import { openDatabase, utc } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

const CANDIDATE = "72fa6229-6adf-453a-bff0-0dc9065c8b92";

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const databaseUrl = process.env[databaseKey];
if (!databaseUrl) throw new Error("no database URL — run under `railway run --service MySQL`");

const connection = await openDatabase(databaseUrl);
const [rows] = await connection.query<any[]>(
  `SELECT v.id, v.requestText, v.internalPrompt, v.createdAt
     FROM casting_candidate_variants v
     JOIN casting_candidates c ON c.id = v.candidateId
    WHERE c.publicId = ? AND v.status = 'ready'
    ORDER BY v.id ASC`,
  [CANDIDATE],
);
await connection.end();

const parse = (value: unknown): any => (typeof value === "string" ? JSON.parse(value) : value);

for (const row of rows) {
  const internal = parse(row.internalPrompt) ?? {};
  const verification = internal.verification ?? {};
  console.log(`\n=== v${row.id}  "${row.requestText}"  ${utc(row.createdAt)} `
    + `(${verification.readings ?? 1} reading(s), ${verification.attempts ?? "?"} attempt(s))`);
  for (const check of verification.checks ?? []) {
    const mark = check.verified ? "ok " : check.read ? "MISS" : "unread";
    console.log(`  ${mark.padEnd(6)} ${String(check.facet).padEnd(20)} binding=${check.binding}`);
    console.log(`         asked: ${String(check.asked).slice(0, 100)}`);
    console.log(`         saw:   ${String(check.saw ?? "(nothing)").slice(0, 100)}`);
  }
}

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
