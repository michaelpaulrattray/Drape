/**
 * THE OTHER EAR, LOOKED AT BY THE DETECTOR (#2800, his eye round 6: *"why did
 * it pick up her left ear but not the left earing?"*).
 *
 * Measured on his screenshot: asked `earring` of the whole picture, the
 * segmenter offered the cast's right hoop and never the left one, and asked
 * again it answered identically. The detector boxed both. These arms drive the
 * repair at both ends — the reader with a stubbed provider answering in that
 * shape, then the scan's choice of when to ask — and every "found" arm has a
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

function maskWith(rects: { x: number; y: number; width: number; height: number }[], width = W, height = H): Mask {
  const data = Buffer.alloc(width * height, 0);
  for (const r of rects) {
    for (let y = r.y; y < r.y + r.height; y += 1) {
      for (let x = r.x; x < r.x + r.width; x += 1) data[y * width + x] = 255;
    }
  }
  return { data, width, height };
}

/* The face spans x 60–139, midline about x 100. A hoop hangs just outside each
   side; a ring sits on the midline under the nose. */
const IMAGE_LEFT_HOOP = { x: 50, y: 50, width: 8, height: 16 };
const IMAGE_RIGHT_HOOP = { x: 142, y: 48, width: 8, height: 16 };
const RING = { x: 94, y: 78, width: 12, height: 6 };

describe("the reader's other-ear look, with a provider answering the way his crop measured", () => {
  async function frame(): Promise<Buffer> {
    return sharp({ create: { width: W, height: H, channels: 3, background: { r: 200, g: 200, b: 200 } } }).png().toBuffer();
  }
  async function uri(mask: Mask): Promise<string> {
    const png = await sharp(mask.data, { raw: { width: mask.width, height: mask.height, channels: 1 } }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  }
  const fraction = (box: { x: number; y: number; width: number; height: number }) => ({
    x_min: box.x / W, y_min: box.y / H, x_max: (box.x + box.width) / W, y_max: (box.y + box.height) / H,
  });

  /**
   * `face` answers the face; the detector boxes both hoops and the ring; a box
   * cut answers the box filled (or, under `thin`, a sliver of it).
   */
  function stub(over: { boxes?: Array<{ x: number; y: number; width: number; height: number }>; thin?: boolean } = {}) {
    const detected: string[] = [];
    const cuts: Array<{ x_min: number; x_max: number }> = [];
    vi.stubGlobal("fetch", async (url: unknown, init: any) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
      if (String(url).includes("moondream3-preview/detect")) {
        detected.push(String(body.prompt));
        return json({ objects: (over.boxes ?? [IMAGE_LEFT_HOOP, IMAGE_RIGHT_HOOP, RING]).map(fraction) });
      }
      if (Array.isArray(body.box_prompts)) {
        const [box] = body.box_prompts;
        cuts.push({ x_min: box.x_min, x_max: box.x_max });
        const rect = { x: box.x_min, y: box.y_min, width: box.x_max - box.x_min, height: box.y_max - box.y_min };
        const answer = over.thin ? { ...rect, width: 1 } : rect;
        return json({ masks: [{ url: await uri(maskWith([answer])) }] });
      }
      if (body.prompt === "face") return json({ masks: [{ url: await uri(maskWith([{ x: 60, y: 20, width: 80, height: 90 }])) }] });
      throw new Error(`unexpected call: ${String(url)} ${String(body.prompt)}`);
    });
    return { detected, cuts };
  }

  it("the cast's LEFT ear is the image's right, and only that hoop is cut and kept", async () => {
    const { detected, cuts } = stub();
    const reader = createFalRegionReader({ apiKey: "k", pairInOneRead: true });
    const found = await reader.sideByDetector!({ image: await frame(), name: "earring", side: "left" });
    expect(boundsOf(found!)).toEqual(IMAGE_RIGHT_HOOP);
    expect(detected).toEqual(["earring"]);
    /* One box cut: the other side's hoop and the ring on the midline are never
       this side's, so they are never paid for. */
    expect(cuts).toEqual([{ x_min: 142, x_max: 150 }]);
  });

  it("and the cast's RIGHT ear is the image's left", async () => {
    stub();
    const reader = createFalRegionReader({ apiKey: "k", pairInOneRead: true });
    const found = await reader.sideByDetector!({ image: await frame(), name: "earring", side: "right" });
    expect(boundsOf(found!)).toEqual(IMAGE_LEFT_HOOP);
  });

  it("nothing boxed at this ear: nothing kept, and no cut bought", async () => {
    const { cuts } = stub({ boxes: [IMAGE_LEFT_HOOP, RING] });
    const reader = createFalRegionReader({ apiKey: "k", pairInOneRead: true });
    expect(await reader.sideByDetector!({ image: await frame(), name: "earring", side: "left" })).toBeNull();
    expect(cuts).toEqual([]);
  });

  it("a cut that fills almost none of its rectangle is refused, as the pointer road refuses it", async () => {
    stub({ thin: true });
    const reader = createFalRegionReader({ apiKey: "k", pairInOneRead: true });
    expect(await reader.sideByDetector!({ image: await frame(), name: "earring", side: "left" })).toBeNull();
  });
});

describe("the scan asks it once, of an ear-worn pair still one-sided after its own second look", () => {
  const FRAME = { bytes: Buffer.from("not a picture"), width: W, height: H };
  const FOUND = maskWith([IMAGE_LEFT_HOOP]);

  /** Every pair answers its image-left side only — the cast's right — as
   *  `earring` did on his picture, twice. */
  function readerWith(over: {
    sideByDetector?: RegionReader["sideByDetector"];
    sides?: (name: string) => SideRegions;
  } = {}): { reader: RegionReader; order: string[] } {
    const order: string[] = [];
    const reader = {
      async region() { return maskWith([{ x: 10, y: 10, width: 5, height: 5 }]); },
      async subject() { return maskWith([]); },
      async landmark() { return []; },
      async regionSides(input: { name: string }) {
        order.push(`regionSides ${input.name}`);
        return over.sides ? over.sides(input.name) : { left: maskWith([]), right: FOUND };
      },
      ...(over.sideByDetector ? {
        async sideByDetector(input: { name: string; side: "left" | "right" }) {
          order.push(`sideByDetector ${input.name} ${input.side}`);
          return over.sideByDetector!(input as never);
        },
      } : {}),
    } as RegionReader;
    return { reader, order };
  }

  it("the missing earring is filed on its own side, after the second look", async () => {
    const { reader, order } = readerWith({ sideByDetector: async () => maskWith([IMAGE_RIGHT_HOOP]) });
    const scan = await scanFace({ frame: FRAME, reader, describe: null });
    expect(scan.boxes.get("earring@left")).toMatchObject(IMAGE_RIGHT_HOOP);
    expect(scan.boxes.get("earring@right")).toMatchObject(IMAGE_LEFT_HOOP);
    const earring = order.filter((one) => one.includes("earring"));
    expect(earring).toEqual(["regionSides earring", "regionSides earring", "sideByDetector earring left"]);
  });

  it("no other pair asks it — an eye is not worn on an ear", async () => {
    const { reader, order } = readerWith({ sideByDetector: async () => maskWith([IMAGE_RIGHT_HOOP]) });
    await scanFace({ frame: FRAME, reader, describe: null });
    expect(order.filter((one) => one.startsWith("sideByDetector"))).toEqual(["sideByDetector earring left"]);
  });

  it("an earring pair empty on both sides is not asked", async () => {
    const { reader, order } = readerWith({
      sideByDetector: async () => maskWith([IMAGE_RIGHT_HOOP]),
      sides: () => ({ left: maskWith([]), right: maskWith([]) }),
    });
    const scan = await scanFace({ frame: FRAME, reader, describe: null });
    expect(order.filter((one) => one.startsWith("sideByDetector"))).toEqual([]);
    expect(scan.boxes.has("earring@left")).toBe(false);
  });

  it("a failed look costs the look and never the earring already found", async () => {
    const { reader } = readerWith({ sideByDetector: async () => { throw new Error("429 concurrent_requests_limit"); } });
    const scan = await scanFace({ frame: FRAME, reader, describe: null });
    expect(scan.boxes.get("earring@right")).toMatchObject(IMAGE_LEFT_HOOP);
    expect(scan.boxes.has("earring@left")).toBe(false);
    expect(scan.failed.map((one) => one.question)).not.toContain("earring");
  });

  it("CONTROL — a reader without the capability reads exactly as before", async () => {
    const { reader } = readerWith();
    const scan = await scanFace({ frame: FRAME, reader, describe: null });
    expect(scan.boxes.has("earring@left")).toBe(false);
    expect(scan.boxes.get("earring@right")).toMatchObject(IMAGE_LEFT_HOOP);
  });
});
