/**
 * DISPOSABLE — foreman-113, 2026-08-30. REPAINT THE MASKS WHITE.
 *
 * The gate caught a `fill="#ffb0b0"` caption in my strip against the founder's
 * standing ruling (fable-230, `onImageGeometryMonochrome.test.ts`): *"Bounding-
 * box overlays are THIN WHITE, not red — everywhere."* The caption was the only
 * thing the guard could see, and fixing only that would have been the fix going
 * to the instance while the class walked free — the very failure that guard's
 * own docblock was written about.
 *
 * The wider fact: my driver paints its mask in RED, and the guard cannot see it
 * because it reads `fill=`/`stroke=` hexes and `[r, g, b]` literals, while the
 * driver assigns channels one at a time. **That idiom has never been in the
 * tracked tree** — foreman-104's and foreman-106's `-WHERE` writers stayed
 * untracked, so this commit would be the one that imports it. White is what the
 * ruling actually prescribes, so the driver paints white now and this repaints
 * the frames already bought.
 *
 * WHY RECOVER RATHER THAN RE-READ: the masks are not saved, only the overlays.
 * Re-running the reads would cost another $0.065 and, worse, would be a
 * DIFFERENT reading — the pictures under the record would no longer be the
 * pictures the record's numbers came from. So the mask is recovered by
 * differencing each overlay against its own original frame, which is exact
 * arithmetic on artifacts already in hand.
 *
 * AND THE RECOVERY IS PROVEN, not trusted: the recovered pixel count must equal
 * the count `output/_shift113/report.md` recorded for that arm, read out of the
 * report rather than retyped. A recovery that cannot be checked against an
 * independent record is a claim; this one has one.
 *
 *   npx tsx scripts/_shift113-repaint-disposable.mts
 *
 * No network, no database, no money.
 */
import { readFileSync, writeFileSync } from "node:fs";

import sharp from "sharp";

const OUT = "output/_shift113";

const report = readFileSync(`${OUT}/report.md`, "utf8");
function recordedPixels(id: string): number {
  const block = report.split(`## ${id} `)[1];
  if (block === undefined) throw new Error(`${id} is not in the report`);
  const line = block.split("\n").find((l) => l.trim().startsWith("mask:"));
  if (line === undefined) throw new Error(`${id} has no mask line`);
  const match = /mask: (\d+) px/.exec(line);
  if (match === null) throw new Error(`${id} recorded no pixel count`);
  return Number(match[1]);
}

const ARMS: { id: string; source: string }[] = [
  { id: "BR-ANG-C-0", source: "output/_shift104-widening/ANG-C-0.png" },
  { id: "BR-ANG-C-2", source: "output/_shift104-widening/ANG-C-2.png" },
  { id: "BR-LAM-K-2", source: "output/_shift104-widening/LAM-K-2.png" },
  { id: "BR-53", source: "output/_shift100-frames/53.png" },
];

for (const arm of ARMS) {
  const overlayPath = `${OUT}/${arm.id}-WHERE.png`;
  const original = await sharp(arm.source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const painted = await sharp(overlayPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (original.info.width !== painted.info.width || original.info.height !== painted.info.height) {
    throw new Error(`${arm.id}: overlay and original differ in size - they are not the same frame`);
  }

  const { width, height } = original.info;
  const out = Buffer.from(original.data);
  let recovered = 0;
  for (let index = 0; index < width * height; index += 1) {
    const at = index * 4;
    const differs = original.data[at] !== painted.data[at]
      || original.data[at + 1] !== painted.data[at + 1]
      || original.data[at + 2] !== painted.data[at + 2];
    if (!differs) continue;
    recovered += 1;
    /* THIN WHITE, the ruling's own words - blended so the feature underneath
       stays visible, which is the whole point of showing where it pointed. */
    out[at] = Math.round((original.data[at]! * 90 + 255 * 165) / 255);
    out[at + 1] = Math.round((original.data[at + 1]! * 90 + 255 * 165) / 255);
    out[at + 2] = Math.round((original.data[at + 2]! * 90 + 255 * 165) / 255);
  }

  /* THE CONTROL. The recovered mask must be the mask the report recorded; a
     silent mismatch would mean these pictures no longer depict the reading
     underneath them. */
  const expected = recordedPixels(arm.id);
  if (recovered !== expected) {
    throw new Error(`${arm.id}: recovered ${recovered} px but the report records ${expected} px - the repaint would not depict the reading`);
  }

  await sharp(out, { raw: { width, height, channels: 4 } }).png().toFile(overlayPath);
  console.log(`${arm.id}: ${recovered} px repainted white (matches the report)`);
}
process.exit(0);
