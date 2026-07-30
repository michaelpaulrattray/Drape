import { ProviderQueue, withRetry } from "./providerQueue";
import { runFalImageJob } from "./falTransport";
import { ProviderError, type CandidateRequest, type CreativeEngine, type ImageResult } from "./types";

/**
 * GPT Image 2 via fal.ai (plan §H.9: "Fal also hosts GPT Image 2 — a
 * single-transport variant exists if OpenRouter disappoints").
 *
 * That contingency became the primary. fal is the transport we can reliably
 * top up, and running both image models through one vendor collapses a whole
 * class of operational surface: one balance, one queue protocol, one
 * cancellation story, one retention conversation. OpenRouter stays as the text
 * transport (the Claude interpreter, the Kimi treatment stage) and as the
 * image fallback — which is exactly what the adapter boundary was for: this is
 * a config change, not a redesign.
 *
 * Endpoint and input contract verified 2026-07-30 against fal's published
 * OpenAPI schema for `openai/gpt-image-2`, not from a docs page: `image_size`
 * accepts an explicit `{width, height}` (multiples of 16, max edge 3840, ratio
 * ≤ 3:1, 655,360–8,294,400 pixels), `quality` is auto|low|medium|high, and the
 * response is the same `images[]` shape the identity engine returns.
 */

export const FAL_GPT_IMAGE_2 = "openai/gpt-image-2";
export const FAL_GPT_IMAGE_2_EDIT = "openai/gpt-image-2/edit";

/**
 * MEASURED, not listed: $0.8912 across 9 medium-quality 1024×1536 images on
 * 2026-07-30, read from the account balance before and after. List-price
 * arithmetic put it at $0.084, so the real rate is ~18% higher — which is
 * enough to blow a spend ceiling that trusts the list. Cost planning uses this.
 */
export const FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE = 0.099;

export type FalCreativeConfig = {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  queue?: ProviderQueue;
};

export function createFalCreativeEngine(config: FalCreativeConfig): CreativeEngine {
  const model = config.model ?? FAL_GPT_IMAGE_2;
  const timeoutMs = config.timeoutMs ?? 300_000;
  const pollIntervalMs = config.pollIntervalMs ?? 1_500;
  const queue =
    config.queue ?? new ProviderQueue({ name: "fal-images", concurrency: 8, maxQueueDepth: 64 });

  return {
    id: `fal:${model}`,

    async generateCandidate(request: CandidateRequest): Promise<ImageResult> {
      const [width, height] = request.size.split("x").map(Number);
      if (!width || !height) {
        throw new ProviderError("capability", `unusable size "${request.size}"`);
      }
      if (width % 16 !== 0 || height % 16 !== 0) {
        // Fail before dispatch rather than pay to learn the constraint.
        throw new ProviderError("capability", "fal requires both dimensions to be multiples of 16");
      }

      return queue.run("generateCandidate", () =>
        withRetry(
          "fal.generateCandidate",
          async () => {
            const job = await runFalImageJob({
              apiKey: config.apiKey,
              endpoint: model,
              body: {
                prompt: request.prompt,
                image_size: { width, height },
                quality: request.quality,
                num_images: 1,
                output_format: "png",
              },
              timeoutMs,
              pollIntervalMs,
              signal: request.signal,
            });

            return {
              bytes: job.bytes,
              contentType: job.contentType,
              width: job.width ?? width,
              height: job.height ?? height,
              latencyMs: job.latencyMs,
              provenance: {
                provider: "fal",
                model,
                providerRef: job.requestId,
              },
            };
          },
          { signal: request.signal },
        ),
      );
    },
  };
}
