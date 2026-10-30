/**
 * A FACE FEATURE IS ON THE FACE (#2844, his eye round 10: *"her left eye box is
 * jacked up and not cropped"*).
 *
 * His cast wears a tattoo sleeve with a tattooed woman's face at the elbow, and
 * the segmenter, asked `eyes`, answered that face's eye beside the cast's own.
 * The pair road (the panel) unioned it into the cast's left eye; the crop road
 * (every paid refine) kept it as a separate instance. These arms drive the
 * repair directly — the pure rule, then the real reader on both roads with a
 * stub segmenter answering in the shape measured on his frame (scaled to a
 * quarter: 1024x1536 → 256x384), then the half-answered heal and the keyed
 * face read — and every "dropped" arm has a "kept" sibling.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

import { createFalRegionReader, keepPiecesOnTheFace } from "./falRegionReader";
import { boundsOf } from "./segmentCuts";
import type { Mask } from "./maskedComposite";

afterEach(() => {
  vi.unstubAllGlobals();
});

const W = 256;
const H = 384;
type Rect = { x: number; y: number; width: number; height: number };

function maskWith(rects: Rect[], width = W, height = H, shift = 0): Mask {
  const data = Buffer.alloc(width * height, 0);
  for (const r of rects) {
    for (let y = r.y; y < r.y + r.height; y += 1) {
      for (let x = r.x - shift; x < r.x - shift + r.width; x += 1) {
        if (x >= 0 && x < width) data[y * width + x] = 255;
      }
    }
  }
  return { data, width, height };
}

/* His frame at a quarter. The face read is x88–181 y79–188; its axis lands
   the midline at x135, so the two halves are 135 and 121 wide and the stub
   tells them apart by width alone. */
const FACE: Rect = { x: 88, y: 79, width: 94, height: 110 };
const MIDLINE = 135;
const RIGHT_EYE: Rect = { x: 93, y: 110, width: 22, height: 12 };
const LEFT_EYE: Rect = { x: 140, y: 110, width: 21, height: 12 };
/** The tattoo's eye at the elbow, y1187–1210 on his frame. Placed across
 *  where his frame has it relative to the face: 204 past the face's right
 *  edge against 221 allowed there, so ONLY the face's height drops it — the
 *  across clause alone would keep it, as on his frame. */
const TATTOO_EYE: Rect = { x: 220, y: 297, width: 8, height: 6 };
const RIGHT_BROW: Rect = { x: 92, y: 99, width: 24, height: 10 };
const LEFT_BROW: Rect = { x: 146, y: 99, width: 12, height: 7 };
/** The tattoo's brow, y1175–1187, placed across the same way. */
const TATTOO_BROW: Rect = { x: 220, y: 293, width: 8, height: 3 };
/** The cast's right ear: SAM 3's face read does not hold it at all (x286–332
 *  against a face from x351), which is why the rule is not "inside the box". */
const RIGHT_EAR: Rect = { x: 71, y: 98, width: 12, height: 34 };
const LEFT_EAR: Rect = { x: 171, y: 99, width: 12, height: 32 };
/** A horn on the cast's left, rising from the head: centre y 17, 62 above
 *  the face's top against 54.5 that the face rule would allow. */
const HORN: Rect = { x: 150, y: 5, width: 10, height: 25 };

/** The rule's face, read the way the reader reads the mask above. */
const SPAN = { midline: MIDLINE, left: 88, right: 181, top: 79, bottom: 188, middle: 133.5 };

describe("keepPiecesOnTheFace — the rule, driven without a reader", () => {
  it("NEGATIVE CONTROL — drops the tattoo's eye far below the chin and keeps the real eye", () => {
    const side = maskWith([LEFT_EYE, TATTOO_EYE]);
    const { kept, dropped } = keepPiecesOnTheFace(side, SPAN);
    expect(boundsOf(kept!)).toEqual(LEFT_EYE);
    expect(dropped).toEqual([{ pixels: 48, centreX: 224, centreY: 300 }]);
  });

  it("POSITIVE CONTROL — keeps an ear the face read does not hold, beside the face's edge", () => {
    /* Centre x 76.5: 11.5 past the left edge, against 47 from that edge to the
       middle — inside the face's own allowance. */
    const side = maskWith([RIGHT_EAR]);
    const { kept, dropped } = keepPiecesOnTheFace(side, SPAN);
    expect(dropped).toEqual([]);
    expect(kept).toBe(side);
  });

  it("drops a lookalike BESIDE the face at its height (a reflection) just as it drops one below", () => {
    /* Centre x 245: 64 past the right edge, against 46 allowed. */
    const side = maskWith([LEFT_EYE, { x: 243, y: 112, width: 5, height: 5 }]);
    const { kept, dropped } = keepPiecesOnTheFace(side, SPAN);
    expect(boundsOf(kept!)).toEqual(LEFT_EYE);
    expect(dropped).toHaveLength(1);
  });

  it("a piece exactly at the allowance is kept — the answer that cannot take a real feature away", () => {
    /* With the middle row at 133 and the chin at 188, 55 is allowed below the
       chin: a one-pixel-tall piece at y 243 is exactly 55 past it and kept,
       and one at y 244 is 56 past it and dropped. */
    const atEdge = maskWith([{ x: 140, y: 243, width: 3, height: 1 }]);
    expect(keepPiecesOnTheFace(atEdge, { ...SPAN, middle: 133 }).dropped).toEqual([]);
    const past = maskWith([{ x: 140, y: 244, width: 3, height: 1 }]);
    expect(keepPiecesOnTheFace(past, { ...SPAN, middle: 133 }).dropped).toHaveLength(1);
  });

  it("an answer that was ONLY the tattoo leaves that side holding nothing", () => {
    expect(keepPiecesOnTheFace(maskWith([TATTOO_EYE]), SPAN).kept).toBeNull();
  });

  it("an empty side is nothing to keep, not an error", () => {
    expect(keepPiecesOnTheFace(maskWith([]), SPAN)).toEqual({ kept: null, dropped: [] });
  });
});

async function uri(mask: Mask): Promise<string> {
  const png = await sharp(mask.data, { raw: { width: mask.width, height: mask.height, channels: 1 } }).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

async function frame(): Promise<Buffer> {
  return sharp({ create: { width: W, height: H, channels: 3, background: { r: 200, g: 200, b: 200 } } }).png().toBuffer();
}

/**
 * A fake fal answering as his frame did. Whole frame: `eyes` → both real eyes
 * as one mask AND the tattoo's eye; `eyebrows` → both real brows; `ear` → two
 * ears. Half frame (told apart by width): `eye` on the image-right half → the
 * real eye, a looser outline of it, and the tattoo's eye; `eyebrow` there →
 * the real brow and the tattoo's; the image-left half → its real feature only.
 * `horns` answers a horn rising well above the face, for the scope control.
 */
function stubFal(): { prompts: string[] } {
  const prompts: string[] = [];
  vi.stubGlobal("fetch", async (address: unknown, init: any) => {
    if (!String(address).startsWith("https://fal.run/")) return new Response("not served", { status: 404 });
    const body = JSON.parse(String(init?.body ?? "{}"));
    const prompt = String(body.prompt ?? "");
    prompts.push(prompt);
    const image = Buffer.from(String(body.image_url).split(",")[1], "base64");
    const width = (await sharp(image).metadata()).width as number;
    const reply = async (masks: Mask[]) => new Response(
      JSON.stringify({ masks: await Promise.all(masks.map(async (mask) => ({ url: await uri(mask) }))) }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
    if (prompt === "face") return reply([maskWith([FACE])]);
    const brow = prompt.includes("brow");
    const eye = !brow && prompt.includes("eye");
    if (width === W) {
      if (eye) return reply([maskWith([RIGHT_EYE, LEFT_EYE]), maskWith([TATTOO_EYE])]);
      if (brow) return reply([maskWith([RIGHT_BROW, LEFT_BROW])]);
      if (prompt.includes("horn")) return reply([maskWith([HORN])]);
      return reply([maskWith([RIGHT_EAR]), maskWith([LEFT_EAR])]);
    }
    const imageRight = width === W - MIDLINE;
    const shift = imageRight ? MIDLINE : 0;
    const half = (rects: Rect[]) => maskWith(rects, width, H, shift);
    if (eye) {
      return reply(imageRight
        ? [half([LEFT_EYE]), half([TATTOO_EYE]), half([{ x: 137, y: 108, width: 26, height: 16 }])]
        : [half([RIGHT_EYE])]);
    }
    if (brow) return reply(imageRight ? [half([LEFT_BROW]), half([TATTOO_BROW])] : [half([RIGHT_BROW])]);
    if (prompt.includes("horn")) return reply(imageRight ? [half([HORN])] : []);
    return reply(imageRight ? [half([LEFT_EAR])] : [half([RIGHT_EAR])]);
  });
  return { prompts };
}

describe("the reader, both roads, with a segmenter answering the way his frame measured", () => {
  it("pair road (the panel): the cast's left eye is the eye, not the eye and the arm", async () => {
    stubFal();
    const reader = createFalRegionReader({ apiKey: "k", pairInOneRead: true });
    /* The cast's LEFT is the image's right. */
    const sides = await reader.regionSides!({ image: await frame(), name: "eyes", absentIsAnswer: true });
    expect(boundsOf(sides!.left)).toEqual(LEFT_EYE);
    expect(boundsOf(sides!.right)).toEqual(RIGHT_EYE);
  });

  it("crop road (every paid refine): `\"separate\"` no longer keeps the tattoo's eye", async () => {
    stubFal();
    const reader = createFalRegionReader({ apiKey: "k", pairInOneRead: false });
    const sides = await reader.regionSides!({ image: await frame(), name: "eyes", absentIsAnswer: true });
    expect(boundsOf(sides!.left)).toEqual(LEFT_EYE);
    expect(boundsOf(sides!.right)).toEqual(RIGHT_EYE);
  });

  it("crop road: the brow's sibling — the tattoo's brow is not the cast's left brow", async () => {
    stubFal();
    const reader = createFalRegionReader({ apiKey: "k", pairInOneRead: false });
    const sides = await reader.regionSides!({ image: await frame(), name: "eyebrows", absentIsAnswer: true });
    expect(boundsOf(sides!.left)).toEqual(LEFT_BROW);
  });

  it("`region` (both sides as one) holds no piece of the arm either", async () => {
    stubFal();
    const reader = createFalRegionReader({ apiKey: "k", pairInOneRead: false });
    const both = await reader.region({ image: await frame(), name: "eyes", absentIsAnswer: true });
    expect(boundsOf(both)).toEqual({ x: 93, y: 110, width: 68, height: 12 });
  });

  it("POSITIVE CONTROL — both ears are kept on both roads, the one the face read does not hold included", async () => {
    for (const pairInOneRead of [true, false]) {
      stubFal();
      const reader = createFalRegionReader({ apiKey: "k", pairInOneRead });
      const sides = await reader.regionSides!({ image: await frame(), name: "ear", absentIsAnswer: true });
      expect(boundsOf(sides!.right), String(pairInOneRead)).toEqual(RIGHT_EAR);
      expect(boundsOf(sides!.left), String(pairInOneRead)).toEqual(LEFT_EAR);
    }
  });

  it("SCOPE CONTROL — horns are not a face feature (the catalogue files them under hair), so a horn above the brow is not judged by the face", async () => {
    stubFal();
    const reader = createFalRegionReader({ apiKey: "k", pairInOneRead: false });
    const sides = await reader.regionSides!({ image: await frame(), name: "horns", absentIsAnswer: true });
    expect(boundsOf(sides!.left)).toEqual(HORN);
  });

  it("the face is read ONCE for the rule and the midline together", async () => {
    const { prompts } = stubFal();
    const reader = createFalRegionReader({ apiKey: "k", pairInOneRead: false });
    await reader.regionSides!({ image: await frame(), name: "eyes", absentIsAnswer: true });
    expect(prompts.filter((one) => one === "face")).toHaveLength(1);
  });

  it("a keyed face judges a SECOND frame by the span it already holds, without a second face read", async () => {
    const { prompts } = stubFal();
    const reader = createFalRegionReader({ apiKey: "k", pairInOneRead: false });
    const key = `cast-2844-${Math.random()}`;
    await reader.regionSides!({ image: await frame(), name: "eyes", absentIsAnswer: true, axisKey: key });
    const second = await reader.regionSides!({ image: await frame(), name: "eyes", absentIsAnswer: true, axisKey: key });
    expect(prompts.filter((one) => one === "face")).toHaveLength(1);
    expect(boundsOf(second!.left)).toEqual(LEFT_EYE);
  });
});

describe("the half-answered heal judges the same answer the first reading did", () => {
  it("the heal's own read of the cast's left eye drops the tattoo's eye too", async () => {
    stubFal();
    const reader = createFalRegionReader({ apiKey: "k", pairInOneRead: true });
    const healed = await reader.sideByCrop!({ image: await frame(), name: "eyes", side: "left" });
    expect(boundsOf(healed!)).toEqual(LEFT_EYE);
  });

  it("CONTROL — the heal still recovers the cast's right eye, which holds no lookalike", async () => {
    stubFal();
    const reader = createFalRegionReader({ apiKey: "k", pairInOneRead: true });
    const healed = await reader.sideByCrop!({ image: await frame(), name: "eyes", side: "right" });
    expect(boundsOf(healed!)).toEqual(RIGHT_EYE);
  });
});
