/**
 * THE SMALL COPY (fable-503) — and the three ways it could be worse than none.
 *
 * A thumbnail is a display asset on the paid render path, which is a dangerous
 * combination: it must never fail a delivery, never outlive its frame, and
 * never be assumed present by anything that draws. All three are driven here;
 * the mint's own numbers are in `thumbnails.ts`.
 */
import { describe, expect, it } from "vitest";
import sharp from "sharp";

import { THUMB_MAX_SIDE, thumbnailKey, thumbnailOf } from "./thumbnails";

const frame = async (width: number, height: number) => sharp({
  create: { width, height, channels: 3, background: { r: 180, g: 140, b: 120 } },
}).png().toBuffer();

describe("what it makes", () => {
  it("shrinks a delivered frame to the display size, in WebP", async () => {
    const thumb = await thumbnailOf({ bytes: await frame(1024, 1536), prefix: "casting-v2/candidates" });
    expect(thumb).not.toBeNull();
    const meta = await sharp(thumb!.bytes).metadata();
    expect(meta.format).toBe("webp");
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(THUMB_MAX_SIDE);
    /* The point of the exercise: the rail was downloading megabytes for a
       90-pixel chip. */
    expect(thumb!.bytes.length).toBeLessThan(60_000);
    expect(thumb!.contentType).toBe("image/webp");
  });

  it("never ENLARGES a frame that is already small", async () => {
    /* Upscaling would spend bytes to lose sharpness — a thumbnail bigger than
       its own source is a worse picture at a higher price. */
    const thumb = await thumbnailOf({ bytes: await frame(120, 160), prefix: "p" });
    const meta = await sharp(thumb!.bytes).metadata();
    expect(meta.width).toBe(120);
    expect(meta.height).toBe(160);
  });

  it("mints an unguessable key of its own, never one derived from the frame's", async () => {
    /*
      The frame's key is the only thing protecting a public-bucket picture of a
      person's face. A thumbnail named after it would make one guessable from
      the other, so the two are independent UUIDs.
    */
    const keys = new Set(Array.from({ length: 50 }, () => thumbnailKey("casting-v2/variants")));
    expect(keys.size).toBe(50);
    for (const key of keys) {
      expect(key).toMatch(/^casting-v2\/variants\/[0-9a-f-]{36}\.webp$/);
    }
  });

  it("ANSWERS NULL rather than throwing on bytes it cannot read", async () => {
    /* The whole posture: a picture she paid for does not become an error
       because its small copy could not be encoded. */
    const thumb = await thumbnailOf({ bytes: Buffer.from("not an image at all"), prefix: "p" });
    expect(thumb).toBeNull();
  });
});
