import { describe, expect, it, vi } from "vitest";

/**
 * The born-worn detector's own trial, in the suite.
 *
 * The court that decides whether a class may arm runs on real faces through the
 * real segmenter (`scripts/calibration/born-worn-court.mts`) — a threshold is
 * not a thing a unit test can measure. What IS provable here is everything
 * around the threshold: that the vocabulary is the product's own rather than a
 * second copy of it, that an unmeasured class cannot arm, that an unarmed class
 * is never even asked, and that a reader having a bad minute costs a face a row
 * rather than costing a customer a cast.
 */
import { LANDMARK_OF_ACCESSORY } from "./accessoryKinds";
import { GLASSES_COVERAGE_FLOOR, wearsGlassesByPixels } from "./canthalTilt";
import { COVERAGE_BANDS, binaryCoverage } from "./maskGeometry";
import { FREE_SUBJECT_KEYS } from "./refineSubjects";
import {
  BORN_WORN_CLASSES,
  BORN_WORN_DETECTOR,
  EARRING_COVERAGE_FLOOR,
  armedBornWornClasses,
  departureFloorFor,
  detectBornWorn,
  type BornWornClass,
} from "./bornWornDetector";
import type { Mask } from "./maskedComposite";

const FRAME = { width: 100, height: 100 };

/** A mask covering exactly `pixels` of a 100×100 frame — coverage = pixels/1e4. */
function maskCovering(pixels: number): Mask {
  const data = Buffer.alloc(FRAME.width * FRAME.height);
  data.fill(255, 0, pixels);
  return { data, ...FRAME };
}

function reader(region: (input: { name: string; absentIsAnswer?: boolean }) => Promise<Mask>) {
  return {
    region: vi.fn(async (input: { image: Buffer; name: string; absentIsAnswer?: boolean }) => region(input)),
    subject: vi.fn(async () => maskCovering(0)),
    landmark: vi.fn(async () => []),
  };
}

const IMAGE = Buffer.from("master");

describe("the born-worn catalogue's vocabulary", () => {
  /*
    The closure test, in the shape `FRINGE_AT_EDGE` already uses: a new kind of
    accessory must be CONSIDERED here, even if the consideration is "nobody has
    measured this". Without it a new kind arrives silently uncatalogued and the
    product quietly stops naming a thing that is on her face.
  */
  it("considers every kind of thing the placement table can name", () => {
    const catalogued = new Set(BORN_WORN_CLASSES.map((entry) => entry.id));
    for (const entry of LANDMARK_OF_ACCESSORY) {
      expect(catalogued.has(entry.region)).toBe(true);
    }
    expect(BORN_WORN_CLASSES).toHaveLength(LANDMARK_OF_ACCESSORY.length);
  });

  /*
    THE IMPLICATION RUNS ONE WAY, and the earring court is why that sentence
    exists. No floor still means never armed — the safety property, unchanged.
    A floor no longer means armed by itself: a kind may hold a measured
    DEPARTURE floor while detection waits for the court detection needs, and
    `deferArming` is where the table says which job the number was measured for.

    This test used to assert `armed === (typeof floor === "number")`, which was
    the coupling stated as a law. Writing the earring floor armed the detector
    as a side effect and that assertion is what caught it — a pin doing exactly
    its job, so it is being rewritten deliberately rather than relaxed.
  */
  it("never arms a class with no measured floor", () => {
    for (const entry of BORN_WORN_CLASSES) {
      if (typeof entry.floor !== "number") {
        expect(entry.armed, entry.id).toBe(false);
        expect(entry.measurement).toMatch(/NOT (MEASURED|CONSIDERED)/);
      }
    }
  });

  it("lets a measured floor stand without arming detection", () => {
    const earring = BORN_WORN_CLASSES.find((entry) => entry.id === "earring")!;
    /* The departure gate reads the floor... */
    expect(departureFloorFor("earring").measured).toBe(true);
    expect(departureFloorFor("earring").floor).toBe(EARRING_COVERAGE_FLOOR);
    /* ...and the detector still does not hunt it on an untouched master. */
    expect(earring.armed).toBe(false);
    /*
      The reason has to be legible from the row, or the next reader sees a
      measured floor that is somehow inert and re-arms it.
    */
    expect(earring.measurement).not.toMatch(/NOT (MEASURED|CONSIDERED)/);

    /* Slice 1 still arms exactly one class, and that is the honest state. */
    expect(armedBornWornClasses().map((entry) => entry.id)).toEqual(["glasses"]);
  });

  /*
    The number itself, pinned against the court that produced it. Not a
    tautology: it fails if anyone moves the floor without moving the
    provenance, which is the pair that must never drift apart.
  */
  it("judges earrings against the court's own number, not the eyewear band", () => {
    const earring = BORN_WORN_CLASSES.find((entry) => entry.id === "earring")!;
    expect(earring.floor).toBe(0.0002);
    expect(earring.measurement).toContain("0.0404");
    expect(earring.measurement).toContain("VISIBLE BARE");
    /*
      The whole point of the number. The band the gate used to compare hoops to
      was measured on GLASSES and is far above every worn earring reading the
      court took — so this must stay strictly under it, by a lot.
    */
    expect(earring.floor!).toBeLessThan(COVERAGE_BANDS.eyewearFrames.min);
    expect(earring.floor!).toBeLessThan(0.000404); // 2x under the smallest worn
  });

  /*
    THE IDENTITY INDEX IS PROVENANCE-BLIND, so this is not a tidiness test.

    A detected class sharing a facet id with a patch facet would put a fact and
    a patch on one identity, where the version counter must keep them apart and
    a future reader would have to remember which is which. Keeping the two
    vocabularies disjoint is what makes "one live row per facet" mean one thing.
  */
  it("names nothing a refine facet already names", () => {
    const patchFacets = new Set<string>(FREE_SUBJECT_KEYS);
    for (const entry of BORN_WORN_CLASSES) {
      expect(patchFacets.has(entry.id)).toBe(false);
    }
  });

  /*
    The glasses floor is not re-derived here, it is IMPORTED — and this proves
    the detector's arithmetic is the same one the 23-bare/8-bespectacled court
    measured through, rather than a lookalike that agrees on the easy cases.
  */
  it("reads with the same arithmetic the glasses floor was measured with", () => {
    for (const pixels of [0, 1, 5, 10, 11, 100, 209]) {
      const mask = maskCovering(pixels);
      expect(binaryCoverage(mask) > GLASSES_COVERAGE_FLOOR).toBe(wearsGlassesByPixels(mask));
    }
  });
});

describe("reading a master for what it already has", () => {
  const glasses = BORN_WORN_CLASSES.find((entry) => entry.id === "glasses")!;

  it("files a detection when the thing covers more than its floor", async () => {
    /* 209 pixels of 10,000 = 2.09%, the top of the bespectacled range. */
    const eyes = reader(async () => maskCovering(209));
    const scan = await detectBornWorn({ image: IMAGE, reader: eyes, classes: [glasses] });

    expect(scan.detections.map((found) => found.facet)).toEqual(["glasses"]);
    expect(scan.detections[0].coverage).toBeCloseTo(0.0209, 6);
    expect(scan.absent).toEqual([]);
    expect(scan.detector).toBe(BORN_WORN_DETECTOR);
  });

  it("records an absence as an absence, not as a row", async () => {
    /* A bare face read 0.000% in the court; a stray pixel is still bare. */
    const bare = reader(async () => maskCovering(1));
    const scan = await detectBornWorn({ image: IMAGE, reader: bare, classes: [glasses] });

    expect(scan.detections).toEqual([]);
    expect(scan.absent).toEqual([{ facet: "glasses", coverage: 0.0001 }]);
  });

  /*
    Asserted at the wire (invariant 5), because this flag is the difference
    between *the model could not answer* and *the answer is nowhere*, and the
    catalogue is the caller for which "nowhere" is a real answer about her face.
  */
  it("asks with absent-is-an-answer, because a bare face is an answer", async () => {
    const eyes = reader(async () => maskCovering(0));
    await detectBornWorn({ image: IMAGE, reader: eyes, classes: [glasses] });

    expect(eyes.region).toHaveBeenCalledWith({ image: IMAGE, name: "glasses", absentIsAnswer: true });
  });

  it("never asks about an unarmed class", async () => {
    const eyes = reader(async () => maskCovering(500));
    const scan = await detectBornWorn({
      image: IMAGE,
      reader: eyes,
      classes: BORN_WORN_CLASSES.filter((entry) => !entry.armed),
    });

    expect(eyes.region).not.toHaveBeenCalled();
    expect(scan.detections).toEqual([]);
  });

  it("cannot be armed into filing without a floor", async () => {
    const eyes = reader(async () => maskCovering(500));
    const forced: BornWornClass = { id: "earring", region: "earring", floor: null, measurement: "none", armed: true };
    const scan = await detectBornWorn({ image: IMAGE, reader: eyes, classes: [forced] });

    expect(eyes.region).not.toHaveBeenCalled();
    expect(scan.detections).toEqual([]);
    expect(scan.failed).toEqual([{ facet: "earring", detail: "armed without a measured floor" }]);
  });

  /*
    fable-085 §4: detection failures are silent non-entries, never blockers. A
    detector that can throw is a detector that can cost a customer a cast
    because a segmenter had a bad minute.
  */
  it("loses one class rather than the whole scan when a read fails", async () => {
    const second: BornWornClass = {
      id: "earring", region: "earring", floor: 0.001, measurement: "test only", armed: true,
    };
    const eyes = reader(async (input) => {
      if (input.name === "glasses") throw new Error("segmenter said 502");
      return maskCovering(209);
    });

    const scan = await detectBornWorn({ image: IMAGE, reader: eyes, classes: [glasses, second] });

    expect(scan.failed).toEqual([{ facet: "glasses", detail: "segmenter said 502" }]);
    expect(scan.detections.map((found) => found.facet)).toEqual(["earring"]);
  });
});
