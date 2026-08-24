/**
 * ARM H OF THE FRAMING CONSISTENCY COURT — is there a measured word that
 * outlines the HEAD INCLUDING ITS HAIR? (designed
 * `docs/specs/CASTING_FRAMING_CONSISTENCY_COURT.md` §8, countersigned
 * fable-1552 §2 as a GATE: no usable word, no cut, the court stops here.)
 *
 * # Why this runs before anything else
 *
 * The deterministic cut places its frame from the FACE box. `FRAMING_FIXED`'s
 * CROP clause is about the HAIR — *"the subject's ENTIRE HAIR SILHOUETTE is
 * inside the frame … not the crown, not a single strand"* — and that clause
 * exists because of a founder gate on 2026-07-31: the first sheets cropped
 * scalps and read as mugshots. **A cut set from the face box guillotines an
 * afro or an updo deterministically, on every sheet**, which is worse than the
 * wobble it was built to remove.
 *
 * So the cut needs a head-top landmark. Whether a measured word delivers one is
 * not known, and eight cents is what it costs to find out.
 *
 * # What it buys, and what it does NOT
 *
 * **16 segmenter reads, ~$0.005 each, ~$0.08. No render, no roll, no credit,
 * no row.** Every frame it reads is already on disk from a court that has been
 * paid for.
 *
 * It answers `head` and `hair` on two populations chosen for one property each:
 *
 *   SUIT     four frames whose FACE boxes are already logged at arm 0, so the
 *            comparison "is the returned box's top ABOVE the face box's top"
 *            is arithmetic and needs no second paid read
 *   CAVEMAN  four frames carrying real hair volume — a swept quiff sitting well
 *            above the skull, which is the case the founder gate is about
 *
 * ⚠ **The caveman cell is judged BY EYE and not by a number**, deliberately.
 * Its face box is not logged and buying one would put this arm over its
 * countersigned price; the question there is *does the outline contain the
 * hair*, which is what an overlay in front of a person answers and what a
 * bounding-box inequality does not (working law 9). The script draws the
 * overlays; it does not grade them.
 *
 * # What a PASS looks like
 *
 * On the SUIT cell, a usable word returns a box whose top is above the face
 * box's top on 4 of 4 — by a margin, not by a pixel. On the caveman cell, the
 * outline visibly contains the quiff. A word that answers `absent` anywhere is
 * not usable at any price: the cut runs on every frame of every sheet.
 *
 *   npx tsx scripts/_framing-armh-disposable.mts
 */

import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import sharp from "sharp";

import { boxOutlineSvg } from "./lib/termsPalette.mts";

if (!process.env.FAL_KEY) throw new Error("no FAL_KEY");

const { createFalRegionReader } = await import("../server/castingV2/falRegionReader.js");
const { extentOf } = await import("../server/castingV2/inkReferenceCrop.js");

const OUT = "output/framing-court";
const WORDS = ["head", "hair"] as const;

/* The four SUIT frames whose face boxes arm 0 logged. pos1 is the sheet's
   binding frame — the tightest, and the one T_min is decided by. */
const SUIT_DIR = "output/two-paths-court-round5/arm3-wardrobe-covered";
const SUIT_POS = ["pos1", "pos3", "pos5", "pos7"];

/* Four frames carrying hair volume. They are cut frames from the failed court,
   which does not matter here: the question is about the READER, not about how
   the picture was made. */
const HAIR_FRAMES = [0, 2, 4, 6].map((i) => ({
  id: `caveman-pos${i}`,
  file: `${OUT}/arm3-caveman-pos${i}.png`,
}));

/* The face boxes, parsed out of arm 0's own log rather than re-bought. */
const faceTops = new Map<string, { top: number; height: number }>();
const ROW = /^SUIT\s+(pos\d)\.png\s+frame \d+x\d+\s+faceBox \d+x(\d+) at \d+,(\d+)/;
for (const line of readFileSync(`${OUT}/arm0.log`, "utf8").split(/\r?\n/)) {
  const match = ROW.exec(line);
  if (match) faceTops.set(match[1]!, { top: Number(match[3]), height: Number(match[2]) });
}
if (faceTops.size === 0) throw new Error("arm0.log gave up no SUIT face boxes — has its format moved?");

const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY! });

const lines: string[] = [];
const say = (text = "") => { console.log(text); lines.push(text); };

mkdirSync(OUT, { recursive: true });

type Read = {
  cell: string;
  id: string;
  word: string;
  file: string;
  box: { left: number; top: number; width: number; height: number } | null;
  pixels: number;
};

const reads: Read[] = [];
let calls = 0;

const askOne = async (cell: string, id: string, file: string, word: string): Promise<void> => {
  const bytes = readFileSync(file);
  const mask = await reader.region({ image: bytes, name: word, absentIsAnswer: true });
  calls += 1;
  const { box, pixels } = extentOf(mask);
  reads.push({ cell, id, word, file, box, pixels });
};

say("ARM H — is there a word that outlines the head INCLUDING its hair?");
say(`words asked: ${WORDS.join(", ")}   ·   8 frames   ·   16 reads, ~$0.08, no render`);
say();

for (const pos of SUIT_POS) {
  for (const word of WORDS) await askOne("SUIT", pos, `${SUIT_DIR}/${pos}.png`, word);
}
for (const frame of HAIR_FRAMES) {
  for (const word of WORDS) await askOne("HAIR", frame.id, frame.file, word);
}

say("THE SUIT CELL — arithmetic, against face boxes arm 0 already logged");
say("  a usable word's box top sits ABOVE the face box top, by a margin");
say();
for (const pos of SUIT_POS) {
  const face = faceTops.get(pos)!;
  say(`  ${pos}   face box top ${face.top}  (face height ${face.height})`);
  for (const word of WORDS) {
    const read = reads.find((r) => r.cell === "SUIT" && r.id === pos && r.word === word)!;
    if (read.box === null) { say(`    ${word.padEnd(5)} ABSENT — not usable at any price`); continue; }
    const above = face.top - read.box.top;
    say(`    ${word.padEnd(5)} box ${read.box.width}x${read.box.height} at ${read.box.left},${read.box.top}`
      + `   top is ${above >= 0 ? `${above}px ABOVE` : `${-above}px BELOW`} the face`
      + `   (${(above / face.height).toFixed(2)} face-heights)`);
  }
}
say();

say("THE HAIR CELL — overlays only. The verdict here is an eye's, not a number's.");
for (const frame of HAIR_FRAMES) {
  for (const word of WORDS) {
    const read = reads.find((r) => r.cell === "HAIR" && r.id === frame.id && r.word === word)!;
    say(`  ${frame.id}  ${word.padEnd(5)} ${read.box === null ? "ABSENT" : `box ${read.box.width}x${read.box.height} at ${read.box.left},${read.box.top}  ${read.pixels}px`}`);
  }
}
say();

/*
  ONE CONTACT SHEET PER WORD, so the eight frames of a word are judged together
  rather than one at a time — a box that looks generous alone reads differently
  beside its neighbours.
*/
const TILE = 320;
for (const word of WORDS) {
  const mine = reads.filter((r) => r.word === word);
  const tiles: Buffer[] = [];
  for (const read of mine) {
    const source = sharp(readFileSync(read.file));
    const meta = await source.metadata();
    const width = meta.width ?? 1024;
    const height = meta.height ?? 1536;
    /*
      THE SHARED HELPER — `boxOutlineSvg` owns what a box on a photograph looks
      like here: thin, pure white, one pixel. The founder ruled on 2026-08-11
      that on-image geometry is monochrome EVERYWHERE, and this file's first
      draft drew a green box and a red line; `onImageGeometryMonochrome` went
      red on it, by name, which is the guard working on its own class.
    */
    const boxes: Array<{ x: number; y: number; width: number; height: number }> = [];
    if (read.box !== null) {
      boxes.push({ x: read.box.left, y: read.box.top, width: read.box.width, height: read.box.height });
    }
    const face = read.cell === "SUIT" ? faceTops.get(read.id) : undefined;
    if (face) boxes.push({ x: 0, y: face.top, width, height: 1 });
    const overlays: sharp.OverlayOptions[] = boxes.length === 0
      ? []
      : [{ input: Buffer.from(boxOutlineSvg(width, height, boxes)), top: 0, left: 0 }];
    /* Composite THEN resize, in two passes: sharp applies `resize` before
       `composite` however they are chained, so a single chain lays a full-size
       overlay onto an already-shrunk tile and is refused. */
    const drawn = await source.composite(overlays).png().toBuffer();
    tiles.push(await sharp(drawn).resize({ width: TILE }).png().toBuffer());
  }
  const heights = await Promise.all(tiles.map(async (tile) => (await sharp(tile).metadata()).height ?? 480));
  const tallest = Math.max(...heights);
  const sheet = await sharp({
    create: { width: TILE * tiles.length, height: tallest, channels: 3, background: "#141414" },
  })
    .composite(tiles.map((tile, i) => ({ input: tile, left: TILE * i, top: 0 })))
    .png()
    .toBuffer();
  writeFileSync(`${OUT}/ARMH-${word}.png`, sheet);
  say(`kept ${OUT}/ARMH-${word}.png  — the box is "${word}"; a full-width rule is the face box top`);
}

writeFileSync(`${OUT}/armH.log`, lines.join("\n"), "utf8");
writeFileSync(`${OUT}/armH.json`, JSON.stringify({ reads, calls }, null, 2), "utf8");
say();
say(`${calls} reads made. Nothing rendered, no credit spent.`);

/* And the last statement ends the process. */
process.exit(0);
