/**
 * THE CONTROLS FOR THE BATCH CUTTER'S TIE-BREAKER (#1281), and they run BEFORE
 * its verdicts count for anything (working law 2).
 *
 *     npx tsx scripts/jev-seat-batching-check.mts
 *
 * The cutter asks Jev two fixed-answer questions, and only where the mechanical
 * reading is genuinely silent:
 *
 *   1. does this card BUILD ON another open card it names?
 *   2. which product AREA does its work land in?
 *
 * A labelled set with known answers, positive and negative, for each. It spends
 * a fraction of a cent of text calls and never a credit. It writes nothing.
 *
 * ⚠ **WHAT A GREEN RUN HERE DOES AND DOES NOT ESTABLISH.** With no control
 * WRONG, a fixture sweep shows only that the reader was right everywhere it was
 * looked at; its "lowest correct" figure is a FLOOR and it moves between runs
 * (measured on the sibling reader: 0.47 / 0.52 / 0.58 / 0.64 over four runs of
 * identical fixtures). So this run does not SET the gate. What it establishes is
 * narrower and is the thing that matters: the reader can say yes, it can say no,
 * and it says them on the cases this product actually meets.
 *
 * The gate itself is `SEAT_BATCHING_CONFIDENCE_GATE`, borrowed from the category
 * reader's own live calibration and declared as borrowed in its docblock. Below
 * it, nothing happens that would not have happened without Jev at all — a card
 * with no area goes to the smallest batch and an unclear ordered card is held —
 * which is what makes borrowing safe rather than convenient.
 */
import {
  areaQuestion,
  areaVerdict,
  buildSeatCardState,
  dependencyQuestion,
  dependencyVerdict,
  DEPENDENCY_NO,
  DEPENDENCY_YES,
  AREA_QUESTION_ID,
  DEPENDENCY_QUESTION_ID,
  NO_AREA,
  SEAT_BATCHING_CONFIDENCE_GATE,
  type SeatCardForReading,
} from "./lib/jevSeatBatching.mts";
import { askJev, jevSpendUsd } from "./lib/jev.mjs";
import { buildAreaIndex } from "./lib/seatBatches.mts";
import { readFileSync } from "node:fs";

await import("dotenv/config");

const atlas = JSON.parse(readFileSync("docs/architecture/drape-architecture.json", "utf8")) as {
  modules: readonly { path?: string | null; domain?: string | null }[];
};
const DOMAINS = buildAreaIndex(atlas.modules).domains;

let inputTokens = 0;

async function askDependency(card: SeatCardForReading) {
  const reply = await askJev(buildSeatCardState(card), dependencyQuestion());
  inputTokens += reply.usage.input_tokens;
  return reply.answers[DEPENDENCY_QUESTION_ID]!;
}

async function askArea(card: SeatCardForReading) {
  const reply = await askJev(buildSeatCardState(card), areaQuestion(DOMAINS));
  inputTokens += reply.usage.input_tokens;
  return reply.answers[AREA_QUESTION_ID]!;
}

/* ── THE DEPENDENCY CONTROLS ────────────────────────────────────────────────
   Every body below is the shape a real card in this repository takes: the
   POSITIVE ones say plainly that they sit on another card, the NEGATIVE ones
   cite one as a precedent or a sibling fault, which is what most bodies do. */

const DEPENDENCY_CONTROLS: ReadonlyArray<{ expect: string; why: string; card: SeatCardForReading }> = [
  {
    expect: DEPENDENCY_YES,
    why: "part two of another card, said outright",
    card: {
      number: 0,
      title: "The signed view sends the roll's own house sentences (part 2)",
      body: "This is part 2 of #1278. Part 1 lands the brief on the view; this card moves the realism block. It cannot start until part 1 is merged, because both touch the same composer.",
      cites: [1278],
    },
  },
  {
    expect: DEPENDENCY_YES,
    why: "stacks on an open pull request's branch",
    card: {
      number: 0,
      title: "The review triage drops its size trigger",
      body: "Stacks on #1325. The branch there adds the triage reader this card changes, so it waits for that to merge and then replays off main.",
      cites: [1325],
    },
  },
  {
    expect: DEPENDENCY_YES,
    why: "waits for a reader another card is building",
    card: {
      number: 0,
      title: "The desk shows what is already being built",
      body: "Waits on #1094, which owns the build-state reader. Until that reader exists there is nothing for this card's row to draw.",
      cites: [1094],
    },
  },
  {
    expect: DEPENDENCY_NO,
    why: "cites a card as a PRECEDENT, which is what most bodies do",
    card: {
      number: 0,
      title: "The heartbeat stamps its own row",
      body: "The same class as #1234, which removed the guess from the close and left it in the heartbeat. This card fixes the heartbeat; nothing about #1234 is unfinished, and the work here is one statement in one file.",
      cites: [1234],
    },
  },
  {
    expect: DEPENDENCY_NO,
    why: "names a sibling fault found by the same sweep",
    card: {
      number: 0,
      title: "The garment cutout keeps a halo on a dark ground",
      body: "Found by the same sweep as #402, which is the caption wording. Two unrelated faults in one feature; either can be fixed today without the other.",
      cites: [402],
    },
  },
  {
    expect: DEPENDENCY_NO,
    why: "quotes a card for its RULING and needs nothing from it",
    card: {
      number: 0,
      title: "The loader names the stage rather than the engine",
      body: "His ruling on #55 is the standard this follows. The change is one string in one component.",
      cites: [55],
    },
  },
];

/* ── THE AREA CONTROLS ─────────────────────────────────────────────────────── */

const AREA_CONTROLS: ReadonlyArray<{ expect: string; why: string; card: SeatCardForReading }> = [
  {
    expect: "casting",
    why: "unmistakably the casting road, named in the customer's words",
    card: {
      number: 0,
      title: "A roll's candidate tile stays casting after the picture arrives",
      body: "When a roll finishes, one of the eight tiles keeps its casting shimmer even though the picture is there. Refreshing fixes it.",
      cites: [],
    },
  },
  {
    expect: "boards",
    why: "the infinite canvas",
    card: {
      number: 0,
      title: "Dragging an item off the edge of a board loses it",
      body: "On the infinite canvas, dragging an item past the left edge puts it somewhere the viewport can never reach again.",
      cites: [],
    },
  },
  {
    expect: "billing",
    why: "plans, invoices and checkout",
    card: {
      number: 0,
      title: "The plan-change preview quotes last month's price",
      body: "Changing plan shows a preview whose total is the previous price. The invoice that arrives is correct, so it is the preview that is wrong.",
      cites: [],
    },
  },
  {
    expect: "wardrobe",
    why: "garments and try-on",
    card: {
      number: 0,
      title: "A digitised garment keeps a pale halo where the background was",
      body: "Uploading a jacket on a light ground leaves a faint outline around the shoulders when it is worn.",
      cites: [],
    },
  },
  {
    expect: NO_AREA,
    why: "NEGATIVE - a card that names no part of the product at all",
    card: {
      number: 0,
      title: "Tidy the leftover backup files the sweep wrote",
      body: "There are backup copies from an old rename sweep sitting in the repository. Delete the ones nothing reads. No behaviour changes anywhere.",
      cites: [],
    },
  },
  {
    expect: NO_AREA,
    why: "NEGATIVE - a card that spans the whole product",
    card: {
      number: 0,
      title: "Every surface should read correctly in both themes",
      body: "A sweep across the entire application, every page and every panel, checking both light and dark. It is not about one part of it.",
      cites: [],
    },
  },
];

async function main(): Promise<number> {
  console.log("CONTROLS for the seat-batching tie-breaker (#1281)");
  console.log(`  gate: ${SEAT_BATCHING_CONFIDENCE_GATE}   domains offered: ${DOMAINS.length}\n`);

  let misses = 0;
  let lowestCorrect = 1;

  console.log("  DEPENDENCY - does this card build on another open card it names?");
  for (const control of DEPENDENCY_CONTROLS) {
    const answer = await askDependency(control.card);
    const verdict = dependencyVerdict(answer);
    const read = answer.choice;
    const ok = read === control.expect;
    if (!ok) misses += 1;
    if (ok && answer.confidence < lowestCorrect) lowestCorrect = answer.confidence;
    console.log(
      `    ${ok ? "OK  " : "MISS"}  want ${control.expect.padEnd(3)} read ${read.padEnd(3)} conf ${answer.confidence.toFixed(2)}`
      + `  ->  ${verdict.kind.padEnd(11)}  ${control.why}`,
    );
  }

  console.log("\n  AREA - which part of the product does the work land in?");
  for (const control of AREA_CONTROLS) {
    const answer = await askArea(control.card);
    const verdict = areaVerdict(answer, DOMAINS);
    const ok = answer.choice === control.expect;
    if (!ok) misses += 1;
    if (ok && answer.confidence < lowestCorrect) lowestCorrect = answer.confidence;
    console.log(
      `    ${ok ? "OK  " : "MISS"}  want ${control.expect.padEnd(13)} read ${answer.choice.padEnd(13)} conf ${answer.confidence.toFixed(2)}`
      + `  ->  area ${String(verdict.area).padEnd(13)}  ${control.why}`,
    );
  }

  const total = DEPENDENCY_CONTROLS.length + AREA_CONTROLS.length;
  console.log(`\n  ${total - misses}/${total} read correctly; lowest CORRECT confidence ${lowestCorrect.toFixed(2)}`);
  console.log(`  spend: $${jevSpendUsd(inputTokens).toFixed(4)} (${inputTokens} input tokens, output free)`);
  if (misses > 0) {
    console.log("\n  ⚠ Every MISS above is read at its fixture by hand before any verdict counts. A confident");
    console.log("    miss is the one failure a threshold cannot protect against; a miss below the gate costs");
    console.log("    nothing, because the cutter then does what it would have done without Jev at all.");
  }
  console.log(`\n  VERDICT: ${misses === 0 ? "the reader can say yes and no on this product's own cases" : `${misses} miss(es) to read`}`);
  return misses;
}

/* ⚠ THE EXIT CODE CARRIES THE VERDICT (review of 2026-09-26). It exited 0 with
   misses on the board, so nothing that RUNS this — a preflight, a shift, anything
   that checks the reader before trusting it — could tell a clean run from a dirty
   one. Working law 2 is that controls run before verdicts count, and a control
   whose result only a human reader can see is not one. */
const misses = await main();
if (misses > 0) process.exit(1);

/*
  AND THE LAST STATEMENT ENDS THE PROCESS (`server/scriptExitDiscipline.test.ts`).
  This one holds a fetch agent open after the last reply, so falling off the end
  keeps the process alive for its keep-alive timeout.
*/
process.exit(0);
