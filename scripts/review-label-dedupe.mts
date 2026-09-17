/**
 * ONE VERDICT PER HEAD SHA — asked by the `labeled` run before it spends (#1026).
 *
 * Run by `review.yml`'s triage job, ONLY on a `labeled needs-fable` event whose
 * diff already earns a review on its own merits (the money pattern, or ≥50
 * code lines — triage computes that and does not call this otherwise):
 *
 *     node scripts/review-label-dedupe.mts --sha <head sha> --run-id <this run>
 *
 * It prints exactly one of these lines, which the shell reads:
 *
 *     dedupe=skip     another review.yml run on this sha is producing, or has
 *                     produced, the verdict — triage answers review=no
 *     dedupe=review   nothing stands in — triage carries on as it always did
 *
 * WHY. Marking a PR ready and labelling it `needs-fable` in the same breath
 * fires two review runs on one sha, and the concurrency key keeps both alive
 * ON PURPOSE (#434 — a skipping run must never cancel a real review). Measured
 * over the 500 newest review runs: four doubled shas (#680, #1007, #1023,
 * #1024), $17.19 on the last two — against the founder's standing rule on
 * doubled reviews. The decision lives in `scripts/lib/reviewRounds.mts` beside
 * the verdict reader the merge tool and the round notice already share, so
 * "does a verdict exist on this sha" has one answer.
 *
 * ⚠ EVERY EXIT IS 0 AND EVERY FAILURE PRINTS `dedupe=review`. This script can
 * only SPEND a verdict nobody needed; it must never SILENCE one that was owed.
 * A `gh` that cannot list runs, a workflow it cannot find, a run whose jobs it
 * cannot read — each one is "review", said out loud with its cause, and the
 * shell treats an absent line the same way. The single `process.exit(0)` the
 * script guards require sits after `main` returns.
 *
 * ⚠ IT RUNS UNDER BARE NODE 24, like `review-round-notice.mts`, so the triage
 * job needs no dependency install; the shared reader imports nothing outside
 * the standard library.
 *
 * Read-only. No database, no production, no deploy, no comment.
 */
import { execFileSync } from "node:child_process";

import { type SameShaRunReading, decideLabelDedupe } from "./lib/reviewRounds.mts";

const REVIEWER_WORKFLOW_PATH = ".github/workflows/review.yml";
const TRIAGE_JOB_NAME = "triage";
const REVIEW_JOB_NAME = "review";

const HELP = [
  "review-label-dedupe — should a `labeled needs-fable` run review a sha another run already covers?",
  "",
  "  --sha <sha>       the pull request's head sha (required)",
  "  --run-id <id>     this workflow run's id, so it never counts itself (required)",
  "",
  "Prints `dedupe=skip` or `dedupe=review`. Always exits 0; every failure is `dedupe=review`.",
].join("\n");

function gh(args: string[]): string {
  return execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function api<T>(path: string): T {
  return JSON.parse(gh(["api", path])) as T;
}

const firstLine = (error: unknown) => String((error as Error).message ?? error).split("\n")[0];

type Job = { name: string; status: string; conclusion: string | null };

function main(argv: readonly string[]): void {
  let sha: string | null = null;
  let runIdArg: string | null = null;
  const review = (why: string) => {
    console.log(`review-label-dedupe: reviewing — ${why}`);
    console.log("dedupe=review");
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    if (a === "--sha") {
      const value = argv[(i += 1)];
      if (value === undefined) return review("--sha needs a value");
      sha = value;
    } else if (a === "--run-id") {
      const value = argv[(i += 1)];
      if (value === undefined) return review("--run-id needs a value");
      runIdArg = value;
    } else if (a === "--help" || a === "-h") {
      console.log(HELP);
      return;
    } else {
      return review(`unknown flag ${a}`);
    }
  }
  if (sha === null || !/^[0-9a-f]{7,40}$/i.test(sha)) return review(`--sha must be a hex sha, got ${sha ?? "nothing"}`);
  if (runIdArg === null) return review("--run-id <id> is required");
  const thisRunId = Number(runIdArg);
  if (!Number.isInteger(thisRunId) || thisRunId <= 0) return review(`--run-id must be a positive integer, got ${runIdArg}`);

  // The reviewer workflow's id, DERIVED — never a pasted number (working law 4).
  let workflowId: number;
  try {
    const found = api<{ workflows: Array<{ id: number; path: string }> }>(
      "repos/:owner/:repo/actions/workflows?per_page=100",
    ).workflows.find((w) => w.path === REVIEWER_WORKFLOW_PATH);
    if (!found) return review(`no workflow at ${REVIEWER_WORKFLOW_PATH}`);
    workflowId = found.id;
  } catch (error) {
    return review(`gh could not list workflows (${firstLine(error)})`);
  }

  let others: SameShaRunReading[];
  try {
    const runs = api<{ workflow_runs: Array<{ id: number; head_sha: string; status: string }> }>(
      `repos/:owner/:repo/actions/workflows/${workflowId}/runs?head_sha=${encodeURIComponent(sha)}&per_page=50`,
    ).workflow_runs;
    others = runs
      // The API filtered on head_sha; re-checked here so a server that ignored
      // the parameter cannot hand this decision a run from another commit.
      .filter((r) => r.head_sha.toLowerCase() === sha!.toLowerCase() && r.id !== thisRunId)
      .map((r) => {
        const jobs = api<{ jobs: Job[] }>(`repos/:owner/:repo/actions/runs/${r.id}/jobs?per_page=100`).jobs;
        const triage = jobs.find((j) => j.name === TRIAGE_JOB_NAME);
        const rev = jobs.find((j) => j.name === REVIEW_JOB_NAME);
        return {
          id: r.id,
          runStatus: r.status,
          triageJobStatus: triage?.status ?? null,
          triageJobConclusion: triage?.conclusion ?? null,
          reviewJobStatus: rev?.status ?? null,
          reviewJobConclusion: rev?.conclusion ?? null,
        };
      });
  } catch (error) {
    return review(`gh could not read the review runs on this sha (${firstLine(error)})`);
  }

  // The shell only calls this once it has established the diff earns a review
  // on its own; the decision still takes the fact as an argument so the arm
  // that drives it can prove the other answer.
  const decision = decideLabelDedupe({ thisRunId, meritsReview: true, others });
  if (decision.kind === "skip") {
    console.log(`review-label-dedupe: SKIPPING — ${decision.reason}`);
    console.log("dedupe=skip");
    return;
  }
  return review(decision.reason);
}

main(process.argv.slice(2));
process.exit(0);
