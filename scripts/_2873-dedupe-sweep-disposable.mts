/**
 * THE NEAR-DUPLICATE RULE, MEASURED RATHER THAN PICKED — #2873's step 1 and 2.
 *
 * #2873's own "what would close this": *"Measure the piece count and the
 * garment-level hit rate across a band of thresholds (0.70 … 0.95) and a
 * minimum-area floor, on the court's three saved fixtures"*, then *"pick the
 * rule on those numbers, and state the piece count it leaves on each fixture"*.
 * This is that measurement.
 *
 * It reads `<id>-RAW.bin`, written by `_2873-raw-split-buy-disposable.mts`, and
 * the court's own `<id>-truth.bin`. **No provider call for the geometry** — one
 * cached `detect` per fixture for the face boxes §6 needs, and the cache file is
 * written on the first run so later runs are free.
 *
 * # THE CONTROL PAIR, BECAUSE AN INSTRUMENT GETS ONE BEFORE ITS VERDICTS COUNT
 *
 * Working law 2. The band includes a **threshold of 1.01, which can never fire**
 * — no two masks have an IoU above 1 — so that row is the shipped road exactly
 * as it stands today, and it must reproduce #2873's measured 26 / 27 / 28. If it
 * does not, the harness is reading something other than the product and no
 * other row in the table means anything. The positive control is the other end:
 * a threshold of 0.70 must drop pieces on every fixture.
 *
 * # TWO PLACEMENTS, AND ONE OF THE THREE POSSIBLE ONES IS STRUCTURALLY DEAD
 *
 * - **front** — dedupe the arriving masks, then his three rules. The court's own
 *   order (`court.mjs:67` runs `dedupe` before it saves or scores anything), and
 *   therefore the order every figure in the design's §8 was taken on.
 * - **bodies** — his main-body rule first, then dedupe, then the rest. The case
 *   for it: a raw mask's speckle is noise, so two masks of the same garment
 *   agree MORE once each is trimmed to its main body, and a threshold compared
 *   on trimmed bodies is comparing the things rather than the noise.
 * - ⚠ **after `cleanSplit` is not measured because it cannot do anything, and
 *   that is a fact about the code rather than a judgement.** The arbitration
 *   gives every contested pixel to exactly one winner, so the pieces it returns
 *   are pairwise DISJOINT — every pair's IoU is 0 and no threshold in (0,1] can
 *   fire. That is also the mechanism behind #2873: 32 near-identical masks are
 *   not collapsed by the contest, they are CARVED into 32 slivers of each other.
 *   `referenceSplitCleanup.test.ts` holds the disjointness as an arm so this
 *   sentence stays true.
 *
 * # WHAT IS REPORTED, AND WHY HOVER IS THE ONE THAT MATTERS
 *
 * `best` is the court's garment-level bar — the best IoU any piece reaches
 * against a true cut, at 0.75. But a customer never gets "the best piece": they
 * point at a garment and ONE piece lights. So `hover` is the court's own
 * `hoverSmallestIoU` — the SMALLEST piece containing the thing's pole (the point
 * deepest inside it), which is what `tapSpotlight`'s hit-test map would light —
 * and `hover≥` counts how many of the nine things light as themselves.
 *
 *     npx tsx scripts/_2873-dedupe-sweep-disposable.mts
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { SPLIT_MAIN_BODY_SHARE, cleanSplit } from "../server/castingV2/referenceSplitCleanup";
import { keepPiecesWhere } from "../server/castingV2/falRegionReader";
import type { Mask } from "../server/castingV2/maskedComposite";
import type { PointerBox } from "../server/castingV2/maskedRefine";
import { TAKE_FACE_NOUN } from "../server/castingV2/referenceTake";

const DIR = "C:/Users/Admin/drape-scratch/relay-14spot";
const GARMENT_LEVEL = 0.75;

function envValue(name: string): string {
  const text = readFileSync(new URL("../.env", import.meta.url), "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!/^[A-Z0-9_]+=/.test(line)) continue;
    const at = line.indexOf("=");
    if (line.slice(0, at) !== name) continue;
    return line.slice(at + 1).replace(/^["']|["']$/g, "");
  }
  throw new Error(`no ${name} in the tree's .env`);
}

/**
 * THE FACE BOXES, CACHED ON DISK AFTER THE FIRST BUY.
 *
 * The same endpoint and the same `TAKE_FACE_NOUN` the take road buys, so the
 * number this cell reports is the number production sees. The no-face fixtures
 * are bought too on purpose: a rule inert where there is no person is a control.
 */
async function faceBoxes(id: string, photo: string, width: number, height: number): Promise<PointerBox[]> {
  const cache = `${DIR}/out/${id}-faces.json`;
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, "utf8")) as PointerBox[];
  const image = `data:image/png;base64,${readFileSync(photo).toString("base64")}`;
  const answer = await fetch("https://fal.run/fal-ai/moondream3-preview/detect", {
    method: "POST",
    headers: { Authorization: `Key ${envValue("FAL_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: image, prompt: TAKE_FACE_NOUN }),
  });
  if (!answer.ok) throw new Error(`detect ${answer.status}: ${(await answer.text()).slice(0, 300)}`);
  const json = (await answer.json()) as { objects?: unknown[] };
  const boxes: PointerBox[] = [];
  for (const object of json.objects ?? []) {
    const o = object as Record<string, unknown>;
    const left = Number(o.x_min);
    const top = Number(o.y_min);
    const right = Number(o.x_max);
    const bottom = Number(o.y_max);
    if (![left, top, right, bottom].every((one) => Number.isFinite(one))) continue;
    const clamp = (v: number): number => Math.min(Math.max(v, 0), 1);
    const x = Math.round(clamp(Math.min(left, right)) * width);
    const y = Math.round(clamp(Math.min(top, bottom)) * height);
    const x2 = Math.round(clamp(Math.max(left, right)) * width);
    const y2 = Math.round(clamp(Math.max(top, bottom)) * height);
    if (x2 <= x || y2 <= y) continue;
    boxes.push({ x, y, width: x2 - x, height: y2 - y });
  }
  writeFileSync(cache, JSON.stringify(boxes));
  return boxes;
}

/** The court's on-disk masks are 0/1; this pipeline thresholds at `> 127`. */
function load(path: string, width: number, height: number): Mask[] {
  const bytes = readFileSync(path);
  const size = width * height;
  if (bytes.length % size !== 0) {
    throw new Error(`${path} is ${bytes.length} bytes, not a whole number of ${width}x${height} masks`);
  }
  const out: Mask[] = [];
  for (let at = 0; at * size < bytes.length; at += 1) {
    const slice = bytes.subarray(at * size, (at + 1) * size);
    const data = Buffer.alloc(size);
    for (let p = 0; p < size; p += 1) data[p] = slice[p]! > 0 ? 255 : 0;
    out.push({ data, width, height });
  }
  let live = 0;
  for (const mask of out) for (const byte of mask.data) if (byte > 127) live += 1;
  if (live === 0) throw new Error(`${path}: every mask read as empty — the 0/1 conversion failed`);
  return out;
}

function live(mask: Mask): number {
  let n = 0;
  for (const byte of mask.data) if (byte > 127) n += 1;
  return n;
}

function iou(a: Mask, b: Mask): number {
  let both = 0;
  let either = 0;
  for (let p = 0; p < a.data.length; p += 1) {
    const x = a.data[p]! > 127;
    const y = b.data[p]! > 127;
    if (x && y) both += 1;
    if (x || y) either += 1;
  }
  return either === 0 ? 0 : both / either;
}

/** The point deepest inside a mask — the court's `poleOf`, the spot a hover test uses. */
function poleOf(mask: Mask): { x: number; y: number } {
  const { width, height, data } = mask;
  const depth = new Float32Array(width * height);
  const FAR = 1e9;
  for (let at = 0; at < depth.length; at += 1) depth[at] = data[at]! > 127 ? FAR : 0;
  const near = (at: number, from: number, step: number): void => {
    const candidate = depth[from]! + step;
    if (candidate < depth[at]!) depth[at] = candidate;
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = y * width + x;
      if (depth[at] === 0) continue;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) depth[at] = Math.min(depth[at]!, 1);
      if (x > 0) near(at, at - 1, 1);
      if (y > 0) near(at, at - width, 1);
      if (x > 0 && y > 0) near(at, at - width - 1, 1.414);
      if (x < width - 1 && y > 0) near(at, at - width + 1, 1.414);
    }
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const at = y * width + x;
      if (depth[at] === 0) continue;
      if (x < width - 1) near(at, at + 1, 1);
      if (y < height - 1) near(at, at + width, 1);
      if (x < width - 1 && y < height - 1) near(at, at + width + 1, 1.414);
      if (x > 0 && y < height - 1) near(at, at + width - 1, 1.414);
    }
  }
  let best = -1;
  let bestAt = 0;
  for (let at = 0; at < depth.length; at += 1) {
    if (depth[at]! > best) {
      best = depth[at]!;
      bestAt = at;
    }
  }
  return { x: bestAt % width, y: Math.floor(bestAt / width) };
}

/** THE RULE UNDER TEST — the court's own `dedupe`, with its two numbers freed. */
function dropNearDuplicates(
  pieces: readonly Mask[],
  threshold: number,
  floor: number,
): { kept: Mask[]; dropped: number[] } {
  const order = pieces
    .map((mask, at) => ({ at, mask, pixels: live(mask) }))
    .sort((a, b) => b.pixels - a.pixels);
  const kept: { at: number; mask: Mask }[] = [];
  const dropped: number[] = [];
  for (const one of order) {
    if (one.pixels < floor) {
      dropped.push(one.at);
      continue;
    }
    if (kept.some((k) => iou(k.mask, one.mask) > threshold)) {
      dropped.push(one.at);
      continue;
    }
    kept.push({ at: one.at, mask: one.mask });
  }
  /* Arrival order back, so a piece's index is still its id in the hit-test map. */
  kept.sort((a, b) => a.at - b.at);
  return { kept: kept.map((k) => k.mask), dropped: dropped.sort((a, b) => a - b) };
}

/** His main-body rule on its own, for the `bodies` placement. */
function mainBodies(pieces: readonly Mask[]): Mask[] {
  const out: Mask[] = [];
  for (const piece of pieces) {
    const { kept } = keepPiecesWhere(
      piece,
      (component, all) => component.pixels >= all.largestPixels * SPLIT_MAIN_BODY_SHARE,
    );
    if (kept !== null) out.push(kept);
  }
  return out;
}

type Fixture = { id: string; width: number; height: number; truth: string[] };

const fixtures: Fixture[] = ["worn", "hanger", "product"].map((id) => {
  const r = JSON.parse(readFileSync(`${DIR}/out/result-${id}.json`, "utf8")) as {
    W: number;
    H: number;
    truth: string[];
  };
  return { id, width: r.W, height: r.H, truth: r.truth };
});

/**
 * ⚠ **THE BAND #2873 NAMED IS 0.70 … 0.95 AND THE FIRST RUN'S BEST ROW SAT ON
 * ITS LOWER EDGE** — 0.70, 0.75 and 0.80 all gave 11 / 6 / 8 pieces and 6 of 9
 * things garment-level, where 0.85 gave 13 / 7 / 8 and 0.90 gave 5 of 9. **A
 * measurement whose winner is the edge of its own band has not found a winner,
 * it has found the edge**, so the band is opened downward here rather than the
 * edge being reported as the answer. `--thresholds 0.3,0.4` overrides it.
 */
const THRESHOLDS = (
  process.argv.find((one) => one.startsWith("--thresholds="))?.slice("--thresholds=".length) ??
  "0.3,0.4,0.5,0.55,0.6,0.65,0.7,0.75,0.8,0.85,0.9,0.95,1.01"
)
  .split(",")
  .map((one) => Number(one));
if (THRESHOLDS.some((one) => !Number.isFinite(one))) throw new Error("--thresholds= takes numbers");

/**
 * ⚠ **THE MINIMUM-AREA FLOOR IS KEPT IN THE SWEEP THOUGH THE FIRST RUN SHOWED
 * IT CHANGES NOTHING** — 0, 50 and 500 pixels gave byte-identical rows on all
 * three fixtures at all seven thresholds. That is an ANSWER to the second half
 * of #2873's step 1, not a reason to stop asking: it stays in the grid so the
 * claim is re-derived on every run rather than remembered.
 */
const FLOORS = (
  process.argv.find((one) => one.startsWith("--floors="))?.slice("--floors=".length) ?? "0,50,500"
)
  .split(",")
  .map((one) => Number(one));

const PLACEMENTS = (
  process.argv.find((one) => one.startsWith("--placements="))?.slice("--placements=".length) ?? "front,bodies"
).split(",") as readonly ("front" | "bodies")[];

type Row = {
  fixture: string;
  placement: string;
  threshold: number;
  floor: number;
  arriving: number;
  afterDrop: number;
  pieces: number;
  best: number[];
  hover: number[];
  garment: number;
  hoverGarment: number;
};
const rows: Row[] = [];

for (const fx of fixtures) {
  const raw = load(`${DIR}/out/${fx.id}-RAW.bin`, fx.width, fx.height);
  const truth = load(`${DIR}/out/${fx.id}-truth.bin`, fx.width, fx.height);
  const photo = fx.id === "worn" ? `${DIR}/fixtures/ref-worn.jpg` : `${DIR}/fixtures/ref-${fx.id}.png`;
  const faces = await faceBoxes(fx.id, `${DIR}/frames/${fx.id}/photo.png`, fx.width, fx.height);
  const poles = truth.map((thing) => poleOf(thing));

  console.log(`\n=== ${fx.id} (${fx.width}x${fx.height}) — ${raw.length} raw masks, ${faces.length} face box(es) ===`);
  console.log(`    photo ${photo}`);
  console.log(`    truth: ${fx.truth.map((n, k) => `${n} ${live(truth[k]!)} px @ ${poles[k]!.x},${poles[k]!.y}`).join(" · ")}`);

  /* ---- WHERE THE THRESHOLD ACTUALLY SITS: for every piece, in area order,
     its highest IoU against a LARGER piece. That is the exact quantity the
     rule compares, so the distribution is what a threshold has to be read
     off — the same way SPLIT_FACE_COVER_SHARE was read off the face-cover
     distribution rather than chosen. ---- */
  const byArea = raw.map((mask, at) => ({ at, mask, pixels: live(mask) })).sort((a, b) => b.pixels - a.pixels);
  const against: { at: number; pixels: number; worst: number; with: number }[] = [];
  byArea.forEach((one, index) => {
    let worst = 0;
    let withWhich = -1;
    for (let earlier = 0; earlier < index; earlier += 1) {
      const score = iou(byArea[earlier]!.mask, one.mask);
      if (score > worst) {
        worst = score;
        withWhich = byArea[earlier]!.at;
      }
    }
    against.push({ at: one.at, pixels: one.pixels, worst, with: withWhich });
  });
  const ladder = against
    .slice(1)
    .map((one) => one.worst)
    .sort((a, b) => b - a);
  console.log(`    IoU with a larger piece, every piece, highest first:`);
  console.log(`      ${ladder.map((v) => v.toFixed(3)).join(" ")}`);
  let widest = { gap: 0, above: 1, below: 1 };
  for (let k = 0; k + 1 < ladder.length; k += 1) {
    const gap = ladder[k]! - ladder[k + 1]!;
    if (gap > widest.gap) widest = { gap, above: ladder[k]!, below: ladder[k + 1]! };
  }
  console.log(
    `      widest gap ${widest.gap.toFixed(3)} between ${widest.above.toFixed(3)} and ${widest.below.toFixed(3)}`,
  );

  for (const placement of PLACEMENTS) {
    const arriving = placement === "front" ? raw : mainBodies(raw);
    for (const threshold of THRESHOLDS) {
      for (const floor of FLOORS) {
        const { kept } = dropNearDuplicates(arriving, threshold, floor);
        const cleaned = cleanSplit(kept, faces);
        const best = truth.map((thing) => Math.max(0, ...cleaned.pieces.map((piece) => iou(piece, thing))));
        const hover = truth.map((thing, k) => {
          const pole = poles[k]!;
          const at = pole.y * fx.width + pole.x;
          const containing = cleaned.pieces
            .filter((piece) => piece.data[at]! > 127)
            .map((piece) => ({ piece, pixels: live(piece) }))
            .sort((a, b) => a.pixels - b.pixels);
          return containing.length === 0 ? 0 : iou(containing[0]!.piece, thing);
        });
        rows.push({
          fixture: fx.id,
          placement,
          threshold,
          floor,
          arriving: arriving.length,
          afterDrop: kept.length,
          pieces: cleaned.pieces.length,
          best,
          hover,
          garment: best.filter((v) => v >= GARMENT_LEVEL).length,
          hoverGarment: hover.filter((v) => v >= GARMENT_LEVEL).length,
        });
      }
    }
  }
}

console.log(
  `\n=== THE SWEEP — pieces a customer would hover, and what lights (bar ${GARMENT_LEVEL}) ===\n` +
    `place  thr   floor | worn pieces  best>= hover>= | hanger pieces best>= hover>= | product pieces best>= hover>=`,
);
for (const placement of PLACEMENTS) {
  for (const threshold of THRESHOLDS) {
    for (const floor of FLOORS) {
      const cells = fixtures.map((fx) =>
        rows.find(
          (r) => r.fixture === fx.id && r.placement === placement && r.threshold === threshold && r.floor === floor,
        )!,
      );
      const totalGarment = cells.reduce((sum, c) => sum + c.garment, 0);
      const totalHover = cells.reduce((sum, c) => sum + c.hoverGarment, 0);
      console.log(
        `${placement.padEnd(6)} ${threshold.toFixed(2)}  ${String(floor).padStart(4)} | ` +
          cells
            .map((c) => `${String(c.pieces).padStart(6)}  ${String(c.garment).padStart(5)}  ${String(c.hoverGarment).padStart(5)}`)
            .join(" | ") +
          `  ||  ${totalGarment}/9 best, ${totalHover}/9 hover`,
      );
    }
  }
}

console.log(`\n=== PER-THING hover IoU, every row (the number a pointer actually gets) ===`);
for (const fx of fixtures) {
  console.log(`\n${fx.id}:`);
  for (const placement of PLACEMENTS) {
    for (const threshold of THRESHOLDS) {
      for (const floor of FLOORS) {
        const r = rows.find(
          (one) =>
            one.fixture === fx.id && one.placement === placement && one.threshold === threshold && one.floor === floor,
        )!;
        console.log(
          `  ${placement.padEnd(6)} thr ${threshold.toFixed(2)} floor ${String(r.floor).padStart(4)} | ` +
            `${String(r.arriving).padStart(2)} in -> ${String(r.afterDrop).padStart(2)} kept -> ${String(r.pieces).padStart(2)} pieces | ` +
            fx.truth.map((n, k) => `${n} best ${r.best[k]!.toFixed(3)} hover ${r.hover[k]!.toFixed(3)}`).join(" · "),
        );
      }
    }
  }
}

writeFileSync(`${DIR}/out/2873-sweep.json`, JSON.stringify(rows, null, 1));
console.log(`\nwrote ${DIR}/out/2873-sweep.json`);
console.log("Spend: nothing new for the geometry. One cached detect per fixture, bought on the first run only.");

process.exit(0);
