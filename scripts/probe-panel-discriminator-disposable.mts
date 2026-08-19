/**
 * IS THIS ONE PHOTOGRAPH OR TWO — the panel discriminator, and **the design it
 * was written to test was wrong at the artifact** (§9.10, ratified fable-1090
 * §1 on the strength of my reasoning, corrected here by looking).
 *
 * # What §9.10 proposed, and what the frames actually say
 *
 * The proposal was: count the components of the HEAD mask, because one head's
 * hair can be two components split by her face while two panels are two heads
 * split by background. Both halves of that turned out to be false, and both were
 * false in the same direction — mask arithmetic reasoned about instead of
 * looked at (law 1).
 *
 * Measured, one run, `fal` segmenter, house money:
 *
 * ```
 *   his STYLE specimen  (736x1309, genuinely two panels)
 *     head   1 component  101051px  box 476x424 at (125, 18)
 *     hair   1 component   99859px  box 479x425 at (123, 18)
 *
 *   his COLOUR specimen (736x981, one woman)
 *     head   1 component  158146px  box 476x498 at (146, 14)
 *     hair   1 component  183157px  box 560x721 at (74, 14)
 * ```
 *
 * **The composite read ONE head, and the box is the TOP PANEL ONLY** — 424 pixels
 * of a 1309-pixel frame, confirmed by cutting it and looking (the crop is the
 * profile, nothing of the crown view). So the discriminator cannot fire: a
 * genuine composite and a single portrait both answer "one head".
 *
 * The reason is already banked — **a segmenter answers a CLASS with an
 * INSTANCE** (`ask-what-cannot-be-answered-wrong`). Asked *where is the head* on
 * a frame with two, it returns one of them and says nothing about the other.
 *
 * **And the counterexample was wrong too, in our favour.** Her hair was supposed
 * to arrive as two components split by her face; it arrives as ONE, because hair
 * on both sides of a face joins over the crown. Hair is connected on a head.
 *
 * # WHAT THE SEGMENTER'S ANSWER MEANS FOR THE PRODUCT, which is the real finding
 *
 * §9.3 feared a union spanning both panels with a white bar through it. **That
 * shape does not occur with this reader.** What occurs is worse in a quieter
 * way: the reader silently picks ONE PANEL, and nobody is told — a carrier cut
 * from a customer's two-view reference would be half her reference, chosen by a
 * model, with no record that a choice happened. That is the no-silent-caps class
 * rather than the corrupt-carrier class.
 *
 * # THE DISCRIMINATOR THAT DOES WORK, and it costs nothing
 *
 * A composite is two photographs butted together, so **the seam is a row (or a
 * column) where the picture stops being continuous.** That is measurable in
 * image space with no model at all: the mean absolute difference between one row
 * of pixels and the next, against the frame's own median row-difference.
 *
 * Measured over the whole corpus, and the separation is not marginal:
 *
 * ```
 *   frame        median row-diff   strongest interior row
 *   style          3.60             y=661   98.7   x27   ← the seam, dead centre
 *   colour         5.80             y=800   11.2   x2
 *   tail           3.42             y=1071  11.8   x3
 *   patchwork      7.61             y=158   21.3   x3
 * ```
 *
 * **27x on the composite; nothing above 3x on any single photograph.** The
 * threshold below sits at 10x, between them by a wide margin, and it is stated
 * as measured on n=1 composite rather than as a law.
 *
 * # What this does NOT settle, stated so nobody reads it as more than it is
 *
 * - **One composite.** A collage whose panels happen to be continuous at the
 *   join — same background, aligned — would be missed, and a single photograph
 *   containing a genuinely hard horizontal edge (a table edge, a black band)
 *   could fire it. Both are cheap to add to this probe when a specimen exists.
 * - It finds a CUT, not panels, and says nothing about how many heads are in
 *   each. That is the next question, and it is answerable now that the frame can
 *   be split first: **the segmenter is asked once per panel instead of once per
 *   frame**, which is also what stops it choosing a panel on our behalf.
 * - It does not decide the carrier. The sheet-versus-single-panel question is a
 *   hypothesis with declared arms (§9.10) and a measurement that has not run.
 *
 * # Money
 *
 * The seam scan is **free** — no model, no network, no credit. The segmenter arm
 * that produced the table above is behind `--segment` so its four calls are not
 * re-bought by every run; its numbers are quoted here rather than re-measured.
 *
 *   npx tsx scripts/probe-panel-discriminator-disposable.mts
 *   npx tsx scripts/probe-panel-discriminator-disposable.mts --segment
 */
import "dotenv/config";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { boxOf, componentsOf, maskOf } from "./lib/shapeOnFace.mts";

if (process.env.MYSQL_PUBLIC_URL) {
  throw new Error("dev only — this must not run in the production context");
}

const OUT = path.resolve("output/panel-probe");
await mkdir(OUT, { recursive: true });

const CORPUS = "docs/specs/references/build-two-founder-specimens";

/**
 * How many times the frame's own median row-difference a seam must exceed.
 *
 * Measured rather than chosen, and sitting in a wide gap: the one composite in
 * the corpus reads 27x, and the loudest interior row of any single photograph
 * reads 3x. **Relative to the frame's own median** on purpose — a noisy film
 * scan and a clean studio frame have very different absolute row-differences and
 * the same seam.
 */
const SEAM_RATIO = 10;

/** A seam inside this fraction of the edge is the frame's own border, not a cut. */
const EDGE_MARGIN = 0.05;

type Specimen = { key: string; file: string; looked: string; expect: string };

const CORPUS_SPECIMENS: Specimen[] = [
  {
    key: "style",
    file: `${CORPUS}/hair-style-dark-waves-two-panel.png`,
    looked: "a vertical stack of two photographs of the same man — a profile above, the crown "
      + "and swept fringe from a downward three-quarter below",
    expect: "A SEAM — this is the only composite in the corpus",
  },
  {
    key: "colour",
    file: `${CORPUS}/hair-colour-blocked-sections-copper-platinum-black-silver.png`,
    looked: "one photograph, one woman, four blocked tones, hair down both sides of her face",
    expect: "no seam",
  },
  {
    key: "tail",
    file: `${CORPUS}/tail-scorpion-fashion-photo.png`,
    looked: "one photograph, a person wearing a segmented metallic tail",
    expect: "no seam",
  },
  {
    key: "glasses",
    file: `${CORPUS}/glasses-cateye-blond-model.png`,
    looked: "one photograph, a blond model in cat-eye glasses",
    expect: "no seam",
  },
  {
    key: "patchwork",
    file: `${CORPUS}/tattoo-patchwork-torso-neck-continuation.png`,
    looked: "one photograph, a shirtless heavily tattooed torso cropped at the chin",
    expect: "no seam",
  },
];

type Seam = { axis: "row" | "column"; at: number; ratio: number };

/**
 * The strongest discontinuity along one axis, and the frame's own median.
 *
 * Greyscale on purpose: a seam is a break in the PICTURE, and three channels
 * would triple the work to answer the same question.
 */
function scan(
  data: Buffer,
  width: number,
  height: number,
  axis: "row" | "column",
): { at: number; ratio: number; median: number; value: number } {
  const outer = axis === "row" ? height : width;
  const inner = axis === "row" ? width : height;
  const diffs: number[] = [];
  for (let index = 0; index + 1 < outer; index += 1) {
    let sum = 0;
    for (let across = 0; across < inner; across += 1) {
      const here = axis === "row" ? index * width + across : across * width + index;
      const next = axis === "row" ? (index + 1) * width + across : across * width + index + 1;
      sum += Math.abs(data[here] - data[next]);
    }
    diffs.push(sum / inner);
  }
  const sorted = [...diffs].sort((left, right) => left - right);
  const median = sorted[Math.floor(sorted.length / 2)] || 1;
  const margin = Math.floor(outer * EDGE_MARGIN);
  let at = -1;
  let value = 0;
  for (let index = margin; index < diffs.length - margin; index += 1) {
    if (diffs[index] > value) { value = diffs[index]; at = index; }
  }
  return { at, ratio: value / median, median, value };
}

/** Where this frame is cut, if it is cut at all. */
function seamOf(data: Buffer, width: number, height: number): {
  seam: Seam | null;
  rows: ReturnType<typeof scan>;
  columns: ReturnType<typeof scan>;
} {
  const rows = scan(data, width, height, "row");
  const columns = scan(data, width, height, "column");
  const best = rows.ratio >= columns.ratio
    ? { axis: "row" as const, at: rows.at, ratio: rows.ratio }
    : { axis: "column" as const, at: columns.at, ratio: columns.ratio };
  return { seam: best.ratio >= SEAM_RATIO ? best : null, rows, columns };
}

console.log(`THE SEAM SCAN — free, no model. A seam is >= ${SEAM_RATIO}x the frame's own median.\n`);

let wrong = 0;
for (const specimen of CORPUS_SPECIMENS) {
  const bytes = await readFile(specimen.file);
  const { data, info } = await sharp(bytes).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { seam, rows, columns } = seamOf(data, info.width, info.height);
  console.log(`${specimen.key}  ${info.width}x${info.height}`);
  console.log(`  SEEN BY EYE: ${specimen.looked}`);
  console.log(`  EXPECT: ${specimen.expect}`);
  console.log(
    `  rows    strongest y=${rows.at}  ${rows.value.toFixed(1)}  (${rows.ratio.toFixed(1)}x median ${rows.median.toFixed(2)})`,
  );
  console.log(
    `  columns strongest x=${columns.at}  ${columns.value.toFixed(1)}  (${columns.ratio.toFixed(1)}x median ${columns.median.toFixed(2)})`,
  );
  const found = seam ? `SEAM at ${seam.axis === "row" ? "y" : "x"}=${seam.at} (${seam.ratio.toFixed(1)}x)` : "no seam";
  const right = (seam !== null) === specimen.expect.startsWith("A SEAM");
  if (!right) wrong += 1;
  console.log(`  READ: ${found}   ${right ? "as expected" : "*** NOT AS EXPECTED ***"}`);

  /* A frame that is cut gets its panels written out, because the next question
     is asked of each panel separately and a person should see them first. */
  if (seam) {
    const panels = seam.axis === "row"
      ? [
        { name: "top", left: 0, top: 0, width: info.width, height: seam.at },
        { name: "bottom", left: 0, top: seam.at + 1, width: info.width, height: info.height - seam.at - 1 },
      ]
      : [
        { name: "left", left: 0, top: 0, width: seam.at, height: info.height },
        { name: "right", left: seam.at + 1, top: 0, width: info.width - seam.at - 1, height: info.height },
      ];
    for (const panel of panels) {
      await writeFile(
        path.join(OUT, `${specimen.key}-panel-${panel.name}.png`),
        await sharp(bytes).extract(panel).png().toBuffer(),
      );
      console.log(`    panel ${panel.name}: ${panel.width}x${panel.height} written`);
    }
  }
  console.log("");
}

console.log(wrong === 0
  ? `every specimen read as expected — ${CORPUS_SPECIMENS.length} frames, 1 composite, 4 controls`
  : `*** ${wrong} specimen(s) did not read as expected ***`);

/* ---------------------------------------------------------------- the segmenter arm */

if (process.argv.includes("--segment")) {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) throw new Error("no FAL_KEY — the segmenter arm cannot run");
  console.log("\nTHE SEGMENTER ARM — four calls, house money. Re-measuring the header's table.\n");
  const reader = createFalRegionReader({ apiKey });
  for (const specimen of CORPUS_SPECIMENS.filter((one) => one.key === "style" || one.key === "colour")) {
    const bytes = await readFile(specimen.file);
    console.log(`${specimen.key}  ${specimen.file}`);
    for (const region of ["head", "hair"] as const) {
      const mask = await reader.region({ image: bytes, name: region });
      const loaded = maskOf({ data: mask.data, info: { width: mask.width, height: mask.height } });
      if (!loaded) {
        console.log(`  ${region}: NO MASK — a no-read, not a zero`);
        continue;
      }
      const { kept, sizes } = componentsOf(loaded, 400);
      console.log(`  ${region}: ${kept.length} component(s) over 400px — sizes ${sizes.slice(0, 4).join(", ")}`);
      for (const [index, component] of kept.entries()) {
        const box = boxOf(component, 0);
        console.log(`      #${index + 1}  ${component.pixels}px  box ${box.w}x${box.h} at (${box.x}, ${box.y})`);
        await writeFile(
          path.join(OUT, `${specimen.key}-${region}-${index + 1}-crop.png`),
          await sharp(bytes).extract({ left: box.x, top: box.y, width: box.w, height: box.h }).png().toBuffer(),
        );
      }
    }
  }
}

console.log(`\nartifacts in ${OUT} — the verdict is what a person sees in them, not this log.`);
process.exit(0);
