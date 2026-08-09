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

/* D-238's subject: the pin's value-space, its capture and its retirement. */
const PIN_SUITES = [
  "server/castingV2/hairArrangement.test.ts",
  "server/castingV2/presentationState.test.ts",
  "server/castingV2/refineService.test.ts",
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
    /* The line grew a surface-facet branch on 2026-08-09; the sabotage is the
       same one — the kept caption sent to the lane that merely asserts. */
    mutations: [{
      find: "      if (!isSurfaceFacet(facet as Facet)) adopted[facet] = caption;",
      replace: "      if (!isSurfaceFacet(facet as Facet)) carried[facet] = caption;",
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
  /*
    D-238 — FOUR REVERSIONS, ONE PER LOAD-BEARING CLAIM.

    `hairWorn` scored 25% twice on hair that never moved, because a two-word
    free-text pin nobody constrained said "loose" and the reader read that word
    against the CUT. Each of these puts one plank of the repair back the way it
    was the morning of run-13.
  */
  {
    name: "the pin taking free text again instead of a choice",
    file: "server/castingV2/presentationState.ts",
    suites: PIN_SUITES,
    mutations: [{
      find: "      const wording = entry.vocabulary.wordingFor(value);",
      replace: "      const wording = value.trim().toLowerCase();",
    }],
  },
  {
    /* Storing the id rather than the sentence: the painter and the reader stop
       sharing a wording, which is the failure fable-048 named one consumer
       earlier. */
    name: "the chosen id stored instead of the one shared wording",
    file: "server/castingV2/presentationState.ts",
    suites: PIN_SUITES,
    mutations: [{
      find: "        return id ? arrangementWording(id) : null;",
      replace: "        return id;",
    }],
  },
  {
    /* The retirement unwired at its CALL SITE, not inside the helper — a
       control that is not invoked does not exist (invariant 7). */
    name: "pre-vocabulary pins carried forward instead of re-read from the master",
    file: "server/castingV2/refineService.ts",
    suites: PIN_SUITES,
    mutations: [{
      find: "unconstrainedPresentationPins(carriedCaptions)",
      replace: "[]",
    }],
  },
  {
    /* Without it, run-12's pixie and run-13's crop have no true answer on the
       list, and the vocabulary reintroduces the argument it was built to end. */
    name: "the vocabulary losing 'worn as cut'",
    file: "server/castingV2/hairArrangement.ts",
    suites: PIN_SUITES,
    mutations: [{
      find: "  \"worn as cut\": \"worn exactly as cut — short enough that it is not gathered, tied or pinned at all\",\n",
    }],
  },
  {
    /*
      THE GLASSES GATE. Without it a woman whose eyes cannot be measured
      through her frames is charged for an eye edit that may be a no-op — the
      protection silently unavailable to half of one population.
    */
    name: "the glasses gate that asks instead of charging",
    file: "server/castingV2/refineService.ts",
    suites: ["server/castingV2/refineService.test.ts"],
    mutations: [{ find: "if (!reading && faceBytes) {", replace: "if (false) {" }],
  },
  {
    /*
      And the THRESHOLD, separately — a gate that fires on everything is as
      broken as one that never fires, and it would fire on the bare population
      whose measured coverage is a flat zero.
    */
    name: "the glasses threshold separating 0.000% from 1.349%",
    file: "server/castingV2/canthalTilt.ts",
    suites: ["server/castingV2/canthalTilt.test.ts", "server/castingV2/refineService.test.ts"],
    mutations: [{ find: "export const GLASSES_COVERAGE_FLOOR = 0.001;", replace: "export const GLASSES_COVERAGE_FLOOR = -1;" }],
  },
  {
    /*
      THE CHIP THAT SUBMITS ONE INSTRUCTION. Restoring the compound is the
      exact string that shipped for an hour: the interpreter files it as a
      removal and her eye ask is gone, 0 times in 5 carrying both halves.
    */
    name: "the chip refusing to submit two instructions in one sentence",
    file: "server/castingV2/refineReask.ts",
    suites: ["server/castingV2/refineReask.test.ts"],
    mutations: [{
      find: '{ label: "Take them off first", resolves: "remove her glasses" },',
      replace: '{ label: "Take them off first", resolves: `remove her glasses, then ${asked}` },',
    }],
  },
  {
    /*
      THE PARSER'S CEILING. Back at 600 the model spends its allowance thinking
      and returns an empty completion on a 200 — four times in six on `remove
      her glasses, then fox eyes`, measured against the real transport.
    */
    name: "the token ceiling that stops starving the parser",
    file: "server/castingV2/refineInterpreter.ts",
    suites: ["server/castingV2/refineInterpreterCeiling.test.ts"],
    mutations: [{ find: "export const REFINE_PARSE_MAX_TOKENS = 4000;", replace: "export const REFINE_PARSE_MAX_TOKENS = 600;" }],
  },
  {
    /*
      THE MARKER THAT CARRIES HER SENTENCE. Without it every authored refusal
      is replaced by the lost-contact line, including three that say nothing
      was charged.
    */
    name: "the spoken marker reaching the outgoing payload",
    file: "server/_core/spokenError.ts",
    suites: ["server/castingV2/spokenSentences.test.ts"],
    mutations: [{ find: "  if (!isSpokenError(error)) return shape;", replace: "  if (true) return shape;" }],
  },
  {
    /* And the client half — the marker means nothing if the copy rule ignores it. */
    name: "the client trusting a spoken sentence",
    file: "client/src/features/castingV2/failureCopy.ts",
    suites: ["server/castingV2/spokenSentences.test.ts"],
    mutations: [{ find: "  if (errorIsSpoken(error) && message) return message;\n" }],
  },
  {
    /*
      THE CAPTION WALL. Restoring the pre-fix line puts a surface facet's
      realization caption back inside its own ask, which is the shape that
      delivered her freckles 0 of 16 times.
    */
    name: "a surface facet's caption kept out of its own ask",
    file: "server/castingV2/refineDelta.ts",
    suites: ["server/castingV2/refineDelta.test.ts"],
    mutations: [{
      find: "      if (!isSurfaceFacet(facet as Facet)) adopted[facet] = caption;",
      replace: "      adopted[facet] = caption;",
    }],
  },
  {
    /*
      AND THE BOUNDARY ITSELF. If every facet answered `true` the rule would
      strip captions from hair and eyes as well — a caption doing real work on
      every facet the painter can tell apart from the master. The test that
      keeps a REPLACEMENT facet's caption is what has to catch this.
    */
    name: "the surface boundary, so the rule cannot swallow the axis lane",
    file: "server/castingV2/changeAmplitude.ts",
    suites: ["server/castingV2/refineDelta.test.ts", "server/castingV2/changeAmplitude.test.ts"],
    mutations: [{
      find: "  return subjects.length > 0 && subjects.every((subject) => CHANGE_AMPLITUDE[subject].levels === SURFACE);",
      replace: "  return true;",
    }],
  },
  {
    /*
      THE SEGMENT PURGE. Deleting the join is exactly the shape the founder's
      condition exists to forbid — a store whose deletion rights arrive "in a
      later slice". The sweep would still report success; the crops of a
      person's face would simply stay at their public URLs forever, with the
      only row naming them deleted alongside the candidate.
    */
    name: "a candidate's segments purging with it",
    file: "server/castingV2/candidateRetention.ts",
    suites: ["server/castingV2/candidateRetention.test.ts"],
    mutations: [{
      find: "      const segments = await listPurgeableSegmentsIn(tx, candidateIds).catch(\n        (error: unknown) => tolerateAbsentSegmentStore(error),\n      );",
      replace: "      const segments: Array<{ maskKey: string; contentKey: string }> = [];",
    }],
  },
  {
    /*
      AND THE LIMIT OF THE ONE TOLERATED FAILURE. "Table absent" is forgiven
      only while the store is disarmed; armed, it is a fault. Widen it and the
      sweep would shrug at a missing table on a database actively writing
      segments — a purge that reports success and collects nothing.
    */
    name: "the missing-table tolerance ending when the store is armed",
    file: "server/castingV2/candidateRetention.ts",
    suites: ["server/castingV2/candidateRetention.test.ts"],
    mutations: [{
      find: "  if (!isMissingTable(error) || castingSegmentsArmed()) throw error;",
      replace: "  if (!isMissingTable(error)) throw error;",
    }],
  },
  {
    /*
      THE CHAIN WALK, and it is here because production found its absence
      before any test did. Reading `code` off the top-level error matches only
      the shape a hand-written test error has: the real path arrives wrapped in
      a DrizzleQueryError with the driver's error on `cause`. Depth 1 restores
      exactly the version that threw in production and left 56 candidates
      uncollected.
    */
    name: "the missing-table check reading THROUGH the query wrapper",
    file: "server/castingV2/candidateRetention.ts",
    suites: ["server/castingV2/candidateRetention.test.ts"],
    mutations: [{
      find: "  for (let link: unknown = error, depth = 0; link && depth < 5; depth += 1) {",
      replace: "  for (let link: unknown = error, depth = 0; link && depth < 1; depth += 1) {",
    }],
  },
  {
    /*
      THE ORDERING THAT KEEPS A FACE OFF A PUBLIC URL WITH NO ROW. Moving the
      manifest after the writes reproduces the diagnostics incident exactly: a
      crash between the put and the row leaves pieces of a person's face at
      permanent keys that nothing will ever collect.
    */
    name: "the segment manifest registered BEFORE the bytes",
    file: "server/castingV2/segmentPersistence.ts",
    suites: ["server/castingV2/segmentPersistence.test.ts"],
    mutations: [{
      find: `    await withTransaction((tx) => createStorageCleanupManifestIn(tx, {
      id: cleanupBatchId,
      userId: input.userId,
      operationId: randomUUID(),
      kind: "casting_candidate_cleanup",
      storageItems: planned.flatMap(({ maskKey, contentKey }) => [
        { storageKey: maskKey, storageBackend: "public_r2" as const },
        { storageKey: contentKey, storageBackend: "public_r2" as const },
      ]),
    }));
`,
    }],
  },
  {
    /*
      BLUNT THE METRIC AND THE CONTROL MUST FIRE. The gauntlet's whole
      argument is that its instrument can condemn a blurred chain; a metric
      that always answers the same number would certify v2 itself. Constant
      energy is the shape of "measured nothing, said fine".
    */
    name: "the sharpness metric's own positive control",
    file: "server/castingV2/sharpness.ts",
    suites: ["server/castingV2/sharpness.test.ts"],
    mutations: [{
      find: "  return { energy: variance, pixels: responses.length };",
      replace: "  return { energy: 1000, pixels: responses.length };",
    }],
  },
  {
    /*
      THE UNDO THAT REFUSES TO PRETEND. Carrying on after dropping nothing
      would report success for a facet she never bought — or worse, for
      something she was BORN wearing, where the answer is a real render into
      the skin behind it. "Done" and the glasses still on.
    */
    name: "an undo with nothing to drop saying so",
    file: "server/castingV2/segmentPrune.ts",
    suites: ["server/castingV2/segmentPrune.test.ts"],
    mutations: [{
      find: '    return { outcome: "nothing-to-drop" };',
      replace: "    /* sabotage */",
    }],
  },
  {
    /*
      RECENCY. Reversing the paste order hands contested pixels to the OLDER
      segment — her previous freckles winning over the ones she just asked to
      be heavier, silently, with the evidence still reporting a resolution.
    */
    name: "the later segment winning the pixels two of them claim",
    file: "server/castingV2/segmentAssembly.ts",
    suites: ["server/castingV2/segmentAssembly.test.ts"],
    mutations: [{
      find: "  for (const segment of input.carried) {",
      replace: "  for (const segment of [...input.carried].reverse()) {",
    }],
  },
  {
    /*
      A DEGRADATION MUST NEVER BE SILENT. Dropping the exclusion record leaves
      a face quietly missing a kept edit with every instrument green — the
      permanence rots one facet at a time and the numbers keep reading well.
    */
    name: "an excluded segment being named rather than dropped quietly",
    file: "server/castingV2/segmentAssembly.ts",
    suites: ["server/castingV2/segmentAssembly.test.ts"],
    mutations: [{
      find: `      evidence.segmentsExcluded.push({
        id: segment.id,
        facet: segment.facet,
        reason: "frameMismatch",
        detail: \`\${segment.frame.width}×\${segment.frame.height} against \${frame.width}×\${frame.height}\`,
      });
`,
    }],
  },
  {
    /*
      NEVER SCALED, NEVER MISPLACED. Skipping the frame check pastes a segment
      cut from another size — which does not fail, it puts her freckles
      somewhere else on her face.
    */
    name: "the frame-size check that stops a segment landing in the wrong place",
    file: "server/castingV2/segmentAssembly.ts",
    suites: ["server/castingV2/segmentAssembly.test.ts"],
    mutations: [{
      find: "    if (segment.frame.width !== frame.width || segment.frame.height !== frame.height) {",
      replace: "    if (false) {",
    }],
  },
  {
    /*
      REFUSE, DO NOT DEGRADE. An unreadable store turned into a shrug delivers
      a face short of the edits she paid for, and it looks exactly like a
      correct render — the silently-short paste, which is the one failure this
      whole read path is shaped around.
    */
    name: "an unreadable store refusing the render instead of shrugging",
    file: "server/castingV2/carriedSegments.ts",
    suites: ["server/castingV2/carriedSegments.test.ts"],
    mutations: [{
      find: `    throw new ProviderError(
      "segment_store",
      "we could not read this face's kept edits",
    );`,
      replace: "    return unchanged;",
    }],
  },
  {
    /*
      THE HONESTY CONDITION THE FOUNDER ATTACHED TO THE STORE. Folding carried
      facets into the delivery denominator is the flattering-bias family in one
      line: the rate would climb because the painter's hardest cases quietly
      left the exam, at the exact moment he is asked to certify a number.
    */
    name: "carried facets staying OUT of the delivery denominator",
    file: "server/castingV2/reliabilityReport.ts",
    suites: ["server/castingV2/reliabilityReport.test.ts"],
    mutations: [{
      find: "    + tally.delivered_unverified;",
      replace: "    + tally.delivered_unverified\n    + tally.delivered_carried;",
    }],
  },
  {
    /*
      AND THE OTHER HALF: a carried fact that is MISSING is the store's own
      promise failing, and must stay a false pass. Excusing it because this
      render did not paint it rebuilds the bias through the door the carried
      column was opened to close.
    */
    name: "a carried fact that is missing still counting as a false pass",
    file: "server/castingV2/reliabilityReport.ts",
    suites: ["server/castingV2/reliabilityReport.test.ts"],
    mutations: [{
      find: "  const fresh = checks.filter((check) => check.carried !== true);\n  if (fresh.length === 0) return \"delivered_carried\";",
      replace: "  const fresh = checks.filter((check) => check.carried !== true);\n  if (checks.some((check) => check.carried === true)) return \"delivered_carried\";",
    }],
  },
  {
    /*
      THE SUB-FLAG'S COVERAGE RULE. Segments belong to candidates, and only
      Casting V2 makes those — so a segment scope reaching past the casting
      scope is inert, and an inert flag that reports itself enabled is how a
      dark slice gets believed to be live.
    */
    name: "the segment scope refusing to reach past the casting scope",
    file: "server/castingV2/castingV2Scope.ts",
    suites: ["server/castingV2/castingV2Scope.test.ts"],
    mutations: [{
      find: "  const uncovered = segments.userIds.filter((userId) => !casting.userIds.includes(userId));",
      replace: "  const uncovered: number[] = [];",
    }],
  },
  {
    /*
      THE LINE BETWEEN A CATALOGUE AND A GUESS. Arming a class whose floor
      nobody measured is a product telling a customer what is on her face on the
      strength of a number somebody liked — working law 2, in the one place
      where breaking it is a single word.
    */
    name: "a class that cannot arm without a measured floor",
    file: "server/castingV2/bornWornDetector.ts",
    suites: ["server/castingV2/bornWornDetector.test.ts"],
    mutations: [{
      find: "    armed: typeof measured?.floor === \"number\",",
      replace: "    armed: true,",
    }],
  },
  {
    /*
      THE ASYMMETRY, AT THE WIRE. With `absentIsAnswer` false, a bare face is a
      failed question rather than a bare face — the catalogue would report every
      face it could not find glasses on as unreadable, which is the exact
      conflation that once made removal impossible.
    */
    name: "the catalogue asking with absent-is-an-answer",
    file: "server/castingV2/bornWornDetector.ts",
    suites: ["server/castingV2/bornWornDetector.test.ts"],
    mutations: [{
      find: "name: entry.region, absentIsAnswer: true });",
      replace: "name: entry.region, absentIsAnswer: false });",
    }],
  },
  {
    /*
      A DETECTOR THAT CAN BLOCK A CAST. fable-085 §4: detection failures are
      silent non-entries. Rethrowing turns a segmenter's bad minute into a
      customer losing a picture.
    */
    name: "a failed detection costing one row rather than the whole scan",
    file: "server/castingV2/bornWornDetector.ts",
    suites: ["server/castingV2/bornWornDetector.test.ts"],
    mutations: [{
      find: "      scan.failed.push({ facet: entry.id, detail: error instanceof Error ? error.message : String(error) });",
      replace: "      throw error;",
    }],
  },
  {
    /*
      THE RE-SCAN'S ORDER. If the idempotency read stops filtering, a catalogue
      pays a segmenter to tell it what a row already says — every time anything
      re-runs.
    */
    name: "the re-scan skipping classes it already holds, BEFORE asking",
    file: "server/castingV2/bornWornCatalogue.ts",
    suites: ["server/castingV2/bornWornCatalogue.test.ts"],
    mutations: [{
      find: "    const wanted = catalogue.filter((entry) => entry.armed && !held.has(entry.id));",
      replace: "    const wanted = catalogue.filter((entry) => entry.armed);",
    }],
  },
  {
    /*
      NEVER RESIZE A MASK TO FIT. A detection measured against another frame,
      filed anyway, names the wrong part of her face — and the row says so
      forever, silently.
    */
    name: "a detection measured against a different frame being refused",
    file: "server/castingV2/bornWornCatalogue.ts",
    suites: ["server/castingV2/bornWornCatalogue.test.ts"],
    mutations: [{
      find: "      if (detection.mask.width !== master.width || detection.mask.height !== master.height) {",
      replace: "      if (false) {",
    }],
  },
  {
    /*
      THE BRANCH IS THE QUESTION (fable-091). Asking the store about the
      CANDIDATE rather than about the selected variant's own lineage is the
      global live-list the founder's fork semantics forbid — a fork from B
      inheriting D's glasses, and losing what D superseded.
    */
    name: "the carried set asking about the SELECTED variant's lineage",
    file: "server/castingV2/carriedSegments.ts",
    suites: ["server/castingV2/carriedSegments.test.ts"],
    mutations: [{
      find: "    anchorVariantId: input.anchorVariantId,\n  });",
      replace: "    anchorVariantId: 0 as unknown as number,\n  });",
    }],
  },
  {
    /*
      An edit made from the candidate itself has no branch, so it carries
      nothing. Without the guard it would ask the store with no anchor at all,
      which is the question that has no answer.
    */
    name: "an edit with no branch carrying nothing",
    file: "server/castingV2/carriedSegments.ts",
    suites: ["server/castingV2/carriedSegments.test.ts"],
    mutations: [{
      find: "  if (!input.anchorVariantId) return { segments: [], excluded: [] };",
      replace: "",
    }],
  },
  {
    /*
      "Take the earrings off" means off the face she is LOOKING AT. An undo
      that dropped the anchor would reach every branch of the tree.
    */
    name: "the undo naming the branch it takes them off",
    file: "server/castingV2/segmentPrune.ts",
    suites: ["server/castingV2/segmentPrune.test.ts"],
    mutations: [{
      find: "    anchorVariantId: input.anchorVariantId,\n    facet: input.facet,",
      replace: "    facet: input.facet,",
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
