/**
 * THE PAIR TILE — what a matched pair should show at 34px, measured and looked at.
 *
 * The founder, on his own face (fable-382 §2): *"its only showing one eye."*
 * The eyes court closed as a reader question — his own v4 read BOTH eyes, nine
 * readings, nine two-sided (opus-303 §2) — so the symptom is one line of the
 * panel: a matched pair draws the LEFT instance's cutout and calls it "Her
 * eyes". Right for earrings, wrong for eyes, and he is the proof.
 *
 * fable-383 §3 approved the union of both boxes, "admissible only while it
 * remains a picture of the FEATURE", with the caution that two EARS union into
 * a head. This bench measures the union before anything is built, because the
 * arithmetic may refuse it before the taste question is even reached: a union
 * box across two eyes is a wide flat rectangle, and a wide flat rectangle drawn
 * to fit a 34px square is a SLIVER.
 *
 * ── THE BAR, WRITTEN BEFORE THE RUN ────────────────────────────────────────
 *
 * Three candidates for one row's tile:
 *
 *   (a) ONE INSTANCE, filling the tile      what ships today
 *   (b) THE UNION of both boxes             fable-382 §2's own words
 *   (c) BOTH INSTANCES ABUTTED              each keeps its own boundary, the
 *                                           gap between them removed
 *
 * Measured per face per bilateral feature (eyes, brows, ears):
 *
 *   1. the SHORT SIDE of the drawn content at a 34px tile. A cutout is fitted
 *      by its longest side, so a 7.5:1 union renders 34 x 4.5 — under 8px on
 *      the short side is a sliver nobody can read.
 *   2. the fraction of the tile's own area the feature's pixels occupy.
 *   3. whether each instance is recognisable in the contact sheet, by looking.
 *
 * DECISION RULE, pre-registered:
 *
 *   - (b) WINS if its short side is >= 8px on at least 5 of 6 pair-readings AND
 *     both instances are recognisable in the sheet.
 *   - (c) WINS if (b) fails that bar and (c) clears it.
 *   - (a) STANDS if both fail. A pair tile nobody can read is worse than one
 *     instance honestly shown, and the row's own name already says it is a pair.
 *
 * The number does not decide alone: the sheet is looked at (law 6) and the
 * reading is written beside the arithmetic. A candidate that wins on paper and
 * looks like a smear loses.
 *
 * House money, off-ledger, ZERO user credits. It writes no row and no object;
 * the sheets live in `output/pair-tile/`.
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";

import sharp from "sharp";

import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import type { Mask } from "../server/castingV2/maskedComposite";
import { boundsOf } from "../server/castingV2/segmentCuts";
import { storagePublicUrl, storageReadBytes } from "../server/storage";
import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const FACES = Number(arg("faces", "3"));
/** The panel's own tile size, from the stylesheet. */
const TILE = 34;
/** How much the sheet is blown up so a person can look at a 34px tile. */
const ZOOM = 8;
const OUT = "output/pair-tile";
mkdirSync(OUT, { recursive: true });

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const databaseUrl = process.env[databaseKey];
if (!databaseUrl) throw new Error("no database URL");
const where = new URL(databaseUrl.replace(/^mysql:/, "http:"));
console.log(`WORLD: ${databaseKey} → ${where.hostname}:${where.port}`);

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY is required — this bench reads real faces");

const lines: string[] = [];
function say(line = "") {
  console.log(line);
  lines.push(line);
}

type Box = { x: number; y: number; width: number; height: number };

function unionOf(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

/** How the panel draws a cutout: fitted by its LONGEST side into the tile. */
function drawnAt(box: Box): { width: number; height: number } {
  const longest = Math.max(box.width, box.height);
  return {
    width: (box.width / longest) * TILE,
    height: (box.height / longest) * TILE,
  };
}

/** One cutout: the frame cut to the box and stencilled by the mask. */
async function cutout(frame: Buffer, mask: Mask, box: Box): Promise<sharp.Sharp> {
  /* `.raw()` is load-bearing and its absence was visible: without it sharp
     picks an output format for a raw input and the alpha comes back at the
     wrong stride, which drew every tile in horizontal stripes. The frame's own
     alpha is REMOVED first — joining onto an image that already has one appends
     a fifth channel instead of replacing the fourth. */
  const alpha = await sharp(mask.data, { raw: { width: mask.width, height: mask.height, channels: 1 } })
    .extract({ left: box.x, top: box.y, width: box.width, height: box.height })
    /* THE SCAR THIS FILE ALREADY CARRIES ONE LAYER DOWN (`writeMaskPng`):
       sharp promotes a raw SINGLE-channel input to truecolour, so `.raw()`
       alone hands back three bytes per pixel and the alpha lands at a third of
       its intended stride. The positive control caught it — a synthetic circle
       came back with opaque corners. */
    .toColourspace("b-w")
    .raw()
    .toBuffer();
  /*
    ASSEMBLED BYTE BY BYTE, and the positive control
    (`probe-cutout-renderer-disposable.mts`) is why. Two library idioms both
    looked right and neither applied the mask: `joinChannel` added a fourth band
    PNG output did not read as alpha, and `dest-in` against a GREYSCALE stencil
    keeps everything, because that stencil's own alpha is 255 everywhere. Run 1
    of this bench was LOOKED AT before the control existed and every tile in it
    was an unstencilled rectangle — the arithmetic survived, the pictures did
    not.
  */
  const rgb = await sharp(frame)
    .extract({ left: box.x, top: box.y, width: box.width, height: box.height })
    .removeAlpha()
    .raw()
    .toBuffer();
  const rgba = Buffer.alloc(box.width * box.height * 4);
  for (let at = 0; at < box.width * box.height; at += 1) {
    rgba[at * 4] = rgb[at * 3]!;
    rgba[at * 4 + 1] = rgb[at * 3 + 1]!;
    rgba[at * 4 + 2] = rgb[at * 3 + 2]!;
    rgba[at * 4 + 3] = alpha[at]!;
  }
  const cut = await sharp(rgba, { raw: { width: box.width, height: box.height, channels: 4 } })
    .png()
    .toBuffer();
  return sharp(cut);
}

/** A candidate tile, drawn at the panel's own size then blown up to be looked at. */
async function tileOf(parts: { image: sharp.Sharp; box: Box }[]): Promise<Buffer> {
  const side = TILE * ZOOM;
  /* Each part gets an equal share of the tile's width, contained inside it —
     the same `contain` the stylesheet applies, once per part. */
  const share = Math.floor(side / parts.length);
  const composited: sharp.OverlayOptions[] = [];
  for (const [at, part] of parts.entries()) {
    const fitted = await part.image
      .resize(share, side, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "nearest" })
      .png()
      .toBuffer();
    composited.push({ input: fitted, left: at * share, top: 0 });
  }
  return sharp({
    create: { width: side, height: side, channels: 4, background: { r: 24, g: 24, b: 24, alpha: 1 } },
  })
    .composite(composited)
    .png()
    .toBuffer();
}

/* ── the run ────────────────────────────────────────────────────────────── */

const connection = await openDatabase(databaseUrl);
const [pool] = await connection.query<any[]>(
  `SELECT id, publicId, imageKey FROM casting_candidates
    WHERE userId = 1 AND status = 'ready' AND imageKey IS NOT NULL
    ORDER BY id DESC LIMIT ${FACES}`,
);
await connection.end();

say(`PAIR TILE BENCH — ${pool.length} faces, tile ${TILE}px, sheets at ${ZOOM}x.`);
say("The bar is pre-registered in this file's header, written before the run.");
say("");
say("face      feature   left box        right box       union box        (b) drawn   (b) short  coverage");

type Reading = { face: string; feature: string; shortSide: number; coverage: number };
const readings: Reading[] = [];

for (const row of pool) {
  const frame = await storageReadBytes(row.imageKey);
  const meta = await sharp(frame.bytes).metadata();
  const url = storagePublicUrl(row.imageKey);
  const reader = createFalRegionReader({ apiKey });

  for (const feature of ["eyes", "eyebrows", "ear"]) {
    let sides: { left: Mask; right: Mask } | null = null;
    try {
      sides = await reader.regionSides!({
        image: frame.bytes,
        name: feature,
        absentIsAnswer: true,
        imageUrl: url,
      });
    } catch (error) {
      say(`${row.publicId.slice(0, 8)}  ${feature.padEnd(9)} READ FAILED — ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (sides === null) {
      say(`${row.publicId.slice(0, 8)}  ${feature.padEnd(9)} no sides for this name`);
      continue;
    }
    const left = boundsOf(sides.left);
    const right = boundsOf(sides.right);
    if (left === null || right === null) {
      say(`${row.publicId.slice(0, 8)}  ${feature.padEnd(9)} one side only (${left ? "L" : "-"}${right ? "R" : "-"}) — no pair to draw`);
      continue;
    }

    const union = unionOf(left, right);
    const drawn = drawnAt(union);
    const shortSide = Math.min(drawn.width, drawn.height);
    const coverage = (left.width * left.height + right.width * right.height) / (union.width * union.height);
    readings.push({ face: row.publicId.slice(0, 8), feature, shortSide, coverage });

    const show = (box: Box) => `${box.width}x${box.height}@${box.x},${box.y}`.padEnd(15);
    say(
      `${row.publicId.slice(0, 8)}  ${feature.padEnd(9)} ${show(left)} ${show(right)} ${show(union)} `
      + `${drawn.width.toFixed(1)}x${drawn.height.toFixed(1)}   ${shortSide.toFixed(1)}px     ${(coverage * 100).toFixed(1)}%`,
    );

    /* The three candidates, drawn at the panel's own size and blown up. */
    const leftCut = await cutout(frame.bytes, sides.left, left);
    const rightCut = await cutout(frame.bytes, sides.right, right);
    const unionMask: Mask = {
      data: Buffer.from(sides.left.data.map((value, at) => Math.max(value, sides!.right.data[at] ?? 0))),
      width: sides.left.width,
      height: sides.left.height,
    };
    const unionCut = await cutout(frame.bytes, unionMask, union);

    const name = `${row.publicId.slice(0, 8)}-${feature}`;
    writeFileSync(`${OUT}/${name}-a-one.png`, await tileOf([{ image: leftCut, box: left }]));
    writeFileSync(`${OUT}/${name}-b-union.png`, await tileOf([{ image: unionCut, box: union }]));
    writeFileSync(`${OUT}/${name}-c-abutted.png`, await tileOf([
      { image: leftCut, box: left },
      { image: rightCut, box: right },
    ]));
    void meta;
  }
}

say("");
const clears = readings.filter((reading) => reading.shortSide >= 8);
say(`(b) UNION: short side >= 8px on ${clears.length} of ${readings.length} pair-readings`
  + ` — the pre-registered bar is 5 of 6.`);
say("(c) ABUTTED always fills the tile by construction: each part is contained in its own half,");
say("    so its short side is the instance's own aspect, never the gap between the two.");
say("");
say("The verdict is NOT in this file. The sheets in output/pair-tile/ are looked at first.");

writeFileSync(`${OUT}/readings.txt`, lines.join("\n"));

process.exit(0);
