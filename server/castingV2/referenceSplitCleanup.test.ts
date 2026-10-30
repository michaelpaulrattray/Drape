/**
 * HIS SPLIT CLEAN-UP, DRIVEN ON SHAPES WHOSE RIGHT ANSWER IS ARITHMETIC (#14
 * slice 3a).
 *
 * The fixtures here are SYNTHETIC on purpose. His obligation — *"measured on
 * the court's fixtures"* — is discharged by a disposable cell against the real
 * split masks on the relay's machine, which are a photograph of a person and
 * are never committed; what a committed suite can do is pin each of his three
 * rules to a shape where the expected pixel count can be counted by hand, so a
 * rule that stops working reddens here rather than on a photograph nobody in
 * CI can see.
 *
 * ⚠ **EVERY ARM ASSERTS AN EXACT COUNT, NOT A DIRECTION.** A clean-up that did
 * nothing at all would satisfy "the big body survives"; it would not satisfy
 * "the result is exactly 400 pixels". That is the difference between an arm
 * that can fail and an arm that reads as coverage.
 */
import { describe, expect, it } from "vitest";

import type { Mask } from "./maskedComposite";
import {
  SPLIT_FACE_COVER_SHARE,
  SPLIT_HOLE_SHARE,
  SPLIT_MAIN_BODY_SHARE,
  cleanSplit,
} from "./referenceSplitCleanup";

const W = 60;
const H = 60;

/** A blank frame. */
function blank(): Mask {
  return { data: Buffer.alloc(W * H, 0), width: W, height: H };
}

/** Paint a filled rectangle live. */
function rect(mask: Mask, x0: number, y0: number, w: number, h: number, value = 255): Mask {
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) mask.data[y * W + x] = value;
  }
  return mask;
}

/** Live pixels, the same `> 127` threshold the module reads. */
function live(mask: Mask): number {
  let n = 0;
  for (const byte of mask.data) if (byte > 127) n += 1;
  return n;
}

/** Is this one pixel live? */
function at(mask: Mask, x: number, y: number): boolean {
  return mask.data[y * W + x]! > 127;
}

describe("his split clean-up", () => {
  describe("rule 1 — each piece's main body", () => {
    it("drops a leaked blotch under a tenth of the piece's largest component", () => {
      /* A 20x20 body (400 px) and a 4x4 blotch (16 px) two pixels away. The
         blotch is 4% of the body, under the tenth, so it goes. */
      const piece = rect(blank(), 5, 5, 20, 20);
      rect(piece, 40, 40, 4, 4);
      expect(live(piece)).toBe(416);

      const cleaned = cleanSplit([piece]);

      expect(cleaned.pieces).toHaveLength(1);
      expect(live(cleaned.pieces[0]!)).toBe(400);
      expect(cleaned.fragmentsDropped).toBe(1);
      expect(cleaned.fragmentPixels).toBe(16);
      expect(at(cleaned.pieces[0]!, 41, 41)).toBe(false);
      expect(at(cleaned.pieces[0]!, 10, 10)).toBe(true);
    });

    it("keeps a second component that IS a tenth of the largest", () => {
      /* 400 px body and a 7x7 = 49 px companion: 12.25%, over the tenth. Both
         survive, which is the arm that stops the rule being "keep the biggest
         component only". */
      const piece = rect(blank(), 5, 5, 20, 20);
      rect(piece, 40, 40, 7, 7);

      const cleaned = cleanSplit([piece]);

      expect(cleaned.fragmentsDropped).toBe(0);
      expect(live(cleaned.pieces[0]!)).toBe(449);
      expect(at(cleaned.pieces[0]!, 42, 42)).toBe(true);
    });

    it("drops the whole piece when nothing is in it", () => {
      const cleaned = cleanSplit([blank()]);

      expect(cleaned.pieces).toHaveLength(0);
      expect(cleaned.dropped).toEqual([{ at: 0, reason: "empty" }]);
    });

    it("is his number and not a local one", () => {
      expect(SPLIT_MAIN_BODY_SHARE).toBe(0.1);
    });
  });

  describe("rule 3 — fill holes under 2% of the piece", () => {
    it("fills a hole under the share and leaves a bigger one open", () => {
      /* A 40x40 square is 1600 px, so the ceiling is 32 px. A 5x5 hole (25) is
         filled; an 8x8 hole (64) is not. Both are enclosed. */
      const small = rect(blank(), 10, 10, 40, 40);
      rect(small, 15, 15, 5, 5, 0);
      expect(live(small)).toBe(1575);

      const filled = cleanSplit([small]);
      expect(filled.holesFilled).toBe(1);
      expect(filled.holePixels).toBe(25);
      expect(live(filled.pieces[0]!)).toBe(1600);
      expect(at(filled.pieces[0]!, 17, 17)).toBe(true);

      const big = rect(blank(), 10, 10, 40, 40);
      rect(big, 15, 15, 8, 8, 0);

      const left = cleanSplit([big]);
      expect(left.holesFilled).toBe(0);
      expect(left.holePixels).toBe(0);
      expect(at(left.pieces[0]!, 18, 18)).toBe(false);
    });

    it("is his number and not a local one", () => {
      expect(SPLIT_HOLE_SHARE).toBe(0.02);
    });
  });

  describe("rule 2 — a contested pixel goes to the piece it sits deeper inside", () => {
    it("gives the overlap to the piece whose body it is deeper within", () => {
      /* A tall thin strip and a wide square overlap in a 6x6 patch. In the
         patch the square's interior is far from the square's edge; the strip is
         only 6 px wide, so every pixel in it is within 3 px of the strip's own
         edge. The square should take the overlap. */
      const strip = rect(blank(), 20, 0, 6, H);
      const square = rect(blank(), 10, 20, 30, 30);
      const before = live(strip) + live(square);

      const cleaned = cleanSplit([strip, square]);

      expect(cleaned.contestedPixels).toBe(6 * 30);
      expect(cleaned.reassignedPixels).toBeGreaterThan(0);
      /* No pixel may be claimed twice afterwards, and none may vanish: the
         union is conserved exactly. */
      const union = new Set<number>();
      for (const piece of cleaned.pieces) {
        for (let p = 0; p < W * H; p += 1) if (piece.data[p]! > 127) union.add(p);
      }
      expect(union.size).toBe(before - cleaned.contestedPixels);
      let doubleClaimed = 0;
      for (let p = 0; p < W * H; p += 1) {
        let held = 0;
        for (const piece of cleaned.pieces) if (piece.data[p]! > 127) held += 1;
        if (held > 1) doubleClaimed += 1;
      }
      expect(doubleClaimed).toBe(0);
      /* The middle of the overlap belongs to the square, not the strip. */
      const [keptStrip, keptSquare] = cleaned.pieces as [Mask, Mask];
      expect(at(keptSquare, 22, 35)).toBe(true);
      expect(at(keptStrip, 22, 35)).toBe(false);
    });

    it("keeps a tie in the larger piece rather than dropping it from both", () => {
      /* Two identical 10x10 squares, one of them with a 10x4 tail so it is the
         larger piece. The shared 10x10 is a depth tie everywhere. */
      const small = rect(blank(), 10, 10, 10, 10);
      const larger = rect(blank(), 10, 10, 10, 10);
      rect(larger, 10, 20, 10, 4);

      const cleaned = cleanSplit([small, larger]);

      expect(cleaned.contestedPixels).toBe(100);
      /* The small one is emptied by the tie rule, so it leaves the set and says
         why — the pixels are not lost, they are the larger piece's. */
      expect(cleaned.dropped).toEqual([{ at: 0, reason: "lost-to-neighbours" }]);
      expect(cleaned.pieces).toHaveLength(1);
      expect(live(cleaned.pieces[0]!)).toBe(140);
    });

    it("counts nothing contested when the pieces do not touch", () => {
      const a = rect(blank(), 2, 2, 10, 10);
      const b = rect(blank(), 40, 40, 10, 10);

      const cleaned = cleanSplit([a, b]);

      expect(cleaned.contestedPixels).toBe(0);
      expect(cleaned.reassignedPixels).toBe(0);
      expect(cleaned.pieces.map(live)).toEqual([100, 100]);
    });
  });

  describe("§6 — a face never lights, and a person is not a takeable thing", () => {
    const face = { x: 20, y: 10, width: 10, height: 10 };

    it("drops a piece that holds the face box — the person is not a thing", () => {
      const person = rect(blank(), 15, 5, 25, 40);

      const cleaned = cleanSplit([person], [face]);

      expect(cleaned.pieces).toHaveLength(0);
      expect(cleaned.personPiecesDropped).toBe(1);
      expect(cleaned.dropped).toEqual([{ at: 0, reason: "covers-a-face" }]);
    });

    it("subtracts the face box out of a piece that only brushes it, and keeps it", () => {
      /* A 30x30 garment whose top-left corner laps 4x4 = 16 px into the face
         box: 16% of the box, under the bar, so the piece stays and loses those
         16 pixels. */
      const garment = rect(blank(), 26, 16, 30, 30);

      const cleaned = cleanSplit([garment], [face]);

      expect(cleaned.personPiecesDropped).toBe(0);
      expect(cleaned.facePixelsRemoved).toBe(16);
      expect(live(cleaned.pieces[0]!)).toBe(900 - 16);
      expect(at(cleaned.pieces[0]!, 27, 17)).toBe(false);
      expect(at(cleaned.pieces[0]!, 40, 30)).toBe(true);
    });

    it("is inert when the reading found no face", () => {
      const piece = rect(blank(), 15, 5, 25, 40);

      const cleaned = cleanSplit([piece], []);

      expect(cleaned.personPiecesDropped).toBe(0);
      expect(cleaned.facePixelsRemoved).toBe(0);
      expect(live(cleaned.pieces[0]!)).toBe(25 * 40);
    });

    it("drops a piece the subtraction empties", () => {
      /* Entirely inside the face box but only 36 of its 100 px — under the
         bar, so it is subtracted rather than dropped as the person, and the
         subtraction leaves nothing. */
      const speck = rect(blank(), 22, 12, 6, 6);

      const cleaned = cleanSplit([speck], [face]);

      expect(cleaned.pieces).toHaveLength(0);
      expect(cleaned.dropped).toEqual([{ at: 0, reason: "empty" }]);
    });

    it("⚠ the person piece leaves BEFORE the contest, so it cannot take the garment with it", () => {
      /* THE REGRESSION GUARD FOR THE DEFECT THE COURT'S FIXTURES CAUGHT.
         The person piece ENCLOSES the garment, so it is deeper at every one of
         the garment's pixels; with the face rule running after the contest it
         won them all and the garment was left a sliver (tank top 0.992 ->
         0.358 on the real fixture). Dropped first, the garment is untouched. */
      const person = rect(blank(), 10, 5, 40, 50);
      const garment = rect(blank(), 18, 25, 18, 18);
      expect(live(garment)).toBe(324);

      const cleaned = cleanSplit([person, garment], [face]);

      expect(cleaned.personPiecesDropped).toBe(1);
      expect(cleaned.pieces).toHaveLength(1);
      /* Not a pixel of the garment is lost, and nothing was contested at all
         once the person had gone. */
      expect(live(cleaned.pieces[0]!)).toBe(324);
      expect(cleaned.contestedPixels).toBe(0);
      expect(cleaned.reassignedPixels).toBe(0);
    });

    it("is his bar and sits in the measured gap", () => {
      expect(SPLIT_FACE_COVER_SHARE).toBe(0.5);
    });
  });

  describe("what it refuses", () => {
    it("refuses pieces that are not all the frame's size rather than resampling", () => {
      const frame = rect(blank(), 1, 1, 5, 5);
      const other: Mask = { data: Buffer.alloc(10 * 10, 255), width: 10, height: 10 };

      expect(() => cleanSplit([frame, other])).toThrow(/must all be the frame's size/);
    });

    it("answers an empty split with an empty split", () => {
      const cleaned = cleanSplit([]);

      expect(cleaned.pieces).toHaveLength(0);
      expect(cleaned.contestedPixels).toBe(0);
    });

    it("never mutates the caller's masks", () => {
      const piece = rect(blank(), 5, 5, 20, 20);
      rect(piece, 40, 40, 4, 4);
      const copy = Buffer.from(piece.data);

      cleanSplit([piece]);

      expect(piece.data.equals(copy)).toBe(true);
    });
  });
});
