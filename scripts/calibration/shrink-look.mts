/**
 * LOOK AT THE REVEAL AT 100%, and diff it — the difference-view rider, which the
 * shrink fixture was missing and which is why a band table read as a pass.
 *
 * The bands said the composite now tracks the painter on the shoulder. The
 * downscaled triptych said something the bands could not: a hard outline tracing
 * the ponytail that is no longer there. A band table cannot see a seam, and a
 * 420px panel cannot be trusted about one — this crops the region at native
 * resolution and puts the difference beside it.
 *
 *   npx tsx scripts/calibration/shrink-look.mts
 */
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";

const OUT = "output/masked/shrink-harvest";
const master = readFileSync(`${OUT}/../hair-up/master.png`);
const painted = readFileSync(`${OUT}/painted.png`);
const composed = readFileSync(`${OUT}/composed.png`);

const meta = await sharp(master).metadata();
const W = meta.width!, H = meta.height!;
/* Where the ponytail hung: her right shoulder, mid-frame down to the hem. */
const CROP = { left: Math.round(W * 0.14), top: Math.round(H * 0.38), width: Math.round(W * 0.40), height: Math.round(H * 0.55) };
console.log(`frame ${W}x${H} — crop ${CROP.width}x${CROP.height} at (${CROP.left},${CROP.top})`);

const raw = async (b: Buffer) => sharp(b).resize(W, H, { fit: "fill" }).removeAlpha().raw().toBuffer();
const A = await raw(master), B = await raw(painted), C = await raw(composed);

/* The difference view, amplified so a five-level seam is visible to an eye. */
const diff = Buffer.allocUnsafe(W * H * 3);
for (let i = 0; i < W * H; i += 1) {
  const at = i * 3;
  const d = (Math.abs(A[at] - C[at]) + Math.abs(A[at + 1] - C[at + 1]) + Math.abs(A[at + 2] - C[at + 2])) / 3;
  const v = Math.min(255, Math.round(d * 6));
  diff[at] = v; diff[at + 1] = v; diff[at + 2] = v;
}
const diffPng = await sharp(diff, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();

const cells = await Promise.all(
  [master, painted, composed, diffPng].map((b) =>
    sharp(b).resize(W, H, { fit: "fill" }).extract(CROP).png().toBuffer()),
);
await sharp({ create: { width: CROP.width * 4 + 36, height: CROP.height, channels: 3, background: "#0A0A0A" } })
  .composite(cells.map((input, i) => ({ input, left: i * (CROP.width + 12), top: 0 })))
  .png()
  .toFile(`${OUT}/REVEAL-100.png`);
console.log("REVEAL-100.png — master | painted | composed | difference x6, all at native resolution");

/* And the adapter's OWN terms over the same crop, so the picture and the mask
   are read at the same scale. `applied` is canonical. */
const terms = ["vacated", "departed", "delivered", "applied"];
const maskCells = await Promise.all(terms.map((t) =>
  sharp(readFileSync(`${OUT}/mask-${t}.png`)).extract(CROP).png().toBuffer()));
await sharp({ create: { width: CROP.width * terms.length + 36, height: CROP.height, channels: 3, background: "#0A0A0A" } })
  .composite(maskCells.map((input, i) => ({ input, left: i * (CROP.width + 12), top: 0 })))
  .png()
  .toFile(`${OUT}/TERMS-100.png`);
console.log(`TERMS-100.png — ${terms.join(" | ")}`);
