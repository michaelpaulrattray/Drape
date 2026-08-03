import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { detectRenderFault } from "./renderFault";

/**
 * The smoke alarm, pinned against the real thing.
 *
 * `docs/specs/references/nine-tile-sheet.png` is **the actual candidate the
 * founder paid for** — the D-93 incident itself, a contact sheet returned where
 * a portrait should have been, delivered as `ready` with no refund because
 * nothing looked at it. It is committed so this suite tests the failure rather
 * than a reconstruction of it.
 *
 * That mattered more than it sounds. The first detector passed its synthetic
 * tests and called the real specimen **clean** — it was measuring the wrong
 * thing, and only the genuine article said so.
 */

const SPECIMEN = new URL("../../docs/specs/references/nine-tile-sheet.png", import.meta.url);

/** A single subject on a backdrop: smooth ground, one textured region, no seams. */
async function singleSubject(): Promise<Buffer> {
  const width = 1024;
  const height = 1536;
  const noise = Buffer.alloc(400 * 400 * 3);
  for (let i = 0; i < noise.length; i += 1) noise[i] = 90 + ((i * 37) % 120);
  return sharp({ create: { width, height, channels: 3, background: "#d8d8d8" } })
    .composite([{ input: noise, raw: { width: 400, height: 400, channels: 3 }, left: 300, top: 500 }])
    .png()
    .toBuffer();
}

describe("the render-fault smoke alarm", () => {
  it("catches the candidate the founder actually paid for", async () => {
    const verdict = await detectRenderFault(await readFile(SPECIMEN));
    expect(verdict.fault).toBe(true);
    expect(verdict.reason).toBe("tiled");
    /*
      The seams it reports are the grid it actually is: a 2x4 sheet, so three
      interior horizontal boundaries at the quarters and one vertical down the
      middle. Asserted rather than left to `fault: true`, because a detector
      that fires for the wrong reason is a detector that will stop firing when
      the reason changes.

      Worth recording: D-93 calls this a NINE-face grid. It is eight — two
      columns by four rows. The prose was written from memory in the moment; the
      image is the record.
    */
    expect(verdict.detail).toContain("3 horizontal at [0.25, 0.50, 0.75]");
    expect(verdict.detail).toContain("1 vertical at [0.50]");
  });

  it("says nothing about a single subject on a backdrop", async () => {
    const verdict = await detectRenderFault(await singleSubject());
    expect(verdict.fault).toBe(false);
  });

  it("says nothing about a flat image with no interior structure at all", async () => {
    const flat = await sharp({ create: { width: 512, height: 768, channels: 3, background: "#cccccc" } })
      .png()
      .toBuffer();
    expect((await detectRenderFault(flat)).fault).toBe(false);
  });

  /*
    FAIL OPEN, and this is the assertion that matters most on the money path.

    A fire destroys an image the customer paid for and the refund does not give
    them the face back, so every uncertainty must resolve to "deliver". Unlike
    a security control, allowing on failure here is the behaviour the product
    already shipped with — invariant 7's posture is deliberately inverted, and
    that inversion is pinned rather than left to the comment.
  */
  it("delivers rather than destroys when it cannot read the bytes", async () => {
    for (const bytes of [Buffer.alloc(0), Buffer.from("not an image at all"), Buffer.from([0xff, 0xd8, 0xff])]) {
      const verdict = await detectRenderFault(bytes);
      expect(verdict.fault).toBe(false);
      expect(verdict.reason).toBe("undetermined");
    }
  });

  /*
    The known blind spot, asserted so it is a recorded limit rather than a
    surprise. An edge-to-edge grid has no seam to find; catching it needs a
    different signal (repeated blocks), and fail-open tolerates the miss.
  */
  it("cannot see a grid with no seams, and that is the documented limit", async () => {
    const cell = 300;
    const noise = Buffer.alloc(cell * cell * 3);
    for (let i = 0; i < noise.length; i += 1) noise[i] = 60 + ((i * 53) % 150);
    const tiles = Array.from({ length: 9 }, (_, i) => ({
      input: noise,
      raw: { width: cell, height: cell, channels: 3 as const },
      left: (i % 3) * cell,
      top: Math.floor(i / 3) * cell,
    }));
    const edgeToEdge = await sharp({
      create: { width: cell * 3, height: cell * 3, channels: 3, background: "#ffffff" },
    })
      .composite(tiles)
      .png()
      .toBuffer();
    expect((await detectRenderFault(edgeToEdge)).fault).toBe(false);
  });
});
