/**
 * THE BORN-WORN DETECTOR'S TRIAL — the court that decides whether a class may
 * arm (working law 2, and fable-085 §2's condition on the catalogue).
 *
 * The detector's job in its new role is not "measure coverage", it is **decide
 * whether a row exists**. So this court runs the product's own
 * `detectBornWorn` — the function the catalogue calls — over two populations
 * and reads the thing that actually matters: a row, or no row.
 *
 * # Both controls, in one sitting
 *
 * The positive arm is a roll whose brief asked for glasses; the negative arm is
 * rolls whose briefs never mention eyewear. **Both are read in this run**, on
 * this day, through this segmenter — a negative control quoted from a previous
 * session is a number, not a control, and this program has been bitten by
 * exactly that.
 *
 * Specimens are chosen by the BRIEF, in `born-worn-specimens-disposable.mts`,
 * so the set is independent of the instrument on trial.
 *
 * # What a miss means, and why this script will not decide that for you
 *
 * A bespectacled BRIEF is not a bespectacled FACE: this pipeline's own history
 * includes briefs that failed to appear. So a positive-arm specimen that reads
 * absent is printed as `LOOK` rather than as a detector failure, its frame is
 * saved, and a human opens it. Reports are claims; artifacts are facts.
 *
 * Every detection's own crop is saved too — a coverage number cannot tell you
 * the mask found her GLASSES rather than her hairline, and a catalogue that
 * names the wrong part of her face is worse than no catalogue.
 *
 *   FAL_KEY=… npx tsx scripts/calibration/born-worn-court.mts
 */
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

import { createFalRegionReader } from "../../server/castingV2/falRegionReader";
import {
  BORN_WORN_CLASSES,
  BORN_WORN_DETECTOR,
  detectBornWorn,
} from "../../server/castingV2/bornWornDetector";
import { boundsOf, cropRaster, cropMask } from "../../server/castingV2/segmentCuts";
import { readRaster } from "../../server/castingV2/maskedComposite";
import { fetchImageBytes } from "../lib/imageBytes.mjs";

const OUT = "output/born-worn";
mkdirSync(OUT, { recursive: true });

const apiKey = process.env.FAL_KEY;
if (!apiKey) {
  /* A harness that cannot measure must refuse, not assume. */
  console.error("FAL_KEY is required — this court reads real faces through the production segmenter.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(`${OUT}/specimens.json`, "utf8")) as {
  drawnAt: string;
  source: string;
  selectedBy: string;
  arms: Record<"bespectacled" | "bare", Array<{ candidate: string; url: string; roll: string; brief: string }>>;
};

const only = process.argv.includes("--class")
  ? process.argv[process.argv.indexOf("--class") + 1]
  : "glasses";
const armed = BORN_WORN_CLASSES.filter((entry) => entry.id === only);
if (armed.length === 0) {
  console.error(`no such class "${only}" in the catalogue`);
  process.exit(1);
}
const subject = armed[0];

/*
  THE COURT MAY TRY AN UNARMED CLASS — that is what a court is for. It reads
  with a candidate floor supplied on the command line so the table can show
  where the two populations actually sit before anybody writes a number into
  the catalogue.
*/
const floorArg = process.argv.includes("--floor")
  ? Number(process.argv[process.argv.indexOf("--floor") + 1])
  : subject.floor;
if (typeof floorArg !== "number" || !Number.isFinite(floorArg)) {
  console.error(`"${only}" has no measured floor — pass one to try it: --floor 0.001`);
  process.exit(1);
}
const onTrial = { ...subject, floor: floorArg, armed: true };

const reader = createFalRegionReader({ apiKey });

type Row = {
  arm: "bespectacled" | "bare";
  candidate: string;
  brief: string;
  coverage: number | null;
  filed: boolean;
  failure?: string;
};

const rows: Row[] = [];

for (const arm of ["bespectacled", "bare"] as const) {
  for (const specimen of manifest.arms[arm]) {
    let row: Row = { arm, candidate: specimen.candidate, brief: specimen.brief, coverage: null, filed: false };
    try {
      const image = await fetchImageBytes(specimen.url);
      const scan = await detectBornWorn({ image: image.bytes, reader, classes: [onTrial] });
      const found = scan.detections.find((detection) => detection.facet === onTrial.id);
      const absent = scan.absent.find((entry) => entry.facet === onTrial.id);
      const failed = scan.failed.find((entry) => entry.facet === onTrial.id);

      row = {
        arm,
        candidate: specimen.candidate,
        brief: specimen.brief,
        coverage: found?.coverage ?? absent?.coverage ?? null,
        filed: Boolean(found),
        failure: failed?.detail,
      };

      /* The artifact, saved for every specimen — the frame always, and for a
         detection the CROP it would file, because the number cannot tell you
         the mask found the right thing. */
      writeFileSync(`${OUT}/${arm}-${specimen.candidate.slice(0, 8)}.png`, image.bytes);
      if (found) {
        const frame = await readRaster(image.bytes);
        const box = boundsOf(found.mask);
        if (box) {
          const crop = cropRaster(frame, box);
          const stencil = cropMask(found.mask, box);
          await sharp(crop.data, { raw: { width: crop.width, height: crop.height, channels: 3 } })
            .png()
            .toFile(`${OUT}/${arm}-${specimen.candidate.slice(0, 8)}-CROP.png`);
          await sharp(stencil.data, { raw: { width: stencil.width, height: stencil.height, channels: 1 } })
            .png()
            .toFile(`${OUT}/${arm}-${specimen.candidate.slice(0, 8)}-MASK.png`);
        }
      }
    } catch (error) {
      row.failure = error instanceof Error ? error.message : String(error);
    }
    rows.push(row);
    const read = row.coverage === null ? "  NO-READ" : `${(row.coverage * 100).toFixed(3)}%`;
    console.log(
      `${arm.padEnd(13)} ${row.candidate.slice(0, 8)}  ${read.padStart(9)}  ${row.filed ? "ROW" : "—  "}`
      + (row.failure ? `  (${row.failure.slice(0, 60)})` : ""),
    );
  }
}

/* ------------------------------------------------------------- the table */

const positives = rows.filter((row) => row.arm === "bespectacled");
const negatives = rows.filter((row) => row.arm === "bare");
const filedPositives = positives.filter((row) => row.filed);
const filedNegatives = negatives.filter((row) => row.filed);
const positiveReadings = positives.map((row) => row.coverage).filter((value): value is number => value !== null);
const negativeReadings = negatives.map((row) => row.coverage).filter((value): value is number => value !== null);

/*
  A NO-READ IS NOT A CLEAN NEGATIVE — and this court's first run proved why the
  rule has to be written into the arithmetic rather than remembered.

  Every one of 24 specimens failed to fetch (production keys against the dev
  bucket), and the naive summary printed "NEGATIVE control rows filed: 0/12",
  which reads exactly like a perfect negative control. Zero rows from zero
  readings is the false-pass class D-235 names: an absence produced by a broken
  instrument, scored as evidence of absence. So the negative arm is INVALID
  unless every specimen in it actually produced a reading.
*/
const negativeValid = negatives.length > 0 && negativeReadings.length === negatives.length;
const positiveValid = positiveReadings.length > 0;

const table = [
  "",
  `# THE BORN-WORN COURT — class "${onTrial.id}"`,
  "",
  `detector      ${BORN_WORN_DETECTOR}`,
  `floor         ${onTrial.floor}  (${(onTrial.floor * 100).toFixed(3)}% of the frame)`,
  `floor's origin ${subject.measurement}`,
  `read at       ${new Date().toISOString()}`,
  `specimens     ${manifest.source}, drawn ${manifest.drawnAt}`,
  `selected by   ${manifest.selectedBy}`,
  `n             ${positives.length} bespectacled, ${negatives.length} bare — both read in THIS sitting`,
  "",
  `readings      ${positiveReadings.length}/${positives.length} bespectacled, ${negativeReadings.length}/${negatives.length} bare`,
  "",
  `POSITIVE control  rows filed: ${filedPositives.length}/${positiveReadings.length} of the specimens that READ`
  + (positiveValid ? "" : "   ← INVALID: nothing read"),
  `NEGATIVE control  rows filed: ${filedNegatives.length}/${negativeReadings.length} of the specimens that READ  (must be 0)`
  + (negativeValid ? "" : `   ← INVALID: ${negatives.length - negativeReadings.length} bare specimen(s) never read;`
    + " zero rows from zero readings is not a clean negative"),
  "",
  `bespectacled coverage  ${positiveReadings.length ? `${(Math.min(...positiveReadings) * 100).toFixed(3)}% – ${(Math.max(...positiveReadings) * 100).toFixed(3)}%` : "no reads"}`,
  `bare coverage          ${negativeReadings.length ? `${(Math.min(...negativeReadings) * 100).toFixed(3)}% – ${(Math.max(...negativeReadings) * 100).toFixed(3)}%` : "no reads"}`,
  "",
  `VERDICT       ${
    positiveValid && negativeValid && filedNegatives.length === 0 && filedPositives.length === positiveReadings.length
      ? "the class may arm — both controls read, and they separate"
      : "NOT PROVEN — read the lines above before arming anything"
  }`,
  "",
  ...positives.filter((row) => !row.filed).map((row) =>
    `LOOK  ${row.candidate.slice(0, 8)} read ${row.coverage === null ? "NO-READ" : `${(row.coverage * 100).toFixed(3)}%`} on a brief that asked for glasses`
    + ` — open ${OUT}/bespectacled-${row.candidate.slice(0, 8)}.png before calling this a miss`),
  "",
];
console.log(table.join("\n"));

writeFileSync(
  `${OUT}/court-${onTrial.id}.json`,
  JSON.stringify({
    class: onTrial.id,
    detector: BORN_WORN_DETECTOR,
    floor: onTrial.floor,
    floorOrigin: subject.measurement,
    readAt: new Date().toISOString(),
    specimens: { source: manifest.source, drawnAt: manifest.drawnAt, selectedBy: manifest.selectedBy },
    rows,
  }, null, 2),
);
writeFileSync(`${OUT}/court-${onTrial.id}.txt`, table.join("\n"));
