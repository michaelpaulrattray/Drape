import {
  EVIDENCE_IMAGE_ATTEMPT_TIMEOUT_MS,
  EVIDENCE_IMAGE_MAX_ATTEMPTS,
} from "@shared/evidenceDelivery";

const MAX_RETRY_DELAY_MS = 15_000;
const BASE_RETRY_DELAY_MS = 400;

export type PrivateEvidenceImageLoadResult =
  | { status: "loaded"; blob: Blob }
  | {
    status: "unavailable";
    reason: "not_found" | "access_denied" | "invalid_response" | "exhausted";
  };

export interface PrivateEvidenceImageLoadOptions {
  src: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  sleep?: (delayMs: number, signal?: AbortSignal) => Promise<void>;
  random?: () => number;
  maxAttempts?: number;
  attemptTimeoutMs?: number;
}

function abortError(): Error {
  return new DOMException("Evidence image request was cancelled", "AbortError");
}

function defaultSleep(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    const onAbort = () => {
      globalThis.clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function retryAfterMs(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(MAX_RETRY_DELAY_MS, Math.ceil(seconds * 1000));
  }
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return null;
  return Math.min(MAX_RETRY_DELAY_MS, Math.max(0, date - now));
}

function retryDelayMs(input: {
  attempt: number;
  retryAfter: string | null;
  random: () => number;
}): number {
  const explicit = retryAfterMs(input.retryAfter);
  if (explicit !== null) return explicit;
  const exponential = Math.min(
    MAX_RETRY_DELAY_MS,
    BASE_RETRY_DELAY_MS * (2 ** Math.max(0, input.attempt - 1)),
  );
  return Math.round(exponential * (0.8 + (input.random() * 0.4)));
}

async function runTimedAttempt<T>(input: {
  signal?: AbortSignal;
  timeoutMs: number;
  run(signal: AbortSignal): Promise<T>;
}): Promise<T> {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  input.signal?.addEventListener("abort", forwardAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    return await input.run(controller.signal);
  } finally {
    clearTimeout(timer);
    input.signal?.removeEventListener("abort", forwardAbort);
  }
}

/**
 * Fetches a private image to completion before exposing it to an <img>. This
 * keeps transient HTTP and truncated-stream failures behind the stable
 * placeholder instead of letting the browser render a broken-image icon.
 */
export async function loadPrivateEvidenceImage(
  options: PrivateEvidenceImageLoadOptions,
): Promise<PrivateEvidenceImageLoadResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;
  const maxAttempts = options.maxAttempts ?? EVIDENCE_IMAGE_MAX_ATTEMPTS;
  const attemptTimeoutMs = options.attemptTimeoutMs
    ?? EVIDENCE_IMAGE_ATTEMPT_TIMEOUT_MS;
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts <= 0) {
    throw new TypeError("maxAttempts must be a positive integer");
  }
  if (!Number.isSafeInteger(attemptTimeoutMs) || attemptTimeoutMs <= 0) {
    throw new TypeError("attemptTimeoutMs must be a positive integer");
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (options.signal?.aborted) throw abortError();
    let response: Response | null = null;
    try {
      const result = await runTimedAttempt({
        signal: options.signal,
        timeoutMs: attemptTimeoutMs,
        run: async (signal) => {
          const attemptResponse = await fetchImpl(options.src, {
            credentials: "same-origin",
            cache: "no-cache",
            signal,
          });
          if (!attemptResponse.ok) {
            return { response: attemptResponse, blob: null };
          }
          const contentType = attemptResponse.headers.get("content-type")
            ?.split(";", 1)[0]
            ?.trim()
            .toLowerCase();
          const declaredSize = Number(
            attemptResponse.headers.get("content-length"),
          );
          const blob = await attemptResponse.blob();
          if (
            contentType !== "image/webp"
            || !Number.isSafeInteger(declaredSize)
            || declaredSize <= 0
            || blob.size !== declaredSize
          ) {
            throw new Error("Evidence image response was incomplete");
          }
          return { response: attemptResponse, blob };
        },
      });
      response = result.response;
      if (result.blob) return { status: "loaded", blob: result.blob };
      if (response.status === 404) {
        return { status: "unavailable", reason: "not_found" };
      }
      if (response.status === 401 || response.status === 403) {
        return { status: "unavailable", reason: "access_denied" };
      }
      if (response.status !== 429 && response.status !== 503) {
        return { status: "unavailable", reason: "invalid_response" };
      }
    } catch (error) {
      if (options.signal?.aborted) throw abortError();
      // Timeouts, network failures, and truncated bodies all retry below.
      void error;
    }
    if (attempt === maxAttempts) break;
    await sleep(retryDelayMs({
      attempt,
      retryAfter: response?.headers.get("retry-after") ?? null,
      random,
    }), options.signal);
  }
  return { status: "unavailable", reason: "exhausted" };
}
