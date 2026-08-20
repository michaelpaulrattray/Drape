/**
 * THE DELIVERED TATTOO'S GEOMETRY, DRIVEN DIRECTLY — clause (a)'s pure half.
 *
 * Everything here costs nothing and calls nothing: no segmenter, no storage, no
 * database. That is the whole reason the file exists as its own half.
 *
 * # The arm that matters most is the LAST one
 *
 * `cutDidNotCut` is not a hypothetical guard. Twice on this road a masking
 * idiom returned the WHOLE PICTURE while every number beside it stayed correct
 * — `composite({ blend: "dest-in" })` with a raw greyscale alpha, once in the
 * ink cutter's own build and once in the court script that measured (a) before
 * it was designed. The second time it produced an uncut photograph of a man
 * that a build decision was nearly taken from.
 *
 * So the double that drives the branch MODELS THAT FAILURE — it returns the
 * frame unchanged, which is exactly what the clever call did — rather than
 * inventing a tidier one that would prove nothing about the real trap
 * (`fake-reader-must-model-the-measurement`).
 */
import { describe, expect, it } from "vitest";

import { countKeptPixels, cutDeliveredInk } from "./inkDeliveryCrop";
import { INK_DESIGN_MIN_EDGE } from "./inkUploadDoor";
import type { Mask } from "./maskedComposite";

const WIDTH = 700;
const HEIGHT = 900;

/** A frame of opaque mid-grey — a stand-in for a delivered render. */
function frame(): Buffer {
  const rgba = Buffer.alloc(WIDTH * HEIGHT * 4);
  for (let at = 0; at < WIDTH * HEIGHT; at += 1) {
    rgba[at * 4] = 128;
    rgba[at * 4 + 1] = 128;
    rgba[at * 4 + 2] = 128;
    rgba[at * 4 + 3] = 255;
  }
  return rgba;
}

/** A filled rectangle of "tattooed skin", in the frame's own space. */
function maskOf(box: { left: number; top: number; width: number; height: number }): Mask {
  const data = Buffer.alloc(WIDTH * HEIGHT, 0);
  for (let y = box.top; y < box.top + box.height; y += 1) {
    for (let x = box.left; x < box.left + box.width; x += 1) data[y * WIDTH + x] = 255;
  }
  return { data, width: WIDTH, height: HEIGHT };
}

const EMPTY: Mask = { data: Buffer.alloc(WIDTH * HEIGHT, 0), width: WIDTH, height: HEIGHT };

describe("cutting the tattoo out of the frame that delivered it", () => {
  it("keeps exactly the region's pixels, and boxes them", () => {
    const box = { left: 200, top: 300, width: 300, height: 280 };
    const result = cutDeliveredInk({ rgba: frame(), width: WIDTH, height: HEIGHT, mask: maskOf(box) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cut.box).toEqual({ left: 200, top: 300, width: 300, height: 280 });
    expect(result.cut.maskPixels).toBe(300 * 280);
    /* Counted in the produced bytes, not inferred from the mask. */
    expect(result.cut.keptPixels).toBe(300 * 280);
    expect(result.cut.keptPixels).toBeLessThan(WIDTH * HEIGHT);
  });

  it("the pixels it keeps are the ones inside the region and no others", () => {
    const box = { left: 200, top: 300, width: 300, height: 280 };
    const result = cutDeliveredInk({ rgba: frame(), width: WIDTH, height: HEIGHT, mask: maskOf(box) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const alphaAt = (x: number, y: number) => result.cut.rgba[(y * WIDTH + x) * 4 + 3];
    expect(alphaAt(250, 350)).toBe(255);
    expect(alphaAt(199, 350)).toBe(0);
    expect(alphaAt(500, 350)).toBe(0);
    expect(alphaAt(250, 299)).toBe(0);
    /* And the colour is untouched — this crop carries HIS SKIN, which is the
       entire reason it beats the artwork. A cut that zeroed the pixels as well
       as the alpha would look identical in every count above. */
    expect(result.cut.rgba[(350 * WIDTH + 250) * 4]).toBe(128);
  });

  it("says `noInk` when the reader found nothing on the frame", () => {
    const result = cutDeliveredInk({ rgba: frame(), width: WIDTH, height: HEIGHT, mask: EMPTY });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal).toBe("noInk");
    expect(result.maskPixels).toBe(0);
  });

  it("says `wholeFrame` when the region is the entire picture — that is the man", () => {
    const result = cutDeliveredInk({
      rgba: frame(), width: WIDTH, height: HEIGHT,
      mask: maskOf({ left: 0, top: 0, width: WIDTH, height: HEIGHT }),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal).toBe("wholeFrame");
  });

  it("⚠ KEEPS a small tattoo — the upload door's floor is not this road's", () => {
    /*
      RED FIRST if the floor comes back. `cropClearsMinimumEdge` stood here and
      refused a real tattoo on the very first live frame it met (`492`,
      `tooSmall` at 26,867 mask pixels) — and, on the boxes measured before this
      build existed, it would have refused TWO of THREE, including `491`, the
      frame this court is showing the founder as its best.

      A crop on this road is a STATEMENT OF EXTENT, not artwork somebody will
      draw from: a small tattoo is small by definition, and that size is the
      fact being carried. `${INK_DESIGN_MIN_EDGE}` px is the UPLOAD door's bar
      and belongs to a different population.
    */
    const result = cutDeliveredInk({
      rgba: frame(), width: WIDTH, height: HEIGHT,
      /* `491`'s own box, to the pixel. */
      mask: maskOf({ left: 10, top: 10, width: 97, height: 98 }),
    });
    expect(result.ok, "the upload door's floor is back and it refuses real tattoos").toBe(true);
    if (!result.ok) return;
    expect(result.cut.box).toEqual({ left: 10, top: 10, width: 97, height: 98 });
    expect(Math.min(result.cut.box.width, result.cut.box.height))
      .toBeLessThan(INK_DESIGN_MIN_EDGE);
  });

  it("⚠ says `cutDidNotCut` when the cut returns the whole frame — the real trap", () => {
    /*
      The double IS the failure: `composite({ blend: "dest-in" })` with a raw
      greyscale alpha hands back the input untouched. Every number the caller
      would print stays correct — the mask is right, the box is right, the
      percentage is right — and the picture is an uncut photograph of a person.
      This is the only thing standing between that and a stored crop.
    */
    const result = cutDeliveredInk({
      rgba: frame(), width: WIDTH, height: HEIGHT,
      mask: maskOf({ left: 200, top: 300, width: 300, height: 280 }),
      cut: ({ rgba }) => rgba,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal).toBe("cutDidNotCut");
  });

  it("and `cutDidNotCut` also fires on a cut that keeps the WRONG pixels", () => {
    /*
      The same class arriving from the other direction: a cut that keeps a
      plausible-looking but different set. Without this arm the guard would only
      catch the loudest instance of its own class, which is how a guard comes to
      be trusted for more than it does.
    */
    const result = cutDeliveredInk({
      rgba: frame(), width: WIDTH, height: HEIGHT,
      mask: maskOf({ left: 200, top: 300, width: 300, height: 280 }),
      cut: ({ rgba, width, height }) => {
        const out = Buffer.from(rgba);
        for (let at = 0; at < width * height; at += 1) out[at * 4 + 3] = at < 5 ? 255 : 0;
        return out;
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal).toBe("cutDidNotCut");
  });
});

describe("the kept count is a reading of the bytes, not of the mask", () => {
  it("counts an opaque frame as every pixel", () => {
    expect(countKeptPixels({ rgba: frame(), width: WIDTH, height: HEIGHT })).toBe(WIDTH * HEIGHT);
  });

  it("counts a fully transparent frame as none", () => {
    expect(countKeptPixels({ rgba: Buffer.alloc(WIDTH * HEIGHT * 4), width: WIDTH, height: HEIGHT }))
      .toBe(0);
  });

  it("refuses a buffer that is not four bytes per pixel rather than indexing into it", () => {
    /* sharp promotes buffers behind your back; a loop walking four bytes over a
       three-channel one reads past the end and compares against `undefined`,
       which is false. D-210 landed three times in one session through this. */
    expect(() => countKeptPixels({
      rgba: Buffer.alloc(WIDTH * HEIGHT * 3), width: WIDTH, height: HEIGHT,
    })).toThrow(/four|bytes/i);
  });
});
