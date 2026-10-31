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
 *
 * ⚠ **AND IT PASSED WHILE THE BAR WAS WRONG, WHICH IS THE SHARPER LESSON —
 * #2831.** A fill bar does not refuse a small thing; it refuses a **thin long**
 * thing, because a tail or a band worn around something is a sliver inside the
 * whole territory it sweeps. Measured on real pictures the day after the bar
 * shipped, a **correct** tail cut filled 17.00% and a **wrong** cut (a sword,
 * asked for as chest armour) passed at 21.64%. So the floor is a **per-caller**
 * decision now, and this file's arms say which road each one is about: the take
 * road passes `CUT_FILL_FLOOR`, the face panel passes
 * `FILL_MEASURED_NOT_REFUSED`. **The arm that holds the split is `the same cut,
 * two roads, two answers`** — one mask, one box, both positions, so neither
 * road can quietly acquire the other's.
 */
import { describe, expect, it } from "vitest";

import {
  CUT_FEATHER_PX,
  CUT_FILL_FLOOR,
  CUT_WIDEN_PX,
  FILL_MEASURED_NOT_REFUSED,
  cleanCut,
  closeHoles,
  featherOutside,
  judgeCut,
  piecesOf,
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

describe("judgeCut on the take road's floor — the refusal half, on raw cuts", () => {
  it("uses a cut that fills most of the rectangle it was asked for", () => {
    /* A disc of r=60 in a 140×140 box: π·3600/19600 ≈ 57.7%, inside the
       42.3–73.5% band every correct cut in the court landed in. */
    const mask = disc(blank(), 100, 100, 60);
    const verdict = judgeCut({ mask, box: { x: 30, y: 30, width: 140, height: 140 }, fillFloor: CUT_FILL_FLOOR });
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
    const verdict = judgeCut({ mask, box: { x: 25, y: 25, width: 150, height: 150 }, fillFloor: CUT_FILL_FLOOR });
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
    const verdict = judgeCut({ mask, box: { x: 88, y: 88, width: 24, height: 24 }, fillFloor: CUT_FILL_FLOOR });
    expect(verdict.use).toBe(true);
    expect(verdict.fill).toBeGreaterThan(CUT_FILL_FLOOR);
  });

  it("refuses an empty mask as no-pixels, never as a fill failure", () => {
    const verdict = judgeCut({ mask: blank(), box: { x: 0, y: 0, width: 50, height: 50 }, fillFloor: CUT_FILL_FLOOR });
    expect(verdict.use).toBe(false);
    expect(verdict.why).toBe("no-pixels");
    expect(verdict.fill).toBeNull();
    expect(verdict.claimed).toBe(0);
  });

  it("refuses a rectangle with no area rather than dividing by it", () => {
    const mask = disc(blank(), 100, 100, 20);
    const verdict = judgeCut({ mask, box: { x: 10, y: 10, width: 0, height: 40 }, fillFloor: CUT_FILL_FLOOR });
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
    const verdict = judgeCut({ mask, box, fillFloor: CUT_FILL_FLOOR });

    expect(verdict.claimed).toBeGreaterThan(verdict.insideBox * 10);
    expect(verdict.insideBox / (box.width * box.height)).toBeLessThan(CUT_FILL_FLOOR);
    expect(verdict.claimed / (box.width * box.height)).toBeGreaterThan(1);

    /* The decision, which is the thing that matters. */
    expect(verdict.fill).toBe(verdict.insideBox / (box.width * box.height));
    expect(verdict.use).toBe(false);
    expect(verdict.why).toBe("below-fill-floor");
  });

  it("⚠ refuses the known-bad at its own measured size — #2831's guard on the take road", () => {
    /* THE RELAY'S OWN ASK ON #2831: *"Add a guard arm proving the take road
       still refuses the 8.3% specimen."* The arm above uses a 14.2% sliver,
       which is the same defect an order of magnitude up; this one is drawn at
       the known-bad's own figure, so a floor loosened toward the 17% correct
       tail — the obvious wrong repair, and the one the card declined — reddens
       here. 8.3% of a 150x150 box is 1,867 pixels; a 13x144 strip lying wholly
       inside it is 1,872. */
    const mask = rect(blank(), 95, 30, 13, 144);
    const box = { x: 25, y: 25, width: 150, height: 150 };
    const verdict = judgeCut({ mask, box, fillFloor: CUT_FILL_FLOOR });
    expect(verdict.fill).toBeCloseTo(0.083, 3);
    expect(verdict.use).toBe(false);
    expect(verdict.why).toBe("below-fill-floor");
  });

  it("treats the floor itself as usable — the bar refuses BELOW it", () => {
    /* Exactly 20% of a 100×100 box is 2,000 pixels. A 40×50 rectangle is
       2,000 pixels, so this arm sits on the line and must be USED: a bar
       written `<=` instead of `<` would refuse it, and nothing else in this
       suite would notice. */
    const mask = rect(blank(), 10, 10, 40, 50);
    const verdict = judgeCut({ mask, box: { x: 0, y: 0, width: 100, height: 100 }, fillFloor: CUT_FILL_FLOOR });
    expect(verdict.insideBox).toBe(2000);
    expect(verdict.fill).toBeCloseTo(CUT_FILL_FLOOR, 10);
    expect(verdict.use).toBe(true);
  });
});

/**
 * THE FACE PANEL'S POSITION — #2831, the relay's decision of 2026-10-30: the
 * panel stops refusing on fill and keeps logging it.
 *
 * Every arm here passes `FILL_MEASURED_NOT_REFUSED`, which is the panel's two
 * callers' own argument (`pointerCut`'s discovery cut, `falRegionReader`'s
 * `sideByDetector`). **What this block has to prove is both halves**: that the
 * fill no longer refuses, AND that taking it off did not take the two yes/no
 * refusals with it — which is the one real risk in the change, because a nil
 * overlap is a nil fill and was swallowed by the floor until today.
 */
describe("judgeCut on the panel road — the fill is measured and never refused on", () => {
  it("keeps the shape of a CORRECT thin cut that the floor threw away", () => {
    /* The tail, at its measured size. `output/_2565-thin/ledger.json` row
       `scorpion-tail`: a correct cut of the whole sweep of a long curved tail,
       looked at, fill 0.1700 — refused, no row, nothing said. A 60x500 strip in
       a 150x1200 box is 16.67%, the same defect at the same figure. */
    const mask = rect(blank(600, 1300), 300, 300, 60, 500);
    const box = { x: 250, y: 100, width: 150, height: 1200 };
    const panel = judgeCut({ mask, box, fillFloor: FILL_MEASURED_NOT_REFUSED });
    expect(panel.use).toBe(true);
    expect(panel.why).toBe("used");
    /* Measured, not discarded: the number is still there for the log. */
    expect(panel.fill).toBeCloseTo(0.1667, 3);
    expect(panel.fill).toBeLessThan(CUT_FILL_FLOOR);
  });

  it("⚠ the same cut, two roads, two answers — and neither road can take the other's", () => {
    /* THE ARM THAT HOLDS THE SPLIT. One mask, one box, both positions. A
       `fillFloor` quietly defaulted on either side, or a floor re-read from the
       constant inside `judgeCut` instead of from the caller, reddens here and
       nowhere else in this file. */
    const mask = rect(blank(), 95, 20, 20, 160);
    const box = { x: 25, y: 25, width: 150, height: 150 };
    const take = judgeCut({ mask, box, fillFloor: CUT_FILL_FLOOR });
    const panel = judgeCut({ mask, box, fillFloor: FILL_MEASURED_NOT_REFUSED });

    expect(take.use).toBe(false);
    expect(take.why).toBe("below-fill-floor");
    expect(panel.use).toBe(true);
    expect(panel.why).toBe("used");
    /* The MEASUREMENT is identical — only the verdict differs. */
    expect(panel.fill).toBe(take.fill);
    expect(panel.claimed).toBe(take.claimed);
    expect(panel.insideBox).toBe(take.insideBox);
  });

  it("⚠ still refuses a cut that misses the rectangle entirely — the hole the floor used to cover", () => {
    /* A nil overlap is a nil fill, so while every road refused below 20% this
       case never needed its own name. `pointerCut` has a box-against-box check
       of its own; `sideByDetector` has not, and would have started keeping cuts
       of the wrong object the moment the floor came off. So the refusal is in
       the judgement, and it holds with NO floor at all. */
    const mask = rect(blank(), 150, 150, 30, 30);
    const box = { x: 0, y: 0, width: 50, height: 50 };
    const verdict = judgeCut({ mask, box, fillFloor: FILL_MEASURED_NOT_REFUSED });
    expect(verdict.use).toBe(false);
    expect(verdict.why).toBe("no-overlap");
    expect(verdict.claimed).toBeGreaterThan(0);
    expect(verdict.insideBox).toBe(0);
    expect(verdict.fill).toBe(0);
    /* And the floored road answers the same thing, by the same reason: the
       overlap fact is road-independent and is checked before the number. */
    expect(judgeCut({ mask, box, fillFloor: CUT_FILL_FLOOR }).why).toBe("no-overlap");
  });

  it("still refuses an empty mask, with no floor to refuse it", () => {
    const verdict = judgeCut({
      mask: blank(),
      box: { x: 0, y: 0, width: 50, height: 50 },
      fillFloor: FILL_MEASURED_NOT_REFUSED,
    });
    expect(verdict.use).toBe(false);
    expect(verdict.why).toBe("no-pixels");
  });

  it("still refuses a rectangle with no area, with no floor to refuse it", () => {
    const mask = disc(blank(), 100, 100, 20);
    const verdict = judgeCut({
      mask,
      box: { x: 10, y: 10, width: 0, height: 40 },
      fillFloor: FILL_MEASURED_NOT_REFUSED,
    });
    expect(verdict.use).toBe(false);
    expect(verdict.why).toBe("no-box-area");
  });

  it("keeps a ring whose box is the whole thing it encircles — the collar arithmetic", () => {
    /* #2831's second reading, drawn at its own figures. Anything worn AROUND
       something cuts as a ring, and a ring's bounding box is the whole thing it
       encircles: π(R² − (R−t)²) over (2R)², which for a 400px span is
       **14.9% at a 20px band and 20.5% at 28px** — so a band must be 7% of its
       own width to clear this floor, and no real chain is. A chunky 20px collar
       is a perfectly correct cut; on this road it keeps its row. */
    const mask = blank(420, 420);
    disc(mask, 210, 210, 200);
    disc(mask, 210, 210, 180, 0);
    const box = { x: 10, y: 10, width: 400, height: 400 };
    const panel = judgeCut({ mask, box, fillFloor: FILL_MEASURED_NOT_REFUSED });
    expect(panel.fill).toBeCloseTo(0.149, 2);
    expect(panel.fill).toBeLessThan(CUT_FILL_FLOOR);
    expect(panel.use).toBe(true);
    /* And the arithmetic the card states: the same ring judged on the take
       road's floor is refused, which is that road's declared limit (#2736). */
    expect(judgeCut({ mask, box, fillFloor: CUT_FILL_FLOOR }).why).toBe("below-fill-floor");
  });
});

describe("how many pieces a cut came back in — measured, refusing nothing (#2841)", () => {
  it("counts one clean shape as one piece whose largest share is all of it", () => {
    const mask = disc(blank(), 100, 100, 40);
    const broken = piecesOf(mask);
    expect(broken.count).toBe(1);
    expect(broken.claimed).toBe(claimedOf(mask));
    expect(broken.largest).toBe(broken.claimed);
  });

  it("counts three separate discs as three, and the largest share is arithmetic", () => {
    /* Radii 30, 20 and 10, far enough apart to share no pixel. A disc of radius
       r has about πr² pixels, so the largest is about 900π of 1400π — the
       answer is owed before the run, which is this file's rule. */
    const mask = blank();
    disc(mask, 40, 40, 30);
    disc(mask, 120, 40, 20);
    disc(mask, 40, 150, 10);
    const broken = piecesOf(mask);
    expect(broken.count).toBe(3);
    expect(broken.claimed).toBe(claimedOf(mask));
    expect(broken.largest / broken.claimed).toBeCloseTo(900 / 1400, 2);
  });

  it("FOUR connectivity — two squares touching only at a corner are two pieces", () => {
    /*
      ⚠ THE ARM THAT HOLDS THE TWO READERS TOGETHER. `closeHoles` uses four
      connectivity and says why; eight would walk this corner and call these one
      shape, and the two numbers could then never be read side by side in one
      log line. Eight-connectivity would answer 1 here.
    */
    const mask = blank();
    rect(mask, 10, 10, 10, 10);
    rect(mask, 20, 20, 10, 10);
    expect(piecesOf(mask).count).toBe(2);
  });

  it("counts nothing as nothing, rather than dividing by zero", () => {
    expect(piecesOf(blank())).toEqual({ count: 0, largest: 0, claimed: 0 });
  });

  it("the judge carries the two numbers on a KEPT cut, and refuses nothing on them", () => {
    /*
      THE CARD'S OWN SPECIMEN, IN THE SMALL (#2841). A real cut of a leather
      jacket's collar came back as 29 disconnected scraps whose largest was
      43.5% of it, and `judgeCut` called it `used` — because the fill number
      cannot see fragmentation at all. This is that shape: many scraps, a fill
      well over the floor, and still `use: true`.

      ⚠ **`use` is `true` ON PURPOSE and this arm is the one that says so.** The
      card's own recommendation is *"log the two numbers now and refuse nothing
      yet"*, and #2831's lesson is what a bar invented without a population
      does. A later hand that makes this refuse will redden here and read why.
    */
    const mask = blank();
    /* Four 50×50 blocks (10,000 px) and twenty-five 4×4 specks (400 px), none
       touching: 29 pieces, 10,400 claimed, the largest 2,500 — a share of
       24.0% — filling 26.0% of the 200×200 rectangle, which is over the take
       road's 20% floor. Every number is owed before the run. */
    for (const [x, y] of [[0, 0], [60, 0], [0, 60], [60, 60]]) rect(mask, x!, y!, 50, 50);
    for (let n = 0; n < 25; n += 1) rect(mask, 130 + (n % 5) * 12, 10 + Math.floor(n / 5) * 12, 4, 4);
    const box = { x: 0, y: 0, width: 200, height: 200 };
    const verdict = judgeCut({ mask, box, fillFloor: CUT_FILL_FLOOR });
    expect(verdict.pieces).toBe(29);
    expect(verdict.claimed).toBe(10_400);
    expect(verdict.largestPieceShare).toBeCloseTo(2_500 / 10_400, 6);
    expect(verdict.fill).toBeCloseTo(10_400 / 40_000, 6);
    /* And the fill is comfortably over the floor, which is the whole point:
       nothing about 29 scraps is visible to the number that decides. */
    expect(verdict.fill!).toBeGreaterThan(CUT_FILL_FLOOR);
    /* A shattered cut is still USED. That is the defect the card names, left
       standing deliberately until the population says where a bar goes. */
    expect(verdict.why).toBe("used");
    expect(verdict.use).toBe(true);
  });

  it("a cut REFUSED on fill still carries its two numbers", () => {
    /*
      The refused cuts are exactly where a later bar would have to tell a fringe
      from a shattering, so they are in the population too. A single small disc
      under the floor: one piece, all of it.
    */
    const mask = disc(blank(), 100, 100, 8);
    const verdict = judgeCut({ mask, box: { x: 0, y: 0, width: 200, height: 200 }, fillFloor: CUT_FILL_FLOOR });
    expect(verdict.why).toBe("below-fill-floor");
    expect(verdict.pieces).toBe(1);
    expect(verdict.largestPieceShare).toBe(1);
  });

  it("the share is of EVERY claimed pixel, not only the ones inside the box", () => {
    /*
      ⚠ THIS ARM EXISTS BECAUSE A SABOTAGE SURVIVED. Dividing by `insideBox`
      instead of by the claimed total left every other arm green — on those the
      box is the whole frame, so the two numbers are equal and nothing can tell
      them apart. Here they differ on purpose.

      The question these numbers answer is *is this cut one thing or many*,
      which is about the SHAPE and not about the rectangle. A cut sprawling past
      its box is already described by `fill` and `claimed`; a denominator of
      `insideBox` would make the same shape read as more broken the further it
      reached outside, which is a different question answered by accident.

      Inside the 100×100 box: one 40×40 block, 1,600 px. Outside it: one 20×20
      block, 400 px. Two pieces, 2,000 claimed, the largest 1,600 — 80% of the
      cut and 100% of what is inside the box.
    */
    const mask = blank();
    rect(mask, 10, 10, 40, 40);
    rect(mask, 150, 150, 20, 20);
    const verdict = judgeCut({
      mask,
      box: { x: 0, y: 0, width: 100, height: 100 },
      fillFloor: FILL_MEASURED_NOT_REFUSED,
    });
    expect(verdict.claimed).toBe(2_000);
    expect(verdict.insideBox).toBe(1_600);
    expect(verdict.pieces).toBe(2);
    expect(verdict.largestPieceShare).toBeCloseTo(1_600 / 2_000, 6);
    /* And NOT the other denominator, said out loud so the arm cannot be read
       as agreeing with both. */
    expect(verdict.largestPieceShare).not.toBeCloseTo(1_600 / 1_600, 6);
  });

  it("CONTROL — a refusal taken before the walk reports no pieces and pays for no walk", () => {
    /* `no-pixels` and `no-overlap` are answered without a shape to describe,
       and both say so rather than reporting a number nobody measured. */
    const empty = judgeCut({ mask: blank(), box: { x: 0, y: 0, width: 10, height: 10 }, fillFloor: CUT_FILL_FLOOR });
    expect([empty.why, empty.pieces, empty.largestPieceShare]).toEqual(["no-pixels", 0, null]);
    const elsewhere = judgeCut({
      mask: disc(blank(), 180, 180, 10),
      box: { x: 0, y: 0, width: 20, height: 20 },
      fillFloor: CUT_FILL_FLOOR,
    });
    expect([elsewhere.why, elsewhere.pieces, elsewhere.largestPieceShare]).toEqual(["no-overlap", 0, null]);
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
    const out = await cleanCut({ mask, box: { x: 30, y: 30, width: 140, height: 140 }, fillFloor: CUT_FILL_FLOOR });
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
    const out = await cleanCut({ mask, box: { x: 25, y: 25, width: 150, height: 150 }, fillFloor: CUT_FILL_FLOOR });
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
    const raw = judgeCut({ mask, box, fillFloor: CUT_FILL_FLOOR });
    expect(raw.use).toBe(false);
    expect(raw.fill).toBeLessThan(CUT_FILL_FLOOR);
    expect(raw.fill).toBeGreaterThan(CUT_FILL_FLOOR - 0.02);

    /* Cleaned by hand in the pipeline's own order, then judged: it clears the
       bar. The pipeline must NOT do this, and the arm above proves it does not. */
    const widened = await cleanCut({
      mask,
      box,
      fillFloor: CUT_FILL_FLOOR,
      widenBy: CUT_WIDEN_PX,
      featherBy: CUT_FEATHER_PX,
    });
    expect(widened.verdict.use).toBe(false);

    const closed = closeHoles(mask).mask;
    const { dilateMask } = await import("./maskGeometry");
    const grown = await dilateMask(closed, 6);
    const afterCleaning = judgeCut({ mask: grown, box, fillFloor: CUT_FILL_FLOOR });
    expect(afterCleaning.fill!).toBeGreaterThan(raw.fill!);
    expect(afterCleaning.use).toBe(true);
  });

  it("respects an explicit widen and feather of zero", async () => {
    const mask = disc(blank(), 100, 100, 60);
    const out = await cleanCut({
      mask,
      box: { x: 30, y: 30, width: 140, height: 140 },
      fillFloor: CUT_FILL_FLOOR,
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
