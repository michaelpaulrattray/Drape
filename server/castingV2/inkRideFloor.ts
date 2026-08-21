/**
 * AN INK CARRY UNDER THE FLOOR IS ENLARGED AT RIDE TIME — the record is not
 * touched, only what the engine is handed (opus-941 §5, granted fable-1280 §1).
 *
 * # The finding this exists for
 *
 * The founder's chest piece came back re-arranged on a render that never
 * mentioned ink. Two candidate causes were put to the dispatch record and both
 * DIED at the artifact: the carry sentence already carries the realism clauses,
 * and the clothing clause was already on the wire on the very render that
 * failed. The third suspect was a number, and it was in the record all along:
 *
 * ```
 *   references[1]  kind: carry · slot: ink:upperChest
 *                  sentGeometry: "504x223"   <- against a 1024x1536 master
 * ```
 *
 * 223 px on the shortest side, against a floor of 256 that HIS OWN COURT bought
 * — six paid frames, one design, one placement, reference size the only
 * variable, which measured that an under-floor reference delivers *"a sparse
 * strand with the design's own subject missing"* and that the upscaled copy
 * brings it back (`inkReferenceUpscale.ts`, ruled fable-1210 §1). The whole
 * delivered-crop population was under it, and the geometry columns said why:
 * `width == bboxW` on every row, a crop cut 1:1 out of the frame with nothing
 * enlarging it anywhere.
 *
 * **This is the third instance of one class in this codebase** (working law 7):
 *
 * ```
 *   earring captions   cut 1:1, 24-36 px. A hoop with a CROSS HANGING FROM IT
 *                      read as "smooth and continuous" 4/4 — and the cross was
 *                      named 4/4 once resized.   Fixed: LEGIBLE_LONG_EDGE 512
 *   uploaded designs   cut 1:1.   Fixed: INK_DESIGN_MIN_EDGE + upscaleToFloor
 *   delivered crops    cut 1:1.   NO FLOOR AT ALL — this module
 * ```
 *
 * `realizationCaption.ts` states the general rule and it is the rule here:
 * **the cure for a picture too small to read is a bigger picture, not a broader
 * question.** A fourth clause said to a lane where three are already losing is
 * what `inkRealism.ts`'s own header warns about.
 *
 * # WHY AT RIDE AND NOT AT MINT, which is the whole licence for it
 *
 * fable-1275 §1 and fable-1276 §1 draw the line this sits on: **the RECORD
 * updates only from delivered frames; INSTRUCTION MATERIAL is editable and dies
 * with its ask.** So the stored crop stays byte-faithful to the frame it was cut
 * from — nothing in `casting_ink_delivery_crops` moves, no migration, no new
 * flag, no stored byte changes — and what the engine is handed is a per-ask copy
 * big enough to read. It is the same shape as the partial-edit copy with the
 * motif alpha'd out: a transport artefact, made for one request, kept by nobody.
 *
 * The digest arm is structural rather than promised: `repaintRender` takes each
 * reference's digest BEFORE it calls the fitter, so the pixel-frozen proof is
 * still taken against the library's own bytes and this cannot launder a moved
 * object. That ordering is a contract in `repaintRender`'s own header, and the
 * arm in `refineService.test.ts` drives it through the production caller.
 *
 * # A REFUSAL HERE IS NEVER A REFUSED RENDER
 *
 * The upload door refuses a cut it cannot enlarge, because a door may refuse.
 * This is not a door — it is the transport of a render the customer has already
 * been charged for, and today's behaviour is that the crop rides at whatever
 * size it is. So every failure degrades to exactly that, loudly: no transport
 * configured, an upscaler that would not answer, a picture nothing could
 * measure. The fit callback around it takes the same posture for the same
 * reason ("a failure to measure is UNKNOWN rather than fatal").
 *
 * **An unmeasurable reference rides native and is NOT treated as small.** Zero
 * is not a size. Reading `min(0, 0) < 256` as *under the floor* would buy an
 * upscale for every reference whose bytes sharp cannot open, which is the
 * `negative-arm` mistake of letting one sentinel mean both *absent* and
 * *too small*.
 *
 * # WHAT IT COSTS
 *
 * One house call per carried ink reference that is actually under the floor, on
 * the shared `FAL_CONCURRENCY` courtesy pool — `upscaleToFloor` is the owner and
 * declares no allowance of its own, so `assertFalBudget`'s ceiling arithmetic is
 * untouched (fable-1210 §1a). A carry already over the floor rides
 * BYTE-IDENTICAL and buys nothing: the enlargement is not merely skipped, the
 * bytes are the same object, which is what the over-floor arm asserts.
 *
 * # ⚠ IT COVERS BOTH INK PICTURES, AND THAT IS WIDER THAN THE FINDING —
 * # DECLARED RATHER THAN QUIET
 *
 * fable-1280 §1's grant names the DELIVERED CROP, which is the road the founder
 * is on and the only one measured under the floor. This module is aimed at any
 * ink carry, artwork included, and the reason is the one `inkUploadService`
 * already wrote down about its own rescue: **a wire that enlarged the delivered
 * crop and still handed the engine a 183 px artwork would admit the bigger
 * picture and refuse the smaller one, which is the wrong way round.** The
 * artwork road has a floor at its own door, so for a design uploaded inside
 * `CASTING_INK_REGION_CROP_SCOPE` this is unreachable by construction; it is a
 * backstop for rows minted before that flag existed or with it off. Nothing
 * about the delivered-crop behaviour differs either way.
 */
import sharp from "sharp";

import { createModuleLogger } from "../logging/logger";
import { INK_DESIGN_MIN_EDGE } from "./inkUploadDoor";
import type { InkUpscaleResult } from "./inkReferenceUpscale";

const log = createModuleLogger("castingV2/inkRideFloor");

/**
 * The enlargement, as a capability rather than as a vendor. `upscaleToFloor`
 * satisfies it, and its null means *this cut is still too small* — which on
 * this road means *ride it as it is*, not *refuse*.
 */
export type InkFloorUpscale = (
  cut: { bytes: Buffer; width: number; height: number },
  /* Handed down rather than re-composed at the far end, so the vendor's own
     lines — the declared fallback, the refusal, the pass that did not grow —
     join to the same render as this module's. A rescue that cannot be traced
     back to the operation it was bought for is a cost with no reader. */
  about: Record<string, unknown>,
) => Promise<InkUpscaleResult | null>;

export type InkRideBytes = {
  bytes: Buffer;
  contentType: string;
  /** Zero when nothing could measure it — the fitter's own convention, which
      the dispatch record reads back as a `null` geometry rather than a size. */
  width: number;
  height: number;
};

/**
 * Measure the bytes about to go out. A picture sharp cannot open is UNKNOWN,
 * never small — see the header.
 */
async function measured(bytes: Buffer, contentType: string): Promise<InkRideBytes> {
  try {
    const meta = await sharp(bytes).metadata();
    return { bytes, contentType, width: meta.width ?? 0, height: meta.height ?? 0 };
  } catch {
    return { bytes, contentType, width: 0, height: 0 };
  }
}

/**
 * Hand back the bytes this ink carry should go out as.
 *
 * Never throws and never refuses: the worst case is the picture that would have
 * ridden anyway, with a line in the log saying why it did.
 */
export async function inkCarryAtFloor(input: {
  bytes: Buffer;
  contentType: string;
  upscale?: InkFloorUpscale;
  about: Record<string, unknown>;
}): Promise<InkRideBytes> {
  const native = await measured(input.bytes, input.contentType);

  if (native.width === 0 || native.height === 0) {
    log.warn(
      { ...input.about, floor: INK_DESIGN_MIN_EDGE },
      "[inkRideFloor] an ink carry's bytes could not be measured — riding it exactly as today, which is what an unknown size means",
    );
    return native;
  }
  if (Math.min(native.width, native.height) >= INK_DESIGN_MIN_EDGE) return native;

  if (input.upscale === undefined) {
    log.warn(
      { ...input.about, size: `${native.width}x${native.height}`, floor: INK_DESIGN_MIN_EDGE },
      "[inkRideFloor] an ink carry is under the floor and there is no upscaler on this path — riding it small, which is the old behaviour said out loud",
    );
    return native;
  }

  const grown = await input.upscale(
    { bytes: native.bytes, width: native.width, height: native.height },
    input.about,
  ).catch((error: unknown) => {
    /* `upscaleToFloor` swallows its own transport failures; this catches the
       ones it cannot — a sharp throw in the alpha re-attach, an aborted
       request. A paid render does not fall over because a rescue did. */
    log.warn(
      { ...input.about, err: error instanceof Error ? error.message : String(error) },
      "[inkRideFloor] the enlargement threw — riding the crop at its own size rather than failing a paid render",
    );
    return null;
  });

  if (grown === null) {
    log.info(
      { ...input.about, size: `${native.width}x${native.height}`, floor: INK_DESIGN_MIN_EDGE },
      "[inkRideFloor] the ink carry could not be brought to the floor — riding it small, exactly as this road does today",
    );
    return native;
  }

  log.info(
    {
      ...input.about,
      was: `${native.width}x${native.height}`,
      went: `${grown.width}x${grown.height}`,
      model: grown.model,
      passes: grown.passes,
      floor: INK_DESIGN_MIN_EDGE,
    },
    "[inkRideFloor] the ink carry went out enlarged to the floor — the stored crop is untouched, this copy dies with the ask",
  );
  return {
    bytes: grown.bytes,
    /* `upscaleToFloor` re-encodes as PNG with OUR alpha re-attached, so the
       type is stated from what came back rather than carried from what went
       in. */
    contentType: "image/png",
    width: grown.width,
    height: grown.height,
  };
}
