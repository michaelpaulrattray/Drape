/**
 * THE POINTER ROAD, DRIVEN DIRECTLY — never through a scan (#2566 slice 2).
 *
 * Working law 3: *"a backstop needs a test the model cannot rescue."* Almost
 * every property that matters on this road is a REFUSAL — a name the catalogue
 * already buys never reaching the detector, a rectangle the detector found but
 * the count did not want never reaching the segmenter, a cut that landed
 * somewhere else never reaching a panel — and not one of them is visible from a
 * reading that happens to go well. So both halves of the reader are doubles
 * that record exactly what they were asked, and the assertions are on the ASK
 * rather than on the answer (invariant 5: a contract about what gets sent is
 * proven on the outgoing request).
 *
 * ⚠ **THE ARM THAT MATTERS MOST IS THE CAP**, and it is the one that looks like
 * an off-by-one: on #2532's three-eyed cast the detector returned THREE
 * rectangles for `third eye` and sending them all made the segmenter cut a
 * NORMAL eye — a right answer turned wrong. The discovery counted one, so one
 * rectangle is asked about. An arm that only checked "a row came back" would
 * pass on the wrong row.
 */
import { describe, expect, it } from "vitest";

import {
  DISCOVERED_SLOT_PREFIX,
  coveredByCatalogue,
  cutDiscovered,
  discoveredSlotOf,
  normalisedName,
  offListFeatures,
} from "./pointerCut";
import { catalogueSlots } from "./referenceSlotCatalogue";
import { scanPlan } from "./faceScan";
import type { DiscoveredFeature } from "./faceDiscovery";
import type { Mask } from "./maskedComposite";
import type { PointerBox, RegionReader } from "./maskedRefine";

const FRAME = { bytes: Buffer.from("a frame"), width: 768, height: 576 };

/** A mask with pixels inside exactly one rectangle and nowhere else. */
function maskAt(box: PointerBox, frame = FRAME): Mask {
  const data = Buffer.alloc(frame.width * frame.height, 0);
  for (let y = box.y; y < box.y + box.height; y += 1) {
    for (let x = box.x; x < box.x + box.width; x += 1) {
      data[y * frame.width + x] = 255;
    }
  }
  return { data, width: frame.width, height: frame.height };
}

/** A mask with nothing in it at all. */
function emptyMask(frame = FRAME): Mask {
  return { data: Buffer.alloc(frame.width * frame.height, 0), width: frame.width, height: frame.height };
}

type Asked = { pointer: string[]; boxes: Array<{ name: string; box: PointerBox }> };

/**
 * A reader with both halves of the capability, recording every ask.
 *
 * `detects` says what the detector returns per noun — an absent noun means an
 * empty list, which on this road is the ABSENCE answer and not a failure.
 * `cuts` says what the segmenter answers for a given rectangle; by default it
 * answers a mask covering exactly that rectangle, which is a cut that landed
 * where it was asked to.
 */
function readerWith(input: {
  detects: Record<string, PointerBox[] | Error>;
  cuts?: (box: PointerBox, name: string) => Mask | null | Error;
}): RegionReader & { asked: Asked } {
  const asked: Asked = { pointer: [], boxes: [] };
  return {
    asked,
    async region() { throw new Error("not this road"); },
    async subject() { throw new Error("not this road"); },
    async landmark() { throw new Error("not this road"); },
    async pointer({ name }) {
      asked.pointer.push(name);
      const answer = input.detects[name];
      if (answer instanceof Error) throw answer;
      return answer ?? [];
    },
    async regionInBox({ name, box }) {
      asked.boxes.push({ name, box });
      const answer = input.cuts ? input.cuts(box, name) : maskAt(box);
      if (answer instanceof Error) throw answer;
      return answer;
    },
  };
}

const feature = (name: string, count = 1): DiscoveredFeature => ({ name, count, about: "" });

describe("coveredByCatalogue — which road cuts a name, derived from the catalogue itself", () => {
  /*
    THE POPULATION IS THE CATALOGUE, NOT A LIST HERE. Slice 1 shipped a
    hand-written phrasebook and the relay deleted it; a roster in this file
    would be the same mirror one layer down (working law 4), and the day a slot
    is added it would be the half that went stale.
  */
  it("covers every question the scan actually sends", () => {
    for (const planned of scanPlan()) {
      expect(coveredByCatalogue(planned.question), planned.question).toBe(true);
    }
  });

  it("covers every noun the catalogue draws a row with", () => {
    for (const definition of catalogueSlots()) {
      expect(coveredByCatalogue(definition.noun), definition.noun).toBe(true);
      if (definition.pairNoun !== undefined) {
        expect(coveredByCatalogue(definition.pairNoun), definition.pairNoun).toBe(true);
      }
    }
  });

  /*
    ⚠ THE NEGATIVE CONTROL IS THE REAL MEASUREMENT AND NOT A GUESS. Every name
    below came back from the discovery read on his own three production fixtures
    (#2566's full-frame run, posted on the card) — and the first two are the
    card's HEADLINE FINDS. A substring rule would have swallowed both: `jaw` is
    a catalogue slot, and `eyes` is a catalogue question.
  */
  it("does NOT cover the off-list names the fixtures really produced", () => {
    for (const name of [
      "jaw hardware", "third eye", "neck hardware", "neck piece", "neck tattoo",
      "jacket", "collar", "choker", "sash", "top", "strap", "straps", "buckle",
      "hood", "robe", "coat", "rope", "scarf", "face mask", "face wrap",
      "shoulder plates", "shoulder armor", "shoulder guard", "shoulder wrap",
      "medallion", "pendants", "rings", "mole", "eyeliner", "freckles", "tattoo",
    ]) {
      expect(coveredByCatalogue(name), name).toBe(false);
    }
  });

  it("reaches a plural the catalogue states singular, and the other way round", () => {
    /* The catalogue asks `ear`; the reading says `ears`. Both are one row. */
    expect(coveredByCatalogue("ears")).toBe(true);
    expect(coveredByCatalogue("eyes")).toBe(true);
    /* And a hyphen is not a different word. */
    expect(coveredByCatalogue("facial-hair")).toBe(true);
    expect(coveredByCatalogue("nose-stud")).toBe(true);
  });
});

describe("normalisedName — the fold, and what it deliberately does not do", () => {
  it("folds case, hyphens and a trailing plural", () => {
    expect(normalisedName("  Shoulder-Plates ")).toBe("shoulder plate");
    expect(normalisedName("FACIAL_HAIR")).toBe("facial hair");
  });

  it("leaves a word whose `s` is part of it alone", () => {
    /* `ss` is not a plural, and a three-letter word is too short to risk. */
    expect(normalisedName("dress")).toBe("dress");
    expect(normalisedName("gas")).toBe("gas");
  });

  /*
    ⚠ THE FOLD IS CRUDE AND IT IS SYMMETRIC, AND THE SECOND IS WHY THE FIRST IS
    SAFE. `lips` folds to `lip` — which is not the catalogue's word for it — and
    that costs nothing, because the CATALOGUE's side of the comparison is folded
    by the same function. An arm asserting a particular fold would be asserting
    the implementation; this asserts the property the comparison actually needs.
  */
  it("folds both sides of the comparison with one function", () => {
    expect(normalisedName("lips")).toBe(normalisedName("lips"));
    for (const definition of catalogueSlots()) {
      if (definition.question === null) continue;
      expect(coveredByCatalogue(definition.question), definition.question).toBe(true);
    }
  });
});

describe("offListFeatures — a name the scan already buys never reaches this road", () => {
  it("drops the covered names and keeps the rest, in the reading's own order", () => {
    const kept = offListFeatures([
      feature("hair"), feature("jacket"), feature("eyes", 2), feature("sash"),
    ]);
    expect(kept.map((one) => one.name)).toEqual(["jacket", "sash"]);
  });
});

describe("discoveredSlotOf — an identity, never a description", () => {
  it("is prefixed, slugged and numbered", () => {
    expect(discoveredSlotOf("jaw hardware", 1)).toBe(`${DISCOVERED_SLOT_PREFIX}jaw-hardware#1`);
    expect(discoveredSlotOf("sash", 2)).toBe(`${DISCOVERED_SLOT_PREFIX}sash#2`);
  });

  /* The non-collision, held against the REAL catalogue rather than asserted in
     prose: the prefix is what makes a found key unmistakable, and this is the
     only place that can check it. */
  it("never collides with a catalogue slot", () => {
    for (const definition of catalogueSlots()) {
      expect(definition.slot.startsWith(DISCOVERED_SLOT_PREFIX), definition.slot).toBe(false);
    }
  });

  it("still answers for a noun with nothing sluggable in it", () => {
    expect(discoveredSlotOf("??", 1)).toBe(`${DISCOVERED_SLOT_PREFIX}feature#1`);
  });
});

describe("cutDiscovered — the two calls, and what is asked on each", () => {
  it("cuts an off-list name and files it under the reading's own noun", async () => {
    const reader = readerWith({ detects: { "jaw hardware": [{ x: 100, y: 200, width: 60, height: 40 }] } });
    const out = await cutDiscovered({ frame: FRAME, features: [feature("jaw hardware")], reader });

    expect(out.asked).toBe(1);
    expect(out.regions).toHaveLength(1);
    const row = out.regions[0]!;
    expect(row.noun).toBe("jaw hardware");
    expect(row.instance).toBe(1);
    expect(row.slot).toBe(`${DISCOVERED_SLOT_PREFIX}jaw-hardware#1`);
    /* The box is the MASK's bounds and not the detector's rectangle: the panel
       draws a window on the frame, and the rectangle was only the question. */
    expect(row.box).toEqual({ x: 100, y: 200, width: 60, height: 40, frame: { width: 768, height: 576 } });
  });

  /*
    ⚠ THE CAP, driven on the exact cell that defeated the obvious shape. The
    detector finds all three eyes; the reading counted ONE third eye; so ONE
    rectangle is asked about, and it is the FIRST.
  */
  it("asks about at most `count` rectangles, first ones first", async () => {
    const boxes = [
      { x: 300, y: 80, width: 40, height: 30 },
      { x: 200, y: 180, width: 40, height: 30 },
      { x: 400, y: 180, width: 40, height: 30 },
    ];
    const reader = readerWith({ detects: { "third eye": boxes } });
    const out = await cutDiscovered({ frame: FRAME, features: [feature("third eye", 1)], reader });

    expect(reader.asked.boxes).toHaveLength(1);
    expect(reader.asked.boxes[0]!.box).toEqual(boxes[0]);
    expect(out.regions).toHaveLength(1);
  });

  it("makes a row per instance when the reading counted several, one call each", async () => {
    const boxes = [
      { x: 100, y: 100, width: 20, height: 20 },
      { x: 500, y: 100, width: 20, height: 20 },
      { x: 300, y: 400, width: 20, height: 20 },
    ];
    const reader = readerWith({ detects: { strap: boxes } });
    const out = await cutDiscovered({ frame: FRAME, features: [feature("strap", 2)], reader });

    /* Two rectangles asked about, each on its OWN call — never one call with
       two prompts, which #2532 measured as switching instances. */
    expect(reader.asked.boxes.map((one) => one.box)).toEqual([boxes[0], boxes[1]]);
    expect(out.regions.map((one) => one.instance)).toEqual([1, 2]);
    expect(out.regions.map((one) => one.slot)).toEqual([
      `${DISCOVERED_SLOT_PREFIX}strap#1`,
      `${DISCOVERED_SLOT_PREFIX}strap#2`,
    ]);
  });

  it("never asks the detector about a name the catalogue already buys", async () => {
    const reader = readerWith({ detects: { hair: [{ x: 0, y: 0, width: 10, height: 10 }] } });
    const out = await cutDiscovered({
      frame: FRAME,
      features: [feature("hair"), feature("eyes", 2)],
      reader,
    });
    expect(reader.asked.pointer).toEqual([]);
    expect(reader.asked.boxes).toEqual([]);
    expect(out.regions).toEqual([]);
    expect(out.asked).toBe(0);
  });

  /*
    THE ABSENCE CONTROL — #2532's three negative controls, each verified absent
    at the frame by eye before the bench ran, all returned an empty list and the
    segmenter was never called. That is the property this road's absence answer
    rests on, so it is driven rather than trusted.
  */
  it("reads an empty detector answer as absence and never calls the segmenter", async () => {
    const reader = readerWith({ detects: {} });
    const out = await cutDiscovered({ frame: FRAME, features: [feature("goggles")], reader });

    expect(reader.asked.pointer).toEqual(["goggles"]);
    expect(reader.asked.boxes).toEqual([]);
    expect(out.regions).toEqual([]);
    expect(out.declined).toEqual(["goggles"]);
    expect(out.failed).toEqual([]);
  });

  it("tells a detector FAILURE apart from an absence, and loses only that row", async () => {
    const reader = readerWith({
      detects: {
        jacket: new Error("429 concurrent_requests_limit"),
        sash: [{ x: 10, y: 10, width: 10, height: 10 }],
      },
    });
    const out = await cutDiscovered({
      frame: FRAME,
      features: [feature("jacket"), feature("sash")],
      reader,
    });

    expect(out.failed).toEqual(["jacket"]);
    expect(out.declined).toEqual([]);
    expect(out.regions.map((one) => one.noun)).toEqual(["sash"]);
  });

  it("drops a row the segmenter answered nothing for", async () => {
    const reader = readerWith({
      detects: { sash: [{ x: 10, y: 10, width: 10, height: 10 }] },
      cuts: () => null,
    });
    const out = await cutDiscovered({ frame: FRAME, features: [feature("sash")], reader });
    expect(out.regions).toEqual([]);
  });

  it("drops a cut with no pixels in it", async () => {
    const reader = readerWith({
      detects: { sash: [{ x: 10, y: 10, width: 10, height: 10 }] },
      cuts: () => emptyMask(),
    });
    const out = await cutDiscovered({ frame: FRAME, features: [feature("sash")], reader });
    expect(out.regions).toEqual([]);
  });

  /*
    ⚠ THE OTHER REFUSAL, and it has no tolerance to tune: the rectangle WAS the
    question, so a mask that shares no pixel with it is the segmenter answering
    about something else.
  */
  it("drops a cut that sits outside the rectangle it was asked about", async () => {
    const reader = readerWith({
      detects: { sash: [{ x: 10, y: 10, width: 20, height: 20 }] },
      cuts: () => maskAt({ x: 400, y: 400, width: 20, height: 20 }),
    });
    const out = await cutDiscovered({ frame: FRAME, features: [feature("sash")], reader });
    expect(out.regions).toEqual([]);
  });

  it("keeps a cut that merely overflows the rectangle", async () => {
    /* A real cut is rarely the detector's rectangle to the pixel, and growing
       past it is the segmenter doing its job — the jaw cell's whole-and-chin
       answer is exactly this shape. */
    const reader = readerWith({
      detects: { "jaw hardware": [{ x: 100, y: 100, width: 20, height: 20 }] },
      cuts: () => maskAt({ x: 90, y: 90, width: 60, height: 60 }),
    });
    const out = await cutDiscovered({ frame: FRAME, features: [feature("jaw hardware")], reader });
    expect(out.regions).toHaveLength(1);
  });

  it("files each row as it lands, so a panel on screen fills in", async () => {
    const landed: string[] = [];
    const reader = readerWith({
      detects: {
        jacket: [{ x: 10, y: 10, width: 10, height: 10 }],
        sash: [{ x: 50, y: 50, width: 10, height: 10 }],
      },
    });
    const out = await cutDiscovered({
      frame: FRAME,
      features: [feature("jacket"), feature("sash")],
      reader,
      onFiled: (region) => landed.push(region.noun),
    });
    expect(landed.sort()).toEqual(["jacket", "sash"]);
    expect(out.regions).toHaveLength(2);
  });

  it("gathers rows in the READING's order, whatever order the provider answered in", async () => {
    /* The detector for the first name answers slowly; the row order must still
       be the reading's, or a panel re-orders itself between two readings of one
       frame. */
    const order = ["jacket", "sash", "rope"];
    const reader: RegionReader = {
      async region() { throw new Error("not this road"); },
      async subject() { throw new Error("not this road"); },
      async landmark() { throw new Error("not this road"); },
      async pointer({ name }) {
        await new Promise((resolve) => setTimeout(resolve, name === "jacket" ? 20 : 1));
        return [{ x: 10, y: 10, width: 10, height: 10 }];
      },
      async regionInBox({ box }) { return maskAt(box); },
    };
    const out = await cutDiscovered({
      frame: FRAME,
      features: order.map((name) => feature(name)),
      reader,
    });
    expect(out.regions.map((one) => one.noun)).toEqual(order);
  });

  /*
    A READER WITHOUT THE CAPABILITY PRODUCES NO ROWS AND NO EXCEPTION — which is
    today's panel, and is what every existing suite in this repository gets
    without changing a line.
  */
  it("answers nothing when the reader cannot point at all", async () => {
    const reader: RegionReader = {
      async region() { throw new Error("not this road"); },
      async subject() { throw new Error("not this road"); },
      async landmark() { throw new Error("not this road"); },
    };
    const out = await cutDiscovered({ frame: FRAME, features: [feature("sash")], reader });
    expect(out).toEqual({ regions: [], asked: 0, declined: [], failed: [] });
  });

  it("asks about a frame's own address when it has one", async () => {
    const seen: Array<string | undefined> = [];
    const reader: RegionReader = {
      async region() { throw new Error("not this road"); },
      async subject() { throw new Error("not this road"); },
      async landmark() { throw new Error("not this road"); },
      async pointer({ imageUrl }) {
        seen.push(imageUrl);
        return [{ x: 10, y: 10, width: 10, height: 10 }];
      },
      async regionInBox({ box, imageUrl }) {
        seen.push(imageUrl);
        return maskAt(box);
      },
    };
    await cutDiscovered({
      frame: { ...FRAME, url: "https://pub.example/frame.png" },
      features: [feature("sash")],
      reader,
    });
    expect(seen).toEqual(["https://pub.example/frame.png", "https://pub.example/frame.png"]);
  });
});
