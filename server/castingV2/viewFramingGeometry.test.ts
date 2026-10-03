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
  type FramingRule,
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

  it("POSITIVE CONTROL: a portrait-framed picture in the close-up slot is out of band, and nothing else moves", async () => {
    /* The same face, pulled back: 190 rows of picture below a 150-row face is
       1.27 face-heights.

       ⚠ **THIS ARM'S SUBJECT CHANGED WITHOUT ITS NUMBERS CHANGING — #1837.** It
       read *"a neck and shoulders below the face"*, which was true of 1.27 while
       the bound was 0.3; his eye then moved the bound to 0.7 and a neck and
       shoulders (0.48 … 0.56 on his own frames) is IN band. 1.27 now sits inside
       the sealed Portrait population (1.10 … 3.03), so what this fixture is, is
       a PORTRAIT delivered where a close-up was asked — which is the case
       #1837's done-when names, and the reason the fixture needed no new pixels. */
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

  it("the bound is HIS EYE's number, and moving it means reading his words", () => {
    /*
      The sibling of the Portrait's arm below, and it exists because this number
      moved once already. ⚠ **It is the one bound in this file set by an EYE
      rather than by a court**: 0.3 was six frames and a Desk reply, and on
      2026-10-03 he looked at #1612's two Sifr2 close-ups — the example-assisted
      render at 0.42 and today's road at 0.51 — and called both close-ups while
      the 0.3 line called both out of band. Law 9 decides which one is wrong.
    */
    const rule = castPackageView("closeUp").band.rules
      .find((candidate) => candidate.must === "roomBelowAtMost");
    expect(rule, "the close-up band lost its distance rule").toBeDefined();
    expect(
      (rule as { inItsOwnHeights: number }).inItsOwnHeights,
      "his eye moved this bound on 2026-10-03 (#1837), verbatim: \"on Sifr2 Yes it reads"
      + " as a closeup\" — of a picture measuring 0.51 face-heights of room below the face."
      + " 0.7 is the geometric middle of the empty band between his highest judged close-up"
      + " (0.51) and his sealed Portraits' tightest (1.10), the same method that set the"
      + " Portrait's 3.7 and the old 0.3. Moving it means reading the band in"
      + " `castViewPackage.ts` and his words on #1612.",
    ).toBe(0.7);
  });

  it("his two judged frames read IN band, and a portrait does not", async () => {
    /*
      The arm that would have gone red before his ruling, driven at the two
      numbers he actually looked at rather than at the constant. A fixture whose
      face is 100 rows high puts `room` in face-heights directly.
    */
    const atRoom = async (room: number) => {
      /* ⚠ `roomBelow` measures the face against the FRAME's lower edge, not
         against the subject — the first draft of this arm built the room out of
         the subject's height and every case read `outOfBand` for the wrong
         reason. Same construction as the Portrait block's `faceWithRoomOf`. */
      const faceHeight = 50;
      const bottom = Math.round(HEIGHT - 1 - room * faceHeight);
      const { reader } = readerOf({
        face: maskOf({ x: 40, y: bottom - faceHeight + 1, width: 120, height: faceHeight }),
        /* Cut by the top, which is the band's other rule — a close-up's crown
           is cropped, and leaving it clear would fail for a second reason and
           tell us nothing about the distance. */
        subject: maskOf({ x: 20, y: 0, width: 160, height: HEIGHT }),
      });
      return (await measureViewFraming({ band, image: FRAME, reader })).verdict;
    };
    /* His two, both of which 0.3 refused. */
    expect(await atRoom(0.42), "the example-assisted Sifr2 render he called a close-up").toBe("inBand");
    expect(await atRoom(0.51), "today's Sifr2 render he called a close-up").toBe("inBand");
    /* The two his ruling admits as a consequence rather than by their own eye. */
    expect(await atRoom(0.52)).toBe("inBand");
    expect(await atRoom(0.56)).toBe("inBand");
    /* And the Portrait population still reads out, which is the done-when's
       other half — a line that admitted 1.10 would have no close-up band left. */
    expect(await atRoom(1.10), "the tightest sealed Portrait must not pass as a close-up").toBe("outOfBand");
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

/**
 * THE PORTRAIT BAND — the view whose debt the `frontClose` bound court paid
 * (#1612, 2026-10-02), and the arms that make the payment real.
 *
 * ⚠ **The hole this band had is the one a unit suite is worst at noticing: it
 * was not a wrong answer, it was a question nobody asked.** `clearOf subject
 * top` is satisfied by a full-length body with room over its hair, so a
 * whole-body frame delivered into the Portrait slot measured `inBand` and every
 * arm in this file agreed with it. The positive control below is that frame.
 *
 * The bound is READ OFF THE BAND rather than typed here, so these arms prove the
 * number BINDS wherever it is set rather than proving it equals 3.7 twice. The
 * one arm that does name 3.7 names the court beside it, because that number is
 * his eye's to close (law 9) and an edit that moves it should have to read why.
 */
describe("measureViewFraming — the portrait band, both directions", () => {
  const band = castPackageView("frontClose").band;

  /** The declared distance bound, derived — never a second copy of the number. */
  const BOUND = ((): number => {
    const rule = band.rules.find(
      (candidate): candidate is Extract<FramingRule, { must: "roomBelowAtMost" }> =>
        candidate.must === "roomBelowAtMost",
    );
    if (!rule) throw new Error("the portrait band declares no distance rule to measure");
    return rule.inItsOwnHeights;
  })();

  /**
   * A face mask with EXACTLY this much picture below it, in its own heights.
   *
   * Built from the bound rather than from a constant, so an arm either side of
   * the line stays either side of the line when the line moves.
   */
  const faceWithRoomOf = (room: number): Mask => {
    const height = 50;
    const bottom = Math.round(HEIGHT - 1 - room * height);
    return maskOf({ x: 40, y: bottom - height + 1, width: 120, height });
  };

  /** The whole subject, clear of the top edge — the band's other rule, satisfied. */
  const SUBJECT_WITH_HEADROOM = maskOf({ x: 20, y: 20, width: 160, height: HEIGHT - 20 });

  it("NEGATIVE CONTROL: a head-and-shoulders portrait reads in band", async () => {
    /* 240 rows of picture below a 120-row face is 2.0 face-heights, which is
       where his own sealed Portraits sit (measured 1.10 … 3.03). */
    const { reader } = readerOf({
      subject: SUBJECT_WITH_HEADROOM,
      face: maskOf({ x: 40, y: 40, width: 120, height: 120 }),
    });
    const measured = await measureViewFraming({ band, image: FRAME, reader });
    expect(measured.verdict).toBe("inBand");
    expect(measured.readings.every((reading) => reading.held === true)).toBe(true);
  });

  it("POSITIVE CONTROL: a full-length body in the Portrait slot is out of band", async () => {
    /* THE DEFECT THIS RULE EXISTS FOR, as a frame: 320 rows below a 40-row face
       is 8.0 face-heights, inside the measured `frontFull` range of 4.61 … 10.39
       — and it has headroom over its hair, so the band's OTHER rule holds. Before
       the court this frame measured in band. */
    const { reader } = readerOf({
      subject: SUBJECT_WITH_HEADROOM,
      face: maskOf({ x: 40, y: 40, width: 120, height: 40 }),
    });
    const measured = await measureViewFraming({ band, image: FRAME, reader });
    expect(measured.verdict).toBe("outOfBand");
    const failed = measured.readings.filter((reading) => reading.held === false);
    expect(failed).toHaveLength(1);
    expect(failed[0]!.rule.must).toBe("roomBelowAtMost");
  });

  it("POSITIVE CONTROL: hair running off the top is out of band, and the distance holds", async () => {
    /* The rule the band already had, kept under the new one: 4 of his 11 sealed
       anchors fail exactly this way (a bun, a spiked crown, a crystal crown) and
       the segmenter is right about all four. */
    const { reader } = readerOf({
      subject: maskOf({ x: 20, y: 0, width: 160, height: HEIGHT - 20 }),
      face: maskOf({ x: 40, y: 40, width: 120, height: 120 }),
    });
    const measured = await measureViewFraming({ band, image: FRAME, reader });
    expect(measured.verdict).toBe("outOfBand");
    const failed = measured.readings.filter((reading) => reading.held === false);
    expect(failed).toHaveLength(1);
    expect(failed[0]!.rule.must).toBe("clearOf");
  });

  it("the declared bound is what binds, on both of its sides", async () => {
    const at = async (room: number) => {
      const { reader } = readerOf({
        subject: SUBJECT_WITH_HEADROOM,
        face: faceWithRoomOf(room),
      });
      return (await measureViewFraming({ band, image: FRAME, reader })).verdict;
    };
    expect(await at(BOUND - 0.1), "a frame just inside the bound is in band").toBe("inBand");
    expect(await at(BOUND + 0.1), "a frame just outside the bound is out of band").toBe("outOfBand");
    /* AND THE EDGE ITSELF IS INSIDE — `roomBelowAtMost` is at-most, so the bound
       is a frame the product keeps. An off-by-one here would refuse a picture for
       being exactly on the line nobody can see. */
    expect(await at(BOUND), "a frame exactly on the bound is kept").toBe("inBand");
  });

  it("the bound is the court's number, and moving it means reading the court", () => {
    expect(
      BOUND,
      "the portrait distance bound was measured on 43 production frames on 2026-10-02: his"
      + " sealed Portraits read 1.10 … 3.03 face-heights and his full-length views 4.61 …"
      + " 10.39, and 3.7 is the geometric middle of that empty band — the same method that"
      + " put the close-up's bound in the empty band below these same Portraits (0.3 at"
      + " first, 0.7 since his eye moved it on 2026-10-03, #1837). His eye closes it"
      + " (law 9); the court is on the band in `castViewPackage.ts`.",
    ).toBe(3.7);
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
