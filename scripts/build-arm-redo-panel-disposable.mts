/**
 * THE ARM SHEET, BEFORE AND AFTER (fable-949 §2) — the redo I asked for on my
 * own eye, put where his eye can settle it in ten seconds.
 *
 * The property a wrap-around design needs is that the four views are four
 * ROTATIONS. On the left they are not; on the right they are, and the elbow is
 * the reason — it is the one landmark on an upper limb that says which way the
 * arm is facing. The bottom row is the proof at reading size: the front view's
 * crease and the back view's bony point, from the shipped sheet itself.
 *
 * Monochrome on-image geometry (fable-230), labels in the white strip only —
 * the wing panel's own lesson: a full-size rect paints over the photograph.
 *
 * THE AFTER CELL IS THE UNCROPPED GENERATION (founder ruling, fable-955). It was
 * briefly the same frame cut off below the elbow, on the argument that forearm
 * is not in the placement vocabulary; he asked *"shouldnt the entire arms be on
 * one sheet though or am i wrong?"* and he is right — the customer never draws on
 * this template, so the crop was guarding a door nobody uses. Said here because
 * the record should show the crop was made and then REVERTED, not that it never
 * happened.
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const OUT = "output/arm-sheet-redo/";
await mkdir(OUT, { recursive: true });

const CELL_H = 520, LABEL_H = 120, GAP = 20, TOP = 104;

type Cell = { file: string; title: string; sub: string; extract?: { left: number; top: number; width: number; height: number } };

/** Rough advance width for Inter/Arial. Deliberately GENEROUS — a caption that
 *  overflows its cell is silently clipped by the SVG viewport, which is exactly
 *  the no-silent-caps failure one layer out. This throws instead. */
function textWidth(text: string, size: number, bold = false): number {
  return text.length * size * (bold ? 0.58 : 0.52);
}
function assertFits(text: string, size: number, cellW: number, bold: boolean, where: string) {
  const w = textWidth(text, size, bold) + 24;
  if (w > cellW) throw new Error(`caption overflows its cell (${where}): needs ~${Math.round(w)}px, cell is ${cellW}px — "${text}"`);
}

async function cell(c: Cell, targetH: number): Promise<Buffer> {
  let img = sharp(c.file);
  if (c.extract) img = sharp(await img.extract(c.extract).toBuffer());
  const meta = await img.metadata();
  const scale = targetH / (meta.height ?? 1);
  const w = Math.round((meta.width ?? 1) * scale);
  const body = await img.resize(w, targetH).toBuffer();
  assertFits(c.title, 25, w, true, c.title);
  assertFits(c.sub, 17, w, false, c.title);
  const svg = Buffer.from(
    `<svg width="${w}" height="${targetH + LABEL_H}">
       <rect y="${targetH}" width="${w}" height="${LABEL_H}" fill="#ffffff"/>
       <text x="12" y="${targetH + 42}" font-family="Inter, Arial" font-size="25" font-weight="700" fill="#0A0A0A">${c.title}</text>
       <text x="12" y="${targetH + 76}" font-family="Inter, Arial" font-size="17" fill="#444">${c.sub}</text>
     </svg>`,
  );
  return sharp({ create: { width: w, height: targetH + LABEL_H, channels: 3, background: "#ffffff" } })
    .composite([{ input: body, top: 0, left: 0 }, { input: svg, top: 0, left: 0 }])
    .png().toBuffer();
}

const AFTER = "assets/ink/arm-template.png";

const topRow = await Promise.all([
  cell({
    file: "docs/specs/references/templates/superseded/ink-template-arm-nearwhite-v1-flat.png",
    title: "BEFORE — four views, one reading",
    sub: "no elbow in frame · nothing says which way the arm faces",
  }, CELL_H),
  cell({
    file: AFTER,
    title: "AFTER — four rotations you can name",
    sub: "1 outer · 2 front · 3 inner · 4 back — whole limb, uncropped",
  }, CELL_H),
]);

// The two telling elbows, from the shipped sheet, at reading size.
const ZOOM_H = 380;
const bottomRow = await Promise.all([
  cell({ file: AFTER, extract: { left: 480, top: 550, width: 270, height: 250 },
    title: "view 2 — the FRONT", sub: "the crease inside the elbow" }, ZOOM_H),
  cell({ file: AFTER, extract: { left: 1130, top: 550, width: 270, height: 250 },
    title: "view 4 — the BACK", sub: "the bony point of the elbow" }, ZOOM_H),
]);

const rowW = async (row: Buffer[]) =>
  (await Promise.all(row.map((b) => sharp(b).metadata()))).reduce((a, m) => a + (m.width ?? 0), 0) + GAP * (row.length + 1);
const W = Math.max(await rowW(topRow), await rowW(bottomRow));
const row1H = CELL_H + LABEL_H, row2H = ZOOM_H + LABEL_H;

const HEAD_1 = "The arm sheet, redone — can you tell the four views apart?";
const HEAD_2 = "A tattoo that wraps needs the same arm from four sides. The elbow is what makes a side nameable, and the whole limb is on the sheet as you ruled.";
assertFits(HEAD_1, 28, W, true, "header line 1");
assertFits(HEAD_2, 18, W, false, "header line 2");

const header = Buffer.from(
  `<svg width="${W}" height="${TOP}">
     <rect width="${W}" height="${TOP}" fill="#ffffff"/>
     <text x="${GAP}" y="42" font-family="Inter, Arial" font-size="28" font-weight="700" fill="#0A0A0A">${HEAD_1}</text>
     <text x="${GAP}" y="78" font-family="Inter, Arial" font-size="18" fill="#444">${HEAD_2}</text>
   </svg>`,
);

async function layout(row: Buffer[], top: number) {
  const metas = await Promise.all(row.map((b) => sharp(b).metadata()));
  let x = GAP;
  return row.map((input, i) => { const item = { input, top, left: x }; x += (metas[i].width ?? 0) + GAP; return item; });
}

const H = TOP + row1H + GAP + row2H + GAP;
await sharp({ create: { width: W, height: H, channels: 3, background: "#ffffff" } })
  .composite([
    { input: header, top: 0, left: 0 },
    ...(await layout(topRow, TOP)),
    ...(await layout(bottomRow, TOP + row1H + GAP)),
  ])
  .png().toFile(`${OUT}arm-sheet-redo-panel.png`);
console.log(`wrote ${OUT}arm-sheet-redo-panel.png  ${W}x${H}`);

process.exit(0);
