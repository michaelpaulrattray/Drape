import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";

/* The store's own front door opens a transaction and registers a cleanup
   manifest. Both are seams this suite has no business reaching — the subject is
   which GROUND a segment is cut from, not how the rows commit. */
vi.mock("../db/connection", () => ({
  withTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
}));
vi.mock("../db/storageCleanup", () => ({
  createStorageCleanupManifestIn: async () => undefined,
}));

import { harvestRefinement, regionNameOf, type RegionReader } from "./maskedRefine";
import { cutSegments, encodeCut } from "./segmentCuts";
import { keepSegmentsFromRender } from "./segmentPersistence";
import { readRaster, type Mask } from "./maskedComposite";
import { facetOfSubject } from "./refineFacets";
import {
  FEATHER_TOLERANCE,
  adjudicateCandidateCarries,
  featherToleranceFor,
} from "../../scripts/lib/carriedAdjudicator.mts";

/**
 * THE ACCESSORY CORRIDOR — the geography that was built, used, and never named.
 *
 * # The census this suite exists to change
 *
 * Every segment row in production, on 2026-08-09, by facet:
 *
 *     6 edit_patch marks · 4 edit_patch makeup · 3 edit_patch hairWorn
 *     1 edit_patch eye.colour                                    total 14
 *     statedAccessories:  ZERO
 *
 * Not one accessory pixel had ever been kept, on any face, on any render this
 * campaign paid for — so an earring was re-rolled from words on every later
 * render, which is why the founder's single gold hoop appeared on her LEFT ear
 * on v#156 and on her RIGHT on v#157.
 *
 * The cause was not a missing capability. `additionDestination` has built the
 * corridor at both earlobes since the addition path was wired; the harvest
 * unions it into the zone and the paint is governed by it. But the segment
 * cutter looks a facet's ground up in `evidence.masterRegions` **by name**, and
 * the corridor went into an anonymous `owned` list. A mask nobody can name is a
 * mask nobody can cut against.
 *
 * # What each test here is holding shut
 *
 * The controls matter more than the affirmatives, because every one of them is a
 * way this fix could pass its own suite while filing nothing:
 *
 * - the corridor could be filed under the WRONG kind (an earring ask harvesting
 *   at her eyes — the defect `LANDMARK_OF_ACCESSORY` was born to kill);
 * - the master's own read of the same name — EMPTY for a genuine addition, and
 *   made on every addition — could overwrite it, which is the original defect
 *   one layer deeper and the version this build very nearly shipped;
 * - the delivered thing could hang past the corridor and be clipped;
 * - and the cutter could be reading a name the service never sends.
 */

const W = 64;
const H = 64;

const SKIN: [number, number, number] = [190, 188, 186];
const METAL: [number, number, number] = [240, 205, 90];

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

const box = (x0: number, y0: number, x1: number, y1: number): Mask => {
  const data = Buffer.alloc(W * H, 0);
  for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) data[y * W + x] = 255;
  return { data, width: W, height: H };
};

const empty = (): Mask => ({ data: Buffer.alloc(W * H, 0), width: W, height: H });

const coverageOf = (mask: Mask | undefined): number => {
  if (!mask) return 0;
  let count = 0;
  for (let at = 0; at < mask.data.length; at += 1) if (mask.data[at] > 0) count += 1;
  return count;
};

const claimsAt = (mask: Mask | undefined, x: number, y: number): boolean =>
  Boolean(mask && mask.data[y * W + x]! > 0);

/**
 * The lobes this suite hangs everything from — the reader's landmark answer, in
 * pixels, so a test can ask whether the corridor really landed on the ear.
 */
const LOBES = [{ x: 0.25, y: 0.5 }, { x: 0.75, y: 0.5 }];
const LEFT_LOBE = { x: Math.round(LOBES[0].x * W), y: Math.round(LOBES[0].y * H) };
const RIGHT_LOBE = { x: Math.round(LOBES[1].x * W), y: Math.round(LOBES[1].y * H) };

/** A face wearing nothing, and the same face with a bead of metal at each lobe. */
const HOOP_RADIUS = 3;
const bareFace = () => png(() => SKIN);
const hoopedFace = () => png((x, y) => {
  const near = (p: { x: number; y: number }) => Math.hypot(x - p.x, y - p.y) <= HOOP_RADIUS;
  return near(LEFT_LOBE) || near(RIGHT_LOBE) ? METAL : SKIN;
});

/**
 * WHERE THE DELIVERED HOOPS ARE, read off the painted frame.
 *
 * Not decoration on the fixture. An addition's harvest asks the PAINTED frame
 * where the thing is now, and a reader that finds nothing there refuses the
 * render outright ("the skin region selects nothing") — so a landed accessory
 * render always has a delivered extent, and a fixture without one is testing a
 * render that could not exist.
 */
const deliveredHoops = (): Mask => {
  const data = Buffer.alloc(W * H, 0);
  for (const lobe of [LEFT_LOBE, RIGHT_LOBE]) {
    for (let y = lobe.y - HOOP_RADIUS; y <= lobe.y + HOOP_RADIUS; y += 1) {
      for (let x = lobe.x - HOOP_RADIUS; x <= lobe.x + HOOP_RADIUS; x += 1) {
        if (Math.hypot(x - lobe.x, y - lobe.y) <= HOOP_RADIUS) data[y * W + x] = 255;
      }
    }
  }
  return { data, width: W, height: H };
};

/**
 * A reader that answers each question honestly for a genuine addition.
 *
 * `onMaster` is what she is wearing NOW — empty for an addition, and the answer
 * that overwrote the corridor before the union rule. `onPainted` is the
 * delivered extent, which is what makes the ground true rather than merely
 * plausible.
 */
function readerFor(input: {
  master: Buffer;
  onMaster?: (name: string) => Mask;
  onPainted?: (name: string) => Mask;
  seen?: string[];
}): RegionReader {
  return {
    region: async ({ image, name }) => {
      const which = Buffer.compare(image, input.master) === 0 ? "master" : "painted";
      input.seen?.push(`${which}:${name}`);
      return which === "master"
        ? (input.onMaster?.(name) ?? empty())
        : (input.onPainted?.(name) ?? empty());
    },
    subject: async () => box(0, 0, W, H),
    landmark: async () => LOBES,
  };
}

async function harvestHoops(overrides: Partial<Parameters<typeof harvestRefinement>[0]> = {}) {
  const master = await bareFace();
  const painted = await hoopedFace();
  return harvestRefinement({
    master: { bytes: master, contentType: "image/png" },
    painted: { bytes: painted, contentType: "image/png" },
    facets: [facetOfSubject("statedAccessories")],
    reader: readerFor({ master, onPainted: () => deliveredHoops() }),
    userId: 1,
    described: "small gold hoops",
    ...overrides,
  });
}

describe("the corridor an addition is painted into is named, so it can be cut against", () => {
  it("files the destination under the kind the instruction named", async () => {
    const result = await harvestHoops();

    const ground = result.evidence?.masterRegions.get("earring");
    expect(coverageOf(ground), "an earring ask leaves earring ground behind").toBeGreaterThan(0);
    /*
      And it is the LOBES, not merely something non-empty. A corridor filed at
      the wrong anatomy would still satisfy a coverage assertion, which is how a
      geometry test passes while the picture is wrong.
    */
    expect(claimsAt(ground, LEFT_LOBE.x, LEFT_LOBE.y), "her left lobe").toBe(true);
    expect(claimsAt(ground, RIGHT_LOBE.x, RIGHT_LOBE.y), "and her right — a pair is both").toBe(true);
    expect(claimsAt(ground, 32, 4), "and nothing at the top of her head").toBe(false);
  });

  it("CONTROL — asks the segmenter for that kind and never for another", async () => {
    /* The founding defect of this table: a `names[0]` harvest with a literal
       `"earring"` fallback, so an ask about GLASSES harvested wherever her
       earrings were. The name on the mask and the name in the question come
       from one entry or they will drift. */
    const master = await bareFace();
    const seen: string[] = [];
    const result = await harvestRefinement({
      master: { bytes: master, contentType: "image/png" },
      painted: { bytes: await hoopedFace(), contentType: "image/png" },
      facets: [facetOfSubject("statedAccessories")],
      reader: readerFor({ master, onPainted: () => deliveredHoops(), seen }),
      userId: 1,
      described: "round tortoiseshell glasses",
    });

    expect(coverageOf(result.evidence?.masterRegions.get("glasses"))).toBeGreaterThan(0);
    expect(result.evidence?.masterRegions.has("earring"), "her ears were never the subject").toBe(false);
    expect(seen.some((question) => question.endsWith(":earring"))).toBe(false);
  });

  it("CONTROL — an edit about nothing worn files no accessory ground at all", async () => {
    /* The instrument has to be able to say NO. A map that gained an `earring`
       key on a hair edit would pass every affirmative above while filing a slab
       of her head as jewellery. */
    const master = await png((x) => (x < 30 ? [40, 30, 25] : SKIN));
    const result = await harvestRefinement({
      master: { bytes: master, contentType: "image/png" },
      painted: { bytes: await png((x) => (x < 20 ? [40, 30, 25] : SKIN)), contentType: "image/png" },
      facets: ["hair.cut"],
      reader: readerFor({
        master,
        onMaster: () => box(0, 0, 30, H),
        onPainted: () => box(0, 0, 20, H),
      }),
      userId: 1,
    });

    expect(coverageOf(result.evidence?.masterRegions.get("hair"))).toBeGreaterThan(0);
    expect(result.evidence?.masterRegions.has("earring")).toBe(false);
    expect(result.evidence?.masterRegions.has("glasses")).toBe(false);
  });

  it("keeps BOTH grounds when she is already wearing a pair — arrived and departed", async () => {
    /*
      THE BUG THIS BUILD NEARLY SHIPPED, pinned.

      An addition asks the master for its own region too, with `absentIsAnswer`,
      so that "nowhere" is a legitimate answer. That read files `earring` into
      the very map the corridor is filed in — so a precedence rule letting the
      READ win (the instinct: a read is evidence, a corridor is a guess) puts an
      EMPTY mask over the corridor and files zero accessory segments, silently,
      with this suite green.

      The union is not a compromise between them. They are two different grounds
      and a swap needs both: the corridor is where the new hoop ARRIVED, and the
      master's own extent is where the studs she had on DEPARTED from.
    */
    const master = await bareFace();
    const wornNow = box(4, 30, 10, 36);
    const result = await harvestHoops({
      reader: readerFor({
        master,
        onMaster: (name) => (name === "earring" ? wornNow : empty()),
        onPainted: () => deliveredHoops(),
      }),
    });

    const ground = result.evidence?.masterRegions.get("earring");
    expect(claimsAt(ground, 6, 32), "the ground the old studs are vacating").toBe(true);
    expect(claimsAt(ground, LEFT_LOBE.x, LEFT_LOBE.y), "and the ground the new hoops arrive on").toBe(true);
  });

  it("reaches a drop that hangs past the corridor, because the delivered read is unioned in", async () => {
    /*
      The corridor errs SMALL on purpose — the founder's rider is that
      boundary-contact expansion catches an under-estimate. So a cut from the
      corridor alone would saw the bottom off a long drop earring. The harvest
      already asks the painted frame where the thing is now, for its own content
      gate; unioning that answer in costs no vision call and makes the ground the
      DELIVERED thing's own extent, which is the whole thesis of the design.
    */
    const master = await bareFace();
    const hangsLow = box(LEFT_LOBE.x - 2, LEFT_LOBE.y + 12, LEFT_LOBE.x + 3, LEFT_LOBE.y + 20);
    const result = await harvestHoops({
      described: "long gold drop earrings",
      painted: {
        bytes: await png((x, y) => (
          x >= LEFT_LOBE.x - 2 && x < LEFT_LOBE.x + 3 && y >= LEFT_LOBE.y + 12 && y < LEFT_LOBE.y + 20
            ? METAL
            : SKIN
        )),
        contentType: "image/png",
      },
      reader: readerFor({ master, onPainted: (name) => (name === "earring" ? hangsLow : empty()) }),
    });

    const ground = result.evidence?.masterRegions.get("earring");
    expect(claimsAt(ground, LEFT_LOBE.x, LEFT_LOBE.y + 18), "the bottom of the drop").toBe(true);
    /*
      AND THE LOBE ITSELF, which only the corridor claims — the painted read here
      found the drop and not the fitting. Both halves are asserted in one place
      on purpose: an assertion that only proves the union's non-empty is passed
      by either side alone, which is how a two-source rule comes to have one
      source and a green suite.
    */
    expect(claimsAt(ground, LEFT_LOBE.x, LEFT_LOBE.y), "and the fitting at the lobe").toBe(true);
    expect(
      claimsAt(result.evidence?.masterRegions.get("earring"), RIGHT_LOBE.x, RIGHT_LOBE.y),
      "on both ears, because the corridor is bilateral even when the paint is not",
    ).toBe(true);
  });

  it("CONTROL — a painted read for an ORDINARY region is not smuggled in as ground", async () => {
    /*
      `painted:<name>` means "where is this thing NOW", and for a hair shrink the
      honest answer is the SHORTER hair. Unioning that into the master geography
      would quietly widen every region in the map, and the consumers of this map
      — the cutter, the verification detail crop — all read it as master
      geography. Only a name the corridor placed takes its painted answer.
    */
    const master = await png((x) => (x < 30 ? [40, 30, 25] : SKIN));
    const result = await harvestRefinement({
      master: { bytes: master, contentType: "image/png" },
      painted: { bytes: await png((x) => (x < 20 ? [40, 30, 25] : SKIN)), contentType: "image/png" },
      facets: ["hair.cut"],
      reader: readerFor({
        master,
        onMaster: () => box(0, 0, 30, H),
        /* The painted answer claims a band the master's hair never occupied. */
        onPainted: () => box(0, 0, 50, H),
      }),
      userId: 1,
    });

    expect(claimsAt(result.evidence?.masterRegions.get("hair"), 45, 32), "not widened by the painted read").toBe(false);
  });
});

describe("an accessory segment is cut, kept and carried like any other facet", () => {
  it("cuts a statedAccessories segment from the ground the corridor named", async () => {
    const harvested = await harvestHoops();
    const composite = await readRaster(harvested.bytes);

    const cuts = cutSegments({
      composite,
      applied: harvested.evidence!.applied,
      /* Exactly what the service sends: the facet has no `REGION_OF_FACET`
         entry, so the placement override is the only thing naming its ground. */
      facetRegions: new Map([[facetOfSubject("statedAccessories"), "earring"]]),
      regionMasks: harvested.evidence!.masterRegions,
    });

    expect(cuts.map((cut) => cut.facet)).toEqual([facetOfSubject("statedAccessories")]);
    expect(cuts[0].region).toBe("earring");
    expect(cuts[0].pixels, "the delivered metal, not an empty promise").toBeGreaterThan(0);
  });

  it("CONTROL — files nothing at all without the placement, which is the production census", async () => {
    /*
      THE NEGATIVE CONTROL FOR THE WHOLE FIX (working law 2).

      This is the state of the product before this change, driven directly: the
      cutter is asked for `statedAccessories` with no override, `regionNameOf`
      returns null, and the answer is silence. If this test ever goes green
      alongside the one above, the override stopped being load-bearing and the
      one above is measuring something else.
    */
    expect(regionNameOf(facetOfSubject("statedAccessories")), "there is no facet-only answer").toBeNull();

    const harvested = await harvestHoops();
    const cuts = cutSegments({
      composite: await readRaster(harvested.bytes),
      applied: harvested.evidence!.applied,
      facetRegions: new Map(),
      regionMasks: harvested.evidence!.masterRegions,
    });
    expect(cuts).toEqual([]);
  });

  it("keeps it through the store's own front door, verdict and all", async () => {
    const harvested = await harvestHoops();
    const recorded: Array<{ facet: string; region: string }> = [];

    const result = await keepSegmentsFromRender({
      userId: 1,
      variantId: 7,
      image: { bytes: harvested.bytes, evidence: harvested.evidence },
      facets: [facetOfSubject("statedAccessories")],
      regionOverrides: { statedAccessories: "earring" },
      verdict: "verified",
      verifiedAt: new Date(0),
      dependencies: {
        enabledFor: () => true,
        store: async ({ key }: { key: string }) => ({ key }),
        record: (async (input: { patches: Array<{ facet: string; region: string }> }) => {
          recorded.push(...input.patches);
          return input.patches.map((patch, index) => ({
            id: index + 1,
            publicId: `p${index}`,
            candidateId: 1,
            facet: patch.facet,
            version: 1,
            retired: 0,
          }));
        }) as never,
      },
    });

    expect(result.outcome).toBe("stored");
    expect(recorded.map((patch) => [patch.facet, patch.region]))
      .toEqual([[facetOfSubject("statedAccessories"), "earring"]]);
    /*
      AND IT IS A PAIR, on the row. The box has to span both lobes — a segment
      cut from one ear would keep the founder's single hoop forever, which is the
      defect the pair law and this store are closing from two ends.
    */
    const kept = recorded[0] as unknown as { geometry: { bbox: { x: number; width: number } } };
    expect(kept.geometry.bbox.x).toBeLessThanOrEqual(LEFT_LOBE.x);
    expect(kept.geometry.bbox.x + kept.geometry.bbox.width).toBeGreaterThanOrEqual(RIGHT_LOBE.x);
  });
});

/**
 * AND THE ADJUDICATOR COVERS IT FROM THE FIRST CUT (fable-120's condition 1).
 *
 * The byte adjudicator is facet-agnostic by construction — it asks "are these
 * the same pixels she already paid for", which is a question about a mask and a
 * frame and knows nothing about jewellery. That is an argument, though, and
 * this program has been wrong about exactly this kind of argument before:
 * `bornWornCatalogue` is built, tested and has no callers, so a capability
 * everybody believed in files no rows at all.
 *
 * So the first accessory segment the product can cut is driven through the real
 * adjudicator here, on its real encoded bytes, with the two controls that make
 * the verdict mean something: a frame that kept it, and a frame that did not.
 */
describe("a kept accessory is judged by arithmetic like every other carried fact", () => {
  const CARRIED = facetOfSubject("statedAccessories");

  const carriedCandidate = async () => {
    const harvested = await harvestHoops();
    const [cut] = cutSegments({
      composite: await readRaster(harvested.bytes),
      applied: harvested.evidence!.applied,
      facetRegions: new Map([[CARRIED, "earring"]]),
      regionMasks: harvested.evidence!.masterRegions,
    });
    const encoded = await encodeCut(cut);
    return { harvested, cut, encoded };
  };

  const run = async (input: {
    frame: Buffer;
    encoded: { mask: Buffer; content: Buffer };
    cut: { box: { x: number; y: number; width: number; height: number } };
    intersections: Array<{ winner: string; loser: string; pixels: number }>;
  }) => adjudicateCandidateCarries({
    variants: [{
      id: 2,
      imageKey: "frame",
      requestText: "she wear her hair down",
      internalPrompt: {
        verification: { checks: [{ facet: CARRIED, read: true, verified: false, carried: true }] },
        assembly: { intersections: input.intersections },
      },
    }],
    segments: [{
      facet: CARRIED,
      variantId: 1,
      version: 1,
      maskKey: "mask",
      contentKey: "content",
      bboxX: input.cut.box.x,
      bboxY: input.cut.box.y,
      bboxW: input.cut.box.width,
      bboxH: input.cut.box.height,
    }],
    fetchBytes: async (key: string) => (
      key === "mask" ? input.encoded.mask : key === "content" ? input.encoded.content : input.frame
    ),
  });

  it("says KEPT when the hoops are byte-identical in the later frame", async () => {
    const { harvested, cut, encoded } = await carriedCandidate();
    const { verdicts, unadjudicable } = await run({
      frame: harvested.bytes, cut, encoded, intersections: [],
    });

    expect(unadjudicable, "an accessory is not a fact this instrument skips").toEqual([]);
    expect(verdicts).toHaveLength(1);
    expect(verdicts[0].facet).toBe(CARRIED);
    expect(verdicts[0].owned).toBeGreaterThan(0);
    expect(verdicts[0].unexplained).toBe(0);
    expect(verdicts[0].kept).toBe(true);
  });

  it("CONTROL — says DEFICIT when the hoops are gone and nothing wrote it down", async () => {
    /*
      The instrument's ability to FAIL, which is the only thing that makes the
      verdict above worth reading. This frame is her bare face: every pixel the
      segment owns has been replaced by skin, and no intersection accounts for
      any of it.
    */
    const { cut, encoded } = await carriedCandidate();
    const { verdicts } = await run({
      frame: await bareFace(), cut, encoded, intersections: [],
    });

    expect(verdicts[0].identical, "the metal is not in this picture").toBeLessThan(verdicts[0].owned);
    expect(verdicts[0].unexplained).toBeGreaterThan(featherToleranceFor(verdicts[0].owned));
    expect(verdicts[0].kept).toBe(false);
    /*
      AND THE ALLOWANCE IS SMALLER THAN THE THING IT IS JUDGING — the reason
      this control failed the first time it was written.

      The flat 64 was calibrated on a 24,056-pixel freckle patch. A pair of
      hoops is under a hundred pixels, so the old tolerance was larger than the
      whole segment and this frame — her bare face, with no jewellery in it at
      all — was scored KEPT. An instrument that cannot fail was reporting
      success.
    */
    expect(verdicts[0].owned).toBeLessThan(FEATHER_TOLERANCE);
    expect(featherToleranceFor(verdicts[0].owned)).toBeLessThan(verdicts[0].owned);
  });

  it("says KEPT when her new hair is RECORDED as having won those pixels", async () => {
    /*
      The same missing metal, with the compositor's own note beside it. This is
      the arithmetic half of the occluded verdict: a hoop behind new hair is not
      a broken promise, and the difference between the two is whether anybody
      wrote down that the hair took the ground.
    */
    const { cut, encoded } = await carriedCandidate();
    const owned = cut as unknown as { pixels: number };
    const { verdicts } = await run({
      frame: await bareFace(),
      cut,
      encoded,
      intersections: [{ winner: "fresh paint", loser: `${CARRIED}@v1`, pixels: owned.pixels }],
    });

    expect(verdicts[0].recorded).toBe(owned.pixels);
    expect(verdicts[0].unexplained).toBe(0);
    expect(verdicts[0].kept).toBe(true);
  });
});

/**
 * THE ALLOWANCE ITSELF, since changing it changes every carried verdict there
 * has ever been.
 *
 * The claim that has to hold is narrow and worth pinning exactly: the founding
 * specimen's arithmetic is untouched, and only segments too small for a flat 64
 * to mean anything move.
 */
describe("the feather allowance scales with the segment it is judging", () => {
  it("leaves the founding specimen's number exactly where it was", async () => {
    /* 24,056 pixels is the freckle patch the flat 64 was calibrated against.
       Any segment at or above 256 keeps the old number, so no verdict already
       in the record can flip on this change. */
    expect(featherToleranceFor(24_056)).toBe(FEATHER_TOLERANCE);
    expect(featherToleranceFor(256)).toBe(FEATHER_TOLERANCE);
    expect(featherToleranceFor(255)).toBeLessThan(FEATHER_TOLERANCE);
  });

  it("never lets the allowance approve the loss of the whole thing", async () => {
    /* The property, rather than a table of numbers: whatever the size, an
       allowance that could excuse a segment vanishing is not an allowance. */
    for (const owned of [1, 8, 58, 120, 999, 24_056]) {
      expect(featherToleranceFor(owned), `${owned} px`).toBeLessThan(owned);
    }
  });
});
