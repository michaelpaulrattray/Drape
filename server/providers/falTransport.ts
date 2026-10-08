import { createModuleLogger } from "../logging/logger";
import { ProviderError, isRetryable, type ProviderFailureClass } from "./types";
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
async function cancelFalUrl(
  apiKey: string,
  cancelUrl: string,
): Promise<"cancelled" | "completed"> {
  const response = await fetch(cancelUrl, { method: "PUT", headers: falHeaders(apiKey) });
  // 400 ALREADY_COMPLETED means the work finished before we asked.
  return response.status === 400 ? "completed" : "cancelled";
}

/**
 * CANCEL, AND SAY WHETHER THE FRAME WAS ALREADY BOUGHT (#2038).
 *
 * Every exit from the poll loop that walks away from a submitted job goes
 * through here — the abort, a status check answered with a non-transient
 * refusal (404, 405…), the deadline. Walking away without cancelling leaves the
 * job running on fal, where it renders and bills, and a retryable exit then has
 * `withRetry` submit a SECOND job beside it. (A transient 5xx/429 on the status
 * poll no longer exits at all — #2044 keeps polling the same job, because
 * whether this cancel stops a job already IN_PROGRESS is unverified.)
 *
 * The answer is the fact the caller's error carries: `true` when fal answered
 * 400 ALREADY_COMPLETED, meaning the frame finished before we asked and is
 * paid for, so a re-ask would buy another. Best-effort: a cancel that throws
 * is `false` (we do not know it ran, so the road keeps the retrying direction,
 * which is `ProviderError.completed`'s stated default) and never replaces the
 * fault the caller is about to raise.
 */
async function cancelOutstanding(
  apiKey: string,
  cancelUrl: string,
  requestId: string,
  reason: string,
): Promise<boolean> {
  const outcome = await cancelFalUrl(apiKey, cancelUrl).catch(() => "unanswered" as const);
  if (outcome === "unanswered") {
    log.warn({ requestId, reason }, "[fal] cancel did not answer — the job may still run");
  }
  return outcome === "completed";
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
  /* The wait before the next poll. It grows only while the status endpoint is
     answering 429 and goes back to the interval on any other answer. */
  let pollWaitMs = pollIntervalMs;
  let statusBlipLogged = false;

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      const completed = await cancelOutstanding(apiKey, cancelUrl, requestId, "aborted");
      throw new ProviderError("capability", "cancelled", { providerRef: requestId, completed });
    }

    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(0, Math.min(pollWaitMs, deadline - Date.now()))),
    );

    const status = await fetch(statusUrl, { headers }).catch(() => null);
    // A blip while polling is not a failed job — the work is still queued.
    if (!status) {
      pollWaitMs = pollIntervalMs;
      continue;
    }

    if (!status.ok) {
      const text = await status.text().catch(() => "");
      const failure = classifyFalHttp(status.status, text);
      /* #2044: A 5xx OR A 429 ON THE STATUS POLL IS THE STATUS ENDPOINT'S
         PROBLEM, NOT THE JOB'S — the same as the dropped connection above, so
         keep polling. #2038 cancelled here and let `withRetry` submit a fresh
         job, and that is two frames whenever fal's cancel does not stop a job
         already IN_PROGRESS — unverified, and this transport's own history
         doubts it (PR #1982: "a job already IN_PROGRESS may still bill").
         Polling on costs nothing: the job we already paid to submit is the one
         we wait for, and if the endpoint never recovers the deadline below
         still cancels. "Transient" is DERIVED from the retry policy's own set
         (`isRetryable`), never a second list of status codes beside it. A 429
         backs off — doubling, capped at eight intervals (12s at the engines'
         1.5s default) — so we are not the reason it keeps saying 429.
         Anything else (404, 405, 401…) is an answer about the job or our
         request, and it cancels and throws. */
      if (isRetryable(failure)) {
        // Once per job, not once per poll: a five-minute 503 storm is one line.
        if (!statusBlipLogged) log.warn(
          { endpoint, requestId, status: status.status },
          "[fal] status check answered non-ok — still polling the same job",
        );
        statusBlipLogged = true;
        pollWaitMs = failure === "rate_limit"
          ? Math.min(pollWaitMs * 2, pollIntervalMs * 8)
          : pollIntervalMs;
        continue;
      }
      /* #2038: we are walking away from a job fal still holds — cancel it
         first, or it runs on and bills. If the cancel says the job already
         finished, that frame is bought and the flag stops every re-ask. */
      const completed = await cancelOutstanding(apiKey, cancelUrl, requestId, "status check failed");
      throw new ProviderError(failure, `fal.ai status check failed (${status.status})`, {
        status: status.status,
        providerRef: requestId,
        completed,
      });
    }
    pollWaitMs = pollIntervalMs;

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
        /* COMPLETED, so this frame is already bought — the status poll said so
           one statement ago. A 5xx here classifies `transport` and a 429
           `rate_limit`, both retryable, so without this flag an arrival loop
           re-asked and paid for a second frame. The fourth site of the class
           the relay's finding named three of. */
        { status: result.status, providerRef: requestId, completed: true },
      );
    }

    /*
      EITHER SHAPE, AND THE SECOND ONE COST TWO PAID CALLS TO FIND (opus-903
      §6b, ruled fable-1210 §1c).

      Every GENERATOR this product dispatches to answers `images: [...]`. An
      UPSCALER answers `image: { url }`, SINGULAR — and this parser read only
      the first shape, so both attempts through it RAN, cost money, and came
      back as *"fal.ai completed without an image"*: a shape mismatch reported
      as a provider failure, which is the loudest way a caller can be wrong
      about what it just bought. Nothing about the generators changes; the
      plural is still read first and wins where both are present.
    */
    const payload = (await result.json()) as {
      images?: Array<{ url?: string; content_type?: string; width?: number; height?: number }>;
      image?: { url?: string; content_type?: string; width?: number; height?: number };
    };
    const image = payload.images?.[0] ?? payload.image;
    if (!image?.url) {
      throw new ProviderError("unknown", "fal.ai completed without an image", {
        providerRef: requestId,
        /* The job COMPLETED and was billed; the payload simply holds no image.
           Deterministic, so a re-ask buys another frame and reads it the same
           way (the relay's finding on PR #1982). */
        completed: true,
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
          /* Bought and delivered — the bytes are in hand and unreadable. */
          completed: true,
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
          /* `transport` is the honest CLASS — a CDN fetch really did fail — and
             it is retryable for a job that never ran. This one ran: re-asking
             renders a NEW frame rather than re-fetching this one, so it is
             terminal at the arrival layer and paid for either way. */
          completed: true,
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
  // A `completed` answer means it finished in the gap and the frame is bought.
  const completed = await cancelOutstanding(apiKey, cancelUrl, requestId, "deadline");
  log.warn({ endpoint, requestId, completed }, "[fal] deadline expired — cancelled");
  throw new ProviderError("timeout", "fal.ai did not complete within the deadline", {
    providerRef: requestId,
    completed,
  });
}
