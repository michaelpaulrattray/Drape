import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  REVIEW_SIZE_DECLARATION_PATH,
  extractReviewNonCodePattern,
  extractReviewSizeLine,
} from "../scripts/lib/prMergeOrder.mts";

/**
 * TRIAGE CAN BE REACHED AGAIN, AND ITS SIZE RULE IS DECLARED ONCE (#1194).
 *
 * # The two halves of the card, and both are about an absence
 *
 * **A PR born CONFLICTING loses its triage for good.** `review.yml` triggered on
 * `opened` and `ready_for_review` only, and neither can fire again on a PR that
 * is already open and already ready — while a CONFLICTING PR gets no
 * `pull_request` workflow run for any event (#566). Measured on PR #1191:
 * opened as a draft `23:34:51Z`, marked ready `23:35:10Z`, and **no `Fable
 * Review` run created for either**, read at the Actions API over the whole
 * repository for that window. `gate.yml` recovered on its own because it also
 * triggers on `synchronize`; triage could not.
 *
 * ⚠ **And the documented recovery road had already closed.** The standing orders
 * say *"the Fable review's manual road is `gh pr edit <n> --add-label
 * needs-fable` and it works ONCE"*. It fired nothing: `review.yml` READS the
 * label as a reason a review is owed, but `labeled` left the trigger list at
 * #1065 when the label became triage's OUTPUT rather than its input. Two
 * documents described a road that did not exist.
 *
 * **And the size obligation had exactly one reader.** The money rule and the
 * reviewer-workflow rule are asked again by `pr-merge-in-order.mts`; the size
 * rule was not, so a large ordinary diff that lost its triage was announced to
 * nobody and the merge tool printed `review=declined` — the same word it uses
 * for a diff that genuinely earned no look.
 *
 * # WHY THESE ARMS ARE SOURCE READS
 *
 * A workflow's triggers cannot be driven from vitest: the only instrument that
 * could is GitHub creating a run, which is the thing that was missing. So the
 * arms read the workflow's own bytes — the same road
 * `moneySurfaceClassifier.test.ts` takes for the money declaration — and the
 * BEHAVIOUR half (the size reading) is driven directly in
 * `server/prMergeOrder.test.ts` against the real declaration.
 */

const repoRoot = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(repoRoot, rel), "utf8");
const reviewYml = read(".github/workflows/review.yml");
const gateYml = read(".github/workflows/gate.yml");
const mergeTool = read("scripts/pr-merge-in-order.mts");
const sizeDeclaration = read(REVIEW_SIZE_DECLARATION_PATH);

describe("the escalation label reaches triage again", () => {
  it("⚠ `labeled` is in the trigger list — the manual road the orders promise", () => {
    const on = /^on:\n([\s\S]*?)\n\n/m.exec(reviewYml);
    expect(on, "review.yml's `on:` block could not be found — this arm is measuring nothing").not.toBeNull();
    expect(on![1]).toMatch(/types:\s*\[[^\]]*\blabeled\b[^\]]*\]/);
    /* The two that were always there stay: a shift's own "this is finished". */
    expect(on![1]).toMatch(/\bopened\b/);
    expect(on![1]).toMatch(/\bready_for_review\b/);
  });

  it("⚠ NOT `synchronize` — that would undo the founder's once-per-PR ruling", () => {
    /* His ruling, 2026-08-26: reduce its frequency. `synchronize` re-runs triage
       on every push, which is the opposite, and the card names it as option A
       precisely because it is the tempting one. */
    const on = /^on:\n([\s\S]*?)\n\n/m.exec(reviewYml)![1]!;
    expect(on).not.toMatch(/\bsynchronize\b/);
  });

  it("⚠ a `labeled` run is triage ONLY for `needs-fable`", () => {
    /* The gate labels `founder-review` on money diffs and `review-skipped` on
       others, and both would otherwise buy a triage run to reach the same
       verdict. The guard is on the job, so the run is created and answers in
       seconds rather than doing the work. */
    expect(reviewYml).toMatch(/github\.event\.action != 'labeled'/);
    expect(reviewYml).toMatch(/github\.event\.label\.name == 'needs-fable'/);
    /* And the labels the gate applies are named here so this arm keeps meaning
       something if either is renamed — they must NOT be the guard's label. */
    expect(gateYml).toContain("--add-label founder-review");
    expect(reviewYml).not.toMatch(/github\.event\.label\.name == 'founder-review'/);
  });

  it("the draft suppression survives the new trigger", () => {
    /* A draft is the shift saying the diff is not finished. Labelling a draft
       must not start a review round. */
    expect(reviewYml).toMatch(/!github\.event\.pull_request\.draft/);
  });
});

describe("the size rule is declared once and read twice", () => {
  it("⚠ CONTROL — the declaration exists and both halves parse", () => {
    expect(extractReviewSizeLine(sizeDeclaration)).toBe(50);
    expect(extractReviewNonCodePattern(sizeDeclaration).length).toBeGreaterThan(10);
  });

  it("review.yml sources it and keeps no copy of either half", () => {
    expect(reviewYml, "review.yml must source the size declaration").toContain(
      ". ./.github/review-size.sh",
    );
    expect(reviewYml).toMatch(/grep -vE "\$REVIEW_NON_CODE"/);
    expect(reviewYml).toMatch(/-lt "\$REVIEW_SIZE_LINE"/);
    /* The anti-mirror arm: a local assignment is the copy that drifted on the
       money rule (#958), and this file exists so it cannot happen here. */
    expect(
      reviewYml,
      "review.yml declares its own size rule — that is the copy #958 removed one rule over",
    ).not.toMatch(/\n\s*REVIEW_(SIZE_LINE|NON_CODE)='/);
    /* And the literal 50 is gone from the triage step, or the sourced value
       would be decoration. */
    const step = reviewYml.slice(reviewYml.indexOf("Decide whether this diff earns a review"));
    expect(step).not.toMatch(/-lt 50\b/);
  });

  it("the merge tool asks the size question itself, and refuses a declaration it cannot read", () => {
    expect(mergeTool).toContain("exceedsReviewSizeLine(");
    expect(mergeTool).toContain("extractReviewSizeLine(");
    expect(mergeTool).toContain("extractReviewNonCodePattern(");
    /* It must fail rather than default — a missing declaration that read as
       "nothing earns a look" is the silence this closes. */
    expect(mergeTool).toMatch(/REVIEW_SIZE_DECLARATION_PATH\} is missing/);
  });

  it("⚠ the line counts ride the PR-files request rather than a second call", () => {
    /* #987's argument for reading the patch here: the payload already carries
       it. A separate `git diff` would be a second reader of a different moment. */
    expect(mergeTool).toMatch(/\.additions, \.deletions\] \| @json/);
    /* And a row whose counts did not parse is REFUSED, not defaulted to zero —
       zero would make a large diff read as small, the permissive direction. */
    expect(mergeTool).toMatch(/came back with no line counts/);
  });
});
