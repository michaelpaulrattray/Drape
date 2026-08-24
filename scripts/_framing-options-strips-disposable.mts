/**
 * THE THREE OPTION STRIPS — the held ruling prepared as PICTURES, not prose.
 * (Ordered fable-1564 §1 on opus-1205 §3.)
 *
 * **No render, no reader, no credit, not one provider call.** Every frame is one
 * arm M already bought; this only crops them three different ways and asks his
 * eye which cost he prefers.
 *
 * # The question all three answer
 *
 * A common headroom `R` has to clear every head (`R >= gap`) and fit inside every
 * frame (`R <= headroom`). Across arm M's clause cells that interval is EMPTY —
 * `basics-clause/pos6` needs `R >= 0.508` because her hair is tall, and
 * `suit-clause/pos4` can give at most `0.352`. **No frame is clipped as
 * delivered; the engine obeyed.** The infeasibility is across-population
 * variance: a woman with tall curls genuinely needs more air above her face than
 * a man with a flat crop, and a single house `R` has to serve both. So the house
 * has to choose what it does with the frame that cannot join the common frame.
 *
 *   (i)   PER-FRAME ESCAPE     the outlier is delivered at her OWN frame.
 *                              Her head is a different SIZE from the others.
 *   (ii)  COMMON SIZE, EXTRA   every head the same size; the outlier gets the
 *         AIR                  headroom her hair needs, so she sits LOWER with
 *                              more space above. Nobody has looked at this one.
 *   (iii) THE CLIP             everyone at the common frame, and her crown is
 *                              sliced. The bad picture rather than its
 *                              description.
 *
 * # All three are the SAME seven frames in the SAME order
 *
 * `basics-clause`, arm M's own cell — seven, because the content checker refused
 * `pos2` and that is a frame the customer never receives. Same frames, same
 * order, one variable: the policy. A comparison where the pictures differ in
 * anything else answers a different question.
 *
 *   npx tsx scripts/_framing-options-strips-disposable.mts
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import sharp from "sharp";

const ARM_M = "output/framing-court/armM";
const OUT = "output/framing-court/options";

/** The frame he would be looking at in the product. */
const DELIVER = { width: 1024, height: 1536 };
const TILE = { width: 300, height: 450 };

/** The court's own common frame, from `armM.json`'s across-cells reading. */
const T = 0.2271;
const R_COMMON = 0.35;
/**
 * Air above the hair for option (ii), in face-heights. Small on purpose: the
 * option is "the room her hair needs", not "a generous frame for her" — the
 * moment it becomes generous it stops being the minimum intervention and starts
 * being a second framing decision nobody ruled.
 */
const CLEARANCE = 0.05;

type Row = { cell: string; pos: string; share: number; headroom: number; gap: number | null };
const armM = JSON.parse(readFileSync(`${ARM_M}/armM.json`, "utf8")) as { rows: Row[] };

const lines: string[] = [];
const say = (text = "") => { console.log(text); lines.push(text); };

mkdirSync(OUT, { recursive: true });

const cell = "basics-clause";
const frames = armM.rows.filter((r) => r.cell === cell).sort((a, b) => a.pos.localeCompare(b.pos));
if (frames.length === 0) throw new Error(`no rows for ${cell}`);

/*
  THE FACE BOX'S HORIZONTAL CENTRE, read out of arm M's own log. The court's
  numbers are all vertical, but these are PICTURES — measured on arm R's frames
  the face centre sits up to ~42 px off the frame's middle, which is plainly
  visible once the crop is narrower than the frame. A cell whose log line is
  missing falls back to the frame's centre AND SAYS SO.
*/
const NEWLINE_RE = new RegExp("\\r?\\n");
const BOX = /^ {2}(pos\d)\s+\d+x\d+\s+face (\d+)x\d+ at (\d+),\d+/;
const CENTRES = new Map<string, number>();
let seen: string | null = null;
for (const line of readFileSync(`${ARM_M}/armM.log`, "utf8").split(NEWLINE_RE)) {
  const head = /^════ (\S+) ════/.exec(line);
  if (head) { seen = head[1]!; continue; }
  const box = BOX.exec(line);
  if (box && seen === cell) CENTRES.set(box[1]!, Number(box[3]) + Number(box[2]) / 2);
}
if (CENTRES.size === 0) throw new Error(`${ARM_M}/armM.log: no face boxes matched for ${cell} — has its format moved?`);

/** Which frame cannot join the common frame, and by how much. */
const outliers = frames.filter((f) => f.gap !== null && f.gap > R_COMMON);
say("THE THREE OPTIONS — no render, no reader, no credit");
say(`  cell ${cell} · ${frames.length} frames (the content checker refused pos2 — a frame she never receives)`);
say(`  the common frame: T = ${(T * 100).toFixed(1)}%  R = ${R_COMMON.toFixed(2)} face-heights`);
for (const one of outliers) {
  say(`  ⚠ ${one.pos} cannot join it: her hair needs R >= ${one.gap!.toFixed(3)},`
    + ` the common frame offers ${R_COMMON.toFixed(2)} — short by ${(one.gap! - R_COMMON).toFixed(3)} face-heights`);
}
if (outliers.length === 0) throw new Error("no frame is an outlier at this R — the three options would be one picture");
say();

/**
 * Cut one frame to a head size `t` and a headroom `r`, then resize to the
 * delivered frame. Reports whether the crop had to be clamped or upscaled,
 * because those are the two ways this transformation lies.
 */
async function cut(row: Row, t: number, r: number): Promise<{ bytes: Buffer; upscaled: boolean; clamped: boolean; clipped: number }> {
  const file = `${ARM_M}/${row.cell}-${row.pos}-raw.png`;
  const meta = await sharp(file).metadata();
  const frameW = meta.width!;
  const frameH = meta.height!;
  const faceH = row.share * frameH;
  const faceTop = row.headroom * faceH;
  const cropH = Math.round(faceH / t);
  const cropW = Math.round(cropH * (DELIVER.width / DELIVER.height));
  const wantTop = Math.round(faceTop - r * faceH);
  const top = Math.max(0, Math.min(wantTop, frameH - cropH));
  const centre = CENTRES.get(row.pos) ?? frameW / 2;
  const left = Math.max(0, Math.min(Math.round(centre - cropW / 2), frameW - cropW));
  /* How many pixels of her hair the crop line eats, if any. */
  const headTop = row.gap === null ? faceTop : faceTop - row.gap * faceH;
  return {
    bytes: await sharp(file)
      .extract({ left, top, width: Math.min(cropW, frameW), height: Math.min(cropH, frameH) })
      .resize({ width: DELIVER.width, height: DELIVER.height })
      .png().toBuffer(),
    upscaled: cropH < DELIVER.height,
    clamped: top !== wantTop,
    clipped: Math.max(0, Math.round(top - headTop)),
  };
}

const tile = async (bytes: Buffer) => sharp(bytes)
  .resize({ width: TILE.width, height: TILE.height, fit: "contain", background: "#141414" })
  .png().toBuffer();

const strip = async (tiles: Buffer[]) => sharp({
  create: { width: TILE.width * tiles.length, height: TILE.height, channels: 3, background: "#141414" },
}).composite(tiles.map((one, index) => ({ input: one, left: TILE.width * index, top: 0 }))).png().toBuffer();

/**
 * The three policies, as functions of one frame. Each returns the `(t, r)` it
 * would deliver, so the arithmetic is visible beside the picture rather than
 * buried in whichever branch drew it.
 */
const POLICIES = [
  {
    file: "OPTION-i-per-frame-escape.png",
    what: "the outlier is delivered at HER OWN frame — her head a different SIZE from the rest",
    pick: (row: Row) => (row.gap !== null && row.gap > R_COMMON
      ? { t: row.share, r: row.headroom, own: true }
      : { t: T, r: R_COMMON, own: false }),
  },
  {
    file: "OPTION-ii-common-size-extra-air.png",
    what: "every head the SAME SIZE; the outlier sits LOWER with the air her hair needs",
    pick: (row: Row) => (row.gap !== null && row.gap + CLEARANCE > R_COMMON
      ? { t: T, r: Math.min(row.gap + CLEARANCE, row.headroom), own: true }
      : { t: T, r: R_COMMON, own: false }),
  },
  {
    file: "OPTION-iii-the-clip.png",
    what: "everyone at the common frame, and her crown is sliced — the bad picture itself",
    pick: () => ({ t: T, r: R_COMMON, own: false }),
  },
] as const;

for (const policy of POLICIES) {
  say(`──── ${policy.file} ────`);
  say(`     ${policy.what}`);
  const tiles: Buffer[] = [];
  let upscales = 0;
  let clamps = 0;
  let clippedFrames = 0;
  for (const row of frames) {
    const { t, r, own } = policy.pick(row);
    const result = await cut(row, t, r);
    if (result.upscaled) upscales += 1;
    if (result.clamped) clamps += 1;
    if (result.clipped > 0) clippedFrames += 1;
    tiles.push(await tile(result.bytes));
    say(`  ${row.pos}  T ${(t * 100).toFixed(1)}%  R ${r.toFixed(3)}`
      + (own ? "  ← this frame is treated differently" : "")
      + (result.clipped > 0 ? `  ⚠ CLIPS ${result.clipped}px of her hair` : "")
      + (result.upscaled ? "  ⚠ UPSCALE — pixels invented" : "")
      + (result.clamped ? "  ⚠ crop clamped to the frame edge" : ""));
  }
  writeFileSync(`${OUT}/${policy.file}`, await strip(tiles));
  say(`  ${frames.length} frames · ${clippedFrames} with hair clipped · ${upscales} upscaled · ${clamps} clamped`);
  say(`  kept ${OUT}/${policy.file}`);
  say();
}

say("⚠ WHAT THESE ARE AND ARE NOT. The same seven frames in the same order, with");
say("   the POLICY as the only variable — a comparison whose pictures differ in");
say("   anything else answers a different question. The numbers say what each");
say("   policy costs; only his eye says which cost is acceptable (law 9).");
say("   Two of the three costs are visible in the picture — a head at the wrong");
say("   size, and a sliced crown. The third, option (ii), costs a head sitting");
say("   lower than its neighbours, and whether that reads as inconsistent is");
say("   exactly the judgement no number here can make.");

writeFileSync(`${OUT}/options.log`, lines.join("\n"), "utf8");
process.exit(0);
