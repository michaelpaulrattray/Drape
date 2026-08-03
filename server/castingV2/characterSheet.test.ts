import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  EXPORT_MAX_BYTES,
  EXPORT_MAX_LONG_SIDE,
  columnsFor,
  composeCharacterSheet,
  orderCells,
  sheetGeometry,
  type SheetCell,
} from "./characterSheet";

/**
 * The character sheet's geometry, asserted as arithmetic.
 *
 * A composition bug is otherwise only visible by looking at the picture, and
 * "I looked at it" is not a test — it is the reason the render-fault detector
 * shipped inert the first time.
 */

async function swatch(colour: string): Promise<Buffer> {
  return sharp({ create: { width: 200, height: 300, channels: 3, background: colour } })
    .png()
    .toBuffer();
}

async function cells(slots: SheetCell["slot"][]): Promise<SheetCell[]> {
  return Promise.all(
    slots.map(async (slot) => ({ slot, bytes: await swatch("#808080"), label: String(slot) })),
  );
}

describe("the order the pack reads in", () => {
  it("leads with the anchor — the one image that is definitely her", async () => {
    const ordered = orderCells(await cells(["backFull", "frontFull", "anchor", "closeUp"]));
    expect(ordered[0].slot).toBe("anchor");
  });

  it("reads as a turnaround: face, front, sides, back", async () => {
    const ordered = orderCells(
      await cells(["backFull", "sideClose", "frontFull", "closeUp", "anchor"]),
    );
    expect(ordered.map((cell) => cell.slot)).toEqual([
      "anchor", "closeUp", "frontFull", "sideClose", "backFull",
    ]);
  });

  /*
    D-102, applied to a composition. Package composition has changed twice — a
    Cast signed under v3 has no `threeQuarter`, one signed under v2 has a
    `sideFull` the current profile never sells. A sheet that dropped what it did
    not recognise would quietly stop being a picture of everything she has.
  */
  it("keeps a view from an era this list has never heard of", async () => {
    const ordered = orderCells([
      ...(await cells(["anchor", "frontFull"])),
      { slot: "somethingNew" as never, bytes: await swatch("#111111"), label: "New" },
    ]);
    expect(ordered.map((cell) => cell.slot)).toContain("somethingNew");
    // Appended rather than interleaved, so a new type has a stable home.
    expect(ordered[ordered.length - 1].slot).toBe("somethingNew");
  });
});

describe("the layout", () => {
  it("stays a rectangle rather than becoming a strip", () => {
    expect(columnsFor(1)).toBe(1);
    expect(columnsFor(4)).toBe(2);
    expect(columnsFor(6)).toBe(3);
    // Never wider than four: a 1x8 line of portraits is unreadable at any size
    // anybody would actually open.
    expect(columnsFor(8)).toBe(3);
    expect(columnsFor(16)).toBe(4);
  });

  /*
    THE LOAD-BEARING ONE. A missing view leaves a GAP — nothing stands in for
    it. Substituting the anchor would put a frontal face in the side-profile
    cell of an identity reference and mis-condition every future generation at
    that angle.
  */
  it("omits a missing view and reflows, never substituting", async () => {
    const full = sheetGeometry(await cells(["anchor", "closeUp", "frontFull", "sideClose"]));
    const short = sheetGeometry(await cells(["anchor", "closeUp", "frontFull"]));

    expect(full.cells).toHaveLength(4);
    expect(short.cells).toHaveLength(3);
    // No slot appears twice — the sign that nothing was duplicated into a hole.
    expect(new Set(short.cells.map((cell) => cell.slot)).size).toBe(3);
    expect(short.cells.map((cell) => cell.slot)).not.toContain("sideClose");
  });

  it("uses one geometry — the renderings differ only by envelope", async () => {
    const pack = await cells(["anchor", "closeUp"]);
    const geometry = sheetGeometry(pack);
    // No label band anywhere: the founder's correction is that labels never
    // bake into pixels, in EITHER rendering. They are page UI in the room.
    expect(geometry.height).toBe(geometry.rows * geometry.cellHeight
      + (geometry.rows + 1) * Math.max(2, Math.round(geometry.cellWidth * 0.012)));
  });

  it("carries each cell's label for the room to render over the image", async () => {
    const geometry = sheetGeometry(await cells(["anchor", "closeUp"]));
    expect(geometry.cells.map((cell) => cell.label)).toEqual(["anchor", "closeUp"]);
  });

  it("never overlaps two cells", async () => {
    const geometry = sheetGeometry(await cells(["anchor", "closeUp", "frontFull", "sideClose", "backFull"]));
    for (const [i, a] of geometry.cells.entries()) {
      for (const b of geometry.cells.slice(i + 1)) {
        const apart = Math.abs(a.left - b.left) > 0 || Math.abs(a.top - b.top) > 0;
        expect(apart, `${a.slot} and ${b.slot} share a position`).toBe(true);
      }
    }
  });
});

describe("what the picture actually contains", () => {
  it("composes a real image whose shape matches the geometry it promised", async () => {
    const pack = await cells(["anchor", "closeUp", "frontFull"]);
    const bytes = await composeCharacterSheet(pack);
    expect(bytes).not.toBeNull();
    const meta = await sharp(bytes!).metadata();
    const geometry = sheetGeometry(pack);
    /*
      Aspect rather than exact pixels: the composite is built at native size and
      then bounded, so the promise the geometry makes is about SHAPE. A layout
      bug moves the ratio; a downscale does not.
    */
    const composed = geometry.width / geometry.height;
    const rendered = meta.width! / meta.height!;
    expect(Math.abs(composed - rendered)).toBeLessThan(0.01);
  });

  /*
    THE EXPORT ENVELOPE, asserted so a future cell-size change cannot breach it
    silently. 4096px long side and under 10MB is the strictest common limit
    across the tools people paste this into — meeting the tightest one means the
    file works everywhere without asking anybody which tool they use.
  */
  it("keeps the export inside the envelope every tool accepts", async () => {
    const pack = await cells(["anchor", "closeUp", "frontFull", "sideClose", "backFull", "frontClose"]);
    const exported = await composeCharacterSheet(pack);
    const meta = await sharp(exported!).metadata();

    expect(meta.format).toBe("jpeg");
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(EXPORT_MAX_LONG_SIDE);
    expect(exported!.length).toBeLessThanOrEqual(EXPORT_MAX_BYTES);
  });

  /*
    THE UNBOUNDED RENDERING IS RETIRED, and this pins that it stays retired.

    A full-native PNG existed briefly for our own engines, on the reasoning that
    we control those consumers. The consumers discard it themselves: Gemini-family
    models downscale every input to 3072 and perceive via 768px tiles, and intake
    budgets are often request-TOTAL, so a 47MB reference crowds out the companion
    references sent with it. One envelope now serves everything.
  */
  it("has no unbounded form left to hand anybody", async () => {
    const pack = await cells(["anchor", "closeUp", "frontFull"]);
    const only = await composeCharacterSheet(pack);
    const meta = await sharp(only!).metadata();
    expect(meta.format).toBe("jpeg");
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(EXPORT_MAX_LONG_SIDE);
  });

  /*
    Composition still happens at NATIVE resolution internally, so nothing is
    pre-blurred — a caller that needs a different envelope gets it derived from
    the full-detail composite rather than from an already-shrunk one.
  */
  it("derives a smaller variant for a consumer that resamples anyway", async () => {
    const pack = await cells(["anchor", "closeUp", "frontFull"]);
    const gemini = await composeCharacterSheet(pack, { maxLongSide: 3072 });
    const meta = await sharp(gemini!).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(3072);
  });

  it("returns nothing for a Cast with nothing in her pack", async () => {
    expect(await composeCharacterSheet([])).toBeNull();
  });

  /*
    A label can be anything a customer typed, and it never reaches the pixels —
    so a name that would once have broken the SVG label markup is now simply
    carried alongside for the room to render. Kept as a case because the hazard
    it guarded moved rather than disappeared.
  */
  it("never draws a label, whatever the label says", async () => {
    const nasty = `Ren & "Q" <script>`;
    const geometry = sheetGeometry([
      { slot: "anchor", bytes: await swatch("#808080"), label: nasty },
    ]);
    expect(geometry.cells[0].label).toBe(nasty);
    const bytes = await composeCharacterSheet(
      [{ slot: "anchor", bytes: await swatch("#808080"), label: nasty }],
    );
    expect(bytes).not.toBeNull();
  });
});
