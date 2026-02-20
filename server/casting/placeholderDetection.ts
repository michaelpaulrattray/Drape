import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("casting/placeholderDetection");

/**
 * Placeholder Detection — Detects blank/gray/solid-color images returned by
 * Gemini when its internal safety filters silently refuse to generate a person
 * but still return finishReason: STOP with image data.
 *
 * Strategy: Decode the base64 image, sample pixels across the image, and check
 * if the color variance is below a threshold (indicating a solid fill).
 *
 * This runs AFTER image extraction but BEFORE the image is stored or credits
 * are finalized, so withAtomicCredits can refund on detection.
 */

// ── Configuration ──────────────────────────────────────────────────────────
const SAMPLE_SIZE = 64; // Number of pixels to sample
const MIN_VARIANCE_THRESHOLD = 150; // Minimum variance across RGB channels
const MIN_UNIQUE_COLORS = 8; // Minimum distinct colors in sample

/**
 * Analyze a base64-encoded image for placeholder characteristics.
 * Returns true if the image appears to be a solid-color placeholder.
 *
 * Uses a lightweight pixel sampling approach that works with raw image
 * data without requiring heavy image processing libraries.
 */
export function isPlaceholderImage(base64Data: string): boolean {
  try {
    const buffer = Buffer.from(base64Data, "base64");

    // Too small to be a real image (< 5KB is suspicious)
    if (buffer.length < 5_000) {
      log.warn(
        `[PlaceholderDetection] Image suspiciously small: ${buffer.length} bytes`,
      );
      return true;
    }

    // For PNG: check IHDR for dimensions, then sample IDAT pixel data
    // For JPEG: sample raw byte patterns
    // We use a format-agnostic approach: sample bytes from the data section
    // and check for repetitive patterns

    const samples = sampleBytes(buffer);
    if (!samples || samples.length < SAMPLE_SIZE) {
      // Can't sample enough data — don't flag as placeholder
      return false;
    }

    // Check 1: Color variance — are all sampled bytes very similar?
    const variance = calculateVariance(samples);
    if (variance < MIN_VARIANCE_THRESHOLD) {
      log.warn(
        `[PlaceholderDetection] Low variance detected: ${variance.toFixed(1)} (threshold: ${MIN_VARIANCE_THRESHOLD})`,
      );
      return true;
    }

    // Check 2: Unique color count — solid fills have very few unique values
    const uniqueColors = new Set(samples.map((s) => `${s[0]}-${s[1]}-${s[2]}`));
    if (uniqueColors.size < MIN_UNIQUE_COLORS) {
      log.warn(
        `[PlaceholderDetection] Too few unique colors: ${uniqueColors.size} (threshold: ${MIN_UNIQUE_COLORS})`,
      );
      return true;
    }

    return false;
  } catch (error) {
    // If analysis fails, don't block the generation
    log.warn({ err: error }, "[PlaceholderDetection] Analysis failed, allowing image:");
    return false;
  }
}

/**
 * Sample RGB-like triplets from the image buffer.
 * Skips headers and samples from the data payload section.
 */
function sampleBytes(buffer: Buffer): number[][] | null {
  // Skip the first 100 bytes (headers) and last 50 bytes (trailers)
  const dataStart = Math.min(100, Math.floor(buffer.length * 0.1));
  const dataEnd = Math.max(dataStart + 100, buffer.length - 50);
  const dataLength = dataEnd - dataStart;

  if (dataLength < SAMPLE_SIZE * 3) return null;

  const step = Math.floor(dataLength / SAMPLE_SIZE);
  const samples: number[][] = [];

  for (let i = 0; i < SAMPLE_SIZE; i++) {
    const offset = dataStart + i * step;
    if (offset + 2 < buffer.length) {
      samples.push([buffer[offset], buffer[offset + 1], buffer[offset + 2]]);
    }
  }

  return samples;
}

/**
 * Calculate the total variance across all sampled RGB triplets.
 * Low variance = uniform color = likely placeholder.
 */
function calculateVariance(samples: number[][]): number {
  if (samples.length === 0) return Infinity;

  // Calculate mean for each channel
  const means = [0, 0, 0];
  for (const s of samples) {
    means[0] += s[0];
    means[1] += s[1];
    means[2] += s[2];
  }
  means[0] /= samples.length;
  means[1] /= samples.length;
  means[2] /= samples.length;

  // Calculate variance for each channel
  let totalVariance = 0;
  for (const s of samples) {
    totalVariance += (s[0] - means[0]) ** 2;
    totalVariance += (s[1] - means[1]) ** 2;
    totalVariance += (s[2] - means[2]) ** 2;
  }
  totalVariance /= samples.length * 3;

  return totalVariance;
}

/**
 * Validate a Gemini-returned image URL/base64 for placeholder characteristics.
 * Call this after extractImage() succeeds but before storing the result.
 *
 * Throws an error if the image is detected as a placeholder, which will
 * trigger the withAtomicCredits refund path.
 */
export function validateNotPlaceholder(imageData: string): void {
  // Gemini returns inline base64 data URLs: "data:image/png;base64,..."
  const base64Match = imageData.match(/^data:image\/[^;]+;base64,(.+)$/);
  if (!base64Match) {
    // Not a base64 data URL (might be a storage URL) — skip validation
    return;
  }

  const base64 = base64Match[1];
  if (isPlaceholderImage(base64)) {
    throw new Error(
      "Generation produced a blank image. This usually means the content was silently filtered. Credits have been refunded. Please adjust your casting parameters and try again.",
    );
  }
}
