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

/*
 * The FLUX.2 PRO ban (founder ruling, 2026-08-07) used to be a constant here
 * with no reader. It lives in `./bannedEngines` now, where the transport
 * consults it on every dispatch — the ruling in a call site rather than in a
 * file.
 */

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
 *
 * ⚠ **AND IT IS STALE BY ABOUT 2.5×, MEASURED 2026-08-24 — DO NOT QUOTE IT FOR
 * A FAL-SIDE PRICE UNTIL IT IS RE-MEASURED** (finding opus-1187 §3, row ordered
 * fable-1542 Q2). Two settled readings that day put a medium 1024×1536 image at
 * **$0.0400** and a 1536×2304 at **$0.0650** — so every fal-side court this
 * program has priced through this constant was priced at roughly two and a half
 * times its real cost, and **the direction is the one that matters: cheapness
 * that was hidden is capability that was parked.**
 *
 * It is NOT simply overwritten with $0.0400, and that is deliberate. The new
 * figure rests on n=2 with one side taken by difference against a balance
 * quantised to the cent, and the re-measurement ordered to firm it up was
 * DESTROYED by a $20 auto top-up landing mid-run (`fal spent $-18.6600` —
 * `docs/specs/INSTRUMENT_DOCTRINE.md` #25). **A fresher lie is not the repair.**
 * The repair is a DATED constant — *measured $X on DATE, re-measure before
 * quoting* — designed once a solid figure exists, so the next reader inherits a
 * price with a shelf life rather than a number with a footnote.
 *
 * Four planning surfaces import this (`scripts/build-cprime-pack.mts`,
 * `scripts/calibrate-providers.mts`, `scripts/calibration/accessory-instance-cell.mts`,
 * and a test that pins it), which is why the warning lives on the constant and
 * not in a document any of them could have been written without reading.
 */
export const FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE = 0.099;

/**
 * ⚠ **AN OPEN QUESTION ABOUT THIS ENGINE, filed rather than discovered twice**
 * (opus-1189 §4, queued fable-1544 §2): **render size may change COMPOSITION,
 * not just resolution.**
 *
 * The same brief class came back at **33.2%** head share (face-box height over
 * frame height) at 1536×2304 against **27.3%** at 1024×1536 — the engine
 * appearing to frame TIGHTER at the larger size. It is confounded (the two
 * sheets differed in wardrobe as well as in size) and is therefore a question
 * rather than a finding.
 *
 * It is written here because it bears on ANY future size change and not merely
 * on the framing court that turned it up: a caller who assumes a bigger render
 * is the same picture with more pixels has assumed exactly what this reading
 * puts in doubt. **What is already settled is the other half — bigger buys
 * PIXELS, not FIELD OF VIEW: the engine composes to the frame it is given, so a
 * larger render offers no margin to crop into.**
 */

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
