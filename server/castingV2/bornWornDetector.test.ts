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
  EARRING_SIDE_COVERAGE_FLOOR,
  armedBornWornClasses,
  bornWornClassFor,
  departureFloorFor,
  detectBornWorn,
  detectionFloorFor,
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
    /*
      THE MECHANISM, DRIVEN — no shipped class defers any more, so the shipped
      table can no longer show this and a version of it written out of local
      objects would be the rule agreeing with a copy of itself. Through
      `bornWornClassFor` it is the same function that decides in production.

      It still matters: `deferArming` is how a kind holds a measured DEPARTURE
      floor while detection waits for the court detection needs, and it is what
      held earrings for four shifts until the per-side court passed.
    */
    const held = bornWornClassFor(
      { region: "earring", pair: true },
      {
        floor: EARRING_COVERAGE_FLOOR,
        measurement: "the union court",
        sideFloor: EARRING_SIDE_COVERAGE_FLOOR,
        sideMeasurement: "the per-side court",
        deferArming: "a ruling has not been given yet",
      },
    );
    /* Both numbers present, both courts run, and detection still inert — the
       field decides, not the arithmetic. */
    expect(held.floor).toBe(EARRING_COVERAGE_FLOOR);
    expect(held.sideFloor).toBe(EARRING_SIDE_COVERAGE_FLOOR);
    expect(held.armed).toBe(false);

    /* And the departure gate reads the union floor either way — that half has
       been live since the court measured it, and nothing here touched it. */
    expect(departureFloorFor("earring").measured).toBe(true);
    expect(departureFloorFor("earring").floor).toBe(EARRING_COVERAGE_FLOOR);
  });

  /*
    TWO BOUNDARIES, TWO NUMBERS — the finding that had to land before arming.

    The union floor was measured on whole-frame readings (0.0404–0.0621%) and
    its provenance claims a 2x margin. A per-side detector judges ONE ear, where
    the worn band is 0.0189–0.0347%, and the union number sits at 0.945x the
    smallest worn side — ABOVE it. Two of the sixteen measured worn sides read at
    or under it, so arming on the union number would have filed a worn earring
    as absent on one wearing ear in eight.
  */
  it("keeps the per-side floor and the union floor apart, each under its own court", () => {
    const earring = BORN_WORN_CLASSES.find((entry) => entry.id === "earring")!;
    expect(earring.floor).toBe(EARRING_COVERAGE_FLOOR);
    expect(earring.sideFloor).toBe(EARRING_SIDE_COVERAGE_FLOOR);
    expect(earring.sideFloor).not.toBe(earring.floor);

    /*
      The smallest worn SIDE the court read, and the margin the provenance
      claims — the pair that must never drift apart. Taken at the BOTTOM of the
      printed reading's rounding interval (0.0189% is somewhere in
      [0.01885%, 0.01895%]), because a margin that only holds if the court
      rounded generously is not a margin.
    */
    const smallestWornSide = 0.0001885;
    expect(earring.sideFloor!).toBeLessThanOrEqual(smallestWornSide / 2);
    /* And the union number would NOT have cleared it, which is the finding. */
    expect(earring.floor!).toBeGreaterThan(smallestWornSide);

    /* Each provenance names the boundary it belongs to, or the next reader
       carries one across the other exactly as this one nearly was. */
    expect(earring.measurement).toContain("0.0404");
    expect(earring.sideMeasurement).toContain("PER SIDE");
    expect(earring.sideMeasurement).toContain("0.0189");
    /* The false-positive arm, stated from the data rather than from hope: 14 of
       14 non-wearing sides read exactly zero, bare AND behind hair. It is the
       reason presence-only arming is safe on a covered face. */
    expect(earring.sideMeasurement).toContain("14 of 14");
  });

  /*
    WHICH GATE READS WHICH, asserted rather than commented. The departure gate
    decides refunds; it must keep reading the union number and must never see
    the per-side one.
  */
  it("never hands the refund-deciding gate the per-side number", () => {
    expect(departureFloorFor("earring").floor).toBe(EARRING_COVERAGE_FLOOR);
    expect(departureFloorFor("earring").floor).not.toBe(EARRING_SIDE_COVERAGE_FLOOR);
    expect(departureFloorFor("glasses").floor).toBe(GLASSES_COVERAGE_FLOOR);
    /* An unmeasured kind is still judged at zero — the strictest reading there
       is, and the direction that does not take her money. */
    expect(departureFloorFor("nose stud").floor).toBe(0);
    expect(departureFloorFor("nose stud").measured).toBe(false);
  });

  it("answers the detection question at the boundary it is asked at", () => {
    expect(detectionFloorFor("earring", "side").floor).toBe(EARRING_SIDE_COVERAGE_FLOOR);
    expect(detectionFloorFor("earring", "frame").floor).toBe(EARRING_COVERAGE_FLOOR);
    expect(detectionFloorFor("glasses", "frame").floor).toBe(GLASSES_COVERAGE_FLOOR);
    /* Glasses are one object across two eyes, so there is no side to judge —
       and the row says that in as many words rather than returning a number. */
    expect(detectionFloorFor("glasses", "side").measured).toBe(false);
    expect(detectionFloorFor("glasses", "side").provenance).toContain("pair: false");

    /*
      A question no accessory court names is judged at zero, which is exactly
      what the scan has always done: any pixels at all are the region
      answering. The permissive fallback must be legible as a fallback.
    */
    for (const anatomy of ["eyes", "hair", "ear", "lips"]) {
      expect(detectionFloorFor(anatomy, "side").floor).toBe(0);
      expect(detectionFloorFor(anatomy, "frame").measured).toBe(false);
    }
  });

  /*
    THE ARMING RULE, one boundary along. A kind worn in twos is drawn, clicked
    and stored per instance, so something will judge one side of it — and the
    earring court is the proof that a union number applied to a side is a margin
    that has quietly stopped being true.
  */
  it("cannot arm a paired kind on a whole-frame number alone", () => {
    const unionCourtOnly = { floor: EARRING_COVERAGE_FLOOR, measurement: "the union court, alone" };
    const bothCourts = { ...unionCourtOnly, sideFloor: EARRING_SIDE_COVERAGE_FLOOR, sideMeasurement: "per side" };

    /* The negative arm: worn in twos, one number. This is the state the
       catalogue was in for four shifts, and arming it then would have filed a
       worn earring absent on one wearing ear in eight. */
    expect(bornWornClassFor({ region: "earring", pair: true }, unionCourtOnly).armed).toBe(false);
    /* The positive arm, so the refusal above is not a reader that says no to
       everything: the same kind with both courts arms. */
    expect(bornWornClassFor({ region: "earring", pair: true }, bothCourts).armed).toBe(true);
    /* And a kind worn singly is unaffected — one number is all its boundary
       needs, which is why glasses armed on the union court alone. */
    expect(bornWornClassFor({ region: "glasses", pair: false }, unionCourtOnly).armed).toBe(true);
    /* No floor at all is still the safety property, unchanged either way. */
    expect(bornWornClassFor({ region: "nose stud", pair: false }, undefined).armed).toBe(false);
  });

  it("arms the two classes whose courts have passed, and no others", () => {
    expect(armedBornWornClasses().map((entry) => entry.id).sort()).toEqual(["earring", "glasses"]);
    /* Nose studs have no court at all and must stay inert — a catalogue that
       lists what it merely suspects is a product guessing about her face. */
    expect(BORN_WORN_CLASSES.find((entry) => entry.id === "nose stud")!.armed).toBe(false);
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

  /*
    A PAIR IS NOT FILED FROM A UNION, and arming the earring class is what made
    this reachable rather than theoretical. `reader.region` on a bilateral name
    returns both sides merged; the store, the panel and the library all work per
    instance. A row filed here would be two hoops under one facet, judged at the
    wrong boundary — so it refuses and says which half is missing.
  */
  it("refuses to file a kind worn in twos from a whole-frame reading", async () => {
    const earring = BORN_WORN_CLASSES.find((entry) => entry.id === "earring")!;
    expect(earring.armed).toBe(true);
    const ears = reader(async () => maskCovering(500));

    const scan = await detectBornWorn({ image: IMAGE, reader: ears, classes: [earring] });

    /* Not even asked: a refusal that still spends a vision call is a refusal
       that costs house money to learn nothing. */
    expect(ears.region).not.toHaveBeenCalled();
    expect(scan.detections).toEqual([]);
    expect(scan.absent).toEqual([]);
    expect(scan.failed).toHaveLength(1);
    expect(scan.failed[0].facet).toBe("earring");
    expect(scan.failed[0].detail).toContain("per-side write path");

    /* The positive arm on the same call: a kind worn singly still files, so the
       refusal is about pairs and not about arming. */
    const both = await detectBornWorn({ image: IMAGE, reader: reader(async () => maskCovering(209)), classes: [earring, glasses] });
    expect(both.detections.map((found) => found.facet)).toEqual(["glasses"]);
  });

  it("cannot be armed into filing without a floor", async () => {
    const eyes = reader(async () => maskCovering(500));
    const forced: BornWornClass = {
      id: "nose stud", region: "nose stud", floor: null, measurement: "none",
      sideFloor: null, sideMeasurement: "none", pair: false, armed: true,
      courtDeferred: null,
    };
    const scan = await detectBornWorn({ image: IMAGE, reader: eyes, classes: [forced] });

    expect(eyes.region).not.toHaveBeenCalled();
    expect(scan.detections).toEqual([]);
    expect(scan.failed).toEqual([{ facet: "nose stud", detail: "armed without a measured floor" }]);
  });

  /*
    fable-085 §4: detection failures are silent non-entries, never blockers. A
    detector that can throw is a detector that can cost a customer a cast
    because a segmenter had a bad minute.
  */
  it("loses one class rather than the whole scan when a read fails", async () => {
    /* A second SINGLY-worn class, because a pair never reaches the read at all
       (the refusal above) and this is a test about the read failing. */
    const second: BornWornClass = {
      id: "nose stud", region: "nose stud", floor: 0.001, measurement: "test only",
      sideFloor: null, sideMeasurement: "worn singly", pair: false, armed: true,
      courtDeferred: null,
    };
    const eyes = reader(async (input) => {
      if (input.name === "glasses") throw new Error("segmenter said 502");
      return maskCovering(209);
    });

    const scan = await detectBornWorn({ image: IMAGE, reader: eyes, classes: [glasses, second] });

    expect(scan.failed).toEqual([{ facet: "glasses", detail: "segmenter said 502" }]);
    expect(scan.detections.map((found) => found.facet)).toEqual(["nose stud"]);
  });
});
