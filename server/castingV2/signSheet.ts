/**
 * THE SIGN SHEET — one render that is the whole package, and the cut that finds
 * the panels instead of assuming them.
 *
 * # His word, 2026-10-07 (terminal), closing #1690
 *
 * > *"and then we go with the sunburst 2.5 max quality for the sign sheet"*
 *
 * Said after he judged the three-engine A/B and the cut views by eye, and after
 * *"sunburst sheets nail it"* and *"gpt image 2.5 had the best results and we
 * can also drop the outfit plate if using gpt image 2.5 as it can come up with
 * the outfit just as good . only reason for the outfit plate was because NBP
 * sucks at outfit creativity"*.
 *
 * So one Sunburst `high` render at 3840x1648 replaces **five Nano Banana Pro
 * views and one Sunburst outfit plate**: ~$0.07 against ~$0.90, ~61–69 s against
 * ~1.5–2 min, and the outfit is settled by construction because every panel is
 * painted in the same frame rather than reasoned toward by six independent
 * calls. The hem-and-shoes complaint that path E's plate existed to answer
 * (*"the hem and shoes differ every take"*, #1278) cannot be raised against one
 * picture.
 *
 * # What this module is NOT
 *
 * ⚠ **It is not `characterSheet.ts`, and the two must never be confused.** That
 * one COMPOSES a turnaround from views the customer has already paid for —
 * arithmetic over existing pictures, no generation, no credits. This one
 * GENERATES the pictures. One is a contact sheet; the other is the shoot.
 *
 * # The three facts the cut rests on, measured rather than reasoned
 *
 * Read at the returned bytes of the three real court sheets on #1690, which are
 * the sheets whose cut views **his eye passed**:
 *
 * 1. **Every sheet came back exactly 3840x1648** — the ask, unclamped. See
 *    `SIGN_SHEET_SIZE`.
 * 2. ⚠ **THE PANELS ARE NOT FIFTHS.** An equal fifth is 768 px; the real panels
 *    measured **624–868 px**, a spread of 244 px. A blind-fifths cut puts a
 *    boundary up to 100 px inside a figure, and on this road **nothing
 *    downstream would catch it**: #1903 deleted the framing and wardrobe axes,
 *    so the judge's three surviving axes are identity, intact and people. A
 *    beheaded panel is none of those. The detector is therefore load-bearing
 *    and not an optimisation.
 * 3. ⚠ **THE DIVIDER IS A BRIGHT BAND, NOT A DARK LINE** — and this is the one
 *    fact a reader would get wrong from the description. The obvious reading of
 *    *"find the divider"* is *"find the darkest column"*, and it is wrong on all
 *    twelve real boundaries: the darkest column in each search window missed its
 *    divider by **91 to 300 px**, because dark hair and dark clothing are darker
 *    than any divider. What the sheets actually carry is a near-white run 2–9 px
 *    wide, 53–101 greylevels above its local background, with **zero other
 *    columns that bright inside the window on any of the twelve**.
 *
 * `signSheet.test.ts` drives all of this against those three PNGs rather than
 * against a fixture, and its blind-fifths arm is the control that fails.
 */
import sharp from "sharp";

import type { CastViewAngle } from "../../shared/boardTypes";
import type { RenderBudget } from "../providers/renderBudget";
import type { ImageResult, ReferenceImage } from "../providers/types";
/* `capitalize` rather than a local one: `castPronouns` already exports it for
   exactly this job ("He came from this sheet."), and a second copy of a
   one-line string helper beside the module that owns it is working law 4 in
   miniature. */
import { capitalize, pronounsForSex, type CastPronouns } from "./castPronouns";
import { CAST_PACKAGE_VIEWS, viewDescriptionOf } from "./castViewPackage";
import { inkViewCropClause, type CarriedInkCrop } from "./inkViewReferences";
import { composeViewFeatureWordsClause, type CarriedFeatureWords } from "./viewFeatureWords";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("castingV2/signSheet");

/**
 * HIS JUDGED PANEL LINES, keyed by the angle each one is the camera for.
 *
 * ⚠ **THIS IS A QUOTATION, AND THE ONLY THINGS CHANGED ARE THE ONES THAT HAD TO
 * BE.** The text is `output/1690-sunburst-noplate/prompt-sent.txt` — the
 * positive-style rewrite whose cut views his eye passed — quoted on #1904 in
 * full. Two adaptations, both forced and both named:
 *
 *   - **Pronouns are parameterised.** His prompt was written for one cast and
 *     says *"her"*; this product casts men, women, groups and creatures, and
 *     `castPronouns` exists precisely so no request calls a male cast *"her"*
 *     (#1480 finding A). Every pronoun comes from the cast.
 *   - **The subject noun is generalised.** His closing line says *"One woman
 *     (reference 1)"*, which is Sifr rather than the product — and **his own
 *     opening line already says the general form**, *"each panel showing the
 *     same person"*. So the closing line says person too, which is his own word
 *     from two paragraphs earlier rather than this module's invention.
 *   - ⚠ **One stale clause is corrected.** His panel 5 ends *"exactly what the
 *     TWO references establish"* — a leftover from the earlier plate-road sheet,
 *     where reference 2 was the wardrobe plate. The prompt he judged carries
 *     **one** reference and this road carries one, so the sentence names
 *     reference 1. Left standing it would point a paid panel at a picture the
 *     request does not hold, which is the defect `outfitReferenceClause` and
 *     `inkViewCropClause` both derive their ordinals to avoid.
 *
 * ⚠ **It is keyed `Partial`, and the refusal in `panelLineFor` is the control.**
 * `CastViewAngle` carries seven members — the comp-card six plus the close-up —
 * and only five are in the package. Authoring panel lines for `frontClose` and
 * `sideFull` to satisfy a total `Record` would be inventing prompt text his eye
 * has never seen, for two views no Sign renders.
 *
 * ⚠ **A TENSION WORTH NAMING RATHER THAN HIDING, because a future camera change
 * will meet it.** His rule of 2026-09-27 is *"the sheet should copy the exact
 * angles and camera views the current views use not invent new ones"*, and these
 * lines are a REWRITE of `castViewPackage`'s per-angle `directive` fields for a
 * panel, not a derivation from them. They cannot be derived: a directive is
 * written for a frame the engine controls alone, and the court measured that
 * sending the directives verbatim produced a sheet he could not judge. So the
 * two can drift — if a view's camera ever moves in `castViewPackage`, **this
 * table moves with it in the same commit**, and the arm below is only able to
 * catch the coarser error (an angle with no line at all).
 */
export const SIGN_SHEET_PANEL_LINES: Readonly<
  Partial<Record<CastViewAngle, (pronouns: CastPronouns) => string>>
> = {
  closeUp: (p) =>
    `THE CLOSE-UP. ${capitalize(p.possessive)} face fills the panel: the top edge crosses `
    + `${p.possessive} forehead between the eyebrows and the hairline, the bottom edge sits below `
    + `${p.possessive} chin with the whole face inside, and ${p.possessive} hair runs past both side `
    + `edges. Eyes straight into the lens and critically sharp — pores, vellus hair, individual `
    + `lashes and iris detail all resolved.`,
  threeQuarter: (p) =>
    `THE THREE-QUARTER. Head and shoulders, turned 45 degrees so ${p.possessive} nose points `
    + `toward the right edge of the sheet, both eyes visible, the full hair silhouette inside the `
    + `panel.`,
  frontFull: (p) =>
    `THE FULL FRONT. Full body, square to camera, the whole figure inside the panel with margin `
    + `above ${p.possessive} hair and below ${p.possessive} feet. Arms relaxed at `
    + `${p.possessive} sides, weight even, standing still.`,
  /* No pronoun in his line for this panel, so none is introduced — the whole
     sentence is his, word for word. */
  sideClose: () =>
    "THE PROFILE. Head and shoulders in a true 90-degree right profile, nose pointing at the "
    + "right edge of the sheet, one eye visible.",
  backFull: (p) =>
    `THE FULL BACK. Full body from behind, walking away, the whole figure inside the panel, the `
    + `back of ${p.possessive} head to camera. ${capitalize(p.possessive)} back and arms carry exactly `
    + `what reference 1 establishes.`,
};


/**
 * HOW MANY PANELS A SHEET HOLDS — the package's own view count, never a literal.
 *
 * ⚠ **The cut and the prompt read the SAME list in the SAME order**, which is
 * the only thing standing between a sixth view and a package where every
 * picture is in the wrong slot. `CAST_PACKAGE_VIEWS` is ordered *"as the room
 * reads them"* — closeUp, threeQuarter, frontFull, sideClose, backFull — and his
 * panel order is that order, which is why this derives rather than restating it
 * (working law 4). A reordering of that list reorders both halves together.
 */
export const SIGN_SHEET_PANEL_ORDER: readonly CastViewAngle[] = CAST_PACKAGE_VIEWS;

/**
 * THE TWO SHEETS A SIGN RENDERS, AND WHY THERE ARE TWO.
 *
 * **His word, 2026-10-08 (terminal), ruling #1926:** *"yes option 1 cooks well
 * done"* — the Sign renders **two** Sunburst sheets **in parallel**, not one.
 *
 * ⚠ **THE REASON IS THE STRIP, AND IT IS ARITHMETIC RATHER THAN TASTE.** One
 * sheet of five panels at 3840x1648 makes a panel 768x1648 — an aspect of
 * **0.466** against the strip tile's `aspect-ratio: 4 / 5` (0.8) with
 * `object-fit: cover`, so a tile showed the top **58%** of a paid view: the
 * close-up lost its mouth and both full-length views lost their legs
 * (`castingV2.css:1813`). Splitting the panels by what they frame lets each
 * sheet take the shape its pictures want — heads land ~1276x1648 (0.774) and
 * bodies ~1750x2336 (0.749), which the same tile shows at **96.8%** and
 * **93.6%**. Today's Nano Banana Pro view is 1696x2528 (0.671) and shows at
 * 83.9%, so this is better than the road it replaces rather than merely less
 * bad than one sheet. ⚠ **No client change is owed, and that is a measured
 * claim, not a hope** — `signSheet.test.ts` recomputes all four of those
 * percentages from the CSS rule itself, with the one-sheet shape as its
 * failing control.
 *
 * ⚠ **BOTH SHEETS TAKE THE MASTER AS THEIR ONLY REFERENCE, AND THE OUTFIT AS
 * WORDS.** The tempting shape is to render the body sheet first and hand it to
 * the head sheet as a second reference showing the outfit — and the relay's
 * tested `prompt-head.txt` does exactly that. ⚠ **It cannot ship, because his
 * ruling says IN PARALLEL**: a head sheet that references the body sheet must
 * wait for it, which serialises the two and doubles the wall time he measured
 * (~70 s for both together). So the head sheet carries the same outfit
 * paragraph the body sheet does, which is the arm his parallel test actually
 * ran — his card says so in the same breath as the prompts.
 *
 * ⚠ **THE PANEL LISTS ARE DERIVED FROM {@link CAST_PACKAGE_VIEWS}, NEVER
 * RESTATED** (working law 4). Only the SPLIT is declared below; each sheet's
 * order is the package's own order, filtered — so a reordering of the package
 * reorders both sheets with it, and the cut and the prompt still read one list.
 * A sixth view added to the package and not named here REFUSES at
 * {@link signSheetPlan} rather than silently rendering four panels and filing
 * five.
 */
const BODY_SHEET_ANGLES: ReadonlySet<CastViewAngle> = new Set<CastViewAngle>([
  "frontFull",
  "backFull",
]);

export type SignSheetKind = "head" | "body";

export const SIGN_SHEET_KINDS: readonly SignSheetKind[] = ["head", "body"];

/**
 * THE PIXELS EACH SHEET IS ASKED FOR — his two numbers, measured on the frames
 * his eye passed (#1904, 2026-10-07T23:43:31Z).
 *
 * ⚠ **A sheet's size is a property of the SHEET KIND, not of a request**, which
 * is why it lives here and reaches the provider through the engine factory. The
 * alternative — an `imageSize` on every identity request — would let a body
 * sheet be asked for at head pixels by a caller that simply forgot, and the
 * panel aspect is the whole point of the split. It travels beside
 * {@link SignSheetPlan.panelOrder} so the pixels and the panel list cannot
 * disagree about which sheet is being rendered.
 *
 * ⚠ **BOTH ARE READ AT THE RETURNED BYTES, NEVER INFERRED FROM THE ASK** —
 * this paragraph moved here from `falImages.SIGN_SHEET_SIZE`, which the split
 * deleted, and it is the measurement rather than a citation of one:
 *
 *     asked 3840x1648  → returned 3840x1648   (#1690 sheets 1, 2 and 3)
 *     asked 3840x1648  → returned 3840x1648   (#1926 head sheet, both renders)
 *     asked 3504x2336  → returned 3504x2336   (#1926 body sheet)
 *
 * Head is 6.33 MP and body 8.19 MP, both inside the door's ~8.29 MP ceiling,
 * and every side is a multiple of 16 as the door requires (3840/16 = 240,
 * 1648/16 = 103, 3504/16 = 219, 2336/16 = 146). ⚠ **The body sheet sits within
 * 1.2% of that ceiling**, so a future panel added to it needs the ceiling
 * re-read and not just a wider number.
 *
 * ⚠ **AND NOTHING MAY COMPUTE A PANEL FROM THESE NUMBERS**, which is the one
 * hazard they carry and {@link cutSignSheet}'s whole subject. On the head sheet
 * an equal third happens to be right to 2 px; on the five-panel court sheets
 * the real panels came back 624–868 px against an equal 768, so a cut derived
 * from a size beheaded a figure on two panels in five. The equal share is the
 * FALLBACK the detector reaches for, never the answer it starts from.
 */
export const SIGN_SHEET_SIZES: Readonly<Record<SignSheetKind, { width: number; height: number }>> = {
  head: { width: 3840, height: 1648 },
  body: { width: 3504, height: 2336 },
};

/** Which sheet a view is cut from — the one place that answers it. */
export function signSheetKindFor(angle: CastViewAngle): SignSheetKind {
  return BODY_SHEET_ANGLES.has(angle) ? "body" : "head";
}

export type SignSheetPlan = {
  readonly kind: SignSheetKind;
  readonly panelOrder: readonly CastViewAngle[];
  readonly size: { width: number; height: number };
};

/**
 * THE TWO SHEETS TO RENDER, each with the panels it carries in the package's
 * own order — and it REFUSES an empty one.
 *
 * An empty panel list would mean a sheet asked for with nothing to paint: the
 * prompt would promise zero panels, the engine would return something, and the
 * cut would file it. That is a startup-shaped failure, so it is raised before
 * any money moves rather than discovered in a delivered package.
 */
export function signSheetPlan(
  panelOrder: readonly CastViewAngle[] = SIGN_SHEET_PANEL_ORDER,
): readonly SignSheetPlan[] {
  return SIGN_SHEET_KINDS.map((kind) => {
    const panels = panelOrder.filter((angle) => signSheetKindFor(angle) === kind);
    if (panels.length === 0) {
      throw new Error(`the ${kind} sheet would be rendered with no panels on it`);
    }
    return { kind, panelOrder: panels, size: SIGN_SHEET_SIZES[kind] };
  });
}

/**
 * HOW FAR FROM ITS FIFTH A DIVIDER IS LOOKED FOR — his card's ±6%, of the
 * SHEET'S WIDTH.
 *
 * ⚠ **Of the width, not of a panel — and that distinction is measured, not a
 * reading of the English.** The worst real deviation of a divider from its
 * fifth is **74 px** (sheet 1's third boundary, 2230 against 2304). That is
 * 1.93% of the 3840 width and **9.6% of a 768 px fifth**, so ±6% of a fifth
 * would have MISSED a real divider on the first sheet it met, while ±6% of the
 * width is 230 px — about three times the worst case observed.
 */
export const DIVIDER_SEARCH_FRACTION = 0.06;

/**
 * HOW FAR BELOW THE BRIGHTEST COLUMN A COLUMN MAY BE AND STILL BE THE DIVIDER.
 *
 * Measured: band columns sit at 249–254 and the first column OUTSIDE a band
 * drops to 161–239 — so the smallest real step off a band is 12 greylevels and
 * the largest is 93. A tolerance of 12 therefore takes the whole band and the
 * transitional pixel at its edge, and nothing beyond it.
 */
const DIVIDER_BAND_TOLERANCE = 12;

/**
 * HOW BRIGHT A BAND MUST BE AGAINST ITS NEIGHBOURHOOD TO BE A DIVIDER AT ALL —
 * against EACH side of it, not against their average (#1976).
 *
 * Measured contrast on the twelve court boundaries, as the average of the two
 * sides: **53 to 101**. The floor is set at 25 — under half the weakest real
 * one — because the cost of the two errors is wildly asymmetric: a missed
 * divider falls back to the fifth, and a false one cuts a panel at a bright
 * patch of backdrop.
 *
 * ⚠ **SINCE #1976 IT IS A FLOOR ON THE WEAKER SIDE, and the number did not
 * have to move.** Every real divider in both fixtures — the twelve court
 * boundaries, the body sheet's one and the serial head sheet's two, fifteen in
 * all — stands **49.9 to 91.3** above its WEAKER side, so 25 is still under
 * half the weakest. What the averaged reading let through was a figure across
 * a boundary: the band is the backdrop beside it, one sample lands in the
 * body, and the average scored **55–62** while the backdrop side read only
 * **19.1–21.1**. Driven over 306 figures (spans 12–400 px, three darknesses,
 * eleven offsets) across both boundaries of the shipping head sheet, the
 * average called **290** of them a divider and the two-sided reading calls
 * **none**. ⚠ **The margin on that side is thin and is stated
 * rather than hidden**: 21.1 against 25. A backdrop with a steeper fall-off
 * 20 px out than the shipping sheet's would cross it, and 30 is the floor that
 * clears the same 306 by nine greylevels while staying 20 under the weakest
 * real divider — a re-tune that changes where no measured sheet is cut, left
 * to the eye that closes #1904 rather than taken here.
 */
export const DIVIDER_MIN_CONTRAST = 25;

/**
 * HOW FAR OUTSIDE A BAND ITS BACKGROUND IS SAMPLED.
 *
 * Far enough to be past the transitional pixels, near enough to be the same
 * panel's backdrop rather than a figure. Real bands are 2–9 px wide, so 20 px
 * clears them with room to spare.
 */
const DIVIDER_BACKGROUND_OFFSET = 20;

/**
 * THE WIDEST A DETECTED BAND MAY BE BEFORE IT IS CLAMPED AROUND ITS PEAK.
 *
 * ⚠ **A cap rather than a rejection, and the difference matters.** Real bands
 * are 2–9 px — 0.05–0.23% of the width — so a band that expands past 1% is one
 * that has run into something bright that is not a divider: a pale backdrop
 * beside a small figure, most likely panel 5's. **Falling back to the fifth
 * there would be the worse answer**, because the peak is still sitting on a real
 * divider and the fifth is up to 74 px away from it. So the band is clamped
 * around its peak and the cut stays on the divider.
 *
 * ⚠ **THAT CASE IS REASONED, NOT MEASURED — and #1976 found the clamp's real
 * customer was the opposite one.** On every sheet in both fixtures the clamp
 * fires on no real divider at all (they are 2–9 px); it fired only on the
 * shipping head sheet, which falls back before reaching it, and on a FIGURE
 * across a boundary, where the "band" is the backdrop beside the body and the
 * clamp turned it into a confident cut up to 155 px off the seam. The
 * two-sided floor now refuses that before the clamp is reached. **The cost,
 * named:** a real divider whose backdrop on one side sits within the floor of
 * it would now fall back too — and the fallback is loud when it lands on no
 * seam, where the false divider was silent. No measured sheet has one.
 */
const DIVIDER_MAX_WIDTH_FRACTION = 0.01;

/**
 * THE NARROWEST A PANEL MAY BE BEFORE THE WHOLE CUT IS REFUSED.
 *
 * Expressed against an equal panel, so it follows the view count and the sheet
 * width rather than pinning a pixel number. The narrowest real panel measured
 * **622 px against a 768 px fifth — 0.81** — so 0.4 leaves a factor of two.
 *
 * ⚠ **Below it the sheet is REFUSED rather than delivered**, because a 200 px
 * panel is not a picture anybody paid for and the judge's three surviving axes
 * cannot see it. A refusal here reaches the caller as *this sheet did not arrive
 * usable*, which is the arrival road — spaced retries, the slice refunded if it
 * never comes — rather than a charge for a sliver.
 */
const MIN_PANEL_FRACTION_OF_EQUAL = 0.4;

/**
 * HOW FAR FROM THE EQUAL SHARE A DARK SEAM MAY SIT AND STILL BE *ITS* SEAM.
 *
 * The question this answers is not *where is the seam* but *did the line I
 * already chose land on one*, so the window is tight on purpose: a seam 40 px
 * away means the fallback cut in the wrong place and the alarm should fire.
 * Measured on the shipping head sheet, both seams sit at offset **0**, and the
 * serial head sheet's bright peaks sit at **+1** — so 4 px is several times
 * the worst real deviation and still an order of magnitude inside the panel.
 */
const SEAM_SEARCH_PX = 4;

/**
 * HOW WIDE A DARK RUN MAY BE BEFORE IT IS A FIGURE RATHER THAN A SEAM.
 *
 * ⚠ **This is the clause that tells the two apart, and it is the whole point.**
 * A seam painted between two flush panels is a hairline; a body crossing the
 * line is hundreds of columns of hair, skin and clothing. Measured with the
 * same {@link DIVIDER_BAND_TOLERANCE} the bright side uses: the two real seams
 * span **1 and 2 px**, while the deepest dark run near any other boundary in
 * either fixture spans **7** — so 4 is double the widest real seam and well
 * under the narrowest impostor.
 */
const DARK_SEAM_MAX_SPAN_PX = 4;

/**
 * HOW FAR BELOW ITS NEIGHBOURHOOD A HAIRLINE MUST SIT TO BE A SEAM.
 *
 * The mirror of {@link DIVIDER_MIN_CONTRAST} and set by the same reasoning.
 * Measured on the shipping head sheet's two seams: **89.0 and 58.5**. The floor
 * is under half the weaker one, because the two errors here are asymmetric in
 * the other direction from the divider search — this decides only whether to
 * WARN, so a missed seam costs a false alarm and a false seam costs a real one.
 *
 * ⚠ **The span cap and this floor exclude the one near-miss independently**:
 * court sheet 3's first boundary carries a 24.1-deep dark run, which is close
 * to this floor and nowhere near the span cap at 7 px wide. Two clauses, each
 * sufficient, is what keeps a single re-measured constant from opening a hole.
 */
export const DARK_SEAM_MIN_DEPTH = 25;

/**
 * HOW FAR INSIDE A CUT EDGE THE PANEL'S OWN BACKDROP IS SAMPLED FROM, AND OVER
 * HOW MANY COLUMNS.
 *
 * ⚠ **Local, and the locality is the whole repair — {@link DIVIDER_BACKGROUND_OFFSET}
 * was tried first and is the wrong instrument for this question.** Sampling 20
 * px inside the edge answers *"is this band brighter than the neighbourhood"*,
 * which is what the divider search needs; it does NOT answer *"has this edge
 * reached the backdrop"*, because 20 px inside a panel is often a figure.
 * Measured: on court sheet 2's first boundary the 20 px sample reads **177**
 * where the backdrop beside that edge is **202**, so the walk never converged
 * and ran **17 px** into the picture — three of the fifteen edges behaved that
 * way. A median taken 3 px in over 6 columns reads the right number on all
 * fifteen, and the worst walk becomes 2 px.
 *
 * The guard of 3 clears the shoulder itself (measured 0–2 px wide), so the
 * sample is never the thing being measured against.
 */
const PANEL_EDGE_BACKDROP_GUARD_PX = 3;
const PANEL_EDGE_BACKDROP_SPAN_PX = 6;

/**
 * HOW FAR OFF ITS PANEL'S BACKDROP A CUT EDGE'S COLUMN MAY SIT AND STILL BE
 * BACKDROP RATHER THAN SEAM.
 *
 * Measured on the real sheets, both directions, which is what fixes the number:
 * **backdrop noise is ±1–3** greylevels column to column (the flat runs at
 * every sheet edge read 196/196/195 and 178/178/179); the **faintest real
 * artifact** is the pair of bright highlights flanking the shipping head
 * sheet's second seam, at **+9 and +11**; and the loudest are the seam itself
 * at **−58 and −89** and a bright divider's shoulder at **+15 to +58**. Eight
 * sits above every noise reading and below every artifact, the nearest call
 * being that +9 highlight.
 *
 * ⚠ **Both signs, one test.** The defect he reported is a DARK hairline, and
 * its sibling on the bright boundaries is a BRIGHT shoulder; a floor that only
 * looked downward would have cleaned his view and left eleven of the twelve
 * court edges still carrying the divider's own glow.
 */
const PANEL_EDGE_TRIM_TOLERANCE = 8;

/**
 * THE FURTHEST A TRIM CAN WALK — **derived from the backdrop window, because
 * the window is what bounds it, and a second number here would be a mirror
 * that drifts** (working law 4).
 *
 * ⚠ **THIS REPLACED A CAP, AND THE CAP WAS DEAD MACHINERY — found by sabotage
 * rather than by reading.** The first shape of this repair carried its own cap
 * of 8 and a docblock saying it REFUSED past it so that a figure could never be
 * eaten. Driving it proved the refusal unreachable: **the backdrop is the
 * MEDIAN of columns `edge+3 … edge+8`, and a median of an integer-indexed
 * sample is one of its own members** — so one column inside that window reads
 * exactly 0 off the backdrop, and the walk is guaranteed to stop at or before
 * it. Sabotaging the refusal into taking its cap changed the answer on no input
 * at all, which is the definition of a control that does not exist (invariant
 * 7) — and the docblock claiming it protected a figure was the part that
 * mattered, because **it is not the cap that protects a figure.**
 *
 * What actually protects one, measured: a figure wide enough to matter FILLS
 * the backdrop window, so it reads as this panel's own backdrop and the walk
 * stops on its first step. A 300-column body pressed against a divider trims
 * **0**. The trim only ever removes something that differs from what lies just
 * behind it — which is what a seam is, and what a figure is not.
 *
 * So the loop is bounded by the window it reads, and the return past the loop
 * is kept as the SAFE answer rather than as a control: if the argument above is
 * ever wrong, trimming nothing leaves the hairline he reported, while trimming
 * nine columns takes a picture nobody gets back.
 */
const PANEL_EDGE_TRIM_BOUND_PX =
  PANEL_EDGE_BACKDROP_GUARD_PX + PANEL_EDGE_BACKDROP_SPAN_PX - 1;

/** Where a panel boundary came from, carried on the receipt rather than inferred. */
export type SheetBoundarySource = "divider" | "fifth";

/** A run of columns read off the profile, bright or dark. */
export type SheetSeamBand = {
  readonly start: number;
  readonly end: number;
  readonly contrast: number;
};

export type SheetBoundary = {
  /** The last column of the panel to the left of this boundary. */
  readonly leftEnd: number;
  /** The first column of the panel to the right of it. */
  readonly rightStart: number;
  readonly source: SheetBoundarySource;
  /** The BRIGHT run this was read off, or `null` where the fifth was used. */
  readonly band: SheetSeamBand | null;
  /**
   * For a `fifth` boundary: the DARK hairline the equal share turned out to
   * land on, or `null` when the line sits on nothing readable.
   *
   * ⚠ **IT CHANGES NO CUT — IT IS ONLY HOW LOUD THE RECEIPT IS, #1967.** The
   * detector looks for a bright divider and the shipping head sheet's panels
   * are joined by a DARK one, so every head sheet falls back and the caller's
   * *"a panel may be cut inside the figure"* warning fired on every Sign. An
   * alarm that always cries cannot report the case it exists for. A fallback
   * that lands on a visible seam is a correct cut; a fallback that lands on
   * nothing, or in the middle of a figure, is the case worth shouting about.
   *
   * Always `null` on a `divider` boundary, which was read off a bright band
   * and needs no second opinion.
   */
  readonly darkSeam: SheetSeamBand | null;
  /**
   * HOW MANY COLUMNS WERE TRIMMED OFF EACH SIDE OF THIS BOUNDARY so that
   * neither panel keeps the seam that marks it — #1971, his *"i can see on the
   * left side of the image where the gap line was"*.
   *
   * On the receipt rather than inferable from the numbers, because `leftEnd`
   * and `rightStart` cannot tell a trim from a differently-placed boundary and
   * the log line is the only place a wrong cut can be noticed at all.
   */
  readonly trimmed: { readonly left: number; readonly right: number };
};

/**
 * THE PANEL'S OWN BACKDROP BESIDE A CUT EDGE — a median, taken locally.
 *
 * A median rather than a mean because the window may clip a figure's first
 * columns, and one dark column of hair in six would drag a mean 10 greylevels
 * while the median does not move.
 */
function backdropBeside(
  means: ArrayLike<number>,
  width: number,
  from: number,
  direction: -1 | 1,
): number {
  const samples: number[] = [];
  for (let i = 0; i < PANEL_EDGE_BACKDROP_SPAN_PX; i += 1) {
    const x = from + direction * (PANEL_EDGE_BACKDROP_GUARD_PX + i);
    if (x < 0 || x > width - 1) continue;
    samples.push(means[x]);
  }
  if (samples.length === 0) return means[Math.min(width - 1, Math.max(0, from))];
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)]!;
}

/**
 * HOW MANY COLUMNS OF SEAM A CUT EDGE IS STILL HOLDING — the repair for #1971,
 * and it is one reader for both kinds of boundary on purpose.
 *
 * ⚠ **The defect is not the boundary being in the wrong place; it is the
 * boundary being in the RIGHT place and the cut keeping the line that marks
 * it.** His three-quarter view is the middle panel of the head sheet and its
 * left edge is interior boundary 1, where the equal share lands at **1280** and
 * the sheet's hairline seam IS column 1280, 1 px wide and **89 greylevels**
 * below its neighbourhood. `leftEnd = 1279` keeps the left panel clean and
 * `rightStart = 1280` hands the three-quarter panel the whole seam as its first
 * column. Measured on the shipping head sheet, **three of its four cut edges**
 * carried seam: 1280 on panel 2's left, 2559 on panel 2's right, 2560 on panel
 * 3's left.
 *
 * ⚠ **AND THE BRIGHT BOUNDARIES HAVE THE SAME DEFECT, WHICH IS WHY THIS IS NOT
 * A DARK-SEAM SPECIAL CASE (working law 7 — the class, not the instance).**
 * {@link DIVIDER_BAND_TOLERANCE} grows a band 12 greylevels down from its PEAK,
 * so a divider at 254 stops claiming columns at 242 — and the shoulder columns
 * below that are still **+15 to +58 over their panel's backdrop**. Court sheet
 * 3's second panel began at column 779 reading **219 against a 161 backdrop**:
 * the same visible line he reported, in the other direction, on a sheet whose
 * cut his eye had passed. Eleven of the twelve court edges carried one.
 *
 * So the rule is read from the panel outward and takes no view on where the
 * seam came from: **walk inward from the cut edge while the column is still
 * more than {@link PANEL_EDGE_TRIM_TOLERANCE} off this panel's own backdrop**,
 * bounded by {@link PANEL_EDGE_TRIM_BOUND_PX} — which that constant's own note
 * shows can never bind, and says what protects a figure instead.
 */
export function seamColumnsAtEdge(
  means: ArrayLike<number>,
  width: number,
  edge: number,
  /** Which way the panel lies: `1` for a panel starting at `edge`, `-1` for one ending there. */
  inward: -1 | 1,
): number {
  const backdrop = backdropBeside(means, width, edge, inward);
  for (let walked = 0; walked <= PANEL_EDGE_TRIM_BOUND_PX; walked += 1) {
    const x = edge + inward * walked;
    if (x < 0 || x > width - 1) return walked;
    if (Math.abs(means[x] - backdrop) <= PANEL_EDGE_TRIM_TOLERANCE) return walked;
  }
  /* Unreachable — see `PANEL_EDGE_TRIM_BOUND_PX`, and 0 is the safe answer
     if that argument is ever wrong. */
  return 0;
}

/**
 * THE DARK HAIRLINE AT A GIVEN LINE, OR `null` — the mirror of the bright
 * search above, measured the same way so the two speak one vocabulary.
 *
 * Deliberately NOT wired into the cut. Teaching the detector to cut on dark
 * seams would move where paid panels are sliced, which is #1904's question and
 * his eye's to close; this only decides whether the fallback is reported as an
 * alarm or as a fact.
 */
export function findDarkSeamAt(
  means: ArrayLike<number>,
  width: number,
  line: number,
): SheetSeamBand | null {
  const lo = Math.max(0, line - SEAM_SEARCH_PX);
  const hi = Math.min(width - 1, line + SEAM_SEARCH_PX);

  let dip = lo;
  for (let x = lo; x <= hi; x += 1) if (means[x] < means[dip]) dip = x;

  /* The run is grown past the search window: a seam is identified by where its
     darkest column sits, and clipping its WIDTH at the window would make a
     broad figure read as a narrow hairline — the one confusion that matters. */
  let start = dip;
  let end = dip;
  while (start - 1 >= 0 && means[start - 1] <= means[dip] + DIVIDER_BAND_TOLERANCE) start -= 1;
  while (end + 1 <= width - 1 && means[end + 1] <= means[dip] + DIVIDER_BAND_TOLERANCE) end += 1;
  if (end - start + 1 > DARK_SEAM_MAX_SPAN_PX) return null;

  const left = means[Math.max(0, start - DIVIDER_BACKGROUND_OFFSET)];
  const right = means[Math.min(width - 1, end + DIVIDER_BACKGROUND_OFFSET)];
  const depth = (left + right) / 2 - means[dip];
  if (depth < DARK_SEAM_MIN_DEPTH) return null;

  return { start, end, contrast: depth };
}

export type SheetPanelGeometry = {
  readonly panels: readonly { readonly left: number; readonly width: number }[];
  readonly boundaries: readonly SheetBoundary[];
};

/**
 * MEAN BRIGHTNESS PER COLUMN — the one signal the cut reads.
 *
 * Full height rather than a band, because a divider runs the whole way down and
 * averaging over all 1648 rows is what makes a 3 px line beat a figure: one
 * bright column of 1648 white pixels averages 254, while a column crossing a
 * face averages its skin, its hair and its backdrop together.
 */
export async function sheetColumnMeans(bytes: Buffer): Promise<{
  means: Float64Array;
  width: number;
  height: number;
}> {
  const { data, info } = await sharp(bytes).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  if (width < 1 || height < 1) throw new Error(`the Sign sheet is not a readable image (${width}x${height})`);
  const means = new Float64Array(width);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) means[x] += data[row + x];
  }
  for (let x = 0; x < width; x += 1) means[x] /= height;
  return { means, width, height };
}

/**
 * MOVE A CHOSEN BOUNDARY'S TWO EDGES OFF THE SEAM — #1971, applied to every
 * boundary whatever found it.
 *
 * ⚠ **It never moves a boundary; it only shrinks the two panels away from one.**
 * The widths change by at most {@link PANEL_EDGE_TRIM_BOUND_PX} a side and the
 * boundary's own position, its `source` and its `band` are untouched, so every
 * reading that judges WHERE the cut fell — the court's judged widths, the
 * fallback alarm, the false-divider finding — is asking the same question of
 * the same answer as before.
 */
function trimBoundary(
  means: ArrayLike<number>,
  width: number,
  raw: Omit<SheetBoundary, "trimmed">,
): SheetBoundary {
  const left = seamColumnsAtEdge(means, width, raw.leftEnd, -1);
  const right = seamColumnsAtEdge(means, width, raw.rightStart, 1);
  return {
    ...raw,
    leftEnd: raw.leftEnd - left,
    rightStart: raw.rightStart + right,
    trimmed: { left, right },
  };
}

/**
 * FIND THE PANELS — one search window per interior boundary, and a stated
 * fallback.
 *
 * ⚠ **The search is windowed rather than global, and that is what makes it
 * safe.** A sheet carries four dividers and an unknown number of bright
 * backdrop columns; looking for *"the four brightest runs in the frame"* would
 * let one panel's pale backdrop outrank a real divider and lose a boundary
 * entirely. Anchoring each search to its own fifth means the worst a wrong peak
 * can do is move one boundary by less than 6% of the width, and the other three
 * are untouched by it.
 *
 * ⚠ **A boundary with no divider falls back to its fifth and SAYS SO on the
 * receipt.** It is the honest answer rather than a good one: the prompt itself
 * asks for panels *"flush edge to edge at identical widths"*, so with no visible
 * divider the equal fifth is the only boundary the picture claims to have. The
 * caller logs it, because a fifths cut is the thing that clips a figure and
 * nothing downstream can see that it happened.
 */
export function findSheetPanelGeometry(
  means: ArrayLike<number>,
  width: number,
  panelCount: number = SIGN_SHEET_PANEL_ORDER.length,
): SheetPanelGeometry {
  if (panelCount < 1) throw new Error("a Sign sheet holds at least one panel");
  if (width < panelCount) throw new Error(`a ${width}px sheet cannot hold ${panelCount} panels`);

  const searchWindow = Math.round(width * DIVIDER_SEARCH_FRACTION);
  const maxBandWidth = Math.max(1, Math.round(width * DIVIDER_MAX_WIDTH_FRACTION));
  const boundaries: SheetBoundary[] = [];

  for (let k = 1; k < panelCount; k += 1) {
    const equal = Math.round((width * k) / panelCount);
    const lo = Math.max(0, equal - searchWindow);
    const hi = Math.min(width - 1, equal + searchWindow);

    let peak = lo;
    for (let x = lo; x <= hi; x += 1) if (means[x] > means[peak]) peak = x;

    let start = peak;
    let end = peak;
    while (start - 1 >= lo && means[start - 1] >= means[peak] - DIVIDER_BAND_TOLERANCE) start -= 1;
    while (end + 1 <= hi && means[end + 1] >= means[peak] - DIVIDER_BAND_TOLERANCE) end += 1;

    const left = means[Math.max(0, start - DIVIDER_BACKGROUND_OFFSET)];
    const right = means[Math.min(width - 1, end + DIVIDER_BACKGROUND_OFFSET)];
    /*
      ⚠ **EACH SIDE ON ITS OWN, NEVER THE TWO AVERAGED — #1976.** A divider has
      backdrop on BOTH sides of it; a figure's edge has backdrop on ONE. The
      average let the dark side carry the bright one: with a body across the
      line, one sample lands inside the figure, and a plain backdrop-to-body
      step scored 55–62 against this floor while its backdrop side sat 19–21
      below it. So the band must stand clear of BOTH neighbours, and the
      receipt carries the weaker of the two — the number the decision was made
      on. See `DIVIDER_MIN_CONTRAST` for both populations, measured.
    */
    const contrast = Math.min(means[peak] - left, means[peak] - right);

    if (contrast < DIVIDER_MIN_CONTRAST) {
      /* Whether the equal share happened to land on a dark hairline — the
         receipt's own answer to "is this fallback the right line", #1967. */
      const darkSeam = findDarkSeamAt(means, width, equal);
      /*
        ⚠ **THE CUT GOES OUTSIDE THE SEAM'S RUN RATHER THAN THROUGH ITS CENTRE
        — #1971.** `equal - 1 / equal` splits a hairline between the two
        panels: a 1 px seam sitting exactly on `equal` lands WHOLE on the right
        panel's first column, and a 2 px one gives each panel half of it. That
        is his three-quarter view. The seam is the boundary the picture actually
        claims, so each panel starts and ends past the whole of it — which also
        moves the line by up to `SEAM_SEARCH_PX` onto the seam the fallback only
        approximated.
      */
      boundaries.push(trimBoundary(means, width, {
        leftEnd: darkSeam ? darkSeam.start - 1 : equal - 1,
        rightStart: darkSeam ? darkSeam.end + 1 : equal,
        source: "fifth",
        band: null,
        darkSeam,
      }));
      continue;
    }

    if (end - start + 1 > maxBandWidth) {
      /* Clamped around the peak rather than rejected — see
         `DIVIDER_MAX_WIDTH_FRACTION`. The peak is on the divider; it is the
         expansion that ran into something else. */
      const half = Math.floor(maxBandWidth / 2);
      start = Math.max(lo, peak - half);
      end = Math.min(hi, start + maxBandWidth - 1);
    }

    boundaries.push(trimBoundary(means, width, {
      leftEnd: start - 1,
      rightStart: end + 1,
      source: "divider",
      band: { start, end, contrast },
      darkSeam: null,
    }));
  }

  const panels: { left: number; width: number }[] = [];
  let left = 0;
  for (const boundary of boundaries) {
    panels.push({ left, width: boundary.leftEnd - left + 1 });
    left = boundary.rightStart;
  }
  panels.push({ left, width: width - left });

  const equalWidth = width / panelCount;
  const floor = equalWidth * MIN_PANEL_FRACTION_OF_EQUAL;
  const runt = panels.findIndex((panel) => panel.width < floor);
  if (runt !== -1) {
    throw new Error(
      `the Sign sheet did not cut into ${panelCount} usable panels: panel ${runt + 1} came out `
      + `${panels[runt].width}px against a ${Math.round(equalWidth)}px equal panel `
      + `(widths ${panels.map((panel) => panel.width).join("/")})`,
    );
  }

  return { panels, boundaries };
}

/** The five panels, keyed by the view each one is, plus the receipt of how they were found. */
export type SignSheetCut = {
  readonly panels: Readonly<Record<CastViewAngle, ReferenceImage>>;
  /** What the door actually returned — never what was asked for. */
  readonly source: { readonly width: number; readonly height: number };
  readonly geometry: SheetPanelGeometry;
};

/**
 * CUT THE SHEET — on the bytes that arrived, never on the size asked for.
 *
 * ⚠ **The same discipline `splitOutfitPlate` has, for a reason this road makes
 * sharper.** That one reads the returned bytes because the door is measured to
 * clamp an ask and a plate cut down the wrong column hands a view a sliver of
 * the other panel — silently, because nobody looks at a reference. Here the
 * panels ARE the delivery: a wrong column is a customer's picture with a hand
 * in it, and `SIGN_SHEET_SIZE`'s width is exactly the number a panel must not
 * be computed from.
 *
 * Panels are PNG, which is what the door is asked for and what it returned on
 * all three court sheets — re-encoding a delivered picture to anything lossy on
 * the way out of a cut would be a quality loss nobody asked for.
 */
export async function cutSignSheet(
  bytes: Buffer,
  panelOrder: readonly CastViewAngle[] = SIGN_SHEET_PANEL_ORDER,
): Promise<SignSheetCut> {
  const { means, width, height } = await sheetColumnMeans(bytes);
  const geometry = findSheetPanelGeometry(means, width, panelOrder.length);
  const cut = await Promise.all(
    geometry.panels.map((panel) =>
      sharp(bytes)
        .extract({ left: panel.left, top: 0, width: panel.width, height })
        .png()
        .toBuffer(),
    ),
  );
  const panels = {} as Record<CastViewAngle, ReferenceImage>;
  panelOrder.forEach((angle, index) => {
    panels[angle] = { bytes: cut[index], contentType: "image/png" };
  });
  return { panels, source: { width, height }, geometry };
}

/**
 * HER MASTER, AS A JPEG — and this is a LATENCY fix with a measured number, not
 * tidiness.
 *
 * **His card:** *"One reference: her signed master, sent as a JPEG, not the
 * 2.6 MB PNG. Measured on #1690: the PNG data URI cost ~17–19 s of queue ingest
 * per call, and the JPEG ~2–4 s, same pixels."*
 *
 * Read on the real master from that court (`0-master.png`, 1024x1536): the PNG
 * is **2.52 MB**, which is **3.36 MB once base64'd into the data URI** the door
 * is handed, and JPEG at quality 92 is **356 KB — 13.8% of it**, at the same
 * pixel dimensions. That is the whole of the 15 seconds.
 *
 * ⚠ **Quality 92 is a choice and it is stated as one.** It is high enough that
 * the artefacts are not visible at the master's own size, and the master is a
 * REFERENCE here rather than a delivery — nothing it is encoded to is ever
 * handed to a customer; the sheet the door paints is. A re-encode of a picture
 * the customer keeps would be a different decision and is not this one.
 */
export async function sheetReferenceFromMaster(anchor: ReferenceImage): Promise<ReferenceImage> {
  const bytes = await sharp(anchor.bytes).jpeg({ quality: 92 }).toBuffer();
  return { bytes, contentType: "image/jpeg" };
}

/**
 * THE SHEET'S PROMPT — his judged text, with the outfit paragraph composed from
 * this cast's own brief.
 *
 * ⚠ **The five panel lines come from `SIGN_SHEET_PANEL_LINES` IN
 * `SIGN_SHEET_PANEL_ORDER`, which is the same list the cut keys its panels on.**
 * That is the whole guard against the quietest defect this road can have: a
 * prompt that paints the profile third and a cut that files the third panel as
 * the front. Two readings of one list cannot disagree; two lists always do
 * (working law 4).
 */
export function composeSignSheetPrompt(input: {
  wardrobeLine?: string | null;
  description?: string | null;
  pronouns?: CastPronouns;
  panelOrder?: readonly CastViewAngle[];
  /**
   * HER TATTOOS AND THE FEATURES NO PHOTOGRAPH SHOWS — carried, not dropped.
   *
   * ⚠ **His judged prompt has neither clause, and shipping without them would
   * have been a capability REGRESSION dressed as fidelity to his text.** Every
   * view this product renders today carries them: a cast's delivered ink crops
   * ride beside the anchor and are named by position, and the features she was
   * cast with that the master cannot show ride as words. His court sheet was
   * one cast with neither, so the question never arose there.
   *
   * They belong on the SHEET and not on a panel, and that is the better place
   * rather than the convenient one: both are facts about the PERSON, true of
   * all five cameras, and the sheet paints all five in one frame. Said once
   * here, they cannot disagree across the panels the way five independent
   * renders could.
   */
  inkCrops?: readonly CarriedInkCrop[];
  featureWords?: readonly CarriedFeatureWords[];
}): string {
  const pronouns = input.pronouns ?? pronounsForSex(null);
  const panelOrder = input.panelOrder ?? SIGN_SHEET_PANEL_ORDER;
  const brief = viewDescriptionOf(input.description);
  /*
    THE ORDINAL IS DERIVED FROM THE LIST IT IS TALKING ABOUT, exactly as the
    view road derives it — the anchor is reference 1 and the crops start at 2.
    A sentence carrying a constant would point a cast with three tattoos at a
    picture of her elbow and call it the outfit; this road has one fewer
    reference than a view's (no plate panel), so a copied constant would have
    been wrong here in a different way.
  */
  const inkClause = inkViewCropClause({
    crops: input.inkCrops ?? [],
    firstOrdinal: 2,
    pronouns,
  });
  const words = composeViewFeatureWordsClause(input.featureWords ?? []);
  /*
    THE OUTFIT, FROM WHICHEVER RECORD EXISTS.

    The stored wardrobe line is the stronger record where there is one, and the
    brief is the fallback — the same order `wardrobeSpecFor` reads them in, and
    for its stated reason. ⚠ Read at the rows on 2026-09-26, **0 of 6 minted
    casts carry `technicalSchema.wardrobe.line`**, all time, so the brief is the
    live road and the line is the one a later ruling may fill.

    With neither, the sentence names reference 1 alone and stops. It does NOT
    invent an outfit adjective: the master shows the top of what she is wearing,
    and that is a real record — an authored one would be this module having an
    opinion about a cast's wardrobe.
  */
  const stated = input.wardrobeLine?.trim() || brief;
  /* His heading is all caps — "HER OUTFIT, as cast:" — so the possessive is
     uppercased rather than sentence-capped. */
  const whose = pronouns.possessive.toUpperCase();
  const outfit = stated
    ? `${whose} OUTFIT, as cast: ${stripTrailingStop(stated)}. `
    : `${whose} OUTFIT is the one reference 1 shows. `;

  return [
    "A CHARACTER SHEET: one landscape photograph divided into "
    + `${panelOrder.length} vertical panels of exactly equal width, side by side in a single row, `
    + "each panel showing the same person.",
    "",
    "THE REFERENCE AND THE OUTFIT:",
    `REFERENCE 1 is ${pronouns.possessive} master photograph — the single source of `
    + `${pronouns.possessive} identity: face, features, skin, freckles, makeup, hair (colour, length `
    + `and cut), body, piercings and any tattoos it shows. It also shows the top of `
    + `${pronouns.possessive} outfit, and that is the outfit ${pronouns.subject} `
    + `${pronouns.plural ? "wear" : "wears"}.`,
    `${outfit}Above the frame of reference 1 the outfit is exactly what reference 1 shows; below `
    + "it, design the cut, length, hardware, footwear and weathering in keeping with the garments, "
    + "materials and colours reference 1 shows. One outfit, identical in every panel, front and "
    + "back.",
    "",
    "THE PANELS, left to right:",
    ...panelOrder.map((angle, index) => `PANEL ${index + 1} — ${panelLineFor(angle, pronouns)}`),
    "",
    /* ⚠ His closing paragraph SPELLS the count — *"behind all five panels"*,
       *"into five equal parts"* — where his opening line uses the digit. Both
       are quoted as he wrote them rather than normalised: the one place a
       prompt's exact wording has been measured to matter in this repository is
       his own law that context is not additive, and a diff against his judged
       text is the only check this module has. */
    `One person (reference 1), one outfit, one plain seamless studio backdrop in the same tone `
    + `behind all ${spelled(panelOrder.length)} panels — only the camera changes. The panels sit `
    + `flush edge to edge at identical widths, so the sheet cuts cleanly into `
    + `${spelled(panelOrder.length)} equal parts. Every panel is pure photography, clean of `
    + "lettering, borders and graphics.",
    /*
      APPENDED, so a cast with neither sends his judged text byte for byte —
      the same inertness discipline the view road's two lanes are asserted on.
    */
    ...(inkClause === "" ? [] : ["", inkClause]),
    ...(words.clause === "" ? [] : ["", words.clause]),
  ].join("\n");
}

/**
 * The line for one angle, and it REFUSES rather than skipping.
 *
 * A panel with no line is a panel the engine is told nothing about, in a prompt
 * that has already promised N panels — so the sheet comes back with a guess in
 * that slot and the cut files it as a view. Refusing before dispatch turns a
 * sixth view added to `CAST_PACKAGE_VIEWS` into a startup-shaped failure
 * instead of a charged picture of the wrong thing.
 */
function panelLineFor(angle: CastViewAngle, pronouns: CastPronouns): string {
  const line = SIGN_SHEET_PANEL_LINES[angle];
  if (!line) throw new Error(`the Sign sheet has no panel line for the ${angle} view`);
  return line(pronouns);
}

/** His sentence puts the outfit clause mid-paragraph, so a stated line's own full stop would double. */
function stripTrailingStop(text: string): string {
  return text.trim().replace(/[.\s]+$/, "");
}

/**
 * The panel count as a word, for the two places his closing paragraph spells it.
 *
 * Covers every count a package could have — `CastViewAngle` has seven members,
 * so seven is the ceiling — and falls back to the digit rather than throwing,
 * because a prompt that reads *"all 8 panels"* is odd English and a Sign that
 * refuses to compose is a Sign nobody can buy.
 */
function spelled(count: number): string {
  return ["zero", "one", "two", "three", "four", "five", "six", "seven"][count] ?? String(count);
}

/**
 * WHO PAINTED — derived from `ImageResult` rather than restated.
 *
 * `ProviderProvenance` is deliberately not exported from `providers/types.ts`,
 * and widening that contract to name a type here would be the wrong repair: an
 * indexed access says *whatever an image result carries*, so this cannot drift
 * from it (working law 4).
 */
type SheetProvenance = ImageResult["provenance"];

/** The one method of the engine this module uses — narrow, so a test double is three lines. */
export type SignSheetEngine = {
  editWithReferences(request: {
    prompt: string;
    references: ReferenceImage[];
    resolution: "1K" | "2K" | "4K";
    signal?: AbortSignal;
  }): Promise<{
    bytes: Buffer;
    contentType: string;
    latencyMs?: number;
    estimatedCostUsd?: number | null;
    provenance?: SheetProvenance;
  }>;
};

export type RenderedSignSheet = SignSheetCut & {
  readonly latencyMs: number;
  readonly estimatedCostUsd: number | null;
  /**
   * WHICH ENGINE PAINTED, carried from the sheet to all five asset rows.
   *
   * ⚠ **This is the only honest record of a delivered view's SIZE, and that is
   * not a new idea — it is the rule `packageOrchestrator`'s `resolution: "2K"`
   * note already states.** The `model_assets.resolution` enum keeps saying `2K`
   * because that column answers a ROLE question (*is this a full view rather
   * than the 1K anchor?*) and relabelling live rows is a row rewrite on a money
   * table. So what tells a 1696x2528 Nano Banana Pro view apart from a ~768x1648
   * Sunburst panel is `provenance.engine` — and a sheet whose provenance never
   * reached its panels would make all five rows claim the view engine of
   * whichever road happened to be live.
   */
  readonly provenance: SheetProvenance;
};

/**
 * RENDER THE SHEET AND CUT IT — one call, five panels, and **every fault
 * propagates**.
 *
 * ⚠ **This is the opposite of `renderOutfitPlate`, deliberately, and the
 * difference is the whole of why they are two functions.** A plate that fails
 * costs a customer nothing — the views render master-only and all five still
 * arrive — so that one answers `null` for every fault there is. A SHEET that
 * fails is the package: there is no softer road behind it, and swallowing the
 * fault here would hand the orchestrator five empty panels to charge for.
 * So it throws, and the caller's arrival budget decides what a fault means.
 *
 * ⚠ **An uncuttable sheet throws for the same reason an unrendered one does.**
 * `findSheetPanelGeometry` refuses a runt panel, and that refusal must reach
 * the caller as a fault rather than as four good panels and one sliver —
 * #1903 left the judge three axes and none of them is framing, so nothing
 * downstream would ever disagree with a sliver.
 */
export async function renderSignSheet(input: {
  engine: SignSheetEngine;
  /** Her signed master — converted to JPEG here, for the measured reason above. */
  anchor: ReferenceImage;
  wardrobeLine?: string | null;
  description?: string | null;
  pronouns?: CastPronouns;
  panelOrder?: readonly CastViewAngle[];
  inkCrops?: readonly CarriedInkCrop[];
  featureWords?: readonly CarriedFeatureWords[];
  operationId?: number | string | null;
  signal?: AbortSignal;
  /**
   * This sheet's share of the Sign's paid renders (#1968). Passed straight
   * through to the engine — `settleSignSheet` owns it, one per sheet, so the
   * re-make and every arrival retry draw on the same pool.
   */
  renderBudget?: RenderBudget;
}): Promise<RenderedSignSheet> {
  const started = Date.now();
  const panelOrder = input.panelOrder ?? SIGN_SHEET_PANEL_ORDER;
  const crops = input.inkCrops ?? [];
  const words = composeViewFeatureWordsClause(input.featureWords ?? []);
  if (words.dropped.length > 0) {
    /*
      ⚠ **THE CAP'S DECLINES ARE SAID OUT LOUD, ONCE.** The view road logs this
      per view and its own comment explains why — *"a cap that silently
      truncates reads, from the outside, exactly like a feature that was never
      there."* On this road there is ONE composition for all five panels, so the
      line fires once and is a fact about the package rather than repeated five
      times. **SLOTS ONLY, never the words**: the words are the customer's own
      and a log is not where they belong.
    */
    log.warn(
      {
        operationId: input.operationId ?? null,
        droppedSlots: words.dropped.map((feature) => feature.slot),
        keptCount: (input.featureWords ?? []).length - words.dropped.length,
      },
      "[signSheet] the sheet's feature clause hit its character cap — these features were "
      + "dropped from the words the sheet carries",
    );
  }
  const image = await input.engine.editWithReferences({
    prompt: composeSignSheetPrompt({
      wardrobeLine: input.wardrobeLine ?? null,
      description: input.description ?? null,
      ...(input.pronouns ? { pronouns: input.pronouns } : {}),
      panelOrder,
      inkCrops: crops,
      featureWords: input.featureWords ?? [],
    }),
    /*
      HER MASTER FIRST, THEN THE TATTOOS SHE REALLY HAS — the same order and the
      same ordinals the view road sends, because the prompt's clause names them
      by POSITION and a list that disagreed with the sentence would point a paid
      panel at the wrong picture. His card's *"One reference: her signed
      master"* is the sentence for a cast with no ink, which is every cast in
      production (`casting_ink_delivery_crops`: 0 rows, all time) — it is not an
      instruction to drop a cast's tattoos on the floor.
    */
    references: [
      await sheetReferenceFromMaster(input.anchor),
      ...crops.map((crop) => ({ bytes: crop.bytes, contentType: crop.contentType })),
    ],
    resolution: "2K",
    ...(input.signal ? { signal: input.signal } : {}),
    ...(input.renderBudget ? { renderBudget: input.renderBudget } : {}),
  });

  const cut = await cutSignSheet(image.bytes, panelOrder);
  const fallbacks = cut.geometry.boundaries.filter((boundary) => boundary.source === "fifth");
  /*
    A fallback that landed on a visible hairline is a correct cut; one that
    landed on nothing readable is the case the alarm exists for — #1967.
  */
  const onNothing = fallbacks.filter((boundary) => boundary.darkSeam === null).length;
  const line = {
    operationId: input.operationId ?? null,
    returned: cut.source,
    panelWidths: cut.geometry.panels.map((panel) => panel.width),
    dividersFound: cut.geometry.boundaries.length - fallbacks.length,
    boundariesFromFifths: fallbacks.length,
    fifthsOnADarkSeam: fallbacks.length - onNothing,
    fifthsOnNothing: onNothing,
    latencyMs: image.latencyMs ?? Date.now() - started,
    estimatedCostUsd: image.estimatedCostUsd ?? null,
  };
  if (onNothing > 0) {
    /*
      ⚠ **LOUD, because this is the one failure the product cannot see.** A
      boundary taken from a fifth may sit inside a figure, and the judge's three
      surviving axes — identity, intact, people — would all pass a beheaded
      panel. The log line is the only alarm there is, so it is a warning with
      the operation id on it rather than a debug note.

      ⚠ **AND IT NO LONGER FIRES ON EVERY SIGN — #1967, his *"3) go with your
      rec"* on #1904.** It used to fire on any fallback at all, and the shipping
      head sheet falls back on BOTH its boundaries forever: the detector hunts a
      bright divider and that sheet's panels are joined by a dark one. So the
      alarm cried on every Sign, which is the same as not having it. It now
      fires only where the chosen line sits on nothing readable — see
      `findDarkSeamAt`.
    */
    log.warn(line, "[signSheet] some panel boundaries came from equal shares with no seam "
      + "visible at the line — nothing in the picture claims a boundary there, so a panel "
      + "may be cut inside the figure");
  } else if (fallbacks.length > 0) {
    log.info(line, "[signSheet] the Sign sheet landed; some boundaries came from equal shares "
      + "and each one landed on the sheet's own hairline seam");
  } else {
    log.info(line, "[signSheet] the Sign sheet landed and was cut on its own dividers");
  }

  return {
    ...cut,
    latencyMs: image.latencyMs ?? Date.now() - started,
    estimatedCostUsd: image.estimatedCostUsd ?? null,
    /*
      ⚠ **A SHEET WITH NO PROVENANCE IS A REFUSAL, NOT A DEFAULT.** Five asset
      rows are about to record which engine painted them, and that stamp is the
      only thing in the product that tells a 1696x2528 Nano Banana Pro view
      apart from a ~768x1648 Sunburst panel (the `resolution` column says `2K`
      for both, by design). A fallback here would write a plausible wrong engine
      onto five permanent rows, which is worse than a Sign that fails and
      refunds.
    */
    provenance: (() => {
      if (!image.provenance) throw new Error("the Sign sheet came back with no provenance to stamp on its panels");
      return image.provenance;
    })(),
  };
}
