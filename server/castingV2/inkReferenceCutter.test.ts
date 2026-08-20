/**
 * THE INK CUTTER, DRIVEN END TO END ON REAL PNG BYTES, with a reader that
 * answers from a script instead of from fal.
 *
 * The geometry and the routing table have their own suite. What is proved here
 * is the half that can go wrong invisibly: WHICH questions are asked, of WHICH
 * picture, what is refused, and whether the bytes that come back are the design
 * alone or a photograph of a person wearing the name of one.
 *
 * Three arms exist because a control was missing somewhere else first:
 *
 *   - **the licence is driven at the CLOAKED MAN'S OWN NUMBERS** — 1.80% of a
 *     frame — so this suite goes red the day anybody adds a percentage floor to
 *     "ignore noise". That edit is the one that sends a photographed person
 *     whole to an engine, and no unit test of the pure router alone would catch
 *     it happening on the road.
 *   - **the containment bound is proved at the BYTES**, pixel by pixel, because
 *     `composite({ blend: "dest-in" })` produced four convincing bounding-box
 *     crops during this build's own reading before a magenta overlay showed no
 *     magenta anywhere. A cut that quietly became a rectangle would still look
 *     right at a glance and would still be a person riding to an engine.
 *   - **`couldNotRead` is driven from the LICENCE question's side too**, not
 *     only the ink question's — a reader failure that fell through to
 *     `rideWhole` is the exact shape of the defect
 *     `negative-arm-cannot-find-yes-defects` names, and it would be silent.
 */
import { describe, expect, it } from "vitest";
import sharp from "sharp";

import { INK_PLACEMENTS, inkPlacementEntry } from "../../shared/inkPlacementVocabulary";
import { INK_REGION, PERSON_REGION, sourceRegionWord } from "./inkReferenceCrop";
import { cutInkDesign } from "./inkReferenceCutter";
import { INK_DESIGN_MIN_EDGE } from "./inkUploadDoor";
import type { Mask } from "./maskedComposite";

/**
 * A picture in which every pixel names its own coordinates.
 *
 * `r = x % 256`, `g = y % 256` — so an extract taken from the wrong place does
 * not merely look different, it can be caught at a named pixel. A gradient
 * would have let a few pixels of drift pass as a rounding difference.
 */
async function coordinatePicture(width: number, height: number): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = (y * width + x) * 3;
      raw[at] = x % 256;
      raw[at + 1] = y % 256;
      raw[at + 2] = 128;
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

type Rect = { x: number; y: number; w: number; h: number };

function empty(width: number, height: number): Mask {
  return { data: Buffer.alloc(width * height, 0), width, height };
}

function rectangle(width: number, height: number, rect: Rect): Mask {
  const data = Buffer.alloc(width * height, 0);
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) data[y * width + x] = 255;
  }
  return { data, width, height };
}

/**
 * A DIAMOND inside `rect` — deliberately not a rectangle.
 *
 * The corners of its bounding box are UNLIT, so a cut that silently became a
 * bounding-box crop lights them and the containment arm goes red. A rectangular
 * fixture would agree with the defect.
 */
function diamond(width: number, height: number, rect: Rect): Mask {
  const data = Buffer.alloc(width * height, 0);
  const cx = rect.x + (rect.w - 1) / 2;
  const cy = rect.y + (rect.h - 1) / 2;
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      const inside = Math.abs(x - cx) / (rect.w / 2) + Math.abs(y - cy) / (rect.h / 2) <= 1;
      if (inside) data[y * width + x] = 255;
    }
  }
  return { data, width, height };
}

type Asked = { name: string; width: number; height: number; absentIsAnswer?: boolean };

/**
 * A reader that answers from a script, and RECORDS every question.
 *
 * The record is half the point. "Two segmenter calls per uploaded design" is a
 * claim about spending house money, and `absentIsAnswer` on BOTH is the thing
 * that keeps a reading apart from a failure — both are claims proved by
 * counting and reading the questions, never by reading the code that asks them.
 */
function reader(answer: (input: { name: string; width: number; height: number }) => Mask | Error): {
  region: (input: { image: Buffer; name: string; absentIsAnswer?: boolean }) => Promise<Mask>;
  asked: Asked[];
} {
  const asked: Asked[] = [];
  return {
    asked,
    async region({ image, name, absentIsAnswer }) {
      const meta = await sharp(image).metadata();
      const width = meta.width ?? 0;
      const height = meta.height ?? 0;
      asked.push({ name, width, height, absentIsAnswer });
      const given = answer({ name, width, height });
      if (given instanceof Error) throw given;
      return given;
    },
  };
}

/** Script both questions at once — `null` for either means "found nothing". */
function answers(script: { ink: Rect | Mask | null; person: Rect | Mask | null; shape?: "rect" | "diamond" }) {
  const build = (which: Rect | Mask | null, width: number, height: number): Mask => {
    if (which === null) return empty(width, height);
    if ("data" in which) return which;
    return script.shape === "diamond" ? diamond(width, height, which) : rectangle(width, height, which);
  };
  return ({ name, width, height }: { name: string; width: number; height: number }): Mask => {
    if (name === INK_REGION) return build(script.ink, width, height);
    if (name === PERSON_REGION) return build(script.person, width, height);
    throw new Error(`nothing scripted an answer for "${name}"`);
  };
}

/** The cut, decoded back to RGBA so the bytes themselves can be read. */
async function rgbaOf(bytes: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  expect(info.channels).toBe(4);
  return { data, width: info.width, height: info.height };
}

const FRAME = { width: 400, height: 400 };
/** Comfortably over `INK_DESIGN_MIN_EDGE`, and not square, so w/h cannot swap unseen. */
const DESIGN: Rect = { x: 50, y: 60, w: 300, h: 280 };

describe("population (ii) — a design ON A BODY, which is his own hard case", () => {
  it("cuts the design, and asks exactly two questions of the whole frame with absentIsAnswer on both", async () => {
    const picture = await coordinatePicture(FRAME.width, FRAME.height);
    const script = reader(answers({ ink: DESIGN, person: { x: 0, y: 0, w: 400, h: 400 } }));

    const result = await cutInkDesign({ bytes: picture, reader: script });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cut.route).toBe("cut");
    expect(result.cut.box).toEqual({ left: 50, top: 60, width: 300, height: 280 });
    expect(result.cut.width).toBe(300);
    expect(result.cut.height).toBe(280);
    expect(result.cut.inkPixels).toBe(300 * 280);
    expect(result.cut.personPixels).toBe(400 * 400);

    /* THE STATED COST, counted rather than asserted in prose. */
    expect(script.asked.map((one) => one.name).sort()).toEqual([INK_REGION, PERSON_REGION].sort());
    expect(script.asked).toHaveLength(2);
    /*
      EACH OF THE PICTURE ITS OWN QUESTION IS ASKED OF — asserted at the wire,
      because "the licence is asked of a padded copy" is a claim about an
      outgoing call and nothing near it (ruled fable-1183 §1).

      The INK is asked of her frame, at her size, because its answer is GEOMETRY
      and a mask from any other space would be the wrong-frame class. The LICENCE
      is asked of a canvas twice her edges, because on her own frame the word
      reads ZERO on photographs of tattooed people — measured, three subjects,
      `LICENCE_PAD_FACTOR`.
    */
    const inkAsk = script.asked.find((one) => one.name === INK_REGION);
    const licenceAsk = script.asked.find((one) => one.name === PERSON_REGION);
    expect(inkAsk).toMatchObject({ width: 400, height: 400 });
    expect(licenceAsk).toMatchObject({ width: 800, height: 800 });
    /*
      AND BOTH WITH `absentIsAnswer`. This is the structural half of keeping a
      reading apart from a failure: without it an empty mask arrives as a thrown
      error and a flash sheet is refused as a provider outage.
    */
    expect(script.asked.every((one) => one.absentIsAnswer === true)).toBe(true);
  });

  it("THE PERSON IS NOT IN THE CROP — every opaque pixel is the design's own, proved at the bytes", async () => {
    /*
      THE CONTAINMENT BOUND. The mask is a DIAMOND, so its bounding box has four
      unlit corners; a cut that had silently become a rectangle lights them.

      And the colour of each kept pixel is checked against the coordinate it came
      from, so an extract taken from the wrong offset is caught as a wrong value
      rather than passing as a right size.
    */
    const picture = await coordinatePicture(FRAME.width, FRAME.height);
    const script = reader(
      answers({ ink: DESIGN, person: { x: 0, y: 0, w: 400, h: 400 }, shape: "diamond" }),
    );

    const result = await cutInkDesign({ bytes: picture, reader: script });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const cut = await rgbaOf(result.cut.bytes);
    const box = result.cut.box!;
    expect(cut.width).toBe(box.width);
    expect(cut.height).toBe(box.height);

    const wanted = diamond(FRAME.width, FRAME.height, DESIGN);
    let opaque = 0;
    let leaked = 0;
    let misplaced = 0;
    for (let y = 0; y < cut.height; y += 1) {
      for (let x = 0; x < cut.width; x += 1) {
        const at = (y * cut.width + x) * 4;
        const source = (y + box.top) * FRAME.width + (x + box.left);
        const shouldBeLit = wanted.data[source] > 127;
        if (cut.data[at + 3] === 255) {
          opaque += 1;
          if (!shouldBeLit) leaked += 1;
          if (cut.data[at] !== (x + box.left) % 256 || cut.data[at + 1] !== (y + box.top) % 256) misplaced += 1;
        } else if (shouldBeLit) {
          leaked += 1;
        }
      }
    }
    /* Not "mostly" — exactly. A leak of one pixel of face is still a face. */
    expect(leaked).toBe(0);
    expect(misplaced).toBe(0);
    expect(opaque).toBe(result.cut.inkPixels);
    /*
      THE NEGATIVE CONTROL FOR THIS ARM: the box has strictly more pixels than
      the design does. Without this line a cutter that kept everything would
      satisfy every assertion above except `leaked`, and a fixture whose mask
      happened to fill its box would satisfy that one too.
    */
    expect(opaque).toBeLessThan(box.width * box.height);
  });
});

describe("population (i) and (iii) — nobody is in the picture, so the frame IS the design", () => {
  it("lets a flat sheet ride whole, and the bytes are hers UNCHANGED", async () => {
    const picture = await coordinatePicture(FRAME.width, FRAME.height);
    const script = reader(answers({ ink: null, person: null }));

    const result = await cutInkDesign({ bytes: picture, reader: script });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cut.route).toBe("rideWhole");
    expect(result.cut.box).toBeNull();
    expect(result.cut.width).toBe(400);
    expect(result.cut.height).toBe(400);
    /*
      BYTE IDENTITY, not "an equivalent picture". A re-encode here would break
      what `digest` means on the design row, which is the thing that lets a
      reference whose bytes have moved be refused rather than painted.
    */
    expect(result.cut.bytes.equals(picture)).toBe(true);
  });

  it("still CUTS when the reader found a design and nobody at all — a shape on a flat sheet", async () => {
    /* Row 2 of the table: found/absent. A design with a shape the reader could
       isolate is better carried as its own region even off a sheet of paper. */
    const picture = await coordinatePicture(FRAME.width, FRAME.height);
    const script = reader(answers({ ink: DESIGN, person: null }));

    const result = await cutInkDesign({ bytes: picture, reader: script });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cut.route).toBe("cut");
    expect(result.cut.personPixels).toBe(0);
  });
});

describe("population (iv) — the ghost mannequin, and the row that never softens", () => {
  it("REFUSES a photographed person the reader could isolate no design on", async () => {
    const picture = await coordinatePicture(FRAME.width, FRAME.height);
    const script = reader(answers({ ink: null, person: { x: 0, y: 0, w: 400, h: 400 } }));

    const result = await cutInkDesign({ bytes: picture, reader: script });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe("personWithoutDesign");
    /*
      AND IT NAMES THE ROAD THAT WORKS (fable-1129 §3). The artist who made the
      mannequin mock-up HAS the flat design; telling her the door that opens
      beats an accurate account of the one that shut.
    */
    expect(result.refusal.message).toContain("A flat photo of the design itself works");
  });

  it("⚠ THE LICENCE HAS NO PERCENTAGE FLOOR — the cloaked man refuses at 1.80% of his frame", async () => {
    /*
      THE ARM THIS SUITE EXISTS FOR.

      Measured: `human skin` on a photographed man in a cloak found his FACE and
      nothing else — 17,407 px, 1.80% of the frame. Read as a percentage that
      sits BELOW the 3.2% a different word scored on a sheet of PAPER, so a
      floor of even 1% — added by anyone to "ignore noise" — sends a
      photographed person whole to an engine.

      Driven HERE, on the road, and not only against the pure router: the road
      is where a floor would actually be introduced.
    */
    const picture = await coordinatePicture(FRAME.width, FRAME.height);
    const face: Rect = { x: 170, y: 170, w: 54, h: 54 };
    const facePixels = face.w * face.h;
    /* 2,916 of 160,000 — the same 1.8% shape as the measurement above. */
    expect(facePixels / (FRAME.width * FRAME.height)).toBeCloseTo(0.018, 3);

    const script = reader(answers({ ink: null, person: face }));
    const result = await cutInkDesign({ bytes: picture, reader: script });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe("personWithoutDesign");
  });

  it("⚠ THE PADDED LICENCE, driven on a reader that MODELS the court's own finding", async () => {
    /*
      THE ARM THE FIX EXISTS FOR, and the reason it is shaped like this.

      `fake-reader-must-model-the-measurement`: a double that simply answers
      "person present" discriminates nothing — it would pass with the padding
      removed, which is precisely the regression this must catch. So this reader
      reproduces what the REAL one did, on the property that actually separated
      the readings: **the size of the picture it is handed.**

      Measured (the measurement court, 2026-08-20): `human skin` on the two
      founder photographs read 0 px as uploaded, 3/3, and 464,859 / 765,210 px
      on the same pixels padded, 2/2. This double says exactly that and nothing
      else — zero on her own frame, a person on the padded one.

      With the pad, the fence holds: no isolable design plus a photographed
      person is `personWithoutDesign`, free. **Take the padding out and this
      same test goes green-to-red the right way** — the licence reads zero, the
      route becomes `rideWhole`, and her photograph is what would ride to an
      engine.
    */
    const picture = await coordinatePicture(FRAME.width, FRAME.height);
    const blind = reader(({ name, width, height }) => {
      if (name === INK_REGION) return empty(width, height);
      if (name !== PERSON_REGION) throw new Error(`nothing scripted an answer for "${name}"`);
      const padded = width === FRAME.width * 2 && height === FRAME.height * 2;
      return padded
        ? rectangle(width, height, { x: 0, y: 0, w: width, h: height })
        : empty(width, height);
    });

    const result = await cutInkDesign({ bytes: picture, reader: blind });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe("personWithoutDesign");

    /* And the licence really was the question asked of the bigger picture. */
    expect(blind.asked.find((one) => one.name === PERSON_REGION)).toMatchObject({
      width: FRAME.width * 2,
      height: FRAME.height * 2,
    });
  });

  it("THE SAME READER, WITH A DRAWING'S ANSWER, still rides whole — the pad walls no sheet", async () => {
    /*
      The negative control of the arm above, and it is not optional
      (`misaimed-guard-fails-both-ways`): a licence made more sensitive is a
      licence that can start refusing the most ordinary upload a tattoo customer
      makes. Measured on the real reader, padding a flash sheet and a drawn
      design left both at ZERO — this is that finding as a double: nobody in the
      picture at any size, so the frame rides whole exactly as it did before.
    */
    const picture = await coordinatePicture(FRAME.width, FRAME.height);
    const drawing = reader(({ width, height }) => empty(width, height));

    const result = await cutInkDesign({ bytes: picture, reader: drawing });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cut.route).toBe("rideWhole");
    expect(result.cut.personPixels).toBe(0);
    expect(result.cut.bytes).toEqual(picture);
  });

  it("and ONE PIXEL of skin is enough — the separation is against a structural zero", async () => {
    const picture = await coordinatePicture(FRAME.width, FRAME.height);
    const script = reader(answers({ ink: null, person: { x: 200, y: 200, w: 1, h: 1 } }));

    const result = await cutInkDesign({ bytes: picture, reader: script });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe("personWithoutDesign");
  });
});

describe("the completeness guard — driven from BOTH sides of the same picture", () => {
  /*
    A guard that refuses everything passes its positive arm and is useless. So
    the floor is crossed in both directions on one fixture, one pixel apart.
  */
  it("refuses a cut whose shortest edge is one pixel under the upload door's own floor", async () => {
    const picture = await coordinatePicture(FRAME.width, FRAME.height);
    const script = reader(answers({
      ink: { x: 10, y: 10, w: 300, h: INK_DESIGN_MIN_EDGE - 1 },
      person: { x: 0, y: 0, w: 400, h: 400 },
    }));

    const result = await cutInkDesign({ bytes: picture, reader: script });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe("cutTooSmall");
    expect(result.refusal.message).toContain(String(INK_DESIGN_MIN_EDGE));
  });

  it("lets the same picture through at exactly the floor", async () => {
    const picture = await coordinatePicture(FRAME.width, FRAME.height);
    const script = reader(answers({
      ink: { x: 10, y: 10, w: 300, h: INK_DESIGN_MIN_EDGE },
      person: { x: 0, y: 0, w: 400, h: 400 },
    }));

    const result = await cutInkDesign({ bytes: picture, reader: script });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cut.height).toBe(INK_DESIGN_MIN_EDGE);
  });

  it("a long thin strip of ink cannot pass on its LENGTH", async () => {
    /* The SHORTEST edge, so 390px of a 4px-tall line is still not a design. */
    const picture = await coordinatePicture(FRAME.width, FRAME.height);
    const script = reader(answers({ ink: { x: 5, y: 200, w: 390, h: 4 }, person: null }));

    const result = await cutInkDesign({ bytes: picture, reader: script });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe("cutTooSmall");
  });
});

describe("the refusals — all free, and none of them sharing a sentinel", () => {
  it("refuses unreadable when the bytes are not a picture at all, and never asks a question", async () => {
    const script = reader(answers({ ink: DESIGN, person: null }));

    const result = await cutInkDesign({ bytes: Buffer.from("this is not a picture"), reader: script });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe("unreadable");
    /* House money is not spent on bytes that were never a picture. */
    expect(script.asked).toHaveLength(0);
  });

  it("refuses couldNotRead when the INK question does not answer", async () => {
    const picture = await coordinatePicture(FRAME.width, FRAME.height);
    const script = reader(({ name, width, height }) =>
      name === INK_REGION ? new Error("fal had a bad minute") : empty(width, height));

    const result = await cutInkDesign({ bytes: picture, reader: script });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe("couldNotRead");
  });

  it("⚠ refuses couldNotRead when the LICENCE question is the one that fails — never rideWhole", async () => {
    /*
      THE SILENT DIRECTION. Both masks empty is `rideWhole`, and a licence
      question that THREW would land on the same value if a failure were read as
      an absence — sending a photograph of a person whole to an engine because a
      provider had a bad minute. `absentIsAnswer` keeps them apart at the wire;
      this arm proves the keeping.
    */
    const picture = await coordinatePicture(FRAME.width, FRAME.height);
    const script = reader(({ name, width, height }) =>
      name === PERSON_REGION ? new Error("fal had a bad minute") : empty(width, height));

    const result = await cutInkDesign({ bytes: picture, reader: script });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe("couldNotRead");
  });

  it("refuses wrongSpace rather than resampling a mask that is not in her picture's space", async () => {
    const picture = await coordinatePicture(FRAME.width, FRAME.height);
    const script = reader(({ name }) =>
      name === INK_REGION ? rectangle(200, 200, { x: 10, y: 10, w: 100, h: 100 }) : empty(400, 400));

    const result = await cutInkDesign({ bytes: picture, reader: script });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe("wrongSpace");
  });

  it("refuses a mask that is the right size and NOT one byte per pixel", async () => {
    /*
      A promoted buffer read one byte per pixel does not fail — it silently
      reads a third of a picture and reports success. So the length is proven,
      not the dimensions alone.
    */
    const picture = await coordinatePicture(FRAME.width, FRAME.height);
    const promoted: Mask = { data: Buffer.alloc(400 * 400 * 3, 255), width: 400, height: 400 };
    const script = reader(({ name, width, height }) =>
      name === PERSON_REGION ? promoted : empty(width, height));

    const result = await cutInkDesign({ bytes: picture, reader: script });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe("wrongSpace");
  });

  it("every refusal says nothing was charged, and no two share a sentence", async () => {
    const picture = await coordinatePicture(FRAME.width, FRAME.height);
    const seen = new Map<string, string>();
    const scripts: Array<() => ReturnType<typeof reader>> = [
      () => reader(({ name, width, height }) => (name === INK_REGION ? new Error("no") : empty(width, height))),
      () => reader(answers({ ink: null, person: { x: 0, y: 0, w: 400, h: 400 } })),
      () => reader(answers({ ink: { x: 0, y: 0, w: 8, h: 8 }, person: null })),
      () => reader(({ name }) => (name === INK_REGION ? rectangle(9, 9, { x: 1, y: 1, w: 2, h: 2 }) : empty(400, 400))),
    ];
    for (const make of scripts) {
      const result = await cutInkDesign({ bytes: picture, reader: make() });
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.refusal.message).toContain("Nothing was charged");
      /* Distinct sentences, so a customer can tell "try again" from "try
         another picture" — and so a support reply is not a guess. */
      expect(seen.has(result.refusal.message)).toBe(false);
      seen.set(result.refusal.message, result.refusal.code);
    }
    expect(seen.size).toBe(4);
  });
});

/*
  THE REGION-SCOPED CUT, AT THE WIRE (ruled fable-1158 §2a, roads and
  conditions ruled fable-1172).

  The arithmetic has its own suite and drives every branch of the choice. What
  is proved HERE is the half that spends money and can go wrong invisibly:
  WHICH question is asked, WHEN, what happens when the reader does not answer
  it, and whether the bytes that come back are the piece she meant.

  **The mirrored arm is mandatory** (fable-1172 §2c). A per-side claim that only
  runs one way round passes on a road biased toward the picture's right, and the
  failure looks exactly like a pass — this campaign's own measured trap.
*/
describe("the cut is scoped to a region of her picture", () => {
  const W = 1000;
  const H = 600;
  /* Two sleeves, one in each half, both big enough to BE designs. */
  const onTheLeft: Rect = { x: 60, y: 60, w: INK_DESIGN_MIN_EDGE + 40, h: INK_DESIGN_MIN_EDGE + 40 };
  const onTheRight: Rect = { ...onTheLeft, x: W - onTheLeft.x - onTheLeft.w };

  /**
   * The first two questions, SORTED — because they are asked with
   * `Promise.allSettled` and the recording order is whichever settles first.
   *
   * Found by a sabotage that reddened an arm it had nothing to do with: an
   * ordered assertion over two concurrent calls is a coin flip that passes
   * most of the time, which is the worst kind of green. The THIRD question is
   * positional and stays positional — it is serial, after the routing, and
   * that order is a decision about house money rather than an accident.
   */
  const theTwoMeasuredQuestions = (asked: Asked[]) =>
    asked.slice(0, 2).map((one) => one.name).sort();

  const bothSleeves = (width: number, height: number): Mask => {
    const mask = rectangle(width, height, onTheLeft);
    const other = rectangle(width, height, onTheRight);
    for (let at = 0; at < mask.data.length; at += 1) {
      if (other.data[at]! > 127) mask.data[at] = 255;
    }
    return mask;
  };

  /** A photographed man with ink on both arms — the road's own subject. */
  const twoSleeves = (over: (name: string, width: number, height: number) => Mask | Error | null = () => null) =>
    reader(({ name, width, height }) => {
      const special = over(name, width, height);
      if (special !== null) return special;
      if (name === INK_REGION) return bothSleeves(width, height);
      if (name === PERSON_REGION) return rectangle(width, height, { x: 0, y: 0, w: width, h: height });
      /* Any other name is the third question: the whole frame is his arm, so
         the HALF is the only thing that can separate the two sleeves. */
      return rectangle(width, height, { x: 0, y: 0, w: width, h: height });
    });

  it("ASKS NOTHING EXTRA when no scope is given — the negative control", async () => {
    /*
      The road one commit ago, and it must be byte-identical. An unscoped cut
      asks two questions and cuts the whole ink mask; if this arm ever needs
      changing, the change is a change to every upload that names no region.
    */
    const picture = await coordinatePicture(W, H);
    const scripted = twoSleeves();

    const result = await cutInkDesign({ bytes: picture, reader: scripted });

    expect(result.ok).toBe(true);
    expect(theTwoMeasuredQuestions(scripted.asked)).toEqual([INK_REGION, PERSON_REGION].sort());
    expect(scripted.asked, "an unscoped cut bought a third question").toHaveLength(2);
    expect(result.ok && result.cut.focus, "an unscoped cut described a narrowing").toBeNull();
    /* Both sleeves, so the box spans the frame. */
    expect(result.ok && result.cut.box).toEqual({
      left: onTheLeft.x,
      top: onTheLeft.y,
      width: onTheRight.x + onTheRight.w - onTheLeft.x,
      height: onTheLeft.h,
    });
  });

  it("takes the sleeve in the half she named — BOTH WAYS ROUND, and asks NO lateral question", async () => {
    for (const [half, expected] of [["left", onTheLeft], ["right", onTheRight]] as const) {
      const picture = await coordinatePicture(W, H);
      const scripted = twoSleeves();

      const result = await cutInkDesign({
        bytes: picture,
        reader: scripted,
        scope: { region: "upper arm", half },
      });

      expect(result.ok, `the ${half} arm refused`).toBe(true);
      /* THREE questions, and the third is the region word — asserted at the
         wire, because a contract about what gets SENT is proved on the
         outgoing request (invariant 5). */
      expect(theTwoMeasuredQuestions(scripted.asked)).toEqual([INK_REGION, PERSON_REGION].sort());
      expect(scripted.asked, "the third question was not asked exactly once").toHaveLength(3);
      expect(scripted.asked[2]!.name, "the region question was not the last one").toBe("upper arm");
      /* NOT A LATERAL QUESTION, on the request itself: no side word reached
         the reader, whichever side she named. */
      for (const question of scripted.asked) {
        expect(question.name, "a side word reached the segmenter").not.toMatch(/\b(left|right)\b/);
      }
      /* And the third is asked with `absentIsAnswer`, like its siblings: a
         region a picture does not contain is a READING, never a failure. */
      expect(scripted.asked[2]!.absentIsAnswer).toBe(true);

      expect(result.ok && result.cut.box)
        .toEqual({ left: expected.x, top: expected.y, width: expected.w, height: expected.h });
      expect(result.ok && result.cut.focus)
        .toEqual({ region: "upper arm", half, fellBack: false });
    }
  });

  it("FALLS BACK to the inked half and SAYS SO — BOTH WAYS ROUND", async () => {
    /*
      §2b's free fallback, at the wire. One arm carries the ink, she named the
      other, and what comes back is the inked one WITH `fellBack` — which is
      the flag the sentence she reads is built from. Without it she would be
      shown the right picture under the wrong words.
    */
    for (const [inked, named] of [[onTheRight, "left"], [onTheLeft, "right"]] as const) {
      const picture = await coordinatePicture(W, H);
      const scripted = reader(({ name, width, height }) => {
        if (name === INK_REGION) return rectangle(width, height, inked);
        if (name === PERSON_REGION) return rectangle(width, height, { x: 0, y: 0, w: width, h: height });
        return rectangle(width, height, { x: 0, y: 0, w: width, h: height });
      });

      const result = await cutInkDesign({
        bytes: picture,
        reader: scripted,
        scope: { region: "upper arm", half: named },
      });

      expect(result.ok).toBe(true);
      expect(result.ok && result.cut.focus?.fellBack, `the ${named} ask did not fall back`).toBe(true);
      expect(result.ok && result.cut.focus?.half).toBe(named === "left" ? "right" : "left");
      expect(result.ok && result.cut.box)
        .toEqual({ left: inked.x, top: inked.y, width: inked.w, height: inked.h });
    }
  });

  it("CUTS THE WHOLE DESIGN when the region question goes unanswered — never a refusal", async () => {
    /*
      THE DIRECTION THIS FAILURE MUST FALL IN. The two questions above are the
      licence and refusing on them is right; this one is an improvement to a
      cut we already know how to make. Turning her picture away because an
      optional question timed out would be a wall bought with a nicety.
    */
    const picture = await coordinatePicture(W, H);
    const scripted = twoSleeves((name) => (name === "upper arm" ? new Error("the reader is down") : null));

    const result = await cutInkDesign({
      bytes: picture,
      reader: scripted,
      scope: { region: "upper arm", half: "left" },
    });

    expect(result.ok, "an unanswered region question refused her picture").toBe(true);
    expect(result.ok && result.cut.focus, "an unanswered question still claimed a narrowing").toBeNull();
    expect(result.ok && result.cut.box?.width).toBe(onTheRight.x + onTheRight.w - onTheLeft.x);
  });

  it("DROPS THE SCOPE when the region mask is in the wrong space — never resamples, never refuses", async () => {
    /*
      The two measured questions refuse on a wrong-space mask, because a licence
      read of the wrong picture is not a licence. This one drops instead: the
      cut that remains is the unscoped one, which is a correct cut of her
      design, and refusing it would trade a real design for a narrowing.
    */
    const picture = await coordinatePicture(W, H);
    const scripted = twoSleeves((name, width, height) => (
      name === "upper arm" ? rectangle(width + 7, height, { x: 0, y: 0, w: 10, h: 10 }) : null
    ));

    const result = await cutInkDesign({
      bytes: picture,
      reader: scripted,
      scope: { region: "upper arm", half: "left" },
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.cut.focus).toBeNull();
  });

  it("KEEPS THE WHOLE DESIGN when the region is not in her picture at all — a flash sheet has no arm", async () => {
    /*
      The most ordinary upload a tattoo customer makes, and the row that would
      have been broken by a scope that refused: a sheet of flash with a design
      on it, asked for a place on HER. The region finds nothing, nothing is
      narrowed, and `focus` is null so no sentence claims a half.
    */
    const picture = await coordinatePicture(W, H);
    const scripted = twoSleeves((name, width, height) => (
      name === "upper arm" ? empty(width, height) : null
    ));

    const result = await cutInkDesign({
      bytes: picture,
      reader: scripted,
      scope: { region: "upper arm", half: "left" },
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.cut.focus).toBeNull();
    expect(result.ok && result.cut.box?.width).toBe(onTheRight.x + onTheRight.w - onTheLeft.x);
  });

  it("CUTS THE REGION'S OWN SHAPE, not the box it happens to sit in", async () => {
    /*
      THE ARM THAT SAYS THE SCOPE REACHED THE PIXELS, and it exists because a
      sabotage proved the others could not tell.

      Cutting `ink` instead of `ink ∩ region` changes nothing a bounding box
      can see when the region is a rectangle around the design — every arm
      above went on passing with the scope thrown away one line before the
      alpha was written. So the region here is a DIAMOND inside the ink, whose
      bounding-box corners are lit in the ink mask and dark in the scoped one:
      the corners are the discriminator, read at the bytes.

      Same instrument the containment bound uses one describe above, for the
      same reason — `dest-in` produced four convincing bounding-box crops
      during this build's own reading before anybody looked at a corner.
    */
    const design: Rect = { x: 100, y: 100, w: INK_DESIGN_MIN_EDGE + 60, h: INK_DESIGN_MIN_EDGE + 60 };
    const picture = await coordinatePicture(W, H);
    const scripted = reader(({ name, width, height }) => {
      if (name === INK_REGION) return rectangle(width, height, design);
      if (name === PERSON_REGION) return rectangle(width, height, { x: 0, y: 0, w: width, h: height });
      return diamond(width, height, design);
    });

    const result = await cutInkDesign({
      bytes: picture,
      reader: scripted,
      scope: { region: "upper arm", half: null },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cut = await rgbaOf(result.cut.bytes);
    /* The box is the diamond's, which is the design's — the diamond touches
       all four edges of it. The CORNERS are what differ. */
    expect(result.cut.box).toEqual({ left: design.x, top: design.y, width: design.w, height: design.h });
    for (const [x, y] of [[0, 0], [cut.width - 1, 0], [0, cut.height - 1], [cut.width - 1, cut.height - 1]]) {
      expect(cut.data[(y * cut.width + x) * 4 + 3], `corner ${x},${y} is opaque — the scope never reached the alpha`)
        .toBe(0);
    }
    /* And the middle IS there, so the arm cannot pass on an empty cut. */
    const middle = (Math.floor(cut.height / 2) * cut.width + Math.floor(cut.width / 2)) * 4 + 3;
    expect(cut.data[middle], "the design itself was cut away").toBe(255);
  });

  it("does not buy the third question for a picture that RIDES WHOLE", async () => {
    /*
      The money decision, asserted rather than described: a flat sheet with
      nobody in it has no region to narrow, so the third call is never made.
      Asked beside the other two it would have been spent on every upload of
      this shape.
    */
    const picture = await coordinatePicture(W, H);
    const scripted = reader(({ name, width, height }) => (
      name === INK_REGION || name === PERSON_REGION ? empty(width, height) : empty(width, height)
    ));

    const result = await cutInkDesign({
      bytes: picture,
      reader: scripted,
      scope: { region: "upper arm", half: "left" },
    });

    expect(result.ok && result.cut.route).toBe("rideWhole");
    expect(theTwoMeasuredQuestions(scripted.asked)).toEqual([INK_REGION, PERSON_REGION].sort());
    expect(scripted.asked, "a picture that rides whole bought the third question").toHaveLength(2);
  });
});

describe("the third question's word", () => {
  /*
    THE GUARD THAT MAKES *"never ask a lateral question"* MECHANICAL
    (fable-1172 §2d). Its failure direction is to ask for LESS: `null` means no
    scope, which is the whole ink mask, which is what this road did yesterday.
  */
  it("takes the vocabulary's measured word for a placement it knows", () => {
    expect(sourceRegionWord({ readerWord: "upper arm", phrase: null })).toBe("upper arm");
  });

  it("REFUSES A SIDE WORD, however it is spelled or joined", () => {
    for (const dirty of ["right arm", "left sleeve", "Right-Arm", "arm/left", "his RIGHT shoulder"]) {
      expect(sourceRegionWord({ readerWord: null, phrase: dirty }), dirty).toBeNull();
    }
  });

  it("does not reject a word that merely CONTAINS a side word", () => {
    /* `bright`, `rightmost` — a substring test would have taken these, and the
       cost of a wrong rejection is a narrowing nobody gets. */
    expect(sourceRegionWord({ readerWord: null, phrase: "bright sleeve" })).toBe("bright sleeve");
  });

  it("keeps her own phrase for a placement the vocabulary does not know", () => {
    expect(sourceRegionWord({ readerWord: null, phrase: "  Sleeve " })).toBe("sleeve");
  });

  it("answers null for nothing at all", () => {
    expect(sourceRegionWord({ readerWord: null, phrase: null })).toBeNull();
    expect(sourceRegionWord({ readerWord: null, phrase: "   " })).toBeNull();
  });

  it("NO MEASURED PLACEMENT'S WORD IS LATERAL — the vocabulary itself, swept", () => {
    /*
      The guard above protects the OPEN lane. This arm protects the closed one
      by proving it needs no protection: every measured `readerWord` survives
      the guard unchanged, so a fourth vocabulary entry spelled `right upper
      arm` would redden here rather than silently losing its scope.
    */
    for (const placement of INK_PLACEMENTS) {
      const word = inkPlacementEntry(placement).readerWord;
      expect(sourceRegionWord({ readerWord: word, phrase: null }), placement).toBe(word);
    }
  });
});
