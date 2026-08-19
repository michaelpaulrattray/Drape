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
