/**
 * THE GITHUB HALF OF THE SHIFT LEDGER — merged PRs and the gate time each one
 * consumed (#543 item 4).
 *
 * `shiftLedger.mts` beside this is the pure join and the arithmetic; this is
 * the I/O it is fed from, kept separate so the decision can be driven from
 * fixtures with no network (law 3).
 *
 * ⚠ IT RETURNS AN `ok: false` REASON RATHER THAN THROWING OR RETURNING AN
 * EMPTY LIST. It is called from the Machinist ledger, whose other five
 * sections read production's own rows and must not be lost because `gh` is
 * unauthenticated on some machine — and an empty PR list would print as a
 * clean, quiet week rather than as an absence (INSTRUMENT_DOCTRINE entry 1:
 * a window with no rows says so; it never prints as zero).
 *
 * GATE MINUTES ARE SUMMED FROM THE RUNS THEMSELVES, on the PR's head branch,
 * between the PR opening and its merge. `updated_at` on a completed run is
 * when it FINISHED — the same field, for the same reason, that
 * `gateStall.mts` records: a run's age is not its duration, and reading a
 * finish time off `created_at` was a live defect there.
 *
 * ⚠ THE BRANCH IS THE ASSOCIATION, exactly as in `reviewRounds.mts`, and for
 * the same measured reason: a workflow run's `pull_requests` array is empty on
 * every recent run in this repository. The window between opening and merge is
 * what keeps a re-used branch name out.
 */
import { execFileSync } from "node:child_process";

import type { MergedPrReading } from "./shiftLedger.mts";

const GATE_WORKFLOW_PATH = ".github/workflows/gate.yml";

export type MergedPrsResult =
  | { ok: true; prs: MergedPrReading[] }
  | { ok: false; why: string };

function gh(args: string[]): string {
  return execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

/**
 * Every PR merged since `sinceIso`, with the gate minutes it consumed.
 *
 * @param limit how many recent PRs to consider before the date filter. The
 *   default covers a fortnight comfortably at this team's rate; it is a bound
 *   on the `gh` page size, not on the answer, and the caller is told when it
 *   binds so a truncated reading is never mistaken for a complete one.
 */
export function readMergedPrs(sinceIso: string, limit = 100): MergedPrsResult {
  let workflowId: number;
  try {
    const workflows = JSON.parse(
      gh(["api", "repos/:owner/:repo/actions/workflows?per_page=100"]),
    ) as { workflows: Array<{ id: number; path: string }> };
    const gate = workflows.workflows.find((w) => w.path === GATE_WORKFLOW_PATH);
    if (!gate) return { ok: false, why: `no workflow at ${GATE_WORKFLOW_PATH}` };
    workflowId = gate.id;
  } catch (error) {
    return { ok: false, why: `gh could not list workflows (${(error as Error).message.split("\n")[0]})` };
  }

  let listed: Array<{
    number: number;
    mergedAt: string | null;
    createdAt: string;
    headRefName: string;
  }>;
  try {
    listed = JSON.parse(
      gh([
        "pr",
        "list",
        "--state",
        "merged",
        "--limit",
        String(limit),
        "--json",
        "number,mergedAt,createdAt,headRefName",
      ]),
    ) as typeof listed;
  } catch (error) {
    return { ok: false, why: `gh pr list failed (${(error as Error).message.split("\n")[0]})` };
  }

  const since = new Date(sinceIso).getTime();
  const inWindow = listed.filter((p) => p.mergedAt !== null && new Date(p.mergedAt).getTime() >= since);
  if (listed.length === limit && inWindow.length === listed.length) {
    // Every PR the page returned is inside the window, so the page bound is
    // what ended the list rather than the date — the reading is a floor.
    return {
      ok: false,
      why:
        `all ${limit} PRs on the page fall inside the window, so the page bound truncated the ` +
        `reading. Re-run with a larger --limit; a truncated count is not a count.`,
    };
  }

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
      return {
        ok: false,
        why: `gh could not read gate runs for #${pr.number} (${(error as Error).message.split("\n")[0]})`,
      };
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
