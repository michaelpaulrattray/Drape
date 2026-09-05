/**
 * THE GITHUB HALF OF THE SHIFT LEDGER — merged PRs and the gate time each one
 * consumed (#543 item 4).
 *
 * `shiftLedger.mts` beside this is the pure join and the arithmetic; this is
 * the I/O it is fed from, kept separate so the decision can be driven from
 * fixtures with no network (law 3). ⚠ The `gh` runner is INJECTABLE for the
 * same reason: the gate review of PR #559 pointed out that the module's own
 * refusal logic lived on the one side with no fixture arm, which is law 2
 * exactly — a checker that cannot be made to fail in a test is not a checker.
 *
 * ⚠ IT RETURNS AN `ok: false` REASON RATHER THAN THROWING OR RETURNING AN
 * EMPTY LIST. It is called from the Machinist ledger, whose other five
 * sections read production's own rows and must not be lost because `gh` is
 * unauthenticated on some machine — and an empty PR list would print as a
 * clean, quiet week rather than as an absence (INSTRUMENT_DOCTRINE entry 1:
 * a window with no rows says so; it never prints as zero).
 *
 * ⚠ THE POPULATION IS SELECTED BY MERGE DATE AT GITHUB, NOT FILTERED AFTER A
 * DEFAULT LISTING — and the first shape of this module did the second, which
 * the gate review of #559 caught as its severest finding.
 *
 * `gh pr list --state merged` pages in CREATION order. So "at least one listed
 * PR falls outside the window" does NOT imply "every in-window merge is on the
 * page": a long-lived branch created three weeks ago and merged yesterday sits
 * below a hundred younger PRs, and a guard reasoning from creation order drops
 * it silently — undercounting cards with no `unattributed` row and no UNREAD,
 * which is precisely the clean-small-population reading `shiftLedger.mts`'s
 * own docblock exists to prevent. `--search "merged:>=<date>"` makes GitHub do
 * the selection on the field the window is actually about, so the page bound
 * applies to the population we want rather than to an unrelated ordering; and
 * hitting the bound at all is now an unconditional REFUSAL, because a
 * truncated count is not a count.
 *
 * GATE MINUTES ARE SUMMED FROM THE RUNS THEMSELVES, on the PR's head branch,
 * between the PR opening and its merge. `updated_at` on a completed run is
 * when it FINISHED — the same field, for the same reason, that
 * `gateStall.mts` records: a run's age is not its duration, and reading a
 * finish time off `created_at` was a live defect there.
 *
 * ⚠ TWO KNOWN FLOOR-DIRECTION LIMITS, STATED RATHER THAN DISCOVERED (#559
 * review, finding 5): a gate run still IN PROGRESS when the ledger reads is
 * skipped, so a PR merged minutes before a reading under-reports its gate
 * minutes in that reading; and a re-run of a completed gate bumps its
 * `updated_at`, inflating that one run's apparent duration. Both are small,
 * both point the same way as the module's other bounds, and neither is worth
 * an instrument of its own — but a figure that moves between two readings of
 * the same window has these two causes before it has an interesting one.
 *
 * ⚠ THE BRANCH IS THE ASSOCIATION for gate runs, exactly as in
 * `reviewRounds.mts`, and for the same measured reason: a workflow run's
 * `pull_requests` array is empty on every recent run in this repository. The
 * window between opening and merge is what keeps a re-used branch name out.
 */
import { execFileSync } from "node:child_process";

import type { MergedPrReading } from "./shiftLedger.mts";

const GATE_WORKFLOW_PATH = ".github/workflows/gate.yml";

export type MergedPrsResult =
  | { ok: true; prs: MergedPrReading[] }
  | { ok: false; why: string };

/** The `gh` boundary, injectable so every refusal path is drivable (law 2). */
export type GhRunner = (args: string[]) => string;

const realGh: GhRunner = (args) =>
  execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

export type ReadMergedPrsOptions = {
  /**
   * A bound on the `gh` page, not on the answer. Hitting it is a REFUSAL, so
   * the caller must size it above the window's real population; the Machinist
   * ledger derives it from `--days`.
   */
  limit?: number;
  gh?: GhRunner;
};

export function readMergedPrs(sinceIso: string, options: ReadMergedPrsOptions = {}): MergedPrsResult {
  const limit = options.limit ?? 100;
  const gh = options.gh ?? realGh;
  const oneLine = (error: unknown) => String((error as Error).message ?? error).split("\n")[0];

  let workflowId: number;
  try {
    const workflows = JSON.parse(gh(["api", "repos/:owner/:repo/actions/workflows?per_page=100"])) as {
      workflows: Array<{ id: number; path: string }>;
    };
    const gate = workflows.workflows.find((w) => w.path === GATE_WORKFLOW_PATH);
    if (!gate) return { ok: false, why: `no workflow at ${GATE_WORKFLOW_PATH}` };
    workflowId = gate.id;
  } catch (error) {
    return { ok: false, why: `gh could not list workflows (${oneLine(error)})` };
  }

  // Date granularity is UTC and inclusive, so this is deliberately a little
  // WIDER than the window; the exact bound is applied below on the same
  // timestamp the join uses.
  const sinceDay = sinceIso.slice(0, 10);
  let listed: Array<{ number: number; mergedAt: string | null; createdAt: string; headRefName: string }>;
  try {
    listed = JSON.parse(
      gh([
        "pr",
        "list",
        "--state",
        "merged",
        "--search",
        `merged:>=${sinceDay}`,
        "--limit",
        String(limit),
        "--json",
        "number,mergedAt,createdAt,headRefName",
      ]),
    ) as typeof listed;
  } catch (error) {
    return { ok: false, why: `gh pr list failed (${oneLine(error)})` };
  }

  if (listed.length >= limit) {
    return {
      ok: false,
      why:
        `the ${limit}-PR page bound was reached, so this reading may be missing merges and a ` +
        `truncated count is not a count. Raise the bound (the ledger's --pr-limit) and re-run.`,
    };
  }

  const since = new Date(sinceIso).getTime();
  const inWindow = listed.filter((p) => p.mergedAt !== null && new Date(p.mergedAt).getTime() >= since);

  const prs: MergedPrReading[] = [];
  for (const pr of inWindow) {
    let runs: Array<{ created_at: string; updated_at: string; status: string }>;
    try {
      runs = (
        JSON.parse(
          gh([
            "api",
            `repos/:owner/:repo/actions/workflows/${workflowId}/runs` +
              `?branch=${encodeURIComponent(pr.headRefName)}&per_page=100`,
          ]),
        ) as { workflow_runs: typeof runs }
      ).workflow_runs;
    } catch (error) {
      return { ok: false, why: `gh could not read gate runs for #${pr.number} (${oneLine(error)})` };
    }

    const opened = new Date(pr.createdAt).getTime();
    const merged = new Date(pr.mergedAt!).getTime();
    let minutes = 0;
    let count = 0;
    for (const run of runs) {
      const created = new Date(run.created_at).getTime();
      if (created < opened || created > merged) continue;
      if (run.status !== "completed") continue;
      minutes += (new Date(run.updated_at).getTime() - created) / 60_000;
      count += 1;
    }
    prs.push({ number: pr.number, mergedAt: pr.mergedAt!, gateMinutes: minutes, gateRuns: count });
  }
  return { ok: true, prs };
}
