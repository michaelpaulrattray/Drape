/**
 * THE DESK SWEEP'S PIPELINE PASS, DRIVEN (issue #1101).
 *
 * The instance: edition 477 put a row on his page reading `in-review` over PR
 * #1078, which had stopped being mergeable eleven hours earlier — and the row
 * did not move through either of that PR's two spells of being stuck, because
 * the sweep's whole reader was `gh pr view --json state` and `state` cannot
 * express *"open, but it can no longer be merged"*.
 *
 * Two halves, and the second is the one no fixture can reach:
 *
 *  1. `planPipelineRowStates` sorted over a fixture table, with the three-state
 *     negative controls the card insisted on — `UNKNOWN` and the fields absent
 *     must say NOTHING, not "fine". `UNKNOWN` is not hypothetical: read live at
 *     21:18Z on 2026-09-22, immediately after the merge that broke #1078, GitHub
 *     answered `UNKNOWN`/`UNKNOWN` for two full minutes before `CONFLICTING`.
 *  2. The `--json` field list held at the BYTES of `crew-desk-sweep.mts`. Trim
 *     `mergeable,mergeStateStatus` out of the live call and every arm above
 *     still passes — it drives a table that carries them — while the reader
 *     correctly answers `null` for every row and the whole warning goes silent
 *     with nothing red anywhere. That is #1099's own lesson, inherited here
 *     because this pass inherited its reader.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  type PipelineRowPullRequest,
  type PlannablePipelineRow,
  planPipelineRowStates,
  planPipelineRowsWithoutPullRequests,
} from "../shared/crewShiftState.js";
import { cardNumbersIn } from "../shared/crewQueuePossiblyDone.js";

const SWEEP = resolve("scripts/crew-desk-sweep.mts");

const row = (id: string, status: string, prNumber: number | null): PlannablePipelineRow =>
  ({ id, status, prNumber });

/** A reader over a fixed table; anything not named reads as unreadable. */
function reader(table: Record<number, PipelineRowPullRequest>) {
  const asked: number[] = [];
  const read = (prNumber: number): PipelineRowPullRequest => {
    asked.push(prNumber);
    return prNumber in table ? table[prNumber] : null;
  };
  return { read, asked };
}

describe("planPipelineRowStates — a live row over a PR that cannot land (#1101)", () => {
  it("reports a CONFLICTING PR under an `in-review` row — the #1078 instance", () => {
    const plan = planPipelineRowStates(
      [row("makeup-cap-1076", "in-review", 1078)],
      reader({ 1078: { state: "OPEN", mergeable: "CONFLICTING", mergeStateStatus: "DIRTY" } }).read,
    );

    expect(plan.stuck.map((item) => item.id)).toEqual(["makeup-cap-1076"]);
    expect(plan.merged).toEqual([]);
    expect(plan.unreadable).toEqual([]);
  });

  it("reports a DIRTY PR whose `mergeable` says nothing of the sort", () => {
    const plan = planPipelineRowStates(
      [row("r", "building", 7)],
      reader({ 7: { state: "OPEN", mergeable: "MERGEABLE", mergeStateStatus: "DIRTY" } }).read,
    );
    expect(plan.stuck).toHaveLength(1);
  });

  it("says nothing about a clean, mergeable PR — the negative control", () => {
    const plan = planPipelineRowStates(
      [row("fine", "in-review", 1100)],
      reader({ 1100: { state: "OPEN", mergeable: "MERGEABLE", mergeStateStatus: "CLEAN" } }).read,
    );

    expect(plan.stuck).toEqual([]);
    expect(plan.merged).toEqual([]);
    expect(plan.unreadable).toEqual([]);
  });

  it("says NOTHING while GitHub is still computing — `UNKNOWN` is not a conflict", () => {
    const plan = planPipelineRowStates(
      [row("just-pushed", "in-review", 1078)],
      reader({ 1078: { state: "OPEN", mergeable: "UNKNOWN", mergeStateStatus: "UNKNOWN" } }).read,
    );

    expect(plan.stuck).toEqual([]);
    /* And it is not laundered into the other two lists either. */
    expect(plan.merged).toEqual([]);
    expect(plan.unreadable).toEqual([]);
  });

  it("says NOTHING when the two fields are absent — a trimmed read is not a clean bill", () => {
    const plan = planPipelineRowStates(
      [row("trimmed", "in-review", 5)],
      reader({ 5: { state: "OPEN" } }).read,
    );
    expect(plan.stuck).toEqual([]);
  });

  it("never reports a MERGED PR as stuck, whatever its mergeability says", () => {
    const plan = planPipelineRowStates(
      [row("landed", "in-review", 1100)],
      /* GitHub answers UNKNOWN for a merged PR; a CONFLICTING one here is the
         harder arm, and the merged guard must still win. */
      reader({ 1100: { state: "MERGED", mergeable: "CONFLICTING", mergeStateStatus: "DIRTY" } }).read,
    );

    expect(plan.merged.map((item) => item.id)).toEqual(["landed"]);
    expect(plan.stuck).toEqual([]);
  });

  it("promotes a merged PR exactly as the pass always did", () => {
    const plan = planPipelineRowStates(
      [row("landed", "in-review", 1100)],
      reader({ 1100: { state: "MERGED", mergeable: "UNKNOWN", mergeStateStatus: "UNKNOWN" } }).read,
    );
    expect(plan.merged.map((item) => item.id)).toEqual(["landed"]);
  });
});

describe("planPipelineRowStates — a PR closed and REPLACED (#1439)", () => {
  /*
    The three states a row's PR can be in, driven as three arms rather than one,
    because only the third reports and the other two must stay silent:
    OPEN (quiet, however old), MERGED (promoted), CLOSED-unmerged (reported).
  */

  it("reports the row whose PR was closed without merging — the #1353 specimen", () => {
    const plan = planPipelineRowStates(
      [row("try-again-row-1347", "in-review", 1353)],
      reader({ 1353: { state: "CLOSED", closedAt: "2026-09-26T07:30:00Z" } }).read,
    );

    expect(plan.closedUnmerged.map((item) => [item.id, item.prNumber, item.closedAt]))
      .toEqual([["try-again-row-1347", 1353, "2026-09-26T07:30:00Z"]]);
    /* And it is not laundered into any other list — a row promoted to `merged`
       on a guess is the shape he asked about wearing a green tick. */
    expect(plan.merged).toEqual([]);
    expect(plan.stuck).toEqual([]);
    expect(plan.unreadable).toEqual([]);
  });

  it(
    "⚠ NEGATIVE CONTROL — an OPEN PR's row stays quiet however long the review takes",
    () => {
      /*
        The arm that makes the report worth reading: a long review is not a stale
        row. `MERGEABLE`/`CLEAN`, `UNKNOWN`/`UNKNOWN` and the fields absent are
        all a live PR, and none of them may reach the new list.
      */
      const plan = planPipelineRowStates(
        [
          row("slow-review", "in-review", 1),
          row("just-pushed", "in-review", 2),
          row("trimmed-read", "in-review", 3),
        ],
        reader({
          1: { state: "OPEN", mergeable: "MERGEABLE", mergeStateStatus: "CLEAN", closedAt: null },
          2: { state: "OPEN", mergeable: "UNKNOWN", mergeStateStatus: "UNKNOWN" },
          3: { state: "OPEN" },
        }).read,
      );

      expect(plan.closedUnmerged).toEqual([]);
      expect(plan.merged).toEqual([]);
      expect(plan.stuck).toEqual([]);
      expect(plan.unreadable).toEqual([]);
    },
  );

  it("⚠ a CLOSED PR is never ALSO reported stuck, even when GitHub still calls it conflicting", () => {
    /*
      GitHub keeps answering `mergeable` on a closed PR, so without the early
      return one row would be printed by two blocks — the exact shape this
      script's header says it exists to kill. The harder fixture is the one that
      proves the order: CONFLICTING/DIRTY under a CLOSED state.
    */
    const plan = planPipelineRowStates(
      [row("closed-and-dirty", "in-review", 9)],
      reader({ 9: { state: "CLOSED", mergeable: "CONFLICTING", mergeStateStatus: "DIRTY" } }).read,
    );

    expect(plan.closedUnmerged.map((item) => item.id)).toEqual(["closed-and-dirty"]);
    expect(plan.stuck).toEqual([]);
  });

  it("MERGED still wins over CLOSED — the promotion is unchanged", () => {
    const plan = planPipelineRowStates(
      [row("landed", "in-review", 10)],
      reader({ 10: { state: "MERGED", closedAt: "2026-09-26T07:37:34Z" } }).read,
    );

    expect(plan.merged.map((item) => item.id)).toEqual(["landed"]);
    expect(plan.closedUnmerged).toEqual([]);
  });

  it("an absent close date is reported as unread rather than invented", () => {
    /* `closedAt` decides nothing — it is the report's own convenience — so a
       read that did not carry it must still produce the finding. */
    const plan = planPipelineRowStates(
      [row("no-date", "building", 11)],
      reader({ 11: { state: "closed" } }).read,
    );

    expect(plan.closedUnmerged).toHaveLength(1);
    expect(plan.closedUnmerged[0]!.closedAt).toBeNull();
  });

  it("does not mutate the row it reports — the plan carries a copy", () => {
    /* The sweep's doctrine for this class is REPORT, never repair, and a plan
       that handed back the live briefing object would make an accidental write
       one keystroke away. */
    const live = row("original", "in-review", 12);
    const plan = planPipelineRowStates(
      [live],
      reader({ 12: { state: "CLOSED", closedAt: "2026-09-26T00:00:00Z" } }).read,
    );

    expect(plan.closedUnmerged[0]).not.toBe(live);
    expect(live).toEqual({ id: "original", status: "in-review", prNumber: 12 });
  });
});

describe("planPipelineRowStates — a failed read is never a verdict (working law 2)", () => {
  it("reports an unreadable PR and claims nothing about it", () => {
    const plan = planPipelineRowStates(
      [row("gone", "in-review", 404)],
      reader({}).read,
    );

    expect(plan.unreadable.map((item) => item.id)).toEqual(["gone"]);
    expect(plan.stuck).toEqual([]);
    expect(plan.merged).toEqual([]);
  });

  it("skips a row that is already `merged` without asking GitHub anything", () => {
    const table = reader({ 9: { state: "OPEN", mergeable: "CONFLICTING" } });
    const plan = planPipelineRowStates([row("done", "merged", 9)], table.read);

    expect(plan).toEqual({ merged: [], stuck: [], closedUnmerged: [], unreadable: [] });
    expect(table.asked).toEqual([]);
  });

  it("skips a row with no PR number and does not report it as unreadable", () => {
    const table = reader({});
    const plan = planPipelineRowStates([row("no-pr", "building", null)], table.read);

    expect(plan).toEqual({ merged: [], stuck: [], closedUnmerged: [], unreadable: [] });
    expect(table.asked).toEqual([]);
  });

  it("reads each PR ONCE, so a flaky reader cannot answer two ways in one plan", () => {
    const table = reader({ 11: { state: "OPEN", mergeable: "CONFLICTING", mergeStateStatus: "DIRTY" } });
    planPipelineRowStates([row("a", "in-review", 11)], table.read);
    expect(table.asked).toEqual([11]);
  });

  it("sorts a whole board in one pass", () => {
    const plan = planPipelineRowStates(
      [
        row("merged-row", "in-review", 1),
        row("stuck-row", "in-review", 2),
        row("fine-row", "building", 3),
        row("unread-row", "building", 4),
        row("already", "merged", 5),
      ],
      reader({
        1: { state: "MERGED" },
        2: { state: "OPEN", mergeable: "CONFLICTING", mergeStateStatus: "DIRTY" },
        3: { state: "OPEN", mergeable: "MERGEABLE", mergeStateStatus: "CLEAN" },
      }).read,
    );

    expect(plan.merged.map((item) => item.id)).toEqual(["merged-row"]);
    expect(plan.stuck.map((item) => item.id)).toEqual(["stuck-row"]);
    expect(plan.unreadable.map((item) => item.id)).toEqual(["unread-row"]);
  });
});

describe("the sweep's live call still asks for the fields the plan depends on", () => {
  /* No fixture can see this. The arms above pass a table that carries the
     fields whatever the script asks GitHub for. */
  it("`crew-desk-sweep.mts` asks for state, mergeable, mergeStateStatus AND closedAt", () => {
    const source = readFileSync(SWEEP, "utf8");
    expect(source).toContain('"state,mergeable,mergeStateStatus,closedAt"');
  });

  it("the sweep reads the three-state reader rather than a second definition", () => {
    const source = readFileSync(SWEEP, "utf8");
    expect(source).toContain("planPipelineRowStates");
    /* The sentence on a conflict is declared once, in `shared/`, and printed
       by four readers now. A hand-typed copy here would be working law 4. */
    expect(source).toContain("PR_CONFLICT_NOTE");
  });

  it("the closed-unmerged block repairs nothing either — it prints and moves on (#1439)", () => {
    const source = readFileSync(SWEEP, "utf8");
    const from = source.indexOf("pipelinePlan.closedUnmerged.length > 0");
    expect(from, "the closed-unmerged block must be found, or this arm proves nothing")
      .toBeGreaterThan(0);
    const printed = source.slice(from, source.indexOf("if (liars.length > 0)", from));
    expect(printed.length).toBeGreaterThan(200);
    /* Nothing in this block may write to the briefing, and above all it may not
       guess at the successor PR. */
    expect(printed).not.toContain("item.status =");
    expect(printed).not.toContain("item.prNumber =");
    expect(printed).not.toContain("item.note =");
    expect(printed).not.toContain("delete item.");
  });

  it(
    "⚠ THE EXIT CODE FOLLOWS THIS FILE'S OWN DOCTRINE, AND THE CARD ASKED FOR THE OTHER ONE",
    () => {
      /*
        #1439 recommended exit 2, *"exactly the way a stale `needsYou` row already
        is (#291)"*. Read at the code, the sweep's closing paragraph states the
        rule it actually uses, and it is NOT how-wrong-is-it:

          "the rule above is not 'how wrong is it', it is **'can the shift ship
           past it'**: a liar is a shape the schema REFUSES at the parse, and a
           row whose PR is merely conflicting is schema-valid and ships."

        A liar exits 2 because the briefing schema refuses it, so exit 2 is not
        even the thing stopping the ship. A closed-unmerged row is schema-valid —
        `status: "in-review"` with a `prNumber` parses — so giving it exit 2 spends
        the one signal meaning *you cannot ship this* on a state you can, which
        that same paragraph forbids, and which its two precedents (a held card
        #604, a stuck row #1101) were both decided against.

        So it prints loudly and exits 0, and this arm holds BOTH halves at the
        bytes: `liars` is still the only term in the exit expression, and the new
        block is still reached. Flipping to exit 2 is a one-line change and a
        deliberate edit to this arm — which is the point, because it is the
        relay's call and not a silent one.
      */
      const source = readFileSync(SWEEP, "utf8");
      /* ⚠ THE LAST ONE. The script has an early `process.exit(1)` for a bad
         argument, and the first draft of this arm read that instead and failed
         for the wrong reason — a reader that matches the wrong statement is a
         reader whose green means nothing. */
      const exits = [...source.matchAll(/process\.exit\(([^)]*)\);/g)];
      expect(exits.length, "the sweep's exit statements must be found").toBeGreaterThan(0);
      expect(exits[exits.length - 1]![1]).toBe("liars.length > 0 ? 2 : 0");
      expect(source).toContain("pipelinePlan.closedUnmerged.length > 0");
    },
  );

  it("the stuck block repairs nothing — it prints and moves on", () => {
    const source = readFileSync(SWEEP, "utf8");
    const block = source.slice(source.indexOf("pipelinePlan.stuck.length > 0"));
    const end = block.indexOf("if (liars.length > 0)");
    expect(end).toBeGreaterThan(0);
    const printed = block.slice(0, end);
    /* Nothing in this block may write to the briefing. */
    expect(printed).not.toContain("item.status =");
    expect(printed).not.toContain("item.note =");
  });
});

/**
 * ⚠ **THE ROWS THAT READER CANNOT SEE AT ALL (#2165).**
 *
 * `planPipelineRowStates` opens with `if (typeof row.prNumber !== "number")
 * continue;` — so a live row naming no pull request is outside every one of its
 * four verdicts by construction. Not promoted, not stuck, not closed-unmerged,
 * not even unreadable: it says whatever it was written saying, for ever.
 *
 * **The specimen was live when this was written.** `dead-engine-record-1785`
 * had said `in-review` since its card closed on 2026-10-03 (his word on #1785:
 * *"1758) seal."*), with `prNumber: null`, through a week of sweeps that had no
 * rule able to notice it. #2165 was filed about a different row —
 * `sign-flat-price-1968`, which HAD a PR number, was repaired by the reader
 * above, and cleared itself at edition 668 — so this is the half of that card's
 * class that genuinely cannot self-heal.
 */
describe("a live pipeline row with no pull request, judged by its card (#2165)", () => {
  const row = (id: string, status: string, title: string, prNumber: number | null = null) =>
    ({ id, status, title, prNumber });

  /** The three-state card reader the sweep hands in, as a table. */
  const openness = (open: readonly number[], unknown: readonly number[] = []) =>
    (card: number): boolean | null => {
      if (unknown.indexOf(card) !== -1) return null;
      return open.indexOf(card) !== -1;
    };

  it("⚠ names the specimen: no PR, card closed, still saying `in-review`", () => {
    const found = planPipelineRowsWithoutPullRequests(
      [row("dead-engine-record-1785", "in-review", "Our list of known-bad engines (#1785)")],
      cardNumbersIn,
      openness([]),
    );
    expect(found.map((one) => one.id)).toEqual(["dead-engine-record-1785"]);
    /* The cards travel with the finding so the report can name what it judged
       the row against, rather than asserting "closed" with nothing behind it. */
    expect(found[0]!.cards).toEqual([1785]);
  });

  it("⚠ CONTROL — a row whose card is OPEN is not a finding", () => {
    /* Without this the reader could answer for every PR-less row and the arm
       above would still pass, which is an enumeration guard enumerating
       everything. */
    expect(planPipelineRowsWithoutPullRequests(
      [row("live-1785", "in-review", "Something (#1785)")],
      cardNumbersIn,
      openness([1785]),
    )).toEqual([]);
  });

  it("⚠ a card it CANNOT TELL about is left alone — the cap guard", () => {
    /*
      The sweep answers `null` when the open queue came back AT `OPEN_QUEUE_LIMIT`,
      because a card missing from a capped list is either closed or past the cap
      and those are opposite answers. Reporting a live card as closed is the
      finding-shaped lie the whole sweep exists to prevent.
    */
    expect(planPipelineRowsWithoutPullRequests(
      [row("unknowable", "in-review", "Something (#1785)")],
      cardNumbersIn,
      openness([], [1785]),
    )).toEqual([]);
  });

  it("EVERY card closed, not any — a row naming one live card still describes live work", () => {
    expect(planPipelineRowsWithoutPullRequests(
      [row("two-cards", "in-review", "A thing (#1785) and another (#1786)")],
      cardNumbersIn,
      openness([1786]),
    )).toEqual([]);
    /* And with both closed it IS a finding, or the arm above passes for the
       wrong reason — a reader that never fires satisfies it too. */
    expect(planPipelineRowsWithoutPullRequests(
      [row("two-cards", "in-review", "A thing (#1785) and another (#1786)")],
      cardNumbersIn,
      openness([]),
    ).map((one) => one.cards)).toEqual([[1785, 1786]]);
  });

  it("is silent about a row that HAS a pull request — that is the other reader's population", () => {
    /* The two readers partition the rows; an overlap would print two blocks
       about one row, which is the shape this script's header says it exists to
       kill. */
    expect(planPipelineRowsWithoutPullRequests(
      [row("has-a-pr", "in-review", "A thing (#1785)", 2105)],
      cardNumbersIn,
      openness([]),
    )).toEqual([]);
  });

  it("is silent about a row whose title names no card at all", () => {
    /* There is nothing to judge it against, and reading a number out of its
       `id` — which happens to end in one — would be a slug passed off as
       evidence. */
    expect(planPipelineRowsWithoutPullRequests(
      [row("dead-engine-record-1785", "in-review", "Our list of known-bad engines")],
      cardNumbersIn,
      openness([]),
    )).toEqual([]);
  });

  it("is silent about a row that is already DONE", () => {
    expect(planPipelineRowsWithoutPullRequests(
      [row("finished", "merged", "A thing (#1785)")],
      cardNumbersIn,
      openness([]),
    )).toEqual([]);
  });

  it("⚠ the block REPAIRS NOTHING — it prints and moves on", () => {
    /* The same arm its neighbour carries, for the same reason: a card closes
       for reasons other than its work shipping, so a status written here would
       be one nobody meant. */
    const source = readFileSync(SWEEP, "utf8");
    const block = source.slice(source.indexOf("if (pipelineNoPr.length > 0)"));
    expect(block.length, "the PR-less block must be found").toBeGreaterThan(0);
    const printed = block.slice(0, block.indexOf("if (liars.length > 0)"));
    expect(printed).not.toContain("item.status =");
    expect(printed).not.toContain("item.note =");
  });

  it("⚠ the sweep hands in a reader that can answer `null`, held at the sweep's own bytes", () => {
    /*
      #1099's lesson, inherited: every arm above drives a table that can answer
      three states, so a sweep that passed a two-state reader would leave them
      all green while the cap guard went silent in the one place it matters.
    */
    const source = readFileSync(SWEEP, "utf8");
    expect(source).toContain("planPipelineRowsWithoutPullRequests");
    expect(source).toContain("queueIsAFloor");
    expect(source).toContain("if (openCardNumbers === null || queueIsAFloor) return null;");
  });
});
