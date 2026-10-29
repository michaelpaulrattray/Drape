/**
 * SEVERAL INSTANCES ON ONE SIDE, AND ONLY THE ONES THAT ARE SEPARATE THINGS
 * (#2818, the law-7 sibling of #2810 found in #2811's sweep).
 *
 * The crop road asked each half for a single instance, so an ear wearing two
 * earrings gave a paid refine one of them. Asking for several fixes that and
 * brings a second problem with it, measured rather than feared: on a feature
 * there is only ONE of, the extra answers are that same feature outlined again,
 * and a refine PAINTS on the mask it gets back — so unioning them would deliver
 * a picture somebody paid for with the wrong region edited.
 *
 * Measured through the product's own crop geometry, two humans and a creature,
 * `eyes` / `eyebrows` / `ear` / `horns`, one half at a time at 1024 and 598:
 * **36 cells, four extra masks, and not one genuine second instance on any
 * anatomy pair** — two tighter, two looser, the worst of which would have taken
 * an eye from 1,042px to 1,995px. On a cast wearing several earrings in one ear
 * the extras are real hoops (1,500 + 334 at 1024; 513 + 109 + 85 at 598).
 *
 * **The two populations separate at the pixels**: 4 of 4 extra earrings share
 * ZERO pixels with the answer already in hand; 4 of 4 anatomy extras are one
 * shape wholly inside the other. These arms drive that rule against a stubbed
 * provider, with a control beside every arm that keeps.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

import { createFalRegionReader } from "./falRegionReader";
import { boundsOf } from "./segmentCuts";
import { binaryCoverage } from "./maskGeometry";
import type { Mask } from "./maskedComposite";

afterEach(() => {
  vi.unstubAllGlobals();
});

const W = 200;
const H = 120;

type Rect = { x: number; y: number; width: number; height: number };

function planeOf(rects: Rect[], width: number, height: number): Buffer {
  const data = Buffer.alloc(width * height, 0);
  for (const rect of rects) {
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        data[y * width + x] = 255;
      }
    }
  }
  return data;
}

async function uri(rects: Rect[], width: number, height: number): Promise<string> {
  const png = await sharp(planeOf(rects, width, height), {
    raw: { width, height, channels: 1 },
  }).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

/* The face spans x 40–139, so her midline is x 90: the image's left half is
   0–89 (90 wide) and its right half begins at x 90 (110 wide). Deliberately off
   centre, so an arm asserts which half was cut. */
const FACE: Rect = { x: 40, y: 20, width: 100, height: 90 };

/** A hoop on the image's RIGHT half — her LEFT ear. */
const HOOP: Rect = { x: 150, y: 60, width: 8, height: 10 };
/** A second hoop, higher up the same ear and touching nothing. */
const SECOND_HOOP: Rect = { x: 151, y: 44, width: 6, height: 6 };
/** The same feature outlined LOOSER — it contains the hoop entirely. */
const LOOSER: Rect = { x: 146, y: 56, width: 16, height: 18 };
/** And TIGHTER — wholly inside it. */
const TIGHTER: Rect = { x: 152, y: 63, width: 3, height: 4 };

/**
 * `face` answers the face on the whole frame; any other prompt is a crop read,
 * answered in the CROP's own pixel space from the rects the arm gives. The stub
 * records whether the request asked for several, because that is half of what
 * these arms assert.
 */
function stub(answers: Rect[][]) {
  const asked: { prompt: string; multiple: boolean; max?: number; width: number }[] = [];
  vi.stubGlobal("fetch", async (url: unknown, init: any) => {
    /* A mask fetch — the stub answers its own data URIs. */
    if (typeof url === "string" && url.startsWith("data:image/png;base64,")) {
      return new Response(Buffer.from(url.split(",")[1] ?? "", "base64"), {
        status: 200, headers: { "content-type": "image/png" },
      });
    }
    const body = JSON.parse(String(init?.body ?? "{}"));
    const json = (value: unknown) => new Response(JSON.stringify(value), {
      status: 200, headers: { "content-type": "application/json" },
    });
    if (body.prompt === "face") {
      return json({ masks: [{ url: await uri([FACE], W, H) }] });
    }
    const bytes = Buffer.from(String(body.image_url).split(",")[1] ?? "", "base64");
    const meta = await sharp(bytes).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    asked.push({
      prompt: String(body.prompt),
      multiple: body.return_multiple_masks === true,
      max: body.max_masks,
      width,
    });
    /* 110 wide is the image's right half, which begins at x 90. */
    const cropLeft = width === 110 ? 90 : 0;
    const here = answers
      .map((rects) => rects
        .map((rect) => ({ ...rect, x: rect.x - cropLeft }))
        .filter((rect) => rect.x >= 0 && rect.x + rect.width <= width))
      .filter((rects) => rects.length > 0);
    if (here.length === 0) return json({ masks: [] });
    const masks = await Promise.all(here.map(async (rects) => ({ url: await uri(rects, width, height) })));
    /* The provider only offers the extras when they were asked for — exactly
       what the real one does, and what makes the "asked for" arm meaningful. */
    return json({ masks: body.return_multiple_masks === true ? masks : masks.slice(0, 1) });
  });
  return { asked };
}

const frame = () => sharp({
  create: { width: W, height: H, channels: 3, background: { r: 200, g: 200, b: 200 } },
}).png().toBuffer();

const reader = () => createFalRegionReader({ apiKey: "k", pairInOneRead: false });

/** Does the mask cover the middle of this rectangle? */
const covers = (mask: Mask, rect: Rect): boolean => {
  const x = Math.floor(rect.x + rect.width / 2);
  const y = Math.floor(rect.y + rect.height / 2);
  return mask.data[y * mask.width + x] !== 0;
};

describe("the crop road asks each half for every instance on it", () => {
  it("THE WHOLE OF THE CARD — a side wearing two hoops gives back BOTH", async () => {
    stub([[HOOP], [SECOND_HOOP]]);
    const found = await reader().sideByCrop!({ image: await frame(), name: "earring", side: "left" });
    expect(covers(found!, HOOP), "the hoop the single ask already found").toBe(true);
    expect(covers(found!, SECOND_HOOP), "and the one further up the same ear").toBe(true);
  });

  it("and it asks for them, which is what the single-instance request never did", async () => {
    const { asked } = stub([[HOOP], [SECOND_HOOP]]);
    await reader().sideByCrop!({ image: await frame(), name: "earring", side: "left" });
    expect(asked, "one crop read, asking for several").toEqual([
      { prompt: "earring", multiple: true, max: 4, width: 110 },
    ]);
  });

  it("CONTROL — a side wearing one hoop gives back exactly that hoop", async () => {
    stub([[HOOP]]);
    const found = await reader().sideByCrop!({ image: await frame(), name: "earring", side: "left" });
    expect(boundsOf(found!)).toEqual(HOOP);
  });

  it("the same feature outlined LOOSER is dropped — it is not a second thing", async () => {
    stub([[HOOP], [LOOSER]]);
    const found = await reader().sideByCrop!({ image: await frame(), name: "ear", side: "left" });
    /* The whole risk this card had to rule out: a refine paints on this mask,
       and the looser outline would have delivered an edit over a region nearly
       twice the size of the one asked about. */
    expect(boundsOf(found!), "the answer already in hand, unchanged").toEqual(HOOP);
    /* The box alone would pass on a mask that filled it; the coverage says the
       shape is the hoop's own area and not the looser outline's. */
    expect(binaryCoverage(found!)).toBeCloseTo((HOOP.width * HOOP.height) / (W * H), 6);
  });

  it("and outlined TIGHTER is dropped too", async () => {
    /* ⚠ THIS ARM CANNOT GO RED ON THE UNION SABOTAGE AND IS KEPT ANYWAY, SAID
       OUT LOUD SO IT IS NOT MISTAKEN FOR A GUARD IT IS NOT: a tighter outline
       unioned in is invisible, because every pixel of it is already in the
       answer. It pins the rule's behaviour on the half of the population that
       is harmless; the LOOSER arm above is the one that protects the picture. */
    stub([[HOOP], [TIGHTER]]);
    const found = await reader().sideByCrop!({ image: await frame(), name: "ear", side: "left" });
    expect(boundsOf(found!)).toEqual(HOOP);
  });

  it("a separate thing is kept even when an overlapping one came back with it", async () => {
    /* The mixed case, which neither arm above reaches: the rule is per answer,
       not a verdict on the whole reply. */
    stub([[HOOP], [LOOSER], [SECOND_HOOP]]);
    const found = await reader().sideByCrop!({ image: await frame(), name: "earring", side: "left" });
    expect(covers(found!, HOOP)).toBe(true);
    expect(covers(found!, SECOND_HOOP), "the real second hoop survives").toBe(true);
    /* The looser outline's own corner, which belongs to neither hoop. */
    expect(covers(found!, { x: LOOSER.x, y: LOOSER.y, width: 2, height: 2 }), "the looser outline does not")
      .toBe(false);
  });

  it("CONTROL — the pair road still UNIONS its answers, overlapping or not", async () => {
    /* ⚠ That road has asked for several since #2191 and wants every answer: the
       two sides of a pair come back as separate instances of one noun. The
       crop road's rule would be wrong there, and wrong in the same direction on
       `region`'s own several-road (#2810), where both tusks and the row between
       them OVERLAP and the union IS the row. So each road says which reading it
       means; this arm is what stops this card's rule leaking into the other. */
    const OVERLAPPING = { x: 146, y: 56, width: 16, height: 18 };
    const { asked } = stub([[HOOP], [OVERLAPPING]]);
    const pairRoad = createFalRegionReader({ apiKey: "k", pairInOneRead: true });
    const sides = await pairRoad.regionSides!({
      image: await frame(), name: "earring", absentIsAnswer: true,
    });
    /* One whole-picture read, not two crop reads. */
    expect(asked.filter((one) => one.prompt === "earring").map((one) => one.width)).toEqual([W]);
    /* And the overlapping answer is still in it — the corner that belongs to
       the looser outline alone. */
    expect(covers(sides!.left, { x: OVERLAPPING.x, y: OVERLAPPING.y, width: 2, height: 2 })).toBe(true);
  });

  it("CONTROL — the shared face read may never ask for several, and still does not", async () => {
    const { asked } = stub([[HOOP]]);
    await reader().sideByCrop!({ image: await frame(), name: "earring", side: "left" });
    expect(asked.some((one) => one.prompt === "face"), "the face read is not a crop read").toBe(false);
  });

  it("nothing on the half is still null, never an empty shape a caller would file", async () => {
    stub([[{ x: 20, y: 60, width: 8, height: 10 }]]);
    const found = await reader().sideByCrop!({ image: await frame(), name: "earring", side: "left" });
    expect(found, "that hoop is on the OTHER half").toBeNull();
  });
});
