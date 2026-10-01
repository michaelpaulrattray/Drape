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
import { pronounsForSex, type CastPronouns } from "./castPronouns";
import { PHOTOREAL_HUMAN_BLOCKS } from "./cohortPhotorealHuman";
import { HOUSE_PHOTOGRAPH_PARAGRAPHS } from "./houseBlock";
import type { ViewFramingBand } from "./viewFramingGeometry";

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
const referenceIsTheDocument = (pronouns: CastPronouns): string =>
  PHOTOREAL_HUMAN_BLOCKS.referenceDocumentSentences(pronouns).join(" ");

/**
 * THE SAME RULE WHEN THE CAST'S BRIEF IS ON RECORD — #1278 part 1.
 *
 * Both forms come from the cohort constant by name, for the reason the one above
 * does: a second copy of the prose is the drift working law 4 is about. Which of
 * the two a view sends is decided in one place (`referenceRuleFor`), because the
 * choice and the description have to move together — sending the undescribed
 * opener beside a description is a prompt that denies its own next line.
 */
const referenceWithDescription = (pronouns: CastPronouns, outfitReferenceOrdinal: number | null): string =>
  PHOTOREAL_HUMAN_BLOCKS.referenceDescribedSentences(pronouns, outfitReferenceOrdinal).join(" ");

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

/**
 * THE IDENTITY SENTENCE — one copy, read by every request that carries her
 * photograph.
 *
 * ⚠ **It was a literal inside {@link composePackageViewPrompt} until #1471.**
 * The wardrobe plate now edits FROM THE MASTER (his ruling, 2026-09-29) and so
 * needs the same sentence, and a second typed copy of it is precisely the drift
 * working law 4 is about — two prompts that must say one thing about who the
 * person is, drifting apart one careful edit at a time. Named here, both roads
 * send the same bytes and a change reaches both.
 */
export const VIEW_IDENTITY_SENTENCE =
  "Keep this exact person unchanged: the same face, bone structure, skin, hair, facial hair and build "
  + "as the reference photograph. This is the same individual in a different photograph, never a "
  + "similar-looking person.";

/**
 * Which reference rule a request carrying her photograph sends — undescribed,
 * or described.
 *
 * ⚠ **Exported since #1471, for the same reason as the sentence above**: the
 * plate carries the master now, so it is a request the rule is true of, and it
 * reads the choice here rather than re-deciding it. The choice and the
 * description have to move together on every road that sends both.
 */
export function referenceRuleFor(
  description: string | null,
  pronouns: CastPronouns = pronounsForSex(null),
  outfitReferenceOrdinal: number | null = null,
): string {
  return description === null
    ? referenceIsTheDocument(pronouns)
    : referenceWithDescription(pronouns, outfitReferenceOrdinal);
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
/**
 * THE ADDITION SENTENCE, AND ITS ONE EXCEPTION — written once because three
 * copies of it drifted and the drift cost a customer a slice (#1479).
 *
 * # What went wrong
 *
 * All three wardrobe sentences below carry the same addition list. Two of them
 * were narrowed — in August, then again on 2026-09-25 (#1207) and 2026-09-26
 * (#1278 part 1) — so that an addition fails only when the reference does not
 * show it. The third, `castPackageWardrobeSpec`, was left with an UNCONDITIONAL
 * list: *"ADDITIONS are failures wherever they appear: jewellery, a hat…"*
 *
 * ⚠ **It was left behind because it was DEAD, and #1278 part 1 brought it to
 * life.** Its own docblock recorded the reasoning — *"`castPackageWardrobeSpec`'s
 * composed-from-a-line road has never once run"*, measured at 5 of 5 signed
 * Casts with no stored line — so narrowing it looked like work on a road nobody
 * was on. That is the path-three shape this repository already has three
 * instances of: a clause that was safe only because it was unreachable, made
 * reachable by a change aimed at something else, with no failing test to say so.
 *
 * # What it cost, read at the rows
 *
 * His Sign of "Bingu" (cast 61, 2026-09-29 06:37Z) ran on roll 309, which
 * carries `wardrobeLine = "dark draped fabric"` — so the stored-line road, on
 * its first real outing. The anchor shows dangling earrings. `model_assets` 361
 * (`backFull`) came back `failed`, *"This view came back in the wrong
 * clothing"*, on the judge's note: *"The layered dark draped fabric robe and
 * scarf match, but the earrings/dangling jewelry visible at the ears are an
 * addition not covered by the wardrobe description."*
 *
 * **The judge did exactly what it was told.** It was told to judge the clothing
 * against the description and that jewellery is a failure wherever it appears,
 * and the description — a five-word line — does not mention earrings. A view
 * that faithfully carried the anchor's own jewellery was refused and refunded.
 *
 * # Why it is one function rather than three corrected strings
 *
 * Correcting the third string would leave three copies of one rule, which is
 * working law 4 and is precisely how this defect was born: two were fixed and
 * the third was not, and nothing could notice. The exception now has ONE owner,
 * so a future narrowing cannot reach two sentences and miss the third.
 *
 * @param alsoJudgedAgainstADescription whether a second record — a stored line
 * or the cast's own brief — is being judged alongside the photograph. When
 * there is one, an addition must be absent from BOTH to be a failure.
 */
function wardrobeAdditionsClause(
  alsoJudgedAgainstADescription: boolean,
  pronouns: CastPronouns = pronounsForSex(null),
): string {
  /*
    ⚠ **FINDING D's ADDITIONS FOLD WAS BUILT AND THEN DECLINED, AND THE REASON
    IS WORTH MORE THAN THE FOLD — #1480, read at `viewConformance.ts:308`.**

    The audit asked to *"fold the additions rule to one place"*, because the
    rule *add nothing that neither record establishes* is stated here and again
    in the reference paragraph, in two half-lists. Merging the nouns into that
    paragraph and leaving this sentence to name the rule works perfectly — for
    the GENERATOR, which is handed the whole prompt.

    **The judge is not.** `packageViewExpectation` hands `viewConformance` the
    framing and wardrobe strings and nothing else; its user message is
    literally `SPECIFICATION for IMAGE 2: / Framing: … / Wardrobe: …`. A
    wardrobe sentence that defers to *"the add-nothing rule above"* therefore
    defers, in the judge's prompt, to nothing at all — and the axis it would
    silently widen is the one that refunds slices.

    So this sentence stays self-contained: its own nouns, its own condition. The
    duplication is real and is the price of one clause having two consumers that
    see different amounts of context. The four #1479 arms in
    `wardrobeViews.test.ts` are what caught it.
  */
  return "ADDITIONS — jewellery, a hat, a bag, a prop, or any printed text or logo "
    + "that the reference does not show"
    + (alsoJudgedAgainstADescription ? " AND the description does not name" : "")
    + " — are a failure wherever they appear. "
    /*
      AND THE POSITIVE HALF, STATED RATHER THAN IMPLIED. "An addition is what
      neither record has" leaves the judge to infer that what the reference DOES
      have is therefore hers; the Bingu note is what that inference looks like
      when it is not drawn. The close-up's own sentence has said this in so many
      words since it was written (*"anything the reference DOES show is this
      person's own and must be there"*), and it is the one wardrobe sentence
      that has never refused a customer's own jewellery.
    */
    /* ⚠ `her` was fixed here too — #1480 finding A's second site, and it and the
       reference paragraph MOVE TOGETHER or a male cast reads *her* in one
       sentence and *his* in the next. */
    + `Anything the reference photograph itself shows ${pronouns.object} wearing is this person's own and is `
    + "never an addition, whether or not it is named in words.";
}

function sharedWardrobeSpec(pronouns: CastPronouns): string {
  return "the SAME outfit the reference photograph shows — the same garments, in the same colours, "
    + "unchanged across every view. "
    + "The reference is a chest-up photograph, so it shows nothing below the waist: anything "
    + "below the frame of the reference CANNOT be compared to it and must not fail this check. "
    + `Judge only what both images show, plus ${wardrobeAdditionsClause(false, pronouns)}`;
}

/**
 * The shared sentence in its DEFAULT-PRONOUN form — what the `VIEWS` table
 * holds and what `wardrobeSpecFor` compares against to tell the close-up's own
 * sentence from this one.
 *
 * ⚠ **The table's copy is the `they` form and that is deliberate** (#1480
 * finding A): a spec written before any cast is in hand cannot know whose it
 * is, and `they` is this product's answer for a person whose pronouns are not
 * known (`castPronouns.ts`). Nothing sends this constant to an engine —
 * `wardrobeSpecFor` composes with the cast's own pronouns and the identity
 * check below is the only thing that reads it by value.
 */
export const CAST_PACKAGE_WARDROBE_SPEC = sharedWardrobeSpec(pronounsForSex(null));

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
function describedWardrobeSpec(pronouns: CastPronouns, outfitReferenceOrdinal: number | null): string {
  /*
    ⚠ **THE BELOW-FRAME HALF YIELDS TO THE OUTFIT REFERENCE — #1480, and this
    is the fourth of the five places that addressed the outfit.** It said *below
    its frame the description governs: the cut, length, hardware, footwear* while
    a plate was attached to settle exactly those, which is two answers to one
    question in one prompt.

    ⚠ **THE JUDGE IS NOT HANDED THE PLATE BRANCH, AND THAT IS NOT THE #1278
    PART-1 DEFECT RETURNING.** That defect was the judge and the generator being
    told two different OUTFITS. Here they are told the same outfit; what differs
    is a clause about where the garment came FROM, and the judge is handed two
    images — the anchor and the candidate — and never the plate, so a sentence
    naming reference N would point it at a picture it cannot see. Its own
    below-frame clause already ends *"where it leaves them open any reading in
    keeping with the garments, materials and colours above the crop is correct"*,
    which is precisely what a plate-dressed hem is, so the permissive side is
    already wide enough to admit one. `packageViewExpectation` therefore passes
    `null` here and its sentence is byte-identical to today's.
  */
  const belowFrame = outfitReferenceOrdinal === null
    ? "Inside the frame of the reference, the reference is the record. Below its frame the "
      + "description governs: the cut, length, hardware, footwear and weathering it names are this "
      + "outfit's own wherever they appear, and where it leaves them open any reading in keeping with "
      + "the garments, materials and colours above the crop is correct. "
    : `Inside the frame of the reference, the reference is the record. Below its frame the OUTFIT is `
      + `reference ${outfitReferenceOrdinal}: copy its cut, length, hardware, footwear and weathering `
      + `rather than working them out from the description. `;
  return "the SAME outfit the reference photograph shows and the DESCRIPTION names — one outfit, "
    + "unchanged across every view. "
    + belowFrame
    + `Judge the clothing against both records together. ${wardrobeAdditionsClause(true, pronouns)}`;
}

/*
  ⚠ `CAST_PACKAGE_WARDROBE_SPEC_DESCRIBED` STOOD HERE AND IS GONE — #1480, and
  the uncalled-export sweep is what said so rather than a judgement.

  It was a CONSTANT because there was nothing to vary; #1480 gave this sentence
  two variables (the cast's pronouns, and whether an outfit reference settles
  the lower half), so every road that wanted it had to call the function
  instead. Keeping the constant beside the function as a default-form alias left
  an export with no consumer anywhere in the tree — not one production caller,
  not one test — and `check-cleanup-dispositions` refused the push for it.

  The sentence has not moved and nothing about it is lost: `wardrobeSpecFor` is
  still the one door both the generator and the judge come through, which is the
  property #1278 part 1's docblock above is really about.
*/

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
 *
 * ⚠ **ITEM 2 ABOVE IS NOW HALF-SUPERSEDED, AND THE HALF THAT SURVIVED COST A
 * SLICE (#1479, 2026-09-29).** It argued that the rest of the addition list
 * *"CAN stay because `wardrobeDoor.ts` refuses hats, props, logos and printed
 * text in the line: the two cannot disagree."* That is true of the LINE and
 * says nothing about the PHOTOGRAPH — and the photograph is the other record.
 * A stored line is a handful of words about the clothes; the anchor may show
 * earrings, a pendant, a headpiece, none of which any wardrobe line would
 * mention and none of which `wardrobeDoor.ts` has an opinion about. So the
 * door's refusals never protected this clause from the case that actually
 * arrived: an addition the reference itself shows.
 *
 * The list still stands, and the exception it now carries is
 * `wardrobeAdditionsClause`'s — one owner, three sentences, so the next
 * narrowing cannot reach two of them and miss this one again.
 */
export function castPackageWardrobeSpec(
  wardrobeLine: string | null,
  pronouns: CastPronouns = pronounsForSex(null),
): string {
  if (wardrobeLine === null) return sharedWardrobeSpec(pronouns);
  return `exactly this outfit, unchanged across every view: ${wardrobeLine}. `
    + "This description covers the whole figure — what is worn on the upper body, on the lower body "
    + "and on the feet — so it applies below the frame of the reference photograph as well as inside "
    + "it. Judge the clothing against this description and the reference photograph together. "
    + wardrobeAdditionsClause(true, pronouns);
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

/**
 * ⚠ **THE FACE BEING JUDGED IS THE ONE IN THE REFERENCE, NOT A HUMAN ONE —
 * #1582, and his own reaction is the reason it is a bug rather than a limit**
 * (2026-09-30, verbatim): *"this is legacy!! why does this kind of stuff still
 * exist we now all full creative casts"*.
 *
 * Four framing specs named human anatomy as the thing to look for — *"BOTH eyes
 * still visible"*, *"exactly ONE eye is showing"*, *"a margin of skin visible
 * BELOW the chin"* — and the judge is told an axis it is unsure about FAILS. So
 * a cast that is not shaped like a person was refused for not having a face it
 * was never meant to have. His own Jingu has **three eyes** and a bronze
 * apparatus where a chin would be; her refusals said so in their own words
 * (*"the third eye is barely visible"*, *"Crop is too tight, cutting off the
 * chin and mouth apparatus at the bottom edge"*) and **each one cost her a view
 * and a refund on a picture that may well have been right.**
 *
 * ⚠ **THE REPAIR IS NOT A WIDER LIST OF ANATOMIES, AND THAT DISTINCTION IS THE
 * WHOLE OF IT.** His ruling of 2026-09-24 forbids exactly that: *"we really
 * cannot be working from fixed lists in a fluid editing application it means no
 * sense to be rigid like this."* Patching *"both eyes"* into *"every eye"* plus
 * a clause per creature would be a taxonomy invented one cast at a time.
 *
 * **What the judge already holds is the one record that is not a list: the
 * ANCHOR.** Every view is judged against IMAGE 1, the signed photograph, and
 * `judgeSystemFor` already names it as such. So the landmarks stop naming
 * anatomy and name *what the reference shows* instead — the same principle
 * #1221 (*everything the reference shows on her is hers*), #1471 and this
 * week's wardrobe work all run on. It is not a taxonomy; it is the judge being
 * told to read the picture it was already given.
 *
 * ⚠ **AND IT DOES NOT WIDEN WHAT PASSES FOR A TWO-EYED CAST — that is the
 * thing to check when editing these sentences, and #1414's own measurement is
 * why.** *"exactly ONE eye is showing"* scored 0/10 non-matching where *"a full
 * 90 degrees"* scored 7/10, so the eye landmark is the strongest reader this
 * axis has ever had.
 *
 * ⚠ **WHICH IS WHY `sideClose` IS NOT IN THIS CLAUSE'S POPULATION, AND THAT WAS
 * A COURT'S DECISION RATHER THAN A DESIGN CHOICE.** The first two shapes of this
 * repair DID rewrite that sentence — conditioning the eye landmark on a face
 * that has an eye on each side, which reads as obviously safe — and a before /
 * after court on his own production frames said otherwise. Three arms, same six
 * pairs, five identical reads each at `temperature: 0`, cast56's delivered side
 * profile (asset 324):
 *
 *     sideClose spec                                 angle axis
 *     #1414's wording, untouched                     0/5 non-matching
 *     reference-relative + the inventory clause       5/5 non-matching
 *     reference-relative + the clause reworded        3/5 non-matching
 *
 * The judge's own notes say why, verbatim: *"Both eyes are faintly visible with
 * the far eye showing rather than fully hidden behind nose and brow."* **A
 * sentence telling a reader to inventory the features the reference shows is
 * poison on the one view whose test is that half of them must be HIDDEN.** So
 * that spec's bytes do not move, its view declares `concealmentTest`, and the
 * population below is derived from that.
 *
 * ⚠ **The honest remainder, named rather than implied**: `sideClose` therefore
 * still asks for *exactly ONE eye*, which is a question a one-eyed or three-eyed
 * being cannot always answer. It is on the card, with these numbers. What buys
 * the deferral is that **it did not in fact refuse her** — Jingu's delivered side
 * profile reads 0/5 non-matching on the angle axis under this spec, before and
 * after — so the measured cost of leaving it is zero and the measured cost of
 * touching it is three to five refusals out of five on a correct picture.
 *
 * ⚠ **The IDENTITY axis is deliberately untouched.** Its sentence in
 * `judgeSystemFor` is already reference-relative by construction (*"anything of
 * that kind visible in IMAGE 1 must be present in IMAGE 2"*, *"judge only where
 * both frames reach"*), so it has no anatomy assumption to correct. This clause
 * rides the FRAMING specs, which are the angle axis's alone.
 *
 * ⚠ **AND IT RIDES THE FOUR FACE SPECS ONLY, never the full-length three.**
 * There the reference is a chest-up master that does not reach the feet, so
 * *"a feature the reference does not show is never required"* would read as
 * permission to crop the legs off — the exact opposite of what those specs are
 * for. The full-length sweep's finding is recorded on the card instead of being
 * answered by the wrong sentence.
 *
 * Exported for the same reason {@link VIEW_IDENTITY_SENTENCE} is: its guard
 * asserts the bytes the specs actually carry rather than a retyped copy of them,
 * and a second typed copy is the drift working law 4 is about.
 */
export const FACE_FROM_REFERENCE =
  "Read from the reference photograph which features this person HAS at all, which may be more, "
  + "fewer or differently placed than a human face's. A facial feature the reference does not "
  + "show is never required here and is never a reason to fail. Which of the features they do "
  + "have should be VISIBLE in this particular frame is decided by the framing described above "
  + "and by nothing else — this sentence is about what they have, never about what must show.";

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
   * ⚠ **THE SAME FRAMING, STATED AS GEOMETRY — #1612 part 1, his ruling of
   * 2026-09-30 (*"i agree with you"*).**
   *
   * `spec.framing` above is a sentence handed to a vision model, and a model
   * reading a two-part prose rule answers whichever half is easiest: on one
   * afternoon the same close-up spec refused a three-eyed cast for not having
   * two eyes (#1582) and passed a frame with the whole neck and shoulders in it
   * that the same sentence calls too loose (#1611). This is that band written as
   * landmark predicates a segmenter can answer the same way every time.
   *
   * It sits HERE, beside the sentence it restates, because a view is one thing
   * and everything about it belongs in one entry — the same reason `belowWaist`,
   * `rotated` and `concealmentTest` are declared per view rather than derived
   * from the angle's name.
   *
   * ⚠ **IT IS A SECOND STATEMENT OF ONE BAND UNTIL THE SLICE THAT WIRES IT, AND
   * THAT IS DECLARED RATHER THAN QUIET.** Nothing reads this yet: the judge is
   * still asked `spec.framing` in prose. The slice that hands the framing axis
   * to the measurement DELETES that sentence from the judge's post, and one band
   * is left. Until then the two can disagree, and `viewFramingBands.test.ts`
   * holds each band against the sentence it restates by naming, for every rule,
   * the clause it comes from.
   *
   * ⚠ **AND THAT SLICE IS NOT A WIRING — MEASURED 2026-10-01, WHEN IT WAS PICKED
   * UP, AND THE PARAGRAPH ABOVE IS WHY IT LOOKED LIKE ONE.** *"Deletes that
   * sentence and one band is left"* is only true where the band says everything
   * the sentence says, and on four views it does not: `closeUp` owes an
   * ORIENTATION and a feature-PRESENCE test, `frontClose` owes how much of her is
   * in the picture, `sideFull` and `backFull` each owe which way the body faces.
   * **Five clauses, and `closeUp` is the one view whose band carries no
   * `readerRemainder` and therefore read as fully measured.** Each is declared on
   * its own band as `unrestated` and held there; the hand-over is paid off per
   * view, and deleting the prose question on a view that still owes one deletes a
   * stated framing test with no line of code saying so.
   *
   * It went unseen because the guard above pairs RULES with clauses in both
   * directions and **neither direction can see a clause no rule ever cited** —
   * the one-way blindness this repository keeps paying for.
   *
   * A view whose framing also asks something geometry does not answer here says
   * so in `band.readerRemainder`, in its own words.
   */
  band: ViewFramingBand;
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
  /**
   * ⚠ DOES THIS VIEW TURN THE SUBJECT AWAY FROM THE MASTER'S FRONT-ON FRAMING —
   * the views a Sign buys that rotate her, and the only ones a
   * which-side-are-you-looking-at sentence has any business reaching (#1579).
   *
   * Declared per view for the same reason `belowWaist` is, one line above: a
   * sixth view states its own answer rather than being caught by a regex on
   * "side" or "back", and absent means no — which is the safe direction here
   * too, because a front-on view told that the sides may have swapped has been
   * handed a licence it has no use for, and #1582 measured on the same day what
   * a clause costs when it reaches a view whose test it does not fit.
   */
  rotated?: boolean;
  /**
   * ⚠ **IS THIS VIEW'S FRAMING TEST ABOUT WHAT MUST BE HIDDEN, rather than about
   * what must be present — #1582, and the flag exists because a court refused to
   * let the tidy answer ship.**
   *
   * `sideClose` is the one, and it is the reason {@link FACE_FROM_REFERENCE} does
   * not reach every face spec. That clause tells the judge to read this person's
   * features off the reference; on a view whose whole test is *the far side is
   * hidden*, it primes a hunt for exactly the features that are supposed to be
   * out of sight, and the judge then finds a faint far eye and refuses a correct
   * profile. **Measured rather than reasoned** — three arms, same six pairs, five
   * identical reads each at `temperature: 0`, on cast56's delivered side profile
   * (asset 324, the frame #1414 celebrated):
   *
   *     sideClose spec                                 angle axis
   *     #1414's wording, untouched                     0/5 non-matching
   *     reference-relative + the inventory clause       5/5 non-matching
   *     reference-relative + the clause reworded        3/5 non-matching
   *
   * Declared per view like its two neighbours above, so the exclusion is DERIVED
   * from a stated property of the view rather than being this view's name written
   * into a guard. Absent means no, which is the safe direction: a new view that
   * forgets to declare it gets the clause and behaves like the three that are
   * fine, instead of silently losing the protection Jingu is owed.
   */
  concealmentTest?: boolean;
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

    — with the lower edge of the face and every eye present in every case, the
    crown free to crop, and hair free to run off the sides.

    ⚠ **THOSE TWO BOUNDS SAID "CHIN" AND THE THIRD CLAUSE SAID "BOTH EYES"
    UNTIL #1582.** The founder's ruling is untouched — the band, the two bounds
    and the two failure directions are exactly as he set them — and what moved
    is only WHOSE face the landmarks belong to: the reference's, not a human
    template's. See {@link FACE_FROM_REFERENCE}. A cast with a bronze jaw and
    three eyes was refused for a chin and a second eye it does not have.

    Writing it as a band is what makes the conformance check real. A single
    ideal crop can only be judged by "how close is this", which a vision model
    answers with a shrug.

    So both bounds are stated as LANDMARK PREDICATES rather than as proportions.
    A judge reliably answers "is the bottom of the face inside the frame" and
    "are the shoulders in frame"; it answers "does the face fill 80% of the
    height" badly. Too tight is therefore a CUT REQUIRED landmark — the margin
    of skin below the face's lower edge is what a too-tight crop destroys first
    — and too loose is a PRESENT FORBIDDEN one: shoulders, or headroom above
    the hair. Both are yes or no by looking, which is also what makes §I's
    fail-closed default ("unsure fails") work for us rather than against us.

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
        "a tight, front-on crop of the face: no tighter than eyebrows-to-the-bottom-of-the-face, "
        + "and no looser than forehead-to-the-bottom-of-the-face. The mouth, every eye the "
        + "reference shows, and the whole lower edge of the face as the reference shows it — a "
        + "chin, or whatever this person has in its place — are entirely inside the frame, with "
        + "a margin of skin visible BELOW that lower edge. "
        + "TOO TIGHT, and it fails: the bottom edge of the frame cuts the mouth or the lower "
        + "edge of the face, or that lower edge touches the bottom of the frame with no skin "
        + "below it. "
        + "The top of the head may be cropped and hair may run off the left and right edges — "
        + "but TOO LOOSE, and it fails: the neck and shoulders are in frame, or the whole "
        + "head fits with clear space above the hair. That is a portrait, not a close-up. "
        + FACE_FROM_REFERENCE,
      wardrobe: CLOSE_UP_WARDROBE,
    },
    /*
      THE FOUNDER'S OWN BAND, AS GEOMETRY — and both of his bounds turn out to
      be ONE quantity, which is what a band is.

        too tight   his words: "the bottom edge of the frame cuts the mouth or
                    the lower edge of the face, or that lower edge touches the
                    bottom of the frame with no skin below it" — so there is
                    SOME room below the face.
        too loose   his words: "the neck and shoulders are in frame, or the
                    whole head fits with clear space above the hair" — so there
                    is not MUCH room below the face, and the subject is cut by
                    the top.

      *"the answer is the range between them"* is his sentence about the crop,
      and the two rules on `face` are literally that range: more than a visible
      margin of picture below the lower edge of the face, and at most a third of
      a face-height of it.

      ⚠ **THE TOO-LOOSE RULE WAS `absent shoulders` UNTIL IT WAS DRIVEN, AND THE
      DRIVE IS THE MOST USEFUL THING ON THIS CARD.** It is the spec's own words,
      it passed every unit arm, and on his six production close-ups
      `region("shoulders")` answered NOTHING on the three frames that plainly
      have shoulders and answered SHOULDERS on the two that have none — wrong on
      five of five and wrong in both directions. See `FRAMING_LANDMARKS` in
      `viewFramingGeometry.ts` for the table. Room below the face is the same
      fact with no body part in it, and it is what separates his frames:

          asset  a person reading it         room below the face
          306    in band                     0.07
          345    in band (tusks, a cowl)     0.18
          314    neck and a collar           0.20
          322    neck and both shoulders     0.48   <- #1611
          326    neck and a shoulder strap   0.52
          371    neck and both shoulders     0.56   <- #1611

      0.3 sits in the middle of an empty band between 0.20 and 0.48 — a factor
      of 2.4 with nothing in it — rather than being fitted to a boundary case.
      ⚠ It is still a number chosen from six frames on one shift's reading, and
      **his eye closes it** (law 9): 314 and 326 are the two it separates, and
      they are the two a person could argue about.

      The headroom test reads the whole silhouette rather than the hair: a
      headwrap, a horn, a branch or a bald crown all decide "is there clear
      space above this person" and only one of them is a hairline. Pika's
      dreadlocks and Kai's cowl are both in the record.

      Left and right are deliberately unconstrained — his ruling lets hair run
      off both edges, and a rule he did not state is not added here.
    */
    band: {
      rules: [
        { must: "clearOf", landmark: "face", edge: "bottom" },
        { must: "roomBelowAtMost", landmark: "face", inItsOwnHeights: 0.3 },
        { must: "cutBy", landmark: "subject", edge: "top" },
      ],
      /*
        ⚠ **THE TWO CLAUSES OF HIS OWN SPEC THAT NO RULE ABOVE RESTATES, and
        this is the view the types called FULLY MEASURED** (#1612, the hand-over,
        2026-10-01). It has no `readerRemainder`, which read as *nothing is left
        over* — and what was actually true is *the rules left nothing over*, which
        is a different sentence about a smaller thing.

        Neither is a crop, which is why a silhouette cannot reach them: one is an
        ORIENTATION and one is a feature PRESENCE test. The second is also a
        COUNT, so #1582 governs it — it belongs with the reference's own face scan
        if it belongs anywhere, and {@link FACE_FROM_REFERENCE} is the sentence
        that keeps it from refusing a cast with three eyes or none. Delete the
        prose question here while these two stand and both tests are gone with
        no line of code saying so.
      */
      unrestated: ["front-on crop of the face", "The mouth, every eye the reference shows"],
    },
    directive:
      "BEAUTY CLOSE-UP OF THE FACE, STRAIGHT ON. The face fills the frame. Crop the TOP of "
      + "the frame across the forehead — anywhere between the eyebrows and the hairline — so "
      + "the crown of the head is cut off, and let the hair run off the left and right edges. "
      + "The BOTTOM of the frame sits below the lowest part of the face: the whole of it is "
      + "visible. The eyes this person has look directly into the lens and are critically "
      + "sharp. Skin texture, pores, vellus "
      + "hair, individual lashes and iris detail are all resolved. Do NOT crop at the mouth "
      + "or cut the bottom of the face, and do NOT pull back far enough to show the whole "
      + "head or the shoulders.",
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
        "a head-and-shoulders portrait, square to the camera, every eye the reference shows "
        + "visible, the whole hair silhouette inside the frame with headroom above it. "
        + FACE_FROM_REFERENCE,
      wardrobe: WARDROBE,
    },
    /*
      *"the whole hair silhouette inside the frame with headroom above it"* is
      the close-up's headroom test with its sign flipped, and it is read off the
      same silhouette for the same reason.

      *"every eye the reference shows visible"* is NOT here and must not be: it
      is a count of a feature, which is the sentence #1582 was refused by, and a
      count belongs with the reference's own face scan if it belongs anywhere.
      It stays with the reader, named below.
    */
    band: {
      rules: [{ must: "clearOf", landmark: "subject", edge: "top" }],
      readerRemainder:
        "whether every eye the reference shows is visible, and whether the subject is square "
        + "to the camera — a feature count and an orientation, neither of which this file's "
        + "landmarks can answer without the reference's own face scan.",
      /*
        ⚠ **THE DISTANCE — and it is the sharpest of the five, because the rule
        above and the remainder beside it between them say nothing about HOW MUCH
        OF HER IS IN THE PICTURE.** `clearOf subject top` is satisfied by a
        full-length body with room over its hair, so a whole-body frame delivered
        into the Portrait slot measures in band. Today the reader catches that
        correctly; hand the axis over with this unpaid and nothing does.

        It is geometry and it is payable: `roomBelowAtMost` on the face is the
        close-up's own too-loose bound, and a head-and-shoulders band is the same
        quantity with a wider bound. It is NOT written here on one shift's
        reading — a bound is a number his eye closes (law 9 — 0.3 took six of his
        frames and a Desk reply), and inventing a second one in the commit that
        hands the axis over is how a band comes to refuse pictures nobody
        measured.
      */
      unrestated: ["a head-and-shoulders portrait"],
    },
    directive:
      "FRONT-FACING HEAD AND SHOULDERS PORTRAIT. Square to camera, head straight with no tilt, "
      + "the eyes this person has looking directly into the lens. The entire hair silhouette is "
      + "inside the frame with clear headroom above it — nothing on the head is clipped.",
  },
  /*
    ⚠ **THE SECOND INSTANCE OF #1414's CLASS, SWEPT RATHER THAN WAITED FOR
    (working law 7, 2026-09-30).** `sideClose`'s docblock below carries the
    finding: a framing spec whose primary test is a NUMBER OF DEGREES asks a
    judge the one kind of question it answers badly, and the axis becomes a coin
    on any frame near the boundary.

    Swept across all seven entries, **exactly two state a degree** — that one and
    this one. Every other spec is already landmarks (*"the chin inside the
    frame"*, *"nothing cropped at the top or bottom"*, *"face not visible"*), so
    the class is two instances and this is the other.

    **This one was the milder of the two and is measured so**: the court read
    `threeQuarter` (asset 370) 5 of 5 `matches`, stable. It is milder because the
    number already came hedged (*"about 45 degrees"*) and two landmarks already
    rode beside it in a parenthesis. The repair is to promote them out of the
    parenthesis and make the degree stop being the test, which is a restatement
    of the same standard rather than a change to it.

    ⚠ **THE DIRECTION IS NOT LOOSENED AND MUST NOT BE.** A mirrored three-quarter
    is a REAL defect and the judge catches it correctly today — on his own Jingu
    (#1492, 2026-09-29) it returned *"head turned toward the subject's right
    (nose toward left edge) rather than the specified left-turn"*, which is the
    right answer to the right question. The mirror now has its own sentence
    instead of being derived from the parenthesis, so a refusal SAYS mirrored;
    that is the same verdict, spelled out.

    ⚠ **AND #1582 CORRECTED WHOSE EYES THOSE ARE, THE SAME DAY.** This repair
    said *"BOTH eyes still visible"* and *"a turn far enough to hide one eye"* —
    a landmark rule, which was right, on a HUMAN landmark, which was not. The
    turn is still judged by what is visible and never by a degree; what the
    reader is now told to look for is the face the reference shows rather than a
    two-eyed one. See {@link FACE_FROM_REFERENCE}.
  */
  threeQuarter: {
    angle: "threeQuarter",
    label: VIEW_ANGLE_LABELS.threeQuarter,
    spec: {
      framing:
        "a head-and-shoulders portrait with the head turned toward the subject's LEFT — their "
        + "nose toward the RIGHT edge of the frame — and every eye the reference shows still "
        + "visible. "
        + "Judge the direction and what is visible rather than estimating the turn in degrees: "
        + "square to the camera, with the nose toward neither edge, FAILS; a turn far enough to "
        + "hide the far side of the face — on a face with an eye on each side, far enough to hide "
        + "one eye — is a side profile and FAILS; and a head turned toward the subject's "
        + "RIGHT, nose toward the LEFT edge, is the mirror of what was asked and FAILS. "
        + "Anything between square and profile, turned the way asked, is the 45-degree "
        + "three-quarter this specifies. "
        + FACE_FROM_REFERENCE,
      wardrobe: WARDROBE,
    },
    /*
      ⚠ **NO MEASURABLE RULE, AND THE REASON IS WORTH MORE THAN THE RULE WOULD
      HAVE BEEN.** The obvious one to write here is the headroom its two
      neighbours have — *"the entire hair silhouette stays inside the frame"* —
      and that sentence is in this view's DIRECTIVE, not in its spec. The
      directive is what the generator was asked for; the spec is the standard a
      delivered picture is held to, and a measurement that quietly promoted a
      generator instruction into a standard would be refusing pictures for a
      rule nobody wrote down. The band restates the SPEC or it restates nothing.

      What the spec does state is a TURN and an eye count, and both stay with
      the reader below. The turn is geometry in principle — where the nose sits
      against the face's own width answers *"which way is this head turned"*
      without estimating a degree — but it needs a landmark model rather than a
      silhouette, and #1414 is a warning about answering a direction question
      cheaply.
    */
    band: {
      rules: [],
      readerRemainder:
        "the whole of it: which way the head is turned, that it is neither square to the camera "
        + "nor a full profile, and that every eye the reference shows is still visible. A "
        + "direction needs a landmark read and an eye count needs the reference's own face scan "
        + "(#1582); neither is a silhouette question. The mirror-image failure #1492 measured "
        + "stays with the reader with them.",
    },
    directive:
      "RIGHT-FACING THREE-QUARTER PORTRAIT. Head and shoulders only. The subject's nose points "
      + "diagonally toward the RIGHT EDGE OF THE OUTPUT FRAME at a 45-degree turn; the eyes this "
      + "person has remain visible. Never mirror the direction. The entire hair silhouette stays "
      + "inside the frame.",
    /* A 45-degree turn already hides part of the far side and foreshortens the
       rest, which is enough for the confusion #1579 measured at ninety. */
    rotated: true,
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
    /*
      *"nothing cropped at the top or bottom of the frame"* — the whole
      silhouette clear of both ends, which is the plainest geometry in the table
      and the one the reader was worst at: `backFull` is the most-refused view
      on production, 3 of 13, and none of the four cards this measurement came
      from had looked at it.

      *"standing square to the camera, arms relaxed at the sides"* is a pose
      rather than a crop; it stays with the reader, named below.
    */
    band: {
      rules: [
        { must: "clearOf", landmark: "subject", edge: "top" },
        { must: "clearOf", landmark: "subject", edge: "bottom" },
      ],
      readerRemainder: "the pose — square to the camera, arms relaxed at the sides.",
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
  /*
    ⚠ **THE ANGLE AXIS WAS 2-OF-3 AGAINST ITSELF ON THIS VIEW, AND THE SPEC IS
    WHY — #1414, 2026-09-30.**

    The judge was asked about one pair three times with everything identical,
    `temperature: 0`, and answered `differs` / `matches` / `differs` on ANGLE
    while identity and wardrobe held. Measured properly afterwards — 5 reads x
    7 pairs x 3 axes = 105, through the real judge on real production frames —
    **every one of the eight non-matching verdicts in the whole court was the
    ANGLE axis on a `sideClose`**, and identity and wardrobe were stable on 7
    pairs out of 7.

    **What that cost a customer cuts both ways.** `packageOrchestrator` refunds
    and DROPS a view whose axis fails, regenerates once, and then its answer
    stands. On an unstable axis two coin flips in a row take away a correct side
    profile — the refund is honest, the picture is gone — and the same coin
    keeps a wrong one.

    # It was not drift, and it was not the picture

    The cheapest hypothesis was a wording defect between the judge's spec and
    the generator's directive. **Read at the code, there is none**: both come
    from this one entry and say the same thing. And his eye ruled on the frames
    (law 9, 2026-09-30, verbatim): *"one angle is a side profile the other is a
    3/4 side angle."*

    **The cause is in the eight notes, which all say one thing in different
    words** — *"slightly less than a full 90-degree turn"*, *"close to a true
    profile but ... suggesting a slightly less than full 90-degree turn"*,
    *"only slightly beyond three-quarter view"*. **The judge was ESTIMATING
    DEGREES, because the specification made a degree its test.** A binary
    verdict on a continuous quantity is a coin wherever a frame lands near the
    boundary, and which frame is near it is not fixed.

    # The repair is this file's own rule, applied where it had not been

    `closeUp`'s bounds docblock, above in this same table, already wrote it down:

      > "So both bounds are stated as LANDMARK PREDICATES rather than as
      > proportions. A judge reliably answers 'is the chin inside the frame' and
      > 'are the shoulders in frame'; it answers 'does the face fill 80% of the
      > height' badly."

    A turn in degrees is that second kind of question. So the landmark becomes
    the TEST rather than a consequence clause hanging off the number: the far
    eye is hidden or it is not, and both of those are yes-or-no by looking —
    which is also what makes §I's "unsure fails" work for us instead of against
    us.

    ⚠ **THIS DOES NOT WIDEN WHAT PASSES, AND THE DISTINCTION IS THE WHOLE
    CARE.** *Only one eye showing* and *ninety degrees* describe the same
    photograph — at a true profile the far eye is behind the nose and brow. What
    changes is only which of the two the reader is asked to judge. A frame with
    both eyes plainly visible still FAILS, and the sentence now says so in its
    own words instead of leaving it to be derived from a number.

    ⚠ **The three options the card put on the table are NOT taken and none of
    them is implied here** — two reads with a tie-break, widening `unsure`, or
    making the axis advisory. Each changes what *"checked against the face you
    signed"* promises and what a view is refunded for, and that is a decision
    for him. This changes the question the judge is asked, not the standard it
    holds a picture to. `#1220`'s rule is untouched for the same reason: a
    flaky axis is not fixed by rolling it again.

    The generator's `directive` below is deliberately unchanged. A GENERATOR can
    be aimed at a number; only a READER has to estimate one.

    ⚠ **AND #1582 TRIED TO CORRECT THIS ONE FOR A THREE-EYED CAST, MEASURED IT,
    AND PUT IT BACK. THIS SENTENCE IS THE ONE FACE SPEC #1582 DOES NOT TOUCH.**

    Twice, in good faith, it was rewritten so the eye landmark was CONDITIONAL on
    a face that has an eye on each side — *"only the near side of the face is
    presented … on a face with an eye on each side, that means exactly ONE eye is
    showing"* — which reads as obviously safe and is not. A before / after court
    on real production frames, five identical reads per arm at `temperature: 0`,
    on cast56's delivered side profile (asset 324, the frame the measurement above
    celebrated):

        this wording, untouched                        0/5 non-matching
        conditioned + the reference-inventory clause   5/5 non-matching
        conditioned + that clause reworded             3/5 non-matching

    The judge's own words, verbatim: *"Both eyes are faintly visible with the far
    eye showing rather than fully hidden behind nose and brow."* **Any sentence
    that sets a reader inventorying the features the reference shows is poison
    here, because this is the one view whose test is that half of them must be
    HIDDEN.** The view declares `concealmentTest: true` so the clause's population
    excludes it by a stated property rather than by name.

    ⚠ **So the remainder is real and it is on the card**: this spec still asks a
    one-eyed or three-eyed being for *exactly ONE eye*. What buys the deferral is
    that it does not in fact refuse one — Jingu's delivered side profile reads
    0/5 non-matching here in every arm — so leaving it costs nothing measured and
    touching it costs a correct picture three times in five. The `directive` is
    unchanged with it, for one reason and one only: generator and judge must not
    be told two different profiles.
  */
  sideClose: {
    angle: "sideClose",
    label: VIEW_ANGLE_LABELS.sideClose,
    /*
      ⚠ **THE ONLY VIEW WHOSE FRAMING TEST IS CONCEALMENT — and #1582 learned
      that the hard way, at the frames.** See {@link FACE_FROM_REFERENCE} and
      the docblock above for the three-arm measurement.
    */
    concealmentTest: true,
    spec: {
      framing:
        "a head-and-shoulders TRUE side profile, not a three-quarter turn. "
        + "Judge this by WHAT IS VISIBLE rather than by estimating the turn in degrees: exactly "
        + "ONE eye is showing, and the far eye is hidden behind the nose and the brow. "
        + "If BOTH eyes are visible, or the far cheek is presented to the camera as a cheek "
        + "rather than reading as the edge of the face, that is a three-quarter turn and it FAILS.",
      wardrobe: WARDROBE,
    },
    /*
      ⚠ **THE ONE VIEW WITH NO MEASURABLE RULE AT ALL, and that is the honest
      answer rather than a gap.** Every word of this spec is about CONCEALMENT —
      one eye showing, the far eye hidden behind the nose and the brow — which is
      a question about what is NOT in the picture, and a silhouette cannot answer
      it. Its `concealmentTest` flag above already says why this view is unlike
      its neighbours.

      An empty rule list folds to `inBand`, which is correct: nothing was asked
      here, so nothing here failed, and the remainder below is what a reader is
      still answering. A band that invented a rule to avoid being empty would be
      the tidy answer #1582's court already refused twice.
    */
    band: {
      rules: [],
      readerRemainder:
        "the whole of it: a true side profile is judged by what is CONCEALED — one eye showing, "
        + "the far eye hidden behind the nose and the brow — and concealment is not a silhouette "
        + "question. A rule here would also have to be stated in the reference's own eye count "
        + "(#1582), which lives with the face scan and not with these landmarks.",
    },
    directive:
      "STRICT RIGHT-FACING SIDE PROFILE PORTRAIT. Head and shoulders only. The subject's nose points "
      + "toward the RIGHT EDGE OF THE OUTPUT FRAME; show one eye and a true 90-degree profile, never a "
      + "three-quarter view.",
    /* The view #1579 was measured on: her bare shoulder is the near side here
       and the draped sleeve hangs behind her. */
    rotated: true,
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
    /*
      Retired from the profile and given its band anyway, on the same
      sibling-consistency ground its `belowWaist` and `rotated` comments state:
      a historical entry that behaves differently from its live siblings is the
      trap the day somebody un-retires it. *"head to feet inside the frame"* is
      the same two rules as the two full-lengths; the STRIDE is a pose and stays
      with the reader.
    */
    band: {
      rules: [
        { must: "clearOf", landmark: "subject", edge: "top" },
        { must: "clearOf", landmark: "subject", edge: "bottom" },
      ],
      readerRemainder: "that the walk is genuinely in motion rather than a standing pose.",
      /*
        ⚠ The SIDE. Two `clearOf subject` rules hold a body inside the frame and
        say nothing about which way it faces, and the remainder above names only
        the stride — so a front-on full-length walk measures in band here.
        Retired from the profile (this angle is not in `CAST_PACKAGE_VIEWS`), so
        it is debt on a historical entry rather than on a view a Sign buys; it is
        declared on the same sibling-consistency ground every other field on this
        entry is.
      */
      unrestated: ["seen from the side"],
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
    /* Retired from the profile and flagged anyway, on the sibling-consistency
       ground its `belowWaist` comment above states. */
    rotated: true,
  },
  backFull: {
    angle: "backFull",
    label: VIEW_ANGLE_LABELS.backFull,
    spec: {
      framing:
        "the whole body seen from directly behind, head to feet inside the frame, face not visible",
      wardrobe: WARDROBE,
    },
    /*
      *"head to feet inside the frame"*, measured — this is the most-refused
      view on production (3 of 13, all time) and the plainest geometry in the
      table.

      *"face not visible"* is a concealment test like `sideClose`'s and is left
      with the reader for the same reason. It is deliberately NOT written as
      `{ must: "absent", landmark: "face" }`: a segmenter asked where a face is
      on a picture of somebody's back is being asked the open question D-213 was
      written about, and an empty answer from it would be indistinguishable from
      a failed one.
    */
    band: {
      rules: [
        { must: "clearOf", landmark: "subject", edge: "top" },
        { must: "clearOf", landmark: "subject", edge: "bottom" },
      ],
      readerRemainder:
        "that the face is not visible — a concealment test, and one a segmenter asked "
        + "\"where is the face\" on a picture of a back cannot answer honestly.",
      /*
        ⚠ THE DIRECTION, and on the most-refused view on production (3 of 13,
        all time). *"face not visible"* is the remainder above and it is NOT this
        clause: a cast photographed from the side with her face turned away shows
        no face and is not seen from behind. The two `clearOf subject` rules
        cannot tell a back from a front, and no landmark in this vocabulary can —
        which is why it reads as a reader's question rather than a rule, and why
        it is debt rather than a missing line.
      */
      unrestated: ["seen from directly behind"],
    },
    directive:
      "FULL BODY FROM BEHIND, walking away from camera. Head to feet entirely inside the frame. "
      /*
        ⚠ **IT SAID *"that the reference does not show"* AND PREDATED BOTH THINGS
        IT NOW CONTRADICTS — #1480 finding C.** The master is a chest-up FRONT
        photograph and cannot show a back at all, while the same prompt says
        *"ALSO TRUE OF THIS PERSON, and not visible in the reference photograph:
        … draw these where they belong"* (a born back tattoo) and, on a Sign with
        a plate, *"copy the GARMENTS from reference N exactly"* — whose right
        panel is the back. Three instructions, two of them telling the engine to
        put on the back what the third forbade. It names every record now.
      */
      + "The face is not visible. Add nothing to the back or arms that neither the references "
      + "nor the words above establish.",
    belowWaist: true,
    /* Seen from directly behind, left and right are mirrored — the plainest
       case of the confusion #1579 measured at ninety degrees. */
    rotated: true,
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
export function wardrobeSpecFor(
  angle: CastViewAngle,
  wardrobeLine: string | null,
  description: string | null = null,
  pronouns: CastPronouns = pronounsForSex(null),
  outfitReferenceOrdinal: number | null = null,
): string {
  const base = VIEWS[angle].spec.wardrobe;
  /*
    The close-up keeps its own sentence on both roads — at that crop the garment
    is barely in frame, which is the whole reason it has one (see
    `CLOSE_UP_WARDROBE`). Only the shared sentence has a described form.
  */
  if (base !== CAST_PACKAGE_WARDROBE_SPEC) return base;
  if (wardrobeLine !== null) return castPackageWardrobeSpec(wardrobeLine, pronouns) + sideClauseFor(angle, pronouns);
  /*
    #1278 part 1. The stored-line road is FIRST because a line is the stronger
    record when one exists — though none ever has: read at the rows 2026-09-26,
    0 of 6 minted casts carry `technicalSchema.wardrobe.line`, all time, the two
    signed the day before included.
  */
  return (description === null
    ? sharedWardrobeSpec(pronouns)
    : describedWardrobeSpec(pronouns, outfitReferenceOrdinal))
    + sideClauseFor(angle, pronouns);
}

/**
 * ⚠ **A ROTATED VIEW SHOWS THE OTHER SIDE OF HER, AND NOTHING TOLD THE JUDGE SO
 * — #1579.**
 *
 * # What a customer was losing
 *
 * A cast whose outfit differs left from right — one bare shoulder, one draped
 * sleeve — could lose her side profile and be refunded 50 credits for it, **at
 * random, on a picture that is correct.** Measured on his own cast 56, ten
 * identical reads of one delivered side view with everything held fixed: the
 * wardrobe axis refused **2 to 4 times out of 10**, while her other axes came
 * back identical every time.
 *
 * The judge's own words for it, verbatim: *"Sleeveless harness top now shows a
 * bare shoulder, whereas the reference had a long draped sleeve/robe covering
 * that arm."* **Both halves of that are true and the conclusion is wrong** — the
 * reference does show a draped sleeve, over the OTHER arm. Her master is
 * chest-up and front-on; the profile turns her ninety degrees, so the bare
 * shoulder is now the near side and the robe hangs behind her.
 *
 * Reproduced independently while #1582 was being courted, on the same cast and
 * the same delivered frame: the wardrobe axis refused 1 to 4 times in 5 across
 * four separate five-read arms, with the judge saying *"The flowing dark
 * robe/kimono layer over the shoulder seen in the reference is missing."*
 *
* ⚠ **AND IT COMPOSES WITH THE CAST'S OWN PRONOUNS, WHICH IS NOT A STYLE NOTE
 * — the first draft of this clause hard-coded *"her"* and
 * `viewOutfitAuthority.test.ts` caught it inside a minute** (#1480 finding A:
 * *never calls a male cast 'her', on any angle, plate or no plate*). The guard
 * was already there, watching the road this clause joined.
 *
 * # Why the repair is a per-view clause and not an edit to the shared sentence
 *
 * The card's own reason for filing rather than fixing was that the obvious
 * repair edits `sharedWardrobeSpec`, **which reaches every axis on every signed
 * cast** — and #1229 is the standing card about not doing that lightly. So this
 * is composed per angle instead, off the `rotated` flag each view declares for
 * itself, and a front-on view's bytes do not move at all. `closeUp` never sees
 * it: it returns before this point and has no rotation to explain.
 *
 * ⚠ **It removes a false failure and licenses nothing.** It says the two frames
 * do not show the same sides of her body; it does not say a different garment is
 * acceptable, and the *same outfit, same garments, same colours* clause it is
 * appended to is untouched. Stated out loud because a wardrobe clause that
 * widens is a slice that stops being refunded, and its own guard arm drives it.
 *
 * ⚠ **AND IT GOES TO THE GENERATOR TOO, WHICH IS THIS FILE'S OWN RULE RATHER
 * THAN AN OVERSIGHT**: `wardrobeSpecFor` has one caller on each road by design,
 * because two authors of one outfit sentence is how a judge comes to fail a view
 * for wearing what the prompt asked for. The sentence is true of the render as
 * well as of the reading — an asymmetric outfit SHOULD present its near side
 * here — so one copy serves both.
 */
function sideClauseFor(angle: CastViewAngle, pronouns: CastPronouns): string {
  if (!VIEWS[angle].rotated) return "";
  return " This view turns the subject away from the reference's front-on framing, so the two "
    + `photographs do not show the same sides of ${pronouns.possessive} body: a garment the `
    + `reference shows on one side of ${pronouns.object} may be the far side here — hidden behind `
    + `${pronouns.object}, or foreshortened — and what is `
    + "nearest the camera here may be the side the reference showed least. Judge whether the SAME "
    + "outfit is present, never whether a garment falls on the same side of the frame. An outfit "
    + `that is different on ${pronouns.possessive} two sides is not a wardrobe change: the turn has `
    + "changed which of the two you can see.";
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
export function belowWaistFor(
  angle: CastViewAngle,
  wardrobeLine: string | null,
  description: string | null = null,
  outfitReferenceOrdinal: number | null = null,
): string {
  /*
    ⚠ **AN OUTFIT REFERENCE SILENCES THIS SENTENCE ENTIRELY — #1480, and the
    docblock above already predicted it: "what it cannot fix is its being asked
    three times."** Path E was built to stop the bottom half being worked out
    from words, and this sentence went on asking for exactly that, composed with
    no knowledge that a plate rides.

    It is the same branch a stored wardrobe line already took, with one more
    condition, for the same reason: when something else in the request settles
    the lower half, a paragraph telling the engine to derive it is not
    redundancy, it is a second answer.
  */
  if (!VIEWS[angle].belowWaist || wardrobeLine !== null || outfitReferenceOrdinal !== null) return "";
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
/**
 * ⚠ **WHAT THE DESCRIPTION SETTLES ON *THIS* ROAD, AND WHAT IT DOES NOT —
 * #1480 finding B.**
 *
 * `AUTHORITY_LINE` arrived on the view road with #1240 (his *"why cant the
 * realism block be the same as when casting a sheet?"*), and on the ROLL it is
 * right: *"Anything the description states outright — a look, a feature, a
 * garment, a mood — is a fact and overrides any default or negative here."*
 *
 * On a VIEW it overreaches. A brief reading *"on a rain-soaked street at night,
 * mid-stride, laughing"* then overrides the studio block's *"no environment,
 * location or scene"* and fights the angle directive's own posture — and the
 * judge's framing spec, which is derived from `spec` alone and knows nothing
 * about the brief, then fails the view we asked for. His Bingu's two angle
 * refusals are the first frames to read this against.
 *
 * So ONE sentence, on the view road only, placed with the view's own lines and
 * never inside the shared block — the block is one road's and both roads' by his
 * ruling, and narrowing it here would narrow the roll too.
 */
const VIEW_DESCRIPTION_SCOPE =
  "ON THIS ROAD the description settles WHO this person is and WHAT they wear, and nothing else: "
  + "where they are, what they are doing, their expression and where the camera stands come from "
  + "this view's own directive and the studio block below, never from the description.";

export function composePackageViewPrompt(
  angle: CastViewAngle,
  wardrobeLine: string | null = null,
  description: string | null = null,
  options: {
    /** Whose face this is, for every sentence that refers to the person (#1480 finding A). */
    pronouns?: CastPronouns;
    /**
     * WHICH REFERENCE IS THE OUTFIT, when one rides — `null` on every view that
     * has no plate and on a Sign whose plate did not land (#1480).
     *
     * ⚠ **It is the ORDINAL and not a boolean**, because three of the five
     * places that addressed the outfit have to stop deferring to the
     * description and start naming the picture, and a sentence that says *"the
     * outfit is a reference"* without saying WHICH one is no better than the
     * ambiguity it replaces. The orchestrator already computes it
     * (`2 + crops.length`) for the clause itself; it is passed in rather than
     * recomputed, because two authors of one ordinal would point a Cast with
     * three tattoos at a picture of her elbow and call it the outfit.
     */
    outfitReferenceOrdinal?: number | null;
    /** The outfit clause itself, composed by its owner and PLACED here (finding D). */
    outfitClause?: string;
  } = {},
): string {
  const view = VIEWS[angle];
  const brief = viewDescriptionOf(description);
  const pronouns = options.pronouns ?? pronounsForSex(null);
  const outfitReferenceOrdinal = options.outfitReferenceOrdinal ?? null;
  return [
    VIEW_IDENTITY_SENTENCE,
    referenceRuleFor(brief, pronouns, outfitReferenceOrdinal),
    /*
      #1278 part 1 — the cast's own words, and the position is load-bearing in two
      directions. It sits AFTER the identity sentence and the reference rule, so
      the reference's primacy is established before the description is read; and
      BEFORE the house paragraphs, so `AUTHORITY_LINE`'s *"the description says WHO
      to cast"* has a referent at last. Since #1240 brought that paragraph onto
      this road it has been resolving to nothing, leaving *"where the description
      is silent, this block governs: plain studio frame"* as its only live branch.
    */
    ...(brief === null ? [] : [`DESCRIPTION: ${brief}`, VIEW_DESCRIPTION_SCOPE]),
    `${view.directive}${belowWaistFor(angle, wardrobeLine, brief, outfitReferenceOrdinal)}`,
    `WARDROBE: ${wardrobeSpecFor(angle, wardrobeLine, brief, pronouns, outfitReferenceOrdinal)}`,
    /*
      ⚠ **THE OUTFIT CLAUSE SITS WITH WARDROBE — #1480 finding D.** It was
      appended by `packageOrchestrator` AFTER the whole house block, i.e. after
      `AUTHORITY_LINE`, which is the paragraph that says what beats what — so the
      one sentence naming the outfit's real authority sat outside the ordering
      that decides authority. It is the outfit's sentence; it belongs where the
      outfit is discussed.

      It arrives composed rather than composed here: its owner is
      `outfitReferenceClause` in `outfitPlate.ts`, which knows the reference's
      SIDE and KIND, and neither of those belongs in this signature.
    */
    ...(options.outfitClause ? [options.outfitClause] : []),
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
