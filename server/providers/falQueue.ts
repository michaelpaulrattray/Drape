import { createModuleLogger } from "../logging/logger";
import { ProviderQueue, withRetry } from "./providerQueue";
import {
  ProviderError,
  type IdentityEditRequest,
  type IdentityEngine,
  type ImageResult,
  type ProviderFailureClass,
} from "./types";

const log = createModuleLogger("providers/falQueue");

/**
 * Nano Banana Pro via fal.ai's queue API (plan §H.9).
 *
 * The identity engine: everything that has to keep looking like the same
 * person — signed package views, revisions, later Takes. Built on Gemini 3 Pro
 * Image, accepts up to 14 reference images, and — unlike the creative engine —
 * has a real cancel endpoint, which is why §F's roll-cancel design treats
 * creative work as non-cancellable and identity work as cancellable.
 *
 * VERIFIED from fal.ai's docs, 2026-07-30: the endpoints, the queue
 * submit/status/result shape, webhooks, cancel semantics (202
 * CANCELLATION_REQUESTED / 400 ALREADY_COMPLETED), resolutions and list
 * pricing. UNVERIFIED until calibration — and this is the program's actual
 * go/no-go question: whether it holds a signed face across the six canonical
 * views at our quality bar. Marketing says "character consistency"; we require
 * our own measurement.
 */

const QUEUE_BASE = "https://queue.fal.run";
export const DEFAULT_IDENTITY_MODEL = "fal-ai/nano-banana-pro";
export const DEFAULT_IDENTITY_EDIT_MODEL = "fal-ai/nano-banana-pro/edit";

/** Documented list price per image (§H.9). 4K is the premium tier. */
export const NANO_BANANA_PRO_USD_PER_IMAGE: Record<IdentityEditRequest["resolution"], number> = {
  "1K": 0.15,
  "2K": 0.15,
  "4K": 0.3,
};

function classifyHttp(status: number, body: string): ProviderFailureClass {
  if (status === 429) return "rate_limit";
  if (status >= 500) return "transport";
  if (status === 408 || status === 504) return "timeout";
  if (status === 401 || status === 403) return "capability";
  if (status === 400 || status === 422) {
    return /nsfw|safety|policy|content|moderation|blocked/i.test(body)
      ? "content_policy"
      : "capability";
  }
  return "unknown";
}

export type FalConfig = {
  apiKey: string;
  model?: string;
  editModel?: string;
  /** Total deadline for submit → result, including polling. */
  timeoutMs?: number;
  pollIntervalMs?: number;
  queue?: ProviderQueue;
};

type SubmitResponse = { request_id?: string; status?: string };

export function createFalIdentityEngine(config: FalConfig) {
  const model = config.model ?? DEFAULT_IDENTITY_MODEL;
  const editModel = config.editModel ?? DEFAULT_IDENTITY_EDIT_MODEL;
  const timeoutMs = config.timeoutMs ?? 300_000;
  const pollIntervalMs = config.pollIntervalMs ?? 1_500;
  const queue =
    config.queue ?? new ProviderQueue({ name: "fal", concurrency: 4, maxQueueDepth: 32 });

  const headers = {
    Authorization: `Key ${config.apiKey}`,
    "Content-Type": "application/json",
  };

  /**
   * Cancels an in-flight request. Verified to exist, and it matters: on abort
   * we must actively stop outstanding work, because a submitted request is
   * already spent unless cancelled.
   */
  async function cancel(endpoint: string, requestId: string): Promise<"cancelled" | "completed"> {
    const response = await fetch(`${QUEUE_BASE}/${endpoint}/requests/${requestId}/cancel`, {
      method: "PUT",
      headers,
    });
    if (response.status === 400) return "completed";
    return "cancelled";
  }

  async function runToCompletion(
    endpoint: string,
    body: unknown,
    resolution: IdentityEditRequest["resolution"],
    signal: AbortSignal | undefined,
    startedAt: number,
  ): Promise<ImageResult> {
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
      throw new ProviderError(classifyHttp(submit.status, text), "fal.ai refused the request", {
        status: submit.status,
      });
    }

    const { request_id: requestId } = (await submit.json()) as SubmitResponse;
    if (!requestId) throw new ProviderError("unknown", "fal.ai returned no request id");

    const deadline = startedAt + timeoutMs;
    while (Date.now() < deadline) {
      if (signal?.aborted) {
        await cancel(endpoint, requestId).catch(() => undefined);
        throw new ProviderError("capability", "cancelled", { providerRef: requestId });
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

      const status = await fetch(`${QUEUE_BASE}/${endpoint}/requests/${requestId}/status`, {
        headers,
      }).catch(() => null);
      if (!status) continue; // A blip while polling is not a failed job.

      if (!status.ok) {
        const text = await status.text().catch(() => "");
        throw new ProviderError(classifyHttp(status.status, text), "fal.ai status check failed", {
          status: status.status,
          providerRef: requestId,
        });
      }

      const state = (await status.json()) as { status?: string };
      if (state.status !== "COMPLETED") continue;

      const result = await fetch(`${QUEUE_BASE}/${endpoint}/requests/${requestId}`, { headers });
      if (!result.ok) {
        const text = await result.text().catch(() => "");
        throw new ProviderError(classifyHttp(result.status, text), "fal.ai result fetch failed", {
          status: result.status,
          providerRef: requestId,
        });
      }

      const payload = (await result.json()) as { images?: Array<{ url?: string; content_type?: string }> };
      const image = payload.images?.[0];
      if (!image?.url) {
        throw new ProviderError("unknown", "fal.ai completed without an image", {
          providerRef: requestId,
        });
      }

      // The provider URL is fetched once and never persisted or exposed —
      // outputs land through our own storage authority (§E).
      const download = await fetch(image.url);
      if (!download.ok) {
        throw new ProviderError("transport", "could not download fal.ai result", {
          providerRef: requestId,
        });
      }
      const bytes = Buffer.from(await download.arrayBuffer());

      return {
        bytes,
        contentType: image.content_type ?? "image/png",
        latencyMs: Date.now() - startedAt,
        estimatedCostUsd: NANO_BANANA_PRO_USD_PER_IMAGE[resolution],
        provenance: { provider: "fal", model: endpoint, providerRef: requestId },
      };
    }

    // Deadline hit. Cancel so the timeout does not silently become spend.
    await cancel(endpoint, requestId).catch(() => undefined);
    throw new ProviderError("timeout", "fal.ai did not complete within the deadline", {
      providerRef: requestId,
    });
  }

  const engine: IdentityEngine & { cancel: typeof cancel } = {
    id: `fal:${model}`,

    async editWithReferences(request: IdentityEditRequest): Promise<ImageResult> {
      if (request.references.length > 14) {
        // Fail before dispatch: the provider's documented ceiling is 14, and
        // discovering that after paying is the wrong order.
        throw new ProviderError("capability", "too many reference images for this engine");
      }
      return queue.run("editWithReferences", () =>
        withRetry(
          "fal.editWithReferences",
          () =>
            runToCompletion(
              editModel,
              {
                prompt: request.prompt,
                image_urls: request.references.map(
                  (reference) =>
                    `data:${reference.contentType};base64,${reference.bytes.toString("base64")}`,
                ),
                num_images: 1,
                resolution: request.resolution,
                ...(request.aspectRatio ? { aspect_ratio: request.aspectRatio } : {}),
              },
              request.resolution,
              request.signal,
              Date.now(),
            ),
          { signal: request.signal },
        ),
      );
    },

    async generateView(request: IdentityEditRequest & { viewAngle: string }): Promise<ImageResult> {
      // A canonical view is the same operation with the angle folded into the
      // instruction; the anchor still travels as a reference so the face is
      // held rather than re-invented.
      return engine.editWithReferences({
        ...request,
        prompt: `${request.prompt}\n\nView: ${request.viewAngle}.`,
      });
    },

    cancel,
  };

  return engine;
}
