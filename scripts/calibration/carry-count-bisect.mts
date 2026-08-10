/**
 * THE BISECT — is it the reference COUNT, or the way the reference is NAMED?
 *
 * fable-189 item 1. opus-135 found the graded result: a crop that ADDS what the
 * master lacks carries; a crop that CHANGES a geometry the master owns carries
 * only about a third of the way, and only inside a good recipe; a crop that
 * changes a SURFACE the master owns does not carry at all. But the recipe that
 * carried moved four things at once against the recipe that reverted, and
 * opus-135 said so plainly: it isolated the bundle, not the member.
 *
 *   FAL_KEY=… npx tsx scripts/calibration/carry-count-bisect.mts [--n 3]
 *
 * # WHAT IS ALREADY OUT, AND WHY
 *
 * CROP PROVENANCE is out. The substitution arm sent the SAME bytes that
 * reverted in b (`output/edit-law/mint-lips.png`) and they carried. A factor
 * that is constant across a flip cannot be the flip.
 *
 * That leaves three live members of the bundle:
 *
 *   count        5 references (master + 4 crops)   vs  2 (master + 1 crop)
 *   naming form  "Reference 4 is the exact X"      vs  "Reference 2 is her lips
 *                                                       exactly as they are now"
 *   ask size     "change only her eye colour"      vs  "wear it in a low bun"
 *                (small, non-geometric)                (large, redraws a region)
 *
 * # THE ARM
 *
 * The CARRYING configuration with the other three crops removed. Naming form
 * kept ("the exact fuller lips she has"), ask kept small and non-geometric
 * (eye colour), crop identical, engine identical, n identical.
 *
 *   it CARRIES  → count is out, and so is everything that travels with it.
 *                 Naming form and ask size are the whole story, and the
 *                 assembler's requirement collapses to something cheap: name
 *                 each reference for what it IS, and do not ask for a region
 *                 redraw in the same breath.
 *   it REVERTS  → the crop needs company. The assembler must emit the proven
 *                 count, and the swap pays for slots it would rather not.
 *
 * DECLARED CONFOUND, because dropping count cannot leave position alone: in the
 * carrying recipe the lips crop is reference 4 of 5, here it is 2 of 2. b‴
 * already showed position is live on its own. So a CARRY clears count AND
 * position together; a REVERT leaves the cause inside {count, position,
 * neighbours} and needs one more arm to split. Half the bundle either way.
 *
 * # AND THE NULL CONTROL, WHICH IS THE HALF THAT MAKES THE ARM READABLE
 *
 * The inherited fullness band was measured on THIRTEEN FRAMES FROM ANOTHER
 * RECIPE. This shift's own hard rule, paid for twice: an instrument needs a
 * control that spans the arm's own conditions. So the same prompt runs WITHOUT
 * the lips sentence and WITHOUT the crop — one reference, everything else
 * identical. That gives the arm its own floor, in its own conditions.
 *
 * The null control is also fable-189 item 2, bought by the same paints. Its
 * frames were never sent a lips reference and were never asked about lips, so
 * their shine is natural BY CONSTRUCTION rather than by inference — which is
 * exactly the second bare specimen the natural band was resting an inference
 * on. n=3 instead of the one paint ordered, because a band needs a spread.
 *
 * # AND A FREE CROSS-CHECK, FROM PAINTS ALREADY BOUGHT
 *
 * `c-bigger-*` and `d-oneear-*` in the edit-law cell are five cached frames
 * from the SAME master that were sent earring anchors only — no lips crop, no
 * lips words. They cost nothing but their region reads and they are a second,
 * independent never-saw-a-gloss-crop family. Their weakness is declared: a
 * large edit elsewhere in the frame can move global rendering, and a specular
 * measure can feel that. It is a weaker confound than the inference it
 * replaces, not no confound.
 *
 * # PRE-REGISTERED, BEFORE ANY ARM IS READ
 *
 *   CARRIED   all n bisect readings above max(inherited band hi, null hi)
 *   REVERTED  none of them above it
 *   SPLIT     anything else — not earned at this n, and reported as not earned
 *
 * 2 arms × n=3 = 6 paints at $0.099 = **$0.59**. Declared to Fable in opus-137
 * before it was spent: $0.30 over fable-189's ~$0.30, and the overrun is the
 * null control, which is the thing this shift was told not to skip.
 */
import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import sharp from "sharp";

import { loadMaskFile, maskOf, type FaceMask } from "../lib/shapeOnFace.mts";
import { createFalRegionReader } from "../../server/castingV2/falRegionReader";
import { createFalMaskedEditEngine, FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE } from "../../server/providers/falImages";

const OUT = "output/count-bisect";
const READS = `${OUT}/reads`;
const EDIT_LAW = "output/edit-law";

const arg = (name: string, fallback: string): string => {
  const at = process.argv.indexOf(`--${name}`);
  return at > -1 ? (process.argv[at + 1] ?? fallback) : fallback;
};
const N = Number(arg("n", "3"));
const DRY = process.argv.includes("--dry");

const apiKey = process.env.FAL_KEY;
if (!apiKey) { console.error("FAL_KEY is required"); process.exit(1); }

const reader = createFalRegionReader({ apiKey });
const engine = createFalMaskedEditEngine({ apiKey });
await mkdir(READS, { recursive: true });

let paints = 0;
let reused = 0;
let regionReads = 0;
let spend = 0;

async function readRegion(label: string, bytes: Buffer, name: string, dir = READS): Promise<FaceMask | null> {
  const path = `${dir}/${label}--${name}.png`;
  const cached = await loadMaskFile(path);
  if (cached) return cached;
  if (await readFile(`${path}.no-read`).catch(() => null)) return null;
  const mask = await reader.region({ image: bytes, name, absentIsAnswer: true }).catch(() => null);
  regionReads += 1;
  if (!mask) { await writeFile(`${path}.no-read`, "the reader answered nothing\n"); return null; }
  await writeFile(path, await sharp(mask.data, {
    raw: { width: mask.width, height: mask.height, channels: 1 },
  }).png().toBuffer());
  return maskOf({ data: Buffer.from(mask.data), info: { width: mask.width, height: mask.height } });
}

/* The edit-law cell's own reading, character for character — a bisect measured
   on a different instrument than the thing it bisects would prove nothing. */
const SPECULAR_ABOVE = 50;

async function readLips(label: string, framePath: string, readsDir = READS): Promise<
  { specular: number; fullness: number } | null
> {
  const bytes = await readFile(framePath).catch(() => null);
  if (!bytes) return null;
  const [lips, face] = await Promise.all([
    readRegion(label, bytes, "lips", readsDir),
    readRegion(label, bytes, "face", readsDir),
  ]);
  if (!lips || !face) return null;
  const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== lips.width) return null;
  const luminance: number[] = [];
  for (let index = 0; index < lips.data.length; index += 1) {
    if (lips.data[index] === 0) continue;
    luminance.push(0.2126 * data[index * 3]! + 0.7152 * data[index * 3 + 1]! + 0.0722 * data[index * 3 + 2]!);
  }
  if (luminance.length === 0) return null;
  const median = [...luminance].sort((a, b) => a - b)[Math.floor(luminance.length / 2)]!;
  return {
    specular: luminance.filter((value) => value > median + SPECULAR_ABOVE).length / luminance.length,
    fullness: lips.pixels / face.pixels,
  };
}

/* --------------------------------------------------------------- the inputs */

const masterBytes = await readFile(`${EDIT_LAW}/master.png`);
const meta = await sharp(masterBytes).metadata();
const width = meta.width!;
const height = meta.height!;
const cropFuller = await readFile(`${EDIT_LAW}/mint-lips.png`);

const cell = JSON.parse(await readFile(`${EDIT_LAW}/cell.json`, "utf8"));
const bandFullness = cell.controls.bandFullness as { lo: number; hi: number; mid: number; n: number };
const bandSpecular = cell.controls.bandSpecular as { lo: number; hi: number; mid: number; n: number };
const masterLips = cell.controls.masterLips as { fullness: number; specular: number };
const mintedFullness = cell.lipReadings["a2-fuller"].fullness as number;

const pct = (value: number) => `${(value * 100).toFixed(2)}%`;

console.log(`master ${width}x${height} · the carried crop ${cropFuller.length}B (the bytes that reverted in b)\n`);
console.log("THE BARS THIS ARM IS JUDGED AGAINST");
console.log(`  the minted crop being carried        ${pct(mintedFullness)} full`);
console.log(`  inherited band, ANOTHER recipe n=13  ${pct(bandFullness.lo)}–${pct(bandFullness.hi)}  (master ${pct(masterLips.fullness)})`);
console.log(`  the five-reference recipe carried at  4.51 / 4.63 / 4.44%  — clear of that band`);
console.log(`  natural shine, master ${pct(masterLips.specular)} · inferred family ${pct(bandSpecular.lo)}–${pct(bandSpecular.hi)}\n`);

/* ------------------------------------------------------------------ the arms */

const IDENTITY = [
  "Reference 1 is the photograph of this person — reproduce her exactly: same face, same pose,",
  "same lighting, same framing, same background.",
].join(" ");
const TAIL = [
  "She is wearing her glasses, exactly as in reference 1.",
  "Change only her eye colour to green.",
].join(" ");

const ARMS = [
  {
    id: "bisect-two-ref",
    title: "THE BISECT — the carrying recipe stripped to TWO references. Naming and ask unchanged.",
    prompt: [
      IDENTITY,
      "Reference 2 is the exact fuller lips she has — the same lips, at the same fullness.",
      TAIL,
    ].join(" "),
    references: [masterBytes, cropFuller],
  },
  {
    id: "null-no-crop",
    title: "THE NULL — the same prompt with the lips sentence and the crop removed. One reference.",
    prompt: [IDENTITY, TAIL].join(" "),
    references: [masterBytes],
  },
];

type Row = { label: string; fullness: number | null; specular: number | null };
const rows: Record<string, Row[]> = {};

for (const arm of ARMS) {
  console.log("=".repeat(92));
  console.log(arm.title);
  console.log("=".repeat(92));
  console.log(`  ${arm.references.length} reference${arm.references.length === 1 ? "" : "s"}: "${arm.prompt}"\n`);
  rows[arm.id] = [];
  for (let index = 1; index <= N; index += 1) {
    const label = `${arm.id}-${index}`;
    let bytes = await readFile(`${OUT}/${label}.png`).catch(() => null);
    if (bytes) { reused += 1; } else if (DRY) {
      console.log(`  ${label.padEnd(24)}--dry, not painted`);
      rows[arm.id]!.push({ label, fullness: null, specular: null });
      continue;
    } else {
      bytes = await engine.edit({
        prompt: arm.prompt,
        references: arm.references.map((reference) => ({ bytes: reference, contentType: "image/png" })),
        width,
        height,
      }).then((result) => result.bytes).catch((error) => {
        console.log(`  ${label} FAILED: ${(error as Error).message.slice(0, 120)}`);
        return null;
      });
      if (!bytes) { rows[arm.id]!.push({ label, fullness: null, specular: null }); continue; }
      paints += 1; spend += FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE;
      await writeFile(`${OUT}/${label}.png`, bytes);
    }
    const lips = await readLips(label, `${OUT}/${label}.png`);
    rows[arm.id]!.push({ label, fullness: lips?.fullness ?? null, specular: lips?.specular ?? null });
    console.log(
      `  ${label.padEnd(24)}fullness ${lips ? pct(lips.fullness) : "  —  "}   shine ${lips ? pct(lips.specular) : "  —  "}`,
    );
  }
  console.log("");
}

/* --------------------------------- the free family: paints already on disk */

console.log("=".repeat(92));
console.log("THE FREE CROSS-CHECK — five cached frames that were never sent a lips reference");
console.log("=".repeat(92));

const NEVER_ASKED = ["c-bigger-1", "c-bigger-2", "d-oneear-1", "d-oneear-2", "d-oneear-3"];
const neverAsked: { label: string; fullness: number; specular: number }[] = [];
for (const label of NEVER_ASKED) {
  const lips = await readLips(label, `${EDIT_LAW}/${label}.png`, `${EDIT_LAW}/reads`);
  if (!lips) { console.log(`  ${label.padEnd(24)}NO READ — counted as neither`); continue; }
  neverAsked.push({ label, ...lips });
  console.log(`  ${label.padEnd(24)}fullness ${pct(lips.fullness)}   shine ${pct(lips.specular)}`);
}

/* ------------------------------------------------------------------ the read */

const spread = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return { lo: sorted[0]!, hi: sorted[sorted.length - 1]!, n: sorted.length };
};

const bisectRows = (rows["bisect-two-ref"] ?? []).filter((row) => row.fullness !== null);
const nullRows = (rows["null-no-crop"] ?? []).filter((row) => row.fullness !== null);

console.log(`\n${"=".repeat(92)}`);
console.log("WHAT IT SAYS");
console.log("=".repeat(92));

if (nullRows.length === 0 || bisectRows.length === 0) {
  console.log("  One of the two arms produced no reading. NOT-RUN rather than reported as a null.");
  await writeFile(`${OUT}/bisect.json`, JSON.stringify({ n: N, rows, neverAsked, bandFullness, bandSpecular }, null, 2));
  process.exit(0);
}

const nullFullness = spread(nullRows.map((row) => row.fullness!));
const nullSpecular = spread(nullRows.map((row) => row.specular!));
const bar = Math.max(bandFullness.hi, nullFullness.hi);

console.log(`\n  THE ARM'S OWN FLOOR (n=${nullFullness.n}, this recipe, no crop)`);
console.log(`    fullness ${pct(nullFullness.lo)}–${pct(nullFullness.hi)}   against the inherited band's ${pct(bandFullness.lo)}–${pct(bandFullness.hi)}`);
console.log(`    ${nullFullness.hi > bandFullness.hi
  ? "the arm's own conditions run FULLER than the inherited band — the inherited bar would have been too low"
  : "the arm's own conditions sit inside the inherited band — the inherited bar governs"}`);
console.log(`    the bar the bisect must clear: ${pct(bar)}`);

/*
  THE NOISE FLOOR. The null's three paints share ONE prompt and ONE reference —
  identical inputs, nothing varying but the engine's own draw. Whatever they
  spread across is the smallest difference this measure can resolve, and a
  reading that clears a bar by less than that has not cleared anything. Written
  in because the gloss half of this same run was lost to exactly that error.
*/
const noiseFloor = nullFullness.hi - nullFullness.lo;
console.log(`\n  THE NOISE FLOOR — ${nullFullness.n} paints of one identical prompt: spread ${pct(noiseFloor)}`);
console.log(`    a reading must clear the null's own ceiling ${pct(nullFullness.hi)} by more than that to count.`);
const clearedNoise = bisectRows.filter((row) => row.fullness! - nullFullness.hi > noiseFloor).length;
console.log(`    ${clearedNoise} of ${bisectRows.length} clear it`
  + `  (margins ${bisectRows.map((row) => pct(row.fullness! - nullFullness.hi)).join(", ")})`);

const carried = bisectRows.filter((row) => row.fullness! > bar).length;
console.log(`\n  THE BISECT: ${carried} of ${bisectRows.length} above ${pct(bar)}`
  + `  (${bisectRows.map((row) => pct(row.fullness!)).join(", ")})`);
console.log(carried === bisectRows.length
  ? "  → CARRIED ON TWO REFERENCES. Count is out, and position with it. What is left of the\n"
    + "    bundle is NAMING FORM and ASK SIZE — and the assembler's requirement gets cheap:\n"
    + "    name each reference for what it is, and do not redraw a region in the same breath."
  : carried === 0
    ? "  → REVERTED. The crop needs company: two references is not enough where five was, on\n"
      + "    identical naming and an identical ask. Count (or the position and neighbours that\n"
      + "    travel with it) is a live factor, and the assembler must emit the proven count."
    : "  → SPLIT. Not earned at this n. Report as not earned; widen before it moves a design.");

/* The natural band, now on measured feet rather than on an inference. */
const bareLo = Math.min(masterLips.specular, nullSpecular.lo, ...neverAsked.map((entry) => entry.specular));
const bareHi = Math.max(masterLips.specular, nullSpecular.hi, ...neverAsked.map((entry) => entry.specular));
console.log(`\n  THE NATURAL BAND, REBUILT FROM FRAMES THAT NEVER SAW A LIPS REFERENCE`);
console.log(`    the bare master (1 frame, unpainted)          ${pct(masterLips.specular)}`);
console.log(`    this recipe, no crop  (n=${nullSpecular.n}, bought here)     ${pct(nullSpecular.lo)}–${pct(nullSpecular.hi)}`);
if (neverAsked.length > 0) {
  const free = spread(neverAsked.map((entry) => entry.specular));
  console.log(`    earring frames, no lips crop (n=${free.n}, free)    ${pct(free.lo)}–${pct(free.hi)}`);
}
console.log(`    → measured natural band  ${pct(bareLo)}–${pct(bareHi)}   on ${1 + nullSpecular.n + neverAsked.length} frames`);
console.log(`    the INFERRED family sat at ${pct(bandSpecular.lo)}–${pct(bandSpecular.hi)}`);
const familyIsNatural = bandSpecular.lo >= bareLo && bandSpecular.hi <= bareHi;
console.log(`    ${familyIsNatural
  ? "the thirteen sit INSIDE the measured natural band — the gloss crop did not carry, confirmed\n"
    + "      on frames that never received one. opus-135's unmasking stands on its own feet now."
  : bandSpecular.lo > bareHi
    ? "the thirteen sit ABOVE the measured natural band — that family picked up SOMETHING, and\n"
      + "      opus-135's unmasking needs re-examining before anything else leans on it."
    : "the thirteen straddle the measured band — neither reading is earned; state it as unearned."}`);

console.log(`\n${paints} new paints · ${reused} reused · ${regionReads} region reads · spend $${spend.toFixed(3)} · 0 credits`);
await writeFile(`${OUT}/bisect.json`, JSON.stringify({
  n: N, rows, neverAsked, bandFullness, bandSpecular, masterLips, mintedFullness,
  nullFullness, nullSpecular, bar, carried, measuredNatural: { lo: bareLo, hi: bareHi },
}, null, 2));
process.exit(0);
