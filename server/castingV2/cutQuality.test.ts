/**
 * THE CLEAN-AND-REFUSE PIPELINE, DRIVEN ON MASKS WHOSE ANSWERS ARE KNOWN BY
 * CONSTRUCTION — working law 2, before any verdict of its counts for anything.
 *
 * Every mask here is drawn by this file, so each arm's owed answer is arithmetic
 * rather than an observation: a disc of radius r in a box of w×h fills
 * πr²/(w·h), a punched hole of radius h has πh² pixels, three separate discs
 * enclose nothing. **A suite that cannot say what the answer should be before it
 * runs is measuring the implementation against itself.**
 *
 * The real population lives elsewhere on purpose: the seven real SAM cuts the
 * bar was measured on are in `output/_2565-bar/` and are driven by
 * `scripts/_2565-cut-quality-cell-disposable.mts`, because a unit suite that
 * needed binary fixtures on disk would redden in CI the day somebody swept the
 * output directory. **This file holds the arithmetic; that cell holds the
 * photographs.**
 *
 * ⚠ **THE ARM THAT MATTERS MOST IS `does not refuse a small thing`.** A bar on
 * "how much of its box did it fill" is only honest if a correct cut of a small
 * item clears it, and the eventual callers include rows for an earring and a
 * septum ring (#2781, #2789). That is the falsification arm, and in the court
 * it took three attempts to fire at all.
 */
import { describe, expect, it } from "vitest";

import {
  CUT_FEATHER_PX,
  CUT_FILL_FLOOR,
  CUT_WIDEN_PX,
  cleanCut,
  closeHoles,
  featherOutside,
  judgeCut,
} from "./cutQuality";
import type { Mask } from "./maskedComposite";

const W = 200;
const H = 200;

function blank(width = W, height = H): Mask {
  return { data: Buffer.alloc(width * height, 0), width, height };
}

/** A filled disc, drawn by the same predicate the module reads (`> 0`). */
function disc(into: Mask, cx: number, cy: number, r: number, value = 255): Mask {
  for (let y = Math.max(0, cy - r); y <= Math.min(into.height - 1, cy + r); y += 1) {
    for (let x = Math.max(0, cx - r); x <= Math.min(into.width - 1, cx + r); x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) into.data[y * into.width + x] = value;
    }
  }
  return into;
}

function rect(into: Mask, x0: number, y0: number, w: number, h: number, value = 255): Mask {
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) into.data[y * into.width + x] = value;
  }
  return into;
}

function claimedOf(mask: Mask): number {
  let n = 0;
  for (let i = 0; i < mask.data.length; i += 1) if ((mask.data[i] ?? 0) > 0) n += 1;
  return n;
}

describe("judgeCut — the refusal half, on raw cuts", () => {
  it("uses a cut that fills most of the rectangle it was asked for", () => {
    /* A disc of r=60 in a 140×140 box: π·3600/19600 ≈ 57.7%, inside the
       42.3–73.5% band every correct cut in the court landed in. */
    const mask = disc(blank(), 100, 100, 60);
    const verdict = judgeCut({ mask, box: { x: 30, y: 30, width: 140, height: 140 } });
    expect(verdict.use).toBe(true);
    expect(verdict.why).toBe("used");
    expect(verdict.fill).toBeGreaterThan(0.5);
    expect(verdict.fill).toBeLessThan(0.62);
  });

  it("refuses the known-bad shape: a sliver in a big rectangle", () => {
    /* The court's known-bad filled 8.3% — the segmenter answering "only the
       straps" inside a box asked about a whole garment. A 20×160 strip in a
       150×150 box is 14.2%, the same defect at the same order of magnitude. */
    const mask = rect(blank(), 95, 20, 20, 160);
    const verdict = judgeCut({ mask, box: { x: 25, y: 25, width: 150, height: 150 } });
    expect(verdict.use).toBe(false);
    expect(verdict.why).toBe("below-fill-floor");
    expect(verdict.fill).toBeLessThan(CUT_FILL_FLOOR);
  });

  it("⚠ does not refuse a small thing — the falsification arm", () => {
    /* A nose stud is a small object in a small box, and it must clear the same
       bar a jacket does. r=8 in a 24×24 box is π·64/576 ≈ 34.9%; the court's
       real nose stud read 67.1% and its hoop earring 49.6%. If a fill bar
       refused small items it would be the wrong instrument, and this is the arm
       that would say so. */
    const mask = disc(blank(), 100, 100, 8);
    const verdict = judgeCut({ mask, box: { x: 88, y: 88, width: 24, height: 24 } });
    expect(verdict.use).toBe(true);
    expect(verdict.fill).toBeGreaterThan(CUT_FILL_FLOOR);
  });

  it("refuses an empty mask as no-pixels, never as a fill failure", () => {
    const verdict = judgeCut({ mask: blank(), box: { x: 0, y: 0, width: 50, height: 50 } });
    expect(verdict.use).toBe(false);
    expect(verdict.why).toBe("no-pixels");
    expect(verdict.fill).toBeNull();
    expect(verdict.claimed).toBe(0);
  });

  it("refuses a rectangle with no area rather than dividing by it", () => {
    const mask = disc(blank(), 100, 100, 20);
    const verdict = judgeCut({ mask, box: { x: 10, y: 10, width: 0, height: 40 } });
    expect(verdict.use).toBe(false);
    expect(verdict.why).toBe("no-box-area");
    expect(verdict.fill).toBeNull();
    /* The pixels were still counted — the refusal is about the question, not
       about the answer being empty. */
    expect(verdict.claimed).toBeGreaterThan(0);
  });

  it("counts fill inside the asked rectangle only, so sprawl cannot clear the bar", () => {
    /* ⚠ THIS ARM IS WRITTEN THE WAY IT IS BECAUSE ITS FIRST VERSION SURVIVED
       SABOTAGE. It asserted only that `claimed` exceeded `insideBox` — two
       return values of the same pass — and never that `fill` was computed from
       the inside-box count. Patching `judgeCut` to divide `claimed` by the
       box's area left all 22 arms green, which is a guard checking the shape of
       its own output instead of the decision that output drives.

       So the arm is now a VERDICT arm, on numbers chosen to make the two
       readings disagree about the answer and not merely about the count: a
       ~201px blob inside a 40x40 box is 12.6% and must be REFUSED, while the
       ~2,827px blob outside it would carry the pair to 189% and clear the bar
       on territory the rectangle never asked about. */
    const mask = blank();
    disc(mask, 40, 40, 8);
    disc(mask, 150, 150, 30);
    const box = { x: 20, y: 20, width: 40, height: 40 };
    const verdict = judgeCut({ mask, box });

    expect(verdict.claimed).toBeGreaterThan(verdict.insideBox * 10);
    expect(verdict.insideBox / (box.width * box.height)).toBeLessThan(CUT_FILL_FLOOR);
    expect(verdict.claimed / (box.width * box.height)).toBeGreaterThan(1);

    /* The decision, which is the thing that matters. */
    expect(verdict.fill).toBe(verdict.insideBox / (box.width * box.height));
    expect(verdict.use).toBe(false);
    expect(verdict.why).toBe("below-fill-floor");
  });

  it("treats the floor itself as usable — the bar refuses BELOW it", () => {
    /* Exactly 20% of a 100×100 box is 2,000 pixels. A 40×50 rectangle is
       2,000 pixels, so this arm sits on the line and must be USED: a bar
       written `<=` instead of `<` would refuse it, and nothing else in this
       suite would notice. */
    const mask = rect(blank(), 10, 10, 40, 50);
    const verdict = judgeCut({ mask, box: { x: 0, y: 0, width: 100, height: 100 } });
    expect(verdict.insideBox).toBe(2000);
    expect(verdict.fill).toBeCloseTo(CUT_FILL_FLOOR, 10);
    expect(verdict.use).toBe(true);
  });
});

describe("closeHoles — §4's gaps, found and filled", () => {
  it("fills an enclosed hole and reports its size, within anti-aliasing of the arithmetic", () => {
    /* A disc of r=50 with a disc of r=10 punched out of its middle. The hole is
       enclosed, so it is a hole; π·100 ≈ 314 pixels. The owed figure is checked
       as a band rather than an integer because a rasterised circle is not
       exactly its own area. */
    const mask = disc(blank(), 100, 100, 50);
    disc(mask, 100, 100, 10, 0);
    const before = claimedOf(mask);
    const out = closeHoles(mask);
    expect(out.holeCount).toBe(1);
    expect(out.holePixels).toBeGreaterThan(280);
    expect(out.holePixels).toBeLessThan(350);
    expect(out.largestHole).toBe(out.holePixels);
    expect(claimedOf(out.mask)).toBe(before + out.holePixels);
  });

  it("counts two separate holes as two, because a torn middle and a stipple differ", () => {
    const mask = disc(blank(), 100, 100, 60);
    disc(mask, 80, 100, 8, 0);
    disc(mask, 125, 100, 8, 0);
    const out = closeHoles(mask);
    expect(out.holeCount).toBe(2);
    expect(out.holePixels).toBeGreaterThan(300);
  });

  it("finds no holes between three separate discs — background is not a hole", () => {
    /* The gaps between the discs reach the frame border, so the flood fill
       reaches them and they are not enclosed. A hole finder that lost its
       border seeds would call this whole background one enormous hole and fill
       the entire frame — which is exactly what the court's sabotage did. */
    const mask = blank();
    disc(mask, 50, 50, 20);
    disc(mask, 150, 50, 20);
    disc(mask, 100, 150, 20);
    const before = claimedOf(mask);
    const out = closeHoles(mask);
    expect(out.holeCount).toBe(0);
    expect(out.holePixels).toBe(0);
    expect(claimedOf(out.mask)).toBe(before);
  });

  it("finds no holes in an empty mask and none in a full one", () => {
    expect(closeHoles(blank()).holePixels).toBe(0);
    const full = rect(blank(), 0, 0, W, H);
    expect(closeHoles(full).holePixels).toBe(0);
  });

  it("does not reach a hole that leaks to the outside diagonally", () => {
    /* Four-connectivity on purpose: a ring broken by a single diagonal step
       still looks like a hole, so the fill must not escape through it. Here the
       enclosure is complete, and the arm beside it proves a real gap DOES
       leak — the pair is what says the connectivity is the chosen one. */
    const ring = disc(blank(), 100, 100, 40);
    disc(ring, 100, 100, 25, 0);
    expect(closeHoles(ring).holeCount).toBe(1);

    /* The same ring cut open by a 4-connected channel to the border: the
       background now reaches the middle, so there is no hole at all. */
    const open = disc(blank(), 100, 100, 40);
    disc(open, 100, 100, 25, 0);
    rect(open, 98, 0, 4, 100, 0);
    expect(closeHoles(open).holeCount).toBe(0);
  });

  it("never mutates the caller's mask", () => {
    const mask = disc(blank(), 100, 100, 40);
    disc(mask, 100, 100, 9, 0);
    const copy = Buffer.from(mask.data);
    const out = closeHoles(mask);
    expect(out.holePixels).toBeGreaterThan(0);
    expect(mask.data.equals(copy)).toBe(true);
    expect(out.mask.data.equals(copy)).toBe(false);
  });
});

describe("featherOutside — the ramp runs outward only", () => {
  it("leaves every originally claimed pixel fully opaque", async () => {
    /* The property his eye asked for on G-seg2. `featherMask` fails this arm by
       construction — it blurs both sides and eats a radius of the interior —
       which is the whole reason this function exists beside it. */
    const mask = disc(blank(), 100, 100, 40);
    const out = await featherOutside(mask, 3);
    let checked = 0;
    for (let p = 0; p < mask.data.length; p += 1) {
      if ((mask.data[p] ?? 0) > 0) {
        expect(out.data[p]).toBe(255);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(4000);
  });

  it("does ramp outside the shape, so it is a feather and not a no-op", async () => {
    const mask = disc(blank(), 100, 100, 40);
    const out = await featherOutside(mask, 3);
    let ramped = 0;
    for (let p = 0; p < mask.data.length; p += 1) {
      const was = mask.data[p] ?? 0;
      const now = out.data[p] ?? 0;
      if (was === 0 && now > 0 && now < 255) ramped += 1;
    }
    expect(ramped).toBeGreaterThan(100);
  });

  it("returns the mask untouched at radius zero", async () => {
    const mask = disc(blank(), 100, 100, 20);
    const out = await featherOutside(mask, 0);
    expect(out).toBe(mask);
  });

  it("keeps the raster's shape", async () => {
    const mask = disc(blank(), 100, 100, 20);
    const out = await featherOutside(mask, 2);
    expect(out.width).toBe(W);
    expect(out.height).toBe(H);
    expect(out.data.length).toBe(mask.data.length);
  });
});

describe("cleanCut — the pipeline, and why its order is load-bearing", () => {
  it("judges, closes, widens and feathers a cut it keeps", async () => {
    const mask = disc(blank(), 100, 100, 60);
    disc(mask, 100, 100, 9, 0);
    const out = await cleanCut({ mask, box: { x: 30, y: 30, width: 140, height: 140 } });
    expect(out.verdict.use).toBe(true);
    expect(out.holeCount).toBe(1);
    expect(out.holePixels).toBeGreaterThan(200);
    expect(out.mask).not.toBeNull();
    expect(out.bounds).not.toBeNull();
    /* Widened, so it occupies more than it did, and the hole is gone. */
    expect(claimedOf(out.mask!)).toBeGreaterThan(claimedOf(mask));
  });

  it("does not clean a cut it refuses, and hands back no mask at all", async () => {
    const mask = rect(blank(), 95, 20, 20, 160);
    const out = await cleanCut({ mask, box: { x: 25, y: 25, width: 150, height: 150 } });
    expect(out.verdict.use).toBe(false);
    expect(out.verdict.why).toBe("below-fill-floor");
    expect(out.mask).toBeNull();
    expect(out.bounds).toBeNull();
    /* Not merely absent — never computed. A refused cut reporting closed holes
       would be a widened mask's numbers beside a raw mask's verdict. */
    expect(out.holePixels).toBe(0);
    expect(out.holeCount).toBe(0);
  });

  it("⚠ cleaning RAISES fill, which is why the verdict is taken first", async () => {
    /* The discipline this suite exists to pin. A cut sitting just under the
       floor must stay refused — if the pipeline cleaned first and judged after,
       the widening alone would lift it over the bar and the measured number
       would mean something different from what was measured. */
    const mask = rect(blank(), 60, 60, 43, 43);
    const box = { x: 50, y: 50, width: 100, height: 100 };
    const raw = judgeCut({ mask, box });
    expect(raw.use).toBe(false);
    expect(raw.fill).toBeLessThan(CUT_FILL_FLOOR);
    expect(raw.fill).toBeGreaterThan(CUT_FILL_FLOOR - 0.02);

    /* Cleaned by hand in the pipeline's own order, then judged: it clears the
       bar. The pipeline must NOT do this, and the arm above proves it does not. */
    const widened = await cleanCut({
      mask,
      box,
      widenBy: CUT_WIDEN_PX,
      featherBy: CUT_FEATHER_PX,
    });
    expect(widened.verdict.use).toBe(false);

    const closed = closeHoles(mask).mask;
    const { dilateMask } = await import("./maskGeometry");
    const grown = await dilateMask(closed, 6);
    const afterCleaning = judgeCut({ mask: grown, box });
    expect(afterCleaning.fill!).toBeGreaterThan(raw.fill!);
    expect(afterCleaning.use).toBe(true);
  });

  it("respects an explicit widen and feather of zero", async () => {
    const mask = disc(blank(), 100, 100, 60);
    const out = await cleanCut({
      mask,
      box: { x: 30, y: 30, width: 140, height: 140 },
      widenBy: 0,
      featherBy: 0,
    });
    expect(out.verdict.use).toBe(true);
    /* No widening and no ramp: the kept mask is the hole-closed mask exactly. */
    expect(claimedOf(out.mask!)).toBe(claimedOf(closeHoles(mask).mask));
  });
});

describe("the declared constants", () => {
  it("states the measured floor and the unmeasured pixel radii as separate facts", () => {
    expect(CUT_FILL_FLOOR).toBe(0.2);
    expect(CUT_WIDEN_PX).toBe(2);
    expect(CUT_FEATHER_PX).toBe(2);
  });
});
