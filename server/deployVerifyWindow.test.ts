/**
 * #1518 — deploy-verify MAY NOT GO RED ON A DEPLOY THAT IS MERELY SLOW.
 *
 * The job waited a flat 15 minutes for production to serve the pushed sha and
 * then asserted a cause it could not see: *"This merge did NOT become live — a
 * failed build, a healthcheck refusal, or Railway missed the push."* On the night
 * it was measured the real cause was none of those three — the build was still
 * running — so the sentence was false and the red was a false alarm.
 *
 * Read at the artifact (`scripts/_1518-deployment-states-disposable.mts`, every
 * GitHub Deployment Railway posted on 2026-09-29):
 *
 *   quiet periods, 20 deploys      90s – 126s   (1.5 – 2.1 min)
 *   the 15:49–18:19 merge burst    671s – 2479s (11.2 – 41.3 min)
 *
 * **SIX of 26 successful deploys crossed the 15-minute window**, two of them at
 * FORTY-ONE minutes; the card said two runs. Two false reds confirmed at the
 * statuses: `b3624986` went `in_progress 17:31:16Z → success 17:50:33Z` while
 * deploy-verify said "never served" at 17:46:22Z, four minutes early; `466cf03e`
 * succeeded at 17:01:28Z against a red at 16:48:32Z, thirteen minutes early.
 *
 * # What these arms hold, and what they cannot
 *
 * The verdict logic is inline bash in a workflow. No vitest suite can execute it
 * — `actionlint` only proves it parses — so the arms here are structural, and the
 * BEHAVIOUR is driven separately by
 * `scripts/_1518-drive-verdicts-disposable.mts`, which extracts this very step's
 * `run:` block out of the YAML (never a retyped copy) and runs it against faked
 * `curl`, `gh`, `jq` and `sleep` over nine cases: live · slow-then-live ·
 * Railway failure · superseded · inactive-before-live · still-building at the
 * ceiling · no deployment record · an unknown state at the ceiling · an unknown
 * state with time left.
 *
 * ⚠ The one thing NOTHING here can reproduce is the old defect itself: showing
 * that a 15-minute window reds a 19-minute build needs 19 minutes of real clock.
 * That claim rests on the deployment statuses quoted above, which is the right
 * evidence for it, and it is not restated as if a test proved it.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const read = (relative: string): string => readFileSync(resolve(ROOT, relative), "utf8");
const WORKFLOW = "deploy-verify.yml";
const yaml = read(`.github/workflows/${WORKFLOW}`);

/**
 * The workflow with its comments stripped — what actually EXECUTES.
 *
 * ⚠ EVERY ARM BELOW READS THIS AND NOT THE RAW FILE, AND IT TOOK TWO FAILURES IN
 * OPPOSITE DIRECTIONS TO GET HERE.
 *
 * **First, two NEGATIVE arms failed on the correctly repaired file**: the header
 * quotes the old assertion (*"This merge did NOT become live — a failed build…"*)
 * and the old cadence (`elapsed % 60`) in order to explain what changed, and a
 * substring arm read its own documentation as the breach. That is the
 * `negation-contains-the-token` class.
 *
 * ⚠ **Then a POSITIVE arm was caught by the sabotage driver doing the mirror
 * image, which is the worse half.** Case 3 deletes `deployments: read` from the
 * permissions block — and the arm stayed GREEN, because the header explains that
 * the job *"needs only `deployments: read` on the GITHUB_TOKEN"*. **The guard was
 * satisfied by its own prose while the permission it guards was gone.** A negative
 * arm reading prose is noisy; a positive one reading prose is blind, and blind is
 * how a control comes to exist only on paper (invariant 7).
 *
 * So the rule is not "strip comments for the not-arms" — it is that an arm about
 * what this workflow DOES looks only where doing happens.
 *
 * Comment lines only: a trailing `#` inside a bash string would be mangled by a
 * cleverer strip, and no arm here needs one.
 */
const executable = yaml
  .split(/\r?\n/)
  .filter((line) => !/^\s*#/.test(line))
  .join("\n");

/** The ceiling the job declares, in minutes, read out of the YAML. */
function declaredCeilingMinutes(): number {
  const m = /CEILING_MINUTES:\s*"(\d+)"/.exec(executable);
  expect(m, "the job declares no CEILING_MINUTES").not.toBeNull();
  return Number(m![1]!);
}

/** `timeout-minutes` on the verify job. */
function jobTimeoutMinutes(): number {
  const m = /timeout-minutes:\s*(\d+)/.exec(executable);
  expect(m, "the job declares no timeout-minutes").not.toBeNull();
  return Number(m![1]!);
}

describe("the window is wide enough for a deploy that really happened", () => {
  it("the ceiling clears the slowest deploy on record, with headroom", () => {
    /*
      41.3 minutes is the slowest SUCCESSFUL deploy measured (466cf03e / 04f234d0
      on 2026-09-29). A ceiling at or below that reproduces the defect; a ceiling
      only just above it reproduces it on the next worse night. The figure is
      stated here rather than imported because it is a historical MEASUREMENT and
      not a value the code derives — if it is ever re-measured higher, this arm is
      what says the ceiling must move with it.
    */
    const SLOWEST_MEASURED_MINUTES = 41.3;
    expect(declaredCeilingMinutes()).toBeGreaterThan(SLOWEST_MEASURED_MINUTES);
  });

  it("⚠ the JOB timeout is above the ceiling — the silent half of this defect", () => {
    /*
      `timeout-minutes` was 20 while the loop's deadline was 15. Raising the loop
      alone would have had the JOB killed at 20 minutes with no message at all —
      a worse verdict than the wrong one it replaced, and nothing in the card
      mentioned it. The relationship is pinned, not the pair of numbers, so either
      may move as long as the job outlives its own wait.
    */
    expect(jobTimeoutMinutes()).toBeGreaterThan(declaredCeilingMinutes());
  });

  it("the ceiling is read from one place, not written twice", () => {
    /* A second copy of the number in the message is how a raised ceiling comes to
       report the old one. The message interpolates it. */
    expect(executable).toContain("within ${CEILING_MINUTES} minutes");
    expect(executable, "a hard-coded 15-minute deadline is back").not.toMatch(/\+\s*15\s*\*\s*60/);
  });
});

describe("it tells still-building from never-served", () => {
  it("it reads Railway's own deployment state, with no third-party secret", () => {
    /*
      ⚠ The card suggested the Railway CLI, "no secret beyond the token the job
      may already hold". There is no such token: `gh secret list` is
      CLAUDE_CODE_OAUTH_TOKEN and SOCKET_CLI_API_TOKEN, and no workflow mentions
      RAILWAY. Railway's GitHub integration posts a GitHub Deployment per sha
      instead, which `deployments: read` on the existing GITHUB_TOKEN can read.
    */
    expect(executable).toContain("deployments: read");
    expect(executable).toContain("deployments?sha=");
    expect(executable).toContain("/statuses");
    /* And no Railway credential appears anywhere in it. */
    expect(executable).not.toContain("RAILWAY_TOKEN");
    expect(executable).not.toMatch(/secrets\./);
  });

  it("a real build failure refuses AT ONCE rather than at the ceiling", () => {
    /* The improvement that is not about the window at all: a failed build used to
       burn the whole wait before saying anything. */
    expect(executable).toMatch(/failure\|error\)/);
    expect(executable).toContain("Railway reported the deployment");
  });

  it("the exhaustion message reports what was READ, never a cause it cannot see", () => {
    /* The old sentence asserted the merge did not become live and offered three
       causes. The new one names the observed state and what it cannot tell. */
    expect(executable, "the sentence that was false on a slow build is back").not.toContain(
      "This merge did NOT become live — a failed build",
    );
    expect(executable).toContain("Railway's deployment state for this commit");
    expect(executable).toContain("STILL BUILDING");
    expect(executable).toContain("NO Railway deployment was ever recorded");
    expect(executable).toContain("What this job cannot tell you");
  });

  it("⚠ an unrecognised Railway state WAITS — it can never become a new false red", () => {
    /*
      THE FAILURE DIRECTION, AND IT IS THE WHOLE POINT OF THE CHANGE. The state
      vocabulary was measured across 30 deployments and is `in_progress`,
      `success`, `inactive`. **No `failure` or `error` was observed**, so what
      Railway posts on a failed build is NOT confirmed — which means the branches
      must be written so that an unknown state cannot refuse. Only `failure` and
      `error` end the wait early; everything else falls through to the ceiling,
      where the message names the state rather than diagnosing it.
    */
    const cases = [...executable.matchAll(/^\s{14}([a-z_|]+)\)$/gm)].map((m) => m[1]!);
    expect(cases.length, "the case arms could not be found — this arm is measuring nothing")
      .toBeGreaterThan(0);
    const endsTheWaitEarly = cases.filter((c) => c !== "inactive");
    expect(endsTheWaitEarly).toEqual(["failure|error"]);
    expect(executable).toContain("does not have a branch for");
  });

  it("a superseded push is still green, on both roads", () => {
    expect(executable).toContain("superseded: production serves");
    expect(executable).toContain("superseded during confirmation");
    expect(executable).toContain("superseded before going live");
  });
});

describe("it does not spend the shared GitHub budget by the second", () => {
  it("the API reads are throttled and the health read is not", () => {
    /*
      Every `gh api` spends the ONE account's hourly budget, which the builder
      seats have tripped three times in an evening. Raising the ceiling from 15 to
      60 minutes would have quadrupled what this job already spent on its
      supersede check, so the GitHub reads moved to once a minute while the health
      read — our own service, free — stays at 15 seconds.
    */
    expect(executable).toContain("next_github=$(( now + 60 ))");
    expect(executable).toContain("sleep 15");
  });

  it("⚠ the cadence is a timestamp, never a modulo on elapsed", () => {
    /* `elapsed % 60 -lt 15` assumes every pass takes exactly 15s. A pass costing
       15–20s lands on 58s then 76s and skips the window entirely, which reads as
       a state that never changed. */
    expect(executable).not.toMatch(/elapsed\s*%\s*60/);
    expect(executable).not.toMatch(/elapsed\s*%\s*120/);
    expect(executable).toContain("next_progress=$(( now + 120 ))");
  });
});
