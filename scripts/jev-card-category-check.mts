/**
 * #1224 STAGE 1 — DOES JEV READ A CARD'S CATEGORY? A CHECK, NEVER A WRITE.
 *
 * `--controls`  run the fixture controls and print the threshold they justify.
 * `--live`      read every open card, print Jev's answer beside its real label.
 * `--json <p>`  also write the full per-card record to a file for the report.
 *
 * It calls `gh` (read-only) and Jev (text only). It never labels, comments on,
 * closes or edits anything, and there is no flag that makes it — that is still
 * true of THIS script and is the reason it can be run at any time.
 *
 * ⚠ **Stage 2 now exists: `scripts/jev-card-category-file.mts`.** It is a
 * separate entrypoint on purpose, so the check can never grow a write flag by
 * accident, and it was gated on the controls below having run and been read.
 * They have (2026-09-25), and the gate it writes at came from the LIVE read
 * rather than from the floor this script prints — see
 * `CARD_CATEGORY_WRITE_THRESHOLD`, which carries the measurement.
 *
 * ⚠ **THE CONTROLS RUN FIRST AND THEIR RESULT IS PRINTED ABOVE THE LIVE READ**
 * (working law 2). A live agreement figure with no controls beside it is the
 * shape this project has been bitten by repeatedly: a number that cannot be
 * wrong, because nothing ever asked whether the instrument could fail.
 *
 * Spend: text only, and stated at the end of every run from the tokens the API
 * reports rather than from a list price. A whole queue is a fraction of a cent.
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

import { homeWorkCategoryFor, type CrewWorkCategoryKey } from "../shared/crewWorkSwitches.js";
import { askJev, jevSpendUsd } from "./lib/jev.mjs";
import {
  CARD_CATEGORY_QUESTION_ID,
  NO_CATEGORY,
  bodyNamesItsOwnCategory,
  buildCardState,
  categoryQuestion,
  type CardForReading,
} from "./lib/jevCardCategory.mjs";

type Reading = {
  number: number;
  title: string;
  labels: string[];
  actual: CrewWorkCategoryKey | null;
  read: string;
  confidence: number;
  probabilities: Record<string, number>;
  agrees: boolean | null;
  selfNaming: boolean;
};

let inputTokensSpent = 0;

async function readCard(
  card: CardForReading,
): Promise<{ read: string; confidence: number; probabilities: Record<string, number> }> {
  const reply = await askJev(buildCardState(card), categoryQuestion());
  inputTokensSpent += reply.usage.input_tokens;
  const answer = reply.answers[CARD_CATEGORY_QUESTION_ID]!;
  return { read: answer.choice, confidence: answer.confidence, probabilities: { ...answer.probabilities } };
}

/** A small pool: the queue is ~50 cards and the API answers in ~300 ms. */
async function mapPooled<T, R>(items: readonly T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      for (;;) {
        const index = next++;
        if (index >= items.length) return;
        out[index] = await fn(items[index]!);
      }
    }),
  );
  return out;
}

/* ── THE CONTROLS ──────────────────────────────────────────────────────────
   POSITIVE: one unmistakable card per category. A person would file each of
   these without hesitating, so a reader that cannot is not usable at any
   threshold. NEGATIVE: cards that are NOT a work category at all — the reader
   must decline them rather than reaching for the nearest label. No fixture
   quotes a category name, so nothing here is answered by keyword. */
const POSITIVE_CONTROLS: ReadonlyArray<{ expect: CrewWorkCategoryKey; card: CardForReading }> = [
  {
    expect: "bugs",
    card: {
      number: 0,
      title: "The price on the checkout button shows the old amount after a plan change",
      body: "A customer changes plan and the button still reads the previous price until they reload the page. Reported twice this week. The amount actually charged is correct; the number on screen is stale.",
    },
  },
  {
    expect: "security",
    card: {
      number: 0,
      title: "A signed-out visitor can open another account's saved board by guessing the address",
      body: "The board page loads its contents without checking who is asking. Anyone holding or guessing the link sees someone else's work. The check must happen in the statement that reads the rows, not afterwards.",
    },
  },
  {
    expect: "performance",
    card: {
      number: 0,
      title: "The gallery takes 4.2 seconds to open and 3.1 of them are one query",
      body: "Measured on the live service: the page waits on a single lookup that fetches every row before showing the first twelve. Target is under a second. A before and after number goes on the card.",
    },
  },
  {
    expect: "housekeeping",
    card: {
      number: 0,
      title: "Four export helpers nothing has called since February are still in the tree",
      body: "Left behind when the old export screen was removed. Nothing imports them, no test names them, and they add nothing. Delete them and the two fixtures that only existed to cover them. No behaviour changes.",
    },
  },
  {
    expect: "process",
    card: {
      number: 0,
      title: "The nightly check reports green when it did not actually run",
      body: "When the runner cannot start, the summary still prints a pass, so nobody notices the night was skipped. The team's own reporting is what is wrong here, not anything a customer touches.",
    },
  },
  {
    expect: "smallFixes",
    card: {
      number: 0,
      title: "The empty-state line reads differently from every other screen",
      body: "One string, one file. Nothing is broken; it simply does not match the wording its neighbours use, and should.",
    },
  },
  {
    expect: "castingUpkeep",
    card: {
      number: 0,
      title: "Refresh the studio's stock wording so it matches how the engine is asked today",
      body: "The instruction the studio sends still carries phrasing from an older arrangement. Nothing is broken and nobody has reported anything; the wording is simply out of step with how that part of the studio is written now. Ordinary upkeep of that road, inside behaviour that already exists.",
    },
  },
];

const NEGATIVE_CONTROLS: ReadonlyArray<{ card: CardForReading; why: string }> = [
  {
    why: "not team work at all",
    card: {
      number: 0,
      title: "Where should we go for the launch dinner in March?",
      body: "Somewhere that can seat twelve and takes a booking. Someone needs to pick a place and send the address around.",
    },
  },
  {
    why: "a brand-new product area, which is nobody's maintenance category",
    card: {
      number: 0,
      title: "Build a whole new video editing suite with timeline, transitions and audio mixing",
      body: "A large new product area that does not exist today, needing its own design, its own surfaces and its own pricing. This is a milestone, not maintenance.",
    },
  },
];

async function runControls(): Promise<{ threshold: number; passed: boolean }> {
  console.log("CONTROLS — working law 2: the instrument is verified before its verdicts count\n");

  const positives = await mapPooled(POSITIVE_CONTROLS, 4, async (entry) => {
    const result = await readCard(entry.card);
    return { ...entry, ...result, ok: result.read === entry.expect };
  });

  console.log("  POSITIVE — an unmistakable card per category; the reader must name it");
  for (const row of positives) {
    console.log(
      `    ${row.ok ? "OK  " : "MISS"}  expected ${row.expect.padEnd(14)} read ${row.read.padEnd(14)} conf ${row.confidence.toFixed(2)}`,
    );
  }
  const positiveHits = positives.filter((row) => row.ok).length;
  console.log(`    ${positiveHits}/${positives.length} named correctly\n`);

  const negatives = await mapPooled(NEGATIVE_CONTROLS, 4, async (entry) => {
    const result = await readCard(entry.card);
    return { ...entry, ...result, ok: result.read === NO_CATEGORY };
  });

  console.log("  NEGATIVE — cards that are NOT a work category; the reader must decline");
  for (const row of negatives) {
    console.log(
      `    ${row.ok ? "OK  " : "MISS"}  ${row.why.padEnd(58)} read ${row.read.padEnd(14)} conf ${row.confidence.toFixed(2)}`,
    );
  }
  const negativeHits = negatives.filter((row) => row.ok).length;
  console.log(`    ${negativeHits}/${negatives.length} declined\n`);

  /* THE THRESHOLD IS SET BY THE CONTROLS, NOT PICKED. It is the lowest
     confidence at which the reader was still RIGHT on a control — below that
     figure this reader has never been shown to be reliable, so nothing below
     it may become a note on his page. A miss ABOVE that figure is reported
     loudly, because a confident miss is the one failure a threshold cannot
     protect against. */
  const rightConfidences = [
    ...positives.filter((row) => row.ok).map((row) => row.confidence),
    ...negatives.filter((row) => row.ok).map((row) => row.confidence),
  ];
  const wrongConfidences = [
    ...positives.filter((row) => !row.ok).map((row) => row.confidence),
    ...negatives.filter((row) => !row.ok).map((row) => row.confidence),
  ];
  const lowestRight = rightConfidences.length > 0 ? Math.min(...rightConfidences) : 1;
  const highestWrong = wrongConfidences.length > 0 ? Math.max(...wrongConfidences) : 0;
  const threshold = Math.max(lowestRight, highestWrong > 0 ? highestWrong + 0.01 : 0);

  console.log(`  lowest confidence on a CORRECT control : ${lowestRight.toFixed(2)}`);
  console.log(`  highest confidence on a WRONG control  : ${highestWrong > 0 ? highestWrong.toFixed(2) : "none wrong"}`);
  console.log(`  THRESHOLD the controls justify         : ${threshold.toFixed(2)}`);
  if (highestWrong === 0) {
    /* ⚠ The honest reading of a clean control sweep, and it is easy to get
       backwards. With NOTHING wrong, the controls have not located the point
       where this reader starts being unreliable — they have only shown it was
       right everywhere they looked. "Lowest correct" is therefore a FLOOR, not
       a calibration, and a number printed without this sentence beside it reads
       as the opposite. A usable threshold comes from the live read's own
       agreement bands, where there are disagreements to learn from. */
    console.log("  ⚠ no control was WRONG, so the controls did not find where this reader fails.");
    console.log("    The figure above is a FLOOR, not a calibration — read the live bands before acting on it.");
  }
  const passed = positiveHits === positives.length && negativeHits === negatives.length;
  console.log(
    `  VERDICT: ${passed ? "controls PASS" : "controls INCOMPLETE — every miss above is read at its fixture before any verdict counts"}\n`,
  );
  return { threshold, passed };
}

async function runLive(threshold: number, jsonPath: string | null): Promise<void> {
  const raw = execFileSync(
    "gh",
    ["issue", "list", "--state", "open", "--limit", "200", "--json", "number,title,body,labels"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const issues = JSON.parse(raw) as Array<{
    number: number;
    title: string;
    body: string;
    labels: Array<{ name: string }>;
  }>;
  console.log(`LIVE READ — ${issues.length} open cards\n`);

  const readings: Reading[] = await mapPooled(issues, 4, async (issue) => {
    const card: CardForReading = { number: issue.number, title: issue.title, body: issue.body ?? "" };
    const labels = issue.labels.map((label) => label.name);
    const actual = homeWorkCategoryFor(labels);
    const result = await readCard(card);
    return {
      number: issue.number,
      title: issue.title,
      labels,
      actual,
      read: result.read,
      confidence: result.confidence,
      probabilities: result.probabilities,
      agrees: actual === null ? null : result.read === actual,
      selfNaming: bodyNamesItsOwnCategory(card, actual),
    };
  });

  const labelled = readings.filter((row) => row.actual !== null);
  const unlabelled = readings.filter((row) => row.actual === null);
  const agree = labelled.filter((row) => row.agrees === true);
  const disagree = labelled.filter((row) => row.agrees === false);
  const confidentDisagree = disagree.filter((row) => row.confidence >= threshold);

  console.log(`  cards with a work label   : ${labelled.length}`);
  console.log(`  cards with none           : ${unlabelled.length}  (stage 2's whole population)`);
  console.log(
    `  agreement                 : ${agree.length}/${labelled.length}` +
      (labelled.length > 0 ? ` (${Math.round((agree.length / labelled.length) * 100)}%)` : ""),
  );
  console.log(
    `  disagreements             : ${disagree.length}, of which ${confidentDisagree.length} at or above the threshold\n`,
  );

  const selfNaming = labelled.filter((row) => row.selfNaming);
  console.log(
    `  ⚠ stated limit: ${selfNaming.length}/${labelled.length} labelled cards name their own category somewhere in their own text,`,
  );
  console.log("    so that much of the agreement figure could be the card telling the reader the answer.\n");

  if (disagree.length > 0) {
    console.log("  EVERY DISAGREEMENT — each read at the card (is Jev wrong, or was the label?)\n");
    for (const row of [...disagree].sort((a, b) => b.confidence - a.confidence)) {
      console.log(
        `    #${row.number}  labelled ${String(row.actual).padEnd(14)} reads ${row.read.padEnd(14)} conf ${row.confidence.toFixed(2)}`,
      );
      console.log(`       ${row.title.slice(0, 110)}`);
    }
    console.log("");
  }

  if (unlabelled.length > 0) {
    console.log("  UNLABELLED — what stage 2 would file, if and only if it is above the threshold\n");
    for (const row of [...unlabelled].sort((a, b) => b.confidence - a.confidence)) {
      const verdict =
        row.read === NO_CATEGORY ? "declines" : row.confidence >= threshold ? "would file" : "below threshold";
      console.log(`    #${row.number}  reads ${row.read.padEnd(14)} conf ${row.confidence.toFixed(2)}  ${verdict}`);
    }
    console.log("");
  }

  if (jsonPath) {
    writeFileSync(jsonPath, JSON.stringify({ threshold, readings }, null, 2), "utf8");
    console.log(`  record written: ${jsonPath}\n`);
  }
}

const args = process.argv.slice(2);
const wantLive = args.includes("--live");
const wantControls = args.includes("--controls") || !wantLive;
const jsonIndex = args.indexOf("--json");
const jsonPath = jsonIndex >= 0 ? (args[jsonIndex + 1] ?? null) : null;

let threshold = 1;
if (wantControls) {
  const result = await runControls();
  threshold = result.threshold;
  if (!result.passed && wantLive) {
    console.log("⚠ The controls did not fully pass. The live read below is printed for READING, not for acting on.\n");
  }
}
if (wantLive) await runLive(threshold, jsonPath);

console.log(
  `SPEND — ${inputTokensSpent.toLocaleString()} input tokens = $${jevSpendUsd(inputTokensSpent).toFixed(4)} (output is free)`,
);
process.exit(0);
