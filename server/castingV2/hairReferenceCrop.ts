/**
 * CUTTING HER HAIR OUT OF THE PICTURE SHE ATTACHED — the crop road's geometry
 * (design `UNIVERSAL_REFERENCE_ROAD_DESIGN.md` §9.10; every rule below was
 * measured on his own specimens before it was written).
 *
 * # Three findings shaped this file, and none of them was the expected one
 *
 * **1. A composite is found by its SEAM, not by counting anything.** The design
 * proposed counting components of a head mask — two heads meaning two panels —
 * and it was ratified on the argument and then run. The composite answered ONE
 * head, and that head was the top panel alone: a segmenter answers a class with
 * an INSTANCE. The counter-example failed too, in our favour: hair on both sides
 * of a face arrives as ONE component, because hair joins over the crown.
 *
 * So the discriminator is deterministic and needs no model at all — **a
 * composite is two photographs butted together, so the seam is a line where the
 * picture stops being continuous.** Measured over his corpus, five frames:
 *
 * ```
 *   style      27.4x its own median row-difference at y=661   SEAM
 *   glasses     6.7x                                          no seam
 *   tail        3.8x                                          no seam
 *   patchwork   2.8x                                          no seam
 *   colour      2.0x                                          no seam
 * ```
 *
 * **2. One panel carries, and the customer is told.** A two-view sheet was put
 * on trial because the ink road's character sheet had been cited for it — and
 * that shape was CONVICTED in its own lane (one neck tattoo arriving as two). On
 * one master, one ask, one sitting, the sheet did not double; it also bought
 * nothing a person could see. So the largest panel carries — a measurement, not
 * a judgement — and the second view's non-use is said plainly rather than
 * silently dropped.
 *
 * **3. THE CARRIER PICTURES ITS OWN SCALE, AND NO PERSON.** A hair cutout on
 * transparency lost the LENGTH: his reference covers the ears and reaches the
 * nape, and what came back was a short crop, on every arm. Six renders settled
 * why — and the third arm is the one that made it a claim rather than a guess:
 *
 * ```
 *   scale carrier + length words    LONG   2/2
 *   plain carrier, no such words    short  2/2
 *   plain carrier + LENGTH WORDS    short  2/2   ← the words were not doing it
 * ```
 *
 * So the hair rides on the head's **redacted form**: the face region minus the
 * hair, filled flat. It says *this much head, this much hair* and nothing about
 * whose head it was. **Flat-filled rather than blurred or darkened** — there is
 * nothing left to recover and nothing for an engine to read as a feature. It is
 * the ink road's mannequin answer arriving in hair's lane.
 *
 * # AND THE SCALE REGION IS ASKED AS `face`
 *
 * Measured, not preferred: asked for `head` on his panel the segmenter returned
 * 99,677px against the hair's 99,220px — **the head answer IS the hair** — and a
 * carrier built on it had 1,043px of form and no scale at all. That would have
 * been a carrier that looked right and carried nothing.
 *
 * # What is here and what is not
 *
 * Geometry only: seams, panels, and the composition of one carrier from one
 * panel's two masks. **No segmenter call, no storage, no minting** — those
 * belong to the callers, and keeping them out is what lets every rule above be
 * driven in a suite that costs nothing.
 */
import sharp from "sharp";

/**
 * How many times its own median a line-difference must reach to be a seam.
 *
 * **Relative to the frame's own median on purpose.** A grainy scan and a clean
 * studio frame have very different absolute line-differences and the same seam,
 * so an absolute threshold would be a property of the photograph rather than of
 * the join. Ten sits in the measured gap — 27.4x on the one composite, 6.7x on
 * the loudest single photograph — and it is stated as measured on ONE composite
 * rather than as a law.
 */
export const SEAM_RATIO = 10;

/**
 * A seam this close to an edge is the frame's own border, not a join.
 *
 * A photograph often has a hard edge at its first or last rows — a letterbox, a
 * scanner edge, a border — and cutting there would produce a panel of nothing.
 */
export const SEAM_EDGE_MARGIN = 0.05;

export type Seam = {
  readonly axis: "row" | "column";
  /** The last line of the first panel. */
  readonly at: number;
  /** How many times the frame's own median this line's discontinuity is. */
  readonly ratio: number;
};

export type Panel = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

/** One axis's strongest interior discontinuity, against that axis's median. */
function scanAxis(
  grey: Buffer,
  width: number,
  height: number,
  axis: "row" | "column",
): { at: number; ratio: number } {
  const outer = axis === "row" ? height : width;
  const inner = axis === "row" ? width : height;
  if (outer < 3) return { at: -1, ratio: 0 };
  const diffs: number[] = [];
  for (let index = 0; index + 1 < outer; index += 1) {
    let sum = 0;
    for (let across = 0; across < inner; across += 1) {
      const here = axis === "row" ? index * width + across : across * width + index;
      const next = axis === "row" ? (index + 1) * width + across : across * width + index + 1;
      sum += Math.abs(grey[here] - grey[next]);
    }
    diffs.push(sum / inner);
  }
  const sorted = [...diffs].sort((left, right) => left - right);
  /* A perfectly flat frame has a median of zero, and dividing by it would make
     every line infinitely discontinuous. One grey level is the floor. */
  const median = Math.max(sorted[Math.floor(sorted.length / 2)] ?? 0, 1);
  const margin = Math.floor(outer * SEAM_EDGE_MARGIN);
  let at = -1;
  let value = 0;
  for (let index = margin; index < diffs.length - margin; index += 1) {
    if (diffs[index] > value) { value = diffs[index]; at = index; }
  }
  return { at, ratio: value / median };
}

/**
 * Where this frame is cut, or `null` if it is one photograph.
 *
 * Takes GREYSCALE pixels because a seam is a break in the picture and three
 * channels would triple the work to answer the same question. The caller
 * decodes; this decides.
 */
export function findSeam(grey: Buffer, width: number, height: number): Seam | null {
  if (grey.length < width * height) {
    throw new Error("the buffer is smaller than the frame it claims to be");
  }
  const rows = scanAxis(grey, width, height, "row");
  const columns = scanAxis(grey, width, height, "column");
  const best = rows.ratio >= columns.ratio
    ? { axis: "row" as const, at: rows.at, ratio: rows.ratio }
    : { axis: "column" as const, at: columns.at, ratio: columns.ratio };
  if (best.at < 0 || best.ratio < SEAM_RATIO) return null;
  return best;
}

/**
 * The panels a seam divides a frame into.
 *
 * The seam line itself belongs to neither: it is the join, and a join carried
 * into a panel is a stripe of the other photograph at its edge.
 */
export function panelsOf(seam: Seam | null, width: number, height: number): Panel[] {
  if (!seam) return [{ left: 0, top: 0, width, height }];
  if (seam.axis === "row") {
    return [
      { left: 0, top: 0, width, height: seam.at },
      { left: 0, top: seam.at + 1, width, height: height - seam.at - 1 },
    ];
  }
  return [
    { left: 0, top: 0, width: seam.at, height },
    { left: seam.at + 1, top: 0, width: width - seam.at - 1, height },
  ];
}

/**
 * The flat the redacted form is filled with.
 *
 * Mid grey rather than white or black: a white form reads as background on a
 * light frame and a black one reads as more hair, and either would change what
 * the carrier appears to picture. It is the ink road's own choice for a
 * mannequin, for the same reason.
 */
export const FORM_FILL = { r: 150, g: 150, b: 150 } as const;

/** A single-channel mask in a known space. */
export type CropMask = {
  readonly data: Buffer;
  readonly width: number;
  readonly height: number;
  /** Bytes per pixel in `data` — sharp promotes a greyscale raw input to three. */
  readonly channels: number;
};

/** The tight box around everything either mask covers. */
export function unionBox(hair: CropMask, form: CropMask): Panel | null {
  if (hair.width !== form.width || hair.height !== form.height) {
    /* The wrong-frame class, refused rather than resolved: geometry computed
       against one image while a mask was read from another is how a correct
       mask lands in the wrong space, silently. */
    throw new Error("the hair and form masks are in different spaces");
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < hair.height; y += 1) {
    for (let x = 0; x < hair.width; x += 1) {
      const index = y * hair.width + x;
      const set = hair.data[index * hair.channels] !== 0 || form.data[index * form.channels] !== 0;
      if (!set) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Interleave one carrier: hair in its own pixels, the rest of the head flat,
 * everything else transparent.
 *
 * **Written as a loop rather than through an imaging call**, and that is a scar
 * rather than a style: `ensureAlpha().joinChannel()` APPENDS a channel nothing
 * reads, `removeAlpha().joinChannel()` produced a three-channel PNG with no
 * alpha at all, and a hand interleave that trusted a one-channel raw buffer read
 * every third byte because sharp had promoted it. **All three returned a whole
 * FACE in a carrier meant to hold hair, and none of them raised anything.**
 * Every mask here carries its own `channels` for that reason.
 */
export function composeCarrierPixels(input: {
  /** The panel's own pixels, cropped to `box`, RGB or RGBA. */
  content: CropMask;
  /** The hair mask, cropped to `box`. */
  hair: CropMask;
  /** The face mask, cropped to `box` — the scale, and it is REDACTED. */
  form: CropMask;
  box: Panel;
}): { rgba: Buffer; hairPixels: number; formPixels: number } {
  const { content, hair, form, box } = input;
  const rgba = Buffer.alloc(box.width * box.height * 4);
  let hairPixels = 0;
  let formPixels = 0;
  for (let index = 0; index < box.width * box.height; index += 1) {
    const at = index * 4;
    if (hair.data[index * hair.channels] !== 0) {
      rgba[at] = content.data[index * content.channels];
      rgba[at + 1] = content.data[index * content.channels + 1];
      rgba[at + 2] = content.data[index * content.channels + 2];
      rgba[at + 3] = 255;
      hairPixels += 1;
      continue;
    }
    if (form.data[index * form.channels] !== 0) {
      /* THE REDACTION — flat, not blurred and not darkened. Nothing of the
         person in that photograph survives it, and there is nothing here for an
         engine to read as a feature. */
      rgba[at] = FORM_FILL.r;
      rgba[at + 1] = FORM_FILL.g;
      rgba[at + 2] = FORM_FILL.b;
      rgba[at + 3] = 255;
      formPixels += 1;
      continue;
    }
    rgba[at + 3] = 0;
  }
  return { rgba, hairPixels, formPixels };
}

/**
 * THE CARRIER MUST PICTURE A SCALE, and a carrier that does not is refused
 * rather than sent.
 *
 * Measured: a form of 1,043px against 99,220px of hair is what a `head` read
 * produced, and it carries no scale at all — a picture that looks like a carrier
 * and does the job of a bare cutout. Since the whole point of the form is the
 * length it buys, a carrier whose form is a rounding error is a silent
 * regression to the shape the length court convicted.
 *
 * The floor is a RATIO rather than a pixel count, because a carrier is whatever
 * size the reference was.
 */
export const MIN_FORM_RATIO = 0.1;

export function carrierPicturesScale(hairPixels: number, formPixels: number): boolean {
  if (hairPixels <= 0) return false;
  return formPixels / hairPixels >= MIN_FORM_RATIO;
}

/** Encode a composed carrier. Separated so the composition itself stays pure. */
export async function encodeCarrier(rgba: Buffer, box: Panel): Promise<Buffer> {
  return sharp(rgba, { raw: { width: box.width, height: box.height, channels: 4 } })
    .png()
    .toBuffer();
}
