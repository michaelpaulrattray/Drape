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
 * THE SAME SENTENCE, WRITTEN FROM A STORED LINE (design §3.3, item 6).
 *
 * The constant above is an honest answer to having nothing written down. Two of
 * its clauses exist only because of that, and both go the moment an exact line
 * exists:
 *
 *  1. **"anything below the frame of the reference CANNOT be compared."** That
 *     is true when the only record of the outfit is a chest-up photograph — the
 *     judge was left adjudicating our own adjective *"plain"* against its own
 *     taste, and a customer paid 50 credits for the ambiguity. A stored line
 *     names the bottoms and the footwear, so the three FULL-LENGTH views become
 *     judgeable for the first time: §I's rule is that an axis told to fail when
 *     unsure must never be pointed at something the reference cannot establish,
 *     and now something else establishes it.
 *  2. ⚠ **"a jacket … is a failure wherever it appears."** With a line that may
 *     SAY *dark canvas work jacket*, that clause fails the customer's own
 *     outfit — the same self-contradiction `FRAMING`'s "No jackets" had, in the
 *     one place where the price of it is a refunded slice. The rest of the
 *     addition list stays, and it CAN stay because `wardrobeDoor.ts` refuses
 *     hats, props, logos and printed text in the line: the two cannot disagree.
 *
 * ⚠ **The judge and the generator read THIS function, one call each, so they
 * cannot drift** — which is the whole reason the line has one owner. A Cast
 * signed after a wardrobe edit is judged against what it is wearing.
 */
export function castPackageWardrobeSpec(wardrobeLine: string | null): string {
  if (wardrobeLine === null) return CAST_PACKAGE_WARDROBE_SPEC;
  return `exactly this outfit, unchanged across every view: ${wardrobeLine}. `
    + "This description covers the whole figure — what is worn on the upper body, on the lower body "
    + "and on the feet — so it applies below the frame of the reference photograph as well as inside "
    + "it. Judge the clothing against this description. "
    + "ADDITIONS are failures wherever they appear: jewellery, a hat, a bag, a prop, or any printed "
    + "text or logo.";
}

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
  /**
   * ⚠ DOES THIS VIEW SHOW BELOW THE WAIST — the two full-length angles, and the
   * only ones a below-waist sentence has any business reaching.
   *
   * Declared per view rather than inferred from the angle's name, so a sixth
   * view added tomorrow states its own answer instead of being caught by a
   * regex on "Full". Absent means no, which is the safe direction: a close-up
   * that quietly gained a bottoms instruction would be composing about pixels
   * it does not contain.
   */
  belowWaist?: boolean;
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
      /* ⚠ "below the FEET", not "below the shoes" (2026-08-23). This is a FRAMING
         clause and it presupposed footwear — harmless while every Cast wore the
         house line's low shoes, and a small untruth said to a barefoot caveman in
         the same prompt that tells the engine he is barefoot. The margin is about
         where the body ends. */
      + "frame with margin above the hair and below the feet. Arms relaxed at the sides, weight even, "
      + "standing still rather than posing.",
    /*
      ⚠ THE BELOW-WAIST SENTENCE IS NOT HERE ANY MORE — it is composed, and only
      for a Cast that has nothing else describing its bottoms. See
      {@link belowWaistFor}.
    */
    belowWaist: true,
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
    /*
      ⚠ RETIRED FROM THE PROFILE AND TREATED THE SAME WAY ANYWAY. This view is
      not in `CAST_PACKAGE_VIEWS`, so no new Sign generates it and the flag
      below decides nothing today. It is set because the alternative is a
      retired entry that behaves differently from its live siblings the day
      somebody un-retires it — the historical record kept, and kept consistent.
    */
    belowWaist: true,
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
    belowWaist: true,
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
/**
 * The wardrobe sentence this slot is composed from and judged against.
 *
 * ⚠ **The CLOSE-UP's sentence is deliberately not substituted.** It is written
 * about the REFERENCE photograph rather than about a spec — *where the collar
 * IS visible it matches the reference's neckline and colour* — so it is already
 * correct on every path, including a Basics Cast with no collar at all. Only
 * the shared sentence, the one that names an outfit, has anything to replace.
 */
function wardrobeSpecFor(angle: CastViewAngle, wardrobeLine: string | null): string {
  const base = VIEWS[angle].spec.wardrobe;
  if (wardrobeLine === null || base !== CAST_PACKAGE_WARDROBE_SPEC) return base;
  return castPackageWardrobeSpec(wardrobeLine);
}

/**
 * ⚠ WHAT A FULL-LENGTH VIEW IS TOLD ABOUT THE BOTTOM HALF — and why it is
 * composed rather than frozen (2026-08-23, countersigned fable-1478).
 *
 * # The defect, quoted from a prompt this function used to build
 *
 * The two full-length directives ENDED with this, hard-coded:
 *
 * > *"Below the waist, plain unbranded neutral trousers and plain unbranded
 * > shoes in a tone that sits with the top…"*
 *
 * Four lines later, the same prompt said:
 *
 * > *"WARDROBE: exactly this outfit, unchanged across every view: a rough
 * > animal-hide wrap draped over one shoulder, a plain hide loincloth, bare
 * > feet."*
 *
 * **The prompt ordered trousers and shoes and then ordered a loincloth and bare
 * feet.** The founder called them hallucinated trousers; the engine was obeying
 * us. It is a block contradicting itself in the same breath, which an image
 * model resolves by picking one, silently, per view — measured at **2 of 4
 * full-length views across two Signs**, each one caught by the judge, refused
 * and refunded at 50 credits.
 *
 * ⚠ **The design predicted it in writing and half of it landed.** §3.3's table
 * has a row for *the six signed views* and a row for *the wardrobe judge*, both
 * to derive from `currentWardrobeLine` so generator and judge cannot drift. The
 * JUDGE half shipped — `castPackageWardrobeSpec` composes from the line, which
 * is exactly why these failures were caught rather than delivered. The
 * GENERATOR half is this. Until now the product paid a text model to referee a
 * disagreement it had manufactured, and refunded the customer when our own two
 * sentences lost.
 *
 * # `null` keeps the sentence, and that is not caution
 *
 * A Cast with no stored line has a chest-up reference and nothing else naming
 * its bottoms, so a full-length view must invent them — and our own restrained
 * default is the honest answer for it. That is every Cast signed to date and
 * every unpathed roll, composing character for character as it always has.
 *
 * ⚠ **What this does NOT fix, named rather than implied**: that unpathed
 * population still has a view inventing below the crop, and the real cure there
 * is a bottom-half document (fable-1476's first-reveal locks, filed and
 * unbuilt). This removes a contradiction; it does not give the engine something
 * to copy.
 */
function belowWaistFor(angle: CastViewAngle, wardrobeLine: string | null): string {
  if (!VIEWS[angle].belowWaist || wardrobeLine !== null) return "";
  return " Below the waist, plain unbranded neutral trousers and plain unbranded shoes in a "
    + "tone that sits with the top — no visible hardware, buttons, stitch detailing or logos.";
}

export function composePackageViewPrompt(angle: CastViewAngle, wardrobeLine: string | null = null): string {
  const view = VIEWS[angle];
  return [
    "Keep this exact person unchanged: the same face, bone structure, skin, hair, facial hair and build "
    + "as the reference photograph. This is the same individual in a different photograph, never a "
    + "similar-looking person.",
    `${view.directive}${belowWaistFor(angle, wardrobeLine)}`,
    `WARDROBE: ${wardrobeSpecFor(angle, wardrobeLine)}`,
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
export function packageViewExpectation(
  angle: CastViewAngle,
  wardrobeLine: string | null = null,
): CastPackageViewSpec {
  const { spec } = VIEWS[angle];
  /*
    The SAME answer the generator was given, through the same function. Two
    call sites composing the sentence separately is how a judge comes to fail a
    view for wearing what the prompt asked for.
  */
  return { framing: spec.framing, wardrobe: wardrobeSpecFor(angle, wardrobeLine) };
}
