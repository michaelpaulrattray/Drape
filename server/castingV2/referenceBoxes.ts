/**
 * THE BOX ARITHMETIC BOTH REFERENCE ROADS DO — #2842.
 *
 * # Why it is one module and not a helper in each file
 *
 * `biggestOf` was written twice, identically, in `referenceDiscovery.ts` and
 * `referenceTake.ts`. That is working law 4 — a second list shadowing a source
 * of truth always drifts from it — and the moment a second fact had to be read
 * off the same boxes a copy in each file would have been two readings of one
 * question. Both now source this; neither declares its own, and
 * `referenceBoxes.test.ts` holds that.
 *
 * # ⚠ WHAT THE SPREAD IS FOR, AND IT IS A MEASUREMENT RATHER THAN A FIX
 *
 * A noun can name a thing made of SEVERAL SEPARATE PARTS, and the detector
 * correctly returns one rectangle per part. Measured on a product shot
 * 2026-10-30 (#2842): `laces` came back as **nine boxes**, and the road kept
 * the biggest — a **57x66 speck of one lace** on a 1536x1024 frame, which is a
 * fragment and not the thing the customer named.
 *
 * ⚠ **AND UNIONING IS NOT OBVIOUSLY THE REPAIR, WHICH IS WHY THIS MODULE ONLY
 * MEASURES.** On the same two fixtures `pocket` came back on one of a jacket's
 * four pockets and `snap button` on one of several snaps: union those and the
 * box becomes most of the jacket, which is worse than a specific one. Whether a
 * noun wants its parts joined or one of them picked is per-noun and **nobody
 * has measured which nouns are which** — so the choice stays exactly where it
 * was and {@link spreadOf} records what the engine already answered, which is
 * the disappearing-technology law's clause 4 read literally.
 *
 * ⚠ **`regionInBox` is a further reason not to guess here**: #2532 measured
 * that several boxes handed to the segmenter do not combine, they switch which
 * object comes back. So a union is a DIFFERENT single question rather than the
 * sum of the ones already asked, and it has to be measured before it is
 * believed.
 */
import type { PointerBox } from "./maskedRefine";

/**
 * HOW MANY PARTS CAME BACK FOR ONE NOUN, AND HOW THEY SIT.
 *
 * Three numbers, and the third is the only one a reader cannot derive from the
 * other two plus the marker it rides on — which is why it is the one stored:
 * `fill` needs every box, and the boxes themselves are deliberately not kept
 * (a noun with nine rectangles would put nine rectangles in every log line to
 * say what one ratio says).
 */
export type BoxSpread = {
  /** How many rectangles the detector returned for this one noun. At least 1. */
  readonly parts: number;
  /** The rectangle every returned box fits inside. The only box when `parts` is 1. */
  readonly union: PointerBox;
  /**
   * What share of `union` the returned boxes actually cover, 0..1, EXACT —
   * overlapping parts are counted once, so this is never above 1 and is exactly
   * 1 when `parts` is 1.
   *
   * ⚠ **This is the number the open question turns on**, and it is why a count
   * alone would not have been enough. Nine boxes threaded along one lacing fill
   * a fair share of a small union; four pockets scattered down a jacket fill
   * almost none of a huge one. The count is identical in shape for both cases
   * and this tells them apart.
   */
  readonly fill: number;
};

/** The biggest rectangle the detector drew, or `null` over no rectangles. */
export function biggestOf(boxes: readonly PointerBox[]): PointerBox | null {
  return [...boxes].sort((a, b) => b.width * b.height - a.width * a.height)[0] ?? null;
}

/** The rectangle every box fits inside, or `null` over no rectangles. */
export function unionOf(boxes: readonly PointerBox[]): PointerBox | null {
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const box of boxes) {
    if (box.x < left) left = box.x;
    if (box.y < top) top = box.y;
    if (box.x + box.width > right) right = box.x + box.width;
    if (box.y + box.height > bottom) bottom = box.y + box.height;
  }
  if (right <= left || bottom <= top) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * THE AREA THE BOXES ACTUALLY COVER, counting an overlap ONCE.
 *
 * A vertical sweep: between each pair of neighbouring x edges the boxes
 * spanning that slab are merged on y, so the answer is exact rather than a sum
 * that double-counts. ⚠ **The sum was the tempting shape and it is wrong in the
 * one direction that matters here** — two nouns can land on nearly the same
 * place (#2787's measured collision), and a summed fill would read above 1 and
 * make a tight cluster look like a scattered one.
 *
 * O(n² log n) in the number of boxes, so it needs no ceiling: a detector
 * answering a hundred rectangles for one noun costs a hundred merges.
 */
export function coveredAreaOf(boxes: readonly PointerBox[]): number {
  const live = boxes.filter((box) => box.width > 0 && box.height > 0);
  if (live.length === 0) return 0;
  const edges = Array.from(new Set(live.flatMap((box) => [box.x, box.x + box.width])))
    .sort((a, b) => a - b);
  let area = 0;
  for (let at = 0; at + 1 < edges.length; at += 1) {
    const left = edges[at]!;
    const right = edges[at + 1]!;
    const spans = live
      .filter((box) => box.x <= left && box.x + box.width >= right)
      .map((box) => ({ from: box.y, to: box.y + box.height }))
      .sort((a, b) => a.from - b.from);
    let covered = 0;
    let top = Number.NEGATIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;
    for (const span of spans) {
      if (span.from > bottom) {
        if (bottom > top) covered += bottom - top;
        top = span.from;
        bottom = span.to;
      } else if (span.to > bottom) {
        bottom = span.to;
      }
    }
    if (bottom > top) covered += bottom - top;
    area += (right - left) * covered;
  }
  return area;
}

/**
 * WHAT CAME BACK FOR ONE NOUN, AS THE THREE NUMBERS WORTH KEEPING.
 *
 * `null` over no rectangles, which is the detector's ABSENCE answer and is
 * every caller's existing refusal — this function never invents a spread for a
 * noun the picture has not got.
 */
export function spreadOf(boxes: readonly PointerBox[]): BoxSpread | null {
  /* ⚠ The empty-size filter is applied ONCE, here, so all three numbers answer
     about the same population. `coveredAreaOf` drops a zero-size rectangle (it
     covers nothing), so counting `boxes.length` would let a degenerate box
     raise `parts` while contributing nothing to `fill` — a spread describing
     two different sets. No real answer from `detectBoxes` carries one (it
     refuses `far <= x`), which is exactly why it would never have been caught. */
  const live = boxes.filter((box) => box.width > 0 && box.height > 0);
  const union = unionOf(live);
  if (union === null) return null;
  const area = union.width * union.height;
  return {
    parts: live.length,
    union,
    fill: area === 0 ? 0 : coveredAreaOf(live) / area,
  };
}
