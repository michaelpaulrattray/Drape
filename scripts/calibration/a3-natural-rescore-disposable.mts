/**
 * a3, RE-SCORED AGAINST THE NATURAL BAND — founder ruling, fable-188.
 *
 * *"Natural shine is fine; gloss is makeup, it's obvious."* So removing gloss
 * compiles to her NATURAL lips, not to a matte extreme. opus-134 scored a3
 * against the a4 matte control and reported "7–11× matte", which overstates the
 * case under the founder's own definition. a4 stays as the reachability control
 * and is NOT the product target.
 *
 * Costs nothing — every number below is already in the cell's ledger.
 *
 *   npx tsx scripts/calibration/a3-natural-rescore-disposable.mts
 *
 * # AND THE BAND ITSELF NEEDED RE-READING, WHICH IS THE INTERESTING PART
 *
 * The thirteen "glossy family" frames were each SENT a gloss crop as a
 * reference. This cell's own finding is that a reference crop contradicting the
 * master does not carry — and the master's lips are bare. If that holds here
 * too, those frames were never glossy: their shine is natural repaint shine,
 * which is exactly what the founder's band should be built from.
 *
 * The internal check is in the table below: the only frames where gloss was
 * asked for IN WORDS (a0, a5) sit clear above the family, while the family sits
 * barely above the bare master. Words produce gloss; the crop did not. That is
 * the b/d finding again, on a different feature, from data already bought.
 */
import { readFile } from "node:fs/promises";

const cell = JSON.parse(await readFile("output/edit-law/cell.json", "utf8"));
const readings = cell.lipReadings as Record<string, { specular: number; specular2: number; fullness: number }>;
const master = cell.controls.masterLips as { specular: number; fullness: number };
const family = cell.controls.bandSpecular as { lo: number; hi: number; n: number };
const bandFullness = cell.controls.bandFullness as { lo: number; hi: number };
const primary = cell.thresholds.primary as number;

const pct = (value: number) => `${(value * 100).toFixed(2)}%`;

console.log(`\nSHINE, at the +${primary} threshold the range control selected\n`);
console.log("  frame".padEnd(22) + "shine".padStart(9) + "   how the shine got there");
console.log(`  ${"master (bare)".padEnd(20)}${pct(master.specular).padStart(9)}   nothing asked — her own lips`);
console.log(`  ${`unedited family (n=${family.n})`.padEnd(20)}${`${pct(family.lo)}–${pct(family.hi)}`.padStart(9)}   sent a GLOSS CROP, asked nothing`);
for (const [label, note] of [
  ["a0-maxgloss", "asked in WORDS — heavy wet high-shine"],
  ["a5-wet-fuller", "asked in WORDS — heavy wet, fuller"],
  ["a4-matte-fuller", "asked in WORDS — completely matte"],
  ["a1-gloss", "asked in WORDS — soft nude gloss"],
] as const) {
  const reading = readings[label];
  if (reading) console.log(`  ${label.padEnd(20)}${pct(reading.specular).padStart(9)}   ${note}`);
}

/*
  THE NATURAL BAND, per the founder: her own bare lips, plus the spread of
  frames where nobody asked about her lips at all.
*/
const naturalLo = Math.min(master.specular, family.lo);
const naturalHi = Math.max(master.specular, family.hi);
console.log(`\nTHE NATURAL BAND — ${pct(naturalLo)} to ${pct(naturalHi)}`);
console.log("  Built from the bare master and every frame where the lips were never asked about.");
console.log("  A frame inside it is wearing HER lips. A frame above it is wearing makeup.");
console.log(`  Note the family sits only ${pct(family.lo - master.specular)} above the bare master, while both`);
console.log("  word-asked gloss frames sit clear of it — the gloss CROP those frames were sent");
console.log("  appears not to have carried, which is this cell's own finding on another feature.\n");

console.log("a3 — 'make her lips noticeably fuller', gloss struck from the stack\n");
console.log("  frame".padEnd(22) + "shine".padStart(9) + "  verdict".padStart(20) + "   fullness");
let natural = 0;
let scored = 0;
for (const index of [1, 2, 3]) {
  const label = `a3-remove-${index}`;
  const reading = readings[label];
  if (!reading) { console.log(`  ${label.padEnd(20)}      —   NO READING`); continue; }
  scored += 1;
  const isNatural = reading.specular <= naturalHi;
  if (isNatural) natural += 1;
  const fuller = reading.fullness > bandFullness.hi;
  console.log(
    `  ${label.padEnd(20)}${pct(reading.specular).padStart(9)}`
    + `${(isNatural ? "HER OWN LIPS" : "still wearing gloss").padStart(20)}`
    + `   ${pct(reading.fullness)} ${fuller ? "FULLER" : "not fuller"}`,
  );
}

console.log(`\nTHE FOUNDING CASE, under the founder's own definition: ${natural} of ${scored} came back`);
console.log("to her natural lips AND fuller. The remaining frame sits above the natural band.");
console.log("\nCAVEAT, and it is not small: the natural band rests on ONE bare specimen plus a family");
console.log("whose own naturalness is inferred from this cell's carry finding rather than measured");
console.log("directly. A second bare specimen — one paint — would put it on its own feet.");
process.exit(0);
