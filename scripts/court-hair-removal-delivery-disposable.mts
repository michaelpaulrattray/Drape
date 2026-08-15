/**
 * DOES "REMOVE HER HAIR" ACTUALLY DELIVER BALD? (fable-606 §3, the paid half.)
 *
 * The routing is now decided in code and the free bench says every phrasing
 * reaches the paint 6/6. What a bench cannot say is what the paint DOES with
 * it, so this buys one render of his exact sentence and keeps the frame for a
 * human to look at — law 6, and the reason the delta was taken from the stable
 * phrasings rather than invented.
 *
 *   npx tsx scripts/court-hair-removal-delivery-disposable.mts
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

import { openDatabase } from "./lib/dbConnection.mts";
import { ensureOutsider } from "./lib/outsider.mts";

const OUT = "output/hair-removal-delivery";
mkdirSync(OUT, { recursive: true });
if (process.env.MYSQL_PUBLIC_URL) throw new Error("dev only — this SPENDS");

const outsider = await ensureOutsider();
process.env.CASTING_REPAINT_SCOPE = `users:${outsider.id}`;
process.env.CASTING_REFERENCE_LIBRARY_SCOPE = `users:${outsider.id}`;
process.env.ENABLE_STORAGE_CLEANUP_WORKER = "true";

const conn = await openDatabase(process.env.DATABASE_URL!);
const [casts] = await conn.execute(
  `SELECT id, publicId FROM casting_candidates WHERE userId = ? AND status = 'ready' ORDER BY id DESC LIMIT 1`,
  [outsider.id],
);
const cast = (casts as Array<{ id: number; publicId: string }>)[0]!;
const balance = async () => {
  const [rows] = await conn.execute(`SELECT balance FROM points WHERE userId = ?`, [outsider.id]);
  return (rows as Array<{ balance: number }>)[0]!.balance;
};

const { refineCandidate } = await import("../server/castingV2/refineService.js");
const before = await balance();
const result = await refineCandidate({}, {
  userId: outsider.id,
  clientRequestId: randomUUID(),
  candidatePublicId: cast.publicId,
  instruction: "remove her hair",
});
console.log(`"remove her hair" → ${result.kind} · ${before - await balance()} credits`);

const [rows] = await conn.execute(
  `SELECT imageKey, JSON_EXTRACT(internalPrompt, '$.repaint.edited') AS edited,
          JSON_UNQUOTE(JSON_EXTRACT(internalPrompt, '$.repaint.prompt')) AS prompt
     FROM casting_candidate_variants WHERE candidateId = ? ORDER BY id DESC LIMIT 1`,
  [cast.id],
);
const row = (rows as Array<{ imageKey: string; edited: unknown; prompt: string }>)[0]!;
console.log(`edited ${JSON.stringify(row.edited)}`);
console.log(`prompt ${String(row.prompt).slice(0, 220)}`);

const { fetchImageBytes } = await import("./lib/imageBytes.mts");
const bytes = (await fetchImageBytes(`${process.env.R2_PUBLIC_URL}/${row.imageKey}`)).bytes;
writeFileSync(`${OUT}/bald.png`, bytes);
console.log(`the frame is at ${OUT}/bald.png — look at it`);
await conn.end();
process.exit(0);
