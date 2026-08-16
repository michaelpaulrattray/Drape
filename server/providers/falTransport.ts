import { createModuleLogger } from "../logging/logger";
import { ProviderError, type ProviderFailureClass } from "./types";
import { throughCensus } from "../castingV2/callCensus";
import { assertEngineNotBanned } from "./bannedEngines";

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
  // Our key or our balance, never the user's request. See `provider_account`.
  if (status === 401 || status === 403) return "provider_account";
  if (status === 400 || status === 422) {
    return isContentRefusal(body) ? "content_policy" : "capability";
  }
  return "unknown";
}

/**
 * HOW LONG A GENERATED FACE SITS ON SOMEONE ELSE'S CDN (D-208).
 *
 * fal keeps generated media for **at least 7 days** by default. We do not need
 * seven days: the transport downloads the bytes into our own R2 within the same
 * job, so the CDN copy is transient convenience and every second past that is a
 * picture of a person living somewhere we do not control.
 *
 * An hour, not a minute, and the margin is deliberate — the job's own deadline
 * is 300s, the queue path polls for a result after that, and a retry re-reads
 * the same URL. A lifetime shorter than the work that consumes it would turn a
 * privacy setting into an intermittent download failure.
 *
 * Format verified against fal's published header documentation rather than
 * assumed (D-202): the value is a JSON **string**, not an object.
 */
const CDN_LIFETIME_SECONDS = 3600;

export function falHeaders(apiKey: string) {
  return {
    Authorization: `Key ${apiKey}`,
    "Content-Type": "application/json",
    "X-Fal-Object-Lifecycle-Preference": JSON.stringify({
      expiration_duration_seconds: CDN_LIFETIME_SECONDS,
    }),
  };
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
  body: Record<string, unknown>;
  timeoutMs: number;
  pollIntervalMs: number;
  signal?: AbortSignal;
  /**
   * Return the image inline instead of leaving an object on fal's CDN.
   *
   * Default ON, by founder/Fable ruling. Without it, every generated image also
   * exists at an unauthenticated `v3b.fal.media` URL with no documented expiry
   * — a customer's cast sitting on a third party's CDN outside our control,
   * which sits badly beside the ruling that a customer's cast is their work.
   *
   * Verified 2026-07-30 on both image endpoints (`openai/gpt-image-2` and
   * `fal-ai/nano-banana-pro/edit`): with `sync_mode: true` the result's `url`
   * is a `data:` URI and no CDN object is created. Note it does NOT bypass the
   * queue — `queue.fal.run` still queues; only the payload changes.
   */
  inlineResult?: boolean;
}): Promise<FalJobResult> {
  /*
    THE ENGINE BAN BITES HERE, because this is the one place every fal image
    job passes — creative rolls, creative edits and identity edits all arrive
    at this function with their endpoint in hand. Before the census, because a
    refused dispatch is not a call anyone made.
  */
  assertEngineNotBanned(input.endpoint, "fal image dispatch");

  /*
    COUNTED WHERE IT HAPPENS (the call census). One entry per JOB rather than
    per HTTP round trip: submit, poll and result are one question to one model
    from a customer's point of view, and it is the question that costs money.
  */
  return throughCensus(
    { stage: "render", provider: "fal", model: input.endpoint },
    () => runFalImageJobUncounted(input),
  );
}

async function runFalImageJobUncounted(input: {
  apiKey: string;
  endpoint: string;
  body: Record<string, unknown>;
  timeoutMs: number;
  pollIntervalMs: number;
  signal?: AbortSignal;
  inlineResult?: boolean;
}): Promise<FalJobResult> {
  const { apiKey, endpoint, timeoutMs, pollIntervalMs, signal } = input;
  const inlineResult = input.inlineResult ?? true;
  const body = { ...input.body, sync_mode: inlineResult };
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
    /*
      The provider's own words, not just ours. "fal.ai refused the request" is
      what a roll that lost three of eight had to be diagnosed from, and it says
      nothing: `capability` is the bucket for every 4xx we did not recognise, so
      class plus a generic string leaves no way to tell a bad prompt from a bad
      key. Truncated, because a provider body can be enormous.
    */
    throw new ProviderError(
      classifyFalHttp(submit.status, text),
      `fal.ai refused the request (${submit.status}): ${text.slice(0, 400)}`,
      { status: submit.status },
    );
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

    /*
      With `sync_mode` the url IS the image — decode it here and no request
      ever leaves for a CDN, because there is no CDN object. Without it we fall
      back to downloading once and discarding the URL; either way a provider
      URL is never persisted or exposed, and outputs land through our own
      storage authority (§E).
    */
    let bytes: Buffer;
    if (image.url.startsWith("data:")) {
      const comma = image.url.indexOf(",");
      if (comma < 0) {
        throw new ProviderError("unknown", "fal.ai returned a malformed data URI", {
          providerRef: requestId,
        });
      }
      bytes = Buffer.from(image.url.slice(comma + 1), "base64");
    } else {
      if (inlineResult) {
        // Asked for inline, got a CDN object anyway: the endpoint does not
        // honour sync_mode. Worth knowing — it means an object exists that the
        // retention question has to cover.
        log.warn(
          { endpoint, requestId },
          "[fal] sync_mode requested but a CDN url was returned — this endpoint leaves an object behind",
        );
      }
      const download = await fetch(image.url);
      if (!download.ok) {
        throw new ProviderError("transport", "could not download fal.ai result", {
          providerRef: requestId,
        });
      }
      bytes = Buffer.from(await download.arrayBuffer());
    }

    return {
      bytes,
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
