/**
 * THE SPOTLIGHT'S HIT-TEST MAP, DRIVEN — #14 slice 3a-2.
 *
 * Two things here are not ordinary unit arms and are the reason the file
 * exists:
 *
 * 1. **The disjointness assertion gets a positive control.** The whole claim
 *    that one byte per pixel can say which piece owns it rests on `cleanSplit`
 *    leaving its pieces pairwise disjoint. An encoder that silently let a
 *    second claim win would produce a lit shape that disagrees with the cut a
 *    tap takes, and nothing downstream would ever disagree with it. So the
 *    throw is driven, not trusted.
 *
 * 2. **The PNG's COLOUR TYPE is asserted on the emitted bytes, not on the
 *    options passed in.** This is invariant 5's habit pointed at an encoder:
 *    `palette: false` is a request, and what matters is the byte in the IHDR
 *    that comes out. At colour type 3 the stored value is an index into a
 *    palette sharp composes, so "the decoded value is the piece id" would be a
 *    claim about a library's optimiser; at colour type 0 it is the format's own
 *    definition. Measured, the paletted form round-trips today — which is
 *    exactly why a test that only round-tripped would pass on the wrong bytes
 *    and let a future sharp upgrade permute piece ids silently.
 */

import { describe, expect, it } from "vitest";
import sharp from "sharp";

import type { Mask } from "./maskedComposite";
import {
  SPOTLIGHT_MAP_MAX_PIECES,
  SPOTLIGHT_MAP_NOTHING,
  encodeSpotlightMap,
  spotlightMapOf,
} from "./referenceSpotlightMap";

const W = 8;
const H = 4;

function maskWhere(on: (x: number, y: number) => boolean, width = W, height = H): Mask {
  const data = Buffer.alloc(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) data[y * width + x] = on(x, y) ? 255 : 0;
  }
  return { data, width, height };
}

/** The PNG's chunk types, in order, read off the bytes themselves. */
function chunksOf(png: Buffer): string[] {
  const out: string[] = [];
  let at = 8;
  while (at < png.length) {
    const length = png.readUInt32BE(at);
    const type = png.toString("ascii", at + 4, at + 8);
    out.push(type);
    at += 12 + length;
    if (type === "IEND") break;
  }
  return out;
}

/** IHDR's colour-type byte: 0 greyscale, 2 truecolour, 3 palette. */
function colourTypeOf(png: Buffer): number {
  return png[25]!;
}

describe("the index map", () => {
  it("names pieces from 1 and leaves everything else as nothing", () => {
    const left = maskWhere((x) => x < 2);
    const right = maskWhere((x) => x >= 6);
    const map = spotlightMapOf([left, right]);

    expect(map.pieces).toBe(2);
    expect(map.width).toBe(W);
    expect(map.height).toBe(H);
    expect(map.indices[0]).toBe(1);
    expect(map.indices[7]).toBe(2);
    /* The middle belongs to nobody, which is what makes a hover over it dark. */
    expect(map.indices[4]).toBe(SPOTLIGHT_MAP_NOTHING);
    expect(SPOTLIGHT_MAP_NOTHING).toBe(0);
  });

  it("thresholds the way every other road here does, at 127", () => {
    const faint: Mask = { data: Buffer.alloc(W * H, 127), width: W, height: H };
    const just: Mask = { data: Buffer.alloc(W * H, 128), width: W, height: H };

    expect(spotlightMapOf([faint]).indices.every((byte) => byte === 0)).toBe(true);
    expect(spotlightMapOf([just]).indices.every((byte) => byte === 1)).toBe(true);
  });

  /* ---- THE CONTROL THAT MATTERS ---- */
  it("REFUSES two pieces claiming one pixel rather than picking a winner", () => {
    const first = maskWhere((x) => x < 5);
    const overlapping = maskWhere((x) => x >= 4);

    expect(() => spotlightMapOf([first, overlapping])).toThrow(/not disjoint/);
  });

  it("names both claimants and the pixel, so a break is diagnosable", () => {
    const first = maskWhere((x, y) => x === 0 && y === 0);
    const second = maskWhere((x, y) => x === 0 && y === 0);

    expect(() => spotlightMapOf([first, second])).toThrow(/piece 1 and by piece 2/);
  });

  it("refuses pieces that are not all the frame's size rather than resampling", () => {
    const frame = maskWhere(() => true);
    const odd = maskWhere(() => true, W + 1, H);

    expect(() => spotlightMapOf([frame, odd])).toThrow(/must all be the frame's size/);
  });

  it("refuses more pieces than a byte can name", () => {
    const many = Array.from({ length: SPOTLIGHT_MAP_MAX_PIECES + 1 }, () => maskWhere(() => false));

    expect(() => spotlightMapOf(many)).toThrow(/can name 255 pieces/);
  });

  it("holds its own ceiling clear of the split's cap, so one cannot move the other", () => {
    /* The byte's limit, not `SPLIT_MAX_MASKS` — see the constant's docblock. */
    expect(SPOTLIGHT_MAP_MAX_PIECES).toBe(255);
  });

  it("answers an empty split with an empty map instead of throwing", () => {
    const map = spotlightMapOf([]);

    expect(map).toEqual({ indices: Buffer.alloc(0), width: 0, height: 0, pieces: 0 });
  });
});

describe("the map as bytes", () => {
  it("emits colour type 0 — the stored byte IS the piece id, by the format", async () => {
    const image = await encodeSpotlightMap(spotlightMapOf([maskWhere((x) => x < 3), maskWhere((x) => x >= 5)]));

    expect(colourTypeOf(image.bytes)).toBe(0);
    expect(image.contentType).toBe("image/png");
    expect(image.pieces).toBe(2);
  });

  it("carries NO palette, so no table can be permuted under the ids", async () => {
    const image = await encodeSpotlightMap(spotlightMapOf([maskWhere((x) => x < 3)]));

    expect(chunksOf(image.bytes)).not.toContain("PLTE");
  });

  it("carries no colour-management chunk, so nothing instructs a shift of the values", async () => {
    const image = await encodeSpotlightMap(spotlightMapOf([maskWhere((x) => x < 3)]));
    const chunks = chunksOf(image.bytes);

    for (const managed of ["gAMA", "iCCP", "sRGB", "cHRM"]) {
      expect(chunks).not.toContain(managed);
    }
  });

  it("round-trips every id exactly", async () => {
    const pieces = [
      maskWhere((x) => x < 2),
      maskWhere((x) => x >= 2 && x < 4),
      maskWhere((x) => x >= 4 && x < 6),
    ];
    const map = spotlightMapOf(pieces);
    const image = await encodeSpotlightMap(map);

    const back = await sharp(image.bytes).raw().toBuffer({ resolveWithObject: true });
    for (let p = 0; p < map.indices.length; p += 1) {
      expect(back.data[p * back.info.channels]).toBe(map.indices[p]);
    }
  });

  it("refuses a map with no frame rather than encoding nothing", async () => {
    await expect(encodeSpotlightMap({ indices: Buffer.alloc(0), width: 0, height: 0, pieces: 0 }))
      .rejects.toThrow(/no frame/);
  });

  it("refuses a map whose bytes do not match its own frame", async () => {
    await expect(encodeSpotlightMap({ indices: Buffer.alloc(10), width: W, height: H, pieces: 1 }))
      .rejects.toThrow(/10 bytes for a 8x4 frame/);
  });
});
