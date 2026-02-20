/**
 * Gemini Queue — Centralized concurrency limiter for all Gemini API calls.
 *
 * All users share one Gemini API key. Without server-side throttling,
 * concurrent users exhaust the quota and everyone gets 429s.
 *
 * Two lanes:
 *   - IMAGE_LANE: Heavy image generation calls (~30-60s each)
 *   - TEXT_LANE:  Lightweight text-only calls (~5-15s each)
 *
 * Overflow: Requests beyond concurrency cap queue FIFO.
 *           If queue depth exceeds MAX_QUEUE_DEPTH, reject immediately.
 *
 * Circuit Breaker: All requests check the circuit breaker before entering
 *                  the queue. If Gemini is down, requests fail fast.
 *
 * Configuration: All limits are configurable via environment variables
 *                so they can be tuned without code changes when Gemini
 *                quotas are upgraded.
 */
import pLimit from "p-limit";
import {
  checkCircuit,
  recordSuccess,
  recordFailure,
} from "./geminiCircuitBreaker";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("casting/geminiQueue");

// ── Configuration (env-configurable) ──────────────────────────────────────
const IMAGE_CONCURRENCY = parseInt(
  process.env.GEMINI_IMAGE_CONCURRENCY ?? "5",
  10,
);
const TEXT_CONCURRENCY = parseInt(
  process.env.GEMINI_TEXT_CONCURRENCY ?? "5",
  10,
);
const MAX_QUEUE_DEPTH = parseInt(
  process.env.GEMINI_MAX_QUEUE_DEPTH ?? "50",
  10,
);

log.info(
  `[GeminiQueue] Initialized — image: ${IMAGE_CONCURRENCY} concurrent, text: ${TEXT_CONCURRENCY} concurrent, max depth: ${MAX_QUEUE_DEPTH}`,
);

// ── Limiters ───────────────────────────────────────────────────────────────
const imageLimiter = pLimit(IMAGE_CONCURRENCY);
const textLimiter = pLimit(TEXT_CONCURRENCY);

// ── Queue depth tracking ───────────────────────────────────────────────────
let imageQueueDepth = 0;
let textQueueDepth = 0;

// ── Queue position tracking ────────────────────────────────────────────────
let imageQueueCounter = 0;
let textQueueCounter = 0;

/**
 * Run a Gemini image generation call through the concurrency limiter.
 * Use for: generateCastingImage, generateFullBody, generateSingleView,
 *          upscaleExistingImage, generateRemainingViews
 *
 * Returns the result and provides queue position via onPosition callback.
 */
export async function withImageQueue<T>(
  fn: () => Promise<T>,
  label: string = "image",
  onPosition?: (position: number, total: number) => void,
): Promise<T> {
  // Circuit breaker: fail fast if Gemini is down
  checkCircuit();

  if (imageQueueDepth >= MAX_QUEUE_DEPTH) {
    log.warn(
      `[GeminiQueue] Image queue full (${imageQueueDepth}/${MAX_QUEUE_DEPTH}), rejecting: ${label}`,
    );
    throw new Error(
      "Server busy — too many image generations in progress. Please try again in a moment.",
    );
  }

  imageQueueDepth++;
  const myPosition = ++imageQueueCounter;

  // Notify caller of their queue position
  if (onPosition) {
    const positionInQueue = imageQueueDepth;
    onPosition(positionInQueue, imageQueueDepth);
  }

  log.info(
    `[GeminiQueue] Image enqueued: ${label} (depth: ${imageQueueDepth}, active: ${imageLimiter.activeCount}/${IMAGE_CONCURRENCY}, ticket: ${myPosition})`,
  );

  try {
    const result = await imageLimiter(() => {
      log.info(
        `[GeminiQueue] Image started: ${label} (active: ${imageLimiter.activeCount}/${IMAGE_CONCURRENCY})`,
      );
      return fn();
    });
    recordSuccess();
    return result;
  } catch (error) {
    recordFailure(error);
    throw error;
  } finally {
    imageQueueDepth--;
    log.info(
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
  // Circuit breaker: fail fast if Gemini is down
  checkCircuit();

  if (textQueueDepth >= MAX_QUEUE_DEPTH) {
    log.warn(
      `[GeminiQueue] Text queue full (${textQueueDepth}/${MAX_QUEUE_DEPTH}), rejecting: ${label}`,
    );
    throw new Error(
      "Server busy — too many requests in progress. Please try again in a moment.",
    );
  }

  textQueueDepth++;
  log.info(
    `[GeminiQueue] Text enqueued: ${label} (depth: ${textQueueDepth}, active: ${textLimiter.activeCount}/${TEXT_CONCURRENCY})`,
  );

  try {
    const result = await textLimiter(() => {
      log.info(
        `[GeminiQueue] Text started: ${label} (active: ${textLimiter.activeCount}/${TEXT_CONCURRENCY})`,
      );
      return fn();
    });
    recordSuccess();
    return result;
  } catch (error) {
    recordFailure(error);
    throw error;
  } finally {
    textQueueDepth--;
    log.info(
      `[GeminiQueue] Text completed: ${label} (depth: ${textQueueDepth})`,
    );
  }
}

// ── Stats (for health monitor / debugging / frontend) ─────────────────────
export function getQueueStats() {
  return {
    image: {
      active: imageLimiter.activeCount,
      pending: imageLimiter.pendingCount,
      queueDepth: imageQueueDepth,
      concurrency: IMAGE_CONCURRENCY,
      maxDepth: MAX_QUEUE_DEPTH,
    },
    text: {
      active: textLimiter.activeCount,
      pending: textLimiter.pendingCount,
      queueDepth: textQueueDepth,
      concurrency: TEXT_CONCURRENCY,
      maxDepth: MAX_QUEUE_DEPTH,
    },
  };
}

