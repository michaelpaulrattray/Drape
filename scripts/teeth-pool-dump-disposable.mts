/**
 * THE FIXTURE FIRST — before the teeth bench asks anything, find frames where
 * teeth are actually visible.
 *
 * fable-402 §2 ruled a small second bench (same four bars, three questions in
 * one read) before teeth joins the describer, and noted the honest answer is
 * null on most casting portraits. That makes the population the whole
 * measurement: a bench run on eight closed mouths would report a clean, empty,
 * meaningless null — *a null result is evidence only if the fixture could have
 * produced a non-null*.
 *
 * So this dumps candidate frames to disk for a HUMAN eye to label
 * teeth-visible / not, and the labels chosen here become the bench's two
 * strata. The model's own visibility reader runs later, beside the labels,
 * never as the gate on them.
 *
 * FREE: storage reads and local image work only. No text calls, no renders,
 * no credits, no writes to the database.
 *
 *   npx tsx scripts/teeth-pool-dump-disposable.mts
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { storageReadBytes } from "../server/storage";

const POOL = Number(process.env.POOL ?? 12);
const OUT = "output/teeth-bench/pool";
mkdirSync(OUT, { recursive: true });

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const databaseUrl = process.env[databaseKey];
if (!databaseUrl) throw new Error("no database URL");
const where = new URL(databaseUrl.replace(/^mysql:/, "http:"));
console.log(`WORLD: ${databaseKey} → ${where.hostname}:${where.port}`);

const connection = await openDatabase(databaseUrl);
const [pool] = await connection.query<any[]>(
  `SELECT id, publicId, imageKey FROM casting_candidates
    WHERE userId = 1 AND status = 'ready' AND imageKey IS NOT NULL
    ORDER BY id ASC`,
);
await connection.end();

console.log(`${pool.length} ready faces on this world`);
if (pool.length < POOL) throw new Error(`only ${pool.length} ready faces — asked for ${POOL}`);

/* Evenly across the pool, the shipped bench's own rule: a population chosen by
   recency is several versions of one face wearing different hair. */
const step = (pool.length - 1) / (POOL - 1);
const chosen = Array.from({ length: POOL }, (_, i) => pool[Math.round(i * step)]);

const manifest: any[] = [];
for (const [index, row] of chosen.entries()) {
  const frame = await storageReadBytes(row.imageKey);
  const image = sharp(frame.bytes);
  const meta = await image.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  /* The whole frame, small enough to read at a glance. */
  await sharp(frame.bytes).resize({ width: 560 }).jpeg({ quality: 88 })
    .toFile(`${OUT}/${String(index).padStart(2, "0")}-${row.publicId.slice(0, 8)}-frame.jpg`);

  /* The mouth's neighbourhood at native resolution: a casting master is framed
     mid-torso up, so the head sits in the top third and the mouth a little
     below its middle. Generous on every side — this is for an eye, not a
     measurement, and a band that misses the mouth would produce a label about
     nothing. */
  const cropTop = Math.round(height * 0.12);
  const cropHeight = Math.round(height * 0.30);
  const cropLeft = Math.round(width * 0.22);
  const cropWidth = Math.round(width * 0.56);
  await sharp(frame.bytes)
    .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
    .resize({ width: 700 })
    .jpeg({ quality: 92 })
    .toFile(`${OUT}/${String(index).padStart(2, "0")}-${row.publicId.slice(0, 8)}-mouth.jpg`);

  manifest.push({ index, id: row.id, publicId: row.publicId, imageKey: row.imageKey, width, height });
  console.log(`  ${String(index).padStart(2)}  #${row.id}  ${row.publicId.slice(0, 8)}  ${width}x${height}`);
}

writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2), "utf8");
console.log(`\nwritten to ${OUT}/ — label by eye, then run the bench with the two strata`);
process.exit(0);
