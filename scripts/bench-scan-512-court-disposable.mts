/**
 * THE 512px COURT — may the SCAN's display reads use a cheaper eye? (fable-358
 * §4, design note §6.)
 *
 * opus-293 measured one nose answered 31× faster at 512px and 0.24% of frame
 * against the full read's 0.27%. That is close, and **close is not a finding**:
 * one region on one face, compared on a single number that cannot tell a
 * slightly smaller nose from a box that has slid onto her lip.
 *
 * The boundary Fable drew stands and this does not touch it: **a crop that can
 * ever ride a recipe is cut from the full-resolution master, no exceptions.**
 * The only thing on trial here is the scan's DISPLAY geometry — the boxes and
 * stencils that draw a 34px thumbnail and a click target.
 *
 *   npx tsx scripts/bench-scan-512-court-disposable.mts [--faces 2]
 *
 * # THE BAR, PRE-REGISTERED — written and committed before the first call
 *
 * Per region, per face, all three must hold:
 *
 *   IoU              ≥ 0.75   the wrong-feature catcher. A cheap box that
 *                             landed on her cheek instead of her eye scores
 *                             near zero here however plausible its area is —
 *                             which is the failure a percentage-of-frame
 *                             comparison cannot see.
 *   centre offset    ≤ 1.0%   of the frame's longer side.
 *   area ratio       within ±25% of the full-resolution box.
 *
 * **Adopt only if EVERY region on EVERY face passes all three**, and print
 * every region that does not. A region the cheap eye misses entirely — a box at
 * full resolution and none at 512 — counts as a FAILURE, not as an absence,
 * because a thumbnail that vanishes at the cheaper size is the same defect
 * wearing a different hat.
 *
 * # THE TRAP THIS SCRIPT MUST NOT FALL INTO
 *
 * The 512px picture has no URL. Passing the master's address alongside the
 * cheap bytes would hand the segmenter a different picture from the one the
 * geometry is measured in — the wrong-frame class this program keeps paying
 * for. So the address travels with the full-resolution arm only, and the cheap
 * arm uploads.
 *
 * House money, off-ledger, no user credits. Read-only: no row, no object.
 */
import "dotenv/config";
import sharp from "sharp";

import { scanFace } from "../server/castingV2/faceScan";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { storagePublicUrl, storageReadBytes } from "../server/storage";
import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

const BAR = { iou: 0.75, centrePercent: 1.0, areaRatio: 0.25 };
const CHEAP_WIDTH = 512;

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const databaseUrl = process.env[databaseKey];
if (!databaseUrl) throw new Error("no database URL");
const where = new URL(databaseUrl.replace(/^mysql:/, "http:"));
console.log(`WORLD: ${databaseKey} → ${where.hostname}:${where.port}`);
console.log(`BAR (pre-registered): IoU ≥ ${BAR.iou} · centre ≤ ${BAR.centrePercent}% of the longer side · area within ±${BAR.areaRatio * 100}%\n`);

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY is required");

const connection = await openDatabase(databaseUrl);
const [rows] = await connection.query<any[]>(
  `SELECT id, imageKey FROM casting_candidates
    WHERE userId = 1 AND status = 'ready' AND imageKey IS NOT NULL
    ORDER BY id DESC LIMIT ?`,
  [Number(arg("faces", "2"))],
);
await connection.end();

type Box = { x: number; y: number; width: number; height: number };

function intersectionOverUnion(a: Box, b: Box): number {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const overlap = Math.max(0, right - left) * Math.max(0, bottom - top);
  const union = a.width * a.height + b.width * b.height - overlap;
  return union === 0 ? 0 : overlap / union;
}

const verdicts: { face: number; slot: string; iou: number; centre: number; area: number; passed: boolean; why: string }[] = [];

for (const face of rows) {
  const frame = await storageReadBytes(face.imageKey);
  const url = storagePublicUrl(face.imageKey);
  const full = await sharp(frame.bytes).metadata();
  if (!full.width || !full.height) throw new Error("the frame has no readable size");

  const cheapBytes = await sharp(frame.bytes).resize({ width: CHEAP_WIDTH }).jpeg({ quality: 92 }).toBuffer();
  const cheap = await sharp(cheapBytes).metadata();
  const scale = full.width / cheap.width!;

  const startedFull = Date.now();
  const fullScan = await scanFace({
    frame: { bytes: frame.bytes, width: full.width, height: full.height, url },
    reader: createFalRegionReader({ apiKey }),
  });
  const fullMs = Date.now() - startedFull;

  const startedCheap = Date.now();
  /* NO URL on this arm — see the header. The cheap picture exists only here. */
  const cheapScan = await scanFace({
    frame: { bytes: cheapBytes, width: cheap.width!, height: cheap.height! },
    reader: createFalRegionReader({ apiKey }),
  });
  const cheapMs = Date.now() - startedCheap;

  console.log(`cand ${face.id}  ${full.width}×${full.height} in ${(fullMs / 1000).toFixed(1)}s`
    + `  ·  ${cheap.width}×${cheap.height} in ${(cheapMs / 1000).toFixed(1)}s`
    + `  ·  ${fullScan.boxes.size} slots vs ${cheapScan.boxes.size}`);

  const longer = Math.max(full.width, full.height);
  for (const [slot, box] of Array.from(fullScan.boxes.entries())) {
    const cheapBox = cheapScan.boxes.get(slot);
    if (!cheapBox) {
      verdicts.push({ face: face.id, slot, iou: 0, centre: Infinity, area: Infinity, passed: false, why: "the cheap eye found nothing here" });
      continue;
    }
    const lifted: Box = {
      x: cheapBox.x * scale,
      y: cheapBox.y * scale,
      width: cheapBox.width * scale,
      height: cheapBox.height * scale,
    };
    const iou = intersectionOverUnion(box, lifted);
    const centre = Math.hypot(
      (box.x + box.width / 2) - (lifted.x + lifted.width / 2),
      (box.y + box.height / 2) - (lifted.y + lifted.height / 2),
    ) / longer * 100;
    const area = Math.abs((lifted.width * lifted.height) / (box.width * box.height) - 1);
    const passed = iou >= BAR.iou && centre <= BAR.centrePercent && area <= BAR.areaRatio;
    verdicts.push({
      face: face.id,
      slot,
      iou,
      centre,
      area,
      passed,
      why: passed ? "" : [
        iou < BAR.iou ? `IoU ${iou.toFixed(2)}` : null,
        centre > BAR.centrePercent ? `centre ${centre.toFixed(2)}%` : null,
        area > BAR.areaRatio ? `area ${(area * 100).toFixed(0)}% off` : null,
      ].filter(Boolean).join(", "),
    });
  }
  /* And the other direction: a slot the CHEAP eye invented. */
  for (const slot of Array.from(cheapScan.boxes.keys())) {
    if (fullScan.boxes.has(slot)) continue;
    verdicts.push({ face: face.id, slot, iou: 0, centre: Infinity, area: Infinity, passed: false, why: "only the cheap eye found this — the full read has no box for it" });
  }
}

console.log("\n--- every region, both faces ---");
for (const verdict of verdicts) {
  console.log(`${verdict.passed ? "ok  " : "FAIL"} cand ${verdict.face} ${verdict.slot.padEnd(14)}`
    + ` IoU ${verdict.iou.toFixed(3)}  centre ${Number.isFinite(verdict.centre) ? `${verdict.centre.toFixed(2)}%` : "—"}`
    + `  area ${Number.isFinite(verdict.area) ? `${(verdict.area * 100).toFixed(0)}%` : "—"}`
    + (verdict.why ? `   ← ${verdict.why}` : ""));
}

const failures = verdicts.filter((verdict) => !verdict.passed);
console.log(`\nVERDICT: ${failures.length === 0 ? "ADOPT" : "DO NOT ADOPT"} — ${verdicts.length - failures.length}/${verdicts.length} regions inside the pre-registered bar`);
if (failures.length > 0) {
  console.log(`failing regions: ${failures.map((failure) => `${failure.slot}@${failure.face}`).join(", ")}`);
}
process.exit(0);
