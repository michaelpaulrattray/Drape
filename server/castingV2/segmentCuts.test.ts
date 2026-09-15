import { describe, expect, it } from "vitest";

import { boundsOf, cropMask, cropRaster, cutSegments, encodeCut, intersectMasks } from "./segmentCuts";
import { readRaster, type Mask, type Raster } from "./maskedComposite";

/**
 * Cutting a delivered frame into the segments it earned.
 *
 * The arithmetic between "one applied mask" and "one segment per facet". It is
 * pure, so it is tested on rasters small enough to write out by hand — the
 * alternative is a fixture nobody can check by reading it.
 */

function mask(width: number, height: number, claim: (x: number, y: number) => boolean): Mask {
  const data = Buffer.alloc(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) data[y * width + x] = claim(x, y) ? 255 : 0;
  }
  return { data, width, height };
}

function raster(width: number, height: number, colour: (x: number, y: number) => [number, number, number]): Raster {
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = colour(x, y);
      const at = (y * width + x) * 3;
      data[at] = r;
      data[at + 1] = g;
      data[at + 2] = b;
    }
  }
  return { data, width, height };
}

describe("the geometry", () => {
  it("intersects to where two masks agree, and says so in whole pixels", () => {
    const left = mask(4, 2, (x) => x < 3);
    const right = mask(4, 2, (x) => x > 1);
    const both = intersectMasks(left, right);
    expect(Array.from(both.data)).toEqual([0, 0, 255, 0, 0, 0, 255, 0]);
  });

  it("refuses masks of different sizes rather than walking off the end of one", () => {
    // The class this closes is real and expensive: a loop that reads past a
    // raster compares against `undefined`, every comparison is false, and the
    // guarantee passes by reading nothing.
    expect(() => intersectMasks(mask(4, 2, () => true), mask(2, 2, () => true))).toThrow(/different sizes/);
  });

  it("bounds a claim tightly, and answers null when there is nothing to bound", () => {
    expect(boundsOf(mask(5, 5, (x, y) => x >= 1 && x <= 2 && y === 3))).toEqual({ x: 1, y: 3, width: 2, height: 1 });
    expect(boundsOf(mask(5, 5, () => false))).toBeNull();
  });

  it("crops a mask and a frame to the same window", () => {
    const box = { x: 1, y: 1, width: 2, height: 2 };
    expect(Array.from(cropMask(mask(4, 4, (x, y) => x === y), box).data)).toEqual([255, 0, 0, 255]);
    const cropped = cropRaster(raster(4, 4, (x, y) => [x * 10, y * 10, 0]), box);
    expect(cropped.width).toBe(2);
    expect(Array.from(cropped.data.subarray(0, 6))).toEqual([10, 10, 0, 20, 10, 0]);
  });
});

describe("cutting a render into segments", () => {
  const composite = raster(8, 8, (x, y) => [x * 8, y * 8, 64]);
  /* The painter was allowed to differ from the master in a 4×4 block. */
  const applied = mask(8, 8, (x, y) => x >= 2 && x < 6 && y >= 2 && y < 6);

  it("gives each facet only the ground its own region can prove", () => {
    const { cuts, dropped } = cutSegments({
      composite,
      applied,
      facetRegions: new Map([["marks", "face skin"], ["hair.colour", "hair"]]),
      regionMasks: new Map([
        // Face skin covers the lower half of the applied block…
        ["face skin", mask(8, 8, (_x, y) => y >= 4)],
        // …and hair the top two rows, which the paint never reached.
        ["hair", mask(8, 8, (_x, y) => y < 2)],
      ]),
    });

    // One segment, not two: `hair.colour`'s region never met the applied mask,
    // so this render has no evidence about it and files nothing.
    expect(cuts.map((cut) => cut.facet)).toEqual(["marks"]);
    /*
      AND IT IS NO LONGER SILENT ABOUT THE ONE IT DROPPED (#64 item 3).

      `hair` is 8 x 2 = 16 pixels of reading, every one of them outside the ask.
      Before this, the whole of that fact was a bare `continue`: the caller saw
      one cut and could not tell a facet that was dropped from one it had never
      been asked about.
    */
    expect(dropped).toEqual([
      { facet: "hair.colour", region: "hair", reason: "noGroundInTheAsk", lostPixels: 16, deliveredRead: false },
    ]);
    /* The filed cut lost ground too: face skin is rows 4..7 across the full
       width - 32 pixels - and the ask granted 8 of them. */
    expect({ kept: cuts[0].pixels, lost: cuts[0].lostPixels }).toEqual({ kept: 8, lost: 24 });
    expect(cuts[0].box).toEqual({ x: 2, y: 4, width: 4, height: 2 });
    expect(cuts[0].pixels).toBe(8);
    expect(cuts[0].frame).toEqual({ width: 8, height: 8 });
    // The crop is the DELIVERED pixels at that box, not the master's.
    expect(Array.from(cuts[0].content.data.subarray(0, 3))).toEqual([16, 32, 64]);
  });

  it("files two segments over shared ground — a stylist's freckles and cheekbones are different things", () => {
    const { cuts } = cutSegments({
      composite,
      applied,
      facetRegions: new Map([["marks", "face skin"], ["cheekbones", "face skin"]]),
      regionMasks: new Map([["face skin", mask(8, 8, () => true)]]),
    });

    /*
      Deliberate duplication. A shared row would make "take the freckles back"
      remove her cheekbones too — per-facet undo is the promised feature, and
      storage is rent rather than debt (ruled, fable-087).
    */
    expect(cuts.map((cut) => cut.facet).sort()).toEqual(["cheekbones", "marks"]);
    expect(cuts[0].box).toEqual(cuts[1].box);
  });

  it("files nothing for a facet whose region was never segmented", () => {
    const { cuts, dropped } = cutSegments({
      composite,
      applied,
      facetRegions: new Map([["nose", "nose"]]),
      regionMasks: new Map(),
    });
    // Not an empty segment: a promise of permanence over nothing is the
    // flattering direction, and the honest state is "no evidence here".
    expect(cuts).toEqual([]);
    /*
      AND THE TWO KINDS OF DROP ARE DIFFERENT THINGS, which is why the reason
      exists. Nothing was read here, so nothing was claimed and nothing was
      lost - a zero that is measured, rather than a zero standing in for "not
      measured". `regionNotSegmented` is what carries that difference.
    */
    expect(dropped).toEqual([
      { facet: "nose", region: "nose", reason: "regionNotSegmented", lostPixels: 0, deliveredRead: false },
    ]);
  });

  it("refuses a region mask that does not match the frame under test", () => {
    expect(() => cutSegments({
      composite,
      applied,
      facetRegions: new Map([["marks", "face skin"]]),
      regionMasks: new Map([["face skin", mask(4, 4, () => true)]]),
    })).toThrow(/does not match the composite/);
  });

  it("encodes the mask as one channel and the crop as a readable picture", async () => {
    const { cuts: [cut] } = cutSegments({
      composite,
      applied,
      facetRegions: new Map([["marks", "face skin"]]),
      regionMasks: new Map([["face skin", mask(8, 8, () => true)]]),
    });
    const encoded = await encodeCut(cut);

    // Read the bytes back rather than trusting the encoder: the crop must come
    // out at the box's size, with the delivered colour still in it.
    const decoded = await readRaster(encoded.content);
    expect({ width: decoded.width, height: decoded.height }).toEqual({ width: 4, height: 4 });
    expect(Array.from(decoded.data.subarray(0, 3))).toEqual([16, 16, 64]);
    expect(encoded.mask.length).toBeGreaterThan(0);
  });
});

/**
 * THE SILHOUETTE — cutting from where the thing NOW IS, not where it used to be.
 *
 * The founder's v#163 in miniature, and the shape is the whole argument. Her
 * master's hair is a bun at the crown; the hair she paid for hangs on her
 * shoulders; the paint was allowed to touch both. Master-anchored, the segment
 * keeps the bun and 90% of what she bought reverts on the next render.
 *
 * Every case here is driven in BOTH directions, because the failure this
 * machinery is most likely to have is a union that quietly does nothing.
 */
describe("delivered-anchored ground", () => {
  const composite = raster(8, 8, (x, y) => [x * 8, y * 8, 64]);
  /* The paint reached the crown AND the shoulders — 8 rows wide, rows 0..5. */
  const applied = mask(8, 8, (_x, y) => y < 6);
  /* Her master's hair: the bun, two rows at the crown. */
  const bun = mask(8, 8, (_x, y) => y < 2);
  /* The hair she was delivered: three rows over her shoulders. */
  const shoulders = mask(8, 8, (_x, y) => y >= 3 && y < 6);
  const facetRegions = new Map([["hairWorn", "hair"]]);
  const regionMasks = new Map([["hair", bun]]);

  const cutWith = (deliveredMasks?: ReadonlyMap<string, Mask> | null) => cutSegments({
    composite, applied, facetRegions, regionMasks, ...(deliveredMasks !== undefined ? { deliveredMasks } : {}),
  }).cuts;

  const dropsWith = (deliveredMasks?: ReadonlyMap<string, Mask> | null) => cutSegments({
    composite, applied, facetRegions, regionMasks, ...(deliveredMasks !== undefined ? { deliveredMasks } : {}),
  }).dropped;

  it("keeps only the vacated bun when nobody asks the delivered frame — the disease", () => {
    const [cut] = cutWith();
    /* 8 wide × 2 rows. Everything she actually bought is outside it. */
    expect(cut.pixels).toBe(16);
    expect(cut.box).toEqual({ x: 0, y: 0, width: 8, height: 2 });
    /* And the counts say the reading never happened, rather than saying zero. */
    expect(cut.deliveredRead).toBe(false);
    expect({ arrived: cut.arrivedPixels, departed: cut.departedPixels }).toEqual({ arrived: 0, departed: 0 });
  });

  it("keeps the bun AND the shoulders when it does — arrived and departed, counted apart", () => {
    const [cut] = cutWith(new Map([["hair", shoulders]]));
    /* The union: two rows of departed bun plus three rows of arrived hair. */
    expect(cut.pixels).toBe(40);
    expect(cut.box).toEqual({ x: 0, y: 0, width: 8, height: 6 });
    expect(cut.deliveredRead).toBe(true);
    expect({ arrived: cut.arrivedPixels, departed: cut.departedPixels }).toEqual({ arrived: 24, departed: 16 });
    /* 16 → 40 is the founder's 10% becoming the whole thing, on a toy face. */
    expect(cut.pixels).toBeGreaterThan(cutWith().at(0)!.pixels);
  });

  it("changes NOTHING when the delivered reading finds the thing where it always was", () => {
    /* The negative control the union needs. A `hair.colour` edit does not move
       the hair, so delivered == master, and a cut that grew here would be the
       union inventing ground rather than recovering it. */
    const same = cutWith(new Map([["hair", bun]]));
    const before = cutWith();
    expect(same[0].pixels).toBe(before[0].pixels);
    expect(same[0].box).toEqual(before[0].box);
    /* Nothing arrived and nothing departed: a recolour vacates no ground, which
       is the reading these two numbers exist to be able to say. */
    expect({ arrived: same[0].arrivedPixels, departed: same[0].departedPixels })
      .toEqual({ arrived: 0, departed: 0 });
  });

  it("changes NOTHING when the delivered reading finds nothing at all", () => {
    /* `absentIsAnswer` makes "nowhere" a legitimate answer — a removal, or a
       segmenter that cannot see a two-pixel wire. It must union to exactly the
       master's own ground rather than erasing it. */
    const [cut] = cutWith(new Map([["hair", mask(8, 8, () => false)]]));
    expect(cut.pixels).toBe(16);
    expect({ arrived: cut.arrivedPixels, departed: cut.departedPixels }).toEqual({ arrived: 0, departed: 16 });
    expect(cut.deliveredRead).toBe(true);
  });

  it("never opens a segment on a delivered reading alone — rule 2, at the gate", () => {
    /* The master read did not settle for this region. The delivered frame has
       an opinion; it is not allowed to be the thing that files a claim. */
    const { cuts, dropped } = cutSegments({
      composite,
      applied,
      facetRegions,
      regionMasks: new Map(),
      deliveredMasks: new Map([["hair", shoulders]]),
    });
    expect(cuts).toEqual([]);
    /* The drop row says the delivered frame DID have an opinion and the gate
       held anyway - the interesting half of rule 2, and until now the only
       record of it was the absence of a segment. */
    expect(dropped).toEqual([
      { facet: "hairWorn", region: "hair", reason: "regionNotSegmented", lostPixels: 0, deliveredRead: true },
    ]);
  });

  it("cannot claim ground the paint was never allowed to touch — rule 4's bound", () => {
    /* The segmenter has a bad day and calls her whole face hair. `applied` is
       the bound: nothing outside it can be owned, whatever the reading says. */
    const [cut] = cutWith(new Map([["hair", mask(8, 8, () => true)]]));
    expect(cut.pixels).toBe(48); // 8 × 6 — the applied region, and not one pixel more
    expect(cut.box.y + cut.box.height).toBe(6);
  });

  it("SAYS what the bound cost — the bad day is a number now, not an absence", () => {
    /*
      THE SAME BAD DAY, READ FROM THE OTHER END (#64 item 3).

      The arm above proves `applied` holds. What it cannot show - and what no
      kept artifact could show until this change - is that the reading asked for
      64 pixels and was granted 48. A cut reporting 48 is the identical row
      whether its reading claimed 48 or claimed the whole frame, and those are
      completely different events: the first is a clean edit, the second is a
      segmenter whose answer nobody can see was wrong.
    */
    const [cut] = cutWith(new Map([["hair", mask(8, 8, () => true)]]));
    expect({ kept: cut.pixels, lost: cut.lostPixels }).toEqual({ kept: 48, lost: 16 });

    /* THE CONTROL, and it is the one that matters: a reading that fits inside
       the ask loses nothing. Without it `lostPixels` could be any number at all
       - the region's whole size included - and the arm above would still pass. */
    const tidy = cutWith(new Map([["hair", mask(8, 8, (_x, y) => y >= 3 && y < 6)]]));
    expect({ kept: tidy[0].pixels, lost: tidy[0].lostPixels }).toEqual({ kept: 40, lost: 0 });
  });

  it("counts lost ground on the MASTER-anchored road too — the population that has it", () => {
    /*
      The union log is gated on `deliveredRead`, correctly: it answers what the
      delivered reading bought. Lost ground is gated on nothing, because every
      render this cutter has ever run intersects with `applied` - and the
      master-anchored ones are most of them. Gating this number the same way
      would have hidden it on exactly the population it describes.
    */
    const [cut] = cutWith();
    expect(cut.deliveredRead).toBe(false);
    /* Her bun is rows 0..1 across 8 - 16 pixels - and the paint reached all of
       it, so nothing was lost. */
    expect(cut.lostPixels).toBe(0);

    /* And with a bun the paint only half reached, the loss is readable without
       any delivered read existing at all. */
    const half = cutSegments({
      composite,
      applied: mask(8, 8, (x, y) => y < 6 && x < 4),
      facetRegions,
      regionMasks,
    });
    expect({ kept: half.cuts[0].pixels, lost: half.cuts[0].lostPixels }).toEqual({ kept: 8, lost: 8 });
    expect(half.cuts[0].deliveredRead).toBe(false);
  });

  it("drops a facet whose reading and whose ask never meet, and says what it cost", () => {
    /* `applied` is rows 0..5; put the whole hair reading below it. The facet
       was segmented and granted nothing - a different state from never having
       been segmented, and the two used to be the same bare `continue`. */
    const missed = cutSegments({
      composite,
      applied,
      facetRegions,
      regionMasks: new Map([["hair", mask(8, 8, (_x, y) => y >= 6)]]),
      deliveredMasks: new Map([["hair", mask(8, 8, (_x, y) => y >= 6)]]),
    });
    expect(missed.cuts).toEqual([]);
    expect(missed.dropped).toEqual([
      { facet: "hairWorn", region: "hair", reason: "noGroundInTheAsk", lostPixels: 16, deliveredRead: true },
    ]);
  });

  it("reports nothing dropped when every facet filed — silence is the healthy state", () => {
    /* The negative control for the drop list itself. A reader that returned a
       row on a clean render would make the log unreadable and, worse, would
       make a real drop invisible inside the noise. */
    expect(dropsWith(new Map([["hair", shoulders]]))).toEqual([]);
    expect(dropsWith()).toEqual([]);
  });

  it("refuses a delivered mask that does not match the frame under test", () => {
    expect(() => cutSegments({
      composite,
      applied,
      facetRegions,
      regionMasks,
      deliveredMasks: new Map([["hair", mask(4, 4, () => true)]]),
    })).toThrow(/delivered hair region does not match/);
  });
});
