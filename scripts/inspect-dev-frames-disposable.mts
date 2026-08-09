/**
 * DO ANY DEV VARIANTS SHARE THEIR MASTER'S FRAME? — read-only.
 *
 * `cutSegments` intersects the applied set with a region, and both are measured
 * against ONE frame. Candidate 316's variants come back 848×1264 against a
 * 1024×1536 master, which makes a difference-mask meaningless. This asks the
 * question of every dev face rather than assuming the answer generalises.
 *
 *   npx tsx scripts/inspect-dev-frames-disposable.mts
 */
import "dotenv/config";
import sharp from "sharp";

import { openDatabase } from "./lib/dbConnection.mts";

if (process.env.MYSQL_PUBLIC_URL) throw new Error("refusing to run beside a production URL");
const base = process.env.R2_PUBLIC_URL!.replace(/\/$/, "");

const connection = await openDatabase();
const [rows] = await connection.query(
  `SELECT c.id AS candidateId, c.imageKey AS masterKey, v.id AS variantId, v.imageKey AS variantKey
     FROM casting_candidates c
     JOIN casting_candidate_variants v ON v.candidateId = c.id
    WHERE c.userId = 823 AND v.status = 'ready' AND v.imageKey IS NOT NULL AND c.imageKey IS NOT NULL
    ORDER BY c.id ASC, v.id ASC`,
);
await connection.end();

const sizeOf = async (key: string): Promise<string> => {
  const response = await fetch(`${base}/${key}`);
  if (!response.ok) return `HTTP ${response.status}`;
  const meta = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
  return `${meta.width}×${meta.height}`;
};

const masters = new Map<number, string>();
for (const row of rows as any[]) {
  if (!masters.has(row.candidateId)) masters.set(row.candidateId, await sizeOf(row.masterKey));
  const variant = await sizeOf(row.variantKey);
  const master = masters.get(row.candidateId)!;
  console.log(
    `candidate ${String(row.candidateId).padStart(3)} master ${master.padEnd(11)} `
    + `· variant ${String(row.variantId).padStart(3)} ${variant.padEnd(11)} `
    + `${master === variant ? "SAME FRAME" : "different"}`,
  );
}
