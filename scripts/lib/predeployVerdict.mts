import type { MigrationReport } from "./ceremonyAutoApply.mts";

/**
 * THE ONE DECISION THE PRE-DEPLOY COMMAND MAKES (#508 D3): does this deploy
 * proceed?
 *
 * Railway's contract: a pre-deploy command that exits non-zero ABORTS the
 * deploy and the old build keeps serving. So the exit code here is a decision
 * about the whole road, and it is deliberately asymmetric:
 *
 * - **A failed WRITE blocks** — a statement that errored, or an object still
 *   absent after its statement ran (`report.blocking`). New code must not take
 *   traffic ahead of a table it was promised and the applier could not
 *   deliver; the old build keeps serving and nothing is lost.
 * - **A waiting CEREMONY does not block** — a destructive statement is HIS to
 *   run (#322), and an unresolved declaration means a migration file has not
 *   landed yet. Both are printed loudly and reported by the rite-as-checker on
 *   every receipt, but wedging every subsequent deploy behind them would turn
 *   his pending decision into a production outage of the deploy road itself.
 *   Booting without the object is exactly today's behaviour on both roads, and
 *   the writers catch their own failure (the #322 design's own premise).
 *
 * A schema that cannot be READ at all never reaches this function — the
 * script exits 1 before planning anything, because deciding a write from an
 * unread schema is the mistake working law 2 exists for.
 */
export type PredeployVerdict = {
  readonly exitCode: 0 | 1;
  readonly lines: readonly string[];
};

export function predeployVerdict(report: MigrationReport): PredeployVerdict {
  const lines: string[] = [...report.lines];
  const waiting = report.problems.filter((problem) => !report.blocking.includes(problem));
  for (const problem of waiting) {
    lines.push(`ceremony waiting (NOT blocking this deploy): ${problem}`);
  }
  if (report.blocking.length > 0) {
    for (const problem of report.blocking) lines.push(`BLOCKING: ${problem}`);
    lines.push("predeploy: REFUSING the deploy — the write path failed; the old build keeps serving.");
    return { exitCode: 1, lines };
  }
  return { exitCode: 0, lines };
}
