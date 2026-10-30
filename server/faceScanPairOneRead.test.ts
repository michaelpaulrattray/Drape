/**
 * A PAIR ASKED ONCE INSTEAD OF TWICE — driven at the wire, both flag positions
 * (#2191, his goal of 2026-10-10: *"our goal would be to reduce this cost by as
 * much as possible"*).
 *
 * A face scan's five bilateral regions are read one half-frame at a time, so
 * each costs TWO segmenter reads — ten of the floor's eighteen. #2532's arm 1
 * measured that one whole-frame read can answer both sides, because fal's
 * `return_multiple_masks` had never been sent and *"SAM 3 returns exactly one
 * instance for a bilateral noun"* was therefore a fact about our REQUEST.
 * `ENABLE_CASTING_PAIR_ONE_READ` is that road, off by default.
 *
 * # What this suite holds, and the first arm is the one that matters most
 *
 * The saving is arithmetic and easy; the risk is all in WHAT COMES BACK. So:
 *
 *   1. **Off is today, byte for byte** — two reads per pair and the new fields
 *      on NO request. The road is dark until a caller asks for it, and a suite
 *      that only tested the new road would not notice it leaking.
 *   2. **On costs one read** and sends exactly the two fields fal publishes.
 *   3. **Both mask shapes come apart correctly.** Arm 1 measured two: `ear` and
 *      `earring` answer as two clean per-side masks, `eyes` and `eyebrows`
 *      usually as ONE mask spanning the midline. A reader that handled only one
 *      of those would silently halve three nouns, so both are driven.
 *   4. **A one-sided answer stays one-sided here**, and the half-answered-pair
 *      heal in `faceScan.ts` still sees it and still buys its second look — the
 *      measured control must not be the thing this saving breaks.
 *   5. **An empty answer is empty at ONE read**, which is what `absentIsAnswer`
 *      rests on.
 *   6. **The shared `face` read refuses the setting outright** — driven
 *      directly, because it shattered into two masks on the elder alien and it
 *      is where every midline and the build row's head box come from.
 *
 * The floor and ceiling are DERIVED by the same drive `faceScanSpend.test.ts`
 * uses and pinned to `FACE_SCAN_FAL_CALLS.sam3.pairInOneRead`, so the constant
 * cannot drift from the wire.
 */
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

import { scanFace } from "./castingV2/faceScan";
import { createFalRegionReader, singularOf } from "./castingV2/falRegionReader";
import { catalogueSlots } from "./castingV2/referenceSlotCatalogue";
import { PAIR_ONE_READ_ENV, pairInOneReadEnabled } from "./castingV2/faceScanService";
import { FACE_SCAN_FAL_CALLS } from "../scripts/lib/falSpend.mts";

const SAM3 = "fal-ai/sam-3/image";
const BIREFNET = "fal-ai/birefnet/v2";

const WIDTH = 400;
const HEIGHT = 600;

/** Every question the scan reads a side at a time — the catalogue's own fact,
 *  read rather than typed, so a new pair joins these arms by itself. */
const PAIR_QUESTIONS = new Set(
  catalogueSlots()
    .filter((definition) => definition.frame === "ownSide" && definition.question !== null)
    .map((definition) => definition.question as string),
);

/* The halves are different colours so a fake can tell which side of the midline
   a half-frame question is about from the picture alone — the reader never says
   so in the request. Same device as `faceScanSpend.test.ts`. */
const LEFT = { r: 200, g: 40, b: 40 };
const RIGHT = { r: 40, g: 40, b: 200 };

async function frame(): Promise<Buffer> {
  const half = WIDTH / 2;
  const left = await sharp({ create: { width: half, height: HEIGHT, channels: 3, background: LEFT } }).png().toBuffer();
  const right = await sharp({ create: { width: half, height: HEIGHT, channels: 3, background: RIGHT } }).png().toBuffer();
  return sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .composite([{ input: left, left: 0, top: 0 }, { input: right, left: half, top: 0 }])
    .png()
    .toBuffer();
}

/** A mask covering the given x bands over the middle third of the height. */
async function bands(width: number, height: number, xs: Array<[number, number]>): Promise<string> {
  const data = Buffer.alloc(width * height, 0);
  for (let y = Math.floor(height / 3); y < Math.floor((height * 2) / 3); y += 1) {
    for (const [from, to] of xs) {
      data.fill(255, y * width + Math.floor(width * from), y * width + Math.floor(width * to));
    }
  }
  const png = await sharp(data, { raw: { width, height, channels: 1 } }).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

/**
 * A MASK AT A GIVEN HEIGHT BAND — `bands` paints the middle third only, and a
 * feature on the FOREHEAD has to sit above the eyes to be its own piece (#2783).
 */
async function rect(
  width: number,
  height: number,
  xs: [number, number],
  ys: [number, number],
): Promise<string> {
  const data = Buffer.alloc(width * height, 0);
  for (let y = Math.floor(height * ys[0]); y < Math.floor(height * ys[1]); y += 1) {
    data.fill(255, y * width + Math.floor(width * xs[0]), y * width + Math.floor(width * xs[1]));
  }
  const png = await sharp(data, { raw: { width, height, channels: 1 } }).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

/** A centred rectangle covering `share` of each axis — the whole-frame answer. */
async function blob(width: number, height: number, share: number): Promise<string> {
  const x0 = Math.floor(width * (0.5 - share / 2));
  const x1 = Math.floor(width * (0.5 + share / 2));
  return bands(width, height, [[x0 / width, x1 / width]]);
}

const coverage = (mask: { data: Buffer }): number => mask.data.reduce((n, byte) => n + (byte === 0 ? 0 : 1), 0);

/**
 * The shape a pair answer comes back in — arm 1 measured the first two on real
 * frames, and the last two are the readings the scan's own controls rest on.
 */
type Shape = "spanning" | "perSide" | "oneSided" | "none" | "midlinePiece" | "midlineOnly" | "bandAndSpeck";

const BANDS: Record<"spanning" | "perSide" | "oneSided", Array<[number, number]>> = {
  /* One mask across her midline covering both — `eyes`, `eyebrows`. */
  spanning: [[0.2, 0.8]],
  /* Two masks, one per side — `ear`, `earring`. Returned as two entries. */
  perSide: [[0.05, 0.3], [0.7, 0.95]],
  /* Everything on one side of the midline: a head turned away. */
  oneSided: [[0.6, 0.9]],
};

type Wire = {
  sam3ByPrompt: Map<string, number>;
  multipleAsked: string[];
  maxMasks: number[];
  halfFrameAsks: number;
  sam3Asked: { prompt: string; wholeFrame: boolean }[];
  birefnet: number;
};

/**
 * A fake fal that answers every question and records what it was asked.
 *
 * A pair arriving as a WHOLE frame is the new road (and the fake asserts the
 * fields are what makes it so, by reading them); a pair arriving as a half
 * frame is today's. `shape` decides what a pair read answers with; everything
 * else is always found, because this suite is about the pair road and an empty
 * answer anywhere else only adds re-asks that `faceScanSpend.test.ts` already
 * derives.
 */
function stubFal(shape: Shape): Wire {
  const wire: Wire = {
    sam3ByPrompt: new Map(), sam3Asked: [], multipleAsked: [], maxMasks: [], halfFrameAsks: 0, birefnet: 0,
  };
  vi.stubGlobal("fetch", async (url: unknown, init?: { body?: unknown }) => {
    const address = String(url);
    const reply = (json: unknown) => new Response(JSON.stringify(json), {
      status: 200, headers: { "content-type": "application/json" },
    });
    if (!address.startsWith("https://fal.run/")) return new Response("not served by this fake", { status: 404 });
    const endpoint = address.slice("https://fal.run/".length);
    const body = JSON.parse(String(init?.body ?? "{}"));
    const image = Buffer.from(String(body.image_url).split(",")[1], "base64");
    const meta = await sharp(image).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;

    if (endpoint === BIREFNET) {
      wire.birefnet += 1;
      return reply({ mask_image: { url: await blob(width, height, 0.9) } });
    }
    if (endpoint !== SAM3) return reply({});

    const prompt = String(body.prompt);
    wire.sam3ByPrompt.set(prompt, (wire.sam3ByPrompt.get(prompt) ?? 0) + 1);
    /* AND AT WHAT WIDTH, because since #2802 a pair's two reads are two
       DIFFERENT questions — the plural of the whole picture, then the singular
       of one half — and a tally by prompt alone cannot tell them apart for a
       noun whose singular and plural are the same word (`ear`, `earring`). */
    wire.sam3Asked.push({ prompt, wholeFrame: width === WIDTH });
    if (body.return_multiple_masks === true) {
      wire.multipleAsked.push(prompt);
      wire.maxMasks.push(Number(body.max_masks));
    }
    if (width !== WIDTH) wire.halfFrameAsks += 1;

    /* The face is always one mask: it is the midline and the head box. */
    if (prompt === "face") return reply({ masks: [{ url: await blob(width, height, 0.5) }] });

    if (PAIR_QUESTIONS.has(prompt) && width === WIDTH) {
      if (shape === "none") return reply({ masks: [] });
      /* `perSide` comes back as TWO entries, which is the half of arm 1's
         reading that a reader picking instances apart would have got right and
         the spanning half it would have got wrong. */
      /*
        A FEATURE ON HER MIDLINE, as the elder alien's forehead eye came back
        (#2783). Three instances in one answer: her two real eyes, well clear of
        the cut, and one piece ACROSS it, higher up the frame so it is its own
        connected piece rather than part of either eye. Returned as separate
        entries, which is how the real read arrived (four masks, four scores).
      */
      if (shape === "midlinePiece") {
        return reply({ masks: [
          { url: await rect(width, height, [0.10, 0.20], [1 / 3, 2 / 3]) },
          { url: await rect(width, height, [0.80, 0.90], [1 / 3, 2 / 3]) },
          { url: await rect(width, height, [0.46, 0.54], [0.10, 0.20]) },
        ] });
      }
      /*
        A BIG PIECE ON THE CUT BESIDE A SMALL ONE AWAY FROM IT — the shape that
        tells the rule apart from "drop whatever crosses the midline". A brow
        band across her midline with a speck of noise out at the edge: the band
        is the row and must survive, the speck is harmless and must not displace
        it.
      */
      if (shape === "bandAndSpeck") {
        return reply({ masks: [
          { url: await rect(width, height, [0.40, 0.60], [1 / 3, 2 / 3]) },
          { url: await rect(width, height, [0.90, 0.93], [1 / 3, 2 / 3]) },
        ] });
      }
      /* And the measured crop-road answer: the midline piece and NOTHING else. */
      if (shape === "midlineOnly") {
        return reply({ masks: [{ url: await rect(width, height, [0.46, 0.54], [0.10, 0.20]) }] });
      }
      const xs = BANDS[shape];
      const masks = shape === "perSide"
        ? await Promise.all(xs.map(async (band) => ({ url: await bands(width, height, [band]) })))
        : [{ url: await bands(width, height, xs) }];
      return reply({ masks });
    }
    return reply({ masks: [{ url: await blob(width, height, width === WIDTH ? 0.5 : 0.6) }] });
  });
  return wire;
}

/** One pair read through the real reader, on the road the flag names. */
async function readPair(options: { pairInOneRead: boolean; shape: Shape; name?: string }) {
  const wire = stubFal(options.shape);
  const reader = createFalRegionReader({ apiKey: "test-key", pairInOneRead: options.pairInOneRead });
  const sides = await reader.regionSides?.({
    image: await frame(), name: options.name ?? "eyes", absentIsAnswer: true,
  });
  return { wire, sides };
}

/** A whole scan through the real `scanFace`, counting what reached fal. */
async function driveScan(pairInOneRead: boolean, shape: Shape): Promise<Wire> {
  const wire = stubFal(shape);
  await scanFace({
    frame: { bytes: await frame(), width: WIDTH, height: HEIGHT },
    reader: createFalRegionReader({ apiKey: "test-key", pairInOneRead }),
    describe: async () => ({ build: null, skin: null, teeth: null }),
  });
  return wire;
}

const total = (byPrompt: Map<string, number>) => [...byPrompt.values()].reduce((sum, n) => sum + n, 0);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the road is dark until a caller asks for it", () => {
  it("leaves a pair on two half-frame reads", async () => {
    const { wire, sides } = await readPair({ pairInOneRead: false, shape: "spanning" });
    expect(wire.halfFrameAsks, "two half frames, one per side").toBe(2);
    expect(coverage(sides!.left)).toBeGreaterThan(0);
    expect(coverage(sides!.right)).toBeGreaterThan(0);
  });

  it("is off for a reader built the way the refine builds one", async () => {
    /*
      `refineService` and the two ink roads call `createFalRegionReader({ apiKey })`
      with no option, and a masked refine PAINTS on the mask it gets back — so a
      wrong side there is a delivered picture somebody paid for, where in the
      scan it is a panel row. This arm is the whole of that boundary: the option
      has to be asked for.
    */
    const wire = stubFal("spanning");
    const reader = createFalRegionReader({ apiKey: "test-key" });
    await reader.regionSides?.({ image: await frame(), name: "ear", absentIsAnswer: true });
    expect(wire.halfFrameAsks).toBe(2);
  });

  it("and its half-frame reads ask for SEVERAL instances now (#2818)", async () => {
    /*
      ⚠ **THESE TWO ARMS ASSERTED `multipleAsked` IS EMPTY UNTIL 2026-10-30, AND
      THAT IS THE CONTRACT #2818 CHANGED — ON PURPOSE AND ON A MEASUREMENT.**
      The arm above is right that this road paints: a side can wear more than
      one of a thing, and asking each half for a single instance gave a paid
      refine ONE earring off an ear wearing two.

      What replaced "do not ask" is not "ask and hope" — it is that an extra
      answer is kept only where it touches nothing already in hand. Measured
      over 36 cells, two humans and a creature: there is no genuine second
      instance on any anatomy pair, every extra there is the same feature
      outlined again (and would have grown an eye from 1,042px to 1,995px), and
      every extra EARRING shares zero pixels with the first. That rule and its
      sabotages are `server/castingV2/severalInstancesOnOneSide.test.ts`; this
      arm is only the wire half of it, so the request shape cannot go back
      silently.
    */
    const { wire } = await readPair({ pairInOneRead: false, shape: "spanning" });
    expect(wire.multipleAsked, "both halves, by the singular noun").toEqual(["eye", "eye"]);
  });
});

describe("one request for both sides", () => {
  it("asks the pair once, of the whole frame, with the two fields fal publishes", async () => {
    const { wire } = await readPair({ pairInOneRead: true, shape: "spanning" });
    expect(wire.halfFrameAsks, "no half frame is cut or asked about").toBe(0);
    expect(wire.sam3ByPrompt.get("eyes"), "the pair asked exactly once").toBe(1);
    expect(wire.multipleAsked, "and the setting rides that one request only").toEqual(["eyes"]);
    expect(wire.maxMasks).toEqual([4]);
    /* The midline is still bought, and still once: it is shared across every
       pair and the build row, so this road saves the SECOND side read and
       nothing else. */
    expect(wire.sam3ByPrompt.get("face")).toBe(1);
  });

  it("cuts ONE mask spanning her midline into both sides", async () => {
    const { sides } = await readPair({ pairInOneRead: true, shape: "spanning" });
    expect(coverage(sides!.left), "her left holds pixels").toBeGreaterThan(0);
    expect(coverage(sides!.right), "and so does her right").toBeGreaterThan(0);
  });

  it("unions TWO per-side masks and cuts them apart just the same", async () => {
    const { sides, wire } = await readPair({ pairInOneRead: true, shape: "perSide", name: "ear" });
    expect(wire.sam3ByPrompt.get("ear")).toBe(1);
    expect(coverage(sides!.left)).toBeGreaterThan(0);
    expect(coverage(sides!.right)).toBeGreaterThan(0);
  });

  it("puts each side's pixels on its own side of the cut, and nowhere else", async () => {
    /*
      The reading that makes this a saving rather than a swap: a side's mask has
      to be a picture of THAT side. A cut taken at the wrong place, or a side
      handed the whole union, scores perfectly against coverage and would mask
      half a symmetrical feature — `placeInFrame`'s own warning.
    */
    const { sides } = await readPair({ pairInOneRead: true, shape: "perSide", name: "ear" });
    const midline = WIDTH / 2;
    const sideOfCut = (mask: { data: Buffer; width: number; height: number }) => {
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
    };
    /* `left` is HER left, which is the IMAGE's right half — the reader relabels
       once, in `regionSides`, and this arm is also the only thing holding that
       mapping down on this road. */
    expect(sideOfCut(sides!.left), "her left is the image's right half, and only that")
      .toEqual({ left: 0, right: expect.any(Number) });
    expect(sideOfCut(sides!.left).right).toBeGreaterThan(0);
    expect(sideOfCut(sides!.right), "and her right is the image's left half")
      .toEqual({ left: expect.any(Number), right: 0 });
    expect(sideOfCut(sides!.right).left).toBeGreaterThan(0);
  });
});

/**
 * A FEATURE ON HER MIDLINE BELONGS TO NEITHER SIDE OF THE PAIR (#2783).
 *
 * Measured through this very reader on a local copy of candidate 2472, the
 * elder alien with an eye in the middle of its forehead (#2566's
 * `B-full-2472.png`, 768x1152, no production read). `eyes` on the pair road
 * answered one box per side running from the eye up to the forehead —
 * `74x104` and `73x101`, where the real eyes measure `45x22` and `41x20` —
 * because the forehead eye was cut at the midline and each half joined its
 * side. After the repair the same drive answers `45x22` and `41x20`.
 *
 * The rule is *a side's biggest piece is always kept; a smaller piece is kept
 * only when it does not touch the cut*, and the two arms that matter most here
 * are the ones holding it OFF a real pair: a unibrow spans the midline
 * legitimately, and a side whose only piece is on the midline is left alone.
 */
describe("a piece on her midline is neither side's", () => {
  /** The x range a mask actually occupies, in the frame's own pixels. */
  const spanX = (mask: { data: Buffer; width: number; height: number }) => {
    let left = mask.width;
    let right = -1;
    for (let y = 0; y < mask.height; y += 1) {
      for (let x = 0; x < mask.width; x += 1) {
        if (mask.data[y * mask.width + x] === 0) continue;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
    return right < 0 ? null : { left, right };
  };

  it("leaves each eye row holding its own eye, and nothing on the midline", async () => {
    const { sides } = await readPair({ pairInOneRead: true, shape: "midlinePiece" });
    const midline = WIDTH / 2;
    /* Her left is the image's RIGHT half: it must hold the eye at 0.80–0.90 and
       stop well clear of the cut, where before the repair it reached it. */
    expect(spanX(sides!.left)).toEqual({ left: Math.floor(WIDTH * 0.8), right: Math.floor(WIDTH * 0.9) - 1 });
    expect(spanX(sides!.right)).toEqual({ left: Math.floor(WIDTH * 0.1), right: Math.floor(WIDTH * 0.2) - 1 });
    /* The forehead piece is in NEITHER answer — the defect's own symptom. */
    expect(spanX(sides!.left)!.left).toBeGreaterThan(midline);
    expect(spanX(sides!.right)!.right).toBeLessThan(midline);
  });

  it("drops only the piece, never the row: both eyes still land", async () => {
    /* The arm that would pass if the rule emptied a side, so it is asserted
       beside the span rather than left to the reading above. */
    const { sides } = await readPair({ pairInOneRead: true, shape: "midlinePiece" });
    expect(coverage(sides!.left)).toBeGreaterThan(0);
    expect(coverage(sides!.right)).toBeGreaterThan(0);
  });

  it("KEEPS a unibrow, which is one real pair whose own mask spans the cut", async () => {
    /*
      The counterexample the obvious rule fails, and the reason this one keeps
      the biggest piece unconditionally. `spanning` is exactly that shape —
      arm 1 measured `eyes` and `eyebrows` answering as ONE mask across her
      midline — and dropping whatever crosses the cut would answer "no
      eyebrows" on a face that has them, which is the failure `BILATERAL` in
      the reader was written about.
    */
    const { sides } = await readPair({ pairInOneRead: true, shape: "spanning", name: "eyebrows" });
    const midline = WIDTH / 2;
    expect(spanX(sides!.left)).toEqual({ left: midline, right: Math.floor(WIDTH * 0.8) - 1 });
    expect(spanX(sides!.right)).toEqual({ left: Math.floor(WIDTH * 0.2), right: midline - 1 });
  });

  it("keeps the biggest piece even when IT is the one on the cut", async () => {
    /*
      THE CLAUSE THE UNIBROW ARM CANNOT REACH, and it was found by sabotage
      rather than by reading: a one-piece unibrow returns before the keep rule
      is consulted at all, so dropping every crossing piece leaves that arm
      green. This is the shape that consults it — a brow band across her
      midline WITH a speck of noise out at the edge. The band is her row and
      survives; the speck is kept too, because it is not on the cut.
    */
    const { sides } = await readPair({ pairInOneRead: true, shape: "bandAndSpeck", name: "eyebrows" });
    const midline = WIDTH / 2;
    expect(spanX(sides!.left), "the band reaches the cut and the speck is still there")
      .toEqual({ left: midline, right: Math.floor(WIDTH * 0.93) - 1 });
    expect(coverage(sides!.left)).toBeGreaterThan(0);
  });

  it("leaves a side whose ONLY piece is on the midline exactly as it was", async () => {
    /*
      The measured crop-road answer, pinned here as the limit rather than
      claimed as a fix: asked a half-frame at a time, the segmenter answered
      with only its half of the forehead eye and neither real eye. Geometry
      cannot invent an eye the reader never got, so this road hands the piece
      back — the caller's question, and #2784's.
    */
    const { sides } = await readPair({ pairInOneRead: true, shape: "midlineOnly" });
    const midline = WIDTH / 2;
    expect(spanX(sides!.left)).toEqual({ left: midline, right: Math.floor(WIDTH * 0.54) - 1 });
    expect(spanX(sides!.right)).toEqual({ left: Math.floor(WIDTH * 0.46), right: midline - 1 });
  });

  it("changes nothing about two clean per-side masks", async () => {
    /* The no-op control: `ear` and `earring` come back as two masks neither of
       which touches the cut, so the rule must not move a pixel of them. */
    const { sides } = await readPair({ pairInOneRead: true, shape: "perSide", name: "ear" });
    expect(spanX(sides!.left)).toEqual({ left: Math.floor(WIDTH * 0.7), right: Math.floor(WIDTH * 0.95) - 1 });
    expect(spanX(sides!.right)).toEqual({ left: Math.floor(WIDTH * 0.05), right: Math.floor(WIDTH * 0.3) - 1 });
  });

  it("is the PAIR road's geometry only — the crop road is untouched", async () => {
    /*
      The boundary this repair must not cross. A masked refine is on the crop
      road by construction and PAINTS on the mask it gets back, so a rule with
      one fixture behind it does not reach a paid picture: the same answer on
      the crop road keeps its midline piece, at two half-frame reads.
    */
    const { sides, wire } = await readPair({ pairInOneRead: false, shape: "midlinePiece" });
    expect(wire.halfFrameAsks).toBe(2);
    expect(coverage(sides!.left)).toBeGreaterThan(0);
    expect(coverage(sides!.right)).toBeGreaterThan(0);
  });
});

describe("the readings the scan's own controls rest on", () => {
  it("leaves a one-sided answer one-sided, and the heal above still buys its second look", async () => {
    const { sides, wire } = await readPair({ pairInOneRead: true, shape: "oneSided" });
    expect(wire.sam3ByPrompt.get("eyes")).toBe(1);
    const found = [sides!.left, sides!.right].filter((mask) => coverage(mask) > 0);
    expect(found, "exactly one side holds anything").toHaveLength(1);

    /*
      And the heal is REACHED, which is the half of this that a reader-level
      rescue would have broken: `faceScan.ts` looks again when exactly one side
      is at literal zero, so a whole scan on this shape asks each pair TWICE —
      one read, then one more — and never three.

      ⚠ **The SECOND of those two is no longer the same question (#2802).** It
      was, and on this road that made it unable to answer: a whole-picture
      request repeated verbatim came back with the same answer, measured 10 of
      10 on the founder's own cast. The blind side is asked for its own
      half-picture now — the singular noun of half the frame — so the bill is
      unchanged and the question is not.
    */
    const scan = await driveScan(true, "oneSided");
    for (const question of PAIR_QUESTIONS) {
      const asked = scan.sam3Asked.filter((one) => one.prompt === question || one.prompt === singularOf(question));
      expect(asked.map((one) => one.wholeFrame), `${question} asked once of the whole picture, then once of one half`)
        .toEqual([true, false]);
    }
    /* And nothing else in the scan cut a half frame, so the count above is the
       heal and not something else wearing its shape. */
    expect(scan.halfFrameAsks, "one half-picture per pair, and no other").toBe(PAIR_QUESTIONS.size);
  });

  it("reads an empty pair as empty, at one read instead of two", async () => {
    const { sides, wire } = await readPair({ pairInOneRead: true, shape: "none" });
    expect(wire.sam3ByPrompt.get("eyes")).toBe(1);
    expect(coverage(sides!.left)).toBe(0);
    expect(coverage(sides!.right)).toBe(0);
  });

  it("refuses to ask the shared face read for several instances", async () => {
    /*
      Driven through the real interface rather than a test-only export: an open
      kind arrives with `declaredTwoSided` set by a classifier, so a name the
      catalogue never listed CAN reach the pair road — and `face` is the one
      name that must not. Under the setting it came back as TWO masks on the
      elder alien, and that read is the midline under all five pairs and the
      head box under the build row at once (#2532 arm 1's refusing control).
    */
    const wire = stubFal("spanning");
    const reader = createFalRegionReader({ apiKey: "test-key", pairInOneRead: true });
    await expect(reader.regionSides?.({
      image: await frame(), name: "face", absentIsAnswer: true, declaredTwoSided: true,
    })).rejects.toThrow(/may not ask for several instances/);
    /* The refusal is the ASK's, not the answer's: fal was asked for the
       midline the ordinary way and never once with the field. */
    expect(wire.multipleAsked).toEqual([]);
  });

  it("still reads a face the ordinary way on the same reader", async () => {
    /* The positive control the arm above needs: the refusal is about the
       field, not about the word, so the shared read itself still works. */
    stubFal("spanning");
    const reader = createFalRegionReader({ apiKey: "test-key", pairInOneRead: true });
    const mask = await reader.region({ image: await frame(), name: "face", absentIsAnswer: true });
    expect(coverage(mask)).toBeGreaterThan(0);
  });
});

describe("the flag the scan reads", () => {
  /*
    The predicate is the whole of the flag, so its positions are driven rather
    than read. ⚠ The empty string is the arm that earns its place: a Railway
    variable created with no value holds `""`, and a truthiness test would read
    that blank variable as ON — the cheapest possible way to put every customer
    on a road nobody has flipped.
  */
  const positions: Array<[string | undefined, boolean]> = [
    [undefined, false],
    ["", false],
    ["true", true],
    ["false", false],
    ["TRUE", false],
    ["1", false],
  ];

  afterEach(() => {
    delete process.env[PAIR_ONE_READ_ENV];
  });

  for (const [value, expected] of positions) {
    it(`reads ${value === undefined ? "an unset variable" : `"${value}"`} as ${expected ? "on" : "off"}`, () => {
      if (value === undefined) delete process.env[PAIR_ONE_READ_ENV];
      else process.env[PAIR_ONE_READ_ENV] = value;
      expect(pairInOneReadEnabled()).toBe(expected);
    });
  }

  it("is the name the catalogue and the cost model both carry", () => {
    /* A flag whose name drifts from its entry is a flag nobody can find — and
       the position on the service is read from neither file but from
       `scripts/lib/productionFlagPositions.mts`. */
    expect(PAIR_ONE_READ_ENV).toBe("ENABLE_CASTING_PAIR_ONE_READ");
  });
});

describe("what a whole scan draws on this road", () => {
  it("files every pair's rows on a spanning answer, the way two reads did", async () => {
    /*
      The FLOOR and the CEILING are derived in `faceScanSpend.test.ts`, beside
      the two arms they mirror and off the same drive — one harness for one
      wire. What this arm holds is the other half of the card's done-when: the
      panel gets the same rows. Both sides of all five pairs land, so no row is
      lost to the saving.
    */
    const wire = await driveScan(true, "spanning");
    for (const question of PAIR_QUESTIONS) {
      expect(wire.sam3ByPrompt.get(question), `${question} asked once`).toBe(1);
    }
    expect(total(wire.sam3ByPrompt)).toBe(FACE_SCAN_FAL_CALLS.sam3.pairInOneRead.fewest);
    expect(wire.halfFrameAsks, "and no half frame is cut on the whole scan").toBe(0);
    expect(wire.birefnet, "the cutout is untouched").toBe(FACE_SCAN_FAL_CALLS.cutouts);
  });
});
