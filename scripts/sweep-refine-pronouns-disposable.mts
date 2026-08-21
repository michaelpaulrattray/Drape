/**
 * §5e's OWN SWEEP, re-run after the fix — the literals-only count, comments
 * excluded, over the surface a customer reads.
 *
 * The roadmap's §5e section carried a count taken by an untracked one-off
 * (`output/_pronounsweep.mts`). This is that reading made repeatable, so the
 * claim *"the refine surface no longer calls every Cast her"* is a measurement
 * rather than a memory.
 *
 * It is NOT promoted into the suite, and §5e says why: a literals gate over the
 * whole corpus needs its own court, because the customer is "she" in every
 * docblock in this house and a guard that reddens on those is a guard nobody
 * can keep green.
 *
 *   npx tsx scripts/sweep-refine-pronouns-disposable.mts
 */
import { readFileSync } from "node:fs";

const FILES = [
  "server/castingV2/cannotSayCopy.ts",
  "server/castingV2/refineReask.ts",
  "server/castingV2/refineRefusals.ts",
  "server/castingV2/vacancyPhrases.ts",
  "server/castingV2/refineService.ts",
  "server/castingV2/repaintAsks.ts",
];
const GENDERED = /\b(she|her|hers|he|him|his)\b/i;

/**
 * Comments out, then quoted strings only.
 *
 * A pronoun in prose ABOUT the code is not a pronoun in front of a customer,
 * and this file's own docblocks are full of the first kind.
 */
function customerLiterals(source: string): string[] {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const withoutLineComments = withoutBlockComments
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  const found: string[] = [];
  for (const match of withoutLineComments.matchAll(/"[^"\n]{6,}"/g)) found.push(match[0]);
  for (const match of withoutLineComments.matchAll(/`[^`\n]{6,}`/g)) found.push(match[0]);
  return found;
}

/**
 * WHAT A CUSTOMER NEVER READS — the two classes §5e left alone on purpose.
 *
 * A log line and a refusal's `detail:` are ours, not hers. Counting them with
 * the copy would make the number un-driveable to zero, and a checker nobody can
 * get green is a checker nobody consults.
 */
const OURS = (one: string): boolean => one.includes("[refineService]")
  || one.includes("[repaint")
  || one.startsWith("`this render")
  || one.startsWith("`the ask names");

let customerFacing = 0;
let internal = 0;
for (const file of FILES) {
  const all = customerLiterals(readFileSync(file, "utf8")).filter((one) => GENDERED.test(one));
  const hits = all.filter((one) => !OURS(one));
  customerFacing += hits.length;
  internal += all.length - hits.length;
  console.log(`${file.padEnd(40)} ${String(hits.length).padStart(2)} customer-facing`
    + `   (${all.length - hits.length} internal)`);
  for (const hit of hits) console.log(`    ${hit.slice(0, 120)}`);
}
console.log(`\nCUSTOMER-FACING gendered literals: ${customerFacing}`);
console.log(`internal — logs and refusal details, left alone by §5e: ${internal}`);
process.exit(0);
