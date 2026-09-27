import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  REFINE_FIGURE_MAX_HEIGHT,
  REFINE_FIGURE_WIDTH,
  isRefineFigure,
  refineFigureAt,
} from "../../shared/refineFigure";
import { cutRefineFigure } from "./refineFigure";

/**
 * CUTTING HER SHAPE OUT OF HER OWN PICTURE — driven on real pixels (#55).
 *
 * # Why real images and not a fixture map
 *
 * The subject is a sharp pipeline: a resize, a colourspace, a raw buffer and a
 * channel count. Every one of those is a thing that can move under us, and a
 * test that handed this function a pre-made array would be testing the
 * arithmetic while the part that actually breaks went unwatched. So each arm
 * PAINTS a picture with sharp and reads the answer back.
 *
 * # The controls, and they are the point (working law 2)
 *
 * A "figure detector" that returns something plausible for everything is worse
 * than none, because its output reads as knowledge. So:
 *
 *   - **POSITIVE**: a bright shape on a dark ground must weight the shape and
 *     leave the ground at zero.
 *   - **NEGATIVE**: a FLAT picture must come back all zeros. There is no figure
 *     in it, and a reader that finds one is finding its own noise. This is the
 *     arm that would catch a normalisation slipped in "to make the dust nicer" —
 *     the same shape of defect as a contrast stretch on an empty frame.
 *   - **INVERTED**: a DARK shape on a bright ground must weight the shape just
 *     as well, because the rule is distance from the backdrop and not brightness.
 *     A reader keyed on light pixels would pass the positive arm and fail every
 *     Cast photographed against a white wall.
 */

/** A `size`-square picture: a `fill` ground with a centred `figure`-filled box. */
async function painted(input: {
  width: number;
  height: number;
  ground: number;
  figure: number;
  boxWidth?: number;
  boxHeight?: number;
}): Promise<Buffer> {
  const boxWidth = input.boxWidth ?? Math.round(input.width * 0.4);
  const boxHeight = input.boxHeight ?? Math.round(input.height * 0.5);
  const box = await sharp({
    create: {
      width: boxWidth,
      height: boxHeight,
      channels: 3,
      background: { r: input.figure, g: input.figure, b: input.figure },
    },
  }).png().toBuffer();
  return sharp({
    create: {
      width: input.width,
      height: input.height,
      channels: 3,
      background: { r: input.ground, g: input.ground, b: input.ground },
    },
  })
    .composite([{ input: box, gravity: "centre" }])
    .png()
    .toBuffer();
}

/** The mean weight inside a rectangle of the grid, as fractions of the box. */
function meanWeight(
  figure: { w: number; h: number; cells: string },
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  let total = 0;
  let n = 0;
  for (let fy = y0; fy < y1; fy += 0.01) {
    for (let fx = x0; fx < x1; fx += 0.01) {
      total += refineFigureAt(figure, fx, fy);
      n += 1;
    }
  }
  return n === 0 ? 0 : total / n;
}

describe("her shape, cut from her own master", () => {
  it("weights the figure and leaves the backdrop alone — the POSITIVE control", async () => {
    const figure = await cutRefineFigure(await painted({
      width: 512, height: 768, ground: 20, figure: 230,
    }));
    expect(figure).not.toBeNull();
    if (!figure) return;
    const middle = meanWeight(figure, 0.42, 0.42, 0.58, 0.58);
    const corner = meanWeight(figure, 0.0, 0.0, 0.12, 0.12);
    expect(middle, "she is where she was painted").toBeGreaterThan(0.8);
    expect(corner, "and the wall is the wall").toBeLessThan(0.05);
  });

  it("finds NOTHING in a flat picture — the NEGATIVE control", async () => {
    const figure = await cutRefineFigure(await sharp({
      create: { width: 512, height: 768, channels: 3, background: { r: 128, g: 128, b: 128 } },
    }).png().toBuffer());
    expect(figure).not.toBeNull();
    if (!figure) return;
    /*
      Every cell zero, not merely low. There is no shape in a flat frame, and a
      reader that returns a faint one has normalised its own rounding into a
      claim about a customer's picture.
    */
    expect(figure.cells.replace(/0/g, "")).toBe("");
  });

  it("weights a DARK figure on a BRIGHT ground just as well — distance, never brightness", async () => {
    const figure = await cutRefineFigure(await painted({
      width: 512, height: 768, ground: 235, figure: 25,
    }));
    expect(figure).not.toBeNull();
    if (!figure) return;
    expect(meanWeight(figure, 0.42, 0.42, 0.58, 0.58)).toBeGreaterThan(0.8);
    expect(meanWeight(figure, 0.0, 0.0, 0.12, 0.12)).toBeLessThan(0.05);
  });

  it("takes its height from the picture, so one reader serves any aspect", async () => {
    const tall = await cutRefineFigure(await painted({
      width: 1024, height: 1536, ground: 20, figure: 200,
    }));
    const wide = await cutRefineFigure(await painted({
      width: 1536, height: 1024, ground: 20, figure: 200,
    }));
    expect(tall?.w).toBe(REFINE_FIGURE_WIDTH);
    expect(tall?.h, "a 2:3 master is 32 x 48").toBe(48);
    expect(wide?.h, "and a 3:2 master is half as tall").toBe(21);
  });

  it("never sends a grid taller than the cap, whatever the picture", async () => {
    const strip = await cutRefineFigure(await painted({
      width: 200, height: 4000, ground: 10, figure: 240,
    }));
    expect(strip).not.toBeNull();
    expect(strip!.h).toBeLessThanOrEqual(REFINE_FIGURE_MAX_HEIGHT);
    expect(strip!.cells).toHaveLength(strip!.w * strip!.h);
  });

  it("answers null rather than throwing on something that is not a picture", async () => {
    await expect(cutRefineFigure(Buffer.from("her picture, allegedly"))).resolves.toBeNull();
    await expect(cutRefineFigure(Buffer.alloc(0))).resolves.toBeNull();
  });

  it("only ever emits a map the wire's own validator accepts", async () => {
    const figure = await cutRefineFigure(await painted({
      width: 768, height: 1024, ground: 40, figure: 210,
    }));
    expect(isRefineFigure(figure)).toBe(true);
  });
});

/**
 * THE VALIDATOR, AND IT IS NOT DECORATION.
 *
 * `internalPrompt` is a json column: whatever shape went in, what comes out is
 * unknown, and the consumer is a loop in a browser that scatters 1,700
 * particles. A `w` nobody checked is a hung page rather than a missing word,
 * which is why this is checked on the way in AND on the way out.
 */
describe("the wire's own gate on her shape", () => {
  const good = { w: 2, h: 2, cells: "0909" };

  it("takes a well-formed map", () => {
    expect(isRefineFigure(good)).toBe(true);
  });

  it("refuses a cell count that disagrees with the dimensions", () => {
    expect(isRefineFigure({ ...good, cells: "090" })).toBe(false);
    expect(isRefineFigure({ ...good, cells: "09099" })).toBe(false);
  });

  it("refuses a cell that is not a digit — it would read as NaN and reject every point", () => {
    expect(isRefineFigure({ ...good, cells: "09 9" })).toBe(false);
    expect(isRefineFigure({ ...good, cells: "09x9" })).toBe(false);
  });

  it("refuses a grid bigger than the one the cutter can produce", () => {
    expect(isRefineFigure({ w: REFINE_FIGURE_WIDTH + 1, h: 1, cells: "0".repeat(33) })).toBe(false);
    expect(isRefineFigure({
      w: 1,
      h: REFINE_FIGURE_MAX_HEIGHT + 1,
      cells: "0".repeat(REFINE_FIGURE_MAX_HEIGHT + 1),
    })).toBe(false);
  });

  it("refuses the shapes a json column really does hand back", () => {
    expect(isRefineFigure(null)).toBe(false);
    expect(isRefineFigure(undefined)).toBe(false);
    expect(isRefineFigure("0909")).toBe(false);
    expect(isRefineFigure({ w: 2.5, h: 2, cells: "0909" })).toBe(false);
    expect(isRefineFigure({ w: 0, h: 0, cells: "" })).toBe(false);
  });

  it("reads a point as a fraction of the box, and answers 0 outside it", () => {
    /* Left column dark, right column full — a map whose answer is unambiguous. */
    const map = { w: 2, h: 1, cells: "09" };
    expect(refineFigureAt(map, 0.25, 0.5)).toBe(0);
    expect(refineFigureAt(map, 0.75, 0.5)).toBe(1);
    expect(refineFigureAt(map, -0.1, 0.5), "off the picture is not on her").toBe(0);
    expect(refineFigureAt(map, 1.2, 0.5)).toBe(0);
    expect(refineFigureAt(map, 0.5, 1.0)).toBe(0);
  });
});
