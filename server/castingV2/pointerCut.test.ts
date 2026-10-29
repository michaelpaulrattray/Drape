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
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  DISCOVERED_SLOT_PREFIX,
  catalogueCutsOf,
  catalogueRowOf,
  coveredByCatalogue,
  cutDiscovered,
  discoveredSlotOf,
  hostedNames,
  normalisedName,
  offListFeatures,
  placeNames,
  pointerFeatures,
  productWordFor,
  settleByPlace,
  wordsOnlyFeatures,
  besideItsHost,
  type CatalogueCut,
  type DiscoveredRegion,
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

/* The three grouping facts default to the values the parse falls back to
   (#2566), so an arm that is not about them reads as it did before they
   existed; `extra` is how slice 2's arms will say what they ARE about. */
const feature = (
  name: string,
  count = 1,
  extra: Partial<DiscoveredFeature> = {},
): DiscoveredFeature => (
  { name, count, about: "", kind: "anatomy", on: "", coverage: "single", ...extra }
);

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

  /*
    ⚠ EVERY ROW-NOUN EXCEPT AN ACCESSORY THE SCAN DOES NOT ASK (#2781). That
    exception is the repair: `nose stud` has a catalogue slot and no question
    anybody sends, so "covered" sent a found nose stud down a road that never
    bought it. The population stays the whole catalogue; the exclusion is read
    off `scanPlan`, the one place that decides what is asked.
  */
  it("covers every noun the catalogue draws a row with, bar an accessory the scan never asks", () => {
    const asked = new Set(scanPlan().flatMap((entry) => entry.slots.map((slot) => slot.slot)));
    for (const definition of catalogueSlots()) {
      if (definition.group === "accessories" && !asked.has(definition.slot)) continue;
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
  });

  /*
    THE SEPTUM RING'S FIRST ROAD (#2781). A reading that names a nose stud is
    talking about a thing the scan has no question out for — the court for
    nose studs was deferred (fable-647) — so it must reach the pointer road,
    or it reaches nothing. The armed accessories are the positive control: the
    scan does ask those, and a found duplicate of them would be bought twice.
  */
  it("does NOT cover an accessory the scan never asks, and still covers the ones it does", () => {
    const asked = new Set(scanPlan().map((entry) => entry.question));
    expect(asked.has("nose stud"), "the premise: nobody sends `nose stud`").toBe(false);
    expect(coveredByCatalogue("nose stud")).toBe(false);
    expect(coveredByCatalogue("nose-studs")).toBe(false);
    expect(asked.has("earring") && asked.has("glasses"), "the premise: these two are asked").toBe(true);
    expect(coveredByCatalogue("earring")).toBe(true);
    expect(coveredByCatalogue("earrings")).toBe(true);
    expect(coveredByCatalogue("glasses")).toBe(true);
  });
});

describe("productWordFor — the accessory table's word, when the detector cannot place the reading's (#2781)", () => {
  /*
    Measured on his screenshot crop: the detector boxed NOTHING for
    `septum ring`, `septum piercing` or `septum` on any read, and boxed the
    ring for `nose stud`, `nose ring` and `nose piercing`. `septum` is the
    nose piercing's own word in the accessory table, so the table knows what
    the detector does not.
  */
  it("answers the nose piercing's word for a found septum ring", () => {
    expect(productWordFor({ name: "septum ring", kind: "accessory" })).toBe("nose stud");
    expect(productWordFor({ name: "septum piercing", kind: "accessory" })).toBe("nose stud");
    expect(productWordFor({ name: "nostril stud", kind: "accessory" })).toBe("nose stud");
  });

  it("refuses a kind the scan already asks, so a found duplicate is never bought", () => {
    /* `stud` is an earring word: re-asked as `earring` this would cut the very
       earring the catalogue row already draws. */
    expect(productWordFor({ name: "ear stud", kind: "accessory" })).toBeNull();
    expect(productWordFor({ name: "sunglasses", kind: "accessory" })).toBeNull();
  });

  it("refuses anything that is not worn, and a name already in the table's word", () => {
    /* `nostril` is a nose-piercing word; the NOSTRIL is not a stud. */
    expect(productWordFor({ name: "nostril", kind: "anatomy" })).toBeNull();
    expect(productWordFor({ name: "septum ring", kind: "marking" })).toBeNull();
    expect(productWordFor({ name: "nose stud", kind: "accessory" })).toBeNull();
    expect(productWordFor({ name: "choker", kind: "accessory" })).toBeNull();
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
    /* Every question the scan SENDS — an unasked accessory's question is not
       covered, by #2781's repair, and has its own arm above. */
    for (const planned of scanPlan()) {
      expect(coveredByCatalogue(planned.question), planned.question).toBe(true);
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

  /*
    ⚠ THE THIRD REFUSAL — #2565 §4's quality bar, and this arm exists because
    invariant 7 asks for a test that the control BLOCKS rather than one that it
    is present. The two arms under it are the pair that keeps the bar honest:
    a legitimately small thing is kept, and the bar's own number is what
    decides, so a floor moved by somebody reddens all three.

    The specimen is the shape the court measured: asked about a whole garment,
    the segmenter returns a coherent fragment of it — "only the straps" — with
    a plausible-looking mask. 60x600 inside a 600x600 rectangle is 10% fill,
    which is the real known-bad's 8.2% to within a point.
  */
  it("drops a cut that fills almost none of the rectangle it was asked about", async () => {
    const reader = readerWith({
      detects: { jacket: [{ x: 60, y: 0, width: 600, height: 576 }] },
      cuts: () => maskAt({ x: 300, y: 0, width: 60, height: 576 }),
    });
    const out = await cutDiscovered({ frame: FRAME, features: [feature("jacket")], reader });
    expect(out.regions).toEqual([]);
    /* Not silently lost: the name is still on the record as asked-and-uncut,
       which is what keeps the call census honest about a call that was bought
       and produced no row. */
    expect(out.named.map((one) => one.noun)).toEqual(["jacket"]);
  });

  it("keeps a SMALL thing that fills its own small rectangle — the falsification arm", async () => {
    /* The bar must not refuse a septum ring for being small. A real SAM cut of
       a thin wire hoop fills 50.1% of its box (measured on the court's own
       masks), and a compact nose stud 67.1–76.1%; both are far above the floor.
       This arm is the one that would say so if a fill bar were the wrong
       instrument for small worn things. */
    const reader = readerWith({
      detects: { "septum ring": [{ x: 100, y: 100, width: 20, height: 12 }] },
      cuts: () => maskAt({ x: 102, y: 102, width: 14, height: 8 }),
    });
    const out = await cutDiscovered({ frame: FRAME, features: [feature("septum ring")], reader });
    expect(out.regions).toHaveLength(1);
    expect(out.named).toEqual([]);
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
        /* A place of its own per name (#2752): three nouns cut onto ONE
           rectangle are one thing by the place rule, which is a different arm. */
        return [{ x: 10 + order.indexOf(name) * 40, y: 10, width: 10, height: 10 }];
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
    /* ⚠ `named` IS EMPTY HERE AND THAT IS THE ASSERTION, not bookkeeping: a
       `single` name the detector was never asked about is not *named and not
       cut* — nobody declined it and nothing was gated. The words-only
       population is the scattered and the makeup, and this reader was handed
       neither. The arm below drives the other direction. */
    expect(out).toEqual({ regions: [], asked: 0, declined: [], failed: [], named: [] });
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

/*
  ---- THE POPULATION GATE (#2566 slice 2's grouping design, rules 2, 4 and the
  narrow sibling rule) ----

  ⚠ **EVERY FIXTURE IN THIS BLOCK IS A REAL READING.** The names, kinds, hosts
  and coverages below are what the discovery read actually answered on his three
  production casts, merged across both crops, on the bench the design was
  written from (`output/2566/grouping-discovery.json`). They are not shapes
  invented to make a rule look right — which matters most for the two arms that
  are about the rule NOT firing.
*/
describe("the population gate — what the detector is never asked about", () => {
  /** Cast 2472's merged reading, abridged to the names the rules turn on. */
  const ELDER = [
    feature("third eye", 1, { kind: "anatomy", on: "forehead" }),
    feature("jaw hardware", 1, { kind: "anatomy", on: "jaw" }),
    feature("neck hardware", 1, { kind: "accessory", on: "neck" }),
    feature("robe", 1, { kind: "clothing", on: "" }),
    feature("strap", 2, { kind: "accessory", on: "robe" }),
    feature("charm", 2, { kind: "accessory", on: "strap" }),
    feature("wrinkles", 1, { kind: "marking", on: "face", coverage: "scattered" }),
    feature("head", 1, { kind: "anatomy", on: "" }),
    feature("ears", 2, { kind: "anatomy", on: "head" }),
  ];

  it("asks about nothing that has no outline to cut", () => {
    const population = pointerFeatures(ELDER).map((one) => one.name);
    expect(population).not.toContain("wrinkles");
    /* And what it sits on is untouched: a scattered thing is skipped, never a
       branch of the reading. */
    expect(population).toContain("jaw hardware");
  });

  it("gives a scattered thing's words a road instead of dropping them", () => {
    const said = wordsOnlyFeatures([
      feature("wrinkles", 1, {
        kind: "marking",
        on: "face",
        coverage: "scattered",
        about: "deep lines across the brow",
      }),
    ]);
    expect(said).toEqual([{
      noun: "wrinkles",
      on: "face",
      about: "deep lines across the brow",
      kind: "marking",
      why: "scattered",
    }]);
  });

  /*
    HIS RULING: makeup is something you change with words, not a thing in the
    list. It is read off the KIND and not the coverage, so a reading that calls
    eyeliner one connected line still buys nothing.
  */
  it("asks about no makeup, however the reading described its spread", () => {
    for (const coverage of ["single", "scattered"] as const) {
      const one = feature("eye makeup", 1, { kind: "makeup", on: "eyes", coverage });
      expect(pointerFeatures([one]), coverage).toEqual([]);
      expect(wordsOnlyFeatures([one])[0]?.why, coverage).toBe("makeup");
    }
  });

  /*
    THE NARROW SIBLING RULE — a place is not a feature.

    ⚠ **`head` IS A PLACE ONLY AFTER THE MERGE, which is why the rule reads the
    merged reading and not one crop**: the full-frame crop named `head`, and the
    HEAD crop was the one that said `ears on=head`. This is the real pairing
    from cast 2472.
  */
  it("draws nothing for a place things merely sit on", () => {
    expect(Array.from(placeNames(ELDER))).toEqual(["head"]);
    expect(pointerFeatures(ELDER).map((one) => one.name)).not.toContain("head");
  });

  it("gives a place no words either — its words are about a head, not a feature", () => {
    const said = wordsOnlyFeatures([
      ...ELDER.filter((one) => one.name !== "head"),
      feature("head", 1, { kind: "anatomy", on: "", about: "a long tapered skull" }),
    ]);
    expect(said.map((one) => one.noun)).not.toContain("head");
  });

  /*
    ⚠ **THE POSITIVE CONTROL FOR THE RULE'S OWN LIMIT, and it is the arm that
    matters most.** `charm on=strap` makes `strap` a host on this very cast — so
    a place rule that did not restrict itself to `anatomy` would take the
    strap's row and its cut away, and every arm above would still pass.
  */
  it("CONTROL — an accessory that things sit on keeps its row and its cut", () => {
    expect(placeNames(ELDER).has("strap")).toBe(false);
    expect(pointerFeatures(ELDER).map((one) => one.name)).toContain("strap");
  });

  it("CONTROL — a reading that answers its own name as its host hosts nothing", () => {
    const narcissus = [feature("skin", 1, { kind: "anatomy", on: "skin" })];
    expect(Array.from(hostedNames(narcissus))).toEqual([]);
    expect(Array.from(placeNames(narcissus))).toEqual([]);
  });

  /*
    THE MEASURED SAVING, on the three production casts the design was written
    from. ⚠ **It is reported rather than celebrated**: four names of twenty-nine
    is a courtesy, and what the gate actually removes is the CLASS — the
    detector is never asked for a thing that has no outline, which is the source
    of the freckles-cut-like-an-object defect his eye found.
  */
  it("spends on twenty-five of the twenty-nine off-list names the fixtures produced", () => {
    const cast2456 = [
      feature("mole", 1, { kind: "marking", on: "face" }),
      feature("collar", 1, { kind: "accessory", on: "neck" }),
      feature("tattoo", 1, { kind: "marking", on: "" }),
      feature("jacket", 1, { kind: "clothing", on: "" }),
      feature("choker", 1, { kind: "accessory", on: "neck" }),
      feature("top", 1, { kind: "clothing", on: "" }),
      feature("harness", 1, { kind: "accessory", on: "jacket" }),
      feature("sash", 1, { kind: "clothing", on: "" }),
    ];
    const cast2472 = [
      ...ELDER,
      feature("scarf", 1, { kind: "clothing", on: "" }),
      feature("shoulder armor", 1, { kind: "accessory", on: "shoulder" }),
      feature("pendant", 1, { kind: "accessory", on: "robe" }),
      feature("shoulder plate", 2, { kind: "accessory", on: "robe" }),
    ];
    const cast2556 = [
      feature("hood", 1, { kind: "clothing", on: "" }),
      feature("face mask", 1, { kind: "clothing", on: "" }),
      feature("scarf", 1, { kind: "clothing", on: "" }),
      feature("coat", 1, { kind: "clothing", on: "" }),
      feature("strap", 2, { kind: "accessory", on: "coat" }),
      feature("buckle", 1, { kind: "accessory", on: "strap" }),
      feature("rope", 1, { kind: "accessory", on: "coat" }),
      feature("leather patch", 2, { kind: "clothing", on: "coat", coverage: "scattered" }),
      feature("stitching", 1, { kind: "marking", on: "coat", coverage: "scattered" }),
    ];
    const casts = [cast2456, cast2472, cast2556];
    const before = casts.reduce((sum, cast) => sum + offListFeatures(cast).length, 0);
    const after = casts.reduce((sum, cast) => sum + pointerFeatures(cast).length, 0);
    expect(before).toBe(29);
    expect(after).toBe(25);
    /* The gated names BY NAME, so a change here says which name it stopped
       asking about rather than only that a number moved. `head` is absent on
       purpose: it is gated as a PLACE, which buys no call AND contributes no
       words, so it shows in the arithmetic and not in this list. */
    const gated = casts.flatMap((cast) => wordsOnlyFeatures(cast).map((one) => one.noun));
    expect(gated.sort()).toEqual(["leather patch", "stitching", "wrinkles"]);
    expect(before - after).toBe(4);
  });
});

describe("cutDiscovered — the grouping facts, and what it says about a name it could not draw", () => {
  const box = { x: 100, y: 200, width: 60, height: 40 };

  it("carries the reading's own kind and host onto every region it cuts", async () => {
    /* The harness on a place of its own, off the jacket's pixels (#2752): an
       accessory cut onto the jacket's own rectangle IS the jacket by the place
       rule, which has arms of its own below. */
    const reader = readerWith({
      detects: { jacket: [box], harness: [{ x: 300, y: 200, width: 60, height: 40 }] },
    });
    const out = await cutDiscovered({
      frame: FRAME,
      features: [
        feature("jacket", 1, { kind: "clothing", on: "" }),
        feature("harness", 1, { kind: "accessory", on: "jacket" }),
      ],
      reader,
    });
    expect(out.regions.map((one) => ({ noun: one.noun, kind: one.kind, on: one.on }))).toEqual([
      { noun: "jacket", kind: "clothing", on: "" },
      { noun: "harness", kind: "accessory", on: "jacket" },
    ]);
  });

  /*
    ⚠ **`named` IS KEYED ON ROWS AND NOT ON THE REFUSAL, and this arm is the
    difference.** A name the detector ANSWERED and the segmenter then failed on
    — no mask, no pixels, or a cut outside the rectangle that asked for it — is
    neither `declined` nor `failed`, and has no row either. Keying the words on
    `declined` would have dropped exactly the specimen this module's header is
    written about: the three-eyed cast's rectangle that came back cutting an
    ordinary eye.
  */
  it("records a name it was asked about and could not draw, however it failed", async () => {
    const reader = readerWith({ detects: { goggles: [box] }, cuts: () => null });
    const out = await cutDiscovered({
      frame: FRAME,
      features: [feature("goggles", 1, { about: "cracked brass lenses" })],
      reader,
    });
    expect(out.regions).toEqual([]);
    expect(out.declined).toEqual([]);
    expect(out.failed).toEqual([]);
    expect(out.named).toEqual([{
      noun: "goggles",
      on: "",
      about: "cracked brass lenses",
      kind: "anatomy",
      why: "uncut",
    }]);
  });

  it("CONTROL — a name it DID draw is not recorded as uncut", async () => {
    const reader = readerWith({ detects: { goggles: [box] } });
    const out = await cutDiscovered({
      frame: FRAME,
      features: [feature("goggles", 1, { about: "cracked brass lenses" })],
      reader,
    });
    expect(out.regions).toHaveLength(1);
    expect(out.named).toEqual([]);
  });

  it("records a partly-drawn name as drawn — one row of two is still a row", async () => {
    let call = 0;
    const reader = readerWith({
      detects: { strap: [box, { x: 300, y: 200, width: 60, height: 40 }] },
      cuts: (asked) => (call++ === 0 ? maskAt(asked) : null),
    });
    const out = await cutDiscovered({
      frame: FRAME,
      features: [feature("strap", 2, { kind: "accessory", on: "coat" })],
      reader,
    });
    expect(out.regions).toHaveLength(1);
    expect(out.named).toEqual([]);
  });

  it("carries a gated name's words even when the reader cannot point at all", async () => {
    const blind: RegionReader = {
      async region() { throw new Error("not this road"); },
      async subject() { throw new Error("not this road"); },
      async landmark() { throw new Error("not this road"); },
    };
    const out = await cutDiscovered({
      frame: FRAME,
      features: [feature("freckles", 1, {
        kind: "marking",
        on: "skin",
        coverage: "scattered",
        about: "a dusting across the nose",
      })],
      reader: blind,
    });
    /* The words were never the detector's to give, so a reader without the
       capability costs the rows and not the record. */
    expect(out.regions).toEqual([]);
    expect(out.named.map((one) => one.noun)).toEqual(["freckles"]);
  });

  it("asks the detector about no gated name at all", async () => {
    const reader = readerWith({ detects: { tattoo: [box] } });
    await cutDiscovered({
      frame: FRAME,
      features: [
        feature("tattoo", 1, { kind: "marking", on: "" }),
        feature("freckles", 1, { kind: "marking", on: "skin", coverage: "scattered" }),
        feature("eye makeup", 1, { kind: "makeup", on: "eyes" }),
      ],
      reader,
    });
    /* The whole point of the gate, read at the wire rather than at a count. */
    expect(reader.asked.pointer).toEqual(["tattoo"]);
  });
});

/**
 * WHERE A FOUND THING IS DECIDES WHAT IT IS (#2752 — his eye on the live
 * grouping, 2026-10-29: *"croissmark and scar ar the same thing>?"* and
 * *"collar is showing up seperate to the outfit"*).
 *
 * Driven on synthetic masks whose overlaps are the ones measured on his
 * screenshot crop through the real road (`output/2752/his-names.txt`, never
 * committed): two nouns on one place shared 99.8–100% of their pixels, and the
 * collar's cut lay 92% on the jacket's while being 60% of it.
 *
 * ⚠ **Every arm that says "one row" has a sibling that says "still two"**,
 * because a place rule that merges too much is the same failure as one that
 * merges too little, pointed the other way — and the two-instance rule (#2565
 * §6) is the one it must not break.
 */
describe("the place rules — one row per place on the picture, never per spelling", () => {
  /** A region on FRAME whose cut is exactly the given rectangles. */
  const region = (
    noun: string,
    kind: DiscoveredRegion["kind"],
    rects: PointerBox[],
    extra: { on?: string; instance?: number } = {},
  ): DiscoveredRegion => {
    const data = Buffer.alloc(FRAME.width * FRAME.height, 0);
    for (const rect of rects) {
      for (let y = rect.y; y < rect.y + rect.height; y += 1) {
        for (let x = rect.x; x < rect.x + rect.width; x += 1) data[y * FRAME.width + x] = 255;
      }
    }
    const left = Math.min(...rects.map((r) => r.x));
    const top = Math.min(...rects.map((r) => r.y));
    const right = Math.max(...rects.map((r) => r.x + r.width));
    const bottom = Math.max(...rects.map((r) => r.y + r.height));
    return {
      slot: discoveredSlotOf(noun, extra.instance ?? 1),
      noun,
      instance: extra.instance ?? 1,
      kind,
      on: extra.on ?? "",
      box: {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
        frame: { width: FRAME.width, height: FRAME.height },
      },
      mask: { data, width: FRAME.width, height: FRAME.height },
    };
  };
  const nouns = (regions: readonly DiscoveredRegion[]) => regions.map((one) => one.noun);

  /* ---- same place, same kind ---- */

  it("his cross mark and scar — two nouns cut onto one place are ONE row", () => {
    const out = settleByPlace([
      region("cross mark", "marking", [{ x: 100, y: 100, width: 10, height: 40 }]),
      region("scar", "marking", [
        { x: 100, y: 100, width: 10, height: 40 },
        { x: 96, y: 112, width: 18, height: 3 },
      ]),
    ]);
    expect(out.regions).toHaveLength(1);
    expect(out.samePlace).toHaveLength(1);
  });

  it("the place takes the LARGER cut's noun, as the more complete picture of it", () => {
    /* The crop's own specimen: `scar` and `cross mark` cut onto part of the
       neck tattoo, and `neck tattoo` cut the whole of it. */
    const out = settleByPlace([
      region("scar", "marking", [{ x: 200, y: 100, width: 20, height: 100 }]),
      region("neck tattoo", "marking", [{ x: 190, y: 95, width: 30, height: 110 }]),
      region("cross mark", "marking", [{ x: 200, y: 100, width: 20, height: 100 }]),
    ]);
    expect(nouns(out.regions)).toEqual(["neck tattoo"]);
    expect(out.samePlace.map((one) => one.into)).toEqual(["neck tattoo", "neck tattoo"]);
  });

  it("pixel-identical cuts keep the reading's order — the first noun names the place", () => {
    const rect = { x: 100, y: 100, width: 10, height: 40 };
    const out = settleByPlace([
      region("cross mark", "marking", [rect]),
      region("scar", "marking", [rect]),
    ]);
    expect(nouns(out.regions)).toEqual(["cross mark"]);
  });

  it("STILL TWO — two real scars in two places stay two rows (#2565 §6)", () => {
    const out = settleByPlace([
      region("scar", "marking", [{ x: 100, y: 100, width: 10, height: 40 }], { instance: 1 }),
      region("scar", "marking", [{ x: 400, y: 100, width: 10, height: 40 }], { instance: 2 }),
    ]);
    expect(out.regions.map((one) => one.instance)).toEqual([1, 2]);
    expect(out.samePlace).toEqual([]);
  });

  it("but two boxes the segmenter answered with ONE scar's pixels are one scar", () => {
    const rect = { x: 100, y: 100, width: 10, height: 40 };
    const out = settleByPlace([
      region("scar", "marking", [rect], { instance: 1 }),
      region("scar", "marking", [rect], { instance: 2 }),
    ]);
    expect(out.regions.map((one) => one.instance)).toEqual([1]);
  });

  it("STILL TWO — a small mark lying inside a large one is two things (a mole on a tattoo)", () => {
    /* The large cut is mostly NOT the small one, so "mostly each other" fails
       one way round — which is the whole reason the rule is read against the
       LARGER cut. */
    const out = settleByPlace([
      region("tattoo", "marking", [{ x: 100, y: 100, width: 100, height: 100 }]),
      region("mole", "marking", [{ x: 140, y: 140, width: 8, height: 8 }]),
    ]);
    expect(nouns(out.regions)).toEqual(["tattoo", "mole"]);
  });

  it("at exactly half of the larger cut it is not yet the same place — MORE than half is the rule", () => {
    /* 400 pixels each, 200 of them shared: exactly half of either. */
    const half = settleByPlace([
      region("scar", "marking", [{ x: 100, y: 100, width: 20, height: 20 }]),
      region("mark", "marking", [{ x: 110, y: 100, width: 20, height: 20 }]),
    ]);
    expect(nouns(half.regions)).toEqual(["scar", "mark"]);
    /* One column more — 220 of 400 — and it is. */
    const over = settleByPlace([
      region("scar", "marking", [{ x: 100, y: 100, width: 20, height: 20 }]),
      region("mark", "marking", [{ x: 109, y: 100, width: 20, height: 20 }]),
    ]);
    expect(nouns(over.regions)).toEqual(["scar"]);
  });

  /* ---- the garment ---- */

  it("his collar — an accessory cut on a garment's own pixels IS that garment, and the garment survives", () => {
    /* The crop's measured shape: the collar's cut lies 92% on the jacket's and
       is 60% of it. Listed first, it still does not take the garment's place —
       the pixels are garment pixels. */
    const out = settleByPlace([
      region("collar", "accessory", [{ x: 100, y: 100, width: 200, height: 120 }], { on: "neck" }),
      region("jacket", "clothing", [{ x: 90, y: 100, width: 300, height: 140 }]),
    ]);
    expect(out.regions.map((one) => [one.noun, one.kind])).toEqual([["jacket", "clothing"]]);
    expect(out.samePlace).toEqual([{ noun: "collar", into: "jacket" }]);
  });

  it("the garment survives the same place even when the accessory's cut is the larger", () => {
    const out = settleByPlace([
      region("neck piece", "accessory", [{ x: 100, y: 100, width: 200, height: 150 }]),
      region("collar", "clothing", [{ x: 100, y: 100, width: 200, height: 120 }]),
    ]);
    expect(out.regions.map((one) => one.kind)).toEqual(["clothing"]);
  });

  it("an accessory lying mostly on a garment, but not the same place, is worn ON it", () => {
    const out = settleByPlace([
      region("jacket", "clothing", [{ x: 0, y: 100, width: 400, height: 300 }]),
      region("collar", "accessory", [{ x: 150, y: 100, width: 100, height: 40 }], { on: "neck" }),
    ]);
    expect(out.regions.map((one) => [one.noun, one.on])).toEqual([["jacket", ""], ["collar", "jacket"]]);
    expect(out.onGarment).toEqual([{ noun: "collar", onto: "jacket" }]);
  });

  it("CONTROL — an accessory on bare skin keeps the host the reading gave it", () => {
    const out = settleByPlace([
      region("jacket", "clothing", [{ x: 0, y: 300, width: 400, height: 200 }]),
      region("choker", "accessory", [{ x: 150, y: 200, width: 100, height: 20 }], { on: "neck" }),
    ]);
    expect(out.regions.map((one) => one.on)).toEqual(["", "neck"]);
    expect(out.onGarment).toEqual([]);
  });

  /* ---- his round-1 ⚠: anatomy is never folded into anything ---- */

  it("⚠ body hardware is NEVER joined to a garment, however many pixels they share", () => {
    const rect = { x: 100, y: 100, width: 120, height: 40 };
    const out = settleByPlace([
      region("collar", "clothing", [rect]),
      region("neck implant", "anatomy", [rect]),
    ]);
    expect(out.regions.map((one) => one.kind)).toEqual(["clothing", "anatomy"]);
    expect(out.samePlace).toEqual([]);
  });

  it("⚠ body hardware lying inside a garment's cut is never put on the garment", () => {
    const out = settleByPlace([
      region("jacket", "clothing", [{ x: 0, y: 100, width: 400, height: 300 }]),
      region("shoulder implant", "anatomy", [{ x: 20, y: 120, width: 40, height: 40 }], { on: "shoulder" }),
    ]);
    expect(out.regions.find((one) => one.noun === "shoulder implant")?.on).toBe("shoulder");
    expect(out.onGarment).toEqual([]);
  });

  it("a marking and a garment on the same pixels stay two rows — the picture cannot say which cut is wrong", () => {
    const rect = { x: 100, y: 100, width: 120, height: 40 };
    const out = settleByPlace([
      region("scarf", "clothing", [rect]),
      region("tattoo", "marking", [rect]),
    ]);
    expect(nouns(out.regions)).toEqual(["scarf", "tattoo"]);
    /* And a marking is never put ON a garment either: it is on the skin by the
       reading's own definition. */
    expect(out.regions.find((one) => one.noun === "tattoo")?.on).toBe("");
  });

  /* ---- what the rule may never do ---- */

  it("returns the survivors in the READING's order, never the size order it walks in", () => {
    const out = settleByPlace([
      region("mole", "marking", [{ x: 10, y: 10, width: 4, height: 4 }]),
      region("jacket", "clothing", [{ x: 0, y: 100, width: 400, height: 300 }]),
      region("neck tattoo", "marking", [{ x: 500, y: 100, width: 40, height: 100 }]),
    ]);
    expect(nouns(out.regions)).toEqual(["mole", "jacket", "neck tattoo"]);
  });

  it("two masks of different sizes are never the same place — refused, not resampled", () => {
    const a = region("scar", "marking", [{ x: 10, y: 10, width: 10, height: 10 }]);
    const small = { width: 384, height: 288 };
    const data = Buffer.alloc(small.width * small.height, 0);
    /* Lit exactly where a reader indexing with the OTHER mask's width would
       look (half the width, so row y lands on row 2y): without the size check
       the two read as the same place, which is what makes this arm able to
       fail. */
    for (let y = 20; y < 40; y += 1) for (let x = 10; x < 20; x += 1) data[y * small.width + x] = 255;
    const b: DiscoveredRegion = {
      ...a,
      noun: "mark",
      slot: discoveredSlotOf("mark", 1),
      mask: { data, width: small.width, height: small.height },
    };
    expect(nouns(settleByPlace([a, b]).regions)).toEqual(["scar", "mark"]);
  });

  /* ---- and through the road itself ---- */

  it("through cutDiscovered: his two nouns on one scar are one row, and the other is not recorded as uncut", async () => {
    const scarBox = { x: 100, y: 100, width: 10, height: 40 };
    const reader = readerWith({ detects: { "cross mark": [scarBox], scar: [scarBox] } });
    const filed: string[] = [];
    const out = await cutDiscovered({
      frame: FRAME,
      features: [
        feature("cross mark", 1, { kind: "marking", on: "cheek" }),
        feature("scar", 1, { kind: "marking", on: "face" }),
      ],
      reader,
      onFiled: (one) => filed.push(one.noun),
    });
    expect(nouns(out.regions)).toEqual(["cross mark"]);
    /* It WAS drawn — its cut is the cross mark's place — so it is not a name
       nothing could draw, and its words do not travel as though it were. */
    expect(out.named).toEqual([]);
    /* And while the reading runs, the second noun on pixels already drawn is
       never drawn: no row appears and then vanishes. */
    expect(filed).toHaveLength(1);
  });

  it("through cutDiscovered: the collar cut from the jacket's pixels ends in the jacket", async () => {
    const reader = readerWith({
      detects: {
        jacket: [{ x: 90, y: 100, width: 300, height: 140 }],
        collar: [{ x: 100, y: 100, width: 200, height: 120 }],
      },
    });
    const out = await cutDiscovered({
      frame: FRAME,
      features: [
        feature("collar", 1, { kind: "accessory", on: "neck" }),
        feature("jacket", 1, { kind: "clothing" }),
      ],
      reader,
    });
    expect(out.regions.map((one) => [one.noun, one.kind])).toEqual([["jacket", "clothing"]]);
  });
});

describe("cutDiscovered — a worn thing the detector cannot place in the reading's word (#2781)", () => {
  /* The ring under the nose on his crop, in the crop's own pixels. */
  const ring = { x: 347, y: 397, width: 36, height: 21 };
  /* The nose the scan cut on the same frame, which the ring's top lies in —
     the product's word must land where that kind is worn (#2789). */
  const noseBox = { x: 330, y: 300, width: 70, height: 100 };
  const nose: CatalogueCut = { slot: "nose" as never, group: "face", question: "nose", box: noseBox, mask: maskAt(noseBox) };

  it("asks once more in the accessory table's word, and the row keeps the reading's noun", async () => {
    const reader = readerWith({ detects: { "nose stud": [ring] } });
    const out = await cutDiscovered({
      frame: FRAME,
      features: [feature("septum ring", 1, { kind: "accessory", on: "nose" })],
      reader,
      catalogue: async () => [nose],
    });
    expect(reader.asked.pointer).toEqual(["septum ring", "nose stud"]);
    expect(out.regions.map((one) => ({ noun: one.noun, kind: one.kind, on: one.on }))).toEqual([
      { noun: "septum ring", kind: "accessory", on: "nose" },
    ]);
    expect(out.declined).toEqual([]);
    expect(out.named.filter((one) => one.why === "uncut")).toEqual([]);
  });

  it("CONTROL — the reading's word placed first is never re-asked", async () => {
    const reader = readerWith({ detects: { "septum ring": [ring], "nose stud": [ring] } });
    const out = await cutDiscovered({
      frame: FRAME,
      features: [feature("septum ring", 1, { kind: "accessory", on: "nose" })],
      reader,
    });
    expect(reader.asked.pointer).toEqual(["septum ring"]);
    expect(out.regions).toHaveLength(1);
  });

  it("CONTROL — a found earring is never re-asked as the catalogue's own earring", async () => {
    const reader = readerWith({ detects: { earring: [ring] } });
    const out = await cutDiscovered({
      frame: FRAME,
      features: [feature("ear stud", 1, { kind: "accessory", on: "ear" })],
      reader,
    });
    expect(reader.asked.pointer).toEqual(["ear stud"]);
    expect(out.regions).toEqual([]);
    expect(out.named.map((one) => `${one.noun}:${one.why}`)).toEqual(["ear stud:uncut"]);
  });

  it("a second miss in the table's word is still a name with no row, kept with its words", async () => {
    const reader = readerWith({ detects: {} });
    const out = await cutDiscovered({
      frame: FRAME,
      features: [feature("septum ring", 1, { kind: "accessory", on: "nose", about: "a thin silver ring" })],
      reader,
    });
    expect(reader.asked.pointer).toEqual(["septum ring", "nose stud"]);
    expect(out.declined).toEqual(["septum ring"]);
    expect(out.named).toEqual([
      { noun: "septum ring", on: "nose", about: "a thin silver ring", kind: "accessory", why: "uncut" },
    ]);
  });

  /*
    THE FIRST ROAD, DRIVEN: a reading that says `nose stud` used to be
    "covered" and was never asked about at all.
  */
  it("a found nose stud reaches the detector now", async () => {
    const reader = readerWith({ detects: { "nose stud": [ring] } });
    const out = await cutDiscovered({
      frame: FRAME,
      features: [feature("nose stud", 1, { kind: "accessory", on: "nose" })],
      reader,
    });
    expect(reader.asked.pointer).toEqual(["nose stud"]);
    expect(out.regions.map((one) => one.noun)).toEqual(["nose stud"]);
  });
});

/**
 * HIS EYE, ROUND 4 (#2789), verbatim: *"star tatoo was coming up under also on
 * this character and under nose? under ears is also ear piercing which is also
 * under accesories?"* One thing, drawn as two rows, twice.
 *
 * Every arm that says "one row" has a sibling that says "still two", for the
 * reason the place rules above do: a rule that merges too much is the same
 * failure pointed the other way, and the two-instance rule (#2565 §6) is the
 * one it must not break.
 */
describe("one thing, one row — a found cut against the catalogue's own cuts (#2789)", () => {
  /** A cut lit on every pixel of the given rectangles. */
  const lit = (rects: PointerBox[]): { box: PointerBox; mask: Mask } => {
    const data = Buffer.alloc(FRAME.width * FRAME.height, 0);
    for (const rect of rects) {
      for (let y = rect.y; y < rect.y + rect.height; y += 1) {
        for (let x = rect.x; x < rect.x + rect.width; x += 1) data[y * FRAME.width + x] = 255;
      }
    }
    const left = Math.min(...rects.map((r) => r.x));
    const top = Math.min(...rects.map((r) => r.y));
    const box = {
      x: left,
      y: top,
      width: Math.max(...rects.map((r) => r.x + r.width)) - left,
      height: Math.max(...rects.map((r) => r.y + r.height)) - top,
    };
    return { box, mask: { data, width: FRAME.width, height: FRAME.height } };
  };
  /** The outline of a rectangle, one pixel thick — a ring, as the segmenter cuts one. */
  const outline = (rect: PointerBox): PointerBox[] => [
    { x: rect.x, y: rect.y, width: rect.width, height: 1 },
    { x: rect.x, y: rect.y + rect.height - 1, width: rect.width, height: 1 },
    { x: rect.x, y: rect.y, width: 1, height: rect.height },
    { x: rect.x + rect.width - 1, y: rect.y, width: 1, height: rect.height },
  ];
  const found = (
    noun: string,
    kind: DiscoveredRegion["kind"],
    rects: PointerBox[],
    extra: { on?: string; instance?: number } = {},
  ): DiscoveredRegion => {
    const { box, mask } = lit(rects);
    return {
      slot: discoveredSlotOf(noun, extra.instance ?? 1),
      noun,
      instance: extra.instance ?? 1,
      kind,
      on: extra.on ?? "",
      box: { ...box, frame: { width: FRAME.width, height: FRAME.height } },
      mask,
    };
  };
  const catalogued = (slot: string, group: CatalogueCut["group"], question: string, rects: PointerBox[]): CatalogueCut => (
    { slot: slot as never, group, question, ...lit(rects) }
  );

  /* ---- his hoop: the found ear piercing IS the catalogue's earring ---- */

  /* The measured shape on his crop: the catalogue's earring is the hoop (a
     ring), the found cut is the hoop AND its inside — every catalogue pixel on
     the found cut, the found cut half hoop. */
  const hoop = { x: 200, y: 300, width: 22, height: 38 };
  const earring = catalogued("earring@right", "accessories", "earring", outline(hoop));

  it("his hoop — a found cut that holds the catalogue earring's whole cut is that Earrings row", () => {
    const piercing = found("ear piercing", "accessory", [hoop], { on: "ear" });
    expect(catalogueRowOf(piercing, [earring])?.slot).toBe("earring@right");
  });

  it("STILL TWO — a second real piercing on the same ear shares no pixels and keeps its row (#2565 §6)", () => {
    const helix = found("ear piercing", "accessory", [{ x: 205, y: 250, width: 6, height: 6 }], { on: "ear" });
    expect(catalogueRowOf(helix, [earring])).toBeNull();
  });

  it("a stud inside a side's union of two pieces is that side's earring, drawn once", () => {
    const side = catalogued("earring@left", "accessories", "earring", [
      { x: 500, y: 300, width: 8, height: 8 },
      { x: 500, y: 330, width: 10, height: 30 },
    ]);
    const stud = found("ear stud", "accessory", [{ x: 500, y: 300, width: 8, height: 8 }], { on: "ear" });
    expect(catalogueRowOf(stud, [side])?.slot).toBe("earring@left");
  });

  /* ---- #2757's own specimen: a mis-cut that IS a body row ---- */

  it("#2757 — a found `lip piercing` cut to the whole lips is the Lips row", () => {
    const lipsRect = { x: 300, y: 400, width: 80, height: 30 };
    const lips = catalogued("lips", "face", "lips", [lipsRect]);
    const miscut = found("lip piercing", "accessory", [lipsRect], { on: "lips" });
    expect(catalogueRowOf(miscut, [lips])?.slot).toBe("lips");
  });

  it("STILL TWO — a real lip ring is a small part of the lips, and is never the Lips row", () => {
    /* Every one of its pixels lies on the lips — worn on worn would join them,
       and that rule is for worn rows only. */
    const lips = catalogued("lips", "face", "lips", [{ x: 300, y: 400, width: 80, height: 30 }]);
    const ring = found("lip ring", "accessory", [{ x: 336, y: 420, width: 6, height: 10 }], { on: "lips" });
    expect(catalogueRowOf(ring, [lips])).toBeNull();
  });

  it("STILL TWO — a garment is never a catalogue row, whatever its pixels touch", () => {
    const hairRect = { x: 100, y: 50, width: 300, height: 200 };
    const hair = catalogued("hair", "hair", "hair", [hairRect]);
    expect(catalogueRowOf(found("hood", "clothing", [hairRect]), [hair])).toBeNull();
    /* CONTROL: the same pixels under any other kind are the Hair row. */
    expect(catalogueRowOf(found("hood", "anatomy", [hairRect]), [hair])?.slot).toBe("hair");
  });

  it("at exactly half of the larger cut a body row is not yet the same place — MORE than half is the rule", () => {
    const lips = catalogued("lips", "face", "lips", [{ x: 300, y: 400, width: 20, height: 20 }]);
    expect(catalogueRowOf(found("mark", "marking", [{ x: 310, y: 400, width: 20, height: 20 }]), [lips])).toBeNull();
    expect(catalogueRowOf(found("mark", "marking", [{ x: 309, y: 400, width: 20, height: 20 }]), [lips])?.slot).toBe("lips");
  });

  it("names the catalogue row sharing the most pixels, whatever order the scan listed them in", () => {
    const left = catalogued("earring@left", "accessories", "earring", [{ x: 100, y: 100, width: 10, height: 10 }]);
    const right = catalogued("earring@right", "accessories", "earring", [{ x: 104, y: 100, width: 10, height: 10 }]);
    const piece = found("hoop", "accessory", [{ x: 105, y: 100, width: 6, height: 10 }]);
    expect(catalogueRowOf(piece, [left, right])?.slot).toBe("earring@right");
    expect(catalogueRowOf(piece, [right, left])?.slot).toBe("earring@right");
  });

  /* ---- which catalogue rows count, read off the scan ---- */

  it("compares only rows the panel DRAWS — Build and Skin draw none on this road, so a found thing on them keeps its row", () => {
    const at = { x: 100, y: 100, width: 50, height: 50, frame: { width: FRAME.width, height: FRAME.height } };
    const mask = lit([at]).mask;
    const cuts = catalogueCutsOf({
      boxes: new Map([["build", at], ["skin", at], ["nose", at]] as [never, typeof at][]),
      masks: new Map([["build", mask], ["skin", mask], ["nose", mask]] as [never, Mask][]),
    });
    expect(cuts.map((one) => [one.slot, one.question, one.group])).toEqual([["nose", "nose", "face"]]);
  });

  it("a slot that answered nothing is simply absent", () => {
    const at = { x: 100, y: 100, width: 50, height: 50 };
    expect(catalogueCutsOf({ boxes: new Map([["nose", at]] as [never, PointerBox][]), masks: new Map() })).toEqual([]);
  });

  /* ---- through the road itself ---- */

  it("through cutDiscovered: his ear piercing is never drawn, and is not recorded as a name nothing could cut", async () => {
    const reader = readerWith({ detects: { "ear piercing": [hoop] } });
    const filed: string[] = [];
    const out = await cutDiscovered({
      frame: FRAME,
      features: [feature("ear piercing", 1, { kind: "accessory", on: "ear" })],
      reader,
      catalogue: async () => [earring],
      onFiled: (one) => filed.push(one.noun),
    });
    expect(out.regions).toEqual([]);
    /* It IS drawn — as the Earrings row — so its words do not travel as though
       nothing could draw it. */
    expect(out.named).toEqual([]);
    /* And it never appears on the panel while the reading runs, so no row
       arrives and then vanishes. */
    expect(filed).toEqual([]);
  });

  it("CONTROL — the same road with no catalogue to compare draws it", async () => {
    const reader = readerWith({ detects: { "ear piercing": [hoop] } });
    const out = await cutDiscovered({
      frame: FRAME,
      features: [feature("ear piercing", 1, { kind: "accessory", on: "ear" })],
      reader,
    });
    expect(out.regions.map((one) => one.noun)).toEqual(["ear piercing"]);
  });

  /* ---- the star: a box from the product's word must be where that kind is worn ---- */

  const noseRect = { x: 330, y: 300, width: 70, height: 100 };
  const nose = catalogued("nose", "face", "nose", [noseRect]);
  /* The ring hangs from the septum, so its top lies in the nose's rectangle. */
  const ringRect = { x: 350, y: 395, width: 30, height: 20 };
  /* The star, on the cheek beside the nose — the detector's `stud` on his crop. */
  const starRect = { x: 250, y: 330, width: 15, height: 14 };

  it("the star — the product's word placed on the cheek is refused, and the name keeps its words", async () => {
    const reader = readerWith({ detects: { "nose stud": [starRect], "star tattoo": [starRect] } });
    const out = await cutDiscovered({
      frame: FRAME,
      features: [
        feature("septum ring", 1, { kind: "accessory", on: "nose", about: "a thin silver ring" }),
        feature("star tattoo", 1, { kind: "marking", on: "cheek" }),
      ],
      reader,
      catalogue: async () => [nose],
    });
    expect(reader.asked.pointer).toEqual(["septum ring", "star tattoo", "nose stud"]);
    /* The star is drawn ONCE, as itself. */
    expect(out.regions.map((one) => one.noun)).toEqual(["star tattoo"]);
    expect(out.named).toEqual([
      { noun: "septum ring", on: "nose", about: "a thin silver ring", kind: "accessory", why: "uncut" },
    ]);
  });

  it("CONTROL — the product's word placed on the ring, which touches the nose, is drawn", async () => {
    const reader = readerWith({ detects: { "nose stud": [ringRect] } });
    const out = await cutDiscovered({
      frame: FRAME,
      features: [feature("septum ring", 1, { kind: "accessory", on: "nose" })],
      reader,
      catalogue: async () => [nose],
    });
    expect(out.regions.map((one) => one.noun)).toEqual(["septum ring"]);
  });

  it("no catalogue, or a scan that failed: the product's word cannot be shown to agree, so it is refused", async () => {
    for (const catalogue of [undefined, async () => null, async () => { throw new Error("scan broke"); }]) {
      const reader = readerWith({ detects: { "nose stud": [ringRect] } });
      const out = await cutDiscovered({
        frame: FRAME,
        features: [feature("septum ring", 1, { kind: "accessory", on: "nose" })],
        reader,
        ...(catalogue === undefined ? {} : { catalogue }),
      });
      expect(out.regions).toEqual([]);
      expect(out.named.map((one) => `${one.noun}:${one.why}`)).toEqual(["septum ring:uncut"]);
    }
  });

  it("a nose the scan did not cut cannot be agreed with either", async () => {
    const reader = readerWith({ detects: { "nose stud": [ringRect] } });
    const out = await cutDiscovered({
      frame: FRAME,
      features: [feature("septum ring", 1, { kind: "accessory", on: "nose" })],
      reader,
      catalogue: async () => [catalogued("lips", "face", "lips", [{ x: 340, y: 430, width: 50, height: 20 }])],
    });
    expect(out.regions).toEqual([]);
  });

  /*
    ⚠ THE READING'S OWN WORD IS NOT SECOND-GUESSED BY THE TABLE, and this arm
    is the reason: the table's match is a substring one, so `lip stud` is an
    EARRING to it (`stud`). Checked against the ear, a real lip stud would lose
    its row. The site check is for the product's stand-in word alone.
  */
  it("CONTROL — a `lip stud` placed in its own word is never sent to the ear", async () => {
    const reader = readerWith({ detects: { "lip stud": [{ x: 340, y: 430, width: 8, height: 8 }] } });
    const out = await cutDiscovered({
      frame: FRAME,
      features: [feature("lip stud", 1, { kind: "accessory", on: "lips" })],
      reader,
      catalogue: async () => [nose],
    });
    expect(out.regions.map((one) => one.noun)).toEqual(["lip stud"]);
  });
});

describe("one ring, two names — the rectangle says what a thin cut's pixels cannot (#2789)", () => {
  const cut = (
    noun: string,
    kind: DiscoveredRegion["kind"],
    rects: PointerBox[],
    extra: { on?: string; instance?: number } = {},
  ): DiscoveredRegion => {
    const data = Buffer.alloc(FRAME.width * FRAME.height, 0);
    for (const rect of rects) {
      for (let y = rect.y; y < rect.y + rect.height; y += 1) {
        for (let x = rect.x; x < rect.x + rect.width; x += 1) data[y * FRAME.width + x] = 255;
      }
    }
    const left = Math.min(...rects.map((r) => r.x));
    const top = Math.min(...rects.map((r) => r.y));
    return {
      slot: discoveredSlotOf(noun, extra.instance ?? 1),
      noun,
      instance: extra.instance ?? 1,
      kind,
      on: extra.on ?? "",
      box: {
        x: left,
        y: top,
        width: Math.max(...rects.map((r) => r.x + r.width)) - left,
        height: Math.max(...rects.map((r) => r.y + r.height)) - top,
        frame: { width: FRAME.width, height: FRAME.height },
      },
      mask: { data, width: FRAME.width, height: FRAME.height },
    };
  };
  /* Two slivers of ONE ring, the measured shape on his crop: the ring's body
     cut once, its edge cut once — rectangles 17x12 and 20x11, almost no pixel
     in common. */
  const body = [{ x: 101, y: 100, width: 15, height: 10 }];
  const edge = [
    { x: 100, y: 110, width: 20, height: 1 },
    { x: 100, y: 101, width: 1, height: 10 },
    { x: 119, y: 101, width: 1, height: 10 },
  ];
  const nouns = (regions: readonly DiscoveredRegion[]) => regions.map((one) => one.noun);

  it("his nose ring and septum ring — two names on one ring under one host are ONE row", () => {
    const out = settleByPlace([
      cut("nose ring", "accessory", body, { on: "nose" }),
      cut("septum ring", "accessory", edge, { on: "nose" }),
    ]);
    expect(out.regions).toHaveLength(1);
    expect(out.samePlace).toHaveLength(1);
  });

  it("STILL TWO — two of ONE noun the reading counted keep their rows, however their rectangles fall (two straps in an X)", () => {
    const out = settleByPlace([
      cut("strap", "accessory", [{ x: 100, y: 100, width: 40, height: 4 }, { x: 100, y: 100, width: 4, height: 40 }], { on: "chest", instance: 1 }),
      cut("strap", "accessory", [{ x: 100, y: 136, width: 40, height: 4 }, { x: 136, y: 100, width: 4, height: 40 }], { on: "chest", instance: 2 }),
    ]);
    expect(out.regions.map((one) => one.instance)).toEqual([1, 2]);
  });

  it("STILL TWO — two worn things on DIFFERENT hosts are two, whatever their rectangles", () => {
    const out = settleByPlace([
      cut("nose ring", "accessory", body, { on: "nose" }),
      cut("lip ring", "accessory", edge, { on: "lips" }),
    ]);
    expect(nouns(out.regions)).toEqual(["nose ring", "lip ring"]);
  });

  it("STILL TWO — garments and marks are not read by the rectangle: a jacket over a shirt", () => {
    const jacket = [{ x: 100, y: 100, width: 20, height: 100 }, { x: 180, y: 100, width: 20, height: 100 }];
    const shirt = [{ x: 120, y: 100, width: 60, height: 100 }];
    expect(nouns(settleByPlace([cut("jacket", "clothing", jacket), cut("shirt", "clothing", shirt)]).regions))
      .toEqual(["jacket", "shirt"]);
    expect(nouns(settleByPlace([
      cut("scar", "marking", body, { on: "cheek" }),
      cut("mark", "marking", edge, { on: "cheek" }),
    ]).regions)).toEqual(["scar", "mark"]);
  });

  it("STILL TWO — a worn thing with no host the reading named is never joined by the rectangle", () => {
    const out = settleByPlace([cut("nose ring", "accessory", body), cut("septum ring", "accessory", edge)]);
    expect(out.regions).toHaveLength(2);
  });

  it("at exactly half of the larger rectangle it is not yet one ring — MORE than half is the rule", () => {
    /* Two 20x10 outlines: offset by 10 they share exactly half; by 9, more. */
    const ring = (x: number) => [
      { x, y: 100, width: 20, height: 1 },
      { x, y: 109, width: 20, height: 1 },
    ];
    const half = settleByPlace([
      cut("nose ring", "accessory", ring(100), { on: "nose" }),
      cut("septum ring", "accessory", ring(110), { on: "nose" }),
    ]);
    expect(half.regions).toHaveLength(2);
    /* The pixel rule alone would join neither offset; the arm is the rectangle's. */
    const over = settleByPlace([
      cut("nose ring", "accessory", [{ x: 100, y: 100, width: 20, height: 1 }, { x: 100, y: 109, width: 2, height: 1 }], { on: "nose" }),
      cut("septum ring", "accessory", [{ x: 109, y: 109, width: 20, height: 1 }, { x: 127, y: 100, width: 2, height: 1 }], { on: "nose" }),
    ]);
    expect(over.regions).toHaveLength(1);
  });

  /*
    ⚠ THE RING'S EDGE IS DRAWN TWO PIXELS THICK FOR THE END-TO-END ARM, AND THE
    REASON IS MEASURED (2026-10-29, #2565 slice 2).

    `edge` above is a ONE-pixel wireframe — 38 pixels inside a 20x10 rectangle,
    which is **19% fill**. That is fine for the `settleByPlace` arms, which read
    RECTANGLES and never pixels, and it was never meant to be a realistic mask:
    this block's own comment records that the measured things on his crop were
    the *rectangles* (17x12 and 20x11), and the pixel pattern is a stand-in.

    The end-to-end arm goes through `cutDiscovered`, which since this slice
    judges a cut against #2565 §4's quality bar — and a 19% fill sits under the
    20% floor, so the wireframe was refused and the second name fell through to
    `named` instead of joining the first's place. **The fixture's pixels were
    the unrealistic half, not the bar**: driven over the court's real masks
    (`scripts/_2565-cut-quality-cell-disposable.mts`), a REAL SAM cut of a thin
    wire hoop earring — the same shape class as a septum ring, a mostly-empty
    bounding box — fills **50.1%**, two and a half times the floor, while the
    known-bad strap sliver reads 8.2% and is refused. A segmenter does not
    return one-pixel wireframes.

    So this arm alone gets a ring whose wire is two pixels rather than one (72
    pixels, 36% fill). **`body` and `edge` are untouched**, so every
    `settleByPlace` arm in this block keeps the exact fixture his eye's round-4
    behaviour was verified on, and what this arm tests is unchanged: two nouns,
    one host, one row.
  */
  const edgeAsSegmented = [
    { x: 100, y: 109, width: 20, height: 2 },
    { x: 100, y: 101, width: 2, height: 10 },
    { x: 118, y: 101, width: 2, height: 10 },
  ];

  it("through cutDiscovered: the second name for the ring is never drawn while the reading runs", async () => {
    const reader = readerWith({
      detects: { "nose ring": [{ x: 101, y: 100, width: 15, height: 10 }], "septum ring": [{ x: 100, y: 101, width: 20, height: 10 }] },
      cuts: (_box, name) => {
        const data = Buffer.alloc(FRAME.width * FRAME.height, 0);
        for (const rect of name === "nose ring" ? body : edgeAsSegmented) {
          for (let y = rect.y; y < rect.y + rect.height; y += 1) {
            for (let x = rect.x; x < rect.x + rect.width; x += 1) data[y * FRAME.width + x] = 255;
          }
        }
        return { data, width: FRAME.width, height: FRAME.height };
      },
    });
    const filed: string[] = [];
    const out = await cutDiscovered({
      frame: FRAME,
      features: [
        feature("nose ring", 1, { kind: "accessory", on: "nose" }),
        feature("septum ring", 1, { kind: "accessory", on: "nose" }),
      ],
      reader,
      catalogue: async () => [],
      onFiled: (one) => filed.push(one.noun),
    });
    expect(out.regions).toHaveLength(1);
    expect(filed).toHaveLength(1);
    expect(out.named).toEqual([]);
  });
});

describe("a found thing is where the reading said it is (#2796, his eye round 5)", () => {
  /* A cut lit on every pixel of the given rectangles, with its own bounds. */
  const lit = (rects: PointerBox[]): { box: PointerBox; mask: Mask } => {
    const data = Buffer.alloc(FRAME.width * FRAME.height, 0);
    for (const rect of rects) {
      for (let y = rect.y; y < rect.y + rect.height; y += 1) {
        for (let x = rect.x; x < rect.x + rect.width; x += 1) data[y * FRAME.width + x] = 255;
      }
    }
    const left = Math.min(...rects.map((r) => r.x));
    const top = Math.min(...rects.map((r) => r.y));
    return {
      box: {
        x: left,
        y: top,
        width: Math.max(...rects.map((r) => r.x + r.width)) - left,
        height: Math.max(...rects.map((r) => r.y + r.height)) - top,
      },
      mask: { data, width: FRAME.width, height: FRAME.height },
    };
  };
  const catalogued = (slot: string, group: CatalogueCut["group"], question: string, rects: PointerBox[]): CatalogueCut => (
    { slot: slot as never, group, question, ...lit(rects) }
  );
  const at = (on: string, rects: PointerBox[]) => ({ box: lit(rects).box, on });
  const judge = (thing: { box: PointerBox; on: string }, cuts: readonly CatalogueCut[] | null) =>
    besideItsHost(thing, FRAME, cuts);

  /* His frame, in the shape measured on it (1024 wide): the nose's cut ends on
     the row the septum ring hangs from, the lips start 14 px below the ring,
     and the stud's ball sits on the lower lip's edge. */
  const noseRect = { x: 330, y: 200, width: 70, height: 100 };
  const lipsRect = { x: 320, y: 324, width: 90, height: 40 };
  const ringRect = { x: 350, y: 299, width: 30, height: 11 };
  const studRect = { x: 360, y: 360, width: 12, height: 12 };
  const nose = catalogued("nose", "face", "nose", [noseRect]);
  const lips = catalogued("lips", "face", "lips", [lipsRect]);
  const earLeft = catalogued("ear@left", "face", "ear", [{ x: 250, y: 220, width: 14, height: 40 }]);
  const earRight = catalogued("ear@right", "face", "ear", [{ x: 470, y: 220, width: 14, height: 40 }]);
  const scan = [nose, lips, earLeft, earRight];

  it("his ring — a `lip piercing` cut on the septum is nearer the nose, and is not the lip piercing", () => {
    const verdict = judge(at("lips", [ringRect]), scan);
    expect(verdict.at).toBe("elsewhere");
    expect(verdict.at === "elsewhere" ? verdict.nearest.slot : null).toBe("nose");
  });

  it("CONTROL — the stud on the lower lip is where the reading said", () => {
    expect(judge(at("lips", [studRect]), scan)).toEqual({ at: "host" });
  });

  it("a labret in the hollow of the chin touches nothing, and is still nearer the lips than any other place", () => {
    const labret = { x: 362, y: 376, width: 8, height: 8 };
    expect(lips.box.y + lips.box.height).toBeLessThan(labret.y);
    expect(judge(at("lip", [labret]), scan)).toEqual({ at: "host" });
  });

  it("⚠ round 4's warning — a `lip stud` is judged by the reading's `on`, never sent to the ear by its word", () => {
    expect(judge(at("lips", [studRect]), scan)).toEqual({ at: "host" });
    /* The negative control: the SAME cut said to be on an ear is refused. */
    expect(judge(at("ear", [studRect]), scan).at).toBe("elsewhere");
  });

  it("a pair is both of its sides — a piercing on either ear is on `ear`", () => {
    expect(judge(at("ear", [{ x: 474, y: 250, width: 6, height: 6 }]), scan)).toEqual({ at: "host" });
    expect(judge(at("ears", [{ x: 252, y: 250, width: 6, height: 6 }]), scan)).toEqual({ at: "host" });
  });

  it("judges nothing when the reading's `on` names no place the scan cut", () => {
    for (const on of ["neck", "cheek", "", "chain necklace"]) {
      expect(judge(at(on, [ringRect]), scan)).toEqual({ at: "unchecked" });
    }
    /* The lips were not cut on this scan, so there is nothing to be nearer to. */
    expect(judge(at("lips", [ringRect]), [nose])).toEqual({ at: "unchecked" });
    expect(judge(at("lips", [ringRect]), null)).toEqual({ at: "unchecked" });
  });

  it("a tie goes to the host — a cut touching both the nose and the lips is on the lips", () => {
    expect(judge(at("lips", [{ x: 360, y: 295, width: 10, height: 35 }]), scan)).toEqual({ at: "host" });
  });

  it("⚠ distance is to a place's PIXELS, never its rectangle — the hair's rectangle holds the whole face", () => {
    /* Hair down both sides of the face: its rectangle holds the mouth, its pixels do not. */
    const hair = catalogued("hair", "hair", "hair", [
      { x: 200, y: 100, width: 40, height: 400 },
      { x: 500, y: 100, width: 40, height: 400 },
    ]);
    /* The labret that touches nothing: by the hair RECTANGLE it would be 0 px
       from the hair and refused; by the hair PIXELS it is nearest the lips. */
    const labret = { x: 362, y: 376, width: 8, height: 8 };
    expect(judge(at("lips", [labret]), [...scan, hair])).toEqual({ at: "host" });
  });

  /* ---- through cutDiscovered: his frame's road, end to end ---- */

  /* The detector's answers on his frame: `lip piercing` boxed the ring, and
     `nose piercing` boxed the whole nose (its cut IS the Nose row). */
  const hisDetects = () => readerWith({
    detects: { "lip piercing": [ringRect], "nose piercing": [noseRect] },
  });
  const hisNames = [
    feature("nose piercing", 1, { kind: "accessory", on: "nose", about: "a septum ring" }),
    feature("lip piercing", 1, { kind: "accessory", on: "lips", about: "a stud below the lower lip" }),
  ];

  it("his panel — the ring is drawn ONCE, under the name the reading gave the nose, and never as the lip piercing", async () => {
    const filed: string[] = [];
    const out = await cutDiscovered({
      frame: FRAME,
      features: hisNames,
      reader: hisDetects(),
      catalogue: async () => scan,
      onFiled: (one) => filed.push(one.noun),
    });
    expect(out.regions.map((one) => one.noun)).toEqual(["nose piercing"]);
    expect(out.regions[0]!.box).toMatchObject(ringRect);
    expect(out.regions[0]!.on).toBe("nose");
    expect(filed).toEqual(["nose piercing"]);
    /* The lip piercing keeps its words, as a name nothing could draw. */
    expect(out.named).toEqual([
      { noun: "lip piercing", on: "lips", about: "a stud below the lower lip", kind: "accessory", why: "uncut" },
    ]);
  });

  it("CONTROL — with nobody on the nose to take it, the ring is dropped rather than drawn as the lip piercing", async () => {
    const out = await cutDiscovered({
      frame: FRAME,
      features: [hisNames[1]!],
      reader: hisDetects(),
      catalogue: async () => scan,
    });
    expect(out.regions).toEqual([]);
    expect(out.named.map((one) => `${one.noun}:${one.why}`)).toEqual(["lip piercing:uncut"]);
  });

  it("CONTROL — a `lip piercing` the detector placed on the stud is drawn as itself", async () => {
    const out = await cutDiscovered({
      frame: FRAME,
      features: hisNames,
      reader: readerWith({ detects: { "lip piercing": [studRect], "nose piercing": [noseRect] } }),
      catalogue: async () => scan,
    });
    expect(out.regions.map((one) => one.noun)).toEqual(["lip piercing"]);
  });

  it("the stray is never handed to a name that has a row of its own, or is another kind", async () => {
    const nostril = { x: 335, y: 280, width: 8, height: 8 };
    const out = await cutDiscovered({
      frame: FRAME,
      features: [
        feature("nose stud", 1, { kind: "accessory", on: "nose" }),
        feature("nose tattoo", 1, { kind: "marking", on: "nose" }),
        hisNames[1]!,
      ],
      reader: readerWith({ detects: { "nose stud": [nostril], "lip piercing": [ringRect] } }),
      catalogue: async () => scan,
    });
    expect(out.regions.map((one) => one.noun)).toEqual(["nose stud"]);
    expect(out.regions[0]!.box).toMatchObject(nostril);
  });

  it("a stray that is its new host's own pixels is that host, and is not drawn", async () => {
    const out = await cutDiscovered({
      frame: FRAME,
      features: hisNames,
      reader: readerWith({ detects: { "lip piercing": [noseRect], "nose piercing": [noseRect] } }),
      catalogue: async () => scan,
    });
    expect(out.regions).toEqual([]);
  });
});

describe("asked again on the place the reading named, when every cut was somewhere else (#2796)", () => {
  /* A REAL picture, because the second ask crops the frame's own bytes. */
  const picture = async () => ({
    ...FRAME,
    bytes: await sharp({ create: { width: FRAME.width, height: FRAME.height, channels: 3, background: "#c8a090" } }).png().toBuffer(),
  });
  const lit = (rect: PointerBox): Mask => maskAt(rect);
  const catalogued = (slot: string, question: string, rect: PointerBox): CatalogueCut => (
    { slot: slot as never, group: "face", question, box: rect, mask: lit(rect) }
  );
  const noseRect = { x: 330, y: 200, width: 70, height: 100 };
  const lipsRect = { x: 320, y: 324, width: 90, height: 40 };
  const ringRect = { x: 350, y: 299, width: 30, height: 11 };
  const studRect = { x: 361, y: 366, width: 10, height: 10 };
  const scan = [catalogued("nose", "nose", noseRect), catalogued("lips", "lips", lipsRect)];

  /*
    The detector as measured on his frame: on the WHOLE frame `lip piercing` is
    the ring alone; on a crop it offers the ring AND the stud, in crop pixels.
    A crop is told apart from the frame by its size, which is what the real
    detector sees too.
  */
  const hisDetector = () => {
    const asked: { name: string; crop: { width: number; height: number } | null }[] = [];
    const cutAt: PointerBox[] = [];
    let offset = { x: 0, y: 0 };
    const reader: RegionReader = {
      async region() { throw new Error("not this road"); },
      async subject() { throw new Error("not this road"); },
      async landmark() { throw new Error("not this road"); },
      async pointer({ image, name }) {
        const meta = await sharp(image).metadata().catch(() => null);
        const whole = meta === null || (meta.width === FRAME.width && meta.height === FRAME.height);
        asked.push({ name, crop: whole ? null : { width: meta!.width!, height: meta!.height! } });
        if (name === "nose piercing") return whole ? [noseRect] : [];
        if (name !== "lip piercing") return [];
        if (whole) return [ringRect];
        /* The crop is the lips grown by half on every side. */
        offset = { x: lipsRect.x - 45, y: lipsRect.y - 20 };
        const local = (box: PointerBox) => ({ ...box, x: box.x - offset.x, y: box.y - offset.y });
        return [local(ringRect), local(studRect)];
      },
      async regionInBox({ box }) {
        cutAt.push(box);
        return maskAt(box);
      },
    };
    return { reader, asked, cutAt };
  };
  const names = [
    feature("nose piercing", 1, { kind: "accessory", on: "nose", about: "a septum ring" }),
    feature("lip piercing", 1, { kind: "accessory", on: "lips", about: "a stud below the lower lip" }),
  ];

  it("his panel, whole — the ring under the nose's name, and the stud found on the lips as the lip piercing", async () => {
    const { reader, asked, cutAt } = hisDetector();
    const out = await cutDiscovered({ frame: await picture(), features: names, reader, catalogue: async () => scan });
    expect(out.regions.map((one) => `${one.noun}@${one.box.x},${one.box.y}`)).toEqual([
      `nose piercing@${ringRect.x},${ringRect.y}`,
      `lip piercing@${studRect.x},${studRect.y}`,
    ]);
    expect(out.named).toEqual([]);
    /* Asked once more, on a crop, in the reading's own word. */
    expect(asked.filter((one) => one.name === "lip piercing").map((one) => one.crop)).toEqual([
      null,
      { width: 180, height: 80 },
    ]);
    /* ⚠ The ring's box from the crop is known to be on the nose, so no
       segmenter call is bought for it: one cut for the ring (the first ask),
       one for the nose piercing's whole nose, one for the stud. */
    expect(cutAt).toHaveLength(3);
    for (const box of [noseRect, ringRect, studRect]) expect(cutAt).toContainEqual(box);
  });

  it("CONTROL — a name whose cut was on its host is never asked again", async () => {
    const { reader, asked } = hisDetector();
    await cutDiscovered({
      frame: await picture(),
      features: [names[0]!],
      reader,
      catalogue: async () => scan,
    });
    expect(asked.map((one) => one.name)).toEqual(["nose piercing"]);
  });

  it("CONTROL — a name the detector declined outright is not asked again by this road", async () => {
    const { reader, asked } = hisDetector();
    await cutDiscovered({
      frame: await picture(),
      features: [feature("lip ring", 1, { kind: "accessory", on: "lips" })],
      reader,
      catalogue: async () => scan,
    });
    expect(asked.map((one) => one.name)).toEqual(["lip ring"]);
  });
});

describe("the same check on the class's siblings (#2796, law 7)", () => {
  const cut = (slot: string, question: string, rect: PointerBox): CatalogueCut => (
    { slot: slot as never, group: "face", question, box: rect, mask: maskAt(rect) }
  );
  const brow = cut("brow@left", "eyebrows", { x: 300, y: 150, width: 60, height: 12 });
  const eye = cut("eye@left", "eyes", { x: 305, y: 180, width: 50, height: 20 });
  const nose = cut("nose", "nose", { x: 360, y: 190, width: 50, height: 90 });

  it("an eyebrow bar cut on the eye is nearer the eye, and is not the eyebrow bar", () => {
    const verdict = besideItsHost({ box: { x: 320, y: 183, width: 10, height: 10 }, on: "eyebrow" }, FRAME, [brow, eye, nose]);
    expect(verdict.at === "elsewhere" ? verdict.nearest.slot : verdict.at).toBe("eye@left");
  });

  it("CONTROL — an eyebrow bar cut through the brow is on the brow", () => {
    expect(besideItsHost({ box: { x: 340, y: 146, width: 6, height: 20 }, on: "eyebrows" }, FRAME, [brow, eye, nose]))
      .toEqual({ at: "host" });
  });

  it("a nose stud the reading placed on the nose and the detector put on a cheek mark beside the eye is refused", () => {
    const star = { x: 250, y: 205, width: 14, height: 14 };
    const verdict = besideItsHost({ box: star, on: "nose" }, FRAME, [brow, eye, nose]);
    expect(verdict.at === "elsewhere" ? verdict.nearest.slot : verdict.at).toBe("eye@left");
  });
});
