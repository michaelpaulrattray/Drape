/**
 * NAMING A TAPPED CUT — driven, including the one property that matters most
 * about this road: what LEAVES the building (#14 slice 3a).
 *
 * The engine is a stub, so nothing is bought. What is asserted is the outgoing
 * request (invariant 5) and the bytes that ride on it: the pixels outside the
 * cut must be REPLACED with grey and not covered, because a mask laid over a
 * photograph would be sending a third-party provider the whole photograph of a
 * person.
 */
import { describe, expect, it, vi } from "vitest";

import { JUDGE_FRAME_LONG_EDGE } from "./judgeFrame";
import type { Mask } from "./maskedComposite";
import {
  CUT_NAME_BACKDROP,
  CUT_NAME_CROP_MIN_LONG_EDGE,
  CUT_NAME_CROP_PAD_FLOOR_PX,
  CUT_NAME_CROP_PAD_FRACTION,
  CUT_NAME_PROMPT,
  nameTheCut,
  pieceOnGrey,
} from "./referenceCutName";
import type { TextEngine, TextRequest } from "../providers/types";

const W = 8;
const H = 8;

/** A picture whose every pixel is a recognisable red. */
async function frame(): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp({ create: { width: W, height: H, channels: 3, background: { r: 200, g: 20, b: 20 } } })
    .png()
    .toBuffer();
}

/** A mask holding one 2x2 square at (1,1). */
function square(): Mask {
  const data = Buffer.alloc(W * H, 0);
  for (let y = 1; y <= 2; y += 1) for (let x = 1; x <= 2; x += 1) data[y * W + x] = 255;
  return { data, width: W, height: H };
}

/** An engine that answers with one fixed string and records what it was asked. */
function engineSaying(text: string): { engine: TextEngine; asked: TextRequest[] } {
  const asked: TextRequest[] = [];
  const engine = {
    complete: vi.fn(async (request: TextRequest) => {
      asked.push(request);
      return { text } as any;
    }),
  } as unknown as TextEngine;
  return { engine, asked };
}

/**
 * A BIG frame with a BIG cut, sized so the crop needs no enlarging.
 *
 * ⚠ The 8x8 `frame`/`square` pair cannot carry the pixel assertions any more
 * (#2875): a 2x2 cut crops to 7x7 and is then enlarged to the 384-px floor, and
 * enlarging RESAMPLES — the boundary pixels come back as blends of red and
 * grey, so "count the pixels that are exactly 200" would be measuring sharp's
 * interpolator rather than this function. At 400x400 in 512x512 the crop is
 * 472x472, over the floor, and every pixel is still exactly what was written.
 */
const BIG = 512;
const CUT_FROM = 64;
const CUT_TO = 463;
async function bigFrame(): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp({ create: { width: BIG, height: BIG, channels: 3, background: { r: 200, g: 20, b: 20 } } })
    .png()
    .toBuffer();
}
function bigSquare(): Mask {
  const data = Buffer.alloc(BIG * BIG, 0);
  for (let y = CUT_FROM; y <= CUT_TO; y += 1) {
    for (let x = CUT_FROM; x <= CUT_TO; x += 1) data[y * BIG + x] = 255;
  }
  return { data, width: BIG, height: BIG };
}
/* The margin this crop is owed, from the constants rather than from a number
   typed twice: round(399 * 0.08) + 4 = 36. */
const BIG_PAD =
  Math.round((CUT_TO - CUT_FROM) * CUT_NAME_CROP_PAD_FRACTION) + CUT_NAME_CROP_PAD_FLOOR_PX;
const BIG_SIDE = Math.min(BIG - 1, CUT_TO + BIG_PAD) - Math.max(0, CUT_FROM - BIG_PAD) + 1;

describe("the piece on flat grey", () => {
  it("REPLACES every pixel outside the cut, so no photograph leaves the building", async () => {
    const sharp = (await import("sharp")).default;

    const piece = await pieceOnGrey({ frame: await bigFrame(), mask: bigSquare() });

    const raw = await sharp(piece.bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, channels } = raw.info;
    const px = (x: number, y: number): number[] => {
      const at = (y * width + x) * channels;
      return [raw.data[at]!, raw.data[at + 1]!, raw.data[at + 2]!];
    };
    /* Where the cut sits once the margin is cropped away. */
    const inset = CUT_FROM - Math.max(0, CUT_FROM - BIG_PAD);
    /* Inside the cut: the real photograph. */
    expect(px(inset, inset)).toEqual([200, 20, 20]);
    expect(px(inset + 399, inset + 399)).toEqual([200, 20, 20]);
    /* Outside it: grey, and NOT the photograph under an alpha channel. */
    expect(px(0, 0)).toEqual([CUT_NAME_BACKDROP.r, CUT_NAME_BACKDROP.g, CUT_NAME_BACKDROP.b]);
    expect(px(BIG_SIDE - 1, BIG_SIDE - 1)).toEqual([
      CUT_NAME_BACKDROP.r,
      CUT_NAME_BACKDROP.g,
      CUT_NAME_BACKDROP.b,
    ]);
    /* Exactly the cut's own pixels survive, and not one more. */
    let photograph = 0;
    for (let y = 0; y < raw.info.height; y += 1) {
      for (let x = 0; x < width; x += 1) if (px(x, y)[0] === 200) photograph += 1;
    }
    expect(photograph).toBe(400 * 400);
  });

  it("paints the court's grey, pinned at the VALUE and not at the constant (#2875)", () => {
    /*
      ⚠ FOUND BY SABOTAGE, not by reading. Every other arm in this file checks
      the backdrop against `CUT_NAME_BACKDROP` itself, so moving the constant
      moves both sides of the assertion and nothing goes red — putting `128`
      back survived the whole suite. The number is what the bench measured, so
      the number is what is pinned; a later slice moving it owes a measurement
      and will be told so here.
    */
    expect(CUT_NAME_BACKDROP).toEqual({ r: 150, g: 150, b: 150 });
  });

  it("crops to the piece's own extent plus the measured margin (#2875)", async () => {
    const sharp = (await import("sharp")).default;

    const piece = await pieceOnGrey({ frame: await bigFrame(), mask: bigSquare() });

    const meta = await sharp(piece.bytes).metadata();
    /* 400 wide plus 36 each side = 472, and emphatically not the frame's 512. */
    expect(BIG_PAD).toBe(36);
    expect(meta.width).toBe(BIG_SIDE);
    expect(meta.height).toBe(BIG_SIDE);
    expect(meta.width).toBeLessThan(BIG);
  });

  it("enlarges a piece under the floor rather than posting a speck (#2875)", async () => {
    const sharp = (await import("sharp")).default;

    /* The 2x2 cut in an 8x8 frame: a crop of 7x7, far under the floor. */
    const piece = await pieceOnGrey({ frame: await frame(), mask: square() });

    const meta = await sharp(piece.bytes).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBe(CUT_NAME_CROP_MIN_LONG_EDGE);
    /* THE CONTROL: the big piece is over the floor and is NOT touched, so the
       arm above is measuring the floor and not a resize that always happens. */
    const big = await pieceOnGrey({ frame: await bigFrame(), mask: bigSquare() });
    const bigMeta = await sharp(big.bytes).metadata();
    expect(bigMeta.width).toBe(BIG_SIDE);
    expect(bigMeta.width).toBeGreaterThan(CUT_NAME_CROP_MIN_LONG_EDGE);
  });

  it("refuses a cut that is not the picture's size rather than resampling", async () => {
    const wrong: Mask = { data: Buffer.alloc(4 * 4, 255), width: 4, height: 4 };

    await expect(pieceOnGrey({ frame: await frame(), mask: wrong })).rejects.toThrow(
      /refusing rather than resampling/,
    );
  });

  it("refuses an EMPTY cut rather than naming a blank grey field (#2875)", async () => {
    /* Before the crop this was harmless — an empty mask greyed the whole frame
       and the reader said something useless about nothing. Cropping makes it a
       negative box, so it is now refused by name. */
    const empty: Mask = { data: Buffer.alloc(W * H, 0), width: W, height: H };

    await expect(pieceOnGrey({ frame: await frame(), mask: empty })).rejects.toThrow(
      /the cut is empty/,
    );
  });
});

describe("naming the cut", () => {
  it("sends the court's measured prompt and its own read purpose", async () => {
    const { engine, asked } = engineSaying("leather jacket");

    const name = await nameTheCut({ frame: await frame(), mask: square(), engine });

    expect(name).toBe("leather jacket");
    expect(asked).toHaveLength(1);
    /* ⚠ A PARAPHRASE INVALIDATES THE COURT'S 8-of-8 — so the bytes are pinned. */
    expect(asked[0]!.system).toBe(CUT_NAME_PROMPT);
    expect(asked[0]!.system).toContain("bare noun phrase of one to three words");
    expect(asked[0]!.about).toBe("reference.cutName");
    expect(asked[0]!.images).toHaveLength(1);
    /*
      ⚠ THIS ASSERTED `image/png` UNTIL #2875 AND IT WAS PINNING THE WRONG
      THING. `pieceOnGrey` still emits PNG — that contract is pinned on its own
      below — but what LEAVES is whatever `boundForJudge` kept, and the crop
      changed that answer: a cropped piece re-encodes SMALLER as JPEG, so the
      bound now keeps the JPEG where it used to keep the PNG. The content type
      was never the property worth pinning at the wire; the DIMENSIONS are,
      because they are what says the crop happened at all.
    */
    const sharp = (await import("sharp")).default;
    const piece = await pieceOnGrey({ frame: await frame(), mask: square() });
    expect(piece.contentType).toBe("image/png");
    const posted = await sharp(asked[0]!.images![0]!.bytes).metadata();
    const cropped = await sharp(piece.bytes).metadata();
    expect(posted.width).toBe(cropped.width);
    expect(posted.width).not.toBe(W);
  });

  it("tidies a quoted or stopped answer without inventing one", async () => {
    const { engine } = engineSaying('  "hoop earring."\n');

    await expect(nameTheCut({ frame: await frame(), mask: square(), engine })).resolves.toBe("hoop earring");
  });

  it("shows NO name rather than a sentence when the answer is not a bare noun", async () => {
    const { engine } = engineSaying("It looks like a leather jacket worn over a scarf, probably vintage.");

    await expect(nameTheCut({ frame: await frame(), mask: square(), engine })).resolves.toBeNull();
  });

  it("shows no name when the answer is empty", async () => {
    const { engine } = engineSaying("   ");

    await expect(nameTheCut({ frame: await frame(), mask: square(), engine })).resolves.toBeNull();
  });

  it("fails open when the provider falls over — a tap never looks broken", async () => {
    const engine = {
      complete: vi.fn(async () => {
        throw new Error("502 bad gateway");
      }),
    } as unknown as TextEngine;

    await expect(nameTheCut({ frame: await frame(), mask: square(), engine })).resolves.toBeNull();
  });

  it("shows NO name when the reply was cut off at the ceiling — and its negative control", async () => {
    /* ⚠ THE DANGEROUS CASE, and it is quieter here than anywhere else that
       signal is read: a cut-off name is not a failed parse, it is a SHORTER
       NAME. `leather jack` is a perfectly good bare noun and it is the wrong
       garment. */
    const cut = { text: "leather jack", truncated: true } as any;
    const truncated = {
      complete: vi.fn(async () => cut),
    } as unknown as TextEngine;

    await expect(nameTheCut({ frame: await frame(), mask: square(), engine: truncated })).resolves.toBeNull();

    /* THE CONTROL: the same reply without the flag is still read, so the arm
       above is measuring `truncated` and not the text's shape. */
    const whole = {
      complete: vi.fn(async () => ({ text: "leather jack" }) as any),
    } as unknown as TextEngine;

    await expect(nameTheCut({ frame: await frame(), mask: square(), engine: whole })).resolves.toBe(
      "leather jack",
    );
  });

  it("BOUNDS the frame before posting it — asserted on the bytes that left", async () => {
    /* The derived half of `readerFrameBound.test.ts` only proves this module
       imports the bound; this proves it is APPLIED. A customer's attachment is
       accepted at up to 8 MB and this piece keeps the attachment's own
       dimensions, so the unbounded case is a real multi-megabyte post per tap. */
    const sharp = (await import("sharp")).default;
    const wide = 2800;
    const tall = 120;
    const big = await sharp({
      create: { width: wide, height: tall, channels: 3, background: { r: 200, g: 20, b: 20 } },
    })
      .png()
      .toBuffer();
    const mask = { data: Buffer.alloc(wide * tall, 255), width: wide, height: tall };
    const { engine, asked } = engineSaying("hat");

    await nameTheCut({ frame: big, mask, engine });

    expect(asked).toHaveLength(1);
    const posted = await sharp(asked[0]!.images![0]!.bytes).metadata();
    expect(posted.width).toBeLessThanOrEqual(JUDGE_FRAME_LONG_EDGE);
    expect(posted.width).toBe(JUDGE_FRAME_LONG_EDGE);
  });

  it("buys nothing when the cut cannot be put on grey", async () => {
    const { engine, asked } = engineSaying("hat");
    const wrong: Mask = { data: Buffer.alloc(4 * 4, 255), width: 4, height: 4 };

    await expect(nameTheCut({ frame: await frame(), mask: wrong, engine })).resolves.toBeNull();
    expect(asked).toHaveLength(0);
  });
});
