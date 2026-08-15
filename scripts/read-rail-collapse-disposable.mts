/**
 * WHAT THE HISTORY COLLAPSE DOES TO REAL RAILS — before and after, read only.
 * (Founder answer 2026-08-15, ordered reported in fable-579 §1.)
 *
 * `liveTakes` groups rows describing the same chain and shows the newest, so a
 * cast where the same ask was bought twice loses a chip. Nothing is deleted:
 * this reads what the rail WOULD show, on rows that already exist, and prints
 * the difference per cast.
 *
 * Read-only. No writes, no renders, no credits. Runs against whichever database
 * the environment points at — and says which one.
 *
 *   npx tsx scripts/read-rail-collapse-disposable.mts
 *   railway run --service MySQL npx tsx scripts/read-rail-collapse-disposable.mts
 */
import "dotenv/config";
import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mts";

const url = resolveDatabaseUrl();
if (!url) throw new Error("no database url");
console.log(`world: ${worldOf(url)}`);
const conn = await openDatabase(url);
const { liveTakes } = await import("../server/castingV2/railTakes.js");
const { readStepDeltas } = await import("../server/castingV2/refineService.js");

const [rows] = await conn.execute(
  `SELECT c.id, c.publicId, c.personaLine, COUNT(v.id) AS versions
     FROM casting_candidates c JOIN casting_candidate_variants v ON v.candidateId = c.id
    WHERE v.status = 'ready'
    GROUP BY c.id HAVING versions > 1 ORDER BY versions DESC LIMIT 40`,
);
let collapsed = 0;
let touched = 0;
for (const cast of rows as Array<{ id: number; publicId: string; personaLine: string | null; versions: number }>) {
  const [variants] = await conn.execute(
    `SELECT publicId, stepDeltas FROM casting_candidate_variants
      WHERE candidateId = ? AND status = 'ready' ORDER BY id ASC`,
    [cast.id],
  );
  const takes = (variants as Array<{ publicId: string; stepDeltas: unknown }>).map((row) => ({
    publicId: row.publicId,
    steps: readStepDeltas(row.stepDeltas),
  }));
  const { live } = liveTakes(takes);
  const before = takes.length;
  const after = live.length;
  if (after < before) {
    touched += 1;
    collapsed += before - after;
    console.log(`  ${cast.publicId.slice(0, 8)} "${(cast.personaLine ?? "").slice(0, 28)}"  ${before} → ${after} chips`);
  }
}
console.log("");
console.log(`${(rows as unknown[]).length} casts with more than one version · ${touched} change · ${collapsed} chips collapse`);
await conn.end();
process.exit(0);
