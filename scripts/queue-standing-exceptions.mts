/**
 * THE STANDING-EXCEPTIONS RANKING, DERIVED — never a second list.
 *
 * `.agents/foreman/PROGRAM.md` used to name the ranking card by card:
 *
 *     1. #54 the refine lockKey  2. #39 the suite  3. #41 the Crew tab
 *     4. #40 the rebaseline      5. #38 the scan cost model  (#37, #32, #33)
 *
 * ALL EIGHT WERE CLOSED ON 2026-08-25, and the list was still being read as
 * the ranking five days later (#271, the founder's own order: *"yeah we need a
 * freshness path done to find whats relevant and whats not"*). Every shift
 * that opened the Program to decide what mattered most was pointed entirely at
 * finished work.
 *
 * That is working law 4 — a second list shadowing a source of truth always
 * drifts from it. The source of truth is the QUEUE, so the ranking is read out
 * of the queue instead of transcribed beside it, and a card closing removes
 * itself from the ranking with no edit anywhere.
 *
 * # What the ranking IS, stated so the derivation can be checked
 *
 * PROGRAM.md's standing exceptions are, in his order:
 *
 *   1. anything the founder marks urgent
 *   2. process/gate findings that block every merge
 *   3. patrol duties when their clock fires
 *
 * ⚠ **AND HIS ORDERED BAND OUTRANKS ALL THREE, WHICH THIS VIEW COULD NOT SEE
 * UNTIL #472.** It read ONE label — `urgent` — and when that band was empty it
 * printed *"Bands 2 and 3 apply"*, a sentence that reads as COMPLETE. Measured
 * the day the card was filed: **0 urgent, 14 `founder-ordered`** — a shift
 * running this script alone was told the urgent band was empty and patrols
 * applied, while fourteen cards he had personally ordered sat unnamed. That is
 * the same shape one step out from #471, and the third appearance of it on this
 * feature: **a derived priority view whose population is narrower than the rule
 * it serves, with a message that reads as complete.**
 *
 * The two bands are printed separately and never merged (#471: `urgent` means
 * this cannot wait, `founder-ordered` means he chose the order), his first,
 * because PROGRAM.md's clause of 2026-08-30 says *taken FIRST — before the
 * focus, before patrols, before anything.*
 *
 * ⚠ This docblock claimed BOTH remaining bands "stay prose in the Program
 * because a clock and a blocking-ness judgement are not labels" — half of that
 * is no longer true, and it was the half that rotted next. BAND 3 IS DERIVED
 * TOO as of #505: `scripts/patrol-clocks.mts` reads each patrol log's own
 * `**Clock:**` line and newest run heading and says which seats are overdue.
 * The Retro sat nine days past a weekly clock while this sentence explained why
 * nothing could compute it. Band 2 (blocks every merge) really is a judgement
 * and stays prose.
 *
 * # It reports rather than decides
 *
 * A shift still chooses its brief under the anti-randomness rule. This answers
 * two questions — *what has he ordered* and *what is in the urgent band right
 * now* — and answers both from the artifact rather than from a paragraph that
 * was true last week.
 *
 *     npx tsx scripts/queue-standing-exceptions.mts
 *
 * Needs `gh` authenticated; it reads nothing else and writes nothing at all.
 * The rendering lives in `scripts/lib/standingExceptions.mts` so both the empty
 * and the populated state can be driven (`server/standingExceptions.test.ts`).
 */
import { execFileSync } from "node:child_process";

import { renderBands, type Row } from "./lib/standingExceptions.mts";

function readBand(label: string): Row[] {
  const raw = execFileSync(
    "gh",
    [
      "issue",
      "list",
      "--state",
      "open",
      "--label",
      label,
      "--limit",
      "200",
      "--json",
      "number,title,createdAt,labels",
    ],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  return JSON.parse(raw) as Row[];
}

function main(): number {
  let ordered: Row[];
  let urgent: Row[];
  try {
    /*
      REFUSE RATHER THAN PRINT AN EMPTY RANKING. A ranking that comes up empty
      because `gh` is unauthenticated reads exactly like a ranking that is
      genuinely empty, and the second one means "nothing urgent, work a patrol".
      That is the collector class CLAUDE.md's Atlas section names: a reader that
      can come up empty THROWS rather than returning a short list. It matters
      MORE on the ordered band than it ever did on the urgent one — an empty
      ordered band tells a shift he has asked for nothing, which is precisely
      the harm his 2026-08-30 clause was written about.
    */
    ordered = readBand("founder-ordered");
    urgent = readBand("urgent");
  } catch (error) {
    console.error(
      "queue-standing-exceptions: could not read the queue — is `gh` authenticated?",
    );
    console.error(String(error instanceof Error ? error.message : error));
    return 1;
  }

  for (const line of renderBands({ ordered, urgent, now: new Date() })) {
    console.log(line);
  }
  return 0;
}

process.exit(main());
