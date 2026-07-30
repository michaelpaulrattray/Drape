/**
 * A/B analysis for the M3 calibration (plan §E.1).
 *
 * The decision rule was pre-registered before the run, and is restated here so
 * the threshold cannot be fitted to the result: path B ships only if it beats
 * path A on diversity and duplication WITHOUT losing lock fidelity or quality,
 * and within +5s median latency.
 *
 * The diversity metric is deliberately simple and stated with its limits. Each
 * candidate is reduced to a small perceptual signature (a 16×16 greyscale
 * downsample); the distance between two candidates is the mean absolute
 * difference of those signatures. Within one roll, the mean pairwise distance
 * is "spread" and the count of pairs below a near-duplicate threshold is
 * "duplicates".
 *
 * What this measures: whether eight candidates *look* different. What it does
 * NOT measure: whether they read as different *characters* — two different
 * people in the same pose score as similar, and the same person in two poses
 * scores as different. It is a screen, not a verdict, and the founder's eyes
 * on the grids remain the real check.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SIGNATURE_EDGE = 16;
/** Mean absolute difference below this reads as a near-duplicate. */
const DUPLICATE_THRESHOLD = 6;

async function signature(file: string): Promise<Uint8Array> {
  const { data } = await sharp(file)
    .greyscale()
    .resize(SIGNATURE_EDGE, SIGNATURE_EDGE, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return new Uint8Array(data);
}

function distance(a: Uint8Array, b: Uint8Array): number {
  let total = 0;
  for (let i = 0; i < a.length; i += 1) total += Math.abs(a[i] - b[i]);
  return total / a.length;
}

export type RollStats = {
  brief: string;
  path: string;
  count: number;
  meanSpread: number;
  minDistance: number;
  duplicatePairs: number;
};

export async function analyseRoll(
  dir: string,
  brief: string,
  pathName: string,
): Promise<RollStats | null> {
  const files: string[] = [];
  for (let i = 1; i <= 8; i += 1) {
    const file = path.join(dir, "images", `ab_${brief}_${pathName}_${i}.png`);
    if (fs.existsSync(file)) files.push(file);
  }
  if (files.length < 2) return null;

  const signatures = await Promise.all(files.map(signature));
  const distances: number[] = [];
  for (let i = 0; i < signatures.length; i += 1) {
    for (let j = i + 1; j < signatures.length; j += 1) {
      distances.push(distance(signatures[i], signatures[j]));
    }
  }

  return {
    brief,
    path: pathName,
    count: files.length,
    meanSpread: distances.reduce((sum, d) => sum + d, 0) / distances.length,
    minDistance: Math.min(...distances),
    duplicatePairs: distances.filter((d) => d < DUPLICATE_THRESHOLD).length,
  };
}
