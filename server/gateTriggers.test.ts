import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * WHICH EVENTS START THE GATE, AND THE COUPLING THAT MAKES THE ANSWER SAFE
 * (card #503).
 *
 * `gate.yml` no longer runs on `ready_for_review`. Measured over the last 100
 * gate runs (2026-09-02 → 2026-09-04): 19 cancelled, and ELEVEN of them were a
 * later run on the same branch with the SAME head sha — `gh pr ready` starting
 * a second run on bytes the draft's run was already testing, which then
 * cancelled it through `gate-<pr>`. No push existed in any of the eleven, so
 * #503's proposed rule about pushing could not have touched them.
 *
 * ⚠ THAT REMOVAL IS ONLY SAFE BECAUSE THE GATE RUNS ON DRAFTS, AND THAT IS THE
 * ARM THAT MATTERS HERE. If a job ever gains an `if:` excluding drafts, the two
 * changes are individually reasonable and together mean a PR opened as a draft
 * is never gated at all and then merges on `ready_for_review` finding nothing
 * to run. Neither change would look wrong on its own. So the draft coupling is
 * asserted beside the trigger list, in the same file, rather than trusted to be
 * remembered — and this docblock is why.
 *
 * Read from the workflow's own `types:` list rather than by asking whether the
 * file "contains" a word: a substring test passes on the token appearing in a
 * comment, which this file now has several of (the shape-match class the Atlas
 * collectors were repaired for).
 */

const repoRoot = path.resolve(__dirname, "..");
const gateYml = readFileSync(path.join(repoRoot, ".github/workflows/gate.yml"), "utf8");
const reviewYml = readFileSync(path.join(repoRoot, ".github/workflows/review.yml"), "utf8");

/**
 * The `types:` of the `pull_request` trigger, taken from the `on:` block alone.
 * Comments are stripped first so a `types:` written inside prose cannot be read
 * as configuration, and the reader THROWS rather than returning an empty list —
 * a collector that can come up empty reports a complete answer either way.
 */
function pullRequestTypes(yml: string, label: string): string[] {
  const withoutComments = yml
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");
  const onBlock = /\non:\n([\s\S]*?)\n(?=[a-zA-Z])/.exec(withoutComments);
  if (!onBlock) throw new Error(`${label}: no top-level 'on:' block found`);
  const pullRequest = /\n {2}pull_request:\n([\s\S]*?)(?=\n {2}\S|$)/.exec(`\n${onBlock[1]!}`);
  if (!pullRequest) throw new Error(`${label}: 'on:' has no pull_request trigger`);
  const types = /\n\s+types:\s*\[([^\]]*)\]/.exec(pullRequest[1]!);
  if (!types) throw new Error(`${label}: pull_request declares no 'types:' list`);
  const parsed = types[1]!
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (parsed.length === 0) throw new Error(`${label}: the 'types:' list parsed empty`);
  return parsed;
}

describe("which events start the gate (#503)", () => {
  it("reads a real list from gate.yml — the parser must not be the thing under test", () => {
    /* Law 2's control: every arm below is a claim about this list, so the list
       must be shown to be a real reading first. */
    const types = pullRequestTypes(gateYml, "gate.yml");
    expect(types.length).toBeGreaterThanOrEqual(3);
    expect(types).toContain("opened");
  });

  it("does NOT run on ready_for_review — that duplicate run was 11 of 19 cancellations", () => {
    expect(pullRequestTypes(gateYml, "gate.yml")).not.toContain("ready_for_review");
  });

  it("still runs on the three events that carry NEW bytes or a new PR", () => {
    /* The removal is narrow on purpose. `opened` gates a PR the first time;
       `synchronize` is every push; `reopened` is a PR whose checks may have
       aged out. Each of those is a commit the gate has not judged in its
       current context — unlike `ready_for_review`, which changes no bytes. */
    const types = pullRequestTypes(gateYml, "gate.yml");
    expect(types).toEqual(["opened", "synchronize", "reopened"]);
  });

  it("⚠ runs on DRAFT pull requests — the coupling the removal depends on", () => {
    /* If any job gains a draft filter, dropping `ready_for_review` means a PR
       opened as a draft is gated by nothing and marked ready by nothing. The
       two edits are individually defensible; together they open the merge gate.
       `draft` appears in this workflow only inside comments, so the reading is
       taken with comments stripped. */
    const configuration = gateYml
      .split("\n")
      .filter((line) => !/^\s*#/.test(line))
      .join("\n");
    expect(
      /draft/.test(configuration),
      "gate.yml now mentions `draft` outside a comment. If a job excludes drafts, `ready_for_review` must go back into the trigger list in the same commit — otherwise a draft PR is never gated at all.",
    ).toBe(false);
  });

  it("keeps cancel-in-progress on a PR-keyed group — the second PUSH should still supersede", () => {
    /* The eight genuine re-pushes are left alone deliberately: the shift already
       holds the fix, so the in-flight run is testing superseded bytes. This is
       the half of #503 that was NOT built, pinned so it is not "fixed" later
       from the card's title. */
    expect(gateYml).toMatch(/concurrency:\n\s+group: gate-\$\{\{[^\n]*pull_request\.number/);
    expect(gateYml).toMatch(/\n\s+cancel-in-progress: true/);
  });

  describe("the negative control — the fix must not spread to the reviewer", () => {
    it("review.yml STILL runs on ready_for_review, which is how the Fable review fires once", () => {
      /* Deliberate and load-bearing: the team opens PRs as drafts so the review
         runs once, when the diff is finished (founder, 2026-08-26 — "reduce its
         frequency so its not burning as much credits"). An arm that only
         asserted gate.yml's absence would pass a commit that stripped the
         trigger from both files and silently stopped every review. */
      expect(pullRequestTypes(reviewYml, "review.yml")).toContain("ready_for_review");
    });
  });
});
