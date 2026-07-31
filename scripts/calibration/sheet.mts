/**
 * One graded calibration sheet, straight through the real compiler.
 *
 * The point is to grade what a customer would actually receive, so this uses
 * `castingBriefCompiler` and the same fal transport, size and quality the roll
 * service uses. Nothing here touches the database, credits or storage — the
 * bytes land on disk, because the thing under test is the image, not the
 * ledger. The roll domain has its own suite for the ledger.
 *
 * Spend is real and counted at dispatch, the same discipline `run.mts` uses:
 * a submitted request is money whether or not the bytes come back.
 *
 * Usage:
 *   npx tsx scripts/calibration/sheet.mts "<brief>" <outDir> [--count 8] [--dry]
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import { castingBriefCompiler } from "../../server/castingV2/briefCompiler";
import { createOpenRouterTextEngine } from "../../server/providers/openrouterText";
import { createFalCreativeEngine } from "../../server/providers/falImages";
import { readFalBalanceUsd } from "../../server/providers/falTransport";
import { ProviderError } from "../../server/providers/types";

const [briefText, outDir, ...rest] = process.argv.slice(2);
if (!briefText || !outDir) {
  console.error('usage: sheet.mts "<brief>" <outDir> [--count 8] [--dry]');
  process.exit(2);
}
const dry = rest.includes("--dry");
const countFlag = rest.indexOf("--count");
const count = countFlag >= 0 ? Number(rest[countFlag + 1]) : 8;

const falKey = process.env.FAL_KEY;
const openRouterKey = process.env.OPENROUTER_API_KEY;
if (!openRouterKey) throw new Error("OPENROUTER_API_KEY is required for the interpreter");
if (!dry && !falKey) throw new Error("FAL_KEY is required unless --dry");

const rollSeed = `calib:${Date.now().toString(36)}`;

const compiled = await castingBriefCompiler({
  briefText,
  candidateCount: count,
  rollSeed,
  engine: createOpenRouterTextEngine({ apiKey: openRouterKey! }),
});

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "compiled.json"),
  `${JSON.stringify({ briefText, rollSeed, compiledBrief: compiled.compiledBrief, lockContract: compiled.lockContract, candidates: compiled.candidates }, null, 2)}\n`,
  "utf8",
);

console.log(`brief:  ${briefText}`);
console.log(`seed:   ${rollSeed}`);
console.log(`locks:  ${JSON.stringify(compiled.lockContract)}`);
/*
  The realized axes, which is what a calibration sheet is actually grading.
  Printing SUBJECT was useless — it opens with the age-idiom block, so eight
  different people produced eight identical-looking lines.
*/
const AXIS_MARKERS = ["HAIR", "EYE COLOUR", "FACIAL HAIR", "BROW CHARACTER", "SKIN CHARACTER"];
for (const [i, candidate] of compiled.candidates.entries()) {
  const axes = AXIS_MARKERS.map((marker) => {
    const at = candidate.prompt.indexOf(`${marker}: `);
    if (at < 0) return null;
    const end = candidate.prompt.indexOf(".", at);
    return candidate.prompt.slice(at, end < 0 ? at + 80 : end);
  }).filter(Boolean);
  console.log(`  ${i + 1}. ${axes.join("  |  ")}`);
}
console.log(`\nfinish: ${compiled.candidates[0].prompt.match(/SKIN FINISH: [^.]*\./)?.[0] ?? "(none)"}`);

if (dry) {
  console.log("\n--dry: no images dispatched.");
  process.exit(0);
}

const before = await readFalBalanceUsd(falKey!).catch(() => null);
console.log(`\nfal balance before: ${before === null ? "unknown" : `$${before.toFixed(2)}`}`);

const engine = createFalCreativeEngine({ apiKey: falKey! });
const results = await Promise.all(
  compiled.candidates.map(async (candidate, index) => {
    const file = path.join(outDir, `cand_${String(index + 1).padStart(2, "0")}.png`);
    try {
      const image = await engine.generateCandidate({
        prompt: candidate.prompt,
        size: compiled.size,
        quality: compiled.quality,
      });
      fs.writeFileSync(file, image.bytes);
      return { index, ok: true as const, bytes: image.bytes.length };
    } catch (error) {
      const failure = error instanceof ProviderError ? error.failureClass : "unknown";
      return { index, ok: false as const, failure, message: (error as Error).message };
    }
  }),
);

for (const result of results) {
  console.log(
    result.ok
      ? `  ${result.index + 1}: ok (${Math.round(result.bytes / 1024)} KB)`
      : `  ${result.index + 1}: FAILED [${result.failure}] ${result.message}`,
  );
}

const after = await readFalBalanceUsd(falKey!).catch(() => null);
console.log(`fal balance after:  ${after === null ? "unknown" : `$${after.toFixed(2)}`}`);
if (before !== null && after !== null) console.log(`spent: $${(before - after).toFixed(2)}`);
console.log(`\nwritten to ${outDir}`);
