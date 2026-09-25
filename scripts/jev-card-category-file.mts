/**
 * #1224 STAGE 2 — THE WRITER. It files a work label on a card that arrived
 * with NONE, and it does nothing else.
 *
 *   (no flag)   report only: what it would file, what it refuses, and why.
 *   --apply     actually add the labels and comment on each card filed.
 *   --threshold <n>  override the gate (for a calibration read; states itself).
 *
 * # WHAT IT CANNOT DO, BY CONSTRUCTION RATHER THAN BY PROMISE
 *
 * ⚠ **It never removes a label and never touches a card that already carries
 * one of the seven.** Moving a card between switches changes which shift takes
 * it and where it appears on his page — a judgement about work. Filling a
 * blank is not that: it is reversible by deleting one label, and the comment
 * it leaves says so. `decideCardFiling` refuses an already-filed card before
 * it looks at anything else, and that refusal is driven directly in
 * `server/jevCardCategory.test.ts` rather than through Jev (working law 3).
 *
 * It also never touches a `rung:*` or a road. That is his scope decision under
 * the milestone gate, and the card says so in his own terms.
 *
 * # WHY THE DEFAULT IS A REPORT
 *
 * His ruling on Jev names the shape every use takes: *a CHECK before a WRITE*.
 * A run with no flag reads the queue and prints its verdicts, so the population
 * can be looked at before anything is applied. `--apply` is the second act.
 *
 * Spend: text only, priced from the tokens the API reports. A whole queue is a
 * fraction of a cent. No customer credits, no images, nothing on a money path.
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";

import { CREW_WORK_CATEGORIES } from "../shared/crewWorkSwitches.js";
import { askJev, jevSpendUsd } from "./lib/jev.mjs";
import {
  CARD_CATEGORY_QUESTION_ID,
  CARD_CATEGORY_WRITE_THRESHOLD,
  assertApplyThreshold,
  assertQueueLabelsExist,
  buildCardState,
  categoryQuestion,
  decideCardFiling,
  filingComment,
  type CardForReading,
  type FilingDecision,
} from "./lib/jevCardCategory.mjs";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const thresholdIndex = args.indexOf("--threshold");
const threshold =
  thresholdIndex >= 0 ? Number(args[thresholdIndex + 1]) : CARD_CATEGORY_WRITE_THRESHOLD;

if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
  console.error(`jev-card-category-file: --threshold must be between 0 and 1, got "${args[thresholdIndex + 1]}"`);
  process.exit(1);
}

assertApplyThreshold(apply, threshold);

function gh(argv: readonly string[]): string {
  return execFileSync("gh", [...argv], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

/* THE LABELS COME FIRST, BEFORE A SINGLE CARD IS READ. A run that discovers a
   missing label halfway through has already filed some cards and not others,
   and nothing records which. */
const repoLabels = (JSON.parse(gh(["label", "list", "--limit", "300", "--json", "name"])) as Array<{ name: string }>)
  .map((label) => label.name);
assertQueueLabelsExist(repoLabels);

const issues = JSON.parse(
  gh(["issue", "list", "--state", "open", "--limit", "200", "--json", "number,title,body,labels"]),
) as Array<{ number: number; title: string; body: string; labels: Array<{ name: string }> }>;

const workLabels = new Set<string>(CREW_WORK_CATEGORIES.map((category) => category.queueLabel));
const unfiled = issues.filter((issue) => !issue.labels.some((label) => workLabels.has(label.name)));

console.log(`THE WRITER — ${apply ? "APPLY" : "report only"} · gate ${threshold.toFixed(2)}`);
console.log(`  ${issues.length} open cards, ${unfiled.length} with no work label\n`);

if (unfiled.length === 0) {
  console.log("  Nothing to file. Every open card already carries a work label.\n");
  console.log("SPEND — 0 input tokens = $0.0000");
  process.exit(0);
}

let inputTokens = 0;

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

type Verdict = {
  number: number;
  title: string;
  choice: string;
  confidence: number;
  decision: FilingDecision;
};

const verdicts: Verdict[] = await mapPooled(unfiled, 4, async (issue) => {
  const card: CardForReading = { number: issue.number, title: issue.title, body: issue.body ?? "" };
  const reply = await askJev(buildCardState(card), categoryQuestion());
  inputTokens += reply.usage.input_tokens;
  const answer = reply.answers[CARD_CATEGORY_QUESTION_ID]!;
  return {
    number: issue.number,
    title: issue.title,
    choice: answer.choice,
    confidence: answer.confidence,
    decision: decideCardFiling({
      labels: issue.labels.map((label) => label.name),
      choice: answer.choice,
      confidence: answer.confidence,
      threshold,
    }),
  };
});

const toFile = verdicts.filter((verdict) => verdict.decision.act === "file");
const refused = verdicts.filter((verdict) => verdict.decision.act === "skip");

console.log(`  WOULD FILE — ${toFile.length}\n`);
for (const verdict of [...toFile].sort((a, b) => b.confidence - a.confidence)) {
  const decision = verdict.decision as Extract<FilingDecision, { act: "file" }>;
  console.log(
    `    #${verdict.number}  ${decision.queueLabel.padEnd(16)} conf ${verdict.confidence.toFixed(2)}  ${verdict.title.slice(0, 72)}`,
  );
}
console.log("");

console.log(`  LEFT ALONE — ${refused.length}, each with the reason it was left\n`);
for (const verdict of [...refused].sort((a, b) => b.confidence - a.confidence)) {
  const decision = verdict.decision as Extract<FilingDecision, { act: "skip" }>;
  console.log(
    `    #${verdict.number}  ${decision.reason.padEnd(18)} ${decision.detail.padEnd(22)} reads ${verdict.choice.slice(0, 14)}`,
  );
}
console.log("");

if (!apply) {
  console.log("  Report only — nothing was written. Re-run with --apply to file the list above.\n");
} else {
  for (const verdict of toFile) {
    const decision = verdict.decision as Extract<FilingDecision, { act: "file" }>;
    /* The label FIRST, then the comment. A label with no comment is an
       unexplained but correct filing; a comment with no label is a claim about
       something that did not happen. */
    gh(["issue", "edit", String(verdict.number), "--add-label", decision.queueLabel]);
    gh([
      "issue",
      "comment",
      String(verdict.number),
      "--body",
      filingComment(decision.category, verdict.confidence),
    ]);
    console.log(`    FILED  #${verdict.number} -> ${decision.queueLabel}`);
  }
  console.log(`\n  ${toFile.length} card(s) filed. Nothing was moved off any card.\n`);
}

console.log(`SPEND — ${inputTokens.toLocaleString()} input tokens = $${jevSpendUsd(inputTokens).toFixed(4)} (output is free)`);
process.exit(0);
