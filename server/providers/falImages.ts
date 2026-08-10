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

/**
 * ⛔ FLUX.2 PRO IS BANNED FROM THIS PROGRAM — founder ruling, 2026-08-07.
 *
 * Never tested again, on anything. Struck from the engine pool, the routing
 * table, and every future probe design. The record is 0-for-4:
 *
 *   1. the engine bake-off — OVER-STYLED, consistently the least restrained
 *      photographically (seam 35.9 and 21.1 against NBP's and GPT2's teens)
 *   2. the glasses silhouette case — GHOSTED, doubled frame outlines, the only
 *      engine to fail that scenario visibly
 *   3. seam convergence — NEVER CONVERGED at any radius, alone among the three
 *   4. eye geometry, its one reputed strength, given a caged chance on a face
 *      measured flat enough to show the delta — it DECORATED rather than
 *      restructured (-0.42deg, inside the instrument's own noise)
 *
 * **The reputation was always styling mistaken for anatomy.** It looked like the
 * engine that changed structure because it changed the most, and "changed the
 * most" is the one thing this program has learned not to read as compliance.
 *
 * Do not add it back for a fifth try. If a successor model appears it is a new
 * entry with its own evidence, not this one rehabilitated.
 */
export const BANNED_ENGINES = ["fal-ai/flux-2-pro", "fal-ai/flux-2-pro/edit"] as const;

/**
 * ⛔ `mask_url` IS BANNED FROM EVERY PRODUCT PATH — fable-178, 2026-08-10.
 *
 * The edit endpoint's published schema carries a mask input:
 *
 *     mask_url : string | null
 *       "The URL of the mask image to use for the generation.
 *        This indicates what part of the image to edit."
 *
 * It does not bound the repaint, and the way it fails is the reason for the
 * word "banned" rather than "unused". Measured on this transport, with the
 * unmasked control in the same sitting (`scripts/calibration/mask-url-probe.mts`,
 * D-243):
 *
 *   RGBA, box transparent      accepted and IGNORED — 156,912 changed pixels
 *                              against the control's 157,795
 *   RGB, box white             very nearly the same
 *   greyscale+alpha            **A COMPLETELY DIFFERENT WOMAN**, 99.9% of the
 *                              frame changed, HTTP 200, no error — and the mask
 *                              file was verified well-formed AFTERWARDS, so
 *                              "malformed input" is not the explanation
 *
 * A stub field that fails by substituting a stranger's face on a paid render is
 * not a parameter, it is a trap. **Do not send it.** If fal ever documents the
 * field properly, the ban lifts only through a fresh probe carrying this one as
 * its negative control.
 *
 * (C′'s own per-render verification — reference match plus face-anchored drift
 * — would catch an identity swap loudly. That is defence in depth, not a reason
 * to touch the field.)
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

/**
 * THE MASKED-EDIT ENGINE — GPT Image 2, at the master's exact resolution.
 *
 * Two things this fixes, and the first one cost the founder three refusals on
 * the first three minutes of real use.
 *
 * **The output size is PINNED, not hoped for.** The incumbent identity engine
 * takes a resolution TIER ("1K"), and Nano Banana Pro answered a 1024x1536
 * master with 848x1264 — its own cap at roughly a megapixel, at the right aspect
 * and the wrong size. A masked composite cannot use that: the master is never
 * resampled, so a patch of a different shape has nothing to composite against.
 * `image_size` takes exact pixels, so the engine is told the answer rather than
 * asked for a size class.
 *
 * **And it is GPT Image 2**, which is the routing row the face wall established:
 * the founder's eye, the seat's eye and the convergence arithmetic picked it
 * independently for face-region edits, and every render on the wall came from
 * it. The product path was still calling the incumbent, so the wall was
 * measuring one engine while production ran another — the gap this closes.
 */
export function createFalMaskedEditEngine(config: FalCreativeConfig) {
  if (!config.apiKey) {
    /* Refused at construction, in one sentence, rather than discovered inside a
       request that has already taken money. */
    throw new ProviderError("capability", "masked editing needs FAL_KEY to render");
  }
  const model = config.model ?? FAL_GPT_IMAGE_2_EDIT;
  const timeoutMs = config.timeoutMs ?? 300_000;
  const pollIntervalMs = config.pollIntervalMs ?? 1_500;
  const queue =
    config.queue ?? new ProviderQueue({ name: "fal-masked-edit", concurrency: 4, maxQueueDepth: 32 });

  return {
    id: `fal:${model}`,
    async edit(request: {
      prompt: string;
      references: readonly { bytes: Buffer; contentType: string }[];
      /** The master's exact pixels. The composite has no use for anything else. */
      width: number;
      height: number;
      signal?: AbortSignal;
    }): Promise<ImageResult> {
      if (request.width % 16 !== 0 || request.height % 16 !== 0) {
        /* Fail before dispatch rather than pay to learn the constraint. */
        throw new ProviderError(
          "capability",
          `fal requires both dimensions to be multiples of 16 — got ${request.width}x${request.height}`,
        );
      }
      return queue.run("maskedEdit", () =>
        withRetry(
          "fal.maskedEdit",
          async () => {
            const job = await runFalImageJob({
              apiKey: config.apiKey,
              endpoint: model,
              body: {
                prompt: request.prompt,
                image_urls: request.references.map(
                  (reference) => `data:${reference.contentType};base64,${reference.bytes.toString("base64")}`,
                ),
                image_size: { width: request.width, height: request.height },
                num_images: 1,
                quality: "high",
                output_format: "png",
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
              estimatedCostUsd: FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE,
              provenance: { provider: "fal" as const, model, providerRef: job.requestId },
            };
          },
          { signal: request.signal },
        ),
      );
    },
  };
}
