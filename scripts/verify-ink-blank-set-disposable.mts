/**
 * THE SIX BLANKS, MEASURED BEFORE THEY ARE PINNED — disposable.
 *
 * Every claim the template commit makes about these files is made here against
 * the bytes rather than against a report (working law 1): the field value, the
 * dimensions, the sha256 that goes into the pin, and the mirror relationship
 * between the two arm blanks — which is the one property that makes them "the
 * same limb by construction" rather than by a second generation agreeing.
 *
 * The NEGATIVE CONTROL prints on every run (working law 2): the female front
 * compared against the male front must NOT come back mirror-identical, or the
 * mirror check cannot fail and its pass means nothing.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import sharp from "sharp";

const BLANKS = [
  ["arm A            ", "output/imagegen/ink-template-arm-single-view-a.png"],
  ["arm B (mirrored) ", "output/imagegen/ink-template-arm-single-view-b-mirrored.png"],
  ["female front     ", "output/imagegen/composite/blank-female-front.png"],
  ["female back      ", "output/imagegen/composite/blank-female-back.png"],
  ["male front       ", "output/imagegen/composite/blank-male-front.png"],
  ["male back        ", "output/imagegen/composite/blank-male-back.png"],
] as const;

/** The four corners plus the four edge midpoints — the field, never the form. */
async function fieldSamples(file: string): Promise<string> {
  const image = sharp(file);
  const { width = 0, height = 0 } = await image.metadata();
  const raw = await image.raw().toBuffer();
  const at = (x: number, y: number) => {
    const i = (y * width + x) * 3;
    return `${raw[i]},${raw[i + 1]},${raw[i + 2]}`;
  };
  const points = [
    at(2, 2), at(width - 3, 2), at(2, height - 3), at(width - 3, height - 3),
    at(Math.floor(width / 2), 2), at(Math.floor(width / 2), height - 3),
    at(2, Math.floor(height / 2)), at(width - 3, Math.floor(height / 2)),
  ];
  const unique = Array.from(new Set(points));
  return unique.length === 1 ? `field ${unique[0]} (all 8 samples)` : `field VARIES: ${unique.join(" | ")}`;
}

async function meanAbsDiff(a: Buffer, b: Buffer): Promise<number> {
  let total = 0;
  for (let i = 0; i < a.length; i += 1) total += Math.abs(a[i] - b[i]);
  return total / a.length;
}

async function main(): Promise<void> {
  for (const [label, file] of BLANKS) {
    const bytes = await readFile(file);
    const meta = await sharp(file).metadata();
    const digest = createHash("sha256").update(bytes).digest("hex");
    console.log(
      `${label} ${String(meta.width).padStart(4)}x${String(meta.height).padStart(4)} ` +
      `${meta.channels}ch  ${await fieldSamples(file)}\n` +
      `                   sha256 ${digest}  ${bytes.byteLength} B`,
    );
  }

  /* THE MIRROR — arm B must be arm A flopped, to the byte. */
  const armA = await sharp(BLANKS[0][1]).raw().toBuffer();
  const armB = await sharp(BLANKS[1][1]).raw().toBuffer();
  const armAFlopped = await sharp(BLANKS[0][1]).flop().raw().toBuffer();
  console.log(`\nMIRROR   arm B vs flop(arm A)   mean abs diff ${(await meanAbsDiff(armB, armAFlopped)).toFixed(4)}`);
  console.log(`CONTROL  arm B vs arm A as-is    mean abs diff ${(await meanAbsDiff(armB, armA)).toFixed(4)}   ← must NOT be 0`);

  /* NEGATIVE CONTROL — two different plates must not read as a mirror pair. */
  const femaleFront = await sharp(BLANKS[2][1]).raw().toBuffer();
  const maleFrontFlopped = await sharp(BLANKS[4][1]).flop().raw().toBuffer();
  console.log(`CONTROL  female front vs flop(male front)  mean abs diff ${(await meanAbsDiff(femaleFront, maleFrontFlopped)).toFixed(4)}   ← must NOT be 0`);
}

main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
