/**
 * WHAT THE ONE-EYED MASK COST THE TILT INSTRUMENT, and what the fix gives back.
 *
 * `readCanthalTilt` is the measurement behind the eye-shape work — the
 * already-true gate, the fox-eyes matrix, every tilt number in the pack. It has
 * two rungs and BOTH of them go through the bilateral `eyes` region:
 *
 *   rung 1  asks `region({ name: "right eye" })` and `"left eye"` directly.
 *           Those names are not in the reader's bilateral set, so they are asked
 *           of SAM 3 verbatim — and `"right eye"` returned ZERO masks on both of
 *           the founder's frames, so this rung throws and is skipped.
 *   rung 2  asks `region({ name: "eyes" })`, then crops to that mask's bounding
 *           box and asks again inside the crop. `cornersFromMask` needs TWO
 *           connected components — *"a tilt reading needs two eyes"* — so a
 *           one-eyed union cannot produce a reading, and the crop drawn from it
 *           is a box around one eye, which cannot either.
 *
 * So a frame with two plainly visible eyes read as NO-READ, and a no-read is not
 * a wrong number — it is a missing one, which is why this was invisible.
 *
 * # The before is REPRODUCED, not remembered
 *
 * `lib/deletedBilateralBranch.mts` is the deleted code kept to the letter: ask
 * `"left eye"`/`"right eye"`, take `masks[0]`, union what came back. Both readers
 * are driven against the same frames in the same run, so the delta is measured
 * rather than inferred from a commit. That is the shift's own law — a null result
 * is evidence only against a fixture that could have produced a non-null one.
 *
 * # And the defect is FRAME-DEPENDENT, which the third specimen is here to say
 *
 * v#165 sits on a different face, and its stored `eye.colour` segment mask —
 * seg#14, pulled and counted — holds TWO blobs, 783px and 659px at opposite ends
 * of its 184px bbox. **That render got both eyes.** So the old branch was not
 * broken everywhere; it lost a side on some faces and not others, which is worse
 * than uniform breakage for the obvious reason: nothing on the product path could
 * tell the two apart. The number that matters is therefore not "it fails" but
 * *how many of his own faces it failed on*, and that is what this prints.
 *
 * Reads only: SAM 3 on the provider balance, no account credit, no walk.
 *
 *   FAL_KEY=… railway.cmd run --service MySQL -- \
 *     npx tsx scripts/prove-tilt-recovered-disposable.mts \
 *       --bucket https://pub-990e39d8d995468eb61aced83162123a.r2.dev
 */
import mysql from "mysql2/promise";

import { assertOneWorld, readLocalEnvFile } from "./lib/worldGuard.mts";
import { createChecks } from "./lib/drivePage.mts";
import { deletedBilateralReader } from "./lib/deletedBilateralBranch.mts";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { readCanthalTilt } from "../server/castingV2/eyeShapeRouting";

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const base = arg("bucket").replace(/\/$/, "");
if (!base) throw new Error("--bucket <public url> is required — these are production frames");
if (base === (readLocalEnvFile().get("R2_PUBLIC_URL") ?? "").replace(/\/$/, "")) {
  throw new Error("--bucket is the local .env's bucket — the dev world, and these rows are production's");
}
const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY is required — this is a real segmentation read");

const SPECIMENS = [
  { label: "v#147 (cand 1593)", publicId: "8ac53e6e-ac36-4a83-83be-a17e04593450" },
  { label: "v#156 (cand 1596)", publicId: "ffe31dae-afac-4fd7-af15-46fb65ee273a" },
  /* His newest render, and the face whose stored segment holds two eyes. */
  { label: "v#165 (cand 1599)", publicId: "23bf4f61-1a93-4024-915f-021efac9cc2b" },
] as const;

/* ----------------------------------------------------------------- the run */

const connection = await mysql.createConnection({
  uri: process.env[databaseKey]!, timezone: "Z",
} as mysql.ConnectionOptions);
const { check, records, print } = createChecks();
/** Every face's before and after, so the rate has a denominator. */
const ledger: Array<{
  label: string;
  before: { meanDeg: number; asymmetryDeg: number } | null;
  after: { meanDeg: number; asymmetryDeg: number } | null;
}> = [];

for (const specimen of SPECIMENS) {
  const [row] = await connection.query<any[]>(
    "SELECT id, imageKey FROM casting_candidate_variants WHERE publicId = ? LIMIT 1",
    [specimen.publicId],
  ).then(([rows]) => rows as any[]);
  if (!row?.imageKey) {
    check(false, `${specimen.label}: the frame is readable`, `no row for ${specimen.publicId}`);
    continue;
  }
  const response = await fetch(`${base}/${row.imageKey}`);
  if (!response.ok) {
    check(false, `${specimen.label}: the frame is readable`, `frame HTTP ${response.status}`);
    continue;
  }
  const image = Buffer.from(await response.arrayBuffer());
  console.log(`\n=== ${specimen.label} (v#${row.id})`);

  const before = await readCanthalTilt({ image, reader: deletedBilateralReader(apiKey) });
  console.log(`    BEFORE (the deleted bilateral branch): ${before ? `${before.meanDeg.toFixed(2)}°` : "NO-READ"}`);

  const after = await readCanthalTilt({ image, reader: createFalRegionReader({ apiKey }) });
  console.log(
    `    AFTER  (one side to a picture):            `
    + `${after ? `${after.meanDeg.toFixed(2)}° mean, ${after.asymmetryDeg.toFixed(2)}° asymmetry` : "NO-READ"}`,
  );

  /*
    THE CONTRACT IS THE AFTER, and the BEFORE is the tally.

    An earlier draft asserted the old branch failed on every specimen. That was
    the wrong assertion the moment a third face was added, and asserting it would
    have turned an honest frame-dependence into a red suite — the same mistake the
    refuted candidate measurement got moved out of.
  */
  check(
    after !== null,
    `${specimen.label}: the tilt instrument reads this face`,
    after ? `${after.meanDeg.toFixed(2)}° mean, ${after.asymmetryDeg.toFixed(2)}° asymmetry` : "NO-READ",
  );
  ledger.push({ label: specimen.label, before, after });
}

await connection.end();
print();

const recovered = ledger.filter((row) => row.before === null && row.after !== null);
console.log("\nBEFORE → AFTER, his own faces:");
for (const row of ledger) {
  console.log(
    `  ${row.label.padEnd(18)} ${row.before ? `${row.before.meanDeg.toFixed(2)}°`.padStart(8) : " NO-READ"}`
    + `  →  ${row.after ? `${row.after.meanDeg.toFixed(2)}°` : "NO-READ"}`,
  );
}
console.log(
  `\n${recovered.length} of ${ledger.length} of his faces went from NO-READ to a reading`
  + `${recovered.length ? ` (${recovered.map((row) => row.label.split(" ")[0]).join(", ")})` : ""}.`,
);
check(
  recovered.length > 0,
  "the delta is real: at least one of his faces could not be read before and can be now",
  `${recovered.length} of ${ledger.length} recovered — a fix with an empty delta is not a proven fix`,
);
print();
console.log(`${records.length} checks recorded.`);
process.exit(0);
