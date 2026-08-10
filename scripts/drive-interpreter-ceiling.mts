/**
 * IS THE PARSER DECIDING, OR IS IT STARVED? — measured at two ceilings.
 *
 * Driving the glasses chip on 2026-08-09 the interpreter came back EMPTY on a
 * 200 three times in a row for one sentence, `finish_reason: length`, with
 * reasoning in the completion — and a fourth reading returned truncated JSON.
 * The retry loop absorbs most of it, and when it does not, a person is told
 * *"that didn't come through clearly"* about a sentence that was perfectly
 * clear, on a paid surface.
 *
 * An empty-on-200 at `length` is not a model declining. It is the model
 * spending its whole allowance thinking and never reaching the answer. So this
 * puts the same sentences to the same model at the shipped ceiling and at a
 * raised one, and reports the rate rather than an anecdote.
 *
 * Text calls only — no images, no credits.
 *
 *   npx tsx scripts/drive-interpreter-ceiling.mts
 *   RUNS=8 npx tsx scripts/drive-interpreter-ceiling.mts
 */
import "dotenv/config";

import { createOpenRouterTextEngine } from "../server/providers/openrouterText";
import { refineParseSystemPrompt } from "../server/castingV2/refineInterpreter";

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) throw new Error("OPENROUTER_API_KEY required — this measures the real transport");
const engine = createOpenRouterTextEngine({ apiKey });

const RUNS = Number(process.env.RUNS ?? 6);
/* The shipped ceiling, and the one under test. */
const CEILINGS = [600, 2000];

/**
 * The sentences, and the first is the one that actually returned empty.
 *
 * Pinned verbatim rather than described: a regression that cannot name the
 * sentence it regressed on is a story, and this bench has been asked for the
 * rate before and after.
 */
const SENTENCES = [
  "remove her glasses, then fox eyes",
  "remove her glasses",
  "fox eyes",
];

/*
  THE REAL SYSTEM PROMPT, IMPORTED — and the first version of this driver did
  not do that.

  It sent a two-line hand-written prompt of its own and measured 6/6 parsed at
  BOTH ceilings, which reads as "there is no defect". There is: the shipped
  prompt is ~3,600 tokens of vocabulary and rules, and it is what makes this
  model think long enough to spend the allowance. An instrument that cannot
  reproduce the failure cannot measure the fix — the positive control is the
  point of the bench, not a formality.
*/
const SYSTEM = refineParseSystemPrompt();

type Tally = { ok: number; empty: number; truncated: number; other: number };

for (const ceiling of CEILINGS) {
  console.log(`\nmax_tokens ${ceiling}`);
  for (const sentence of SENTENCES) {
    const tally: Tally = { ok: 0, empty: 0, truncated: 0, other: 0 };
    for (let run = 0; run < RUNS; run += 1) {
      try {
        const reply = await engine.complete({
          system: SYSTEM,
          /* The same context block the interpreter sends, so the prompt weight
             under test is the one that ships. */
          user: [
            "Current eye colour: brown",
            "Current eye shape: unknown",
            "Current hair cut: unknown",
            "Current hair colour: unknown",
            "Current hair texture: unknown",
            "Current makeup: none — a bare face",
            `Instruction: ${sentence}`,
          ].join("\n"),
          json: true,
          temperature: 0.1,
          maxOutputTokens: ceiling,
        });
        try {
          JSON.parse(reply.text.trim().replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, ""));
          tally.ok += 1;
        } catch {
          tally.truncated += 1;
        }
      } catch (error) {
        const message = String((error as Error)?.message ?? error);
        if (/returned nothing/i.test(message)) tally.empty += 1;
        else if (/truncat/i.test(message)) tally.truncated += 1;
        else tally.other += 1;
      }
    }
    console.log(`  "${sentence}"`.padEnd(44)
      + `parsed ${tally.ok}/${RUNS}   empty ${tally.empty}   truncated ${tally.truncated}`
      + `   other ${tally.other}`);
  }
}

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
