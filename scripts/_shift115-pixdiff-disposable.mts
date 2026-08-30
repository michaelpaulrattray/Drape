/**
 * Pixel control for brief 00's acceptance test — "no existing page changes
 * appearance" (foreman-115, 2026-08-30).
 *
 * The four PRE-EXISTING sections of `/casting/foundation` are captured on this
 * branch and on `main` and compared here. Those four sections render every
 * primitive the foundation already shipped, so they are the real subject of the
 * acceptance test: if section 00 leaked, it leaks here.
 *
 * ⚠ **A hash comparison already ran and said three of four DIFFER**, which is
 * why this exists: a byte difference is not a visible difference, and two of
 * those sections contain a running animation (the skeleton's `dp-sweep`, the
 * progress bar). This measures WHERE and HOW MUCH, so the verdict is a reading
 * rather than a guess.
 *
 * Negative control included: two genuinely different sections must report a
 * large difference, or the comparison is not measuring anything.
 */
import sharp from "sharp";

const DIR = "output/_shift115-evidence";

async function raw(path: string) {
  const image = sharp(path).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

async function compare(a: string, b: string) {
  const left = await raw(a);
  const right = await raw(b);
  if (left.width !== right.width || left.height !== right.height) {
    return { sizeMismatch: `${left.width}x${left.height} vs ${right.width}x${right.height}` };
  }
  let changed = 0;
  let maxDelta = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  for (let i = 0; i < left.data.length; i += left.channels) {
    const delta = Math.max(
      Math.abs(left.data[i] - right.data[i]),
      Math.abs(left.data[i + 1] - right.data[i + 1]),
      Math.abs(left.data[i + 2] - right.data[i + 2]),
    );
    if (delta === 0) continue;
    changed += 1;
    maxDelta = Math.max(maxDelta, delta);
    const pixel = i / left.channels;
    const x = pixel % left.width;
    const y = Math.floor(pixel / left.width);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const total = left.width * left.height;
  return {
    size: `${left.width}x${left.height}`,
    changed,
    total,
    percent: ((changed / total) * 100).toFixed(3),
    maxDelta,
    bbox: changed ? { minX, minY, maxX, maxY } : null,
  };
}

async function main(): Promise<void> {
  const [left, right] = process.argv.slice(2);
  if (!left || !right) throw new Error("usage: <leftTag> <rightTag>");

  for (const section of [1, 2, 3, 4]) {
    const verdict = await compare(
      `${DIR}/${left}-sec${section}.png`,
      `${DIR}/${right}-sec${section}.png`,
    );
    console.log(`section ${section}:`, JSON.stringify(verdict));
  }
}

await main();
process.exit(0);
