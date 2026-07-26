/** Maximum evidence images any one product surface may mount at once. */
export const MAX_RENDERABLE_EVIDENCE_IMAGES = 60;

/**
 * Four request opportunities per mounted image cover initial load plus
 * revalidation/retry bursts without turning ordinary product use into a 429.
 */
export const EVIDENCE_DELIVERY_REQUESTS_PER_MINUTE = 240;

export const EVIDENCE_IMAGE_MAX_ATTEMPTS = 5;
export const EVIDENCE_IMAGE_ATTEMPT_TIMEOUT_MS = 15_000;
