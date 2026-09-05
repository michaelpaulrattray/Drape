/**
 * THE SECOND REVIEW ROUND SAYS SO (#543 item 5, founder-ordered and urgent).
 *
 * Run as the last step of the `review` job, on the run that has just produced
 * a verdict. When that verdict is the SECOND for this pull request, it posts
 * one line saying the round is the last and how a third is asked for.
 *
 *     node scripts/review-round-notice.mts --pr 558 [--dry-run]
 *
 * WHY. The investigation behind this card measured the reviewer at 1.3 runs
 * per PR — but **7 of the last 25 merged PRs took two or more rounds**, and
 * that tail is the whole gap between the 27-minute median wait and the
 * 42-minute mean. The card's rule: *"the reviewer's second round becomes the
 * last, mechanically."* A third round means the change is not understood —
 * stop, card it with the reviewer's words, and move on.
 *
 * ⚠ IT IS A NOTICE, NOT A BLOCK, AND THAT IS DELIBERATE. It cannot fail the
 * job (`continue-on-error` at the step, and every path here exits 0). A cap
 * that could refuse would be a control standing between a diff and a review it
 * might genuinely need; the shift's own judgement stays the thing that stops,
 * and this makes the count visible at the moment it matters instead of leaving
 * it to be remembered.
 *
 * ⚠ IT COUNTS VERDICTS, NEVER ATTEMPTS. A run that produced no verdict — the
 * Fable allowance running out (#219), a cancelled run (#434), the reviewer
 * refusing its own change (#165) — judged nothing, and counting it would let
 * an OUTAGE spend one of the two rounds a shift is allowed. The counting rule
 * lives in `scripts/lib/reviewRounds.mts` beside the merge tool that reads the
 * same fact (#543 item 3), so the two cannot drift into two answers.
 *
 * ⚠ IT RUNS UNDER BARE NODE, NOT `npx tsx`. Node 24 strips types natively and
 * the shared reader imports nothing outside the standard library, so the step
 * needs no dependency install inside the review job — the same reason
 * `gate.yml` reaches for `setup-node` rather than a package install for its own
 * cheap steps.
 *
 * Read-only except for one PR comment. No database, no production, no deploy.
 */
import { execFileSync } from "node:child_process";

import {
  type ReviewRunReading,
  alreadyNoticed,
  decideRoundNotice,
  roundNoticeBody,
  tallyRounds,
} from "./lib/reviewRounds.mts";

const REVIEWER_WORKFLOW_PATH = ".github/workflows/review.yml";
const REVIEW_JOB_NAME = "review";

const HELP = [
  "review-round-notice — post the final-round line when a PR earns its second verdict",
  "",
  "  --pr <n>     the pull request (required)",
  "  --dry-run    print what would be posted; post nothing",
  "",
  "Always exits 0: it runs inside the review job and must never change that check.",
].join("\n");

function gh(args: string[]): string {
  return execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function api<T>(path: string): T {
  return JSON.parse(gh(["api", path])) as T;
}

const firstLine = (error: unknown) => String((error as Error).message ?? error).split("\n")[0];

/**
 * ⚠ NOTHING HERE EXITS EARLY. EVERY exit is 0: this runs inside the review
 * job, and a bookkeeping step that could redden the `review` check would give
 * that check a third meaning, when its two (#219 — a verdict exists, or none
 * does) are already the subtlest reading on a PR's checks page. So the whole
 * flow is a function that RETURNS, and the single `process.exit(0)` the script
 * guards require sits after it.
 *
 * ⚠ A WINDOWS-ONLY NOISE, MEASURED AND ATTRIBUTED RATHER THAN LEFT TO ALARM A
 * LATER SHIFT. Under BARE node on Windows (v24.18.0), a script that reaches
 * `process.exit(0)` without having spawned a child aborts with
 * `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), src\win\async.c` and
 * status 127, after printing correctly. ⚠ IT IS NOT THIS SCRIPT: the same run
 * under `tsx` exits 0, and `scripts/gate-stall-check.mts --help` — merged weeks
 * ago — reproduces it identically under bare node. It is node's own
 * type-stripping path on Windows, the review job runs on Linux, and the step is
 * `continue-on-error`, so it cannot touch the check either way. Recorded here
 * so nobody diagnoses it twice.
 */
function main(argv: readonly string[]): void {
  let prArg: string | null = null;
  let dryRun = false;
  const stop = (why: string) => {
    console.log(`review-round-notice: not posting — ${why}`);
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    if (a === "--pr") {
      const value = argv[(i += 1)];
      if (value === undefined) return stop("--pr needs a value");
      prArg = value;
    } else if (a === "--dry-run") {
      dryRun = true;
    } else if (a === "--help" || a === "-h") {
      console.log(HELP);
      return;
    } else {
      return stop(`unknown flag ${a}`);
    }
  }
  if (prArg === null) return stop("--pr <n> is required");
  const pr = Number(prArg);
  if (!Number.isInteger(pr) || pr <= 0) return stop(`--pr must be a positive integer, got ${prArg}`);

  let view: { number: number; headRefName: string; createdAt: string };
  try {
    view = JSON.parse(
      gh(["pr", "view", String(pr), "--json", "number,headRefName,createdAt"]),
    ) as typeof view;
  } catch (error) {
    return stop(`gh pr view failed (${firstLine(error)})`);
  }

  // The reviewer workflow's id, DERIVED — never a pasted number (working law 4).
  let workflowId: number;
  try {
    const found = api<{ workflows: Array<{ id: number; path: string }> }>(
      "repos/:owner/:repo/actions/workflows?per_page=100",
    ).workflows.find((w) => w.path === REVIEWER_WORKFLOW_PATH);
    if (!found) return stop(`no workflow at ${REVIEWER_WORKFLOW_PATH}`);
    workflowId = found.id;
  } catch (error) {
    return stop(`gh could not list workflows (${firstLine(error)})`);
  }

  let runs: ReviewRunReading[];
  try {
    runs = api<{
      workflow_runs: Array<{ id: number; head_branch: string; created_at: string; status: string }>;
    }>(
      `repos/:owner/:repo/actions/workflows/${workflowId}/runs` +
        `?branch=${encodeURIComponent(view.headRefName)}&per_page=100`,
    ).workflow_runs.map((r) => {
      // A queued run has no jobs yet; asking for them costs a call that can
      // only answer "not started", which the run's own status already says.
      if (r.status !== "completed") {
        return {
          id: r.id,
          headBranch: r.head_branch,
          createdAt: r.created_at,
          runStatus: r.status,
          reviewJobStatus: null,
          reviewJobConclusion: null,
        };
      }
      const job = api<{ jobs: Array<{ name: string; status: string; conclusion: string | null }> }>(
        `repos/:owner/:repo/actions/runs/${r.id}/jobs?per_page=100`,
      ).jobs.find((j) => j.name === REVIEW_JOB_NAME);
      return {
        id: r.id,
        headBranch: r.head_branch,
        createdAt: r.created_at,
        runStatus: r.status,
        reviewJobStatus: job?.status ?? null,
        reviewJobConclusion: job?.conclusion ?? null,
      };
    });
  } catch (error) {
    return stop(`gh could not read the review runs (${firstLine(error)})`);
  }

  const tally = tallyRounds(runs, {
    number: view.number,
    headRefName: view.headRefName,
    createdAt: view.createdAt,
  });
  const notice = decideRoundNotice(tally.verdicts.length);

  console.log(
    `review-round-notice: PR #${pr} on ${view.headRefName} — ` +
      `${tally.verdicts.length} verdict(s), ${tally.noVerdicts.length} run(s) with none, ` +
      `${tally.declined.length} declined, ${tally.pending.length} pending`,
  );

  if (notice.kind === "silent") {
    console.log(`review-round-notice: round ${tally.verdicts.length} — nothing to say.`);
    return;
  }

  // ⚠ ONCE PER PR, EVER — the decision and its marker live in the shared lib,
  // so the suite can drive them. Putting them here made a sabotage that
  // deleted the whole check redden nothing.
  let already: boolean;
  try {
    already = alreadyNoticed(
      api<Array<{ body: string }>>(`repos/:owner/:repo/issues/${pr}/comments?per_page=100`).map(
        (c) => c.body,
      ),
    );
  } catch (error) {
    return stop(`gh could not read the PR's comments (${firstLine(error)})`);
  }
  if (already) {
    console.log("review-round-notice: already posted on this PR — saying it once is the point.");
    return;
  }

  const body = roundNoticeBody(notice);
  if (dryRun) {
    console.log(`review-round-notice: DRY RUN — would post:\n${body}`);
    return;
  }
  try {
    gh(["pr", "comment", String(pr), "--body", body]);
    console.log(`review-round-notice: posted the final-round line on #${pr}.`);
  } catch (error) {
    return stop(`gh pr comment failed (${firstLine(error)})`);
  }
}

main(process.argv.slice(2));
process.exit(0);
