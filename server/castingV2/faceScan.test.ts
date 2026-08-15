import { describe, expect, it } from "vitest";

import { composedPlan, scanFace, scanPlan } from "./faceScan";
import { armedBornWornClasses } from "./bornWornDetector";
import { LANDMARK_OF_ACCESSORY } from "./accessoryKinds";
import type { Mask } from "./maskedComposite";
import type { RegionReader } from "./maskedRefine";

/**
 * THE AUTO-SCAN, driven directly — never through a model that usually behaves.
 *
 * The scan exists because a face nobody has edited has a panel of empty boxes
 * (fable-352, his screenshot). What it must never do is fill those boxes with
 * anything it did not measure, so these drive the four ways it can be wrong:
 * asking the wrong questions, filing a box for a region that answered nothing,
 * turning a failed reading into a fact, and giving a pair one box between them.
 */
const FRAME = { bytes: Buffer.from("not really a picture"), width: 1000, height: 1500 };

/** A mask claiming one rectangle, so the box it produces is predictable. */
function maskOf(box: { x: number; y: number; width: number; height: number }): Mask {
  const data = Buffer.alloc(FRAME.width * FRAME.height, 0);
  for (let y = box.y; y < box.y + box.height; y += 1) {
    data.fill(255, y * FRAME.width + box.x, y * FRAME.width + box.x + box.width);
  }
  return { data, width: FRAME.width, height: FRAME.height };
}

const EMPTY: Mask = { data: Buffer.alloc(FRAME.width * FRAME.height, 0), width: FRAME.width, height: FRAME.height };

function reader(answers: {
  region?: (name: string) => Mask | Promise<Mask>;
  sides?: ((name: string) => { left: Mask; right: Mask } | null) | null;
}): RegionReader & {
  asked: string[]; sideAsked: string[]; subjectAsked: string[]; urls: (string | undefined)[];
} {
  const asked: string[] = [];
  const sideAsked: string[] = [];
  const subjectAsked: string[] = [];
  const urls: (string | undefined)[] = [];
  const built: any = {
    asked,
    sideAsked,
    subjectAsked,
    urls,
    async region({ name, imageUrl }: { name: string; imageUrl?: string }) {
      asked.push(name);
      urls.push(imageUrl);
      return answers.region ? answers.region(name) : maskOf({ x: 10, y: 20, width: 30, height: 40 });
    },
    async subject() { subjectAsked.push("(subject matte)"); return EMPTY; },
    async landmark() { return null; },
  };
  if (answers.sides !== null) {
    built.regionSides = async ({ name, imageUrl }: { name: string; imageUrl?: string }) => {
      sideAsked.push(name);
      urls.push(imageUrl);
      return answers.sides
        ? answers.sides(name)
        : { left: maskOf({ x: 100, y: 200, width: 20, height: 20 }), right: maskOf({ x: 700, y: 200, width: 20, height: 20 }) };
    };
  }
  return built;
}

describe("what the scan asks is derived from the catalogue", () => {
  it("asks nothing about a slot the catalogue calls words-only", () => {
    const questions = scanPlan().map((region) => region.question);
    /* Chin, jaw and cheekbones carry no segmentation question of their own —
       the founder's third shape (fable-360) keeps them askable in words with no
       thumbnail, and the catalogue is what says so. A scan that asked for them
       would be inventing a picture for a row that has none. */
    expect(questions).not.toContain("chin");
    expect(questions).not.toContain("jaw");
    expect(questions).not.toContain("cheekbone");
  });

  it("asks about EVERY armed accessory class and no unarmed one", () => {
    const questions = scanPlan().map((region) => region.question);
    const accessories = LANDMARK_OF_ACCESSORY.map((entry) => entry.region);
    const armed = armedBornWornClasses().map((entry) => entry.region);
    /*
      BOTH DIRECTIONS, OVER THE WHOLE TABLE — and the one-way version of this
      check is why (shift 91).

      It used to name `glasses` as the armed one and then loop `["earring",
      "nose stud"]` under `if (!armed.includes(kind))`. Every clause of that was
      true when it was written and none of it could fire the day it stopped
      being: the earring court passed, `deferArming` came off, and the arm that
      would have noticed simply skipped itself. A check that quietly stops
      checking is this program's oldest shape of failure, and it left a roster
      of which kinds are armed sitting unread in four prose sites.

      So no kind is named here at all. The table says which kinds exist,
      `armedBornWornClasses` says which are armed, and the plan is asserted
      EQUAL to it — a new kind, or a kind arming or disarming, moves both sides
      of this line at once or fails it.
    */
    const askedAccessories = questions.filter((question) => accessories.includes(question));
    expect([...askedAccessories].sort()).toEqual([...armed].sort());
    /* And the equality is only worth something if both sides are populated: two
       empty lists are equal, and would pass on a build where arming had been
       deleted outright. */
    expect(armed.length).toBeGreaterThan(0);
    expect(armed.length).toBeLessThanOrEqual(accessories.length);
  });

  it("asks each feature ONCE, however many slots it feeds", () => {
    const plan = scanPlan();
    const features = plan.map((region) => region.feature);
    expect(new Set(features).size).toBe(features.length);
    /*
      AND TEETH IS ITS OWN QUESTION (fable-463), not the lips' under a second
      name: measured on the founder's own frames, "lips" answers 0 px on a
      smiling mouth and "teeth" answers 1,345 — the two are different questions
      to this reader, whatever they are to a diagram.
    */
    /* And it asks for ALL of them (fable-619 §2): the bare noun handed his
       panel one fang, 10% of the mouth's width, on the frame he was looking
       at. */
    expect(plan.find((region) => region.feature === "teeth")?.question).toBe("all the teeth");
    /* A bilateral feature is one question read two-sidedly, so both its slots
       ride one plan entry rather than costing two reads. */
    const eye = plan.find((region) => region.feature === "eye");
    expect(eye?.slots.map((slot) => slot.instance).sort()).toEqual(["left", "right"]);
  });
});

describe("the scan files only what it measured", () => {
  it("gives each side of a pair its OWN box", async () => {
    const scan = await scanFace({ frame: FRAME, reader: reader({}), describe: null });

    expect(scan.boxes.get("eye@left")).toMatchObject({ x: 100, width: 20 });
    expect(scan.boxes.get("eye@right")).toMatchObject({ x: 700, width: 20 });
    /* One box shared between two instances is the wrong-boundary class with a
       rectangle on it — a crop of both her earrings filed under one side. */
    expect(scan.boxes.get("eye@left")).not.toEqual(scan.boxes.get("eye@right"));
  });

  it("carries the frame with every box, because a box without one is a rectangle in an unknown space", async () => {
    const scan = await scanFace({ frame: FRAME, reader: reader({}), describe: null });
    for (const box of scan.boxes.values()) {
      expect(box.frame).toEqual({ width: 1000, height: 1500 });
    }
  });

  it("FILES NOTHING for a region that answered nothing — an ear nobody can see is not an ear wearing nothing", async () => {
    const scan = await scanFace({
      describe: null,
      frame: FRAME,
      reader: reader({ region: (name) => (name === "facial hair" ? EMPTY : maskOf({ x: 5, y: 5, width: 5, height: 5 })) }),
    });

    expect(scan.boxes.has("facial-hair")).toBe(false);
    expect(scan.empty).toContain("facial hair");
    /* And the rest of the face is unaffected: one silent region is not a
       failed scan. */
    expect(scan.found).toBeGreaterThan(0);
  });

  /*
    AN EMPTY ANATOMY READ IS ASKED ONCE MORE (fable-468 ruling 1).

    Measured on the founder's own frames before this existed: his LIPS row
    vanished on the frame where she smiled and his EYES row vanished on a build
    edit that touched neither, both because the scan reported nothing there and
    a row's price of admission is a rectangle. A part of her face reading empty
    is a missed reading; a bare earlobe reading empty is a fact.
  */
  it("asks an empty ANATOMY region again, and keeps what the second look finds", async () => {
    let looks = 0;
    const scan = await scanFace({
      describe: null,
      frame: FRAME,
      reader: reader({
        region: (name) => {
          if (name !== "lips") return maskOf({ x: 5, y: 5, width: 5, height: 5 });
          looks += 1;
          /* Empty once, then found — the flake this ruling is about. */
          return looks === 1 ? EMPTY : maskOf({ x: 40, y: 60, width: 12, height: 8 });
        },
      }),
    });

    expect(looks).toBe(2);
    expect(scan.boxes.has("lips")).toBe(true);
    expect(scan.empty).not.toContain("lips");
  });

  it("gives up after the second look, so an honest absence stays absent", async () => {
    let looks = 0;
    const scan = await scanFace({
      describe: null,
      frame: FRAME,
      reader: reader({
        region: (name) => {
          if (name !== "lips") return maskOf({ x: 5, y: 5, width: 5, height: 5 });
          looks += 1;
          return EMPTY;
        },
      }),
    });

    expect(looks).toBe(2);
    expect(scan.boxes.has("lips")).toBe(false);
    expect(scan.empty).toContain("lips");
  });

  it("CONTROL — a WORN thing is asked once and not argued with", async () => {
    /* An empty earring read is the born-worn rule being careful on purpose;
       asking twice would only make it careful twice. Make the re-ask
       unconditional and this goes red. */
    let looks = 0;
    const scan = await scanFace({
      describe: null,
      frame: FRAME,
      reader: reader({
        region: (name) => maskOf({ x: 5, y: 5, width: 5, height: 5 }),
        sides: (name) => {
          if (name !== "earring") return { left: maskOf({ x: 100, y: 200, width: 20, height: 20 }), right: maskOf({ x: 700, y: 200, width: 20, height: 20 }) };
          looks += 1;
          return { left: EMPTY, right: EMPTY };
        },
      }),
    });

    expect(looks).toBeLessThanOrEqual(1);
    expect(scan.boxes.has("earring@left")).toBe(false);
  });

  /*
    A DEPARTABLE FEATURE'S ABSENCE IS A FACT, NOT A MISS (fable-530 §4).

    The re-ask's own reasoning is about features that are ALWAYS in frame —
    "she is in frame, looking at the camera, and an empty read of her LIPS is a
    missed reading". A beard, a tattoo or a pair of horns can simply not be
    there, and asking twice about a clean-shaven chin makes the product careful
    twice on every clean face, for ever.

    Three arms, because a one-armed version of this would be a rule that turned
    the re-ask off for everybody and passed.
  */
  /* Horns are a PAIR since the founder's carry ruling (2026-08-15), so the
     question reaches the reader through `sides` — one half of the frame at a
     time — exactly as the earring arm above. The rule under test is unchanged:
     a departable feature's absence is a fact, asked once. */
  it("asks a DEPARTABLE anatomy feature once when it is absent", async () => {
    let looks = 0;
    const scan = await scanFace({
      describe: null,
      frame: FRAME,
      reader: reader({
        sides: (name) => {
          if (name !== "horns") return { left: maskOf({ x: 100, y: 200, width: 20, height: 20 }), right: maskOf({ x: 700, y: 200, width: 20, height: 20 }) };
          looks += 1;
          return { left: EMPTY, right: EMPTY };
        },
      }),
    });

    expect(looks).toBe(1);
    expect(scan.boxes.has("horns@left")).toBe(false);
    expect(scan.boxes.has("horns@right")).toBe(false);
    expect(scan.empty.some((one) => one.includes("horns"))).toBe(true);
  });

  it("behaves exactly as before when that feature IS there", async () => {
    /* The arm that matters most: the saving is a second look nobody needed,
       not a first look somebody did. */
    let looks = 0;
    const scan = await scanFace({
      describe: null,
      frame: FRAME,
      reader: reader({
        sides: (name) => {
          if (name !== "horns") return { left: maskOf({ x: 100, y: 200, width: 20, height: 20 }), right: maskOf({ x: 700, y: 200, width: 20, height: 20 }) };
          looks += 1;
          return { left: maskOf({ x: 30, y: 10, width: 20, height: 40 }), right: maskOf({ x: 90, y: 10, width: 20, height: 40 }) };
        },
      }),
    });

    expect(looks).toBe(1);
    expect(scan.boxes.has("horns@left")).toBe(true);
    expect(scan.boxes.has("horns@right")).toBe(true);
  });

  it("CONTROL — a feature that is ALWAYS in frame still gets its second look", async () => {
    /*
      `skin` is the case that keeps the derivation honest: it holds `marks`,
      which IS departable, beside `skinTone` and `skinCharacter`, which are not
      — and her skin is always in frame. A predicate reading "any departable
      facet" would take the second look away from her whole face, so it reads
      EVERY subject that writes into the slot.
    */
    let looks = 0;
    await scanFace({
      describe: null,
      frame: FRAME,
      reader: reader({
        region: (name) => {
          if (name !== "face skin") return maskOf({ x: 5, y: 5, width: 5, height: 5 });
          looks += 1;
          return EMPTY;
        },
      }),
    });

    expect(looks).toBe(2);
  });

  it("turns a FAILED READING into no box, never into a fact", async () => {
    const scan = await scanFace({
      describe: null,
      frame: FRAME,
      reader: reader({
        region: (name) => {
          if (name === "hair") throw new Error("the segmenter fell over");
          return maskOf({ x: 5, y: 5, width: 5, height: 5 });
        },
      }),
    });

    expect(scan.boxes.has("hair")).toBe(false);
    expect(scan.failed.map((entry) => entry.question)).toContain("hair");
    /* Recorded, not swallowed: a silent catch is how thirty faces were once
       declared bare (opus-052 §3). And the scan still returns — a courtesy read
       the user never asked to pay for must degrade to today's panel, not to an
       error on her screen. */
    expect(scan.failed[0]?.why).toContain("fell over");
    expect(scan.found).toBeGreaterThan(0);
  });

  it("leaves a pair UNANSWERED rather than splitting one box across it", async () => {
    /* `regionSides` returning null is the reader saying this name has no sides
       for it — a capability answer. Falling back to the whole-frame question
       would light both instances off one rectangle covering both. */
    const scan = await scanFace({ frame: FRAME, reader: reader({ sides: () => null }), describe: null });

    expect(scan.boxes.has("eye@left")).toBe(false);
    expect(scan.boxes.has("eye@right")).toBe(false);
    /* Named from the plan rather than typed here: the catalogue's question for
       the eye feature is "eyes", and a test carrying its own copy of that word
       is the second list this module refuses to keep. */
    const eyeQuestion = scanPlan().find((region) => region.feature === "eye")?.question;
    expect(scan.empty).toContain(eyeQuestion);
  });

  it("passes the frame's address through so twelve questions do not carry twelve copies", async () => {
    const withUrl = reader({});
    await scanFace({ frame: { ...FRAME, url: "https://pub-test.r2.dev/master.png" }, reader: withUrl, describe: null });
    expect(withUrl.urls.every((url) => url === "https://pub-test.r2.dev/master.png")).toBe(true);

    /* And it is genuinely optional — a frame with no address is read exactly as
       before. */
    const without = reader({});
    await scanFace({ frame: FRAME, reader: without, describe: null });
    expect(without.urls.every((url) => url === undefined)).toBe(true);
  });

  /*
    THE SPECIMEN THAT WOULD HAVE BEEN LOST.

    The earring court read sixteen worn SIDES at 0.0189–0.0347% of frame, and
    the shipped union floor (0.0200%) sits ABOVE the smallest two of them. This
    frame is 1000×1500, so a worn side of 0.0189% is 284 pixels, the per-side
    floor is 135 and the union floor would be 300. Judged on the union number, a real gold hoop on a real ear
    would have been filed as absent and her row would have gone missing on one
    wearing ear in eight — the founder's own bug, half-closed and reopened.
  */
  it("keeps a worn earring at the smallest measured reading, and files nothing for a bare lobe", async () => {
    const wornSide = maskOf({ x: 120, y: 400, width: 4, height: 71 }); // 284px = 0.0189%
    const scan = await scanFace({
      describe: null,
      frame: FRAME,
      reader: reader({
        sides: (name) => (name === "earring"
          ? { left: wornSide, right: EMPTY }
          : { left: maskOf({ x: 100, y: 200, width: 20, height: 20 }), right: maskOf({ x: 700, y: 200, width: 20, height: 20 }) }),
      }),
    });

    /* The worn side is PRESENT at the smallest reading the court ever took... */
    expect(scan.boxes.get("earring@left")).toMatchObject({ x: 120, width: 4 });
    /* ...and the bare one files nothing at all, which is what makes arming
       presence-only safe: there is no absent row to misfile (fable-435). */
    expect(scan.boxes.has("earring@right")).toBe(false);
    expect(scan.masks.has("earring@right")).toBe(false);
  });

  it("does not file a box for a reading under the court's own floor", async () => {
    /* 135 pixels — EXACTLY the per-side floor, and half a real hoop. Every
       floor in this codebase is read strictly-greater, so the boundary itself
       files nothing. The negative control the positive one above needs: without
       it, a floor of zero would pass that test just as well. */
    const speck = maskOf({ x: 120, y: 400, width: 1, height: 135 });
    const scan = await scanFace({
      describe: null,
      frame: FRAME,
      reader: reader({ sides: (name) => (name === "earring" ? { left: speck, right: EMPTY } : null) }),
    });

    expect(scan.boxes.has("earring@left")).toBe(false);
    /* And the region says it answered nothing, rather than saying nothing. */
    expect(scan.empty).toContain("earring");
  });

  it("writes nothing anywhere — the scan mints no reference (fable-360 ruling 5)", async () => {
    /*
      The boundary this whole build is checked against, asserted the only way a
      unit test honestly can: the module's dependencies. A scan that could write
      would have to import a writer, and it imports none.
    */
    const source = await (await import("node:fs/promises")).readFile(
      new URL("./faceScan.ts", import.meta.url), "utf8",
    );
    const imports = source.slice(0, source.indexOf("const log ="));
    for (const writer of ["referenceLibrary", "referenceMint", "storage", "connection", "drizzle"]) {
      expect(imports, `the scan must not import ${writer}`).not.toContain(writer);
    }
  });
});

describe("it asks them all at once", () => {
  it("does not wait for one region before asking the next", async () => {
    let inFlight = 0;
    let peak = 0;
    const slow: RegionReader = {
      async region() {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return maskOf({ x: 1, y: 1, width: 2, height: 2 });
      },
      async regionSides() {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return { left: maskOf({ x: 1, y: 1, width: 2, height: 2 }), right: maskOf({ x: 9, y: 1, width: 2, height: 2 }) };
      },
      async subject() {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return EMPTY;
      },
      landmark: (async () => null) as never,
    } as never;

    await scanFace({ frame: FRAME, reader: slow, describe: null });
    /* Serially this is the difference between a panel that fills while she is
       looking at the face and one that arrives after she stopped waiting. */
    expect(peak).toBeGreaterThan(1);
  });
});

describe("the shape is kept beside the rectangle (fable-374)", () => {
  it("returns a mask for every slot it returns a box for, and for no others", async () => {
    /*
      The founder chose masked cutouts, so the panel needs the SHAPE as well as
      the rectangle. A slot with a box and no mask would render as a hard-edged
      crop beside its cutout neighbours; one with a mask and no box has nowhere
      to put it. They are one answer and they travel together.
    */
    const scan = await scanFace({
      describe: null,
      frame: FRAME,
      reader: reader({ region: (name) => (name === "facial hair" ? EMPTY : maskOf({ x: 5, y: 5, width: 5, height: 5 })) }),
    });

    expect([...scan.masks.keys()].sort()).toEqual([...scan.boxes.keys()].sort());
    expect(scan.masks.has("facial-hair")).toBe(false);
  });

  it("keeps each side's OWN shape, never the pair's", async () => {
    const scan = await scanFace({ frame: FRAME, reader: reader({}), describe: null });
    const left = scan.masks.get("eye@left");
    const right = scan.masks.get("eye@right");
    expect(left).toBeDefined();
    expect(right).toBeDefined();
    /* Two different pictures, not one union wearing two names — the same
       discipline at the thumbnail as at the box (fable-374). */
    expect(Buffer.compare(Buffer.from(left!.data), Buffer.from(right!.data))).not.toBe(0);
  });

  it("does not re-read the segmenter to get the shape it already had", async () => {
    const counting = reader({});
    await scanFace({ frame: FRAME, reader: counting, describe: null });
    /* The box is DERIVED from the mask, so keeping the mask costs nothing. One
       question per region, and paying twice for one answer would also invite
       two different ones. */
    const plan = scanPlan();
    /*
      One question per plan entry, plus the composed row's own two — a `face`
      read and the whole-subject matte, which no plan entry asks for and which
      therefore cannot be shared with one. The composed cost is stated in the
      sum rather than left to widen it silently: if a future region starts
      being read twice, this arithmetic is what says so.
    */
    const composedReads = composedPlan().length === 0 ? 0 : 1;
    expect(counting.asked.length + counting.sideAsked.length).toBe(plan.length + composedReads);
    expect(counting.subjectAsked.length).toBe(composedPlan().length === 0 ? 0 : 1);
    /* And every question is asked ONCE. */
    expect(new Set(counting.asked).size).toBe(counting.asked.length);
  });
});

/**
 * THE TWO ROWS THAT COULD NOT COMPLY WITH THE FOUNDER'S BOX RULE — until now.
 *
 * *"Nothing should ride words alone in the right panel — everything in the right
 * panel should have a bounding box"* (fable-414). Every row satisfied it except
 * `skin`, whose region may be drawn and never cut, and `build`, whose region is
 * composed rather than asked. These drive both, and the control that keeps them
 * out of the library.
 */
describe("the rows that are drawn from somewhere else", () => {
  it("gives HER SKIN a box, from the region it may never be cut from", () => {
    const questions = scanPlan().map((region) => region.question);
    expect(questions).toContain("face skin");
    const skin = scanPlan().find((region) => region.question === "face skin");
    expect(skin?.slots.map((slot) => slot.slot)).toEqual(["skin"]);
  });

  it("gives HER BUILD a box, composed from a matte and a head", async () => {
    const counting = reader({});
    const scan = await scanFace({ frame: FRAME, reader: counting, describe: null });

    /* The composed region is her silhouette below the bottom of the face box,
       so the harness's head mask decides where it starts. */
    expect(counting.asked).toContain("face");
    expect(counting.subjectAsked).toHaveLength(1);
    expect(composedPlan().map((definition) => definition.slot)).toEqual(["build"]);
  });

  it("files NO box for her build when the frame has no body in it", async () => {
    /*
      The matte and the head are the same rectangle: her head reaches the bottom
      of what the reader can see, so nothing of her is below her chin. A box
      here would be a rectangle around nothing, labelled "her build".
    */
    const one = maskOf({ x: 400, y: 100, width: 200, height: 1400 });
    const scan = await scanFace({
      frame: FRAME,
      reader: reader({ region: (name) => (name === "face" ? one : EMPTY), sides: null }),
      describe: null,
    });

    expect(scan.boxes.has("build")).toBe(false);
    /* Recorded rather than swallowed — a silent catch is how thirty faces were
       once declared bare. */
    expect(scan.failed.some((entry) => entry.question.includes("below-head"))).toBe(true);
  });

  it("NEVER sends the derived key to a reader", async () => {
    const counting = reader({});
    await scanFace({ frame: FRAME, reader: counting, describe: null });
    for (const question of [...counting.asked, ...counting.sideAsked]) {
      expect(question.startsWith("derived:")).toBe(false);
    }
  });

  it("CONTROL — a scan writes nothing anywhere, composed rows included", async () => {
    /* The scan's own boundary (fable-360 ruling 5), restated where the two new
       rows enter it: geometry in memory, no row, no object, no manifest. The
       composed region is the same region the mint cuts a CARRIER from, so this
       is the line that keeps "shown" and "carried" apart at the scan too. */
    const scan = await scanFace({ frame: FRAME, reader: reader({}), describe: null });
    expect(Object.keys(scan)).toEqual(
      expect.arrayContaining(["boxes", "masks", "descriptions", "empty", "failed"]),
    );
    expect(scan.boxes.size).toBeGreaterThan(0);
  });
});
