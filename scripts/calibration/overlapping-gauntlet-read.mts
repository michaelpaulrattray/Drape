/**
 * READ THE OVERLAPPING GAUNTLET'S FRAMES — including the run that did not finish.
 *
 * The paint run died in its fourth chain: the engine returned a `lips` frame
 * whose change the harvest could not find, and `assertUsable` refused it — the
 * product behaving correctly, and a harness that treated a legitimate refusal as
 * a crash. Twenty-one frames were already bought and written.
 *
 * Repainting them to satisfy a script's control flow would spend real provider
 * balance to recover from a bug in the script. So the measurement is taken from
 * the frames on disk, and **every cell states its own n** rather than inheriting
 * one from the run's intent.
 *
 *   npx tsx scripts/calibration/overlapping-gauntlet-read.mts
 */
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { createFalRegionReader } from "../../server/castingV2/falRegionReader.js";
import { readRaster, type Mask } from "../../server/castingV2/maskedComposite.js";
import { ratioAgainst, SHARPNESS_BAND } from "../../server/castingV2/sharpness.js";

const OUT = "output/overlapping-gauntlet";
const MASTER_FILE = "output/marks-court/MASTER-run15.png";

const STEPS = [
  { facet: "hair.colour", region: "hair" },
  { facet: "marks", region: "face skin" },
  { facet: "hairWorn", region: "hair" },
  { facet: "lips", region: "lips" },
  { facet: "hair.texture", region: "hair" },
  { facet: "cheekbones", region: "face skin" },
] as const;

const ENTRIES = new Map<string, number[]>();
STEPS.forEach((step, index) => ENTRIES.set(step.region, [...(ENTRIES.get(step.region) ?? []), index]));

const apiKey = process.env.FAL_KEY;
if (!apiKey) { console.error("FAL_KEY is required for the region masks"); process.exit(1); }
const reader = createFalRegionReader({ apiKey });

const master = readFileSync(MASTER_FILE);
const masterRaster = await readRaster(master);
const regionMask = new Map<string, Mask>();
for (const region of new Set(STEPS.map((step) => step.region))) {
  regionMask.set(region, await reader.region({ image: master, name: region }));
}

const fileFor = (arm: string, chain: number, index: number) =>
  `${OUT}/${arm}-c${chain}-v${index + 1}-${STEPS[index].facet.replace(".", "-")}.png`;

type Cell = { ratios: number[]; missing: number };
const readings = new Map<string, Cell>();
const key = (region: string, entry: number, arm: string) => `${region}|${entry}|${arm}`;

for (const arm of ["master-anchored", "composite-anchored"]) {
  for (const chain of [1, 2]) {
    for (const [region, steps] of Array.from(ENTRIES.entries())) {
      for (let entry = 0; entry < steps.length; entry += 1) {
        const path = fileFor(arm, chain, steps[entry]);
        const cell = readings.get(key(region, entry, arm)) ?? { ratios: [], missing: 0 };
        if (!existsSync(path)) {
          /* NOT SILENTLY SKIPPED. A frame the run never bought is a smaller n,
             and a table that hides that is a table claiming evidence it has not
             got — the whole lesson of the previous arm. */
          cell.missing += 1;
        } else {
          const reading = ratioAgainst({
            reference: masterRaster,
            subject: await readRaster(readFileSync(path)),
            region: regionMask.get(region)!,
          });
          if (reading.read) cell.ratios.push(reading.ratio);
        }
        readings.set(key(region, entry, arm), cell);
      }
    }
  }
}

const mean = (values: number[]) => (values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length);
const show = (cell: Cell | undefined) => {
  if (!cell || cell.ratios.length === 0) return "NO FRAME".padEnd(20);
  const spread = cell.ratios.length > 1
    ? `±${((Math.max(...cell.ratios) - Math.min(...cell.ratios)) / 2).toFixed(3)}`
    : "";
  return `${mean(cell.ratios).toFixed(3)} ${spread} n=${cell.ratios.length}`.padEnd(20);
};

const lines: string[] = [
  "",
  "# THE OVERLAPPING GAUNTLET — read off the frames that were actually painted",
  "",
  `subject     ${MASTER_FILE}`,
  `instrument  Laplacian variance over a MASTER-anchored region, ratio only, band ${SHARPNESS_BAND}`,
  "engine      fal:openai/gpt-image-2/edit",
  `read at     ${new Date().toISOString()}`,
  "",
  "21 of 24 frames. The run's fourth chain stopped when the engine returned a",
  "`lips` frame the harvest could not find a change in and the product refused it",
  "— correct behaviour, and a harness that treated a legitimate refusal as fatal.",
  "Every cell states its own n; nothing is averaged across a gap.",
  "",
  "A FRESHLY PAINTED REGION AGAINST THE MASTER'S OWN SHARPNESS THERE",
  "",
  "  ground      entry  master-anchored     composite-anchored  difference",
];

const rows: Array<{ region: string; entry: number; master: number; composite: number; n: number }> = [];
for (const [region, steps] of Array.from(ENTRIES.entries())) {
  for (let entry = 0; entry < steps.length; entry += 1) {
    const a = readings.get(key(region, entry, "master-anchored"));
    const c = readings.get(key(region, entry, "composite-anchored"));
    const difference = a?.ratios.length && c?.ratios.length
      ? `${mean(c.ratios) - mean(a.ratios) >= 0 ? "+" : ""}${(mean(c.ratios) - mean(a.ratios)).toFixed(3)}`
      : "—";
    lines.push(`  ${region.padEnd(11)} #${entry + 1}     ${show(a)}${show(c)}${difference}`);
    if (a?.ratios.length && c?.ratios.length) {
      rows.push({
        region, entry, master: mean(a.ratios), composite: mean(c.ratios),
        n: Math.min(a.ratios.length, c.ratios.length),
      });
    }
  }
}

const firsts = rows.filter((row) => row.entry === 0);
const laters = rows.filter((row) => row.entry > 0);
lines.push(
  "",
  "WHAT SEPARATES THEM",
  `  FIRST entries — both arms hand the engine the same master, so this is the`,
  `                  engine's own run-to-run spread and sets the scale:`,
  `                  mean difference ${mean(firsts.map((r) => r.composite - r.master)).toFixed(3)}  (${firsts.length} ground(s))`,
  `  RE-entries    — the only place the arms genuinely differ:`,
  `                  mean difference ${mean(laters.map((r) => r.composite - r.master)).toFixed(3)}  (${laters.length} reading(s))`,
  "",
  "A re-entry difference has to beat the first-entry spread to mean anything at",
  "all. Read the two numbers together or not at all.",
);

const text = lines.join("\n");
console.log(text);
writeFileSync(`${OUT}/overlapping-gauntlet.txt`, `${text}\n`);
writeFileSync(`${OUT}/overlapping-gauntlet.json`, `${JSON.stringify({
  master: MASTER_FILE, readAt: new Date().toISOString(), band: SHARPNESS_BAND,
  framesExpected: 24, framesRead: Array.from(readings.values()).reduce((total, cell) => total + cell.ratios.length, 0),
  rows,
}, null, 2)}\n`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
