/**
 * DID THE MINT STOP FILING? — read-only, on whichever world is pointed at.
 * (fable-586: the founder's right cross drifted, and the prime suspect is that
 * his render filed NOTHING at all — horns, earrings and everything else.)
 *
 * Readings before anything: which renders filed library rows, which filed
 * nothing, and what the refusals say. No writes, no renders, no credits.
 *
 *   railway run --service MySQL npx tsx scripts/read-mint-filing-disposable.mts
 */
import "dotenv/config";
import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mts";

const url = resolveDatabaseUrl();
if (!url) throw new Error("no database url");
console.log(`world: ${worldOf(url)}`);
const conn = await openDatabase(url);

/* The account with the most recent casting work — named by its rows, never printed. */
const [who] = await conn.execute(
  `SELECT userId, MAX(createdAt) AS latest, COUNT(*) AS versions
     FROM casting_candidate_variants WHERE status = 'ready'
    GROUP BY userId ORDER BY latest DESC LIMIT 1`,
);
const userId = (who as Array<{ userId: number; latest: string; versions: number }>)[0]!.userId;
console.log(`most recent caster: user ${userId} · ${(who as any[])[0].versions} versions · last ${(who as any[])[0].latest}`);

console.log("");
console.log("HIS LAST 12 RENDERS, and what each filed:");
const [variants] = await conn.execute(
  `SELECT v.id, v.publicId, v.requestText, v.createdAt,
          (SELECT COUNT(*) FROM casting_reference_library l WHERE l.variantId = v.id) AS filed
     FROM casting_candidate_variants v
    WHERE v.userId = ? AND v.status = 'ready'
    ORDER BY v.id DESC LIMIT 12`,
  [userId],
);
for (const row of variants as Array<Record<string, unknown>>) {
  console.log(`  ${String(row.createdAt).slice(0, 19)}  ${String(row.filed).padStart(2)} rows  "${String(row.requestText ?? "").slice(0, 46)}"`);
}

console.log("");
console.log("AND THE LAST 12 LIBRARY ROWS he has, filed or refused:");
const [library] = await conn.execute(
  `SELECT slot, guardKind, guardCoverage, refusedReason, refusedCoverage,
          storageKey IS NOT NULL AS kept, refusedContentKey IS NOT NULL AS keptRefused, createdAt, variantId
     FROM casting_reference_library WHERE userId = ? ORDER BY id DESC LIMIT 12`,
  [userId],
);
for (const row of library as Array<Record<string, unknown>>) {
  console.log(`  ${String(row.createdAt).slice(0, 19)}  ${String(row.slot).padEnd(16)}`
    + ` ${row.refusedReason ? `REFUSED ${row.refusedReason}` : "filed"}`
    + ` ${row.guardCoverage !== null && row.guardCoverage !== undefined ? `${Number(row.guardCoverage) / 100}%` : ""}`
    + `${row.refusedCoverage !== null && row.refusedCoverage !== undefined ? ` read ${Number(row.refusedCoverage) / 100}%` : ""}`
    + ` · crop ${row.kept ? "kept" : row.keptRefused ? "kept(refused)" : "none"}`);
}
await conn.end();
process.exit(0);
