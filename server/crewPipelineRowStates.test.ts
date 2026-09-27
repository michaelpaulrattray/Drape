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
} from "../shared/crewShiftState.js";

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
