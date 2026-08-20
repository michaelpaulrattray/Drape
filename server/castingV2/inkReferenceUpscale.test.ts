import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  INK_UPSCALE_FALLBACK,
  INK_UPSCALE_MAX_PASSES,
  INK_UPSCALE_MODEL,
  upscaleToFloor,
} from "./inkReferenceUpscale";
import { INK_DESIGN_MIN_EDGE } from "./inkUploadDoor";

/**
 * THE ENLARGING, DRIVEN DIRECTLY — never through a model that usually behaves
 * (working law 3).
 *
 * The subject is a paid provider call, so every arm here hands `upscaleToFloor`
 * a double for `runFalImageJob` and counts what it was asked for. What the
 * DOUBLE MODELS is the finding rather than a tidier version of it: a real
 * upscaler returns a bigger picture, and the failure this road has to survive
 * is one that returns something no bigger — which is what a "successful" no-op
 * looks like from the outside.
 *
 * The six frames that bought this behaviour are in the module's own docblock;
 * nothing here re-litigates them.
 */

const png = (width: number, height: number): Promise<Buffer> =>
  sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
  }).png().toBuffer();

/**
 * A cut with a real HOLE in it — the fixture family the first ladder did not
 * have (fable-1215 §1c).
 *
 * Left half fully transparent, right half fully opaque, which is the binary
 * alpha `cutOutPixels` actually produces (`mask > 127 ? 255 : 0`). A picture
 * that is 0.0% transparent cannot notice a road that throws transparency away,
 * and all three rungs of the floor court were exactly that.
 */
const holedPng = async (width: number, height: number): Promise<Buffer> => {
  const raw = Buffer.alloc(width * height * 4);
  for (let at = 0; at < width * height; at += 1) {
    const x = at % width;
    raw[at * 4] = 200; raw[at * 4 + 1] = 120; raw[at * 4 + 2] = 60;
    raw[at * 4 + 3] = x < width / 2 ? 0 : 255;
  }
  return sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer();
};

/** Every fully-transparent pixel, counted. */
async function transparentFraction(bytes: Buffer): Promise<number> {
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let clear = 0;
  for (let at = 3; at < data.length; at += 4) if (data[at] === 0) clear += 1;
  return clear / (info.width * info.height);
}

/**
 * A double that scales by `factor`, and says what it was asked.
 *
 * ⚠ **IT DROPS THE ALPHA, BECAUSE THE REAL MODEL DOES.** Measured: `aura-sr`
 * handed a 4-channel cut returns three channels and 0.0% transparency
 * (opus-908 §1, opus-909 §1). A double that preserved the fourth channel would
 * be a tidier version of the provider rather than a model of it, and this arm
 * would pass over the defect it exists to catch.
 */
function upscalerThatGrows(factor: number) {
  const asked: string[] = [];
  const run = (async (input: { endpoint: string; body: Record<string, unknown> }) => {
    asked.push(input.endpoint);
    const source = Buffer.from(String(input.body.image_url).split(",")[1] ?? "", "base64");
    const meta = await sharp(source).metadata();
    const bytes = await sharp(source)
      .resize({
        width: Math.round((meta.width ?? 1) * factor),
        height: Math.round((meta.height ?? 1) * factor),
        fit: "fill",
      })
      .removeAlpha()
      .png()
      .toBuffer();
    return { bytes, contentType: "image/png", requestId: "r", latencyMs: 1 };
  }) as never;
  return { run, asked };
}

describe("the model choice is the ruling, not a preference", () => {
  it("is a faithful super-resolution model and its declared fallback", () => {
    expect(INK_UPSCALE_MODEL).toBe("fal-ai/aura-sr");
    expect(INK_UPSCALE_FALLBACK).toBe("fal-ai/esrgan");
  });

  it("NEVER names a diffusion upscaler — the fidelity prohibition, mechanical", () => {
    /*
      fable-1209 §1: a diffusion refiner invents strokes the customer did not
      draw, and that is forbidden REGARDLESS of how the frame looks. A comment
      saying so is a comment; this is the arm.
    */
    for (const model of [INK_UPSCALE_MODEL, INK_UPSCALE_FALLBACK]) {
      expect(model).not.toMatch(/clarity|diffusion|sd|flux/i);
    }
  });
});

describe("enlarging a cut that is under the floor", () => {
  it("asks the faithful model and returns the REAL dimensions it answered with", async () => {
    const { run, asked } = upscalerThatGrows(4);
    const grown = await upscaleToFloor({
      bytes: await png(183, 259), width: 183, height: 259, apiKey: "k", about: {}, run,
    });

    expect(asked).toEqual([INK_UPSCALE_MODEL]);
    expect(grown).not.toBeNull();
    /* 4x is the MODEL'S ratio and not a target this road chose — the assertion
       is on what came back, which is what gets stored. */
    expect(grown!.width).toBe(732);
    expect(grown!.height).toBe(1036);
    expect(grown!.passes).toBe(1);
    expect(grown!.model).toBe(INK_UPSCALE_MODEL);
    expect(Math.min(grown!.width, grown!.height)).toBeGreaterThanOrEqual(INK_DESIGN_MIN_EDGE);
  });

  it("spends NOTHING on a cut that already clears the floor", async () => {
    const { run, asked } = upscalerThatGrows(4);
    const grown = await upscaleToFloor({
      bytes: await png(720, 390), width: 720, height: 390, apiKey: "k", about: {}, run,
    });

    // The negative control for the whole road: no call, and the bytes untouched.
    expect(asked, "a cut over the floor must not buy a single call").toEqual([]);
    expect(grown!.passes).toBe(0);
    expect(grown!.width).toBe(720);
  });

  it("buys a second pass only while the floor is still unmet, and stops the moment it is", async () => {
    /* A weak upscaler: 2x per pass. 100 -> 200 (still under 256) -> 400. */
    const { run, asked } = upscalerThatGrows(2);
    const grown = await upscaleToFloor({
      bytes: await png(100, 100), width: 100, height: 100, apiKey: "k", about: {}, run,
    });

    expect(asked.length).toBe(2);
    expect(grown!.passes).toBe(2);
    expect(grown!.width).toBe(400);
  });

  it("refuses rather than buying a third — the spend bound is real", async () => {
    /* 1.1x per pass never reaches 256 from 100 inside the bound. */
    const { run, asked } = upscalerThatGrows(1.1);
    const grown = await upscaleToFloor({
      bytes: await png(100, 100), width: 100, height: 100, apiKey: "k", about: {}, run,
    });

    expect(grown, "under the floor after every pass this road will buy is a refusal").toBeNull();
    expect(asked.length).toBe(INK_UPSCALE_MAX_PASSES);
  });

  it("STOPS PAYING when a pass answers no larger than it was asked", async () => {
    /*
      The failure a real provider actually produces: a completed job whose
      picture is the same size. Without this the loop would buy the bound every
      time for a picture that is never going to grow.
    */
    const { run, asked } = upscalerThatGrows(1);
    const grown = await upscaleToFloor({
      bytes: await png(183, 259), width: 183, height: 259, apiKey: "k", about: {}, run,
    });

    expect(grown).toBeNull();
    expect(asked.length, "a no-op pass must not be repeated").toBe(1);
  });
});

describe("THE SHAPE IS OURS — the model contributes detail, never geometry", () => {
  it("gives back FOUR channels with the hole still in it, though the model returned three", async () => {
    const { run } = upscalerThatGrows(4);
    const grown = await upscaleToFloor({
      bytes: await holedPng(100, 100), width: 100, height: 100, apiKey: "k", about: {}, run,
    });

    const meta = await sharp(grown!.bytes).metadata();
    expect(meta.channels, "an enlarged cut with no alpha is a design on a rectangle").toBe(4);
    expect(meta.hasAlpha).toBe(true);
    /* Nonzero rather than a figure: the number is the fixture's, and pinning it
       would be asserting the fixture instead of the behaviour. */
    expect(await transparentFraction(grown!.bytes)).toBeGreaterThan(0);
  });

  it("DERIVES that alpha from the original — the same bytes, scaled, and nothing else", async () => {
    /*
      The derivation itself is the assertion (fable-1215 §1c). The expected
      channel is computed here from the INPUT, independently of the module, and
      compared byte for byte — a percentage would pass for any mask of roughly
      the right size, including one the model invented.
    */
    const source = await holedPng(100, 100);
    const { run } = upscalerThatGrows(4);
    const grown = await upscaleToFloor({
      bytes: source, width: 100, height: 100, apiKey: "k", about: {}, run,
    });

    const expected = await sharp(source)
      .ensureAlpha()
      .extractChannel(3)
      .resize({ width: grown!.width, height: grown!.height, fit: "fill" })
      .raw()
      .toBuffer();
    const actual = await sharp(grown!.bytes)
      .ensureAlpha()
      .extractChannel(3)
      .raw()
      .toBuffer();

    expect(Buffer.compare(actual, expected), "the enlarged cut's alpha is the cut's own alpha").toBe(0);
  });

  it("OVERRIDES an alpha the model supplies — our geometry wins whichever endpoint answered", async () => {
    /*
      `esrgan` has never been called on this road and nobody knows whether it
      keeps a fourth channel. This is why that does not have to be measured: a
      model that returns a WRONG alpha (here, fully opaque) still gets ours.
    */
    const asked: string[] = [];
    const run = (async (input: { endpoint: string; body: Record<string, unknown> }) => {
      asked.push(input.endpoint);
      const from = Buffer.from(String(input.body.image_url).split(",")[1] ?? "", "base64");
      const bytes = await sharp(from)
        .resize({ width: 400, height: 400, fit: "fill" })
        .removeAlpha()
        .ensureAlpha()
        .png()
        .toBuffer();
      return { bytes, contentType: "image/png", requestId: "r", latencyMs: 1 };
    }) as never;

    const grown = await upscaleToFloor({
      bytes: await holedPng(100, 100), width: 100, height: 100, apiKey: "k", about: {}, run,
    });

    expect(await transparentFraction(grown!.bytes),
      "a fully-opaque answer must not become the stored cut's shape").toBeGreaterThan(0);
  });

  it("leaves an opaque cut opaque — the fix takes nothing away from the road it found", async () => {
    const { run } = upscalerThatGrows(4);
    const grown = await upscaleToFloor({
      bytes: await png(100, 100), width: 100, height: 100, apiKey: "k", about: {}, run,
    });

    expect(await transparentFraction(grown!.bytes)).toBe(0);
    expect((await sharp(grown!.bytes).metadata()).channels).toBe(4);
  });
});

describe("the fallback is declared, used, and never silent", () => {
  it("falls back to the second model when the first refuses, and reports which answered", async () => {
    const asked: string[] = [];
    const run = (async (input: { endpoint: string; body: Record<string, unknown> }) => {
      asked.push(input.endpoint);
      if (input.endpoint === INK_UPSCALE_MODEL) throw new Error("fal.ai refused the request (404)");
      const source = Buffer.from(String(input.body.image_url).split(",")[1] ?? "", "base64");
      const bytes = await sharp(source).resize({ width: 732, height: 1036, fit: "fill" }).png().toBuffer();
      return { bytes, contentType: "image/png", requestId: "r", latencyMs: 1 };
    }) as never;

    const grown = await upscaleToFloor({
      bytes: await png(183, 259), width: 183, height: 259, apiKey: "k", about: {}, run,
    });

    expect(asked).toEqual([INK_UPSCALE_MODEL, INK_UPSCALE_FALLBACK]);
    /* WHICH ONE ANSWERED travels out, so a deployment quietly running on the
       fallback is a readable fact rather than an assumption. */
    expect(grown!.model).toBe(INK_UPSCALE_FALLBACK);
  });

  it("refuses when BOTH refuse — and refusal is a null, never a smaller picture", async () => {
    const asked: string[] = [];
    const run = (async (input: { endpoint: string }) => {
      asked.push(input.endpoint);
      throw new Error("fal.ai unreachable");
    }) as never;

    const grown = await upscaleToFloor({
      bytes: await png(183, 259), width: 183, height: 259, apiKey: "k", about: {}, run,
    });

    expect(grown).toBeNull();
    expect(asked).toEqual([INK_UPSCALE_MODEL, INK_UPSCALE_FALLBACK]);
  });
});
