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

import { INK_REGION, PERSON_REGION } from "./inkReferenceCrop";
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
    /* Both of the whole frame — this road has no panels. */
    expect(script.asked.every((one) => one.width === 400 && one.height === 400)).toBe(true);
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
