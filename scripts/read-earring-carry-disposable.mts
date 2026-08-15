/**
 * DID THE FILED EARRING CROPS RIDE THE NEXT RENDER? — read-only.
 * (fable-586/587: both crosses filed with crops, and the right one drifted on
 * the next edit. So the question moves from the mint door to the carry.)
 *
 * Reads, per side: the library rows' own life (version, retired, digest), which
 * render wrote each side's WORDS, and whether a crop existed at the moment of
 * the next render. No writes.
 *
 *   railway run --service MySQL npx tsx scripts/read-earring-carry-disposable.mts
 */
import "dotenv/config";
import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mts";

const url = resolveDatabaseUrl();
if (!url) throw new Error("no database url");
console.log(`world: ${worldOf(url)}`);
const conn = await openDatabase(url);

const [who] = await conn.execute(
  `SELECT userId FROM casting_candidate_variants WHERE status='ready'
    GROUP BY userId ORDER BY MAX(createdAt) DESC LIMIT 1`);
const userId = (who as Array<{ userId: number }>)[0]!.userId;

/* The two renders in question: the horns+crosses one and the eye one after it. */
const [variants] = await conn.execute(
  `SELECT id, publicId, requestText, createdAt, candidateId
     FROM casting_candidate_variants
    WHERE userId = ? AND status = 'ready' ORDER BY id DESC LIMIT 3`, [userId]);
const rows = variants as Array<{ id: number; requestText: string; createdAt: string; candidateId: number }>;
for (const row of rows) console.log(`variant ${row.id} · ${String(row.createdAt).slice(0, 21)} · "${row.requestText}"`);
const candidateId = rows[0]!.candidateId;

console.log("");
console.log("EVERY EARRING ROW ON THAT FACE, oldest first:");
const [library] = await conn.execute(
  `SELECT id, slot, variantId, version, retiredAt IS NOT NULL AS retired,
          storageKey IS NOT NULL AS hasCrop, digest IS NOT NULL AS hasDigest,
          JSON_LENGTH(words) AS wordCount, createdAt
     FROM casting_reference_library
    WHERE userId = ? AND candidateId = ? AND slot LIKE 'earring%'
    ORDER BY id ASC`, [userId, candidateId]);
for (const row of library as Array<Record<string, unknown>>) {
  console.log(`  #${row.id} ${String(row.slot).padEnd(14)} from variant ${String(row.variantId ?? "master").padStart(6)}`
    + ` v${row.version} ${row.retired ? "RETIRED" : "live   "}`
    + ` crop ${row.hasCrop ? "yes" : "no "} digest ${row.hasDigest ? "yes" : "no "}`
    + ` words ${row.wordCount} · ${String(row.createdAt).slice(0, 21)}`);
}

console.log("");
console.log("AND THE WORDS EACH SIDE CARRIES NOW (587's provenance):");
const [words] = await conn.execute(
  `SELECT slot, variantId, JSON_EXTRACT(words, '$[0]') AS firstWord, createdAt
     FROM casting_reference_library
    WHERE userId = ? AND candidateId = ? AND slot LIKE 'earring%' AND retiredAt IS NULL
    ORDER BY slot ASC`, [userId, candidateId]);
for (const row of words as Array<Record<string, unknown>>) {
  console.log(`  ${String(row.slot).padEnd(14)} written by variant ${String(row.variantId ?? "master")}`
    + ` · ${String(row.firstWord).slice(0, 70)}`);
}
await conn.end();
process.exit(0);
