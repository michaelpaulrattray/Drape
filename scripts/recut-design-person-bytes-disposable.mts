/**
 * RE-CUT IN PLACE — the person leaves four dev design objects that were cut
 * before `cutOutPixels` zeroed the colour under a cleared alpha
 * (found opus-909 §2, ruled fable-1217 §1).
 *
 *   npx tsx scripts/recut-design-person-bytes-disposable.mts --apply
 *
 * # Why re-cut and not purge
 *
 * Two dev variants name a flagged design in their `inkApplied`, so deleting the
 * rows would leave pointers at nothing — a worse state than the one being
 * cleaned. Re-cutting removes the hidden picture and keeps every dependant
 * working.
 *
 * # THE DIGEST MOVES WITH THE BYTES, IN THE SAME ACT
 *
 * `inkPlateMint.ts` re-hashes the fetched object and compares it against
 * `design.digest`, and refuses when they differ (fable-1137 §3b's moved-bytes
 * refusal). That fence is a good one and is not blinked off for this: the row's
 * `digest` and `byteSize` are written immediately after the object, and the
 * whole thing is READ BACK from R2 and re-hashed before the script calls it
 * done — the ceremonies' read-apply-read-back rite, on a smaller subject.
 *
 * # It refuses to touch anything that is not the world it was pointed at
 *
 * `assertOneWorld` on `DATABASE_URL`, and a dry run unless `--apply` is given.
 */
import "dotenv/config";

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

import { storagePut } from "../server/storage";
import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

const OUT = "output/court-upscale-alpha";
const APPLY = process.argv.includes("--apply");

assertOneWorld(["DATABASE_URL"]);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("no DATABASE_URL");
const base = process.env.R2_PUBLIC_URL;
if (!base) throw new Error("R2_PUBLIC_URL is not set");

await mkdir(OUT, { recursive: true });
const connection = await openDatabase(databaseUrl);
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

/** Zero the colour under every fully-cleared pixel; touch nothing else. */
async function personFree(bytes: Buffer): Promise<{ png: Buffer; hidden: number } | null> {
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) return null;
  let hidden = 0;
  for (let at = 0; at < info.width * info.height; at += 1) {
    if (data[at * 4 + 3] !== 0) continue;
    if (data[at * 4] !== 0 || data[at * 4 + 1] !== 0 || data[at * 4 + 2] !== 0) hidden += 1;
    data[at * 4] = 0; data[at * 4 + 1] = 0; data[at * 4 + 2] = 0;
  }
  const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
  return { png, hidden };
}

const [rows] = await connection.query<any[]>(
  `SELECT publicId, userId, placement, storageKey, digest, byteSize, mime, width, height
     FROM casting_ink_designs ORDER BY id`,
);

console.log(APPLY ? "APPLYING\n" : "DRY RUN — pass --apply to write\n");
let touched = 0;
for (const row of rows) {
  const url = `${base.replace(/\/$/, "")}/${row.storageKey}`;
  const response = await fetch(url).catch(() => null);
  if (!response?.ok) { console.log(`${row.publicId}  UNREACHABLE`); continue; }
  const before = Buffer.from(await response.arrayBuffer());
  const cleaned = await personFree(before);
  if (cleaned === null) { console.log(`${row.publicId}  not RGBA — left alone`); continue; }
  if (cleaned.hidden === 0) { console.log(`${row.publicId}  already clean`); continue; }

  console.log(`${row.publicId}  user ${row.userId}  ${row.placement}  ${row.width}x${row.height}`);
  console.log(`   hidden pixels: ${cleaned.hidden}`);
  console.log(`   digest   before ${row.digest}`);
  console.log(`            after  ${sha(cleaned.png)}`);
  console.log(`   byteSize before ${row.byteSize} -> after ${cleaned.png.byteLength}`);
  /* The row's recorded digest is proven to describe the CURRENT object before
     anything is replaced — a row already out of step with its bytes is a
     different problem and must not be silently repaired by this. */
  if (sha(before) !== row.digest) {
    console.log("   ⚠ the row's digest does NOT match the object as it stands — refusing to touch this one");
    continue;
  }
  if (!APPLY) { touched += 1; continue; }

  await storagePut(row.storageKey, cleaned.png, row.mime ?? "image/png");
  await connection.query(
    "UPDATE casting_ink_designs SET digest = ?, byteSize = ? WHERE publicId = ?",
    [sha(cleaned.png), cleaned.png.byteLength, row.publicId],
  );

  /* READ BACK — from R2, re-hashed, compared against what the row now says. */
  const readBack = Buffer.from(await (await fetch(`${url}?v=${sha(cleaned.png).slice(0, 8)}`)).arrayBuffer());
  const [after] = await connection.query<any[]>(
    "SELECT digest, byteSize FROM casting_ink_designs WHERE publicId = ?",
    [row.publicId],
  );
  const agrees = sha(readBack) === after[0]?.digest && readBack.byteLength === after[0]?.byteSize;
  const stillHidden = (await personFree(readBack))?.hidden ?? -1;
  console.log(`   read back: object ${sha(readBack).slice(0, 16)}…  row ${String(after[0]?.digest).slice(0, 16)}…`
    + `  ${agrees ? "AGREE" : "⚠ DISAGREE"}   hidden now ${stillHidden}`);
  touched += 1;
}

console.log(`\n${touched} object(s) ${APPLY ? "re-cut" : "would be re-cut"}.`);
await connection.end();
process.exit(0);
