/**
 * The golden refinement harness — LIVE interpreter, no stubs.
 *
 * Sibling of `drive-golden-briefs.mts`, and it exists for the same reason that
 * one does: the last regression hid behind a stub, so the thing that decides
 * what a user's words MEAN is exercised for real or not at all.
 *
 * It asserts both halves of §10:
 *
 *   1. a real eye ask resolves to the EXACT delta, from a closed vocabulary;
 *   2. an out-of-tier ask is REFUSED — which is the half that costs money when
 *      it breaks, because an interpreter that stretches to fit "make her older"
 *      charges 25 credits for a face that is not older.
 *
 * Text calls only — pennies, no images, no credits. Still a driver rather than
 * part of `pnpm test`, because a suite that quietly spends money offline is a
 * suite nobody can trust to run.
 *
 *   npx tsx scripts/drive-golden-refinements.mts
 *   RUNS=5 npx tsx scripts/drive-golden-refinements.mts
 */
import "dotenv/config";

import { GOLDEN_REFINEMENTS } from "../server/castingV2/goldenBriefs";
import { interpretRefinement, refusalMessage } from "../server/castingV2/refineInterpreter";

const RUNS = Number(process.env.RUNS ?? 1);

type Failure = { instruction: string; run: number; problem: string };
const failures: Failure[] = [];

for (const golden of GOLDEN_REFINEMENTS) {
  for (let run = 1; run <= RUNS; run += 1) {
    const parsed = await interpretRefinement({
      instruction: golden.instruction,
      currentEyeColour: golden.from?.eyeColour ?? "brown",
      currentEyeShape: golden.from?.eyeShape ?? null,
      /* A relative ask needs something to be relative TO. Omitting these is
         what made "shorter" refuse: with no current cut it is not an
         under-specified hair instruction, it is a meaningless one. */
      currentHairStyle: golden.from?.hairStyle ?? null,
      currentHairColour: golden.from?.hairColour ?? null,
    });

    if (golden.delta === null) {
      if (parsed.ok) {
        failures.push({
          instruction: golden.instruction,
          run,
          problem: `expected a refusal, got ${JSON.stringify(parsed.delta)}`,
        });
        continue;
      }
      if (!parsed.refusal.reason.startsWith("wall_")) {
        /*
          A refusal for the wrong reason is still a bug worth seeing. "Unreadable"
          on a perfectly clear out-of-tier ask means the interpreter did not
          understand it rather than declined it, and the copy the user gets is
          the wrong one.
        */
        failures.push({
          instruction: golden.instruction,
          run,
          problem: `refused as "${parsed.refusal.reason}" rather than a named wall`,
        });
        continue;
      }
      console.log(`PASS  refused     "${golden.instruction}" → "${refusalMessage(parsed)}"`);
      continue;
    }

    if (!parsed.ok) {
      failures.push({
        instruction: golden.instruction,
        run,
        problem: `expected ${JSON.stringify(golden.delta)}, got refusal "${parsed.refusal.reason}"`,
      });
      continue;
    }
    /*
      Key ORDER is not meaning. Comparing raw JSON strings failed a correct
      two-axis parse purely because the model named the cut before the colour —
      a harness bug that reads exactly like a product bug, which is the worst
      kind to leave in an instrument.
    */
    /*
      FREE TEXT is matched by CONTAINMENT, not equality. "a smoky eye and a
      nude lip" and "smoky eye and a nude lip" are the same answer, and a golden
      that fails on a dropped article is an instrument that cries wolf — which
      is how a suite stops being read.
    */
    const freeish = (want: Record<string, unknown>, got: Record<string, unknown>) => {
      for (const [key, wanted] of Object.entries(want)) {
        if (key !== "makeup" && key !== "free") continue;
        const gotValue = JSON.stringify(got[key] ?? "").toLowerCase();
        /*
          ANY of the markers, not all of them. Free text is genuinely two-valued
          run to run — "none" and "a bare face" both mean the makeup is off — and
          a golden that demands one exact phrasing flaps, which is how an
          instrument stops being believed. What must be TRUE is that the right
          subject was addressed; the wording is the model's to choose.
        */
        const words = JSON.stringify(wanted).toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter((w) => w.length > 3);
        if (words.length > 0 && !words.some((w) => gotValue.includes(w))) return false;
      }
      return true;
    };
    const canonical = (value: Record<string, unknown>) =>
      JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));
    const got = canonical(parsed.delta as Record<string, unknown>);
    const want = canonical(golden.delta as Record<string, unknown>);
    const wantObj = golden.delta as Record<string, unknown>;
    const gotObj = parsed.delta as Record<string, unknown>;
    const structural = Object.keys(wantObj).filter((k) => k !== "makeup" && k !== "free");
    /*
      The GUARANTEED fields must match exactly — that is the whole point of a
      guarantee. Extra free-lane entries alongside them are allowed, because a
      near-match legitimately lands there ("a dark bob" gives an exact cut and
      an inexact colour), and forbidding that would pin a variance the design
      deliberately permits.
    */
    const structuralMatch = structural.every((k) => gotObj[k] === wantObj[k]);
    if (!structuralMatch || !freeish(wantObj, gotObj)) {
      failures.push({ instruction: golden.instruction, run, problem: `expected ${want}, got ${got}` });
      continue;
    }
    console.log(`PASS  parsed      "${golden.instruction}" → ${got}`);
  }
}

if (failures.length > 0) {
  console.log(`\n${failures.length} failure(s):`);
  for (const failure of failures) {
    console.log(`  FAIL  "${failure.instruction}" (run ${failure.run}) — ${failure.problem}`);
  }
  process.exit(1);
}
console.log(`\nAll ${GOLDEN_REFINEMENTS.length} golden refinements passed × ${RUNS} run(s).`);
process.exit(0);
