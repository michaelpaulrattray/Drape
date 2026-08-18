/**
 * THE LOCALITY CLASSIFIER'S CONTROLS — fable-951 §3's bar, on the real
 * transport, before any verdict of this reader counts for anything.
 *
 * Three words with answers nobody can argue about, and each one is a DIFFERENT
 * arm rather than three of the same:
 *
 *   fangs   coLocated    several, together — the founder's own case
 *   wings   distributed  two, opposite sides — the case the gate was built for
 *   halo    single       one of it
 *
 * A classifier that says `distributed` to everything passes a one-arm court and
 * is useless; a classifier that says `coLocated` to everything opens the crop
 * road to wings. Both are refused here, by construction, because the three arms
 * disagree with each other.
 *
 * NONE OF THESE WORDS APPEARS IN THE PROMPT — a control whose answer is written
 * into the instruction is not a control, and the suite asserts that separately.
 *
 * Three text reads on house money. No credit path, no store write (the reader is
 * driven directly, never `ensureKindProperties`).
 */
import "dotenv/config";

import { interpreterEngine } from "../server/castingV2/interpreter";
import { readKindProperties, KIND_PROPERTY_PROMPT_VERSION } from "../server/castingV2/openKindProperties";
import type { KindLocality } from "../shared/kindLocality";

const CONTROLS: ReadonlyArray<{ noun: string; expect: KindLocality; why: string }> = [
  { noun: "fangs", expect: "coLocated", why: "the founder's case — several, sitting together" },
  { noun: "wings", expect: "distributed", why: "two, on opposite sides — one crop cannot hold both" },
  { noun: "halo", expect: "single", why: "there is only one of it" },
];

const engine = interpreterEngine();
if (!engine) { console.error("no text transport configured"); process.exit(1); }

console.log(`prompt ${KIND_PROPERTY_PROMPT_VERSION}\n`);
let held = 0;
for (const control of CONTROLS) {
  const read = await readKindProperties(control.noun, { engine });
  const got = read?.locality ?? "NO READ";
  const ok = got === control.expect;
  if (ok) held += 1;
  console.log(`${ok ? "HOLDS " : "FAILS "} ${control.noun.padEnd(6)} expected ${control.expect.padEnd(12)} got ${String(got).padEnd(12)} anchor ${read?.anchorRegion ?? "-"}`);
  console.log(`         ${control.why}`);
}
console.log(`\n${held} of ${CONTROLS.length} arms hold.`);
console.log(held === CONTROLS.length
  ? "THE CLASSIFIER'S VERDICTS COUNT (fable-951 §3)."
  : "THE BAR IS NOT MET — no verdict of this reader counts until it is.");
process.exit(held === CONTROLS.length ? 0 : 1);
