/**
 * DOES A MINTED BOX STILL FIT THE FEATURE IT NAMES? — the reading fable-749 §3b
 * authorized, and the one that decides the horn-box flip.
 *
 * # The question, and why the last reading could not answer it
 *
 * The founder: *"since the horns are bigger in the new render the bounding box
 * never adjusted for the size."* Confirmed at the code (opus-544 §2): the panel
 * takes `held.box ?? found.box` (`facePanel.ts:539`) — the LIBRARY's minted
 * geometry wins whole, and the scan's fresh box only fills a slot the library
 * has nothing for. A feature that grew keeps outgrowing a box anchored to
 * history.
 *
 * The one-line fix is to flip that preference. I declined to flip it on the eye
 * rate, and then said why the eye rate could not license it either (opus-546
 * §4): that reading measured box PRESENCE, and the flip's real risk is a
 * scanned box that is present and WORSE. This measures the thing that decides
 * it.
 *
 * # WHAT IS COMPARED, AND AGAINST WHAT
 *
 * For every library row carrying geometry, the slot's own question is put to the
 * candidate's CURRENT frame and the fresh box is compared to the minted one by
 * intersection-over-union.
 *
 * ```
 * IoU ≈ 1     the minted box still fits — the flip changes nothing here
 * IoU low     the two disagree. WHICH is right is not decided by this number:
 *             a grown feature and a bad fresh read look identical in IoU, and
 *             they argue in opposite directions.
 * ```
 *
 * That ambiguity is the point of also reporting AREA RATIO: a feature that grew
 * makes the fresh box BIGGER than the minted one, while a poor read is as
 * likely to be smaller. The two columns together say more than either alone,
 * and neither is a verdict — the frames are what settle it (law 9), which is
 * why the worst cells are written out as candidate ids somebody can look at.
 *
 * # THE FRAME IS PART OF THE BOX
 *
 * A minted box carries the frame it was measured on (`frameWidth/Height`), and
 * comparing a rectangle across two differently-sized frames without scaling is
 * the wrong-boundary class in its cheapest form. Rows whose frame differs are
 * scaled, and the count of them is reported rather than hidden.
 *
 * # SPEND
 *
 * One region call per (candidate, feature) — a bilateral pair is ONE call read
 * two-sidedly, exactly as the scan does it. No full `scanFace`, so this is a
 * fraction of a scan's twenty questions.
 *
 *   npx tsx scripts/read-box-drift-disposable.mts
 */
import "dotenv/config";
import { mkdirSync } from "node:fs";

import sharp from "sharp";

import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mts";
import { teeTo, openLedgerWatch } from "./lib/benchKit.mts";
import { scanPlan } from "../server/castingV2/faceScan.ts";
import { detectionFloorFor } from "../server/castingV2/bornWornDetector.ts";
import { binaryCoverage } from "../server/castingV2/maskGeometry.ts";
import { boundsOf } from "../server/castingV2/segmentCuts.ts";
import { createFalRegionReader } from "../server/castingV2/falRegionReader.ts";
import { storageReadBytes, storagePublicUrl } from "../server/storage.ts";

const OUT = "output/box-drift";
mkdirSync(OUT, { recursive: true });
const say = teeTo(`${OUT}/drift.txt`);

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) throw new Error("FAL_KEY is required");

const USD_PER_READ = 0.005;
let reads = 0;

/* Same world guard as the eye rate, and for the same reason: the rows and the
   bytes must be in one world or the reading is of a world nobody chose. */
const url = resolveDatabaseUrl();
if (!url) throw new Error("no database url — pass one, or run under the service that injects it");
const bucket = process.env.R2_BUCKET ?? "";
const rowsProd = url.includes(":23768");
const bytesProd = bucket === "drape-production";
say(`world     rows ${worldOf(url)} · bytes ${bucket}`);
if (rowsProd !== bytesProd) {
  say("*** REFUSING TO READ — rows and bytes are in different worlds. ***");
  process.exit(2);
}
say(`          → ${rowsProd ? "PRODUCTION" : "DEV"}, both halves agreeing`);
say();

const db = await openDatabase(url);
const query = async (sql: string, params?: unknown[]) => {
  const [rows] = await db.query<any[]>(sql, params);
  return rows;
};
const ledger = await openLedgerWatch({ query, userId: 1 });

/** feature → the question the product asks for it. Never retyped. */
const questionOf = new Map(scanPlan().map((entry) => [entry.feature, entry.question]));

type LibRow = {
  candidate: string; imageKey: string; slot: string; variantId: string | null;
  bboxX: number; bboxY: number; bboxW: number; bboxH: number;
  frameWidth: number; frameHeight: number;
};

const rows = await query(
  `SELECT c.publicId AS candidate, c.imageKey, l.slot, l.variantId,
          l.bboxX, l.bboxY, l.bboxW, l.bboxH, l.frameWidth, l.frameHeight
   FROM casting_reference_library l JOIN casting_candidates c ON c.id = l.candidateId
   WHERE l.retiredAt IS NULL AND l.bboxW IS NOT NULL AND c.imageKey IS NOT NULL
   ORDER BY c.publicId, l.slot`,
) as LibRow[];
say(`library rows carrying geometry: ${rows.length}`);

/* Grouped by (candidate, feature) so a bilateral pair is ONE reading, exactly
   as the scan groups it — two calls for one pair would be paying twice for one
   answer and inviting two different ones. */
const groups = new Map<string, { candidate: string; imageKey: string; feature: string; rows: LibRow[] }>();
for (const row of rows) {
  const feature = row.slot.split("@")[0]!;
  if (!questionOf.has(feature)) continue;
  const key = `${row.candidate}::${feature}`;
  const held = groups.get(key);
  if (held) held.rows.push(row);
  else groups.set(key, { candidate: row.candidate, imageKey: row.imageKey, feature, rows: [row] });
}
say(`(candidate, feature) readings to take: ${groups.size}`);
say();

type Cell = { slot: string; candidate: string; iou: number; areaRatio: number; scaled: boolean };
const cells: Cell[] = [];
let missing = 0;

for (const group of groups.values()) {
  const question = questionOf.get(group.feature)!;
  try {
    const frame = await storageReadBytes(group.imageKey);
    const meta = await sharp(frame.bytes).metadata();
    if (!meta.width || !meta.height) throw new Error("frame has no readable size");
    const reader = createFalRegionReader({ apiKey: FAL_KEY });
    const bilateral = group.rows.some((row) => row.slot.includes("@"));
    const floor = detectionFloorFor(question, bilateral ? "side" : "frame").floor;

    /* The whole-frame reading, taken at most once per group for the same reason
       the per-side one is: two calls for one answer is paying twice and
       inviting two different answers. */
    let wholeOnce: any;
    const wholeFrameMask = async () => {
      if (wholeOnce === undefined) {
        wholeOnce = await reader.region({
          image: frame.bytes, name: question, absentIsAnswer: true,
          imageUrl: storagePublicUrl(group.imageKey),
        });
        reads += 1;
      }
      return wholeOnce;
    };

    /* One reading serves both sides of a pair — taken once, sliced per slot. */
    let sidesOnce: { left: any; right: any } | null | undefined;
    for (const row of group.rows) {
      let mask;
      if (bilateral && reader.regionSides) {
        if (sidesOnce === undefined) {
          sidesOnce = await reader.regionSides({
            image: frame.bytes, name: question, absentIsAnswer: true,
            imageUrl: storagePublicUrl(group.imageKey),
          });
          reads += 2;
        }
        mask = sidesOnce === null ? null : (row.slot.endsWith("@left") ? sidesOnce.left : sidesOnce.right);
      } else {
        mask = await wholeFrameMask();
      }
      if (!mask || binaryCoverage(mask) <= floor) {
        missing += 1;
        say(`  ${row.candidate.slice(0, 8)} ${row.slot.padEnd(14)} the scan found NOTHING here`);
        continue;
      }
      const b = boundsOf(mask);
      if (!b) { missing += 1; continue; }
      /* The minted box carries the frame it was measured on. Scaling is not a
         nicety: comparing rectangles across two frame sizes is the
         wrong-boundary class at its cheapest. */
      const sx = meta.width / (row.frameWidth || meta.width);
      const sy = meta.height / (row.frameHeight || meta.height);
      const scaled = Math.abs(sx - 1) > 1e-9 || Math.abs(sy - 1) > 1e-9;
      const minted = {
        x: row.bboxX * sx, y: row.bboxY * sy, w: row.bboxW * sx, h: row.bboxH * sy,
      };
      const fresh = { x: b.x, y: b.y, w: b.width, h: b.height };
      const ix = Math.max(0, Math.min(minted.x + minted.w, fresh.x + fresh.w) - Math.max(minted.x, fresh.x));
      const iy = Math.max(0, Math.min(minted.y + minted.h, fresh.y + fresh.h) - Math.max(minted.y, fresh.y));
      const inter = ix * iy;
      const union = minted.w * minted.h + fresh.w * fresh.h - inter;
      const iou = union > 0 ? inter / union : 0;
      const areaRatio = (minted.w * minted.h) > 0 ? (fresh.w * fresh.h) / (minted.w * minted.h) : 0;
      cells.push({ slot: row.slot, candidate: row.candidate, iou, areaRatio, scaled });
      say(
        `  ${row.candidate.slice(0, 8)} ${row.slot.padEnd(14)} IoU ${iou.toFixed(3)}  `
        + `fresh/minted area ${areaRatio.toFixed(2)}×${scaled ? "  (frames differ — scaled)" : ""}`,
      );
    }
  } catch (error) {
    say(`  ${group.candidate.slice(0, 8)} ${group.feature.padEnd(14)} FAILED — ${String(error).slice(0, 80)}`);
  }
}

say();
say("═══ THE DRIFT, with n ═══");
say();
if (cells.length === 0) {
  say("*** RUN INVALID — no slot produced a comparable pair of boxes. ***");
} else {
  const sorted = [...cells].sort((a, b) => a.iou - b.iou);
  const median = sorted[Math.floor(sorted.length / 2)]!.iou;
  const fits = cells.filter((c) => c.iou >= 0.7).length;
  const grew = cells.filter((c) => c.iou < 0.7 && c.areaRatio > 1.15).length;
  const shrank = cells.filter((c) => c.iou < 0.7 && c.areaRatio < 0.87).length;
  say(`n = ${cells.length} comparable boxes · ${missing} slot(s) the scan could not find`);
  say(`median IoU        ${median.toFixed(3)}`);
  say(`fits (IoU ≥ 0.70) ${fits}/${cells.length}`);
  say(`disagrees, fresh BIGGER  ${grew}/${cells.length}   ← the "it grew" shape`);
  say(`disagrees, fresh SMALLER ${shrank}/${cells.length}   ← the "bad read" shape`);
  say();
  say("worst five, for eyes rather than for arithmetic:");
  for (const c of sorted.slice(0, 5)) {
    say(`  ${c.candidate} ${c.slot.padEnd(14)} IoU ${c.iou.toFixed(3)} area ${c.areaRatio.toFixed(2)}×`);
  }
}
say();
say(`house money: ${reads} segmenter reads × $${USD_PER_READ} = $${(reads * USD_PER_READ).toFixed(3)}`);
say((await ledger.close()).line);

await db.end();
process.exit(0);
