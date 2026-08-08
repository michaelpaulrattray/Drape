/**
 * Do the prune tests DRIVE the guard, or merely sit near it?
 *
 * Two sabotages, one per half of run-7's root cause, each restoring the exact
 * pre-fix behaviour of the line it targets. Both must turn the suite RED; a
 * green here would mean the tests pinning this defect are decorative — which is
 * the failure mode this program distrusts most, and the reason these rows exist
 * at all.
 */
import { execFileSync } from "node:child_process";
import { sabotage, type Mutation } from "./lib/sabotage.mts";

const SUITES = [
  "server/castingV2/refineService.test.ts",
  "server/castingV2/refineRemoval.test.ts",
  "server/castingV2/reliabilityReport.test.ts",
];

const runs: Array<{ name: string; file: string; mutations: Mutation[] }> = [
  {
    name: "width inferred from missing words (the matcher's half)",
    file: "server/castingV2/refineRemoval.ts",
    mutations: [{
      find: "  if (words.length === 0) {\n    return target.whole ? byFacet.map(({ index }) => ({ index, keep: null })) : [];\n  }",
      replace: "  if (words.length === 0) return byFacet.map(({ index }) => ({ index, keep: null }));",
    }],
  },
  {
    /* The advisory bucket is only trustworthy while a REAL miss still lands in
       FALSE. Demoting the binding test is exactly how it would become a
       laundromat, so the suite has to notice when it stops discriminating. */
    name: "the advisory bucket swallowing a binding miss",
    file: "server/castingV2/reliabilityReport.ts",
    mutations: [{
      find: "&& check.binding !== false)) {",
      replace: "&& false)) {",
    }],
  },
  {
    /* Run-8: the already-true gate keyed on the COMPOSED recipe, so a delivered
       "fox eyes" intercepted every later ask with a question about her eyes. */
    name: "the already-true gate reading the composed recipe instead of this ask",
    file: "server/castingV2/refineService.ts",
    mutations: [{
      find: "  const asksUpsweptNow = editDelta != null && isUpsweptAsk(editDelta.eyeShape);",
      replace: "  const asksUpsweptNow = isUpsweptAsk(composed.eyeShape);",
    }],
  },
  {
    name: "the noun requirement dropped before the matcher (the service's half)",
    file: "server/castingV2/refineService.ts",
    mutations: [{
      find: "    if (!parsed.match) {\n      log.warn(",
      replace: "    if (false) {\n      log.warn(",
    }],
  },
];

const red = (): boolean => {
  try {
    execFileSync("npx", ["vitest", "run", ...SUITES], { stdio: "pipe", shell: true });
    return false;
  } catch {
    return true;
  }
};

let allProven = true;
for (const run of runs) {
  const applied = await sabotage(run.file, run.mutations);
  const wentRed = red();
  await applied.restore();
  console.log(`${wentRed ? "PROVEN" : "DECORATIVE"} — ${run.name}`);
  if (!wentRed) allProven = false;
}

if (!allProven) {
  console.error("At least one sabotage left the suite green. The guard is not driven by these tests.");
  process.exit(1);
}
console.log(`All ${runs.length} guards are driven by the suite.`);
