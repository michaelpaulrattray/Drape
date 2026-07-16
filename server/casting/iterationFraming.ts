/**
 * Typed-iteration framing — V1+V14 (R6 Batch A-coupled, Codex-review
 * corrected).
 *
 * Two exhaustive maps from canonical view angle, both keyed by
 * CanonicalViewAngle so a future canonical angle fails compilation here
 * instead of silently inheriting a default:
 *
 *  - CROP: the close trio (frontClose/sideClose/threeQuarter) is HEADSHOT,
 *    the body trio FULL_BODY. This drives camera distance and the
 *    close-portrait geometry lock in the iterate prompt.
 *  - FRAME DIRECTIVE: the per-angle instruction that actually reaches the
 *    image-model prompt. The era-0 binary collapsed every close view to
 *    "STRAIGHT-ON HEADSHOT" — which would rotate a sideClose or
 *    threeQuarter edit toward the camera. Each canonical angle now carries
 *    its own orientation-PRESERVATION directive: iteration is an edit of
 *    the selected source asset, so the directive preserves the source's
 *    camera angle, orientation, and pose — it never asks for a new pose.
 *
 * Product truth (execution plan, Batch A-coupled): typed iteration remains
 * an INDIVIDUAL selected-image generation against the view's own image —
 * not composed from canon or anchor references (composeIdentityPayload is
 * never consulted here), and it does not synchronize sibling views. The
 * stale-writer marks divergence; propagation limits are unchanged until the
 * Batch D composer.
 */
import { TRPCError } from "@trpc/server";
import type { CanonicalViewAngle } from "@shared/boardTypes";
import { isCanonicalViewType } from "@shared/exportViews";

export type IterationCrop = "HEADSHOT" | "FULL_BODY";

export interface IterationFraming {
  viewAngle: CanonicalViewAngle;
  crop: IterationCrop;
}

export const ITERATION_CROP_BY_VIEW: Record<CanonicalViewAngle, IterationCrop> = {
  frontClose: "HEADSHOT",
  sideClose: "HEADSHOT",
  threeQuarter: "HEADSHOT",
  frontFull: "FULL_BODY",
  sideFull: "FULL_BODY",
  backFull: "FULL_BODY",
};

/**
 * The per-angle VISUAL RULES directive for the iterate prompt. Wording is
 * deliberate: each view names its own orientation and forbids the rotation
 * the model would otherwise drift toward; no directive asks for a new pose.
 * (Kept free of other views' orientation vocabulary so the six-angle prompt
 * tests can assert real exclusions, not incidental word overlaps.)
 */
export const ITERATION_FRAME_DIRECTIVES: Record<CanonicalViewAngle, string> = {
  frontClose:
    "STRAIGHT-ON HEADSHOT. CLOSE UP FACIAL PORTRAIT. PRESERVE THE SOURCE IMAGE'S STRAIGHT-ON, FRONT-FACING HEAD ORIENTATION EXACTLY. MAINTAIN EXACT CAMERA DISTANCE.",
  sideClose:
    "CLOSE UP FACIAL PORTRAIT IN EXACT SIDE PROFILE. PRESERVE THE SOURCE IMAGE'S SIDE-PROFILE HEAD ORIENTATION EXACTLY — DO NOT ROTATE THE HEAD TOWARD THE CAMERA. MAINTAIN EXACT CAMERA DISTANCE.",
  threeQuarter:
    "CLOSE UP FACIAL PORTRAIT AT THE SOURCE IMAGE'S EXACT THREE-QUARTER HEAD ANGLE. PRESERVE THAT THREE-QUARTER ORIENTATION EXACTLY — DO NOT ROTATE THE HEAD IN EITHER DIRECTION. MAINTAIN EXACT CAMERA DISTANCE.",
  frontFull:
    "FULL BODY FASHION SHOT. HEAD TO TOE VISIBLE. PRESERVE THE SOURCE IMAGE'S FRONT-FACING BODY ORIENTATION AND POSE EXACTLY.",
  sideFull:
    "FULL BODY FASHION SHOT. HEAD TO TOE VISIBLE. PRESERVE THE SOURCE IMAGE'S SIDE-ON WALKING ORIENTATION AND POSE EXACTLY — DO NOT ROTATE THE SUBJECT.",
  backFull:
    "FULL BODY FASHION SHOT. HEAD TO TOE VISIBLE. PRESERVE THE SOURCE IMAGE'S REAR, BACK-FACING BODY ORIENTATION EXACTLY — DO NOT TURN THE SUBJECT AROUND.",
};

/**
 * Resolve the complete typed framing (canonical angle + crop class) for a
 * stored asset's view type. Fails CLOSED on a non-canonical view type
 * (legacy era-0 rows, corrupted data): refusing is safer than guessing a
 * frame, and the caller resolves this BEFORE any generation record,
 * deduction, or image call.
 */
export function iterationFramingForView(viewType: string): IterationFraming {
  if (!isCanonicalViewType(viewType)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "This image uses a legacy view format that can't be edited safely — regenerate the view from the comp card first.",
    });
  }
  return { viewAngle: viewType, crop: ITERATION_CROP_BY_VIEW[viewType] };
}
