/**
 * WHY DOES A CROP CARRY IN ONE RECIPE AND REVERT IN ANOTHER?
 *
 * fable-187 caught the overreach in opus-134: the program already holds a
 * POSITIVE specimen of a master-contradicting reference carrying. The C′
 * bench's cell 2 delivered gold hoops on all three paints from a master whose
 * ears are BARE. The edit-law cell's b/b′/b″ reverted. Both configurations are
 * cached with their exact inputs, so the honest next step is not another
 * hypothesis bought blind — it is a DIFF, and then the smallest arm that
 * isolates whatever flips it.
 *
 *   FAL_KEY=… npx tsx scripts/calibration/carry-configuration-diff.mts [--n 3]
 *
 * # THE DIFF, from the two recipes on disk
 *
 *                      C′ cell 2 — CARRIED        edit-law b — REVERTED
 *   references         5 (master + 4 crops)       2 (master + 1 crop)
 *   naming form        "Reference 4 is the        "Reference 2 is her lips
 *                      exact nude lip gloss"      exactly as they are now"
 *   the ask            eye colour → green         hair → a low bun
 *                      (small, non-geometric)     (large, redraws a region)
 *   carried feature    a HOOP the master          LIPS the master already
 *                      does not have at all       has, at a different size
 *   crop provenance    a stored segment cut       a 40px-margin rectangle
 *                      by the product             cut by this cell
 *
 * # THE ONE ARM THAT SPLITS THE DIFF IN HALF
 *
 * Rather than one arm per factor (five arms, ~$1.50), this runs the CARRYING
 * configuration verbatim — same five reference slots, same naming form, same
 * eye-colour ask — with **the fuller-lips crop substituted for the gloss crop**.
 *
 *   it CARRIES   → the flipping factor is in the recipe bundle (count, naming,
 *                  ask size, provenance), and the next arm bisects that bundle.
 *   it REVERTS   → the recipe is not the factor, and what is left is the
 *                  FEATURE KIND: a reference reliably supplies something the
 *                  master LACKS, and does not override geometry the master
 *                  already has. That is a different and more useful finding
 *                  than "crops don't carry", and it is testable by the mirror
 *                  arm below.
 *
 * # AND THE MIRROR, which costs the same and rules out "lips are just hard"
 *
 * The same carrying configuration, with the crop swapped for the ORIGINAL
 * gloss crop — the exact reference C′ cell 2 sent. If gloss carries where
 * fullness does not, on identical wording and identical slots, then the split
 * is not "lips are hard" but **additive-vs-substitutive**: gloss adds a surface
 * the master lacks; fullness overrides a geometry the master owns.
 *
 * 2 arms × n=3 = 6 paints at $0.099 = **$0.59**, inside fable-187's ~$1.50.
 */
import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import sharp from "sharp";

import { loadMaskFile, maskOf, boxOf, type FaceMask } from "../lib/shapeOnFace.mts";
import { createFalRegionReader } from "../../server/castingV2/falRegionReader";
import { createFalMaskedEditEngine, FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE } from "../../server/providers/falImages";

const BASE = "https://pub-990e39d8d995468eb61aced83162123a.r2.dev";
const OUT = "output/carry-diff";
const READS = `${OUT}/reads`;
const EDIT_LAW = "output/edit-law";
const BENCH = "output/cprime";

/* The C′ bench's own reference keys — the carrying configuration's inputs. */
const CROP_MARKS = "casting-v2/segments/ab9ef497-77c7-4871-a99f-f386383b2985-content.png";
const CROP_HAIR = "casting-v2/segments/3649a9bc-782c-4265-8a09-9fd7f0ee542b-content.png";
const CROP_GLOSS = "casting-v2/segments/68e45d40-df00-46be-b80d-9427a9985937-content.png";

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

async function fromR2(key: string, label: string): Promise<Buffer> {
  const path = `${OUT}/${label}.png`;
  const cached = await readFile(path).catch(() => null);
  if (cached) return cached;
  const response = await fetch(`${BASE}/${key}`);
  if (!response.ok) { console.error(`${label} did not fetch: ${response.status}`); process.exit(1); }
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(path, bytes);
  return bytes;
}

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

/* --------------------------------------------------------------- the inputs */

const masterBytes = await readFile(`${EDIT_LAW}/master.png`);
const meta = await sharp(masterBytes).metadata();
const width = meta.width!;
const height = meta.height!;

const [cropMarks, cropHair, cropGloss, cropHoop] = await Promise.all([
  fromR2(CROP_MARKS, "crop-freckles"),
  fromR2(CROP_HAIR, "crop-hair"),
  fromR2(CROP_GLOSS, "crop-gloss"),
  readFile(`${BENCH}/reference-earring.png`),
]);

/* The fuller-lips crop the edit-law cell minted from a2. Same bytes that
   reverted in b, so the only thing changing here is the recipe around it. */
const cropFuller = await readFile(`${EDIT_LAW}/mint-lips.png`);

console.log(`master ${width}x${height}`);
console.log(`references: freckles ${cropMarks.length}B · hair ${cropHair.length}B · gloss ${cropGloss.length}B`);
console.log(`            hoop ${cropHoop.length}B · FULLER LIPS ${cropFuller.length}B (the crop that reverted in b)\n`);

/* ------------------------------------------------------- the two lip readings */

const SPECULAR_ABOVE = 50;

async function readLips(label: string, framePath: string, readsDir = READS): Promise<
  { specular: number; fullness: number; mask: FaceMask } | null
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
    mask: lips,
  };
}

/* ------------------------------------------------------------- the benchmarks */

const cell = JSON.parse(await readFile(`${EDIT_LAW}/cell.json`, "utf8"));
const bandFullness = cell.controls.bandFullness as { lo: number; hi: number; mid: number; n: number };
const bandSpecular = cell.controls.bandSpecular as { lo: number; hi: number; mid: number; n: number };
const masterLips = cell.controls.masterLips as { fullness: number; specular: number };
const mintedFullness = cell.lipReadings["a2-fuller"].fullness as number;

console.log("THE BARS, inherited from the edit-law cell's own controls");
console.log(`  the minted crop being carried      ${(mintedFullness * 100).toFixed(2)}% full`);
console.log(`  the unedited repaint band          ${(bandFullness.lo * 100).toFixed(2)}–${(bandFullness.hi * 100).toFixed(2)}%  (master ${(masterLips.fullness * 100).toFixed(2)}%)`);
console.log(`  b / b′ / b″ all landed inside that band — that is what "reverted" meant.`);
console.log(`  NATURAL shine band (founder, fable-188): master ${(masterLips.specular * 100).toFixed(2)}%,`
  + ` unedited family ${(bandSpecular.lo * 100).toFixed(2)}–${(bandSpecular.hi * 100).toFixed(2)}%\n`);

/* ------------------------------------------------------------------ the arms */

/**
 * The C′ bench's clause, verbatim except for the slot under test. Reference 4
 * is the substituted one; everything else is the configuration that carried.
 */
function clauseWith(fourth: string): string {
  return [
    "Reference 1 is the photograph of this person — reproduce her exactly: same face, same pose,",
    "same lighting, same framing, same background.",
    "Reference 2 is the exact freckles across her cheeks and nose.",
    "Reference 3 is the exact hairstyle.",
    fourth,
    "Reference 5 is the exact gold hoop earring she is wearing — the same hoop, on the same ear.",
    "She is wearing her glasses, exactly as in reference 1.",
    "Change only her eye colour to green.",
  ].join(" ");
}

const ARMS = [
  {
    id: "fuller-in-carrying-config",
    title: "THE SUBSTITUTION — the carrying recipe, with the FULLER LIPS crop in slot 4",
    fourth: "Reference 4 is the exact fuller lips she has — the same lips, at the same fullness.",
    crop: cropFuller,
  },
  {
    id: "gloss-in-carrying-config",
    title: "THE MIRROR — the same recipe with the ORIGINAL gloss crop, exactly as C′ cell 2 sent it",
    fourth: "Reference 4 is the exact nude lip gloss.",
    crop: cropGloss,
  },
];

type Row = { label: string; fullness: number | null; specular: number | null };
const rows: Record<string, Row[]> = {};

for (const arm of ARMS) {
  console.log("=".repeat(92));
  console.log(arm.title);
  console.log("=".repeat(92));
  const prompt = clauseWith(arm.fourth);
  console.log(`  slot 4: "${arm.fourth}"\n`);
  rows[arm.id] = [];
  for (let index = 1; index <= N; index += 1) {
    const label = `${arm.id}-${index}`;
    let bytes = await readFile(`${OUT}/${label}.png`).catch(() => null);
    if (bytes) { reused += 1; } else if (DRY) {
      console.log(`  ${label.padEnd(30)}--dry, not painted`);
      rows[arm.id]!.push({ label, fullness: null, specular: null });
      continue;
    } else {
      bytes = await engine.edit({
        prompt,
        references: [masterBytes, cropMarks, cropHair, arm.crop, cropHoop]
          .map((reference) => ({ bytes: reference, contentType: "image/png" })),
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
      `  ${label.padEnd(30)}fullness ${lips ? (lips.fullness * 100).toFixed(2) + "%" : "  —  "}`
      + `   ${lips ? (lips.fullness > bandFullness.hi ? "CARRIED" : "reverted") : ""}`
      + `   shine ${lips ? (lips.specular * 100).toFixed(2) + "%" : "—"}`,
    );
  }
  console.log("");
}

/* ------------------------------------------------------------------ the read */

console.log("=".repeat(92));
console.log("WHAT IT SAYS");
console.log("=".repeat(92));

const fullerRows = (rows["fuller-in-carrying-config"] ?? []).filter((row) => row.fullness !== null);
const glossRows = (rows["gloss-in-carrying-config"] ?? []).filter((row) => row.specular !== null);
const carriedCount = fullerRows.filter((row) => row.fullness! > bandFullness.hi).length;
const glossCarried = glossRows.filter((row) => row.specular! >= bandSpecular.lo).length;

if (fullerRows.length > 0) {
  console.log(
    `  FULLNESS in the carrying configuration: ${carriedCount} of ${fullerRows.length} above the band`
    + ` (${fullerRows.map((row) => (row.fullness! * 100).toFixed(2)).join(", ")}%)`,
  );
  console.log(carriedCount === fullerRows.length
    ? "  → THE RECIPE IS THE FACTOR. b's failure was its configuration, not the architecture.\n"
      + "    Bisect the bundle next: reference count, naming form, ask size, crop provenance."
    : carriedCount === 0
      ? "  → THE RECIPE IS NOT THE FACTOR. The same crop reverts inside the configuration that\n"
        + "    carries a hoop, so what differs is the FEATURE: a reference supplies what the master\n"
        + "    LACKS and does not override geometry the master already owns. The mirror below is\n"
        + "    what separates that from \"lips are simply hard\"."
      : "  → SPLIT RESULT. Neither reading is earned at this n; widen before concluding.");
}
if (glossRows.length > 0) {
  console.log(
    `\n  GLOSS in the same configuration: ${glossCarried} of ${glossRows.length} at or above the family's`
    + ` own shine floor (${glossRows.map((row) => (row.specular! * 100).toFixed(2)).join(", ")}%)`,
  );
  console.log("  This is the control that says whether slot 4 carries ANYTHING here — a null on both");
  console.log("  arms would mean the substitution broke the recipe, not that fullness is special.");
}

console.log(`\n${paints} new paints · ${reused} reused · ${regionReads} region reads · spend $${spend.toFixed(3)} · 0 credits`);
await writeFile(`${OUT}/diff.json`, JSON.stringify({ n: N, rows, bandFullness, bandSpecular, mintedFullness }, null, 2));
process.exit(0);
