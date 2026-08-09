/**
 * THE MARKS INSTRUMENT — specks darker than their own neighbourhood, on skin.
 *
 * Extracted from `freckle-density.mts` **unchanged** so that a second bench can
 * read a frame the same way rather than beside it. This program's law 4 is the
 * reason: a copy of a courted instrument drifts from it, and then two tables
 * disagree about one face and nobody knows which is the measurement.
 *
 * Its declared limit travels with it: **it can only ORDER FRAMES OF ONE FACE.**
 * Clear skin does not read zero — pores, fine lines and the down on a cheek are
 * small dark specks against local skin and no threshold separates them from
 * pigment. So it never answers *is this face freckled*; it answers *how far
 * above her own untouched skin this frame sits*, and every table using it must
 * print her floor as its first row.
 *
 * Its court is `freckle-density.mts`'s own header: her master 3.84, the frame
 * that delivered 4.28, the frame at her floor 3.49, the densest 5.03 — and a
 * clear-skinned stranger at 6.02, which is what the limit above looks like.
 */
import { readFileSync } from "node:fs";
import sharp from "sharp";

import { CHANGE_AMPLITUDE } from "../../../server/castingV2/changeAmplitude";
import type { RegionReader } from "../../../server/castingV2/maskedRefine";

export type Patch = { left: number; top: number; width: number; height: number };
export type Population = { patch: Patch; skin: Uint8Array; pixels: number };

/**
 * How much darker than local skin a speck has to be, in mean levels.
 *
 * `CHANGE_AMPLITUDE.marks` — the SURFACE band, whose basis is measured on this
 * exact thing. Taken from the registry rather than picked here, because a
 * measurement constant invented at the bench is the shape this program keeps
 * finding on the paid path.
 */
export const DARKER_BY = CHANGE_AMPLITUDE.marks.levels;
/** A freckle's plausible area in pixels. Bigger is a mole, a nostril or a
 *  shadow; smaller is sensor noise. */
const MIN_AREA = 3;
const MAX_AREA = 120;

/**
 * HER CHEEKS AND NOSE, PLACED FROM HER EYES — not from a fraction of a box.
 *
 * A fraction of a box assumes where a face sits in it, and the first version of
 * this landed squarely on her MOUTH. Her eyes do not assume: they are the same
 * anchor `additionDestination` uses to place an earring, read from the picture.
 *
 * And the population is the segmentation ∩ the band, never the bounding box:
 * the box over her cheeks also contains the lower rim of her glasses, her hair
 * at both edges and her nostrils — dark, speck-sized, and counted.
 */
export async function cheekBand(reader: RegionReader, file: string): Promise<Population | null> {
  const bytes = readFileSync(file);
  const region = await reader.region({ image: bytes, name: "face skin" }).catch(() => null);
  if (!region) return null;
  let minX = region.width;
  let maxX = 0;
  let minY = region.height;
  let maxY = 0;
  for (let y = 0; y < region.height; y += 1) {
    for (let x = 0; x < region.width; x += 1) {
      if (region.data[y * region.width + x] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX <= minX || maxY <= minY) return null;
  const eyes = await reader.landmark({ image: bytes, name: "eyes" }).catch(() => []);
  if (eyes.length === 0) return null;
  const eyeY = (eyes.reduce((sum, point) => sum + point.y, 0) / eyes.length) * region.height;
  const faceWidth = maxX - minX;
  const faceHeight = maxY - minY;
  const patch: Patch = {
    left: Math.round(minX + faceWidth * 0.10),
    top: Math.round(eyeY + faceHeight * 0.05),
    width: Math.round(faceWidth * 0.80),
    height: Math.round(faceHeight * 0.20),
  };

  const skin = new Uint8Array(patch.width * patch.height);
  let pixels = 0;
  for (let y = 0; y < patch.height; y += 1) {
    for (let x = 0; x < patch.width; x += 1) {
      const source = (patch.top + y) * region.width + (patch.left + x);
      if (region.data[source] === 0) continue;
      skin[y * patch.width + x] = 1;
      pixels += 1;
    }
  }
  return { patch, skin, pixels };
}

/**
 * A LOCAL SKIN BASELINE THAT ONLY SEES SKIN.
 *
 * A blur over the whole crop lets a dark object inside the radius drag the
 * local baseline down and suppress detections near it — so a frame with the
 * eyewear gone gets a brighter baseline and more specks for a reason that has
 * nothing to do with freckles. It is not enough for the POPULATION to be
 * identical across frames if the INSTRUMENT reads a different neighbourhood on
 * each of them.
 *
 * Box radius 10 for its variance — (2r+1)²/12 ≈ 36.8, σ ≈ 6.1 — matching the
 * Gaussian it replaces, because `DARKER_BY` was set against that spatial scale.
 */
export function skinBaseline(
  values: Uint8Array | Buffer,
  skin: Uint8Array,
  width: number,
  height: number,
  radius = 10,
): Float32Array {
  const stride = width + 1;
  const sumValue = new Float64Array(stride * (height + 1));
  const sumSkin = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      const on = skin[pixel] ? 1 : 0;
      const here = (y + 1) * stride + (x + 1);
      sumValue[here] = on * values[pixel]!
        + sumValue[here - 1]! + sumValue[here - stride]! - sumValue[here - stride - 1]!;
      sumSkin[here] = on
        + sumSkin[here - 1]! + sumSkin[here - stride]! - sumSkin[here - stride - 1]!;
    }
  }
  const box = (sums: Float64Array, x0: number, y0: number, x1: number, y1: number): number =>
    sums[(y1 + 1) * stride + (x1 + 1)]! - sums[y0 * stride + (x1 + 1)]!
    - sums[(y1 + 1) * stride + x0]! + sums[y0 * stride + x0]!;

  const baseline = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      if (!skin[pixel]) continue;
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius);
      const count = box(sumSkin, x0, y0, x1, y1);
      baseline[pixel] = count > 0 ? box(sumValue, x0, y0, x1, y1) / count : values[pixel]!;
    }
  }
  return baseline;
}

/**
 * Count them, and write out exactly what was counted.
 *
 * The saved patch has everything off the population blacked out, because a
 * patch that flatters the count is how a band over her mouth survived four
 * numbers. Connected components, so a speck is counted once and a shadow is
 * not counted at all — it is too big to be a freckle and says so by its area.
 */
export async function countSpecks(file: string, population: Population, save: string): Promise<{
  specks: number; area: number; perThousand: number;
}> {
  const { patch, skin, pixels } = population;
  const cropped = sharp(readFileSync(file)).extract(patch).greyscale();
  const raw = await cropped.clone().raw().toBuffer({ resolveWithObject: true });

  const { width, height } = raw.info;
  const baseline = skinBaseline(raw.data, skin, width, height);
  const dark = new Uint8Array(width * height);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    if (!skin[pixel]) continue;
    if (baseline[pixel]! - raw.data[pixel]! >= DARKER_BY) dark[pixel] = 1;
  }

  const shown = await sharp(readFileSync(file)).extract(patch).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    if (skin[pixel]) continue;
    shown.data[pixel * 4] = 0;
    shown.data[pixel * 4 + 1] = 0;
    shown.data[pixel * 4 + 2] = 0;
  }
  await sharp(shown.data, { raw: { width, height, channels: 4 } }).png().toFile(save);

  const seen = new Uint8Array(width * height);
  let specks = 0;
  for (let start = 0; start < width * height; start += 1) {
    if (!dark[start] || seen[start]) continue;
    const stack = [start];
    seen[start] = 1;
    let area = 0;
    while (stack.length > 0) {
      const pixel = stack.pop()!;
      area += 1;
      const x = pixel % width;
      const y = (pixel - x) / width;
      for (const neighbour of [
        x > 0 ? pixel - 1 : -1, x < width - 1 ? pixel + 1 : -1,
        y > 0 ? pixel - width : -1, y < height - 1 ? pixel + width : -1,
      ]) {
        if (neighbour < 0 || seen[neighbour] || !dark[neighbour]) continue;
        seen[neighbour] = 1;
        stack.push(neighbour);
      }
    }
    if (area >= MIN_AREA && area <= MAX_AREA) specks += 1;
  }
  return { specks, area: pixels, perThousand: (specks / pixels) * 1000 };
}
