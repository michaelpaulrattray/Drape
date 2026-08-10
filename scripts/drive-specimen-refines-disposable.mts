/**
 * THE COMPLETENESS SPECIMENS, BOUGHT ON THE PAID PATH — one kind at a time.
 *
 * # Why a specimen cannot be made any other way
 *
 * The guard's threshold for a kind is *the coverage of one crop a human looked
 * at and called complete* (`referenceCompleteness`). Exactly one kind has one:
 * `hair`, at 94.6%, measured on the delivered-anchored cut of v#163. Every other
 * kind refuses at `noSpecimen` — deliberately, because borrowing hair's number
 * would be a measurement about hair adjudicating a lip.
 *
 * A MASTER read cannot supply the missing ones. With no edit governing the
 * frame, `applied` is the whole picture, so the cut IS the region and the guard
 * scores it against a second read of the same region on the same frame:
 * coverage ≈ 1.0 by construction, whatever the cutter did. Every wholeFrame slot
 * in the shift-28 demo read exactly 100.0%, which is a fine identity control and
 * not a specimen (opus-153 §1, ratified fable-210 §2).
 *
 * So a specimen has to come off a REAL DELIVERED RENDER, and this buys them.
 *
 * # The artifact is the product's own, not a reproduction (fable-213)
 *
 * The delivered-anchored cut `applied ∩ (region(delivered) ∪ region(master))` is
 * already persisted by the segment store, with its content and its mask, for
 * every facet a render earns. That is the same source hair's 94.6% came from —
 * so the kinds end up comparable to each other, which is the whole point of a
 * threshold family. This script therefore ADDS NOTHING to the paid path: it
 * drives a real refine, then reads the rows that render wrote.
 *
 * Re-deriving the cut offline instead would have been one argument away from
 * worthless: a specimen measured on a recomputed `applied` is not a measurement
 * of what the product made.
 *
 *   npx tsx scripts/drive-specimen-refines-disposable.mts --inventory
 *   npx tsx scripts/drive-specimen-refines-disposable.mts --kind lips
 *
 * `--inventory` buys nothing and prints what a real run would spend.
 *
 * # What it does NOT decide
 *
 * It does not adopt anything. It writes every crop to disk beside its number and
 * stops, because the label on a specimen is a HUMAN VERDICT on the picture and
 * the instrument's job is only to read it (`COMPLETENESS_SPECIMENS.source`). A
 * number adopted without somebody looking is the input-label class wearing a
 * demo plan.
 */
import "dotenv/config";

import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

import mysql from "mysql2/promise";
import sharp from "sharp";

import { assertOneWorld, APP_WRITE_PATH_KEYS } from "./lib/worldGuard.mts";
import { fetchImageBytes } from "./lib/imageBytes.mts";
import { refineCandidate } from "../server/castingV2/refineService";
import { selectVariant } from "../server/db/castingV2Variants";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { measureCoverage } from "../server/castingV2/referenceCompleteness";
import type { Mask } from "../server/castingV2/maskedComposite";

const OUT = path.join("output", "specimens");
const USER_ID = 1;
const CANDIDATE_ID = 359;

/**
 * ONE HONEST EDIT PER SPECIMEN-BEARING KIND.
 *
 * `nose` is missing on purpose. There is no instruction that changes a nose and
 * leaves a nose to crop against — every honest one either restructures the
 * region the crop is scored against or is a no-op, and a specimen minted from a
 * dishonest ask poisons its kind for every instance after it.
 *
 * `hair` is not re-bought: it has a specimen, and buying a second one to
 * confirm the first is how a threshold family quietly becomes an average.
 */
const KINDS = [
  { kind: "lips", instruction: "a fuller cupid's bow", expect: "lips" },
  { kind: "glasses", instruction: "put her in thin gold wire-frame glasses", expect: "glasses" },
  { kind: "earring", instruction: "give her small gold hoop earrings", expect: "earring" },
] as const;

const INVENTORY = process.argv.includes("--inventory");
const ONLY = (() => {
  const index = process.argv.indexOf("--kind");
  return index > -1 ? process.argv[index + 1] : null;
})();

type SegmentRow = {
  id: number;
  facet: string;
  region: string;
  contentKey: string;
  maskKey: string;
  bboxX: number;
  bboxY: number;
  bboxW: number;
  bboxH: number;
  frameWidth: number;
  frameHeight: number;
};

/** A stored mask PNG back into the single-channel buffer the guard measures. */
async function decodeMask(bytes: Buffer): Promise<Mask> {
  const image = sharp(bytes);
  const meta = await image.metadata();
  const pipeline = meta.hasAlpha ? sharp(bytes).extractChannel(3) : sharp(bytes).toColourspace("b-w");
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  if (data.length !== info.width * info.height) {
    throw new Error(`a stored mask decoded to ${data.length} bytes for ${info.width}x${info.height}`);
  }
  return { data: Buffer.from(data), width: info.width, height: info.height };
}

async function main(): Promise<void> {
  /* This runs `refineCandidate` in-process, so it writes rows AND objects — the
     whole write-path set, not the two keys this file mentions by name. */
  assertOneWorld(APP_WRITE_PATH_KEYS);
  mkdirSync(OUT, { recursive: true });

  const planned = KINDS.filter((entry) => ONLY === null || entry.kind === ONLY);
  console.log(`candidate    ${CANDIDATE_ID}, user ${USER_ID}, DEV database`);
  console.log(`kinds        ${planned.map((entry) => entry.kind).join(", ")}`);
  console.log(`renders      ${planned.length} paid render(s) — dev credits, real provider dollars`);
  console.log(`guard reads  1 vision call per segment the render writes`);
  if (INVENTORY) {
    console.log("\n--inventory: nothing bought.");
    return;
  }

  const apiKey = process.env.FAL_KEY;
  if (!apiKey) throw new Error("FAL_KEY is required — a specimen needs the reader that will judge it");
  const reader = createFalRegionReader({ apiKey });

  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const [candidates] = await connection.query(
    "select id, publicId from casting_candidates where id=? and userId=?",
    [CANDIDATE_ID, USER_ID],
  ) as [Array<{ id: number; publicId: string }>, unknown];
  const candidate = candidates[0];
  if (!candidate) throw new Error(`candidate ${CANDIDATE_ID} is not user ${USER_ID}'s`);

  for (const entry of planned) {
    console.log(`\n=== ${entry.kind} — "${entry.instruction}"`);
    /* From the ORIGINAL every time, so one kind's edit is never the next
       kind's master. A stack would make each specimen a measurement of a
       different face. */
    await selectVariant({ userId: USER_ID, candidatePublicId: candidate.publicId, variantPublicId: null });

    const started = Date.now();
    let result;
    try {
      result = await refineCandidate({}, {
        userId: USER_ID,
        clientRequestId: randomUUID(),
        candidatePublicId: candidate.publicId,
        instruction: entry.instruction,
      });
    } catch (error) {
      console.log(`  REFUSED — ${(error as Error).message.slice(0, 200)}`);
      continue;
    }
    const seconds = Math.round((Date.now() - started) / 1000);
    console.log(`  ${result.kind} in ${seconds}s — variant ${result.variantId ?? "(original)"}`);
    if (result.kind !== "rendered" || !result.variantId) {
      console.log("  nothing was rendered, so there is no delivered frame to cut from");
      continue;
    }

    const [rows] = await connection.query(
      `select s.id, s.facet, s.region, s.contentKey, s.maskKey, s.bboxX, s.bboxY, s.bboxW, s.bboxH,
              s.frameWidth, s.frameHeight
         from casting_segments s
         join casting_candidate_variants v on v.id = s.variantId
        where v.publicId = ? and s.userId = ?`,
      [result.variantId, USER_ID],
    ) as [SegmentRow[], unknown];

    if (rows.length === 0) {
      console.log("  the render wrote no segment — nothing to measure, and that is the finding");
      continue;
    }

    const delivered = await fetchImageBytes(result.imageUrl);
    writeFileSync(path.join(OUT, `${entry.kind}-delivered.png`), delivered.bytes);

    for (const row of rows) {
      const content = await fetchImageBytes(`${process.env.R2_PUBLIC_URL}/${row.contentKey}`);
      const maskBytes = await fetchImageBytes(`${process.env.R2_PUBLIC_URL}/${row.maskKey}`);
      /* A crop and its mask share an index, so the pair reads as one thing. */
      const stem = `${entry.kind}-${row.facet.replace(/[^\w.-]/g, "_")}`;
      writeFileSync(path.join(OUT, `${stem}.png`), content.bytes);
      writeFileSync(path.join(OUT, `${stem}-mask.png`), maskBytes.bytes);

      /*
        THE GUARD'S OWN READING, taken the way the guard takes it: a SECOND,
        independent full read of this crop's region on the frame the crop claims
        to represent. Not the mask that cut it — that is the checker that cannot
        fail, and it is the one thing this measurement may not do.
      */
      let line = `  ${row.facet.padEnd(18)} ${row.region.padEnd(12)} ${row.bboxW}x${row.bboxH}`;
      try {
        const region = await reader.region({
          image: delivered.bytes,
          name: row.region,
          absentIsAnswer: true,
        });
        const mask = await decodeMask(maskBytes.bytes);
        const reading = measureCoverage(
          { mask, box: { x: row.bboxX, y: row.bboxY, width: row.bboxW, height: row.bboxH } },
          region,
        );
        line += `  coverage ${(reading.coverage * 100).toFixed(1)}%`
          + `  spill ${(reading.spill * 100).toFixed(1)}%`
          + `  region ${reading.regionPixels}px  crop ${reading.cropPixels}px`;
      } catch (error) {
        line += `  READ DID NOT SETTLE — ${(error as Error).message.slice(0, 80)}`;
      }
      console.log(line);
    }
  }

  await connection.end();
  console.log(`\ncrops written to ${OUT} — LOOK AT THEM before any number is adopted.`);
}

await main();
process.exit(0);
