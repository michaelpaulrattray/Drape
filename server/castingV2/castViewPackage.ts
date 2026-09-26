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
import { HOUSE_PHOTOGRAPH_PARAGRAPHS } from "./houseBlock";

/**
 * THE ONE RULE A VIEW HAS AND A ROLL CANNOT — kept as a VIEW-ONLY line when
 * the legacy cohort blocks left this road (#1240).
 *
 * It is the founder's own sentence from #1221 (*everything the reference shows
 * on her is hers; add nothing it does not show*), and it stays because a roll
 * has no reference photograph to say it about. Taken from the cohort constant
 * by name rather than re-typed: it is the same prose the #1221 ruling put
 * there, and a second copy of it is the drift working law 4 is about.
 */
const REFERENCE_IS_THE_DOCUMENT = PHOTOREAL_HUMAN_BLOCKS.referenceDocumentSentences.join(" ");

/**
 * THE SAME RULE WHEN THE CAST'S BRIEF IS ON RECORD — #1278 part 1.
 *
 * Both forms come from the cohort constant by name, for the reason the one above
 * does: a second copy of the prose is the drift working law 4 is about. Which of
 * the two a view sends is decided in one place (`referenceRuleFor`), because the
 * choice and the description have to move together — sending the undescribed
 * opener beside a description is a prompt that denies its own next line.
 */
const REFERENCE_WITH_DESCRIPTION = PHOTOREAL_HUMAN_BLOCKS.referenceDescribedSentences.join(" ");

/**
 * THE CAST'S OWN WORDS, NORMALISED — the one door the description comes through.
 *
 * `null` for absent, empty or whitespace, so every road agrees on what "no
 * description" means. A legacy cast has no source roll at all (read at the rows
 * 2026-09-26: 2 of 6 minted casts carry one), and a blank brief must compose the
 * same bytes as a missing one rather than emitting an empty `DESCRIPTION:` label.
 */
export function viewDescriptionOf(text: string | null | undefined): string | null {
  const trimmed = (text ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/** Which reference rule this view sends — undescribed, or described. */
function referenceRuleFor(description: string | null): string {
  return description === null ? REFERENCE_IS_THE_DOCUMENT : REFERENCE_WITH_DESCRIPTION;
}

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
 * ⚠ **AND IT NAMED A GARMENT UNTIL 2026-09-25 (#1207), WHICH IS THIS
 * DOCBLOCK'S OWN OPENING LESSON MISSED ONE LEVEL UP.** The header says
 * *relative to the reference, never an absolute colour* — and the sentence then
 * said *"the SAME plain unbranded **crew-neck top** the reference photograph
 * shows"*. A colour was the thing that cost a refund in August; a garment TYPE
 * is the same mistake with more of the outfit inside it. His report, verbatim:
 * *"my sifr cast closeup rendered correctly full frontal rendered incorrect she
 * is wearing pants and shoes these dont match her described outfit at all in
 * the brief."*
 *
 * ⚠ **The product contained its own control and it is why the close-up
 * survived.** `CLOSE_UP_WARDROBE` describes BY REFERENCE — *"where the collar
 * IS visible it matches the reference's neckline and colour"* — and names no
 * garment; that is the one view he reported as correct. This sentence now takes
 * the same posture, so both are relative and neither can contradict a master.
 *
 * ⚠ **Measured before it was changed, and it is not an edge case: 5 of 5
 * signed Casts in production carry NO stored wardrobe line, all time.** So
 * `castPackageWardrobeSpec`'s composed-from-a-line road has never once run, and
 * this constant is not a fallback — it is the only wardrobe sentence the
 * product has ever sent. That the dead road still costs a parameter on a paid
 * path is filed, not settled here.
 *
 * ⚠ **"a jacket … is a failure" LEFT THE ADDITION LIST IN THE SAME EDIT**, and
 * the reason was already written down two docblocks below: with an outfit that
 * may itself BE a jacket, that clause fails the customer's own clothes. It was
 * filed there as a thing that would go *"the moment an exact line exists"* — but
 * no line has ever existed, so the contradiction was never conditional and has
 * been live for every Cast whose outfit includes one. The rest of the list
 * stays and is now phrased against the reference, which is what makes it able
 * to keep standing without a stored line behind it.
 *
 * The trousers and shoes did not simply vanish. They moved into the DIRECTIVE
 * of the three full-length views, which is generation guidance and is never
 * shown to the judge. The garment is still asked for; it just stops being
 * grounds for a refund nobody could have earned.
 */
export const CAST_PACKAGE_WARDROBE_SPEC =
  "the SAME outfit the reference photograph shows — the same garments, in the same colours, "
  + "unchanged across every view. "
  + "The reference is a chest-up photograph, so it shows nothing below the waist: anything "
  + "below the frame of the reference CANNOT be compared to it and must not fail this check. "
  + "Judge only what both images show, plus ADDITIONS — jewellery, a hat, a bag, a prop, or "
  + "any printed text or logo that the reference does not show is a failure wherever it appears.";

/**
 * THE SAME SENTENCE WITH THE CAST'S BRIEF ON RECORD — #1278 part 1.
 *
 * His two faults, verbatim (2026-09-26): *"The dress is a plain modest version of
 * what the brief describes, and the hem and shoes differ every take."*
 *
 * # What this sentence was doing to his dress
 *
 * The constant above is an honest answer to knowing nothing about the outfit but
 * what a chest-up photograph shows, and three of its clauses only make sense
 * under that ignorance: the outfit is whatever the reference shows, below the
 * waist is unjudgeable, and any printed text or logo is an ADDITION and a
 * failure. Read against his own brief — *"a white, body-conscious dress that
 * mixes qipao structure with industrial straps, buckles, and a worn graphic on
 * the chest, leaving the exact cut, hardware, and weathering open"* — two of
 * those are actively wrong: **the worn graphic on her chest is the outfit, and
 * this sentence calls it a failure**, and the cut and weathering the brief
 * deliberately leaves open are exactly what nothing then establishes.
 *
 * # The narrowing
 *
 * An addition fails when the reference does not show it **and** the description
 * does not name it. Every noun is kept. Below the frame stops being unjudgeable
 * and becomes the description's to govern, which is what makes the three
 * full-length views answerable for the first time without inventing an adjective
 * of our own to judge against (the *"plain"* that cost a customer 50 credits —
 * see the docblock above).
 *
 * ⚠ **THIS IS THE JUDGE'S SENTENCE AS WELL AS THE GENERATOR'S** — one function,
 * one call each, which is what stops the two being told two outfits. So the
 * narrowing changes what is REFUSED and therefore what is REFUNDED: strictly
 * fewer refusals, because every clause here either stays or widens. Named rather
 * than discovered later, since a slice refused is a slice refunded.
 */
export const CAST_PACKAGE_WARDROBE_SPEC_DESCRIBED =
  "the SAME outfit the reference photograph shows and the DESCRIPTION names — one outfit, "
  + "unchanged across every view. "
  + "Inside the frame of the reference, the reference is the record. Below its frame the "
  + "description governs: the cut, length, hardware, footwear and weathering it names are this "
  + "outfit's own wherever they appear, and where it leaves them open any reading in keeping with "
  + "the garments, materials and colours above the crop is correct. "
  + "Judge the clothing against both records together. ADDITIONS — jewellery, a hat, a bag, a "
  + "prop, or printed text or a logo that the reference does not show AND the description does "
  + "not name — are a failure wherever they appear.";

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
 *
 * ⚠ **THE LIST WAS ABSOLUTE AND IS NOW RELATIVE — founder ruling, 2026-09-25
 * (#1221).** It read *"No earrings, no glasses, no piercings, no hat, no
 * headphones, no visible logo or text"* and then, at the end, *"nothing worn
 * that the reference photograph does not show"* — **two rules, and the list
 * came first.** His word on re-reading it: the closing clause is the one that
 * is right, *"never as a list"*. A customer whose signed master wears a nose
 * stud and a pair of hoops had them banned by our own spec, and this sentence
 * is the JUDGE's as well as the generator's, so it could fail her close-up for
 * wearing her own jewellery. The addition half is kept — it is the thing this
 * crop can genuinely check — and every item in it now hangs off *absent from
 * the reference*, with the other direction stated out loud so the rule cannot
 * be read as a ban with an exception. Same posture as `CAST_PACKAGE_WARDROBE_SPEC`,
 * which was already relative and needed no change.
 */
const CLOSE_UP_WARDROBE =
  "at this crop the garment may be barely visible, and that is fine — if no clothing is in "
  + "frame, this passes. Where the collar IS visible it matches the reference's neckline and "
  + "colour. Nothing worn that the reference photograph does not show: an earring, glasses, a "
  + "piercing, a hat, headphones or a visible logo or text that is absent from the reference is "
  + "a failure wherever it appears — and anything of that kind the reference DOES show is this "
  + "person's own and must be there.";

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
 * Two things must exist before any such clause rides five paid views: the
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
function wardrobeSpecFor(
  angle: CastViewAngle,
  wardrobeLine: string | null,
  description: string | null = null,
): string {
  const base = VIEWS[angle].spec.wardrobe;
  /*
    The close-up keeps its own sentence on both roads — at that crop the garment
    is barely in frame, which is the whole reason it has one (see
    `CLOSE_UP_WARDROBE`). Only the shared sentence has a described form.
  */
  if (base !== CAST_PACKAGE_WARDROBE_SPEC) return base;
  if (wardrobeLine !== null) return castPackageWardrobeSpec(wardrobeLine);
  /*
    #1278 part 1. The stored-line road is FIRST because a line is the stronger
    record when one exists — though none ever has: read at the rows 2026-09-26,
    0 of 6 minted casts carry `technicalSchema.wardrobe.line`, all time, the two
    signed the day before included.
  */
  return description === null ? base : CAST_PACKAGE_WARDROBE_SPEC_DESCRIBED;
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
 * has a row for *the five signed views* and a row for *the wardrobe judge*, both
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
 *
 * # ⚠ THE RESTRAINED DEFAULT WAS THE WHOLE POPULATION, AND IT FOUGHT HER OUTFIT (#1207)
 *
 * The paragraph above calls the `null` branch *"every Cast signed to date and
 * every unpathed roll"* and reasons about it as the honest answer for a Cast
 * with nothing describing its bottoms. Read at production on 2026-09-25: **5 of
 * 5 signed Casts, all time, take this branch** — no Cast has ever had a stored
 * line — so it was never a default, and since #203 made the path column a
 * constant `null` no future Cast can take the other one either.
 *
 * What it sent was *"plain unbranded neutral trousers and plain unbranded
 * shoes"*, and his Sifr cast met it: *"she is wearing pants and shoes these
 * dont match her described outfit at all in the brief."* **The trousers were
 * ours.** The 2026-08-23 repair above removed a contradiction between two of
 * our own sentences; it left the invention itself standing, because at the time
 * a stored line looked like the thing that would retire it.
 *
 * So the sentence stops naming garments and asks the engine to EXTEND what the
 * reference already shows. It still has to invent — a chest-up photograph
 * cannot establish a hem — but it now invents in her outfit's direction instead
 * of against it, which is the difference between a guess and a contradiction.
 * The judge is untouched by this: `packageViewExpectation` is assembled from
 * `spec` alone and never reads a directive, so nothing here can fail a view.
 */
function belowWaistFor(
  angle: CastViewAngle,
  wardrobeLine: string | null,
  description: string | null = null,
): string {
  if (!VIEWS[angle].belowWaist || wardrobeLine !== null) return "";
  /*
    #1278 part 1 — the hem-and-shoes half of his report.

    The undescribed clause below asks for "whatever its lower half and footwear
    WOULD BE", which is the honest question to ask of a chest-up photograph and is
    also an open invitation: nothing constrains the answer, so it lands differently
    on every independent render. With the brief on record the description answers
    it — his own words name the dress, and where they leave the hem open they at
    least name the register it has to sit in.

    ⚠ This does NOT make the three full-length views agree with EACH OTHER. They
    are still three independent renders of an open question, and identical-across-
    views is what part 2's one-sheet-then-cut shape is for. What this fixes is the
    answer being unanchored; what it cannot fix is its being asked three times.
  */
  if (description !== null) {
    return " Below the waist, CONTINUE THE SAME OUTFIT — the lower half, length, hardware and "
      + "footwear the DESCRIPTION names, and where it leaves them open, a reading in keeping with "
      + "the garments, materials and colours visible above the crop. Do not substitute a different "
      + "style of clothing, and no logos or printed text that neither the reference nor the "
      + "description shows.";
  }
  return " Below the waist, CONTINUE THE SAME OUTFIT the reference photograph shows — whatever "
    + "its lower half and footwear would be, in keeping with the garments, materials and colours "
    + "visible above the crop. Do not substitute a different style of clothing, and no visible "
    + "logos or printed text.";
}

/**
 * ⚠ **THE LIGHT A SIGNED VIEW IS SHOT UNDER IS THE MASTER'S, NOT THE FLASH
 * STUDIO'S — 2026-09-25 (#1207).**
 *
 * His report, verbatim: *"the side profile has a harsh flash which doesnt match
 * the master or the closeup."* Read at the wire rather than at the file: this
 * prompt sent `PHOTOREAL_HUMAN_BLOCKS.capture` whole, and that block's third
 * sentence is *"LIGHTING: Direct on-camera or slightly off-axis front flash …
 * No gels, no diffusion."* **The flash was ordered, not hallucinated** — the
 * same shape as the trousers, and the same shape as the 2026-08-23 defect this
 * file already documents.
 *
 * The card reported the opposite — *"no view directive names the master's
 * lighting"* — because its grep was run over THIS file, and the sentence
 * arrives through an import. A prompt is proven at the wire (working law 5);
 * composing one and reading it is what found this.
 *
 * ⚠ **The master disagrees BY CONSTRUCTION, and the product already knew.**
 * Every roll since the register widened on 2026-09-24 is authored, and
 * `houseBlock.ts` §5e replaces that sentence with the founder's own
 * `LIGHTING_LINE` (*"Large soft frontal key … not as a forced flash sheen on
 * every face"*) — then lists *"front flash"* and *"No gels, no diffusion"* in
 * `DROPPED_FROM_BLOCK`. **The Sign was sending phrases the road that made
 * its own reference bans.** So the fix is a shared constant, not a new
 * sentence: nothing here is authored, and the lighting a customer sees is the
 * one he ratified.
 *
 * ⚠ **STATED, because it is a decision and not a free win** (fidelity law): the
 * four Casts signed before 2026-09-24 have HOUSE-road masters, which really
 * were flash-lit, and a view of one re-rendered today is lit the new way.
 * Nothing fails — the judge has no light axis (that is #1207's second half,
 * carded) — and the alternative is threading each Cast's road through a paid
 * path so the product can keep reproducing retired blocks forever. **A package
 * re-rendered today is rendered by today's product**; the declined option is
 * named here rather than in a report nobody re-reads.
 *
 * ⚠ **AND THE REALISM BLOCK IS THE SIGN VIEW'S OWN NOW, FOR THE SAME REASON ONE
 * BLOCK OVER — founder ruling, 2026-09-25 (#1221), the third instance of this
 * class after the trousers and the flash.**
 *
 * His report: a signed cast's close-up came back with a **bare unmade face and
 * no neck tattoos**, from a master that has heavy neck ink, dark makeup and a
 * high collar. His ruling on the root, verbatim: *"yeah thats because this was
 * a legacy prompt for when our casts were not allowed outfits and were wearing
 * the bare minimum now we have a fully open concept"*.
 *
 * This prompt sent `PHOTOREAL_HUMAN_BLOCKS.realism` whole, and that block's
 * four stated-X doors each defer to *"the character description"* — of which a
 * Sign view HAS NONE. So they collapsed to their defaults and the wire carried,
 * verbatim, *"Never invent damage, scars or ink that was not asked for"* and
 * *"the default is a bare, unmade face"*. **Her tattoos were removed on our
 * instruction.** ~~It now sends `referenceRealism()`~~ — **that repair was
 * a SUBTRACTION from the legacy block, and #1240 below replaced it with the
 * roll's own sentences; only its one added rule survives, as
 * `REFERENCE_IS_THE_DOCUMENT` above.** The ROLL road is untouched and its bytes
 * are pinned by hash — there the brief IS the description and the doors have a
 * referent.
 *
 * ⚠ **AND THE WHOLE LEGACY COHORT BLOCK LEFT THIS ROAD — founder ruling,
 * 2026-09-26 (#1240), which is the end of this three-defect run rather than a
 * fourth patch on it.**
 *
 * His question, verbatim: *"why cant the realism block be the same as when
 * casting a sheet?"* — and his *"yes"* to the shape. **ONE BLOCK, TWO ROADS.**
 * A view is a photograph of the person the house block already made, so it is
 * photographed under that same block: the view's own lines, then
 * {@link HOUSE_PHOTOGRAPH_PARAGRAPHS} — the roll's capture, realism, negatives,
 * style preset and authority, taken from the same constants rather than copied.
 *
 * **Measured at the composed string before it was built** (working law 5): the
 * block below the view's own lines goes from **63 sentences to 20**. What
 * leaves is the legacy cohort's, and each departure is the card's point rather
 * than a cost:
 *
 *   - `identityIntegrity` — fourteen sentences about CASTING a face from a
 *     stated heritage. A view must cast nobody; the reference already is the
 *     person. Its *"when the description does not state them, eye colour, hair
 *     colour and skin tone … follow plausibly from their heritage"* clause fired
 *     on EVERY view, telling the engine to derive her colouring instead of
 *     copying the picture.
 *   - `negatives` — the letters ban goes on his own ruling (*"what do other big
 *     SaaS operators do? do they ban these? if not unban it"* — they do not).
 *     **A script tattoo is text on her skin**, and this line forbade it on every
 *     view. The roll's `NEGATIVE_LINES` keep the logo, watermark, caption,
 *     signage and scene bans, which is the half a studio frame actually wants.
 *   - `authority` — *"the FRAMING, CAPTURE, REALISM and NEGATIVE rules above
 *     override the character description entirely"* and *"if the description
 *     implies … a costume … ignore that implication"*. The roll's
 *     `AUTHORITY_LINE` says the opposite and the right thing: a stated fact is
 *     a fact and beats the block's defaults.
 *   - the eye, lash, lip, brow and vellus CRAFT — twenty sentences the roll's
 *     own realism does not carry either. **This is the one departure that is a
 *     question rather than an answer**, and it is the card's court: close-ups
 *     rendered under this block beside close-ups under the old one, at his eye
 *     (law 9). If detail is lost there, they come back as a VIEW-ONLY addendum
 *     — never as the old block, because the doors ride with it.
 *
 * ⚠ **The EXPRESSION rule leaves with them and nothing replaces it, which is
 * stated here rather than discovered later** (fidelity law: name the tradeoff
 * out loud). The roll carries expression in its FRAMING paragraph, which a view
 * replaces with its own angle directive — and four of the five directives name
 * neither a mouth nor a gaze. The defence is this card's own principle: a view
 * has a reference photograph showing the expression where a roll has only
 * words. The alternative — re-typing a gaze-free expression sentence, since
 * `EXPRESSION_LINE` opens with *"Eyes into the lens"* and a back view cannot
 * obey it — was DECLINED as an authored sentence on a road his ruling says
 * takes the roll's own. It is an arm in the suite and a question for the
 * court's frames.
 *
 * ⚠ **The words that could have carried her ink were declined by design, and
 * that is NOT repaired here.** The Sign's own log for this Cast reads
 * `rode=[] declined=[{"slot":"bornInk:wholeBody","reason":"markingDiscloses"}]`
 * — born ink is kept out of a view's words on purpose (fable-1399 §3: a marking
 * under fabric has nothing visible to carry). **That design is right for a
 * covered tattoo and wrong for a neck**, and it is a separate question from
 * this one: the repair here makes the PICTURE the document, which is the road
 * his ruling names, and it holds whether or not the words ever ride.
 */
export function composePackageViewPrompt(
  angle: CastViewAngle,
  wardrobeLine: string | null = null,
  description: string | null = null,
): string {
  const view = VIEWS[angle];
  const brief = viewDescriptionOf(description);
  return [
    "Keep this exact person unchanged: the same face, bone structure, skin, hair, facial hair and build "
    + "as the reference photograph. This is the same individual in a different photograph, never a "
    + "similar-looking person.",
    referenceRuleFor(brief),
    /*
      #1278 part 1 — the cast's own words, and the position is load-bearing in two
      directions. It sits AFTER the identity sentence and the reference rule, so
      the reference's primacy is established before the description is read; and
      BEFORE the house paragraphs, so `AUTHORITY_LINE`'s *"the description says WHO
      to cast"* has a referent at last. Since #1240 brought that paragraph onto
      this road it has been resolving to nothing, leaving *"where the description
      is silent, this block governs: plain studio frame"* as its only live branch.
    */
    ...(brief === null ? [] : [`DESCRIPTION: ${brief}`]),
    `${view.directive}${belowWaistFor(angle, wardrobeLine, brief)}`,
    `WARDROBE: ${wardrobeSpecFor(angle, wardrobeLine, brief)}`,
    ...HOUSE_PHOTOGRAPH_PARAGRAPHS,
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
  description: string | null = null,
): CastPackageViewSpec {
  const { spec } = VIEWS[angle];
  /*
    The SAME answer the generator was given, through the same function. Two
    call sites composing the sentence separately is how a judge comes to fail a
    view for wearing what the prompt asked for.

    ⚠ #1278 part 1 takes `description` for exactly that reason and for no other.
    The generator's wardrobe sentence narrows when a brief is on record, so a
    judge that did not know about the brief would keep failing the graphic on her
    chest that the prompt just told the engine to paint — the same defect this
    function's own comment describes, arriving through a new door.
  */
  return {
    framing: spec.framing,
    wardrobe: wardrobeSpecFor(angle, wardrobeLine, viewDescriptionOf(description)),
  };
}
