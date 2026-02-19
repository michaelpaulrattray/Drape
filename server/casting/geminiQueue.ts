/**
 * Gemini Queue — Centralized concurrency limiter for all Gemini API calls.
 *
 * All users share one Gemini API key. Without server-side throttling,
 * concurrent users exhaust the quota and everyone gets 429s.
 *
 * Two lanes:
 *   - IMAGE_LANE (3 concurrent): Heavy image generation calls (~30-60s each)
 *   - TEXT_LANE  (5 concurrent): Lightweight text-only calls (~5-15s each)
 *
 * Overflow: Requests beyond concurrency cap queue FIFO.
 *           If queue depth exceeds MAX_QUEUE_DEPTH, reject immediately.
 */
import pLimit from "p-limit";

// ── Configuration ──────────────────────────────────────────────────────────
const IMAGE_CONCURRENCY = 3;
const TEXT_CONCURRENCY = 5;
const MAX_QUEUE_DEPTH = 20;

// ── Limiters ───────────────────────────────────────────────────────────────
const imageLimiter = pLimit(IMAGE_CONCURRENCY);
const textLimiter = pLimit(TEXT_CONCURRENCY);

// ── Queue depth tracking ───────────────────────────────────────────────────
let imageQueueDepth = 0;
let textQueueDepth = 0;

/**
 * Run a Gemini image generation call through the concurrency limiter.
 * Use for: generateCastingImage, generateFullBody, generateSingleView,
 *          upscaleExistingImage, generateRemainingViews
 */
export async function withImageQueue<T>(
  fn: () => Promise<T>,
  label: string = "image",
): Promise<T> {
  if (imageQueueDepth >= MAX_QUEUE_DEPTH) {
    console.warn(
      `[GeminiQueue] Image queue full (${imageQueueDepth}/${MAX_QUEUE_DEPTH}), rejecting: ${label}`,
    );
    throw new Error(
      "Server busy — too many image generations in progress. Please try again in a moment.",
    );
  }

  imageQueueDepth++;
  console.log(
    `[GeminiQueue] Image enqueued: ${label} (depth: ${imageQueueDepth}, active: ${imageLimiter.activeCount}/${IMAGE_CONCURRENCY})`,
  );

  try {
    return await imageLimiter(() => {
      console.log(
        `[GeminiQueue] Image started: ${label} (active: ${imageLimiter.activeCount}/${IMAGE_CONCURRENCY})`,
      );
      return fn();
    });
  } finally {
    imageQueueDepth--;
    console.log(
      `[GeminiQueue] Image completed: ${label} (depth: ${imageQueueDepth})`,
    );
  }
}

/**
 * Run a Gemini text-only call through the concurrency limiter.
 * Use for: generateMasterPrompt, enhanceUserPrompt, compactMasterPrompt,
 *          updateSchemaForIteration, reconcileSchemaWithImage,
 *          generateCastingSuggestions, analyzeReferenceForTransfer,
 *          checkIdentityConsistency
 */
export async function withTextQueue<T>(
  fn: () => Promise<T>,
  label: string = "text",
): Promise<T> {
  if (textQueueDepth >= MAX_QUEUE_DEPTH) {
    console.warn(
      `[GeminiQueue] Text queue full (${textQueueDepth}/${MAX_QUEUE_DEPTH}), rejecting: ${label}`,
    );
    throw new Error(
      "Server busy — too many requests in progress. Please try again in a moment.",
    );
  }

  textQueueDepth++;
  console.log(
    `[GeminiQueue] Text enqueued: ${label} (depth: ${textQueueDepth}, active: ${textLimiter.activeCount}/${TEXT_CONCURRENCY})`,
  );

  try {
    return await textLimiter(() => {
      console.log(
        `[GeminiQueue] Text started: ${label} (active: ${textLimiter.activeCount}/${TEXT_CONCURRENCY})`,
      );
      return fn();
    });
  } finally {
    textQueueDepth--;
    console.log(
      `[GeminiQueue] Text completed: ${label} (depth: ${textQueueDepth})`,
    );
  }
}

// ── Stats (for health monitor / debugging) ─────────────────────────────────
export function getQueueStats() {
  return {
    image: {
      active: imageLimiter.activeCount,
      pending: imageLimiter.pendingCount,
      queueDepth: imageQueueDepth,
      concurrency: IMAGE_CONCURRENCY,
    },
    text: {
      active: textLimiter.activeCount,
      pending: textLimiter.pendingCount,
      queueDepth: textQueueDepth,
      concurrency: TEXT_CONCURRENCY,
    },
  };
}
