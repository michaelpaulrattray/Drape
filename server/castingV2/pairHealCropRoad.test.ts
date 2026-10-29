/**
 * A HALF-ANSWERED PAIR'S SECOND LOOK IS A DIFFERENT QUESTION (#2802, the law-7
 * sibling of #2800).
 *
 * Production reads a pair in ONE whole-picture request
 * (`ENABLE_CASTING_PAIR_ONE_READ`), so the second look a half-answered pair got
 * went out as the identical request and came back with the identical answer.
 * Measured through the product's own reader on the founder's round-6 cast,
 * `ear` at 1024 and at 598, five draws a size: **the pair road answered nothing
 * on either side, 10 of 10**, while the same frame cut in half answered both
 * ears 10 of 10 — and on two casts whose ears are genuinely hidden the crop
 * road recovered nothing on the blind side, 12 of 12.
 *
 * These arms drive the repair at both ends — the reader against a stubbed
 * provider, then the scan's choice of what to ask — and every "found" arm has a
 * sibling that must not find.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

import { createFalRegionReader } from "./falRegionReader";
import { scanFace } from "./faceScan";
import { boundsOf } from "./segmentCuts";
import type { Mask } from "./maskedComposite";
import type { RegionReader, SideRegions } from "./maskedRefine";

afterEach(() => {
  vi.unstubAllGlobals();
});

const W = 200;
const H = 120;

function maskWith(
  rects: { x: number; y: number; width: number; height: number }[],
  width = W,
  height = H,
): Mask {
  const data = Buffer.alloc(width * height, 0);
  for (const rect of rects) {
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) data[y * width + x] = 255;
    }
  }
  return { data, width, height };
}

/*
  The face spans x 40–139, so her midline is x 90 and the two crops are 0–89
  (90 wide) and 90–199 (110 wide). ⚠ The face is deliberately OFF CENTRE: with a
  centred one both halves would be 100 wide and an arm could not tell which of
  them was cut, which is the only thing these reader arms are really asserting.
*/
const FACE = { x: 40, y: 20, width: 100, height: 90 };
const IMAGE_LEFT_EAR = { x: 20, y: 50, width: 8, height: 16 };
const IMAGE_RIGHT_EAR = { x: 150, y: 48, width: 8, height: 16 };
/* Nearer her midline than her right edge — a septum ring's place, not an ear's. */
const ON_THE_MIDLINE = { x: 96, y: 78, width: 10, height: 6 };

describe("the reader reads one side from a picture containing only that side", () => {
  const frame = () => sharp({
    create: { width: W, height: H, channels: 3, background: { r: 200, g: 200, b: 200 } },
  }).png().toBuffer();

  async function uri(mask: Mask): Promise<string> {
    const png = await sharp(mask.data, {
      raw: { width: mask.width, height: mask.height, channels: 1 },
    }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  }

  /**
   * `face` answers the face on the whole frame. Any other prompt is a crop
   * read: the stub MEASURES the picture it was handed and answers in that
   * picture's own pixel space, so an arm asserts which half was cut rather than
   * trusting the caller's arithmetic.
   */
  function stub(over: { rects?: { x: number; y: number; width: number; height: number }[] } = {}) {
    const asked: { prompt: string; width: number }[] = [];
    vi.stubGlobal("fetch", async (_url: unknown, init: any) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const json = (value: unknown) => new Response(JSON.stringify(value), {
        status: 200, headers: { "content-type": "application/json" },
      });
      if (body.prompt === "face") return json({ masks: [{ url: await uri(maskWith([FACE])) }] });
      const bytes = Buffer.from(String(body.image_url).split(",")[1] ?? "", "base64");
      const meta = await sharp(bytes).metadata();
      const width = meta.width ?? 0;
      const height = meta.height ?? 0;
      asked.push({ prompt: String(body.prompt), width });
      /* 90 wide is her left half of the image; 110 wide is the right one, which
         begins at x 90. Anything else is the whole frame. */
      const cropLeft = width === 110 ? 90 : 0;
      const here = (over.rects ?? [IMAGE_LEFT_EAR, IMAGE_RIGHT_EAR])
        .map((rect) => ({ ...rect, x: rect.x - cropLeft }))
        .filter((rect) => rect.x >= 0 && rect.x + rect.width <= width);
      if (here.length === 0) return json({ masks: [] });
      return json({ masks: [{ url: await uri(maskWith(here, width, height)) }] });
    });
    return { asked };
  }

  it("the cast's LEFT ear is read from the image's RIGHT half, by the singular noun, once", async () => {
    const { asked } = stub();
    const reader = createFalRegionReader({ apiKey: "k", pairInOneRead: true });
    const found = await reader.sideByCrop!({ image: await frame(), name: "ear", side: "left" });
    /* Handed back in the WHOLE frame's pixels — a mask left in the crop's own
       space would land ninety pixels out. */
    expect(boundsOf(found!)).toEqual(IMAGE_RIGHT_EAR);
    expect(asked).toEqual([{ prompt: "ear", width: 110 }]);
  });

  it("and the cast's RIGHT ear is read from the image's LEFT half", async () => {
    const { asked } = stub();
    const reader = createFalRegionReader({ apiKey: "k", pairInOneRead: true });
    const found = await reader.sideByCrop!({ image: await frame(), name: "ear", side: "right" });
    expect(boundsOf(found!)).toEqual(IMAGE_LEFT_EAR);
    expect(asked).toEqual([{ prompt: "ear", width: 90 }]);
  });

  it("a pair is asked by its singular noun, as the crop road has always asked", async () => {
    const { asked } = stub({ rects: [IMAGE_RIGHT_EAR] });
    const reader = createFalRegionReader({ apiKey: "k", pairInOneRead: true });
    await reader.sideByCrop!({ image: await frame(), name: "eyes", side: "left" });
    expect(asked.map((one) => one.prompt)).toEqual(["eye"]);
  });

  it("a name this reader does not read two-sidedly answers null, and spends nothing", async () => {
    const { asked } = stub();
    const reader = createFalRegionReader({ apiKey: "k", pairInOneRead: true });
    expect(await reader.sideByCrop!({ image: await frame(), name: "nose", side: "left" })).toBeNull();
    expect(asked, "not one call — and not even the face read").toEqual([]);
  });

  it("nothing on that half is null, never an empty shape a caller would file", async () => {
    stub({ rects: [IMAGE_LEFT_EAR] });
    const reader = createFalRegionReader({ apiKey: "k", pairInOneRead: true });
    expect(await reader.sideByCrop!({ image: await frame(), name: "ear", side: "left" })).toBeNull();
  });

  it("an ear-worn pair drops a piece nearer the middle of the face than that side (#2781)", async () => {
    stub({ rects: [ON_THE_MIDLINE, IMAGE_RIGHT_EAR] });
    const reader = createFalRegionReader({ apiKey: "k", pairInOneRead: true });
    const kept = await reader.sideByCrop!({
      image: await frame(), name: "earring", side: "left", onTheEars: true,
    });
    expect(boundsOf(kept!), "the hoop at the ear, and not the ring under the nose").toEqual(IMAGE_RIGHT_EAR);
  });

  it("CONTROL — without that rule the same piece is kept, so the arm above reads the rule and not the geometry", async () => {
    stub({ rects: [ON_THE_MIDLINE, IMAGE_RIGHT_EAR] });
    const reader = createFalRegionReader({ apiKey: "k", pairInOneRead: true });
    const kept = await reader.sideByCrop!({ image: await frame(), name: "earring", side: "left" });
    expect(boundsOf(kept!)?.x, "the ring is still in the answer").toBe(ON_THE_MIDLINE.x);
  });
});

describe("the scan asks the blind side for its own half-picture", () => {
  const FRAME = { bytes: Buffer.from("not a picture"), width: W, height: H };
  const FIRST_READING = maskWith([IMAGE_LEFT_EAR]);
  const RECOVERED = maskWith([IMAGE_RIGHT_EAR]);
  const SOMETHING_ELSE = maskWith([{ x: 20, y: 20, width: 4, height: 4 }]);

  /** Every pair answers its image-left side only — the cast's RIGHT — which is
   *  the shape his round-6 panel showed. */
  function readerWith(over: {
    sideByCrop?: (input: { name: string; side: "left" | "right"; onTheEars?: true }) => Promise<Mask | null>;
    sides?: (name: string) => SideRegions;
  } = {}): { reader: RegionReader; order: string[]; earRule: (true | undefined)[] } {
    const order: string[] = [];
    const earRule: (true | undefined)[] = [];
    const reader = {
      async region() { return maskWith([{ x: 10, y: 10, width: 5, height: 5 }]); },
      async subject() { return maskWith([]); },
      async landmark() { return []; },
      async regionSides(input: { name: string }) {
        order.push(`regionSides ${input.name}`);
        return over.sides ? over.sides(input.name) : { left: maskWith([]), right: FIRST_READING };
      },
      ...(over.sideByCrop ? {
        async sideByCrop(input: { name: string; side: "left" | "right"; onTheEars?: true }) {
          order.push(`sideByCrop ${input.name} ${input.side}`);
          if (input.name === "earring") earRule.push(input.onTheEars);
          return over.sideByCrop!(input);
        },
      } : {}),
    } as RegionReader;
    return { reader, order, earRule };
  }

  /** What was asked about the ears alone — `earring` shares the substring. */
  const aboutTheEar = (order: string[]) => order.filter((one) => / ear$| ear /.test(one));

  it("the blind side is asked for its own half, and the whole region is NOT asked again", async () => {
    const { reader, order } = readerWith({ sideByCrop: async () => RECOVERED });
    await scanFace({ frame: FRAME, reader, describe: null });
    /* The whole of the card: one whole-picture reading, then a question about
       the blind side — never the same whole-picture question twice. */
    expect(aboutTheEar(order)).toEqual(["regionSides ear", "sideByCrop ear left"]);
  });

  it("the recovered side is filed, and the side that landed keeps its FIRST reading", async () => {
    const { reader } = readerWith({ sideByCrop: async () => RECOVERED });
    const scan = await scanFace({ frame: FRAME, reader, describe: null });
    expect(scan.boxes.get("ear@left")).toMatchObject(IMAGE_RIGHT_EAR);
    expect(scan.boxes.get("ear@right"), "never traded for a second answer").toMatchObject(IMAGE_LEFT_EAR);
  });

  it("a second answer about the OTHER side can never overwrite the good one", async () => {
    /* Only the blind slot is ever written, so a reader answering about the
       wrong side costs the look and nothing else. */
    const { reader } = readerWith({ sideByCrop: async () => SOMETHING_ELSE });
    const scan = await scanFace({ frame: FRAME, reader, describe: null });
    expect(scan.boxes.get("ear@right")).toMatchObject(IMAGE_LEFT_EAR);
  });

  it("a blind second look leaves the pair exactly as it was read", async () => {
    const { reader } = readerWith({ sideByCrop: async () => null });
    const scan = await scanFace({ frame: FRAME, reader, describe: null });
    expect(scan.boxes.has("ear@left")).toBe(false);
    expect(scan.boxes.get("ear@right")).toMatchObject(IMAGE_LEFT_EAR);
  });

  it("CONTROL — a pair that answered on BOTH sides is never asked again", async () => {
    const { reader, order } = readerWith({
      sideByCrop: async () => RECOVERED,
      sides: () => ({ left: maskWith([IMAGE_RIGHT_EAR]), right: FIRST_READING }),
    });
    await scanFace({ frame: FRAME, reader, describe: null });
    /* The bill. A heal that fired on healthy reads would put a second call on
       every pair of every scan. */
    expect(order.filter((one) => one.startsWith("sideByCrop"))).toEqual([]);
  });

  it("CONTROL — a reader without the capability takes the old road, and still only replaces the blind side", async () => {
    const { reader, order } = readerWith();
    const scan = await scanFace({ frame: FRAME, reader, describe: null });
    expect(aboutTheEar(order), "asked twice, as before").toEqual(["regionSides ear", "regionSides ear"]);
    expect(scan.boxes.get("ear@right")).toMatchObject(IMAGE_LEFT_EAR);
  });

  it("an ear-worn pair carries the ear rule, and an anatomy pair does not", async () => {
    const { reader, order, earRule } = readerWith({ sideByCrop: async () => RECOVERED });
    await scanFace({ frame: FRAME, reader, describe: null });
    expect(earRule, "the earring's blind side is judged where an ear is").toEqual([true]);
    /* And the same question about an eye is not, because an eye is nearer the
       middle of the face than its side — the rule an ear passes would take an
       eye away. */
    expect(order).toContain("sideByCrop eyes left");
    expect(earRule, "only the ear-worn pair").toHaveLength(1);
  });

  it("a failed look costs the look and never the side already found", async () => {
    const { reader } = readerWith({
      sideByCrop: async () => { throw new Error("429 concurrent_requests_limit"); },
    });
    const scan = await scanFace({ frame: FRAME, reader, describe: null });
    expect(scan.boxes.get("ear@right")).toMatchObject(IMAGE_LEFT_EAR);
    expect(scan.boxes.has("ear@left")).toBe(false);
  });
});
