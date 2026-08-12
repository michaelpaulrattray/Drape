/**
 * THE EIGHT MASTERS, ON DISK — so the removal frames can be looked at BESIDE the
 * face they came from.
 *
 * The class instrument judges one fact (are the glasses gone). The audit a human
 * does is wider than that and cannot be done from the delivered frame alone: a
 * frame with no glasses and a different woman in it is a worse outcome than a
 * refusal, and it would pass every glasses question ever asked. So the master is
 * saved beside every paint.
 *
 * Read-only: SELECT and a storage GET. No paints, no credits, no writes.
 *
 *   npx tsx scripts/save-glasses-masters-disposable.mts
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { storageReadBytes } from "../server/storage";

const OUT = "output/shift63-removal-class/masters";
const key = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([key]);
const connection = await openDatabase(process.env[key]!);
await mkdir(OUT, { recursive: true });

const [faces] = await connection.query<any[]>(
  `SELECT c.publicId, c.imageKey
     FROM casting_candidates c
     JOIN casting_rolls r ON r.id = c.rollId
     JOIN casting_sessions s ON s.id = r.sessionId
    WHERE s.userId = 1 AND c.status = 'ready' AND r.briefText LIKE '%chunky glasses%'
    ORDER BY c.id`,
);

for (const face of faces) {
  const bytes = await storageReadBytes(face.imageKey);
  const file = path.join(OUT, `${face.publicId.slice(0, 8)}-master.png`);
  await writeFile(file, bytes.bytes);
  console.log(`${face.publicId.slice(0, 8)}  ${bytes.bytes.length} B  → ${file}`);
}

await connection.end();
process.exit(0);
