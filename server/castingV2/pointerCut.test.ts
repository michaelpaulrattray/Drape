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
  hostedNames,
  normalisedName,
  offListFeatures,
  placeNames,
  pointerFeatures,
  productWordFor,
  settleByPlace,
  wordsOnlyFeatures,
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

  it("asks once more in the accessory table's word, and the row keeps the reading's noun", async () => {
    const reader = readerWith({ detects: { "nose stud": [ring] } });
    const out = await cutDiscovered({
      frame: FRAME,
      features: [feature("septum ring", 1, { kind: "accessory", on: "nose" })],
      reader,
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
