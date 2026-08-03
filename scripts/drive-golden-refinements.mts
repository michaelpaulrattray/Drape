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
      if (parsed.refusal.reason !== "out_of_tier") {
        /*
          A refusal for the wrong reason is still a bug worth seeing. "Unreadable"
          on a perfectly clear out-of-tier ask means the interpreter did not
          understand it rather than declined it, and the copy the user gets is
          the wrong one.
        */
        failures.push({
          instruction: golden.instruction,
          run,
          problem: `refused as "${parsed.refusal.reason}" rather than out_of_tier`,
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
    const got = JSON.stringify(parsed.delta);
    const want = JSON.stringify(golden.delta);
    if (got !== want) {
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
