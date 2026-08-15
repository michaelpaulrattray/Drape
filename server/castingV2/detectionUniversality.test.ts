import { describe, expect, it } from "vitest";

import {
  armingViolationOf,
  detectionGaps,
  detectionMap,
  detectionViolations,
  hasCourt,
  type DetectionRow,
} from "./detectionUniversality";
import { BORN_WORN_CLASSES, type BornWornClass } from "./bornWornDetector";

/**
 * V4's TARGET, DRIVEN — *"what the product can say, the scan can see."*
 *
 * The map itself is the reader; this is what makes its clean run mean
 * something. Every arm below either shows the map catching a state the rules
 * forbid, or pins a state the rules allow so that a NEW one is loud.
 *
 * The pinned gap list is the part worth understanding. It is not a second copy
 * of anything — each gap's REASON comes from the table that owns it — but the
 * SET is pinned, because the failure this phase is written against is a kind
 * the product learns to say while nothing learns to see it. That failure adds a
 * gap, and an unpinned gap list would absorb it in silence.
 */
const widget = (over: Partial<BornWornClass> = {}): BornWornClass => ({
  id: "widget",
  region: "widget",
  floor: null,
  sideFloor: null,
  pair: false,
  armed: false,
  measurement: "NOT MEASURED — invented for this test",
  sideMeasurement: "NOT CONSIDERED and never needed",
  ...over,
});

const accessoryRow = (rows: DetectionRow[]): DetectionRow => {
  const row = rows.find((entry) => entry.lands === "accessories");
  if (!row) throw new Error("the map has no accessory facet — the fixture cannot be read");
  return row;
};

describe("the V4 map reads the shipped vocabulary", () => {
  it("finds no violation anywhere in the shipped tables", () => {
    const violations = detectionViolations();
    expect(violations.map((row) => `${row.facet}: ${row.why}`)).toEqual([]);
  });

  it("gives every facet a verdict and every gap a written reason", () => {
    const rows = detectionMap();
    expect(rows.length).toBeGreaterThan(20);
    for (const row of rows) {
      expect(["SEEN", "GAP", "VIOLATION"]).toContain(row.verdict);
      /* A gap with no reason is the silent decider this phase exists to kill:
         "we cannot see it" and "nobody decided" must never look alike. */
      if (row.verdict === "GAP") expect(row.why.length).toBeGreaterThan(20);
    }
  });

  it("pins today's gaps, so a NEW one cannot arrive quietly", () => {
    /*
      Seven, each for a reason its own table states:

        makeup       worn STATE on the anatomy it sits on — no slot of its own
        lashes       the nearest question is "eyes", which is broader
        cheekbones   the nearest question is "face skin", which is broader
        jaw          same
        chin         same
        ink          OWED — its question comes from a placement, and the slots
                     arrive with the tattoo studio (D-138)
        expression   presentation rather than identity, and no zone contains it

      Adding a kind the product can say without a story for seeing it lengthens
      this list and turns this line red. That is the point of it.
    */
    expect(detectionGaps()).toEqual([
      "cheekbones", "chin", "expression", "ink", "jaw", "lashes", "makeup",
    ]);
  });

  it("reads the accessory table as SEEN and still names the kind nobody can see", () => {
    const row = accessoryRow(detectionMap());
    expect(row.verdict).toBe("SEEN");
    /* The half that matters: a partially armed family must not report as
       finished. The unarmed kind is named in the row's own sentence. */
    expect(row.why).toContain("nose stud");
    expect(row.unarmed.some((entry) => entry.startsWith("nose stud"))).toBe(true);
    expect(row.armed.sort()).toEqual(["earring", "glasses"]);
  });
});

describe("the map can print what it is looking for", () => {
  /*
    THE CONTROLS. A clean map and a blind map produce the same page, and this
    program has published that page before — so the reader is shown each defect
    it claims to detect, through the same function production reads.
  */
  it("POSITIVE — a kind armed on a real court reads as armed, with its court", () => {
    const glasses = BORN_WORN_CLASSES.find((entry) => entry.id === "glasses");
    expect(glasses?.armed).toBe(true);
    expect(hasCourt(glasses!.measurement)).toBe(true);
    expect(armingViolationOf(glasses!, new Set(["glasses", "earring"]))).toBeNull();
  });

  it("NEGATIVE — a kind with no floor prints a GAP that names it", () => {
    const row = accessoryRow(detectionMap([widget()]));
    expect(row.verdict).toBe("GAP");
    expect(row.unarmed.join(" ")).toContain("widget");
  });

  it("NEGATIVE — armed on a floor no court measured is a VIOLATION", () => {
    const row = accessoryRow(detectionMap([widget({ floor: 0.001, armed: true })]));
    expect(row.verdict).toBe("VIOLATION");
    expect(row.why).toContain("no court measured");
  });

  it("NEGATIVE — a PAIR armed without a per-side court is a VIOLATION", () => {
    /* The earring court's own lesson: a union floor sits above two of sixteen
       measured worn sides, so a pair judged on it loses a real earring on one
       wearing ear in eight. */
    const problem = armingViolationOf(
      widget({
        floor: 0.001, armed: true, pair: true,
        measurement: "8 worn 1.2–2.0% and 8 bare 0.000%, invented for this test",
      }),
      new Set(["widget"]),
    );
    expect(problem).toContain("per-side court");
  });

  it("NEGATIVE — a detector nothing consults is a VIOLATION, both ways round", () => {
    const measured = "12 worn 1.2–2.0% and 12 bare 0.000%, invented for this test";
    expect(armingViolationOf(widget({ floor: 0.001, armed: true, measurement: measured }), new Set()))
      .toContain("never asks");
    expect(armingViolationOf(widget(), new Set(["widget"])))
      .toContain("without being ARMED");
  });

  it("does not read an empty map as a clean one", () => {
    /* Two empty lists are equal, and a reader handed nothing must say so rather
       than reporting no problems. */
    const row = accessoryRow(detectionMap([]));
    expect(row.verdict).toBe("GAP");
    expect(row.why).toContain("no accessory kind has a measured court");
  });
});
