/**
 * The golden-brief harness — LIVE interpreter, no stubs.
 *
 * The founder's standing instruction after two regressions hid behind stubs:
 * "Live interpreter only — stubs are how the last one hid." Every test in the
 * partial-deference suite drove a hand-written intent that already contained
 * the fact the bug removed, so the suite was green while the product dropped
 * stated facts on three of five briefs.
 *
 * This runs the real interpreter, the real compiler and the real echo, and
 * asserts the two things the founder pinned:
 *
 *   1. every golden brief with a category returns a NON-NULL role;
 *   2. its echo carries the "cast as" clause.
 *
 * Plus the one that made the assertion necessary in the first place: the
 * category's own words must appear in the composed prompt.
 *
 * Costs a few text calls per brief and is therefore a driver rather than part
 * of `pnpm test` — a suite that quietly spends money is a suite nobody can
 * trust to run offline. `RUNS` raises the sample; the failures this catches are
 * stochastic, so one pass proves less than it looks.
 *
 *   npx tsx scripts/drive-golden-briefs.mts          # 1 run per brief
 *   RUNS=5 npx tsx scripts/drive-golden-briefs.mts   # 5 runs per brief
 */
import "dotenv/config";

import { GOLDEN_BRIEFS } from "../server/castingV2/goldenBriefs";
import { castingBriefCompiler } from "../server/castingV2/briefCompiler";
import { composeEcho, echoText } from "../client/src/features/castingV2/briefEcho";
import { lockFactsOf } from "../server/castingV2/castingIntent";

const RUNS = Number(process.env.RUNS ?? 1);

type Failure = { brief: string; run: number; problem: string };
const failures: Failure[] = [];

for (const golden of GOLDEN_BRIEFS) {
  const roles: (string | null)[] = [];

  for (let run = 1; run <= RUNS; run += 1) {
    const compiled = await castingBriefCompiler({
      briefText: golden.brief,
      candidateCount: 8,
      rollSeed: `golden-${golden.brief}-${run}`,
    });
    const intent = (compiled.compiledBrief as { intent?: Record<string, unknown> }).intent ?? {};
    const role = (intent.role as string | null) ?? null;
    roles.push(role);

    if (golden.category && !role) {
      failures.push({ brief: golden.brief, run, problem: "role came back NULL on a brief that names a category" });
    }

    /*
      The counter-case, asserted LIVE rather than only offline. Without this the
      category assertion above could be satisfied by backfilling every null, and
      the harness would call that a pass.
    */
    if (!golden.category && role) {
      failures.push({
        brief: golden.brief,
        run,
        problem: `role "${role}" invented on a brief that names no category`,
      });
    }

    /*
      characterNotes words must reach the prompt too, not just role words.
      "Silver at the temples" travels in notes, and the D-79 rollback was
      exactly a case of a stated fact vanishing from that field — a harness
      that only checks `role` cannot see it happen again.
    */
    const notes = (intent.characterNotes as string | null) ?? null;
    if (notes) {
      const missing = compiled.candidates.filter((c) => !c.prompt.includes(notes)).length;
      if (missing > 0) {
        failures.push({
          brief: golden.brief,
          run,
          problem: `characterNotes "${notes}" missing from ${missing}/8 prompts`,
        });
      }
    }

    if (golden.category && role) {
      /* The category's own words must reach the image model. */
      const missing = compiled.candidates.filter((c) => !c.prompt.includes(role)).length;
      if (missing > 0) {
        failures.push({ brief: golden.brief, run, problem: `role "${role}" missing from ${missing}/8 prompts` });
      }

      /* And the sheet must say so. */
      const locks = lockFactsOf(intent as never);
      const echo = echoText(
        composeEcho({
          role,
          locks: {
            sex: locks.sex ?? null,
            ageBand: locks.ageBand ?? null,
            agePhase: locks.agePhase ?? null,
            heritage: locks.heritage?.map((h) => h.heritage) ?? null,
            build: locks.build ?? null,
            energy: locks.energy ?? null,
            look: locks.look ?? null,
          } as never,
          open: [],
          variationAxis: (intent.variationAxis as never) ?? null,
        }),
      );
      if (!echo.includes("cast as")) {
        failures.push({ brief: golden.brief, run, problem: `echo carries no "cast as" clause: ${echo}` });
      }
      if (echo.trimStart().startsWith(",")) {
        failures.push({ brief: golden.brief, run, problem: `echo opens on a comma: ${echo}` });
      }
    }
  }

  const nulls = roles.filter((r) => r === null).length;
  const label = golden.category ? "CATEGORY" : "no-category";
  console.log(
    `${nulls > 0 && golden.category ? "FAIL" : "ok  "}  ${label.padEnd(12)} "${golden.brief}"` +
      `\n        roles: ${JSON.stringify(roles)}`,
  );
}

console.log("");
if (failures.length === 0) {
  console.log(`GOLDEN BRIEFS PASS — ${GOLDEN_BRIEFS.length} briefs x ${RUNS} run(s), live interpreter.`);
  process.exit(0);
}
console.log(`GOLDEN BRIEFS FAILED — ${failures.length} problem(s):`);
for (const f of failures) console.log(`  - [run ${f.run}] "${f.brief}": ${f.problem}`);
process.exit(1);
