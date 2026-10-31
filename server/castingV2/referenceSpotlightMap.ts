/**
 * THE SPOTLIGHT'S HIT-TEST MAP — #14 slice 3a-2, the shape the geometry travels in.
 *
 * §0 of `docs/specs/REFERENCE_SELECTOR_BUILD_DESIGN_2026-10-28.md` says the
 * hover "is then a hit-test in the browser and costs nothing". That sentence
 * has a transport hiding inside it: the browser must be able to answer *which
 * piece is under this pixel* for up to `SPLIT_MAX_MASKS` (32) pieces of one
 * photograph, without asking the server again.
 *
 * A `Mask` is one byte per pixel at the frame's own size, so the obvious shape
 * — hand the pieces over — is 25 MB on a 768x1024 frame. This module is the
 * shape that is not that: **one byte per pixel for the whole set**, holding
 * WHICH piece owns that pixel, as a greyscale PNG.
 *
 * ## Why one byte can say it at all
 *
 * Because `cleanSplit` has already arbitrated. Its rule 2 gives every contested
 * pixel to the single piece it sits deepest inside and ZEROES it in all the
 * others, so **the pieces it returns are pairwise disjoint** — which is what
 * makes an index map lossless rather than a summary. That is an invariant of
 * the upstream function, not a hope about it, so this module ASSERTS it
 * (`spotlightMapOf` throws on a second claim) instead of resolving a collision
 * silently. A silent resolution here would be a lit shape that disagrees with
 * the cut the tap takes, which is the fidelity law's exact failure.
 *
 * ## Why greyscale, measured rather than preferred
 *
 * Driven on the spotlight court's own saved split output, three encodings of
 * the same real index map (`_14-spotlight-map-size-disposable.mts`):
 *
 * | encoding | bytes | the byte that comes back |
 * |---|---|---|
 * | **greyscale, colour type 0** | **16.8 KB** | **the id itself, by the format's definition** |
 * | paletted, colour type 3 | 17.0 KB | `PLTE[id]` — an index through a table sharp builds |
 * | truecolour, colour type 2 | 22.1 KB | the id, replicated into R, G and B |
 * | run-length (value + uint32) | 42.7 KB | the id |
 *
 * **Greyscale is both the smallest and the only one exact by definition, so
 * there is no tradeoff to declare here.** The one that had to be ruled out
 * carefully is the PALETTE, and it is sharp's default: at colour type 3 the
 * stored byte is an index into a table sharp composes from the values present,
 * so "the decoded red channel equals the piece id" would be a claim about a
 * library's optimiser rather than about the PNG format. It round-trips today.
 * **A permuted palette would mislight pieces in a way that reads exactly like a
 * geometry bug**, so `palette: false` is load-bearing and
 * `referenceSpotlightMap.test.ts` asserts the colour type on the emitted bytes.
 *
 * Run-length was the other candidate and it is 2.5x the bytes for the same
 * exactness; it is named here because it is the fallback if a browser ever
 * turns out to hand back colour-managed pixels (no `gAMA`, `iCCP` or `sRGB`
 * chunk is emitted, so none should), and that verification belongs to the
 * surface slice that reads the map.
 *
 * ## What this module does NOT decide
 *
 * Where the map is stored, or whether it is stored at all. It returns bytes;
 * the caller puts them on its own response. §6 keeps a customer's picture at
 * owner-only addresses, and minting a new address for derived geometry would be
 * a new enumerated route — a deliberate decision, not a side effect of an
 * encoder.
 */

import sharp from "sharp";
import type { Mask } from "./maskedComposite";

/** No piece owns this pixel. The frame's own background, and the gaps. */
export const SPOTLIGHT_MAP_NOTHING = 0;

/**
 * How many pieces one map can name.
 *
 * 255 rather than `SPLIT_MAX_MASKS` on purpose: this is the BYTE's limit, which
 * is the limit this encoding actually has, and tying it to the split's cap
 * would make a change to that cap silently change what this module refuses.
 * The split's cap is 32 and the clean-up only ever removes pieces, so the two
 * are nowhere near each other — which is the point.
 */
export const SPOTLIGHT_MAP_MAX_PIECES = 255;

export type SpotlightIndexMap = {
  /**
   * One byte per pixel, row-major: `SPOTLIGHT_MAP_NOTHING` for nothing, and
   * otherwise a 1-based index into the pieces that built it.
   */
  indices: Buffer;
  width: number;
  height: number;
  /** How many pieces are named in it. */
  pieces: number;
};

export type SpotlightMapImage = {
  bytes: Buffer;
  contentType: "image/png";
  width: number;
  height: number;
  pieces: number;
};

/**
 * THE INDEX MAP, WITH THE DISJOINTNESS ASSERTED.
 *
 * Throws rather than resolving when two pieces claim one pixel, and throws when
 * the pieces are not all the frame's size — the same rule `cleanSplit` applies
 * one road up, for the same reason: a mismatch is a bug upstream, and
 * resampling it would answer about a different picture.
 */
export function spotlightMapOf(pieces: readonly Mask[]): SpotlightIndexMap {
  if (pieces.length > SPOTLIGHT_MAP_MAX_PIECES) {
    throw new Error(
      `a spotlight map can name ${SPOTLIGHT_MAP_MAX_PIECES} pieces and was given ${pieces.length}`,
    );
  }
  const first = pieces[0];
  if (first === undefined) return { indices: Buffer.alloc(0), width: 0, height: 0, pieces: 0 };
  const { width, height } = first;
  for (const piece of pieces) {
    if (piece.width !== width || piece.height !== height) {
      throw new Error(
        `a spotlight map's pieces must all be the frame's size — got ${piece.width}x${piece.height} beside ${width}x${height}`,
      );
    }
  }
  const size = width * height;
  const indices = Buffer.alloc(size);
  pieces.forEach((piece, at) => {
    const id = at + 1;
    for (let p = 0; p < size; p += 1) {
      if (piece.data[p]! <= 127) continue;
      if (indices[p] !== SPOTLIGHT_MAP_NOTHING) {
        throw new Error(
          `pixel ${p} is claimed by piece ${indices[p]} and by piece ${id} — the split is not disjoint`,
        );
      }
      indices[p] = id;
    }
  });
  return { indices, width, height, pieces: pieces.length };
}

/**
 * THE MAP AS BYTES A BROWSER CAN READ ONE PIXEL OF.
 *
 * `toColourspace("b-w")` with `palette: false` is what pins colour type 0, and
 * both halves are needed: without the colourspace sharp widens a 1-channel raw
 * buffer to truecolour, and without `palette: false` it optimises back down to
 * a palette. See the header's table.
 */
export async function encodeSpotlightMap(map: SpotlightIndexMap): Promise<SpotlightMapImage> {
  if (map.width <= 0 || map.height <= 0 || map.indices.length === 0) {
    throw new Error("a spotlight map with no frame cannot be encoded");
  }
  if (map.indices.length !== map.width * map.height) {
    throw new Error(
      `the map is ${map.indices.length} bytes for a ${map.width}x${map.height} frame`,
    );
  }
  const bytes = await sharp(map.indices, {
    raw: { width: map.width, height: map.height, channels: 1 },
  })
    .toColourspace("b-w")
    .png({ compressionLevel: 9, effort: 10, palette: false })
    .toBuffer();
  return { bytes, contentType: "image/png", width: map.width, height: map.height, pieces: map.pieces };
}
