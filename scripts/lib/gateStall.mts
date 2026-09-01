/**
 * THE STALL ALARM — telling "the checks are still running" from "no checks
 * will ever run" (#368, founder-ordered 2026-09-01).
 *
 * THE INCIDENT. On 2026-08-26 from 13:44Z the Gate and Fable Review workflows
 * stopped producing runs for this repository entirely. Three consecutive
 * `pull_request` events on PR #78 — a push, a close/reopen and an empty
 * re-trigger commit — created NO check suite at all, while the Railway and
 * Claude apps both created theirs on the same commits. Workflows active,
 * Actions enabled, GitHub status green, workflow files unchanged. Branch
 * protection correctly refused the merge, so nothing unsafe happened; the
 * shift simply sat waiting ~40 minutes for a green that could not arrive.
 *
 * A shift cannot see the difference from the outside: waiting and stuck look
 * identical. Same class as the heartbeat (#295) and the silent-death guard
 * (#331) — a machine with no way to say it is stuck.
 *
 * WHAT THIS IS AND IS NOT. It produces a FINDING, never a failure and never a
 * retry (the card is explicit on both): the shift stops waiting, writes the
 * finding to the mailbox and to the briefing's problems, and moves to other
 * work. The 2026-08-26 cause was never established from outside GitHub, so a
 * silent auto-retry against an unknown fault is how a stall becomes a loop.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE THRESHOLD IS MEASURED, AND THE MEASUREMENT OVERTURNED THE CARD.
 *
 * The card proposed 10 minutes and said so honestly — *"a starting figure,
 * not a measurement … a threshold under the real p99 would alarm on healthy
 * runs"* — citing the gate taking ~6 minutes and having been seen at 13.
 *
 * ⚠ THOSE ARE DURATIONS, AND THIS ALARM DOES NOT KEY ON DURATION. It keys on
 * the check suite EXISTING. A run that has been going 15 minutes is alive and
 * must not alarm; the question is only whether GitHub created the run at all.
 * So the distribution to set the threshold from is `push → suite created`,
 * which nobody had ever measured. Three rounds, because two plausible proxies
 * were both wrong in the same direction — both made the gate look far slower
 * to start than it is, which would have set the threshold too high to fire:
 *
 *   1. head commit's committer date → run created. p99 = 693s. CONTAMINATED:
 *      a commit is authored when the shift wrote it and pushed when the shift
 *      finished, and a `git merge main` commit is dated at the merge. It
 *      measures shift behaviour, not GitHub.
 *   2. earliest non-Actions check suite on the same commit (Railway, Claude,
 *      created by GitHub at the push) → run created. p99 = 681s. STILL
 *      CONTAMINATED, and subtly: those apps fire on the BRANCH PUSH while our
 *      Gate fires on `pull_request`, so on a branch's first commit the offset
 *      contains however long the shift took to run `gh pr create`. All 19
 *      outliers were `team/*` first-pushes, which is the tell.
 *   3. the same reference, with the two populations SPLIT by grouping runs
 *      per branch — the first gate run on a branch is the PR-open case, every
 *      later one is the push-to-an-open-PR case.
 *
 * Round 3, over 253 distinct head commits from 2026-08-25 to 2026-09-01
 * (`gh api` workflow runs + per-commit check suites, 110 sampled, 0 without a
 * reference suite):
 *
 *   PUSH to an already-open PR   n=41   p50 4.0s   p99 5.0s   p100 5.0s
 *   FIRST push of a branch       n=69   p50 36.0s  p99 56.0s  p100 56.0s
 *
 * So the real figure is SECONDS, and the card's ten minutes is ~100× the p100
 * of the population it watches. The threshold here is FIVE MINUTES: 5.4× the
 * worst case ever observed across both populations and 60× the push case's,
 * which leaves an enormous margin for a GitHub slow patch while halving the
 * 40 minutes the incident burned. The card authorises exactly this move —
 * *"check it against the gate's own distribution before shipping"*.
 *
 * ⚠ THE SAMPLE IS OF HEALTHY RUNS BY CONSTRUCTION — a stalled commit has no
 * run and so cannot appear in a population read from runs. That is the right
 * methodology for setting a no-false-alarm threshold and the wrong one for
 * estimating how often stalls happen, and it is written down here so the
 * second question is never answered off the first one's number.
 *
 * GATE DURATION was measured in the same sitting, off 278 completed runs:
 * p50 7.3m · p95 14.0m · p99 15.1m · p100 15.4m. It sets no threshold here —
 * it is reported by the CLI so a shift watching a live run can see whether it
 * is inside the normal spread, and it is the fixture behind this module's
 * named positive control: a run 15.1 minutes old MUST NOT alarm.
 */

/** Push → gate suite created. 5.4× the p100 of the slower measured population. */
export const NO_SUITE_FINDING_MS = 5 * 60_000;

/** Measured 2026-09-01 over 278 completed, non-cancelled gate runs. */
export const GATE_DURATION = {
  p50Ms: 7.3 * 60_000,
  p95Ms: 14.0 * 60_000,
  p99Ms: 15.1 * 60_000,
  p100Ms: 15.4 * 60_000,
} as const;

/** Measured 2026-09-01, round 3. Kept so a later shift can re-measure against it. */
export const SUITE_CREATION = {
  pushP100Ms: 5_000,
  pushSample: 41,
  branchFirstP100Ms: 56_000,
  branchFirstSample: 69,
} as const;

export type GateRun = {
  /** GitHub's `status`: queued | in_progress | completed (and waiting/pending). */
  status: string;
  conclusion: string | null;
  /** ISO. When GitHub created the run — i.e. when the suite appeared. */
  createdAt: string;
};

export type StallInput = {
  /** Every Gate-workflow run GitHub holds for the PR's CURRENT head commit. */
  runs: readonly GateRun[];
  /**
   * When the head commit was pushed, ISO. Dated the way the measurement dated
   * it: the earliest check suite on the commit from an app that is not GitHub
   * Actions. `null` when no such suite exists — see `pushKnown` below.
   */
  pushedAt: string | null;
  /** ISO. The moment the reading is taken. */
  now: string;
};

export type StallVerdict =
  | { kind: "complete"; conclusion: string | null; ageMs: number }
  | { kind: "running"; ageMs: number; beyondP99: boolean }
  | { kind: "waiting"; sincePushMs: number; findingAtMs: number }
  | { kind: "stall"; sincePushMs: number; findingAtMs: number }
  | { kind: "unknown-push"; reason: string };

const ms = (a: string, b: string) => new Date(b).getTime() - new Date(a).getTime();

/**
 * The whole decision, as a pure function, because a polling loop is the
 * hardest thing in this repository to drive by hand (law 3).
 *
 * The order of the branches is the contract and is what keeps the card's
 * "a slow-but-alive gate does NOT alarm" bar true by construction: the
 * existence of a run is answered BEFORE the clock is ever consulted, so no
 * elapsed time can turn a live run into a stall.
 */
export function decideStall(input: StallInput): StallVerdict {
  const { runs, pushedAt, now } = input;

  // 1. A run exists. Whatever the clock says, this is not a stall — the suite
  //    arrived, which is the only thing this alarm is about.
  if (runs.length > 0) {
    // Newest first: a re-run supersedes the run it replaced.
    const newest = [...runs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0]!;
    const ageMs = ms(newest.createdAt, now);
    if (newest.status === "completed") {
      return { kind: "complete", conclusion: newest.conclusion, ageMs };
    }
    return { kind: "running", ageMs, beyondP99: ageMs > GATE_DURATION.p99Ms };
  }

  // 2. No run, and no way to date the push. Refusing to guess is the whole
  //    point: a wrong push time here either cries stall over a fresh push or
  //    sits silent over a dead one, and both are worse than saying so.
  if (pushedAt === null) {
    return {
      kind: "unknown-push",
      reason:
        "no non-Actions check suite on this commit, so the push cannot be dated from GitHub's own side",
    };
  }

  // 3. No run, push datable. The clock decides, and only here.
  const sincePushMs = ms(pushedAt, now);
  if (sincePushMs >= NO_SUITE_FINDING_MS) {
    return { kind: "stall", sincePushMs, findingAtMs: NO_SUITE_FINDING_MS };
  }
  return { kind: "waiting", sincePushMs, findingAtMs: NO_SUITE_FINDING_MS };
}

/** One line, in the words the mailbox entry and the briefing problem card use. */
export function describeVerdict(v: StallVerdict): string {
  const mins = (n: number) => `${(n / 60_000).toFixed(1)}m`;
  switch (v.kind) {
    case "complete":
      return `COMPLETE — the gate finished ${mins(v.ageMs)} ago: ${v.conclusion ?? "no conclusion"}.`;
    case "running":
      return v.beyondP99
        ? `RUNNING — ${mins(v.ageMs)} old, past the measured p99 (${mins(GATE_DURATION.p99Ms)}). Alive, not stalled; keep waiting or check the run.`
        : `RUNNING — ${mins(v.ageMs)} old, inside the measured spread (p50 ${mins(GATE_DURATION.p50Ms)}, p99 ${mins(GATE_DURATION.p99Ms)}). Keep waiting.`;
    case "waiting":
      return `WAITING — no gate run yet, ${mins(v.sincePushMs)} since the push. Normal below ${mins(v.findingAtMs)}.`;
    case "stall":
      return `STALL — no gate run exists ${mins(v.sincePushMs)} after the push, past the ${mins(v.findingAtMs)} finding line. STOP WAITING: write it to the mailbox and as a briefing problem, and move to other work. Do not retry blindly.`;
    case "unknown-push":
      return `UNKNOWN — ${v.reason}. No verdict; read the PR by hand rather than treating silence as either answer.`;
  }
}
