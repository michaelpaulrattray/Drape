/** Prints the pre-registered A/B analysis. Run after a calibration A/B phase. */
import { analyseRoll, type RollStats } from "./analyse.mts";

const BRIEFS = [
  "tight-1", "tight-2", "tight-3", "tight-4",
  "loose-1", "loose-2", "loose-3", "loose-4",
  "nonhuman-1", "nonhuman-2", "nonhuman-3", "nonhuman-4",
];

const rows: RollStats[] = [];
for (const brief of BRIEFS) {
  for (const path of ["A", "B"]) {
    const stats = await analyseRoll(".calibration", brief, path);
    if (stats) rows.push(stats);
  }
}

console.log("brief          path  n  spread  minDist  dupPairs");
for (const row of rows) {
  console.log(
    row.brief.padEnd(14),
    row.path.padEnd(5),
    row.count,
    row.meanSpread.toFixed(1).padStart(6),
    row.minDistance.toFixed(1).padStart(8),
    String(row.duplicatePairs).padStart(8),
  );
}

function aggregate(path: string) {
  const subset = rows.filter((row) => row.path === path);
  return {
    spread: subset.reduce((sum, row) => sum + row.meanSpread, 0) / subset.length,
    duplicates: subset.reduce((sum, row) => sum + row.duplicatePairs, 0),
    closest: Math.min(...subset.map((row) => row.minDistance)),
  };
}

const a = aggregate("A");
const b = aggregate("B");
console.log("\nAGGREGATE");
console.log(`  path A: mean spread ${a.spread.toFixed(2)} | duplicate pairs ${a.duplicates} | closest ${a.closest.toFixed(1)}`);
console.log(`  path B: mean spread ${b.spread.toFixed(2)} | duplicate pairs ${b.duplicates} | closest ${b.closest.toFixed(1)}`);
console.log(`  spread change: ${(((b.spread - a.spread) / a.spread) * 100).toFixed(1)}%`);
console.log(`  duplicate change: ${a.duplicates} → ${b.duplicates}`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
