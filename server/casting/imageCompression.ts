/**
 * Server-side image compression for Gemini API payloads.
 * Equivalent to the SOT's client-side compressImageForApi (which uses canvas).
 * Uses sharp for server-side processing.
 *
 * Target: ≤1.5 MB JPEG with cascading quality reduction.
 */
import sharp from "sharp";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("imageCompression");

const MAX_BYTES = 1.5 * 1024 * 1024; // 1.5 MB — matches SOT
const MAX_DIMENSION = 2048;           // max width or height
const QUALITY_CASCADE = [85, 70, 50]; // JPEG quality steps — matches SOT

/**
 * Extract the raw bytes from a data-URL or plain base64 string.
 * Returns a Buffer ready for sharp.
 */
function toBuffer(input: string): Buffer {
  if (input.startsWith("data:")) {
    const commaIdx = input.indexOf(",");
    return Buffer.from(input.slice(commaIdx + 1), "base64");
  }
  return Buffer.from(input, "base64");
}

/**
 * Compress an image (data-URL or raw base64) so it fits within the
 * Gemini API payload budget.  Returns a `data:image/jpeg;base64,…` string.
 *
 * If the image is already under the limit it is returned as-is.
 */
export async function compressImageForApi(imageData: string): Promise<string> {
  // Fast path — already small enough
  const rawBytes = toBuffer(imageData);
  if (rawBytes.length <= MAX_BYTES) {
    // Ensure it's a proper data URL
    if (imageData.startsWith("data:")) return imageData;
    return `data:image/jpeg;base64,${imageData}`;
  }

  log.info(
    { originalKB: Math.round(rawBytes.length / 1024) },
    "[Compress] Image exceeds 1.5 MB, compressing"
  );

  let pipeline = sharp(rawBytes).rotate(); // auto-rotate EXIF

  // Resize if either dimension exceeds MAX_DIMENSION
  const meta = await pipeline.metadata();
  if ((meta.width && meta.width > MAX_DIMENSION) || (meta.height && meta.height > MAX_DIMENSION)) {
    pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true });
  }

  // Cascade through quality levels until under budget
  for (const quality of QUALITY_CASCADE) {
    const buf = await pipeline.clone().jpeg({ quality, mozjpeg: true }).toBuffer();
    if (buf.length <= MAX_BYTES) {
      log.info(
        { quality, resultKB: Math.round(buf.length / 1024) },
        "[Compress] Success"
      );
      return `data:image/jpeg;base64,${buf.toString("base64")}`;
    }
  }

  // Last resort — aggressive resize + lowest quality
  const lastResort = await pipeline
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 40, mozjpeg: true })
    .toBuffer();

  log.warn(
    { resultKB: Math.round(lastResort.length / 1024) },
    "[Compress] Used last-resort compression"
  );
  return `data:image/jpeg;base64,${lastResort.toString("base64")}`;
}

/**
 * Compress a URL-based image by fetching it first, then compressing.
 * Returns a data-URL string.
 */
export async function compressImageUrlForApi(imageUrl: string): Promise<string> {
  if (imageUrl.startsWith("data:")) {
    return compressImageForApi(imageUrl);
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image for compression: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.length <= MAX_BYTES) {
    const contentType = response.headers.get("content-type") || "image/jpeg";
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  }

  return compressImageForApi(buffer.toString("base64"));
}
