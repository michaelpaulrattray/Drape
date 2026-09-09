import { readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { readListedSource } from "../testing/listedSource";

import sharp from "sharp";

import {
  paintTerm, checkerAt, checkerCell, CHECKERED, LOST_GREY, DIMMED_FRAME_CEILING, TERM_LEGEND,
  boxOutlineSvg, type TermClass,
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
 * Idiom 3: `buf[i] = R; buf[i + 1] = G; buf[i + 2] = B;` — one base expression,
 * three consecutive channel offsets, all three values written as literals.
 *
 * The backreferences are the whole anchor. `\1` pins the buffer name and `\2`
 * pins the index EXPRESSION verbatim, so `a[i] = 220; b[j + 1] = 40;` cannot be
 * folded into one match; the bounded gaps let the three writes sit on one line
 * or on three without admitting an unrelated statement between them.
 */
const PER_CHANNEL_WRITE = new RegExp(
  String.raw`([A-Za-z_$][\w$]*)\s*\[([^\]\n]+?)\]\s*=\s*(\d{1,3})\s*;`
  + String.raw`[\s\S]{0,60}?\1\s*\[\s*\2\s*\+\s*1\s*\]\s*=\s*(\d{1,3})\s*;`
  + String.raw`[\s\S]{0,60}?\1\s*\[\s*\2\s*\+\s*2\s*\]\s*=\s*(\d{1,3})\s*;`,
  "g",
);

/**
 * Every non-grey colour the source draws with. THREE idioms, and each is
 * anchored so it cannot fire on a number that merely looks like one: a hex only
 * counts in a `fill=`/`stroke=`/`colour:` position, and an RGB triple only
 * counts on a line that says it is a colour — `for (const radius of [4, 8, 16])`
 * is a list of radii and the guard must not pretend otherwise.
 *
 * # The third idiom, added 2026-09-09 (#257) — and it was the COMMON one
 *
 * Per-channel assignment into a raw RGBA buffer is **the standard way this
 * codebase paints a mask back onto a frame**: sharp promotes a raw
 * single-channel buffer to greyscale and paints the whole frame, so `dest-in`
 * is not available and the boring loop is the documented cure. So the guard was
 * blind to the idiom its own subject matter uses most.
 *
 * PR #256 is the specimen and it is the sharpest one available: it went red on
 * `fill="#ffb0b0"`, a **caption tint** — the least important colour in the file
 * — while the same file painted its **mask** in solid red three lines away and
 * the guard passed it. Fixing only what CI named would have been the fix going
 * to the instance while the class walked free, which is the failure this file's
 * own header was written about, happening to this file.
 *
 * ⚠ **It was never a hypothetical class.** At the tree this landed on, eight
 * writes in the population matched the idiom and **six were non-grey** — one of
 * them TRACKED: `scripts/calibration/hair-matte-composition.mts` filled a whole
 * mask `255, 30, 30` and composited it onto a photograph. #257 was filed
 * believing no specimen existed in the population (*"every prior overlay writer
 * stayed untracked"*); read at the bytes, the population is the files ON DISK,
 * so they were all in it and only the missing vocabulary hid them. All six are
 * repainted in the commit that adds this.
 *
 * # Why idiom 3 is anchored STRUCTURALLY, with no colour word
 *
 * Idiom 2 asks whether the line says "colour", because `[4, 8, 16]` alone is
 * ambiguous. Idiom 3 needs no such test and is stronger without one: three
 * assignments into the same base at offsets `+0/+1/+2`, every value literal and
 * inside `0…255`, in a file that composites onto an image, is an RGB write by
 * construction. Requiring a `colour`-ish word beside it would have missed the
 * live breach above — `tint[index * 4] = 255` names its buffer, not its channel.
 *
 * The alpha write (`+ 3`) is deliberately outside the match: opacity is not a
 * hue, and a mark is allowed to be faint.
 *
 * # ⚠ The stated limit: the population is the DISK, not the index
 *
 * The walk below reads `scripts/` as it stands, so an UNTRACKED disposable is
 * in scope — correctly, because an untracked overlay writer is exactly what put
 * a red mask in front of the founder. The cost is that a red this guard reports
 * may be invisible to CI and live only on one machine's tree. That property is
 * not new here (idioms 1 and 2 have always had it); it matters more now, because
 * five of the six breaches above were untracked shift instruments.
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
  for (const match of source.matchAll(PER_CHANNEL_WRITE)) {
    const [r, g, b] = [Number(match[3]), Number(match[4]), Number(match[5])];
    if (r > 255 || g > 255 || b > 255) continue;
    if (r === g && g === b) continue;
    /* Reported as the triple rather than as the matched span: the span is three
       statements long and would bury the finding in the failure message. */
    found.push(`${match[1]}[${match[2]!.trim()}] = ${r}, ${g}, ${b}`);
  }
  return found;
};

describe("on-image geometry is monochrome, everywhere (founder ruling, fable-230)", () => {
  const walk = (dir: string): string[] => readdirSync(path.join(ROOT, dir), { withFileTypes: true })
    .flatMap((entry) => (entry.isDirectory()
      ? walk(path.posix.join(dir, entry.name))
      : (/\.m?ts$/.test(entry.name) ? [path.posix.join(dir, entry.name)] : [])));
  const compositors = walk("scripts")
    /* A listed file can be gone by the read — a parallel suite plants and
       unlinks in `scripts/` (#223). The population arm below is what stops the
       skip from being silent. */
    .flatMap((rel) => {
      const raw = readListedSource(path.join(ROOT, rel));
      return raw === null ? [] : [{ rel, raw }];
    })
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

  it("CAN FAIL on the PER-CHANNEL idiom — the specimens that were in the tree, carried here", () => {
    /*
      #257's bar, and the reason it says the control must carry its own fixture:
      the guard is being widened onto an idiom, and the same commit repaints
      every instance of it. So a control POINTING at a file would be green the
      moment the fix lands and could never redden again — a guard that cannot
      fail, which is the shape this whole file exists to refuse (working law 2).

      These are the real breaches, verbatim from the tree at 2026-09-09, kept as
      literals so the arm survives the repair:
    */
    expect(nonGreyColoursIn(
      /* scripts/calibration/hair-matte-composition.mts:216 — the tracked one. */
      `tint[index * 4] = 255;\n    tint[index * 4 + 1] = 30;\n    tint[index * 4 + 2] = 30;\n`
      + `    tint[index * 4 + 3] = Math.round(small[index] * 0.62);`,
    )).toEqual(["tint[index * 4] = 255, 30, 30"]);

    /* Three writes on ONE line — the untracked `-WHERE` overlay writers' shape,
       and the line #257 quotes in its own body. */
    expect(nonGreyColoursIn(`rgba[i * 4] = 220; rgba[i * 4 + 1] = 40; rgba[i * 4 + 2] = 40;`))
      .toEqual(["rgba[i * 4] = 220, 40, 40"]);
    /* A bare index rather than a stride expression (`_shift105`). */
    expect(nonGreyColoursIn(`red[i] = 255; red[i + 1] = 0; red[i + 2] = 0;`))
      .toEqual(["red[i] = 255, 0, 0"]);

    /* The negative side, and each of these is a way the match could over-fire.
       An always-refusing guard passes every arm above it BY refusing. */
    expect(nonGreyColoursIn(`d[at] = 255; d[at + 1] = 255; d[at + 2] = 255;`), "white is the ruling")
      .toEqual([]);
    expect(nonGreyColoursIn(`d[at] = 96; d[at + 1] = 96; d[at + 2] = 96;`), "a grey mark").toEqual([]);
    expect(nonGreyColoursIn(`a[i] = 220; b[i + 1] = 40; c[i + 2] = 40;`), "three different buffers")
      .toEqual([]);
    expect(nonGreyColoursIn(`a[i] = 220; a[j + 1] = 40; a[j + 2] = 40;`), "a different index")
      .toEqual([]);
    expect(nonGreyColoursIn(`a[i] = 220; a[i + 2] = 40; a[i + 3] = 40;`), "not channels 0/1/2")
      .toEqual([]);
    expect(nonGreyColoursIn(`a[i] = r; a[i + 1] = g; a[i + 2] = b;`), "values are variables")
      .toEqual([]);
    /* Alpha alone is not a hue: a mark is allowed to be faint. */
    expect(nonGreyColoursIn(`d[at] = 255; d[at + 1] = 255; d[at + 2] = 255; d[at + 3] = 40;`))
      .toEqual([]);
    /* Two unrelated statements that happen to sit near each other must not be
       welded into a match by the gap tolerance. */
    expect(nonGreyColoursIn(
      `hist[bin] = 220;\n${"    doSomethingRatherLongIndeed(withAnArgument, andAnother, andOneMore);\n".repeat(2)}`
      + `    hist[bin + 1] = 40;\n    hist[bin + 2] = 40;`,
    )).toEqual([]);
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

describe("the box is thin and white IN THE PIXELS, not in the source string", () => {
  /*
    The delivered pack passed every check that read the source — `#ffffff`,
    `stroke-width="1"` — and put a TWO-pixel, 55%-opacity, faintly WARM band on
    the founder's frame, because an integer-coordinate SVG stroke straddles two
    rows at half coverage. Rows 454 and 455 of `00-her-frame-with-every-box.png`
    came back `166,150,136` and `162,145,131`, and the exhibit held not one pure
    white pixel.

    So this drives the rasteriser and reads the result. Assert at the wire: the
    contract is about what lands on the image, not about the string near it.
  */
  const render = async (svg: string) => {
    const canvas = await sharp({
      create: { width: 40, height: 40, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
    }).png().toBuffer();
    return sharp(canvas).composite([{ input: Buffer.from(svg) }]).ensureAlpha().raw()
      .toBuffer({ resolveWithObject: true });
  };
  const rowRuns = (data: Buffer, width: number, y: number): number[] => {
    const runs: number[] = [];
    let run = 0;
    for (let x = 0; x <= width; x += 1) {
      const at = (y * width + x) * 4;
      const white = x < width && data[at] === 255 && data[at + 1] === 255 && data[at + 2] === 255;
      if (white) { run += 1; continue; }
      if (run > 0) runs.push(run);
      run = 0;
    }
    return runs;
  };

  it("draws PURE WHITE — not a blend of white and whatever is underneath", async () => {
    const { data, info } = await render(boxOutlineSvg(40, 40, [{ x: 8, y: 8, width: 20, height: 20 }]));
    let white = 0;
    for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
      const at = pixel * 4;
      if (data[at] === 255 && data[at + 1] === 255 && data[at + 2] === 255) white += 1;
    }
    expect(white, "no pure-white pixel — the stroke is being blended, as it was on the delivered pack").toBeGreaterThan(0);
  });

  it("draws ONE pixel, not two — the half-pixel offset, proved on the raster", async () => {
    const { data, info } = await render(boxOutlineSvg(40, 40, [{ x: 8, y: 8, width: 20, height: 20 }]));
    /* Across the middle of the box, the only white is the two vertical edges,
       one pixel each. A straddled stroke gives runs of 2 — or no white at all. */
    expect(rowRuns(data, info.width, 18)).toEqual([1, 1]);
    /* And the top edge is a single row: the row above it carries no white. */
    expect(rowRuns(data, info.width, 7)).toEqual([]);
    expect(rowRuns(data, info.width, 8).length).toBe(1);
  });

  const whiteCount = (data: Buffer, info: { width: number; height: number }) => {
    let white = 0;
    for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
      const at = pixel * 4;
      if (data[at] === 255 && data[at + 1] === 255 && data[at + 2] === 255) white += 1;
    }
    return white;
  };

  it("CAN FAIL — the integer-coordinate stroke the pack actually shipped", async () => {
    const straddled = `<svg width="40" height="40">`
      + `<rect x="8" y="8" width="20" height="20" fill="none" stroke="#ffffff" stroke-width="1"/></svg>`;
    const { data, info } = await render(straddled);
    /* Exactly the delivered defect: no pure white anywhere, and the "1px" edge
       spread over two rows at half coverage. If this ever starts passing, the
       rasteriser changed and the offset should be re-argued, not kept by habit. */
    expect(whiteCount(data, info)).toBe(0);
    const grey = `${data[(7 * info.width + 18) * 4]},${data[(8 * info.width + 18) * 4]}`;
    expect(grey).toBe("128,128");
  });

  it("REFUSES the tidy-looking near-miss: crisp edges that move the box a row", async () => {
    /*
      `shape-rendering="crispEdges"` also removes the smudge, and it is the fix a
      reader reaches for first. On its own it snaps the straddled stroke to the
      row ABOVE — a crisp, white, correctly-thin box pointing one pixel off the
      thing it is meant to point at. A bounding box that is wrong about WHERE is
      the wrong-boundary class wearing a tidy edge, so it is named here rather
      than left as a plausible future simplification of the offset.
    */
    const crisp = `<svg width="40" height="40" shape-rendering="crispEdges">`
      + `<rect x="8" y="8" width="20" height="20" fill="none" stroke="#ffffff" stroke-width="1"/></svg>`;
    const { data, info } = await render(crisp);
    expect(whiteCount(data, info)).toBeGreaterThan(0);
    expect(rowRuns(data, info.width, 7).length, "crispEdges alone puts the top edge on row 7").toBeGreaterThan(0);
    expect(rowRuns(data, info.width, 8)).toEqual([1, 1]);

    /* What the shipped helper does with the same box, for the contrast. */
    const ours = await render(boxOutlineSvg(40, 40, [{ x: 8, y: 8, width: 20, height: 20 }]));
    expect(rowRuns(ours.data, ours.info.width, 7)).toEqual([]);
    expect(rowRuns(ours.data, ours.info.width, 8).length).toBe(1);
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
