import { ProviderQueue, withRetry } from "./providerQueue";
import { runFalImageJob } from "./falTransport";
import {
  ProviderError,
  type CandidateRequest,
  type CreativeEngine,
  type IdentityEditRequest,
  type IdentityEngine,
  type ImageResult,
} from "./types";

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
 * GPT IMAGE 2.5 FLARE — the roll engine the founder chose at his eye on court
 * #1068 (2026-09-22: *"honestly flare gave good results"*, then *"switch to
 * flare"*). Rendered through `CASTING_ROLL_ENGINE_SCOPE` + `CASTING_ROLL_ENGINE_MODEL=flare` (#1079, #1084). Its
 * edit door is the sibling an image-anchored Follow roll takes.
 *
 * ⚠ PRICE NOT YET MEASURED at medium 1024×1536 — the census still records
 * GPT Image 2's dated constant as the estimate; the fal receipt from his first
 * rolls is where Flare's number comes from (clause 3 of the disappearing-
 * technology law: the price is named beside the finding, never assumed).
 */
export const FAL_GPT_IMAGE_25_FLARE = "openai/gpt-image-2.5/flare/text-to-image";
export const FAL_GPT_IMAGE_25_FLARE_EDIT = "openai/gpt-image-2.5/flare/edit";
/**
 * GPT IMAGE 2.5 SUNBURST — the "precision" 2.5 model. His eye after three
 * Flare rolls (2026-09-22): *"flare is producing bad results - switch over to
 * sunburst and let me try it"* — Flare refused 4 of 8 on roll 276 and read
 * wrong to him on 274/275. Same unread-price caveat as Flare.
 */
export const FAL_GPT_IMAGE_25_SUNBURST = "openai/gpt-image-2.5/sunburst/text-to-image";
export const FAL_GPT_IMAGE_25_SUNBURST_EDIT = "openai/gpt-image-2.5/sunburst/edit";
/**
 * THE EDIT SIBLING OF EACH ROLL ENGINE (#1079). An image-anchored render (the
 * Follow road's attached photo, #177 Row A) goes to the SAME model's edit door
 * — a roll and its Follow must be one engine, or one cast wears two looks. A
 * model with no entry here refuses a reference rather than painting strangers
 * against a sentence about a photograph that never arrived.
 */
const FAL_EDIT_SIBLINGS: Readonly<Record<string, string>> = {
  [FAL_GPT_IMAGE_2]: FAL_GPT_IMAGE_2_EDIT,
  [FAL_GPT_IMAGE_25_FLARE]: FAL_GPT_IMAGE_25_FLARE_EDIT,
  [FAL_GPT_IMAGE_25_SUNBURST]: FAL_GPT_IMAGE_25_SUNBURST_EDIT,
};
export function editSiblingOf(model: string): string | null {
  return FAL_EDIT_SIBLINGS[model] ?? null;
}

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
 * ✅ **SO HERE IS THE DATE, AND WHAT IT PRICES — 2026-09-26 (#1196). IT IS THE
 * PRICE OF A RETIRED ENGINE AND AN UPPER BOUND, NEVER A QUOTE FOR TODAY.**
 * #1340 made Sunburst every account's roll engine and both factories in this
 * file default to it (`:198`, `:310`), so nothing rendering from now on can be
 * given this number: it prices rows ALREADY RENDERED, plus the calibration
 * cells that name the constant by hand. **The retirement is CHECKED, not
 * claimed here** — `server/castingV2/rollEngineChoice.test.ts` drives the
 * engine a roll is actually given and `server/providers/falMaskedEditWire.test.ts`
 * asserts the endpoint a paid edit is sent to AT THE WIRE, so a road coming
 * back to GPT Image 2 reddens rather than quietly making this paragraph false.
 *
 * ⚠ **AND THE BAND IS WIDER THAN THE TWO READINGS ABOVE — it lives in ONE
 * place now rather than half here and half there.** #1134 re-read this engine
 * on 2026-09-25 and got three more figures that agree with neither the $0.099
 * nor the $0.0400: they are recorded with their windows and their n in
 * `scripts/lib/falSpend.mts` (`FAL_MEASURED_USD`'s comment for these rows, and
 * `FAL_GPT_IMAGE_2_REREAD_2026_09_25`), which also carries the 2026-08-24 pair
 * restated beside them, so that ONE place shows the whole band. **Until #1196
 * each module recorded readings the other did not, and neither reader could see
 * it.** The three #1134 figures are deliberately NOT repeated here: a second
 * prose copy of a measurement is the drift working law 4 is about, and the
 * narrative of how the 2026-08-24 pair was taken — and destroyed by a top-up —
 * belongs where it happened, which is above.
 *
 * What is settled, and it is the whole of what a reader needs: **every
 * re-reading at the sheet's 1024×1536 sits BELOW $0.099**, so every fal-side
 * figure this constant has ever produced is an over-statement rather than a
 * surprise waiting to land. Reconciling them needs a window driven on purpose,
 * which now means moving `CASTING_ROLL_ENGINE_MODEL` off `sunburst` on
 * production and back — the founder's call, and the open half of #1196.
 *
 * Four planning surfaces import this (`scripts/build-cprime-pack.mts`,
 * `scripts/calibrate-providers.mts`, `scripts/calibration/accessory-instance-cell.mts`,
 * and a test that pins it), which is why the warning lives on the constant and
 * not in a document any of them could have been written without reading.
 */
export const FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE = 0.099;

/**
 * WHAT A PICTURE COSTS, PER MODEL — because one engine's figure is not another
 * engine's figure (#1340, and it is #1134's defect one layer down).
 *
 * The census above this layer used to add every roll render to the fal line as
 * `openai/gpt-image-2` whatever engine ran, so from the day the roll scope was
 * flipped it priced a 2.5 picture at GPT Image 2's rate — **six times too
 * high**. #1134 fixed that by reading the engine off the row. This is the same
 * mistake one floor down: both engine factories stamped
 * `FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE` onto `estimatedCostUsd` no matter
 * which endpoint they were pointed at, and the #1340 probe watched a Sunburst
 * edit come back labelled `0.099`.
 *
 * ⚠ **A MODEL THAT IS NOT IN HERE IS UNPRICED, AND THAT IS THE POINT.** The
 * lookup returns `undefined` rather than a neighbour's number: `estimatedCostUsd`
 * is optional precisely so a gap can say *we have not measured this* instead of
 * quietly inheriting a figure from a different engine. `openai/gpt-image-2.5/sunburst/edit`
 * is deliberately absent, and an unmeasured entry in a table called MEASURED is
 * the *"fresher lie"* `scripts/lib/falSpend.mts` refuses by name.
 *
 * ⚠ **AND THE REASON IT IS ABSENT CHANGED ON 2026-09-27 (#1459) — IT IS NO
 * LONGER "NOTHING HAS MEASURED IT". TWO COURTS HAVE, AND IT STILL CANNOT GO IN
 * HERE, WHICH IS THE MORE USEFUL FACT.** #1394's price phase took a SETTLED
 * balance either side of one render and got **$0.14** at 2352x3504; #1451's
 * 24-render window divides to $0.1429 with the residue putting it at ~$0.136;
 * #1459's drive through the shipped engine read **$0.15** (21.68 -> settled
 * 21.53, n=1). Three readings inside a cent and a half.
 *
 * **This table is keyed on MODEL and this endpoint's price moves with the
 * SIZE**, and the two roads that now send to it ask for different ones: a Sign
 * view asks 2352x3504 (`SIGNED_VIEW_SIZE`, ~8.24 MP) and a paid refine repaint
 * asks the master's own pixels, around 1024x1536 (~1.57 MP). Writing $0.14 here
 * would price every repaint at roughly five times its size — the same defect
 * one row up, where `openai/gpt-image-2.5/sunburst/text-to-image` sits at
 * $0.015 for the sheet's 1024x1536 and this file already warns that *"a bigger
 * canvas costs more, and this number is the 1024x1536 sheet size only."*
 *
 * So the measurement is recorded where a SIZE can be recorded beside it — on
 * {@link createFalSunburstPlateEngine} below, in the two court records, and in
 * the capability atlas — and a size-keyed price is the card this would need.
 * `undefined` here stays the honest answer for both roads.
 *
 * ⚠ **THAT SENTENCE NAMED `createFalSunburstViewEngine` UNTIL 2026-09-30 AND
 * THE FACTORY IT NAMED IS NOW DELETED (#1554, his word: *"DELETE"*).** Its
 * measured band moved INTO the plate engine's docblock in the same commit
 * rather than being dropped — the plate's block had been CITING it, not
 * carrying it, so a straight deletion would have left the three price readings
 * with no home and a dangling citation pointing at nothing. **A pointer is not
 * a copy**, and that is the one thing a deletion of a cited block has to check.
 *
 * These numbers are repeated from `FAL_MEASURED_USD` in `scripts/lib/falSpend.mts`
 * rather than imported, for that module's own stated reason — it stays outside
 * the server's import graph — and `server/falSpend.test.ts` pins the two
 * equal, so a re-measurement that moves one and not the other reddens.
 */
export const FAL_MEASURED_USD_PER_IMAGE: Readonly<Record<string, number>> = {
  [FAL_GPT_IMAGE_2]: FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE,
  [FAL_GPT_IMAGE_2_EDIT]: FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE,
  /* #1134, 2026-09-25 — one balance window carrying eight Sunburst renders and
     nothing else divides to $0.0150 a picture; two further readings bracket it. */
  [FAL_GPT_IMAGE_25_SUNBURST]: 0.015,
};

/** The measured figure for a model, or `undefined` where nothing has measured it. */
export function measuredUsdPerImage(model: string): number | undefined {
  return FAL_MEASURED_USD_PER_IMAGE[model];
}

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
  const model = config.model ?? FAL_GPT_IMAGE_25_SUNBURST;
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

      /*
        THE ANCHOR PHOTO (#177 Row A): a request carrying references is an
        IMAGE-ANCHORED render and goes to the same model's EDIT endpoint —
        the wire the #177 court measured (24/24 delivered, the anchor as a
        data URI in `image_urls`). Only GPT Image 2 has that sibling here;
        any other configured model REFUSES rather than rendering without the
        attachment, because these prompts say "the attached look" and a
        dropped attachment would paint strangers against a sentence about a
        photograph that never arrived (`CandidateRequest.references`).
      */
      const references = request.references ?? [];
      const editSibling = editSiblingOf(model);
      if (references.length > 0 && editSibling === null) {
        throw new ProviderError(
          "capability",
          `engine ${model} has no edit sibling to attach an image reference to`,
        );
      }
      const endpoint = references.length > 0 ? editSibling! : model;

      return queue.run("generateCandidate", () =>
        withRetry(
          "fal.generateCandidate",
          async () => {
            const job = await runFalImageJob({
              apiKey: config.apiKey,
              endpoint,
              body: {
                prompt: request.prompt,
                ...(references.length > 0
                  ? {
                      image_urls: references.map(
                        (reference) => `data:${reference.contentType};base64,${reference.bytes.toString("base64")}`,
                      ),
                    }
                  : {}),
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
                /* The endpoint actually called: an anchored render's row says the edit sibling, never the base model. */
                model: endpoint,
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
  const model = config.model ?? FAL_GPT_IMAGE_25_SUNBURST_EDIT;
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
                /* MEDIUM, on his word 2026-10-01 (terminal), verbatim: "Repaint to
                   medium quality just do it without a court because i checked the
                   rolled casts they are already medium and the quality is good."
                   His finance guy's figure beside it: about $0.066 → $0.023 per
                   repaint. The roll (text-to-image, above) already renders at medium;
                   this is the masked edit joining it. The wardrobe plate below stays
                   high — he ruled on the repaint only. */
                quality: "medium",
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
              /* The endpoint that actually painted, never a constant — a gap
                 reads as UNPRICED rather than as another engine's price. */
              estimatedCostUsd: measuredUsdPerImage(model),
              provenance: { provider: "fal" as const, model, providerRef: job.requestId },
            };
          },
          { signal: request.signal },
        ),
      );
    },
  };
}

/**
 * THE SIGNED VIEW'S SIZE — what the door actually gives, asked for by name.
 *
 * Sunburst's edit door publishes `image_size` as `{width, height}` with each
 * side up to 14142, and it does not honour that: #1394 asked for 3392x5056 and
 * was answered **2352x3504**, the aspect kept, which is the same ~8.29 MP
 * ceiling `image_size` carries above for GPT Image 2. So this is the door's own
 * measured ceiling at the package's 2:3, not a preference — and it is asked for
 * explicitly so no row has to be read as an ask that was silently clamped.
 *
 * Both sides are multiples of 16, which the door requires.
 *
 * For scale: Nano Banana Pro's `2K` tier returned **1696x2528** (4.29 MP), so a
 * signed view is about twice the pixels it was, and the files roughly double
 * with it (measured across 24 renders in #1451: 5.0 MB against 9.4 MB).
 */
export const SIGNED_VIEW_SIZE = { width: 2352, height: 3504 } as const;

/**
 * ⚠ **INHERITED FROM NANO BANANA PRO AND UNVERIFIED FOR THIS DOOR.**
 *
 * `falQueue.ts` refuses more than 14 references because fal documents that
 * ceiling for Nano Banana Pro. **Nothing states one for Sunburst's edit door**,
 * and inventing a number would be a guess on a paid road. Carrying the
 * incumbent number forward is the choice that changes nothing: the guard that
 * was standing when this road was Nano Banana Pro's is still standing, and it
 * refuses before dispatch rather than after the customer has paid.
 *
 * What it costs is bounded and measured rather than argued: a signed view
 * travels with the anchor plus the cast's DELIVERED ink crops, and
 * `casting_ink_delivery_crops` holds **0 rows, all time, in production**
 * (#1451's fixture reading) — so every view this product has ever rendered
 * carried exactly ONE reference. The ceiling has never been approached.
 */
const SIGNED_VIEW_MAX_REFERENCES = 14;

/**
 * THE OUTFIT PLATE'S ASK — one landscape frame holding two panels.
 *
 * ⚠ **IT IS AN ASK, AND THIS DOOR IS MEASURED TO CLAMP IT** — which is why
 * nothing downstream may compute a panel's width from this constant. #1394's
 * sheet arm asked `4688x1760` and was answered `3840x1440` EVERY TIME: the
 * ratio survived to three decimal places (2.664 asked, 2.667 returned) and the
 * long side landed on 3840. So the door preserves aspect and caps the long
 * side, and a caller that trusts its own ask cuts the plate in the wrong place.
 * {@link splitOutfitPlate} reads the returned bytes instead.
 *
 * The number chosen is the one that changes least: 3:2 landscape at the same
 * pixel budget as a signed view (8.19 MP against 8.24 MP), long side 3504 —
 * inside the observed 3840 cap, so it is the one shape of ask this door has
 * been seen to honour unscaled. Each panel is then 3:4 portrait, which is what
 * a head-to-feet figure wants. Both sides are multiples of 16, which the door
 * requires.
 *
 * MEASURED THROUGH THE REAL DOOR (#1278 path E, 2026-09-29): see the drive
 * receipt on the card. A future change to this constant re-measures rather
 * than reasoning from the arithmetic above.
 *
 * ⚠ **RE-MEASURED ON THE EDIT DOOR, WITH A PORTRAIT MASTER BESIDE IT (#1471,
 * 2026-09-29) — and it had to be, because two precedents pointed opposite
 * ways.** The plate moved doors when his ruling gave it the master, and the
 * master is portrait (1024x1536): #1394 had this door CLAMPING a landscape ask
 * (4688x1760 → 3840x1440), while path E's own aspect finding had Nano Banana
 * Pro DRAGGING its output toward a reference's shape. Either behaviour would
 * cut every plate down the wrong column, silently.
 *
 *     asked 3504x2336, master 1024x1536   → returned 3504x2336   (Sifr, #55)
 *     asked 3504x2336, master 1024x1536   → returned 3504x2336   (creature, #58)
 *
 * **The ask survives a portrait reference on this door**, read at the returned
 * BYTES rather than at the provider's report — which matters, because
 * `runFalImageJob` answered `width: null, height: null` on all four renders of
 * that court. A reader trusting the report would have called both plates
 * clamped.
 */
export const OUTFIT_PLATE_SIZE = { width: 3504, height: 2336 } as const;

/**
 * THE OUTFIT PLATE'S ENGINE — GPT Image 2.5 Sunburst at `high`, his creativity
 * choice, on a road no customer's delivered picture comes out of.
 *
 * **His ruling, 2026-09-29 (terminal), path E, verbatim on the two engines:**
 *
 * > *"Sunburst was only chosen because it was more creative in outfit design.
 * > NBP2k was a better quality rersult though."*
 *
 * So the two courts he ran do not cancel: #1451 said Sunburst invents the
 * better outfit, #1394 said Nano Banana Pro renders the better picture, and
 * path E keeps both by giving each the job it won. **This engine draws the
 * WARDROBE PLATE and nothing a customer is handed**; the delivered views go
 * back to `createFalIdentityEngine` at `2K` in the same change.
 *
 * # ⚠ IT WAS A GENERATION FROM WORDS FOR ONE DAY, AND HIS RULING ENDED THAT
 *
 * **His word, 2026-09-29 (terminal), verbatim and entire (#1471):**
 *
 * > *"no the plate must reference the master image otherwise it wouldnt be able
 * > to invent the outfit correctly"*
 *
 * Path E shipped the plate on `text-to-image` with `references: []`, reasoning
 * that a plate is *of the outfit, not of her*. **Two things were wrong with
 * that and he named the first himself.** A plate drawn from words alone cannot
 * see the top she was SIGNED in, so on any cast whose signed close-up shows a
 * garment the brief does not describe exactly, the plate invents a different
 * one — and the full-length view is then told to take the clothes from the
 * plate, which is the product contradicting a picture the customer has already
 * accepted. The second is that the plate's own wardrobe paragraph
 * (`CAST_PACKAGE_WARDROBE_SPEC…`) says *"the SAME outfit the reference
 * photograph shows"* — a sentence addressed to a reference the request did not
 * carry.
 *
 * So the plate is an EDIT now, on `FAL_GPT_IMAGE_25_SUNBURST_EDIT` — the road
 * #1451 measured, the one his eye chose on the outfit court (*"sunburst
 * produced the best result easily"*). The master is its reference; the person
 * in the plate is therefore HER, and the two references a full-length view
 * carries agree on identity by construction rather than by instruction.
 *
 * # THIS IS NOW THE ONLY FACTORY ON THAT DOOR, AND IT WAS ONE OF TWO
 *
 * ⚠ **`createFalSunburstViewEngine` stood beside it until 2026-09-30 and is
 * DELETED — his word on #1554, verbatim and entire: *"DELETE"*.** It was the
 * Sign's view engine for two days (#1459) and path E took the delivered views
 * back to Nano Banana Pro on his later word, leaving it wired to nothing but
 * its own suite. The two factories had come to differ in exactly one field of
 * the body, `image_size`: that one pinned {@link SIGNED_VIEW_SIZE} and refused
 * any resolution but `2K`; a plate is landscape and twice as wide, so it could
 * not ride that constant, and loosening the view engine to take a size would
 * have put the Sign's own picture size behind a parameter for the sake of a
 * road that is not the Sign's picture. **That is why there were two, and it is
 * why deleting the unwired one leaves this one exactly as it was.**
 *
 * `SIGNED_VIEW_SIZE` itself is KEPT and is now reached by this block and by
 * `signViewEngineChain.test.ts`, which asserts a plate's ask is NOT that shape.
 * It is the measured ceiling this door gives at 2:3 (#1394), so it is a reading
 * rather than a preference, and re-deriving it the next time his engine ruling
 * moves would be the worse trade. Named here rather than left quiet, because an
 * export whose production reader has gone is exactly what #1554 was about.
 *
 * # What it costs, stated beside the choice (disappearing-technology law, 3)
 *
 *   price     one extra render per Sign, **$0.14–$0.15** at this size. House
 *             money; no customer credit moves, and the Sign's 8,500 is untouched.
 *
 *             ⚠ **THIS BAND IS RECORDED HERE RATHER THAN CITED, since #1554.**
 *             It read *"the band `createFalSunburstViewEngine` records"* until
 *             that factory was deleted — a pointer, not a copy, and a deletion
 *             would have taken the readings with it. They are THREE, all n=1 or
 *             near it, none of them settling the last cent, and they are stated
 *             as a band rather than a middle because fal's balance is quantised
 *             to the cent and a one-render subtraction cannot resolve finer:
 *             #1394's price phase, a SETTLED balance either side of one render,
 *             **$0.14** (14.77 → 14.63); #1451's 24-render window, dividing to
 *             **$0.1429** with the residue putting Sunburst at ~$0.136; and
 *             #1459's own drive through the deleted factory, **$0.15** (21.68 →
 *             settled 21.53). They are a signed view's readings and they apply
 *             here unchanged because the pixel budget is within 1% of one
 *             (8.19 MP against 8.24 MP). It is NOT in
 *             {@link FAL_MEASURED_USD_PER_IMAGE} — see the note there; that
 *             table is keyed on MODEL and this endpoint's price moves with the
 *             SIZE, so a single number would misprice the repaint road.
 *   latency   ~52 s a picture at this size against Nano Banana Pro's ~29 s
 *             (#1451, p95 65.5 s) — also moved here from the deleted block. One
 *             render, and it runs IN PARALLEL with the three views that do not
 *             wait for it, so what a customer waits is not 52 s added, it is
 *             the plate's render standing where the full-length pair's would
 *             have started. Re-measured on THIS door with a master beside it
 *             (#1471): 70.8 s on Sifr, 55.9 s on the creature — slower, because
 *             the door now reads a 2.6 MB master.
 *   quality   his eye, on a real Sign's strip (law 9). Not claimed here. His
 *             own compromise, verbatim on the outfit court: *"compromise on
 *             that additional detail from NBP 2k"* — less skin and hair texture
 *             than Nano Banana Pro 2K, accepted for the invented outfit.
 */
export function createFalSunburstPlateEngine(config: {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  queue?: ProviderQueue;
}): IdentityEngine {
  if (!config.apiKey) {
    /* Refused at construction for the reason its sibling is: a Sign that
       reaches dispatch has already taken 8,500 credits. */
    throw new ProviderError("capability", "the outfit plate needs FAL_KEY to render");
  }
  const model = config.model ?? FAL_GPT_IMAGE_25_SUNBURST_EDIT;
  const timeoutMs = config.timeoutMs ?? 300_000;
  const pollIntervalMs = config.pollIntervalMs ?? 1_500;
  const queue =
    config.queue ?? new ProviderQueue({ name: "fal-outfit-plate", concurrency: 1, maxQueueDepth: 32 });

  async function edit(request: IdentityEditRequest): Promise<ImageResult> {
    if (request.resolution !== "2K") {
      throw new ProviderError(
        "capability",
        `the outfit plate engine renders one plate size only — asked for ${request.resolution}`,
      );
    }
    /*
      ⚠ **IT REFUSES AN EMPTY REFERENCE LIST, AND THAT REFUSAL IS THE EXACT
      INVERSE OF THE ONE THAT STOOD HERE YESTERDAY (#1471).** The plate was
      generated from words for one day and his ruling ended it, verbatim: *"no
      the plate must reference the master image otherwise it wouldnt be able to
      invent the outfit correctly"*. So this door is the EDIT door now, and an
      edit with nothing to edit is the one request it cannot serve — measured on
      the real door during #1278's build, **422: "Number of image URLs must be
      at least 1"**. Refusing before dispatch turns that 422 into a sentence,
      and `renderOutfitPlate` turns the sentence into "no plate" rather than
      into a failed Sign.
    */
    if (request.references.length < 1) {
      throw new ProviderError(
        "capability",
        "the outfit plate is edited from the master and needs at least one reference image",
      );
    }
    /*
      The same ceiling its sibling carries, taken from the same constant rather
      than typed again — see {@link SIGNED_VIEW_MAX_REFERENCES}, whose docblock
      says plainly that the number is Nano Banana Pro's and is unverified for
      this door. Carrying it is the choice that changes nothing; inventing a
      different number for the same endpoint would be the guess.
    */
    if (request.references.length > SIGNED_VIEW_MAX_REFERENCES) {
      throw new ProviderError("capability", "too many reference images for the outfit plate engine");
    }

    return queue.run("outfitPlate", () =>
      withRetry(
        "fal.outfitPlate",
        async () => {
          const job = await runFalImageJob({
            apiKey: config.apiKey,
            endpoint: model,
            body: {
              prompt: request.prompt,
              image_urls: request.references.map(
                (reference) =>
                  `data:${reference.contentType};base64,${reference.bytes.toString("base64")}`,
              ),
              image_size: OUTFIT_PLATE_SIZE,
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
            /* The endpoint that painted, never a constant — same reason as the
               view engine's: a gap reads as UNPRICED, not as another price. */
            estimatedCostUsd: measuredUsdPerImage(model),
            provenance: { provider: "fal" as const, model, providerRef: job.requestId },
          };
        },
        { signal: request.signal },
      ),
    );
  }

  return {
    id: `fal:${model}:plate`,
    editWithReferences: edit,
    async generateView(request: IdentityEditRequest & { viewAngle: string }): Promise<ImageResult> {
      return edit({ ...request, prompt: `${request.prompt}\n\nView: ${request.viewAngle}.` });
    },
  };
}

/**
 * THE SIGN SHEET'S ENGINE — GPT Image 2.5 Sunburst at `high`, on the edit door.
 *
 * It is {@link createFalSunburstPlateEngine}'s sibling and shares its door, its
 * quality and its three refusals; what differs is the SIZE it asks for and the
 * fact that **what comes back is DELIVERED to a customer** rather than used as
 * a reference nobody ever sees. That second difference is why this is a
 * separate factory and not a size argument on the plate's: the plate's own
 * docblock records that it is a door the next ruling can move without touching
 * its neighbour, and a factory shared by a scratch reference and five paid
 * pictures is a factory no ruling can move safely.
 *
 * ⚠ **IT IS NOT THE PLATE ENGINE WITH A WIDER ASK.** A caller that handed the
 * plate's factory a sheet size would get a picture of the right
 * shape with the plate's prompt discipline around it; the two roads carry
 * different prompts, different reference rules and — from this card — different
 * lifetimes. Keeping them apart costs one factory and buys the ability to
 * price, measure and retire either one on its own.
 *
 * What is measured here, and what is not:
 *
 *   size      the caller's, required — see this factory's `size` argument and
 *             `signSheet.SIGN_SHEET_SIZES`, which carries the reading at the
 *             RETURNED BYTES of all five real sheets. Never inferred from the
 *             ask, which this endpoint reports as `width: null`.
 *   latency   **~61–69 s a sheet**, three runs (#1690, 2026-10-07), against the
 *             ~1.5–2 min recorded for today's plate plus five views. One render
 *             stands where six stood, so the saving is a customer's whole wait
 *             rather than a slice of it.
 *   cost      **~$0.07 a sheet** — a fal balance reading across that court,
 *             quantised to the cent, against ~$0.90 for today's road (plate
 *             ~$0.145 + 5 × Nano Banana Pro 2K at ~$0.15). ⚠ It is deliberately
 *             NOT added to {@link FAL_MEASURED_USD_PER_IMAGE}: that table is
 *             keyed on MODEL and this endpoint's price moves with the SIZE, so
 *             one number there would misprice the plate and the repaint — the
 *             defect that table's own docblock warns about twice. The figure
 *             lives here, where a size can be recorded beside it, and
 *             `estimatedCostUsd` therefore comes back `undefined`, which reads
 *             as UNPRICED rather than as another price.
 *   quality   **his eye, on the cut views of those three sheets** (law 9), and
 *             it is the only reason this engine exists. Not claimed by this
 *             docblock. His own named compromise rides with it: a delivered
 *             view is about **620–870 × 1648** where today's is 1696x2528 —
 *             roughly 30% of the pixels — and he judged the cut views at that
 *             size before saying go.
 */
export function createFalSunburstSheetEngine(config: {
  apiKey: string;
  /**
   * THE PIXELS THIS ENGINE ASKS FOR — required, and deliberately without a
   * default.
   *
   * ⚠ **A default here would be the defect this argument exists to prevent.**
   * His #1926 ruling renders two sheets of different shapes, and the panel
   * ASPECT is the entire reason there are two: one five-panel sheet showed 58%
   * of a paid view in the strip, the two shipped shapes show 94–97%. A caller
   * that forgot the argument would silently get the other sheet's shape, the
   * cut would succeed, and nothing downstream could see it — #1903 left the
   * judge three axes and none of them is framing.
   *
   * The numbers and their measurement live on `signSheet.SIGN_SHEET_SIZES`,
   * beside the panel list they have to agree with. This layer takes them as an
   * argument rather than importing them: `providers/` sits below
   * `castingV2/`, and a provider reaching up for a product constant is a
   * dependency direction this tree does not have anywhere else.
   *
   * ⚠ **WHAT THE DOOR DOES TO AN ASK IT DOES NOT LIKE IS THE CONSTRAINT ON
   * ANY FUTURE NUMBER, and it belongs here because that is this layer's own
   * fact.** {@link OUTFIT_PLATE_SIZE}'s docblock carries the two measured
   * behaviours: the door preserves aspect and **caps the long side at 3840**
   * (#1394 — 4688x1760 asked, 3840x1440 answered, every time). Both shipped
   * sheets sit at or under that cap (head's long side IS 3840, body's is
   * 3504), which is why both come back unscaled. ⚠ **A size whose long side
   * exceeds 3840 will be silently resized, and the cut would then divide a
   * picture of the wrong shape** — so a new sheet shape is read at the
   * returned bytes before it is trusted, never at the ask.
   */
  size: { width: number; height: number };
  model?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  queue?: ProviderQueue;
}): IdentityEngine {
  if (!config.apiKey) {
    /* Refused at construction for the reason both its siblings are: a Sign that
       reaches dispatch has already taken 8,500 credits, so a credential nobody
       set is a configuration fault and never a generation failure a customer
       should have to be refunded for. */
    throw new ProviderError("capability", "the Sign sheet needs FAL_KEY to render");
  }
  const model = config.model ?? FAL_GPT_IMAGE_25_SUNBURST_EDIT;
  const timeoutMs = config.timeoutMs ?? 300_000;
  const pollIntervalMs = config.pollIntervalMs ?? 1_500;
  const queue =
    config.queue ?? new ProviderQueue({ name: "fal-sign-sheet", concurrency: 1, maxQueueDepth: 32 });

  async function edit(request: IdentityEditRequest): Promise<ImageResult> {
    if (request.resolution !== "2K") {
      /*
        The signed-view TIER, and the word is a role rather than a pixel count —
        `packageOrchestrator`'s own note on `resolution: "2K"` says so at
        length: it names the tier the 1K anchor is not, and
        `model_assets.resolution` keeps saying it so the two readers asking *is
        this a full view rather than the anchor?* keep working. A sheet carries
        five views of that tier, so it asks for that tier.
      */
      throw new ProviderError(
        "capability",
        `the Sign sheet engine renders one sheet size only — asked for ${request.resolution}`,
      );
    }
    /*
      An edit with nothing to edit is the one request this door cannot serve —
      measured on the real door during #1278's build, **422: "Number of image
      URLs must be at least 1"**. His card names exactly one reference (*"One
      reference: her signed master"*), and refusing here turns that 422 into a
      sentence before any money moves.
    */
    if (request.references.length < 1) {
      throw new ProviderError(
        "capability",
        "the Sign sheet is edited from the signed master and needs at least one reference image",
      );
    }
    if (request.references.length > SIGNED_VIEW_MAX_REFERENCES) {
      throw new ProviderError("capability", "too many reference images for the Sign sheet engine");
    }

    return queue.run("signSheet", () =>
      withRetry(
        "fal.signSheet",
        async () => {
          const job = await runFalImageJob({
            apiKey: config.apiKey,
            endpoint: model,
            body: {
              prompt: request.prompt,
              image_urls: request.references.map(
                (reference) =>
                  `data:${reference.contentType};base64,${reference.bytes.toString("base64")}`,
              ),
              image_size: config.size,
              num_images: 1,
              /* His word: *"sunburst 2.5 max quality for the sign sheet"*. */
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
            /* UNPRICED on purpose — see this factory's docblock. The ~$0.07
               reading is size-keyed and that table is model-keyed. */
            estimatedCostUsd: measuredUsdPerImage(model),
            provenance: { provider: "fal" as const, model, providerRef: job.requestId },
          };
        },
        /*
          ⚠ **The sheet is the one engine that carries a render budget (#1968),
          because it is the one whose price was set on a bounded render count.**
          Cid's flat 650 for a Sign holds at 2 paid renders per sheet; the
          counting happens inside `withRetry`, which is the only layer that sees
          each submission. A caller that passes none is unbounded exactly as
          before.
        */
        { signal: request.signal, ...(request.renderBudget ? { budget: request.renderBudget } : {}) },
      ),
    );
  }

  return {
    id: `fal:${model}:sheet`,
    editWithReferences: edit,
    /*
      ⚠ **A SHEET HAS NO ANGLE, AND THIS IS THE PLACE THAT HAS TO SAY SO.** The
      plate's sibling appends `View: <angle>.` to its prompt here, which is
      harmless for a two-panel reference nobody judges. A sheet carries all five
      cameras in one frame and its prompt declares them panel by panel, so a
      trailing `View: closeUp.` is an instruction to make the WHOLE SHEET a
      close-up, fighting the four panel lines above it. The road a caller might
      reach for out of habit therefore REFUSES, rather than quietly composing a
      prompt that contradicts itself.
    */
    async generateView(): Promise<ImageResult> {
      throw new ProviderError(
        "capability",
        "the Sign sheet is one frame holding every view — render it with editWithReferences, "
        + "never per angle",
      );
    },
  };
}
