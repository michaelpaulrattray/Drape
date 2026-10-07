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
import type { ReferenceImage } from "../providers/types";
/* `capitalize` rather than a local one: `castPronouns` already exports it for
   exactly this job ("He came from this sheet."), and a second copy of a
   one-line string helper beside the module that owns it is working law 4 in
   miniature. */
import { capitalize, pronounsForSex, type CastPronouns } from "./castPronouns";
import { CAST_PACKAGE_VIEWS, viewDescriptionOf } from "./castViewPackage";
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
 * HOW BRIGHT A BAND MUST BE AGAINST ITS NEIGHBOURHOOD TO BE A DIVIDER AT ALL.
 *
 * Measured contrast on the twelve real boundaries: **53 to 101**. The floor is
 * set at 25 — under half the weakest real one — because the cost of the two
 * errors is wildly asymmetric: a missed divider falls back to the fifth, and a
 * false one cuts a panel at a bright patch of backdrop.
 */
const DIVIDER_MIN_CONTRAST = 25;

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

/** Where a panel boundary came from, carried on the receipt rather than inferred. */
export type SheetBoundarySource = "divider" | "fifth";

export type SheetBoundary = {
  /** The last column of the panel to the left of this boundary. */
  readonly leftEnd: number;
  /** The first column of the panel to the right of it. */
  readonly rightStart: number;
  readonly source: SheetBoundarySource;
  /** The bright run this was read off, or `null` where the fifth was used. */
  readonly band: { readonly start: number; readonly end: number; readonly contrast: number } | null;
};

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
    const contrast = means[peak] - (left + right) / 2;

    if (contrast < DIVIDER_MIN_CONTRAST) {
      boundaries.push({ leftEnd: equal - 1, rightStart: equal, source: "fifth", band: null });
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

    boundaries.push({
      leftEnd: start - 1,
      rightStart: end + 1,
      source: "divider",
      band: { start, end, contrast },
    });
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
}): string {
  const pronouns = input.pronouns ?? pronounsForSex(null);
  const panelOrder = input.panelOrder ?? SIGN_SHEET_PANEL_ORDER;
  const brief = viewDescriptionOf(input.description);
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
  }>;
};

export type RenderedSignSheet = SignSheetCut & {
  readonly latencyMs: number;
  readonly estimatedCostUsd: number | null;
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
  operationId?: number | string | null;
  signal?: AbortSignal;
}): Promise<RenderedSignSheet> {
  const started = Date.now();
  const panelOrder = input.panelOrder ?? SIGN_SHEET_PANEL_ORDER;
  const image = await input.engine.editWithReferences({
    prompt: composeSignSheetPrompt({
      wardrobeLine: input.wardrobeLine ?? null,
      description: input.description ?? null,
      ...(input.pronouns ? { pronouns: input.pronouns } : {}),
      panelOrder,
    }),
    /* ONE reference, which is his card's own word. Her delivered ink crops are
       NOT sent: they are named BY POSITION in a view's own clause, and a sheet
       is not a view — the tattoos ride the view, where they are judged. */
    references: [await sheetReferenceFromMaster(input.anchor)],
    resolution: "2K",
    ...(input.signal ? { signal: input.signal } : {}),
  });

  const cut = await cutSignSheet(image.bytes, panelOrder);
  const fellBack = cut.geometry.boundaries.filter((boundary) => boundary.source === "fifth").length;
  const line = {
    operationId: input.operationId ?? null,
    returned: cut.source,
    panelWidths: cut.geometry.panels.map((panel) => panel.width),
    dividersFound: cut.geometry.boundaries.length - fellBack,
    boundariesFromFifths: fellBack,
    latencyMs: image.latencyMs ?? Date.now() - started,
    estimatedCostUsd: image.estimatedCostUsd ?? null,
  };
  if (fellBack > 0) {
    /*
      ⚠ **LOUD, because this is the one failure the product cannot see.** A
      boundary taken from a fifth may sit inside a figure, and the judge's three
      surviving axes — identity, intact, people — would all pass a beheaded
      panel. The log line is the only alarm there is, so it is a warning with
      the operation id on it rather than a debug note.
    */
    log.warn(line, "[signSheet] some panel boundaries came from equal fifths — no divider was "
      + "visible there, so a panel may be cut inside the figure");
  } else {
    log.info(line, "[signSheet] the Sign sheet landed and was cut on its own dividers");
  }

  return {
    ...cut,
    latencyMs: image.latencyMs ?? Date.now() - started,
    estimatedCostUsd: image.estimatedCostUsd ?? null,
  };
}
