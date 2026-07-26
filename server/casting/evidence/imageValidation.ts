import { createHash } from "node:crypto";
import sharp from "sharp";
import { supportedImageMime } from "../../security/trustedImageFetch";

export const MAX_EVIDENCE_INPUT_BYTES = 10 * 1024 * 1024;
export const MAX_EVIDENCE_CANONICAL_BYTES = 10 * 1024 * 1024;
export const MAX_EVIDENCE_PIXELS = 40_000_000;
export const MIN_EVIDENCE_DIMENSION = 256;
export const MAX_EVIDENCE_DIMENSION = 8192;
export const EVIDENCE_CANONICAL_MIME = "image/webp" as const;

const ACCEPTED_DATA_URL_PREFIXES = [
  "data:image/jpeg;base64,",
  "data:image/png;base64,",
  "data:image/webp;base64,",
] as const;
const MAX_DATA_URL_PREFIX_LENGTH = Math.max(
  ...ACCEPTED_DATA_URL_PREFIXES.map((prefix) => prefix.length),
);
const MAX_BASE64_LENGTH = Math.ceil(MAX_EVIDENCE_INPUT_BYTES / 3) * 4;
export const MAX_EVIDENCE_DATA_URL_LENGTH =
  MAX_BASE64_LENGTH + MAX_DATA_URL_PREFIX_LENGTH;
export const EVIDENCE_IMAGE_PUBLIC_MESSAGE =
  "The reference image could not be accepted. Use one still JPEG, PNG, or WebP image between 256 and 8192 pixels.";

export type EvidenceImageValidationCode =
  | "invalid_data_url"
  | "encoded_too_large"
  | "invalid_base64"
  | "decoded_too_large"
  | "unsupported_format"
  | "mime_mismatch"
  | "invalid_dimensions"
  | "animated_image"
  | "canonical_too_large"
  | "decode_failed";

export class EvidenceImageValidationError extends Error {
  readonly code: EvidenceImageValidationCode;

  constructor(code: EvidenceImageValidationCode) {
    super(EVIDENCE_IMAGE_PUBLIC_MESSAGE);
    this.name = "EvidenceImageValidationError";
    this.code = code;
  }
}

export interface CanonicalEvidenceImage {
  bytes: Buffer;
  mime: typeof EVIDENCE_CANONICAL_MIME;
  width: number;
  height: number;
  byteSize: number;
  contentHash: string;
}

export type AcceptedEvidenceInputMime = "image/jpeg" | "image/png" | "image/webp";

function acceptedInputMime(value: string): value is AcceptedEvidenceInputMime {
  return value === "image/jpeg" || value === "image/png" || value === "image/webp";
}

function fail(code: EvidenceImageValidationCode): never {
  throw new EvidenceImageValidationError(code);
}

function assertDimensions(width: number | undefined, height: number | undefined): void {
  if (
    width === undefined
    || height === undefined
    || !Number.isSafeInteger(width)
    || !Number.isSafeInteger(height)
    || width < MIN_EVIDENCE_DIMENSION
    || height < MIN_EVIDENCE_DIMENSION
    || width > MAX_EVIDENCE_DIMENSION
    || height > MAX_EVIDENCE_DIMENSION
    || width * height > MAX_EVIDENCE_PIXELS
  ) {
    fail("invalid_dimensions");
  }
}

function strictDataUrl(input: string): {
  bytes: Buffer;
  declaredMime: AcceptedEvidenceInputMime;
} {
  if (input.length > MAX_EVIDENCE_DATA_URL_LENGTH) fail("encoded_too_large");
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(input);
  if (!match || !acceptedInputMime(match[1])) fail("invalid_data_url");
  const payload = match[2];
  if (payload.length % 4 !== 0 || payload.length > MAX_BASE64_LENGTH) {
    fail(payload.length > MAX_BASE64_LENGTH ? "encoded_too_large" : "invalid_base64");
  }
  const bytes = Buffer.from(payload, "base64");
  if (bytes.length === 0 || bytes.toString("base64") !== payload) fail("invalid_base64");
  if (bytes.length > MAX_EVIDENCE_INPUT_BYTES) fail("decoded_too_large");
  return { bytes, declaredMime: match[1] };
}

function mimeToSharpFormat(
  mime: AcceptedEvidenceInputMime,
): "jpeg" | "png" | "webp" {
  if (mime === "image/jpeg") return "jpeg";
  if (mime === "image/png") return "png";
  return "webp";
}

function pngDeclaresAnimation(bytes: Buffer): boolean {
  const pngSignatureLength = 8;
  let offset = pngSignatureLength;
  while (offset + 12 <= bytes.length) {
    const dataLength = bytes.readUInt32BE(offset);
    const chunkEnd = offset + 12 + dataLength;
    if (chunkEnd > bytes.length) return false;
    const chunkType = bytes.toString("ascii", offset + 4, offset + 8);
    if (chunkType === "acTL") return true;
    if (chunkType === "IEND") return false;
    offset = chunkEnd;
  }
  return false;
}

/**
 * Canonicalize already-server-owned bytes. This is deliberately free of
 * database, storage, route, logging, scope, provider, and credit concerns.
 */
export async function canonicalizeEvidenceImage(input: {
  bytes: Uint8Array;
  declaredMime: AcceptedEvidenceInputMime;
}): Promise<CanonicalEvidenceImage> {
  const source = Buffer.from(input.bytes);
  if (source.length === 0) fail("decode_failed");
  if (source.length > MAX_EVIDENCE_INPUT_BYTES) fail("decoded_too_large");

  const magicMime = supportedImageMime(source);
  if (!magicMime || !acceptedInputMime(magicMime)) fail("unsupported_format");
  if (magicMime !== input.declaredMime) fail("mime_mismatch");
  if (magicMime === "image/png" && pngDeclaresAnimation(source)) {
    fail("animated_image");
  }

  try {
    const decoder = sharp(source, {
      animated: true,
      failOn: "error",
      limitInputPixels: MAX_EVIDENCE_PIXELS,
    });
    const metadata = await decoder.metadata();
    if (metadata.format !== mimeToSharpFormat(input.declaredMime)) fail("mime_mismatch");
    if ((metadata.pages ?? 1) !== 1) fail("animated_image");
    assertDimensions(metadata.width, metadata.height);

    const canonical = await decoder
      .rotate()
      .webp({ lossless: true, effort: 2 })
      .toBuffer({ resolveWithObject: true });
    if (canonical.data.length > MAX_EVIDENCE_CANONICAL_BYTES) {
      fail("canonical_too_large");
    }
    assertDimensions(canonical.info.width, canonical.info.height);

    return {
      bytes: canonical.data,
      mime: EVIDENCE_CANONICAL_MIME,
      width: canonical.info.width,
      height: canonical.info.height,
      byteSize: canonical.data.length,
      contentHash: createHash("sha256").update(canonical.data).digest("hex"),
    };
  } catch (error) {
    if (error instanceof EvidenceImageValidationError) throw error;
    fail("decode_failed");
  }
}

/**
 * Re-prove the canonical DTO at the storage boundary. The type is useful for
 * callers, but runtime authority never rests on a structural TypeScript claim.
 */
export async function assertCanonicalEvidenceImage(
  image: CanonicalEvidenceImage,
): Promise<void> {
  if (image.mime !== EVIDENCE_CANONICAL_MIME) fail("mime_mismatch");
  if (
    image.bytes.length === 0
    || image.bytes.length !== image.byteSize
    || image.bytes.length > MAX_EVIDENCE_CANONICAL_BYTES
  ) {
    fail(
      image.bytes.length > MAX_EVIDENCE_CANONICAL_BYTES
        ? "canonical_too_large"
        : "decode_failed",
    );
  }
  if (supportedImageMime(image.bytes) !== EVIDENCE_CANONICAL_MIME) {
    fail("mime_mismatch");
  }
  const hash = createHash("sha256").update(image.bytes).digest("hex");
  if (hash !== image.contentHash) fail("decode_failed");
  try {
    const metadata = await sharp(image.bytes, {
      animated: true,
      failOn: "error",
      limitInputPixels: MAX_EVIDENCE_PIXELS,
    }).metadata();
    if (
      metadata.format !== "webp"
      || (metadata.pages ?? 1) !== 1
      || metadata.width !== image.width
      || metadata.height !== image.height
      || metadata.exif !== undefined
      || metadata.icc !== undefined
      || metadata.xmp !== undefined
      || metadata.iptc !== undefined
    ) {
      fail("decode_failed");
    }
    assertDimensions(metadata.width, metadata.height);
  } catch (error) {
    if (error instanceof EvidenceImageValidationError) throw error;
    fail("decode_failed");
  }
}

/** Strict founder-route data-URL boundary. */
export async function canonicalizeEvidenceDataUrl(
  input: string,
): Promise<CanonicalEvidenceImage> {
  return canonicalizeEvidenceImage(strictDataUrl(input));
}
