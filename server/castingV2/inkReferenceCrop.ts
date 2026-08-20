/**
 * THE CUTTER'S GEOMETRY AND ITS ROUTING TABLE — build 3a's pure half
 * (design `V3B_INK_AND_MARKS_DESIGN_NOTE.md` §7.12, ruled fable-1127/1129/1130).
 *
 * Every rule that was MEASURED lives here, and nothing here calls a segmenter,
 * touches storage or writes a row — so all of it drives in a suite that costs
 * nothing and can be driven directly rather than through a model that usually
 * behaves. `inkReferenceCutter.ts` is the half that spends money.
 *
 * The split is `hairReferenceCrop` / `hairReferenceCutter`'s, deliberately: the
 * one road in this product that has already been through a court of its own.
 *
 * # THE TWO QUESTIONS ARE MEASURED VALUES, NOT LABELS SOMEBODY LIKED
 *
 * 58 reader calls on the founder's own fixtures, every mask cut out and looked
 * at. The precedent is `V3B_PLACEMENT_VOCABULARY_READING` — `collarbone`,
 * `clavicle` and `decolletage` read NOTHING on skin that was plainly bare while
 * `upper chest` found it exactly.
 *
 * ```
 *                        specimen A       specimen B    no-ink control
 * word                   (solid design)   (fine line)   (photographed person)
 * ─────────────────────────────────────────────────────────────────────────────
 * tattooed skin          6,256 px         1,476 px      0 masks     ← chosen
 * tattoo                   370 px  ← ONE STAR of four
 * tattoo on her arm      6,155 px         1,435 px
 * body art               5,425 px         1,412 px
 * ink / arm tattoo       0 masks          0 masks
 * ```
 *
 * `tattoo` was very nearly filed as *the reader cannot find ink*, on readings of
 * `0.0%` and `0.1%`. 370 of 1,572,864 pixels PRINTS as `0.0%`, and cut out it is
 * one complete star of a crescent-and-three-stars design. **A percentage hid a
 * whole object.** Hence `INK_REGION` below and hence this module counts PIXELS.
 */
import { INK_DESIGN_MIN_EDGE } from "./inkUploadDoor";
import type { Mask } from "./maskedComposite";
import type { PictureHalf } from "./sidePhrasing";

/**
 * THE CUT QUESTION. Measured against seven rivals; see the table above.
 *
 * Not `tattoo`, which returns one object of a multi-object design, and not
 * `ink` or `arm tattoo`, which return no mask at all on either specimen.
 */
export const INK_REGION = "tattooed skin";

/**
 * THE LICENCE QUESTION — *is there somebody photographed in this picture?*
 *
 * Not `person`, and the reason is the whole licence. `person` cannot tell a
 * DRAWN person from a PHOTOGRAPHED one, and it is wrong in both directions:
 * 25,885 px on a flash sheet (it found a drawn angel, correctly — the sheet
 * depicts three) and ZERO on another sheet that depicts a drawn figure and a
 * hand. A flash sheet covered in figures is the most ordinary thing a tattoo
 * customer uploads.
 *
 * `human skin` asks after a SUBSTANCE only a photograph of a person contains. A
 * drawing has none. Four for four in both directions, and 6/6 counting the
 * low-skin arm.
 *
 * The control that proves the shape of it: `a photograph of a person` — naming
 * the MEDIUM directly — read ZERO on all four frames, INCLUDING both real
 * photographs. **The discriminator is bought by asking what is IN the picture,
 * never what kind of picture it is.**
 */
export const PERSON_REGION = "human skin";

/**
 * ⚠ AND THE LICENCE QUESTION IS ASKED OF A PADDED COPY OF HER PICTURE — the
 * measurement court, 2026-08-20, ruled fable-1183 §1
 * (`scripts/court-ink-licence-words-disposable.mts`,
 * `output/_court-words-round{1,2,3}.log`).
 *
 * # WHAT WAS MEASURED — the consequence, which is the part that rules
 *
 * `human skin` read **ZERO** on two real photographs of two real heavily
 * tattooed men, three reads each. Centred unchanged on a canvas twice the edge,
 * the SAME PIXELS answered:
 *
 * ```
 *                              as uploaded        padded x2
 *   patchwork man                  0 px          464,859 px      2/2
 *   torso/neck                     0 px          765,210 px      2/2
 *   the first man's top quarter    0 px           91,713 px      2/2
 *
 *   the flash sheet (drawn)        0 px                0 px      2/2   ← negatives HOLD
 *   the trex design (drawn)        0 px                0 px      2/2
 *   the un-inked model       170,103 px          173,333 px      2/2   ← still answers
 * ```
 *
 * So the pad rescued three photographs of three subjects and broke neither
 * drawing. **The finding this encodes is not "the word is blind on inked skin".
 * It is that the word's SILENCE CARRIES NO INFORMATION about whether a person is
 * in the picture** — an answer that flips when you pad a canvas is not a fence,
 * and the fence is what `routeInkUpload`'s last row rests on.
 *
 * # WHY IT WORKS IS NOT KNOWN, AND THIS DOCBLOCK DOES NOT GUESS
 *
 * Three hypotheses went into that court and all three came out dead: it is not a
 * face anchor (`face` answers 16,286 px on the very frame the licence misses),
 * not inked-over skin and not a skin-dominant field (the pad holds the picture's
 * content fixed and flips the answer anyway). A fourth would be a story, and a
 * story in this position is how a measured mitigation becomes a remembered one.
 * **If this ever stops working, the court above is the thing to re-run** — its
 * specimens, its arms and its negatives are all still on disk.
 *
 * # WHY IT IS SAFE, WHICH IS STRUCTURAL RATHER THAN CAREFUL
 *
 * **The licence answer is only ever a COUNT.** `routeInkUpload` takes
 * `personPixels`; no geometry is taken from that mask, nothing is cut from it,
 * and it never reaches a compositor. So a mask living in a padded space cannot
 * put a correct-looking mask in the wrong place — the wrong-frame class this
 * codebase keeps paying for is unreachable from here. **The INK mask, which IS
 * geometry, is never asked of anything but her own pixels.**
 */
export const LICENCE_PAD_FACTOR = 2;

/**
 * THE PADDED CANVAS, AS ARITHMETIC — so the shape of the licence read can be
 * driven for nothing, and so the space check downstream has one place to agree
 * with.
 *
 * Integer throughout: a half-pixel offset would put her picture on a boundary
 * sharp has to round, and the mask that comes back would be one row out of the
 * space this says it is in.
 */
export function paddedLicenceCanvas(input: { width: number; height: number }): {
  width: number;
  height: number;
  left: number;
  top: number;
} {
  const { width, height } = input;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`a picture to pad needs a real size, got ${width}x${height}`);
  }
  const padded = { width: width * LICENCE_PAD_FACTOR, height: height * LICENCE_PAD_FACTOR };
  return {
    ...padded,
    left: Math.round((padded.width - width) / 2),
    top: Math.round((padded.height - height) / 2),
  };
}

/**
 * THE THIRD QUESTION'S WORD — where in HER PICTURE to look, and the one place
 * a lateral word is stopped from reaching a segmenter (fable-1172 §2d).
 *
 * It lives beside `INK_REGION` and `PERSON_REGION` because all three are
 * question words this cutter puts to a reader, and a fourth file holding the
 * third of them is how a rule about what may be asked comes to have two homes.
 *
 * # THE SIDE IS NEVER IN THE QUESTION — mechanically, not by intention
 *
 * SAM 3 ignores laterality and answers a class with an instance
 * (`ask-what-cannot-be-answered-wrong`), so *"right arm"* buys a confident mask
 * of whichever arm it felt like. The side is decided by geometry instead, one
 * function along. **This one refuses to produce a question containing a side
 * word at all** — and the refusal is FAIL-OPEN INTO TODAY'S BEHAVIOUR rather
 * than into a wall: `null` means no region scope, which is the whole ink mask,
 * which is exactly what this road did yesterday.
 *
 * A measured placement's word comes from the vocabulary and is already clean —
 * `neck`, `upper arm`, `upper chest`, measured on sixteen masters. An OPEN
 * placement is the customer's own phrase, and hers may hold anything; the
 * take's model is asked for the side separately, so a clean phrase is the
 * ordinary case and a dirty one is the corner this guard is for.
 *
 * # WHY A WORD LIST HERE IS NOT THE PHRASING LIST D-163 FORBIDS
 *
 * That rule outlaws code deciding what a customer MEANT from a list of
 * spellings. This decides nothing about her meaning: it is a guard on what we
 * are about to SEND, and its failure direction is to send less. A word it
 * wrongly rejects costs a narrowing; a word it wrongly accepts costs an arm.
 */
const SIDE_WORDS = Object.freeze([
  "left", "right", "lefthand", "righthand", "l/h", "r/h", "near", "far",
]);

export function sourceRegionWord(placement: {
  /** The vocabulary's measured word, when this is a placement it knows. */
  readerWord: string | null;
  /** Her own phrase, when it is not. */
  phrase: string | null;
}): string | null {
  const word = (placement.readerWord ?? placement.phrase ?? "").trim().toLowerCase();
  if (word.length === 0) return null;
  /* Split on anything that is not a letter, so `right-arm` and `right/arm` are
     the same two words `right arm` is. A substring test would reject `bright`. */
  const parts = word.split(/[^a-z]+/).filter((one) => one.length > 0);
  if (parts.length === 0) return null;
  if (parts.some((one) => SIDE_WORDS.includes(one))) return null;
  return parts.join(" ");
}

/**
 * What the two answers decide. Deliberately asymmetric — the failing direction
 * is the one that matters.
 *
 * ```
 *   ink     person   →
 *   ─────────────────────────────────────────────────────────────────────
 *   found   found    →  cut       the design. The person is not in the crop.
 *   found   absent   →  cut       a design on a flat sheet with a shape the
 *                                 reader found is still best carried as its
 *                                 own region
 *   absent  absent   →  rideWhole THE LICENCE, and it comes from `human skin:
 *                                 absent` — NEVER from no-tattoo-found
 *   absent  FOUND    →  refuse    ⚠ free, naming what it could not do
 * ```
 *
 * **The last row is the whole design.** *"No tattoo found"* alone must never buy
 * the whole frame: a photograph of a person whose ink the reader missed is
 * precisely the object the widening tripwire exists to keep out of an engine.
 */
export type InkUploadRoute = "cut" | "rideWhole" | "refuse";

/**
 * ROUTE ONE UPLOAD — the table above, and it takes PIXEL COUNTS.
 *
 * # Why counts and not coverages, which is a law rather than a preference
 * # (ratified fable-1129 §1)
 *
 * > **The licence is `pixels > 0`. It may NEVER carry a percentage floor.**
 *
 * Measured on a photographed man in a cloak and armour: `human skin` found his
 * FACE and nothing else — 17,407 px, **1.80% of that frame**. Read as a
 * percentage that sits BELOW the 3.2% a different word scored on a sheet of
 * paper. So a floor of even 1%, added by anyone to "ignore noise", sends a
 * photographed person WHOLE to an engine.
 *
 * The separation this road rests on is 17,407 against a STRUCTURAL zero —
 * `human skin` is exactly zero on a picture with no skin in it — and the zero is
 * the whole licence. Taking counts is what makes that structural instead of
 * remembered: there is no ratio in this signature for a later edit to threshold.
 *
 * A negative count is our own arithmetic gone wrong rather than a reading, and
 * it must not be able to resolve to a licence.
 */
export function routeInkUpload(input: { inkPixels: number; personPixels: number }): InkUploadRoute {
  const { inkPixels, personPixels } = input;
  if (!Number.isInteger(inkPixels) || !Number.isInteger(personPixels) || inkPixels < 0 || personPixels < 0) {
    throw new Error(
      `routeInkUpload needs two non-negative pixel counts, got ink=${inkPixels} person=${personPixels}`,
    );
  }
  if (inkPixels > 0) return "cut";
  return personPixels > 0 ? "refuse" : "rideWhole";
}

/** The smallest rectangle containing every lit pixel, or `null` for an empty mask. */
export type CropBox = { readonly left: number; readonly top: number; readonly width: number; readonly height: number };

/**
 * A mask's extent, counted and bounded in ONE pass.
 *
 * Both numbers come back together because the routing needs the count and the
 * cut needs the box, and reading the buffer twice is how the two drift when
 * somebody later changes what "lit" means.
 *
 * `> 127` rather than `!== 0`, matching what the reader's own masks carry: SAM 3
 * is binary, but a PNG round trip is not guaranteed to be, and a half-lit edge
 * pixel is not a pixel of design.
 */
export function extentOf(mask: Mask): { pixels: number; box: CropBox | null } {
  const { data, width, height } = mask;
  if (data.length !== width * height) {
    /* The channel count is PROVEN, never assumed — sharp promotes buffers to
       three channels behind your back, and every loop below walks one byte per
       pixel, reads past the end and compares against `undefined`, which is
       false. D-210 landed three times in one session through this door. */
    throw new Error(`mask is ${data.length} bytes for ${width}x${height} — not one byte per pixel`);
  }
  let pixels = 0;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      if (data[row + x] > 127) {
        pixels += 1;
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) return { pixels: 0, box: null };
  return { pixels, box: { left, top, width: right - left + 1, height: bottom - top + 1 } };
}

/**
 * IS THIS CUT BIG ENOUGH TO BE A DESIGN? — the completeness guard, consulted on
 * the request path rather than existing as a function nothing calls
 * (invariant 7, and `carrierPicturesScale`'s own pattern).
 *
 * A cut of forty pixels of ink is not a design. The floor is
 * `INK_DESIGN_MIN_EDGE` — **the one the upload door already enforces on the
 * whole picture**, imported rather than restated, because a second number is a
 * second thing to drift. Law 4: derive, never mirror.
 *
 * The SHORTEST edge, so a long thin strip of ink cannot pass on its length.
 */
export function cropClearsMinimumEdge(box: CropBox): boolean {
  return Math.min(box.width, box.height) >= INK_DESIGN_MIN_EDGE;
}

/**
 * THE MASKED CUTOUT — the design in its own pixels, everything else transparent.
 *
 * **A masked cutout, and never a bounding rectangle.** Already ruled twice
 * (fable-1052): a rectangle *"is not an interim, it is 3a done badly, in the one
 * place he said cropped means the design"* — the fidelity law's named violation.
 * `crop-holds-the-region-it-depicts` governs: a carrier pins the region it
 * PICTURES, so what is pictured must be the design alone.
 *
 * # The alpha is written by a BORING LOOP, and the two clever idioms both fail
 *
 * `composite({ blend: "dest-in" })` with a single-channel mask does **nothing**
 * — a one-channel PNG is greyscale and carries no alpha of its own, so every
 * pixel is kept and the "cutout" is a plain crop wearing the name of one. It
 * produced four convincing bounding-box crops during this build's own reading
 * before a magenta overlay showed no magenta anywhere. And `joinChannel` is the
 * other idiom, already banked as a trap in this house: it appends and promotes
 * raw greyscale, and three masking idioms returned a whole FACE, silently.
 *
 * So: RGBA in, one loop, alpha from the mask. The caller encodes and extracts.
 *
 * # The mask is NEVER resized to fit
 *
 * `maskedRefine`'s house rule: a mask not in its picture's space is our error
 * and her free refusal, never a resample. Enforced here by throwing rather than
 * scaling — a resample inside the one path that promises not to have one.
 */
export function cutOutPixels(input: {
  /** The frame as RGBA, one row after another. */
  rgba: Buffer;
  width: number;
  height: number;
  mask: Mask;
}): Buffer {
  const { rgba, width, height, mask } = input;
  if (mask.width !== width || mask.height !== height) {
    throw new Error(
      `mask is ${mask.width}x${mask.height} but the picture is ${width}x${height} — refusing rather than resampling`,
    );
  }
  if (rgba.length !== width * height * 4) {
    throw new Error(`picture is ${rgba.length} bytes for ${width}x${height} RGBA — expected ${width * height * 4}`);
  }
  const out = Buffer.from(rgba);
  for (let at = 0; at < width * height; at += 1) {
    out[at * 4 + 3] = mask.data[at] > 127 ? 255 : 0;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * THE REGION-SCOPED CUT — its arithmetic (ruled fable-1158 §2a,       *
 * roads and conditions ruled fable-1172)                              *
 * ------------------------------------------------------------------ */

/**
 * WHY A CUT NEEDS SCOPING AT ALL, in one measured number.
 *
 * `tattooed skin` on a wholly-tattooed man answers a class with ONE INSTANCE
 * and the extent came back `140x167` (opus-862) — a fragment of a body covered
 * in work. A customer who says *"copy his right arm sleeve"* is naming a
 * REGION and a SIDE of somebody else's photograph, and neither of those is a
 * question this product may put to the segmenter:
 *
 *   - the REGION is asked, but never laterally. `arm`, never `right arm` —
 *     SAM 3 ignores laterality and answers a class with an instance, which is
 *     this campaign's own `ask-what-cannot-be-answered-wrong`. Non-optional,
 *     and it is the caller's word that is constrained rather than a filter
 *     here (fable-1172 §2d);
 *   - the SIDE is decided by IMAGE GEOMETRY — the half machinery, whose one
 *     owner is `sidePhrasing.imageHalfOf`. A half of a frame is arithmetic; a
 *     reader's opinion about somebody's left is not.
 *
 * **And the geometry assumes a subject facing the camera, which an arbitrary
 * photograph does not promise.** That is the whole reason road (c) was ruled
 * rather than (a) or (b): the cut goes in front of her, free, with the sentence
 * saying which half of the picture it came out of, and she discards for nothing
 * if the guess was wrong. Everything in this file is what makes that guess
 * legible; nothing in it makes the guess safe on its own.
 */

/**
 * ONE MASK MINUS EVERYTHING THE OTHER DOES NOT COVER.
 *
 * Both masks must be in the same space — a mask that is not is our error and
 * never something to resample (`maskedRefine`'s house rule, and `cutOutPixels`
 * throws for the same reason one line along).
 *
 * The result is a fresh buffer rather than a mutation of either input: both
 * arrive from a reader that a caller may still want to count, and an
 * intersection that quietly emptied the ink mask would make the fallback below
 * compare a half against itself.
 */
export function intersectMasks(a: Mask, b: Mask): Mask {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(
      `masks are ${a.width}x${a.height} and ${b.width}x${b.height} — refusing rather than resampling`,
    );
  }
  if (a.data.length !== a.width * a.height || b.data.length !== b.width * b.height) {
    throw new Error("a mask is not one byte per pixel — refusing rather than indexing into it");
  }
  const data = Buffer.alloc(a.width * a.height, 0);
  for (let at = 0; at < data.length; at += 1) {
    data[at] = a.data[at]! > 127 && b.data[at]! > 127 ? 255 : 0;
  }
  return { data, width: a.width, height: a.height };
}

/**
 * HALF A FRAME, AS A MASK — the geometry, and the only place a half is turned
 * into pixels.
 *
 * The split is by COLUMN and the middle column belongs to neither half when the
 * width is odd: `x < floor(w/2)` is the left, `x >= ceil(w/2)` is the right. A
 * middle column claimed by both would put one strip of pixels in two halves,
 * and the fallback below compares the two counts — so an overlap would be a
 * thumb on the scale of exactly the decision this exists to make.
 */
export function maskOfHalf(input: { width: number; height: number; half: PictureHalf }): Mask {
  const { width, height, half } = input;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`a half needs a real frame, got ${width}x${height}`);
  }
  const data = Buffer.alloc(width * height, 0);
  const from = half === "left" ? 0 : Math.ceil(width / 2);
  const to = half === "left" ? Math.floor(width / 2) : width;
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = from; x < to; x += 1) data[row + x] = 255;
  }
  return { data, width, height };
}

/**
 * WHICH PIXELS THE CUT IS TAKEN FROM, and WHY those.
 *
 * `half` is the half of the picture the pixels came out of, or `null` when no
 * side narrowed anything. `fellBack` is the §2b arithmetic having fired: the
 * half her word pointed at held no design-sized piece and the other one did.
 */
export type InkScopeChoice = {
  readonly mask: Mask;
  readonly pixels: number;
  readonly box: CropBox | null;
  readonly half: PictureHalf | null;
  readonly fellBack: boolean;
  /** Did the REGION narrow anything, or was the whole ink mask kept? */
  readonly regionHeld: boolean;
};

/**
 * SCOPE ONE INK MASK TO A REGION AND A HALF — the whole of fable-1172 §2b, by
 * arithmetic and never by a reader.
 *
 * ```
 *   region ∩ ink empty          →  the WHOLE ink mask, unnarrowed (see below)
 *   no side named               →  region ∩ ink
 *   the named half holds a cut  →  region ∩ ink ∩ that half        ← geometry
 *   it does not, the other does →  region ∩ ink ∩ the OTHER half   ← the fallback
 *   neither half holds a cut    →  region ∩ ink, both halves together
 * ```
 *
 * # THE EMPTY REGION KEEPS THE WHOLE MASK, AND THAT IS THE IMPORTANT ROW
 *
 * A flash sheet has no arm in it. A stencil has no torso. So an ask that names
 * a place on HER, applied as a scope to a picture of a piece of paper, finds
 * nothing — and refusing there would take the most ordinary upload a tattoo
 * customer makes and wall it on the strength of a region word. **The scope
 * NARROWS where it can and never refuses on its own**: what walls a picture is
 * `routeInkUpload`, upstream, on the two questions that were measured.
 *
 * # WHY "HOLDS A CUT" AND NOT "HOLDS A PIXEL"
 *
 * `~empty` in the ruling needed a number, and inventing one here would be a
 * threshold nobody measured sitting in the middle of a money path. So it is not
 * a new number: a half holds a design when the piece in it CLEARS THE UPLOAD
 * DOOR'S OWN FLOOR (`cropClearsMinimumEdge`), the same test that decides
 * whether a whole cut is a design at all. A few stray pixels of the far arm's
 * ink bleeding over the midline is not a sleeve, and this is the product's
 * existing sentence for that, rather than a second one.
 *
 * # AND THE FALLBACK IS FREE
 *
 * Both halves are measured off masks already in hand. No reader is asked
 * anything, no laterality question is put to anybody, and the whole decision
 * costs two passes over a buffer. That is what makes *"an empty offer where a
 * design plainly exists would be a wall wearing a shrug"* answerable without
 * paying for it.
 */
export function scopeInkMask(input: {
  ink: Mask;
  /** The named region's mask, or `null` when nothing was asked. */
  region: Mask | null;
  /** The half her word points at, already flipped by `sidePhrasing.imageHalfOf`. */
  half: PictureHalf | null;
}): InkScopeChoice {
  const { ink, region, half } = input;
  const whole = extentOf(ink);
  const held = region === null ? null : intersectMasks(ink, region);
  const heldExtent = held === null ? null : extentOf(held);

  /* The region found nothing of the design — keep everything, narrow nothing. */
  if (held === null || heldExtent === null || heldExtent.pixels === 0) {
    return {
      mask: ink,
      pixels: whole.pixels,
      box: whole.box,
      half: null,
      fellBack: false,
      regionHeld: false,
    };
  }

  if (half === null) {
    return {
      mask: held,
      pixels: heldExtent.pixels,
      box: heldExtent.box,
      half: null,
      fellBack: false,
      regionHeld: true,
    };
  }

  const other: PictureHalf = half === "left" ? "right" : "left";
  const sideOf = (which: PictureHalf) => {
    const mask = intersectMasks(held, maskOfHalf({ width: ink.width, height: ink.height, half: which }));
    const extent = extentOf(mask);
    return { which, mask, ...extent };
  };
  const named = sideOf(half);
  if (named.box !== null && cropClearsMinimumEdge(named.box)) {
    return {
      mask: named.mask,
      pixels: named.pixels,
      box: named.box,
      half,
      fellBack: false,
      regionHeld: true,
    };
  }
  const opposite = sideOf(other);
  if (opposite.box !== null && cropClearsMinimumEdge(opposite.box)) {
    return {
      mask: opposite.mask,
      pixels: opposite.pixels,
      box: opposite.box,
      half: other,
      fellBack: true,
      regionHeld: true,
    };
  }
  /* Neither half holds a design on its own — a piece across the midline, or a
     design too small either side of it. The region's own intersection is the
     honest answer, and the guard downstream decides whether it is big enough. */
  return {
    mask: held,
    pixels: heldExtent.pixels,
    box: heldExtent.box,
    half: null,
    fellBack: false,
    regionHeld: true,
  };
}
