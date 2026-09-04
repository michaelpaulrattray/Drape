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
 * Only (1) is a label, and it is the one that rotted, so this prints the urgent
 * band — ordered oldest-first, because an urgent card that has waited longest
 * is the one #236 was filed about ("an urgent founder card sat a whole shift
 * unworked").
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
 * one question — *which cards are in the urgent band right now* — and answers
 * it from the artifact rather than from a paragraph that was true last week.
 *
 *     pnpm tsx scripts/queue-standing-exceptions.mts
 *
 * Needs `gh` authenticated; it reads nothing else and writes nothing at all.
 */
import { execFileSync } from "node:child_process";

type Row = {
  number: number;
  title: string;
  createdAt: string;
  labels: { name: string }[];
};

function readUrgent(): Row[] {
  const raw = execFileSync(
    "gh",
    [
      "issue",
      "list",
      "--state",
      "open",
      "--label",
      "urgent",
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
  let rows: Row[];
  try {
    rows = readUrgent();
  } catch (error) {
    /*
      REFUSE RATHER THAN PRINT AN EMPTY RANKING. A ranking that comes up empty
      because `gh` is unauthenticated reads exactly like a ranking that is
      genuinely empty, and the second one means "nothing urgent, work a patrol".
      That is the collector class CLAUDE.md's Atlas section names: a reader that
      can come up empty THROWS rather than returning a short list.
    */
    console.error(
      "queue-standing-exceptions: could not read the queue — is `gh` authenticated?",
    );
    console.error(String(error instanceof Error ? error.message : error));
    return 1;
  }

  rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  console.log("THE URGENT BAND — standing exception 1, derived from the queue");
  console.log(`read ${new Date().toISOString()} · ${rows.length} open\n`);

  if (rows.length === 0) {
    console.log(
      "  (empty — no card carries `urgent`. Bands 2 and 3 apply; for band 3 run",
    );
    console.log("   `npx tsx scripts/patrol-clocks.mts`.)");
    return 0;
  }

  for (const [index, row] of rows.entries()) {
    const others = row.labels
      .map((label) => label.name)
      .filter((name) => name !== "urgent");
    const age = Math.floor(
      (Date.now() - Date.parse(row.createdAt)) / (24 * 60 * 60 * 1000),
    );
    console.log(
      `${String(index + 1).padStart(2)}. #${row.number}  ${row.createdAt.slice(0, 10)}  (${age}d)  ${row.title}`,
    );
    if (others.length > 0) console.log(`      labels: ${others.join(", ")}`);
  }

  console.log(
    "\nOldest first. Band 2 (blocks every merge) is a judgement and stays prose.",
  );
  console.log(
    "Band 3 (a patrol whose clock has fired) is DERIVED — `npx tsx scripts/patrol-clocks.mts`.",
  );
  return 0;
}

process.exit(main());
