import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
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
    const full = sheetGeometry(await cells(["anchor", "closeUp", "frontFull", "sideClose"]), "reference");
    const short = sheetGeometry(await cells(["anchor", "closeUp", "frontFull"]), "reference");

    expect(full.cells).toHaveLength(4);
    expect(short.cells).toHaveLength(3);
    // No slot appears twice — the sign that nothing was duplicated into a hole.
    expect(new Set(short.cells.map((cell) => cell.slot)).size).toBe(3);
    expect(short.cells.map((cell) => cell.slot)).not.toContain("sideClose");
  });

  it("gives the export rendering room for its labels and the reference none", async () => {
    const pack = await cells(["anchor", "closeUp"]);
    const reference = sheetGeometry(pack, "reference");
    const exported = sheetGeometry(pack, "export");
    expect(exported.height).toBeGreaterThan(reference.height);
    expect(reference.width).toBe(exported.width);
  });

  it("never overlaps two cells", async () => {
    const geometry = sheetGeometry(await cells(["anchor", "closeUp", "frontFull", "sideClose", "backFull"]), "export");
    for (const [i, a] of geometry.cells.entries()) {
      for (const b of geometry.cells.slice(i + 1)) {
        const apart = Math.abs(a.left - b.left) > 0 || Math.abs(a.top - b.top) > 0;
        expect(apart, `${a.slot} and ${b.slot} share a position`).toBe(true);
      }
    }
  });
});

describe("what the picture actually contains", () => {
  it("composes a real PNG at the geometry it promised", async () => {
    const pack = await cells(["anchor", "closeUp", "frontFull"]);
    const bytes = await composeCharacterSheet(pack, "reference");
    expect(bytes).not.toBeNull();
    const meta = await sharp(bytes!).metadata();
    const geometry = sheetGeometry(pack, "reference");
    expect(meta.width).toBe(geometry.width);
    expect(meta.height).toBe(geometry.height);
  });

  /*
    THE REFERENCE CARRIES NO TEXT, and this is a money assertion wearing a
    layout costume. Image models reproduce what they see in a reference —
    labels, captions and watermarks come back out in the render — and our own
    framing constant forbids letters in the picture. A lettered reference would
    manufacture the conformance failures we then refund.

    Asserted by SIZE rather than by reading pixels: the export reserves a label
    band per row and the reference reserves none, so an identical pack differing
    only in variant proves the band is absent.
  */
  it("reserves no label space at all in the engine-facing rendering", async () => {
    const pack = await cells(["anchor", "closeUp"]);
    const reference = await composeCharacterSheet(pack, "reference");
    const exported = await composeCharacterSheet(pack, "export");
    const referenceMeta = await sharp(reference!).metadata();
    const exportMeta = await sharp(exported!).metadata();
    expect(exportMeta.height! - referenceMeta.height!).toBe(44);
  });

  it("returns nothing for a Cast with nothing in her pack", async () => {
    expect(await composeCharacterSheet([], "reference")).toBeNull();
  });

  /*
    A name reaches the export rendering, and a name with an ampersand in it
    would otherwise produce invalid SVG and a failed download.
  */
  it("survives a name that would break the label markup", async () => {
    const bytes = await composeCharacterSheet(
      [{ slot: "anchor", bytes: await swatch("#808080"), label: `Ren & "Q" <script>` }],
      "export",
    );
    expect(bytes).not.toBeNull();
  });
});
