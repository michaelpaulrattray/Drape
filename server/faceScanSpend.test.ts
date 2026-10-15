/**
 * WHAT ONE FACE SCAN BUYS AT fal — derived by driving the real scan through the
 * real reader, and held against what real faces were measured to cost (#2184).
 *
 * # Why this replaced a single number
 *
 * `FACE_SCAN_READS_PER_VERSION = 20` was counted by `count-scan-reads-disposable`
 * with a fake reader that found everything on the first ask. That is the one
 * kind of face no scan ever meets: a real face makes the scan ask AGAIN when a
 * read comes back short — an empty anatomy read gets a second look, a pair with
 * one side at zero gets a second look — and the 20 also folded the body cutout
 * (BiRefNet, priced per compute-second) in as if it were one more SAM 3 read at
 * half a cent. #2183 measured 21–27 SAM 3 reads plus one cutout on eight real
 * casts, against fal's own usage report.
 *
 * # What this suite derives, and how
 *
 * It does NOT re-implement the re-ask rules. It runs `scanFace` with the real
 * `createFalRegionReader` and a fake `fetch`, and counts the requests that
 * reach `https://fal.run/…`, endpoint by endpoint — assert at the wire. Two
 * kinds of fake segmenter answer them:
 *
 *   FINDS EVERYTHING   every question answered on the first ask — the FEWEST
 *                      reads the code can make.
 *   MISSES ON PURPOSE  answers shaped to fire each re-ask the code has, and the
 *                      worst per question is taken — the MOST it can make when
 *                      every call succeeds.
 *
 * Those two are pinned to `FACE_SCAN_FAL_CALLS` in `falSpend.mts`, which holds
 * the figures as constants only so that module stays out of the server's import
 * graph (its own stated rule). If the scan starts asking more or fewer
 * questions, this goes red and the constant has to move with it. The measured
 * band must sit inside the derived one: a band outside what the code can do is
 * a measurement of some other code.
 */
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

import { scanFace } from "./castingV2/faceScan";
import { createFalRegionReader } from "./castingV2/falRegionReader";
import { catalogueSlots } from "./castingV2/referenceSlotCatalogue";
import {
  FACE_SCAN_FAL_CALLS,
  FACE_SCAN_PART_USD,
  FAL_MEASURED_USD,
  faceScanFalFloorUsd,
  faceScanUsd,
} from "../scripts/lib/falSpend.mts";

const SAM3 = "fal-ai/sam-3/image";
const BIREFNET = "fal-ai/birefnet/v2";

const WIDTH = 400;
const HEIGHT = 600;
/* The two halves are different colours, so the fake can tell which side of
   the midline a half-frame question is about from the picture alone — the
   reader never says so in the request. */
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

/** A centred rectangle covering `share` of each axis, as a mask data URI. */
async function blob(width: number, height: number, share: number): Promise<string> {
  const data = Buffer.alloc(width * height, 0);
  const x0 = Math.floor(width * (0.5 - share / 2));
  const x1 = Math.floor(width * (0.5 + share / 2));
  const y0 = Math.floor(height * (0.5 - share / 2));
  const y1 = Math.floor(height * (0.5 + share / 2));
  for (let y = y0; y < y1; y += 1) data.fill(255, y * width + x0, y * width + x1);
  const png = await sharp(data, { raw: { width, height, channels: 1 } }).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

/** A mask covering one x band over the middle third of the height — a pair
 *  answer that sits wholly on one side of her midline. */
async function band(width: number, height: number, x0: number, x1: number): Promise<string> {
  const data = Buffer.alloc(width * height, 0);
  for (let y = Math.floor(height / 3); y < Math.floor((height * 2) / 3); y += 1) {
    data.fill(255, y * width + x0, y * width + x1);
  }
  const png = await sharp(data, { raw: { width, height, channels: 1 } }).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

/**
 * How the fake segmenter answers.
 *
 * `n` is how many times THIS prompt has been asked of THIS picture (the whole
 * frame, or one side of it), counting from 1.
 */
type Policy = {
  whole: (n: number) => boolean;
  side: (n: number, side: "left" | "right") => boolean;
  /**
   * A PAIR ASKED OF THE WHOLE FRAME — the `pairInOneRead` road only (#2191).
   *
   * On that road a bilateral region is one request about the whole picture, so
   * `side` is never consulted for it and `whole` cannot say the one thing that
   * matters: whether the answer covers BOTH sides of her midline or one. This
   * says which, and the fake draws the mask to match.
   *
   * Absent, a pair answers by `whole` like any other whole-frame question —
   * which on this fake is a centred rectangle, i.e. `"both"`. That default is
   * why the two old policies below need no `pair` entry.
   */
  pair?: (n: number) => "both" | "one" | "none";
};

const FINDS_EVERYTHING: Policy = { whole: () => true, side: () => true };

/** Empty first time, both sides; then one side only; then found. Fires the
 *  empty-anatomy re-ask AND, inside it, the half-pair heal. */
const BOTH_EMPTY_THEN_HALF: Policy = {
  whole: (n) => n > 1,
  side: (n, side) => (n === 1 ? false : n === 2 ? side === "right" : true),
  /*
    The `pairInOneRead` reading of this same policy, and it is spelled out for
    the reason the comparison turns on: it must take the same number of LOOKS
    as the `side` line above, so that the two ceilings differ in reads per look
    and in nothing else. Empty, then half, then found — three looks, which is
    the empty-anatomy re-ask with the half-pair heal firing inside it.
  */
  pair: (n) => (n === 1 ? "none" : n === 2 ? "one" : "both"),
};

/** One side only first time; then found. Fires the half-pair heal on a pair
 *  the empty-anatomy rule never re-asks (a worn thing). */
const HALF_THEN_FOUND: Policy = {
  whole: (n) => n > 1,
  side: (n, side) => n > 1 || side === "right",
  /* The `pairInOneRead` reading of this same policy: one side first, both on
     the look after. It is spelled out rather than left to the default because
     the default answers `"both"` first time, which fires no heal at all — and
     a ceiling derived without the heal would be a cost figure that is too
     low, which is the direction that matters. */
  pair: (n) => (n > 1 ? "both" : "one"),
};

/** Every question the scan reads a side at a time — the catalogue's own fact,
 *  so a new pair joins the pair-road arms below by itself. */
const PAIR_QUESTIONS = new Set(
  catalogueSlots()
    .filter((definition) => definition.frame === "ownSide" && definition.question !== null)
    .map((definition) => definition.question as string),
);

type Wire = { sam3ByPrompt: Map<string, number>; birefnet: number; other: string[] };

async function drive(policy: Policy, pairInOneRead = false): Promise<Wire & { describer: number }> {
  const wire: Wire = { sam3ByPrompt: new Map(), birefnet: 0, other: [] };
  const asked = new Map<string, number>();

  vi.stubGlobal("fetch", async (url: unknown, init?: { body?: unknown }) => {
    const address = String(url);
    const reply = (json: unknown) => new Response(JSON.stringify(json), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    if (!address.startsWith("https://fal.run/")) {
      wire.other.push(address.slice(0, 60));
      return new Response("not served by this fake", { status: 404 });
    }
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
    if (endpoint !== SAM3) {
      wire.other.push(endpoint);
      return reply({});
    }
    const prompt = String(body.prompt);
    wire.sam3ByPrompt.set(prompt, (wire.sam3ByPrompt.get(prompt) ?? 0) + 1);

    const whole = width === WIDTH;
    let side: "left" | "right" | null = null;
    if (!whole) {
      const { data } = await sharp(image).raw().toBuffer({ resolveWithObject: true });
      side = data[0] > data[2] ? "left" : "right";
    }
    const key = `${prompt}|${side ?? "whole"}`;
    const n = (asked.get(key) ?? 0) + 1;
    asked.set(key, n);

    /*
      A PAIR ASKED OF THE WHOLE FRAME is the `pairInOneRead` road, and the fake
      answers it with a mask the reader's own cut can come apart — `"both"` is a
      rectangle across her midline, `"one"` sits wholly on one side of it. The
      reader is what splits them, so this stays a statement about the WIRE.
    */
    if (pairInOneRead && whole && PAIR_QUESTIONS.has(prompt)) {
      const shape = (policy.pair ?? ((ask: number) => (policy.whole(ask) ? "both" : "none")))(n);
      if (shape === "none") return reply({ masks: [] });
      const url = shape === "both"
        ? await blob(width, height, 0.5)
        : await band(width, height, Math.floor(width * 0.6), Math.floor(width * 0.9));
      return reply({ masks: [{ url }] });
    }

    /* The face is always found: it is the midline and the head, and an empty
       one would only take the composed row away, never add a call. */
    const found = prompt === "face"
      || (side === null ? policy.whole(n) : policy.side(n, side));
    return reply({ masks: found ? [{ url: await blob(width, height, side === null ? 0.5 : 0.6) }] : [] });
  });

  let describer = 0;
  const bytes = await frame();
  await scanFace({
    frame: { bytes, width: WIDTH, height: HEIGHT },
    reader: createFalRegionReader({ apiKey: "test-key", pairInOneRead }),
    describe: async () => {
      describer += 1;
      return { build: null, skin: null, teeth: null };
    },
  });
  return { ...wire, describer };
}

const total = (byPrompt: Map<string, number>) => [...byPrompt.values()].reduce((sum, n) => sum + n, 0);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("what one scan asks of fal, counted at the wire", () => {
  it("makes the fewest SAM 3 reads when every question is answered first time", async () => {
    const wire = await drive(FINDS_EVERYTHING);
    expect(wire.other, "only the two fal endpoints a scan is known to call").toEqual([]);
    expect(total(wire.sam3ByPrompt)).toBe(FACE_SCAN_FAL_CALLS.sam3.fewest);
  }, 60_000);

  it("makes one body cutout and one describer call, however the reads go", async () => {
    for (const policy of [FINDS_EVERYTHING, BOTH_EMPTY_THEN_HALF, HALF_THEN_FOUND]) {
      const wire = await drive(policy);
      expect(wire.birefnet).toBe(FACE_SCAN_FAL_CALLS.cutouts);
      expect(wire.describer).toBe(FACE_SCAN_FAL_CALLS.describer);
    }
  }, 120_000);

  it("makes at most the derived ceiling when every re-ask the code has fires", async () => {
    const runs = [
      await drive(FINDS_EVERYTHING),
      await drive(BOTH_EMPTY_THEN_HALF),
      await drive(HALF_THEN_FOUND),
    ];
    /* Each question's re-asks depend on that question's answers alone, so the
       worst per prompt is reachable on one face; the sum is the ceiling. */
    const prompts = new Set(runs.flatMap((run) => [...run.sam3ByPrompt.keys()]));
    let most = 0;
    for (const prompt of prompts) {
      most += Math.max(...runs.map((run) => run.sam3ByPrompt.get(prompt) ?? 0));
    }
    expect(most).toBe(FACE_SCAN_FAL_CALLS.sam3.most);
    /* And the re-asks are real: a fake that fired none would make the ceiling
       equal the floor and this suite would prove nothing about them. */
    expect(most).toBeGreaterThan(FACE_SCAN_FAL_CALLS.sam3.fewest);
  }, 120_000);
});

/**
 * THE SAME TWO NUMBERS WITH `ENABLE_CASTING_PAIR_ONE_READ` ON — a road that is built
 * and OFF, so these are not what production does (#2191).
 *
 * Derived by the same drive and the same policies as the two arms above, which
 * is the whole reason they live in this file rather than beside the pair road's
 * own behaviour arms (`server/faceScanPairOneRead.test.ts`): a second harness
 * counting the same wire is a second source of truth about one fact, and the
 * two would disagree the first time either was touched.
 */
describe("what one scan asks of fal on the pair-in-one-read road", () => {
  it("brings the floor down by one read per pair, and nothing else moves", async () => {
    const wire = await drive(FINDS_EVERYTHING, true);
    expect(wire.other, "only the two fal endpoints a scan is known to call").toEqual([]);
    expect(total(wire.sam3ByPrompt)).toBe(FACE_SCAN_FAL_CALLS.sam3.pairInOneRead.fewest);
    /* The saving is exactly the pairs — five regions, one read each instead of
       two — which is this card's claim stated as arithmetic the wire proves. */
    expect(FACE_SCAN_FAL_CALLS.sam3.fewest - FACE_SCAN_FAL_CALLS.sam3.pairInOneRead.fewest)
      .toBe(PAIR_QUESTIONS.size);
    for (const question of PAIR_QUESTIONS) {
      expect(wire.sam3ByPrompt.get(question), `${question} asked once`).toBe(1);
    }
    /* The midline is still bought, and still once: it is shared across all five
       pairs and the build row, so this road saves the second SIDE read only. */
    expect(wire.sam3ByPrompt.get("face")).toBe(1);
    expect(wire.birefnet).toBe(FACE_SCAN_FAL_CALLS.cutouts);
    expect(wire.describer).toBe(FACE_SCAN_FAL_CALLS.describer);
  }, 60_000);

  it("brings the ceiling down too, by less, because every re-ask still fires", async () => {
    const runs = [
      await drive(FINDS_EVERYTHING, true),
      await drive(BOTH_EMPTY_THEN_HALF, true),
      await drive(HALF_THEN_FOUND, true),
    ];
    const prompts = new Set(runs.flatMap((run) => [...run.sam3ByPrompt.keys()]));
    let most = 0;
    for (const prompt of prompts) {
      most += Math.max(...runs.map((run) => run.sam3ByPrompt.get(prompt) ?? 0));
    }
    expect(most).toBe(FACE_SCAN_FAL_CALLS.sam3.pairInOneRead.most);
    /* Both controls, and the second is the one that could hide a cost: a
       ceiling equal to the floor would mean no re-ask fired, and a ceiling that
       did not fall would mean the road saved nothing on a real face. */
    expect(most).toBeGreaterThan(FACE_SCAN_FAL_CALLS.sam3.pairInOneRead.fewest);
    expect(most).toBeLessThan(FACE_SCAN_FAL_CALLS.sam3.most);
  }, 120_000);

  it("holds what real faces measured on this road inside what the code can do", () => {
    /* The same relationship the crop road's band has with its own derived pair:
       a measurement outside what the code can do is a measurement of some other
       code. Both roads' bands came out of ONE sitting on the same three casts,
       so the pair of them is also the saving, measured rather than derived. */
    const { fewest, most, measured } = FACE_SCAN_FAL_CALLS.sam3.pairInOneRead;
    expect(measured.low).toBeGreaterThanOrEqual(fewest);
    expect(measured.high).toBeLessThanOrEqual(most);
    expect(measured.low).toBeLessThanOrEqual(measured.high);
    /* The crop road's reading from that same sitting sits inside ITS derived
       pair too — the control that says the two bands were taken the same way
       and are therefore comparable at all. */
    expect(measured.cropRoadLow).toBeGreaterThanOrEqual(FACE_SCAN_FAL_CALLS.sam3.fewest);
    expect(measured.cropRoadHigh).toBeLessThanOrEqual(FACE_SCAN_FAL_CALLS.sam3.most);
    /* And it is cheaper on every face it was measured on, at both ends. */
    expect(measured.low).toBeLessThan(measured.cropRoadLow);
    expect(measured.high).toBeLessThan(measured.cropRoadHigh);
  });
});

describe("the measured band, against what the code can do", () => {
  it("sits inside the derived floor and ceiling", () => {
    const { fewest, most, measured } = FACE_SCAN_FAL_CALLS.sam3;
    expect(measured.low).toBeGreaterThanOrEqual(fewest);
    expect(measured.high).toBeLessThanOrEqual(most);
    expect(measured.low).toBeLessThanOrEqual(measured.high);
  });

  it("prices a scan from its parts, and the parts bracket the measured totals", () => {
    const usd = faceScanUsd();
    const sam = FAL_MEASURED_USD[SAM3].usd;
    const { measured } = FACE_SCAN_FAL_CALLS.sam3;
    /* The SAM 3 share is the read count times fal's own price, and nothing
       else: the cutout and the describer are their own terms. */
    expect(usd.sam3.low).toBeCloseTo(measured.low * sam, 6);
    expect(usd.sam3.high).toBeCloseTo(measured.high * sam, 6);
    expect(usd.cutout.low).toBeGreaterThan(0);
    expect(usd.total.low).toBeCloseTo(usd.sam3.low + usd.cutout.low + usd.describer.low, 6);
    expect(usd.total.high).toBeCloseTo(usd.sam3.high + usd.cutout.high + usd.describer.high, 6);
    /* #2183's per-cast totals ran $0.121–$0.151. The composed band must hold
       every one of them; it is wider because it adds independent extremes. */
    expect(usd.total.low).toBeLessThanOrEqual(0.121);
    expect(usd.total.high).toBeGreaterThanOrEqual(0.151);
    /* fal's share alone is what a fal balance drop can be charged with. */
    expect(usd.fal.low).toBeCloseTo(usd.sam3.low + usd.cutout.low, 6);
    expect(usd.fal.high).toBeCloseTo(usd.sam3.high + usd.cutout.high, 6);
  });

  it("gives the balance reader a floor no real scan can go under", () => {
    /* `fal-picture-price.mts` subtracts scans out of a balance drop to bound a
       render's price; charging a scan MORE than it can cost would hide part of
       the render. So the floor is the derived fewest, never the measured band. */
    const floor = faceScanFalFloorUsd();
    expect(floor).toBeCloseTo(
      FACE_SCAN_FAL_CALLS.sam3.fewest * FAL_MEASURED_USD[SAM3].usd
        + FACE_SCAN_FAL_CALLS.cutouts * FACE_SCAN_PART_USD.cutout.low,
      6,
    );
    expect(floor).toBeLessThanOrEqual(faceScanUsd().fal.low);
    expect(floor).toBeGreaterThan(0);
  });
});
