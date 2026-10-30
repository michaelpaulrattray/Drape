/**
 * THE BOX ARITHMETIC, DRIVEN — #2842.
 *
 * Three of these are controls rather than tests, and they are why the suite is
 * worth its length:
 *
 *   **the sum that would have been wrong** — `coveredAreaOf` exists because the
 *   obvious implementation is to add the areas up, and a sum double-counts an
 *   overlap. So the overlapping arm asserts the exact answer AND that the naive
 *   sum differs from it: swap the sweep for a sum and the arm reddens on the
 *   second assertion instead of passing on the first;
 *
 *   **the two shapes the open question is about** — the card's whole point is
 *   that `laces` (parts threaded along one lacing) and `pocket` (parts spread
 *   down a jacket) want different answers. `fill` is the number claimed to tell
 *   them apart, so the claim is driven rather than asserted in prose;
 *
 *   **the second copy that must not come back** — `biggestOf` was written twice
 *   identically before this module existed, which is working law 4's own shape.
 *   The arm asserts neither road declares its own, with the shared module as the
 *   POSITIVE control, so a wrong pattern string cannot pass as coverage.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { biggestOf, coveredAreaOf, spreadOf, unionOf } from "./referenceBoxes";
import type { PointerBox } from "./maskedRefine";

const BOX = (x: number, y: number, width: number, height: number): PointerBox => ({ x, y, width, height });

const HERE = join(process.cwd(), "server", "castingV2");

describe("the biggest rectangle", () => {
  it("is the one with the largest area, whatever order they arrive in", () => {
    expect(biggestOf([BOX(0, 0, 10, 10), BOX(5, 5, 100, 100), BOX(1, 1, 20, 20)]))
      .toEqual(BOX(5, 5, 100, 100));
    expect(biggestOf([BOX(5, 5, 100, 100), BOX(0, 0, 10, 10)]))
      .toEqual(BOX(5, 5, 100, 100));
  });

  it("⚠ is area and not width — a tall thin box beats a wide flat bigger-looking one", () => {
    /* `laces` is 57x66 and a lace's own band can be 300x4. The sort has to be
       on area, which is the thing a reader checking this by eye gets wrong. */
    expect(biggestOf([BOX(0, 0, 300, 4), BOX(0, 0, 57, 66)])).toEqual(BOX(0, 0, 57, 66));
  });

  it("⚠ NEGATIVE CONTROL — over no rectangles it is null, which is the absence answer", () => {
    expect(biggestOf([])).toBeNull();
  });
});

describe("the union", () => {
  it("is the rectangle every box fits inside", () => {
    expect(unionOf([BOX(10, 20, 10, 10), BOX(100, 5, 20, 40)]))
      .toEqual(BOX(10, 5, 110, 40));
  });

  it("is the only box when there is only one", () => {
    expect(unionOf([BOX(7, 9, 11, 13)])).toEqual(BOX(7, 9, 11, 13));
  });

  it("⚠ NEGATIVE CONTROL — null over nothing, and over a box with no size", () => {
    expect(unionOf([])).toBeNull();
    expect(unionOf([BOX(4, 4, 0, 0)])).toBeNull();
  });
});

describe("the area the boxes actually cover", () => {
  it("adds up disjoint parts exactly", () => {
    expect(coveredAreaOf([BOX(0, 0, 10, 10), BOX(50, 50, 20, 20)])).toBe(100 + 400);
  });

  it("⚠ counts an overlap ONCE — and the naive sum would not", () => {
    /* Two 100x100 boxes overlapping on a 50x100 band: 10,000 + 10,000 - 5,000.
       The second assertion is the control: a sum reads 20,000, so replacing the
       sweep with one reddens here rather than slipping through. */
    const boxes = [BOX(0, 0, 100, 100), BOX(50, 0, 100, 100)];
    expect(coveredAreaOf(boxes)).toBe(15_000);
    const naiveSum = boxes.reduce((at, box) => at + box.width * box.height, 0);
    expect(naiveSum).toBe(20_000);
    expect(coveredAreaOf(boxes)).not.toBe(naiveSum);
  });

  it("⚠ a box wholly inside another adds nothing", () => {
    expect(coveredAreaOf([BOX(0, 0, 100, 100), BOX(10, 10, 10, 10)])).toBe(10_000);
  });

  it("⚠ counts two IDENTICAL boxes once — #2787's measured collision, to the pixel", () => {
    /* `hoop earring` and `nose ring` came back as `305,462 44x56` each. Summed,
       that reads as twice the area actually covered. */
    const same = BOX(305, 462, 44, 56);
    expect(coveredAreaOf([same, same])).toBe(44 * 56);
  });

  it("⚠ NEGATIVE CONTROL — nothing covers nothing", () => {
    expect(coveredAreaOf([])).toBe(0);
    expect(coveredAreaOf([BOX(1, 1, 0, 5), BOX(2, 2, 5, 0)])).toBe(0);
  });
});

describe("the spread, which is what #2842 records", () => {
  it("one box is one part, its own union, and completely full", () => {
    const spread = spreadOf([BOX(1094, 671, 57, 66)]);
    expect(spread).not.toBeNull();
    expect(spread!.parts).toBe(1);
    expect(spread!.union).toEqual(BOX(1094, 671, 57, 66));
    expect(spread!.fill).toBe(1);
  });

  it("⚠ NEGATIVE CONTROL — no rectangles is no spread, never a spread of zero parts", () => {
    /* The detector's empty list is the ABSENCE answer and every caller refuses
       on it. A `{ parts: 0 }` would make the absence look like a reading. */
    expect(spreadOf([])).toBeNull();
  });

  it("⚠ counts only the boxes the fill is measured over, so the two never disagree", () => {
    /* A zero-size rectangle covers nothing, so letting it raise `parts` would
       describe one population with a number measured over another. */
    expect(spreadOf([BOX(0, 0, 10, 10), BOX(5, 5, 0, 0)])!.parts).toBe(1);
  });

  it("⚠ fill is never above 1, however the parts overlap", () => {
    const same = BOX(305, 462, 44, 56);
    expect(spreadOf([same, same, same])!.fill).toBe(1);
  });

  /**
   * ⚠ THE TWO SHAPES THE OPEN QUESTION IS ABOUT, AND THE GEOMETRY IS INVENTED.
   *
   * The nine real `laces` boxes were never recorded — that is the hole this
   * card closes, so no suite can claim them. What is asserted here is a
   * property of the MEASURE and not a fact about the fixture: parts threaded
   * along one lacing fill a large share of a small union, and parts scattered
   * down a garment fill almost none of a huge one, so `fill` separates the case
   * the card calls fine from the case it calls not fine. The real numbers
   * replace these the first time a spread is read off a real reading.
   */
  it("⚠ fill separates a threaded thing from a scattered one — the card's own two cases", () => {
    const lacing = Array.from({ length: 9 }, (_, at) => BOX(1090, 640 + at * 12, 60, 12));
    const pockets = [BOX(160, 797, 78, 207), BOX(600, 797, 78, 207), BOX(240, 300, 70, 90), BOX(560, 300, 70, 90)];
    const threaded = spreadOf(lacing)!;
    const scattered = spreadOf(pockets)!;
    expect(threaded.parts).toBe(9);
    expect(scattered.parts).toBe(4);
    /* Threaded: the union is barely bigger than the parts. */
    expect(threaded.fill).toBeGreaterThan(0.8);
    /* Scattered: the union is most of the garment and the parts are not. */
    expect(scattered.fill).toBeLessThan(0.2);
  });
});

describe("⚠ the second copy of the sort, which must not come back", () => {
  const AREA_SORT = "b.width * b.height - a.width * a.height";

  it("POSITIVE CONTROL — the shared module is where the sort lives", () => {
    /* Without this, a typo in the pattern above would make both arms below
       pass by finding nothing anywhere. */
    const shared = readFileSync(join(HERE, "referenceBoxes.ts"), "utf8");
    expect(shared).toContain(AREA_SORT);
    expect(shared.split(AREA_SORT)).toHaveLength(2);
  });

  it("neither reference road declares its own", () => {
    /* It was written twice, identically, in these two files — working law 4's
       own shape, and the reason this module exists. */
    for (const file of ["referenceDiscovery.ts", "referenceTake.ts"]) {
      const source = readFileSync(join(HERE, file), "utf8");
      expect(source, `${file} grew its own area sort again`).not.toContain(AREA_SORT);
      expect(source, `${file} stopped sourcing the shared arithmetic`).toContain("./referenceBoxes");
    }
  });
});
