/**
 * A PAIR EMPTY ON BOTH SIDES IS ASKED A DIFFERENT QUESTION (#2817, the law-7
 * sibling of #2802).
 *
 * #2802 gave the blind side of a HALF-answered pair its own half-picture. A
 * pair empty on BOTH sides never reaches that heal — it takes the empty-anatomy
 * re-ask (fable-468 ruling 1), and on production's pair road that re-ask is the
 * identical whole-picture request, so it comes back with the identical nothing
 * and the panel loses the whole row.
 *
 * Measured through the product's own reader on the founder's round-6 cast,
 * `ear` at 1024 and at 598, three draws a size: the pair road answered 0 and 0
 * on 6 of 6 and the re-ask answered 0 and 0 on 6 of 6, while the same frame
 * asked a half at a time found BOTH ears on 6 of 6. On a hooded cast with no
 * ear in frame, and on five browless faces — three of them the exact frames
 * `DEPARTURE_GATE_SUBSTITUTION_2026-08-30.md` §7 recorded the whole-frame ask
 * inventing brows on — the crop road answered nothing on either side.
 *
 * These arms drive the scan's CHOICE of question, and every "found" arm has a
 * sibling that must not find. The reader's own half-picture read is #2802's
 * suite and is not re-driven here.
 */
import { describe, expect, it } from "vitest";

import { scanFace } from "./faceScan";
import type { Mask } from "./maskedComposite";
import type { RegionReader, SideRegions } from "./maskedRefine";

const W = 200;
const H = 120;

function maskWith(rects: { x: number; y: number; width: number; height: number }[]): Mask {
  const data = Buffer.alloc(W * H, 0);
  for (const rect of rects) {
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) data[y * W + x] = 255;
    }
  }
  return { data, width: W, height: H };
}

const NOTHING = maskWith([]);
const IMAGE_LEFT_EAR = { x: 20, y: 50, width: 8, height: 16 };
const IMAGE_RIGHT_EAR = { x: 150, y: 48, width: 8, height: 16 };
const HER_RIGHT = maskWith([IMAGE_LEFT_EAR]);
const HER_LEFT = maskWith([IMAGE_RIGHT_EAR]);

const FRAME = { bytes: Buffer.from("not a picture"), width: W, height: H };

/** Every pair answers on both sides unless an arm says otherwise, so a call
 *  count is about the ONE question under test and not about the whole face. */
const ANSWERED: SideRegions = { left: HER_LEFT, right: HER_RIGHT };

type Half = (input: { name: string; side: "left" | "right"; onTheEars?: true }) => Promise<Mask | null>;

function readerWith(over: {
  /** The questions whose pair reading comes back empty on BOTH sides. */
  bothEmpty?: string[];
  /** The questions whose pair reading answers on one side only. */
  halfAnswered?: string[];
  half?: Half;
  /** Left out entirely, so the old road is the only one available. */
  noHalfRead?: true;
} = {}): { reader: RegionReader; order: string[]; ears: (true | undefined)[] } {
  const order: string[] = [];
  const ears: (true | undefined)[] = [];
  const reader = {
    async region(input: { name: string }) {
      order.push(`region ${input.name}`);
      return maskWith([{ x: 10, y: 10, width: 5, height: 5 }]);
    },
    async subject() { return NOTHING; },
    async landmark() { return []; },
    async regionSides(input: { name: string }): Promise<SideRegions> {
      order.push(`regionSides ${input.name}`);
      if (over.bothEmpty?.includes(input.name)) return { left: NOTHING, right: NOTHING };
      if (over.halfAnswered?.includes(input.name)) return { left: NOTHING, right: HER_RIGHT };
      return ANSWERED;
    },
    ...(over.noHalfRead ? {} : {
      async sideByCrop(input: { name: string; side: "left" | "right"; onTheEars?: true }) {
        order.push(`sideByCrop ${input.name} ${input.side}`);
        if (input.name === "earring") ears.push(input.onTheEars);
        return over.half ? over.half(input) : null;
      },
    }),
  } as unknown as RegionReader;
  return { reader, order, ears };
}

/** What was asked about the ears alone — `earring` shares the substring. */
const aboutTheEar = (order: string[]) => order.filter((one) => / ear$| ear /.test(one));

describe("a pair empty on both sides is asked for each half's own picture", () => {
  it("THE WHOLE OF THE CARD — both halves are asked, and the whole region is NOT asked again", async () => {
    const { reader, order } = readerWith({ bothEmpty: ["ear"], half: async () => HER_LEFT });
    await scanFace({ frame: FRAME, reader, describe: null });
    expect(aboutTheEar(order)).toEqual([
      "regionSides ear",
      "sideByCrop ear left",
      "sideByCrop ear right",
    ]);
  });

  it("both recovered sides are filed, so the row the panel lost comes back whole", async () => {
    const { reader } = readerWith({
      bothEmpty: ["ear"],
      half: async (input) => (input.side === "left" ? HER_LEFT : HER_RIGHT),
    });
    const scan = await scanFace({ frame: FRAME, reader, describe: null });
    expect(scan.boxes.get("ear@left")).toMatchObject(IMAGE_RIGHT_EAR);
    expect(scan.boxes.get("ear@right")).toMatchObject(IMAGE_LEFT_EAR);
  });

  it("one side recovered is filed and the other stays empty — no third look is spent", async () => {
    const { reader, order } = readerWith({
      bothEmpty: ["ear"],
      half: async (input) => (input.side === "left" ? HER_LEFT : null),
    });
    const scan = await scanFace({ frame: FRAME, reader, describe: null });
    expect(scan.boxes.get("ear@left")).toMatchObject(IMAGE_RIGHT_EAR);
    expect(scan.boxes.has("ear@right")).toBe(false);
    /* A half-answered SECOND reading must not start the #2802 heal over again:
       on this road that heal would ask the identical half a third time. */
    expect(aboutTheEar(order)).toHaveLength(3);
  });

  it("nothing on either half leaves the pair exactly as it was read, and the question reads empty", async () => {
    const { reader } = readerWith({ bothEmpty: ["ear"], half: async () => null });
    const scan = await scanFace({ frame: FRAME, reader, describe: null });
    expect(scan.boxes.has("ear@left")).toBe(false);
    expect(scan.boxes.has("ear@right")).toBe(false);
    expect(scan.empty).toContain("ear");
    expect(scan.failed.map((one) => one.question)).not.toContain("ear");
  });

  it("CONTROL — a pair that answered on both sides is never asked again", async () => {
    const { reader, order } = readerWith({ half: async () => HER_LEFT });
    await scanFace({ frame: FRAME, reader, describe: null });
    /* The bill. A second look on a healthy pair would put two calls on every
       pair of every scan. */
    expect(aboutTheEar(order)).toEqual(["regionSides ear"]);
    expect(order.filter((one) => one.startsWith("sideByCrop"))).toEqual([]);
  });

  it("CONTROL — a HALF-answered pair still takes #2802's road: the blind side only", async () => {
    const { reader, order } = readerWith({ halfAnswered: ["ear"], half: async () => HER_LEFT });
    await scanFace({ frame: FRAME, reader, describe: null });
    expect(aboutTheEar(order)).toEqual(["regionSides ear", "sideByCrop ear left"]);
  });

  it("CONTROL — a WORN pair empty on both sides is not asked again at all", async () => {
    const { reader, order, ears } = readerWith({
      bothEmpty: ["earring"],
      half: async () => HER_LEFT,
    });
    await scanFace({ frame: FRAME, reader, describe: null });
    /* An empty earring read is the born-worn detector being careful, and
       asking twice would only make it careful twice. It is also why the ear
       rule below can travel with this road without ever being used by it. */
    expect(order.filter((one) => one.includes("earring"))).toEqual(["regionSides earring"]);
    expect(ears).toEqual([]);
  });

  it("CONTROL — a pair that may honestly be absent is not asked again either", async () => {
    const { reader, order } = readerWith({ bothEmpty: ["horns"], half: async () => HER_LEFT });
    await scanFace({ frame: FRAME, reader, describe: null });
    expect(order.filter((one) => one.includes("horns"))).toEqual(["regionSides horns"]);
  });

  it("CONTROL — a reader that cannot read one side alone keeps the re-ask it has", async () => {
    const { reader, order } = readerWith({ bothEmpty: ["ear"], noHalfRead: true });
    await scanFace({ frame: FRAME, reader, describe: null });
    expect(aboutTheEar(order), "asked twice, as before").toEqual([
      "regionSides ear",
      "regionSides ear",
    ]);
  });

  it("a half that throws costs that half and never the other", async () => {
    const { reader } = readerWith({
      bothEmpty: ["ear"],
      half: async (input) => {
        if (input.side === "left") throw new Error("429 concurrent_requests_limit");
        return HER_RIGHT;
      },
    });
    const scan = await scanFace({ frame: FRAME, reader, describe: null });
    expect(scan.boxes.get("ear@right")).toMatchObject(IMAGE_LEFT_EAR);
    expect(scan.boxes.has("ear@left")).toBe(false);
    /* An outage on one side is not an absence on the other, and it is not a
       failed reading either — a side did answer. */
    expect(scan.failed.map((one) => one.question)).not.toContain("ear");
  });

  it("both halves throwing is a FAILED reading, never an empty one", async () => {
    const { reader } = readerWith({
      bothEmpty: ["ear"],
      half: async () => { throw new Error("429 concurrent_requests_limit"); },
    });
    const scan = await scanFace({ frame: FRAME, reader, describe: null });
    /* The re-ask rate is read by question, so an outage filed as an absence
       would say the second look looked and found nothing. */
    expect(scan.failed.map((one) => one.question)).toContain("ear");
    expect(scan.empty).not.toContain("ear");
  });

  it("CONTROL — a whole-frame region is still asked the same question twice", async () => {
    /* The re-ask is fable-468's ruling and only the PAIR road's copy of it is
       changed: a region with one slot has no half to cut. */
    const { reader } = readerWith();
    const order: string[] = [];
    const watched = {
      ...reader,
      async region(input: { name: string }) {
        order.push(input.name);
        return NOTHING;
      },
    } as unknown as RegionReader;
    await scanFace({ frame: FRAME, reader: watched, describe: null });
    expect(order.filter((one) => one === "nose")).toEqual(["nose", "nose"]);
  });
});
