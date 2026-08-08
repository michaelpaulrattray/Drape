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

const DETAIL_SUITES = [
  "server/castingV2/verificationDetail.test.ts",
  "server/castingV2/renderVerification.test.ts",
];

const LANE_SUITES = [
  "server/castingV2/refineDeparture.test.ts",
  "server/castingV2/refineDelta.test.ts",
];

const MASK_SUITES = [
  "server/castingV2/maskedRefine.test.ts",
  "server/castingV2/maskGeometry.test.ts",
  "server/castingV2/maskedComposite.test.ts",
  "server/castingV2/compositeIntegrity.test.ts",
];

/* `suites` overrides the default for a guard that lives elsewhere — the driver
   grew a second subject (the compositor) and pointing it at the refine suites
   would have proved four compositor guards DECORATIVE for the wrong reason. */
const runs: Array<{ name: string; file: string; mutations: Mutation[]; suites?: string[] }> = [
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
  /*
    THE REMOVAL CRITERION — four halves of one ruling, each a real reversion.
    A base-worn removal's vacancy is governed by the removal's own rule inside
    the departed thing's own ground, and by the veil gate nowhere inside it.
  */
  {
    name: "the veil gate governing a departure's vacancy again (the bypass removed)",
    file: "server/castingV2/maskedRefine.ts",
    suites: MASK_SUITES,
    mutations: [{
      find: "    region.removalGoverned\n      ? region.vacancy\n      : harvestGate({",
      replace: "    false\n      ? region.vacancy\n      : harvestGate({",
    }],
  },
  {
    name: "the ground left as the segmenter's own tight outline (no expansion)",
    file: "server/castingV2/maskedRefine.ts",
    suites: MASK_SUITES,
    mutations: [{
      find: "    const grownTerritory = question.departed && coverage(masterRegion) > 0",
      replace: "    const grownTerritory = false && question.departed && coverage(masterRegion) > 0",
    }],
  },
  {
    name: "a SHRINK handed the removal's rule too (the scope removed)",
    file: "server/castingV2/maskedRefine.ts",
    suites: MASK_SUITES,
    mutations: [{
      find: "    const grownTerritory = question.departed && coverage(masterRegion) > 0",
      replace: "    const grownTerritory = coverage(masterRegion) > 0",
    }],
  },
  {
    /* The absorbed ask: if the service stops asking, or the guard stops
       answering, a delta that only repeats her record reaches a charge. */
    name: "the absorbed-ask guard never consulted by the service",
    file: "server/castingV2/refineService.ts",
    suites: ["server/castingV2/refineService.test.ts"],
    mutations: [{
      find: '  if (parsed.ok && "delta" in parsed) refuseIfAbsorbed(parsed.delta);',
      replace: '  if (false && parsed.ok && "delta" in parsed) refuseIfAbsorbed((parsed as never)!);',
    }],
  },
  {
    name: "the absorbed-ask guard answering 'nothing was absorbed' every time",
    file: "server/castingV2/refineDelta.ts",
    suites: ["server/castingV2/refineDelta.test.ts", "server/castingV2/refineService.test.ts"],
    mutations: [{
      find: "  if (echoed.length === 0) return { absorbed: false };",
      replace: "  if (echoed.length >= 0) return { absorbed: false };",
    }],
  },
  {
    /* The diagnostic backstop: a refusal that stops saying what the model said
       puts us back where run-11 left us — a free refusal and no way to tell why. */
    name: "the refusal line dropping what the model actually said",
    file: "server/castingV2/refineService.ts",
    suites: ["server/castingV2/refineService.test.ts"],
    mutations: [{
      find: '        ...("value" in parsed.refusal && parsed.refusal.value',
      replace: '        ...(false && "value" in parsed.refusal && parsed.refusal.value',
    }],
  },
  {
    name: "the departure inheriting the ponytail's 160px reach (the fence removed)",
    file: "server/castingV2/maskedRefine.ts",
    suites: MASK_SUITES,
    mutations: [{
      find: "        reachPx: question.departed ? departedEdgeReach : departedReach,",
      replace: "        reachPx: departedReach,",
    }],
  },
  {
    /*
      THE MAGNIFIER'S TWO DISHONEST FAILURE MODES, one sabotage each.

      A magnifier that never fires leaves the reader as blind as before while
      every test about the crop's correctness stays green — which is why the
      contract is asserted on the outgoing request rather than near it.
    */
    name: "the crop computed and then never read (the close pass skipped)",
    file: "server/castingV2/renderVerification.ts",
    suites: DETAIL_SUITES,
    mutations: [{
      find: "  if (!input.detail || closely.length === 0) return verdict;",
      replace: "  return verdict;",
    }],
  },
  {
    /* And the merge: a close reading taken and then discarded looks identical
       from outside to one that was never taken. */
    name: "the close reading taken and then thrown away",
    file: "server/castingV2/renderVerification.ts",
    suites: DETAIL_SUITES,
    mutations: [{
      find: "    return closer?.read ? closer : check;",
      replace: "    return check;",
    }],
  },
  {
    /*
      And the other one: a smooth resampler invents plausible pigment, so the
      magnifier would begin manufacturing the very thing it was added to
      detect. The test asserts the nearest-neighbour promise BY VALUE, so
      swapping the kernel must turn it red.
    */
    name: "the enlargement blending neighbours instead of repeating them",
    file: "server/castingV2/verificationDetail.ts",
    suites: DETAIL_SUITES,
    mutations: [{
      find: "resize({ width: target, kernel: \"nearest\" })",
      replace: "resize({ width: target, kernel: \"lanczos3\" })",
    }],
  },
  {
    /* And the third: magnifying every facet would cost every render a larger
       reading on a hunch. The seeded list is the decision; it must be pinned. */
    name: "the fine-detail list opened up to every facet",
    file: "server/castingV2/verificationDetail.ts",
    suites: DETAIL_SUITES,
    mutations: [{
      find: "  return facets.some((facet) => FINE_DETAIL_FACETS.has(facet));",
      replace: "  return facets.length > 0;",
    }],
  },
  {
    /*
      ORDER 3. The caption back in the lane that merely asserts — which is
      exactly where it sat for four paid renders while the imperative lane
      carried the bare noun.
    */
    name: "the caption left in the already-true lane instead of sharpening the ask",
    file: "server/castingV2/refineDelta.ts",
    suites: LANE_SUITES,
    mutations: [{
      find: "    if (asked.has(facet)) adopted[facet] = caption;",
      replace: "    if (asked.has(facet)) carried[facet] = caption;",
    }],
  },
  {
    /* And the guard's new eye. A guard that watches one of three doors reports
       a clean house, which is what it did all morning. */
    name: "contradictedFacets blinded to the captions lane again",
    file: "server/castingV2/refineDelta.ts",
    suites: LANE_SUITES,
    mutations: [{
      find: "    ...prompt.captionedFacets.filter((facet) => edited.has(facet)),\n",
    }],
  },
  {
    /* And the sweep's own finding: a departed facet's caption carried into the
       removal, which is "reproduce her glasses exactly" beside "take them
       off". Unreachable through the routing, so it is driven directly. */
    name: "a departed facet's caption carried into the already-true lane",
    file: "server/castingV2/refineDelta.ts",
    suites: LANE_SUITES,
    mutations: [{
      find: "    else if (!written.has(facet)) carried[facet] = caption;",
      replace: "    else carried[facet] = caption;",
    }],
  },
];

const red = (suites: string[]): boolean => {
  try {
    execFileSync("npx", ["vitest", "run", ...suites], { stdio: "pipe", shell: true });
    return false;
  } catch {
    return true;
  }
};

let allProven = true;
for (const run of runs) {
  const applied = await sabotage(run.file, run.mutations);
  const wentRed = red(run.suites ?? SUITES);
  await applied.restore();
  console.log(`${wentRed ? "PROVEN" : "DECORATIVE"} — ${run.name}`);
  if (!wentRed) allProven = false;
}

if (!allProven) {
  console.error("At least one sabotage left the suite green. The guard is not driven by these tests.");
  process.exit(1);
}
console.log(`All ${runs.length} guards are driven by the suite.`);
