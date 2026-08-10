/**
 * CONTROLS FOR A NEW INSTRUMENT, before any verdict of its own counts (law 2).
 *
 * The walk's step 2 no longer declares `expects: "asked"` from a constant. It
 * measures her tilt and derives the expectation. That derivation is now an
 * instrument deciding whether a 25-credit outcome counts as a pass, so it gets
 * a positive and a negative control against faces whose product behaviour is
 * already on the record — not against my own reasoning about them.
 *
 *   run-6's face   the gate FIRED: "Her eyes already sweep up at the outer
 *                  corners…" — the derivation must say `asked`
 *   run-7's face   the gate stayed silent, she was charged, the painter came
 *                  back without fox eyes twice and was refunded — the
 *                  derivation must say `delivered` (or an honest refusal)
 *
 * Both readings come from the SAME ladder and the SAME threshold the product
 * uses. If either control disagrees with what production actually did, the
 * derivation is wrong and the walk must not run on it.
 */
import { readCanthalTilt } from "../server/castingV2/eyeShapeRouting.js";
import { alreadyUpswept, UPSWEPT_ALREADY } from "../server/castingV2/canthalTilt.js";
import { createFalRegionReader } from "../server/castingV2/falRegionReader.js";

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY is required — the controls cannot be faked");

const BUCKET = "https://pub-990e39d8d995468eb61aced83162123a.r2.dev";

const CONTROLS = [
  {
    face: "run-6 · 7c796a72",
    key: "casting-v2/candidates/0397517c-1f6a-436f-ab1b-b42321485f05.png",
    /* Production, verbatim from output/walk/run-6.log. */
    productDid: "asked",
    expect: "asked" as const,
  },
  {
    face: "run-7 · b6ee8102",
    key: "casting-v2/candidates/03b5db91-07bf-4a7f-8619-7749d2200906.png",
    productDid: "refused (charged, came back twice without fox eyes, refunded)",
    expect: "delivered" as const,
  },
];

const reader = createFalRegionReader({ apiKey });
let failures = 0;

console.log(`threshold: already-upswept at ${UPSWEPT_ALREADY}°\n`);

for (const control of CONTROLS) {
  const url = `${BUCKET}/${control.key}`;
  const response = await fetch(url);
  if (!response.ok) {
    console.log(`${control.face}: HER PICTURE ANSWERED ${response.status} — ${url}`);
    failures += 1;
    continue;
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const reading = await readCanthalTilt({ image: bytes, reader });
  const derived = reading && alreadyUpswept(reading) ? "asked" : "delivered";
  const ok = derived === control.expect;
  if (!ok) failures += 1;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${control.face}\n`
    + `     measured ${reading ? `${reading.meanDeg.toFixed(2)}° (asymmetry ${reading.asymmetryDeg.toFixed(2)}°)` : "NO READ"}\n`
    + `     derived  ${derived}\n`
    + `     product  ${control.productDid}`,
  );
}

if (failures > 0) {
  console.error(`\n${failures} control(s) disagree with what production did. The derivation is not trustworthy.`);
  process.exit(1);
}
console.log("\nBoth controls agree with production. The derivation may decide expectations.");

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
