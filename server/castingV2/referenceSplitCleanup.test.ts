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
  SPLIT_SAME_THING_IOU,
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
      /* ⚠ THIS FIXTURE WAS RE-SHAPED WHEN THE NEAR-DUPLICATE RULE LANDED
         (#2873), and the old one is kept as that rule's arm two blocks down.
         It used to be a 10x10 square beside the same square with a 10x4 tail —
         IoU 100/140 = 0.714, which is over {@link SPLIT_SAME_THING_IOU}, so the
         new rule now drops the small one as a duplicate and the CONTEST never
         sees it. The tie rule is unchanged and still needed; what changed is
         that this fixture stopped reaching it.

         So the tail is a DETACHED 15x15 block instead: 100/325 = 0.308 is under
         the bar, both pieces arrive at the contest, and the shared 10x10 is
         still a depth tie everywhere — the block sits in the corner of the
         larger piece's bounding box, where the box border is an edge exactly as
         it is for the small piece's own box. The 15x15 is 225 px, so the 100-px
         block is 44% of the largest component and rule 1 keeps both. */
      const small = rect(blank(), 10, 10, 10, 10);
      const larger = rect(blank(), 10, 10, 10, 10);
      rect(larger, 30, 30, 15, 15);
      expect(live(larger)).toBe(325);

      const cleaned = cleanSplit([small, larger]);

      expect(cleaned.duplicatesDropped).toBe(0);
      expect(cleaned.contestedPixels).toBe(100);
      /* The small one is emptied by the tie rule, so it leaves the set and says
         why — the pixels are not lost, they are the larger piece's. */
      expect(cleaned.dropped).toEqual([{ at: 0, reason: "lost-to-neighbours" }]);
      expect(cleaned.pieces).toHaveLength(1);
      expect(live(cleaned.pieces[0]!)).toBe(325);
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

  describe("the same thing answered twice — the court's step, ported (#2873)", () => {
    it("drops the near-duplicate and keeps the FULLER answer", () => {
      /* A 20x20 square and the same square one pixel to the right: the
         intersection is 19x20 = 380 and the union 21x20 = 420, so IoU is 0.905.
         The larger of the two survives — here they are equal in area, so the
         arm that matters is that exactly ONE does and the count is exact. */
      const a = rect(blank(), 5, 5, 20, 20);
      const b = rect(blank(), 6, 5, 20, 20);

      const cleaned = cleanSplit([a, b]);

      expect(cleaned.duplicatesDropped).toBe(1);
      expect(cleaned.pieces).toHaveLength(1);
      expect(live(cleaned.pieces[0]!)).toBe(400);
      /* Nothing was contested, because the duplicate left before the contest —
         which is the whole mechanism #2873 measured: left in, two near-identical
         masks are not collapsed by the contest, they are carved into slivers of
         each other. */
      expect(cleaned.contestedPixels).toBe(0);
      expect(cleaned.dropped).toEqual([{ at: 1, reason: "the-same-thing-twice" }]);
    });

    it("drops the SMALLER of a pair and says which arrived", () => {
      /* THE OLD TIE FIXTURE, which this rule now catches first: a 10x10 square
         beside the same square with a 10x4 tail. IoU 100/140 = 0.714, over the
         bar, so the 100-px piece is the 140-px piece seen short. */
      const small = rect(blank(), 10, 10, 10, 10);
      const larger = rect(blank(), 10, 10, 10, 10);
      rect(larger, 10, 20, 10, 4);

      const cleaned = cleanSplit([small, larger]);

      expect(cleaned.duplicatesDropped).toBe(1);
      expect(cleaned.dropped).toEqual([{ at: 0, reason: "the-same-thing-twice" }]);
      expect(cleaned.pieces).toHaveLength(1);
      expect(live(cleaned.pieces[0]!)).toBe(140);
    });

    it("keeps two pieces that overlap UNDER the bar", () => {
      /* 20x20 at (5,5) and 20x20 at (15,5): intersection 10x20 = 200, union 600,
         IoU 0.333. Both are things; the contest settles the overlap. This is the
         negative control — a rule that dropped here would be eating garments,
         which is the measured failure at a threshold of 0.30. */
      const a = rect(blank(), 5, 5, 20, 20);
      const b = rect(blank(), 15, 5, 20, 20);

      const cleaned = cleanSplit([a, b]);

      expect(cleaned.duplicatesDropped).toBe(0);
      expect(cleaned.pieces).toHaveLength(2);
      expect(cleaned.contestedPixels).toBe(200);
    });

    it("⚠ decides on the REAL IoU, on a pair neither prune can answer — 0.481 keeps, 0.538 drops", () => {
      /* ⚠ THIS PAIR OF ARMS EXISTS BECAUSE A SABOTAGE SURVIVED WITHOUT IT, and
         the hole it found is the one worth naming: breaking the union to
         `union = intersection` — which makes every overlapping pair read as IoU
         1.0 — left all of this block GREEN. Every arm above is decided by one of
         the two PRUNES before `iouOf` is ever called, so nothing held the IoU
         itself. "Keeps two pieces that overlap under the bar" was being
         satisfied by a sibling.

         Both squares are 20x20, so the area-ratio bound (1.0) cannot refuse, and
         the boxes overlap by 260 and 280 px against a 400-px piece, so the
         box-overlap bound cannot refuse either. What is left is the true IoU,
         and the two offsets sit either side of the bar:

           offset 7 → intersection 13x20 = 260, union 540, IoU 0.481 → two things
           offset 6 → intersection 14x20 = 280, union 520, IoU 0.538 → one thing

         So these also pin the bar to a real number rather than to a constant
         read back from the module. */
      const keep = cleanSplit([rect(blank(), 5, 5, 20, 20), rect(blank(), 12, 5, 20, 20)]);
      expect(keep.duplicatesDropped).toBe(0);
      expect(keep.pieces).toHaveLength(2);

      const drop = cleanSplit([rect(blank(), 5, 5, 20, 20), rect(blank(), 11, 5, 20, 20)]);
      expect(drop.duplicatesDropped).toBe(1);
      expect(drop.pieces).toHaveLength(1);
    });

    it("⚠ the two prunes are exact — a pair that passes both and is NOT a duplicate survives", () => {
      /* THE ARM BEHIND "THE PRUNES ARE BOUNDS, NOT HEURISTICS". Two interleaved
         combs over the same 20x20 patch: even columns and odd columns.

           · equal areas, so the area-ratio bound (min/max = 1.0) cannot refuse;
           · near-identical bounding boxes, so the box-overlap bound cannot
             refuse either (360 px of overlap against a 200-px piece);
           · and the true intersection is ZERO.

         A reader that trusted either bound as an answer would call these one
         thing and delete half the picture. Both must survive, untouched. */
      const even = blank();
      const odd = blank();
      for (let x = 0; x < 20; x += 1) {
        rect(x % 2 === 0 ? even : odd, 5 + x, 5, 1, 20);
      }
      expect(live(even)).toBe(200);
      expect(live(odd)).toBe(200);

      const cleaned = cleanSplit([even, odd]);

      expect(cleaned.duplicatesDropped).toBe(0);
      expect(cleaned.contestedPixels).toBe(0);
      expect(cleaned.pieces.map(live)).toEqual([200, 200]);
    });

    it("keeps the survivors in ARRIVAL order, not in area order", () => {
      /* The hit-test map reads a piece's position in this array as its id, so a
         rule that sorted by area would re-label every piece on the picture. A
         small piece arrives first, a large one second, and a duplicate of the
         large one third. */
      const small = rect(blank(), 2, 2, 8, 8);
      const large = rect(blank(), 30, 30, 20, 20);
      const twin = rect(blank(), 31, 30, 20, 20);

      const cleaned = cleanSplit([small, large, twin]);

      expect(cleaned.duplicatesDropped).toBe(1);
      expect(cleaned.pieces.map(live)).toEqual([64, 400]);
    });

    it("⚠ leaves the pieces it returns DISJOINT, which is why this rule cannot run last", () => {
      /* The module's placement argument rests on this: the arbitration gives
         every contested pixel to exactly one winner, so no pair of surviving
         pieces can have an IoU above zero and a near-duplicate rule placed after
         it could never fire. Three overlapping pieces, none of them duplicates. */
      const a = rect(blank(), 2, 2, 24, 24);
      const b = rect(blank(), 20, 2, 24, 24);
      const c = rect(blank(), 2, 20, 24, 24);

      const cleaned = cleanSplit([a, b, c]);

      expect(cleaned.pieces.length).toBeGreaterThan(1);
      let shared = 0;
      for (let first = 0; first < cleaned.pieces.length; first += 1) {
        for (let second = first + 1; second < cleaned.pieces.length; second += 1) {
          for (let p = 0; p < W * H; p += 1) {
            if (cleaned.pieces[first]!.data[p]! > 127 && cleaned.pieces[second]!.data[p]! > 127) shared += 1;
          }
        }
      }
      expect(shared).toBe(0);
    });

    it("is the measured bar and sits between the two failures", () => {
      /* Below 0.336 a garment reads as a duplicate of the person wearing it (the
         tank top's IoU with the whole-person piece); above 0.588 real duplicates
         survive (the lowest true duplicate on the worn photograph). */
      expect(SPLIT_SAME_THING_IOU).toBe(0.5);
      expect(SPLIT_SAME_THING_IOU).toBeGreaterThan(0.336);
      expect(SPLIT_SAME_THING_IOU).toBeLessThan(0.588);
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
