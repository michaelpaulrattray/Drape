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
import { imperativeOpenerIn } from "../server/castingV2/declarativeState";
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
      A NAVIGATE OR A REMOVE IS A DISAGREEMENT, NOT A CRASH.

      An `ok` parse does not always carry a delta: `intent: "remove"` and
      `intent: "navigate"` are legitimate shapes with no `delta` field at all,
      and this harness read `parsed.delta` unconditionally — so a golden the
      model classified as a removal took the whole run down with a
      TypeError at instruction 15 of 20, hiding every case after it.
      A driver that dies on a real answer measures the corpus it reached.
    */
    if ("intent" in parsed && parsed.intent !== "edit") {
      failures.push({
        instruction: golden.instruction,
        run,
        problem: `expected ${JSON.stringify(golden.delta)}, got intent "${parsed.intent}"`
          + ("match" in parsed ? ` (subject ${parsed.subject}, match "${parsed.match}")` : ""),
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
    /*
      AND EVERY FREE-LANE VALUE MUST BE A STATE (fable-195, fable-307).

      Checked on every golden rather than on the one that caused it, because the
      contract is the lane's and not one sentence's. Containment cannot do this
      job: "wear her hair down" contains "down", so the golden above passes on a
      value the assembler will refuse at the door — which is exactly how the
      founder's most-used sentence reached a paid render and cost 31.9 seconds
      and a refund. The marker is imported from the module the assembler refuses
      with, so this driver and that door can never disagree about the list.
    */
    const instructions = Object.entries((gotObj.free ?? {}) as Record<string, unknown>)
      .flatMap(([subject, value]) => (Array.isArray(value) ? value : [value])
        .map((item) => ({ subject, item: String(item), opener: imperativeOpenerIn(String(item)) }))
        .filter((entry) => entry.opener !== null));
    if (instructions.length > 0) {
      failures.push({
        instruction: golden.instruction,
        run,
        problem: instructions
          .map((entry) => `free.${entry.subject} = "${entry.item}" opens with "${entry.opener}" — an instruction, not a state`)
          .join("; "),
      });
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
