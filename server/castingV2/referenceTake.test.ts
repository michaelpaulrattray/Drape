/**
 * THE TAKE ROAD, DRIVEN ON PICTURES AND MASKS WHOSE ANSWERS ARE KNOWN BY
 * CONSTRUCTION — working law 2, before any verdict of its counts for anything.
 *
 * Every photograph here is drawn by this file out of flat colour blocks, and
 * every mask is a rectangle, so each arm's owed answer is arithmetic rather than
 * an observation: a 100×100 mask inside a 100×100 box fills exactly 1.0, a
 * 10×10 one inside it fills 0.01, and a cut's surviving pixel count is the
 * rectangle's area. **A suite that cannot say what the answer should be before
 * it runs is measuring the implementation against itself.**
 *
 * The real population lives elsewhere on purpose: the court's own garment
 * photographs and their SAM cuts are in `output/2736-court/`, driven by
 * `scripts/_2736-cut-disposable.mts`. **This file holds the arithmetic and the
 * fence; that cell holds the photographs.**
 *
 * ⚠ **THE THREE ARMS THAT MATTER MOST, and each is a VERDICT arm rather than a
 * shape arm** — the #2565 lesson from the night before this road was built, where
 * a sabotage survived because an arm asserted that two return values differed
 * instead of asserting which one the decision used:
 *
 *   the person leaves the BYTES   not merely the alpha channel. Every
 *                                 transparent pixel's RGB is read and must be
 *                                 zero, because a cut that is a photograph
 *                                 under a mask is a photograph.
 *   the judgement is on the RAW   a mask one pixel under the floor must be
 *   cut                           REFUSED even though widening would carry it
 *                                 over, which is the one ordering this road can
 *                                 silently get wrong.
 *   the cheap doors are cheap     a picture the detector found nothing in must
 *                                 never pay for a mask, and a cut the floor
 *                                 refused must never pay for the face read.
 */
import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";

import { CUT_FILL_FLOOR, CUT_WIDEN_PX } from "./cutQuality";
import {
  TAKE_CUT_KEY_PREFIX,
  TAKE_FACE_NOUN,
  cutThingFromPicture,
  mintTakeCut,
  subtractFaces,
  takeScopeSentence,
} from "./referenceTake";
import type { Mask } from "./maskedComposite";
import type { PointerBox, RegionReader } from "./maskedRefine";

const W = 120;
const H = 120;

/** A photograph: a flat red field, so any surviving RGB is legible as red. */
async function photo(width = W, height = H): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 40, b: 40 } },
  }).png().toBuffer();
}

function blank(width = W, height = H): Mask {
  return { data: Buffer.alloc(width * height, 0), width, height };
}

function rect(into: Mask, box: PointerBox, value = 255): Mask {
  for (let y = box.y; y < box.y + box.height; y += 1) {
    for (let x = box.x; x < box.x + box.width; x += 1) {
      into.data[y * into.width + x] = value;
    }
  }
  return into;
}

/**
 * A reader with exactly the two capabilities this road needs, and a call log.
 *
 * `pointer` answers by NAME so the face read and the thing read can be told
 * apart — which is what lets an arm assert that the face read was never bought.
 */
function reader(options: {
  boxes?: readonly PointerBox[];
  faces?: readonly PointerBox[];
  mask?: Mask | null;
  throwOn?: "pointer" | "regionInBox";
}): RegionReader & { calls: string[]; askedBoxes: PointerBox[] } {
  const calls: string[] = [];
  const askedBoxes: PointerBox[] = [];
  return {
    calls,
    askedBoxes,
    region: vi.fn(),
    landmark: vi.fn(),
    async pointer({ name }: { name: string }) {
      calls.push(`pointer:${name}`);
      if (options.throwOn === "pointer") throw new Error("the provider did not answer");
      if (name === TAKE_FACE_NOUN) return options.faces ?? [];
      return options.boxes ?? [];
    },
    async regionInBox({ box }: { box: PointerBox }) {
      calls.push("regionInBox");
      askedBoxes.push(box);
      if (options.throwOn === "regionInBox") throw new Error("the provider did not answer");
      return options.mask ?? null;
    },
  } as unknown as RegionReader & { calls: string[]; askedBoxes: PointerBox[] };
}

const ABOUT = { userId: 7, candidatePublicId: "cand-1" } as const;

/** Every pixel of a cut, as RGBA, so the bytes can be read rather than trusted. */
async function rgbaOf(png: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  const raw = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: raw.data, width: raw.info.width, height: raw.info.height };
}

describe("subtractFaces", () => {
  it("zeroes the mask inside every face box and leaves the rest", () => {
    const mask = rect(blank(), { x: 0, y: 0, width: W, height: H });
    const out = subtractFaces(mask, [{ x: 10, y: 10, width: 20, height: 20 }]);
    expect(out.data[10 * W + 10]).toBe(0);
    expect(out.data[29 * W + 29]).toBe(0);
    /* One past the box on both axes is untouched — the bound is exclusive. */
    expect(out.data[30 * W + 30]).toBe(255);
    expect(out.data[0]).toBe(255);
  });

  it("never mutates the caller's mask", () => {
    const mask = rect(blank(), { x: 0, y: 0, width: W, height: H });
    subtractFaces(mask, [{ x: 0, y: 0, width: W, height: H }]);
    expect(mask.data[0]).toBe(255);
  });

  it("clamps a face box that runs off the picture rather than writing past the buffer", () => {
    const mask = rect(blank(), { x: 0, y: 0, width: W, height: H });
    const out = subtractFaces(mask, [{ x: -50, y: -50, width: 60, height: 60 }]);
    expect(out.data[0]).toBe(0);
    expect(out.data[9 * W + 9]).toBe(0);
    expect(out.data[10 * W + 10]).toBe(255);
    expect(out.data.length).toBe(W * H);
  });

  it("returns the caller's own mask when there are no faces", () => {
    const mask = rect(blank(), { x: 0, y: 0, width: 10, height: 10 });
    expect(subtractFaces(mask, [])).toBe(mask);
  });
});

describe("cutThingFromPicture", () => {
  it("refuses a reader that cannot point, and asks nothing", async () => {
    const bare = { region: vi.fn(), landmark: vi.fn() } as unknown as RegionReader;
    const result = await cutThingFromPicture({
      bytes: await photo(), noun: "jacket", reader: bare, about: ABOUT,
    });
    expect(result).toEqual({ ok: false, why: "no-pointer", verdict: null });
  });

  it("⚠ an empty detect is an ANSWER about the picture, and it buys no mask", async () => {
    const r = reader({ boxes: [] });
    const result = await cutThingFromPicture({
      bytes: await photo(), noun: "jacket", reader: r, about: ABOUT,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.why).toBe("not-found");
    /* The cheap door is cheap: one detect, no segmenter read, no face read. */
    expect(r.calls).toEqual(["pointer:jacket"]);
  });

  it("asks the BIGGEST box, and asks it alone — one box per call", async () => {
    const big = { x: 10, y: 10, width: 100, height: 100 };
    const r = reader({
      boxes: [{ x: 0, y: 0, width: 5, height: 5 }, big, { x: 2, y: 2, width: 9, height: 9 }],
      mask: rect(blank(), big),
    });
    await cutThingFromPicture({ bytes: await photo(), noun: "jacket", reader: r, about: ABOUT });
    expect(r.askedBoxes).toEqual([big]);
  });

  /**
   * ⚠ THE PARTS NOT ASKED ABOUT ARE RECORDED — #2842, and the two halves of
   * this arm are the whole point: the choice has NOT changed and the discarded
   * answer is no longer lost.
   *
   * The card's defect on the sibling road: `laces` returned nine boxes and the
   * marker was a 57x66 speck of one lace. Here the same shape cuts one part.
   * Nothing moves on it yet (#2532 measured that several boxes handed to the
   * segmenter switch which object comes back rather than combining), so what
   * this proves is that the spread survives the take — on the road a customer
   * can actually reach today.
   */
  it("⚠ records how many parts came back, their union and its fill — #2842", async () => {
    const big = { x: 10, y: 10, width: 100, height: 100 };
    const r = reader({
      boxes: [{ x: 0, y: 0, width: 5, height: 5 }, big, { x: 2, y: 2, width: 9, height: 9 }],
      mask: rect(blank(), big),
    });
    const result = await cutThingFromPicture({
      bytes: await photo(), noun: "jacket", reader: r, about: ABOUT,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    /* THE CHOICE IS UNCHANGED: the biggest box is still the one cut. */
    expect(r.askedBoxes).toEqual([big]);
    /* AND THE DISCARDED TWO ARE NO LONGER LOST. */
    expect(result.thing.spread.parts).toBe(3);
    expect(result.thing.spread.union).toEqual({ x: 0, y: 0, width: 110, height: 110 });
    /* 10,000 + 25 + 81 kept pixels, minus the overlaps the sweep counts once,
       over a 12,100 union — so a tight cluster reads as one. */
    expect(result.thing.spread.fill).toBeGreaterThan(0.8);
    expect(result.thing.spread.fill).toBeLessThanOrEqual(1);
  });

  it("⚠ a noun that came back as ONE thing records one part, completely full", async () => {
    /* The ordinary case, asserted so the recording cannot quietly describe
       every take as several parts. */
    const box = { x: 20, y: 20, width: 60, height: 60 };
    const r = reader({ boxes: [box], mask: rect(blank(), box) });
    const result = await cutThingFromPicture({
      bytes: await photo(), noun: "jacket", reader: r, about: ABOUT,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.thing.spread.parts).toBe(1);
    expect(result.thing.spread.union).toEqual(box);
    expect(result.thing.spread.fill).toBe(1);
  });

  it("refuses when the segmenter returns no mask for that rectangle", async () => {
    const r = reader({ boxes: [{ x: 0, y: 0, width: 50, height: 50 }], mask: null });
    const result = await cutThingFromPicture({
      bytes: await photo(), noun: "jacket", reader: r, about: ABOUT,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.why).toBe("no-mask");
    /* And the face read was not bought for a cut that never existed. */
    expect(r.calls.filter((one) => one === `pointer:${TAKE_FACE_NOUN}`)).toEqual([]);
  });

  it("⚠ refuses a cut under the fill floor, and buys no face read for it", async () => {
    const box = { x: 0, y: 0, width: 100, height: 100 };
    /* 10×10 claimed inside a 100×100 question = 1% fill, well under the floor. */
    const r = reader({ boxes: [box], mask: rect(blank(), { x: 0, y: 0, width: 10, height: 10 }) });
    const result = await cutThingFromPicture({
      bytes: await photo(), noun: "jacket", reader: r, about: ABOUT,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.why).toBe("cut-refused");
      expect(result.verdict?.why).toBe("below-fill-floor");
      expect(result.verdict?.fill).toBeCloseTo(0.01, 5);
    }
    expect(r.calls).toEqual(["pointer:jacket", "regionInBox"]);
  });

  /**
   * ⚠ THE ORDER ARM, AND IT IS A VERDICT ARM.
   *
   * A mask drawn just under the floor RAW is over it once the pipeline widens by
   * `CUT_WIDEN_PX`. Judging the cleaned mask would therefore USE this cut; the
   * bar was measured on raw segmenter output, so the owed answer is refusal. The
   * arm asserts the decision, not the ordering of two calls — a reversed
   * pipeline passes a call-order assertion and fails this one.
   */
  it("judges the RAW cut: a mask widening would carry over the floor is still refused", async () => {
    const side = 100;
    const box = { x: 5, y: 5, width: side, height: side };
    /* Choose a square whose raw fill is just under the floor and whose fill
       after a `CUT_WIDEN_PX` dilation is over it. */
    const raw = Math.floor(Math.sqrt(CUT_FILL_FLOOR * side * side)) - 1;
    const widened = raw + 2 * CUT_WIDEN_PX;
    expect((raw * raw) / (side * side)).toBeLessThan(CUT_FILL_FLOOR);
    expect((widened * widened) / (side * side)).toBeGreaterThan(CUT_FILL_FLOOR);
    const r = reader({
      boxes: [box],
      mask: rect(blank(), { x: 5, y: 5, width: raw, height: raw }),
    });
    const result = await cutThingFromPicture({
      bytes: await photo(), noun: "jacket", reader: r, about: ABOUT,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.verdict?.why).toBe("below-fill-floor");
  });

  it("takes the thing, cropped tight to what survived", async () => {
    const box = { x: 20, y: 20, width: 60, height: 60 };
    const r = reader({ boxes: [box], mask: rect(blank(), box) });
    const result = await cutThingFromPicture({
      bytes: await photo(), noun: "jacket", reader: r, about: ABOUT,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.thing.noun).toBe("jacket");
    expect(result.thing.facesRemoved).toBe(0);
    /* The crop is the thing's own extent plus the widening the pipeline adds,
       never the whole photograph. */
    expect(result.thing.width).toBeGreaterThanOrEqual(box.width);
    expect(result.thing.width).toBeLessThan(W);
    expect(result.thing.height).toBeLessThan(H);
    const decoded = await rgbaOf(result.thing.bytes);
    expect(decoded.width).toBe(result.thing.width);
    expect(decoded.height).toBe(result.thing.height);
  });

  /**
   * ⚠ THE PERSON LEAVES THE BYTES, NOT JUST THE VIEW.
   *
   * The whole likeness fence rests on this and on nothing else. `cutOutPixels`
   * zeroes RGB as well as alpha; a cut that merely carried an alpha channel over
   * the photograph would be the photograph, and it would LOOK correct in every
   * viewer. So the pixels are read: outside the mask, every channel is zero.
   */
  it("⚠ leaves no photograph pixel outside the mask — RGB, not only alpha", async () => {
    const box = { x: 30, y: 30, width: 50, height: 50 };
    const r = reader({ boxes: [box], mask: rect(blank(), box) });
    const result = await cutThingFromPicture({
      bytes: await photo(), noun: "jacket", reader: r, about: ABOUT,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { data, width, height } = await rgbaOf(result.thing.bytes);
    let transparent = 0;
    let leaked = 0;
    let opaqueRed = 0;
    for (let at = 0; at < width * height; at += 1) {
      const alpha = data[at * 4 + 3]!;
      if (alpha === 0) {
        transparent += 1;
        if (data[at * 4]! !== 0 || data[at * 4 + 1]! !== 0 || data[at * 4 + 2]! !== 0) leaked += 1;
      }
      if (alpha === 255 && data[at * 4]! > 150) opaqueRed += 1;
    }
    /* There IS transparent territory to check — a crop with none would pass this
       arm by having nothing to leak, which is the shape of a hollow guard. */
    expect(transparent).toBeGreaterThan(0);
    expect(leaked).toBe(0);
    /* And the thing itself survived: the photograph's own red is still there. */
    expect(opaqueRed).toBeGreaterThan(0);
  });

  it("subtracts the face from what it keeps, and says how many it took out", async () => {
    const box = { x: 0, y: 0, width: 100, height: 100 };
    /* FULL HEIGHT, and the first version of this arm got it wrong in a way worth
       recording: a face box only as tall as the asked box left the rows the
       pipeline's own widening added below it still carrying pixels on the left,
       so the surviving bounds still started near x=0 and the arm read as a
       failure of the subtraction. The subtraction was correct; the fixture was
       describing a face that stopped short of the cut. */
    const faces = [{ x: 0, y: 0, width: 40, height: H }];
    const r = reader({ boxes: [box], mask: rect(blank(), box), faces });
    const result = await cutThingFromPicture({
      bytes: await photo(), noun: "jacket", reader: r, about: ABOUT,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.thing.facesRemoved).toBe(1);
    /* The surviving extent starts to the RIGHT of the face box, so the crop is
       narrower than the cut was — the face is gone from the geometry, not only
       from the alpha. */
    expect(result.thing.width).toBeLessThan(box.width);
  });

  it("refuses when the face subtraction leaves nothing at all", async () => {
    const box = { x: 0, y: 0, width: 100, height: 100 };
    const r = reader({
      boxes: [box],
      mask: rect(blank(), box),
      faces: [{ x: 0, y: 0, width: W, height: H }],
    });
    const result = await cutThingFromPicture({
      bytes: await photo(), noun: "jacket", reader: r, about: ABOUT,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.why).toBe("nothing-left");
  });

  it("a provider that does not answer is OUR failure, not a finding about the picture", async () => {
    const r = reader({ boxes: [{ x: 0, y: 0, width: 50, height: 50 }], throwOn: "regionInBox" });
    const result = await cutThingFromPicture({
      bytes: await photo(), noun: "jacket", reader: r, about: ABOUT,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.why).toBe("reader-failed");
  });

  it("an undecodable attachment is refused rather than thrown", async () => {
    const r = reader({ boxes: [{ x: 0, y: 0, width: 50, height: 50 }] });
    const result = await cutThingFromPicture({
      bytes: Buffer.from("this is not a picture"), noun: "jacket", reader: r, about: ABOUT,
    });
    expect(result).toEqual({ ok: false, why: "unreadable", verdict: null });
    expect(r.calls).toEqual([]);
  });

  /**
   * THE ALPHA COMES FROM THE MASK AND NEVER FROM THE ATTACHMENT.
   *
   * A customer may attach a PNG that already carries transparency. If the road
   * read that alpha, the cut would be the attachment's own holes rather than the
   * mask's answer. The photograph here is transparent everywhere; the cut must
   * still be opaque where the mask claims.
   */
  it("⚠ ignores whatever alpha the attachment already carried", async () => {
    const transparent = await sharp({
      create: { width: W, height: H, channels: 4, background: { r: 10, g: 220, b: 10, alpha: 0 } },
    }).png().toBuffer();
    const box = { x: 20, y: 20, width: 60, height: 60 };
    const r = reader({ boxes: [box], mask: rect(blank(), box) });
    const result = await cutThingFromPicture({
      bytes: transparent, noun: "jacket", reader: r, about: ABOUT,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { data, width, height } = await rgbaOf(result.thing.bytes);
    let opaque = 0;
    for (let at = 0; at < width * height; at += 1) if (data[at * 4 + 3]! === 255) opaque += 1;
    expect(opaque).toBeGreaterThan(0);
  });
});

describe("takeScopeSentence", () => {
  const they = { subject: "they", object: "them", possessive: "their", plural: true };
  const she = { subject: "she", object: "her", possessive: "her", plural: false };

  it("names the thing in the customer's own word and keeps the rest of the outfit", () => {
    const said = takeScopeSentence("jacket", they);
    expect(said).toContain("this exact jacket");
    expect(said).toContain("its cut, its colour and its material");
    expect(said).toContain("Everything else they wear stays as it is");
  });

  it("agrees with a singular cast's verb", () => {
    expect(takeScopeSentence("coat", she)).toContain("she wears stays as it is");
  });

  /* ⚠ THE SCENERY WALL IS NOT THIS ROAD'S TO MOVE — the clause is asserted
     rather than left to review memory, because a scope sentence is the one place
     in this road that speaks to the paint engine about the frame. */
  it("says the set, the backdrop and the props do not change", () => {
    const said = takeScopeSentence("jacket", they);
    expect(said).toContain("nothing about the set, the backdrop or the props changes");
  });

  it("names no engine, no pipeline word and no number", () => {
    const said = takeScopeSentence("jacket", they).toLowerCase();
    for (const forbidden of ["sunburst", "nano banana", "fal", "sam", "segment", "mask", "%"]) {
      expect(said).not.toContain(forbidden);
    }
  });
});

describe("mintTakeCut", () => {
  const thing = {
    bytes: Buffer.from("the cut's own bytes"),
    width: 10,
    height: 10,
    noun: "jacket",
    verdict: { use: true, fill: 0.5, claimed: 50, insideBox: 50, why: "used" as const },
    facesRemoved: 0,
  };

  it("⚠ writes the manifest BEFORE the bytes exist", async () => {
    const order: string[] = [];
    await mintTakeCut({ userId: 7, thing }, {
      manifest: async () => { order.push("manifest"); },
      store: async ({ key }) => { order.push("store"); return { key, url: "u" }; },
    });
    expect(order).toEqual(["manifest", "store"]);
  });

  it("names the key under the take's own prefix, and the name is a UUID", async () => {
    let stored = "";
    const minted = await mintTakeCut({ userId: 7, thing }, {
      manifest: async () => {},
      store: async ({ key }) => { stored = key; return { key, url: "u" }; },
    });
    expect(minted.key).toBe(stored);
    expect(minted.key.startsWith(`${TAKE_CUT_KEY_PREFIX}/`)).toBe(true);
    expect(minted.key).toMatch(
      /^casting-v2\/reference-take\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/,
    );
  });

  it("manifests the very key it stores, so the sweep holds an exact name", async () => {
    let manifested: readonly string[] = [];
    let stored = "";
    await mintTakeCut({ userId: 7, thing }, {
      manifest: async ({ storageKeys }) => { manifested = storageKeys; },
      store: async ({ key }) => { stored = key; return { key, url: "u" }; },
    });
    expect(manifested).toEqual([stored]);
  });

  it("digests the cut's own bytes", async () => {
    const minted = await mintTakeCut({ userId: 7, thing }, {
      manifest: async () => {},
      store: async ({ key }) => ({ key, url: "u" }),
    });
    const { createHash } = await import("node:crypto");
    expect(minted.sha).toBe(createHash("sha256").update(thing.bytes).digest("hex"));
    expect(minted.contentType).toBe("image/png");
  });

  it("two takes never share a key", async () => {
    const keys = new Set<string>();
    for (let n = 0; n < 20; n += 1) {
      const minted = await mintTakeCut({ userId: 7, thing }, {
        manifest: async () => {},
        store: async ({ key }) => ({ key, url: "u" }),
      });
      keys.add(minted.key);
    }
    expect(keys.size).toBe(20);
  });
});
