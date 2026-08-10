/**
 * DISPOSABLE — WHICH mechanism claimed the torn pixels?
 *
 * Inside the applied mask the composite IS the painted frame (blended), so the
 * painter's own colours are readable from the delivered PNG even though the
 * painted frame was never stored. That is enough to run `differenceMatte`'s
 * arithmetic by hand over the two torn regions and see whether it would have
 * claimed them.
 *
 * `differenceMatte` recovers a strand as the projection of the observed move
 * onto the move a fully-opaque strand would make:
 *
 *   alpha = ((patch - master) . (strand - master)) / |strand - master|²
 *
 * For a `marks` edit the confirmed content is "face skin", so `strand` is HER
 * SKIN COLOUR. The question is what that projection does to a pixel where the
 * painter replaced dark hair with pale background.
 *
 * Positive control: the left notch (master hair → patch pale).
 * Negative control: the right phantom (master pale → patch dark hair).
 * If the arithmetic claims one and not the other, the two tears have DIFFERENT
 * mechanisms, and the negative one points at the vacancy path instead.
 */
import { readFile } from "node:fs/promises";
import sharp from "sharp";

const DIR = "output/run6-audit";

type Rgb = [number, number, number];

async function raster(path: string): Promise<{ data: Buffer; width: number; height: number }> {
  const image = sharp(await readFile(path)).removeAlpha().raw();
  const { data, info } = await image.toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function meanOf(
  image: { data: Buffer; width: number },
  box: { x: number; y: number; w: number; h: number },
): Rgb {
  const totals = [0, 0, 0];
  let count = 0;
  for (let y = box.y; y < box.y + box.h; y += 1) {
    for (let x = box.x; x < box.x + box.w; x += 1) {
      const at = (y * image.width + x) * 3;
      totals[0] += image.data[at]!;
      totals[1] += image.data[at + 1]!;
      totals[2] += image.data[at + 2]!;
      count += 1;
    }
  }
  return [totals[0]! / count, totals[1]! / count, totals[2]! / count];
}

/** The exact line from `differenceMatte`, applied to one averaged pixel. */
function projectedAlpha(master: Rgb, patch: Rgb, strand: Rgb): number {
  let dot = 0;
  let span = 0;
  for (let channel = 0; channel < 3; channel += 1) {
    const toStrand = strand[channel]! - master[channel]!;
    dot += (patch[channel]! - master[channel]!) * toStrand;
    span += toStrand * toStrand;
  }
  if (span <= 1) return 0;
  return Math.max(0, Math.min(1, dot / span));
}

const show = (label: string, rgb: Rgb) =>
  `${label} [${rgb.map((v) => v.toFixed(0)).join(", ")}]`;

async function main(): Promise<void> {
  const master = await raster(`${DIR}/00-master.png`);
  const torn = await raster(`${DIR}/01-freckles.png`);
  console.log(`master ${master.width}×${master.height}`);

  /* Her skin, from a patch of cheek well inside the confirmed face-skin region.
     This stands in for `differenceMatte`'s interior-measured strand colour. */
  const skin = meanOf(torn, { x: 470, y: 540, w: 60, h: 40 });
  console.log(`\n${show("strand colour (her skin, from the delivered frame)", skin)}`);

  const REGIONS = [
    { name: "LEFT NOTCH  (master hair → delivered pale)", x: 320, y: 740, w: 60, h: 70 },
    { name: "LEFT WASH   (master hair → delivered grey)", x: 350, y: 650, w: 40, h: 60 },
    { name: "RIGHT PHANTOM (master pale → delivered hair)", x: 640, y: 680, w: 60, h: 70 },
    { name: "CONTROL: untouched shoulder hair", x: 250, y: 1100, w: 60, h: 70 },
    { name: "CONTROL: untouched background", x: 900, y: 300, w: 60, h: 70 },
  ];

  for (const region of REGIONS) {
    const before = meanOf(master, region);
    const after = meanOf(torn, region);
    const alpha = projectedAlpha(before, after, skin);
    const moved = Math.hypot(after[0]! - before[0]!, after[1]! - before[1]!, after[2]! - before[2]!);
    console.log(`\n${region.name}`);
    console.log(`  ${show("master ", before)}   ${show("delivered", after)}   |Δ| ${moved.toFixed(1)}`);
    console.log(`  differenceMatte alpha = ${alpha.toFixed(3)}  →  ${
      alpha > 0.5 ? "CLAIMED as a strand" : alpha > 0.05 ? "partly claimed" : "not claimed by the strand path"
    }`);
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
