/**
 * THE V4 MAP, PRINTED — *"what the product can say, the scan can see"*
 * (`docs/specs/VOCABULARY_OVERHAUL_REVIEW.md` Part 2, V4; ordered fable-645 §2).
 *
 * Every column is JOINED from the table that owns it — nothing here is a second
 * list — and the join itself lives in `server/castingV2/detectionUniversality.ts`
 * so the suite asserts the same function this prints.
 *
 * It spends nothing: no transport, no database, no credits. Static reads plus
 * the same functions production calls.
 *
 *   npx tsx scripts/v4-detection-map-disposable.mts            the map
 *   npx tsx scripts/v4-detection-map-disposable.mts --controls the map's own
 *                                                              three controls
 *
 * # WHY THE CONTROLS ARE NOT OPTIONAL
 *
 * An inventory that reports "no problems" looks exactly like an inventory that
 * cannot see one, and this program has published that shape before. So the
 * printer refuses to be believed until it has been shown a kind with no floor
 * (it must print GAP), a kind armed on a floor no court measured (VIOLATION),
 * and a kind whose court is real (SEEN, with its court quoted).
 */
import {
  detectionMap,
  detectionGaps,
  detectionViolations,
  hasCourt,
  type DetectionRow,
} from "../server/castingV2/detectionUniversality";
import { BORN_WORN_CLASSES } from "../server/castingV2/bornWornDetector";

const CONTROLS = process.argv.includes("--controls");

const line = (row: DetectionRow): string =>
  `${row.verdict.padEnd(10)} ${row.facet.padEnd(20)} ${row.lands.padEnd(13)} ${row.why}`;

if (!CONTROLS) {
  const rows = detectionMap();
  console.log("THE V4 MAP — one row per facet, joined from the tables that own each column");
  console.log("");
  for (const row of rows) console.log(line(row));

  console.log("");
  console.log("ARMING, PER KIND — the accessory table with its courts");
  for (const entry of BORN_WORN_CLASSES) {
    console.log(`  ${entry.id.padEnd(12)} ${entry.armed ? "ARMED " : "unarmed"} `
      + `floor ${String(entry.floor).padEnd(9)} court ${hasCourt(entry.measurement) ? "yes" : "NO"}`);
    console.log(`               ${entry.measurement.slice(0, 150)}`);
  }

  const gaps = detectionGaps();
  const violations = detectionViolations();
  console.log("");
  console.log(`${rows.length} facets · ${rows.filter((row) => row.verdict === "SEEN").length} SEEN · `
    + `${gaps.length} GAP · ${violations.length} VIOLATION`);
  console.log(`gaps: ${gaps.join(", ")}`);
  for (const row of violations) console.log(`VIOLATION ${row.facet}: ${row.why}`);
  console.log("");
  console.log("A ZERO-VIOLATION RUN IS NOT PUBLISHABLE ON ITS OWN — run --controls beside it.");
  process.exit(0);
}

/* ── the controls ─────────────────────────────────────────────────────────── */

const accessoryFacet = (rows: DetectionRow[]): DetectionRow => {
  const row = rows.find((entry) => entry.lands === "accessories");
  if (!row) throw new Error("no accessory facet in the map — the fixture cannot be read");
  return row;
};

const shipped = accessoryFacet(detectionMap());
let failures = 0;
const check = (ok: boolean, name: string, saw: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  console.log(`      saw: ${saw}`);
  if (!ok) failures += 1;
};

/* POSITIVE — a kind whose court is real reads SEEN, and the court is quotable. */
const glasses = BORN_WORN_CLASSES.find((entry) => entry.id === "glasses");
check(
  shipped.verdict === "SEEN" && glasses !== undefined && glasses.armed && hasCourt(glasses.measurement),
  "POSITIVE — glasses armed on a real court, the accessory facet reads SEEN",
  `${shipped.verdict} · armed=[${shipped.armed.join(", ")}] · `
    + `glasses court "${glasses?.measurement.slice(0, 60)}…"`,
);

/* NEGATIVE 1 — a kind with no floor at all must show as unarmed, never silent. */
const noFloor = detectionMap([
  { id: "widget", region: "widget", floor: null, sideFloor: null, pair: false, armed: false,
    measurement: "NOT MEASURED — invented for this control", sideMeasurement: "NOT CONSIDERED" },
]);
const noFloorRow = accessoryFacet(noFloor);
check(
  noFloorRow.verdict === "GAP" && noFloorRow.unarmed.some((entry) => entry.startsWith("widget")),
  "NEGATIVE 1 — a kind with no floor prints GAP and names itself unarmed",
  `${noFloorRow.verdict} · unarmed=[${noFloorRow.unarmed.join(" | ").slice(0, 90)}]`,
);

/* NEGATIVE 2 — armed on a floor no court measured is a VIOLATION, and the
   provenance it is convicted on is printed. */
const unmeasured = detectionMap([
  { id: "widget", region: "widget", floor: 0.001, sideFloor: null, pair: false, armed: true,
    measurement: "NOT MEASURED — a number typed without a court", sideMeasurement: "NOT CONSIDERED" },
]);
const unmeasuredRow = accessoryFacet(unmeasured);
check(
  unmeasuredRow.verdict === "VIOLATION" && unmeasuredRow.why.includes("no court measured"),
  "NEGATIVE 2 — armed on an unmeasured floor prints VIOLATION",
  `${unmeasuredRow.verdict} · ${unmeasuredRow.why.slice(0, 110)}`,
);

/* NEGATIVE 3 — the map must also catch the other direction: armed, court real,
   and the scan never asking it. A detector nothing consults is not a detector. */
const neverAsked = detectionMap([
  { id: "widget", region: "widget", floor: 0.001, sideFloor: null, pair: false, armed: true,
    measurement: "12 worn frames 1.2–2.0% and 12 bare 0.000%, 2026-01-01 (invented for this control)",
    sideMeasurement: "NOT CONSIDERED and never needed" },
]);
const neverAskedRow = accessoryFacet(neverAsked);
check(
  neverAskedRow.verdict === "VIOLATION" && neverAskedRow.why.includes("never asks"),
  "NEGATIVE 3 — armed with a real court but never asked prints VIOLATION",
  `${neverAskedRow.verdict} · ${neverAskedRow.why.slice(0, 110)}`,
);

console.log("");
console.log(failures === 0
  ? "4 controls, 0 failures — the map can print a gap and two shapes of violation, so a clean run means something"
  : `${failures} CONTROL(S) FAILED — do not publish this map`);
process.exit(failures === 0 ? 0 : 1);
