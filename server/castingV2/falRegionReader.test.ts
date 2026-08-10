import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LANDMARK_OF_ACCESSORY } from "./accessoryKinds";
import { createFalRegionReader } from "./falRegionReader";
import { MaskError } from "./maskGeometry";
import type { Mask } from "./maskedComposite";

/** The reader's own singularisation, restated only where a test must predict it. */
const singularOfRegion = (name: string): string => (name === "eyes" ? "eye" : name.replace(/s$/, ""));

/**
 * WHAT THE READER MUST DO WITH BYTES THAT ARE NOT A PICTURE.
 *
 * The specimen is real and it cost a whole sweep (opus-052 §3): masters fetched
 * from a bucket base that answers unknown keys with the app's own HTML index at
 * HTTP 200, handed straight to this reader with `absentIsAnswer: true`. The
 * caller's `.catch(() => null)` turned the resulting mess into a coverage of
 * zero, and zero coverage reads as *this face wears no glasses*. Thirty faces
 * were declared bare on the strength of thirty error pages.
 *
 * `absentIsAnswer` is the dangerous door because it is the only one that turns
 * a failed reading into a confident negative. So the guard sits at the reader's
 * entrance, before any provider call: a question about a picture is refused
 * unless it is asked of one, and it is refused by name.
 */
const APP_INDEX_HTML = Buffer.from(
  '<!DOCTYPE html>\n<html lang="en">\n  <head><title>Drape</title></head>\n',
  "utf8",
);

/**
 * A real 1×1 PNG, not a magic-byte stub — the absent path sizes the empty mask
 * with sharp, so the positive control has to be a picture all the way down.
 */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("falRegionReader refuses a question asked of a document", () => {
  it("refuses an HTML error page even when absence is an acceptable answer", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const reader = createFalRegionReader({ apiKey: "test-key" });

    const error = await reader
      .region({ image: APP_INDEX_HTML, name: "glasses", absentIsAnswer: true })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(MaskError);
    expect((error as Error).message).toContain('asked "glasses"');
    expect((error as Error).message).toContain("an HTML page");
    /* The half that fails on the code this was written against: the refusal
       happens BEFORE the provider is paid to look at a web page. */
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses the same bytes on the subject and landmark doors too", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const reader = createFalRegionReader({ apiKey: "test-key" });

    await expect(reader.subject({ image: APP_INDEX_HTML }))
      .rejects.toBeInstanceOf(MaskError);
    await expect(reader.landmark({ image: APP_INDEX_HTML, name: "left ear" }))
      .rejects.toBeInstanceOf(MaskError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("lets a real picture through to the provider — the guard is not a wall", async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ masks: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchSpy);
    const reader = createFalRegionReader({ apiKey: "test-key" });

    /* No masks and absence permitted: the honest empty answer, which is the
       behaviour a removal depends on and must survive the new guard. */
    const mask = await reader.region({ image: PNG, name: "glasses", absentIsAnswer: true });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(mask.data.every((value) => value === 0)).toBe(true);
    expect(mask.width).toBeGreaterThan(0);
  });
});

/**
 * BOTH SIDES OF A SYMMETRICAL FEATURE, DRIVEN DIRECTLY.
 *
 * # The defect these are written against, in its own numbers
 *
 * The bilateral branch used to ask SAM 3 *"left eye"* and *"right eye"* and union
 * the two answers. Measured through this module's own code path on the founder's
 * production frames v#147 and v#156
 * (`scripts/prove-bilateral-laterality-disposable.mts`):
 *
 *   `"right eye"` returned ZERO masks on both frames, both runs, so the union the
 *   caller received was ONE EYE — 695px and 727px, every pixel on one side of her
 *   midline, while the same frames cut in half and asked the plain noun read
 *   518/937 and 581/1019. On v#156 BOTH `"eyebrow"` calls returned zero, so the
 *   union was EMPTY — which with `absentIsAnswer` is the sentence *"she has no
 *   eyebrows"* about a face whose brows measure 1429px and 1593px.
 *
 * Four paid refine facets route here (`eye.colour`, `eye.shape`, `lashes` →
 * `eyes`; `brows` → `eyebrows`), so the shipped consequence was a customer paying
 * for both eyes and receiving one.
 *
 * # Why these are stubbed rather than driven at a provider
 *
 * A guard whose only test runs through a model that usually behaves is untested
 * (working law 3). The fake below is not a convenience — it is the measured
 * behaviour of SAM 3 pinned in place: **one instance per answer, and the answer
 * is about the pixels it was handed.** Against it, the old implementation
 * produces a one-sided mask and the new one cannot.
 */
describe("falRegionReader cuts the frame instead of naming a side", () => {
  const WIDTH = 200;
  const HEIGHT = 120;

  /** A real PNG of the right size — the reader sizes and crops with sharp. */
  async function frame(): Promise<Buffer> {
    return sharp({
      create: { width: WIDTH, height: HEIGHT, channels: 3, background: { r: 90, g: 90, b: 90 } },
    }).png().toBuffer();
  }

  /** A single-channel mask PNG as a data URI, so no mask fetch leaves the test. */
  async function maskUri(
    width: number,
    height: number,
    paint: (x: number, y: number) => boolean,
  ): Promise<string> {
    const data = Buffer.alloc(width * height, 0);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) if (paint(x, y)) data[y * width + x] = 255;
    }
    const png = await sharp(data, { raw: { width, height, channels: 1 } }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  }

  /** A centred rectangle, so her "face" centroid is the middle of the frame. */
  const faceMask = (width: number, height: number) => maskUri(width, height, (x, y) =>
    x >= width * 0.3 && x < width * 0.7 && y >= height * 0.25 && y < height * 0.75);

  /**
   * ONE blob, in the middle of WHATEVER PICTURE IT WAS HANDED — the measured
   * behaviour, and the thing that makes the whole fix work: handed one side, the
   * model answers about that side.
   */
  const featureBlob = (width: number, height: number) => maskUri(width, height, (x, y) =>
    x >= width * 0.4 && x < width * 0.6 && y >= height * 0.4 && y < height * 0.6);

  function acrossMidline(mask: Mask, midline: number): { left: number; right: number } {
    let left = 0;
    let right = 0;
    for (let y = 0; y < mask.height; y += 1) {
      for (let x = 0; x < mask.width; x += 1) {
        if (mask.data[y * mask.width + x] === 0) continue;
        if (x < midline) left += 1;
        else right += 1;
      }
    }
    return { left, right };
  }

  /**
   * The fake segmenter. `sides` decides what a half-frame question answers, so
   * one stub serves the pair-found case, the one-side case and the empty case —
   * and the "both sides" assertion is therefore not trivially true.
   */
  function stubSam3(options: {
    sides: "both" | "one" | "none";
    /** Answer a side question at the FULL frame's size, to drive the resampling
     *  path a provider's own scaling preference would put us on. */
    wrongSize?: boolean;
  }): { prompts: string[] } {
    const prompts: string[] = [];
    let sideCalls = 0;
    vi.stubGlobal("fetch", async (_url: unknown, init: any) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const prompt = String(body.prompt ?? "");
      prompts.push(prompt);
      const image = Buffer.from(String(body.image_url).split(",")[1], "base64");
      const meta = await sharp(image).metadata();
      const width = meta.width ?? 0;
      const height = meta.height ?? 0;

      const reply = (masks: string[]) => new Response(JSON.stringify({ masks: masks.map((url) => ({ url })) }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });

      if (prompt === "face") return reply([await faceMask(width, height)]);

      /*
        THE OLD PROMPTS, ANSWERED THE WAY PRODUCTION ANSWERED THEM: "left" gets
        one instance and "right" gets nothing. If the qualifiers ever come back,
        this is what they come back to.
      */
      if (prompt.startsWith("right ")) return reply([]);
      if (prompt.startsWith("left ")) return reply([await featureBlob(width, height)]);

      sideCalls += 1;
      if (options.sides === "none") return reply([]);
      if (options.sides === "one" && sideCalls > 1) return reply([]);
      return reply([
        options.wrongSize
          ? await featureBlob(WIDTH, HEIGHT)
          : await featureBlob(width, height),
      ]);
    });
    return { prompts };
  }

  it("returns a union covering BOTH sides of her midline, and never names a side", async () => {
    const { prompts } = stubSam3({ sides: "both" });
    const reader = createFalRegionReader({ apiKey: "test-key" });

    const mask = await reader.region({ image: await frame(), name: "eyes" });

    /* The answer is in the WHOLE frame's coordinates, not a crop's. */
    expect({ width: mask.width, height: mask.height }).toEqual({ width: WIDTH, height: HEIGHT });

    /* The finding, inverted: pixels on both sides of her own midline. */
    const split = acrossMidline(mask, WIDTH / 2);
    expect(split.left).toBeGreaterThan(0);
    expect(split.right).toBeGreaterThan(0);
    /* Two blobs of 20×24 within their own halves — the second side is not the
       first one smeared across the frame. */
    expect(split.left + split.right).toBe(2 * 20 * 24);

    /* Assert at the wire: the face, then one plain noun per side. No adjective. */
    expect(prompts).toEqual(["face", "eye", "eye"]);
    expect(prompts.some((prompt) => /^(left|right) /.test(prompt))).toBe(false);
  });

  /**
   * A PAIR OF EARRINGS IS BILATERAL, AND THIS SET USED TO SAY IT WAS NOT.
   *
   * `LANDMARK_OF_ACCESSORY` already recorded `pair: true` for the earring
   * entry, and `bothSides`'s own doc comment says it is how to name both sides
   * "in the painter's clause and the reader's" — but the reader's set was three
   * hand-written anatomical names and never consulted it. Measured on a real
   * frame where both hoops are visible: `"earring"` returned ONE component,
   * `"ear"` returned two.
   *
   * The assertion is at the wire, on the prompts actually sent, because the
   * union's pixels alone would pass with one side read twice.
   */
  it("asks about an EARRING one side at a time, because the accessory table says it is a pair", async () => {
    const { prompts } = stubSam3({ sides: "both" });
    const reader = createFalRegionReader({ apiKey: "test-key" });

    const mask = await reader.region({ image: await frame(), name: "earring" });

    const split = acrossMidline(mask, WIDTH / 2);
    expect(split.left, "a hoop on her left").toBeGreaterThan(0);
    expect(split.right, "and a hoop on her right").toBeGreaterThan(0);

    /* The face first, then the plain noun once per side. Never an adjective. */
    expect(prompts).toEqual(["face", "earring", "earring"]);
  });

  /**
   * DERIVED, NOT MIRRORED — the reason the row above is not simply a fourth
   * hand-written string.
   *
   * Every `pair: true` entry in the accessory table must take the bilateral
   * path, and every `pair: false` one must not. A future paired accessory added
   * to that table is then bilateral without anyone remembering this file, and a
   * copy of the list here would be the drift that caused the defect.
   */
  it("follows the accessory table's own pair column, in both directions", async () => {
    for (const entry of LANDMARK_OF_ACCESSORY) {
      const { prompts } = stubSam3({ sides: "both" });
      const reader = createFalRegionReader({ apiKey: "test-key" });
      await reader.region({ image: await frame(), name: entry.region });

      if (entry.pair) {
        expect(prompts, `${entry.region} is a pair, so it is asked once per side`)
          .toEqual(["face", singularOfRegion(entry.region), singularOfRegion(entry.region)]);
      } else {
        expect(prompts, `${entry.region} is worn singly, so it is asked once, whole`)
          .toEqual([entry.region]);
      }
      vi.unstubAllGlobals();
    }
  });

  it("gives the whole frame's coordinates back even when a side answers at the wrong size", async () => {
    stubSam3({ sides: "both", wrongSize: true });
    const reader = createFalRegionReader({ apiKey: "test-key" });

    const mask = await reader.region({ image: await frame(), name: "eyebrows" });

    expect({ width: mask.width, height: mask.height }).toEqual({ width: WIDTH, height: HEIGHT });
    const split = acrossMidline(mask, WIDTH / 2);
    expect(split.left).toBeGreaterThan(0);
    expect(split.right).toBeGreaterThan(0);
  });

  it("answers with the one side that had something — a turned head has one visible ear", async () => {
    stubSam3({ sides: "one" });
    const reader = createFalRegionReader({ apiKey: "test-key" });

    const mask = await reader.region({ image: await frame(), name: "ear" });

    const split = acrossMidline(mask, WIDTH / 2);
    /* Exactly one side, and which one depends on which crop won the race — the
       assertion that matters is that a single-sided answer is still an answer. */
    expect(split.left > 0).not.toBe(split.right > 0);
    expect(split.left + split.right).toBe(20 * 24);
  });

  it("reaches absence only when BOTH pictures came back empty", async () => {
    stubSam3({ sides: "none" });
    const reader = createFalRegionReader({ apiKey: "test-key" });
    const image = await frame();

    const empty = await reader.region({ image, name: "eyes", absentIsAnswer: true });
    expect(empty.data.every((value) => value === 0)).toBe(true);
    expect({ width: empty.width, height: empty.height }).toEqual({ width: WIDTH, height: HEIGHT });

    /* And where absence is NOT an answer, it is a refusal rather than an empty
       mask — the half of the asymmetry that stops a paid render changing nothing. */
    await expect(reader.region({ image, name: "eyes" })).rejects.toBeInstanceOf(MaskError);
  });
});
