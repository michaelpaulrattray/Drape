/**
 * THE STALL ALARM — is the gate still running, or will it never arrive? (#368)
 *
 * A shift that pushes and waits cannot tell those two apart from the outside:
 * both look like silence. On 2026-08-26 a shift burned ~40 minutes waiting on
 * a check suite GitHub never created. This is the reading that ends that wait.
 *
 *     npx tsx scripts/gate-stall-check.mts --pr 368
 *     npx tsx scripts/gate-stall-check.mts --pr 368 --watch
 *
 * `--watch` polls in the FOREGROUND, which is the only kind of waiting a
 * headless shift may do: ending the turn to wait for a notification kills the
 * session (four seats lost in one morning, 2026-08-26).
 *
 * EXIT CODES — the finding is the exit code, so a shell loop can act on it:
 *     0  a gate run exists (running, or completed) or the push is still
 *        inside the measured window
 *     2  STALL — the finding. Stop waiting, write it to the mailbox and to
 *        the briefing's `problems`, move to other work. It is NOT a failure
 *        of the shift and NOT a licence to retry (the card is explicit on
 *        both: the 2026-08-26 cause was never established, and a silent retry
 *        against an unknown fault is how a stall becomes a loop).
 *     3  the push could not be dated — no verdict, read the PR by hand
 *     4  --watch gave up with the run still alive (not a stall; say so)
 *     1  tool error
 *
 * The threshold and its three-round measurement live in `lib/gateStall.mts`,
 * beside the decision they set. Read that header before changing either.
 *
 * Read-only: `gh` against the GitHub REST API. No database, no writes, no
 * token beyond the one `gh` already holds.
 */
import { execFileSync } from "node:child_process";

import {
  GATE_DURATION,
  NO_SUITE_FINDING_MS,
  decideStall,
  describeVerdict,
  type GateRun,
  type StallVerdict,
} from "./lib/gateStall.mts";

const GATE_WORKFLOW_PATH = ".github/workflows/gate.yml";

function gh(args: string[]): string {
  return execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function api<T>(path: string): T {
  return JSON.parse(gh(["api", path])) as T;
}

function fail(message: string): never {
  console.error(`gate-stall-check: ${message}`);
  process.exit(1);
}

// ---- arguments ------------------------------------------------------------
// Refusing an unknown flag rather than ignoring it: a `--dry-run` that did not
// exist was silently ignored by a crew writer and closed a LIVE production row
// (#288/#289). A reader has less to lose than a writer and gets the same rule.
const argv = process.argv.slice(2);
let prArg: string | null = null;
let watch = false;
let intervalMs = 20_000;
let watchTimeoutMs = 30 * 60_000;

for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i]!;
  const next = () => argv[(i += 1)] ?? fail(`${a} needs a value`);
  switch (a) {
    case "--pr":
      prArg = next();
      break;
    case "--watch":
      watch = true;
      break;
    case "--interval":
      intervalMs = Number(next()) * 1000;
      break;
    case "--timeout":
      watchTimeoutMs = Number(next()) * 60_000;
      break;
    case "--help":
    case "-h":
      console.log(
        [
          "gate-stall-check — is the gate still running, or will it never arrive?",
          "",
          "  --pr <n>          the pull request to read (required)",
          "  --watch           poll in the foreground until it completes or stalls",
          "  --interval <s>    poll every s seconds (default 20)",
          "  --timeout <min>   give up watching after min minutes (default 30)",
          "",
          `finding line: no gate run ${NO_SUITE_FINDING_MS / 60_000} minutes after the push`,
          `gate duration, measured: p50 ${(GATE_DURATION.p50Ms / 60_000).toFixed(1)}m · p99 ${(GATE_DURATION.p99Ms / 60_000).toFixed(1)}m`,
        ].join("\n"),
      );
      process.exit(0);
      break;
    default:
      fail(`unknown flag ${a} — refusing rather than ignoring it (#289's class)`);
  }
}
if (prArg === null) fail("--pr <n> is required");
const pr = Number(prArg);
if (!Number.isInteger(pr) || pr <= 0) fail(`--pr must be a positive integer, got ${prArg}`);

// ---- the gate workflow's id, DERIVED ---------------------------------------
// Never a pasted number: a second copy of an id is a mirror of the workflow
// file and drifts from it the first time the workflow is recreated (law 4).
const workflows = api<{ workflows: Array<{ id: number; path: string; state: string }> }>(
  "repos/:owner/:repo/actions/workflows?per_page=100",
).workflows;
const gate = workflows.find((w) => w.path === GATE_WORKFLOW_PATH);
if (!gate) fail(`no workflow at ${GATE_WORKFLOW_PATH} — the gate has been renamed or removed`);
if (gate.state !== "active") {
  console.log(`NOTE: the gate workflow is '${gate.state}', not active. That alone explains silence.`);
}

type Suite = { created_at: string; app: { slug: string; name: string } | null };

function read(): { verdict: StallVerdict; sha: string; suites: Suite[]; runs: GateRun[] } {
  const head = JSON.parse(
    gh(["pr", "view", String(pr), "--json", "headRefOid,headRefName,isDraft,state"]),
  ) as { headRefOid: string; headRefName: string; isDraft: boolean; state: string };
  const sha = head.headRefOid;

  const runs = api<{ workflow_runs: Array<{ status: string; conclusion: string | null; created_at: string }> }>(
    `repos/:owner/:repo/actions/workflows/${gate!.id}/runs?head_sha=${sha}&per_page=50`,
  ).workflow_runs.map<GateRun>((r) => ({
    status: r.status,
    conclusion: r.conclusion,
    createdAt: r.created_at,
  }));

  const suites = api<{ check_suites: Suite[] }>(
    `repos/:owner/:repo/commits/${sha}/check-suites?per_page=100`,
  ).check_suites;

  // The push is dated the same way the threshold was measured: by the earliest
  // suite from an app that is NOT GitHub Actions. Those apps fire on the push
  // itself, so they date it from GitHub's own side rather than from a commit
  // timestamp the shift controls.
  const others = suites
    .filter((s) => s.app?.slug !== "github-actions")
    .map((s) => new Date(s.created_at).getTime())
    .sort((a, b) => a - b);
  const pushedAt = others.length > 0 ? new Date(others[0]!).toISOString() : null;

  return {
    verdict: decideStall({ runs, pushedAt, now: new Date().toISOString() }),
    sha,
    suites,
    runs,
  };
}

function banner(sha: string, suites: Suite[], runs: GateRun[]): void {
  const apps = [...new Set(suites.map((s) => s.app?.slug ?? "unknown"))].sort();
  console.log(`PR #${pr} · head ${sha.slice(0, 8)}`);
  console.log(`  check suites on this commit: ${suites.length} (${apps.join(", ") || "none"})`);
  console.log(`  gate runs for this commit:   ${runs.length}`);
}

const sleep = (n: number) => new Promise<void>((r) => setTimeout(r, n));

const first = read();
banner(first.sha, first.suites, first.runs);
console.log(describeVerdict(first.verdict));

if (!watch) {
  process.exit(
    first.verdict.kind === "stall" ? 2 : first.verdict.kind === "unknown-push" ? 3 : 0,
  );
}

// ---- foreground watch -----------------------------------------------------
const deadline = Date.now() + watchTimeoutMs;
let code = 4;
let current: StallVerdict = first.verdict;
while (current.kind !== "complete" && current.kind !== "stall" && current.kind !== "unknown-push") {
  if (Date.now() >= deadline) {
    console.log(
      `GAVE UP — watched ${(watchTimeoutMs / 60_000).toFixed(0)} minutes and the run is still alive. That is NOT a stall; the suite exists.`,
    );
    code = 4;
    break;
  }
  await sleep(intervalMs);
  const round = read();
  current = round.verdict;
  console.log(`[${new Date().toISOString()}] ${describeVerdict(current)}`);
}
if (current.kind === "complete") code = 0;
else if (current.kind === "stall") code = 2;
else if (current.kind === "unknown-push") code = 3;

process.exit(code);
