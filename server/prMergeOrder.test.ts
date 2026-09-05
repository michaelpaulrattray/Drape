/**
 * THE MERGE-IN-ORDER DECISION, AND THE REVIEW-ROUND READING UNDER IT
 * (#543 item 3, founder-ordered and urgent).
 *
 * A tool that merges pull requests is the most consequential thing the team
 * runs on its own behalf, so its decision is a pure function and this suite
 * drives it directly rather than through the network (working law 3: a
 * backstop needs a test the model — here, GitHub — cannot rescue).
 *
 * Two arms in here read REAL artifacts rather than fixtures, and they are the
 * ones that matter most:
 *   - the money/auth pattern is extracted from the live `.github/workflows/
 *     review.yml`, so a rename there reddens this suite instead of silently
 *     letting a money PR merge unreviewed (working law 4 — never mirror);
 *   - the `review` job name and the `gate-checks` job name are read out of the
 *     real workflow files for the same reason.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  type MergeContext,
  type PrReading,
  REVIEWER_WORKFLOW_PATH,
  decideMergeAction,
  describeAction,
  extractMoneyPattern,
  orderByOpened,
  refuseProtectedPush,
  sharesFiles,
  touchesMoney,
  touchesReviewerWorkflow,
} from "../scripts/lib/prMergeOrder.mts";
import { gitTreeReader, readProtectedRefs } from "../scripts/lib/pushPaths.mts";
import {
  FINAL_ROUND_MESSAGE,
  type PrIdentity,
  type ReviewRunReading,
  classifyRun,
  decideRoundNotice,
  reviewPresence,
  tallyRounds,
} from "../scripts/lib/reviewRounds.mts";

const REPO_ROOT = join(__dirname, "..");
const reviewYml = readFileSync(join(REPO_ROOT, REVIEWER_WORKFLOW_PATH), "utf8");
const MONEY = extractMoneyPattern(reviewYml);
const ctx: MergeContext = { moneyPattern: MONEY };

const pr = (over: Partial<PrReading> = {}): PrReading => ({
  number: 551,
  createdAt: "2026-09-05T10:00:00Z",
  headRefName: "team/551-thing",
  isDraft: false,
  state: "OPEN",
  mergeable: "MERGEABLE",
  mergeStateStatus: "CLEAN",
  files: ["scripts/thing.mts"],
  gate: "green",
  review: "none",
  acknowledged: false,
  worktreePath: "C:/Users/Admin/drape-shift-551-thing",
  ...over,
});

// ---------------------------------------------------------------------------
describe("the money rule is read out of the reviewer's own workflow", () => {
  it("extracts a pattern from the real review.yml", () => {
    expect(MONEY.length).toBeGreaterThan(20);
    expect(() => new RegExp(MONEY)).not.toThrow();
  });

  it("that pattern still matches the surfaces the workflow's own comment names", () => {
    // If review.yml's MONEY line is edited to stop covering these, this arm is
    // the thing that says so — the tool's money hold is only as good as it.
    for (const path of [
      "server/routes/billing.ts",
      "server/routes/emailAuth.ts",
      "server/db/billing.ts",
      "server/_core/sdk.ts",
      "server/security/adminSecurity.ts",
      "shared/const.ts",
      "drizzle/0060_thing.sql",
    ]) {
      expect(touchesMoney([path], MONEY), `${path} should read as money/auth`).toBe(true);
    }
  });

  it("and does not swallow ordinary paths", () => {
    for (const path of [
      "scripts/pr-merge-in-order.mts",
      "client/src/features/casting/Roll.tsx",
      "docs/architecture/drape-architecture.json",
      "server/crew/crew-briefing.json",
    ]) {
      expect(touchesMoney([path], MONEY), `${path} should NOT read as money/auth`).toBe(false);
    }
  });

  it("REFUSES when the declaration moves, rather than returning a pattern that matches nothing", () => {
    expect(() => extractMoneyPattern("jobs:\n  triage:\n    steps: []\n")).toThrow(/MONEY=/);
    // A commented-out or renamed line must not be silently accepted either.
    expect(() => extractMoneyPattern("          # MONEY_OLD='^server/'\n")).toThrow(/MONEY=/);
  });
});

// ---------------------------------------------------------------------------
describe("the order is the order opened", () => {
  it("sorts by createdAt, oldest first", () => {
    const out = orderByOpened([
      pr({ number: 3, createdAt: "2026-09-05T12:00:00Z" }),
      pr({ number: 1, createdAt: "2026-09-05T10:00:00Z" }),
      pr({ number: 2, createdAt: "2026-09-05T11:00:00Z" }),
    ]);
    expect(out.map((p) => p.number)).toEqual([1, 2, 3]);
  });

  it("breaks a same-instant tie on the PR number, so the order is total", () => {
    const out = orderByOpened([
      pr({ number: 9, createdAt: "2026-09-05T10:00:00Z" }),
      pr({ number: 4, createdAt: "2026-09-05T10:00:00Z" }),
    ]);
    expect(out.map((p) => p.number)).toEqual([4, 9]);
  });

  it("does not mutate its input", () => {
    const input = [pr({ number: 3, createdAt: "2026-09-05T12:00:00Z" }), pr({ number: 1 })];
    orderByOpened(input);
    expect(input.map((p) => p.number)).toEqual([3, 1]);
  });
});

describe("shared files predict the sync", () => {
  it("names the intersection, sorted", () => {
    expect(sharesFiles(["b.ts", "a.ts", "c.ts"], ["c.ts", "a.ts"])).toEqual(["a.ts", "c.ts"]);
  });
  it("is empty for disjoint diffs", () => {
    expect(sharesFiles(["a.ts"], ["b.ts"])).toEqual([]);
  });
  it("catches the generated map, which is the real-world case", () => {
    const map = "docs/architecture/drape-architecture.json";
    expect(sharesFiles([map, "a.ts"], [map, "b.ts"])).toEqual([map]);
  });
});

// ---------------------------------------------------------------------------
describe("decideMergeAction — the branch order is the contract", () => {
  it("merges a clean, green, unreviewed-by-triage PR", () => {
    expect(decideMergeAction(pr(), ctx)).toEqual({ kind: "merge" });
  });

  it("skips one that is already merged", () => {
    expect(decideMergeAction(pr({ state: "MERGED" }), ctx).kind).toBe("skip");
  });

  it("skips a closed one rather than acting on it", () => {
    expect(decideMergeAction(pr({ state: "CLOSED" }), ctx).kind).toBe("skip");
  });

  it("stops on a draft — marking ready spends a review round", () => {
    const a = decideMergeAction(pr({ isDraft: true }), ctx);
    expect(a.kind).toBe("stop");
    expect(a.kind === "stop" && a.reason).toMatch(/gh pr ready 551/);
  });

  it("waits on a running gate", () => {
    expect(decideMergeAction(pr({ gate: "running" }), ctx).kind).toBe("wait");
  });

  it("STOPS on a red gate and never retries it", () => {
    const a = decideMergeAction(pr({ gate: "red" }), ctx);
    expect(a.kind).toBe("stop");
    expect(a.kind === "stop" && a.reason).toMatch(/never retries/);
  });

  it("waits when no gate run exists yet, and points at the stall alarm", () => {
    const a = decideMergeAction(pr({ gate: "absent" }), ctx);
    expect(a.kind).toBe("wait");
    expect(a.kind === "wait" && a.reason).toMatch(/gate-stall-check --pr 551/);
  });

  it("⚠ the gate is answered BEFORE the clock: a draft with a red gate still stops on the draft", () => {
    // Order matters because each branch prints a different instruction; the
    // cheapest, most certain refusal must be the one the shift is told about.
    const a = decideMergeAction(pr({ isDraft: true, gate: "red" }), ctx);
    expect(a.kind === "stop" && a.reason).toMatch(/DRAFT/);
  });

  it("STOPS on an unacknowledged verdict — green is not a pass", () => {
    const a = decideMergeAction(pr({ review: "verdict" }), ctx);
    expect(a.kind).toBe("stop");
    expect(a.kind === "stop" && a.reason).toMatch(/--acknowledge 551/);
  });

  it("merges once the verdict is acknowledged", () => {
    expect(decideMergeAction(pr({ review: "verdict", acknowledged: true }), ctx)).toEqual({
      kind: "merge",
    });
  });

  it("merges an ordinary PR with NO verdict — the standing orders say the gate alone", () => {
    expect(decideMergeAction(pr({ review: "no-verdict" }), ctx)).toEqual({ kind: "merge" });
  });

  it("STOPS on a money/auth PR with no verdict", () => {
    const a = decideMergeAction(
      pr({ review: "no-verdict", files: ["server/routes/billing.ts"] }),
      ctx,
    );
    expect(a.kind).toBe("stop");
    expect(a.kind === "stop" && a.reason).toMatch(/money\/auth/);
  });

  it("but a money/auth PR WITH a read verdict merges", () => {
    expect(
      decideMergeAction(
        pr({ review: "verdict", acknowledged: true, files: ["server/routes/billing.ts"] }),
        ctx,
      ),
    ).toEqual({ kind: "merge" });
  });

  it("STOPS on a PR touching review.yml — the reviewer self-skips on its own change (#165)", () => {
    const a = decideMergeAction(
      pr({ review: "no-verdict", files: [REVIEWER_WORKFLOW_PATH] }),
      ctx,
    );
    expect(a.kind).toBe("stop");
    expect(a.kind === "stop" && a.reason).toMatch(/165/);
  });

  it("and merges it once hand-reviewed", () => {
    expect(
      decideMergeAction(
        pr({ review: "no-verdict", acknowledged: true, files: [REVIEWER_WORKFLOW_PATH] }),
        ctx,
      ),
    ).toEqual({ kind: "merge" });
  });

  it("syncs main into a CONFLICTING branch that has a worktree", () => {
    const a = decideMergeAction(pr({ mergeable: "CONFLICTING" }), ctx);
    expect(a.kind).toBe("sync-main");
    expect(a.kind === "sync-main" && a.worktreePath).toBe("C:/Users/Admin/drape-shift-551-thing");
  });

  it("syncs a BEHIND branch too", () => {
    expect(decideMergeAction(pr({ mergeStateStatus: "BEHIND" }), ctx).kind).toBe("sync-main");
  });

  it("STOPS instead of syncing when no worktree holds the branch — it never cuts one", () => {
    const a = decideMergeAction(pr({ mergeable: "CONFLICTING", worktreePath: null }), ctx);
    expect(a.kind).toBe("stop");
    expect(a.kind === "stop" && a.reason).toMatch(/shift-worktree\.mts add 551-thing/);
  });

  it("WAITS on mergeable=UNKNOWN rather than reading it as clean", () => {
    // The seconds after an earlier PR lands are exactly when this is UNKNOWN,
    // and treating it as clean is how a tool merges a conflict.
    expect(decideMergeAction(pr({ mergeable: "UNKNOWN", mergeStateStatus: "UNKNOWN" }), ctx).kind).toBe(
      "wait",
    );
  });

  it("STOPS on BLOCKED — it will not merge past branch protection", () => {
    const a = decideMergeAction(pr({ mergeStateStatus: "BLOCKED" }), ctx);
    expect(a.kind).toBe("stop");
    expect(a.kind === "stop" && a.reason).toMatch(/branch protection/);
  });

  it("an unacknowledged verdict outranks a conflict — the read comes before the sync", () => {
    const a = decideMergeAction(pr({ review: "verdict", mergeable: "CONFLICTING" }), ctx);
    expect(a.kind).toBe("stop");
  });

  it("describeAction names the PR in every branch", () => {
    for (const over of [
      {},
      { state: "MERGED" },
      { gate: "running" as const },
      { gate: "red" as const },
      { mergeable: "CONFLICTING" },
    ]) {
      const p = pr(over);
      expect(describeAction(p, decideMergeAction(p, ctx))).toMatch(/#551/);
    }
  });
});

describe("the push this tool performs can never reach a protected ref", () => {
  // The population is the hook's own, read the way `pushPathsToMain.test.ts`
  // reads it — a second list of protected refs is the thing this avoids.
  const PROTECTED = readProtectedRefs(gitTreeReader(REPO_ROOT));

  it("the real hook still names main, so this arm has something to refuse", () => {
    // A positive control on the FIXTURE: an empty protected list would make
    // every refusal arm below pass by testing nothing.
    expect(PROTECTED).toContain("main");
    expect(PROTECTED.length).toBeGreaterThan(0);
  });

  it("REFUSES a push from a worktree sitting on any protected ref", () => {
    for (const ref of PROTECTED) {
      const refusal = refuseProtectedPush(ref, PROTECTED);
      expect(refusal, `${ref} must be refused`).not.toBeNull();
      expect(refusal).toMatch(/deploy-rite/);
    }
  });

  it("allows an ordinary team branch", () => {
    expect(refuseProtectedPush("team/551-thing", PROTECTED)).toBeNull();
  });

  it("matches the whole ref, not a prefix — `main-ish` is not `main`", () => {
    expect(refuseProtectedPush("team/maintenance", PROTECTED)).toBeNull();
    expect(refuseProtectedPush("mainline", PROTECTED)).toBeNull();
  });
});

describe("touchesReviewerWorkflow", () => {
  it("is an exact path match, not a substring", () => {
    expect(touchesReviewerWorkflow([REVIEWER_WORKFLOW_PATH])).toBe(true);
    expect(touchesReviewerWorkflow([".github/workflows/review.yml.bak"])).toBe(false);
    expect(touchesReviewerWorkflow([".github/workflows/gate.yml"])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
const identity: PrIdentity = {
  number: 550,
  headRefName: "team/shift-worktree",
  createdAt: "2026-09-05T08:05:46Z",
};

const run = (over: Partial<ReviewRunReading> = {}): ReviewRunReading => ({
  id: 1,
  headBranch: "team/shift-worktree",
  createdAt: "2026-09-05T08:19:36Z",
  reviewJobConclusion: "success",
  ...over,
});

describe("review rounds — a verdict is not a run, and a run is not a verdict", () => {
  it("a review job that succeeded is a verdict", () => {
    expect(classifyRun(run(), identity)).toBe("verdict");
  });

  it("a SKIPPED review job is triage declining, not a verdict", () => {
    // A run whose triage said no concludes `success` at the RUN level, which is
    // why the job is what gets read (#219).
    expect(classifyRun(run({ reviewJobConclusion: "skipped" }), identity)).toBe("declined");
  });

  it("a failed or cancelled review job produced NO verdict (#219, #434, #165)", () => {
    expect(classifyRun(run({ reviewJobConclusion: "failure" }), identity)).toBe("no-verdict");
    expect(classifyRun(run({ reviewJobConclusion: "cancelled" }), identity)).toBe("no-verdict");
    expect(classifyRun(run({ reviewJobConclusion: "timed_out" }), identity)).toBe("no-verdict");
  });

  it("a run with no review job at all is no verdict", () => {
    expect(classifyRun(run({ reviewJobConclusion: null }), identity)).toBe("no-verdict");
  });

  it("a run on another branch is not this PR's", () => {
    expect(classifyRun(run({ headBranch: "team/preflight" }), identity)).toBe("not-this-pr");
  });

  it("a run older than the PR is not this PR's — the branch-reuse bound", () => {
    expect(classifyRun(run({ createdAt: "2026-09-04T00:00:00Z" }), identity)).toBe("not-this-pr");
  });

  it("tallies PR #550's real shape: two verdicts and one decline", () => {
    // Read at the artifact 2026-09-05: runs 33954331743 (skipped),
    // 33954949823 (review success) and 33955640709 (review success) on
    // team/shift-worktree, which matches that shift's own report of two rounds.
    const tally = tallyRounds(
      [
        run({ id: 33955640709, createdAt: "2026-09-05T08:34:40Z" }),
        run({ id: 33954331743, createdAt: "2026-09-05T08:05:50Z", reviewJobConclusion: "skipped" }),
        run({ id: 33954949823, createdAt: "2026-09-05T08:19:36Z" }),
      ],
      identity,
    );
    expect(tally.verdicts.map((r) => r.id)).toEqual([33954949823, 33955640709]);
    expect(tally.declined).toHaveLength(1);
    expect(tally.noVerdicts).toHaveLength(0);
    expect(reviewPresence(tally)).toBe("verdict");
  });

  it("presence is none when triage declined every time", () => {
    const tally = tallyRounds([run({ reviewJobConclusion: "skipped" })], identity);
    expect(reviewPresence(tally)).toBe("none");
  });

  it("presence is no-verdict when the reviewer was owed a look and produced none", () => {
    const tally = tallyRounds([run({ reviewJobConclusion: "failure" })], identity);
    expect(reviewPresence(tally)).toBe("no-verdict");
  });

  it("a verdict outranks a later outage — one read verdict is still a verdict", () => {
    const tally = tallyRounds(
      [
        run({ id: 1, createdAt: "2026-09-05T08:19:36Z" }),
        run({ id: 2, createdAt: "2026-09-05T08:40:00Z", reviewJobConclusion: "failure" }),
      ],
      identity,
    );
    expect(reviewPresence(tally)).toBe("verdict");
  });
});

describe("the two-round cap counts VERDICTS, never attempts", () => {
  it("says nothing on the first verdict", () => {
    expect(decideRoundNotice(1).kind).toBe("silent");
  });

  it("posts the final-round line on the second", () => {
    const n = decideRoundNotice(2);
    expect(n.kind).toBe("final-round");
    expect(n.kind === "final-round" && n.message).toBe(FINAL_ROUND_MESSAGE);
  });

  it("keeps saying it on a third, rather than going quiet exactly when it matters", () => {
    expect(decideRoundNotice(3).kind).toBe("final-round");
  });

  it("says nothing at zero", () => {
    expect(decideRoundNotice(0).kind).toBe("silent");
  });

  it("the message names the deliberate road to a third look, and the one-shot label trap", () => {
    expect(FINAL_ROUND_MESSAGE).toMatch(/needs-fable/);
    expect(FINAL_ROUND_MESSAGE).toMatch(/368/);
  });
});
