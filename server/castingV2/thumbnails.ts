/**
 * A SMALL PICTURE BESIDE EVERY DELIVERED FRAME (fable-503, approved).
 *
 * # What was measured
 *
 * `thumbKey` has existed on `casting_candidates` and `casting_candidate_variants`
 * since the roll domain landed, and **nothing has ever written one**: 0 of 60
 * variants and 1 of 33 candidates in dev. Every projection falls back to the
 * full frame, so a version rail draws eight 90-pixel chips by downloading eight
 * ~2.6 MB PNGs — and the viewer's own switch is only instant because the rail
 * paid for the full picture already (opus-379).
 *
 * On a cold or slow link that is the whole cost of looking at a sheet, and it
 * is the reason fable-501's thumb-first swap could not be built as specified:
 * there was no smaller asset to show.
 *
 * # What a thumbnail is here
 *
 * The longest side at {@link THUMB_MAX_SIDE}, WebP, quality 82 — about 20 KB
 * against 2.6 MB. Large enough for a 90 px chip at 2× and for the viewer to
 * show while the full frame decodes; small enough that eight of them are a
 * rounding error.
 *
 * # What it is NOT
 *
 * It is not a second source of truth about her face. Nothing reads a thumbnail
 * to decide anything — no scan, no mint, no measurement, no recipe. It is a
 * display asset, and every consumer keeps `thumbKey ?? imageKey` so a row
 * without one is exactly what it was.
 *
 * And it never fails a delivery. A picture the customer paid for does not
 * become an error because its thumbnail could not be encoded, so every failure
 * here is swallowed to `null` and the row lands without one.
 */
import { randomUUID } from "node:crypto";

import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("castingV2/thumbnails");

/** The longest side of a delivered frame's thumbnail. */
export const THUMB_MAX_SIDE = 320;

/** WebP at this quality is ~20 KB for a 320 px face and visually clean. */
export const THUMB_QUALITY = 82;

export type Thumbnail = { bytes: Buffer; contentType: string; key: string };

/**
 * The key a thumbnail is written to.
 *
 * Its own UUID rather than a name derived from the frame's: the frame's key is
 * the only thing protecting a public-bucket object of a person's face, and a
 * derived name would make one guessable from the other. (The repo-wide storage
 * guard rejects the weak random source by name; this uses the cryptographic
 * one, like every other writer here.)
 */
export function thumbnailKey(prefix: string): string {
  return `${prefix}/${randomUUID()}.webp`;
}

/**
 * Shrink a delivered frame, or answer null.
 *
 * `sharp` is imported lazily for the same reason the rest of this tree does it:
 * a native module loaded at import time is a cost every process pays, including
 * the ones that never touch an image.
 */
export async function thumbnailOf(input: {
  bytes: Buffer;
  /** The storage prefix the thumbnail belongs beside. */
  prefix: string;
}): Promise<Thumbnail | null> {
  try {
    const sharp = (await import("sharp")).default;
    const bytes = await sharp(input.bytes)
      .resize({
        width: THUMB_MAX_SIDE,
        height: THUMB_MAX_SIDE,
        fit: "inside",
        /* Never upscale: a frame smaller than the box is already its own
           thumbnail, and enlarging it would cost bytes to lose sharpness. */
        withoutEnlargement: true,
      })
      .webp({ quality: THUMB_QUALITY })
      .toBuffer();
    return { bytes, contentType: "image/webp", key: thumbnailKey(input.prefix) };
  } catch (error) {
    /* A delivery is never failed by its thumbnail. */
    log.warn(
      { err: error instanceof Error ? error.message.slice(0, 120) : String(error) },
      "[thumbnails] a delivered frame could not be shrunk — it lands without one",
    );
    return null;
  }
}
