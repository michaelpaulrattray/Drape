/**
 * DISPOSABLE — DOES THE `head` BOX ACTUALLY CONTAIN THE HAIR? A raw-pixel
 * second reader for the one word the whole cut is placed from.
 *
 * **No network call, no segmenter, no credit.** It opens frames already paid
 * for and counts dark pixels.
 *
 * # Why it exists
 *
 * Arm H disqualified `hair` and made `head` the cut's landmark, on the strength
 * of overlays judged by eye — *"both words outline from the top of the hair"*.
 * Then arm R's widest-gap frame was opened at full resolution and **the `head`
 * box looked like it was sitting INSIDE the hair rather than around it**: an
 * afro whose sides plainly cross the box's left and right edges, and a top edge
 * that could not be called clear of the hair by eye.
 *
 * Eye is not enough in either direction (law 9 cuts both ways: a reader's
 * verdict is never final, and neither is a squint at a JPEG). So this measures
 * it, with an instrument that shares NO resolver with the segmenter: **raw
 * luminance**.
 *
 * # The measurement
 *
 * The house frame is a single subject against a uniform pale sweep, and nothing
 * in the picture sits above the head. So the topmost row holding a run of dark
 * pixels IS the top of the hair. Compared against the `head` box top that arm R
 * recorded:
 *
 *   hairTop  <  headTop     ⚠ the box does not contain the hair, by that many px
 *   hairTop  >= headTop     the box's top edge is at or above the hair
 *
 * ⚠ **The threshold is not guessed at.** It is derived per frame from the
 * frame's own top-left corner — indisputably background — and a fixed margin
 * below it, so a pale-haired subject and a dark-haired one are read on the same
 * rule rather than on a constant tuned to one of them. The corner value and the
 * threshold are printed on every row, because a threshold nobody can see is a
 * knob nobody can check.
 *
 *   npx tsx scripts/_framing-hairtop-disposable.mts
 */

import { readFileSync } from "node:fs";

import sharp from "sharp";

const ARM_R = "output/framing-court/armR";

/** How many dark pixels in a row before it counts as the subject rather than
 *  compression noise or a stray speck. A hair mass is hundreds wide. */
const RUN = 8;
/** How far below the background's own luminance a pixel must fall. Generous,
 *  because grey hair against a pale sweep is a small step. */
const MARGIN = 40;

const armR = JSON.parse(readFileSync(`${ARM_R}/armR.json`, "utf8")) as {
  rows: Array<{ size: string; pos: number; frameH: number; headTop: number | null; gap: number | null }>;
};

const rows = armR.rows.filter((row) => row.headTop !== null);
if (rows.length === 0) throw new Error(`${ARM_R}/armR.json: no row carries a head box — nothing to check`);

console.log("HAIR TOP by RAW LUMINANCE against the `head` box arm R recorded");
console.log(`  a row counts as subject at ${RUN}+ pixels more than ${MARGIN} below the frame's own`);
console.log("  top-left corner · no segmenter, no network, no credit");
console.log();

let contained = 0;
let breached = 0;
let worst = { id: "", by: 0 };

for (const row of rows) {
  const file = `${ARM_R}/${row.size}-pos${row.pos}-raw.png`;
  const { data, info } = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true });
  const width = info.width;
  const background = data[0]!;
  const threshold = background - MARGIN;

  let hairTop: number | null = null;
  for (let y = 0; y < info.height; y += 1) {
    let dark = 0;
    for (let x = 0; x < width; x += 1) {
      if (data[y * width + x]! < threshold) dark += 1;
    }
    if (dark >= RUN) { hairTop = y; break; }
  }
  if (hairTop === null) {
    console.log(`  ${row.size}-pos${row.pos}  NO DARK ROW AT ALL — corner ${background}, threshold ${threshold}`);
    continue;
  }
  const by = row.headTop! - hairTop;
  if (by > 0) { breached += 1; if (by > worst.by) worst = { id: `${row.size}-pos${row.pos}`, by }; } else contained += 1;
  console.log(`  ${row.size}-pos${row.pos.toString().padEnd(2)}  corner ${background} thr ${threshold}`
    + `  hairTop ${hairTop.toString().padStart(4)}  headTop ${row.headTop!.toString().padStart(4)}`
    + `  ${by > 0 ? `⚠ BOX IS ${by} px BELOW THE HAIR` : `box is ${-by} px above the hair`}`);
}

console.log();
console.log(`${contained} of ${rows.length} frames: the \`head\` box top is at or above the hair.`);
if (breached > 0) {
  console.log(`⚠ ${breached} of ${rows.length} BREACH IT — worst ${worst.id} by ${worst.by} px.`);
  console.log("   A cut that places headroom from this box's top would crop into the hair on");
  console.log("   those frames, which is the founder gate of 2026-07-31 (scalped sheets).");
  console.log("   The margin the cut carries is measured in FACE-HEIGHTS, so a breach is only");
  console.log("   fatal if it exceeds that margin — the court's own clearance figure decides,");
  console.log("   and this reading is what that figure has to be corrected BY.");
} else {
  console.log("No frame's hair rises above its `head` box. The landmark holds at the pixels,");
  console.log("by an instrument that shares no resolver with the segmenter that drew the box.");
}

/* And the last statement ends the process. */
process.exit(0);
