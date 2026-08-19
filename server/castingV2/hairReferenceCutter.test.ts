/**
 * THE CROP ROAD'S CUTTER — driven end to end on real PNG bytes, with a reader
 * that answers from a script instead of from fal.
 *
 * The geometry has its own suite; what is proved here is the part that can go
 * wrong invisibly: WHICH questions are asked, of WHICH picture, what is refused
 * and in what order anything is written.
 *
 * Two arms exist because a control was missing somewhere else first:
 *
 *   - the scale floor is driven from BOTH sides on the same picture, because a
 *     guard that refuses everything passes its positive arm and is useless;
 *   - `noHair` and `couldNotRead` are separated by construction, because one
 *     sentinel meaning both *absent* and *unusable* is a defect this program has
 *     already paid for twice.
 */
import { describe, expect, it } from "vitest";
import sharp from "sharp";

import { FORM_FILL, MIN_FORM_RATIO } from "./hairReferenceCrop";
import {
  HAIR_CARRIER_KEY_PREFIX,
  HAIR_REGION,
  SCALE_REGION,
  cutHairCarrier,
  mintHairCarrier,
} from "./hairReferenceCutter";
import type { Mask } from "./maskedComposite";

/** A picture that is continuous everywhere — one photograph. */
async function onePhotograph(width: number, height: number): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = (y * width + x) * 3;
      raw[at] = Math.round(60 + (x / width) * 60);
      raw[at + 1] = Math.round(70 + (y / height) * 60);
      raw[at + 2] = 90;
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

/**
 * The same picture cut at `at` — two photographs butted together.
 *
 * The bottom half is inverted, which is what a seam IS: a line where the
 * picture stops being continuous.
 */
async function twoPanels(width: number, height: number, at: number): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 3;
      const r = Math.round(60 + (x / width) * 60);
      const g = Math.round(70 + (y / height) * 60);
      const flip = y > at;
      raw[index] = flip ? 255 - r : r;
      raw[index + 1] = flip ? 255 - g : g;
      raw[index + 2] = flip ? 165 : 90;
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

/** A rectangular mask in a frame of the given size. */
function box(width: number, height: number, rect: { x: number; y: number; w: number; h: number }): Mask {
  const data = Buffer.alloc(width * height, 0);
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) data[y * width + x] = 255;
  }
  return { data, width, height };
}

function empty(width: number, height: number): Mask {
  return { data: Buffer.alloc(width * height, 0), width, height };
}

type Asked = { name: string; width: number; height: number };

/**
 * A reader that answers from a script, and RECORDS every question.
 *
 * The record is half the point: "two calls for one photograph, three for a
 * composite" is a claim about spending house money on a paid path, and a claim
 * about calls is proved by counting them rather than by reading the code.
 */
function reader(
  answer: (input: { name: string; width: number; height: number }) => Mask | Error,
): { region: (input: { image: Buffer; name: string; absentIsAnswer?: boolean }) => Promise<Mask>; asked: Asked[] } {
  const asked: Asked[] = [];
  return {
    asked,
    async region({ image, name }) {
      const meta = await sharp(image).metadata();
      const width = meta.width ?? 0;
      const height = meta.height ?? 0;
      asked.push({ name, width, height });
      const given = answer({ name, width, height });
      if (given instanceof Error) throw given;
      return given;
    },
  };
}

/** Hair over a third of the frame, a face beside it — a carrier that passes. */
function ordinaryAnswers(hairArea = { x: 10, y: 10, w: 40, h: 40 }, formArea = { x: 50, y: 20, w: 30, h: 30 }) {
  return ({ name, width, height }: { name: string; width: number; height: number }): Mask => {
    if (name === HAIR_REGION) return box(width, height, hairArea);
    if (name === SCALE_REGION) return box(width, height, formArea);
    throw new Error(`nothing scripted an answer for "${name}"`);
  };
}

describe("one photograph — the ordinary road", () => {
  it("cuts a carrier, asks exactly two questions, and says no second view was dropped", async () => {
    const picture = await onePhotograph(120, 100);
    const answers = reader(ordinaryAnswers());

    const result = await cutHairCarrier({ bytes: picture, reader: answers });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.carrier.panels).toBe(1);
    expect(result.carrier.carriedPanel).toBe(0);
    expect(result.carrier.secondViewUnused).toBe(false);
    expect(result.carrier.seam).toBeNull();
    /* THE STATED COST, counted rather than asserted in prose. */
    expect(answers.asked.map((one) => one.name)).toEqual([HAIR_REGION, SCALE_REGION]);
    /* Both questions were asked of the whole frame, because there is one panel. */
    expect(answers.asked.every((one) => one.width === 120 && one.height === 100)).toBe(true);
  });

  it("the carrier is the union's box, with the hair's own pixels and NOTHING ELSE OF HIM", async () => {
    /*
      THE CONTAINMENT BOUND, PROVED AT THE BYTES (fable-1093 §2a).

      Every opaque pixel is either hair — the photograph's own colour — or the
      flat fill. A carrier that leaked one pixel of face would still look
      right at a glance and would still be a photograph of a person riding to
      an engine.
    */
    const picture = await onePhotograph(120, 100);
    const result = await cutHairCarrier({ bytes: picture, reader: reader(ordinaryAnswers()) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    /* union of {10,10,40x40} and {50,20,30x30} → x 10..79, y 10..49 */
    expect(result.carrier.width).toBe(70);
    expect(result.carrier.height).toBe(40);
    expect(result.carrier.hairPixels).toBe(40 * 40);
    expect(result.carrier.formPixels).toBe(30 * 30);

    const { data, info } = await sharp(result.carrier.bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(info.channels).toBe(4);
    const source = await sharp(picture).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let flat = 0;
    let fromThePhotograph = 0;
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const at = (y * info.width + x) * 4;
        if (data[at + 3] === 0) continue;
        const inHair = x + 10 >= 10 && x + 10 < 50 && y + 10 >= 10 && y + 10 < 50;
        if (inHair) {
          const from = ((y + 10) * 120 + (x + 10)) * source.info.channels;
          expect([data[at], data[at + 1], data[at + 2]])
            .toEqual([source.data[from], source.data[from + 1], source.data[from + 2]]);
          fromThePhotograph += 1;
        } else {
          expect([data[at], data[at + 1], data[at + 2]]).toEqual([FORM_FILL.r, FORM_FILL.g, FORM_FILL.b]);
          flat += 1;
        }
      }
    }
    expect(fromThePhotograph).toBe(40 * 40);
    expect(flat).toBe(30 * 30);
  });
});

describe("a composite — asked once per panel, so nobody's picture is half-used in silence", () => {
  it("asks each panel its own question and carries the one holding the most hair", async () => {
    const picture = await twoPanels(120, 100, 59);
    /* The bottom panel is the taller one and holds the larger head of hair. */
    const answers = reader(({ name, width, height }) => {
      if (name === HAIR_REGION) {
        return height === 59
          ? box(width, height, { x: 5, y: 5, w: 20, h: 20 })
          : box(width, height, { x: 5, y: 5, w: 30, h: 30 });
      }
      return box(width, height, { x: 40, y: 5, w: 20, h: 20 });
    });

    const result = await cutHairCarrier({ bytes: picture, reader: answers });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.carrier.panels).toBe(2);
    expect(result.carrier.carriedPanel).toBe(1);
    expect(result.carrier.secondViewUnused).toBe(true);
    expect(result.carrier.seam?.axis).toBe("row");
    expect(result.carrier.seam?.at).toBe(59);
    expect(result.carrier.hairPixels).toBe(30 * 30);

    /*
      THREE calls, and the two hair questions were asked of two DIFFERENT
      pictures — which is the whole fix for the silent pick.

      The two panels are asked CONCURRENTLY, so which of them answers first is
      the provider's business and not a contract. The arm is written on what is
      actually promised: both panels were asked, and the scale question came
      last, of the panel that won.
    */
    expect(answers.asked).toHaveLength(3);
    const hairAsks = answers.asked.slice(0, 2).filter((one) => one.name === HAIR_REGION);
    expect(hairAsks.map((one) => one.height).sort((left, right) => left - right)).toEqual([40, 59]);
    expect(answers.asked[2]).toEqual({ name: SCALE_REGION, width: 120, height: 40 });
  });

  it("keeps the first panel when the two hold the same amount of hair", async () => {
    /* A tie has no better answer, so it has a stated one: reading order. A sort
       would settle it too, and would settle it differently on another day. */
    const picture = await twoPanels(120, 100, 59);
    const answers = reader(({ name, width, height }) => (
      name === HAIR_REGION
        ? box(width, height, { x: 5, y: 5, w: 20, h: 20 })
        : box(width, height, { x: 40, y: 5, w: 20, h: 20 })
    ));

    const result = await cutHairCarrier({ bytes: picture, reader: answers });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.carrier.carriedPanel).toBe(0);
    expect(answers.asked[2]).toEqual({ name: SCALE_REGION, width: 120, height: 59 });
  });
});

describe("the refusals — all free, and none of them sharing a sentinel", () => {
  it("refuses noHair when the reader ANSWERS and the answer is none — and never buys the scale call", async () => {
    const picture = await onePhotograph(120, 100);
    const answers = reader(({ name, width, height }) => (
      name === HAIR_REGION ? empty(width, height) : box(width, height, { x: 0, y: 0, w: 50, h: 50 })
    ));

    const result = await cutHairCarrier({ bytes: picture, reader: answers });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe("noHair");
    expect(result.refusal.message).toMatch(/couldn't find any hair/);
    /* A picture with no hair in it does not get a second question bought about
       it — the refusal is free in calls as well as in credits. */
    expect(answers.asked.map((one) => one.name)).toEqual([HAIR_REGION]);
  });

  it("refuses couldNotRead when the reader does not answer at all", async () => {
    /*
      THE ARM THE OTHER ONE CANNOT PROVE. Same picture, same script, one
      difference: the reader throws instead of returning nothing. If these two
      ever collapse into one code, a customer is told her photograph has no hair
      in it because a provider had a bad minute.
    */
    const picture = await onePhotograph(120, 100);
    const answers = reader(() => new Error("the segmenter is having a moment"));

    const result = await cutHairCarrier({ bytes: picture, reader: answers });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe("couldNotRead");
  });

  it("refuses couldNotRead when the SCALE question is the one that fails", async () => {
    const picture = await onePhotograph(120, 100);
    const answers = reader(({ name, width, height }) => (
      name === HAIR_REGION
        ? box(width, height, { x: 10, y: 10, w: 40, h: 40 })
        : new Error("the segmenter is having a moment")
    ));

    const result = await cutHairCarrier({ bytes: picture, reader: answers });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe("couldNotRead");
  });

  it("refuses wrongSpace rather than resampling a mask to fit its panel", async () => {
    /* Never resize a mask to fit: it moves every edge it touches, and a mask a
       row out of step composes a carrier that is confidently wrong. */
    const picture = await onePhotograph(120, 100);
    const answers = reader(({ name }) => (
      name === HAIR_REGION ? box(60, 50, { x: 5, y: 5, w: 20, h: 20 }) : box(120, 100, { x: 0, y: 0, w: 40, h: 40 })
    ));

    const result = await cutHairCarrier({ bytes: picture, reader: answers });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe("wrongSpace");
  });

  it("refuses a mask that is not one byte per pixel", async () => {
    /* The promoted-buffer class: three channels arriving where one is expected
       does not fail, it silently reads a third of a picture. */
    const picture = await onePhotograph(120, 100);
    const answers = reader(({ name, width, height }) => {
      const honest = name === HAIR_REGION
        ? box(width, height, { x: 10, y: 10, w: 40, h: 40 })
        : box(width, height, { x: 50, y: 20, w: 30, h: 30 });
      return name === HAIR_REGION
        ? { ...honest, data: Buffer.alloc(honest.data.length * 3, 255) }
        : honest;
    });

    const result = await cutHairCarrier({ bytes: picture, reader: answers });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe("wrongSpace");
  });

  it("refuses bytes that are not a picture", async () => {
    const result = await cutHairCarrier({
      bytes: Buffer.from("this is not a photograph"),
      reader: reader(ordinaryAnswers()),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe("unreadable");
  });
});

describe("the scale floor — driven from BOTH sides of the same picture", () => {
  /*
    A guard that refuses everything passes its positive arm and protects
    nothing. So the two arms below differ in ONE thing — how much form the
    reader reports — and the boundary between them is `MIN_FORM_RATIO` rather
    than a number typed twice.
  */
  const hair = { x: 10, y: 10, w: 40, h: 40 };
  const hairPixels = 40 * 40;

  it("refuses a carrier whose form is a rounding error — the bare cutout the length court convicted", async () => {
    const side = Math.floor(Math.sqrt(hairPixels * MIN_FORM_RATIO)) - 2;
    const picture = await onePhotograph(120, 100);
    const answers = reader(ordinaryAnswers(hair, { x: 60, y: 20, w: side, h: side }));

    const result = await cutHairCarrier({ bytes: picture, reader: answers });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe("noScale");
    expect(side * side / hairPixels).toBeLessThan(MIN_FORM_RATIO);
  });

  it("lets the same picture through when the form is over the floor", async () => {
    const side = Math.ceil(Math.sqrt(hairPixels * MIN_FORM_RATIO)) + 2;
    const picture = await onePhotograph(120, 100);
    const answers = reader(ordinaryAnswers(hair, { x: 60, y: 20, w: side, h: side }));

    const result = await cutHairCarrier({ bytes: picture, reader: answers });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(side * side / hairPixels).toBeGreaterThanOrEqual(MIN_FORM_RATIO);
    expect(result.carrier.formPixels).toBe(side * side);
  });

  it("refuses when the scale question comes back with nothing at all", async () => {
    /* A picture cropped so tight that no face is readable is a real reading,
       and it lands here rather than as an exception. */
    const picture = await onePhotograph(120, 100);
    const answers = reader(({ name, width, height }) => (
      name === HAIR_REGION ? box(width, height, hair) : empty(width, height)
    ));

    const result = await cutHairCarrier({ bytes: picture, reader: answers });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe("noScale");
  });
});

describe("the mint — manifest first, then bytes", () => {
  it("writes the manifest naming the exact key BEFORE the object exists", async () => {
    /*
      The keeper-receipt order. Bytes at a permanently public address with
      nothing naming them are litter nobody goes looking for, and on this road
      the litter is cut from a photograph of a person.
    */
    const picture = await onePhotograph(120, 100);
    const cut = await cutHairCarrier({ bytes: picture, reader: reader(ordinaryAnswers()) });
    expect(cut.ok).toBe(true);
    if (!cut.ok) return;

    const order: string[] = [];
    let manifested: readonly string[] = [];
    const minted = await mintHairCarrier({ userId: 1, carrier: cut.carrier }, {
      async manifest({ storageKeys, userId }) {
        expect(userId).toBe(1);
        manifested = storageKeys;
        order.push("manifest");
      },
      async store({ key, bytes, contentType }) {
        order.push("store");
        expect(bytes).toEqual(cut.carrier.bytes);
        expect(contentType).toBe("image/png");
        return { key, url: `https://example.invalid/${key}` };
      },
    });

    expect(order).toEqual(["manifest", "store"]);
    expect(manifested).toEqual([minted.key]);
    expect(minted.key.startsWith(`${HAIR_CARRIER_KEY_PREFIX}/`)).toBe(true);
    expect(minted.key.endsWith(".png")).toBe(true);
    const { createHash } = await import("node:crypto");
    expect(minted.sha).toBe(createHash("sha256").update(cut.carrier.bytes).digest("hex"));
  });

  it("gives every carrier its own unguessable name", async () => {
    const picture = await onePhotograph(120, 100);
    const cut = await cutHairCarrier({ bytes: picture, reader: reader(ordinaryAnswers()) });
    expect(cut.ok).toBe(true);
    if (!cut.ok) return;
    const keys = new Set<string>();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const minted = await mintHairCarrier({ userId: 1, carrier: cut.carrier }, {
        async manifest() {},
        async store({ key }) { return { key, url: key }; },
      });
      keys.add(minted.key);
    }
    expect(keys.size).toBe(3);
  });
});
