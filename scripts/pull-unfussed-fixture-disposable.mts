/**
 * THE C′ BENCH'S FIXTURE, PULLED ONCE AND WRITTEN DOWN.
 *
 * fable-153/156: the bench needs a face with delivered edits whose CROPS we
 * hold, and the Unfussed lineage (`f9e9cb81`) is the ratified one. This reads
 * the candidate, its variants and its segment rows — keys and geometry only, no
 * bytes, no writes — so the bench itself depends on no live database.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/pull-unfussed-fixture-disposable.mts
 */
import mysql from "mysql2/promise";

import { assertOneWorld } from "./lib/worldGuard.mts";
import { openDatabase } from "./lib/dbConnection.mts";

const CANDIDATE = "f9e9cb81";

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const url = process.env[databaseKey];
if (!url) { console.error("no database url — run under `railway run --service MySQL`"); process.exit(1); }
const connection = await openDatabase({ uri: url, timezone: "Z" } as any);

const [candidates] = await connection.query<any[]>(
  `SELECT id, publicId, userId, imageKey, createdAt FROM casting_candidates
    WHERE publicId LIKE ? LIMIT 5`,
  [`${CANDIDATE}%`],
);
console.log("CANDIDATE");
for (const row of candidates) {
  console.log(`  #${row.id}  ${row.publicId}  user ${row.userId}`);
  console.log(`  master  ${row.imageKey}`);
}
if (candidates.length !== 1) {
  console.log(`  ${candidates.length} matches — the bench needs exactly one. STOP.`);
  await connection.end();
  process.exit(1);
}
const candidateId = candidates[0].id;

const [variants] = await connection.query<any[]>(
  `SELECT id, publicId, requestText, status, imageKey, createdAt
     FROM casting_candidate_variants WHERE candidateId = ? ORDER BY id ASC`,
  [candidateId],
);
console.log(`\nVARIANTS (${variants.length})`);
for (const row of variants) {
  console.log(`  v#${row.id}  ${row.publicId.slice(0, 8)}  ${String(row.status).padEnd(9)}  ${row.requestText ?? "—"}`);
  console.log(`        ${row.imageKey ?? "(no image)"}`);
}

const [segments] = await connection.query<any[]>(
  `SELECT id, publicId, variantId, provenance, facet, region, version,
          maskKey, contentKey, bboxX, bboxY, bboxW, bboxH, frameWidth, frameHeight,
          verdict, retiredAt
     FROM casting_segments WHERE candidateId = ? ORDER BY id ASC`,
  [candidateId],
);
console.log(`\nSEGMENTS (${segments.length}) — the crops the bench references`);
for (const row of segments) {
  console.log(
    `  #${row.id}  ${String(row.facet).padEnd(18)} v${row.version}  from v#${row.variantId ?? "—"}  `
    + `${row.bboxW}x${row.bboxH} at ${row.bboxX},${row.bboxY} in ${row.frameWidth}x${row.frameHeight}`
    + `${row.retiredAt ? "  RETIRED" : ""}`,
  );
  console.log(`        content ${row.contentKey}`);
  console.log(`        mask    ${row.maskKey}`);
}

await connection.end();
process.exit(0);
