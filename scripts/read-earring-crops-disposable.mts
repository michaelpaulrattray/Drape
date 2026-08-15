/**
 * WERE THE TWO CROSSES THE SAME OBJECT? — the free crop-to-crop look.
 * (fable-590 §2, sharpened by his eyewitness in 591: he says the pair was
 * matched and the per-side WORDS diverged anyway.)
 *
 * Reads the two filed crops from the render that made them and puts them side
 * by side, with their own numbers beside the picture: a pair described
 * differently is either two different objects (the records would be honest) or
 * one object described twice differently (a describer-variance finding).
 *
 * Read-only, and the BUCKET is named explicitly: `railway run --service MySQL`
 * injects the database and nothing else, so R2_PUBLIC_URL would quietly be the
 * dev bucket and every fetch would 404 about the wrong world.
 *
 *   railway run --service MySQL npx tsx scripts/read-earring-crops-disposable.mts
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";

import sharp from "sharp";

import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mts";

const OUT = "output/earring-crops";
mkdirSync(OUT, { recursive: true });
const url = resolveDatabaseUrl();
if (!url) throw new Error("no database url");
const productionBucket = "https://pub-990e39d8d995468eb61aced83162123a.r2.dev";
const bucket = worldOf(url).includes("23768") ? productionBucket : process.env.R2_PUBLIC_URL;
console.log(`world: ${worldOf(url)} · bucket ${bucket}`);
const conn = await openDatabase(url);

const [rows] = await conn.execute(
  `SELECT id, slot, storageKey, bboxW, bboxH, JSON_UNQUOTE(JSON_EXTRACT(words, '$[0]')) AS words
     FROM casting_reference_library
    WHERE slot LIKE 'earring%' AND storageKey IS NOT NULL AND retiredAt IS NULL
    ORDER BY id DESC LIMIT 2`,
);
const crops = rows as Array<{ id: number; slot: string; storageKey: string; bboxW: number; bboxH: number; words: string }>;
const tiles: sharp.OverlayOptions[] = [];
let at = 0;
for (const crop of crops.sort((a, b) => a.slot.localeCompare(b.slot))) {
  const response = await fetch(`${bucket}/${crop.storageKey}`);
  console.log(`  ${crop.slot.padEnd(14)} ${crop.bboxW}×${crop.bboxH}px · HTTP ${response.status} · "${(crop.words ?? "").slice(0, 60)}"`);
  if (!response.ok) continue;
  const bytes = Buffer.from(await response.arrayBuffer());
  writeFileSync(`${OUT}/${crop.slot.replace("@", "-")}.png`, bytes);
  const meta = await sharp(bytes).metadata();
  console.log(`                 file ${meta.width}×${meta.height}, ${(bytes.length / 1024).toFixed(0)}kB`);
  tiles.push({
    input: await sharp(bytes).resize(360, 480, { fit: "contain", background: { r: 245, g: 245, b: 245 } }).png().toBuffer(),
    left: 8 + at * 368,
    top: 8,
  });
  at += 1;
}
if (tiles.length === 2) {
  await sharp({ create: { width: 8 + 2 * 368, height: 496, channels: 3, background: { r: 245, g: 245, b: 245 } } })
    .composite(tiles).png().toFile(`${OUT}/pair.png`);
  console.log(`\nside by side → ${OUT}/pair.png (left, then right)`);
}
await conn.end();
process.exit(0);
