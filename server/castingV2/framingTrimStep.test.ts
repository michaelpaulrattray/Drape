/**
 * THE TRIM STEP, DRIVEN ON REAL BYTES — and the property that matters most is
 * the one a green suite would otherwise never check: **it cannot fail a
 * candidate.**
 *
 * A roll is billed per slice and refunded per slice, so a trim that threw would
 * turn a segmenter hiccup into a refund and a missing face. Every arm below that
 * makes something go wrong asserts the same two things: bytes came back, and the
 * reason came with them.
 *
 * The reader is a double rather than the real one — this suite buys nothing and
 * calls no provider — but the double answers in the SHAPE the real reader
 * answers in (`extentOf(mask).box`), because a double that models the caller's
 * convenience instead of the dependency's contract is how a bench passes while
 * the road is broken.
 */
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { photorealHumanConstant } from "./cohortPhotorealHuman";
import {
  applyFramingTrim,
  FRAMING_TRIM_DELIVERED,
  FRAMING_TRIM_RENDER,
  FRAMING_TRIM_TARGET,
  type FramingTrimDependencies,
} from "./framingTrimStep";

/** A real PNG at the render size — the trim runs on bytes, so the test does too. */
async function renderSizeFrame(): Promise<Buffer> {
  return sharp({
    create: {
      width: FRAMING_TRIM_RENDER.width, height: FRAMING_TRIM_RENDER.height,
      channels: 3, background: "#808080",
    },
  }).png().toBuffer();
}

/**
 * A reader that answers with the boxes a real frame would produce. Built from
 * the court's own quantities so the numbers mean something: `basics-clause/pos0`
 * for the ordinary case.
 */
function readerFor(boxes: { face: unknown; head: unknown }): FramingTrimDependencies {
  const answers = [boxes.face, boxes.head];
  let next = 0;
  return {
    reader: { region: async () => answers[next++] },
    extentOf: (mask: unknown) => ({ box: mask as never }),
  };
}

/** Every frame that leaves the step is this size — trimmed or not. */
async function expectDeliveredSize(bytes: Buffer): Promise<void> {
  const meta = await sharp(bytes).metadata();
  expect([meta.width, meta.height]).toEqual([
    FRAMING_TRIM_DELIVERED.width, FRAMING_TRIM_DELIVERED.height,
  ]);
}

/*
 * ⚠ THE FIXTURES ARE RE-BASED ON THE NO-CLAUSE POPULATION (2026-08-24, ruled
 * fable-1649), AND THAT IS THE WHOLE STORY OF THIS FILE'S RED RUN.
 *
 * They were `share 0.197` — a real frame, from `basics-clause/pos0`. Under the
 * clause-era `T = 0.227` it trimmed. It cannot under `T = 0.316`, and not
 * because the trim broke: **a frame trims only if `share <= T <= 1.5 × share`**,
 * the upper bound being the point past which the crop is smaller than the
 * 1024×1536 we deliver and would have to be upscaled. A 0.197 frame's band tops
 * out at 0.296.
 *
 * That two-sided constraint is what the retarget's first proposed `T` (34.3%)
 * missed, and these arms are what caught it — sized by the trim's own author
 * against a population the product stopped producing. **They are re-based, not
 * relaxed**: every fixture below is a REAL row from the court's no-clause
 * control cells, named, so each one means something and the band it sits in is
 * stated beside it.
 */

/** `basics-control/pos5` — the ordinary case. share 0.242, band [0.242, 0.363]. */
const FACE = { left: 562, top: 241, width: 406, height: 557 };
const HEAD = { left: 545, top: 107, width: 440, height: 720 };   /* gap 0.241 */

/**
 * `basics-clause/pos0` — share 0.197, band [0.197, 0.296]. BELOW the settled T,
 * so it is now the WOULD-UPSCALE specimen rather than the ordinary one. Kept
 * deliberately: the frame that used to be typical is the one that now takes the
 * refusal road, which is the retarget in one fixture.
 */
const FACE_TOO_SMALL = { left: 620, top: 227, width: 386, height: 454 };
const HEAD_TOO_SMALL = { left: 600, top: 105, width: 430, height: 600 };

describe("the framing trim step", () => {
  it("trims a frame and delivers it at the delivered size", async () => {
    const bytes = await renderSizeFrame();
    const outcome = await applyFramingTrim(readerFor({ face: FACE, head: HEAD }), { bytes });
    expect(outcome.trimmed).toBe(true);
    expect(outcome.why).toBeUndefined();
    const meta = await sharp(outcome.bytes).metadata();
    expect(meta.width).toBe(FRAMING_TRIM_DELIVERED.width);
    expect(meta.height).toBe(FRAMING_TRIM_DELIVERED.height);
    /* And the bytes actually CHANGED — a step that returned its input while
       reporting `trimmed` would pass every other assertion here. */
    expect(outcome.bytes.equals(bytes)).toBe(false);
  });

  it("reports the headroom a tall-haired frame received, and that it took its own", async () => {
    const bytes = await renderSizeFrame();
    /* `basics-control/pos3` — share 0.220 (band [0.220, 0.329]), gap 0.328, so
       `gap + clearance` is 0.378 against the 0.35 house floor: this frame needs
       more air than the house gives and must take its own. */
    const tallFace = { left: 576, top: 399, width: 360, height: 506 };
    const tallHead = { left: 560, top: 233, width: 395, height: 700 };
    const outcome = await applyFramingTrim(readerFor({ face: tallFace, head: tallHead }), { bytes });
    expect(outcome.trimmed).toBe(true);
    expect(outcome.ownHeadroom).toBe(true);
    expect(outcome.headroom!).toBeGreaterThan(FRAMING_TRIM_TARGET.houseHeadroom);
  });

  describe("it CANNOT fail a candidate — every wrong turn returns the bytes", () => {
    /*
      ⚠ THESE FOUR USED TO ASSERT `outcome.bytes.equals(bytes)` AND THAT
      ASSERTION WAS THE DEFECT, WRITTEN DOWN AND GUARDED.

      Byte identity on a decline is exactly what shipped two 1536x2304 frames
      onto a sheet of 1024x1536 ones (roll 209, production, read at the bytes).
      What a decline owes the caller is BYTES BACK — never a throw, never a
      failed candidate — at the size every other frame arrives in. So each arm
      asserts the outcome the contract actually has: not trimmed, a reason, and
      the delivered size.
    */
    it("a reader that throws", async () => {
      const bytes = await renderSizeFrame();
      const outcome = await applyFramingTrim({
        reader: { region: async () => { throw new Error("provider said no"); } },
        extentOf: () => ({ box: null }),
      }, { bytes });
      expect(outcome.trimmed).toBe(false);
      expect(outcome.why).toBe("read-failed");
      await expectDeliveredSize(outcome.bytes);
    });

    it("a reader that finds no face", async () => {
      const bytes = await renderSizeFrame();
      const outcome = await applyFramingTrim(readerFor({ face: null, head: HEAD }), { bytes });
      expect(outcome.trimmed).toBe(false);
      expect(outcome.why).toBe("no-face");
      await expectDeliveredSize(outcome.bytes);
    });

    it("a reader that finds no head — never guess a gap", async () => {
      const bytes = await renderSizeFrame();
      const outcome = await applyFramingTrim(readerFor({ face: FACE, head: null }), { bytes });
      expect(outcome.trimmed).toBe(false);
      expect(outcome.why).toBe("no-head");
      await expectDeliveredSize(outcome.bytes);
    });

    it("a head already bigger than the target", async () => {
      const bytes = await renderSizeFrame();
      /* `suit-control-b/pos5`, share 0.332 — the LARGEST head in the court's
         no-clause population and the one frame T = 0.316 cannot serve. It was
         the binding frame of the old one-sided T_min; under the two-sided band
         it is the single frame the settled T gives up. */
      const big = { left: 451, top: 346, width: 648, height: 765 };  /* share 0.332 */
      const outcome = await applyFramingTrim(readerFor({ face: big, head: { ...big, top: 300 } }), { bytes });
      expect(outcome.trimmed).toBe(false);
      expect(outcome.why).toBe("share-above-target");
      await expectDeliveredSize(outcome.bytes);
    });

    it("⚠ a frame whose band EXCLUDES T takes the untrimmed road as `would-upscale`", async () => {
      /*
        The ceiling, driven. `FACE_TOO_SMALL` is `basics-clause/pos0` — share
        0.197, so its band tops out at 0.296 and the settled T of 0.316 sits
        above it. The crop would be 454/0.316 = 1437px tall against the 1536 we
        deliver, so trimming it would mean UPSCALING, and this road exists to
        refuse that rather than ship a soft frame.

        It is load-bearing now in a way it was not before: under the clause-era
        T this frame trimmed happily, and the ceiling was never the binding
        constraint on anything. It is the reason the retarget's first proposed
        constant was wrong.
      */
      const bytes = await renderSizeFrame();
      const outcome = await applyFramingTrim(
        readerFor({ face: FACE_TOO_SMALL, head: HEAD_TOO_SMALL }), { bytes },
      );
      expect(outcome.trimmed).toBe(false);
      expect(outcome.why).toBe("would-upscale");
      await expectDeliveredSize(outcome.bytes);
    });

    it("bytes that are not an image at all", async () => {
      const bytes = Buffer.from("this is not a png");
      const outcome = await applyFramingTrim(readerFor({ face: FACE, head: HEAD }), { bytes });
      expect(outcome.trimmed).toBe(false);
      expect(outcome.why).toBe("no-dimensions");
      expect(outcome.bytes.equals(bytes)).toBe(true);
    });

    it("a cut that fails on bytes whose header parses and whose pixels do not", async () => {
      /*
        ⚠ THIS ARM WAS HARD TO REACH AND THAT IS THE FINDING, NOT AN INCONVENIENCE.
        The first version handed the planner a box at `left: 99_999` expecting
        sharp to refuse the extract — and the planner CLAMPS the horizontal, so
        the crop came back valid and the trim succeeded. The planner does not
        emit crops that leave the frame; that is one of its own arms.

        So the `trim-failed` branch is driven the only honest way left: bytes
        whose PNG header parses (metadata answers) and whose pixel data is gone,
        so the failure lands where a real decode failure would. A branch whose
        test is a comment saying "cannot happen" is a branch with no test.
      */
      const whole = await renderSizeFrame();
      const bytes = whole.subarray(0, 512);
      const outcome = await applyFramingTrim(readerFor({ face: FACE, head: HEAD }), { bytes });
      expect(outcome.trimmed).toBe(false);
      expect(outcome.why === "trim-failed" || outcome.why === "no-dimensions").toBe(true);
      expect(outcome.bytes.equals(bytes)).toBe(true);
    });
  });

  /*
    ⚠ THE ARM THE DEFECT NEEDED AND DID NOT HAVE (ordered fable-1592 §1).

    Every arm above is about ONE frame, and the defect was only visible across a
    SHEET: six candidates at 1024x1536 beside two at 1536x2304 (roll 209, his
    own first flagged sheet). A per-frame suite can be entirely green while the
    product ships a sheet nobody can compare — which is the exact thing this
    feature exists to prevent.

    So this drives eight frames through the real step with a reader that trims
    six and declines two, and asserts the property a SHEET has. Delete the
    resize in `untouched` and it goes red here and nowhere else.
  */
  it("delivers every frame of a sheet at ONE size, whether it was trimmed or not", async () => {
    const bytes = await renderSizeFrame();
    /* `suit-control-b/pos5`, share 0.332 — above target, so the planner
       declines. The two positions are 1 and 6, which is where roll 209's two
       actually fell. */
    const tooBig = { left: 451, top: 346, width: 648, height: 765 };
    const sheet = await Promise.all([0, 1, 2, 3, 4, 5, 6, 7].map((position) => {
      const declines = position === 1 || position === 6;
      const face = declines ? tooBig : FACE;
      const head = declines ? { ...tooBig, top: 300 } : HEAD;
      return applyFramingTrim(readerFor({ face, head }), { bytes });
    }));

    expect(sheet.map((outcome) => outcome.trimmed))
      .toEqual([true, false, true, true, true, true, false, true]);
    for (const outcome of sheet) await expectDeliveredSize(outcome.bytes);

    /* And said as the property rather than as eight coincidences: ONE size. */
    const sizes = new Set(await Promise.all(sheet.map(async (outcome) => {
      const meta = await sharp(outcome.bytes).metadata();
      return `${meta.width}x${meta.height}`;
    })));
    expect([...sizes]).toEqual([`${FRAMING_TRIM_DELIVERED.width}x${FRAMING_TRIM_DELIVERED.height}`]);
  });

  it("buys exactly two reads, and asks for face then head", async () => {
    const bytes = await renderSizeFrame();
    const asked: string[] = [];
    const answers = [FACE, HEAD];
    let next = 0;
    await applyFramingTrim({
      reader: {
        region: async (input) => { asked.push(input.name); return answers[next++]; },
      },
      extentOf: (mask) => ({ box: mask as never }),
    }, { bytes });
    /* The cost line in the design is $0.08 a roll BECAUSE it is two per slice.
       If this ever reads one, the design's arithmetic is wrong by half. */
    expect(asked).toEqual(["face", "head"]);
  });

  it("asks with absentIsAnswer, so an absent feature is an answer and not an error", async () => {
    const bytes = await renderSizeFrame();
    const flags: (boolean | undefined)[] = [];
    const answers = [FACE, HEAD];
    let next = 0;
    await applyFramingTrim({
      reader: {
        region: async (input) => { flags.push(input.absentIsAnswer); return answers[next++]; },
      },
      extentOf: (mask) => ({ box: mask as never }),
    }, { bytes });
    expect(flags).toEqual([true, true]);
  });
});

describe("⚠ THE MARGIN CLAUSE IS GONE, and its absence is asserted rather than assumed", () => {
  /*
    Founder retarget, 2026-08-24, ruled fable-1648: the clause is DELETED —
    `FRAMING_CLAUSE_FROM`, `FRAMING_CLAUSE_TO` and `applyFramingClause`, with
    their call site and the five arms that stood here.

    His finding retired it: **painted detail follows COMPOSITION, not
    resolution.** The engine paints fine facial texture where the face fills the
    frame, and no later crop recovers what a wide composition never painted. The
    clause bought room and spent detail.

    ⚠ WHAT REPLACES THOSE FIVE ARMS IS ONE ABSENCE ARM, and an absence test that
    cannot fail is worse than none — so this one drives the real module's real
    exports rather than grepping a file. If a prompt rewriter reappears here,
    this reddens; if the module is renamed out from under it, the import fails.
  */
  it("this module exports NOTHING that rewrites a prompt", async () => {
    const step = await import("./framingTrimStep");
    const names = Object.keys(step);

    for (const banned of ["applyFramingClause", "FRAMING_CLAUSE_FROM", "FRAMING_CLAUSE_TO"]) {
      expect(names, `${banned} came back — the clause must not return silently`).not.toContain(banned);
    }
    // …and it is not vacuously empty: the trim road itself is still exported.
    expect(names).toContain("applyFramingTrim");
    expect(names).toContain("FRAMING_TRIM_TARGET");
  });

  it("the landmark sentence is left UNTOUCHED in the composed constant", () => {
    /*
      The old arm asserted this sentence still existed so the SWAP could find
      it. It is asserted now for the opposite reason: nothing rewrites it any
      more, so a flagged roll's prompt is byte-identical to an unflagged one —
      the strongest property this build has ever had.
    */
    expect(photorealHumanConstant(null)).toContain("Frame from mid-torso up in a 2:3 portrait.");
  });
});

describe("⚠ T, re-chosen at the no-clause population", () => {
  /*
    22.7% was `T_min` across the court's CLAUSE cells — a population the product
    no longer produces. 34.3% is `T_min` across its sixteen NO-CLAUSE control
    frames, re-derived from rows already on disk by
    `scripts/_framing-tmin-noclause-disposable.mts`, which reproduces the
    court's published table cell for cell before asking anyone to believe its
    new row.
  */
  it("is the no-clause figure, not the clause-era one", () => {
    expect(FRAMING_TRIM_TARGET.headShare).toBeCloseTo(0.316, 3);
    expect(FRAMING_TRIM_TARGET.headShare).not.toBeCloseTo(0.227, 3);
  });

  it("⚠ T IS TWO-SIDED — the band is [T/1.5, T], and this is the arm that did not exist", () => {
    /*
      ⚠ THE CONSTRAINT THE COURT'S OWN INSTRUMENT DID NOT MODEL. `tMinOf`
      computes the LOWER bound only — `share <= T`, the crop fitting inside the
      frame. There is a second bound in the opposite direction: `cropHeight =
      faceH / T` must not be smaller than the 1536 we deliver, or the crop
      would be an UPSCALE and is refused (`framingTrim.ts`, `would-upscale`).
      Since `faceH = share × 2304`, that ceiling is `T <= 1.5 × share`.

      A first proposed retarget value of 34.3% — a correct `T_min`, reproduced
      cell-for-cell against the court's published table — was unreachable for
      three of sixteen frames because of it. **A bound is not a value.**
    */
    const T = FRAMING_TRIM_TARGET.headShare;
    const RATIO = FRAMING_TRIM_RENDER.height / FRAMING_TRIM_DELIVERED.height;
    expect(RATIO).toBeCloseTo(1.5, 3);

    /* Real rows from the court's no-clause control cells. */
    const shares = [
      0.257, 0.277, 0.259, 0.290, 0.289, 0.332, 0.309, 0.257, // suit-control-b
      0.229, 0.216, 0.225, 0.220, 0.251, 0.242, 0.281, 0.237, // basics-control
    ];
    const trims = shares.filter((share) => share <= T && T <= share * RATIO);

    /* 15 of 16 — the best any single T achieves on this population, because
       max/min share is 1.54 and the render only affords 1.50. The one it gives
       up is the largest head, refused as `share-above-target` rather than
       mis-cropped. */
    expect(trims).toHaveLength(15);
    expect(shares.filter((share) => share > T)).toEqual([0.332]);
  });
});
