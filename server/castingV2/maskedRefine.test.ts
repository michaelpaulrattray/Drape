import { describe, expect, it } from "vitest";
import sharp from "sharp";

import {
  MASKED_EDITING_SCOPE,
  additionDestination,
  hangsBelowAnchor,
  harvestRefinement,
  landmarkNameOf,
  maskedEditingEnabledFor,
  needsLandmarkDestination,
  regionNameOf,
  type RegionReader,
} from "./maskedRefine";
import { allFacets } from "./refineFacets";
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

describe("the flag is dark, and dark means nothing happens", () => {
  it("ships off", () => {
    expect(MASKED_EDITING_SCOPE, "a deploy of this must change nothing").toBe("off");
  });

  it("is a SCOPE, so the first flip can go to one account", () => {
    /* A boolean would make "on for me" and "on for everyone" the same edit, and
       that is exactly the decision that deserves two. Same grammar as
       CASTING_V2_SCOPE — a second scope parser would be a mirror (law #4). */
    expect(maskedEditingEnabledFor(1), "off means off for everyone").toBe(false);
    expect(maskedEditingEnabledFor(undefined)).toBe(false);
  });

  it("returns the engine's own bytes, byte for byte", async () => {
    const master = await png(() => [190, 188, 186]);
    const painted = await png((x, y) => (y < 30 ? [40, 30, 25] : [12, 200, 40]));
    const result = await harvestRefinement({
      master: { bytes: master, contentType: "image/png" },
      painted: { bytes: painted, contentType: "image/png" },
      facets: ["hair.cut"],
      reader,
      userId: 1,
    });
    expect(result.outcome).toBe("flag-off");
    expect(Buffer.compare(result.bytes, painted), "not re-encoded, not touched").toBe(0);
    expect(result.contentType).toBe("image/png");
  });

  it("does not even consult the segmenter while dark", async () => {
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
      userId: 1,
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
