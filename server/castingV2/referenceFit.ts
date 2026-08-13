/**
 * A CARRIED CROP GOES OUT AT THE MASTER'S GEOMETRY — measured, not assumed.
 *
 * # The defect this closes, in numbers
 *
 * The founder looked at two of his own frames and said her head got bigger. It
 * had: face height moved **+14.5%** on #178 → #179 against a **±0.3%** noise
 * floor across the three steps he called clean (opus-288). #179 was also the
 * only one of the four with a CARRY — master plus a `hair` crop, two references
 * at different scales, where the clean rows sent the master alone.
 *
 * That was n=1 and it was deliberately not filed as a cause. Driven as an
 * experiment (opus-292), on the RECORDED dispatch rather than a reconstruction:
 *
 *   with the carry, three repeats     +9.3%   +10.1%   +7.0%   hair kept
 *   without it, three repeats         +0.5%    +0.8%   +0.5%   HAIR LOST
 *
 * The arms do not overlap; the smallest drift with a carry is nearly nine times
 * the largest without one. But dropping the carry is not a fix — it holds the
 * frame by discarding the edit the customer paid for two steps earlier.
 *
 * So the crop was padded back to its own position on a master-sized canvas and
 * the same ask re-run (opus-294):
 *
 *   padded to the master's frame           -0.5%   +0.3%   -1.3%   hair kept
 *
 * **The drift class is gone and her hair survives** — the first configuration
 * with both properties. The residual ±1.3% scatter (n=3) is the honest number
 * and it travels with this module rather than being rounded away; fable-359
 * amended its own "held" bar in the open on that evidence.
 *
 * # Why padding rather than stretching
 *
 * Stretching the crop to fill the frame would fix the pixel dimensions while
 * making her head bigger still — the opposite of the point. Padding at the
 * stored bbox makes the reference dimensionally identical to the master AND
 * puts her hair at the size it is in the master, which is what "the exact hair
 * she has" was always supposed to mean.
 *
 * # The line this module does not cross
 *
 * It runs at DISPATCH, on a copy, after the pixel-frozen digest has already been
 * checked against the library's own bytes. The stored crop is never rewritten:
 * the library's mint stays the archival record, and this is transport.
 */
import sharp from "sharp";

import type { ReferenceGeometry } from "./referenceLibrary";

export type StudioBackground = { r: number; g: number; b: number };

/**
 * HER OWN BACKGROUND, sampled from the master's top-left corner.
 *
 * # The near-miss this function's shape exists to prevent
 *
 * The first version of the experiment padded her hair onto a warm mauve field
 * and called it her studio wall, because
 *
 *     sharp(bytes).extract({ ... }).stats()
 *
 * reports statistics of the **input image** and silently ignores the extract in
 * the chain. Driven, it returned rgb(200,189,185) — byte-identical to
 * `sharp(bytes).stats()`, which is the average of the whole photograph including
 * her hair, skin and shirt. The corner's real pixels are ~rgb(217,217,219).
 *
 * The corner is therefore MATERIALISED first and its SHAPE is asserted before
 * anything is read from it — see the control below for why that beats comparing
 * it to the whole-image mean. A pad the colour of a whole photograph is not a
 * wall, and it would be invisible in every output except the picture.
 */
const CORNER = 8;

export async function studioBackgroundOf(master: Buffer): Promise<StudioBackground> {
  const cornerBytes = await sharp(master).extract({ left: 0, top: 0, width: CORNER, height: CORNER }).toBuffer();

  /*
    THE CONTROL, in the shipped path — and STRONGER than the one it replaces.

    fable-359 asked to keep the check that caught this: *the sampled corner
    equals the whole-image mean*. That heuristic has a false positive I would
    rather not ship — **on a uniform master the two are legitimately equal**, so
    a plain backdrop with nobody in front of it would throw a correct render.

    This asserts the thing the heuristic was standing in for, directly: that the
    materialised buffer really is 8×8. If `extract` is ever ignored again, these
    are the master's own dimensions and it fails immediately, on every image,
    including the uniform one the mean test would have got wrong in both
    directions.
  */
  const shape = await sharp(cornerBytes).metadata();
  if (shape.width !== CORNER || shape.height !== CORNER) {
    throw new Error(
      `the sampled corner is ${shape.width}×${shape.height}, not ${CORNER}×${CORNER} — the extract did `
      + "not apply, so this pad would be built from the whole photograph rather than her background",
    );
  }

  const corner = await sharp(cornerBytes).stats();
  const sampled = corner.channels.slice(0, 3).map((channel) => Math.round(channel.mean));
  if (sampled.length < 3) throw new Error(`the master has ${sampled.length} channels; a background needs three`);
  return { r: sampled[0]!, g: sampled[1]!, b: sampled[2]! };
}

/**
 * The crop, placed back where it was cut from, on a canvas the master's size.
 *
 * Refuses rather than guessing when the stored frame is not the frame being
 * rendered: a bbox from a differently-sized frame would put her hair somewhere
 * she never had it, and a reference that is subtly wrong about WHERE she is is
 * worse than one that is honestly the wrong size.
 */
export async function padToFrame(input: {
  crop: Buffer;
  geometry: ReferenceGeometry;
  frame: { width: number; height: number };
  background: StudioBackground;
}): Promise<Buffer> {
  const { bbox } = input.geometry;
  const stored = input.geometry.frame;
  if (stored.width !== input.frame.width || stored.height !== input.frame.height) {
    throw new Error(
      `the crop was cut from a ${stored.width}×${stored.height} frame and this render is `
      + `${input.frame.width}×${input.frame.height} — its position does not transfer`,
    );
  }
  if (bbox.x < 0 || bbox.y < 0
    || bbox.x + bbox.width > input.frame.width
    || bbox.y + bbox.height > input.frame.height) {
    throw new Error(
      `the crop's box (${bbox.x},${bbox.y} ${bbox.width}×${bbox.height}) does not fit inside `
      + `${input.frame.width}×${input.frame.height}`,
    );
  }

  const actual = await sharp(input.crop).metadata();
  if (actual.width !== bbox.width || actual.height !== bbox.height) {
    /*
      The stored box is a claim about the stored pixels, and this is the one
      place both are in hand. A crop whose bytes disagree with its own geometry
      would be composited at the wrong scale — the exact defect this module
      exists to remove, reintroduced by its own fix.
    */
    throw new Error(
      `the crop is ${actual.width}×${actual.height} but its geometry says `
      + `${bbox.width}×${bbox.height}`,
    );
  }

  return sharp({
    create: {
      width: input.frame.width,
      height: input.frame.height,
      channels: 3,
      background: input.background,
    },
  })
    .composite([{ input: input.crop, left: bbox.x, top: bbox.y }])
    .png()
    .toBuffer();
}
