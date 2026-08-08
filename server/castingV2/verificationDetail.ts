/**
 * THE MAGNIFIED CROP THE READER NEEDS TO SEE A FRECKLE.
 *
 * # The measurement this exists for
 *
 * Run-12's `marks` scored 25% and stopped the walk, and the first story was a
 * broken reader. Its court put eight cases to the production reader five times
 * at each of three lenses — 120 readings — and found **zero split verdicts**.
 * The reader agrees with itself perfectly. What decides the answer is what it
 * is handed:
 *
 *     portrait (today)              6/8 cases unanimous, 30/40 readings right
 *     face crop                     7/8                  35/40
 *     face crop, enlarged 2x        8/8                  40/40
 *
 * Light freckles are a few pixels across in a 1024×1536 portrait and do not
 * survive the downsample a vision model applies before it ever sees the image.
 * So the repair is neither more readings nor a better question. It is pixels.
 *
 * # Why it costs no vision call
 *
 * The crop's box comes from a region the harvest **already** segmented for its
 * own work, carried on `MaskedRefineResult.evidence.masterRegions` — the same
 * evidence the inherited-verdict design was built to use. When the step being
 * rendered never segmented a suitable region, there is simply no detail, and
 * verification is exactly what it is today. A silent partial is the honest
 * failure here: sending nothing loses nothing, and buying a segmentation on the
 * paid path to gain a lens would put ten seconds and a new failure mode on
 * every render, which is a decision rather than an implementation detail.
 *
 * # Why the box comes from the MASTER and is applied to the RENDER
 *
 * Every render is anchored on the original candidate at the same pose and size
 * (D-86), so the master's face sits where the render's face sits. Deriving the
 * box from the master rather than from each frame also keeps it identical
 * across a chain — the population law, applied to a crop: a lens that moves
 * between two frames cannot be used to compare them.
 */
import sharp from "sharp";

import type { Mask } from "./maskedComposite";
import { regionNameOf } from "./maskedRefine";
import type { Facet } from "./refineFacets";
import { facetOfSubject } from "./refineFacets";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("castingV2/verificationDetail");

/**
 * FACETS WHOSE EVIDENCE IS FINER THAN A PORTRAIT CAN CARRY.
 *
 * A targeted list with a measured entry bar, the same shape and for the same
 * reason as `UNRELIABLE_FACETS` in `renderVerification`: every entry costs
 * every render of that facet a larger reading, so a hunch is not enough.
 *
 * Seeded with the one facet that has been measured:
 *
 *   - `marks` — freckles, moles and beauty spots. Court above: portrait 6/8
 *     unanimous, enlarged 8/8, on a bench containing three clear-skin cases
 *     that stayed unanimously absent at every lens.
 *
 * Candidates NOT added, because nobody has measured them: `skinCharacter`,
 * `lashes`, `teeth`, `ink`. Each is plausibly small enough to qualify and each
 * needs its own sitting in the court first.
 */
const FINE_DETAIL_FACETS: ReadonlySet<Facet> = new Set<Facet>([facetOfSubject("marks")]);

/** Test seam: a list the suite can read is a list the suite can hold to. */
export function facetsNeedingMagnification(): Facet[] {
  return Array.from(FINE_DETAIL_FACETS);
}

export function needsMagnification(facets: ReadonlyArray<Facet>): boolean {
  return facets.some((facet) => FINE_DETAIL_FACETS.has(facet));
}

/**
 * The region names worth cropping to, for the facets in play.
 *
 * Derived from `REGION_OF_FACET` rather than listed again — a second list
 * shadowing a source of truth always drifts from it.
 */
export function detailRegionNames(facets: ReadonlyArray<Facet>): string[] {
  const names = new Set<string>();
  for (const facet of facets) {
    if (!FINE_DETAIL_FACETS.has(facet)) continue;
    const region = regionNameOf(facet);
    if (region) names.add(region);
  }
  return Array.from(names);
}

export type Box = { left: number; top: number; width: number; height: number };

/**
 * The tightest box containing the mask, padded, and clamped to the frame.
 *
 * `null` when the mask is empty — an absent region is not a zero-sized crop,
 * and a caller that receives `null` sends no detail rather than a 1×1 image of
 * her cheekbone.
 */
export function boxOfMask(mask: Mask, padFraction = 0.04): Box | null {
  let minX = mask.width;
  let maxX = -1;
  let minY = mask.height;
  let maxY = -1;
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (mask.data[y * mask.width + x] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) return null;
  const pad = Math.round((maxX - minX + 1) * padFraction);
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  return {
    left,
    top,
    width: Math.min(mask.width - left, maxX - minX + 1 + pad * 2),
    height: Math.min(mask.height - top, maxY - minY + 1 + pad * 2),
  };
}

/** The reader's own ceiling; past it the enlargement buys nothing but tokens. */
const MAX_DETAIL_WIDTH = 2048;
/** Below this the crop is not a face and the box is not to be trusted. */
const MIN_DETAIL_WIDTH = 64;

/**
 * Crop the rendered frame to the box and enlarge it.
 *
 * **Nearest-neighbour, deliberately.** A smooth resampler would hand the reader
 * plausible pigment the render does not contain, which is the fidelity law's
 * failure mode aimed straight at an instrument: the magnifier would start
 * manufacturing the very thing it was added to detect.
 *
 * Returns `null` on anything unexpected rather than throwing. A detail is an
 * improvement to a reading, never a precondition for one — a verification that
 * refuses because a crop failed would turn a nice-to-have into an outage.
 */
export async function magnifiedDetail(input: {
  bytes: Buffer;
  box: Box;
  scale?: number;
}): Promise<{ bytes: Buffer; contentType: string } | null> {
  const { box } = input;
  if (box.width < MIN_DETAIL_WIDTH || box.height < MIN_DETAIL_WIDTH) return null;
  try {
    const cropped = sharp(input.bytes).extract(box);
    const target = Math.min(MAX_DETAIL_WIDTH, Math.round(box.width * (input.scale ?? 2)));
    if (target <= box.width) return null;
    const bytes = await cropped.resize({ width: target, kernel: "nearest" }).png().toBuffer();
    return { bytes, contentType: "image/png" };
  } catch (error) {
    log.warn({ error: String(error).slice(0, 120) }, "[verificationDetail] no detail — reading the frame alone");
    return null;
  }
}

/**
 * The whole decision, in one place: do these facts need magnifying, is a region
 * available for free, and if so what does the reader get.
 *
 * `answers` is the crop's own franchise, and it is narrow on purpose — only the
 * magnified facets whose region is the one this crop was actually cut from. A
 * crop of her cheeks must not be allowed to answer a question about her hair
 * just because it happened to be in the call.
 */
export async function detailForVerification(input: {
  bytes: Buffer;
  facets: ReadonlyArray<Facet>;
  masterRegions: ReadonlyMap<string, Mask> | null | undefined;
}): Promise<{ bytes: Buffer; contentType: string; answers: Facet[] } | null> {
  if (!input.masterRegions || !needsMagnification(input.facets)) return null;
  for (const name of detailRegionNames(input.facets)) {
    const mask = input.masterRegions.get(name);
    if (!mask) continue;
    const box = boxOfMask(mask);
    if (!box) continue;
    const detail = await magnifiedDetail({ bytes: input.bytes, box });
    if (!detail) continue;
    const answers = input.facets.filter((facet) =>
      FINE_DETAIL_FACETS.has(facet) && regionNameOf(facet) === name);
    return { ...detail, answers };
  }
  return null;
}
