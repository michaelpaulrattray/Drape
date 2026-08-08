import { describe, expect, it } from "vitest";
import sharp from "sharp";

import {
  MASKED_EDITING_SCOPE,
  additionDestination,
  hangsBelowAnchor,
  anyFacetMovesAnEdge,
  confusableNeighboursOf,
  fringeTableNames,
  harvestRefinement,
  hasFringeAtEdge,
  landmarkNameOf,
  maskedEditingEnabledFor,
  needsLandmarkDestination,
  regionNameOf,
  edgeTableNames,
  neighbourTableNames,
  segmentableRegionNames,
  vacancyOf,
  type RegionReader,
} from "./maskedRefine";
import { coverage } from "./maskGeometry";
import { allFacets, facetOfSubject } from "./refineFacets";
import { hasRegion } from "./zoneScope";
import type { Mask } from "./maskedComposite";

/**
 * The product-path seam, proved without a provider.
 *
 * The flag is dark, so the test that matters most is that the dark path is a
 * byte-for-byte passthrough — a deploy of this must change nothing at all.
 */

const W = 64;
const H = 64;

async function png(fill: (x: number, y: number) => [number, number, number]): Promise<Buffer> {
  const data = Buffer.allocUnsafe(W * H * 3);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const [r, g, b] = fill(x, y);
      const at = (y * W + x) * 3;
      data[at] = r; data[at + 1] = g; data[at + 2] = b;
    }
  }
  return sharp(data, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
}

const box = (x0: number, y0: number, x1: number, y1: number, fill = 255): Mask => {
  const data = Buffer.alloc(W * H, 0);
  for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) data[y * W + x] = fill;
  return { data, width: W, height: H };
};

const reader: RegionReader = {
  region: async () => box(20, 8, 44, 28),
  subject: async () => box(16, 6, 48, 60),
  landmark: async () => [{ x: 0.3, y: 0.45 }, { x: 0.7, y: 0.45 }],
};

describe("the scope is one account, and everyone else is on the old path", () => {
  it("is scoped to a named user, never to everyone", () => {
    /* A boolean would make "on for me" and "on for everyone" the same edit, and
       that is exactly the decision that deserves two. Same grammar and the same
       parser as CASTING_V2_SCOPE — a second scope grammar would be a mirror
       (law #4). Widening is a separate founder call. */
    expect(MASKED_EDITING_SCOPE).toMatch(/^(off|users:[1-9][0-9,]*)$/);
    expect(MASKED_EDITING_SCOPE, "never flipped straight to everyone").not.toBe("all");
  });

  it("leaves every other account exactly where it was", () => {
    /* The half that matters on a scoped flip: the blast radius is one id. */
    expect(maskedEditingEnabledFor(2)).toBe(false);
    expect(maskedEditingEnabledFor(999)).toBe(false);
    expect(maskedEditingEnabledFor(undefined), "and an unattributed render never opts in").toBe(false);
  });

  it("returns the engine's own bytes, byte for byte, for everyone off the scope", async () => {
    const master = await png(() => [190, 188, 186]);
    const painted = await png((x, y) => (y < 30 ? [40, 30, 25] : [12, 200, 40]));
    const result = await harvestRefinement({
      master: { bytes: master, contentType: "image/png" },
      painted: { bytes: painted, contentType: "image/png" },
      facets: ["hair.cut"],
      reader,
      userId: 2,
    });
    expect(result.outcome).toBe("flag-off");
    expect(Buffer.compare(result.bytes, painted), "not re-encoded, not touched").toBe(0);
    expect(result.contentType).toBe("image/png");
  });

  it("does not even consult the segmenter for an account off the scope", async () => {
    /* A dark path that still spends provider calls is not dark. */
    let calls = 0;
    const counting: RegionReader = {
      region: async () => { calls += 1; return box(20, 8, 44, 28); },
      subject: async () => { calls += 1; return box(16, 6, 48, 60); },
      landmark: async () => { calls += 1; return []; },
    };
    await harvestRefinement({
      master: { bytes: await png(() => [190, 188, 186]), contentType: "image/png" },
      painted: { bytes: await png(() => [40, 30, 25]), contentType: "image/png" },
      facets: ["hair.cut"],
      reader: counting,
      userId: 2,
    });
    expect(calls).toBe(0);
  });
});

describe("the segmentation question is named per facet, never invented", () => {
  it("gives every SEGMENTABLE facet a question to ask", () => {
    /* D-213: a segmenter is never asked an open question, so a facet whose
       region is read off her current picture must have a written prompt rather
       than a derived one. */
    const missing = allFacets().filter((facet) =>
      hasRegion(facet) && !needsLandmarkDestination(facet) && regionNameOf(facet) === null);
    expect(missing).toEqual([]);
  });

  it("gives ADDITIONS none, because the thing is not there to segment", () => {
    /* An earring's destination comes from a landmark and the described object's
       extent — segmenting the master for it would be asking where a thing is
       that nobody is wearing. */
    const additions = allFacets().filter(needsLandmarkDestination);
    expect(additions.sort()).toEqual(["ink", "statedAccessories"]);
    for (const facet of additions) expect(regionNameOf(facet)).toBeNull();
  });

  it("anchors an accessory on WHAT IT IS, not on which slot it landed in", () => {
    /* One facet covers earrings, glasses and piercings, and they do not share an
       anchor. Keying on the facet alone would put her spectacles on her
       earlobes — the audit's marks-versus-freckles finding, second sighting. */
    expect(landmarkNameOf("statedAccessories", "small gold hoops")).toBe("earlobe");
    expect(landmarkNameOf("statedAccessories", "round tortoiseshell glasses")).toBe("eye");
    expect(landmarkNameOf("statedAccessories", "a small nose stud")).toBe("nose");
  });

  it("refuses an accessory nobody has an anchor for, rather than guessing one", () => {
    expect(landmarkNameOf("statedAccessories", "an anklet")).toBeNull();
    expect(landmarkNameOf("statedAccessories", undefined)).toBeNull();
  });

  it("refuses ink, which has no facial landmark at all", () => {
    /* "Left forearm" is not a facial landmark, and inventing one would be a
       guess dressed as anatomy. */
    expect(landmarkNameOf("ink", "a sleeve")).toBeNull();
  });

  it("takes the LONGEST match, so a list's order cannot decide anatomy", () => {
    /* "a small nose stud" contains both "stud" and "nose stud". A first-match
       scan put it on her earlobe — an answer that depended on array order is a
       defect waiting for somebody to tidy the array. */
    expect(landmarkNameOf("statedAccessories", "a small nose stud")).toBe("nose");
    expect(landmarkNameOf("statedAccessories", "a small stud")).toBe("earlobe");
  });

  it("knows what hangs and what sits", () => {
    expect(hangsBelowAnchor("long drop earrings"), "a drop hangs").toBe(true);
    expect(hangsBelowAnchor("round glasses"), "glasses sit").toBe(false);
  });
});

describe("an addition is placed from landmarks, and scaled by her own face", () => {
  const at = (mask: Mask, x: number, y: number) => mask.data[y * W + x];

  it("builds one corridor per landmark — two ears, two questions", () => {
    const both = additionDestination({
      landmarks: [{ x: 0.25, y: 0.5 }, { x: 0.75, y: 0.5 }], width: W, height: H, dropSteps: 0,
    });
    expect(at(both, 16, 32), "her right lobe").toBeGreaterThan(0);
    expect(at(both, 48, 32), "her left lobe").toBeGreaterThan(0);
    expect(at(both, 32, 32), "and nothing in between").toBe(0);
  });

  it("hangs a drop below the anchor without widening it", () => {
    const stud = additionDestination({ landmarks: [{ x: 0.5, y: 0.3 }], width: W, height: H, dropSteps: 0 });
    const drop = additionDestination({ landmarks: [{ x: 0.5, y: 0.3 }], width: W, height: H, dropSteps: 6 });
    let studPx = 0; let dropPx = 0;
    for (let i = 0; i < stud.data.length; i += 1) { if (stud.data[i]) studPx += 1; if (drop.data[i]) dropPx += 1; }
    expect(dropPx, "a drop reaches further than a stud").toBeGreaterThan(studPx);
    expect(at(drop, 32, 30), "and still starts at the lobe").toBeGreaterThan(0);
  });

  it("takes its scale from the distance between the landmarks, not a constant", () => {
    /* A face filling the frame and one far away must get proportionate studs. */
    const near = additionDestination({
      landmarks: [{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }], width: W, height: H, dropSteps: 0,
    });
    const far = additionDestination({
      landmarks: [{ x: 0.45, y: 0.5 }, { x: 0.55, y: 0.5 }], width: W, height: H, dropSteps: 0,
    });
    let nearPx = 0; let farPx = 0;
    for (let i = 0; i < near.data.length; i += 1) { if (near.data[i]) nearPx += 1; if (far.data[i]) farPx += 1; }
    expect(nearPx, "a wider head gets larger studs").toBeGreaterThan(farPx);
  });

  it("refuses to place an addition with no landmark at all", () => {
    expect(() => additionDestination({ landmarks: [], width: W, height: H })).toThrow(/needs a landmark/);
  });

  it("gives the regionless facet none", () => {
    /* expression routes full-frame; a region prompt for it would be a lie. */
    expect(regionNameOf("expression")).toBeNull();
  });
});

/**
 * THE REVEAL — the harvest used to discard it, and a perfect render was undone.
 *
 * Proven on the founder's own specimen before any of this was written (exhibit
 * 32): asked to tie her hair up, the painter produced a clean updo with bare
 * shoulders, moving 19.2% and 18.1% of the two shoulder bands — and the
 * composite moved 0.0% of them, because the revealed shoulder is not "hair" and
 * nothing was harvested there. We charged for a render that was correct until we
 * composited it.
 *
 * These drive the arithmetic with masks rather than with a painter, because a
 * test of this that needs a real render to fire is a test of the render.
 */
describe("the reveal is harvested, and no instruction is ever classified", () => {
  const zone = box(0, 0, W, H);

  it("gives up territory the region has left — the shrink", async () => {
    /* Hair down to row 40; the painter puts it up and it stops at row 20. */
    const vacancy = await vacancyOf({
      zone, masterRegion: box(20, 8, 44, 40), paintedRegion: box(20, 8, 44, 20), tolerancePx: 0,
    });
    /* The band between them is the shoulder she got back. */
    expect(vacancy.data[30 * W + 32], "the revealed band is delivered from the painter").toBe(255);
    expect(vacancy.data[14 * W + 32], "the hair that is still hair is not vacated").toBe(0);
  });

  it("gives up the WHOLE region when the painter removed the thing", async () => {
    /* "Take her glasses off" — the segmenter finds none on the painted frame,
       and nothing found is the answer rather than a failure. */
    const vacancy = await vacancyOf({
      zone, masterRegion: box(20, 8, 44, 28), paintedRegion: box(0, 0, 0, 0), tolerancePx: 0,
    });
    expect(coverage(vacancy)).toBeGreaterThan(0);
    expect(vacancy.data[18 * W + 32], "the frames' own territory is given up whole").toBe(255);
  });

  /* --- the negative controls, so the term can be shown unable to fire --- */

  it("NEGATIVE CONTROL — a grow vacates nothing at all", async () => {
    /* The path a growth takes must be byte-for-byte the path it always took. */
    const vacancy = await vacancyOf({
      zone, masterRegion: box(20, 8, 44, 28), paintedRegion: box(12, 4, 52, 44), tolerancePx: 0,
    });
    expect(coverage(vacancy), "nothing was given up, so nothing is claimed").toBe(0);
  });

  it("NEGATIVE CONTROL — an unchanged silhouette vacates nothing", async () => {
    /* A pure recolour. Same outline on both frames. */
    const vacancy = await vacancyOf({
      zone, masterRegion: box(20, 8, 44, 28), paintedRegion: box(20, 8, 44, 28), tolerancePx: 0,
    });
    expect(coverage(vacancy)).toBe(0);
  });

  it("NEGATIVE CONTROL — a jittering segmenter vacates nothing", async () => {
    /*
      Two segmentations of the same face on two frames do not agree pixel for
      pixel. Without the tolerance every pixel they disagree on reads as vacated
      territory, and a recolour would ship slivers of painter-background along an
      unchanged hair edge.
    */
    const wobbled = await vacancyOf({
      zone, masterRegion: box(20, 8, 44, 28), paintedRegion: box(22, 10, 42, 26), tolerancePx: 8,
    });
    expect(coverage(wobbled), "a boundary that wobbles a few pixels gives up nothing").toBe(0);

    const withoutTolerance = await vacancyOf({
      zone, masterRegion: box(20, 8, 44, 28), paintedRegion: box(22, 10, 42, 26), tolerancePx: 0,
    });
    expect(coverage(withoutTolerance), "and the control proves the tolerance is what did it")
      .toBeGreaterThan(0);
  });

  it("NEGATIVE CONTROL — the tolerance cannot swallow a real reveal", async () => {
    /* The guard has to be shown to stop guarding somewhere, or it is a guard
       that would swallow the defect it was written beside. */
    const vacancy = await vacancyOf({
      zone, masterRegion: box(20, 8, 44, 40), paintedRegion: box(20, 8, 44, 20), tolerancePx: 8,
    });
    expect(coverage(vacancy), "a shoulder is orders of magnitude wider than the wobble")
      .toBeGreaterThan(0);
  });

  it("can never claim a pixel the zone does not already allow", async () => {
    /* The outer bound holds for this term exactly as it holds for the harvest —
       the reveal widens what is DELIVERED inside the zone, never the zone. */
    const vacancy = await vacancyOf({
      zone: box(20, 8, 44, 20),
      masterRegion: box(20, 8, 44, 40),
      paintedRegion: box(0, 0, 0, 0),
      tolerancePx: 0,
    });
    expect(vacancy.data[30 * W + 32], "outside the zone, nothing is claimed").toBe(0);
    expect(vacancy.data[14 * W + 32], "inside it, the reveal stands").toBe(255);
  });
});

/**
 * An accessory's harvest question comes from the INSTRUCTION, like its landmark.
 *
 * The second half of the same table, and it was missing: the harvest name fell
 * back to the literal string "earring" whenever no facet was segmentable, which
 * is every pure accessory edit. So an ask about GLASSES harvested wherever her
 * earrings were — the exact defect `landmarkNameOf` exists to prevent, one field
 * away in the same rows.
 */
describe("an accessory is harvested by what it IS", () => {
  /**
   * ONE ROW PER OBJECT TYPE, so no single case can ever be the only witness.
   *
   * The defect this matrix exists for is the placeholder-turned-load-bearing
   * class: the harvest name was a literal `"earring"` fallback, which was true
   * for the only case anyone had driven and silent about being scaffolding.
   * Earrings were the only witness, so earrings were the only thing that worked.
   */
  const OBJECTS = [
    { described: "small gold hoops", region: "earring", landmark: "earlobe" },
    { described: "thin wire glasses", region: "glasses", landmark: "eye" },
    { described: "a small nose stud", region: "nose stud", landmark: "nose" },
  ];

  const askedFor = async (described: string) => {
    const asked: string[] = [];
    const naming: RegionReader = {
      region: async ({ name }) => { asked.push(name); return box(20, 8, 44, 28); },
      subject: async () => box(16, 6, 48, 60),
      landmark: async () => [{ x: 0.3, y: 0.45 }, { x: 0.7, y: 0.45 }],
    };
    await harvestRefinement({
      master: { bytes: await png(() => [190, 188, 186]), contentType: "image/png" },
      painted: { bytes: await png((x, y) => (y < 30 ? [40, 30, 25] : [188, 186, 184])), contentType: "image/png" },
      facets: ["statedAccessories"],
      reader: naming,
      userId: 1,
      described,
    }).catch(() => undefined);
    return asked;
  };

  for (const object of OBJECTS) {
    it(`asks about ${object.region}, because that is what the instruction named`, async () => {
      const asked = await askedFor(object.described);
      expect(asked, `"${object.described}" is a question about ${object.region}`).toContain(object.region);
      for (const other of OBJECTS) {
        if (other.region === object.region) continue;
        expect(asked, `and never about ${other.region}`).not.toContain(other.region);
      }
    });

    it(`anchors ${object.region} on its own landmark`, () => {
      expect(landmarkNameOf("statedAccessories", object.described)).toBe(object.landmark);
    });
  }

  /*
    A REMOVAL DELETES ITS OWN FACET, so the record cannot name what left.

    This is the asymmetry against `52a22740`: a distributed shrink keeps its
    facet in `composed` (a shorter cut is still `hair.cut`), so the harvest is
    still asked where the hair is. An object removal prunes its own step —
    `facetsWrittenBy(composed)` stops naming `statedAccessories`, no question is
    asked at the eyes at all, and `outsideMaskUnchanged` then guarantees the
    master is kept exactly where the painter took the glasses off. The
    composite puts them back and she pays for the face she started with.

    So the removal event carries its own subject, and these prove it arrives.
  */
  it("asks about the DEPARTED thing when the record no longer names it", async () => {
    const asked: string[] = [];
    const naming: RegionReader = {
      region: async ({ name }) => { asked.push(name); return box(20, 8, 44, 28); },
      subject: async () => box(16, 6, 48, 60),
      landmark: async () => [{ x: 0.3, y: 0.45 }, { x: 0.7, y: 0.45 }],
    };
    await harvestRefinement({
      master: { bytes: await png(() => [190, 188, 186]), contentType: "image/png" },
      painted: { bytes: await png(() => [188, 186, 184]), contentType: "image/png" },
      /* The pruned record: the glasses step is gone, so no facet points at it. */
      facets: [],
      reader: naming,
      userId: 1,
      departed: "thin wire glasses",
    }).catch(() => undefined);
    expect(asked, "the thing that left is never asked about").toContain("glasses");
  });

  it("asks about the DEPARTED thing and not the SURVIVOR", async () => {
    /* The earlobe failure, precisely: a chain of earrings plus glasses minus
       the glasses leaves `described` holding the hoops, so keying the question
       off survivors sends the harvest to her earlobes to remove her
       spectacles. */
    const asked: string[] = [];
    const naming: RegionReader = {
      region: async ({ name }) => { asked.push(name); return box(20, 8, 44, 28); },
      subject: async () => box(16, 6, 48, 60),
      landmark: async () => [{ x: 0.3, y: 0.45 }, { x: 0.7, y: 0.45 }],
    };
    await harvestRefinement({
      master: { bytes: await png(() => [190, 188, 186]), contentType: "image/png" },
      painted: { bytes: await png(() => [188, 186, 184]), contentType: "image/png" },
      facets: ["statedAccessories"],
      reader: naming,
      userId: 1,
      described: "small gold hoops",
      departed: "thin wire glasses",
    }).catch(() => undefined);
    expect(asked, "the departed thing must be asked about").toContain("glasses");
    expect(asked, "and the surviving hoops keep their own question too").toContain("earring");
  });

  it("REFUSES a departed thing it has no row for, rather than guessing where it was", async () => {
    await expect(harvestRefinement({
      master: { bytes: await png(() => [190, 188, 186]), contentType: "image/png" },
      painted: { bytes: await png(() => [40, 30, 25]), contentType: "image/png" },
      facets: [],
      reader,
      userId: 1,
      departed: "a silver anklet",
    })).rejects.toThrow(/refusing to guess where it was/);
  });

  it("REFUSES ink by name rather than defaulting it into somebody else's row", async () => {
    /* "Left forearm" is not a facial landmark. The refusal is the feature — a
       default here would place a sleeve on her earlobe. */
    await expect(harvestRefinement({
      master: { bytes: await png(() => [190, 188, 186]), contentType: "image/png" },
      painted: { bytes: await png(() => [40, 30, 25]), contentType: "image/png" },
      facets: ["ink"],
      reader,
      userId: 1,
      described: "a sleeve on her left forearm",
    })).rejects.toThrow(/no landmark/);
  });

  it("REFUSES an object nobody has a row for, rather than picking the first one", async () => {
    await expect(harvestRefinement({
      master: { bytes: await png(() => [190, 188, 186]), contentType: "image/png" },
      painted: { bytes: await png(() => [40, 30, 25]), contentType: "image/png" },
      facets: ["statedAccessories"],
      reader,
      userId: 1,
      described: "a silver anklet",
    })).rejects.toThrow(/no landmark/);
  });
});

/**
 * NO QUIET DEFAULTS IN A DISPATCH OVER FACETS (founder rider, 2026-08-07).
 *
 * The zone builder was `isDistributed(facet) ? dilate(region, 48) : region` — a
 * five-valued scope table collapsed to a boolean, so three classes shared one
 * branch written for one of them. `allSkin` was the silent casualty.
 */
describe("every zone scope is handled by name, or refuses by name", () => {
  it("refuses a skin-spanning facet instead of quietly scoping it to her face", async () => {
    /* zoneScope.ts: "scoping a tan to the face manufactures a body mismatch".
       The adapter can only ask about "face skin", so it says so and refunds
       rather than delivering a face that does not match her neck. */
    await expect(harvestRefinement({
      master: { bytes: await png(() => [190, 188, 186]), contentType: "image/png" },
      painted: { bytes: await png(() => [150, 120, 95]), contentType: "image/png" },
      facets: ["skinTone"],
      reader,
      userId: 1,
    })).rejects.toThrow(/visible skin/);
  });

  it("still builds a zone for every scope class that IS implemented", async () => {
    /* The control: the refusal above must be about allSkin specifically, not a
       builder that refuses everything. */
    for (const facet of ["hair.cut", "eye.colour", "lips"] as const) {
      const result = await harvestRefinement({
        master: { bytes: await png(() => [190, 188, 186]), contentType: "image/png" },
        painted: { bytes: await png((x, y) => (y < 30 ? [40, 30, 25] : [188, 186, 184])), contentType: "image/png" },
        facets: [facet],
        reader,
        userId: 1,
      });
      expect(result.outcome, `${facet} composites`).toBe("composited");
    }
  });
});

/**
 * THE REVEAL, END TO END — asserted on the DELIVERED PIXELS, never on an
 * intermediate mask.
 *
 * The first version of this checked `explain.vacated` and **survived having the
 * whole vacancy term deleted**, because that intermediate is computed either
 * way. A test of a claim that never reaches the picture is the invoked-but-inert
 * class wearing a green tick. What the user gets is the composite, so that is
 * what is measured.
 */
describe("the reveal fires on a shrink and is structurally empty on a grow", () => {
  const HAIR: [number, number, number] = [40, 30, 25];
  const SHIRT: [number, number, number] = [190, 188, 186];
  /* The painter's reconstruction of the shirt — near hers, not identical, which
     is what a reconstruction actually is. */
  const PLATE: [number, number, number] = [176, 174, 172];
  const inBlock = (x: number, y: number, y1: number) => x >= 20 && x < 44 && y >= 8 && y < y1;

  const twoFrameReader = (masterBytes: Buffer, onMaster: Mask, onPainted: Mask): RegionReader => ({
    region: async ({ image }) => (Buffer.compare(image, masterBytes) === 0 ? onMaster : onPainted),
    subject: async () => box(0, 0, W, H),
    landmark: async () => [{ x: 0.3, y: 0.45 }, { x: 0.7, y: 0.45 }],
  });

  /** What the composite actually put at one pixel. */
  const pixelAt = async (bytes: Buffer, x: number, y: number) => {
    const { data } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const at = (y * W + x) * 3;
    return [data[at], data[at + 1], data[at + 2]] as [number, number, number];
  };

  it("DELIVERS the painter's plate where a shrinking region gave up its territory", async () => {
    /* Her hair runs to row 40; the painter puts it up and it stops at row 20.
       Rows 20-40 are the shoulder she got back. */
    const masterBytes = await png((x, y) => (inBlock(x, y, 40) ? HAIR : SHIRT));
    const paintedBytes = await png((x, y) => (inBlock(x, y, 20) ? HAIR : PLATE));
    const result = await harvestRefinement({
      master: { bytes: masterBytes, contentType: "image/png" },
      painted: { bytes: paintedBytes, contentType: "image/png" },
      facets: ["hairWorn"],
      reader: twoFrameReader(masterBytes, box(20, 8, 44, 40), box(20, 8, 44, 20)),
      userId: 1,
    });

    const revealed = await pixelAt(result.bytes, 32, 30);
    /* THE WHOLE POINT: before the fix this was her old hair, at full strength,
       on top of a render that had correctly taken it off. */
    expect(revealed[0], "the revealed shoulder is the painter's, not her old ponytail")
      .toBeGreaterThan(140);
    expect(Math.abs(revealed[0] - PLATE[0]), "and it is the plate, closely").toBeLessThan(20);
  });

  it("NEGATIVE CONTROL — a grow leaves her surface alone outside the harvest", async () => {
    /*
      The half that protects everything that already worked. The projection would
      otherwise fire on a growth — her shirt against a NEW head of hair projects
      onto (old hair - new hair) perfectly well — and hand the painter's frame to
      territory the harvest gate is meant to govern.

      Her hair runs to row 28; the painter gives her more, to row 44. Row 50 is
      shirt on BOTH frames and the painter repainted it, as painters do. It must
      still be hers.
    */
    const masterBytes = await png((x, y) => (inBlock(x, y, 28) ? HAIR : SHIRT));
    const paintedBytes = await png((x, y) => (x >= 12 && x < 52 && y >= 4 && y < 44 ? HAIR : PLATE));
    const result = await harvestRefinement({
      master: { bytes: masterBytes, contentType: "image/png" },
      painted: { bytes: paintedBytes, contentType: "image/png" },
      facets: ["hairWorn"],
      reader: twoFrameReader(masterBytes, box(20, 8, 44, 28), box(12, 4, 52, 44)),
      userId: 1,
      explain: true,
    });

    expect(coverage(result.explain!.vacated), "nothing was given up, so nothing is claimed").toBe(0);
    const untouched = await pixelAt(result.bytes, 32, 50);
    expect(untouched, "her repainted shirt below the new hair is still hers").toEqual(SHIRT);
  });

  it("leaves her surface alone when hair grows nearly her own colour", async () => {
    /*
      The projection divides by |old strand - painted|, so hair grown close to
      the colour she already had collapses that denominator and a faint
      alignment can scale to full alpha. This drives that case and asserts the
      outcome that matters — her shirt is still hers.

      **HONEST LIMIT ON THIS FIXTURE:** it does NOT demonstrate that the fence on
      the departed term is what prevents it. Removing the fence leaves this green,
      because at 64x64 the frame-fraction reaches collapse to about ten pixels and
      nothing is within range to leak. The fence is kept as reasoned insurance
      that costs the shrink nothing (measured: shoulder bands identical with and
      without it), not as a control this suite has driven red. Marked so nobody
      later reads a green tick here as evidence it was needed.
    */
    const masterBytes = await png((x, y) => (inBlock(x, y, 28) ? HAIR : SHIRT));
    const paintedBytes = await png((x, y) =>
      (x >= 12 && x < 52 && y >= 4 && y < 44 ? [34, 24, 19] : PLATE));
    const result = await harvestRefinement({
      master: { bytes: masterBytes, contentType: "image/png" },
      painted: { bytes: paintedBytes, contentType: "image/png" },
      facets: ["hairWorn"],
      reader: twoFrameReader(masterBytes, box(20, 8, 44, 28), box(12, 4, 52, 44)),
      userId: 1,
      explain: true,
    });
    expect(coverage(result.explain!.vacated), "a growth gives up nothing").toBe(0);
    const shirt = await pixelAt(result.bytes, 32, 55);
    expect(shirt, "and her shirt well below the new hair is untouched").toEqual(SHIRT);
  });

  it("keeps its working to itself unless a fixture asks for it", async () => {
    const masterBytes = await png(() => SHIRT);
    const result = await harvestRefinement({
      master: { bytes: masterBytes, contentType: "image/png" },
      painted: { bytes: await png((x, y) => (y < 20 ? HAIR : PLATE)), contentType: "image/png" },
      facets: ["hairWorn"],
      reader,
      userId: 1,
    });
    expect(result.explain, "the product path allocates none of it").toBeUndefined();
  });
});

/**
 * WHAT THE MASK GUARDS ACTUALLY COVER ON THIS PATH — pinned so the gap between
 * the specification and the code cannot go quiet again.
 *
 * `requestMatte` in maskGeometry describes itself as the one way to get a mask
 * from a model, with every guard in the contract rather than in the callers. It
 * has no production call site. These say which of its guarantees are real here.
 */
describe("the mask guards that are actually invoked", () => {
  const masterPng = () => png(() => [190, 188, 186]);
  const paintedPng = () => png((x, y) => (y < 20 ? [40, 30, 25] : [186, 184, 182]));

  it("refuses a mask whose bytes do not match its own dimensions", async () => {
    /* A row-misaligned mask silently shifts every index downstream. The
       composite would still produce bytes and still "verify" against its own
       wrong mask — the picture is the only thing that would know. */
    const malformed: RegionReader = {
      region: async () => ({ data: Buffer.alloc(W * H * 3, 255), width: W, height: H }),
      subject: async () => box(0, 0, W, H),
      landmark: async () => [{ x: 0.3, y: 0.45 }],
    };
    await expect(harvestRefinement({
      master: { bytes: await masterPng(), contentType: "image/png" },
      painted: { bytes: await paintedPng(), contentType: "image/png" },
      facets: ["hair.cut"],
      reader: malformed,
      userId: 1,
    })).rejects.toThrow(/not single-channel/);
  });

  it("KNOWN GAP, NAMED — nothing gates the question before it is asked (D-213)", async () => {
    /*
      An ADD of an absent distributed facet segments a thing that is not there.
      "Give him a beard" on a clean-shaven man asks a segmenter where his facial
      hair is, and a SAM-class model answers that question confidently rather
      than emptily — which is precisely the phantom `requestMatte.present` was
      written to prevent, on a path that never calls it.

      The harvest narrows the gap without closing it: when the phantom lands
      somewhere the painter drew nothing, the empty harvest refuses and the user
      is refunded. That is NOT the dangerous case. The dangerous one is when the
      painter DOES draw the beard it was asked for — then the phantom zone and
      the paint agree, and an edit lands wherever a segmenter guessed a beard
      would be on a face that has none.

      This test asserts the CURRENT behaviour, not the desired one, so that the
      day someone closes the gap this goes red and has to be updated deliberately.
      It is a marker, not an endorsement.
     */
    const phantom: RegionReader = {
      /* A confident blob for a beard that does not exist. */
      region: async () => box(24, 40, 40, 52),
      subject: async () => box(0, 0, W, H),
      landmark: async () => [{ x: 0.3, y: 0.45 }],
    };
    const result = await harvestRefinement({
      master: { bytes: await masterPng(), contentType: "image/png" },
      /* The painter drew the beard it was asked for, at the guessed place. */
      painted: {
        bytes: await png((x, y) => (x >= 24 && x < 40 && y >= 40 && y < 52 ? [50, 40, 34] : [186, 184, 182])),
        contentType: "image/png",
      },
      facets: ["facialHair"],
      reader: phantom,
      userId: 1,
    });
    expect(result.outcome, "today it composites on the phantom — the record is never consulted")
      .toBe("composited");
  });
});

/**
 * A COMPOUND OVER TWO REGIONS IS HARVESTED, ONE REGION AT A TIME.
 *
 * My first answer to `harvestName = names[0]` was to refuse compounds. That was
 * wrong, and wrong in the way that would have shown up only in the founder's
 * hands: refinements are BASE-ANCHORED, so the master is the ORIGINAL and the
 * painted frame carries every composed instruction. By the second step of any
 * chain the edit spans two regions — freckles, then fox eyes — and a refusal
 * there refuses the walk. Nothing in the suite drove a chain through this
 * function, so nothing would have caught it.
 */
describe("every region the instruction touches is harvested, not just the first", () => {
  const HAIR: [number, number, number] = [40, 30, 25];
  const SKIN: [number, number, number] = [190, 188, 186];
  const LIP: [number, number, number] = [150, 90, 90];

  /* Two regions in two places, answered per name and per frame. */
  const twoRegionReader = (masterBytes: Buffer): RegionReader => ({
    region: async ({ name }) => (name === "lips" ? box(26, 40, 40, 48) : box(20, 4, 44, 24)),
    subject: async () => box(0, 0, W, H),
    landmark: async () => [{ x: 0.3, y: 0.45 }, { x: 0.7, y: 0.45 }],
  });

  const pixelAt = async (bytes: Buffer, x: number, y: number) => {
    const { data } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const at = (y * W + x) * 3;
    return [data[at], data[at + 1], data[at + 2]] as [number, number, number];
  };

  it("DELIVERS BOTH — a chain spanning two regions composites, never refuses", async () => {
    const masterBytes = await png((x, y) => {
      if (x >= 20 && x < 44 && y >= 4 && y < 24) return HAIR;
      if (x >= 26 && x < 40 && y >= 40 && y < 48) return LIP;
      return SKIN;
    });
    /* The painter changed BOTH: paler hair and a darker lip. */
    const paintedBytes = await png((x, y) => {
      if (x >= 20 && x < 44 && y >= 4 && y < 24) return [120, 100, 80];
      if (x >= 26 && x < 40 && y >= 40 && y < 48) return [90, 40, 45];
      return SKIN;
    });
    const result = await harvestRefinement({
      master: { bytes: masterBytes, contentType: "image/png" },
      painted: { bytes: paintedBytes, contentType: "image/png" },
      facets: ["hair.colour", "lips"],
      reader: twoRegionReader(masterBytes),
      userId: 1,
    });
    expect(result.outcome).toBe("composited");

    const hair = await pixelAt(result.bytes, 32, 14);
    const lip = await pixelAt(result.bytes, 32, 44);
    expect(hair[0], "the hair edit landed").toBeGreaterThan(HAIR[0] + 20);
    /* THE ONE THAT USED TO BE DROPPED: the second region of the compound. */
    expect(lip[0], "and so did the lip edit, which names[0] discarded")
      .toBeLessThan(LIP[0] - 20);
  });

  it("asks each distinct question once, and both of them", async () => {
    const asked: string[] = [];
    const counting: RegionReader = {
      region: async ({ name, image }) => {
        asked.push(name);
        return name === "lips" ? box(26, 40, 40, 48) : box(20, 4, 44, 24);
      },
      subject: async () => box(0, 0, W, H),
      landmark: async () => [{ x: 0.3, y: 0.45 }],
    };
    const masterBytes = await png(() => SKIN);
    await harvestRefinement({
      master: { bytes: masterBytes, contentType: "image/png" },
      painted: { bytes: await png((x, y) => (y < 24 ? HAIR : SKIN)), contentType: "image/png" },
      /* Three facets, TWO questions — a cut and a colour both segment hair. */
      facets: ["hair.cut", "hair.colour", "lips"],
      reader: counting,
      userId: 1,
    }).catch(() => undefined);
    /*
      The HARVEST's questions are deduped — a cut and a colour both segment
      hair, and that is one call, which is what this test was written for.

      "facial hair" is also in the list now and is NOT a harvest question: it is
      the territory rule protecting the lips' confusable neighbour, and it is
      asked of the MASTER only. Asserted as a superset rather than an equality
      so the dedup claim keeps its teeth while the protection reads stay
      visible rather than silently widening an equality nobody re-reads.
    */
    expect(new Set(asked), "both harvest questions asked").toEqual(
      new Set(["hair", "lips", "facial hair"]),
    );
    /* ONCE PER FRAME, not once per facet — the memo's actual claim. A cut and a
       colour both segment hair, so without it this would be four calls. */
    expect(asked.filter((name) => name === "hair").length, "hair asked once per frame")
      .toBe(2);
  });
});

/**
 * FRINGE IS A PROPERTY OF THE MATERIAL, AND SKIN HAS NONE.
 *
 * Run-6's torn render: "give her freckles" was delivered, charged 25, and
 * scored `delivered_compliant` with a hard-edged slab of background punched
 * through her hair. `differenceMatte` recovers a strand as the projection of
 * `(patch − master)` onto `(strand − master)`, and for a `marks` edit the
 * confirmed content is FACE SKIN — so the reference is her skin, and *dark hair
 * → pale background* is nearly parallel to *dark hair → skin*.
 *
 * Measured on the production pixels: alpha 0.730 at the notch, 0.490 at the
 * wash, 0.000 at both untouched controls.
 */
describe("a harvest only reaches past its boundary where the material has fringe", () => {
  it("declares every region it can be asked about — no silent default", () => {
    /* The reverse direction, closed. This file already carries the scar of the
       other approach: a `names[0]` harvest and a literal "earring" fallback,
       both correct for the only case anyone had driven. */
    expect(fringeTableNames()).toEqual(expect.arrayContaining(segmentableRegionNames()));
    for (const name of segmentableRegionNames()) {
      expect(fringeTableNames(), `region "${name}" has no fringe declaration`).toContain(name);
    }
  });

  it("gives hair its fringe and skin none — the two the tear turns on", () => {
    expect(hasFringeAtEdge("hair")).toBe(true);
    expect(hasFringeAtEdge("face skin")).toBe(false);
  });

  it("refuses fringe to a region nobody has considered", () => {
    /* Guessing yes produces the torn frame; guessing no produces a slightly
       tight boundary. The default resolves the way that does not tear. */
    expect(hasFringeAtEdge("shoulder blade")).toBe(false);
  });

  it("does not claim the painter's drift outside a skin harvest — the notch, in miniature", async () => {
    /* Her master: dark hair on the left half, skin on the right. The painter
       returns the same face with the hair edge moved — pale where hair was.
       The harvest is her skin, and the drift lies outside it. */
    const HAIR_EDGE = 24;
    const SKIN: [number, number, number] = [210, 164, 147];
    const HAIR: [number, number, number] = [8, 6, 6];
    const masterBytes = await png((x) => (x < HAIR_EDGE ? HAIR : SKIN));
    const paintedBytes = await png((x, y) => {
      /* The hair edge has drifted eight pixels left — pale where hair was. */
      if (x < HAIR_EDGE - 8) return HAIR;
      /* And she has been freckled, which is the edit that was actually asked
         for: without a real change inside the harvest the gate refuses the
         whole render and this test would pass for the wrong reason. */
      if (x >= 32 && x < 60 && y >= 8 && y < 56 && (x + y) % 3 === 0) return [150, 110, 95];
      return SKIN;
    });

    const skinOnly: RegionReader = {
      /* "face skin" on both frames: the right half, well clear of the drift. */
      region: async () => box(32, 8, 60, 56),
      subject: async () => box(0, 0, 64, 64),
      landmark: async () => [{ x: 0.3, y: 0.45 }, { x: 0.7, y: 0.45 }],
    };

    const composed = await harvestRefinement({
      master: { bytes: masterBytes, contentType: "image/png" },
      painted: { bytes: paintedBytes, contentType: "image/png" },
      facets: [facetOfSubject("marks")],
      reader: skinOnly,
      userId: 1,
      described: "freckles",
      explain: true,
    });

    /* The drifted band is at x in [16, 24). Nothing there may be claimed: the
       instruction was about her skin, and her hair is not its business. */
    const applied = composed.explain!.applied;
    let claimedInDrift = 0;
    for (let y = 0; y < H; y += 1) {
      for (let x = HAIR_EDGE - 8; x < HAIR_EDGE; x += 1) {
        if (applied.data[y * W + x]! > 0) claimedInDrift += 1;
      }
    }
    expect(claimedInDrift).toBe(0);
  });
});

/**
 * THE TERRITORY RULE, AND THE THREE EDITS IT MUST NOT BREAK.
 *
 * `FRINGE_AT_EDGE` took run-6's left notch down 67% and left both tears alive.
 * The remainder is the harvest itself: once the painter moved her hair, a
 * segmenter asked "where is her face skin" on THAT frame answers with pixels
 * the master has hair in. So the rule is about the outcome — a harvest may not
 * deliver a pixel that on the MASTER belongs to a confusable neighbour this
 * edit never named.
 *
 * Subtracting territory is also how you rebuild "the composite puts them back",
 * which is the defect this whole workstream exists downstream of. Three edits
 * legitimately deliver onto a neighbour's master ground, and each has a control
 * here: a REMOVAL (the arms cross her temples), a SHRINK (the reveal was hair),
 * and an ADDITION (whose master extent is empty by definition, so only its
 * destination corridor can own the ground).
 */
describe("territory it was never asked about is given back to her master", () => {
  const HAIR_T: [number, number, number] = [20, 16, 14];
  const SKIN_T: [number, number, number] = [205, 165, 150];
  const PALE: [number, number, number] = [200, 198, 200];

  /* Her hair is the left column; her face skin is the right block. */
  const hairBox = () => box(0, 0, 26, 64);
  const skinBox = () => box(34, 10, 60, 54);

  it("declares a neighbour list for every region it can be asked about", () => {
    for (const name of segmentableRegionNames()) {
      expect(neighbourTableNames(), `region "${name}" has no neighbour declaration`).toContain(name);
    }
  });

  it("names hair as the aggressor and never as the victim", () => {
    /* The finding, pinned: hair is the only region that moves a large
       silhouette across everything else. If a future edit gives hair a
       protector, that is a decision someone should have to make on purpose. */
    expect(confusableNeighboursOf("hair")).toEqual([]);
    expect(confusableNeighboursOf("face skin")).toContain("hair");
  });

  it("CONTROL 1 — a skin edit does not deliver onto master hair", async () => {
    const masterBytes = await png((x) => (x < 26 ? HAIR_T : SKIN_T));
    /* The painter freckled her AND moved the hair edge left, exposing pale. */
    const paintedBytes = await png((x, y) => {
      if (x < 18) return HAIR_T;
      if (x < 26) return PALE;
      if (x >= 34 && x < 60 && y >= 10 && y < 54 && (x + y) % 3 === 0) return [150, 110, 95];
      return SKIN_T;
    });
    const reader: RegionReader = {
      /* The painted frame's "face skin" now reaches into master-hair ground —
         which is exactly what run-6's segmenter did. */
      region: async ({ image, name }) => {
        if (name === "hair") return hairBox();
        return Buffer.compare(image, masterBytes) === 0 ? skinBox() : box(18, 10, 60, 54);
      },
      subject: async () => box(0, 0, W, H),
      landmark: async () => [{ x: 0.3, y: 0.45 }, { x: 0.7, y: 0.45 }],
    };
    const result = await harvestRefinement({
      master: { bytes: masterBytes, contentType: "image/png" },
      painted: { bytes: paintedBytes, contentType: "image/png" },
      facets: [facetOfSubject("marks")],
      reader,
      userId: 1,
      described: "freckles",
      explain: true,
    });
    /* Nothing delivered over her hair; the freckles still land. */
    const delivered = result.explain!.delivered;
    let onHair = 0;
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < 26; x += 1) if (delivered.data[y * W + x]! > 0) onHair += 1;
    }
    expect(onHair, "her hair is not this edit's to change").toBe(0);
    expect(coverage(delivered), "and the freckles still arrive").toBeGreaterThan(0);
  });

  it("CONTROL 2 — a removal's reveal still lands on hair it overlaps", async () => {
    /* Glasses on the master, arms crossing her hair at the temples. The
       painter took them off, so the reveal is skin and hair where they were —
       ON protected ground, and it must survive. */
    const armBox = { x0: 10, y0: 28, x1: 56, y1: 34 };
    const masterBytes = await png((x, y) => {
      if (x >= armBox.x0 && x < armBox.x1 && y >= armBox.y0 && y < armBox.y1) return [15, 15, 20];
      return x < 26 ? HAIR_T : SKIN_T;
    });
    const paintedBytes = await png((x) => (x < 26 ? HAIR_T : SKIN_T));
    const reader: RegionReader = {
      region: async ({ name }) => {
        if (name === "hair") return hairBox();
        if (name === "glasses") return box(armBox.x0, armBox.y0, armBox.x1, armBox.y1);
        return skinBox();
      },
      subject: async () => box(0, 0, W, H),
      landmark: async () => [{ x: 0.3, y: 0.48 }, { x: 0.7, y: 0.48 }],
    };
    const result = await harvestRefinement({
      master: { bytes: masterBytes, contentType: "image/png" },
      painted: { bytes: paintedBytes, contentType: "image/png" },
      facets: [facetOfSubject("statedAccessories")],
      reader,
      userId: 1,
      described: "glasses",
      departed: "glasses",
      explain: true,
    });
    /* The arm's own footprint over her hair: x in [10, 26). The reveal must
       reach it, or the composite puts the glasses back — the exact defect. */
    const delivered = result.explain!.delivered;
    let revealedOverHair = 0;
    for (let y = armBox.y0; y < armBox.y1; y += 1) {
      for (let x = armBox.x0; x < 26; x += 1) if (delivered.data[y * W + x]! > 0) revealedOverHair += 1;
    }
    expect(revealedOverHair, "the removal owns the ground its object sits on").toBeGreaterThan(0);
  });

  it("CONTROL 3 — a hair shrink's reveal is untouched", async () => {
    /* Hair is the named region, so its own extent is owned outright and it has
       no protector anyway. The ponytail exhibit, in miniature. */
    const masterBytes = await png((x) => (x < 40 ? HAIR_T : PALE));
    const paintedBytes = await png((x) => (x < 20 ? HAIR_T : PALE));
    const reader: RegionReader = {
      region: async ({ image }) => (Buffer.compare(image, masterBytes) === 0
        ? box(0, 0, 40, 64)
        : box(0, 0, 20, 64)),
      subject: async () => box(0, 0, W, H),
      landmark: async () => [{ x: 0.3, y: 0.45 }],
    };
    const result = await harvestRefinement({
      master: { bytes: masterBytes, contentType: "image/png" },
      painted: { bytes: paintedBytes, contentType: "image/png" },
      facets: [facetOfSubject("hairWorn")],
      reader,
      userId: 1,
      described: "tied back",
      explain: true,
    });
    /* The vacated band x in [20, 40) is the reveal and must be delivered. */
    const delivered = result.explain!.delivered;
    let revealed = 0;
    for (let y = 0; y < H; y += 1) {
      for (let x = 20; x < 40; x += 1) if (delivered.data[y * W + x]! > 0) revealed += 1;
    }
    expect(revealed, "the shrink's reveal is its own ground").toBeGreaterThan(0);
  });

  it("CONTROL 4 — an ADDITION owns the ground its destination corridor covers", async () => {
    /*
      Fable's trap: an addition has NO master extent to own, so without the
      destination exemption "round wire-frame glasses" delivers arms sheared off
      wherever they cross her hair, after a perfect paint. The Tier A catalogue
      asks for exactly that.

      **The artifice here is deliberate and it is the only way to see the
      exemption at all.** For every accessory the protected neighbour is `hair`,
      and hair ALREADY occludes accessories by design — the depth stack rides it
      as `occludedBy` so an earring under her hair renders behind it. So on the
      ordinary path the arms over hair are absent for a reason that has nothing
      to do with this rule, and a test that just looks at them passes whatever
      the rule does.

      This reader therefore answers the OCCLUSION lookup with nothing and the
      PROTECTION lookup with her real hair — they are distinguishable because
      the protection read asks with `absentIsAnswer`. That isolates the one
      question worth asking: with occlusion out of the way, does the territory
      rule clip the addition? It must not.
    */
    const masterBytes = await png((x) => (x < 26 ? HAIR_T : SKIN_T));
    const paintedBytes = await png((x, y) => {
      if (y >= 28 && y < 34) return [15, 15, 20];
      return x < 26 ? HAIR_T : SKIN_T;
    });
    const reader: RegionReader = {
      region: async ({ name, image, absentIsAnswer }) => {
        if (name === "hair") return absentIsAnswer ? hairBox() : box(0, 0, 0, 0);
        if (name === "glasses") {
          return Buffer.compare(image, masterBytes) === 0 ? box(0, 0, 0, 0) : box(10, 28, 56, 34);
        }
        return skinBox();
      },
      subject: async () => box(0, 0, W, H),
      landmark: async () => [{ x: 0.25, y: 0.48 }, { x: 0.75, y: 0.48 }],
    };
    const result = await harvestRefinement({
      master: { bytes: masterBytes, contentType: "image/png" },
      painted: { bytes: paintedBytes, contentType: "image/png" },
      facets: [facetOfSubject("statedAccessories")],
      reader,
      userId: 1,
      described: "round wire-frame glasses",
      explain: true,
    });
    /* Her temples, inside the destination corridor and inside protected hair. */
    const delivered = result.explain!.delivered;
    let armOverHair = 0;
    for (let y = 28; y < 34; y += 1) {
      for (let x = 10; x < 26; x += 1) if (delivered.data[y * W + x]! > 0) armOverHair += 1;
    }
    expect(armOverHair, "the arms reach the temples they were painted on").toBeGreaterThan(0);
  });
});

/**
 * A REVEAL ONLY EXISTS WHERE SOMETHING CAN LEAVE.
 *
 * With the strand projection scoped and the territory rule in place, run-6's
 * left notch fell 90% and the right phantom did not move at all. Per-mask
 * attribution on the replay named it: `vacated` was zero everywhere and
 * `departed` claimed 7,955 px of that band — the reversed projection, reach
 * 160px, run for every question including a freckle instruction.
 */
describe("only an edit that can move an edge may claim a reveal", () => {
  const HAIR_E: [number, number, number] = [20, 16, 14];
  const SKIN_E: [number, number, number] = [205, 165, 150];
  const PALE_E: [number, number, number] = [200, 198, 200];

  it("declares every facet, so a new one cannot inherit a reveal by silence", () => {
    for (const facet of allFacets()) {
      expect(edgeTableNames(), `facet "${facet}" has no edge declaration`).toContain(facet);
    }
  });

  it("separates a surface repaint from a silhouette change", () => {
    expect(anyFacetMovesAnEdge([facetOfSubject("marks")]), "freckles do not remove skin").toBe(false);
    expect(anyFacetMovesAnEdge([facetOfSubject("skinTone")])).toBe(false);
    expect(anyFacetMovesAnEdge(["makeup"])).toBe(false);
    expect(anyFacetMovesAnEdge([facetOfSubject("hairWorn")]), "the shrink it was built for").toBe(true);
    expect(anyFacetMovesAnEdge([facetOfSubject("statedAccessories")])).toBe(true);
  });

  it("does not disagree with itself on a compound — one mover is enough", () => {
    expect(anyFacetMovesAnEdge([facetOfSubject("marks"), facetOfSubject("hairWorn")])).toBe(true);
  });

  it("holds a hair COLOUR to no reveal, where the amplitude table calls it REPLACEMENT", () => {
    /* The two tables genuinely disagree here, which is why this one exists
       rather than reusing the amplitude record's SURFACE band: every strand
       pixel moves, and the silhouette does not. */
    expect(anyFacetMovesAnEdge([facetOfSubject("hairShade")])).toBe(false);
  });

  it("claims no reveal on a surface edit — the right phantom, in miniature", async () => {
    /* Her hair is the left column. The painter drifted it RIGHT, putting hair
       where the master has skin: exactly the phantom's geometry. */
    const masterBytes = await png((x) => (x < 20 ? HAIR_E : SKIN_E));
    const paintedBytes = await png((x, y) => {
      if (x < 40) return HAIR_E;
      if (x >= 44 && x < 62 && y >= 10 && y < 54 && (x + y) % 3 === 0) return [150, 110, 95];
      return SKIN_E;
    });
    const reader: RegionReader = {
      /*
        A REALISTIC SEGMENTER, on purpose. Asked for "face skin" on the PAINTED
        frame it answers x >= 30, because the painter put hair over x in
        [20, 30) and a segmenter does not call hair skin. That isolates the one
        question this test is about: with the harvest behaving correctly, can
        the REVEAL path still deliver the painter's hair onto her neck?

        (A segmenter that widens into moved hair is a different defect and has
        its own control, one describe up — that is the territory rule's.)
      */
      region: async ({ name, image }) => {
        if (name === "hair") return box(0, 0, 20, 64);
        return Buffer.compare(image, masterBytes) === 0 ? box(20, 6, 62, 58) : box(40, 6, 62, 58);
      },
      subject: async () => box(0, 0, W, H),
      landmark: async () => [{ x: 0.3, y: 0.45 }, { x: 0.7, y: 0.45 }],
    };
    const result = await harvestRefinement({
      master: { bytes: masterBytes, contentType: "image/png" },
      painted: { bytes: paintedBytes, contentType: "image/png" },
      facets: [facetOfSubject("marks")],
      reader,
      userId: 1,
      described: "freckles",
      explain: true,
    });
    expect(coverage(result.explain!.vacated), "a freckle vacates nothing").toBe(0);
    expect(coverage(result.explain!.departed), "and nothing departed her face").toBe(0);
    /*
      The band x in [20, 30) is master-skin the painter covered with hair, and
      it is measured a clear TEN pixels inside the painted skin boundary at 40
      — because `harvestMatteFrom` tapers its own edge by 8px, and a band drawn
      inside that taper would be measuring the feather rather than the phantom.
      The first version of this test asserted over a 10px band whose far edge WAS
      the boundary, and could not have passed however correct the fix.
    */
    const delivered = result.explain!.delivered;
    let phantom = 0;
    for (let y = 0; y < H; y += 1) {
      for (let x = 20; x < 30; x += 1) if (delivered.data[y * W + x]! > 0) phantom += 1;
    }
    expect(phantom, "the painter's hair does not arrive on her neck").toBe(0);
  });

  it("still reveals for a REMOVAL whose facets were all pruned away", async () => {
    /* A removal can be the whole instruction, leaving `facets` empty — the case
       that once threw "no facets to mask" and refunded a perfect render. A
       departure is a reveal by definition, whatever the facet list says. */
    const glasses = { x0: 12, y0: 28, x1: 52, y1: 34 };
    const masterBytes = await png((x, y) => {
      if (x >= glasses.x0 && x < glasses.x1 && y >= glasses.y0 && y < glasses.y1) return [15, 15, 20];
      return SKIN_E;
    });
    const paintedBytes = await png(() => SKIN_E);
    const reader: RegionReader = {
      region: async ({ name }) => (name === "glasses"
        ? box(glasses.x0, glasses.y0, glasses.x1, glasses.y1)
        : box(0, 0, 0, 0)),
      subject: async () => box(0, 0, W, H),
      landmark: async () => [{ x: 0.3, y: 0.48 }, { x: 0.7, y: 0.48 }],
    };
    const result = await harvestRefinement({
      master: { bytes: masterBytes, contentType: "image/png" },
      painted: { bytes: paintedBytes, contentType: "image/png" },
      facets: [],
      reader,
      userId: 1,
      departed: "glasses",
      explain: true,
    });
    expect(coverage(result.explain!.delivered), "the frames still come off").toBeGreaterThan(0);
  });

  it("still reveals for a hair shrink — the ponytail exhibit", async () => {
    const masterBytes = await png((x) => (x < 40 ? HAIR_E : PALE_E));
    const paintedBytes = await png((x) => (x < 20 ? HAIR_E : PALE_E));
    const reader: RegionReader = {
      region: async ({ image }) => (Buffer.compare(image, masterBytes) === 0
        ? box(0, 0, 40, 64)
        : box(0, 0, 20, 64)),
      subject: async () => box(0, 0, W, H),
      landmark: async () => [{ x: 0.3, y: 0.45 }],
    };
    const result = await harvestRefinement({
      master: { bytes: masterBytes, contentType: "image/png" },
      painted: { bytes: paintedBytes, contentType: "image/png" },
      facets: [facetOfSubject("hairWorn")],
      reader,
      userId: 1,
      described: "tied back",
      explain: true,
    });
    let revealed = 0;
    const delivered = result.explain!.delivered;
    for (let y = 0; y < H; y += 1) {
      for (let x = 20; x < 40; x += 1) if (delivered.data[y * W + x]! > 0) revealed += 1;
    }
    expect(revealed, "the shrink still reveals what was behind her hair").toBeGreaterThan(0);
  });
});
