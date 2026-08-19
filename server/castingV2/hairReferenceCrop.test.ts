/**
 * THE CROP ROAD'S GEOMETRY — driven on synthetic frames where the right answer
 * is known by construction, and on the FIGURES his own specimens produced.
 *
 * Every rule in the module was measured before it was written, so the arms below
 * are written against those measurements rather than against the code's shape.
 */
import { describe, expect, it } from "vitest";

import {
  FORM_FILL,
  MIN_FORM_RATIO,
  SEAM_RATIO,
  carrierPicturesScale,
  composeCarrierPixels,
  encodeCarrier,
  findSeam,
  panelsOf,
  unionBox,
  type CropMask,
} from "./hairReferenceCrop";

/**
 * A frame that is continuous everywhere, like one photograph.
 *
 * A smooth gradient rather than patterned noise, and the first version got this
 * wrong in a way worth keeping: it used `(x * 3 + y * 2) % 24`, whose wrap-around
 * puts a hard step every few pixels, so the frame's OWN median line-difference
 * was already large and a genuine seam could not stand out against it. The
 * fixture has to be what it claims to be — the detector is relative to the
 * frame's own median, so a noisy fixture hides the very thing under test.
 */
function continuous(width: number, height: number): Buffer {
  const grey = Buffer.alloc(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      grey[y * width + x] = Math.round(60 + (x / width) * 60 + (y / height) * 60);
    }
  }
  return grey;
}

/** The same frame, cut at `at` — the row below the seam starts a new picture. */
function composite(width: number, height: number, at: number): Buffer {
  const grey = continuous(width, height);
  for (let y = at + 1; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) grey[y * width + x] = 255 - grey[y * width + x];
  }
  return grey;
}

const mask = (width: number, height: number, set: (x: number, y: number) => boolean): CropMask => {
  const data = Buffer.alloc(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) data[y * width + x] = set(x, y) ? 255 : 0;
  }
  return { data, width, height, channels: 1 };
};

describe("the seam — a composite is found by a discontinuity, never by counting", () => {
  it("finds a horizontal cut and puts it at the right line", () => {
    const seam = findSeam(composite(80, 120, 60), 80, 120);
    expect(seam).not.toBeNull();
    expect(seam?.axis).toBe("row");
    expect(seam?.at).toBe(60);
    expect(seam?.ratio).toBeGreaterThanOrEqual(SEAM_RATIO);
  });

  it("finds a vertical cut too — side by side is a composite as well", () => {
    /* Transposed by construction: the same picture, cut the other way. */
    const width = 120;
    const height = 80;
    const grey = continuous(width, height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 61; x < width; x += 1) grey[y * width + x] = 255 - grey[y * width + x];
    }
    const seam = findSeam(grey, width, height);
    expect(seam?.axis).toBe("column");
    expect(seam?.at).toBe(60);
  });

  it("finds NOTHING in one continuous photograph — the arm that matters", () => {
    /* A detector that fires on everything would pass the positive arm and be
       useless. His four single-photograph specimens all read below 7x. */
    expect(findSeam(continuous(80, 120), 80, 120)).toBeNull();
  });

  it("ignores a hard edge at the frame's own border", () => {
    /* A letterbox or a scanner edge is not a join, and cutting there would
       produce a panel of nothing. */
    const width = 80;
    const height = 120;
    const grey = continuous(width, height);
    for (let x = 0; x < width; x += 1) {
      grey[1 * width + x] = 0;
      grey[(height - 2) * width + x] = 0;
    }
    expect(findSeam(grey, width, height)).toBeNull();
  });

  it("does not divide by a flat frame's zero median", () => {
    /* Every line identical: the median difference is 0, and a naive ratio would
       be infinite on every line of an empty picture. */
    expect(findSeam(Buffer.alloc(40 * 40, 200), 40, 40)).toBeNull();
  });

  it("refuses a buffer that is not the frame it claims to be", () => {
    expect(() => findSeam(Buffer.alloc(10), 80, 120)).toThrow(/smaller than the frame/);
  });
});

describe("the panels — the seam line belongs to neither", () => {
  it("returns the whole frame when there is no seam", () => {
    expect(panelsOf(null, 80, 120)).toEqual([{ left: 0, top: 0, width: 80, height: 120 }]);
  });

  it("splits a row seam into two panels that exclude the join", () => {
    expect(panelsOf({ axis: "row", at: 60, ratio: 27 }, 80, 120)).toEqual([
      { left: 0, top: 0, width: 80, height: 60 },
      { left: 0, top: 61, width: 80, height: 59 },
    ]);
  });

  it("splits a column seam the same way", () => {
    expect(panelsOf({ axis: "column", at: 60, ratio: 27 }, 120, 80)).toEqual([
      { left: 0, top: 0, width: 60, height: 80 },
      { left: 61, top: 0, width: 59, height: 80 },
    ]);
  });
});

describe("the carrier — hair in its own pixels, the head REDACTED, the rest gone", () => {
  const size = 10;
  /* Hair across the top, face beneath it, background around both. */
  const hair = mask(size, size, (_x, y) => y < 4);
  const form = mask(size, size, (x, y) => y >= 4 && y < 8 && x >= 2 && x < 8);
  const content: CropMask = {
    data: Buffer.alloc(size * size * 3, 77),
    width: size,
    height: size,
    channels: 3,
  };

  it("boxes everything either mask covers", () => {
    /* Not the hair's box: a fringe hanging past the head outline must not be
       cut off by the head's own bounds, and the form must not be cut off by the
       hair's. */
    expect(unionBox(hair, form)).toEqual({ left: 0, top: 0, width: 10, height: 8 });
  });

  it("refuses two masks in different spaces rather than resolving them", () => {
    expect(() => unionBox(hair, mask(8, 8, () => true))).toThrow(/different spaces/);
  });

  it("returns null when neither mask covers anything", () => {
    expect(unionBox(mask(4, 4, () => false), mask(4, 4, () => false))).toBeNull();
  });

  it("paints hair from the frame, the head flat, and everything else transparent", () => {
    const box = { left: 0, top: 0, width: size, height: size };
    const { rgba, hairPixels, formPixels } = composeCarrierPixels({ content, hair, form, box });
    expect(hairPixels).toBe(size * 4);
    expect(formPixels).toBe(6 * 4);

    const at = (x: number, y: number) => (y * size + x) * 4;
    /* Hair: the photograph's own pixels, opaque. */
    expect([...rgba.subarray(at(0, 0), at(0, 0) + 4)]).toEqual([77, 77, 77, 255]);
    /* The form: flat, opaque, and NOT the photograph's pixels — there is
       nothing of the person left in it. */
    expect([...rgba.subarray(at(4, 5), at(4, 5) + 4)])
      .toEqual([FORM_FILL.r, FORM_FILL.g, FORM_FILL.b, 255]);
    /* Everything else: gone. */
    expect(rgba[at(0, 9) + 3]).toBe(0);
  });

  it("reads every mask by ITS OWN channel count", () => {
    /*
      THE SCAR THIS ARM EXISTS FOR. Three imaging idioms in a row returned a
      whole FACE in a hair carrier, silently — the last of them because sharp
      promotes a one-channel raw buffer to three on the way out and a loop
      indexing it as greyscale reads every third byte.

      So a three-channel mask carrying the same shape must produce the identical
      carrier. If this arm ever goes red, a face is riding.
    */
    const wide: CropMask = {
      data: Buffer.alloc(size * size * 3),
      width: size,
      height: size,
      channels: 3,
    };
    for (let index = 0; index < size * size; index += 1) {
      const value = hair.data[index];
      wide.data[index * 3] = value;
      wide.data[index * 3 + 1] = value;
      wide.data[index * 3 + 2] = value;
    }
    const box = { left: 0, top: 0, width: size, height: size };
    const one = composeCarrierPixels({ content, hair, form, box });
    const three = composeCarrierPixels({ content, hair: wide, form, box });
    expect(three.hairPixels).toBe(one.hairPixels);
    expect(three.rgba.equals(one.rgba)).toBe(true);
  });

  it("encodes to a PNG that really carries an alpha channel", async () => {
    /* `hasAlpha false` on a four-channel intention is exactly what one of the
       failed idioms produced, and nothing complained. */
    const box = { left: 0, top: 0, width: size, height: size };
    const { rgba } = composeCarrierPixels({ content, hair, form, box });
    const png = await encodeCarrier(rgba, box);
    const sharp = (await import("sharp")).default;
    const meta = await sharp(png).metadata();
    expect(meta.hasAlpha).toBe(true);
    expect(meta.width).toBe(size);
    expect(meta.height).toBe(size);
  });
});

describe("a carrier that pictures no scale is refused", () => {
  it("refuses the shape the head-region read actually produced", () => {
    /* MEASURED: asking for `head` returned 99,677px against 99,220px of hair,
       leaving 1,043px of form — a carrier that looks right and carries no scale
       at all, which is a silent regression to the cutout the length court
       convicted. */
    expect(carrierPicturesScale(99_220, 1_043)).toBe(false);
  });

  it("admits the shape the face-region read produced", () => {
    expect(carrierPicturesScale(99_220, 60_008)).toBe(true);
  });

  it("is a ratio, so a small reference is judged the same as a large one", () => {
    const floor = Math.ceil(1_000 * MIN_FORM_RATIO);
    expect(carrierPicturesScale(1_000, floor)).toBe(true);
    expect(carrierPicturesScale(1_000, floor - 1)).toBe(false);
    expect(carrierPicturesScale(100_000, floor)).toBe(false);
  });

  it("refuses a carrier with no hair at all, whatever its form", () => {
    expect(carrierPicturesScale(0, 50_000)).toBe(false);
  });
});

/*
  AND THE SAME DETECTOR OVER HIS OWN SIX FRAMES.

  The figures in the module's header were produced by a probe with its own copy
  of this logic, and a probe's numbers are a REPORT. This drives the shipped
  function over the committed corpus, so the claim *"one composite, at y=661,
  and four controls below the threshold"* is a fact the suite re-proves rather
  than a sentence somebody typed.

  It reads real photographs off disk, which is why it is the only arm here that
  costs anything — a second or so. Worth it: this is the arm that would go red
  if the detector were tuned for synthetic fixtures and wrong on real ones.
*/
describe("his own corpus, through the shipped detector", () => {
  const CORPUS = "docs/specs/references/build-two-founder-specimens";
  const FRAMES: Array<{ file: string; seam: number | null }> = [
    { file: "hair-style-dark-waves-two-panel.png", seam: 661 },
    { file: "hair-colour-blocked-sections-copper-platinum-black-silver.png", seam: null },
    { file: "tail-scorpion-fashion-photo.png", seam: null },
    { file: "glasses-cateye-blond-model.png", seam: null },
    { file: "tattoo-patchwork-torso-neck-continuation.png", seam: null },
  ];

  it("reads exactly one composite, at the line that was measured", async () => {
    const sharp = (await import("sharp")).default;
    const path = await import("node:path");
    const read: Array<{ file: string; at: number | null }> = [];
    for (const frame of FRAMES) {
      const { data, info } = await sharp(path.join(CORPUS, frame.file))
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const seam = findSeam(data, info.width, info.height);
      read.push({ file: frame.file, at: seam?.at ?? null });
    }
    expect(read).toEqual(FRAMES.map((frame) => ({ file: frame.file, at: frame.seam })));
  }, 30_000);
});
