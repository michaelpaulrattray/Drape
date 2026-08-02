/**
 * The canonical view package a Sign buys (plan §H.4/§H.10, §I `viewPackageProfile`).
 *
 * Five slots, all rendered at 2K by the identity engine, all held against the
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
 * PACKAGE v2 — five views (founder ruling, 2026-08-02, after the first two real
 * Signs). Policy, not schema: a profile is what a cohort promises, and it is
 * expressed by choosing from the canonical angles rather than by inventing new
 * ones.
 *
 * What changed and why, because the reasoning is the useful part:
 *
 * - **`frontClose` is now a tight CLOSE-UP**, not a waist-up headshot. The
 *   founder's first Sign proved the old spec merely duplicated the anchor's own
 *   crop — the package contained no view of the face at detail scale, which is
 *   the single most useful reference a downstream generator can be given.
 * - **The walk is gone.** Motion belongs to Takes. It cost a slot that a
 *   reconstruction needs more: nothing else showed hair mass from behind at
 *   detail.
 * - The set a generator actually needs to rebuild a person from three-to-five
 *   references: **close-up** (detail), **front** (proportions), **profile**
 *   (bone structure), **back** (hair mass, and the garment surface VTO works
 *   on). **Three-quarter** stays for the comp-card deliverable.
 *
 * Ordered as the room reads them, and every entry must be a canonical angle —
 * `modelAssets.viewType` is a fixed enum and a profile that named something
 * outside it would fail at the first insert rather than at review.
 */
export const CAST_PACKAGE_VIEWS: readonly CanonicalViewAngle[] = [
  "frontClose",
  "threeQuarter",
  "frontFull",
  "sideClose",
  "backFull",
];

/** The refundable slice, per view. */
export const CAST_PACKAGE_VIEW_PRICE = CASTING_V2_SIGN_COSTS.view;

/**
 * 200 + 5 × 50 = 450 credits (§H.10, amended by the package-v2 ruling).
 *
 * Derived from the view list's own length, so a profile that promises five
 * views cannot quote a price for six. The client is served this number; it
 * never carries a literal (D-15).
 */
export const CASTING_V2_SIGN_PRICE_CREDITS =
  CASTING_V2_SIGN_COSTS.promotion + CAST_PACKAGE_VIEW_PRICE * CAST_PACKAGE_VIEWS.length;

/**
 * The wardrobe the whole package is in — **relative to the reference, never an
 * absolute colour.**
 *
 * One authored sentence, read by the generator and by the judge. It is a
 * *spec*, not a prompt fragment: "did the shirt change between the headshot and
 * the walk" is a question about the product, and the answer has to be checkable
 * without knowing what we asked for. The M3 calibration is why this axis exists
 * at all — the identity held across the package while the wardrobe quietly did
 * not, and nothing in the design would have caught it.
 *
 * **Why it names no colour, learned on the first real Sign (2026-08-02):** the
 * sheet's own framing rule casts candidates in "neutral grey OR off-white", and
 * this spec used to say "mid-grey". A candidate signed in off-white therefore
 * had a package that could not satisfy both halves of its own contract — the
 * generator obeyed the spec, the judge compared against the reference as it is
 * told to, and the headshot was correctly failed and refunded for a change WE
 * had specified. The customer paid for our inconsistency.
 *
 * The continuity the customer actually cares about is with the face they
 * signed, so that is what the spec asks for. It is also the only version that
 * stays true when the sheet's wardrobe latitude widens again.
 */
export const CAST_PACKAGE_WARDROBE_SPEC =
  "the SAME plain unbranded crew-neck top the reference photograph shows, in the same colour, "
  + "unchanged across every view; on full-length views, plain unbranded neutral trousers and plain "
  + "unbranded shoes in a tone that sits with it. "
  + "No jacket, no jewellery, no hat, no bag, no props, no printed text or logos anywhere.";

/**
 * The close-up's own wardrobe sentence.
 *
 * On a tight face crop the garment is barely in frame, so "does the shirt
 * match" is nearly unanswerable — and the judge is told that an axis it is
 * unsure about FAILS. Left as the shared sentence, this axis would refund
 * views for being hard to see, which is refund noise wearing a validator's hat.
 *
 * What is genuinely checkable at this crop, and genuinely worth checking, is
 * ADDITION: earrings, glasses, a collar logo — the things the package forbids
 * and a generator loves to invent. So the sentence names the collar line where
 * visible, names the additions as failures, and states plainly that seeing no
 * garment at all is a PASS. An axis that can fail for a real reason and cannot
 * fail for a silly one.
 */
const CLOSE_UP_WARDROBE =
  "at this crop the garment may be barely visible, and that is fine — if no clothing is in "
  + "frame, this passes. Where the collar IS visible it matches the reference's neckline and "
  + "colour. No earrings, no glasses, no piercings, no hat, no headphones, no visible logo or "
  + "text — nothing worn that the reference photograph does not show.";

export type CastPackageViewSpec = {
  /** What the customer is looking at. */
  framing: string;
  /** The garment contract — shared by every slot except the close-up. */
  wardrobe: string;
};

type CastPackageView = {
  angle: CanonicalViewAngle;
  /**
   * The package's OWN label, not the shared `VIEW_ANGLE_LABELS` entry.
   *
   * `frontClose` means "Headshot" everywhere else in the product, and legacy
   * assets under that name genuinely are head-and-shoulders. This profile's
   * `frontClose` is a tight close-up, so it says so — while the shared map
   * keeps telling the truth about everything else.
   */
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
    label: "Close-up",
    spec: {
      /*
        THE SHOWPIECE, and the identity-detail reference. Deliberately tighter
        than anything the sheet produces: the point is skin, iris, the texture
        of the hairline — detail a downstream generator can rebuild a face from.
      */
      framing:
        "a tight close-up of the face, square to the camera and filling the frame from just "
        + "above the hairline to just below the chin, both eyes sharp and looking into the lens — "
        + "close enough to read skin texture and iris detail",
      wardrobe: CLOSE_UP_WARDROBE,
    },
    directive:
      "TIGHT FRONT-FACING CLOSE-UP OF THE FACE. The face fills the frame — from just above the "
      + "hairline to just below the chin, cropping the sides of the hair if it must. Square to "
      + "camera, head straight, both eyes looking directly into the lens and critically sharp. "
      + "Skin texture, pores, fine hairs and iris detail are all resolved. Not a headshot: this is "
      + "closer than a portrait crop.",
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
  /*
    RETIRED FROM THE PROFILE, kept in the record (package v2).

    The walk is no longer generated — motion belongs to Takes — but two signed
    Casts already own one, and a package is a historical record rather than a
    statement about today's policy. Deleting this entry would leave their walk
    slot rendering with no label. It is simply absent from `CAST_PACKAGE_VIEWS`,
    which is the only list that decides what a new Sign buys.
  */
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
