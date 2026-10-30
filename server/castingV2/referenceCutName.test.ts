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

describe("the piece on flat grey", () => {
  it("REPLACES every pixel outside the cut, so no photograph leaves the building", async () => {
    const sharp = (await import("sharp")).default;

    const piece = await pieceOnGrey({ frame: await frame(), mask: square() });

    const raw = await sharp(piece.bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { channels } = raw.info;
    const px = (x: number, y: number): number[] => {
      const at = (y * W + x) * channels;
      return [raw.data[at]!, raw.data[at + 1]!, raw.data[at + 2]!];
    };
    /* Inside the cut: the real photograph. */
    expect(px(1, 1)).toEqual([200, 20, 20]);
    expect(px(2, 2)).toEqual([200, 20, 20]);
    /* Outside it: grey, and NOT the photograph under an alpha channel. */
    expect(px(0, 0)).toEqual([CUT_NAME_BACKDROP.r, CUT_NAME_BACKDROP.g, CUT_NAME_BACKDROP.b]);
    expect(px(5, 5)).toEqual([CUT_NAME_BACKDROP.r, CUT_NAME_BACKDROP.g, CUT_NAME_BACKDROP.b]);
    /* Four pixels of the picture survive and sixty do not. */
    let photograph = 0;
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) if (px(x, y)[0] === 200) photograph += 1;
    }
    expect(photograph).toBe(4);
  });

  it("refuses a cut that is not the picture's size rather than resampling", async () => {
    const wrong: Mask = { data: Buffer.alloc(4 * 4, 255), width: 4, height: 4 };

    await expect(pieceOnGrey({ frame: await frame(), mask: wrong })).rejects.toThrow(
      /refusing rather than resampling/,
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
    expect(asked[0]!.images![0]!.contentType).toBe("image/png");
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
