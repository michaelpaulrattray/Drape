/**
 * THE SEAM TABLE — the per-shift watch's other half (fable-119, fable-120).
 *
 * The seam check ran in shadow for four shifts and produced a LOG LINE, and only
 * when it fired. A verdict recorded only when it is bad is a sample of failures
 * with no denominator, which is why the shadow→enforce flip has rested on three
 * anecdotes. `acc5b4f1` put the verdict on the row for every render, torn or
 * clean, with the coherence statistic beside it — and this is the reader for it.
 *
 * # Two numbers, and they measure different defects
 *
 * - **amplitude** — `worstExcess`, the biggest step across the boundary. A TEAR.
 *   The existing detector thresholds this at 80 levels.
 * - **coherence** — `|signedMean| / signedSpread`. A BLEND SEAM: a small,
 *   consistent offset the eye integrates along an edge. The founder's own
 *   complaint scored **0 pixels over the tear bar** and 1.118 coherence in his
 *   band against 0.020 for the whole boundary. The amplitude instrument cannot
 *   express his defect at any threshold, which is why nothing flipped.
 *
 * # Why this exists before there is anything to read
 *
 * Because the alternative is writing it the morning the data arrives, against a
 * deadline, with nobody to check it — and because an empty table and a broken
 * reader look identical unless the reader prints its own denominator. Every
 * count below is stated against how many rows were examined and how many were
 * eligible, so "nothing yet" is a reading rather than a silence.
 *
 *   railway.cmd run --service MySQL -- \
 *     npx tsx scripts/sweep-seam-rows-disposable.mts [--days 30]
 *   npx tsx scripts/sweep-seam-rows-disposable.mts --selftest   (no database)
 *
 * # The positive control, and why it is built in
 *
 * This reader's most likely output for weeks is "nothing yet", and a reader that
 * has only ever printed nothing has not been shown to be able to print anything.
 * `--selftest` runs the whole mapping and both rates over two synthetic rows —
 * one clean, one carrying the founder's own numbers — so the instrument
 * demonstrates it can express a finding before its silence is trusted. Working
 * law 2, at the cost of one flag.
 */
import mysql from "mysql2/promise";

import { assertOneWorld } from "./lib/worldGuard.mts";
import {
  CLEAN_BOUNDARY_COHERENCE, FOUNDER_SEAM_COHERENCE, readSeamRow, seamRates, SEAM_CONTROL_ROWS, type SeamRow,
} from "./lib/seamRows.mts";

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const SELFTEST = process.argv.includes("--selftest");
const DAYS = Number(arg("days", "30"));

/*
  THE TWO CONTROL ROWS MOVED TO `lib/seamRows.mts` (2026-08-10), because the
  finding-replay walk's control C needs the same pair and a second copy of a
  control drifts from the thing it checks (law 4). The numbers are unchanged: an
  ordinary clean boundary, and the founder's shirt seam.
*/
const SELFTEST_ROWS = SEAM_CONTROL_ROWS;

let rows: readonly any[];
if (SELFTEST) {
  rows = SELFTEST_ROWS;
  console.log("SELFTEST — two synthetic rows, no database touched.\n");
} else {
  const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
  assertOneWorld([databaseKey]);
  const url = process.env[databaseKey];
  if (!url) { console.error("no database url — run under `railway run --service MySQL`"); process.exit(1); }
  const connection = await mysql.createConnection({ uri: url, timezone: "Z" } as any);
  ([rows] = await connection.query<any[]>(
    `SELECT v.id, v.publicId, v.userId, v.requestText, v.status, v.pointsCost,
            v.internalPrompt, v.createdAt
       FROM casting_candidate_variants v
      WHERE v.createdAt > (NOW() - INTERVAL ? DAY)
      ORDER BY v.id ASC`,
    [DAYS],
  ));
  await connection.end();
}

const json = (value: unknown): any => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") { try { return JSON.parse(value); } catch { return null; } }
  return value;
};

const seams: SeamRow[] = [];
let composited = 0;
for (const row of rows) {
  const seam = readSeamRow(row);
  if (!seam) continue;
  composited += 1;
  seams.push(seam);
}

console.log(`${rows.length} variant rows in the last ${DAYS} day(s)`);
console.log(`${composited} of them carry a seam verdict — the denominator this flip has been missing\n`);

if (seams.length === 0) {
  /*
    NOT A CLEAN BILL OF HEALTH, and the wording matters. Every render that
    predates `acc5b4f1` has no seam key at all, so an empty table here means the
    founder has not rendered since the deploy — not that no seam has torn.
  */
  console.log("No render in this window carries a seam verdict.");
  console.log("That is an EMPTY TABLE, not a clean one: rows before the seam-persistence");
  console.log("deploy have no verdict to read, so this says only that nothing has");
  console.log("rendered since. The flip stays where fable-119 left it.");
  process.exit(0);
}

console.log("=".repeat(88));
console.log("EVERY SEAM VERDICT ON THE ROW");
console.log("=".repeat(88));
console.log(
  "  id".padEnd(7) + "boundary".padStart(9) + "torn px".padStart(9) + "share".padStart(8)
  + "worst".padStart(8) + "signed mean".padStart(13) + "sd".padStart(8) + "coherence".padStart(11)
  + "  verdict",
);
for (const seam of seams) {
  console.log(
    `  ${seam.id}`.padEnd(7)
    + String(seam.boundaryPixels).padStart(9)
    + String(seam.tornPixels).padStart(9)
    + seam.share.toFixed(4).padStart(8)
    + seam.worstExcess.toFixed(1).padStart(8)
    + (seam.signedMean === undefined ? "—" : seam.signedMean.toFixed(2)).padStart(13)
    + (seam.signedSpread === undefined ? "—" : seam.signedSpread.toFixed(2)).padStart(8)
    + (seam.coherence === undefined ? "—" : seam.coherence.toFixed(3)).padStart(11)
    + `  ${seam.torn ? "TORN" : "clean"}${seam.enforced ? " (enforced)" : ""}`,
  );
  console.log(`         ${seam.requestText}`);
}

/* ------------------------------------------------------------------ the two rates */

const rates = seamRates(seams);

console.log(`\n${"=".repeat(88)}`);
console.log("WHAT THE TABLE SAYS SO FAR");
console.log("=".repeat(88));
console.log(`amplitude  : ${rates.torn} of ${rates.total} renders scored TORN on the 80-level bar`);
if (rates.coherence) {
  console.log(
    `coherence  : mean ${rates.coherence.mean.toFixed(3)}`
    + `  median ${rates.coherence.median.toFixed(3)}`
    + `  max ${rates.coherence.max.toFixed(3)}`
    + `   (n=${rates.coherence.n})`,
  );
  /*
    The founder's own specimen, so the table always carries the thing it is being
    compared against rather than a number a reader has to remember.
  */
  console.log(
    `             his shirt seam measured ${FOUNDER_SEAM_COHERENCE} in-band`
    + ` against ${CLEAN_BOUNDARY_COHERENCE.toFixed(3)} whole-boundary`,
  );
  const suspicious = seams.filter((seam) => seam.coherence !== undefined && seam.coherence >= 0.5 && !seam.torn);
  console.log(
    `             ${suspicious.length} render(s) scored coherence ≥ 0.5 while passing the tear bar`
    + " — the founder-visible class",
  );
  for (const seam of suspicious) console.log(`               v#${seam.id}  ${seam.requestText}`);
} else {
  console.log("coherence  : no row carries the statistic yet");
}
console.log("\nA week of dogfooding turns this into the flip decision. It is not one yet.");

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
