/**
 * BENCH B — THE SHARPNESS GAUNTLET, slice-1 form (fable-089).
 *
 * v2's defect was blur. Six edits deep the founder's own face was visibly soft
 * while every facet-survival instrument read green, because those instruments
 * ask *is the thing there* and blur does not remove anything. Nothing in that
 * product could measure the disease, which is why it shipped.
 *
 * Segment permanence claims the disease cannot recur: every render is anchored
 * on the MASTER, and a kept facet is PASTED rather than re-painted, so pixels
 * are copied instead of re-imagined. In slice 1 the chain is non-overlapping,
 * so that argument is structural — and fable-089's ruling is that slice 1's
 * gauntlet **proves the construction and still MEASURES**, because the last
 * architecture's blur was invisible to every instrument that looked at it.
 *
 * # Three tiers, and the third is the bench
 *
 * 1. **Asserts.** Everything outside the ground this render owns is
 *    byte-identical to the master; at version 6 every carried segment's pixels
 *    are byte-identical to the crop the store holds for it.
 * 2. **Measurement.** Per region, high-frequency energy at the version it was
 *    delivered against version 6 — flat within the declared band — and each
 *    step's FRESH region against the master's own sharpness there.
 * 3. **THE POSITIVE CONTROL, without which this is decoration.** A second
 *    six-step chain in **v2's shape**: each render re-anchored on the previous
 *    FRAME, no patches, no store. The metric MUST read that chain degraded. If
 *    it cannot flag the disease the bench exists to prevent, the bench has not
 *    run — and this bench prints NOT PROVEN rather than a table.
 *
 * The control is deliberately NOT six re-encodes: the product writes PNG end to
 * end, PNG is lossless, and a control that changes nothing proves nothing. That
 * lesson cost a "degradation" that read exactly 1.000 one shift ago.
 *
 *   npx tsx scripts/drive-casting-v2-segment-store-disposable.mts \
 *     --run scripts/calibration/bench-b-gauntlet.mts
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import mysql from "mysql2/promise";
import sharp from "sharp";

import { createFalMaskedEditEngine } from "../../server/providers/falImages";
import { createFalRegionReader } from "../../server/castingV2/falRegionReader";
import { harvestRefinement } from "../../server/castingV2/maskedRefine";
import { assembleWithCarriedSegments, listCarriedRows } from "../../server/castingV2/carriedSegments";
import { persistSegmentsForVariant } from "../../server/castingV2/segmentPersistence";
import { cutSegments } from "../../server/castingV2/segmentCuts";
import { readRaster, type Mask, type Raster } from "../../server/castingV2/maskedComposite";
import { ratioAgainst, SHARPNESS_BAND } from "../../server/castingV2/sharpness";
import { listLineageSegments } from "../../server/db/castingV2Segments";

const OUT = "output/bench-b";
mkdirSync(OUT, { recursive: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !/drape_castingv2_segments_/.test(databaseUrl)) {
  console.error(
    "Refusing to run: this bench writes candidates, variants and segments, so it only runs on the\n"
    + "disposable database the driver makes. Start it with\n"
    + "  npx tsx scripts/drive-casting-v2-segment-store-disposable.mts --run scripts/calibration/bench-b-gauntlet.mts",
  );
  process.exit(1);
}
const apiKey = process.env.FAL_KEY;
if (!apiKey) {
  console.error("FAL_KEY is required — a bench that cannot paint must refuse, not assume.");
  process.exit(1);
}

const MASTER_FILE = "output/marks-court/MASTER-run15.png";
const master = readFileSync(MASTER_FILE);
const meta = await sharp(master).metadata();
const W = meta.width!;
const H = meta.height!;

const PREAMBLE = "Edit this photograph of this exact person, changing ONLY what is listed below. ";

/**
 * SIX EDITS ON SIX REGIONS THAT DO NOT OVERLAP — and the disjointness is
 * ASSERTED from the assembly's own evidence rather than assumed from this list.
 * If two of them turn out to share ground, that is a finding printed in the
 * table, not a bench quietly measuring something else.
 */
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
];

const engine = createFalMaskedEditEngine({ apiKey });
const reader = createFalRegionReader({ apiKey });
const connection = await mysql.createConnection(databaseUrl);

const USER_ID = await (async () => {
  const [row] = await connection.execute<any>(
    "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'Bench B', 1, 1)",
    [`bench-b-${randomUUID()}`],
  );
  return row.insertId as number;
})();
process.env.CASTING_V2_SCOPE = `users:${USER_ID}`;
process.env.CASTING_SEGMENTS_SCOPE = `users:${USER_ID}`;
process.env.ENABLE_STORAGE_CLEANUP_WORKER = "true";

const [session] = await connection.execute<any>(
  "INSERT INTO casting_sessions (publicId, userId, status) VALUES (?, ?, 'open')",
  [randomUUID(), USER_ID],
);
const [roll] = await connection.execute<any>(
  "INSERT INTO casting_rolls (publicId, sessionId, userId, rollIndex, briefText, status, operationId, priceCredits)"
    + " VALUES (?, ?, ?, 0, 'bench b', 'complete', ?, 640)",
  [randomUUID(), session.insertId, USER_ID, randomUUID()],
);
const [candidate] = await connection.execute<any>(
  "INSERT INTO casting_candidates (publicId, rollId, sessionId, userId, position, status, imageKey, thumbKey)"
    + " VALUES (?, ?, ?, ?, 0, 'ready', ?, ?)",
  [randomUUID(), roll.insertId, session.insertId, USER_ID, `bench/${randomUUID()}.png`, `bench/${randomUUID()}-t.png`],
);
const candidateId = candidate.insertId as number;

/* Each step's variant names the one it was made from — the chain recorded as a
   chain, which is what the store walks to answer "what does this face keep". */
async function newVariant(parentVariantId: number | null): Promise<number> {
  const [variant] = await connection.execute<any>(
    "INSERT INTO casting_candidate_variants (publicId, candidateId, sessionId, userId, status, instructions, operationId, parentVariantId)"
      + " VALUES (?, ?, ?, ?, 'ready', ?, ?, ?)",
    [randomUUID(), candidateId, session.insertId, USER_ID, JSON.stringify(["bench"]), randomUUID(), parentVariantId],
  );
  return variant.insertId as number;
}

/* Crops of a face stay on this machine — see bench A's note. */
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

/* Each region's mask, read off the MASTER once — the crop never comes from the
   frame under test, or the measurement wanders to where the answer is
   convenient. Every reading below is scoped by these, so a region measured at
   step 2 and at step 6 is the same set of pixels. */
const regionMask = new Map<string, Mask>();
for (const step of STEPS) {
  const mask = await reader.region({ image: master, name: step.region });
  regionMask.set(step.region, mask);
  let covered = 0;
  for (let at = 0; at < mask.data.length; at += 1) if (mask.data[at] > 0) covered += 1;
  console.log(`region ${step.region.padEnd(10)} ${covered.toLocaleString()} px (${((covered / (W * H)) * 100).toFixed(2)}% of frame)`);
}

/* Disjointness, from the masks the chain will actually use. */
const overlaps: string[] = [];
for (let a = 0; a < STEPS.length; a += 1) {
  for (let b = a + 1; b < STEPS.length; b += 1) {
    const first = regionMask.get(STEPS[a].region)!;
    const second = regionMask.get(STEPS[b].region)!;
    let shared = 0;
    for (let at = 0; at < first.data.length; at += 1) {
      if (first.data[at] > 0 && second.data[at] > 0) shared += 1;
    }
    if (shared > 0) overlaps.push(`${STEPS[a].region}∩${STEPS[b].region} = ${shared} px`);
  }
}
console.log(overlaps.length === 0
  ? "\nthe six regions are DISJOINT on this face\n"
  : `\nOVERLAPS FOUND (a finding, not a silence): ${overlaps.join(", ")}\n`);

type Version = { index: number; facet: string; region: string; file: string; raster: Raster };
const versions: Version[] = [];
let anchorVariantId: number | null = null;
const outsideIdentical: boolean[] = [];
const carriedByteIdentical: string[] = [];
/** Steps whose prompt still named a facet the store was about to paste. */
const incompleteSubtractions: string[] = [];

for (let index = 0; index < STEPS.length; index += 1) {
  const step = STEPS[index];
  const began = Date.now();
  /*
    THE PROMPT IS BUILT THE WAY THE PRODUCT BUILDS IT (fable-102's sweep).

    This bench used to send ONE ask per render — `PREAMBLE + step.ask` — while
    the product, being base-anchored, sent the whole accumulated recipe every
    time. That single difference is why six green benches sat beside a
    production walk that re-rolled every earlier facet and lost her freckles
    twice: the bench modelled a product that asks for one thing at a time.

    It now accumulates like the recipe does and subtracts what the store is
    about to paste, which is the product's own rule. On a disjoint chain the
    result should be exactly the current ask again — and that equality is
    ASSERTED below rather than assumed, because it is the whole claim of the
    prompt-stripping half of the fix.
  */
  const carriedRows = await listCarriedRows({
    userId: USER_ID,
    candidateId,
    anchorVariantId,
    writing: [step.facet],
  });
  const carriedHere = new Set(carriedRows.map((row) => row.facet));
  const stillAsked = STEPS.slice(0, index + 1).filter((earlier) => !carriedHere.has(earlier.facet));
  if (stillAsked.length !== 1 || stillAsked[0].facet !== step.facet) {
    console.log(
      `
SUBTRACTION INCOMPLETE at step ${index + 1}: still asking for `
      + `${stillAsked.map((entry) => entry.facet).join(", ")} — the prompt would re-roll a kept facet.`,
    );
    incompleteSubtractions.push(`v${index + 1}: ${stillAsked.map((entry) => entry.facet).join(", ")}`);
  }
  const painted = await engine.edit({
    prompt: `${PREAMBLE}${stillAsked.map((entry) => entry.ask).join(" ")}`,
    references: [{ bytes: master, contentType: "image/png" }],
    width: W,
    height: H,
  });

  const harvested = await harvestRefinement({
    master: { bytes: master, contentType: "image/png" },
    painted: { bytes: painted.bytes, contentType: painted.contentType },
    facets: [step.facet],
    reader,
    userId: USER_ID,
    described: step.described,
    explain: true,
  });

  const assembled = await assembleWithCarriedSegments({
    userId: USER_ID,
    candidateId,
    anchorVariantId,
    /* The product derives this from the ASK, never from the recipe — the bug
       that made the whole architecture inert was the other choice. */
    writing: [step.facet],
    /* One read, shared with the prompt above, exactly as the service does it. */
    rows: carriedRows,
    master: { bytes: master, contentType: "image/png" },
    harvested: {
      bytes: harvested.bytes,
      contentType: harvested.contentType,
      evidence: harvested.evidence ?? null,
    },
    dependencies: { readBytes },
  });

  const file = `${OUT}/v${index + 1}-${step.facet.replace(/\W/g, "-")}.png`;
  writeFileSync(file, assembled.bytes);
  const raster = await readRaster(assembled.bytes);
  versions.push({ index: index + 1, facet: step.facet, region: step.region, file, raster });

  /* TIER 1a — everything outside the ground this render owns is the master,
     byte for byte. The assembly claims this; the bench checks it. */
  if (assembled.evidence) {
    let differing = 0;
    for (let pixel = 0; pixel < W * H; pixel += 1) {
      if (assembled.evidence.applied.data[pixel] > 0) continue;
      const at = pixel * 3;
      if (raster.data[at] !== masterRaster.data[at]
        || raster.data[at + 1] !== masterRaster.data[at + 1]
        || raster.data[at + 2] !== masterRaster.data[at + 2]) differing += 1;
    }
    outsideIdentical.push(differing === 0);
    if (differing > 0) console.log(`   !! ${differing} px outside the applied ground differ from the master`);
  } else {
    outsideIdentical.push(false);
  }

  const variantId = await newVariant(anchorVariantId);
  if (assembled.evidence) {
    const cuts = cutSegments({
      composite: raster,
      applied: assembled.evidence.applied,
      facetRegions: new Map([[step.facet, step.region]]),
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

  anchorVariantId = variantId;
  const live = await listLineageSegments({ userId: USER_ID, candidateId, anchorVariantId: variantId });
  console.log(
    `v${index + 1}  ${step.facet.padEnd(12)} carried set ${live.length}  `
    + `carried ${assembled.carriedFacets.length ? assembled.carriedFacets.join(",") : "—"}  `
    + `${((Date.now() - began) / 1000).toFixed(0)}s`,
  );
  if (assembled.assembly?.intersections?.length) {
    console.log(`     intersections resolved: ${JSON.stringify(assembled.assembly.intersections)}`);
  }
}

/* TIER 1b — at version 6, every carried segment's own pixels are the crop the
   store holds. A paste that is not byte-identical is a re-imagining. */
const finalRaster = versions[versions.length - 1].raster;
const liveAtEnd = await listLineageSegments({ userId: USER_ID, candidateId, anchorVariantId: anchorVariantId! });
for (const row of liveAtEnd) {
  if (row.facet === STEPS[STEPS.length - 1].facet) continue; /* the fresh one */
  const crop = await readRaster(objects.get(row.contentKey)!);
  const stencil = await sharp(objects.get(row.maskKey)!).removeAlpha().toColourspace("b-w").raw()
    .toBuffer({ resolveWithObject: true });
  const { bbox } = row.geometry;
  let differing = 0;
  let compared = 0;
  for (let y = 0; y < bbox.height; y += 1) {
    for (let x = 0; x < bbox.width; x += 1) {
      /* Only where the segment fully owns the pixel — a feathered edge blends
         against the master by design and is not a byte claim. */
      if (stencil.data[y * bbox.width + x] < 255) continue;
      compared += 1;
      const from = (y * bbox.width + x) * 3;
      const to = ((bbox.y + y) * W + (bbox.x + x)) * 3;
      if (crop.data[from] !== finalRaster.data[to]
        || crop.data[from + 1] !== finalRaster.data[to + 1]
        || crop.data[from + 2] !== finalRaster.data[to + 2]) differing += 1;
    }
  }
  carriedByteIdentical.push(`${row.facet}: ${differing} of ${compared} px differ`);
}

/* ------------------------------------------------ TIER 3, the control */

console.log("\n── the POSITIVE CONTROL: v2's shape, each render on the previous frame\n");
const controlVersions: Raster[] = [];
let carry: Buffer = master;
for (let index = 0; index < STEPS.length; index += 1) {
  const step = STEPS[index];
  const painted = await engine.edit({
    prompt: `${PREAMBLE}${step.ask}`,
    references: [{ bytes: carry, contentType: "image/png" }],
    width: W,
    height: H,
  });
  carry = painted.bytes;
  writeFileSync(`${OUT}/control-v${index + 1}.png`, carry);
  controlVersions.push(await readRaster(carry));
  console.log(`control v${index + 1}  ${step.facet}`);
}

/* ------------------------------------------------------------- the table */

const patched: string[] = [];
const control: string[] = [];
let patchedHeld = 0;
let patchedRead = 0;
let controlDegraded = 0;
let controlRead = 0;

for (let index = 0; index < STEPS.length - 1; index += 1) {
  const step = STEPS[index];
  const region = regionMask.get(step.region)!;

  const held = ratioAgainst({
    reference: versions[index].raster,
    subject: finalRaster,
    region,
  });
  patched.push(`${step.region.padEnd(10)} ${held.read ? `${held.ratio.toFixed(3)}  ${held.withinBand ? "held" : "DEGRADED"}` : "NO-READ"}`);
  if (held.read) {
    patchedRead += 1;
    if (held.withinBand) patchedHeld += 1;
  }

  const degraded = ratioAgainst({
    reference: controlVersions[index],
    subject: controlVersions[controlVersions.length - 1],
    region,
  });
  control.push(`${step.region.padEnd(10)} ${degraded.read ? `${degraded.ratio.toFixed(3)}  ${degraded.withinBand ? "held" : "DEGRADED"}` : "NO-READ"}`);
  if (degraded.read) {
    controlRead += 1;
    if (!degraded.withinBand) controlDegraded += 1;
  }
}

/* Each step's FRESH region against the master's own sharpness there — first
   generation paint, with no inherited softness. */
const fresh: string[] = [];
for (let index = 0; index < STEPS.length; index += 1) {
  const step = STEPS[index];
  const reading = ratioAgainst({
    reference: masterRaster,
    subject: versions[index].raster,
    region: regionMask.get(step.region)!,
  });
  fresh.push(`${step.region.padEnd(10)} ${reading.read ? reading.ratio.toFixed(3) : "NO-READ"}`);
}

const controlFired = controlRead > 0 && controlDegraded > 0;
const table = [
  "",
  "# BENCH B — THE SHARPNESS GAUNTLET (slice-1 form)",
  "",
  `subject     one face (${MASTER_FILE}), six sequential edits on six regions`,
  `instrument  Laplacian variance over a master-anchored region, ratio only, band ${SHARPNESS_BAND}`,
  `engine      ${engine.id}`,
  `read at     ${new Date().toISOString()}`,
  `disjoint    ${overlaps.length === 0 ? "yes — the six regions share no pixels on this face" : `NO: ${overlaps.join(", ")}`}`,
  "",
  "TIER 1 — asserts",
  `  outside the applied ground, byte-identical to the master: ${outsideIdentical.filter(Boolean).length}/${outsideIdentical.length} versions`,
  ...carriedByteIdentical.map((line) => `  carried at v6 — ${line}`),
  "",
  "TIER 2 — measurement: each region at the version it was delivered → version 6",
  ...patched.map((line) => `  ${line}`),
  "",
  "         each step's FRESH region against the master's own sharpness there",
  ...fresh.map((line) => `  ${line}`),
  "",
  "TIER 3 — THE POSITIVE CONTROL: the same six asks, each re-anchored on the",
  "         previous FRAME (v2's shape). The metric MUST read this degraded.",
  ...control.map((line) => `  ${line}`),
  "",
  `  control fired: ${controlFired ? `YES — ${controlDegraded}/${controlRead} regions read degraded` : "NO — THE BENCH HAS NOT RUN"}`,
  "",
  "TIER 0 — THE PROMPT, built the product's way: accumulate the recipe, subtract",
  "         what the store is about to paste. On a disjoint chain that must come",
  "         back to exactly the current ask.",
  `  subtraction complete at every step: ${
    incompleteSubtractions.length === 0 ? "yes" : `NO — ${incompleteSubtractions.join(" · ")}`
  }`,
  "",
  `VERDICT  ${
    !controlFired
      ? "NOT PROVEN — the instrument could not flag the disease this bench exists to prevent"
      : incompleteSubtractions.length > 0
        ? "NOT PROVEN — a kept facet was still being asked for, so this chain re-rolled rather than carried"
        : outsideIdentical.every(Boolean) && patchedRead > 0 && patchedHeld === patchedRead
          ? "PASS — the patched chain holds its detail where the re-anchored chain loses it"
          : "NOT PROVEN — read the tiers above"
  }`,
  "",
];
console.log(table.join("\n"));
writeFileSync(`${OUT}/bench-b.txt`, table.join("\n"));
writeFileSync(`${OUT}/bench-b.json`, JSON.stringify({
  master: MASTER_FILE,
  engine: engine.id,
  readAt: new Date().toISOString(),
  band: SHARPNESS_BAND,
  overlaps,
  outsideIdentical,
  carriedByteIdentical,
  patched,
  fresh,
  control,
}, null, 2));

await connection.end();

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
