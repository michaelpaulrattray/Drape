import { createModuleLogger } from "../logging/logger";
import { ProviderQueue, withRetry } from "./providerQueue";
import {
  ProviderError,
  type CandidateRequest,
  type CreativeEngine,
  type ImageResult,
  type ProviderFailureClass,
} from "./types";

const log = createModuleLogger("providers/openrouterImages");

/**
 * GPT Image 2 via OpenRouter's unified Images API (plan §H.9).
 *
 * The creative engine: eight independent candidate jobs per roll. GPT Image 2
 * *can* return several images from one call (`n`), and we deliberately do not
 * use it — per-candidate durability, retry, refund and streaming all want
 * independent jobs, and a batch that half-fails is a refund problem with no
 * clean answer (§E pipeline answer 1).
 *
 * VERIFIED from the vendors' docs, 2026-07-30: the model slug, portrait sizes,
 * the quality ladder, and that OpenRouter serves this model through
 * `/api/v1/images`. UNVERIFIED until M3's calibration run: effective
 * concurrency on a fresh account, real per-call latency, how OpenRouter
 * surfaces upstream policy refusals, and data-retention terms as applied
 * through OpenRouter. The failure mapping below is written to fail closed
 * wherever the shape is a guess.
 */

const BASE_URL = "https://openrouter.ai/api/v1";
export const DEFAULT_CREATIVE_MODEL = "openai/gpt-image-2";

/** Documented list price, used for pre-flight cost estimates (§H.10). */
export const GPT_IMAGE_2_USD_PER_IMAGE: Record<CandidateRequest["quality"], number> = {
  low: 0.006,
  medium: 0.053,
  high: 0.211,
};

/**
 * Larger canvases cost proportionally more than the 1024×1024 list price.
 * Portrait 1024×1536 is 1.5× the pixels, which is what the sheet uses.
 */
export function estimateCandidateCostUsd(request: CandidateRequest): number {
  const [width, height] = request.size.split("x").map(Number);
  const pixelRatio = (width * height) / (1024 * 1024);
  const base = GPT_IMAGE_2_USD_PER_IMAGE[request.quality] * pixelRatio;
  // OpenRouter adds a percentage on top of upstream list price.
  return base * 1.055;
}

function classifyHttp(status: number, body: string): ProviderFailureClass {
  if (status === 429) return "rate_limit";
  if (status >= 500) return "transport";
  if (status === 408 || status === 504) return "timeout";
  if (status === 400 || status === 422) {
    // OpenRouter forwards upstream moderation refusals as 400s with prose.
    return /moderation|safety|policy|content|rejected/i.test(body)
      ? "content_policy"
      : "capability";
  }
  if (status === 401 || status === 403) return "capability";
  return "unknown";
}

export type OpenRouterConfig = {
  apiKey: string;
  model?: string;
  /** Per-call deadline. A hung stream must not stall a roll indefinitely. */
  timeoutMs?: number;
  queue?: ProviderQueue;
};

export function createOpenRouterCreativeEngine(config: OpenRouterConfig): CreativeEngine {
  const model = config.model ?? DEFAULT_CREATIVE_MODEL;
  const timeoutMs = config.timeoutMs ?? 180_000;
  const queue =
    config.queue ??
    new ProviderQueue({ name: "openrouter", concurrency: 8, maxQueueDepth: 64 });

  return {
    id: `openrouter:${model}`,

    async generateCandidate(request: CandidateRequest): Promise<ImageResult> {
      return queue.run("generateCandidate", () =>
        withRetry(
          "openrouter.generateCandidate",
          async () => {
            const startedAt = Date.now();
            const timeout = AbortSignal.timeout(timeoutMs);
            const signal = request.signal
              ? AbortSignal.any([request.signal, timeout])
              : timeout;

            let response: Response;
            try {
              response = await fetch(`${BASE_URL}/images`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${config.apiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model,
                  prompt: request.prompt,
                  size: request.size,
                  quality: request.quality,
                  n: 1,
                }),
                signal,
              });
            } catch (error) {
              // AbortSignal.timeout produces a TimeoutError; a user cancel
              // produces an AbortError. They mean different things to billing.
              const name = (error as Error)?.name;
              if (name === "TimeoutError") {
                throw new ProviderError("timeout", "OpenRouter call exceeded its deadline", {
                  cause: error,
                });
              }
              if (name === "AbortError") {
                throw new ProviderError("capability", "cancelled", { cause: error });
              }
              throw new ProviderError("transport", "OpenRouter unreachable", { cause: error });
            }

            const providerRef = response.headers.get("x-request-id") ?? undefined;

            if (!response.ok) {
              const body = await response.text().catch(() => "");
              const failureClass = classifyHttp(response.status, body);
              log.warn(
                { status: response.status, failureClass, providerRef },
                "[OpenRouter] request failed",
              );
              throw new ProviderError(failureClass, "OpenRouter refused the request", {
                status: response.status,
                providerRef,
              });
            }

            const payload = (await response.json()) as {
              data?: Array<{ b64_json?: string; url?: string }>;
              model?: string;
            };
            const first = payload.data?.[0];
            if (!first?.b64_json) {
              // A 200 with no image is not success. Treat as unknown so it
              // fails closed rather than landing an empty candidate.
              throw new ProviderError("unknown", "OpenRouter returned no image data", {
                providerRef,
              });
            }

            const bytes = Buffer.from(first.b64_json, "base64");
            const [width, height] = request.size.split("x").map(Number);
            return {
              bytes,
              contentType: "image/png",
              width,
              height,
              latencyMs: Date.now() - startedAt,
              estimatedCostUsd: estimateCandidateCostUsd(request),
              provenance: {
                provider: "openrouter",
                model,
                servedModel: payload.model,
                providerRef,
              },
            };
          },
          { signal: request.signal },
        ),
      );
    },
  };
}
