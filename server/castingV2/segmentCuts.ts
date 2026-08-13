/**
 * Cutting a delivered frame into the segments it earned.
 *
 * The harvest hands back ONE `applied` mask for the whole edit — the region the
 * composite was allowed to differ from the master in — plus the master regions
 * it segmented on the way. A segment, though, is named by FACET, because that
 * is the name the compositor, the undo and the face chart all read. This module
 * is the arithmetic between those two facts, and it is deliberately pure: no
 * database, no storage, no engine. It takes rasters and gives back rasters.
 *
 * # Why the intersection rather than `applied` whole
 *
 * An instruction can write two facets, and filing `applied` twice would store
 * one region under two names — so removing her freckles would also remove the
 * hair colour that shared the row. Each facet keeps only the ground it can
 * prove: the part of the applied region that lies inside its OWN segmentation
 * region.
 *
 * # And why a cut can come back empty
 *
 * A facet whose region never met the applied mask has no pixels of its own in
 * this render. That is a real and common state — the painter answered it
 * outside its region, or did not answer it at all — and it produces NO segment
 * rather than an empty one. A zero-pixel segment would be a promise of
 * permanence over nothing, which is the flattering direction.
 */
import sharp from "sharp";

import { unionMasks } from "./maskGeometry";
import type { Mask, Raster } from "./maskedComposite";

export type SegmentBox = { x: number; y: number; width: number; height: number };

export type SegmentCut = {
  /** The name in the product's vocabulary — a `Facet` id. */
  facet: string;
  /** The segmentation question that drew the region. */
  region: string;
  /** The mask, cropped to its own box: one byte per pixel, 0 or 255. */
  mask: Mask;
  /** The delivered pixels inside that box. */
  content: Raster;
  box: SegmentBox;
  /** The frame both were cut from — the thing a later paste must match. */
  frame: { width: number; height: number };
  /** How many pixels this segment actually owns. Never zero: see above. */
  pixels: number;
  /**
   * ARRIVED GROUND — owned pixels the MASTER's own reading did not claim.
   *
   * The whole point of the delivered union, as a number rather than as a
   * belief. Zero on every master-anchored cut this product has ever filed; on
   * the founder's v#163 it is the hair on her shoulders, which is 90% of what
   * she paid for. Reported rather than capped: growth is already bounded by
   * `applied`, and a segmenter having a bad day should be VISIBLE in a log
   * line, not silently trimmed to a number somebody guessed.
   */
  arrivedPixels: number;
  /**
   * DEPARTED GROUND — owned pixels the master claimed and the delivered
   * reading did not.
   *
   * Where the thing used to be and no longer is: her vacated bun. Not an
   * optimisation and not a leftover — paste the arrived ground alone onto a
   * later render and she gets her hair down AND the bun still there.
   *
   * **Zero when `deliveredRead` is false**, because with no delivered reading
   * nothing is known about what departed. A zero that means "not measured"
   * reading as "none departed" is the silent-zero class, so the flag below
   * carries the difference rather than the number pretending to.
   */
  departedPixels: number;
  /**
   * Whether a delivered reading existed for this region at all.
   *
   * The denominator for the two counts above. Without it a master-anchored cut
   * and a delivered-anchored cut that found nothing new are the same row.
   */
  deliveredRead: boolean;
};

function assertSameShape(a: { width: number; height: number }, b: { width: number; height: number }, what: string): void {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`${what}: ${a.width}×${a.height} against ${b.width}×${b.height}`);
  }
}

/**
 * Where two masks agree. Binary out — a segment's mask is a claim of ownership,
 * not a blend ramp, and the ramps belong to the compositor that pastes it.
 */
export function intersectMasks(a: Mask, b: Mask): Mask {
  assertSameShape(a, b, "intersectMasks was given masks of different sizes");
  const data = Buffer.alloc(a.data.length);
  for (let pixel = 0; pixel < data.length; pixel += 1) {
    data[pixel] = a.data[pixel] > 0 && b.data[pixel] > 0 ? 255 : 0;
  }
  return { data, width: a.width, height: a.height };
}

/**
 * The tight box around everything a mask claims, or null if it claims nothing.
 *
 * `above` is the alpha a pixel must EXCEED to count, and it defaults to 0 — a
 * segment's mask is binary, so every claim is 255 and the default is the whole
 * of it. A composed region carries a real matte ramp instead (`belowHeadMask`
 * keeps the subject's own alpha), and there the threshold has to be the SAME
 * one its completeness is judged at: a box drawn around every pixel above zero
 * and a guard counting every pixel above 127 are two readings of one mask, and
 * two readings of one mask disagreeing is how a crop passes a check it should
 * have failed.
 */
export function boundsOf(mask: Mask, above = 0): SegmentBox | null {
  let minX = mask.width;
  let minY = mask.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < mask.height; y += 1) {
    const row = y * mask.width;
    for (let x = 0; x < mask.width; x += 1) {
      if (mask.data[row + x]! <= above) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function assertBoxInside(box: SegmentBox, frame: { width: number; height: number }): void {
  if (
    box.x < 0 || box.y < 0 || box.width <= 0 || box.height <= 0
    || box.x + box.width > frame.width || box.y + box.height > frame.height
  ) {
    throw new Error("a segment box falls outside its own frame");
  }
}

export function cropMask(mask: Mask, box: SegmentBox): Mask {
  assertBoxInside(box, mask);
  const data = Buffer.alloc(box.width * box.height);
  for (let y = 0; y < box.height; y += 1) {
    mask.data.copy(
      data,
      y * box.width,
      (box.y + y) * mask.width + box.x,
      (box.y + y) * mask.width + box.x + box.width,
    );
  }
  return { data, width: box.width, height: box.height };
}

export function cropRaster(raster: Raster, box: SegmentBox): Raster {
  assertBoxInside(box, raster);
  const data = Buffer.alloc(box.width * box.height * 3);
  for (let y = 0; y < box.height; y += 1) {
    const from = ((box.y + y) * raster.width + box.x) * 3;
    raster.data.copy(data, y * box.width * 3, from, from + box.width * 3);
  }
  return { data, width: box.width, height: box.height };
}

/**
 * Cut one delivered composite into one segment per facet that owns pixels in it.
 *
 * `regionMasks` is keyed by the segmentation QUESTION (`face skin`, `hair`) —
 * the harvest's own `masterRegions`, kept rather than re-derived, so this costs
 * no vision call. `facetRegions` says which question each facet asked, and two
 * facets are allowed to share one: `marks` and `cheekbones` are both face skin,
 * and each files its own segment over the same ground. That duplication is
 * deliberate — per-facet undo is the feature §7 promises, and a shared row
 * would make removing one remove the other.
 */
export function cutSegments(input: {
  /** The delivered frame — what the user is looking at. */
  composite: Raster;
  /** Where the composite was allowed to differ from the master. */
  applied: Mask;
  /** Which segmentation question each facet asked. */
  facetRegions: ReadonlyMap<string, string>;
  /** The master regions the harvest already segmented, by question. */
  regionMasks: ReadonlyMap<string, Mask>;
  /**
   * WHERE THE SAME QUESTIONS LAND ON THE DELIVERED FRAME.
   *
   * `own(facet) = applied ∩ ( region(facet, delivered) ∪ region(facet, master) )`
   * — the delivered-anchored design, at the one line that decides what a
   * segment owns. Absent, or missing a name, and this function behaves exactly
   * as it did before the union existed, which is the regression anchor.
   *
   * # The four rules, and where each one actually lives
   *
   * 1. *Later delivery wins the overlap.* Not here — `assembleComposite`
   *    already claims per pixel, later wins, and records every resolution.
   * 2. *A segment may not claim ground its own reading did not find.* Here,
   *    and structurally: a delivered read that did not settle is simply not in
   *    this map, and a master read that did not settle still files nothing at
   *    all. A delivered-only ground can never open a segment that would not
   *    have opened anyway.
   * 3. *Departed ground is surrendered first.* The master half IS the departed
   *    ground, and it is what shipped before this change; same-facet
   *    supersession already retires an earlier row whole.
   * 4. *Growth is bounded by the ask.* By `applied`, which is the composite's
   *    own governed territory — a facet cannot grow anywhere the paint was not
   *    allowed to go. What this adds is the accounting (`arrivedPixels`), so a
   *    reading that overreached is a number somebody can see.
   */
  deliveredMasks?: ReadonlyMap<string, Mask> | null;
}): SegmentCut[] {
  assertSameShape(input.composite, input.applied, "the applied mask does not match the composite");
  const frame = { width: input.composite.width, height: input.composite.height };
  const cuts: SegmentCut[] = [];

  for (const [facet, region] of Array.from(input.facetRegions.entries())) {
    const regionMask = input.regionMasks.get(region);
    /*
      A facet whose region was never segmented is not a failure and not a
      silent zero — it is a facet this render has no evidence about. It gets no
      segment, and the next render treats it exactly as today: words.
    */
    if (!regionMask) continue;
    assertSameShape(regionMask, input.applied, `the ${region} region does not match the composite`);

    /*
      THE UNION, and the gate above is deliberately left on the MASTER read.

      A facet whose master region was never segmented still files nothing, even
      when the delivered frame has an opinion about it: the delivered union is
      additive to a claim, never the thing that opens one. That keeps this
      change unable to file a segment the old code would not have filed at all,
      which is the property that makes it safe to reason about.
    */
    const deliveredMask = input.deliveredMasks?.get(region) ?? null;
    if (deliveredMask) {
      assertSameShape(deliveredMask, input.applied, `the delivered ${region} region does not match the composite`);
    }
    const ground = deliveredMask ? unionMasks(regionMask, deliveredMask) : regionMask;

    const owned = intersectMasks(input.applied, ground);
    const box = boundsOf(owned);
    if (!box) continue;

    const mask = cropMask(owned, box);
    /*
      THE SPLIT, counted on the same pixels the segment actually owns rather
      than on the region masks — a count taken off the inputs would describe
      ground `applied` never granted.
    */
    let pixels = 0;
    let arrivedPixels = 0;
    let departedPixels = 0;
    for (let y = 0; y < box.height; y += 1) {
      for (let x = 0; x < box.width; x += 1) {
        if (mask.data[y * box.width + x] === 0) continue;
        pixels += 1;
        if (!deliveredMask) continue;
        const at = (box.y + y) * input.applied.width + (box.x + x);
        const onMaster = regionMask.data[at] > 0;
        if (!onMaster) arrivedPixels += 1;
        else if (deliveredMask.data[at] === 0) departedPixels += 1;
      }
    }
    if (pixels === 0) continue;

    cuts.push({
      facet,
      region,
      mask,
      content: cropRaster(input.composite, box),
      box,
      frame,
      pixels,
      arrivedPixels,
      departedPixels,
      deliveredRead: Boolean(deliveredMask),
    });
  }

  return cuts;
}

/**
 * A cut's two objects, as bytes.
 *
 * The mask goes out as a one-channel PNG rather than three: it is a stencil,
 * and storing it as a picture of a grey shape would triple the bytes and invite
 * a reader to composite it by accident.
 */
export async function encodeCut(cut: SegmentCut): Promise<{ mask: Buffer; content: Buffer }> {
  const [mask, content] = await Promise.all([
    sharp(cut.mask.data, { raw: { width: cut.mask.width, height: cut.mask.height, channels: 1 } })
      .png({ compressionLevel: 9 })
      .toBuffer(),
    sharp(cut.content.data, { raw: { width: cut.content.width, height: cut.content.height, channels: 3 } })
      .png({ compressionLevel: 9 })
      .toBuffer(),
  ]);
  return { mask, content };
}
