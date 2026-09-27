/**
 * CUTTING HER SHAPE OUT OF HER OWN MASTER — the dust's seed map (#55, board E).
 *
 * One function, called once per refine, on bytes the road has already read.
 *
 * # Why it is here and not in the browser
 *
 * The full reasoning is in `shared/refineFigure.ts`; the short version is that
 * the public bucket sends no CORS header, so a canvas cannot read her pixels,
 * and the alternative — opening the bucket — would let any origin read a
 * customer's cast into a canvas. Her bytes are already in this process's hands
 * at dispatch (`refineService` reads the master to render from it), so the map
 * is cut where the bytes are and rides the row as ~1.5 KB of digits.
 *
 * # What it is, exactly
 *
 * His filed formula, and nothing added to it: resize to a coarse grid, take the
 * backdrop to be the mean of the EDGE cells, and weight every cell by how far
 * its luminance sits from that backdrop, × 3.2, clamped to 1. On a studio frame
 * — one person, one flat backdrop, which is every frame this road renders — that
 * puts the weight on her outline, hair and body and leaves the wall at zero.
 *
 * **It is not a segmentation and must never be described as one.** It cannot
 * tell her from a chair; a dark dress against a dark wall reads as wall. That
 * is acceptable for scattering decoration and would not be acceptable for a
 * mask anything is built on (the fidelity law — declared, not discovered).
 *
 * # It never costs the render anything
 *
 * Every failure returns `null`, and `null` is a first-class answer all the way
 * to the surface: the loader draws the ambient field it drew before this
 * existed rather than a uniform scatter it would be calling her shape. A
 * decoration that can fail a paid edit is a decoration built wrong.
 */
import {
  REFINE_FIGURE_MAX_HEIGHT,
  REFINE_FIGURE_WIDTH,
  encodeRefineFigureCells,
  isRefineFigure,
  type RefineFigure,
} from "../../shared/refineFigure";

/** His number, from the mockup he tuned: how hard a difference from the backdrop counts. */
const FIGURE_CONTRAST = 3.2;

/**
 * HER SHAPE AS A GRID, or `null` when the picture cannot be read.
 *
 * @param bytes the master's own bytes — the same buffer the render is composed
 *              from, so this adds no download and no second decode of anything
 *              the road was not already holding.
 */
export async function cutRefineFigure(bytes: Buffer): Promise<RefineFigure | null> {
  try {
    const sharp = (await import("sharp")).default;
    /*
      GREYSCALE AND RAW, and the height left to the picture.

      `resize({ width })` keeps the aspect, so the grid is as tall as the master
      is — which is what makes one fraction reader serve a portrait and a square
      without either knowing the other exists. `removeAlpha` first: a PNG with
      transparency would otherwise average its own emptiness into the backdrop.

      ⚠ The channel count is READ rather than assumed. `greyscale()` is a
      colourspace instruction and `raw()` honours it, but a boring loop over
      `info.channels` costs nothing and cannot be wrong the day sharp's
      defaults move under it (memory: the quiet clever call).
    */
    const { data, info } = await sharp(bytes)
      .removeAlpha()
      .greyscale()
      .resize({ width: REFINE_FIGURE_WIDTH, fit: "inside", withoutEnlargement: false })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const w = info.width;
    const h = Math.min(info.height, REFINE_FIGURE_MAX_HEIGHT);
    const channels = info.channels;
    if (!(w >= 1 && h >= 1 && channels >= 1)) return null;

    /* Luminance per cell, 0..1. One channel after `greyscale()`; three if a
       future sharp hands them back, in which case the first is the grey. */
    const lum = new Float64Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const at = i * channels;
      if (channels >= 3) {
        lum[i] = (0.2126 * data[at] + 0.7152 * data[at + 1] + 0.0722 * data[at + 2]) / 255;
      } else {
        lum[i] = data[at] / 255;
      }
    }

    /*
      THE BACKDROP IS THE EDGE OF THE FRAME — his own definition.

      Every cell of the border rather than the mockup's every-third-pixel walk:
      the grid is 32 wide, so "every third" would be a handful of samples and
      the mean would swing on one dark shoulder touching the frame.
    */
    let edge = 0;
    let n = 0;
    for (let x = 0; x < w; x++) {
      edge += lum[x] + lum[(h - 1) * w + x];
      n += 2;
    }
    for (let y = 0; y < h; y++) {
      edge += lum[y * w] + lum[y * w + w - 1];
      n += 2;
    }
    const backdrop = edge / n;

    const weights: number[] = [];
    for (let i = 0; i < w * h; i++) {
      weights.push(Math.abs(lum[i] - backdrop) * FIGURE_CONTRAST);
    }
    const figure = { w, h, cells: encodeRefineFigureCells(weights) };
    /*
      THE WRITER CHECKS ITSELF AGAINST THE READER'S OWN VALIDATOR.

      Not belt and braces: this value is about to be written into a json column
      and read back by a browser loop, and the one thing worse than no dust is a
      row carrying a malformed map that the client has to defend against at
      runtime. If the shape this produced would not pass the wire's own gate, it
      does not go on the wire.
    */
    return isRefineFigure(figure) ? figure : null;
  } catch {
    /* A picture sharp cannot open, a codec it does not have, a buffer that is
       not an image at all. The render is unaffected and says nothing about it. */
    return null;
  }
}
