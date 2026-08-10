import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  paintTerm, checkerAt, checkerCell, CHECKERED, LOST_GREY, DIMMED_FRAME_CEILING, TERM_LEGEND,
  type TermClass,
} from "../../scripts/lib/termsPalette.mts";

/**
 * ON-IMAGE GEOMETRY IS MONOCHROME — founder ruling, 2026-08-11 (fable-230),
 * standing and product-wide: *"Bounding-box overlays are THIN WHITE, not red —
 * everywhere."*
 *
 * The ruling was obeyed twice by hand and both times only where it was noticed.
 * `ebcea900` corrected the pack builder's `#ff2d55` and left the identical line
 * in `scripts/open-refused-crops.mts` untouched — the same 3px red box, in the
 * same idiom, three files away. That is the fix going to the instance while the
 * class walked free (working law 7), and it is why this file exists.
 *
 * The list of files it holds is DERIVED, not written down: anything under
 * `scripts/` that composites onto an image is drawing on a photograph, so it is
 * in scope the moment it is written. A hand-kept list would drift from the tree
 * the same way the ruling drifted from the code.
 *
 * It lives under `server/` because that is where `pnpm test` looks, and a design
 * law nobody can run is a design law that lasts one refactor.
 */

const ROOT = path.resolve(__dirname, "..", "..");

/** Prose removed: a comment naming the red it replaced is not a breach of the
 *  rule, and `v#163` in a sentence is a version, not a colour. */
const withoutProse = (source: string): string => source
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ");

const isGreyHex = (hex: string): boolean => {
  const body = hex.slice(1);
  const full = body.length === 3 ? body.split("").map((c) => c + c).join("") : body;
  return full.slice(0, 2).toLowerCase() === full.slice(2, 4).toLowerCase()
    && full.slice(2, 4).toLowerCase() === full.slice(4, 6).toLowerCase();
};

/**
 * Every non-grey colour the source draws with. Two idioms, and each is anchored
 * so it cannot fire on a number that merely looks like one: a hex only counts in
 * a `fill=`/`stroke=`/`colour:` position, and an RGB triple only counts on a
 * line that says it is a colour — `for (const radius of [4, 8, 16])` is a list
 * of radii and the guard must not pretend otherwise.
 */
export const nonGreyColoursIn = (raw: string): string[] => {
  const source = withoutProse(raw);
  const found: string[] = [];
  for (const match of source.matchAll(/(?:fill|stroke|color|colour)\s*[=:]\s*"(#[0-9a-fA-F]{3,6})"/g)) {
    if (!isGreyHex(match[1]!)) found.push(match[0]!);
  }
  for (const line of source.split("\n")) {
    if (!/colour|color|rgb|paint|fill|stroke/i.test(line)) continue;
    for (const match of line.matchAll(/\[\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\]/g)) {
      const [r, g, b] = [Number(match[1]), Number(match[2]), Number(match[3])];
      if (r > 255 || g > 255 || b > 255) continue;
      if (r === g && g === b) continue;
      found.push(match[0]!);
    }
  }
  return found;
};

describe("on-image geometry is monochrome, everywhere (founder ruling, fable-230)", () => {
  const walk = (dir: string): string[] => readdirSync(path.join(ROOT, dir), { withFileTypes: true })
    .flatMap((entry) => (entry.isDirectory()
      ? walk(path.posix.join(dir, entry.name))
      : (/\.m?ts$/.test(entry.name) ? [path.posix.join(dir, entry.name)] : [])));
  const compositors = walk("scripts")
    .map((rel) => ({ rel, raw: readFileSync(path.join(ROOT, rel), "utf8") }))
    .filter((file) => file.raw.includes(".composite("));

  it("finds the exhibit builders at all — a guard over an empty list is not a guard", () => {
    /* Invariant 7 in miniature. If a rename empties this scan, every assertion
       below passes vacuously, so the scan itself is asserted first. */
    expect(compositors.length).toBeGreaterThan(20);
    const names = compositors.map((file) => file.rel.replace(/\\/g, "/"));
    expect(names).toContain("scripts/build-library-demo-pack.mts");
    expect(names).toContain("scripts/open-refused-crops.mts");
    expect(names).toContain("scripts/diagnose-earring-cut-2-disposable.mts");
  });

  it("draws no non-grey colour in any script that composites onto an image", () => {
    const breaches = compositors
      .map((file) => ({ rel: file.rel, colours: nonGreyColoursIn(file.raw) }))
      .filter((file) => file.colours.length > 0);
    expect(breaches.map((b) => `${b.rel}: ${b.colours.join(", ")}`)).toEqual([]);
  });

  it("CAN FAIL — the two idioms it hunts, driven directly", () => {
    /* The exact lines that were in the tree this morning. A checker that has
       only ever seen a clean tree is not yet a checker (working law 2). */
    expect(nonGreyColoursIn(`const outline = 'rect fill="none" stroke="#ff2d55" stroke-width="3"';`))
      .toEqual(['stroke="#ff2d55"']);
    expect(nonGreyColoursIn(`if (a) colour = [255, 214, 0];`)).toEqual(["[255, 214, 0]"]);
    expect(nonGreyColoursIn(`colour = [0, 160, 255];`)).toEqual(["[0, 160, 255]"]);

    /* And the negative side: what it must NOT flag. */
    expect(nonGreyColoursIn(`for (const radius of [4, 8, 16]) {}`)).toEqual([]);
    expect(nonGreyColoursIn(`/* it drew #ff2d55 before the ruling */`)).toEqual([]);
    expect(nonGreyColoursIn(`const s = 'stroke="#ffffff"';`)).toEqual([]);
    expect(nonGreyColoursIn(`colour = [158, 158, 158];`)).toEqual([]);
  });
});

describe("the set-diff grammar (scripts/lib/termsPalette.mts)", () => {
  const CLASSES = Object.keys(TERM_LEGEND) as TermClass[];

  it("paints every class in grey, and every class has a sentence", () => {
    for (const term of CLASSES) {
      const colour = paintTerm(term, 0, 0);
      if (!colour) continue;
      expect(new Set(colour).size, `${term} is not grey`).toBe(1);
      expect(TERM_LEGEND[term]?.length ?? 0, `${term} has no sentence`).toBeGreaterThan(10);
    }
  });

  it("keeps the lost-grey clear of the brightest thing the dimmed frame can make", () => {
    /* The greys were chosen against a MEASURED number (102, the dimmed pair's
       brightest surviving channel), not against taste. A future re-dim has to
       re-argue them rather than let the marks sink into the photograph. */
    expect(LOST_GREY).toBeGreaterThan(DIMMED_FRAME_CEILING);
    expect(255 - LOST_GREY).toBeGreaterThan(50);
  });

  it("NEVER lets the control's mark be white at source scale — white is `kept`", () => {
    /* The defect this shift shipped and caught by measurement: a source-scale
       checker gave nine isolated control pixels a flat WHITE block each, so the
       exhibit carried 187 white source pixels where 178 were `kept`. An alarm
       wearing a reading's mark is worse than the hue it replaced. */
    for (let x = 0; x < 4; x += 1) {
      for (let y = 0; y < 4; y += 1) {
        expect(paintTerm("controlFailure", x, y)).not.toEqual([255, 255, 255]);
      }
    }
  });

  it("gives every control block BOTH extremes once magnified, so it cannot read as a flat tone", () => {
    const zoom = 12;
    expect(CHECKERED.has("controlFailure")).toBe(true);
    expect(checkerCell(zoom)).toBeGreaterThan(1);
    /* Every alignment of a source pixel's block within the checker, so this
       holds for an isolated speck anywhere on the frame — which is what the
       control set actually looks like (7 of row 8's 20 have no neighbour). */
    for (let originX = 0; originX < zoom * 2; originX += 1) {
      for (let originY = 0; originY < zoom * 2; originY += 1) {
        const tones = new Set<string>();
        for (let dx = 0; dx < zoom; dx += 1) {
          for (let dy = 0; dy < zoom; dy += 1) tones.add(checkerAt(originX + dx, originY + dy, zoom).join(","));
        }
        expect(tones.has("255,255,255"), `block at ${originX},${originY} has no white`).toBe(true);
        expect(tones.has("0,0,0"), `block at ${originX},${originY} has no black`).toBe(true);
      }
    }
  });
});
