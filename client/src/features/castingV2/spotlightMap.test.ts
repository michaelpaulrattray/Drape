import { inflateSync } from "node:zlib";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

/* The SERVER's real encoder — the positive control is its bytes, never a
   fixture this suite wrote to agree with the decoder under test. */
import {
  encodeSpotlightMap,
  spotlightMapOf,
} from "../../../../server/castingV2/referenceSpotlightMap";
import type { Mask } from "../../../../server/castingV2/maskedComposite";

import {
  SPOTLIGHT_NOTHING,
  bytesOfBase64,
  decodeSpotlightMap,
  framePoint,
  litPixels,
  mapFitsPicture,
  pieceAt,
} from "./spotlightMap";

/** A disjoint set of pieces on a frame, the shape `cleanSplit` hands the encoder. */
function piecesOn(width: number, height: number, owner: (x: number, y: number) => number, count: number): Mask[] {
  const masks: Mask[] = Array.from({ length: count }, () => ({
    width,
    height,
    data: Buffer.alloc(width * height),
  }));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const id = owner(x, y);
      if (id > 0) masks[id - 1]!.data[y * width + x] = 255;
    }
  }
  return masks;
}

/** Which scanline filters a greyscale PNG's rows were written with — read with node's own zlib. */
function filtersIn(png: Buffer, width: number, height: number): Set<number> {
  const parts: Buffer[] = [];
  let at = 8;
  while (at < png.length) {
    const length = png.readUInt32BE(at);
    if (png.toString("latin1", at + 4, at + 8) === "IDAT") parts.push(png.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(parts));
  const seen = new Set<number>();
  for (let y = 0; y < height; y += 1) seen.add(raw[y * (width + 1)]!);
  return seen;
}

/* A deterministic scramble, so the map has edges in every direction and the
   encoder's adaptive filtering is driven through more than one filter. */
function scramble(x: number, y: number, count: number): number {
  const blob = Math.floor(Math.sin(x * 0.091) * 3 + Math.cos(y * 0.067) * 3 + (x * y) % 7);
  const id = ((blob % (count + 1)) + (count + 1)) % (count + 1);
  return (x + 3 * y) % 13 === 0 ? 0 : id;
}

describe("the spotlight map decodes exactly what the server encoded", () => {
  it("round-trips the server's real encoder byte for byte, over a busy map", async () => {
    const width = 157;
    const height = 211;
    const count = 27;
    const pieces = piecesOn(width, height, (x, y) => scramble(x, y, count), count);
    const indexMap = spotlightMapOf(pieces);
    const encoded = await encodeSpotlightMap(indexMap);

    const decoded = await decodeSpotlightMap(new Uint8Array(encoded.bytes));

    expect(decoded.width).toBe(width);
    expect(decoded.height).toBe(height);
    expect(Buffer.from(decoded.indices).equals(indexMap.indices)).toBe(true);
  });

  it("round-trips a map of plain rectangles too — the cut's own one-piece shape", async () => {
    const width = 90;
    const height = 64;
    const pieces = piecesOn(width, height, (x, y) => (x > 20 && x < 70 && y > 10 && y < 50 ? 1 : 0), 1);
    const indexMap = spotlightMapOf(pieces);
    const encoded = await encodeSpotlightMap(indexMap);
    const decoded = await decodeSpotlightMap(bytesOfBase64(encoded.bytes.toString("base64")));
    expect(Buffer.from(decoded.indices).equals(indexMap.indices)).toBe(true);
  });

  /*
    ⚠ THE ARM ABOVE CANNOT SEE FOUR OF THE FIVE FILTERS, AND THAT WAS MEASURED.
    The server's encoder leaves sharp's `adaptiveFiltering` at its default,
    which is off, so every row it writes is filter 0 — sabotaging Sub, Up,
    Average or Paeth in the decoder left that arm green. A decoder that is only
    right for the encoder's CURRENT settings is one option change from lighting
    the wrong piece. So the same map is encoded again with adaptive filtering on
    — sharp's own choice of filters, not ones this suite picked — and the arm
    first proves the stream really carries all four, then that it decodes.
  */
  it("decodes all five scanline filters, proven present in the stream first", async () => {
    const width = 157;
    const height = 211;
    const count = 27;
    const indexMap = spotlightMapOf(piecesOn(width, height, (x, y) => scramble(x, y, count), count));
    const png = await sharp(indexMap.indices, { raw: { width, height, channels: 1 } })
      .toColourspace("b-w")
      .png({ compressionLevel: 9, effort: 10, palette: false, adaptiveFiltering: true })
      .toBuffer();

    const used = filtersIn(png, width, height);
    expect([1, 2, 3, 4].every((filter) => used.has(filter)), `filters seen: ${[...used].join(",")}`).toBe(true);

    const decoded = await decodeSpotlightMap(new Uint8Array(png));
    expect(Buffer.from(decoded.indices).equals(indexMap.indices)).toBe(true);
  });

  it("refuses a PALETTE png rather than reading its table indices as piece ids", async () => {
    const raw = Buffer.alloc(16 * 16, 3);
    const paletted = await sharp(raw, { raw: { width: 16, height: 16, channels: 1 } })
      .png({ palette: true })
      .toBuffer();
    await expect(decodeSpotlightMap(new Uint8Array(paletted))).rejects.toThrow(/greyscale/);
  });

  it("refuses a truecolour png", async () => {
    const rgb = await sharp(Buffer.alloc(8 * 8 * 3, 9), { raw: { width: 8, height: 8, channels: 3 } })
      .png({ palette: false })
      .toBuffer();
    await expect(decodeSpotlightMap(new Uint8Array(rgb))).rejects.toThrow(/greyscale/);
  });

  it("refuses bytes that are not a png at all", async () => {
    await expect(decodeSpotlightMap(new TextEncoder().encode("not a picture"))).rejects.toThrow(/not a PNG/);
  });
});

describe("the hit-test", () => {
  const map = {
    width: 4,
    height: 2,
    indices: Uint8Array.from([
      0, 1, 1, 2,
      3, 3, 0, 2,
    ]),
  };

  it("maps a pointer on the drawn picture to the frame's own pixel, at any drawn size", () => {
    /* The frame is 4x2 and is drawn at 400x200 from (100, 50). */
    const box = { left: 100, top: 50, width: 400, height: 200 };
    expect(framePoint({ clientX: 100, clientY: 50 }, box, map)).toEqual({ x: 0, y: 0 });
    expect(framePoint({ clientX: 499, clientY: 249 }, box, map)).toEqual({ x: 3, y: 1 });
    expect(framePoint({ clientX: 260, clientY: 120 }, box, map)).toEqual({ x: 1, y: 0 });
  });

  it("answers nothing off the picture", () => {
    const box = { left: 100, top: 50, width: 400, height: 200 };
    expect(framePoint({ clientX: 99, clientY: 60 }, box, map)).toBeNull();
    expect(framePoint({ clientX: 500, clientY: 60 }, box, map)).toBeNull();
    expect(pieceAt(map, null)).toBe(SPOTLIGHT_NOTHING);
    expect(pieceAt(map, { x: 9, y: 0 })).toBe(SPOTLIGHT_NOTHING);
  });

  it("reads which piece owns a pixel", () => {
    expect(pieceAt(map, { x: 1, y: 0 })).toBe(1);
    expect(pieceAt(map, { x: 3, y: 1 })).toBe(2);
    expect(pieceAt(map, { x: 0, y: 1 })).toBe(3);
    expect(pieceAt(map, { x: 0, y: 0 })).toBe(SPOTLIGHT_NOTHING);
  });

  it("lights exactly the asked piece's pixels, and every layer's", () => {
    const one = litPixels(map, [{ map, piece: 2 }]);
    const alpha = Array.from({ length: 8 }, (_, at) => one[at * 4 + 3]);
    expect(alpha).toEqual([0, 0, 0, 255, 0, 0, 0, 255]);

    const two = litPixels(map, [{ map, piece: 1 }, { map, piece: 3 }]);
    expect(Array.from({ length: 8 }, (_, at) => two[at * 4 + 3])).toEqual([0, 255, 255, 0, 255, 255, 0, 0]);

    /* Nothing asked, nothing lit. */
    expect(litPixels(map, [{ map, piece: SPOTLIGHT_NOTHING }]).some((value) => value !== 0)).toBe(false);
  });
});

describe("a map lights only the picture it describes", () => {
  it("accepts the same shape at a different scale", () => {
    expect(mapFitsPicture({ width: 768, height: 1024 }, { width: 1536, height: 2048 })).toBe(true);
    expect(mapFitsPicture({ width: 1024, height: 1536 }, { width: 1024, height: 1536 })).toBe(true);
  });

  it("refuses a turned picture — the map would light the wrong place", () => {
    expect(mapFitsPicture({ width: 1024, height: 1536 }, { width: 1536, height: 1024 })).toBe(false);
  });

  it("refuses a picture that never decoded", () => {
    expect(mapFitsPicture({ width: 1024, height: 1536 }, { width: 0, height: 0 })).toBe(false);
  });
});
