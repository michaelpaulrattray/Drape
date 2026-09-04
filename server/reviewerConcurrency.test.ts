/**
 * A RUN THAT WILL DO NOTHING MUST NEVER CANCEL A RUN THAT WOULD REVIEW (#434).
 *
 * `review.yml` triggers on `opened`, `ready_for_review` and `labeled`, and
 * most `labeled` runs are going to do nothing: its triage job reviews a label
 * event only when the label is `needs-fable`. While every event on a pull
 * request shared one concurrency slot (`review-<pr>`) with
 * `cancel-in-progress`, a label applied in the same second as the PR was
 * created took that slot, cancelled the real review, and then skipped itself.
 * The PR was left with a red `review` check and no verdict behind it.
 *
 * MEASURED AT THE ARTIFACTS, 2026-09-04, and the frequency is smaller than the
 * card that ordered the fix said. Over the last 100 `review.yml` runs: 46
 * success, 45 skipped, 8 failure, **1 cancelled** — run 33588638499 on PR
 * #433, whose `triage` job was cancelled one second after it started. The 45
 * skipped runs are the design working, not the bug; #502's "27 of the last 60
 * were skipped" counts the reviewer doing its job. The gate's own
 * `founder-review` label was raised as a likely second road and does not hold:
 * on PRs #337 and #349 the label run was created and skipped ~8 seconds before
 * the reviewing run existed, so there was nothing to cancel.
 *
 * WHY THIS GUARD RESOLVES THE TEMPLATE INSTEAD OF MATCHING ITS TEXT. A
 * substring test for `github.event.action` would pass on a group that
 * mentions the action in a way that still collides, and would redden on a
 * correct group written differently — a regex standing in for something the
 * file already states, which is the shape-match class the Atlas was repaired
 * for. So the arms below take the group expression as it ships, substitute
 * real webhook payloads into it, and compare the STRINGS GitHub would
 * actually key on. The property under test is the one that matters: two
 * events that must not cancel each other resolve to different groups, and two
 * that must still supersede resolve to the same one.
 *
 * THE INSTRUMENT IS VERIFIED BEFORE ITS FINDINGS COUNT (working law 2). Arm 1
 * runs the resolver over the OLD, broken group and requires it to REPORT the
 * collision; arm 2 requires it to distinguish two pull requests. Without both,
 * a resolver that returned a constant — or the empty string — would pass every
 * "these differ" arm by accident.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reviewYmlPath = path.join(repoRoot, ".github/workflows/review.yml");
const reviewYml = readFileSync(reviewYmlPath, "utf8");

/** The group expression exactly as `review.yml` ships it, comments stripped. */
function shippedGroupTemplate(): string {
  const lines = reviewYml.split(/\r?\n/);
  const start = lines.findIndex((l) => l === "concurrency:");
  if (start === -1) throw new Error("review.yml has no top-level `concurrency:` block");
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^\S/.test(line)) break; // left the block
    const m = /^\s+group:\s*(.+?)\s*$/.exec(line);
    if (m) return m[1];
  }
  throw new Error("review.yml's `concurrency:` block declares no `group:`");
}

/** The group as it stood before #434 — arm 1's positive control, not shipped. */
const BROKEN_GROUP = "review-${{ github.event.pull_request.number }}";

type Payload = Record<string, unknown>;

/**
 * Resolve a GitHub Actions group template against one webhook payload.
 *
 * A dotted `github.…` path that is ABSENT from the payload resolves to the
 * empty string, because that is what Actions does and it is load-bearing here
 * (`github.event.label.name` is genuinely absent on an `opened` event). Any
 * expression this resolver cannot model — a function call, a `||`, an
 * unrecognised root — THROWS rather than quietly becoming empty: a future
 * template these arms cannot evaluate must redden, never pass green over a
 * reading that was never taken.
 */
function resolveGroup(template: string, event: Payload): string {
  const github: Payload = { event };
  let sawExpression = false;
  const resolved = template.replace(/\$\{\{\s*([^}]+?)\s*\}\}/g, (_all, expr: string) => {
    sawExpression = true;
    if (!/^github(\.[A-Za-z_][A-Za-z0-9_]*)+$/.test(expr)) {
      throw new Error(`resolveGroup cannot evaluate the expression \`${expr}\``);
    }
    let cursor: unknown = github;
    for (const key of expr.split(".").slice(1)) {
      if (cursor === null || cursor === undefined) return "";
      if (typeof cursor !== "object") return "";
      cursor = (cursor as Payload)[key];
    }
    if (cursor === null || cursor === undefined) return "";
    return String(cursor);
  });
  if (!sawExpression) throw new Error(`group template holds no expression: ${template}`);
  return resolved;
}

/** The webhook payloads GitHub delivers for the three triggers review.yml takes. */
const opened = (pr: number): Payload => ({ action: "opened", pull_request: { number: pr } });
const readyForReview = (pr: number): Payload => ({
  action: "ready_for_review",
  pull_request: { number: pr },
});
const labeled = (pr: number, label: string): Payload => ({
  action: "labeled",
  pull_request: { number: pr },
  label: { name: label },
});

describe("the review workflow's concurrency key (#434)", () => {
  describe("the resolver itself, before any finding rests on it (law 2)", () => {
    it("REPORTS the collision on the group that shipped the bug", () => {
      // Positive control. The pre-#434 group ignored the event entirely, so
      // an `opened` run and a `labeled` run on one PR keyed on the same slot
      // and `cancel-in-progress` killed the first. If this arm ever passes by
      // reporting a DIFFERENCE, the resolver has stopped being able to see a
      // collision and every arm below is worthless.
      expect(resolveGroup(BROKEN_GROUP, opened(433))).toBe(
        resolveGroup(BROKEN_GROUP, labeled(433, "small-fix")),
      );
    });

    it("distinguishes two pull requests, so it is substituting rather than returning a constant", () => {
      expect(resolveGroup(BROKEN_GROUP, opened(433))).not.toBe(
        resolveGroup(BROKEN_GROUP, opened(434)),
      );
    });

    it("refuses an expression it cannot model instead of resolving it to nothing", () => {
      expect(() => resolveGroup("review-${{ hashFiles('x') }}", opened(433))).toThrow();
    });

    it("refuses a group template that declares no expression at all", () => {
      expect(() => resolveGroup("review", opened(433))).toThrow();
    });
  });

  describe("the group review.yml actually ships", () => {
    const group = shippedGroupTemplate();

    it("gives a skipping label run a different slot from the run that reviews", () => {
      // The defect, stated as the property that prevents it: this is the exact
      // pair from PR #433 — `gh pr create --label small-fix` firing `opened`
      // and `labeled` within one second.
      expect(resolveGroup(group, opened(433))).not.toBe(
        resolveGroup(group, labeled(433, "small-fix")),
      );
    });

    it("gives the gate's own founder-review label a different slot from the review run", () => {
      // gate.yml labels money/auth PRs seconds after they open. It has never
      // been shown to cancel a review, but it is the same shape and the key
      // must not depend on which one lost the race.
      expect(resolveGroup(group, readyForReview(357))).not.toBe(
        resolveGroup(group, labeled(357, "founder-review")),
      );
    });

    it("keeps two labels applied at once from cancelling each other", () => {
      // `gh pr create --label needs-fable,small-fix` fires two `labeled`
      // events. One of them buys the deliberate second look; nothing else may
      // take it away.
      expect(resolveGroup(group, labeled(433, "needs-fable"))).not.toBe(
        resolveGroup(group, labeled(433, "small-fix")),
      );
    });

    it("still supersedes a run of the same kind on the same pull request", () => {
      // The behaviour the group was always for, and it must survive the fix:
      // marking a PR ready twice should leave one review running, not two.
      expect(resolveGroup(group, readyForReview(433))).toBe(
        resolveGroup(group, readyForReview(433)),
      );
      expect(resolveGroup(group, labeled(433, "needs-fable"))).toBe(
        resolveGroup(group, labeled(433, "needs-fable")),
      );
    });

    it("never shares a slot between two pull requests", () => {
      expect(resolveGroup(group, opened(433))).not.toBe(resolveGroup(group, opened(434)));
      expect(resolveGroup(group, labeled(433, "needs-fable"))).not.toBe(
        resolveGroup(group, labeled(434, "needs-fable")),
      );
    });

    it("still cancels in progress, because superseding within a kind is the point", () => {
      expect(reviewYml).toMatch(/^concurrency:\r?\n(?:\s+.*\r?\n)*?\s+cancel-in-progress:\s*true$/m);
    });
  });

  describe("the premise the fix rests on is still true", () => {
    it("triage still reviews a `labeled` event only for needs-fable", () => {
      // If this ever changes — every label buying a review — a label run would
      // no longer be a run that does nothing, and the reasoning above (not
      // just the key) would need rewriting. Pinned so that lands here first.
      expect(reviewYml).toContain(
        "github.event.action != 'labeled' || github.event.label.name == 'needs-fable'",
      );
    });

    it("the workflow still triggers on all three events the key separates", () => {
      expect(reviewYml).toContain("types: [opened, ready_for_review, labeled]");
    });
  });

  describe("a cancelled run reads as no verdict (#219's three-state sentence)", () => {
    it("the meaning step names cancellation as its own state", () => {
      expect(reviewYml).toContain('elif [ "$OUTCOME" = "cancelled" ]; then');
      expect(reviewYml).toMatch(/NO VERDICT — the run was CANCELLED before it finished/);
    });

    it("points a cancelled run's reader at the superseding run, not at the Fable allowance", () => {
      // The generic branch blames the founder's Fable allowance (#219). That
      // is the wrong place to look for a superseded run, and sending a shift
      // there costs it the same dig through an action log the three-state
      // sentence exists to prevent. Read at the message the operator SEES —
      // the annotation — never at the comment above it, which is free to
      // discuss the other branch by name.
      const lines = reviewYml.split(/\r?\n/);
      const branchAt = lines.findIndex((l) => l.includes('elif [ "$OUTCOME" = "cancelled" ]'));
      if (branchAt === -1) throw new Error("no cancelled branch to read");
      const annotation = lines
        .slice(branchAt, branchAt + 12)
        .find((l) => l.includes("::error::"));
      if (!annotation) throw new Error("the cancelled branch emits no ::error:: annotation");
      expect(annotation).toContain("CANCELLED");
      expect(annotation).toContain("supersedes");
      expect(annotation).not.toContain("allowance");
    });

    it("the summary table's red row names cancellation alongside #165 and #219", () => {
      const redRow = reviewYml
        .split(/\r?\n/)
        .find((l) => l.includes("| red | **no verdict exists.**"));
      if (!redRow) throw new Error("review.yml's summary table has no red row to read");
      expect(redRow).toContain("#165");
      expect(redRow).toContain("#219");
      expect(redRow).toContain("#434");
    });
  });
});
