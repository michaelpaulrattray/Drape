/**
 * THE FACE THE SCAN CUTS BY IS ON THE HEAD (#2885, the founder's eye, round 11: *"it also
 * didnt pick up her eyes /brows etc after reanalyzing the image"*; and #2844,
 * round 10, the same class on another cast).
 *
 * Production's own log named the cause: the segmenter's shared `face` read —
 * the midline every pair is cut on, the face rule, the ear rules and the
 * other-ear look all trust it — answered a face TATTOOED ON THE CAST'S ARM, a 67px box
 * low in the frame. The real eyes, brows and ears were found and then dropped
 * as "away from the face", and both earrings fell on one side of a midline at
 * x81 and were drawn as one ear-to-ear box.
 *
 * The repair hands the reader the rectangle the discovery's head crop is cut
 * from (`discoveryHeadBoxOf`, the top half of the frame — geometry, never a
 * reading, so the read is not judged against itself), and every arm below is
 * driven through the REAL `createFalRegionReader` with a stub segmenter:
 *
 *   - the defect reproduced on today's road (no head box), as the negative
 *     control every repaired arm is read against;
 *   - the refusal and the re-ask on the head crop, mapped back to the frame;
 *   - the union sibling (the cast's face AND the tattoo's in one read);
 *   - the re-ask finding nothing, which must read on WITHOUT a face rather than
 *     without the eyes;
 *   - a real face whose chin crosses the head box's edge, kept whole;
 *   - the earring side the founder saw drawn across the nose;
 *   - the #2532 single-instance guard, still refusing on the new reader;
 *   - and the whole scan through `faceScanService`, the wire that hands the box
 *     in.
 *
 * The frame encodes its own coordinates in its pixels (R = x, G/B = y), so the
 * stub knows WHICH piece of the frame it was asked about from the picture alone
 * — the reader never says, and a stub that guessed the midline would agree with
 * whatever midline the code chose.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

import { createFalRegionReader } from "./falRegionReader";
import { discoveryCropsOf, discoveryHeadBoxOf } from "./faceDiscovery";
import { boundsOf } from "./segmentCuts";
import type { Mask } from "./maskedComposite";

vi.mock("../auditLog", () => ({ logAuditEvent: async () => undefined }));

afterEach(() => {
  vi.unstubAllGlobals();
});

const W = 256;
const H = 384;
type Rect = { x: number; y: number; width: number; height: number };

/* The cast's face, at a quarter of a 1024x1536 frame (the round-10 cast's own
   geometry, as `faceFeatureOnTheFace.test.ts` scales it). Centre y 133.5 —
   inside a head box that ends at row 192. */
const REAL_FACE: Rect = { x: 88, y: 79, width: 94, height: 110 };
/* The tattooed face on the arm, where production logged it on round 11
   (x50–117, y955–1132 on a frame about 768 wide), at this frame's scale:
   low on the image-left, its centre at y 347 — far outside the head box. */
const TATTOO_FACE: Rect = { x: 17, y: 318, width: 23, height: 59 };
/* The cast's face again, with its chin PAST the head box's edge (bottom row 229
   against a box ending at 192) and its centre (174.5) inside it — the shape
   six of the eleven measured faces have. */
const LOW_FACE: Rect = { x: 88, y: 120, width: 94, height: 110 };

const RIGHT_EYE: Rect = { x: 93, y: 110, width: 22, height: 12 };
const LEFT_EYE: Rect = { x: 140, y: 110, width: 21, height: 12 };
const RIGHT_BROW: Rect = { x: 92, y: 99, width: 24, height: 10 };
const LEFT_BROW: Rect = { x: 146, y: 99, width: 12, height: 7 };
const RIGHT_EAR: Rect = { x: 71, y: 98, width: 12, height: 34 };
const LEFT_EAR: Rect = { x: 171, y: 99, width: 12, height: 32 };
/* The tattoo's own eye, inside the tattooed face. */
const TATTOO_EYE: Rect = { x: 22, y: 335, width: 6, height: 4 };
/* A hoop under each ear. */
const IMAGE_LEFT_HOOP: Rect = { x: 72, y: 134, width: 8, height: 16 };
const IMAGE_RIGHT_HOOP: Rect = { x: 174, y: 133, width: 8, height: 16 };

/** What the segmenter can see, by the noun it is asked — in FRAME pixels. */
const FEATURES: Record<"eye" | "eyebrow" | "ear" | "earring", Rect[]> = {
  eye: [RIGHT_EYE, LEFT_EYE, TATTOO_EYE],
  eyebrow: [RIGHT_BROW, LEFT_BROW],
  ear: [RIGHT_EAR, LEFT_EAR],
  earring: [IMAGE_LEFT_HOOP, IMAGE_RIGHT_HOOP],
};

const HEAD = discoveryHeadBoxOf({ width: W, height: H })!;
const HEAD_BOX = { frame: { width: W, height: H }, box: HEAD };

function maskWith(rects: Rect[], width: number, height: number, left = 0, top = 0): Mask {
  const data = Buffer.alloc(width * height, 0);
  for (const r of rects) {
    for (let y = r.y - top; y < r.y - top + r.height; y += 1) {
      if (y < 0 || y >= height) continue;
      for (let x = r.x - left; x < r.x - left + r.width; x += 1) {
        if (x >= 0 && x < width) data[y * width + x] = 255;
      }
    }
  }
  return { data, width, height };
}

/** Does any part of `r` fall inside the crop? */
function meets(r: Rect, crop: { left: number; top: number; width: number; height: number }): boolean {
  return r.x < crop.left + crop.width && r.x + r.width > crop.left
    && r.y < crop.top + crop.height && r.y + r.height > crop.top;
}

async function uri(mask: Mask): Promise<string> {
  const png = await sharp(mask.data, { raw: { width: mask.width, height: mask.height, channels: 1 } }).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

/** A frame whose every pixel says where it is: R = x, G = y mod 256, B = y div 256. */
async function frame(width = W, height = H): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = (y * width + x) * 3;
      raw[at] = x & 255;
      raw[at + 1] = y & 255;
      raw[at + 2] = y >> 8;
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

/** Where a picture the reader sent sits in the frame, read off its first pixel. */
async function placeOf(image: Buffer): Promise<{ left: number; top: number; width: number; height: number }> {
  const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { left: data[0]!, top: data[1]! + 256 * data[2]!, width: info.width, height: info.height };
}

type FaceAsk = { whole: boolean; place: { left: number; top: number; width: number; height: number }; multiple: boolean };
type Wire = { faceAsks: FaceAsk[]; halves: Array<{ noun: string; left: number; width: number }> };

/**
 * The stub segmenter. `whole` is what `face` answers on the whole frame (one
 * array per mask the provider returns); `head` is what it answers on any
 * smaller picture, i.e. the head crop — written in FRAME pixels and shifted
 * into the crop here, so an arm states where the face IS and never where the
 * crop happens to put it.
 */
function stubFal(scenario: { whole: Rect[][]; head?: Rect[][] }): Wire {
  const wire: Wire = { faceAsks: [], halves: [] };
  vi.stubGlobal("fetch", async (address: unknown, init: any) => {
    const url = String(address);
    const json = (value: unknown) => new Response(JSON.stringify(value), {
      status: 200, headers: { "content-type": "application/json" },
    });
    if (!url.startsWith("https://fal.run/")) return new Response("not served", { status: 404 });
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (url.includes("moondream3-preview/detect")) {
      const rects = String(body.prompt).includes("earring") ? FEATURES.earring : [];
      return json({
        objects: rects.map((r) => ({ x_min: r.x / W, y_min: r.y / H, x_max: (r.x + r.width) / W, y_max: (r.y + r.height) / H })),
      });
    }
    if (!url.includes("sam-3")) return json({});
    const image = Buffer.from(String(body.image_url).split(",")[1], "base64");
    const place = await placeOf(image);
    if (Array.isArray(body.box_prompts)) {
      /* A box cut answers the rectangle it was asked about, filled. */
      const [box] = body.box_prompts;
      const rect = { x: box.x_min, y: box.y_min, width: box.x_max - box.x_min, height: box.y_max - box.y_min };
      return json({ masks: [{ url: await uri(maskWith([rect], W, H)) }] });
    }
    const prompt = String(body.prompt ?? "");
    const reply = async (masks: Rect[][]) => json({
      masks: await Promise.all(masks.map(async (rects) => ({
        url: await uri(maskWith(rects, place.width, place.height, place.left, place.top)),
      }))),
    });
    if (prompt === "face") {
      const whole = place.width === W && place.height === H;
      wire.faceAsks.push({ whole, place, multiple: body.return_multiple_masks === true });
      return reply(whole ? scenario.whole : scenario.head ?? []);
    }
    const noun = prompt.includes("brow") ? "eyebrow"
      : prompt.includes("earring") ? "earring"
      : prompt.includes("eye") ? "eye"
      : prompt.includes("ear") ? "ear"
      : null;
    if (noun === null) return reply([]);
    wire.halves.push({ noun, left: place.left, width: place.width });
    /* Every separate thing on this piece of the frame comes back as its own
       instance, as SAM 3 answers when asked for several. */
    return reply(FEATURES[noun].filter((r) => meets(r, place)).map((r) => [r]));
  });
  return wire;
}

const coverage = (mask: Mask | null | undefined): number => (mask ? mask.data.reduce((n, v) => n + (v > 0 ? 1 : 0), 0) : 0);
/** Every pixel of `rect` is held by `mask`. */
function holds(mask: Mask | null | undefined, rect: Rect): boolean {
  if (!mask) return false;
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) if (mask.data[y * mask.width + x] === 0) return false;
  }
  return true;
}

async function eyesBrowsEars(reader: ReturnType<typeof createFalRegionReader>, image: Buffer) {
  const read = (name: string) => reader.regionSides!({ image, name, absentIsAnswer: true });
  const [eyes, brows, ears] = await Promise.all([read("eyes"), read("eyebrows"), read("ear")]);
  return { eyes: eyes!, brows: brows!, ears: ears! };
}

describe("the head box is the rectangle the discovery's head crop is cut from", () => {
  it("is the top half of the frame at full width, and nothing for a frame too small to head-crop", () => {
    expect(discoveryHeadBoxOf({ width: 1024, height: 1536 })).toEqual({ left: 0, top: 0, width: 1024, height: 768 });
    expect(discoveryHeadBoxOf({ width: W, height: H })).toEqual({ left: 0, top: 0, width: W, height: 192 });
    expect(discoveryHeadBoxOf({ width: 63, height: 400 })).toBeNull();
    expect(discoveryHeadBoxOf({ width: 400, height: 126 })).toBeNull();
    expect(discoveryHeadBoxOf({ width: 400, height: 127 })).toEqual({ left: 0, top: 0, width: 400, height: 64 });
  });

  it("the head crop the discovery asks about IS that rectangle — one source, not two", async () => {
    /* Cut from a frame whose top half is white and bottom half black: a crop
       taken from any rectangle but the box would carry black rows. */
    const width = 400;
    const height = 900;
    const raw = Buffer.alloc(width * height * 3, 0);
    raw.fill(255, 0, width * Math.round(height / 2) * 3);
    const bytes = await sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
    const [head] = await discoveryCropsOf({ bytes, width, height });
    const box = discoveryHeadBoxOf({ width, height })!;
    const { data, info } = await sharp(head!.bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    /* Resized to 768 wide, so the crop's aspect is the box's. */
    expect(info.height).toBe(Math.round((box.height * info.width) / box.width));
    expect(data.every((value) => value === 255)).toBe(true);
  });
});

describe("today's road — no head box — reproduces the founder's round-11 scan", () => {
  it("NEGATIVE CONTROL: a face read on the arm drops the real eyes, brows and ears as away from the face", async () => {
    stubFal({ whole: [[TATTOO_FACE]] });
    const reader = createFalRegionReader({ apiKey: "k" });
    const { eyes, brows, ears } = await eyesBrowsEars(reader, await frame());
    expect(holds(eyes.left, LEFT_EYE)).toBe(false);
    expect(holds(eyes.right, RIGHT_EYE)).toBe(false);
    expect(coverage(brows.left) + coverage(brows.right)).toBe(0);
    expect(coverage(ears.left) + coverage(ears.right)).toBe(0);
  });

  it("NEGATIVE CONTROL: both earrings fall on one side of a midline on the arm — the founder's ear-to-ear box", async () => {
    stubFal({ whole: [[TATTOO_FACE]] });
    const reader = createFalRegionReader({ apiKey: "k" });
    const left = await reader.sideByDetector!({ image: await frame(), name: "earring", side: "left" });
    expect(holds(left, IMAGE_LEFT_HOOP) && holds(left, IMAGE_RIGHT_HOOP)).toBe(true);
  });
});

describe("with the head box, a face read on the arm is refused and the head is asked again", () => {
  it("finds the eyes, brows and ears on both sides — the tattoo's eye judged by the real face and dropped", async () => {
    stubFal({ whole: [[TATTOO_FACE]], head: [[REAL_FACE]] });
    const reader = createFalRegionReader({ apiKey: "k", headBox: HEAD_BOX });
    const { eyes, brows, ears } = await eyesBrowsEars(reader, await frame());
    /* The cast's LEFT is the image's right. */
    expect(boundsOf(eyes.left)).toEqual(LEFT_EYE);
    expect(boundsOf(eyes.right)).toEqual(RIGHT_EYE);
    expect(boundsOf(brows.left)).toEqual(LEFT_BROW);
    expect(boundsOf(brows.right)).toEqual(RIGHT_BROW);
    expect(boundsOf(ears.left)).toEqual(LEFT_EAR);
    expect(boundsOf(ears.right)).toEqual(RIGHT_EAR);
  });

  it("asks the head crop once, for every reader of the face on that frame, and never for several instances", async () => {
    const wire = stubFal({ whole: [[TATTOO_FACE]], head: [[REAL_FACE]] });
    const reader = createFalRegionReader({ apiKey: "k", headBox: HEAD_BOX });
    const image = await frame();
    await eyesBrowsEars(reader, image);
    await reader.region({ image, name: "face", absentIsAnswer: true });
    await reader.sideByDetector!({ image, name: "earring", side: "left" });
    expect(wire.faceAsks.map((one) => one.whole)).toEqual([true, false]);
    expect(wire.faceAsks[1]!.place).toEqual({ left: 0, top: 0, width: W, height: HEAD.height });
    /* The #2532 guard's subject: the shared face read asks for ONE instance,
       on the frame and on the head alike. */
    expect(wire.faceAsks.filter((one) => one.multiple)).toEqual([]);
  });

  it("cuts the build row's head from the same judged face — the cast's face, not the arm", async () => {
    stubFal({ whole: [[TATTOO_FACE]], head: [[REAL_FACE]] });
    const reader = createFalRegionReader({ apiKey: "k", headBox: HEAD_BOX });
    const head = await reader.region({ image: await frame(), name: "face", absentIsAnswer: true });
    expect(boundsOf(head)).toEqual(REAL_FACE);
  });

  it("puts the re-asked face back where the head box is, for a box that is not at the frame's corner", async () => {
    /* `discoveryHeadBoxOf` always starts at (0,0), which would pass a
       placement that ignored the offset. This box does not. */
    const box = { left: 16, top: 40, width: 200, height: 200 };
    const wire = stubFal({ whole: [[TATTOO_FACE]], head: [[REAL_FACE]] });
    const reader = createFalRegionReader({ apiKey: "k", headBox: { frame: { width: W, height: H }, box } });
    const head = await reader.region({ image: await frame(), name: "face", absentIsAnswer: true });
    expect(wire.faceAsks[1]!.place).toEqual(box);
    expect(boundsOf(head)).toEqual(REAL_FACE);
  });

  it("the pair road (one request for both sides) is cut at the real midline too", async () => {
    stubFal({ whole: [[TATTOO_FACE]], head: [[REAL_FACE]] });
    const reader = createFalRegionReader({ apiKey: "k", pairInOneRead: true, headBox: HEAD_BOX });
    const eyes = await reader.regionSides!({ image: await frame(), name: "eyes", absentIsAnswer: true });
    expect(boundsOf(eyes!.left)).toEqual(LEFT_EYE);
    expect(boundsOf(eyes!.right)).toEqual(RIGHT_EYE);
  });

  it("the half-answered heal reads the blind side by the same judged face", async () => {
    stubFal({ whole: [[TATTOO_FACE]], head: [[REAL_FACE]] });
    const reader = createFalRegionReader({ apiKey: "k", headBox: HEAD_BOX });
    const healed = await reader.sideByCrop!({ image: await frame(), name: "eyes", side: "left" });
    expect(boundsOf(healed!)).toEqual(LEFT_EYE);
  });

  it("the earrings are on their own ears again", async () => {
    stubFal({ whole: [[TATTOO_FACE]], head: [[REAL_FACE]] });
    const reader = createFalRegionReader({ apiKey: "k", headBox: HEAD_BOX });
    const image = await frame();
    const left = await reader.sideByDetector!({ image, name: "earring", side: "left" });
    const right = await reader.sideByDetector!({ image, name: "earring", side: "right" });
    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
    expect(boundsOf(left!)).toEqual(IMAGE_RIGHT_HOOP);
    expect(boundsOf(right!)).toEqual(IMAGE_LEFT_HOOP);
    const sides = await reader.regionSides!({ image, name: "earring", absentIsAnswer: true, onTheEars: true });
    expect(boundsOf(sides!.left)).toEqual(IMAGE_RIGHT_HOOP);
    expect(boundsOf(sides!.right)).toEqual(IMAGE_LEFT_HOOP);
  });
});

describe("the union sibling — the cast's face and the tattoo's in one read", () => {
  it("NEGATIVE CONTROL, today's road: the union's span holds the arm, so the tattoo's eye passes the face rule", async () => {
    stubFal({ whole: [[REAL_FACE], [TATTOO_FACE]] });
    const reader = createFalRegionReader({ apiKey: "k" });
    const { eyes } = await eyesBrowsEars(reader, await frame());
    expect(holds(eyes.right, RIGHT_EYE)).toBe(true);
    expect(holds(eyes.right, TATTOO_EYE)).toBe(true);
  });

  it("with the head box the arm's piece is refused, the cast's face stands, and nothing is asked again", async () => {
    const wire = stubFal({ whole: [[REAL_FACE], [TATTOO_FACE]] });
    const reader = createFalRegionReader({ apiKey: "k", headBox: HEAD_BOX });
    const image = await frame();
    const { eyes } = await eyesBrowsEars(reader, image);
    expect(boundsOf(eyes.right)).toEqual(RIGHT_EYE);
    expect(boundsOf(eyes.left)).toEqual(LEFT_EYE);
    expect(boundsOf(await reader.region({ image, name: "face", absentIsAnswer: true }))).toEqual(REAL_FACE);
    expect(wire.faceAsks.map((one) => one.whole)).toEqual([true]);
  });
});

describe("when the head alone answers no face either", () => {
  it("the scan reads on WITHOUT a face — every real eye, brow and ear kept, none dropped", async () => {
    const wire = stubFal({ whole: [[TATTOO_FACE]], head: [] });
    const reader = createFalRegionReader({ apiKey: "k", headBox: HEAD_BOX });
    const image = await frame();
    const { eyes, brows, ears } = await eyesBrowsEars(reader, image);
    /* No face, so nothing is judged against one — a missing face's answer,
       which is NOT "no eyes". The pairs are cut at the frame's middle. */
    expect(holds(eyes.left, LEFT_EYE)).toBe(true);
    expect(holds(eyes.right, RIGHT_EYE)).toBe(true);
    expect(holds(brows.left, LEFT_BROW) && holds(brows.right, RIGHT_BROW)).toBe(true);
    expect(holds(ears.left, LEFT_EAR) && holds(ears.right, RIGHT_EAR)).toBe(true);
    expect(new Set(wire.halves.filter((one) => one.left === 0).map((one) => one.width))).toEqual(new Set([W / 2]));
    /* And the build row's head is the honest absence. */
    expect(coverage(await reader.region({ image, name: "face", absentIsAnswer: true }))).toBe(0);
  });

  it("CONTROL: the same frame with NO face anywhere answers the same — the refused road and the empty one agree", async () => {
    stubFal({ whole: [] });
    const reader = createFalRegionReader({ apiKey: "k", headBox: HEAD_BOX });
    const { eyes } = await eyesBrowsEars(reader, await frame());
    expect(holds(eyes.left, LEFT_EYE) && holds(eyes.right, RIGHT_EYE)).toBe(true);
  });
});

describe("POSITIVE CONTROLS — a face on the head is the face", () => {
  it("is returned as it came, with no second request", async () => {
    const wire = stubFal({ whole: [[REAL_FACE]] });
    const reader = createFalRegionReader({ apiKey: "k", headBox: HEAD_BOX });
    const image = await frame();
    const { eyes } = await eyesBrowsEars(reader, image);
    expect(boundsOf(eyes.left)).toEqual(LEFT_EYE);
    expect(boundsOf(eyes.right)).toEqual(RIGHT_EYE);
    expect(boundsOf(await reader.region({ image, name: "face", absentIsAnswer: true }))).toEqual(REAL_FACE);
    expect(wire.faceAsks.map((one) => one.whole)).toEqual([true]);
  });

  it("a face whose CHIN crosses the head box's edge is kept whole — judged by its centre, not its extent", async () => {
    const wire = stubFal({ whole: [[LOW_FACE]] });
    const reader = createFalRegionReader({ apiKey: "k", headBox: HEAD_BOX });
    const head = await reader.region({ image: await frame(), name: "face", absentIsAnswer: true });
    expect(LOW_FACE.y + LOW_FACE.height).toBeGreaterThan(HEAD.height);
    expect(boundsOf(head)).toEqual(LOW_FACE);
    expect(wire.faceAsks.map((one) => one.whole)).toEqual([true]);
  });

  it("a picture of another size than the box was measured on is not judged by it — today's answer, no re-ask", async () => {
    const wire = stubFal({ whole: [[TATTOO_FACE]], head: [[REAL_FACE]] });
    /* A box that WOULD refuse the arm's face, had it been measured on this
       picture — so only the size check can be what keeps it out. */
    const reader = createFalRegionReader({
      apiKey: "k", headBox: { frame: { width: W * 2, height: H * 2 }, box: HEAD },
    });
    const head = await reader.region({ image: await frame(), name: "face", absentIsAnswer: true });
    expect(boundsOf(head)).toEqual(TATTOO_FACE);
    expect(wire.faceAsks.map((one) => one.whole)).toEqual([true]);
  });
});

describe("#2532's guard holds on the new reader", () => {
  it("the shared face read still refuses to ask for several instances", async () => {
    const wire = stubFal({ whole: [[REAL_FACE]] });
    const reader = createFalRegionReader({ apiKey: "k", pairInOneRead: true, headBox: HEAD_BOX });
    await expect(reader.regionSides!({
      image: await frame(), name: "face", absentIsAnswer: true, declaredTwoSided: true,
    })).rejects.toThrow(/may not ask for several instances/);
    expect(wire.faceAsks.filter((one) => one.multiple)).toEqual([]);
  });
});

describe("the scan hands the head box in — `faceScanService`, its own reader, the whole catalogue", () => {
  const saved = { FAL_KEY: process.env.FAL_KEY };
  beforeEach(() => {
    process.env.FAL_KEY = "test-not-a-key";
    delete process.env.CASTING_SCAN_TABLE_SCOPE;
    delete process.env.ENABLE_CASTING_PAIR_ONE_READ;
  });
  afterEach(() => {
    if (saved.FAL_KEY === undefined) delete process.env.FAL_KEY;
    else process.env.FAL_KEY = saved.FAL_KEY;
  });

  async function scan(scenario: { whole: Rect[][]; head?: Rect[][] }, candidateId: number) {
    const { resetFaceScanCache, scannedFace } = await import("./faceScanService");
    resetFaceScanCache();
    const wire = stubFal(scenario);
    const bytes = await frame();
    const read = await scannedFace({
      userId: 2_885_001,
      candidateId,
      variantId: null,
      imageKey: `local/2885/${candidateId}.png`,
      dependencies: {
        readBytes: (async () => ({ bytes, contentType: "image/png" })) as never,
        publicUrl: () => "https://frame.invalid/2885.png",
        describe: null,
        discover: null,
      },
    });
    return { read, wire };
  }

  it("the founder's round-11 shape: the face read lands on the arm, and the scan still finds every side", async () => {
    const { read, wire } = await scan({ whole: [[TATTOO_FACE]], head: [[REAL_FACE]] }, 2_885_011);
    expect(read.sides).toContain("eye:LR brow:LR ear:LR");
    expect(read.sides).toContain("earring:LR");
    expect(wire.faceAsks.map((one) => one.whole)).toEqual([true, false]);
  }, 30_000);

  it("CONTROL: a face read on the head is read once, as every scan before this one", async () => {
    const { read, wire } = await scan({ whole: [[REAL_FACE]] }, 2_885_012);
    expect(read.sides).toContain("eye:LR brow:LR ear:LR");
    expect(wire.faceAsks.map((one) => one.whole)).toEqual([true]);
  }, 30_000);
});

/**
 * EVERY READER SAYS WHERE THE HEAD IS — the derived answer (#2888).
 *
 * #2887 gave the SCAN a head box and left every other reader on today's road,
 * named in its own commit rather than shipped silently. Those readers are the
 * paid refine's (ten call sites), the take's, the ink mint's and the ink
 * upload's, and all four are built BEFORE any frame is in hand — so they say
 * `"topHalfOfEachPicture"` and the box is derived from the bytes each read
 * actually gets, through the same `discoveryHeadBoxOf` the scan's measured box
 * came from.
 *
 * The contrast arm is the one that earns the second answer: on a picture the
 * scan's measured box declines to judge (another size), the derived answer
 * judges it — which is exactly the position a refine is in, reading one
 * picture after another through one reader.
 */
describe("the derived head box — every reader but the scan's (#2888)", () => {
  const DERIVED = "topHalfOfEachPicture" as const;

  it("the founder's round-11 shape, on a reader that measured nothing: the arm's face is refused and the head is asked again", async () => {
    const wire = stubFal({ whole: [[TATTOO_FACE]], head: [[REAL_FACE]] });
    const reader = createFalRegionReader({ apiKey: "k", headBox: DERIVED });
    const image = await frame();
    const { eyes, brows, ears } = await eyesBrowsEars(reader, image);
    expect(boundsOf(eyes.left)).toEqual(LEFT_EYE);
    expect(boundsOf(eyes.right)).toEqual(RIGHT_EYE);
    expect(boundsOf(brows.left)).toEqual(LEFT_BROW);
    expect(boundsOf(brows.right)).toEqual(RIGHT_BROW);
    expect(boundsOf(ears.left)).toEqual(LEFT_EAR);
    expect(boundsOf(ears.right)).toEqual(RIGHT_EAR);
    /* The whole frame once, then the head crop once — one extra read, as the
       measured road buys. */
    expect(wire.faceAsks.map((one) => one.whole)).toEqual([true, false]);
  });

  it("judges a picture the scan's MEASURED box declines to judge — which is the whole reason for a second answer", async () => {
    /* The arm above in "POSITIVE CONTROLS" drives the measured half of this
       comparison: the same frame, a box measured on another size, the arm's
       face returned untouched and no re-ask. Here the only thing that differs
       is which answer the caller gave. */
    const measured = stubFal({ whole: [[TATTOO_FACE]], head: [[REAL_FACE]] });
    const declines = createFalRegionReader({
      apiKey: "k", headBox: { frame: { width: W * 2, height: H * 2 }, box: HEAD },
    });
    expect(boundsOf(await declines.region({ image: await frame(), name: "face", absentIsAnswer: true })))
      .toEqual(TATTOO_FACE);
    expect(measured.faceAsks.map((one) => one.whole)).toEqual([true]);

    vi.unstubAllGlobals();
    const derived = stubFal({ whole: [[TATTOO_FACE]], head: [[REAL_FACE]] });
    const reader = createFalRegionReader({ apiKey: "k", headBox: DERIVED });
    expect(boundsOf(await reader.region({ image: await frame(), name: "face", absentIsAnswer: true })))
      .toEqual(REAL_FACE);
    expect(derived.faceAsks.map((one) => one.whole)).toEqual([true, false]);
  });

  it("agrees with the scan's measured box on the frames the product reads — one geometry, two ways of asking", async () => {
    for (const scenario of [
      { whole: [[REAL_FACE]] },
      { whole: [[LOW_FACE]] },
      { whole: [[TATTOO_FACE]], head: [[REAL_FACE]] },
      { whole: [[REAL_FACE, TATTOO_FACE]] },
    ]) {
      const readings: Array<{ bounds: Rect | null; asks: boolean[] }> = [];
      for (const headBox of [HEAD_BOX, DERIVED] as const) {
        vi.unstubAllGlobals();
        const wire = stubFal(scenario);
        const reader = createFalRegionReader({ apiKey: "k", headBox });
        const bounds = boundsOf(await reader.region({ image: await frame(), name: "face", absentIsAnswer: true }));
        readings.push({ bounds, asks: wire.faceAsks.map((one) => one.whole) });
      }
      expect(readings[1], JSON.stringify(scenario)).toEqual(readings[0]);
    }
  }, 30_000);

  it("a picture too small to cut a head crop is read as today — no judging, no second request", async () => {
    /* `discoveryHeadBoxOf` answers `null` under 64px, which is the same answer
       the discovery gives such a frame: it asks about it at all. */
    expect(discoveryHeadBoxOf({ width: 60, height: 60 })).toBeNull();
    const LOW_ON_A_TINY_FRAME: Rect = { x: 5, y: 40, width: 10, height: 10 };
    const wire = stubFal({ whole: [], head: [[LOW_ON_A_TINY_FRAME]] });
    const reader = createFalRegionReader({ apiKey: "k", headBox: DERIVED });
    const face = await reader.region({ image: await frame(60, 60), name: "face", absentIsAnswer: true });
    expect(boundsOf(face)).toEqual(LOW_ON_A_TINY_FRAME);
    expect(wire.faceAsks).toHaveLength(1);
  });

  it("POSITIVE CONTROL: a face on the head is returned as it came, with no second request", async () => {
    const wire = stubFal({ whole: [[REAL_FACE]] });
    const reader = createFalRegionReader({ apiKey: "k", headBox: DERIVED });
    const image = await frame();
    expect(boundsOf(await reader.region({ image, name: "face", absentIsAnswer: true }))).toEqual(REAL_FACE);
    const { eyes } = await eyesBrowsEars(reader, image);
    expect(boundsOf(eyes.left)).toEqual(LEFT_EYE);
    expect(boundsOf(eyes.right)).toEqual(RIGHT_EYE);
    expect(wire.faceAsks.map((one) => one.whole)).toEqual([true]);
  });
});
