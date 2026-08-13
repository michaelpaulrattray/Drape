/**
 * THE CARRIED CROP'S GEOMETRY, driven on real pixels.
 *
 * The fixture is the founder's own #179 recipe, in the shape the production row
 * records it: a 1024×1536 master and a 484×617 `hair` crop cut at (268,134).
 * Those four numbers are read out of production
 * (`casting_reference_library` row 37) rather than invented, because the defect
 * this module fixes was a relationship between exactly those two sizes.
 *
 * Every case here drives real image bytes through sharp. That is deliberate:
 * the near-miss this module carries a scar from was a sharp call answering a
 * different question than it was asked, and a double would have reproduced my
 * misunderstanding rather than the library's behaviour.
 */
import { describe, expect, it } from "vitest";
import sharp from "sharp";

import { padToFrame, studioBackgroundOf } from "./referenceFit";

/** #179's own numbers. */
const FRAME = { width: 1024, height: 1536 };
const BBOX = { x: 268, y: 134, width: 484, height: 617 };

/** A master with a pale corner and a dark subject — the shape of a studio shot. */
async function master(): Promise<Buffer> {
  return sharp({
    create: { width: FRAME.width, height: FRAME.height, channels: 3, background: { r: 217, g: 217, b: 219 } },
  })
    .composite([{
      input: {
        create: { width: 600, height: 900, channels: 3, background: { r: 30, g: 24, b: 20 } },
      },
      left: 200,
      top: 300,
    }])
    .png()
    .toBuffer();
}

const crop = async (width = BBOX.width, height = BBOX.height) => sharp({
  create: { width, height, channels: 3, background: { r: 90, g: 60, b: 40 } },
}).png().toBuffer();

describe("her studio's background, sampled from the master's corner", () => {
  it("reads the CORNER, not the average of the whole photograph", async () => {
    /*
      THE REGRESSION, and it is the whole reason this function exists in its
      current shape. `sharp(bytes).extract(...).stats()` reports statistics of
      the INPUT image and silently ignores the extract in the chain — on the
      founder's real master it returned rgb(200,189,185), byte-identical to the
      whole-image mean, when the corner is ~rgb(217,217,219).

      The fixture has a dark subject on a pale field precisely so the two answers
      are far apart: a corner read gives the pale wall, a whole-image read is
      dragged down by the subject.
    */
    const bytes = await master();
    const background = await studioBackgroundOf(bytes);
    const whole = await sharp(bytes).stats();

    expect(background, "the pale corner, not the darkened average")
      .toEqual({ r: 217, g: 217, b: 219 });
    expect(Math.round(whole.channels[0]!.mean), "the fixture's two answers must actually differ")
      .toBeLessThan(200);
  });

  it("a UNIFORM master is fine — the control must not fire on a legitimate image", async () => {
    /*
      Why the shipped control asserts the corner's SHAPE rather than comparing it
      to the whole-image mean, which is what fable-359 asked to keep: on a
      uniform frame those two are legitimately identical, so the mean test would
      throw on a correct render of a plain backdrop. The shape test cannot.
    */
    const flat = await sharp({
      create: { width: 64, height: 64, channels: 3, background: { r: 200, g: 200, b: 200 } },
    }).png().toBuffer();

    await expect(studioBackgroundOf(flat)).resolves.toEqual({ r: 200, g: 200, b: 200 });
  });
});

describe("a carried crop is padded back to the master's geometry", () => {
  it("goes out at the master's size with the crop at its own recorded position", async () => {
    const padded = await padToFrame({
      crop: await crop(),
      geometry: { bbox: BBOX, frame: FRAME },
      frame: FRAME,
      background: { r: 217, g: 217, b: 219 },
    });

    const meta = await sharp(padded).metadata();
    expect({ width: meta.width, height: meta.height }, "the reference is now the master's size")
      .toEqual(FRAME);

    /*
      AND THE CROP IS WHERE IT WAS CUT FROM, proved by reading pixels rather than
      by trusting the composite call. Padding at the wrong position would keep
      the size fix and put her hair somewhere she never had it — a reference
      that is subtly wrong about WHERE she is, which is worse than one that is
      honestly the wrong size.
    */
    /* The channel count is READ, not assumed — the composite may carry alpha,
       and a reader that assumes three lands on the wrong byte and reports a
       colour nothing in the image has. */
    const { data: raw, info } = await sharp(padded).raw().toBuffer({ resolveWithObject: true });
    const at = (x: number, y: number) => {
      const offset = (y * info.width + x) * info.channels;
      return { r: raw[offset]!, g: raw[offset + 1]!, b: raw[offset + 2]! };
    };
    expect(at(BBOX.x + 2, BBOX.y + 2), "just inside the box is the crop").toEqual({ r: 90, g: 60, b: 40 });
    expect(at(BBOX.x - 2, BBOX.y - 2), "just outside it is her wall").toEqual({ r: 217, g: 217, b: 219 });
    expect(at(4, 4), "and the far corner is her wall").toEqual({ r: 217, g: 217, b: 219 });
  });

  it("REFUSES a crop whose bytes disagree with its own recorded geometry", async () => {
    /*
      The stored box is a claim about the stored pixels, and this is the one
      place both are in hand. Compositing a differently-sized crop at that box
      would reintroduce the exact scale defect this module removes — by way of
      its own fix.
    */
    await expect(padToFrame({
      crop: await crop(300, 400),
      geometry: { bbox: BBOX, frame: FRAME },
      frame: FRAME,
      background: { r: 217, g: 217, b: 219 },
    })).rejects.toThrow(/300×400 but its geometry says 484×617/);
  });

  it("REFUSES a box cut from a differently-sized frame", async () => {
    /* A position only means something inside the frame it was measured in. */
    await expect(padToFrame({
      crop: await crop(),
      geometry: { bbox: BBOX, frame: { width: 512, height: 768 } },
      frame: FRAME,
      background: { r: 217, g: 217, b: 219 },
    })).rejects.toThrow(/does not transfer/);
  });

  it("REFUSES a box that would fall outside the frame", async () => {
    await expect(padToFrame({
      crop: await crop(),
      geometry: { bbox: { ...BBOX, x: FRAME.width - 10 }, frame: FRAME },
      frame: FRAME,
      background: { r: 217, g: 217, b: 219 },
    })).rejects.toThrow(/does not fit inside/);
  });
});
