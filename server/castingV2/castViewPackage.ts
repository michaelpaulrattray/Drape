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
  VIEW_ANGLE_LABELS,
  type CastViewAngle,
} from "../../shared/boardTypes";
import { CASTING_V2_SIGN_COSTS } from "../casting/castingCreditCosts";
import { PHOTOREAL_HUMAN_BLOCKS } from "./cohortPhotorealHuman";

/**
 * PACKAGE v3.1 — the final composition (founder ruling, 2026-08-02). This ends
 * the package saga.
 *
 * The strip shows SIX things and the first is not generated: **Master**, the
 * signed sheet image itself, then the close-up, the three-quarter, the front,
 * the profile and the back. The Master costs nothing and is never re-rendered —
 * it is the face that was chosen.
 *
 * **A clean turnaround plus the detail shot.** Read as angles rather than as a
 * list, the package is now 0° / 45° / 90° / 180°, with one crop that exists to
 * show skin:
 *
 *   Master      chest-up, 0°   — the signed face, free
 *   Close-up    the beauty band — detail
 *   Three-quarter          45°  — the angle engines and campaigns actually use
 *   Full front             0°   — proportion
 *   Side profile           90°  — bone structure
 *   Full back              180° — hair mass, and the surface VTO works on
 *
 * **What v3.1 changed, and why.** v3 carried `frontClose` ("Portrait") as well
 * as the Master and the close-up, which made **three frontal crops** — one too
 * many. The Master already shows her chest-up and square to camera; a Portrait
 * beside it is the same rung of the zoom ladder climbed twice. So the portrait
 * retires and the **three-quarter returns**: 45° was the one genuinely missing
 * viewpoint, and it is the one downstream generation asks for most.
 *
 * **The price does not move**: still five generated views, 200 + 5 × 50.
 *
 * **Historical record, as ever.** A Cast keeps the package it bought. "Package
 * Three" keeps her Portrait forever; every Cast renders its own slots from its
 * own durable promise, which is what makes a mixed roster legal by construction
 * (D-102). Nothing here is retroactive.
 *
 * Ordered as the room reads them, and every entry must be a known angle —
 * `modelAssets.viewType` is a fixed enum and a profile that named something
 * outside it would fail at the first insert rather than at review.
 */
export const CAST_PACKAGE_VIEWS: readonly CastViewAngle[] = [
  "closeUp",
  "threeQuarter",
  "frontFull",
  "sideClose",
  "backFull",
];

/** The refundable slice, per view. */
export const CAST_PACKAGE_VIEW_PRICE = CASTING_V2_SIGN_COSTS.view;

/**
 * The base — what promotion itself costs.
 *
 * Retained on a partial package, where it buys what it says it buys. Refunded
 * whole on a total loss, because nothing arrived to be permanent about (founder
 * ruling, 2026-08-02).
 */
export const CASTING_V2_SIGN_PROMOTION_PRICE = CASTING_V2_SIGN_COSTS.promotion;

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
 *
 * **The same defect, found a second time and closed properly (2026-08-02).**
 * The v3.1 verification Sign lost its full-back view because the judge reported
 * *"dark leather dress shoes instead of plain neutral shoes, and trousers with
 * visible stitch detailing not specified as plain."* The anchor is a CHEST-UP
 * photograph. It shows no trousers and no shoes, so there was nothing to
 * compare against — the judge was left adjudicating our own adjective "plain"
 * against its own taste, and the customer paid 50 credits for the ambiguity.
 *
 * An axis told to fail when unsure (§I) must therefore never be pointed at
 * something the reference cannot establish. So this sentence — which BOTH the
 * judge and the generator read (`composePackageViewPrompt`) — now names its own
 * limits: compare what both images show, and treat additions as failures
 * wherever they appear.
 *
 * The trousers and shoes did not simply vanish. They moved into the DIRECTIVE
 * of the three full-length views, which is generation guidance and is never
 * shown to the judge. The garment is still asked for; it just stops being
 * grounds for a refund nobody could have earned.
 */
export const CAST_PACKAGE_WARDROBE_SPEC =
  "the SAME plain unbranded crew-neck top the reference photograph shows, in the same colour, "
  + "unchanged across every view. "
  + "The reference is a chest-up photograph, so it shows no trousers and no shoes: anything "
  + "below the frame of the reference CANNOT be compared to it and must not fail this check. "
  + "Judge only what both images show, plus ADDITIONS — a jacket, jewellery, a hat, a bag, a "
  + "prop, or any printed text or logo is a failure wherever it appears.";

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
  angle: CastViewAngle;
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

const VIEWS: Record<CastViewAngle, CastPackageView> = {
  /*
    THE BEAUTY CROP — a BAND, not a point (founder ruling, 2026-08-02, final).

    v3 shipped a macro that cropped at the lower lip, and it was too tight: a
    face with no chin is a texture sample, not a portrait of anyone. The founder
    supplied two references and the answer is the range between them —

      tight bound   brow to chin
      loose bound   forehead to chin

    — with the chin and both eyes present in every case, the crown free to crop,
    and hair free to run off the sides.

    Writing it as a band is what makes the conformance check real. A single
    ideal crop can only be judged by "how close is this", which a vision model
    answers with a shrug.

    So both bounds are stated as LANDMARK PREDICATES rather than as proportions.
    A judge reliably answers "is the chin inside the frame" and "are the
    shoulders in frame"; it answers "does the face fill 80% of the height"
    badly. Too tight is therefore a CUT REQUIRED landmark — the margin of skin
    below the chin is what a too-tight crop destroys first — and too loose is a
    PRESENT FORBIDDEN one: shoulders, or headroom above the hair. Both are yes
    or no by looking, which is also what makes §I's fail-closed default
    ("unsure fails") work for us rather than against us.

    And the DIRECTIVE aims mid-band, not at an edge. v3's directive commanded
    "to just below the lower lip" — ship that beside this spec and every
    close-up would fail its own conformance check by construction, charging and
    refunding the customer for our contradiction. That is exactly the defect the
    maiden voyage found in the wardrobe spec; it does not get to happen twice.
  */
  closeUp: {
    angle: "closeUp",
    label: "Close-up",
    spec: {
      framing:
        "a tight, front-on crop of the face: no tighter than eyebrows-to-chin, and no looser "
        + "than forehead-to-chin. The chin, the mouth and both eyes are entirely inside the "
        + "frame, with a margin of skin visible BELOW the chin. "
        + "TOO TIGHT, and it fails: the bottom edge cuts the chin or the mouth, or the chin "
        + "touches the bottom edge with no skin below it. "
        + "The top of the head may be cropped and hair may run off the left and right edges — "
        + "but TOO LOOSE, and it fails: the neck and shoulders are in frame, or the whole "
        + "head fits with clear space above the hair. That is a portrait, not a close-up.",
      wardrobe: CLOSE_UP_WARDROBE,
    },
    directive:
      "BEAUTY CLOSE-UP OF THE FACE, STRAIGHT ON. The face fills the frame. Crop the TOP of "
      + "the frame across the forehead — anywhere between the eyebrows and the hairline — so "
      + "the crown of the head is cut off, and let the hair run off the left and right edges. "
      + "The BOTTOM of the frame sits below the chin: the whole chin is visible. Both eyes "
      + "look directly into the lens and are critically sharp. Skin texture, pores, vellus "
      + "hair, individual lashes and iris detail are all resolved. Do NOT crop at the mouth "
      + "or cut the chin, and do NOT pull back far enough to show the whole head or the "
      + "shoulders.",
  },
  /*
    RETIRED FROM THE PROFILE, kept in the record (package v3.1) — and unlike the
    walk, this angle still does a job.

    No new Sign buys a portrait: the Master already shows her chest-up and
    square to camera, so a Portrait beside it was the same rung of the zoom
    ladder climbed twice. But `frontClose` is the angle the 1K ANCHOR is stored
    under, and `activateSignedCast` still seals a `frontClose` slot from it
    because the snapshot authority requires a displayed headshot (D-97). The
    entry therefore stays live rather than becoming a memorial: every Cast has
    one of these rows, and Casts signed under v2 and v3 own a paid 2K view here
    that must keep its spec and its label forever.
  */
  frontClose: {
    angle: "frontClose",
    /*
      "Portrait" from v3. This slot renders head-and-shoulders and always did —
      v2's "Close-up" label described an intention the pixels never met, which
      the founder spotted on his own Cast within a minute. `castPackageLabel`
      resolves the era; a v3.1 Cast's only frontClose image is her Master.
    */
    label: "Portrait",
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
      + "standing still rather than posing."
      + "Below the waist, plain unbranded neutral trousers and plain unbranded shoes in a "
      + "tone that sits with the top — no visible hardware, buttons, stitch detailing or "
      + "logos.",
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
      + "Head to feet entirely inside the frame."
      + "Below the waist, plain unbranded neutral trousers and plain unbranded shoes in a "
      + "tone that sits with the top — no visible hardware, buttons, stitch detailing or "
      + "logos.",
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
      + "The face is not visible. Add nothing to the back or arms that the reference does not show."
      + "Below the waist, plain unbranded neutral trousers and plain unbranded shoes in a "
      + "tone that sits with the top — no visible hardware, buttons, stitch detailing or "
      + "logos.",
  },
};

export function castPackageView(angle: CastViewAngle): CastPackageView {
  return VIEWS[angle];
}

/**
 * What a slot was CALLED when the Cast bought it (founder ruling, 2026-08-02).
 *
 * A label is part of the record, not part of today's policy. `frontClose` meant
 * a waist-up "Headshot" in the six-view era and means a tight "Close-up" now —
 * so labelling every Cast from today's profile tells the two existing Casts
 * that the waist-up image in their package is a close-up, which is simply false
 * about their own property.
 *
 * The era is read from the Cast's own promise rather than stored: a package
 * containing the walk is a v1 package, because the walk is exactly what v2
 * retired. When a third composition arrives it adds a clause here — and the
 * promise is already durable, so no migration is needed to tell them apart.
 */
export function castPackageLabel(
  angle: CastViewAngle,
  promisedAngles: readonly CastViewAngle[],
): string {
  /*
    Every era of this one slot, told apart from the Cast's OWN promise — nothing
    is stored, because the promise is already durable:

      v1    contains the walk            -> `frontClose` was "Headshot"
      v2    no walk, no true close-up    -> `frontClose` was "Close-up"
      v3    close-up AND frontClose      -> `frontClose` is "Portrait"
      v3.1  no frontClose promised       -> the only frontClose image she has
                                            IS the signed face: "Master"

    The v3.1 clause is deliberately not dead code even though the room draws its
    Master tile from the anchor directly. `frontClose` remains a real row in her
    ledger — the anchor is stored under that angle, and `activateSignedCast`
    still seals a `frontClose` slot from it, because the snapshot authority
    requires one (D-97). Anything that walks those rows and asks for a label
    must get an honest one rather than the label of a view she never bought.
  */
  if (angle !== "frontClose") return VIEWS[angle].label;
  if (promisedAngles.includes("sideFull")) return "Headshot";
  if (!promisedAngles.includes("closeUp")) return "Close-up";
  if (!promisedAngles.includes("frontClose")) return "Master";
  return VIEWS.frontClose.label;
}

/**
 * The instruction the identity engine receives for one slot.
 *
 * Order matters and mirrors the sheet composer's: the identity instruction and
 * the angle first, then the code-owned constant LAST with authority over
 * everything above it. The anchor image travels separately as a reference —
 * this text never describes the person, because describing them is how a
 * likeness drifts into a lookalike.
 *
 * # WHAT A VIEW IS RENDERED FROM TODAY, and the gap it leaves
 *
 * The anchor's PIXELS plus this constant. **No customer words reach a view** —
 * not the open field, not a refine delta, not `identityText` (which is stamped
 * on the asset record and never enters a prompt). Verified at the wire,
 * 2026-08-17. So whatever is visible in the signed portrait carries into the
 * fuller views through the reference image, and whatever is not visible in it
 * carries by nothing at all.
 *
 * That is deliberate — it is the sentence above — and it is also a GAP the
 * moment the product accepts an ask about something the portrait cannot show
 * (a vampire's hands, an ankle tattoo). The founder has ruled such asks are
 * accepted, free, and *"for now"* pending exactly this test.
 *
 * # THE FOUNDER'S BOUND ON CLOSING IT — fable-876 §2, verbatim
 *
 * > *"i think yes i just dont know what to expect obviously the reference is
 * > still king."*
 *
 * **THE REFERENCE IS STILL KING.** The anchor image remains the identity
 * authority. A clause added here may supply ONLY facts the anchor cannot show;
 * it may never re-describe the person; and where words and pixels could
 * disagree, **the pixels win**. That is the same likeness-drift guard this
 * comment has always stated — his ruling makes it a founder bound rather than
 * an engineering preference, which means it is not a tradeoff a later build
 * gets to re-weigh.
 *
 * Two things must exist before any such clause rides six paid views: the
 * how-does-the-code-know-a-fact-is-not-shown answer (designed once, with the
 * does-it-extend and is-it-paired kind-properties — fable-872 §2), and a
 * CONTROL on `packageViewExpectation`, which is assembled from the view spec
 * alone and today has no opinion about a clause at all (invariant 7 —
 * fable-871 §3).
 */
export function composePackageViewPrompt(angle: CastViewAngle): string {
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
export function packageViewExpectation(angle: CastViewAngle): CastPackageViewSpec {
  const { spec } = VIEWS[angle];
  return { framing: spec.framing, wardrobe: spec.wardrobe };
}
