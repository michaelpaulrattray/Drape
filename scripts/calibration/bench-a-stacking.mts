/**
 * BENCH A — SAME-FACET STACKING (fable-089, the D-146 confound).
 *
 * The claim segment permanence makes about a re-ask is structural: **one facet,
 * one CARRIED segment, the newest version this branch filed.** Re-asking a
 * facet supersedes its predecessor rather than contesting it, so the painter is
 * never handed the previous freckles as ground truth for new freckles — which
 * is what killed D-146. A structural argument is a claim; this measures it.
 *
 * # THE CONTROL THIS BENCH DID NOT HAVE, AND WHY IT NOW DOES
 *
 * The first version compared the re-ask against a number I INVENTED —
 * `mean(v1) + (mean(v1) − floor)`, "what stacking would read". It passed on one
 * tree and failed on the next with the same code, because the threshold was
 * derived from one of the arms and both arms are draws from the same noisy
 * distribution. Neither verdict meant anything.
 *
 * A bench needs a SPECIMEN of the disease, not an arithmetic guess at it. So
 * there is now a **STACKED arm**: the identical re-ask, painted on the FIRST
 * ARM'S FRAME instead of on the master — genuinely compounded, by construction,
 * the way v2 did it. The verdict is gated on that arm moving:
 *
 *   the stacked control does not separate from the ask
 *     → this bench cannot answer this question on this facet, and it says so
 *   the stacked control sits clearly above, and the re-ask sits with the ask
 *     → supersession is measured rather than assumed
 *
 * # Two facets, because one of them is the wrong instrument
 *
 * `marks` is the class whose delivery flickers, counted in steps of 0.082 per
 * 1000 against an effect of about 1.0 over a floor of 6.35 — its own
 * round-to-round spread on the SAME words is larger than the thing being
 * measured. `hair.colour` is a REPLACEMENT facet that delivered 4/4 both ways
 * in the caption court, measured as a continuous distance from the master over
 * her hair. Both run; each prints its own control, and a facet whose control
 * does not fire returns NO-READ rather than a verdict.
 *
 * # The store is REAL, and that is the point of the driver
 *
 *   npx tsx scripts/drive-casting-v2-segment-store-disposable.mts \
 *     --run scripts/calibration/bench-a-stacking.mts --rounds 3
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import mysql from "mysql2/promise";
import sharp from "sharp";

import { createFalMaskedEditEngine } from "../../server/providers/falImages";
import { createFalRegionReader } from "../../server/castingV2/falRegionReader";
import { harvestRefinement } from "../../server/castingV2/maskedRefine";
import { assembleWithCarriedSegments } from "../../server/castingV2/carriedSegments";
import { persistSegmentsForVariant } from "../../server/castingV2/segmentPersistence";
import { cutSegments } from "../../server/castingV2/segmentCuts";
import { readRaster, type Mask, type Raster } from "../../server/castingV2/maskedComposite";
import { listLineageSegments } from "../../server/db/castingV2Segments";
import { cheekBand, countSpecks, type Population } from "./lib/speckDensity.mjs";
import { openDatabase } from "../lib/dbConnection.mts";

const OUT = "output/bench-a";
mkdirSync(OUT, { recursive: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !/drape_castingv2_segments_/.test(databaseUrl)) {
  console.error(
    "Refusing to run: this bench writes candidates, variants and segments, so it only runs on the\n"
    + "disposable database the driver makes. Start it with\n"
    + "  npx tsx scripts/drive-casting-v2-segment-store-disposable.mts --run scripts/calibration/bench-a-stacking.mts",
  );
  process.exit(1);
}
const apiKey = process.env.FAL_KEY;
if (!apiKey) {
  console.error("FAL_KEY is required — a bench that cannot paint must refuse, not assume.");
  process.exit(1);
}

const roundsFlag = process.argv.indexOf("--rounds");
const ROUNDS = roundsFlag > -1 ? Number(process.argv[roundsFlag + 1]) : 3;

const MASTER_FILE = "output/marks-court/MASTER-run15.png";
const master = readFileSync(MASTER_FILE);
const meta = await sharp(master).metadata();
const W = meta.width!;
const H = meta.height!;

const PREAMBLE = "Edit this photograph of this exact person, changing ONLY what is listed below. ";

/**
 * The two facets fable-089 named. Steps 1 and 2 are byte-identical asks — that
 * is the whole test — and step 3 differs only by its intensity words.
 */
const ARMS = [
  {
    facet: "marks",
    region: "face skin",
    described: "visibly textured, freckles",
    measure: "specks" as const,
    ask: `${PREAMBLE}Give her freckles: a natural scattering of small brown freckles across the nose, `
      + "cheeks and upper face, denser over the bridge of the nose and thinning outward — "
      + "the same person with freckled skin, not a different face and not makeup.",
    intensified: `${PREAMBLE}Give her MANY MORE freckles, much heavier and denser: a thick scattering of `
      + "small brown freckles across the nose, cheeks and upper face, crowded over the bridge of the nose "
      + "and thinning outward — the same person with heavily freckled skin, not a different face and not makeup.",
  },
  {
    facet: "hair.colour",
    region: "hair",
    described: "warm copper hair",
    measure: "distance" as const,
    ask: `${PREAMBLE}Change her hair colour to a warm coppery auburn.`,
    intensified: `${PREAMBLE}Change her hair colour to a much more vivid, saturated copper red.`,
  },
];

const engine = createFalMaskedEditEngine({ apiKey });
const reader = createFalRegionReader({ apiKey });
const connection = await openDatabase(databaseUrl);

const USER_ID = await (async () => {
  const [row] = await connection.execute<any>(
    "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'Bench A', 1, 1)",
    [`bench-a-${randomUUID()}`],
  );
  return row.insertId as number;
})();
process.env.CASTING_V2_SCOPE = `users:${USER_ID}`;
process.env.CASTING_SEGMENTS_SCOPE = `users:${USER_ID}`;
process.env.ENABLE_STORAGE_CLEANUP_WORKER = "true";

let sessionId = 0;
async function newFace(): Promise<number> {
  const [session] = await connection.execute<any>(
    "INSERT INTO casting_sessions (publicId, userId, status) VALUES (?, ?, 'open')",
    [randomUUID(), USER_ID],
  );
  sessionId = session.insertId;
  const [roll] = await connection.execute<any>(
    "INSERT INTO casting_rolls (publicId, sessionId, userId, rollIndex, briefText, status, operationId, priceCredits)"
      + " VALUES (?, ?, ?, 0, 'bench a', 'complete', ?, 640)",
    [randomUUID(), sessionId, USER_ID, randomUUID()],
  );
  const [candidate] = await connection.execute<any>(
    "INSERT INTO casting_candidates (publicId, rollId, sessionId, userId, position, status, imageKey, thumbKey)"
      + " VALUES (?, ?, ?, ?, 0, 'ready', ?, ?)",
    [randomUUID(), roll.insertId, sessionId, USER_ID, `bench/${randomUUID()}.png`, `bench/${randomUUID()}-t.png`],
  );
  return candidate.insertId as number;
}

async function newVariant(candidateId: number, parentVariantId: number | null): Promise<number> {
  const [variant] = await connection.execute<any>(
    "INSERT INTO casting_candidate_variants (publicId, candidateId, sessionId, userId, status, instructions, operationId, parentVariantId)"
      + " VALUES (?, ?, ?, ?, 'ready', ?, ?, ?)",
    [randomUUID(), candidateId, sessionId, USER_ID, JSON.stringify(["bench"]), randomUUID(), parentVariantId],
  );
  return variant.insertId as number;
}

/* Crops of a face stay on this machine — never a public bucket for a fixture. */
const objects = new Map<string, Buffer>();
const store = async (input: { key: string; bytes: Buffer; contentType: string }) => {
  objects.set(input.key, input.bytes);
  return { key: input.key };
};
const readBytes = async (key: string) => {
  const bytes = objects.get(key);
  if (!bytes) throw new Error(`no such object ${key}`);
  return { bytes, contentType: "image/png" };
};

const masterRaster = await readRaster(master);

/**
 * HOW FAR THIS FRAME'S REGION SITS FROM THE MASTER'S, in mean levels.
 *
 * The right instrument for a REPLACEMENT facet: grey hair repainted copper is a
 * large, continuous distance, and repainting already-copper hair MORE copper
 * pushes it further. Unlike a speck count it has no quantisation floor, which is
 * exactly what the marks arm could not survive.
 */
function distanceFromMaster(frame: Raster, region: Mask): number {
  let total = 0;
  let pixels = 0;
  for (let pixel = 0; pixel < region.data.length; pixel += 1) {
    if (region.data[pixel] === 0) continue;
    const at = pixel * 3;
    total += (Math.abs(frame.data[at] - masterRaster.data[at])
      + Math.abs(frame.data[at + 1] - masterRaster.data[at + 1])
      + Math.abs(frame.data[at + 2] - masterRaster.data[at + 2])) / 3;
    pixels += 1;
  }
  return pixels === 0 ? 0 : total / pixels;
}

type Reading = { arm: string; round: number; step: string; value: number; file: string; carried: number };
const readings: Reading[] = [];
const tables: string[] = [];

/* One population per arm, from the MASTER — a before/after whose population
   moves between the before and the after is not a comparison. */
const speckPopulation: Population | null = await cheekBand(reader, MASTER_FILE);
if (!speckPopulation) throw new Error("no face read on her master — nothing below could be compared");
const speckFloor = await countSpecks(MASTER_FILE, speckPopulation, `${OUT}/PATCH-master.png`);
const hairRegion = await reader.region({ image: master, name: "hair" });

for (const arm of ARMS) {
  console.log(`\n══ ARM ${arm.facet}\n`);

  /** One paint through the product's own chain, landed into the store. */
  async function landed(input: {
    candidateId: number; anchor: number | null; prompt: string;
  }): Promise<{ bytes: Buffer; variantId: number; carried: number }> {
    const painted = await engine.edit({
      prompt: input.prompt,
      references: [{ bytes: master, contentType: "image/png" }],
      width: W,
      height: H,
    });
    const harvested = await harvestRefinement({
      master: { bytes: master, contentType: "image/png" },
      painted: { bytes: painted.bytes, contentType: painted.contentType },
      facets: [arm.facet],
      reader,
      userId: USER_ID,
      described: arm.described,
      explain: true,
    });
    const assembled = await assembleWithCarriedSegments({
      userId: USER_ID,
      candidateId: input.candidateId,
      anchorVariantId: input.anchor,
      /*
        THE PRODUCT'S OWN NOTION, not the recipe's (fable-102's sweep). An arm
        writes the facet it asks for, and nothing else — which is exactly what
        `writtenFacets` computes in the service now. This bench's arms are
        single asks on a master, so accumulation does not arise here; bench B
        carries that half.
      */
      writing: [arm.facet],
      master: { bytes: master, contentType: "image/png" },
      harvested: {
        bytes: harvested.bytes,
        contentType: harvested.contentType,
        evidence: harvested.evidence ?? null,
      },
      dependencies: { readBytes },
    });
    const variantId = await newVariant(input.candidateId, input.anchor);
    if (assembled.evidence) {
      const composite = await readRaster(assembled.bytes);
      await persistSegmentsForVariant({
        userId: USER_ID,
        variantId,
        cuts: cutSegments({
          composite,
          applied: assembled.evidence.applied,
          facetRegions: new Map([[arm.facet, arm.region]]),
          regionMasks: assembled.evidence.masterRegions,
        }),
        verdict: "verified",
        verifiedAt: new Date(),
        dependencies: { store },
      });
    }
    const carried = (await listLineageSegments({
      userId: USER_ID, candidateId: input.candidateId, anchorVariantId: variantId,
    })).length;
    return { bytes: assembled.bytes, variantId, carried };
  }

  async function read(file: string, bytes: Buffer, save: string): Promise<number> {
    writeFileSync(file, bytes);
    if (arm.measure === "specks") {
      return (await countSpecks(file, speckPopulation!, save)).perThousand;
    }
    return distanceFromMaster(await readRaster(bytes), hairRegion);
  }

  for (let round = 1; round <= ROUNDS; round += 1) {
    const candidateId = await newFace();
    const tag = `${arm.facet.replace(/\W/g, "-")}-r${round}`;
    console.log(`── round ${round}`);

    const v1 = await landed({ candidateId, anchor: null, prompt: arm.ask });
    const v1Value = await read(`${OUT}/${tag}-v1.png`, v1.bytes, `${OUT}/PATCH-${tag}-v1.png`);
    readings.push({ arm: arm.facet, round, step: "v1", value: v1Value, file: `${OUT}/${tag}-v1.png`, carried: v1.carried });
    console.log(`   1  ask            ${v1Value.toFixed(2).padStart(7)}   carried ${v1.carried}`);

    const v2 = await landed({ candidateId, anchor: v1.variantId, prompt: arm.ask });
    const v2Value = await read(`${OUT}/${tag}-v2.png`, v2.bytes, `${OUT}/PATCH-${tag}-v2.png`);
    readings.push({ arm: arm.facet, round, step: "v2", value: v2Value, file: `${OUT}/${tag}-v2.png`, carried: v2.carried });
    console.log(`   2  SAME words     ${v2Value.toFixed(2).padStart(7)}   carried ${v2.carried}`);

    /*
      THE STACKED CONTROL — the disease, built on purpose.

      The identical re-ask, painted on the FIRST ARM'S FRAME instead of on the
      master: v2's own shape, where the painter sees what it already did and
      goes again. Nothing is filed for it; it exists to be measured.
    */
    const stacked = await engine.edit({
      prompt: arm.ask,
      references: [{ bytes: v1.bytes, contentType: "image/png" }],
      width: W,
      height: H,
    });
    const stackedValue = await read(`${OUT}/${tag}-stacked.png`, stacked.bytes, `${OUT}/PATCH-${tag}-stacked.png`);
    readings.push({ arm: arm.facet, round, step: "stacked", value: stackedValue, file: `${OUT}/${tag}-stacked.png`, carried: 0 });
    console.log(`   C  STACKED (on v1's frame)  ${stackedValue.toFixed(2).padStart(7)}`);

    const v3 = await landed({ candidateId, anchor: v2.variantId, prompt: arm.intensified });
    const v3Value = await read(`${OUT}/${tag}-v3.png`, v3.bytes, `${OUT}/PATCH-${tag}-v3.png`);
    readings.push({ arm: arm.facet, round, step: "v3", value: v3Value, file: `${OUT}/${tag}-v3.png`, carried: v3.carried });
    console.log(`   3  intensified    ${v3Value.toFixed(2).padStart(7)}   carried ${v3.carried}`);
  }

  /* ------------------------------------------------------- the arm's table */

  const at = (step: string) => readings.filter((row) => row.arm === arm.facet && row.step === step).map((row) => row.value);
  const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;
  const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
  const v1s = at("v1");
  const v2s = at("v2");
  const stackeds = at("stacked");
  const v3s = at("v3");

  /*
    THE NOISE, MEASURED: the widest within-arm spread of the two arms that ask
    the SAME words. A separation smaller than that is not a separation.
  */
  const noise = Math.max(spread(v1s), spread(v2s));
  const controlSeparates = mean(stackeds) - mean(v1s) > noise;
  const supersedes = Math.abs(mean(v2s) - mean(v1s)) <= noise;
  const intensifiedMoved = mean(v3s) > mean(v1s);
  const carriedOne = readings
    .filter((row) => row.arm === arm.facet && row.step !== "stacked")
    .every((row) => row.carried === 1);

  tables.push([
    "",
    `## ARM "${arm.facet}" — ${arm.measure === "specks" ? "specks per 1000 skin px" : "mean levels from the master, over her hair"}`,
    "",
    `  1  ask                ${v1s.map((value) => value.toFixed(2)).join("  ")}   mean ${mean(v1s).toFixed(2)}`,
    `  2  the SAME words     ${v2s.map((value) => value.toFixed(2)).join("  ")}   mean ${mean(v2s).toFixed(2)}`,
    `  C  STACKED control    ${stackeds.map((value) => value.toFixed(2)).join("  ")}   mean ${mean(stackeds).toFixed(2)}`,
    `  3  intensified        ${v3s.map((value) => value.toFixed(2)).join("  ")}   mean ${mean(v3s).toFixed(2)}`,
    "",
    `  noise (widest same-words spread)  ${noise.toFixed(2)}`,
    `  CONTROL SEPARATES   ${controlSeparates ? "yes" : "NO"} — stacked ${mean(stackeds).toFixed(2)} against the ask's ${mean(v1s).toFixed(2)}, noise ${noise.toFixed(2)}`,
    controlSeparates
      ? `  SUPERSEDES          ${supersedes ? "yes" : "NO"} — the re-ask sits ${Math.abs(mean(v2s) - mean(v1s)).toFixed(2)} from the ask`
      : "  SUPERSEDES          NO-READ — this instrument cannot see stacking on this facet, so it may not rule on it",
    `  INTENSIFIED MOVED   ${intensifiedMoved ? "yes" : "NO"} — ${mean(v3s).toFixed(2)} against ${mean(v1s).toFixed(2)}`,
    `  carried set always 1: ${carriedOne ? "yes" : "NO"}`,
    "",
    `  VERDICT  ${
      !controlSeparates
        ? "NO-READ — the bench could not produce the disease it tests for"
        : supersedes && intensifiedMoved && carriedOne
          ? "PASS"
          : "FAIL"
    }`,
  ].join("\n"));
}

const header = [
  "",
  "# BENCH A — SAME-FACET STACKING",
  "",
  `subject     one face (${MASTER_FILE}), ${ROUNDS} rounds per arm, one candidate per round`,
  "store       REAL, on a disposable database",
  `engine      ${engine.id}`,
  `read at     ${new Date().toISOString()}`,
  `controls    her master reads ${speckFloor.perThousand.toFixed(2)} specks per 1000 (the marks floor, in this sitting);`,
  "            the STACKED arm is the disease built on purpose — the same re-ask painted on",
  "            the first arm's FRAME rather than on the master, which is v2's own shape",
].join("\n");

console.log([header, ...tables, ""].join("\n"));
writeFileSync(`${OUT}/bench-a.txt`, [header, ...tables, ""].join("\n"));
writeFileSync(`${OUT}/bench-a.json`, JSON.stringify({
  master: MASTER_FILE, rounds: ROUNDS, engine: engine.id,
  readAt: new Date().toISOString(), speckFloor: speckFloor.perThousand, readings,
}, null, 2));

await connection.end();

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
