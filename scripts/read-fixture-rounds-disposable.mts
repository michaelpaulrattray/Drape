/**
 * THREE ROUNDS PER ARM, READ BY THE INSTRUMENT WITH CONTROLS.
 *
 * One paint is not a rate. This defect is a flicker — the same recipe delivered
 * her freckles at step 1 and not at step 3 — so each arm is painted three times
 * and every frame is put to the production reader five times, with her bare
 * master and her own delivered step-1 frame in the same sitting as the negative
 * and positive controls.
 *
 *   npx tsx scripts/read-fixture-rounds-disposable.mts
 */
import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";

import { verifyRender } from "../server/castingV2/renderVerification";

const REPEAT = 5;
const ROUNDS = ["", "-r2", "-r3"];
const ARMS = [
  { name: "written15 (step-1 prompt, marks alone)", dir: "output/masked/freckles-written15" },
  { name: "carried-alone (step-3 clause, marks alone)", dir: "output/masked/freckles-alone" },
  { name: "carried (step-3 prompt, marks + makeup)", dir: "output/masked/freckles-carried" },
];

async function present(file: string): Promise<number | null> {
  if (!existsSync(file)) return null;
  const bytes = readFileSync(file);
  let yes = 0;
  for (let reading = 0; reading < REPEAT; reading += 1) {
    const verdict = await verifyRender({
      bytes, contentType: "image/png",
      facts: [{ facet: "marks", asked: "freckles", binding: false }],
    });
    if (verdict.checks[0]?.verified) yes += 1;
  }
  return yes;
}

console.log("CONTROLS");
for (const control of [
  { name: "her bare master (negative)", file: "output/marks-court/MASTER-run15.png" },
  { name: "her step-1 frame (positive)", file: "output/walk/2026-08-08T19-59-45-742Z/01-delivered.png" },
]) {
  console.log(`  ${control.name.padEnd(30)} ${await present(control.file)}/${REPEAT}`);
}

console.log("\nARMS — freckles present, out of 5 readings per frame");
console.log("arm                                          round  painted  composed");
for (const arm of ARMS) {
  for (const round of ROUNDS) {
    const dir = `${arm.dir}${round}`;
    const painted = await present(`${dir}/painted.png`);
    const composed = await present(`${dir}/composed.png`);
    if (painted === null) continue;
    console.log(`${arm.name.padEnd(44)} ${(round || "-r1").padEnd(6)} `
      + `${String(painted).padStart(5)}/5  ${String(composed ?? "—").padStart(6)}/5`);
  }
}

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
