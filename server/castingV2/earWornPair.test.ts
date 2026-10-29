/**
 * AN EARRING IS A THING ON AN EAR (#2781, his eye round 3: *"the earring boxes
 * are massive?"*).
 *
 * Asked `earring` of his cast, the segmenter answered the SEPTUM RING too, at
 * the same score as the two hoops. The ring sits on the face's midline, so the
 * split every pair is read through gave half of it to each side, and each
 * side's rectangle ran from the ear to the nose. These arms drive the repair
 * directly — the pure rule, then the reader on both roads with a stub
 * segmenter answering in the shape his crop measured, then the scan's choice
 * of which pairs ask for it — and every "kept" arm has a "dropped" sibling.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

import { createFalRegionReader, keepPiecesAtTheSide } from "./falRegionReader";
import { scanFace, scanPlan, wornOnTheEars } from "./faceScan";
import { boundsOf } from "./segmentCuts";
import type { Mask } from "./maskedComposite";
import type { RegionReader } from "./maskedRefine";

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

/* The face spans x 60–139 and its midline is x 100, as the stub's face read
   below answers. A hoop hangs just outside each side; the ring straddles the
   midline under the nose. */
const FACE = { midline: 100, left: 60, right: 139 };
const LEFT_HOOP = { x: 52, y: 50, width: 5, height: 14 };
const RIGHT_HOOP = { x: 143, y: 48, width: 5, height: 16 };
const RING = { x: 94, y: 78, width: 12, height: 6 };

describe("keepPiecesAtTheSide — the rule, driven without a reader", () => {
  it("drops the half-ring nearer the middle and keeps the hoop at the side", () => {
    const side = maskWith([LEFT_HOOP, { x: 94, y: 78, width: 6, height: 6 }]);
    const { kept, dropped } = keepPiecesAtTheSide(side, "imageLeft", FACE);
    expect(dropped).toEqual([{ pixels: 36, centreX: 97 }]);
    expect(boundsOf(kept!)).toEqual({ x: 52, y: 50, width: 5, height: 14 });
  });

  it("reads the IMAGE-RIGHT side against the face's right edge", () => {
    const side = maskWith([RIGHT_HOOP, { x: 100, y: 78, width: 6, height: 6 }]);
    const { kept, dropped } = keepPiecesAtTheSide(side, "imageRight", FACE);
    expect(dropped).toHaveLength(1);
    expect(boundsOf(kept!)).toEqual({ x: 143, y: 48, width: 5, height: 16 });
  });

  it("CONTROL — two earrings on one ear stay two (#2565 §6), and the mask is untouched", () => {
    const stud = { x: 55, y: 30, width: 3, height: 3 };
    const side = maskWith([LEFT_HOOP, stud]);
    const { kept, dropped } = keepPiecesAtTheSide(side, "imageLeft", FACE);
    expect(dropped).toEqual([]);
    expect(kept).toBe(side);
  });

  it("an answer that was ONLY the ring leaves that side holding nothing", () => {
    const side = maskWith([{ x: 94, y: 78, width: 6, height: 6 }]);
    expect(keepPiecesAtTheSide(side, "imageLeft", FACE).kept).toBeNull();
  });

  it("a piece exactly halfway is kept — the answer that cannot take a real earring away", () => {
    /* Centre x 80 is 20 from the midline and 20 from the side. */
    const side = maskWith([{ x: 79, y: 40, width: 3, height: 3 }]);
    expect(keepPiecesAtTheSide(side, "imageLeft", FACE).dropped).toEqual([]);
  });

  it("an empty side is nothing to keep, not an error", () => {
    expect(keepPiecesAtTheSide(maskWith([]), "imageLeft", FACE)).toEqual({ kept: null, dropped: [] });
  });
});

describe("the reader, both roads, with a segmenter answering the way his crop measured", () => {
  /* The two halves are told apart by their colour, because both are 100 px
     wide and the crop road asks them in parallel. */
  async function frame(): Promise<Buffer> {
    const dark = await sharp({ create: { width: W / 2, height: H, channels: 3, background: { r: 10, g: 10, b: 10 } } }).png().toBuffer();
    return sharp({ create: { width: W, height: H, channels: 3, background: { r: 200, g: 200, b: 200 } } })
      .composite([{ input: dark, left: 0, top: 0 }]).png().toBuffer();
  }
  async function uri(mask: Mask): Promise<string> {
    const png = await sharp(mask.data, { raw: { width: mask.width, height: mask.height, channels: 1 } }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  }

  /**
   * `face` answers the face rectangle; the whole-frame `earring` answers three
   * instances (two hoops and the ring); a half-frame `earring` answers only
   * the half of the ring that fell in it — which is what the crop road did on
   * his crop, on both sides.
   */
  function stub(instances?: Mask[]): { prompts: string[] } {
    const prompts: string[] = [];
    vi.stubGlobal("fetch", async (_url: unknown, init: any) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const prompt = String(body.prompt ?? "");
      prompts.push(prompt);
      const image = Buffer.from(String(body.image_url).split(",")[1], "base64");
      const meta = await sharp(image).metadata();
      const reply = (masks: string[]) => new Response(
        JSON.stringify({ masks: masks.map((url) => ({ url })) }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
      if (prompt === "face") return reply([await uri(maskWith([{ x: 60, y: 20, width: 80, height: 90 }]))]);
      if (meta.width === W) {
        const whole = instances ?? [maskWith([LEFT_HOOP]), maskWith([RIGHT_HOOP]), maskWith([RING])];
        return reply(await Promise.all(whole.map(uri)));
      }
      /* A half frame: only its half of the ring, in the half's own pixels. */
      const half = meta.width as number;
      const { data } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const left = (data[0] as number) < 100;
      return reply([await uri(maskWith([left ? { x: 94, y: 78, width: 6, height: 6 } : { x: 0, y: 78, width: 6, height: 6 }], half, H))]);
    });
    return { prompts };
  }

  /**
   * ⚠ THIS ARM MEASURED HIS RECTANGLE UNTIL #2783 LANDED BESIDE IT, AND WHAT
   * CHANGED IT IS THE POINT RATHER THAN A BROKEN TEST.
   *
   * It read `box.x + box.width === 100` — the hoop at x 52 joined by the ring's
   * left half running to the midline, which is what he saw. #2783's midline
   * rule (`withoutPiecesOnTheCut`, the same file) drops a smaller piece sitting
   * ON the cut whichever noun was asked, so on THIS road his rectangle can no
   * longer be reproduced with the option off: two independent repairs each
   * prevent it and either alone is enough. Driven on the merged tree
   * 2026-10-29 — the hoop alone, on both sides, where the old arm read 100.
   *
   * The crop-road control below is untouched and still answers the ring halves,
   * because geometry cannot repair that road (#2783's docblock, #2784).
   */
  it("the midline rule alone already keeps the ring out of both sides", async () => {
    stub();
    const reader = createFalRegionReader({ apiKey: "k", pairInOneRead: true });
    /* The cast's RIGHT is the image's left. */
    const sides = await reader.regionSides!({ image: await frame(), name: "earring", absentIsAnswer: true });
    expect(boundsOf(sides!.right)).toEqual(LEFT_HOOP);
    expect(boundsOf(sides!.left)).toEqual(RIGHT_HOOP);
  });

  /**
   * POSITIVE CONTROL FOR THE WIRING, AND IT IS OWED RATHER THAN EXTRA.
   *
   * With the arm above true, the pair road answers the SAME box with the option
   * on and off on the shared fixture — so nothing on that fixture proves the
   * reader still hands `onTheEars` to the rule at all, and #2781's repair on
   * this road would read as covered while testing nothing (invariant 7).
   *
   * This fixture separates the two repairs: a stud beside the nose, OFF the
   * midline, which the midline rule KEEPS (it touches no cut column) and
   * `onTheEars` DROPS (its centre, x 90, is 10 from the midline and 30 from the
   * face's own left edge).
   */
  const STUD_BY_THE_NOSE = { x: 88, y: 78, width: 6, height: 6 };
  const hoopsAndStud = (): Mask[] => [maskWith([LEFT_HOOP]), maskWith([RIGHT_HOOP]), maskWith([STUD_BY_THE_NOSE])];

  it("a stud beside the nose: the midline rule keeps it and only the option drops it", async () => {
    stub(hoopsAndStud());
    const off = await createFalRegionReader({ apiKey: "k", pairInOneRead: true })
      .regionSides!({ image: await frame(), name: "earring", absentIsAnswer: true });
    expect(boundsOf(off!.right)).toEqual({ x: 52, y: 50, width: 42, height: 34 });
    stub(hoopsAndStud());
    const on = await createFalRegionReader({ apiKey: "k", pairInOneRead: true })
      .regionSides!({ image: await frame(), name: "earring", absentIsAnswer: true, onTheEars: true });
    expect(boundsOf(on!.right)).toEqual(LEFT_HOOP);
  });

  it("pair road, on the ears: each side is its hoop, and the face is still read ONCE", async () => {
    const { prompts } = stub();
    const reader = createFalRegionReader({ apiKey: "k", pairInOneRead: true });
    const sides = await reader.regionSides!({ image: await frame(), name: "earring", absentIsAnswer: true, onTheEars: true });
    expect(boundsOf(sides!.right)).toEqual({ x: 52, y: 50, width: 5, height: 14 });
    expect(boundsOf(sides!.left)).toEqual({ x: 143, y: 48, width: 5, height: 16 });
    expect(prompts.filter((one) => one === "face")).toHaveLength(1);
    expect(prompts.filter((one) => one === "earring")).toHaveLength(1);
  });

  it("crop road, on the ears: two halves of a ring are no earring at all", async () => {
    stub();
    const reader = createFalRegionReader({ apiKey: "k", pairInOneRead: false });
    const sides = await reader.regionSides!({ image: await frame(), name: "earring", absentIsAnswer: true, onTheEars: true });
    expect(boundsOf(sides!.left)).toBeNull();
    expect(boundsOf(sides!.right)).toBeNull();
  });

  it("CONTROL — the crop road without the option still answers the ring halves, as before", async () => {
    stub();
    const reader = createFalRegionReader({ apiKey: "k", pairInOneRead: false });
    const sides = await reader.regionSides!({ image: await frame(), name: "earring", absentIsAnswer: true });
    expect(boundsOf(sides!.right)).toEqual({ x: 94, y: 78, width: 6, height: 6 });
    expect(boundsOf(sides!.left)).toEqual({ x: 100, y: 78, width: 6, height: 6 });
  });
});

describe("the scan asks it of an ear-worn pair, and of nothing else", () => {
  it("knows the earring is worn on the ears, read off the two tables", () => {
    expect(wornOnTheEars("earring")).toBe(true);
    for (const other of ["ear", "eyes", "eyebrows", "horns", "glasses", "nose stud"]) {
      expect(wornOnTheEars(other), other).toBe(false);
    }
  });

  it("passes it on the earring's reads only", async () => {
    const FRAME = { bytes: Buffer.from("not a picture"), width: 200, height: 120 };
    const calls: { name: string; onTheEars: unknown }[] = [];
    const reader: RegionReader = {
      async region() { return maskWith([{ x: 10, y: 10, width: 5, height: 5 }]); },
      async subject() { return maskWith([]); },
      async landmark() { return []; },
      async regionSides(input) {
        calls.push({ name: input.name, onTheEars: input.onTheEars });
        return { left: maskWith([{ x: 150, y: 50, width: 4, height: 4 }]), right: maskWith([{ x: 40, y: 50, width: 4, height: 4 }]) };
      },
    } as RegionReader;
    await scanFace({ frame: FRAME, reader, describe: null });
    const pairs = scanPlan().filter((entry) => entry.slots.some((slot) => slot.instance !== null)).map((entry) => entry.question);
    expect(pairs).toContain("earring");
    for (const question of pairs) {
      const mine = calls.filter((call) => call.name === question);
      expect(mine.length, question).toBeGreaterThan(0);
      for (const call of mine) expect(call.onTheEars, question).toBe(question === "earring" ? true : undefined);
    }
  });
});
