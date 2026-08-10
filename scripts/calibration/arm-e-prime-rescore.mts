/**
 * RE-SCORING ARM (e′)'s IDENTITY COLUMN — because the probe's own floor was zero.
 *
 * The probe asked a shortened identity question ("judge whether each feature
 * matches", no description step) and got NO geometry misses anywhere — including
 * against built-step4, which D-199 established is a visibly different woman.
 * A floor of zero measures nothing, which is D-203 catching its own author one
 * entry later.
 *
 * So the column is re-read with the DESCRIBE-THEN-JUDGE prompt verbatim from
 * identity-control.mts, the one whose floor is known: on base vs built-step4 it
 * returns five of seven differing. No re-rendering — the pictures were fine.
 *
 * The floor is printed first and every run of it is kept. If the floor comes
 * back empty again, the finding is about the instrument and the identity column
 * of arm (e′) stays UNMEASURED rather than being reported as a pass.
 *
 *   npx tsx scripts/calibration/arm-e-prime-rescore.mts
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";

import { interpreterEngine } from "../../server/castingV2/interpreter";

const DIR = "output/quality-unit/specimens";
const OUT = "output/quality-unit/arm-e-prime";
const reader = interpreterEngine();
if (!reader) throw new Error("no reader configured");

/** Verbatim from identity-control.mts. The description step is the difference. */
const PER_FEATURE = [
  "You are shown two photographs. Compare them FEATURE BY FEATURE and report what you",
  "actually see in each, then judge whether each feature MATCHES.",
  "",
  "Judge only: jaw width, face length/shape, nose shape, lip fullness, eye spacing,",
  "skin freckling (present or absent, and where), skin tone.",
  "",
  "Do not be charitable. If a feature reads differently, say it does not match.",
  "",
  'Reply with JSON: {"features":[{"name":"...","first":"...","second":"...",',
  '"matches":true|false}], "samePerson": true|false} and nothing else.',
].join("\n");

const GEOMETRY = ["jaw", "face length", "face shape", "nose", "lip", "eye spacing"];

async function once(left: Buffer, right: Buffer) {
  const reply = await reader!.complete({
    system: PER_FEATURE,
    user: "First image, then second image.",
    images: [
      { bytes: left, contentType: "image/png" },
      { bytes: right, contentType: "image/png" },
    ],
    json: true,
    temperature: 0,
    maxOutputTokens: 900,
  });
  const parsed = JSON.parse(
    reply.text.trim().replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, ""),
  );
  return (parsed?.features ?? [])
    .filter((feature: any) => feature?.matches === false)
    .map((feature: any) => String(feature?.name).toLowerCase());
}

/** Majority of three — one reader's bad day is not a finding (D-194). */
async function misses(left: Buffer, right: Buffer) {
  const runs: string[][] = [];
  for (let index = 0; index < 3; index += 1) runs.push(await once(left, right));
  const names = [...new Set(runs.flat())];
  const agreed = names.filter((name) => runs.filter((run) => run.includes(name)).length >= 2);
  return {
    agreed,
    geometry: agreed.filter((name) => GEOMETRY.some((feature) => name.includes(feature))),
    runs,
  };
}

const base = readFileSync(`${DIR}/built-base.png`);

console.log("FLOOR CHECK — base vs the drifted steps, before any restore\n");
const rows: any[] = [];
for (const step of [1, 2, 3, 4]) {
  const drifted = readFileSync(`${DIR}/built-step${step}.png`);
  const restored = readFileSync(`${OUT}/step${step}-restored.png`);
  const before = await misses(base, drifted);
  const after = await misses(base, restored);
  rows.push({ step, before, after });
  console.log(
    `  step ${step}  geometry lost ${before.geometry.length} -> ${after.geometry.length}`
    + `   drifted: [${before.geometry.join(", ")}]`
    + `   restored: [${after.geometry.join(", ")}]`,
  );
}

writeFileSync(`${OUT}/identity-rescore.json`, JSON.stringify(rows, null, 2));
console.log(`\nwritten to ${OUT}/identity-rescore.json`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
