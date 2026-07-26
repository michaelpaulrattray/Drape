import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  EVIDENCE_CANONICAL_MIME,
  EVIDENCE_IMAGE_PUBLIC_MESSAGE,
  EvidenceImageValidationError,
  MAX_EVIDENCE_CANONICAL_BYTES,
  MAX_EVIDENCE_DATA_URL_LENGTH,
  MAX_EVIDENCE_INPUT_BYTES,
  canonicalizeEvidenceDataUrl,
  canonicalizeEvidenceImage,
} from "./imageValidation";

async function image(
  format: "jpeg" | "png" | "webp",
  width = 320,
  height = 480,
): Promise<Buffer> {
  const pipeline = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 80, g: 120, b: 160 },
    },
  });
  if (format === "jpeg") return pipeline.jpeg({ quality: 90 }).toBuffer();
  if (format === "png") return pipeline.png().toBuffer();
  return pipeline.webp({ lossless: true }).toBuffer();
}

function dataUrl(mime: string, bytes: Buffer): string {
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

async function expectCode(
  promise: Promise<unknown>,
  code: EvidenceImageValidationError["code"],
): Promise<void> {
  await expect(promise).rejects.toMatchObject({
    name: "EvidenceImageValidationError",
    code,
    message: EVIDENCE_IMAGE_PUBLIC_MESSAGE,
  });
}

describe("R7-7C2 evidence image canonicalization", () => {
  it.each([
    ["jpeg", "image/jpeg"],
    ["png", "image/png"],
    ["webp", "image/webp"],
  ] as const)("accepts one still %s image and emits only canonical WebP", async (format, mime) => {
    const result = await canonicalizeEvidenceDataUrl(
      dataUrl(mime, await image(format)),
    );
    const metadata = await sharp(result.bytes).metadata();
    expect(result).toMatchObject({
      mime: EVIDENCE_CANONICAL_MIME,
      width: 320,
      height: 480,
      byteSize: result.bytes.length,
      contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(metadata).toMatchObject({ format: "webp", width: 320, height: 480 });
    expect(metadata.pages ?? 1).toBe(1);
  });

  it("is byte/hash deterministic for the same source", async () => {
    const source = await image("png", 512, 512);
    const [first, second] = await Promise.all([
      canonicalizeEvidenceImage({ bytes: source, declaredMime: "image/png" }),
      canonicalizeEvidenceImage({ bytes: source, declaredMime: "image/png" }),
    ]);
    expect(first.bytes.equals(second.bytes)).toBe(true);
    expect(first.contentHash).toBe(second.contentHash);
  });

  it("auto-rotates EXIF orientation and strips metadata from the canonical object", async () => {
    const source = await sharp({
      create: {
        width: 300,
        height: 500,
        channels: 3,
        background: { r: 20, g: 40, b: 60 },
      },
    })
      .withMetadata({ orientation: 6, comment: "PRIVATE_EXIF_MARKER" })
      .jpeg()
      .toBuffer();
    const result = await canonicalizeEvidenceImage({
      bytes: source,
      declaredMime: "image/jpeg",
    });
    const metadata = await sharp(result.bytes).metadata();
    expect(result).toMatchObject({ width: 500, height: 300 });
    expect(metadata.orientation).toBeUndefined();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    expect(result.bytes.includes(Buffer.from("PRIVATE_EXIF_MARKER"))).toBe(false);
  });

  it("refuses malformed data URLs, junk base64, empty input and encoded oversize before decode", async () => {
    await expectCode(canonicalizeEvidenceDataUrl("not-a-data-url"), "invalid_data_url");
    await expectCode(
      canonicalizeEvidenceDataUrl("data:image/png;base64,AAAA$==="),
      "invalid_data_url",
    );
    await expectCode(
      canonicalizeEvidenceDataUrl("data:image/png;base64,"),
      "invalid_data_url",
    );
    expect(MAX_EVIDENCE_DATA_URL_LENGTH).toBeLessThan(15 * 1024 * 1024);
    await expectCode(
      canonicalizeEvidenceDataUrl(
        `data:image/png;base64,${"A".repeat(MAX_EVIDENCE_DATA_URL_LENGTH)}`,
      ),
      "encoded_too_large",
    );
  });

  it("refuses decoded oversize before inspecting image contents", async () => {
    await expectCode(canonicalizeEvidenceImage({
      bytes: Buffer.alloc(MAX_EVIDENCE_INPUT_BYTES + 1),
      declaredMime: "image/png",
    }), "decoded_too_large");
  });

  it("refuses MIME/magic disagreement and unsupported GIF/SVG/PDF payloads", async () => {
    const jpeg = await image("jpeg");
    await expectCode(
      canonicalizeEvidenceDataUrl(dataUrl("image/png", jpeg)),
      "mime_mismatch",
    );
    const gif = await sharp({
      create: {
        width: 320,
        height: 320,
        channels: 3,
        background: "red",
      },
    }).gif().toBuffer();
    await expectCode(
      canonicalizeEvidenceDataUrl(dataUrl("image/gif", gif)),
      "invalid_data_url",
    );
    await expectCode(
      canonicalizeEvidenceDataUrl(dataUrl("image/png", Buffer.from("<svg/>"))),
      "unsupported_format",
    );
    await expectCode(
      canonicalizeEvidenceDataUrl(dataUrl("image/png", Buffer.from("%PDF-1.7"))),
      "unsupported_format",
    );
  });

  it("refuses real multi-frame WebP and PNG animation declarations", async () => {
    const width = 256;
    const pageHeight = 256;
    const twoPages = Buffer.alloc(width * pageHeight * 4 * 2);
    twoPages.fill(255, 0, width * pageHeight * 4);
    twoPages.fill(127, width * pageHeight * 4);
    const animatedWebp = await sharp(twoPages, {
      raw: {
        width,
        height: pageHeight * 2,
        channels: 4,
        pageHeight,
      },
      animated: true,
    }).webp({ lossless: true, loop: 0, delay: [100, 100] }).toBuffer();
    expect((await sharp(animatedWebp, { animated: true }).metadata()).pages).toBe(2);
    await expectCode(canonicalizeEvidenceImage({
      bytes: animatedWebp,
      declaredMime: "image/webp",
    }), "animated_image");

    const stillPng = await image("png", width, pageHeight);
    const animationControl = Buffer.alloc(20);
    animationControl.writeUInt32BE(8, 0);
    animationControl.write("acTL", 4, "ascii");
    animationControl.writeUInt32BE(2, 8);
    animationControl.writeUInt32BE(0, 12);
    const ihdrEnd = 8 + 12 + stillPng.readUInt32BE(8);
    const pngDeclaringAnimation = Buffer.concat([
      stillPng.subarray(0, ihdrEnd),
      animationControl,
      stillPng.subarray(ihdrEnd),
    ]);
    await expectCode(canonicalizeEvidenceImage({
      bytes: pngDeclaringAnimation,
      declaredMime: "image/png",
    }), "animated_image");
  });

  it("refuses truncated decoder input with the same closed public copy", async () => {
    const jpeg = await image("jpeg");
    await expectCode(canonicalizeEvidenceImage({
      bytes: jpeg.subarray(0, 32),
      declaredMime: "image/jpeg",
    }), "decode_failed");
  });

  it("refuses too-small, too-large and over-40MP dimensions", async () => {
    await expectCode(canonicalizeEvidenceImage({
      bytes: await image("png", 255, 256),
      declaredMime: "image/png",
    }), "invalid_dimensions");
    await expectCode(canonicalizeEvidenceImage({
      bytes: await image("png", 8193, 256),
      declaredMime: "image/png",
    }), "invalid_dimensions");
    await expectCode(canonicalizeEvidenceImage({
      bytes: await image("png", 7000, 6000),
      declaredMime: "image/png",
    }), "decode_failed");
  }, 30_000);

  it("refuses a small compressed input whose lossless canonical output amplifies past 10 MiB", async () => {
    const width = 2100;
    const height = 2100;
    const noisyJpeg = await sharp(randomBytes(width * height * 3), {
      raw: { width, height, channels: 3 },
    }).jpeg({ quality: 55 }).toBuffer();
    expect(noisyJpeg.length).toBeLessThan(MAX_EVIDENCE_INPUT_BYTES);
    await expectCode(canonicalizeEvidenceImage({
      bytes: noisyJpeg,
      declaredMime: "image/jpeg",
    }), "canonical_too_large");
  }, 30_000);

  it("never exposes decoder details in validation errors", async () => {
    const error = await canonicalizeEvidenceImage({
      bytes: Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00]),
      declaredMime: "image/jpeg",
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(EvidenceImageValidationError);
    expect(String(error)).toBe(`EvidenceImageValidationError: ${EVIDENCE_IMAGE_PUBLIC_MESSAGE}`);
    expect(JSON.stringify(error)).not.toMatch(/sharp|vips|jpeg|buffer|0xff/i);
    expect(MAX_EVIDENCE_CANONICAL_BYTES).toBe(10 * 1024 * 1024);
  });
});
