/**
 * THE ROW THAT CANNOT BE TRUE — written15-r2: painted 0/5, composed 4/5.
 *
 * A composite is the painter's pixels inside the applied mask and her master
 * everywhere else, so it cannot hold pigment the paint does not have. Either
 * the reader is unstable on this pair or the frames are not what I think they
 * are, and the headline rate (~1 paint in 3) has no error bar until I know
 * which.
 *
 * Ten readings each, plus the arithmetic: how much of the composite differs
 * from the paint, and where.
 *
 *   npx tsx scripts/probe-r2-anomaly-disposable.mts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import sharp from "sharp";

import { verifyRender } from "../server/castingV2/renderVerification";

const DIR = "output/masked/freckles-written15-r2";
const REPEAT = 10;

for (const name of ["painted", "composed"]) {
  const bytes = readFileSync(`${DIR}/${name}.png`);
  let yes = 0;
  const saws = new Set<string>();
  for (let reading = 0; reading < REPEAT; reading += 1) {
    const verdict = await verifyRender({
      bytes, contentType: "image/png",
      facts: [{ facet: "marks", asked: "freckles", binding: false }],
    });
    if (verdict.checks[0]?.verified) yes += 1;
    saws.add(String(verdict.checks[0]?.saw ?? "—"));
  }
  console.log(`${name.padEnd(9)} present ${yes}/${REPEAT}`);
  for (const saw of saws) console.log(`    ${saw.slice(0, 86)}`);
}

/* And the arithmetic, so "they are different pictures" is a number. */
const raw = async (file: string) => {
  const meta = await sharp(`${DIR}/painted.png`).metadata();
  return sharp(file).resize(meta.width!, meta.height!, { fit: "fill" })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
};
const a = await raw(`${DIR}/painted.png`);
const b = await raw(`${DIR}/composed.png`);
let differing = 0;
let loud = 0;
for (let pixel = 0; pixel < a.info.width * a.info.height; pixel += 1) {
  const at = pixel * 3;
  const delta = (Math.abs(a.data[at]! - b.data[at]!) + Math.abs(a.data[at + 1]! - b.data[at + 1]!)
    + Math.abs(a.data[at + 2]! - b.data[at + 2]!)) / 3;
  if (delta > 2) differing += 1;
  if (delta > 25) loud += 1;
}
const total = a.info.width * a.info.height;
console.log(`\npainted vs composed: ${((differing / total) * 100).toFixed(1)}% of the frame differs `
  + `at all, ${((loud / total) * 100).toFixed(1)}% loudly`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
