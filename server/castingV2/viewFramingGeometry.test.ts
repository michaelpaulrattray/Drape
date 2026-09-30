/**
 * THE FRAMING MEASUREMENT, DRIVEN — #1612 part 1.
 *
 * Law 2 is the whole reason this file is longer than the thing it tests: *a new
 * metric, reader or checker gets a negative control and a positive control
 * before its verdicts count for anything.* So every arm here asserts a
 * DIRECTION, and the two that matter most are the pair on one band — a frame
 * that must read in-band and a frame that must not, differing in one landmark.
 *
 * The masks are built here rather than fetched, on purpose: this file is about
 * the arithmetic over a mask and must be able to fail when the arithmetic is
 * wrong, whatever the segmenter is doing that minute. The segmenter's own
 * behaviour on his real frames is the driver's job, and its record rides the
 * card.
 */
import { describe, expect, it } from "vitest";

import { castPackageView } from "./castViewPackage";
import type { Mask } from "./maskedComposite";
import {
  ABSENCE_FLOOR_FRACTION,
  EDGE_BAND_FLOOR_PX,
  edgeBandPx,
  isPresent,
  litPixels,
  measureViewFraming,
  reachesEdge,
  type FramingLandmark,
  type FramingReader,
} from "./viewFramingGeometry";

const WIDTH = 200;
const HEIGHT = 400;

/** A mask lit inside one rectangle and dark everywhere else. */
function maskOf(box: { x: number; y: number; width: number; height: number }): Mask {
  const data = Buffer.alloc(WIDTH * HEIGHT, 0);
  for (let row = box.y; row < box.y + box.height; row += 1) {
    for (let column = box.x; column < box.x + box.width; column += 1) {
      if (row < 0 || row >= HEIGHT || column < 0 || column >= WIDTH) continue;
      data[row * WIDTH + column] = 255;
    }
  }
  return { data, width: WIDTH, height: HEIGHT };
}

const EMPTY: Mask = { data: Buffer.alloc(WIDTH * HEIGHT, 0), width: WIDTH, height: HEIGHT };

/**
 * A reader that answers from a table and RECORDS what it was asked.
 *
 * The record is not decoration: `absentIsAnswer` is the difference between *the
 * model could not answer* and *the answer is nowhere*, and getting it the wrong
 * way round is a silent defect — an edge rule would read a failed question as a
 * pass. Asserting it at the wire is invariant 5's rule applied to a reader
 * instead of to a request.
 */
function readerOf(table: Partial<Record<FramingLandmark, Mask | Error>>): {
  reader: FramingReader;
  asked: Array<{ landmark: string; absentIsAnswer: boolean | undefined }>;
} {
  const asked: Array<{ landmark: string; absentIsAnswer: boolean | undefined }> = [];
  const answer = (landmark: FramingLandmark): Mask => {
    const held = table[landmark];
    if (held instanceof Error) throw held;
    return held ?? EMPTY;
  };
  return {
    asked,
    reader: {
      async subject({ image: _image }) {
        asked.push({ landmark: "subject", absentIsAnswer: undefined });
        return answer("subject");
      },
      async region({ name, absentIsAnswer }) {
        asked.push({ landmark: name, absentIsAnswer });
        return answer(name as FramingLandmark);
      },
    },
  };
}

const FRAME = Buffer.from("not a real frame — this reader never decodes one");

/**
 * The masks a close-up that satisfies its band would produce.
 *
 * The face runs rows 60–359 of a 400-row frame: clear of the bottom edge (so
 * not too tight) with 40 rows below it, which is 0.13 of its own height (so not
 * too loose). The silhouette runs off the top, so the crown is cropped.
 */
const IN_BAND_CLOSE_UP = {
  face: maskOf({ x: 40, y: 60, width: 120, height: 300 }),
  subject: maskOf({ x: 20, y: 0, width: 160, height: 380 }),
};

describe("edgeBandPx", () => {
  it("is one percent of the edge's own dimension", () => {
    expect(edgeBandPx(1696, 2528, "top")).toBe(25);
    expect(edgeBandPx(1696, 2528, "bottom")).toBe(25);
    expect(edgeBandPx(1696, 2528, "left")).toBe(17);
    expect(edgeBandPx(2352, 3504, "top")).toBe(35);
  });

  it("never collapses to nothing on a small frame", () => {
    expect(edgeBandPx(10, 10, "top")).toBe(EDGE_BAND_FLOOR_PX);
  });
});

describe("reachesEdge", () => {
  it("says no when the shape is nowhere near the frame's edges", () => {
    expect(reachesEdge(maskOf({ x: 80, y: 180, width: 40, height: 40 }), "top")).toBe(false);
    expect(reachesEdge(maskOf({ x: 80, y: 180, width: 40, height: 40 }), "bottom")).toBe(false);
    expect(reachesEdge(maskOf({ x: 80, y: 180, width: 40, height: 40 }), "left")).toBe(false);
    expect(reachesEdge(maskOf({ x: 80, y: 180, width: 40, height: 40 }), "right")).toBe(false);
  });

  it("says yes for the edge the shape runs off, and only that edge", () => {
    const offTheTop = maskOf({ x: 80, y: 0, width: 40, height: 200 });
    expect(reachesEdge(offTheTop, "top")).toBe(true);
    expect(reachesEdge(offTheTop, "bottom")).toBe(false);
    expect(reachesEdge(offTheTop, "left")).toBe(false);
    expect(reachesEdge(offTheTop, "right")).toBe(false);
  });

  it("counts a single strand, because a person looking at the picture would", () => {
    /* One pixel column touching the top: a hair strand off the frame is still
       the crown being cropped, and a bounding-box reading would agree only by
       accident on a shape that leans. */
    const strand = maskOf({ x: 100, y: 0, width: 1, height: 30 });
    expect(reachesEdge(strand, "top")).toBe(true);
  });

  it("treats the band as a band — inside it is touching, outside it is clear", () => {
    const band = edgeBandPx(WIDTH, HEIGHT, "bottom");
    const justInside = maskOf({ x: 80, y: HEIGHT - band, width: 40, height: band });
    const justOutside = maskOf({ x: 80, y: HEIGHT - band - 10, width: 40, height: 5 });
    expect(reachesEdge(justInside, "bottom")).toBe(true);
    expect(reachesEdge(justOutside, "bottom")).toBe(false);
  });

  it("answers no on an empty mask rather than throwing", () => {
    expect(reachesEdge(EMPTY, "top")).toBe(false);
  });
});

describe("isPresent", () => {
  it("counts a real region as present", () => {
    expect(isPresent(maskOf({ x: 10, y: 10, width: 100, height: 100 }))).toBe(true);
  });

  it("reads a scatter of stray pixels as nothing", () => {
    const stray = maskOf({ x: 10, y: 10, width: 10, height: 10 });
    expect(litPixels(stray)).toBe(100);
    expect(100).toBeLessThan(WIDTH * HEIGHT * ABSENCE_FLOOR_FRACTION);
    expect(isPresent(stray)).toBe(false);
  });

  it("reads an empty mask as nothing", () => {
    expect(isPresent(EMPTY)).toBe(false);
  });
});

describe("measureViewFraming — the close-up band, both directions", () => {
  const band = castPackageView("closeUp").band;

  it("NEGATIVE CONTROL: a frame satisfying every rule reads in band", async () => {
    const { reader } = readerOf(IN_BAND_CLOSE_UP);
    const measured = await measureViewFraming({ band, image: FRAME, reader });
    expect(measured.verdict).toBe("inBand");
    expect(measured.readings.every((reading) => reading.held === true)).toBe(true);
  });

  it("POSITIVE CONTROL: a neck and shoulders below the face is out of band, and nothing else moves", async () => {
    /* The same face, pulled back: 190 rows of picture below a 150-row face is
       1.27 face-heights, which on his own frames is a neck and shoulders. */
    const { reader } = readerOf({
      ...IN_BAND_CLOSE_UP,
      face: maskOf({ x: 40, y: 60, width: 120, height: 150 }),
    });
    const measured = await measureViewFraming({ band, image: FRAME, reader });
    expect(measured.verdict).toBe("outOfBand");
    const failed = measured.readings.filter((reading) => reading.held === false);
    expect(failed).toHaveLength(1);
    expect(failed[0]!.rule.must).toBe("roomBelowAtMost");
    expect(failed[0]!.note).toContain("1.27");
  });

  it("POSITIVE CONTROL: the face cut at the bottom is out of band — too tight", async () => {
    const { reader } = readerOf({
      ...IN_BAND_CLOSE_UP,
      face: maskOf({ x: 40, y: 60, width: 120, height: HEIGHT - 60 }),
    });
    const measured = await measureViewFraming({ band, image: FRAME, reader });
    expect(measured.verdict).toBe("outOfBand");
    /* And ONLY the tight bound fails — a frame with no room below the face is
       trivially inside the loose bound, which is what makes the pair a band. */
    const failed = measured.readings.filter((reading) => reading.held === false);
    expect(failed).toHaveLength(1);
    expect(failed[0]!.rule.must).toBe("clearOf");
  });

  it("POSITIVE CONTROL: clear space above the head is out of band — too loose", async () => {
    const { reader } = readerOf({
      ...IN_BAND_CLOSE_UP,
      subject: maskOf({ x: 20, y: 40, width: 160, height: 340 }),
    });
    const measured = await measureViewFraming({ band, image: FRAME, reader });
    expect(measured.verdict).toBe("outOfBand");
    expect(measured.readings.find((reading) => reading.rule.landmark === "subject")!.held).toBe(false);
  });

  it("a landmark it cannot find is NOT a failure — it is an unanswered question", async () => {
    const { reader } = readerOf({ ...IN_BAND_CLOSE_UP, face: EMPTY });
    const measured = await measureViewFraming({ band, image: FRAME, reader });
    expect(measured.verdict).toBe("cannotMeasure");
    expect(measured.readings.find((reading) => reading.rule.landmark === "face")!.held).toBeNull();
  });

  it("a reader that throws is not a verdict, and the reason survives", async () => {
    const { reader } = readerOf({
      ...IN_BAND_CLOSE_UP,
      subject: new Error("429 concurrent_requests_limit"),
    });
    const measured = await measureViewFraming({ band, image: FRAME, reader });
    expect(measured.verdict).toBe("cannotMeasure");
    expect(measured.readings.some((reading) => reading.note.includes("429"))).toBe(true);
  });

  it("cannot-measure outranks out-of-band, so the record can tell them apart", async () => {
    const { reader } = readerOf({
      ...IN_BAND_CLOSE_UP,
      face: EMPTY,
      subject: maskOf({ x: 20, y: 40, width: 160, height: 340 }),
    });
    const measured = await measureViewFraming({ band, image: FRAME, reader });
    expect(measured.verdict).toBe("cannotMeasure");
    expect(measured.readings.some((reading) => reading.held === false)).toBe(true);
  });
});

describe("measureViewFraming — what it asks, at the wire", () => {
  it("asks each landmark once however many rules name it", async () => {
    const { reader, asked } = readerOf({
      subject: maskOf({ x: 20, y: 40, width: 160, height: 300 }),
    });
    /* Both full-length rules name `subject`; one read must answer both. */
    const measured = await measureViewFraming({
      band: castPackageView("backFull").band,
      image: FRAME,
      reader,
    });
    expect(measured.readings).toHaveLength(2);
    expect(asked.filter((entry) => entry.landmark === "subject")).toHaveLength(1);
    expect(measured.landmarksRead).toEqual(["subject"]);
  });

  /**
   * ⚠ EVERY READ IS THE STRICT QUESTION, AND THIS ARM IS THE SCAR.
   *
   * The band's too-loose test began as `absent shoulders`, which is the only
   * predicate that would treat an empty answer as information. Driven on his six
   * real close-ups, `region("shoulders")` was silent on the three frames that
   * have shoulders and answered on the two that do not — so silence from this
   * segmenter meant the opposite of what it looks like. No band asks for silence
   * now, and nothing here may quietly start to.
   */
  it("every landmark is asked the strict question — silence is never a pass", async () => {
    for (const angle of ["closeUp", "backFull", "frontClose"] as const) {
      const { reader, asked } = readerOf(IN_BAND_CLOSE_UP);
      await measureViewFraming({ band: castPackageView(angle).band, image: FRAME, reader });
      expect(asked.filter((entry) => entry.landmark !== "subject").length).toBeGreaterThanOrEqual(0);
      for (const entry of asked) {
        if (entry.landmark === "subject") continue;
        expect(entry.absentIsAnswer, `${angle} asked ${entry.landmark} permissively`).toBe(false);
      }
    }
  });
});

describe("measureViewFraming — the properties the fold rests on", () => {
  it("cutBy and clearOf are exact complements on one frame", async () => {
    /* One mask, two bands that differ only in the word. Whatever the mask is
       doing at that edge, exactly one of the two holds — which is what stops a
       frame answering neither, the defect an earlier two-threshold shape had. */
    for (const y of [0, 1, 3, 4, 5, 20, 100]) {
      const subject = maskOf({ x: 20, y, width: 160, height: 300 });
      const { reader: a } = readerOf({ subject });
      const { reader: b } = readerOf({ subject });
      const clear = await measureViewFraming({
        band: { rules: [{ must: "clearOf", landmark: "subject", edge: "top" }] },
        image: FRAME,
        reader: a,
      });
      const cut = await measureViewFraming({
        band: { rules: [{ must: "cutBy", landmark: "subject", edge: "top" }] },
        image: FRAME,
        reader: b,
      });
      expect([clear.verdict, cut.verdict].sort()).toEqual(["inBand", "outOfBand"]);
    }
  });

  it("a band with no measurable rule reads in band and asks nothing", async () => {
    const { reader, asked } = readerOf({});
    const measured = await measureViewFraming({
      band: castPackageView("sideClose").band,
      image: FRAME,
      reader,
    });
    expect(measured.verdict).toBe("inBand");
    expect(measured.readings).toHaveLength(0);
    expect(asked).toHaveLength(0);
    /* And the half a reader still answers is written down rather than hidden
       inside that pass. */
    expect(castPackageView("sideClose").band.readerRemainder).toBeTruthy();
  });

  it("is a measurement, not a draw: the same frame reads the same every time", async () => {
    const verdicts = new Set<string>();
    for (let run = 0; run < 10; run += 1) {
      const { reader } = readerOf(IN_BAND_CLOSE_UP);
      const measured = await measureViewFraming({
        band: castPackageView("closeUp").band,
        image: FRAME,
        reader,
      });
      verdicts.add(JSON.stringify([measured.verdict, measured.readings.map((r) => r.held)]));
    }
    expect(verdicts.size).toBe(1);
  });
});
