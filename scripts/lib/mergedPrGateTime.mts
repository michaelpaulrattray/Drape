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

import { SEARCH_RESULT_CEILING } from "./crewNamingWindow.mts";
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
   *
   * ⚠ **AND IT MAY NOT EXCEED `SEARCH_RESULT_CEILING` (#2291).** This is a
   * `--search` read, so above GitHub's 1000-result ceiling the page can never
   * REACH the bound, `listed.length >= limit` can never fire, and the reading
   * becomes exactly the silent floor that refusal exists to prevent. The remedy
   * on this road is a NARROWER WINDOW, never a bigger bound.
   */
  limit?: number;
  gh?: GhRunner;
  /** How many times one `gh` call is tried before its failure becomes the refusal. */
  attempts?: number;
  /** The pause between attempts, injectable so the arms do not wait. */
  sleep?: (ms: number) => void;
};

/**
 * ⚠ ONE DROPPED CONNECTION USED TO BLANK THE WHOLE SECTION (Machinist run 3,
 * 2026-09-12). This reader makes one `gh api` call PER MERGED PR — a 14-day
 * window is ~200 sequential calls over the founder's home connection — and a
 * single `connectex … did not properly respond` on call 140 threw the other
 * 139 away and printed `UNREAD`. Measured the morning it was fixed: three of
 * four full readings lost, each to ONE call; the 3-day read on #543 recorded
 * the same (*"four of five attempts today"*). The UNREAD line is the honest
 * shape when `gh` genuinely cannot answer; it is the wrong shape when `gh`
 * answered 199 times and stumbled once.
 *
 * So every `gh` call is tried `attempts` times (default 3) with a short pause,
 * and the refusal — still a refusal, still with its reason — is written only
 * when the LAST attempt fails. Deliberately no classifier deciding which
 * errors are "transient": an auth failure retried three times costs about a
 * second and reads the same, while a classifier that misreads one message
 * silently gives the old behaviour back on the one road this exists for.
 */
const DEFAULT_ATTEMPTS = 3;
const RETRY_PAUSE_MS = 1_500;
const syncSleep = (ms: number) => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};

export function readMergedPrs(sinceIso: string, options: ReadMergedPrsOptions = {}): MergedPrsResult {
  const limit = options.limit ?? 100;
  const gh = options.gh ?? realGh;

  /*
    ⚠ **A BOUND ABOVE THE SEARCH CEILING IS REFUSED BEFORE ANY CALL IS MADE
    (#2291).** Below this line the reading is a `--search` read whose only
    truncation check is `listed.length >= limit`. GitHub's Search API returns at
    most `SEARCH_RESULT_CEILING` results whatever `--limit` says, so a bound
    above it can never be reached, the compare can never fire, and a short read
    is written as a complete one — the silent floor, arriving through the very
    option a caller reaches for to avoid it.

    It is checked FIRST because it needs nothing from GitHub to decide, and
    `mergedPullRequestArgs` next door already refuses the same shape on the same
    ground. The remedy is a NARROWER WINDOW, which is why the sentence names
    `--days` and not `--pr-limit`.
  */
  if (limit > SEARCH_RESULT_CEILING) {
    return {
      ok: false,
      why:
        `a page bound of ${limit} is above GitHub's ${SEARCH_RESULT_CEILING}-result search ceiling, ` +
        `so truncation could never be detected and the reading would be a silent floor. Narrow the ` +
        `window (the ledger's --days) instead of raising the bound.`,
    };
  }
  const attempts = Math.max(1, Math.floor(options.attempts ?? DEFAULT_ATTEMPTS));
  const sleep = options.sleep ?? syncSleep;
  const oneLine = (error: unknown) => String((error as Error).message ?? error).split("\n")[0];

  /* Every `gh` call goes through here, so no call site can be the one that
     still blanks the section on a single stumble. The thrown error is the
     LAST attempt's, and the reason names the count so a reader can tell a
     dead `gh` from an unlucky one. */
  const tried = (args: string[]): string => {
    let last: unknown;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return gh(args);
      } catch (error) {
        last = error;
        if (attempt < attempts) sleep(RETRY_PAUSE_MS);
      }
    }
    throw new Error(`${oneLine(last)} — after ${attempts} attempt(s)`);
  };

  let workflowId: number;
  try {
    const workflows = JSON.parse(tried(["api", "repos/:owner/:repo/actions/workflows?per_page=100"])) as {
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
      tried([
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
    /*
      ⚠ **THE REMEDY NAMED HERE USED TO BE ONE THIS ROAD CANNOT HONOUR (#2291).**
      It read *"Raise the bound (the ledger's --pr-limit) and re-run"*, and on a
      `--search` read that advice stops working at exactly the point it starts
      being needed: past `SEARCH_RESULT_CEILING` a bigger bound buys no extra
      rows and silently disables this compare, so following the instruction
      turned a loud refusal into a quiet floor. The bound is refused up there
      now, and the sentence names the remedy that works on this road.
    */
    const headroom = SEARCH_RESULT_CEILING - limit;
    return {
      ok: false,
      why:
        `the ${limit}-PR page bound was reached, so this reading may be missing merges and a ` +
        `truncated count is not a count. ` +
        (headroom > 0
          ? `Narrow the window (the ledger's --days), or raise the bound to at most ` +
            `${SEARCH_RESULT_CEILING} (the search ceiling) and re-run.`
          : `The bound is already at GitHub's ${SEARCH_RESULT_CEILING}-result search ceiling, so ` +
            `raising it buys nothing — narrow the window (the ledger's --days) and re-run.`),
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
          tried([
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
    // The head branch rides along so the join can anchor the PR to the run that
    // names that branch (#2097) — it is already read above for the gate runs.
    prs.push({
      number: pr.number,
      mergedAt: pr.mergedAt!,
      gateMinutes: minutes,
      gateRuns: count,
      headRefName: pr.headRefName,
    });
  }
  return { ok: true, prs };
}
