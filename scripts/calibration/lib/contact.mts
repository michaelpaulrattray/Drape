/**
 * BOUNDARY CONTACT — the rider (`RIDER_boundary-contact.md`), as arithmetic.
 *
 * `painted` is where the composite differs from the master inside the hard mask
 * — where paint WENT, never where paint was allowed. `edgeRing(t)` is the band
 * of the hard mask within `t` pixels of its own boundary. Contact is the share
 * of that ring carrying paint: if real hair or a spectacle frame runs right up
 * to where the zone stopped, the ring is painted and the zone was cut too tight.
 *
 * Reported across tolerances because the rider says the number is measured, not
 * guessed. Nothing here chooses.
 *
 * # Why it lives in a library
 *
 * It was written three times — the glasses fixture, the boundary-contact sweep,
 * and (nearly) the removal diagnosis — and the second copy carried the comment
 * *"copied in shape from the fixture"*, which is a drift warning in the present
 * tense. Three instruments answering the same question must be one instrument,
 * or a knob tuned against one of them is tuned against a number the others do
 * not report. Derive, never mirror (law 4), applies to the bench as well as to
 * the product.
 */
import type { Mask, Raster } from "../../../server/castingV2/maskedComposite";

export type BoundaryContact = {
  /** Pixels inside the hard mask where the composite really differs. */
  paintedPixels: number;
  contact: { tolerance: number; ringPixels: number; paintedShareOfRing: number }[];
};

export function boundaryContact(
  master: Raster,
  composite: Raster,
  hard: Mask,
  tolerances: number[],
): BoundaryContact {
  const { width, height } = hard;
  const painted = new Uint8Array(width * height);
  let paintedCount = 0;
  for (let pixel = 0; pixel < hard.data.length; pixel += 1) {
    if (hard.data[pixel] === 0) continue;
    const at = pixel * 3;
    const delta = Math.abs(composite.data[at] - master.data[at])
      + Math.abs(composite.data[at + 1] - master.data[at + 1])
      + Math.abs(composite.data[at + 2] - master.data[at + 2]);
    /* A few levels of tolerance so JPEG-grade noise is not scored as paint. */
    if (delta > 18) { painted[pixel] = 1; paintedCount += 1; }
  }

  /* Distance from the mask's own boundary, by repeated erosion — exact, and the
     masks are small enough that clarity beats a distance transform here. */
  const inside = new Uint8Array(width * height);
  for (let pixel = 0; pixel < hard.data.length; pixel += 1) inside[pixel] = hard.data[pixel] > 0 ? 1 : 0;
  const depth = new Int32Array(width * height).fill(-1);
  let current = inside;
  for (let layer = 0; layer < Math.max(...tolerances) + 1; layer += 1) {
    const next = new Uint8Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixel = y * width + x;
        if (!current[pixel]) continue;
        const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1
          || !current[pixel - 1] || !current[pixel + 1]
          || !current[pixel - width] || !current[pixel + width];
        if (edge) { if (depth[pixel] < 0) depth[pixel] = layer; } else next[pixel] = 1;
      }
    }
    current = next;
  }

  return {
    paintedPixels: paintedCount,
    contact: tolerances.map((tolerance) => {
      let ring = 0;
      let ringPainted = 0;
      for (let pixel = 0; pixel < depth.length; pixel += 1) {
        if (depth[pixel] < 0 || depth[pixel] > tolerance) continue;
        ring += 1;
        if (painted[pixel]) ringPainted += 1;
      }
      return { tolerance, ringPixels: ring, paintedShareOfRing: ring === 0 ? 0 : ringPainted / ring };
    }),
  };
}

/** The single number the rider is usually quoted by. */
export function contactAt(master: Raster, composite: Raster, hard: Mask, tolerance: number): number {
  return boundaryContact(master, composite, hard, [tolerance])
    .contact.find((entry) => entry.tolerance === tolerance)!.paintedShareOfRing;
}
