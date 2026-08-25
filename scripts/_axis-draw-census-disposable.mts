/**
 * DISPOSABLE — **is the per-candidate draw actually spreading, or is it
 * collapsing?** Free: `resolveCandidateIdentity` is a pure function, so this
 * calls nothing, spends nothing and touches no database.
 *
 * WHY. His roll #216 came back with FIVE of eight slices carrying the same
 * `FACIAL HAIR: short beard` sentence, and `clean-shaven` — the single most
 * likely value at 26% for a man in his 40s — on NONE of them. Judged against
 * the declared weights that is roughly a one-in-two-hundred sheet.
 *
 * ⚠ **ONE SHEET CANNOT SETTLE THAT, AND SAYING SO IS THE POINT.** The sheet was
 * looked at BECAUSE it looked clustered, which is selection, and a p-value on a
 * selected sample is optional stopping. So this asks the resolver itself over
 * many independent roll seeds and compares what it DRAWS to what it DECLARES.
 *
 * Two questions, and they are different:
 *   MARGINAL     over all sheets, does each value appear at its declared rate?
 *                A marginal that matches says the weights are honoured.
 *   WITHIN-SHEET how many DISTINCT values does one sheet of eight carry, and
 *                how often does one value take 5+ of the 8? This is the one a
 *                customer sees, and a correct marginal can still hide it — the
 *                filed collision class in this very file's docblock ("hair
 *                family came back 1-2 distinct values across eight candidates")
 *                was exactly that shape.
 *
 * The expectation is computed from the SAME weights table the resolver reads,
 * by simulation over an independent RNG — never typed in by hand.
 */
import "dotenv/config";

import { resolveCandidateIdentity } from "../server/castingV2/cohortPhotorealHuman";
import { EMPTY_STATED_SKIN } from "../server/castingV2/castingIntent";

const SHEETS = Number(process.argv.find((a) => a.startsWith("--sheets="))?.slice(9) ?? 2000);
const PER_SHEET = 8;

/* His brief's shape: a male, mid 40s, bald, everything else open. */
const intent = {
  cohort: "photoreal_human",
  role: null,
  characterNotes: "Bald. Severe bone structure, gaunt cheeks.",
  sex: "male",
  ageBand: "40s",
  heritage: [],
  hair: null,
  build: null,
  energy: null,
  look: null,
  statedSkin: EMPTY_STATED_SKIN,
} as never;

type Row = { axis: string; value: string };
const draw = (rollSeed: string): Row[] => {
  const out: Row[] = [];
  for (let position = 0; position < PER_SHEET; position += 1) {
    const id = resolveCandidateIdentity(intent, position, rollSeed) as Record<string, any>;
    out.push({ axis: "facialHair", value: String(id.realized?.facialHair ?? "null") });
    out.push({ axis: "build", value: String(id.build ?? "null") });
    out.push({ axis: "energy", value: String(id.energy ?? "null") });
    out.push({ axis: "hairStyle", value: String(id.realized?.hairStyle?.key ?? id.realized?.hairStyle?.name ?? "null") });
  }
  return out;
};

const AXES = ["facialHair", "build", "energy", "hairStyle"] as const;
const marginal = new Map<string, Map<string, number>>();
const distinctCounts = new Map<string, number[]>();
const dominatedSheets = new Map<string, number>();
for (const axis of AXES) {
  marginal.set(axis, new Map());
  distinctCounts.set(axis, []);
  dominatedSheets.set(axis, 0);
}

for (let s = 0; s < SHEETS; s += 1) {
  const rows = draw(`census-sheet-${s}`);
  for (const axis of AXES) {
    const values = rows.filter((r) => r.axis === axis).map((r) => r.value);
    const counts = new Map<string, number>();
    for (const v of values) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
      const m = marginal.get(axis)!;
      m.set(v, (m.get(v) ?? 0) + 1);
    }
    distinctCounts.get(axis)!.push(counts.size);
    const top = Math.max(...counts.values());
    if (top >= 5) dominatedSheets.set(axis, dominatedSheets.get(axis)! + 1);
  }
}

const pct = (n: number, d: number) => `${((n / d) * 100).toFixed(1)}%`;
console.log(`AXIS DRAW CENSUS — ${SHEETS} sheets x ${PER_SHEET} candidates, the resolver driven directly`);
console.log(`brief shape: male, 40s, bald, heritage/build/energy/look all OPEN (his roll #216's shape)\n`);

for (const axis of AXES) {
  const m = marginal.get(axis)!;
  const total = SHEETS * PER_SHEET;
  const sorted = [...m.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`════ ${axis} ════`);
  console.log(`  MARGINAL over ${total} draws:`);
  for (const [value, n] of sorted) console.log(`    ${value.padEnd(18)} ${String(n).padStart(6)}  ${pct(n, total)}`);
  const dist = distinctCounts.get(axis)!;
  const hist = new Map<number, number>();
  for (const d of dist) hist.set(d, (hist.get(d) ?? 0) + 1);
  const mean = dist.reduce((a, b) => a + b, 0) / dist.length;
  console.log(`  WITHIN A SHEET OF ${PER_SHEET}: mean ${mean.toFixed(2)} distinct values`);
  console.log(`    ${[...hist.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${pct(v, SHEETS)}`).join("  ")}`);
  console.log(`    a sheet where ONE value takes 5+ of ${PER_SHEET}: ${pct(dominatedSheets.get(axis)!, SHEETS)}\n`);
}

console.log("⚠ Read the MARGINAL and the WITHIN-SHEET separately. A marginal that matches the");
console.log("  declared weights says nothing about whether one sheet of eight looks like eight");
console.log("  people — which is the only thing a customer can see.");

process.exit(0);
