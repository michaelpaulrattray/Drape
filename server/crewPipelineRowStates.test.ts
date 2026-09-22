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

    expect(plan).toEqual({ merged: [], stuck: [], unreadable: [] });
    expect(table.asked).toEqual([]);
  });

  it("skips a row with no PR number and does not report it as unreadable", () => {
    const table = reader({});
    const plan = planPipelineRowStates([row("no-pr", "building", null)], table.read);

    expect(plan).toEqual({ merged: [], stuck: [], unreadable: [] });
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
  it("`crew-desk-sweep.mts` asks for state, mergeable AND mergeStateStatus", () => {
    const source = readFileSync(SWEEP, "utf8");
    expect(source).toContain('"state,mergeable,mergeStateStatus"');
  });

  it("the sweep reads the three-state reader rather than a second definition", () => {
    const source = readFileSync(SWEEP, "utf8");
    expect(source).toContain("planPipelineRowStates");
    /* The sentence on a conflict is declared once, in `shared/`, and printed
       by four readers now. A hand-typed copy here would be working law 4. */
    expect(source).toContain("PR_CONFLICT_NOTE");
  });

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
