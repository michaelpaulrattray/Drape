/**
 * WHERE SHE IS IN HER OWN PICTURE — the map the dust sits on (#55, board E).
 *
 * # The order, and it is his own drawing
 *
 * The loader he chose across an evening of boards closes with *"i just adjusted
 * thew ripple. its perfect now file it"*. Clause 3 of the filed spec:
 *
 *   > **Dust on her shape.** ~1,700 particles seeded where the picture differs
 *   > from its own studio backdrop (the backdrop is the mean of the edge pixels;
 *   > weight = |lum − backdrop| × 3.2, clamped), so they sit on her outline,
 *   > hair and body, not on the wall.
 *
 * **That formula is his, taken verbatim from the mockup he tuned** — it is not
 * a segmentation and this file does not pretend to be one. A dedicated matting
 * model is the right tool for a MASK that something is built on (the fidelity
 * law, and `maskGeometry`'s incident is why); it is the wrong tool for deciding
 * where to scatter decoration on a loading screen, because it would spend a
 * paid call per refine on dust. What is declared here is exactly what is built:
 * a coarse weight map, his numbers, no model.
 *
 * # Why it exists at all, and why it is not computed in the browser
 *
 * The mockup reads her pixels with `getImageData`. **The app cannot**: served
 * images sit on the public R2 bucket, which sends no `Access-Control-Allow-Origin`
 * (read at the wire, 2026-09-26), so a canvas that draws the frame is tainted
 * and `getImageData` throws. The two roads out of that were putting CORS on the
 * bucket — a production change that would let ANY origin read a customer's cast
 * into a canvas, against *"a customer's cast is their work"* — or cutting the
 * map where her bytes already are. The refine already reads the master's bytes
 * on the request path, so the second road costs no download at all.
 *
 * So: the server cuts this from the master with sharp and rides it on the row
 * beside the step (`internalPrompt.figure`), and the browser gets ~1.5 KB of
 * digits instead of 2.6 MB of picture it already has on screen.
 *
 * # Why the shape lives in `shared/`
 *
 * The server writes it and the loader reads it, and the two must never hold
 * separate ideas of what a cell means (working law 4) — the same reason
 * `refineSteps.ts` is shared. One encoder, one decoder, one validator, here.
 */

/**
 * The grid's width, in cells.
 *
 * 32 across is ~14 px per cell on the box the mockup was drawn at (466 px), and
 * the dust is scattered by REJECTION SAMPLING rather than placed cell by cell —
 * so a cell is a probability field, not a pixel, and its edges are never seen.
 * The payload is what caps it: 32 × 48 is 1,536 digits for a 2:3 picture, which
 * rides on a response the panel already polls.
 */
export const REFINE_FIGURE_WIDTH = 32;

/**
 * And the tallest grid a picture may produce.
 *
 * A pathologically tall master (a strip, a banner) would otherwise send a row
 * per 14 px of height forever. 96 covers every aspect the studio delivers —
 * a 2:3 master is 48 — and bounds the string at 3,072 characters.
 */
export const REFINE_FIGURE_MAX_HEIGHT = 96;

/**
 * WHAT ONE CELL SAYS: how much of her is here, in ten steps.
 *
 * A single digit per cell, `0`–`9`, because the consumer is a probability in a
 * rejection sample — the difference between 0.61 and 0.62 cannot be seen in
 * scattered dust, and a digit string is legible in a log, cheap to validate,
 * and has no encoding to get wrong at either end.
 */
export const REFINE_FIGURE_LEVELS = 10;

/**
 * HER SHAPE, COARSELY — a grid of weights and the grid's own dimensions.
 *
 * `cells` is `w × h` digits in row-major order, top row first. It carries no
 * pixels and no colour: it cannot be turned back into a picture of her, which
 * is deliberate on a field the metadata-only boundary applies to.
 */
export type RefineFigure = {
  w: number;
  h: number;
  cells: string;
};

/**
 * A json column is validated, never trusted — the same rule `isRefineStep`
 * follows one file over, and for a sharper reason: this one arrives at a
 * `Float32Array`-sized loop in a browser, so a `w` nobody checked is a page
 * that hangs rather than a word nobody sees.
 */
export function isRefineFigure(value: unknown): value is RefineFigure {
  if (!value || typeof value !== "object") return false;
  const figure = value as { w?: unknown; h?: unknown; cells?: unknown };
  if (typeof figure.w !== "number" || !Number.isInteger(figure.w) || figure.w < 1) return false;
  if (typeof figure.h !== "number" || !Number.isInteger(figure.h) || figure.h < 1) return false;
  if (figure.w > REFINE_FIGURE_WIDTH || figure.h > REFINE_FIGURE_MAX_HEIGHT) return false;
  if (typeof figure.cells !== "string") return false;
  if (figure.cells.length !== figure.w * figure.h) return false;
  /* Every character a digit — a cell that is not one would read as NaN in the
     sampler and reject every point, which is a uniform field wearing her name. */
  return /^[0-9]+$/.test(figure.cells);
}

/** The digits, from weights in 0..1. */
export function encodeRefineFigureCells(weights: readonly number[]): string {
  let out = "";
  for (const weight of weights) {
    const clamped = weight < 0 ? 0 : weight > 1 ? 1 : weight;
    const level = Math.round(clamped * (REFINE_FIGURE_LEVELS - 1));
    out += String(level);
  }
  return out;
}

/**
 * HOW MUCH OF HER IS AT THIS POINT OF THE BOX, in 0..1.
 *
 * Takes a position as a FRACTION of the box rather than a pixel, so the one
 * reader serves a 466 px mockup and a full-screen viewer without either of
 * them knowing the grid's size. Out of bounds answers 0 rather than throwing:
 * the caller is a hot loop scattering dust, and its worst case must be a dull
 * field, never a broken page.
 */
export function refineFigureAt(figure: RefineFigure, fx: number, fy: number): number {
  if (!(fx >= 0 && fx < 1 && fy >= 0 && fy < 1)) return 0;
  const gx = Math.min(figure.w - 1, Math.floor(fx * figure.w));
  const gy = Math.min(figure.h - 1, Math.floor(fy * figure.h));
  const digit = figure.cells.charCodeAt(gy * figure.w + gx) - 48;
  if (!(digit >= 0 && digit <= 9)) return 0;
  return digit / (REFINE_FIGURE_LEVELS - 1);
}
