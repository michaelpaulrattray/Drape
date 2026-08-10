/**
 * THE C′ TILE PACK — the founder's law: a taste decision gets pixels.
 *
 * fable-153 ordered the bench adjudicated BOTH ways: instruments and a founder
 * tile pack, "side-by-side frames, lossless difference tiles, black means
 * identical". fable-154 put his own claim on the record as the hypothesis under
 * test — *"NBP will reliably copy any hairstyle or reference image onto the
 * original"* — so this page answers that sentence, in that order, with frames.
 *
 * # The rules this generator keeps, inherited from the judgment pack
 *
 * 1. **No guessed captions.** Every figure is read out of
 *    `output/cprime/cprime-bench.json` at build time. Nothing is retyped here,
 *    so a stale number cannot outlive its measurement.
 * 2. **A missing frame is a visible gap**, never a silently dropped row.
 * 3. **A difference tile is only ever cut between two frames of the SAME
 *    geometry.** The painters disagree about output size, and diffing across a
 *    resample would manufacture a difference the eye should not be asked to
 *    judge. Where the sizes differ the tile says so instead.
 *
 * # Two crop strips, because they answer two different questions
 *
 *   AT ITS OWN FACE   each paint cropped around where ITS OWN face sits → is it
 *                     the same spectacle frame, the same hoops, the same hair?
 *   AT ONE FIXED BOX  every paint cropped at the first paint's box → does she
 *                     stay PUT between renders?
 *
 * A single strip would blur those together, and under Nano Banana Pro they have
 * opposite answers: the items hold and the framing does not.
 *
 *   npx tsx scripts/build-cprime-pack.mts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import sharp from "sharp";

import { FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE } from "../server/providers/falImages";
import { NANO_BANANA_PRO_USD_PER_IMAGE } from "../server/providers/falQueue";

const CPRIME = "output/cprime";
const OUT = "output/pack/cprime-pack.html";
const CROP = 260;
/* The face crop is deliberately generous: it has to hold the glasses, both ears
   and the hoops at once, because the question "is it the same?" is about all of
   them and a tight box kept landing on a forehead. */
const FACE_CROP = 560;

if (!existsSync(`${CPRIME}/cprime-bench.json`)) {
  console.error(`${CPRIME}/cprime-bench.json is not on disk — the bench has not finished. Refusing to build a pack with no numbers.`);
  process.exit(1);
}
const bench = JSON.parse(readFileSync(`${CPRIME}/cprime-bench.json`, "utf8"));

const dataUri = (bytes: Buffer) => `data:image/png;base64,${bytes.toString("base64")}`;
const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type Frame = { label: string; bytes: Buffer; width: number; height: number };

const frames = new Map<string, Frame>();
async function frame(label: string): Promise<Frame | null> {
  if (frames.has(label)) return frames.get(label)!;
  const path = `${CPRIME}/${label}.png`;
  if (!existsSync(path)) return null;
  const bytes = readFileSync(path);
  const meta = await sharp(bytes).metadata();
  const loaded = { label, bytes, width: meta.width ?? 0, height: meta.height ?? 0 };
  frames.set(label, loaded);
  return loaded;
}

/**
 * Where to cut a crop so the item is IN it — the centre of the mask's LARGEST
 * CONNECTED COMPONENT, not the centroid of the whole mask.
 *
 * The centroid was the first version and it put the earring crop on her nose:
 * a mask holding a matching pair has its centre of mass between the two hoops,
 * which is the middle of her face. A tile captioned "is it the same hoop?"
 * showing an eye is worse than no tile — so the crop follows one real object.
 */
async function centre(label: string, item: string): Promise<{ cx: number; cy: number } | null> {
  const path = `${CPRIME}/reads/${label}--${item}.png`;
  if (!existsSync(path)) return null;
  const { data, info } = await sharp(readFileSync(path)).greyscale().raw().toBuffer({ resolveWithObject: true });
  const seen = new Uint8Array(data.length);
  let best: { pixels: number; cx: number; cy: number } | null = null;

  for (let start = 0; start < data.length; start += 1) {
    if (data[start] === 0 || seen[start] === 1) continue;
    /* Iterative flood fill — a portrait-sized component overflows a recursive one. */
    const stack = [start];
    seen[start] = 1;
    let pixels = 0; let sumX = 0; let sumY = 0;
    while (stack.length > 0) {
      const at = stack.pop()!;
      const x = at % info.width;
      const y = Math.floor(at / info.width);
      pixels += 1; sumX += x; sumY += y;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= info.width || ny >= info.height) continue;
        const next = ny * info.width + nx;
        if (data[next] === 0 || seen[next] === 1) continue;
        seen[next] = 1;
        stack.push(next);
      }
    }
    if (!best || pixels > best.pixels) best = { pixels, cx: sumX / pixels, cy: sumY / pixels };
  }
  return best === null ? null : { cx: best.cx, cy: best.cy };
}

async function cropAt(source: Frame, cx: number, cy: number, box = CROP): Promise<Buffer> {
  const width = Math.min(box, source.width);
  const height = Math.min(box, source.height);
  const left = Math.max(0, Math.min(source.width - width, Math.round(cx - width / 2)));
  const top = Math.max(0, Math.min(source.height - height, Math.round(cy - height / 2)));
  /* Shown at its own size. A nearest-neighbour upscale adds no information and
     quadrupled the page — 44 MB for a document he is meant to open. */
  return sharp(source.bytes).extract({ left, top, width, height }).png().toBuffer();
}

/**
 * A lossless absolute difference, amplified so the eye can read it.
 *
 * BLACK MEANS IDENTICAL. The multiplier is printed on the tile, because a
 * difference tile with an unstated gain is a rhetorical device rather than a
 * measurement.
 */
const GAIN = 4;
async function difference(a: Frame, b: Frame): Promise<{ bytes: Buffer | null; note: string }> {
  if (a.width !== b.width || a.height !== b.height) {
    return { bytes: null, note: `${a.width}x${a.height} against ${b.width}x${b.height} — different geometry, so no honest difference tile exists` };
  }
  const [rawA, rawB] = await Promise.all([
    sharp(a.bytes).removeAlpha().raw().toBuffer(),
    sharp(b.bytes).removeAlpha().raw().toBuffer(),
  ]);
  const out = Buffer.allocUnsafe(rawA.length);
  for (let index = 0; index < rawA.length; index += 1) {
    out[index] = Math.min(255, Math.abs(rawA[index]! - rawB[index]!) * GAIN);
  }
  const bytes = await sharp(out, { raw: { width: a.width, height: a.height, channels: 3 } }).png().toBuffer();
  return { bytes, note: `absolute difference, x${GAIN} gain — black means identical` };
}

/* ------------------------------------------------------------ the blocks */

type Tile = { src: string | null; label: string; missing?: string };
type Block = { n: number; title: string; question: string; reading: string; rows: { caption: string; tiles: Tile[] }[] };
const blocks: Block[] = [];

const CELL1 = ["cell1-1", "cell1-2", "cell1-3", "cell1-4", "cell1-5"];
const CELL2 = ["cell2-1", "cell2-2", "cell2-3", "cell2-4", "cell2-5"];
const CELL2G = ["cell2g-1", "cell2g-2", "cell2g-3"];

const tileOf = (label: string, bytes: Buffer | null, missing?: string): Tile =>
  ({ src: bytes ? dataUri(bytes) : null, label, missing });

async function frameTiles(labels: string[]): Promise<Tile[]> {
  const tiles: Tile[] = [];
  for (const label of labels) {
    const loaded = await frame(label);
    tiles.push(loaded
      ? tileOf(`${label}  ${loaded.width}x${loaded.height}`, await sharp(loaded.bytes).resize(320).png().toBuffer())
      : tileOf(label, null, "not on disk"));
  }
  return tiles;
}

/**
 * Her face at 2x out of each paint, cut around that paint's OWN face.
 *
 * Earlier versions cut around the item's own mask and kept landing badly: the
 * `earring` mask holds a matching PAIR, so its centre is her nose, and the
 * `glasses` mask runs back along the temples, so its centre is her forehead.
 * The question being asked — is this the same spectacle frame, the same hoops,
 * the same hair — wants all of them in one tile anyway, so the crop follows the
 * face and is generous enough to hold them.
 */
async function ownCentreStrip(labels: string[], item: string): Promise<Tile[]> {
  void item;
  const tiles: Tile[] = [];
  for (const label of labels) {
    const loaded = await frame(label);
    if (!loaded) { tiles.push(tileOf(label, null, "frame not on disk")); continue; }
    const at = await centre(label, "face");
    if (!at) { tiles.push(tileOf(label, null, "NO-READ — the reader found no face here")); continue; }
    tiles.push(tileOf(label, await cropAt(loaded, at.cx, at.cy, FACE_CROP)));
  }
  return tiles;
}

async function fixedBoxStrip(labels: string[], item: string): Promise<Tile[]> {
  const anchor = await centre(labels[0]!, "face");
  void item;
  const tiles: Tile[] = [];
  for (const label of labels) {
    const loaded = await frame(label);
    if (!loaded || !anchor) { tiles.push(tileOf(label, null, "no anchor to cut against")); continue; }
    tiles.push(tileOf(label, await cropAt(loaded, anchor.cx, anchor.cy, FACE_CROP)));
  }
  return tiles;
}

/**
 * A contact sheet cut by hand while reading the frames, embedded whole.
 *
 * These three exist because the automatic crop could not answer their
 * questions: the reader's `earring` mask holds BOTH hoops, so a crop at its
 * centre lands on her nose, and a crop at its largest component lands on an
 * ear rather than the hoop hanging below it. Rather than tune a heuristic until
 * it flattered the tile, the regions were cut, looked at, and kept.
 */
async function sheet(name: string, width: number): Promise<Tile> {
  const path = `${CPRIME}/${name}.png`;
  if (!existsSync(path)) return tileOf(name, null, "not on disk — cut it with the disposable that made it");
  return tileOf(name, await sharp(readFileSync(path)).resize(width).png().toBuffer());
}

async function differenceStrip(labels: string[]): Promise<Tile[]> {
  const first = await frame(labels[0]!);
  const tiles: Tile[] = [];
  for (const label of labels.slice(1)) {
    const other = await frame(label);
    if (!first || !other) { tiles.push(tileOf(label, null, "frame not on disk")); continue; }
    const diff = await difference(first, other);
    tiles.push(diff.bytes
      ? tileOf(`${labels[0]} vs ${label}`, await sharp(diff.bytes).resize(320).png().toBuffer())
      : tileOf(`${labels[0]} vs ${label}`, null, diff.note));
  }
  return tiles;
}

/*
  PAINT COUNTS COME FROM THE CELLS, NOT FROM THE RUN'S OWN COUNTERS.

  `calls.nbpNew`/`calls.gpt2New` are what THIS run bought, and the run that
  wrote this JSON was a resume in which every paint came off disk — so those
  counters read 0 and 0, and the first version of this caption told the founder
  "14 Nano Banana Pro paints and 0 GPT Image 2 paints". The cells know their own
  n regardless of who paid for them; the framing probe is the one NBP paint that
  belongs to no cell, so it is added by name.
*/
const nbpPaints = (bench.cell1?.n ?? 0) + (bench.cell2?.n ?? 0) + (bench.framing?.nbpAspectPinned ? 1 : 0);
const gpt2Paints = bench.cell2Gpt2?.n ?? 0;

const item = (cell: any, name: string) => cell?.items?.[name];
const fixed = (value: number | undefined, places = 1) =>
  value === undefined ? "—" : value.toFixed(places);

/* Block 1 — the recipe that was sent, every slot of it, pulled from the same
   production URLs the bench itself read (free). */
{
  const BASE = "https://pub-990e39d8d995468eb61aced83162123a.r2.dev";
  const SLOTS: { key: string; label: string }[] = [
    { key: "casting-v2/candidates/5b9a6e1b-667c-4f03-abf9-c3eea4f249c5.png", label: "1 — her master photograph" },
    { key: "casting-v2/segments/ab9ef497-77c7-4871-a99f-f386383b2985-content.png", label: "2 — her freckles" },
    /* HIS CATCH, NAMED IN THE PACK RATHER THAN ANSWERED ELSEWHERE (fable-164).
       The founder looked at this tile and said it is not her hairstyle, it is
       her fringe. He is right, and the tile is faithful — the slot is fetched
       live from the production key below, so the engine really was handed a
       fringe band under that name. Every stored segment in production was cut
       by the MASTER-ANCHORED cutter (the ~10% class); the delivered-anchored
       cutter that captures 88.7% is still dark and has never re-cut a row. */
    { key: "casting-v2/segments/3649a9bc-782c-4265-8a09-9fd7f0ee542b-content.png", label: "3 — “her hairstyle” — HIS CATCH: this is a FRINGE BAND, not the hairstyle" },
    { key: "casting-v2/segments/68e45d40-df00-46be-b80d-9427a9985937-content.png", label: "4 — her lip gloss" },
  ];
  const tiles: Tile[] = [];
  for (const slot of SLOTS) {
    const response = await fetch(`${BASE}/${slot.key}`).catch(() => null);
    if (!response?.ok) { tiles.push(tileOf(slot.label, null, "could not be fetched from production storage")); continue; }
    const bytes = Buffer.from(await response.arrayBuffer());
    tiles.push(tileOf(slot.label, await sharp(bytes).resize(240, 300, { fit: "inside" }).png().toBuffer()));
  }
  const reference = `${CPRIME}/reference-earring.png`;
  tiles.push(existsSync(reference)
    ? tileOf("5 — her gold hoop", await sharp(readFileSync(reference)).resize(240, undefined, { kernel: "nearest" }).png().toBuffer())
    : tileOf("5 — her gold hoop", null, "not on disk"));
  blocks.push({
    n: 1,
    title: "The claim under test",
    question: "“NBP will reliably copy any hairstyle or reference image onto the original.” — the founder, on the record",
    reading: `Every paint below was given the same five references: her master photograph, and crops of her freckles, her hairstyle, her lip gloss and this hoop. Nothing chains — each paint starts from the master. ${nbpPaints} Nano Banana Pro paints and ${gpt2Paints} GPT Image 2 paints, on the Unfussed cast.`,
    rows: [{
      caption: "The five slots, exactly as they were handed to the painter — slot 3 is the one he caught: "
        + "a stored segment from the old master-anchored cutter, so “her hairstyle” reached the engine as a fringe band. "
        + "The stability findings survive it (a partial reference holds partially-stable as a full one holds fully-stable); "
        + "the reference LIBRARY does not, and is re-cut before it is built.",
      tiles,
    }],
  });
}

/* Block 2 — the same recipe, five times, nothing asked. */
blocks.push({
  n: 2,
  title: "The same recipe, five times, nothing asked",
  question: "If a reference makes the item the SAME, these five frames differ only where the painter breathes.",
  reading: [
    `THE HEAD ITSELF moved mean ${fixed(bench.cell1?.head?.drift.mean)} px between paints — read every line below against that`,
    ``,
    `glasses   ${fixed(item(bench.cell1, "glasses")?.anchored.mean)} px out of place ON HER FACE (raw ${fixed(item(bench.cell1, "glasses")?.drift.mean)} px, almost all of it the head)`,
    `hair      ${fixed(item(bench.cell1, "hair")?.anchored.mean)} px out of place ON HER FACE (raw ${fixed(item(bench.cell1, "hair")?.drift.mean)} px)`,
    `earring   ${fixed(item(bench.cell1, "earring")?.anchored.mean)} px out of place ON HER FACE (raw ${fixed(item(bench.cell1, "earring")?.drift.mean)} px)`,
  ].join("\n"),
  rows: [
    { caption: "The five frames", tiles: await frameTiles(CELL1) },
    { caption: "The same face out of each paint — same glasses? same hoops? same hair?", tiles: await ownCentreStrip(CELL1, "glasses") },
    { caption: "And where she SITS — every frame cut at the first frame's box, so any wander shows", tiles: await fixedBoxStrip(CELL1, "glasses") },
    { caption: "Difference against the first frame — black means identical", tiles: await differenceStrip(CELL1) },
  ],
});

/* Block 3 — with an unrelated ask landed. */
blocks.push({
  n: 3,
  title: "The same recipe again, with one unrelated ask",
  question: "“Change only her eye colour to green.” Do the referenced items hold while the ask lands?",
  reading: [
    `earring   drift mean ${fixed(item(bench.cell2, "earring")?.drift.mean)} px · IoU mean ${fixed(item(bench.cell2, "earring")?.iou.mean, 3)}`,
    `glasses   drift mean ${fixed(item(bench.cell2, "glasses")?.drift.mean)} px · IoU mean ${fixed(item(bench.cell2, "glasses")?.iou.mean, 3)}`,
    `hair      drift mean ${fixed(item(bench.cell2, "hair")?.drift.mean)} px · IoU mean ${fixed(item(bench.cell2, "hair")?.iou.mean, 3)}`,
  ].join("\n"),
  rows: [
    { caption: "The five frames", tiles: await frameTiles(CELL2) },
    { caption: "The same face out of each paint", tiles: await ownCentreStrip(CELL2, "glasses") },
    { caption: "Difference against the first frame", tiles: await differenceStrip(CELL2) },
  ],
});

/* Block 4 — the other painter. */
blocks.push({
  n: 4,
  title: "The same recipe through the other painter",
  question: "Engine choice is routing, not architecture. GPT Image 2 takes exact pixels and accepts 16 references; this is the identical recipe through it.",
  reading: [
    `size returned            ${bench.cell2Gpt2?.size ?? "—"}   — the master's own ${bench.framing?.master ?? "—"}`,
    `Nano Banana Pro returned ${bench.framing?.nbpDefault ?? "—"} with no aspect argument, ${bench.framing?.nbpAspectPinned ?? "NO-READ"} with the aspect pinned — never hers`,
    ``,
    `THE HEAD ITSELF moved mean ${fixed(bench.cell2Gpt2?.head?.drift.mean)} px between paints, against ${fixed(bench.cell1?.head?.drift.mean)} px on the other painter`,
    `glasses   IoU ${fixed(item(bench.cell2Gpt2, "glasses")?.iou.mean, 3)} between paints, against ${fixed(item(bench.cell1, "glasses")?.iou.mean, 3)}`,
    `hair      IoU ${fixed(item(bench.cell2Gpt2, "hair")?.iou.mean, 3)} between paints, against ${fixed(item(bench.cell1, "hair")?.iou.mean, 3)}`,
    ``,
    `the earring reads ${fixed(item(bench.cell2Gpt2, "earring")?.drift.mean)} px of drift, and that is a PAIR question, not a fidelity one:`,
    `paints 1 and 2 wear the matching pair, paint 3 wears one hoop. The clause said "the same hoop, on the same ear".`,
    ``,
    /* From the constants the product itself bills against, never retyped: a
       cost line divided out of this run's own spend would read $0.000 on a
       resumed run where every paint came off disk. */
    `cost per render  $${FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE.toFixed(3)} GPT Image 2 (measured off the balance)  ·  $${NANO_BANANA_PRO_USD_PER_IMAGE["1K"].toFixed(3)} Nano Banana Pro (list)`,
  ].join("\n"),
  rows: [
    { caption: "The three frames", tiles: await frameTiles(CELL2G) },
    { caption: "The same face out of each paint", tiles: await ownCentreStrip(CELL2G, "glasses") },
    { caption: "Difference against the first frame", tiles: await differenceStrip(CELL2G) },
    {
      caption: "Your master wears no earrings — the hoops came from the reference crop (top: master · bottom: paint 1)",
      tiles: [await sheet("EARS-master-vs-paint", 760)],
    },
    {
      caption: "The one thing it gets wrong — rows are paints 1, 2, 3 · paints 1 and 2 wear the pair, paint 3 wears one hoop",
      tiles: [await sheet("EARS-gpt2-sheet", 420)],
    },
    {
      caption: "And the ask landed on all three — top row is your master's grey-blue, the three below are green",
      tiles: [await sheet("EYES-sheet", 700)],
    },
  ],
});

/* ------------------------------------------------------------- the page */

const styles = `
:root { color-scheme: dark light; }
body { margin: 0; background: #0A0A0A; color: #EBEBEB; font-family: Inter, system-ui, sans-serif; }
body.light { background: #EBEBEB; color: #0A0A0A; }
header { padding: 48px 40px 24px; border-bottom: 1px solid #333; }
body.light header { border-color: #ccc; }
h1 { font-size: 24px; font-weight: 500; margin: 0 0 8px; letter-spacing: -0.01em; }
.sub { opacity: 0.62; font-size: 14px; max-width: 70ch; line-height: 1.55; }
section { padding: 40px; border-bottom: 1px solid #222; }
body.light section { border-color: #d5d5d5; }
h2 { font-size: 18px; font-weight: 500; margin: 0 0 6px; }
.q { opacity: 0.72; font-size: 14px; max-width: 78ch; line-height: 1.6; margin: 0 0 16px; }
pre { font-size: 12px; line-height: 1.65; opacity: 0.75; background: rgba(127,127,127,0.08);
      padding: 12px 14px; border-radius: 4px; margin: 0 0 24px;
      /* wrap rather than scroll: a reading that runs off the right edge of an
         evidence document is a reading he will not read. */
      white-space: pre-wrap; word-break: break-word; }
.caption { font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; opacity: 0.5; margin: 24px 0 10px; }
.strip { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-start; }
figure { margin: 0; }
figure img { display: block; border-radius: 3px; max-width: 100%; }
figcaption { font-size: 11px; opacity: 0.5; margin-top: 6px; font-variant-numeric: tabular-nums; }
.gap { width: 260px; height: 160px; border: 1px dashed #666; border-radius: 3px; display: flex;
       align-items: center; justify-content: center; text-align: center; font-size: 11px;
       opacity: 0.6; padding: 12px; box-sizing: border-box; }
button { position: fixed; top: 16px; right: 16px; background: transparent; color: inherit;
         border: 1px solid currentColor; border-radius: 999px; padding: 6px 14px; font-size: 12px;
         cursor: pointer; opacity: 0.55; font-family: inherit; }
`;

const renderTile = (tile: Tile) => tile.src
  ? `<figure><img src="${tile.src}" alt="${escapeHtml(tile.label)}"><figcaption>${escapeHtml(tile.label)}</figcaption></figure>`
  : `<figure><div class="gap">${escapeHtml(tile.label)}<br>— ${escapeHtml(tile.missing ?? "missing")}</div></figure>`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>C′ — does a reference make the item the same, or only similar?</title>
<style>${styles}</style></head>
<body>
<button onclick="document.body.classList.toggle('light')">theme</button>
<header>
  <h1>Does a reference make the item the same, or only similar?</h1>
  <p class="sub">Every frame on this page was painted from the pristine master plus the same five reference
  crops. Nothing chains. The question is not whether it looks good — it is whether the thing you already
  approved comes back as <em>itself</em> when the next render happens.</p>
</header>
${blocks.map((block) => `
<section>
  <h2>${block.n}. ${escapeHtml(block.title)}</h2>
  <p class="q">${escapeHtml(block.question)}</p>
  <pre>${escapeHtml(block.reading)}</pre>
  ${block.rows.map((row) => `
  <div class="caption">${escapeHtml(row.caption)}</div>
  <div class="strip">${row.tiles.map(renderTile).join("")}</div>`).join("")}
</section>`).join("")}
</body></html>`;

mkdirSync("output/pack", { recursive: true });
writeFileSync(OUT, html);
console.log(`${OUT} — ${(Buffer.byteLength(html) / 1e6).toFixed(1)} MB, ${blocks.length} blocks, ${frames.size} frames embedded`);

process.exit(0);
