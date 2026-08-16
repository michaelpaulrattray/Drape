/**
 * WHAT CHANGES ON THE RAIL WHEN THE SHIPPED RULE IS THE ONE THAT RUNS
 * (fable-717 §4, executing fable-575 §3).
 *
 * The route grouped the rail by INFERENCE — two rows whose parsed chains match
 * are two takes of one version — while the module documented the DECLARED rule
 * as the shipped one and nothing called it. Swapping the caller is the order.
 * The question the order leaves open is what it does to rows already on the
 * record, and that is a count rather than an opinion:
 *
 *   HIDDEN BY INFERENCE     rows the rail is not drawing today
 *   HIDDEN BY DECLARATION   rows that say outright what they replaced
 *   REAPPEARING             the difference — pictures somebody paid for that
 *                           come back onto the rail, which is the forward-only
 *                           guarantee working, and also a visible change
 *
 * Read-only. It opens one database, runs one SELECT, and writes nothing.
 *
 *   npx tsx scripts/count-take-regrouping-disposable.mts            (dev)
 *   railway run --service MySQL npx tsx scripts/… --production      (prod)
 */
import "dotenv/config";

import { openDatabase } from "./lib/dbConnection.mts";
import { declaredTakes, liveTakes } from "../server/castingV2/railTakes";
import { readStepDeltas } from "../server/castingV2/refineService";

const production = process.argv.includes("--production");
const url = production
  ? (process.env.MYSQL_PUBLIC_URL ?? process.env.DATABASE_URL)
  : process.env.DATABASE_URL;
if (!url) throw new Error("no database URL for the world asked for");
const where = new URL(url.replace(/^mysql:/, "http:"));
console.log(`WORLD: ${production ? "PRODUCTION" : "dev"} → ${where.hostname}:${where.port}`);

const conn = await openDatabase(url);
const [rows] = await conn.query<Array<{
  candidateId: number; userId: number; publicId: string;
  stepDeltas: unknown; internalPrompt: unknown; createdAt: Date;
}>>(
  `SELECT candidateId, userId, publicId, stepDeltas, internalPrompt, createdAt
     FROM casting_candidate_variants
    WHERE status = 'ready'
    ORDER BY candidateId, id`,
);
await conn.end();

const json = (value: unknown): unknown =>
  (typeof value === "string" ? JSON.parse(value) as unknown : value);
const declaredFrom = (internalPrompt: unknown): string | null => {
  const record = json(internalPrompt);
  if (!record || typeof record !== "object") return null;
  const value = (record as { regeneratedFrom?: unknown }).regeneratedFrom;
  return typeof value === "string" && value.length > 0 ? value : null;
};

const faces = new Map<number, typeof rows>();
for (const row of rows) {
  const held = faces.get(row.candidateId) ?? [];
  held.push(row);
  faces.set(row.candidateId, held);
}

let inferredHidden = 0;
let declaredHidden = 0;
const reappearing: Array<{ candidateId: number; userId: number; publicId: string; createdAt: Date }> = [];

for (const [candidateId, held] of faces) {
  const inferred = liveTakes(held.map((row) => ({
    publicId: row.publicId,
    steps: readStepDeltas(json(row.stepDeltas)),
  })));
  const declared = declaredTakes(held.map((row) => ({
    publicId: row.publicId,
    regeneratedFrom: declaredFrom(row.internalPrompt),
  })));
  const inferredLive = new Set(inferred.live.map((row) => row.publicId));
  const declaredLive = new Set(declared.live.map((row) => row.publicId));
  inferredHidden += held.length - inferredLive.size;
  declaredHidden += held.length - declaredLive.size;
  for (const row of held) {
    if (!inferredLive.has(row.publicId) && declaredLive.has(row.publicId)) {
      reappearing.push({
        candidateId, userId: row.userId, publicId: row.publicId, createdAt: row.createdAt,
      });
    }
  }
}

console.log(`\n${rows.length} delivered version(s) across ${faces.size} face(s)`);
console.log(`  hidden by the INFERENCE   ${inferredHidden}`);
console.log(`  hidden by the DECLARATION ${declaredHidden}`);
console.log(`  REAPPEARING on the rail   ${reappearing.length}`);
for (const row of reappearing.slice(0, 40)) {
  console.log(`    user ${row.userId} · face ${row.candidateId} · ${row.publicId}`
    + ` · born ${row.createdAt.toISOString()}`);
}
if (reappearing.length > 40) console.log(`    …and ${reappearing.length - 40} more`);
process.exit(0);
