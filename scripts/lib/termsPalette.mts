/**
 * THE MONOCHROME GRAMMAR FOR A SET-DIFF EXHIBIT.
 *
 * Founder ruling, 2026-08-11 (fable-230): *"Bounding-box overlays are THIN
 * WHITE, not red — everywhere."* Standing and product-wide for any on-image
 * geometry. fable-233 §4 extended it to the zoom pairs, which are not boxes but
 * overlapping SETS: *"restate monochrome (white vs mid-grey) — the ruling's
 * letter was bounding boxes; its spirit is the monochrome language."*
 *
 * White vs mid-grey covers two sets. This exhibit draws FOUR, so tone alone
 * cannot carry it and a fourth hue would put the ruling back where it started.
 * The grammar is therefore **tone for what a set IS, texture for where it came
 * from**:
 *
 *   kept              solid white     our cut holds it
 *   lostDelivered     solid grey      the second look found it, our cut does not
 *   lostMasterOnly    hatched grey    ALSO lost — same tone — but granted by the
 *                                     master's read rather than the delivered
 *                                     one, so the texture says which ground
 *   controlFailure    white/black     THE CONTROL. Our cut owns ground NEITHER
 *                     checker         read granted, which cannot legitimately
 *                                     happen. A checker of pure white and pure
 *                                     black is the one mark in the picture that
 *                                     no photograph can make, so a failed
 *                                     control cannot be mistaken for a reading.
 *
 * THE CONTROL'S CHECKER IS PAINTED AFTER MAGNIFICATION, and that is not a
 * detail. Drawn at source resolution it was measurably worse than the hue it
 * replaced: on the delivered pair, 7 of row 8's 20 control pixels have no
 * orthogonal neighbour, so a source-scale checker gives each of them a single
 * flat block — and half of those blocks come out pure white. The restated
 * exhibit carried 187 white source pixels against 178 that were `kept`: nine
 * alarms wearing a reading's mark. A texture that needs two adjacent pixels to
 * read is no use on specks, so `magnifyExhibit` re-paints the checker in the
 * MAGNIFIED raster, where one source pixel is a ×N block with room for it.
 *
 * The greys clear the frame by measurement, not by taste: the exhibit dims its
 * frame to 0.35 brightness, whose brightest surviving channel is **102** on the
 * delivered pair. `LOST_GREY` sits at 158 — half again the brightest thing the
 * photograph can produce — and the checker's black is the only pure black in
 * the picture.
 *
 * Kept beside the builder rather than inside it because the correction of an
 * already-delivered exhibit must repaint with the SAME code the builder now
 * draws with; otherwise "only the palette moved" is a claim rather than a fact.
 */

/**
 * THE BOX, AND WHY IT NEEDS A HALF PIXEL.
 *
 * `stroke="#ffffff" stroke-width="1"` on integer coordinates does NOT draw a
 * white pixel. An SVG stroke straddles its path, so a 1px stroke at y=455 covers
 * 454.5–455.5 and the rasteriser splits it across BOTH rows at half coverage.
 * Read off the delivered pack: rows 454 and 455 came back `166,150,136` and
 * `162,145,131` — two pixels wide, 55% opacity, and tinted WARM by the skin
 * showing through. The source said thin, white and monochrome; the bytes said
 * two-pixel, grey and warm, and the guard that read the source string could not
 * tell the difference.
 *
 * Offsetting by half a pixel puts the stroke inside one pixel exactly. Measured
 * over the same box, top edge meant for row 8:
 *
 *   integer coords, as delivered   row 7 = 128,128,128   row 8 = 128,128,128
 *                                  no pure white anywhere — the two-pixel smudge
 *   `crispEdges` alone             row 7 = 255,255,255   row 8 = 0,0,0
 *                                  CRISP AND ONE ROW TOO HIGH
 *   half-pixel offset alone        row 7 = 0,0,0         row 8 = 255,255,255
 *   both                           identical to the offset alone
 *
 * So the offset does the whole job and `crispEdges` is not carried: its only
 * solo effect is to move the box off the thing it is pointing at, which is the
 * wrong-boundary class wearing a tidy edge. The offset assumes whole-pixel box
 * coordinates, so they are rounded here rather than assumed — every caller
 * passes database bbox integers today, and an assumption that is free to
 * enforce should not be left as one.
 */
export const boxOutlineSvg = (
  width: number,
  height: number,
  boxes: ReadonlyArray<{ x: number; y: number; width: number; height: number }>,
): string => `<svg width="${width}" height="${height}">`
  + boxes.map((box) => `<rect x="${Math.round(box.x) + 0.5}" y="${Math.round(box.y) + 0.5}"`
    + ` width="${Math.max(0, Math.round(box.width) - 1)}" height="${Math.max(0, Math.round(box.height) - 1)}"`
    + ` fill="none" stroke="#ffffff" stroke-width="1"/>`).join("")
  + "</svg>";

export type TermClass = "kept" | "lostDelivered" | "lostMasterOnly" | "controlFailure";

/** Mid-grey. One tone for "lost", because both lost sets are the same finding. */
export const LOST_GREY = 158;

/** The brightest channel the dimmed frame can produce, measured on the delivered
 *  pair (`terms-earring-{left,right}.png`, brightness 0.35). Every mark above is
 *  chosen against this number, and a test pins it so a future re-dim has to
 *  re-argue the greys instead of silently swallowing them. */
export const DIMMED_FRAME_CEILING = 102;

/** One sentence per mark, so the console legend, the guard test and the pack's
 *  prose all read from here instead of drifting apart (working law 4). */
export const TERM_LEGEND: Record<TermClass, string> = {
  kept: "solid white — our cut holds it",
  lostDelivered: "solid grey — the second look found it and our cut does not hold it",
  lostMasterOnly: "hatched grey — also lost, but granted by the master's read rather than the delivered one",
  controlFailure: "white/black checker — CONTROL FAILURE: our cut owns ground neither read granted",
};

/**
 * What to paint at (x, y), or `null` to leave the frame showing through.
 *
 * Position is a parameter because two of the four marks are TEXTURES, and a
 * texture is the only way to separate four sets without a fourth hue. Parity is
 * taken on the source pixel, so a ×12 nearest-neighbour magnification renders it
 * as unmissable blocks; at 1:1 the hatch reads as a dither, which is stated
 * rather than hidden — the ×12 crop is where these sets are meant to be read.
 */
export function paintTerm(term: TermClass, x: number, y: number): [number, number, number] | null {
  const even = (x + y) % 2 === 0;
  switch (term) {
    case "kept":
      return [255, 255, 255];
    case "lostDelivered":
      return [LOST_GREY, LOST_GREY, LOST_GREY];
    case "lostMasterOnly":
      return even ? [LOST_GREY, LOST_GREY, LOST_GREY] : null;
    case "controlFailure":
      /* Black at 1:1 — never white, which is `kept`'s mark. An alarm may be hard
         to see at a resolution nothing is readable at; it may not be legible as
         something else. `magnifyExhibit` gives it its checker. */
      return [0, 0, 0];
  }
}

/** Classes whose real mark is a texture in the magnified raster. */
export const CHECKERED: ReadonlySet<TermClass> = new Set<TermClass>(["controlFailure"]);

/** Checker cells about a third of a source pixel's block, so one control pixel
 *  renders as a 3×3 checkerboard rather than a fine dither — a dither at this
 *  size reads as another flat tone, which is the confusion the mark exists to
 *  avoid. Looked at in the running exhibit at ×12 before it was kept. */
export const checkerCell = (zoom: number) => Math.max(1, Math.round(zoom / 3));

/** The checker, in MAGNIFIED coordinates. */
export const checkerAt = (X: number, Y: number, zoom: number): [number, number, number] => {
  const cell = checkerCell(zoom);
  return (Math.floor(X / cell) + Math.floor(Y / cell)) % 2 === 0 ? [255, 255, 255] : [0, 0, 0];
};

/**
 * Magnify a composed exhibit and paint the render-scale textures into it.
 *
 * `termAt` is asked in FRAME coordinates, so both the builder (which has its
 * sets) and the restatement (which recovered them from the delivered bytes)
 * hand over the same thing and get the same picture — which is what makes
 * "only the palette moved" checkable rather than asserted.
 */
export async function magnifyExhibit(options: {
  composed: Buffer;
  box: { left: number; top: number; width: number; height: number };
  zoom: number;
  termAt: (x: number, y: number) => TermClass | null;
  sharp: typeof import("sharp");
}): Promise<Buffer> {
  const { composed, box, zoom, termAt } = options;
  const magnified = await options.sharp(composed)
    .extract(box)
    .resize({ width: box.width * zoom, height: box.height * zoom, kernel: "nearest" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { data, info } = magnified;
  for (let Y = 0; Y < info.height; Y += 1) {
    const sourceY = box.top + Math.floor(Y / zoom);
    for (let X = 0; X < info.width; X += 1) {
      const term = termAt(box.left + Math.floor(X / zoom), sourceY);
      if (!term || !CHECKERED.has(term)) continue;
      const colour = checkerAt(X, Y, zoom);
      const at = (Y * info.width + X) * 4;
      data[at] = colour[0];
      data[at + 1] = colour[1];
      data[at + 2] = colour[2];
      data[at + 3] = 255;
    }
  }
  return options.sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}
