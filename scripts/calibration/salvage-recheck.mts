/**
 * RE-CONFIRMING THE SALVAGE TABLE (D-201) — with the two controls it never had.
 *
 * D-202 is the reason this exists. The salvage verdicts said "repainted" on
 * three of three, and they were read off an instrument whose own control had
 * never been run honestly. So before the table is trusted, the ruler is
 * measured — and this time by the only method that cannot be argued with:
 *
 *   NEGATIVE CONTROL — a picture against ITSELF. Must come back identical.
 *     If the reader can find seven differences between an image and a copy of
 *     itself, every "repainted" verdict in D-201 is noise.
 *
 *   POSITIVE CONTROL — a picture against a real unsharp-mask of itself. A
 *     signal-processing sharpen changes clarity and nothing else, which is
 *     EXACTLY what a salvage pass was asked for. This is what success would
 *     have looked like, so the reader must call it unchanged too.
 *
 * Then the three stored salvage outputs are re-scored three times each, because
 * D-199's correction established the reader disagrees with itself.
 *
 * No image generation. The renders already happened; only the reading was
 * suspect.
 *
 *   npx tsx scripts/calibration/salvage-recheck.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";

import { interpreterEngine } from "../../server/castingV2/interpreter";

const DIR = "output/quality-unit/specimens";
const OUT = "output/quality-unit";

const engine = interpreterEngine();
if (!engine) throw new Error("no reader configured");

/** Verbatim from salvage.mts, so the re-score asks the original question. */
const SAMENESS = [
  "You are shown two photographs — the SAME picture before and after a restoration pass",
  "that was supposed to change nothing except clarity.",
  "",
  "Compare them FEATURE BY FEATURE and report what you see in each, then judge whether",
  "each MATCHES. Judge: jaw width, face length/shape, nose shape, lip fullness, eye",
  "spacing, skin freckling, skin tone, hair shape, hair colour, jewellery, expression.",
  "",
  "Do not be charitable. Anything that reads differently does not match. A restoration",
  "that improves a feature has still changed it.",
  "",
  'Reply with JSON: {"features":[{"name":"...","first":"...","second":"...",',
  '"matches":true|false}], "identical": true|false} and nothing else.',
].join("\n");

async function score(left: Buffer, right: Buffer) {
  const reply = await engine!.complete({
    system: SAMENESS,
    user: "First image: before. Second image: after.",
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
  const differs: string[] = (parsed?.features ?? [])
    .filter((feature: { matches?: unknown }) => feature?.matches === false)
    .map((feature: { name?: unknown }) => String(feature?.name));
  return { identical: parsed?.identical === true, differs };
}

/** Three readings, because one reading of an inconsistent reader is an anecdote. */
async function scoreThrice(label: string, left: Buffer, right: Buffer) {
  const runs: Array<Awaited<ReturnType<typeof score>>> = [];
  for (let index = 0; index < 3; index += 1) runs.push(await score(left, right));
  const counts = runs.map((run) => run.differs.length);
  const union = [...new Set(runs.flatMap((run) => run.differs))].sort();
  const always = union.filter((name) => runs.every((run) => run.differs.includes(name)));
  console.log(
    `  ${label.padEnd(26)} differs on ${counts.join(" / ")} features`
    + `   agreed-every-time: ${always.length ? always.join(", ") : "none"}`,
  );
  return { label, counts, union, always, runs };
}

const results = [];

console.log("CONTROLS — the reader measured before anything is measured with it\n");

const control = readFileSync(`${DIR}/built-step4.png`);

// Negative: the same bytes twice. Any difference found here is invented.
results.push(await scoreThrice("negative (self vs self)", control, control));

// Positive: a real sharpen. Clarity changes, nothing else does — the salvage
// pass's own stated goal, performed by a filter that structurally cannot repaint.
const sharpened = await sharp(control)
  .sharpen({ sigma: 1.2, m1: 0, m2: 3 })
  .png()
  .toBuffer();
writeFileSync(`${OUT}/salvage-control-sharpened.png`, sharpened);
results.push(await scoreThrice("positive (unsharp mask)", control, sharpened));

console.log("\nRE-SCORING THE STORED SALVAGE OUTPUTS — no new renders\n");

for (const name of ["recovered-1", "recovered-2", "built-step4"]) {
  const degraded = readFileSync(
    name === "built-step4" ? `${DIR}/built-step4.png` : `${DIR}/${name}-degraded.png`,
  );
  const salvaged = readFileSync(`${OUT}/salvage-${name}.png`);
  results.push(await scoreThrice(name, degraded, salvaged));
}

writeFileSync(`${OUT}/salvage-recheck.json`, JSON.stringify(results, null, 2));
console.log(`\nwritten to ${OUT}/salvage-recheck.json`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
