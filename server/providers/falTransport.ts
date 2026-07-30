import { createModuleLogger } from "../logging/logger";
import { ProviderError, type ProviderFailureClass } from "./types";

const log = createModuleLogger("providers/falTransport");

/**
 * The fal.ai queue walk, shared by every engine we run there.
 *
 * fal hosts both of our image models — Nano Banana Pro for identity work and
 * GPT Image 2 for creative rolls — behind one queue protocol: submit, poll
 * status, fetch result. Extracted so the two engines cannot drift on the part
 * that matters most: cancelling outstanding work, and never letting a provider
 * URL escape.
 */

export const QUEUE_BASE = "https://queue.fal.run";
const BALANCE_URL = "https://rest.alpha.fal.ai/billing/user_balance";

/**
 * Whether a provider body is genuinely a content refusal.
 *
 * This started as a loose word-list that included the bare token `content`,
 * and the M3 calibration run caught what that costs: five candidates failed at
 * the result-fetch step, every one was classified `content_policy` — which is
 * NON-retryable — and re-running one of the same prompts afterwards succeeded
 * immediately. They were transient errors that the retry policy would have
 * absorbed, permanently failed and refunded instead, because a body containing
 * the substring "content" (as in `content_type`) matched.
 *
 * Misclassifying in this direction is the expensive one: a real refusal
 * retried three times wastes a little money, but a transient error marked
 * terminal loses a candidate the user paid for. So the phrases here are
 * deliberately specific, and anything unrecognised falls through to a
 * retryable class rather than being called a refusal.
 */
export function isContentRefusal(body: string): boolean {
  return /\bnsfw\b|safety[\s_-]?system|content[\s_-]?polic|policy[\s_-]?violation|moderation[\s_-]?(block|refus|reject)|blocked[\s_-]?by[\s_-]?(safety|moderation)|prohibited[\s_-]?content|violates/i.test(
    body,
  );
}

export function classifyFalHttp(status: number, body: string): ProviderFailureClass {
  if (status === 429) return "rate_limit";
  if (status >= 500) return "transport";
  if (status === 408 || status === 504) return "timeout";
  if (status === 401 || status === 403) return "capability";
  if (status === 400 || status === 422) {
    return isContentRefusal(body) ? "content_policy" : "capability";
  }
  return "unknown";
}

export function falHeaders(apiKey: string) {
  return { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" };
}

/**
 * Account balance in USD. Used by the calibration harness to measure what a run
 * actually cost, rather than trusting list-price arithmetic — the only honest
 * way to report cost per candidate.
 */
export async function readFalBalanceUsd(apiKey: string): Promise<number | null> {
  try {
    const response = await fetch(BALANCE_URL, { headers: falHeaders(apiKey) });
    if (!response.ok) return null;
    return Number(await response.text());
  } catch {
    return null;
  }
}

/**
 * Cancels an in-flight request. Verified to exist on fal's queue API, and it
 * matters: a submitted request is spend unless it is cancelled, so both user
 * aborts and deadline expiry must call this.
 */
export async function cancelFalUrl(
  apiKey: string,
  cancelUrl: string,
): Promise<"cancelled" | "completed"> {
  const response = await fetch(cancelUrl, { method: "PUT", headers: falHeaders(apiKey) });
  // 400 ALREADY_COMPLETED means the work finished before we asked.
  return response.status === 400 ? "completed" : "cancelled";
}

/** Convenience for callers holding an endpoint + id rather than a cancel URL. */
export async function cancelFalRequest(
  apiKey: string,
  endpoint: string,
  requestId: string,
): Promise<"cancelled" | "completed"> {
  return cancelFalUrl(apiKey, `${QUEUE_BASE}/${endpoint}/requests/${requestId}/cancel`);
}

export type FalJobResult = {
  bytes: Buffer;
  contentType: string;
  width?: number;
  height?: number;
  requestId: string;
  /** Milliseconds from submit to bytes in hand. */
  latencyMs: number;
  /** Milliseconds the request sat in fal's queue before running, when reported. */
  queuedMs?: number;
};

/**
 * Submit → poll → fetch → download, with the deadline and cancellation
 * discipline both engines need.
 */
export async function runFalImageJob(input: {
  apiKey: string;
  endpoint: string;
  body: unknown;
  timeoutMs: number;
  pollIntervalMs: number;
  signal?: AbortSignal;
}): Promise<FalJobResult> {
  const { apiKey, endpoint, body, timeoutMs, pollIntervalMs, signal } = input;
  const headers = falHeaders(apiKey);
  const startedAt = Date.now();

  const submit = await fetch(`${QUEUE_BASE}/${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  }).catch((error) => {
    throw new ProviderError("transport", "fal.ai unreachable", { cause: error });
  });

  if (!submit.ok) {
    const text = await submit.text().catch(() => "");
    throw new ProviderError(classifyFalHttp(submit.status, text), "fal.ai refused the request", {
      status: submit.status,
    });
  }

  const submitted = (await submit.json()) as {
    request_id?: string;
    status_url?: string;
    response_url?: string;
    cancel_url?: string;
  };
  const requestId = submitted.request_id;
  if (!requestId) throw new ProviderError("unknown", "fal.ai returned no request id");

  /*
    Use the URLs fal hands back, do not construct them.

    For sub-path endpoints like `fal-ai/nano-banana-pro/edit`, the queue URLs
    drop the trailing segment — status lives at
    `/fal-ai/nano-banana-pro/requests/{id}/status`, not
    `/fal-ai/nano-banana-pro/edit/requests/{id}/status`. Constructing them from
    the submit endpoint returns 405 on every poll, which is exactly how the
    first calibration run lost its whole identity phase. The response is the
    contract; the fallbacks below only cover a response that omits them.
  */
  const statusUrl = submitted.status_url ?? `${QUEUE_BASE}/${endpoint}/requests/${requestId}/status`;
  const resultUrl = submitted.response_url ?? `${QUEUE_BASE}/${endpoint}/requests/${requestId}`;
  const cancelUrl = submitted.cancel_url ?? `${QUEUE_BASE}/${endpoint}/requests/${requestId}/cancel`;

  const deadline = startedAt + timeoutMs;
  let startedRunningAt: number | undefined;

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      await cancelFalUrl(apiKey, cancelUrl).catch(() => undefined);
      throw new ProviderError("capability", "cancelled", { providerRef: requestId });
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

    const status = await fetch(statusUrl, { headers }).catch(() => null);
    // A blip while polling is not a failed job — the work is still queued.
    if (!status) continue;

    if (!status.ok) {
      const text = await status.text().catch(() => "");
      throw new ProviderError(classifyFalHttp(status.status, text), "fal.ai status check failed", {
        status: status.status,
        providerRef: requestId,
      });
    }

    const state = (await status.json()) as { status?: string };
    if (state.status === "IN_PROGRESS" && startedRunningAt === undefined) {
      startedRunningAt = Date.now();
    }
    if (state.status !== "COMPLETED") continue;

    const result = await fetch(resultUrl, { headers });
    if (!result.ok) {
      const text = await result.text().catch(() => "");
      // Carry the status and a body excerpt into the message. The calibration
      // run failed five calls here and the log said only "result fetch
      // failed", which cost a live re-probe to diagnose.
      throw new ProviderError(
        classifyFalHttp(result.status, text),
        `fal.ai result fetch failed (${result.status}): ${text.slice(0, 200)}`,
        { status: result.status, providerRef: requestId },
      );
    }

    const payload = (await result.json()) as {
      images?: Array<{ url?: string; content_type?: string; width?: number; height?: number }>;
    };
    const image = payload.images?.[0];
    if (!image?.url) {
      throw new ProviderError("unknown", "fal.ai completed without an image", {
        providerRef: requestId,
      });
    }

    // Fetched once, then discarded. Provider URLs are never persisted and never
    // exposed — outputs land through our own storage authority (§E).
    const download = await fetch(image.url);
    if (!download.ok) {
      throw new ProviderError("transport", "could not download fal.ai result", {
        providerRef: requestId,
      });
    }

    return {
      bytes: Buffer.from(await download.arrayBuffer()),
      contentType: image.content_type ?? "image/png",
      width: image.width,
      height: image.height,
      requestId,
      latencyMs: Date.now() - startedAt,
      queuedMs: startedRunningAt ? startedRunningAt - startedAt : undefined,
    };
  }

  // Deadline hit. Cancel, so a timeout does not silently become spend.
  await cancelFalUrl(apiKey, cancelUrl).catch(() => undefined);
  log.warn({ endpoint, requestId }, "[fal] deadline expired — cancelled");
  throw new ProviderError("timeout", "fal.ai did not complete within the deadline", {
    providerRef: requestId,
  });
}
