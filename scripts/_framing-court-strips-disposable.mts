/**
 * THE COURT'S STRIPS — the half of this court that no number substitutes for
 * (design §6.4, law 9).
 *
 * **No render, no reader, no credit, not one provider call.** Every frame and
 * every box it uses was bought by arms R and M and is read out of their JSON.
 *
 * # What it builds, and why three rather than the two §6.4 names
 *
 * §6.4 asks for *"the cut sheet beside sheet 2"* (within-sheet) and *"the cut
 * SUIT sheet beside the cut BASICS sheet"* (across-cast). The first phrase reads
 * two ways — beside its own uncut self, or beside the other sheet — so it builds
 * both rather than picking, because the cost is zero and the wrong pick would be
 * found at his desk:
 *
 *   A  SUIT     raw above cut     within-sheet: is the wobble gone?
 *   B  BASICS   raw above cut     the same question on the other population
 *   C  SUIT cut above BASICS cut  ACROSS-CAST — the thing he actually asked for
 *
 * # The cut is ONE frame for both sheets, and that is the whole claim
 *
 * Across-cast consistency means the two sheets are cut to the SAME `(T, R)` —
 * the across-cells `T_min` and usable `R` arm M measured. A per-sheet cut would
 * make each sheet agree with itself and prove nothing about his complaint.
 *
 * # It prints the fidelity cost per frame rather than mentioning it
 *
 * A crop shorter than the delivered height is an UPSCALE and invents pixels.
 * At the ship size arm R measured 0 of 8 needing one at any target; this prints
 * the number for every frame it writes, so the claim is on the artifact rather
 * than in a paragraph about it.
 *
 *   npx tsx scripts/_framing-court-strips-disposable.mts
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import sharp from "sharp";

import { type FramingFrame, tMinOf } from "./lib/framingTmin.mts";

const ARM_M = "output/framing-court/armM";
const OUT = "output/framing-court/strips";

/** What a roll actually delivers today. The strips are built at this size
 *  because that is the frame he would be looking at in the product. */
const DELIVER = { width: 1024, height: 1536 };
/** One tile in a strip. 2:3, so a whole sheet fits on one row legibly. */
const TILE = { width: 300, height: 450 };

type Row = {
  cell: string; group: string; pos: string;
  share: number; headroom: number; below: number; gap: number | null;
};

const armM = JSON.parse(readFileSync(`${ARM_M}/armM.json`, "utf8")) as {
  size: string; rows: Row[];
};
if (armM.rows.length === 0) throw new Error(`${ARM_M}/armM.json: no rows — arm M has nothing to strip`);

/*
  ⚠ THE HORIZONTAL CENTRE COMES FROM THE FACE BOX, NOT THE FRAME'S MIDDLE.

  Arm M's JSON stores the box's HEIGHT ratios — `share` and `headroom` — and not
  its left edge, because every number the court reads is vertical. The strips are
  a picture, so the horizontal matters: measured on arm R's own frames the face
  centre sits up to ~42 px off the frame's centre on a 1024-wide frame, which is
  4% of the width and plainly visible once the crop is narrower than the frame.
  So the left edges are read out of arm M's LOG, which prints the full box.

  A cell whose log line is missing falls back to the frame's centre AND SAYS SO
  on its own line — the house frame is centred and square to camera, so the
  fallback is defensible; silently taking it would not be.
*/
/** Line split that survives either ending — the logs are written on Windows. */
const NEWLINE_RE = new RegExp("\\r?\\n");
const CENTRES = new Map<string, number>();
const BOX = /^ {2}(pos\d)\s+\d+x\d+\s+face (\d+)x\d+ at (\d+),\d+/;
let currentCell: string | null = null;
for (const line of readFileSync(`${ARM_M}/armM.log`, "utf8").split(NEWLINE_RE)) {
  const cellHead = /^════ (\S+) ════/.exec(line);
  if (cellHead) { currentCell = cellHead[1]!; continue; }
  const box = BOX.exec(line);
  if (box && currentCell) {
    CENTRES.set(`${currentCell}/${box[1]!}`, Number(box[3]) + Number(box[2]) / 2);
  }
}
if (CENTRES.size === 0) throw new Error(`${ARM_M}/armM.log: no face boxes matched — has its format moved?`);

/*
  THE COMMON FRAME. Both clause cells together, through the one copy of the
  T_min arithmetic — never a second implementation of the court's headline.
*/
const clauseFrames: FramingFrame[] = armM.rows.filter((row) => row.cell.endsWith("-clause"));
const across = tMinOf(clauseFrames);
const T = across.tMin;
const R = across.usableR;

const lines: string[] = [];
const say = (text = "") => { console.log(text); lines.push(text); };

mkdirSync(OUT, { recursive: true });

say("THE COURT'S STRIPS — no render, no reader, no credit");
say(`  the common frame both sheets are cut to: T = ${(T * 100).toFixed(1)}%  R = ${R.toFixed(2)} face-heights`);
say(`  binding frame ${across.binding.group}/${across.binding.pos} · n=${across.n} clause frames`);
say(`  built at the DELIVERED size ${DELIVER.width}x${DELIVER.height}, which is the frame he would see`);
say("  ⚠ every cut frame's head share IS T, by construction — DETERMINED BY THE CUT,");
say("     NOT EVIDENCE (§6.3). What the strips are evidence of is what it LOOKS like.");
say();

/**
 * Cut one frame to the common `(T, R)` and resize to the delivered size. Returns
 * the bytes and how the resize went, because an UPSCALE invents pixels and that
 * is the one thing about this transformation that has to be visible.
 */
async function cutToCommon(file: string, row: Row): Promise<{ bytes: Buffer; cropH: number; upscaled: boolean; clampedTop: boolean; centredOnFace: boolean }> {
  const meta = await sharp(file).metadata();
  const frameW = meta.width!;
  const frameH = meta.height!;
  /* The face box, reconstructed from the ratios arm M stored. They are exact —
     `share` and `headroom` are the box divided by the frame — so this is the
     same box the reader drew and not a second guess at it. */
  const faceH = row.share * frameH;
  const faceTop = row.headroom * faceH;
  const cropH = Math.round(faceH / T);
  const cropW = Math.round(cropH * (DELIVER.width / DELIVER.height));
  const wantTop = Math.round(faceTop - R * faceH);
  const top = Math.max(0, Math.min(wantTop, frameH - cropH));
  const faceCentre = CENTRES.get(`${row.cell}/${row.pos}`);
  const centre = faceCentre ?? frameW / 2;
  const left = Math.max(0, Math.min(Math.round(centre - cropW / 2), frameW - cropW));
  const bytes = await sharp(file)
    .extract({ left, top, width: Math.min(cropW, frameW), height: Math.min(cropH, frameH) })
    .resize({ width: DELIVER.width, height: DELIVER.height })
    .png().toBuffer();
  return {
    bytes, cropH,
    upscaled: cropH < DELIVER.height,
    clampedTop: top !== wantTop,
    centredOnFace: faceCentre !== undefined,
  };
}

const tile = async (bytes: Buffer) => sharp(bytes)
  .resize({ width: TILE.width, height: TILE.height, fit: "contain", background: "#141414" })
  .png().toBuffer();

/** One row of tiles, in position order. */
async function rowOf(tiles: Buffer[]): Promise<Buffer> {
  return sharp({ create: { width: TILE.width * tiles.length, height: TILE.height, channels: 3, background: "#141414" } })
    .composite(tiles.map((one, index) => ({ input: one, left: TILE.width * index, top: 0 })))
    .png().toBuffer();
}

/** Two rows, stacked. */
async function stack(topRow: Buffer, bottomRow: Buffer, width: number): Promise<Buffer> {
  return sharp({ create: { width, height: TILE.height * 2, channels: 3, background: "#141414" } })
    .composite([{ input: topRow, left: 0, top: 0 }, { input: bottomRow, left: 0, top: TILE.height }])
    .png().toBuffer();
}

type Built = { raw: Buffer[]; cut: Buffer[] };
const built = new Map<string, Built>();

for (const cell of ["suit-clause", "basics-clause"] as const) {
  const mine = armM.rows.filter((row) => row.cell === cell)
    .sort((a, b) => a.pos.localeCompare(b.pos));
  if (mine.length === 0) throw new Error(`no rows for ${cell} — the strip would be empty and would not say so`);
  say(`──── ${cell} ────`);
  /*
    ⚠ A SHORT CELL LEAVES A BLACK TILE, AND A BLACK TILE HE WAS NOT TOLD ABOUT
    READS AS A BUG. The strips carry no captions by design, so the absence is
    named HERE and in the report that carries them: it is a slice the provider's
    content checker refused, which is a frame the customer never receives —
    a measured cost of the lowered neckline the founder kept (fable-1465), not
    anything this court did.
  */
  if (mine.length < 8) {
    const absent = Array.from({ length: 8 }, (_, index) => `pos${index}`)
      .filter((pos) => !mine.some((row) => row.pos === pos));
    say(`  ⚠ ${mine.length} of 8 — ${absent.join(", ")} absent (refused by the content checker,`);
    say("     so the strip's last tile is BLACK. That is the honest picture of a sheet");
    say("     the customer receives short, not a missing frame in the instrument.");
  }
  const raw: Buffer[] = [];
  const cut: Buffer[] = [];
  let upscales = 0;
  let clamps = 0;
  for (const row of mine) {
    const file = `${ARM_M}/${cell}-${row.pos}-raw.png`;
    const result = await cutToCommon(file, row);
    if (result.upscaled) upscales += 1;
    if (result.clampedTop) clamps += 1;
    raw.push(await tile(readFileSync(file)));
    cut.push(await tile(result.bytes));
    /*
      The post-cut share is T on every frame BY CONSTRUCTION — the crop height is
      `faceH / T` and the resize is uniform — so it is not printed as a finding.
      §6.3's rule: a number the transformation determines is reported as such or
      not at all, and an unclamped cut restating its own definition is the shape
      that fooled the last court.
    */
    say(`  ${row.pos}  raw share ${(row.share * 100).toFixed(1)}%  →  cut to T`
      + `  ·  crop ${result.cropH}px → ${DELIVER.height}px  `
      + `${result.upscaled ? "⚠ UPSCALE — pixels invented" : "downscale, nothing invented"}`
      + `${result.clampedTop ? "  ⚠ TOP CLAMPED — this frame could not take the common headroom" : ""}`
      + `${result.centredOnFace ? "" : "  ⚠ CENTRED ON THE FRAME, not the face — no log line for it"}`);
  }
  say(`  upscales ${upscales}/${mine.length} · top clamps ${clamps}/${mine.length}`);
  if (clamps > 0) {
    say("  ⚠ A CLAMPED TOP MEANS THE CUT DID NOT DELIVER THE COMMON FRAME on that");
    say("     frame — it ran out of picture above the head and stopped at the edge.");
    say("     T_min exists to make this zero; a non-zero count here is a defect in");
    say("     the cut or in the T_min it was handed, not a tolerance.");
  } else {
    /*
      §6.3, in the words the design specifies. With no clamps, the post-cut share
      and headroom of every frame are exactly what the cut was told to produce —
      so quoting them as an outcome is the transformation restating its own
      definition, which is the last court's first defect. The instrument says so
      on its own face rather than leaving a reader to notice.
    */
    say("  post-cut share and headroom, all eight frames:");
    say("  DETERMINED BY THE CUT — NOT EVIDENCE");
  }
  say();
  built.set(cell, { raw, cut });
}

const suit = built.get("suit-clause")!;
const basics = built.get("basics-clause")!;

const strips: Array<{ file: string; what: string; top: Buffer[]; bottom: Buffer[] }> = [
  { file: "STRIP-A-suit-raw-vs-cut.png", what: "SUIT: raw above, cut below — is the wobble gone?", top: suit.raw, bottom: suit.cut },
  { file: "STRIP-B-basics-raw-vs-cut.png", what: "BASICS: raw above, cut below — the same question, other population", top: basics.raw, bottom: basics.cut },
  { file: "STRIP-C-across-cast.png", what: "ACROSS-CAST: cut SUIT above cut BASICS — the thing he asked for", top: suit.cut, bottom: basics.cut },
];

for (const strip of strips) {
  const width = TILE.width * Math.max(strip.top.length, strip.bottom.length);
  const image = await stack(await rowOf(strip.top), await rowOf(strip.bottom), width);
  writeFileSync(`${OUT}/${strip.file}`, image);
  say(`kept ${OUT}/${strip.file}`);
  say(`     ${strip.what}`);
}

say();
say("⚠ WHAT THESE STRIPS ARE FOR, AND WHAT THEY ARE NOT. They are the court's");
say("   answer to his own sentence, and his eye is the verdict on them (law 9).");
say("   The numbers beside them say the frames AGREE; only he can say the frame is");
say("   RIGHT — and `FRAMING_FIXED` asks for CLEAR SPACE above the hair, which is a");
say("   judgement about a picture rather than a measurement.");

writeFileSync(`${OUT}/strips.log`, lines.join("\n"), "utf8");

/* And the last statement ends the process. */
process.exit(0);
