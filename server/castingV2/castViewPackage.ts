/**
 * The canonical view package a Sign buys (plan §H.4/§H.10, §I `viewPackageProfile`).
 *
 * Six slots, all rendered at 2K by the identity engine, all held against the
 * signed anchor. This module owns three things and deliberately nothing else:
 *
 *   1. **The SPEC** — what each slot promises the customer, in plain words.
 *   2. **The directive** — what the generator is told, composed FROM the spec.
 *   3. **The price** — derived from the number of views actually promised.
 *
 * The direction of that second arrow is the whole point, and it is D-92's
 * ruling in code: **view conformance is judged against the SPEC, never against
 * the generation prompt.** A judge handed the prompt is asked "did the model do
 * as it was told", which is prompt compliance — the settled anti-pattern, and a
 * check that passes happily while the picture is wrong in a way nobody
 * described. A judge handed the spec is asked "is this the thing we sold", and
 * that is a question a customer would recognise.
 *
 * So `spec` is authored first, in customer words; `directive` is built from it
 * for the generator; `expectation` is built from it for the judge; and the
 * judge never sees the directive or the code-owned constant. `castViewPackage.test.ts`
 * holds that separation open — it is one refactor away from collapsing.
 *
 * ONE COHORT'S WORTH. This is the photoreal-human profile. The cohort registry
 * (M9) will hold several, keyed by cohortKey; the shape here is what it will
 * absorb, not a second design.
 */
import {
  CANONICAL_VIEW_ANGLES,
  VIEW_ANGLE_LABELS,
  type CanonicalViewAngle,
} from "../../shared/boardTypes";
import { CASTING_V2_SIGN_COSTS } from "../casting/castingCreditCosts";
import { PHOTOREAL_HUMAN_BLOCKS } from "./cohortPhotorealHuman";

/**
 * The six canonical slots, in the order the room renders them.
 *
 * Derived from `CANONICAL_VIEW_ANGLES` rather than re-listed: the `modelAssets`
 * viewType enum, the legacy package and this package must name the same six
 * things, and a second hand-maintained list is how they stop doing that.
 */
export const CAST_PACKAGE_VIEWS: readonly CanonicalViewAngle[] = CANONICAL_VIEW_ANGLES;

/** The refundable slice, per view. */
export const CAST_PACKAGE_VIEW_PRICE = CASTING_V2_SIGN_COSTS.view;

/**
 * 200 + 6 × 50 = 500 credits (§H.10).
 *
 * Derived from the view list's own length, so a cohort that promises five views
 * or seven cannot quote a price for six. The client is served this number; it
 * never carries a literal (D-15).
 */
export const CASTING_V2_SIGN_PRICE_CREDITS =
  CASTING_V2_SIGN_COSTS.promotion + CAST_PACKAGE_VIEW_PRICE * CAST_PACKAGE_VIEWS.length;

/**
 * The wardrobe the whole package is in — the contemporary world's rest state,
 * the same garment the sheet cast them in.
 *
 * One authored sentence, read by the generator and by the judge. It is a
 * *spec*, not a prompt fragment: "did the shirt change between the headshot and
 * the walk" is a question about the product, and the answer has to be checkable
 * without knowing what we asked for. The M3 calibration is why this axis exists
 * at all — the identity held across the package while the wardrobe quietly did
 * not, and nothing in the design would have caught it.
 */
export const CAST_PACKAGE_WARDROBE_SPEC =
  "a plain unbranded mid-grey crew-neck t-shirt, unchanged across every view; "
  + "on full-length views, plain unbranded mid-grey trousers and plain unbranded shoes. "
  + "No jacket, no jewellery, no hat, no bag, no props, no printed text or logos anywhere.";

export type CastPackageViewSpec = {
  /** What the customer is looking at. */
  framing: string;
  /** The garment contract, shared by every slot. */
  wardrobe: string;
};

type CastPackageView = {
  angle: CanonicalViewAngle;
  label: string;
  spec: CastPackageViewSpec;
  /**
   * The generation directive for this angle.
   *
   * Ported from the legacy per-angle framing craft (`geminiViews.ts`
   * `SINGLE_VIEW_PROMPTS`) per §I's craft-reference law — the direction-naming
   * ("toward the RIGHT EDGE OF THE OUTPUT FRAME") and the true-90°-vs-45°
   * distinction are hard-won and were the difference between a profile and a
   * near-profile. Consulted and adopted per item, not inherited wholesale.
   */
  directive: string;
};

const WARDROBE = CAST_PACKAGE_WARDROBE_SPEC;

const VIEWS: Record<CanonicalViewAngle, CastPackageView> = {
  frontClose: {
    angle: "frontClose",
    label: VIEW_ANGLE_LABELS.frontClose,
    spec: {
      framing:
        "a head-and-shoulders portrait, square to the camera, both eyes visible, "
        + "the whole hair silhouette inside the frame with headroom above it",
      wardrobe: WARDROBE,
    },
    directive:
      "FRONT-FACING HEAD AND SHOULDERS PORTRAIT. Square to camera, head straight with no tilt, "
      + "both eyes looking directly into the lens. The entire hair silhouette is inside the frame "
      + "with clear headroom above it — nothing on the head is clipped.",
  },
  threeQuarter: {
    angle: "threeQuarter",
    label: VIEW_ANGLE_LABELS.threeQuarter,
    spec: {
      framing:
        "a head-and-shoulders portrait with the head turned about 45 degrees to the subject's "
        + "left (their nose toward the right edge of the frame), both eyes still visible",
      wardrobe: WARDROBE,
    },
    directive:
      "RIGHT-FACING THREE-QUARTER PORTRAIT. Head and shoulders only. The subject's nose points "
      + "diagonally toward the RIGHT EDGE OF THE OUTPUT FRAME at a 45-degree turn; both eyes remain "
      + "visible. Never mirror the direction. The entire hair silhouette stays inside the frame.",
  },
  frontFull: {
    angle: "frontFull",
    label: VIEW_ANGLE_LABELS.frontFull,
    spec: {
      framing:
        "the whole body from the top of the hair to the feet, standing square to the camera, "
        + "arms relaxed at the sides, nothing cropped at the top or bottom of the frame",
      wardrobe: WARDROBE,
    },
    directive:
      "FULL BODY FRONT VIEW. The subject stands square to camera, head to feet entirely inside the "
      + "frame with margin above the hair and below the shoes. Arms relaxed at the sides, weight even, "
      + "standing still rather than posing.",
  },
  sideClose: {
    angle: "sideClose",
    label: VIEW_ANGLE_LABELS.sideClose,
    spec: {
      framing:
        "a head-and-shoulders TRUE side profile — the face turned a full 90 degrees so only one eye "
        + "is visible, not a three-quarter turn",
      wardrobe: WARDROBE,
    },
    directive:
      "STRICT RIGHT-FACING SIDE PROFILE PORTRAIT. Head and shoulders only. The subject's nose points "
      + "toward the RIGHT EDGE OF THE OUTPUT FRAME; show one eye and a true 90-degree profile, never a "
      + "three-quarter view.",
  },
  sideFull: {
    angle: "sideFull",
    label: VIEW_ANGLE_LABELS.sideFull,
    spec: {
      /*
        The sixth slot is a WALK, not a standing side view (D-44). The label the
        whole product uses for it is "Walk", so a spec describing a static
        profile would be judging a different photograph from the one the room
        promises.
      */
      framing:
        "the whole body in a walking stride, seen from the side — head to feet inside the frame, "
        + "the walk genuinely in motion rather than a standing pose",
      wardrobe: WARDROBE,
    },
    directive:
      "STRICT RIGHT-FACING FULL BODY SIDE PROFILE, WALKING. The subject's nose and toes point toward "
      + "the RIGHT EDGE OF THE OUTPUT FRAME; the torso stays in true profile and the stride is mid-walk. "
      + "Head to feet entirely inside the frame.",
  },
  backFull: {
    angle: "backFull",
    label: VIEW_ANGLE_LABELS.backFull,
    spec: {
      framing:
        "the whole body seen from directly behind, head to feet inside the frame, face not visible",
      wardrobe: WARDROBE,
    },
    directive:
      "FULL BODY FROM BEHIND, walking away from camera. Head to feet entirely inside the frame. "
      + "The face is not visible. Add nothing to the back or arms that the reference does not show.",
  },
};

export function castPackageView(angle: CanonicalViewAngle): CastPackageView {
  return VIEWS[angle];
}

/**
 * The instruction the identity engine receives for one slot.
 *
 * Order matters and mirrors the sheet composer's: the identity instruction and
 * the angle first, then the code-owned constant LAST with authority over
 * everything above it. The anchor image travels separately as a reference —
 * this text never describes the person, because describing them is how a
 * likeness drifts into a lookalike.
 */
export function composePackageViewPrompt(angle: CanonicalViewAngle): string {
  const view = VIEWS[angle];
  return [
    "Keep this exact person unchanged: the same face, bone structure, skin, hair, facial hair and build "
    + "as the reference photograph. This is the same individual in a different photograph, never a "
    + "similar-looking person.",
    view.directive,
    `WARDROBE: ${view.spec.wardrobe}`,
    PHOTOREAL_HUMAN_BLOCKS.capture,
    PHOTOREAL_HUMAN_BLOCKS.realism,
    PHOTOREAL_HUMAN_BLOCKS.identityIntegrity,
    PHOTOREAL_HUMAN_BLOCKS.negatives,
    PHOTOREAL_HUMAN_BLOCKS.authority,
  ].join("\n");
}

/**
 * What the judge is told this slot should be — the spec, in customer words,
 * and nothing else.
 *
 * Deliberately assembled from `spec` alone. If this function ever reaches for
 * `directive` or a constant block, view conformance silently becomes prompt
 * compliance and the check stops being worth running.
 */
export function packageViewExpectation(angle: CanonicalViewAngle): CastPackageViewSpec {
  const { spec } = VIEWS[angle];
  return { framing: spec.framing, wardrobe: spec.wardrobe };
}
