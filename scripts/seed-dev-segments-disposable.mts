/**
 * DEV SEED DATA — real crops of a real dev face, so the kept panel can be
 * LOOKED AT before it ships (fable-125 option (a), D-101).
 *
 * # Why a seed exists at all
 *
 * `c29d93d6` is a visual change that has never been rendered, because the dev
 * database holds zero segment rows: the store is dark everywhere except
 * production, and production is the founder's own account. The panel therefore
 * cannot be photographed without rows, and rows cannot be bought without a paid
 * refine. So the rows are seeded — and everything about them that could be
 * faked is instead taken from the product's own machinery:
 *
 *   the face        a real dev candidate (316) and its real refinement chain
 *   the words       whatever `currentValueOfFacet` reads off each variant's OWN
 *                   resolved identity — no string is authored here
 *   the regions     the real segmentation reader on fal (SAM 3), asked the same
 *                   question `regionNameOf` would ask, of the delivered frame
 *   the cut         `cutSegments`, the product's own arithmetic
 *   the write       `persistSegmentsForVariant`, the product's own writer,
 *                   through the same cleanup manifest
 *
 * # The two seeded facts, declared rather than buried
 *
 * 1. **The applied set is the WHOLE FRAME, so each segment is its region
 *    entire.** The real applied mask comes from the compositor, and NO dev
 *    variant has one: measured across every ready variant the verify bot owns,
 *    each delivered frame is 848×1264 (sometimes 843×1264) against a 1024×1536
 *    master — not one of them went through the masked-composite path, so there
 *    is no frame-aligned difference to recover and a resize-then-diff would be
 *    a picture of resampling. A segment here therefore claims its whole region,
 *    which is what a real segment looks like when the edit covered its region.
 * 2. **The `parentVariantId` links** that make 17→18→19 one branch. Those rows
 *    predate the lineage column, so their ancestry is genuinely unknown;
 *    writing it is invented in the direction the sheet already displays them.
 *
 * # It refuses to be pointed anywhere but dev
 *
 * Three ways: `MYSQL_PUBLIC_URL` present is fatal, the bucket must be the dev
 * one by name, and the target user must be the verify bot rather than a person.
 *
 *   npx tsx scripts/seed-dev-segments-disposable.mts            # plan only
 *   npx tsx scripts/seed-dev-segments-disposable.mts --spend    # fal + write
 */
import "dotenv/config";

import { fixtureSpendAuthorized } from "./lib/stopline.mts";
import { assertOneWorld, assertDefinedByService, APP_WRITE_PATH_KEYS } from "./lib/worldGuard.mts";

import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { cutSegments } from "../server/castingV2/segmentCuts";
import { persistSegmentsForVariant } from "../server/castingV2/segmentPersistence";
import { readRaster, type Mask, type Raster } from "../server/castingV2/maskedComposite";
import { regionNameOf } from "../server/castingV2/maskedRefine";
import { currentValueOfFacet } from "../server/castingV2/refineDelta";
import { readResolvedIdentity } from "../server/castingV2/rollService";
import { nameForFacet } from "../server/castingV2/segmentsOnFace";
import type { Facet } from "../server/castingV2/refineFacets";
import { openDatabase } from "./lib/dbConnection.mts";

assertOneWorld();
assertDefinedByService(APP_WRITE_PATH_KEYS);

const SPEND = fixtureSpendAuthorized(
  "segment one dev face with the real reader on fal, to seed the kept panel's rows",
);

/* ------------------------------------------------------------ the refusals */

if (process.env.MYSQL_PUBLIC_URL) {
  throw new Error("MYSQL_PUBLIC_URL is set — this writes rows and never goes near production");
}
if (process.env.R2_BUCKET !== "drape-dev") {
  throw new Error(`R2_BUCKET is "${process.env.R2_BUCKET}" — this seed writes only into the dev bucket`);
}

/** The verify bot. Never a person's account, so no customer face is touched. */
const USER_ID = 823;
const CANDIDATE_ID = 316;

/**
 * WHICH VARIANT FILED WHAT, and each one is a facet that variant's own resolved
 * identity really does carry a value for — checked below rather than trusted.
 *
 * Three DIFFERENT regions on purpose: eyes, lips, face skin. The mock's own
 * legibility claim is that a masked thumbnail reads by its SHAPE, and three
 * segments sharing one region would be three copies of the same silhouette —
 * which is exactly the useless version the founder pulled this panel forward to
 * avoid.
 */
const PLAN: Array<{ variantId: number; facet: Facet }> = [
  { variantId: 17, facet: "eye.shape" as Facet },
  { variantId: 18, facet: "lips" as Facet },
  { variantId: 19, facet: "makeup" as Facet },
];

/** The branch these three sit on — see the header; this is the invented half. */
const LINEAGE: Array<{ variantId: number; parentVariantId: number }> = [
  { variantId: 18, parentVariantId: 17 },
  { variantId: 19, parentVariantId: 18 },
];

/**
 * The applied set this seed can honestly supply: all of it.
 *
 * See seeded fact 1 in the header. Named rather than inlined so the one place
 * this seed departs from the product's arithmetic is a thing with a name.
 */
function wholeFrame(frame: Raster): Mask {
  return { data: Buffer.alloc(frame.width * frame.height, 255), width: frame.width, height: frame.height };
}

function countMask(mask: Mask): number {
  let pixels = 0;
  for (let at = 0; at < mask.data.length; at += 1) if (mask.data[at] > 0) pixels += 1;
  return pixels;
}

async function fetchBytes(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

/* -------------------------------------------------------------------- run */

const connection = await openDatabase();
const [candidateRows] = await connection.query(
  "SELECT id, userId, publicId, imageKey, selectedVariantId FROM casting_candidates WHERE id = ? AND userId = ?",
  [CANDIDATE_ID, USER_ID],
);
const candidate = (candidateRows as any[])[0];
if (!candidate) throw new Error(`candidate ${CANDIDATE_ID} is not the verify bot's`);

const [variantRows] = await connection.query(
  "SELECT id, candidateId, userId, imageKey, internalPrompt, parentVariantId FROM casting_candidate_variants "
  + "WHERE candidateId = ? AND userId = ? ORDER BY id ASC",
  [CANDIDATE_ID, USER_ID],
);
const variants = new Map((variantRows as any[]).map((row) => [row.id as number, row]));

const base = process.env.R2_PUBLIC_URL!.replace(/\/$/, "");
console.log(`master: ${base}/${candidate.imageKey}`);

/* The words FIRST, before a single byte is fetched: a seed whose rows would be
   dropped by the projection is a seed that photographs an empty panel. */
const planned: Array<{ variantId: number; facet: Facet; region: string; name: string }> = [];
for (const step of PLAN) {
  const variant = variants.get(step.variantId);
  if (!variant) throw new Error(`variant ${step.variantId} is not on candidate ${CANDIDATE_ID}`);
  const prompt = typeof variant.internalPrompt === "string"
    ? JSON.parse(variant.internalPrompt)
    : variant.internalPrompt;
  const value = currentValueOfFacet(readResolvedIdentity(prompt), step.facet);
  const name = nameForFacet(step.facet, value);
  const region = regionNameOf(step.facet);
  if (!name) throw new Error(`variant ${step.variantId} has no delivered value for ${step.facet}`);
  if (!region) throw new Error(`${step.facet} has no region and can never own pixels`);
  planned.push({ variantId: step.variantId, facet: step.facet, region, name });
  console.log(`  v${step.variantId}  ${step.facet.padEnd(10)} region "${region}"  →  "${name}"`);
}

if (!SPEND) {
  console.log("\nPlan only. Re-run with --spend to ask fal for the regions and write the rows.");
  await connection.end();
  process.exit(0);
}

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY is not set — the real reader is the point of this seed");
const reader = createFalRegionReader({ apiKey });

/*
  EACH REGION IS READ ON THE FRAME IT WILL BE CUT FROM, never on the master.
  The two are different sizes here (seeded fact 1), and a mask measured against
  one frame and applied to another is the mislabelled-frame class — the thing
  `assertGeometry` refuses at the write, arriving one layer earlier.
*/
for (const entry of planned) {
  const variant = variants.get(entry.variantId)!;
  const compositeBytes = await fetchBytes(`${base}/${variant.imageKey}`);
  const composite = await readRaster(compositeBytes);
  const regionMask = await reader.region({
    image: compositeBytes, name: entry.region, absentIsAnswer: false,
  });
  console.log(
    `\nv${entry.variantId} ${entry.facet}: frame ${composite.width}×${composite.height}, `
    + `region "${entry.region}" = ${countMask(regionMask)} px of ${regionMask.width}×${regionMask.height}`,
  );

  const cuts = cutSegments({
    composite,
    applied: wholeFrame(composite),
    facetRegions: new Map([[entry.facet, entry.region]]),
    regionMasks: new Map([[entry.region, regionMask]]),
  });
  if (cuts.length === 0) {
    console.log("  NO CUT — this render changed nothing inside that region. Nothing filed.");
    continue;
  }
  for (const cut of cuts) {
    console.log(`  cut ${cut.facet}: ${cut.pixels} px, box ${cut.box.width}×${cut.box.height} at `
      + `(${cut.box.x},${cut.box.y}) in ${cut.frame.width}×${cut.frame.height}`);
  }

  const result = await persistSegmentsForVariant({
    userId: USER_ID,
    variantId: entry.variantId,
    cuts,
    /*
      `verdict` is varchar(24) — the product writes the literal "verified" and
      nothing longer, and a 68-character sentence here cost this seed a whole
      run: the insert died, `keepSegmentsFromRender` swallowed it by design
      ("the picture stands"), and three pairs of objects went to the bucket with
      no row. The manifest is what saves that — undischarged, so the worker
      collects them. The word marks these rows as seeded wherever they are read.
    */
    verdict: "dev-seed",
    verifiedAt: new Date(),
    /* The store is dark in dev by flag, and this is the one place that is
       deliberately overridden — declared here rather than by exporting the
       flag, so nothing else in the tree inherits the override. */
    dependencies: { enabledFor: () => true },
  });
  console.log(`  ${result.outcome}: ${result.segments.map((s) => `${s.facet}@v${s.version}`).join(", ")}`);
}

for (const link of LINEAGE) {
  await connection.query(
    "UPDATE casting_candidate_variants SET parentVariantId = ? WHERE id = ? AND userId = ? AND candidateId = ?",
    [link.parentVariantId, link.variantId, USER_ID, CANDIDATE_ID],
  );
  console.log(`lineage: variant ${link.variantId} was made from ${link.parentVariantId} [DEV SEED]`);
}

await connection.query(
  "UPDATE casting_candidates SET selectedVariantId = ? WHERE id = ? AND userId = ?",
  [19, CANDIDATE_ID, USER_ID],
);
console.log(`selected: candidate ${CANDIDATE_ID} is looking at variant 19`);

await connection.end();
/*
  THE APP'S OWN POOL IS STILL OPEN, and nothing here can close it: `getDb()`
  hands out a module-level pool with no exported shutdown. A script that runs
  app services in-process therefore never exits on its own — which is exactly
  how four `drive-casting-v2-segment-store-disposable` stacks and three bench
  stacks were found still resident on this machine, days after they finished.
  Every one of them had completed its work. Exiting explicitly is the fix a
  disposable script can make.
*/
process.exit(0);
