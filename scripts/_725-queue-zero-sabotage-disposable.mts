/**
 * DISPOSABLE — the sabotage receipt for #725's repair of `countOpen`'s
 * empty-read road (`scripts/lib/crewQueueCount.mts`).
 *
 * Working law 2: a new guard gets a negative and a positive control before its
 * verdicts count for anything. Each sabotage patches the real PRODUCT file,
 * runs `server/crewQueueCountEmptyRead.test.ts`, records which arms went red,
 * and RESTORES THE FILE IN A `finally`.
 *
 * Shape and runner taken from `scripts/_697-adminsecurity-sabotage-disposable.mts`,
 * including its two habits that have caught a lying driver before:
 *   · ARM 0 is a NO-OP sabotage — it must redden NOTHING.
 *   · Every arm asserts the reddened set EXACTLY, never "at least".
 *
 * ⚠ **THERE IS NO `--before` FLAG HERE, AND THE REASON IS THE DIFFERENCE FROM
 * #697.** There the product was unchanged and the SUITE was rewritten, so the
 * before-measurement needed the old suite checked out. Here the product itself
 * is the repair, so the pre-repair state IS a sabotage — ARM 1 removes the
 * refusal entirely and reproduces the code exactly as it stood when production
 * stored a fresh zero over eight open cards. Its reddened set is the negative
 * control, taken in the same run as everything else.
 *
 * Run: npx tsx scripts/_725-queue-zero-sabotage-disposable.mts
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SUITE = "server/crewQueueCountEmptyRead.test.ts";
const OUT = path.join(ROOT, "_725-sabotage-result.json");
const LIB = "scripts/lib/crewQueueCount.mts";

/** Arm titles, named once so a rename cannot leave a prediction pointing at nothing. */
const A_REFUSES_DISAGREEMENT = "⚠ REFUSES the zero when the run's own whole-queue read holds cards with that label";
const A_OTHERS_STILL_WRITTEN = "⚠ POSITIVE CONTROL — the untouched categories in that same run are still written";
const A_EMPTY_STILL_ZERO = "⚠ POSITIVE CONTROL — a genuinely empty category still stores 0";
const A_UNCHECKABLE = "⚠ refuses an empty read it CANNOT check — an unverified zero is the one that parks the team";
const A_EXCLUDED_ZERO = "⚠ and a category whose cards are all EXCLUDED still stores 0 — `offered` is not an empty read";
const A_ONE_READ = "asks `gh` for the whole open queue exactly once, however many categories refuse";
const A_EVERY_CATEGORY = "⚠ every switch category is covered by the cross-check, derived rather than listed";
const A_SIBLING_REFUSES = "⚠ REFUSES an empty queue read while this run's own oldest-card read found a card";
const A_SIBLING_CONTROL = "⚠ POSITIVE CONTROL — a queue that really has rows still writes every group";
const A_DRIFT_NAMED = "⚠ NAMES a label whose cards PREDATE the whole-queue read — a rename cannot hide";
const A_DRIFT_SKEW = "⚠ CONTROL — a card filed DURING the run is skew, and says nothing at all";
const A_DRIFT_ORDINARY = "⚠ CONTROL — an ordinary agreeing run says nothing either";

type Sabotage = { name: string; file: string; find: string; replace: string; expect: string[] };

const SABOTAGES: Sabotage[] = [
  {
    name: "ARM 0 — NO-OP CONTROL (a comment only; must redden nothing)",
    file: LIB,
    find: "function countPipelineGroups(gh: QueueGhReader",
    replace: "/* sabotage no-op */ function countPipelineGroups(gh: QueueGhReader",
    expect: [],
  },
  {
    /* ⚠ THE NEGATIVE CONTROL, AND IT IS THE PRODUCTION CODE OF 2026-09-09.
       Deleting this block restores `countOpen` exactly as it stood when a fresh
       zero was stored over eight open `seat:retro` cards. Every arm that
       reddens here is an arm that would have caught the incident. */
    name: "THE REFUSAL GOES ENTIRELY — the pre-repair code, reproduced",
    file: LIB,
    find: "      const carried = population === null ? null : population.get(label) ?? 0;",
    replace: "      const carried = -1 as number | null;",
    expect: [A_REFUSES_DISAGREEMENT, A_OTHERS_STILL_WRITTEN, A_UNCHECKABLE, A_EVERY_CATEGORY].sort(),
  },
  {
    name: "THE DISAGREEMENT IS IGNORED — a zero contradicted by the queue is written anyway",
    file: LIB,
    find: "      if (carried > 0) {",
    replace: "      if (false) {",
    /* Not the unchecked road: `carried === null` still refuses, so the
       cannot-check arm stays green and tells the two roads apart. */
    expect: [A_REFUSES_DISAGREEMENT, A_OTHERS_STILL_WRITTEN, A_EVERY_CATEGORY].sort(),
  },
  {
    name: "THE UNCHECKABLE ZERO IS BELIEVED — the witness never took the stand and the zero stands",
    file: LIB,
    find: "      if (carried === null) {",
    replace: "      if ((carried as unknown) === undefined) {",
    expect: [A_UNCHECKABLE],
  },
  {
    /* ⚠ A CONTROL IN THE OTHER DIRECTION — the failure mode of the repair
       itself. A counter that refuses EVERY zero passes all three refusal arms
       above and is a different wrong panel: `Security — 0 open` is a true and
       useful sentence today. */
    name: "THE COUNTER CAN NO LONGER SAY ZERO — every empty read refuses",
    file: LIB,
    find: "      if (carried > 0) {",
    replace: "      if (carried >= 0) {",
    /* ⚠ MY PREDICTION HERE WAS WRONG AND THE DRIVER CAUGHT IT — kept rather
       than edited away. I wrote `[A_EMPTY_STILL_ZERO]` alone, forgetting that
       the other-categories arm asserts `skipped === 1`: in its fixture five
       further categories are legitimately empty, so refusing every zero refuses
       six rows, not one. The product was right and my claim about it was not,
       which is the direction an exact-set driver exists to catch. */
    expect: [A_EMPTY_STILL_ZERO, A_OTHERS_STILL_WRITTEN].sort(),
  },
  {
    /* The evidence path itself: if the population stops being counted, every
       lookup answers 0 and every contradicted zero reads as confirmed. This is
       what proves the arms are driven by the cross-check rather than passing
       for some incidental reason. */
    name: "THE EVIDENCE STOPS BEING GATHERED — the label population is built from nothing",
    file: LIB,
    find: "      for (const name of row.labels) labelPopulation.set(name, (labelPopulation.get(name) ?? 0) + 1);",
    replace: "      for (const name of [] as string[]) labelPopulation.set(name, (labelPopulation.get(name) ?? 0) + 1);",
    /* ⚠ A FOURTH CORRECTION, AND IT IS THE TRIPWIRE ARRIVING: with the
       population emptied, every label looks renamed, so the ordinary-run
       control reddens too. The three below were right before that arm existed
       and are incomplete now rather than wrong. */
    expect: [A_REFUSES_DISAGREEMENT, A_OTHERS_STILL_WRITTEN, A_EVERY_CATEGORY, A_DRIFT_ORDINARY].sort(),
  },
  {
    /* ⚠ THE ORDERING, WHICH IS THE HALF A READER WOULD CALL COSMETIC. Reading
       the whole queue AFTER the categories leaves the population null at the
       moment every zero is judged — so the guard still "works", refuses
       everything it cannot check, and the disagreement arm can no longer tell
       the two refusals apart. */
    name: "THE EVIDENCE ARRIVES TOO LATE — the whole-queue read moves back below the loop",
    file: LIB,
    find: "  const pipeline = countPipelineGroups(gh, warn, oldestOpen !== null);\n\n  let written = 0;",
    replace: "  const pipeline: ReturnType<typeof countPipelineGroups> = null;\n\n  let written = 0;",
    /* ⚠ THE SECOND WRONG PREDICTION, AND IT TAUGHT ME SOMETHING ABOUT THE
       SUITE. I expected the all-excluded arm to redden and it did not — that
       category's read holds a real row, so it never enters the empty branch and
       no evidence is owed of it. `A_ONE_READ` reddens because this sabotage
       removes the call entirely, and the other-categories arm for the `skipped`
       reason above. Recorded, because a driver whose predictions are quietly
       corrected to match the run is a driver that can no longer be wrong. */
    /* ⚠ AND THIS SET GREW WHEN THE SIBLING'S ARMS WERE ADDED, which is the
       third correction on this driver and the least surprising: removing the
       whole-queue read removes the sibling's subject too, so both of its arms
       redden. Six is the honest number and the first four were never wrong,
       only incomplete. */
    expect: [
      A_REFUSES_DISAGREEMENT, A_EMPTY_STILL_ZERO, A_OTHERS_STILL_WRITTEN, A_ONE_READ,
      A_SIBLING_REFUSES, A_SIBLING_CONTROL,
      /* No population at all means no tripwire either — the drift arm cannot
         see what it is there to see. */
      A_DRIFT_NAMED,
    ].sort(),
  },
  {
    /* THE LAW-7 SIBLING — `countPipelineGroups`, whose docblock has named this
       exact failure since #325 while guarding only the shape. */
    name: "THE SIBLING'S REFUSAL GOES — an empty whole-queue read writes a zero into every group",
    file: LIB,
    find: "    if (rows.length === 0) {\n      warn(\n        \"REFUSING the pipeline groups:",
    replace: "    if (false) {\n      warn(\n        \"REFUSING the pipeline groups:",
    expect: [A_SIBLING_REFUSES],
  },
  {
    /* The sibling's own can-still-say-yes control: a guard that refuses every
       whole-queue read takes his entire pipeline off the panel. */
    name: "THE SIBLING REFUSES EVERYTHING — no whole-queue read is ever believed",
    file: LIB,
    find: "    if (rows.length === 0) {\n      warn(\n        \"REFUSING the pipeline groups:",
    replace: "    if (rows.length >= 0) {\n      warn(\n        \"REFUSING the pipeline groups:",
    expect: [A_SIBLING_CONTROL, A_REFUSES_DISAGREEMENT, A_OTHERS_STILL_WRITTEN, A_EMPTY_STILL_ZERO, A_DRIFT_NAMED].sort(),
  },
  {
    /* PR #729's review, finding 1 — the tripwire that catches the guard going
       inert. Removing it is the state the review found. */
    name: "THE TRIPWIRE GOES — a renamed label disarms the guard in silence",
    file: LIB,
    find: "      const predating = stamped.filter((row) => Number.isFinite(row.at) && row.at < populationReadAt);",
    replace: "      const predating = [] as typeof stamped;",
    expect: [A_DRIFT_NAMED],
  },
  {
    /* Its own control, in the other direction: a tripwire that fires on the
       benign skew case is one a shift learns to scroll past. */
    name: "THE TRIPWIRE STOPS TELLING SKEW APART — every disagreement is called drift",
    file: LIB,
    find: "      const predating = stamped.filter((row) => Number.isFinite(row.at) && row.at < populationReadAt);",
    replace: "      const predating = stamped;",
    expect: [A_DRIFT_SKEW],
  },
];

function runSuite(): { failed: string[]; total: number } {
  if (existsSync(OUT)) rmSync(OUT);
  try {
    execFileSync(
      "npx",
      ["vitest", "run", SUITE, "--reporter=json", `--outputFile=${OUT}`],
      { cwd: ROOT, stdio: "pipe", shell: true },
    );
  } catch {
    /* a red suite exits non-zero — that is the point; the JSON is what we read */
  }
  if (!existsSync(OUT)) throw new Error("vitest produced no JSON report");
  const report = JSON.parse(readFileSync(OUT, "utf8")) as {
    testResults: { assertionResults: { title: string; status: string }[] }[];
  };
  const arms = report.testResults.flatMap((file) => file.assertionResults);
  if (arms.length === 0) throw new Error("the report holds no arms at all");
  return {
    failed: arms.filter((arm) => arm.status === "failed").map((arm) => arm.title).sort(),
    total: arms.length,
  };
}

let EXIT_CODE = 0;

function main(): void {
  console.log("=== the suite must be GREEN before any sabotage ===");
  const base = runSuite();
  if (base.failed.length > 0) {
    console.error(`REFUSING — the suite is already red:\n  ${base.failed.join("\n  ")}`);
    rmSync(OUT, { force: true });
    process.exit(1);
  }
  console.log(`  ${base.total} arms, 0 red. Proceeding.\n`);

  let pass = 0;
  const findings: string[] = [];

  for (const sabotage of SABOTAGES) {
    const abs = path.join(ROOT, sabotage.file);
    const original = readFileSync(abs, "utf8");
    const occurrences = original.split(sabotage.find).length - 1;
    try {
      if (occurrences !== 1) {
        findings.push(`${sabotage.name}: anchor matched ${occurrences} times in ${sabotage.file}, expected exactly 1`);
        console.log(`X ${sabotage.name}\n    anchor matched ${occurrences} times — NOT DRIVEN`);
        continue;
      }
      writeFileSync(abs, original.replace(sabotage.find, sabotage.replace), "utf8");
      const got = runSuite().failed;
      const want = [...sabotage.expect].sort();
      const same = want.length === got.length && want.every((entry, index) => entry === got[index]);
      if (same) {
        pass += 1;
        console.log(`OK ${sabotage.name}\n    reddened exactly ${got.length}: ${got.join(" | ") || "(nothing, as required)"}`);
      } else {
        findings.push(
          `${sabotage.name}\n      wanted: ${want.join(" | ") || "(nothing)"}\n      got:    ${got.join(" | ") || "(nothing)"}`,
        );
        console.log(`X ${sabotage.name}\n    wanted: ${want.join(" | ") || "(nothing)"}\n    got:    ${got.join(" | ") || "(nothing)"}`);
      }
    } finally {
      writeFileSync(abs, original, "utf8");
    }
  }

  rmSync(OUT, { force: true });
  console.log(`\n=== ${pass}/${SABOTAGES.length} sabotages behaved exactly as claimed ===`);
  if (findings.length > 0) {
    console.log("\nFINDINGS:");
    for (const finding of findings) console.log(`  · ${finding}`);
    EXIT_CODE = 1;
  }
}

main();
process.exit(EXIT_CODE);
