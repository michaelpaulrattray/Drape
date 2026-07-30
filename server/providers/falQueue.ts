import { ProviderQueue, withRetry } from "./providerQueue";
import { cancelFalRequest, runFalImageJob } from "./falTransport";
import {
  ProviderError,
  type IdentityEditRequest,
  type IdentityEngine,
  type ImageResult,
} from "./types";

/**
 * Nano Banana Pro via fal.ai (plan §H.9).
 *
 * The identity engine: everything that has to keep looking like the same
 * person — signed package views, revisions, later Takes. Built on Gemini 3 Pro
 * Image, accepts up to 14 reference images, and has a real cancel endpoint,
 * which is why §F treats identity work as cancellable while creative work is
 * designed around not being.
 *
 * VERIFIED from fal.ai, 2026-07-30: endpoints, the queue submit/status/result
 * shape, cancel semantics (202 CANCELLATION_REQUESTED / 400 ALREADY_COMPLETED),
 * resolutions, list pricing. UNVERIFIED until calibration — and this is the
 * program's actual go/no-go question: whether it holds a signed face across the
 * six canonical views at our quality bar. Marketing says "character
 * consistency"; we require our own measurement.
 *
 * The queue walk itself lives in `falTransport.ts`, shared with the creative
 * engine now that GPT Image 2 also runs here.
 */

export const DEFAULT_IDENTITY_MODEL = "fal-ai/nano-banana-pro";
export const DEFAULT_IDENTITY_EDIT_MODEL = "fal-ai/nano-banana-pro/edit";

/** Documented list price per image (§H.9). 4K is the premium tier. */
export const NANO_BANANA_PRO_USD_PER_IMAGE: Record<IdentityEditRequest["resolution"], number> = {
  "1K": 0.15,
  "2K": 0.15,
  "4K": 0.3,
};

export type FalConfig = {
  apiKey: string;
  model?: string;
  editModel?: string;
  /** Total deadline for submit → result, including polling. */
  timeoutMs?: number;
  pollIntervalMs?: number;
  queue?: ProviderQueue;
};

export function createFalIdentityEngine(config: FalConfig) {
  const model = config.model ?? DEFAULT_IDENTITY_MODEL;
  const editModel = config.editModel ?? DEFAULT_IDENTITY_EDIT_MODEL;
  const timeoutMs = config.timeoutMs ?? 300_000;
  const pollIntervalMs = config.pollIntervalMs ?? 1_500;
  const queue =
    config.queue ?? new ProviderQueue({ name: "fal", concurrency: 4, maxQueueDepth: 32 });

  async function edit(request: IdentityEditRequest): Promise<ImageResult> {
    if (request.references.length > 14) {
      // Fail before dispatch: the documented ceiling is 14, and discovering
      // that after paying is the wrong order.
      throw new ProviderError("capability", "too many reference images for this engine");
    }

    return queue.run("editWithReferences", () =>
      withRetry(
        "fal.editWithReferences",
        async () => {
          const job = await runFalImageJob({
            apiKey: config.apiKey,
            endpoint: editModel,
            body: {
              prompt: request.prompt,
              image_urls: request.references.map(
                (reference) =>
                  `data:${reference.contentType};base64,${reference.bytes.toString("base64")}`,
              ),
              num_images: 1,
              resolution: request.resolution,
              ...(request.aspectRatio ? { aspect_ratio: request.aspectRatio } : {}),
            },
            timeoutMs,
            pollIntervalMs,
            signal: request.signal,
          });

          return {
            bytes: job.bytes,
            contentType: job.contentType,
            width: job.width,
            height: job.height,
            latencyMs: job.latencyMs,
            estimatedCostUsd: NANO_BANANA_PRO_USD_PER_IMAGE[request.resolution],
            provenance: { provider: "fal", model: editModel, providerRef: job.requestId },
          };
        },
        { signal: request.signal },
      ),
    );
  }

  const engine: IdentityEngine & {
    cancel: (endpoint: string, requestId: string) => Promise<"cancelled" | "completed">;
  } = {
    id: `fal:${model}`,

    editWithReferences: edit,

    async generateView(request: IdentityEditRequest & { viewAngle: string }): Promise<ImageResult> {
      // A canonical view is the same operation with the angle folded into the
      // instruction; the anchor still travels as a reference, so the face is
      // held rather than re-invented.
      return edit({ ...request, prompt: `${request.prompt}\n\nView: ${request.viewAngle}.` });
    },

    cancel: (endpoint, requestId) => cancelFalRequest(config.apiKey, endpoint, requestId),
  };

  return engine;
}
