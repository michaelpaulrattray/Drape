/**
 * THE RIDE-TIME FLOOR, DRIVEN DIRECTLY.
 *
 * Every arm here is about ONE decision — does this picture get enlarged before
 * it goes out — and the fake upscaler is a fake of the MEASUREMENT rather than
 * of the outcome: it answers with a genuinely larger picture, so an arm that
 * passes because the double agreed with the assertion is not available.
 *
 * The wire itself (the dispatch record's geometry, and the stored digest being
 * untouched by any of this) is proved through the production caller in
 * `refineService.test.ts` — a contract about what gets sent is proved on the
 * outgoing request, not on the module that prepares it (working law 5).
 */
import { describe, expect, it } from "vitest";
import sharp from "sharp";

import { inkCarryAtFloor, type InkFloorUpscale } from "./inkRideFloor";
import { INK_DESIGN_MIN_EDGE } from "./inkUploadDoor";

/** A real picture at a real size, because the decision under test is a size. */
const png = (width: number, height: number, grey = 120) => sharp({
  create: { width, height, channels: 4, background: { r: grey, g: grey, b: grey, alpha: 1 } },
}).png().toBuffer();

/**
 * An upscaler that actually enlarges, and RECORDS what it was handed.
 *
 * `factor` is the model's own ratio in production; here it is only large enough
 * to clear the floor in one pass, so an arm that needs two can ask for it.
 */
const growingUpscaler = (factor = 4) => {
  const asked: Array<{ width: number; height: number }> = [];
  const seen: Array<Record<string, unknown>> = [];
  const upscale: InkFloorUpscale = async (cut, about) => {
    asked.push({ width: cut.width, height: cut.height });
    seen.push(about);
    const width = cut.width * factor;
    const height = cut.height * factor;
    return { bytes: await png(width, height, 200), width, height, model: "test:sr", passes: 1 };
  };
  return { upscale, asked, seen };
};

describe("an ink carry on its way to the engine", () => {
  it("UNDER THE FLOOR: goes out enlarged, and it is the small one that was handed over", async () => {
    /*
      The founder's own case, at the size the dispatch record recorded it:
      `sentGeometry: "504x223"` against a 1024x1536 master, 223 on the shortest
      side against a floor of 256 that six paid frames bought.
    */
    const { upscale, asked, seen } = growingUpscaler();
    const native = await png(504, 223);

    const went = await inkCarryAtFloor({
      bytes: native, contentType: "image/png", upscale, about: { slot: "ink:upperChest" },
    });

    expect(asked, "the upscaler saw the crop at its own size").toEqual([{ width: 504, height: 223 }]);
    /* And it was told WHICH render bought it, so the vendor's own refusal and
       fallback lines join to the same operation this one does. */
    expect(seen).toEqual([{ slot: "ink:upperChest" }]);
    expect(Math.min(went.width, went.height)).toBeGreaterThanOrEqual(INK_DESIGN_MIN_EDGE);
    expect(went.width).toBe(2016);
    expect(went.height).toBe(892);
    /* And the bytes on the wire really are the bigger picture, read back off
       the picture rather than off the numbers beside it. */
    const meta = await sharp(went.bytes).metadata();
    expect([meta.width, meta.height]).toEqual([2016, 892]);
  });

  it("OVER THE FLOOR: rides BYTE-IDENTICAL and buys nothing", async () => {
    /*
      The arm that makes the one above mean something. If this road enlarged
      every ink carry it would be spending house money on pictures that never
      needed it — and, worse, running a customer's readable artwork through a
      GAN that admits to inventing a sub-1% rim.
    */
    const { upscale, asked } = growingUpscaler();
    const native = await png(400, 300);

    const went = await inkCarryAtFloor({
      bytes: native, contentType: "image/png", upscale, about: {},
    });

    expect(asked, "no call was bought").toEqual([]);
    expect(went.width).toBe(400);
    expect(went.height).toBe(300);
    /* Not merely "the same size" — the same bytes. A re-encode here would be a
       transport quietly rewriting a reference nobody asked it to touch. */
    expect(went.bytes.equals(native)).toBe(true);
    expect(went.bytes).toBe(native);
  });

  it("EXACTLY ON THE FLOOR rides native — the boundary, stated rather than assumed", async () => {
    const { upscale, asked } = growingUpscaler();
    const native = await png(INK_DESIGN_MIN_EDGE, 1000);

    const went = await inkCarryAtFloor({
      bytes: native, contentType: "image/png", upscale, about: {},
    });

    expect(asked).toEqual([]);
    expect(went.bytes).toBe(native);
  });

  it("keeps asking while the floor is unmet, and stops the moment it is met", async () => {
    /*
      The loop is `upscaleToFloor`'s own and is proved in its suite; what is
      proved HERE is that this module does not second-guess it — one call, and
      whatever came back is what rides. A double that grows too little answers
      the same shape a real refusal does.
    */
    const { upscale, asked } = growingUpscaler(1.2);
    const went = await inkCarryAtFloor({
      bytes: await png(100, 100), contentType: "image/png", upscale, about: {},
    });

    expect(asked).toHaveLength(1);
    /* Still under the floor, and it rides anyway rather than refusing — this is
       transport for a render already paid for, not a door. */
    expect(went.width).toBe(120);
  });

  it("an upscaler that cannot help never fails the render", async () => {
    /*
      `upscaleToFloor` answers null for a refused call, an unanswered one, and
      one that did not grow — all three mean *this cut is still too small*,
      which on a paid render means today's behaviour and a line in the log.
    */
    const native = await png(120, 90);
    const went = await inkCarryAtFloor({
      bytes: native, contentType: "image/png", upscale: async () => null, about: {},
    });

    expect(went.bytes).toBe(native);
    expect([went.width, went.height]).toEqual([120, 90]);
  });

  it("an upscaler that THROWS never fails the render either", async () => {
    /* The transport swallows its own vendor failures; this covers the ones it
       cannot — a sharp throw in the alpha re-attach, an aborted request. */
    const native = await png(120, 90);
    const went = await inkCarryAtFloor({
      bytes: native,
      contentType: "image/png",
      upscale: async () => { throw new Error("the pool was closed"); },
      about: {},
    });

    expect(went.bytes).toBe(native);
    expect([went.width, went.height]).toEqual([120, 90]);
  });

  it("no upscaler on the path at all: rides small, exactly as this road does today", async () => {
    /*
      A deployment with no `FAL_KEY` reaches this with `upscale` absent. The
      answer must be the picture that would have gone out anyway — the rescue is
      the new thing, and a new thing that can take the old road down is worse
      than the old road.
    */
    const native = await png(120, 90);
    const went = await inkCarryAtFloor({ bytes: native, contentType: "image/png", about: {} });

    expect(went.bytes).toBe(native);
    expect([went.width, went.height]).toEqual([120, 90]);
  });

  it("⚠ AN UNMEASURABLE PICTURE IS UNKNOWN, NEVER SMALL — no upscale is bought", async () => {
    /*
      THE ONE THAT MATTERS, and it is the reason zero is handled by name.
      `min(0, 0) < 256` is true, so a floor written the obvious way would buy an
      enlargement for every reference sharp cannot open — one sentinel meaning
      both *absent* and *too small*, which is the shape that has cost this
      codebase a bug before.

      It is also not hypothetical: the refine suite's own harness serves
      distinguishable non-image bytes per key, which is exactly this case.
    */
    const { upscale, asked } = growingUpscaler();
    const native = Buffer.from("crop:casting-v2/ink-delivery/on-her-chest.png");

    const went = await inkCarryAtFloor({
      bytes: native, contentType: "image/png", upscale, about: {},
    });

    expect(asked, "nothing was bought for a picture nobody could measure").toEqual([]);
    expect(went.bytes).toBe(native);
    /* Zero rather than a guess: the dispatch record reads this back as a `null`
       geometry, and a record that stated a size would be inventing evidence. */
    expect([went.width, went.height]).toEqual([0, 0]);
  });
});
