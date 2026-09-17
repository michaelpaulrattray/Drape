/**
 * ONE VERDICT PER HEAD SHA (#1026) — the decision, and its call site.
 *
 * A PR marked ready and labelled `needs-fable` in the same breath fires two
 * `review.yml` runs on one sha, and the concurrency key keeps both alive on
 * purpose (#434). Measured over the 500 newest review runs, each run's `review`
 * job read from the jobs API: four doubled shas (#680, #1007, #1023, #1024),
 * the two runs 36 s, 1 s, 2 s and 1 s apart, $17.19 on the last two — against
 * the founder's standing word on doubled reviews.
 *
 * The repair is a question the `labeled` run asks before it spends, and this
 * suite holds it to the one property that matters more than saving money:
 *
 * ⚠ IT MAY SPEND, IT MAY NEVER SILENCE. Every arm in the "negative" block is a
 * case where the decision must say `review`, and each is a real state the
 * artifacts have shown: a run whose triage was skipped (a `labeled urgent` run,
 * a draft), a run whose review job failed on the allowance (#219) or was
 * cancelled (#434), a run listed before its jobs exist, no other run at all,
 * a trivial diff (where the label is the only review there will be). The
 * "positive" block is the four measured doubles, in the shapes the API
 * returns them: a sibling triage still evaluating, a sibling review queued or
 * running, a sibling verdict already produced.
 *
 * Then the chain (invariant 7): review.yml calls the script, the script calls
 * the decision, the triage job can read the runs it asks about, and the
 * inputs travel through `env` rather than the run block. A decision with no
 * caller is how CLAUDE.md's "Currently not enforced" list was filled.
 *
 * Every chain arm reads an artifact. Nothing here is a fixture of the workflow.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  type SameShaRunReading,
  decideLabelDedupe,
  sameShaRunStandsIn,
} from "../scripts/lib/reviewRounds.mts";

const ROOT = join(__dirname, "..");
const REVIEW_YML = ".github/workflows/review.yml";
const DEDUPE_SCRIPT = "scripts/review-label-dedupe.mts";

const reviewYml = readFileSync(join(ROOT, REVIEW_YML), "utf8");
const dedupe = readFileSync(join(ROOT, DEDUPE_SCRIPT), "utf8");

const THIS_RUN = 35159143054; // PR #1023's `labeled` run — the second of the measured pair.

function run(over: Partial<SameShaRunReading> & { id: number }): SameShaRunReading {
  return {
    runStatus: "completed",
    triageJobStatus: "completed",
    triageJobConclusion: "success",
    reviewJobStatus: "completed",
    reviewJobConclusion: "success",
    ...over,
  };
}

describe("positive: the measured doubles are caught", () => {
  it("a sibling run still evaluating this sha (triage in progress, no review job yet) stands in", () => {
    // PR #1023: 35159141107 was created two seconds before this run and its
    // triage was still checking out when this one asked.
    const sibling = run({
      id: 35159141107,
      runStatus: "in_progress",
      triageJobStatus: "in_progress",
      triageJobConclusion: null,
      reviewJobStatus: null,
      reviewJobConclusion: null,
    });
    const decided = decideLabelDedupe({ thisRunId: THIS_RUN, meritsReview: true, others: [sibling] });
    expect(decided.kind).toBe("skip");
    if (decided.kind === "skip") expect(decided.byRun).toBe(35159141107);
  });

  it("a sibling whose review job is queued or running stands in", () => {
    for (const status of ["queued", "in_progress"]) {
      const sibling = run({
        id: 35159141107,
        runStatus: "in_progress",
        reviewJobStatus: status,
        reviewJobConclusion: null,
      });
      expect(decideLabelDedupe({ thisRunId: THIS_RUN, meritsReview: true, others: [sibling] }).kind).toBe("skip");
    }
  });

  it("a sibling that already produced a verdict stands in (the 36-second case, #680)", () => {
    const sibling = run({ id: 34211491222 });
    const decided = decideLabelDedupe({ thisRunId: 34211543915, meritsReview: true, others: [sibling] });
    expect(decided.kind).toBe("skip");
    if (decided.kind === "skip") expect(decided.reason).toContain("verdict");
  });

  it("with several siblings, the oldest one that stands in is the one cited", () => {
    const older = run({ id: 100, triageJobStatus: "completed", triageJobConclusion: "skipped" });
    const stands = run({ id: 200 });
    const later = run({ id: 300 });
    const decided = decideLabelDedupe({ thisRunId: 400, meritsReview: true, others: [later, stands, older] });
    expect(decided.kind).toBe("skip");
    if (decided.kind === "skip") expect(decided.byRun).toBe(200);
  });
});

describe("negative: every unknown resolves to review — it may spend, never silence", () => {
  it("no other run on this sha → review", () => {
    const decided = decideLabelDedupe({ thisRunId: THIS_RUN, meritsReview: true, others: [] });
    expect(decided.kind).toBe("review");
    expect(decided.reason).toContain("no other review run");
  });

  it("the only run listed is this run itself → review (it never counts itself)", () => {
    const self = run({ id: THIS_RUN, runStatus: "in_progress", triageJobStatus: "in_progress", triageJobConclusion: null, reviewJobStatus: null, reviewJobConclusion: null });
    expect(decideLabelDedupe({ thisRunId: THIS_RUN, meritsReview: true, others: [self] }).kind).toBe("review");
  });

  it("a trivial diff never dedupes, whatever the siblings say — the label IS the escalation there", () => {
    const sibling = run({ id: 35159141107 });
    const decided = decideLabelDedupe({ thisRunId: THIS_RUN, meritsReview: false, others: [sibling] });
    expect(decided.kind).toBe("review");
    expect(decided.reason).toContain("own merits");
  });

  it("a sibling listed before its jobs exist → review (not known to be reviewing)", () => {
    const queued = run({
      id: 35159141107,
      runStatus: "queued",
      triageJobStatus: null,
      triageJobConclusion: null,
      reviewJobStatus: null,
      reviewJobConclusion: null,
    });
    expect(sameShaRunStandsIn(queued).standsIn).toBe(false);
    expect(decideLabelDedupe({ thisRunId: THIS_RUN, meritsReview: true, others: [queued] }).kind).toBe("review");
  });

  it("a sibling whose triage was SKIPPED (a `labeled urgent` run, a draft) → review", () => {
    const urgent = run({
      id: 35159127765, // PR #1023's own `labeled` run for another label, skipped.
      triageJobStatus: "completed",
      triageJobConclusion: "skipped",
      reviewJobStatus: "completed",
      reviewJobConclusion: "skipped",
    });
    expect(decideLabelDedupe({ thisRunId: THIS_RUN, meritsReview: true, others: [urgent] }).kind).toBe("review");
  });

  it("a sibling whose triage failed or was cancelled → review", () => {
    for (const conclusion of ["failure", "cancelled"]) {
      const sibling = run({
        id: 35159141107,
        triageJobStatus: "completed",
        triageJobConclusion: conclusion,
        reviewJobStatus: "completed",
        reviewJobConclusion: "skipped",
      });
      expect(decideLabelDedupe({ thisRunId: THIS_RUN, meritsReview: true, others: [sibling] }).kind).toBe("review");
    }
  });

  it("a sibling whose review job FAILED (#219) or was CANCELLED (#434) → review; the label is the retry road", () => {
    for (const conclusion of ["failure", "cancelled", "timed_out"]) {
      const sibling = run({ id: 35159141107, reviewJobConclusion: conclusion });
      const decided = decideLabelDedupe({ thisRunId: THIS_RUN, meritsReview: true, others: [sibling] });
      expect(decided.kind, conclusion).toBe("review");
      expect(decided.reason).toContain("no verdict");
    }
  });

  it("a sibling whose triage DECLINED this sha (review job skipped) → review; the two readings disagreed", () => {
    const sibling = run({ id: 35159141107, reviewJobConclusion: "skipped" });
    expect(decideLabelDedupe({ thisRunId: THIS_RUN, meritsReview: true, others: [sibling] }).kind).toBe("review");
  });

  it("a sibling whose triage finished with no review job listed → review (unknown)", () => {
    const sibling = run({ id: 35159141107, reviewJobStatus: null, reviewJobConclusion: null });
    expect(decideLabelDedupe({ thisRunId: THIS_RUN, meritsReview: true, others: [sibling] }).kind).toBe("review");
  });

  it("the review reason names each sibling and why it did not stand in", () => {
    const a = run({ id: 1, triageJobStatus: "completed", triageJobConclusion: "skipped" });
    const b = run({ id: 2, reviewJobConclusion: "failure" });
    const decided = decideLabelDedupe({ thisRunId: 3, meritsReview: true, others: [a, b] });
    expect(decided.kind).toBe("review");
    expect(decided.reason).toContain("1:");
    expect(decided.reason).toContain("2:");
  });
});

describe("the question has a call site (invariant 7)", () => {
  const decideStep = (() => {
    const start = reviewYml.indexOf("- name: Decide whether this diff earns a Fable review");
    if (start === -1) throw new Error("review.yml has no decide step");
    const rest = reviewYml.slice(start);
    const end = rest.indexOf("\n  review:");
    return end === -1 ? rest : rest.slice(0, end);
  })();

  it("review.yml's triage runs the dedupe script under bare node", () => {
    expect(decideStep).toMatch(/node scripts\/review-label-dedupe\.mts --sha "\$HEAD_SHA" --run-id "\$RUN_ID"/);
    expect(reviewYml).not.toContain(`npx tsx ${DEDUPE_SCRIPT}`);
  });

  it("only on a `labeled` event, and only when the diff earns a review on its own merits", () => {
    // The guard is the whole safety of the thing: a trivial diff's label run
    // must never reach the question, because it is the only review there is.
    expect(decideStep).toMatch(
      /if \[ "\$EVENT_ACTION" = "labeled" \] && \{ \[ "\$MONEY" = "yes" \] \|\| \[ "\$LINES" -ge 50 \]; \}; then/,
    );
    // And the merits reading comes BEFORE the money/label exits it used to
    // sit after — otherwise LINES is unset on the path that needs it.
    const merits = decideStep.indexOf('LINES=$(echo "$CODE"');
    const question = decideStep.indexOf("review-label-dedupe.mts");
    const moneyExit = decideStep.indexOf('if [ "$MONEY" = "yes" ]; then');
    expect(merits).toBeGreaterThan(-1);
    expect(merits).toBeLessThan(question);
    expect(question).toBeLessThan(moneyExit);
  });

  it("a `skip` answer is read as the exact line, and anything else falls through to review", () => {
    expect(decideStep).toContain("grep -qx 'dedupe=skip'");
    // `|| true` on the call: a node that cannot run the script must not fail
    // triage — it must fall through, which is "review".
    expect(decideStep).toMatch(/review-label-dedupe\.mts[^\n]*\|\| true\)/);
  });

  it("the skip names its remedy, because a silenced review needs a road back (#368)", () => {
    expect(decideStep).toContain("remove and re-add needs-fable (#368)");
  });

  it("⚠ the inputs travel through `env`, never interpolated into the run block", () => {
    // zizmor's template-injection audit: a `${{ … }}` inside `run:` is textual
    // substitution into the shell. Workflow linters are on preflight's excused
    // list, so the arm lives here.
    expect(decideStep).toMatch(/EVENT_ACTION: \$\{\{ github\.event\.action \}\}/);
    expect(decideStep).toMatch(/HEAD_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
    expect(decideStep).toMatch(/RUN_ID: \$\{\{ github\.run_id \}\}/);
    expect(decideStep).toMatch(/GH_TOKEN: \$\{\{ github\.token \}\}/);
    const runBlock = decideStep.slice(decideStep.indexOf("run: |"));
    expect(runBlock).not.toContain("${{");
  });

  it("the triage job can read the runs it asks about (`actions: read`)", () => {
    const triageJob = reviewYml.slice(reviewYml.indexOf("\n  triage:"), reviewYml.indexOf("\n  review:"));
    expect(triageJob).toMatch(/permissions:\s*\n\s*contents: read\s*\n\s*actions: read/);
  });

  it("and sets up a node that can strip types, without failing triage if it cannot", () => {
    const triageJob = reviewYml.slice(reviewYml.indexOf("\n  triage:"), reviewYml.indexOf("\n  review:"));
    expect(triageJob).toMatch(/actions\/setup-node@[0-9a-f]{40}[^\n]*\n\s*continue-on-error: true\n\s*with:\n\s*node-version:\s*2[4-9]/);
  });

  it("the script calls the shared decision — not a copy of the rule", () => {
    expect(dedupe).toContain("decideLabelDedupe");
    expect(dedupe).toContain('from "./lib/reviewRounds.mts"');
    // It prints exactly the two lines the shell reads, and nothing it prints
    // on a failure path is the skip line.
    expect(dedupe).toContain('console.log("dedupe=skip")');
    expect(dedupe).toContain('console.log("dedupe=review")');
    expect(dedupe.match(/console\.log\("dedupe=skip"\)/g)).toHaveLength(1);
  });

  it("the script imports nothing outside node's standard library", () => {
    const specifiers = [...dedupe.matchAll(/^import[^"']*["']([^"']+)["']/gm)].map((m) => m[1]!);
    expect(specifiers.length).toBeGreaterThan(0);
    for (const specifier of specifiers) {
      expect(
        specifier.startsWith("node:") || specifier.startsWith("./") || specifier.startsWith("../"),
        `${DEDUPE_SCRIPT} imports ${specifier}, which the triage job has no install for`,
      ).toBe(true);
    }
  });
});
