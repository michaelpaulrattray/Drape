/**
 * MINT THE DELIVERED CROP FOR ONE ALREADY-PAID FRAME — the shipped function,
 * driven on the shipped inputs, after the floor correction.
 *
 * # Why this exists rather than a second paid render
 *
 * Variant `492` was rendered and CHARGED, the tattoo landed, and the mint's
 * live call site ran and answered `no-cut / tooSmall` — the log line
 * `[refineService] the delivered tattoo's own crop` is the proof that the wire
 * is live, and the refusal was the upload door's floor applied to the wrong
 * population (see `inkDeliveryCrop.ts`'s header).
 *
 * The floor is gone. Re-buying the render to re-run one segmenter call would
 * spend 25 more credits to learn nothing the frame does not already hold, so
 * this drives `mintInkDeliveryCrop` — THE SAME FUNCTION the render calls, with
 * the same arguments the render passed — on the same delivered bytes.
 *
 * It spends ONE segmenter call of house money and no credits.
 *
 *   npx tsx scripts/mint-delivered-crop-disposable.mts <variantPublicId>
 */
import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";

import { mintInkDeliveryCrop } from "../server/castingV2/inkDeliveryMint";
import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

const OUT = "output/court-carry-a";

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const databaseUrl = process.env[databaseKey];
if (!databaseUrl) throw new Error("no database URL");

const wanted = process.argv[2];
if (!wanted) throw new Error("name the variant publicId");

const base = process.env.R2_PUBLIC_URL;
if (!base) throw new Error("R2_PUBLIC_URL is not set");

await mkdir(OUT, { recursive: true });

const connection = await openDatabase(databaseUrl);
/* Every fact from the ROW rather than from a log line I retyped — a
   reconstructed input is a claim (`reconstruction-needs-an-independent-record`). */
const [rows] = await connection.query<any[]>(
  `SELECT v.publicId AS variant, v.imageKey, v.deltas, c.publicId AS candidate, c.userId
     FROM casting_candidate_variants v
     JOIN casting_candidates c ON c.id = v.candidateId
    WHERE v.publicId = ?`,
  [wanted],
);
const row = rows[0];
if (!row) throw new Error(`no variant ${wanted}`);
/*
  BOTH POINTER FIELDS, since 0050 — `inkApplied` names the design (absent on
  D-137's words road) and `inkDelivered` names the crop this render's chain
  already promised. The crop's NAME comes from the chain and is never minted
  here: a fresh uuid would file a row nothing points at, and the carry would
  find nothing while this script printed `minted`.
*/
const chain = row.deltas as {
  inkApplied?: Record<string, string>;
  inkDelivered?: Record<string, string>;
} | null;
const applied = chain?.inkApplied ?? {};
const delivered = chain?.inkDelivered ?? {};
const slot = Object.keys(delivered)[0] ?? Object.keys(applied)[0];
if (slot === undefined) throw new Error("that variant delivered no ink — nothing to mint");
const designPublicId = applied[slot];
const cropPublicId = delivered[slot];
if (cropPublicId === undefined) {
  throw new Error(
    `that variant's chain names no crop for ${slot} — it was claimed before migration 0050, and re-minting one under a fresh name would file a row nothing points at`,
  );
}

console.log(`variant ${row.variant} · candidate ${row.candidate} · user ${row.userId}`);
console.log(`delivered: ${slot} -> crop ${cropPublicId} · design ${designPublicId ?? "(painted from words)"}`);

const url = `${base.replace(/\/$/, "")}/${row.imageKey}`;
const frame = Buffer.from(await (await fetch(url)).arrayBuffer());
console.log(`frame:   ${url} (${frame.length} bytes)`);

const outcome = await mintInkDeliveryCrop({
  userId: row.userId,
  candidatePublicId: row.candidate,
  variantPublicId: row.variant,
  frame,
  delivered: {
    cropPublicId,
    slot,
    ...(designPublicId === undefined ? {} : { designPublicId }),
  },
});
console.log("outcome:", outcome);

/*
  ⚠ BY THE VARIANT, NEVER BY THE SLOT. The first version of this query read the
  newest row for the slot and printed ANOTHER FRAME'S CROP as this one's result,
  under a filename naming this variant — a report about the wrong picture, which
  is the exact failure this whole build is guarding at the frames.
*/
const [crops] = await connection.query<any[]>(
  `SELECT d.storageKey, d.width, d.height, d.bboxX, d.bboxY, d.frameWidth, d.frameHeight,
          d.maskPixels, d.keptPixels, v.publicId AS fromVariant
     FROM casting_ink_delivery_crops d
     JOIN casting_candidate_variants v ON v.id = d.variantId
    WHERE d.variantId = (SELECT id FROM casting_candidate_variants WHERE publicId = ?)
      AND d.slot = ?`,
  [wanted, slot],
);
await connection.end();
if (crops.length === 0) {
  console.log("no row — nothing was kept");
  process.exit(0);
}
const crop = crops[0];
console.log("row:", crop);
/* THE PICTURE, SAVED AND LOOKED AT. The numbers are a pointer; the frame is the
   finding (law 9), and this road has already had one cut that reported perfect
   numbers over an uncut photograph of a man. */
const cropUrl = `${base.replace(/\/$/, "")}/${crop.storageKey}`;
const bytes = Buffer.from(await (await fetch(cropUrl)).arrayBuffer());
await writeFile(`${OUT}/${row.variant.slice(0, 8)}-carry.png`, bytes);
console.log(`crop:    ${OUT}/${row.variant.slice(0, 8)}-carry.png (${bytes.length} bytes)  <- ${cropUrl}`);

process.exit(0);
