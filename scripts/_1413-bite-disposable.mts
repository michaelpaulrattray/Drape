/**
 * #1413 — WHERE DOES `boundForJudge` ACTUALLY BITE? Offline, free, no model
 * calls, no writes. Reads real frames out of the dev database's own signed
 * casts and derives the crop and phone-photo shapes from them, because the
 * crop sizes this card must decide about (24-823 px) are measured numbers in
 * `realizationCaption.ts` and a guess about them would be the thing law 7b
 * forbids.
 *
 *   npx tsx scripts/_1413-bite-disposable.mts
 */
import "dotenv/config";
import sharp from "sharp";

import { boundForJudge, JUDGE_FRAME_LONG_EDGE } from "../server/castingV2/judgeFrame";
import type { ReferenceImage } from "../server/providers/types";
import { openDatabase, resolveDatabaseUrl } from "./lib/dbConnection.mts";

const db = await openDatabase(resolveDatabaseUrl());
const [rows] = await db.query<Array<Record<string, unknown>>>(
  `select id, viewType, storageUrl from model_assets
    where storageUrl <> '' order by id desc limit 6`,
);
await db.end();

const png = (bytes: Buffer): ReferenceImage => ({ bytes, contentType: "image/png" });
const kb = (n: number) => (n / 1024).toFixed(0).padStart(7);
const b64mb = (n: number) => ((n * 4) / 3 / 1024 / 1024).toFixed(2).padStart(6);

console.log(`JUDGE_FRAME_LONG_EDGE = ${JUDGE_FRAME_LONG_EDGE}\n`);
console.log("label                        source px      src KB   as b64   out KB   out b64  bounded  ctype");
console.log("-".repeat(104));

async function report(label: string, image: ReferenceImage) {
  const meta = await sharp(image.bytes).metadata();
  const out = await boundForJudge(image);
  console.log(
    `${label.padEnd(28)} ${`${meta.width}x${meta.height}`.padEnd(11)}`
    + ` ${kb(image.bytes.length)} ${b64mb(image.bytes.length)}MB`
    + ` ${kb(out.image.bytes.length)} ${b64mb(out.image.bytes.length)}MB`
    + `  ${String(out.record.bounded).padEnd(7)} ${out.image.contentType}`,
  );
  return out;
}

let master: Buffer | null = null;
for (const row of rows) {
  const response = await fetch(String(row.storageUrl));
  if (!response.ok) { console.log(`  (asset ${String(row.id)}: HTTP ${response.status})`); continue; }
  const bytes = Buffer.from(await response.arrayBuffer());
  await report(`asset ${String(row.id)} ${String(row.viewType)}`, png(bytes));
  if (!master) master = bytes;
}

if (!master) throw new Error("no frame loaded — the measurement cannot run on nothing");
console.log();

/* A 4K view's shape (#1373/#1387, open): the pixel half starts biting here. */
const fourK = await sharp(master).resize({ width: 2760, height: 4136, fit: "fill" }).png().toBuffer();
await report("4K view shape (2760x4136)", png(fourK));

/* A customer's phone photograph: 24 MP, JPEG, inside the door's 8 MB cap. */
for (const q of [80, 90]) {
  const photo = await sharp(master).resize({ width: 4000, height: 6000, fit: "fill" }).jpeg({ quality: q }).toBuffer();
  await report(`phone photo 4000x6000 q${q}`, { bytes: photo, contentType: "image/jpeg" });
}

console.log();
/* THE CROP QUESTION, on the real measured sizes from realizationCaption.ts. */
for (const [w, h] of [[24, 66], [27, 74], [36, 99], [463, 700], [823, 1100], [2000, 2400]] as const) {
  const crop = await sharp(master).resize({ width: w, height: h, fit: "fill" }).png().toBuffer();
  await report(`cut ${w}x${h} (png)`, png(crop));
}

process.exit(0);
