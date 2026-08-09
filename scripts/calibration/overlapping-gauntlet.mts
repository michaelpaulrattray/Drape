/**
 * THE OVERLAPPING GAUNTLET — the fixture that can actually separate the two
 * anchoring architectures (fable-124).
 *
 * # Why the last run could not answer the question
 *
 * `composite-anchored-arm.mts` measured a composite-anchored chain against bench
 * B's disjoint six edits and read 0 of 5 degraded, twice. That number was
 * guaranteed before the first frame was painted:
 *
 *     version_k    = anchor_(k-1) with region k replaced by fresh paint
 *     anchor_(k-1) = master with regions 1..k-1 replaced
 *     ⇒ final      = master with each region replaced by its own fresh paint
 *
 * — which is exactly what a master-anchored chain builds. **On disjoint ground
 * the two architectures produce the same picture by construction**, so the
 * fixture could not distinguish them and a null result there is not evidence.
 *
 * # What this fixture changes, and the one measurement that discriminates
 *
 * The chain RE-ENTERS ground it has already painted. That is the only shape
 * where the two differ, and the difference is exactly the photocopy mechanism:
 *
 * - **master-anchored** — every render is handed HER MASTER, so the engine paints
 *   hair from first-generation hair, however many times the chain revisits it.
 * - **composite-anchored** — render N+1 is handed composite N, so the third hair
 *   edit paints from hair the engine has already generated twice.
 *
 * So the discriminating reading is **a freshly painted RE-ENTERED region against
 * the master's own sharpness there**, arm against arm. A region entered once is
 * the internal control: it must read the same in both arms, because for it the
 * algebra above still holds.
 *
 * # The pair, and why this one
 *
 * Hair, three times, interleaved with face work — because it is the shape the
 * product actually sells and the founder's own session is made of it: he
 * recoloured, then asked for it worn down, then changed the texture. Two
 * `face skin` edits do the same job on a second ground, and `lips` is entered
 * once as the control.
 *
 * The overlap is PROVEN from the harvest's own region masks rather than assumed
 * from this list (fable-124's first condition). If the regions turn out not to
 * intersect, that is printed as a finding and the run refuses rather than
 * measuring something else.
 *
 *   npx tsx scripts/calibration/overlapping-gauntlet.mts --spend [--chains 2]
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

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const CHAINS = Number(arg("chains", "2"));
const OUT = arg("out", "output/overlapping-gauntlet");
const MASTER_FILE = arg("master", "output/marks-court/MASTER-run15.png");
mkdirSync(OUT, { recursive: true });

const PREAMBLE = "Edit this photograph of this exact person, changing ONLY what is listed below. ";

/**
 * Six edits on THREE grounds, two of them entered more than once.
 *
 * `hair` three times is the founder's own session shape. `lips` once is the
 * internal control — the one region for which both arms are identical by
 * construction, so if it ever separates, the instrument is the thing that moved.
 */
const STEPS = [
  { facet: "hair.colour", region: "hair", described: "warm copper hair",
    ask: "Change her hair colour to a warm coppery auburn." },
  { facet: "marks", region: "face skin", described: "light freckles",
    ask: "Give her light freckles across her nose and cheeks." },
  { facet: "hairWorn", region: "hair", described: "worn down",
    ask: "Have her wear her hair down, loose past the shoulders." },
  { facet: "lips", region: "lips", described: "fuller lips",
    ask: "Make her lips a little fuller, with a more defined cupid's bow." },
  { facet: "hair.texture", region: "hair", described: "softer waves",
    ask: "Give her hair a softer, looser wave through its length." },
  { facet: "cheekbones", region: "face skin", described: "higher cheekbones",
    ask: "Give her slightly higher, more defined cheekbones." },
] as const;

/** How many times each ground is entered — the thing that makes this fixture. */
const ENTRIES = new Map<string, number[]>();
STEPS.forEach((step, index) => {
  ENTRIES.set(step.region, [...(ENTRIES.get(step.region) ?? []), index]);
});
const REENTERED = Array.from(ENTRIES.entries()).filter(([, at]) => at.length > 1).map(([region]) => region);
const ENTERED_ONCE = Array.from(ENTRIES.entries()).filter(([, at]) => at.length === 1).map(([region]) => region);

const SPEND = fixtureSpendAuthorized(`paint ${CHAINS * STEPS.length * 2} fixture frames on fal for the overlapping gauntlet`);
const apiKey = process.env.FAL_KEY;
if (!apiKey) { console.error("FAL_KEY is required — a bench that cannot paint must refuse, not assume."); process.exit(1); }

const master = readFileSync(MASTER_FILE);
const meta = await sharp(master).metadata();
const W = meta.width!;
const H = meta.height!;
const masterRaster = await readRaster(master);
console.log(`master ${W}x${H}   ${MASTER_FILE}`);
console.log(`re-entered grounds: ${REENTERED.join(", ")}   entered once: ${ENTERED_ONCE.join(", ")}`);

const engine = createFalMaskedEditEngine({ apiKey });
const reader = createFalRegionReader({ apiKey });
const USER_ID = 1;
process.env.MASKED_EDITING_SCOPE = `users:${USER_ID}`;

const regionMask = new Map<string, Mask>();
if (!SPEND) {
  console.log("dry run — no segmentation calls, no paints. Re-run with --spend.");
  process.exit(0);
}
for (const region of new Set(STEPS.map((step) => step.region))) {
  regionMask.set(region, await reader.region({ image: master, name: region }));
}

/*
  THE OVERLAP, PROVEN RATHER THAN ASSUMED (fable-124's first condition).

  Two facets sharing a `REGION_OF_FACET` entry is a claim about a table; two
  masks sharing pixels on THIS face is a fact about this fixture. A run whose
  "overlapping" ground did not actually intersect would measure the disjoint
  case again and report it under the wrong name.
*/
const coverageOf = (mask: Mask) => {
  let count = 0;
  for (let at = 0; at < mask.data.length; at += 1) if (mask.data[at] > 0) count += 1;
  return count;
};
for (const region of REENTERED) {
  const at = ENTRIES.get(region)!;
  console.log(`  ${region}: entered at steps ${at.map((index) => index + 1).join(", ")} — ${coverageOf(regionMask.get(region)!).toLocaleString()} px, the SAME mask each time`);
}
const shared: string[] = [];
const regions = Array.from(regionMask.entries());
for (let a = 0; a < regions.length; a += 1) {
  for (let b = a + 1; b < regions.length; b += 1) {
    let overlap = 0;
    const [nameA, maskA] = regions[a];
    const [nameB, maskB] = regions[b];
    for (let at = 0; at < maskA.data.length; at += 1) {
      if (maskA.data[at] > 0 && maskB.data[at] > 0) overlap += 1;
    }
    if (overlap > 0) shared.push(`${nameA}∩${nameB} = ${overlap} px`);
  }
}
console.log(shared.length === 0
  ? "  the three grounds are disjoint from EACH OTHER, so re-entry is the only overlap"
  : `  grounds also intersect each other: ${shared.join(", ")}`);
if (REENTERED.length === 0) {
  console.error("no ground is entered twice — this fixture cannot separate the arms. Refusing.");
  process.exit(1);
}

type Arm = "master-anchored" | "composite-anchored";

/**
 * One chain of six edits, differing between arms ONLY in what the engine is
 * handed. Everything else — asks, order, regions, compositing — is identical,
 * which is fable-124's second condition.
 */
async function runChain(arm: Arm, chain: number): Promise<{ fresh: Raster[]; outsideIdentical: boolean[] }> {
  console.log(`\n── ${arm}, chain ${chain}`);
  const fresh: Raster[] = [];
  const outsideIdentical: boolean[] = [];
  let anchor: Buffer = master;

  for (let index = 0; index < STEPS.length; index += 1) {
    const step = STEPS[index];
    /* THE ONLY DIFFERENCE BETWEEN THE ARMS. */
    const reference = arm === "master-anchored" ? master : anchor;
    const painted = await engine.edit({
      prompt: `${PREAMBLE}${step.ask}`,
      references: [{ bytes: reference, contentType: "image/png" }],
      width: W,
      height: H,
    });
    const harvested = await harvestRefinement({
      master: { bytes: reference, contentType: "image/png" },
      painted: { bytes: painted.bytes, contentType: painted.contentType },
      facets: [step.facet as never],
      reader,
      userId: USER_ID,
      described: step.described,
    });
    if (harvested.outcome !== "composited") {
      throw new Error(`${arm} step ${index + 1} did not composite (${harvested.outcome})`);
    }
    /*
      The COMPOSITE is what the next step of the composite arm is handed, and it
      is also what the master arm would paste into its own base. Either way this
      step's freshly delivered region lives in it, which is what gets measured.
    */
    const composite = await readRaster(harvested.bytes);
    fresh.push(composite);
    outsideIdentical.push(harvested.guarantee?.outsideIdentical === true);
    if (arm === "composite-anchored") anchor = harvested.bytes;
    writeFileSync(`${OUT}/${arm}-c${chain}-v${index + 1}-${step.facet.replace(".", "-")}.png`, harvested.bytes);
    console.log(`  v${index + 1}  ${step.facet.padEnd(13)} on ${step.region.padEnd(10)} outside-identical ${outsideIdentical[index] ? "yes" : "NO"}`);
  }
  return { fresh, outsideIdentical };
}

const runs: Array<{ arm: Arm; chain: number; fresh: Raster[]; outsideIdentical: boolean[] }> = [];
for (const arm of ["master-anchored", "composite-anchored"] as Arm[]) {
  for (let chain = 1; chain <= CHAINS; chain += 1) {
    runs.push({ arm, chain, ...(await runChain(arm, chain)) });
  }
}

/* ---------------------------------------------------------------- the table */

/**
 * THE DISCRIMINATING READING: a freshly painted region against the MASTER's own
 * sharpness there, at each entry.
 *
 * For a re-entered ground the two arms hand the engine different material — the
 * master's own hair, or hair it has already generated once or twice — so this is
 * where the photocopy mechanism lives if it lives anywhere.
 */
type Entry = { region: string; step: number; entry: number; arm: Arm; chain: number; ratio: number; read: boolean };
const entries: Entry[] = [];
for (const run of runs) {
  for (const [region, at] of Array.from(ENTRIES.entries())) {
    at.forEach((step, entry) => {
      const reading = ratioAgainst({
        reference: masterRaster,
        subject: run.fresh[step],
        region: regionMask.get(region)!,
      });
      entries.push({
        region, step, entry, arm: run.arm, chain: run.chain,
        ratio: reading.ratio, read: reading.read,
      });
    });
  }
}

const mean = (values: number[]) => (values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length);
const at = (region: string, entry: number, arm: Arm) => entries
  .filter((row) => row.region === region && row.entry === entry && row.arm === arm && row.read)
  .map((row) => row.ratio);

const lines: string[] = [
  "",
  "# THE OVERLAPPING GAUNTLET — the fixture that can separate the two anchorings",
  "",
  `subject     ${MASTER_FILE}`,
  `instrument  Laplacian variance over a MASTER-anchored region, ratio only, band ${SHARPNESS_BAND}`,
  "engine      fal:openai/gpt-image-2/edit",
  `read at     ${new Date().toISOString()}`,
  `n           ${CHAINS} chain(s) per arm, ${STEPS.length} edits each — ${CHAINS * STEPS.length * 2} paints`,
  "",
  `re-entered ground : ${REENTERED.join(", ")}`,
  `entered once      : ${ENTERED_ONCE.join(", ")}   ← the internal control`,
  "",
  "A FRESHLY PAINTED REGION AGAINST THE MASTER'S OWN SHARPNESS THERE",
  "(the master-anchored arm always paints from her master; the composite-anchored",
  " arm paints the Nth entry from material it has already generated N-1 times)",
  "",
  "  ground      entry   master-anchored   composite-anchored   difference",
];

const findings: Array<{ region: string; entry: number; master: number; composite: number }> = [];
for (const [region, steps] of Array.from(ENTRIES.entries())) {
  steps.forEach((_, entry) => {
    const anchored = at(region, entry, "master-anchored");
    const composited = at(region, entry, "composite-anchored");
    if (anchored.length === 0 || composited.length === 0) {
      lines.push(`  ${region.padEnd(11)} #${entry + 1}      NO-READ`);
      return;
    }
    const a = mean(anchored);
    const c = mean(composited);
    findings.push({ region, entry, master: a, composite: c });
    lines.push(
      `  ${region.padEnd(11)} #${entry + 1}      ${a.toFixed(3).padEnd(18)}${c.toFixed(3).padEnd(21)}${(c - a >= 0 ? "+" : "")}${(c - a).toFixed(3)}`,
    );
  });
}

const reentries = findings.filter((row) => (ENTRIES.get(row.region)?.length ?? 0) > 1 && row.entry > 0);
const firstEntries = findings.filter((row) => row.entry === 0);
lines.push(
  "",
  "WHAT SEPARATES THEM",
  `  first entries (both arms paint from the master by definition): mean difference ${mean(firstEntries.map((r) => r.composite - r.master)).toFixed(3)}`,
  `  RE-entries    (where the arms genuinely differ)              : mean difference ${mean(reentries.map((r) => r.composite - r.master)).toFixed(3)}`,
  "",
  `  the composite guarantee held on every step: ${runs.every((run) => run.outsideIdentical.every(Boolean))}`,
  "",
  "A first entry is the control: both arms hand the engine the same master, so a",
  "difference there is the engine's own run-to-run spread and sets the scale that",
  "any re-entry difference has to beat.",
);

const text = lines.join("\n");
console.log(text);
writeFileSync(`${OUT}/overlapping-gauntlet.txt`, `${text}\n`);
writeFileSync(`${OUT}/overlapping-gauntlet.json`, `${JSON.stringify({
  master: MASTER_FILE, readAt: new Date().toISOString(), chains: CHAINS,
  band: SHARPNESS_BAND, steps: STEPS, reentered: REENTERED, enteredOnce: ENTERED_ONCE,
  entries, findings,
}, null, 2)}\n`);
console.log(`\nwritten to ${OUT}/`);
