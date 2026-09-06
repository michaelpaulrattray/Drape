/**
 * THE THIRD ARM — a chain anchored on the previous COMPOSITE (fable-120 half 2).
 *
 * # The question the founder has to answer, and why it has no evidence yet
 *
 * Two designs are partial alternatives to each other:
 *
 * - **delivered-anchored segments** — keep cutting from the master, but cut the
 *   mask from the DELIVERED thing's own extent. Costs a new boundary class,
 *   surrender rules for grown grounds, and a bigger purge.
 * - **chain anchoring** — anchor render N+1 on composite N. Most of the above
 *   becomes unnecessary, and the cost is that the picture is re-encoded by a
 *   generative engine on every step.
 *
 * The founder chose patches (D-86, base anchoring) **before this class of
 * evidence existed**, and the argument against chain anchoring has been the
 * photocopy-of-a-photocopy — which bench B measures at TIER 3, on the wrong
 * animal. Its control re-anchors on the previous raw FRAME, so the whole picture
 * is regenerated every step; 3 of 5 regions read degraded, as they should.
 *
 * **A composite-anchored chain is a different animal.** Outside the applied
 * region the composite is byte-identical to its own anchor, so untouched ground
 * is COPIED, not re-imagined — only the repainted region re-encodes, and only
 * once per step. Nobody has ever measured it. So the founder has been asked to
 * choose between a measured complexity and a FEARED degradation.
 *
 * This arm measures the degradation. Same master, same six asks, same regions,
 * same sharpness instrument as bench B, so the three columns are comparable.
 *
 * # What it does NOT do
 *
 * It writes no rows and needs no database: a composite-anchored chain keeps
 * nothing, which is the entire point of it. It is therefore not bench B with a
 * flag — it is the arm bench B cannot host.
 *
 *   npx tsx scripts/calibration/composite-anchored-arm.mts --spend [--chains 2]
 */
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

import { createFalMaskedEditEngine } from "../../server/providers/falImages.js";
import { createFalRegionReader } from "../../server/castingV2/falRegionReader.js";
import { harvestRefinement } from "../../server/castingV2/maskedRefine.js";
import { readRaster, type Mask, type Raster } from "../../server/castingV2/maskedComposite.js";
import { ratioAgainst, SHARPNESS_BAND } from "../../server/castingV2/sharpness.js";
import { fixtureSpendAuthorized } from "../lib/stopline.mts";
import { parseStrictArgsOrRefuse } from "../lib/strictArgs.mts";

/**
 * THIS ARM'S WHOLE VOCABULARY, DECLARED SO A WORD OUTSIDE IT REFUSES (#345).
 *
 * The reader here could not fail on a word it was never asked about, so a
 * mistyped `--chians` fell back to 2 chains and this arm painted its fixtures
 * anyway — a provider spend on a line the operator had already got wrong.
 */
const ARGS = parseStrictArgsOrRefuse(process.argv.slice(2), {
  value: ["chains", "out", "master"],
  boolean: [],
});
function arg(name: string, fallback = ""): string {
  return ARGS.value(name) ?? fallback;
}

const CHAINS = Number(arg("chains", "2"));
const OUT = arg("out", "output/composite-anchored");
const MASTER_FILE = arg("master", "output/marks-court/MASTER-run15.png");
mkdirSync(OUT, { recursive: true });

/* The named door, typed on purpose. The freeze covers account spend; a fixture
   paint is provider balance and has its own name so it is never passed as an
   option somebody did not read (fable-119/120). */
const SPEND = fixtureSpendAuthorized(`paint ${CHAINS * 6} fixture frames on fal for the composite-anchored arm`);
const apiKey = process.env.FAL_KEY;
if (!apiKey) { console.error("FAL_KEY is required — a bench that cannot paint must refuse, not assume."); process.exit(1); }

/* Bench B's own steps, verbatim, because the columns are only comparable if the
   asks are identical. A second copy of this list that drifts by one adjective
   would produce a difference nobody could attribute. */
const PREAMBLE = "Edit this photograph of this exact person, changing ONLY what is listed below. ";
const STEPS = [
  { facet: "hair.colour", region: "hair", described: "warm copper hair",
    ask: "Change her hair colour to a warm coppery auburn." },
  { facet: "eye.colour", region: "eyes", described: "seafoam green eyes",
    ask: "Change her eye colour to a clear seafoam green." },
  { facet: "brows", region: "eyebrows", described: "fuller, straighter brows",
    ask: "Make her eyebrows fuller and straighter, with a softer arch." },
  { facet: "lips", region: "lips", described: "fuller lips",
    ask: "Make her lips a little fuller, with a more defined cupid's bow." },
  { facet: "nose", region: "nose", described: "a narrower nose bridge",
    ask: "Make the bridge of her nose slightly narrower and straighter." },
  { facet: "ears", region: "ear", described: "smaller, neater ears",
    ask: "Make her ears slightly smaller and set a little closer to her head." },
] as const;

/** Bench B's last run, for the two columns this arm is being compared against. */
const BENCH_B = "output/bench-b/bench-b.json";

const master = readFileSync(MASTER_FILE);
const meta = await sharp(master).metadata();
const W = meta.width!;
const H = meta.height!;
const masterRaster = await readRaster(master);
console.log(`master ${W}x${H}   ${MASTER_FILE}`);

const engine = createFalMaskedEditEngine({ apiKey });
const reader = createFalRegionReader({ apiKey });

/*
  REGIONS OFF THE MASTER, ONCE — bench B's rule and the reason its numbers mean
  anything. A region re-read on the frame under test would let the measurement
  wander to wherever the answer is convenient, and in a chain that wander
  compounds.
*/
const regionMask = new Map<string, Mask>();
if (SPEND) {
  /*
    BEHIND THE DOOR TOO, and this is a correction rather than a precaution: the
    first dry run of this script made six fal segmentation calls before reaching
    the paint gate. A "dry run" that quietly spends provider balance is the same
    class of defect as a control that cannot fail — the flag says one thing and
    the wire does another. There is nothing to measure without paint, so there is
    nothing to segment either.
  */
  for (const step of STEPS) {
    regionMask.set(step.region, await reader.region({ image: master, name: step.region }));
  }
} else {
  console.log("dry run — no segmentation calls either");
}

/* The masked path is per-user; this harness has no user, so it names one. */
const USER_ID = 1;
process.env.MASKED_EDITING_SCOPE = `users:${USER_ID}`;

type ChainResult = {
  chain: number;
  versions: Raster[];
  /** How much of each step's own frame the composite let through, for the record. */
  applied: number[];
  outsideIdentical: boolean[];
};

async function runChain(chain: number): Promise<ChainResult> {
  console.log(`\n── chain ${chain}: each render anchored on the previous COMPOSITE\n`);
  const versions: Raster[] = [];
  const applied: number[] = [];
  const outsideIdentical: boolean[] = [];
  let anchor: Buffer = master;

  for (let index = 0; index < STEPS.length; index += 1) {
    const step = STEPS[index];
    if (!SPEND) { console.log(`  [dry] ${step.facet}`); continue; }
    const painted = await engine.edit({
      prompt: `${PREAMBLE}${step.ask}`,
      /* THE WHOLE POINT: the reference is the previous COMPOSITE, not the
         master and not the previous raw frame. */
      references: [{ bytes: anchor, contentType: "image/png" }],
      width: W,
      height: H,
    });
    /*
      And the composite is taken against that same anchor, so "outside the
      applied region, byte-identical" is a statement about the picture the user
      was last looking at — which is exactly what makes this arm different from
      the photocopy control.
    */
    const harvested = await harvestRefinement({
      master: { bytes: anchor, contentType: "image/png" },
      painted: { bytes: painted.bytes, contentType: painted.contentType },
      facets: [step.facet as never],
      reader,
      userId: USER_ID,
      described: step.described,
    });
    if (harvested.outcome !== "composited") {
      throw new Error(`step ${index + 1} did not composite (${harvested.outcome}) — the arm would be measuring the raw frame`);
    }
    anchor = harvested.bytes;
    writeFileSync(`${OUT}/chain${chain}-v${index + 1}-${step.facet.replace(".", "-")}.png`, anchor);
    versions.push(await readRaster(anchor));
    applied.push(harvested.guarantee?.zoneCoverage ?? 0);
    outsideIdentical.push(harvested.guarantee?.outsideIdentical === true);
    console.log(
      `  v${index + 1}  ${step.facet.padEnd(12)} zone ${(applied[index] * 100).toFixed(2)}%`
      + `  outside-identical ${outsideIdentical[index] ? "yes" : "NO"}`,
    );
  }
  return { chain, versions, applied, outsideIdentical };
}

const results: ChainResult[] = [];
for (let chain = 1; chain <= CHAINS; chain += 1) results.push(await runChain(chain));

if (!SPEND) {
  console.log("\nDRY RUN — no frames painted. Re-run with --spend.");
  process.exit(0);
}

/* --------------------------------------------------------------- the table */

/**
 * Each region measured at the step that delivered it against the LAST frame of
 * its own chain — identical in form to bench B's tier 2 and tier 3, so the three
 * columns answer one question.
 */
type Reading = { region: string; ratio: number; read: boolean; withinBand: boolean };
const perChain: Reading[][] = results.map(({ versions }) => {
  const readings: Reading[] = [];
  for (let index = 0; index < STEPS.length - 1; index += 1) {
    const reading = ratioAgainst({
      reference: versions[index],
      subject: versions[versions.length - 1],
      region: regionMask.get(STEPS[index].region)!,
    });
    readings.push({
      region: STEPS[index].region,
      ratio: reading.ratio,
      read: reading.read,
      withinBand: reading.withinBand,
    });
  }
  return readings;
});

/* And each step's FRESH region against the MASTER's sharpness there — the
   accumulated cost of anchoring, which the within-chain reading cannot see. */
const freshAgainstMaster: Reading[][] = results.map(({ versions }) => STEPS.map((step, index) => {
  const reading = ratioAgainst({
    reference: masterRaster,
    subject: versions[index],
    region: regionMask.get(step.region)!,
  });
  return { region: step.region, ratio: reading.ratio, read: reading.read, withinBand: reading.withinBand };
}));

let benchB: any = null;
try { benchB = JSON.parse(readFileSync(BENCH_B, "utf8")); } catch { /* stated below */ }
const columnOf = (lines: string[] | undefined, region: string): string => {
  const line = (lines ?? []).find((entry) => entry.startsWith(region));
  return line ? line.slice(region.length).trim() : "—";
};

const lines: string[] = [
  "",
  "# THE THIRD ARM — a chain anchored on the previous COMPOSITE",
  "",
  `subject     ${MASTER_FILE}, the same six sequential edits bench B runs`,
  `instrument  Laplacian variance over a MASTER-anchored region, ratio only, band ${SHARPNESS_BAND}`,
  "engine      fal:openai/gpt-image-2/edit",
  `read at     ${new Date().toISOString()}`,
  `n           ${CHAINS} chain(s) of ${STEPS.length} edits on this arm`,
  benchB
    ? `compared to bench B's run of ${benchB.readAt} — n=1 on each of its two arms, stated because it is not 2`
    : "bench B's report was not readable, so the other two columns are absent rather than guessed",
  "",
  "EACH REGION AT THE STEP THAT DELIVERED IT → THE LAST FRAME OF ITS CHAIN",
  "",
  "  region     patched(B)     photocopy(B)   " + results.map((r) => `composite#${r.chain}`).join("   "),
];

for (let index = 0; index < STEPS.length - 1; index += 1) {
  const region = STEPS[index].region;
  lines.push(
    `  ${region.padEnd(10)} ${columnOf(benchB?.patched, region).padEnd(14)} `
    + `${columnOf(benchB?.control, region).padEnd(14)} `
    + perChain.map((readings) => {
      const reading = readings[index];
      return reading.read
        ? `${reading.ratio.toFixed(3)} ${reading.withinBand ? "held" : "DEGRADED"}`.padEnd(15)
        : "NO-READ".padEnd(15);
    }).join(""),
  );
}

lines.push(
  "",
  "EACH STEP'S FRESH REGION AGAINST THE MASTER'S OWN SHARPNESS THERE",
  "  (bench B's patched chain paints every step from the master, so its numbers",
  "   are first-generation by construction; this arm's are not)",
  "",
  "  region     fresh(B)       " + results.map((r) => `composite#${r.chain}`).join("   "),
);
for (let index = 0; index < STEPS.length; index += 1) {
  const region = STEPS[index].region;
  lines.push(
    `  ${region.padEnd(10)} ${columnOf(benchB?.fresh, region).padEnd(14)} `
    + freshAgainstMaster.map((readings) => (
      readings[index].read ? readings[index].ratio.toFixed(3).padEnd(15) : "NO-READ".padEnd(15)
    )).join(""),
  );
}

const degraded = perChain.map((readings) => readings.filter((r) => r.read && !r.withinBand).length);
const readCount = perChain.map((readings) => readings.filter((r) => r.read).length);
lines.push(
  "",
  "WHAT THIS ARM READ",
  ...results.map((result, at) => `  chain ${result.chain}: ${degraded[at]} of ${readCount[at]} regions read degraded`),
  `  bench B's photocopy control, for scale: ${(benchB?.control ?? []).filter((l: string) => l.includes("DEGRADED")).length}`
  + ` of ${(benchB?.control ?? []).length} — and its patched arm: `
  + `${(benchB?.patched ?? []).filter((l: string) => l.includes("DEGRADED")).length} of ${(benchB?.patched ?? []).length}`,
  "",
  "  the composite's own guarantee held on every step: "
  + results.every((r) => r.outsideIdentical.every(Boolean)),
  "",
  "This is a MEASUREMENT, not a recommendation. It exists so the founder compares",
  "delivered-anchored segments' real complexity against chain anchoring's real",
  "degradation rather than a feared one.",
);

const text = lines.join("\n");
console.log(text);
writeFileSync(`${OUT}/composite-anchored-arm.txt`, `${text}\n`);
writeFileSync(`${OUT}/composite-anchored-arm.json`, `${JSON.stringify({
  master: MASTER_FILE,
  readAt: new Date().toISOString(),
  chains: CHAINS,
  band: SHARPNESS_BAND,
  perChain,
  freshAgainstMaster,
  applied: results.map((r) => r.applied),
  outsideIdentical: results.map((r) => r.outsideIdentical),
}, null, 2)}\n`);
console.log(`\nwritten to ${OUT}/`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
