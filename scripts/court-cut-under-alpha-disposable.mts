/**
 * WHAT IS UNDER THE TRANSPARENCY OF A STORED CUT — free, no call, no engine.
 *
 * `cutOutPixels` (`inkReferenceCrop.ts:371`) is `Buffer.from(rgba)` followed by
 * a loop that writes ONLY the alpha byte. So every pixel outside the mask keeps
 * the customer's original photograph in its RGB and is hidden by alpha alone.
 *
 * This flattens the alpha off two real stored cuts and writes what is left, so
 * the question *"is a person's picture in those bytes"* is answered by looking
 * rather than by reading a mean.
 *
 *   npx tsx scripts/court-cut-under-alpha-disposable.mts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

const REPO = resolve(import.meta.dirname, "..");
const OUT = resolve(REPO, "output/court-upscale-alpha");

const SUBJECTS = [
  ["output/court-region-floor/S1-upperArm-native-183x353.png", "under-1-S1-upperArm-flattened.png"],
  ["output/court-region-crop/S2-torso-neck-road-on.png", "under-2-S2-upperChest-flattened.png"],
] as const;

await mkdir(OUT, { recursive: true });

for (const [from, to] of SUBJECTS) {
  const bytes = await readFile(resolve(REPO, from));
  const meta = await sharp(bytes).metadata();
  /* THE ALPHA REMOVED AND NOTHING ELSE TOUCHED — this is what any consumer that
     ignores the alpha channel receives. */
  const flat = await sharp(bytes).removeAlpha().png().toBuffer();
  await writeFile(resolve(OUT, to), flat);
  console.log(`${from}  ${meta.width}x${meta.height} channels=${meta.channels} -> ${to} (${flat.byteLength} B)`);
}
console.log("\nOpen both. If a person is visible, the stored cut carries the photograph under its alpha.");

process.exit(0);
