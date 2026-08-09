/**
 * BENCH A — SAME-FACET STACKING (fable-089, the D-146 confound).
 *
 * The claim segment permanence makes about a re-ask is structural: **one facet,
 * one CARRIED segment, the newest version this branch filed.** Re-asking
 * `marks` supersedes its predecessor rather than contesting it, so the painter
 * is never handed the previous freckles as ground truth for new freckles —
 * which is what killed D-146. A structural argument is a claim; this measures it.
 *
 * # The sequence, three steps on one face
 *
 *   1  ask for freckles            → keep the segment
 *   2  ask again, THE SAME WORDS   → must SUPERSEDE, not stack
 *   3  ask again, INTENSIFIED      → must move in the asked direction
 *
 * n rounds of the whole chain, each on its own candidate, because one paint is
 * a lucky round and this program has read n=1 as a measurement before.
 *
 * # The store is REAL here, and that is the point of the driver
 *
 * "One facet, one carried segment" is resolved by a recursive walk over the
 * variant tree in SQL. A bench that mocked the store would be measuring the
 * mock, so this runs against a disposable database with the real statements,
 * the real cut, and the real assembly — and each step's variant records the one
 * it was made from, exactly as the service does:
 *
 *   npx tsx scripts/drive-casting-v2-segment-store-disposable.mts \
 *     --run scripts/calibration/bench-a-stacking.mts -- --rounds 3
 *
 * # Controls first, in this sitting (working law 2)
 *
 * The instrument is the marks counter, whose declared limit is that it can only
 * ORDER FRAMES OF ONE FACE. So both its controls run here, on this face, in
 * this run: her master is the floor (negative), and step 1's delivered
 * composite must read ABOVE it (positive). If the counter cannot order those
 * two, nothing below it means anything and the bench says so instead of
 * printing numbers.
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
import { readRaster } from "../../server/castingV2/maskedComposite";
import { listLineageSegments } from "../../server/db/castingV2Segments";
import { cheekBand, countSpecks, type Population } from "./lib/speckDensity.mjs";

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

/* HER master — the face the marks counter was courted on. Its limit says the
   counter can only order frames of ONE face, so the bench holds that one. */
const MASTER_FILE = "output/marks-court/MASTER-run15.png";
const master = readFileSync(MASTER_FILE);
const meta = await sharp(master).metadata();
const W = meta.width!;
const H = meta.height!;

/*
  THE THREE ASKS.

  Steps 1 and 2 are byte-identical — that is the whole test, and writing them
  as one constant makes it impossible for a later edit to make them differ by
  accident. Step 3 differs ONLY by its intensity words, so the third row
  measures the ask rather than a new sentence.
*/
const ASK = "Edit this photograph of this exact person, changing ONLY what is listed below. "
  + "Give her freckles: a natural scattering of small brown freckles across the nose, "
  + "cheeks and upper face, denser over the bridge of the nose and thinning outward — "
  + "the same person with freckled skin, not a different face and not makeup.";
const INTENSIFIED = "Edit this photograph of this exact person, changing ONLY what is listed below. "
  + "Give her MANY MORE freckles, much heavier and denser: a thick scattering of small brown "
  + "freckles across the nose, cheeks and upper face, crowded over the bridge of the nose and "
  + "thinning outward — the same person with heavily freckled skin, not a different face and not makeup.";
const STEPS = [
  { key: "v1", label: "1  freckles", prompt: ASK },
  { key: "v2", label: "2  the SAME words", prompt: ASK },
  { key: "v3", label: "3  intensified", prompt: INTENSIFIED },
];

const engine = createFalMaskedEditEngine({ apiKey });
const reader = createFalRegionReader({ apiKey });
const connection = await mysql.createConnection(databaseUrl);

/* The store is armed for this user, in this process only. */
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

async function newFace(): Promise<number> {
  const [session] = await connection.execute<any>(
    "INSERT INTO casting_sessions (publicId, userId, status) VALUES (?, ?, 'open')",
    [randomUUID(), USER_ID],
  );
  const [roll] = await connection.execute<any>(
    "INSERT INTO casting_rolls (publicId, sessionId, userId, rollIndex, briefText, status, operationId, priceCredits)"
      + " VALUES (?, ?, ?, 0, 'bench a', 'complete', ?, 640)",
    [randomUUID(), session.insertId, USER_ID, randomUUID()],
  );
  const [candidate] = await connection.execute<any>(
    "INSERT INTO casting_candidates (publicId, rollId, sessionId, userId, position, status, imageKey, thumbKey)"
      + " VALUES (?, ?, ?, ?, 0, 'ready', ?, ?)",
    [randomUUID(), roll.insertId, session.insertId, USER_ID, `bench/${randomUUID()}.png`, `bench/${randomUUID()}-t.png`],
  );
  (newFace as unknown as { sessionId?: number }).sessionId = session.insertId;
  return candidate.insertId as number;
}

/* The chain is recorded as a chain: each step's variant names the one it was
   made from, which is what the store reads to answer "what does THIS face
   keep" per branch (fable-091). */
async function newVariant(candidateId: number, parentVariantId: number | null): Promise<number> {
  const sessionId = (newFace as unknown as { sessionId: number }).sessionId;
  const [variant] = await connection.execute<any>(
    "INSERT INTO casting_candidate_variants (publicId, candidateId, sessionId, userId, status, instructions, operationId, parentVariantId)"
      + " VALUES (?, ?, ?, ?, 'ready', ?, ?, ?)",
    [randomUUID(), candidateId, sessionId, USER_ID, JSON.stringify(["give her freckles"]), randomUUID(), parentVariantId],
  );
  return variant.insertId as number;
}

/*
  THE SEGMENT OBJECTS GO NOWHERE NEAR R2.

  The bench writes crops of a face; they belong on this machine and nowhere
  else, and a public bucket is exactly what the store's own retention rules
  exist to keep them out of. So storage is a local map, injected — the same
  seam the unit tests use, and the rows still go through the real statements.
*/
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

type Reading = { round: number; step: string; perThousand: number; file: string; live: number };
const readings: Reading[] = [];

/* ONE population for every frame — the master's. A before/after whose
   POPULATION moves between the before and the after is not a comparison. */
const population: Population | null = await cheekBand(reader, MASTER_FILE);
if (!population) throw new Error("no face read on her master — nothing below could be compared");
const floor = await countSpecks(MASTER_FILE, population, `${OUT}/PATCH-master.png`);
console.log(`her floor (the NEGATIVE control, in this sitting): ${floor.perThousand.toFixed(2)} per 1000 `
  + `over ${population.pixels} skin px\n`);

for (let round = 1; round <= ROUNDS; round += 1) {
  const candidateId = await newFace();
  let anchorVariantId: number | null = null;
  console.log(`── round ${round} — candidate ${candidateId}`);

  for (const step of STEPS) {
    const began = Date.now();
    const painted = await engine.edit({
      prompt: step.prompt,
      references: [{ bytes: master, contentType: "image/png" }],
      width: W,
      height: H,
    });

    const harvested = await harvestRefinement({
      master: { bytes: master, contentType: "image/png" },
      painted: { bytes: painted.bytes, contentType: painted.contentType },
      facets: ["marks"],
      reader,
      userId: USER_ID,
      described: "visibly textured, freckles",
      explain: true,
    });

    /* The product's own assembly: everything this face already keeps, minus
       the facet being written. For a same-facet chain that is nothing — which
       is the property under test, not an assumption made here. */
    const assembled = await assembleWithCarriedSegments({
      userId: USER_ID,
      candidateId,
      anchorVariantId,
      writing: ["marks"],
      master: { bytes: master, contentType: "image/png" },
      harvested: {
        bytes: harvested.bytes,
        contentType: harvested.contentType,
        evidence: harvested.evidence ?? null,
      },
      dependencies: { readBytes },
    });

    const variantId = await newVariant(candidateId, anchorVariantId);
    if (assembled.evidence) {
      const composite = await readRaster(assembled.bytes);
      const cuts = cutSegments({
        composite,
        applied: assembled.evidence.applied,
        facetRegions: new Map([["marks", "face skin"]]),
        regionMasks: assembled.evidence.masterRegions,
      });
      await persistSegmentsForVariant({
        userId: USER_ID,
        variantId,
        cuts,
        verdict: "verified",
        verifiedAt: new Date(),
        dependencies: { store },
      });
    }

    const file = `${OUT}/r${round}-${step.key}.png`;
    writeFileSync(file, assembled.bytes);
    const counted = await countSpecks(file, population, `${OUT}/PATCH-r${round}-${step.key}.png`);
    /* What the NEXT edit on this branch would carry — one facet, one segment,
       the newest version this branch filed. The row count grows; the carried
       set must not. */
    const live = (await listLineageSegments({ userId: USER_ID, candidateId, anchorVariantId: variantId })).length;
    anchorVariantId = variantId;

    readings.push({ round, step: step.key, perThousand: counted.perThousand, file, live });
    console.log(
      `   ${step.label.padEnd(20)} ${counted.perThousand.toFixed(2).padStart(6)} per 1000  `
      + `(${(((counted.perThousand / floor.perThousand) - 1) * 100).toFixed(0)}% over her floor)  `
      + `carried: ${live}  ${((Date.now() - began) / 1000).toFixed(0)}s`
      + (assembled.carriedFacets.length ? `  carried: ${assembled.carriedFacets.join(",")}` : ""),
    );
  }
}

/* ------------------------------------------------------------- the table */

const at = (step: string) => readings.filter((row) => row.step === step).map((row) => row.perThousand);
const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;
const v1 = at("v1");
const v2 = at("v2");
const v3 = at("v3");

/*
  THE BAND, and why it is the SPREAD rather than a number I chose.

  "Version 2 within the measured band of version 1" needs a band, and the only
  honest one is what the same ask actually does twice — so the band is v1's own
  round-to-round range. A v2 inside it is indistinguishable from another v1; a
  v2 near v1+v1 is stacking, and the table prints that sum so the reader can
  see which end the number sits at.
*/
const v1Range = { low: Math.min(...v1), high: Math.max(...v1) };
const stackedWouldBe = mean(v1) + (mean(v1) - floor.perThousand);
const superseded = mean(v2) <= v1Range.high + (v1Range.high - v1Range.low);
const positiveControl = mean(v1) > floor.perThousand;
const intensifiedMoved = mean(v3) > mean(v1);

const table = [
  "",
  "# BENCH A — SAME-FACET STACKING",
  "",
  `subject       one face (${MASTER_FILE}), ${ROUNDS} rounds, one candidate per round`,
  `instrument    the marks counter (specks darker than local skin, on skin) — it can`,
  "              only ORDER FRAMES OF ONE FACE, which is why this bench holds one",
  `store         REAL, on a disposable database (${databaseUrl.replace(/\/\/[^@]+@/, "//…@").split("/").pop()})`,
  `engine        ${engine.id}`,
  `read at       ${new Date().toISOString()}`,
  "",
  `NEGATIVE control  her master reads ${floor.perThousand.toFixed(2)} — the floor, in this sitting`,
  `POSITIVE control  step 1 reads ${mean(v1).toFixed(2)} — ${positiveControl ? "ABOVE the floor, so the counter can see the ask land" : "AT OR BELOW the floor: THE INSTRUMENT CANNOT SEE THE ASK, and nothing below is a reading"}`,
  "",
  `step 1  freckles          ${v1.map((value) => value.toFixed(2)).join("  ")}   mean ${mean(v1).toFixed(2)}`,
  `step 2  the SAME words    ${v2.map((value) => value.toFixed(2)).join("  ")}   mean ${mean(v2).toFixed(2)}`,
  `step 3  intensified       ${v3.map((value) => value.toFixed(2)).join("  ")}   mean ${mean(v3).toFixed(2)}`,
  "",
  `step 1's own spread       ${v1Range.low.toFixed(2)} – ${v1Range.high.toFixed(2)}  (the band, measured rather than chosen)`,
  `what STACKING would read  ${stackedWouldBe.toFixed(2)}  (step 1 twice over her floor)`,
  "",
  `SUPERSEDES        ${superseded ? "yes" : "NO"} — step 2 mean ${mean(v2).toFixed(2)} against a stacked ${stackedWouldBe.toFixed(2)}`,
  `INTENSIFIED MOVED ${intensifiedMoved ? "yes" : "NO"} — step 3 mean ${mean(v3).toFixed(2)} against step 1's ${mean(v1).toFixed(2)}`,
  "",
  `carried set at the end of each chain: ${readings.filter((row) => row.step === "v3").map((row) => row.live).join(", ")}  (must be 1 — one facet, one carried segment)`,
  "",
  `VERDICT  ${
    positiveControl && superseded && intensifiedMoved
      && readings.filter((row) => row.step === "v3").every((row) => row.live === 1)
      ? "PASS"
      : "NOT PROVEN — read the control lines above"
  }`,
  "",
];
console.log(table.join("\n"));
writeFileSync(`${OUT}/bench-a.txt`, table.join("\n"));
writeFileSync(`${OUT}/bench-a.json`, JSON.stringify({
  master: MASTER_FILE,
  rounds: ROUNDS,
  engine: engine.id,
  readAt: new Date().toISOString(),
  floor: floor.perThousand,
  readings,
}, null, 2));

await connection.end();
