/**
 * ADD A SCOPE FLAG (fable-486 §d) — the block, the rehearsal, and the list of
 * everything this cannot write.
 *
 * Seven of these were added in two weeks, thirteen sites each. What the
 * generator is FOR is the two that are easy to get wrong and expensive when
 * they are: the parent-scope refusals (a child naming a user its parent does
 * not cover is a feature that charges for a picture nobody can see) and the
 * rehearsal (2026-07-31, a scope flag crash-looped production because its guard
 * had never been driven with the shape about to be set).
 *
 * It writes ONE file — the rehearsal — and prints the rest. `castingV2Scope.ts`
 * is edited by hand on purpose: its comments carry the reasons, and a generator
 * editing it in place would strip the one thing a reader comes for.
 *
 *   npx tsx scripts/new-scope-flag.mts \
 *     --env CASTING_THING_SCOPE --stem CastingThing \
 *     --parent CastingReferenceLibrary --parent-field libraryScope \
 *     --inert "the panel it fills does not render" \
 *     --parent-value users:1 --ask users:1
 */
import fs from "node:fs";
import path from "node:path";

import { HAND_SITES, rehearsalScript, scopeFlagBlock, type ScopeFlagSpec } from "./lib/scopeFlagTemplate.mts";

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const at = argv.indexOf(`--${name}`);
  return at === -1 ? undefined : argv[at + 1];
};

const env = flag("env");
const stem = flag("stem");
const parentStem = flag("parent");
if (!env || !stem || !parentStem) {
  console.error("REFUSING: --env, --stem and --parent are required. See the docblock.");
  process.exit(1);
}

const spec: ScopeFlagSpec = {
  env,
  stem,
  parentEnvConst: `${flag("parent-env") ?? parentStem.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase() + "_SCOPE"}_ENV`,
  parentParse: `parse${parentStem}Scope`,
  parentEnabled: `capture${parentStem}Enabled`,
  parentField: flag("parent-field") ?? "parentScope",
  inertWithoutParent: flag("inert") ?? "the surface it feeds does not render",
};

console.log("── PASTE INTO server/castingV2/castingV2Scope.ts ".padEnd(78, "─"));
console.log("");
console.log(scopeFlagBlock(spec));
console.log("");

const rehearsalPath = path.resolve(
  "scripts",
  `rehearse-${env.toLowerCase().replace(/_/g, "-").replace(/^casting-/, "").replace(/-scope$/, "")}-boot-disposable.mts`,
);
if (fs.existsSync(rehearsalPath)) {
  console.log(`── REHEARSAL ALREADY EXISTS, not overwritten: ${rehearsalPath}`);
} else {
  fs.writeFileSync(rehearsalPath, rehearsalScript(spec, {
    parentValue: flag("parent-value") ?? "users:1",
    ask: flag("ask") ?? "users:1",
  }), "utf8");
  console.log(`── WROTE ${path.relative(process.cwd(), rehearsalPath)}`);
  console.log("   Run it BEFORE the variable is set anywhere — including its failure arms.");
}

console.log("");
console.log("── EVERYTHING ELSE, IN A SAFE ORDER ".padEnd(78, "─"));
for (const [index, site] of HAND_SITES.entries()) {
  console.log(`${String(index + 1).padStart(3)}. ${site.where}`);
  console.log(`     ${site.what}`);
}
process.exit(0);
