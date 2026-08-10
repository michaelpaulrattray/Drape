/**
 * IS THERE A NEW CHAIN? — fable-141 order 2, answered from rows.
 *
 * fable-141 reports the founder dogfooded a new chain (face "Sharp-eyed":
 * Original → freckles → gold hoops → remove glasses) and asks what the hoops
 * step cut. A report is a claim; the row is the fact. This asks the narrowest
 * version of the question and nothing else:
 *
 *   - what the database thinks the time is (so a `--days` window has honest
 *     arithmetic rather than a laptop clock's opinion),
 *   - the newest variant rows on ANY account, not just his,
 *   - candidates whose Cast name looks like the one in the screenshot,
 *   - and for the newest chain found: its segments, seam verdicts and the
 *     image-proxy pressure question.
 *
 * Writes nothing, spends nothing, asks no model.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/read-new-chain-disposable.mts
 */
import mysql from "mysql2/promise";

import { assertOneWorld } from "./lib/worldGuard.mts";

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);

const url = process.env[databaseKey];
if (!url) { console.error("no database url — run under `railway run --service MySQL`"); process.exit(1); }

const connection = await mysql.createConnection({ uri: url, timezone: "Z" } as any);
const query = async (sql: string, params: unknown[] = []): Promise<any[]> => {
  const [rows] = await connection.query<any[]>(sql, params);
  return rows;
};
const stamp = (value: unknown): string =>
  value instanceof Date ? value.toISOString().replace("T", " ").slice(0, 19) : String(value ?? "");

const [clock] = await query("SELECT NOW() AS now, @@global.time_zone AS tz, @@session.time_zone AS session_tz");
console.log(`database NOW() = ${stamp(clock.now)}  (global tz ${clock.tz}, session ${clock.session_tz})`);
console.log(`this laptop    = ${new Date(Number(process.env.WALL_MS ?? "0") || 0).toISOString().replace("T", " ").slice(0, 19)} (WALL_MS, passed in)\n`);

/* ── 1. the newest variant rows anywhere, not just his ─────────────────── */
const newest = await query(
  `SELECT v.id, v.publicId, v.userId, v.candidateId, v.parentVariantId, v.requestText,
          v.status, v.failureClass, v.pointsCost, v.imageKey, v.createdAt,
          c.publicId AS candidatePublicId
     FROM casting_candidate_variants v
     JOIN casting_candidates c ON c.id = v.candidateId
    ORDER BY v.id DESC LIMIT 25`,
);
console.log(`--- newest 25 variant rows on ANY account ---`);
console.log("  id  user  candidate  created              status      landed  request");
for (const row of newest) {
  console.log(
    `${String(row.id).padStart(5)}  ${String(row.userId).padStart(4)}  ${String(row.candidatePublicId).slice(0, 8)}   `
    + `${stamp(row.createdAt)}  ${String(row.status).padEnd(10)}  ${row.imageKey ? "yes   " : "NO    "}  `
    + `${row.requestText ?? "(none)"}${row.failureClass ? `   [${row.failureClass}]` : ""}`,
  );
}

/* ── 2. the face in the screenshot, by its Cast name ───────────────────── */
const named = await query(
  `SELECT id, publicId, userId, name, createdAt FROM casts
    WHERE name LIKE '%harp%' ORDER BY id DESC LIMIT 10`,
).catch(() => []);
console.log(`\n--- casts whose name contains "harp" (${named.length}) ---`);
for (const row of named) {
  console.log(`  cast ${row.id}  user ${row.userId}  ${row.publicId}  "${row.name}"  ${stamp(row.createdAt)}`);
}

/* ── 3. the newest candidates, so a face cast today is visible even with
       no refinement on it yet ──────────────────────────────────────────── */
const candidates = await query(
  `SELECT id, publicId, userId, status, selectedVariantId, signedCastId, createdAt
     FROM casting_candidates ORDER BY id DESC LIMIT 12`,
);
console.log(`\n--- newest 12 candidates on ANY account ---`);
for (const row of candidates) {
  console.log(`  cand ${String(row.id).padStart(5)}  user ${row.userId}  ${String(row.publicId).slice(0, 8)}  `
    + `${String(row.status).padEnd(10)} selected=${row.selectedVariantId ?? "-"}  signed=${row.signedCastId ?? "-"}  ${stamp(row.createdAt)}`);
}

/* ── 4. segments — the corridor's first real-money outing, if it happened ─ */
const segments = await query(
  `SELECT id, publicId, candidateId, variantId, provenance, facet, region, version,
          verdict, detector, bboxW, bboxH, createdAt
     FROM casting_segments ORDER BY id DESC LIMIT 20`,
).catch((error: unknown) => { console.log(`\ncasting_segments unreadable: ${String(error)}`); return []; });
console.log(`\n--- newest 20 casting_segments rows, ANY account (${segments.length}) ---`);
if (segments.length === 0) console.log("  NONE — the table is empty; no render has ever cut a segment in this world.");
for (const row of segments) {
  console.log(`${String(row.id).padStart(5)}  cand=${row.candidateId} variant=${row.variantId ?? "-"}  `
    + `${String(row.provenance).padEnd(13)} ${String(row.facet).padEnd(16)} region=${String(row.region).padEnd(14)} `
    + `v${row.version} verdict=${row.verdict ?? "-"}  ${row.bboxW}x${row.bboxH}  ${stamp(row.createdAt)}`);
}

/* ── 5. the ledger's own last word, so "he rendered" has a money answer ─── */
const spend = await query(
  `SELECT id, userId, amount, type, description, referenceId, balanceAfter, createdAt
     FROM point_transactions ORDER BY id DESC LIMIT 12`,
);
console.log(`\n--- newest 12 ledger rows, ANY account ---`);
for (const row of spend) {
  console.log(`  ${stamp(row.createdAt)}  user ${row.userId}  ${String(row.type).padEnd(12)} ${String(row.amount).padStart(6)}  `
    + `balance ${row.balanceAfter}  ${String(row.description ?? "").slice(0, 60)}`);
}

await connection.end();
process.exit(0);
