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

import {
  countKeptPixels,
  cutDeliveredInk,
  deliveryRegionWord,
  padRegionBox,
} from "./inkDeliveryCrop";
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
  it("boxes the region and OPENS IT UP by the pad — the surface, not the strokes", () => {
    const box = { left: 200, top: 300, width: 300, height: 280 };
    const result = cutDeliveredInk({ rgba: frame(), width: WIDTH, height: HEIGHT, mask: maskOf(box) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    /* 15% of 300 is 45, of 280 is 42 — both sides, clamped nowhere because this
       box sits well inside the frame. */
    expect(result.cut.box).toEqual({ left: 155, top: 258, width: 390, height: 364 });
    /* The MASK count stays the region's own: it is a fact about what the reader
       answered, and it must not silently become the rectangle's. */
    expect(result.cut.maskPixels).toBe(300 * 280);
    /* The kept count IS the rectangle, because every pixel of it is kept. */
    expect(result.cut.keptPixels).toBe(390 * 364);
    expect(result.cut.keptPixels).toBeLessThan(WIDTH * HEIGHT);
  });

  it("⚠ the pad is what holds the ROSE LEAVES — the 8% that hangs below the surface", () => {
    /*
      THE ARM THE PAD EXISTS FOR, in the court's own numbers. `upper chest` is a
      SURFACE and the piece runs off the bottom of it: the ink's bbox measured
      688x440 where the region's was 674x419, worst single side 36 px at the
      bottom — the leaf tips of both roses, visible un-tinted under the mask at
      `output/court-ride-floor/mask-B-upper-chest.png`.

      Modelled to scale rather than described. Without the pad that ink is
      outside the crop and the engine redraws it: this disease at a twentieth
      of the size, and in front of him.
    */
    const region = { left: 185, top: 885, width: 674, height: 419 };
    const padded = padRegionBox(region, { width: 1024, height: 1536 });
    const inkBottom = region.top + region.height + 36;
    expect(padded.top + padded.height).toBeGreaterThanOrEqual(inkBottom);
    /* Comfortably rather than exactly — ~1.75x the worst measured shortfall,
       because over-inclusion is skin the carry sentence already claims and
       under-inclusion is the defect. */
    expect(padded.top + padded.height - inkBottom).toBeGreaterThan(20);
  });

  it("the pad CLAMPS to the frame rather than running off it", () => {
    /* A piece high on a chest legitimately reaches the top of a tight frame,
       and a crop that stops at the edge of the picture is honest there. */
    const padded = padRegionBox(
      { left: 4, top: 2, width: 300, height: 200 }, { width: WIDTH, height: HEIGHT },
    );
    expect(padded.left).toBe(0);
    expect(padded.top).toBe(0);
    expect(padded.left + padded.width).toBeLessThanOrEqual(WIDTH);
    expect(padded.top + padded.height).toBeLessThanOrEqual(HEIGHT);
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

  it("⚠ and a PAD that swallows the picture is the picture too", () => {
    /*
      The refusal above asks about the MASK and cannot see this one: a region
      filling most of a tight frame pads out to all of it. Reachable rather than
      theoretical, and the answer is unchanged — a crop of the entire man
      carries nothing about a tattoo.
    */
    const result = cutDeliveredInk({
      rgba: frame(), width: WIDTH, height: HEIGHT,
      mask: maskOf({ left: 20, top: 20, width: WIDTH - 40, height: HEIGHT - 40 }),
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
      frame this court showed the founder as its best.

      A crop on this road is a STATEMENT OF EXTENT, not artwork somebody will
      draw from: a small tattoo is small by definition, and that size is the
      fact being carried. The upload door's bar belongs to a different
      population, and this road needs it even less now — a SURFACE's extent
      clears it by construction on every placement in the vocabulary.
    */
    const result = cutDeliveredInk({
      rgba: frame(), width: WIDTH, height: HEIGHT,
      /* `491`'s own box, to the pixel. */
      mask: maskOf({ left: 10, top: 10, width: 97, height: 98 }),
    });
    expect(result.ok, "the upload door's floor is back and it refuses real tattoos").toBe(true);
    if (!result.ok) return;
    expect(Math.min(result.cut.box.width, result.cut.box.height))
      .toBeLessThan(INK_DESIGN_MIN_EDGE);
  });
});

describe("⚠ WHICH WORD THE MINT ASKS — the whole finding, in one function", () => {
  /*
    `tattooed skin` on a seven-mark chest piece answered with ONE SWALLOW —
    13,554 px against 221,363, 1 of 7 marks, same frame and same minute, the
    control reproducing three times within 9 px (opus-945). The reader was
    answering its question correctly; the QUESTION was the defect. The slot's
    own `readerWord` is what answers with the thing.
  */
  it("asks the SLOT'S OWN word for every placement the vocabulary has measured", () => {
    expect(deliveryRegionWord("ink:upperChest")).toBe("upper chest");
    expect(deliveryRegionWord("ink:neck")).toBe("neck");
    expect(deliveryRegionWord("ink:upperArm")).toBe("upper arm");
    /* And never the convicted word for any of them — the arm that goes red if a
       future edit reinstates a default. */
    for (const slot of ["ink:upperChest", "ink:neck", "ink:upperArm"]) {
      expect(deliveryRegionWord(slot)).not.toBe("tattooed skin");
    }
  });

  it("the SIDE is an instance of a surface, and the segmenter is asked the surface", () => {
    /* Laterality is not this question: `sidesForInkPlacement` owns which side,
       and a reader asked about "left upper arm" is the class of question this
       codebase has already measured as unanswerable. */
    expect(deliveryRegionWord("ink:upperArm@left")).toBe("upper arm");
    expect(deliveryRegionWord("ink:upperArm@right")).toBe("upper arm");
  });

  it("⚠ the OPEN lane keeps today's word, because it has no measured surface", () => {
    /*
      A customer's own word for a surface nobody has measured has no
      `readerWord` to offer, so that lane keeps exactly the behaviour it has
      today rather than being handed a word we invented for it. A narrowing
      nobody courted would be this fix's own mistake in the other direction.
    */
    expect(deliveryRegionWord("ink:ribcage")).toBe("tattooed skin");
    expect(deliveryRegionWord("ink:sleeve@left")).toBe("tattooed skin");
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
