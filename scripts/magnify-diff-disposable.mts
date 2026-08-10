/** The difference pictures are 1024×1536 and the hoop is 25×32 — magnify or
 *  nobody can look at them. Crops a padded window around each box and scales
 *  ×12 with nearest-neighbour, so a pixel stays a pixel. */
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const DIR = path.resolve("output/earring-cut-diagnosis");
/* The two boxes, from the rows themselves. */
const BOXES: Record<string, { x: number; y: number; width: number; height: number }> = {
  "earring-left": { x: 642, y: 455, width: 25, height: 32 },
  "earring-right": { x: 352, y: 470, width: 24, height: 27 },
};
const PAD = 14;

for (const file of await readdir(DIR)) {
  if (!file.endsWith("-diff.png") || file.includes("x12")) continue;
  const key = Object.keys(BOXES).find((name) => file.startsWith(name));
  if (!key) continue;
  const box = BOXES[key]!;
  const meta = await sharp(path.join(DIR, file)).metadata();
  const left = Math.max(0, box.x - PAD);
  const top = Math.max(0, box.y - PAD);
  const width = Math.min(meta.width! - left, box.width + PAD * 2);
  const height = Math.min(meta.height! - top, box.height + PAD * 2);
  const out = await sharp(path.join(DIR, file))
    .extract({ left, top, width, height })
    .resize({ width: width * 12, height: height * 12, kernel: "nearest" })
    .png()
    .toBuffer();
  await writeFile(path.join(DIR, file.replace("-diff.png", "-diff-x12.png")), out);
  console.log(file.replace("-diff.png", "-diff-x12.png"));
}

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
