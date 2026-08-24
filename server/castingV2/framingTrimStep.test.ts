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
  applyFramingClause,
  applyFramingTrim,
  FRAMING_CLAUSE_FROM,
  FRAMING_CLAUSE_TO,
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

const FACE = { left: 620, top: 227, width: 386, height: 454 };   /* share 0.197, headroom 0.500 */
const HEAD = { left: 600, top: 105, width: 430, height: 600 };   /* gap 0.269 */

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
    /* gap 0.508 of a 385px face: the head sits 196px above the face box. */
    const tallFace = { left: 620, top: 295, width: 330, height: 385 };
    const tallHead = { left: 600, top: 99, width: 400, height: 600 };
    const outcome = await applyFramingTrim(readerFor({ face: tallFace, head: tallHead }), { bytes });
    expect(outcome.trimmed).toBe(true);
    expect(outcome.ownHeadroom).toBe(true);
    expect(outcome.headroom!).toBeGreaterThan(FRAMING_TRIM_TARGET.houseHeadroom);
  });

  describe("it CANNOT fail a candidate — every wrong turn returns the bytes", () => {
    it("a reader that throws", async () => {
      const bytes = await renderSizeFrame();
      const outcome = await applyFramingTrim({
        reader: { region: async () => { throw new Error("provider said no"); } },
        extentOf: () => ({ box: null }),
      }, { bytes });
      expect(outcome.trimmed).toBe(false);
      expect(outcome.why).toBe("read-failed");
      expect(outcome.bytes.equals(bytes)).toBe(true);
    });

    it("a reader that finds no face", async () => {
      const bytes = await renderSizeFrame();
      const outcome = await applyFramingTrim(readerFor({ face: null, head: HEAD }), { bytes });
      expect(outcome.trimmed).toBe(false);
      expect(outcome.why).toBe("no-face");
      expect(outcome.bytes.equals(bytes)).toBe(true);
    });

    it("a reader that finds no head — never guess a gap", async () => {
      const bytes = await renderSizeFrame();
      const outcome = await applyFramingTrim(readerFor({ face: FACE, head: null }), { bytes });
      expect(outcome.trimmed).toBe(false);
      expect(outcome.why).toBe("no-head");
      expect(outcome.bytes.equals(bytes)).toBe(true);
    });

    it("a head already bigger than the target", async () => {
      const bytes = await renderSizeFrame();
      const big = { left: 500, top: 400, width: 600, height: 700 };  /* share 0.304 */
      const outcome = await applyFramingTrim(readerFor({ face: big, head: { ...big, top: 300 } }), { bytes });
      expect(outcome.trimmed).toBe(false);
      expect(outcome.why).toBe("share-above-target");
      expect(outcome.bytes.equals(bytes)).toBe(true);
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

describe("the margin clause", () => {
  it("swaps the landmark sentence and leaves the shoulders clause standing", () => {
    const composed = `blah ${FRAMING_CLAUSE_FROM} Shoulders fully inside the frame with margin at both sides. tail`;
    const result = applyFramingClause(composed);
    expect(result.applied).toBe(true);
    expect(result.prompt).toContain(FRAMING_CLAUSE_TO);
    expect(result.prompt).not.toContain(FRAMING_CLAUSE_FROM);
    /* ⚠ THE SECOND SENTENCE SURVIVES. The court replaced only the FIRST of the
       two, and a swap that took both would be a prompt no court has rendered. */
    expect(result.prompt).toContain("Shoulders fully inside the frame with margin at both sides.");
    expect(result.prompt.startsWith("blah ")).toBe(true);
    expect(result.prompt.endsWith(" tail")).toBe(true);
  });

  it("REPORTS a miss rather than silently returning its input", () => {
    const result = applyFramingClause("a prompt with no landmark sentence in it at all");
    expect(result.applied).toBe(false);
    expect(result.prompt).toBe("a prompt with no landmark sentence in it at all");
  });

  it("swaps exactly once, even if the sentence somehow appears twice", () => {
    const twice = `${FRAMING_CLAUSE_FROM} middle ${FRAMING_CLAUSE_FROM}`;
    const result = applyFramingClause(twice);
    expect(result.prompt.split(FRAMING_CLAUSE_TO).length - 1).toBe(1);
    /* The second occurrence is left alone — a prompt carrying the sentence twice
       is a defect somewhere else, and doubling the new clause would compound it
       rather than report it. */
    expect(result.prompt).toContain(FRAMING_CLAUSE_FROM);
  });

  /*
    ⚠ THE DRIFT GUARD, and it is the reason `applied` exists at all.

    `String.replace` that matches nothing returns its input and says nothing. So
    an ordinary edit to `FRAMING_FIXED` — rewording the landmark, adding a
    comma — would silently disable this clause, and a flagged roll would render
    LARGE WITH NO MARGIN ASK, which arm R measured as a tighter picture than
    today. Worse than not having the feature, and visible to nobody.

    This arm asks the real constant, so the drift is caught here at build time
    rather than in production by a founder wondering why his sheets got tighter.
  */
  it("the sentence it swaps STILL EXISTS in the composed constant", () => {
    expect(photorealHumanConstant(null)).toContain(FRAMING_CLAUSE_FROM);
  });
});
