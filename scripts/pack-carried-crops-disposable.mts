/**
 * THE CARRIED PATCH, MADE VISIBLE — block 4 of the visual judgment pack.
 *
 * The campaign's strongest architectural claim is a number: 20,036 of 24,056
 * freckle pixels byte-identical four paid renders later. The founder asked to
 * see the tests rather than read the tables, and a byte count is the least
 * seeable claim in the program. So this cuts the same window out of the frame
 * where the facet landed and the frame four renders later, at 3x, and puts a
 * third tile beside them that is the DIFFERENCE — because "identical" is a
 * claim about pixels and the honest way to show it is to show what changed.
 *
 * Reads only: production rows, the public bucket, no model, no spend.
 *
 *   PUBLIC_BASE=<bucket url> railway.cmd run --service MySQL -- \
 *     npx tsx scripts/pack-carried-crops-disposable.mts --candidate f9e9cb81 --facet marks
 */
import { mkdirSync, writeFileSync } from "node:fs";

import mysql from "mysql2/promise";
import sharp from "sharp";

import { assertOneWorld } from "./lib/worldGuard.mts";
import { openDatabase } from "./lib/dbConnection.mts";

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const url = process.env[databaseKey];
const publicBase = process.env.PUBLIC_BASE;
if (!url) { console.error("no database url — run under `railway run --service MySQL`"); process.exit(1); }
if (!publicBase) { console.error("PUBLIC_BASE (the bucket's public url) is required — and it must be the world the rows came from"); process.exit(1); }

const candidatePrefix = arg("candidate");
const wantedFacet = arg("facet", "marks");
const SCALE = Number(arg("scale", "3"));
const OUT = arg("out", "output/pack/carried");
if (!candidatePrefix) { console.error("--candidate <publicId prefix> is required"); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const connection = await openDatabase({ uri: url, timezone: "Z" } as any);
const query = async (sql: string, params: unknown[] = []): Promise<any[]> => {
  const [rows] = await connection.query<any[]>(sql, params);
  return rows;
};

const [candidate] = await query(
  "SELECT id, publicId, personaLine FROM casting_candidates WHERE publicId LIKE ?",
  [`${candidatePrefix}%`],
);
if (!candidate) { console.error(`no candidate ${candidatePrefix}`); process.exit(1); }

const [segment] = await query(
  `SELECT id, facet, region, variantId, version, bboxX, bboxY, bboxW, bboxH, maskKey, contentKey
     FROM casting_segments WHERE candidateId = ? AND facet = ? ORDER BY id ASC LIMIT 1`,
  [candidate.id, wantedFacet],
);
if (!segment) { console.error(`no ${wantedFacet} segment on ${candidate.publicId}`); process.exit(1); }

/* Every landed frame from the one that filed the segment onwards — the chain
   the pixels had to survive. Ordered by id, which is the order they happened. */
const later = await query(
  `SELECT id, publicId, requestText, imageKey, createdAt FROM casting_candidate_variants
    WHERE candidateId = ? AND id >= ? AND imageKey IS NOT NULL ORDER BY id ASC`,
  [candidate.id, segment.variantId],
);
if (later.length < 2) { console.error("fewer than two landed frames from the filing render on — nothing to compare"); process.exit(1); }

const first = later[0];
const last = later[later.length - 1];
console.log(`candidate ${candidate.publicId} "${candidate.personaLine}"`);
console.log(`segment #${segment.id} ${segment.facet}@v${segment.version} region "${segment.region}" bbox ${segment.bboxX},${segment.bboxY} ${segment.bboxW}x${segment.bboxH}`);
console.log(`filed by variant ${first.id} ("${first.requestText}") ${first.createdAt.toISOString?.() ?? first.createdAt}`);
console.log(`compared against variant ${last.id} ("${last.requestText}") — ${later.length - 1} render(s) later\n`);

const fetchKey = async (key: string): Promise<Buffer> => {
  const response = await fetch(`${publicBase.replace(/\/$/, "")}/${key}`);
  if (!response.ok) throw new Error(`${response.status} on ${key}`);
  return Buffer.from(await response.arrayBuffer());
};

const box = {
  left: Number(segment.bboxX), top: Number(segment.bboxY),
  width: Number(segment.bboxW), height: Number(segment.bboxH),
};

const firstBytes = await fetchKey(first.imageKey);
const lastBytes = await fetchKey(last.imageKey);
const maskBytes = await fetchKey(segment.maskKey);

const cropOf = async (bytes: Buffer, name: string): Promise<Buffer> => {
  const raw = await sharp(bytes).extract(box)
    .resize(box.width * SCALE, box.height * SCALE, { kernel: "nearest" })
    .png().toBuffer();
  writeFileSync(`${OUT}/${name}.png`, raw);
  return raw;
};

await cropOf(firstBytes, `${candidatePrefix}-${wantedFacet}-delivered`);
await cropOf(lastBytes, `${candidatePrefix}-${wantedFacet}-later`);

/*
  THE DIFFERENCE, and it is the tile that makes the claim falsifiable.

  Two crops that look the same prove nothing — a person cannot see a
  four-thousand-pixel change across a face at reading distance, which is the
  entire reason this program measures instead of squinting. So the third tile
  is |later − delivered| inside the segment's own mask, amplified. Black means
  identical. Anything visible is a pixel that moved.
*/
const raw = async (bytes: Buffer) => sharp(bytes).extract(box).ensureAlpha().raw()
  .toBuffer({ resolveWithObject: true });
const a = await raw(firstBytes);
const b = await raw(lastBytes);
/*
  THE MASK IS ONE GREY CHANNEL, not an alpha channel — `encodeCut` writes it
  from raw `channels: 1`. Reading it through `ensureAlpha()` returns 255
  everywhere, so every pixel in the bbox counts as owned and the answer comes
  back as the bbox area. It did: 153,549 owned against the 24,056 this segment
  is known to hold. The reference number is what caught it, which is the whole
  argument for having one before trusting a new instrument.
*/
const maskMeta = await sharp(maskBytes).metadata();
if (maskMeta.width !== box.width || maskMeta.height !== box.height) {
  console.error(`mask is ${maskMeta.width}x${maskMeta.height} but the bbox is ${box.width}x${box.height} — refusing to resample a membership map`);
  process.exit(1);
}
const maskRaw = await sharp(maskBytes).greyscale().raw().toBuffer({ resolveWithObject: true });

const pixels = box.width * box.height;
const diff = Buffer.alloc(pixels * 4);
let owned = 0;
let identical = 0;
for (let index = 0; index < pixels; index += 1) {
  const at = index * 4;
  /* One grey channel, one byte per pixel — the membership map as written. */
  const inSegment = maskRaw.data[index]! > 127;
  if (!inSegment) {
    diff[at] = 12; diff[at + 1] = 12; diff[at + 2] = 12; diff[at + 3] = 255;
    continue;
  }
  owned += 1;
  const delta = Math.max(
    Math.abs(a.data[at]! - b.data[at]!),
    Math.abs(a.data[at + 1]! - b.data[at + 1]!),
    Math.abs(a.data[at + 2]! - b.data[at + 2]!),
  );
  if (delta === 0) identical += 1;
  /* Amplified 8x and clipped: a one-level change must be visible, because a
     one-level change is not "identical". */
  const shown = Math.min(255, delta * 8);
  diff[at] = shown; diff[at + 1] = shown; diff[at + 2] = shown; diff[at + 3] = 255;
}
await sharp(diff, { raw: { width: box.width, height: box.height, channels: 4 } })
  .resize(box.width * SCALE, box.height * SCALE, { kernel: "nearest" })
  .png().toFile(`${OUT}/${candidatePrefix}-${wantedFacet}-difference.png`);

const percent = owned === 0 ? 0 : (identical / owned) * 100;
console.log(`pixels the segment owns:      ${owned.toLocaleString()}`);
console.log(`byte-identical ${later.length - 1} render(s) later: ${identical.toLocaleString()}  (${percent.toFixed(2)}%)`);
console.log(`moved or overpainted:         ${(owned - identical).toLocaleString()}`);
console.log(`\nwritten to ${OUT}/`);

await connection.end();
process.exit(0);
