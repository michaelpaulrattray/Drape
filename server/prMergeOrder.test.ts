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
 *   - both halves of the money/auth rule are extracted from the live
 *     `.github/money-surfaces.sh` (it lived in `review.yml` until #958), so a
 *     rename there reddens this suite instead of silently letting a money PR
 *     merge unreviewed (working law 4 — never mirror);
 *   - the `triage` and `gate-checks` job names are asserted against what the
 *     real workflow files DECLARE (the `review` job is retired with the action
 *     reviewer, #1065 — the verdict is a hand verdict read off the PR). The gate review of PR #558 found this
 *     header claiming that arm before it existed — the header was the mirror,
 *     which is the joke working law 4 exists to spoil. It exists now, and it
 *     matters because the `review` name fails in the SILENT, PERMISSIVE
 *     direction: rename that job and every run reads as "no verdict" forever,
 *     so ordinary PRs with real verdicts merge unread and nothing reddens.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  type MergeContext,
  type PrReading,
  type Rollup,
  MONEY_DECLARATION_PATH,
  CUSTOMER_SURFACE_DECLARATION_PATH,
  REVIEWER_WORKFLOW_PATH,
  checkStateOf,
  decideMergeAction,
  describeAction,
  classifyMergeOutcome,
  classifyPrMergeReceipt,
  classifyRemoteBranchDeletion,
  extractJobNames,
  extractMoneyPattern,
  extractMoneySymbols,
  extractCustomerSurfaceExemptPattern,
  extractCustomerSurfacePattern,
  MONEY_SYMBOL_ROOTS,
  moneySymbolHits,
  refuseDirtyWorktree,
  orderByOpened,
  mergeNotice,
  refuseProtectedPush,
  refuseUnknownJobName,
  reviewAbsenceClause,
  sharesFiles,
  supplyChainStateOf,
  touchesMoney,
  touchesCustomerSurface,
  touchesReviewerWorkflow,
} from "../scripts/lib/prMergeOrder.mts";
import { gitTreeReader, readProtectedRefs } from "../scripts/lib/pushPaths.mts";
import {
  HAND_VERDICT_MARKER,
  type HandVerdictReading,
  type PrIdentity,
  classifyComment,
  isHandVerdict,
  reviewPresence,
  tallyRounds,
} from "../scripts/lib/reviewRounds.mts";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

/* This suite drives a real child process (`pushPaths.mts` shells out to git),
   so it declares the class's timeout rather than racing vitest's 5 s default
   under a parallel run (#548).

   ⚠ It was INVISIBLE to that population until PR #650's review: `pushPaths.mts`
   declares a quote-bearing regex at line 98 and its `execFileSync` sits at
   line 131, and the deriver's stripper — having no regex-literal mode — was
   swallowing everything between. This file is the measured instance of that
   defect rather than a hypothetical one. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

const REPO_ROOT = join(__dirname, "..");
// #958: the declaration moved out of review.yml, which was carrying a copy of
// gate.yml's copy. Three readers, one file.
const reviewYml = readFileSync(join(REPO_ROOT, REVIEWER_WORKFLOW_PATH), "utf8");
const moneyDeclaration = readFileSync(join(REPO_ROOT, MONEY_DECLARATION_PATH), "utf8");
const MONEY = extractMoneyPattern(moneyDeclaration);
const SYMBOLS = extractMoneySymbols(moneyDeclaration);
const ctx: MergeContext = { moneyPattern: MONEY, moneySymbols: SYMBOLS };

const pr = (over: Partial<PrReading> = {}): PrReading => ({
  number: 551,
  createdAt: "2026-09-05T10:00:00Z",
  headRefName: "team/551-thing",
  isDraft: false,
  state: "OPEN",
  mergeable: "MERGEABLE",
  mergeStateStatus: "CLEAN",
  files: ["scripts/thing.mts"],
  patches: [],
  gate: "green",
  staticShapes: "green",
  bundleBudget: "green",
  supplyChain: "green",
  review: "declined",
  verdictCount: 0,
  acknowledgedAtVerdictCount: null,
  worktreePath: "C:/Users/Admin/drape-shift-551-thing",
  ...over,
});

// ---------------------------------------------------------------------------
describe("the money rule is read out of the one file that declares it", () => {
  it("extracts a pattern from the real .github/money-surfaces.sh", () => {
    expect(MONEY.length).toBeGreaterThan(20);
    expect(() => new RegExp(MONEY)).not.toThrow();
  });

  it("that pattern still matches the surfaces the workflow's own comment names", () => {
    // If the MONEY_PATHS line is edited to stop covering these, this arm is
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
    expect(() => extractMoneyPattern("# nothing declared here\n")).toThrow(/MONEY_PATHS=/);
    // A commented-out or renamed line must not be silently accepted either.
    expect(() => extractMoneyPattern("# MONEY_OLD='^server/'\n")).toThrow(/MONEY_PATHS=/);
    // ⚠ And the OLD home must not still answer: review.yml declaring its own
    // copy again is the drift #958 removed, and this tool quietly reading it
    // is how that copy would stay alive unnoticed.
    expect(() => extractMoneyPattern("          MONEY='^server/stripe/'\n")).toThrow(/MONEY_PATHS=/);
  });
});

// ---------------------------------------------------------------------------
describe("the money rule's second half — a changed line naming the credit API (#987)", () => {
  const file = (filename: string, patch: string | null) => ({ filename, patch });

  it("extracts the symbols from the real .github/money-surfaces.sh, and refuses when they move", () => {
    expect(SYMBOLS).toMatch(/recordRefund/);
    expect(() => new RegExp(SYMBOLS)).not.toThrow();
    expect(() => extractMoneySymbols("MONEY_PATHS='^server/stripe/'\n")).toThrow(/MONEY_SYMBOLS=/);
    expect(() => extractMoneySymbols("# MONEY_SYMBOLS_OLD='addCredits'\n")).toThrow(/MONEY_SYMBOLS=/);
  });

  it("counts an added line and a removed line", () => {
    expect(moneySymbolHits([file("server/a.ts", "@@ -1 +1,2 @@\n x\n+  await addCredits(u, 5, ref);")], SYMBOLS)).toEqual([
      "server/a.ts",
    ]);
    expect(moneySymbolHits([file("shared/b.ts", "@@ -1,2 +1 @@\n-  await deductCredits(u, 5, ref);\n x")], SYMBOLS)).toEqual([
      "shared/b.ts",
    ]);
  });

  it("does not count a context line, a hunk header, or an ordinary change", () => {
    const patch =
      "@@ -40,3 +40,3 @@ export async function recordRefund(userId: number) {\n" +
      "   await recordRefund(userId, cost, ref);\n" +
      "-  const x = 1;\n" +
      "+  const x = 2;";
    expect(moneySymbolHits([file("server/a.ts", patch)], SYMBOLS)).toEqual([]);
  });

  it("does not count a file GitHub sent no patch for — the path half still applies to it", () => {
    expect(moneySymbolHits([file("server/huge.json", null)], SYMBOLS)).toEqual([]);
  });

  it("reads only under the gate's own roots — a script or client line is not what the gate labels", () => {
    const line = "@@ -1 +1 @@\n+  await addCredits(u, 5, ref);";
    expect(moneySymbolHits([file("scripts/x.mts", line), file("client/src/y.ts", line)], SYMBOLS)).toEqual([]);
    // A directory whose name merely STARTS with a root is not under it.
    expect(moneySymbolHits([file("serverless/z.ts", line)], SYMBOLS)).toEqual([]);
  });

  /**
   * ⚠ THE ARM THAT KEEPS THE ROOTS A HELD MIRROR RATHER THAN A SILENT ONE.
   * Both workflows scope `git diff -G"$MONEY_SYMBOLS"` with a literal pathspec
   * that the declaration does not carry, so the tool's `MONEY_SYMBOL_ROOTS` is
   * a third copy. It is read back out of BOTH workflows here, and the reader
   * throws rather than returning nothing when the line moves.
   */
  it("uses exactly the pathspec both workflows scope their symbol reading to", () => {
    const gateYml = readFileSync(join(REPO_ROOT, ".github/workflows/gate.yml"), "utf8");
    for (const [name, yml] of [
      ["gate.yml", gateYml],
      ["review.yml", reviewYml],
    ] as const) {
      const lines = [...yml.matchAll(/git diff -G"\$MONEY_SYMBOLS"[^\n]*? -- ([^|\n]+?)\s*\|\|/g)];
      expect(lines.length, `${name}: the symbol reading's git diff line was not found`).toBe(1);
      expect(lines[0]![1]!.trim().split(/\s+/), name).toEqual([...MONEY_SYMBOL_ROOTS]);
    }
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
    expect(decideMergeAction(pr(), ctx)).toEqual({ kind: "merge", notice: null });
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

  /*
    SOCKET'S OWN VERDICT — the founder's ruling on #35, verbatim and entire: "A".

    ⚠ THE ARM THAT MATTERS IS THE FIRST ONE, AND IT IS ABOUT WHY THIS CODE
    EXISTS AT ALL. He chose "just let Socket's own verdict do the blocking",
    whose consequence line promised "nothing to maintain". Registering the check
    as REQUIRED on `main` would have been that — and it would not have bound us:
    the account that performs every merge here is an admin, and `enforce_admins`
    on `main` is false, so GitHub lets it merge straight through a failing
    required check. The context is registered anyway (it binds a non-admin and
    it makes the verdict a rule), and this reading is the half that binds the
    road the team actually merges on. Both halves, or it is the fifth safety net
    in this project installed and never connected.
  */
  it("STOPS on a red Socket verdict — a green gate is not enough on its own", () => {
    const a = decideMergeAction(pr({ gate: "green", supplyChain: "red" }), ctx);
    expect(a.kind).toBe("stop");
    expect(a.kind === "stop" && a.reason).toMatch(/Socket REFUSED/);
  });

  it("waits while Socket's verdict is still running", () => {
    expect(decideMergeAction(pr({ supplyChain: "running" }), ctx).kind).toBe("wait");
  });

  it("STOPS when Socket posted nothing on a MERGEABLE head — silence is not approval (#566's class)", () => {
    const a = decideMergeAction(pr({ supplyChain: "absent" }), ctx);
    expect(a.kind).toBe("stop");
    expect(a.kind === "stop" && a.reason).toMatch(/not a pass, it is\s+no answer/);
  });

  /*
    ⚠ THE INTERACTION ARMS — PR #761 review, findings 1 and 2. Every arm above
    holds `mergeable: "CLEAN"`, and the input that mattered was the one crossing
    `supplyChain` with the mergeability states: after `syncMain` pushes a new
    head, BOTH checks read absent for a while, and an absent-stop above the sync
    road abandons the whole remaining merge order while printing that an outside
    service is down — about a commit thirty seconds old.
  */
  it("SYNCS a conflicting PR whose Socket verdict is absent — it does not diagnose the outage", () => {
    const a = decideMergeAction(
      pr({ supplyChain: "absent", gate: "absent", mergeable: "CONFLICTING", mergeStateStatus: "DIRTY" }),
      ctx,
    );
    expect(a.kind).toBe("sync-main");
  });

  it("still STOPS on a RED Socket verdict even while conflicting — red is a true reading of this head", () => {
    /* The mirror of the arm above, and the reason only `absent` moved: a red
       verdict says something about the diff, not about the branch being behind. */
    const a = decideMergeAction(
      pr({ supplyChain: "red", mergeable: "CONFLICTING", mergeStateStatus: "DIRTY" }),
      ctx,
    );
    expect(a.kind).toBe("stop");
    expect(a.kind === "stop" && a.reason).toMatch(/Socket REFUSED/);
  });

  it("the absent-stop says the conflict does not explain it — the sentence only a mergeable head earns", () => {
    const a = decideMergeAction(pr({ supplyChain: "absent" }), ctx);
    expect(a.kind === "stop" && a.reason).toMatch(/no conflict explains it/);
  });

  it("merges when both the gate and Socket are green — the control on the three above", () => {
    /* Without this the three arms above would all pass over a rule that simply
       never merges anything. */
    expect(decideMergeAction(pr({ gate: "green", supplyChain: "green" }), ctx).kind).toBe("merge");
  });

  /*
    ⚠ A SOCKET SKIP IS ITS OWN STATE (#1051). Socket reads a PR seconds after
    it opens; if GitHub has not computed mergeability yet, or cannot show it
    the base commit yet, it posts `NEUTRAL` titled "Skipped" and never reads
    that head again. The classification used to live in the script, untested,
    and read every non-SUCCESS conclusion as `red`, so the stop said "Socket
    REFUSED this diff … read the alerts" over a head with no alerts to read.
    Measured over 60 PRs / 104 heads: 5 NEUTRAL skips, 0 FAILUREs — every
    firing of that stop had been a skip.
  */
  it("STOPS on a skipped Socket head and names the remedy — a new head, not a read of the alerts", () => {
    const a = decideMergeAction(pr({ gate: "green", supplyChain: "skipped" }), ctx);
    expect(a.kind).toBe("stop");
    expect(a.kind === "stop" && a.reason).toMatch(/SKIPPED/);
    expect(a.kind === "stop" && a.reason).toMatch(/empty commit/);
    expect(a.kind === "stop" && a.reason).not.toMatch(/REFUSED/);
  });

  it("SYNCS a conflicting PR whose Socket reading is skipped — the sync makes the head it will re-read", () => {
    const a = decideMergeAction(
      pr({ supplyChain: "skipped", gate: "green", mergeable: "CONFLICTING", mergeStateStatus: "DIRTY" }),
      ctx,
    );
    expect(a.kind).toBe("sync-main");
  });

  /*
    ⚠ THE SEMGREP JOB — #1034 split it out of `gate-checks` into `static-shapes`,
    and the split is a decoration unless this tool reads the new job: the
    merging account is an admin and `enforce_admins` is off, so a required
    check alone binds nobody here (the `supplyChain` paragraph above, which is
    the same lesson). Four states, the gate's own three roads.
  */
  it("STOPS on a red static-shapes job — a green gate-checks is not enough on its own", () => {
    const a = decideMergeAction(pr({ gate: "green", staticShapes: "red" }), ctx);
    expect(a.kind).toBe("stop");
    expect(a.kind === "stop" && a.reason).toMatch(/static-shapes FAILED/);
  });

  it("waits while the semgrep job is still running", () => {
    const a = decideMergeAction(pr({ staticShapes: "running" }), ctx);
    expect(a.kind).toBe("wait");
    expect(a.kind === "wait" && a.reason).toMatch(/static-shapes/);
  });

  it("STOPS when gate-checks ran on a MERGEABLE head and static-shapes did not — silence is not a pass", () => {
    const a = decideMergeAction(pr({ gate: "green", staticShapes: "absent" }), ctx);
    expect(a.kind).toBe("stop");
    expect(a.kind === "stop" && a.reason).toMatch(/no `static-shapes` job did/);
  });

  it("when BOTH jobs are absent it is the gate's own wait (one run, no run yet), not the semgrep stop", () => {
    const a = decideMergeAction(pr({ gate: "absent", staticShapes: "absent" }), ctx);
    expect(a.kind).toBe("wait");
    expect(a.kind === "wait" && a.reason).toMatch(/no gate-checks run/);
  });

  it("SYNCS a conflicting PR whose semgrep job is absent — the conflict explains the silence", () => {
    const a = decideMergeAction(
      pr({ gate: "absent", staticShapes: "absent", supplyChain: "absent", mergeable: "CONFLICTING", mergeStateStatus: "DIRTY" }),
      ctx,
    );
    expect(a.kind).toBe("sync-main");
  });

  it("⚠ the GATE is answered before semgrep: a diff failing both is told about the tests first", () => {
    const a = decideMergeAction(pr({ gate: "red", staticShapes: "red" }), ctx);
    expect(a.kind === "stop" && a.reason).toMatch(/gate-checks FAILED/);
  });

  it("merges when gate-checks, static-shapes and Socket are all green — the control on the arms above", () => {
    expect(decideMergeAction(pr({ gate: "green", staticShapes: "green", supplyChain: "green" }), ctx).kind).toBe("merge");
  });

  /*
    ⚠ THE BUNDLE BUDGET — #1035 added `bundle-budget` beside `static-shapes`,
    and it is read for the identical reason: the merging account is an admin,
    `enforce_admins` is off, and a required check alone binds nobody here.
  */
  it("STOPS on a red bundle-budget job — the first download over the line blocks the merge", () => {
    const a = decideMergeAction(pr({ gate: "green", staticShapes: "green", bundleBudget: "red" }), ctx);
    expect(a.kind).toBe("stop");
    expect(a.kind === "stop" && a.reason).toMatch(/bundle-budget FAILED/);
  });

  it("waits while the bundle-budget job is still building", () => {
    const a = decideMergeAction(pr({ bundleBudget: "running" }), ctx);
    expect(a.kind).toBe("wait");
    expect(a.kind === "wait" && a.reason).toMatch(/bundle-budget/);
  });

  it("STOPS when gate-checks ran on a MERGEABLE head and bundle-budget did not — silence is not a pass", () => {
    const a = decideMergeAction(pr({ gate: "green", bundleBudget: "absent" }), ctx);
    expect(a.kind).toBe("stop");
    expect(a.kind === "stop" && a.reason).toMatch(/no `bundle-budget` job did/);
  });

  it("when every gate job is absent it is the gate's own wait, not the budget stop", () => {
    const a = decideMergeAction(pr({ gate: "absent", staticShapes: "absent", bundleBudget: "absent" }), ctx);
    expect(a.kind).toBe("wait");
    expect(a.kind === "wait" && a.reason).toMatch(/no gate-checks run/);
  });

  it("SYNCS a conflicting PR whose bundle-budget job is absent — the conflict explains the silence", () => {
    const a = decideMergeAction(
      pr({ gate: "absent", staticShapes: "absent", bundleBudget: "absent", supplyChain: "absent", mergeable: "CONFLICTING", mergeStateStatus: "DIRTY" }),
      ctx,
    );
    expect(a.kind).toBe("sync-main");
  });

  it("⚠ semgrep is answered before the budget: a diff failing both is told in the gate's order", () => {
    const a = decideMergeAction(pr({ staticShapes: "red", bundleBudget: "red" }), ctx);
    expect(a.kind === "stop" && a.reason).toMatch(/static-shapes FAILED/);
  });

  it("merges when gate-checks, static-shapes, bundle-budget and Socket are all green — the control", () => {
    expect(
      decideMergeAction(pr({ gate: "green", staticShapes: "green", bundleBudget: "green", supplyChain: "green" }), ctx).kind,
    ).toBe("merge");
  });

  it("⚠ the GATE is answered before Socket: a diff failing both is told about the gate", () => {
    /* Both are refusals and both are true; the shift is sent to the one it can
       act on with a run log rather than to an outside service's dashboard. */
    const a = decideMergeAction(pr({ gate: "red", supplyChain: "red" }), ctx);
    expect(a.kind === "stop" && a.reason).toMatch(/gate-checks FAILED/);
  });

  it("⚠ the gate is answered BEFORE the clock: a draft with a red gate still stops on the draft", () => {
    // Order matters because each branch prints a different instruction; the
    // cheapest, most certain refusal must be the one the shift is told about.
    const a = decideMergeAction(pr({ isDraft: true, gate: "red" }), ctx);
    expect(a.kind === "stop" && a.reason).toMatch(/DRAFT/);
  });

  it("STOPS on an unacknowledged verdict — green is not a pass", () => {
    const a = decideMergeAction(pr({ review: "verdict", verdictCount: 1 }), ctx);
    expect(a.kind).toBe("stop");
    expect(a.kind === "stop" && a.reason).toMatch(/--acknowledge 551/);
  });

  it("merges once the verdict is acknowledged", () => {
    expect(decideMergeAction(pr({ review: "verdict", verdictCount: 1, acknowledgedAtVerdictCount: 1 }), ctx)).toEqual({
      kind: "merge",
      notice: null,
    });
  });

  it("merges an ordinary PR with NO verdict — the standing orders say the gate alone", () => {
    expect(decideMergeAction(pr({ review: "no-verdict" }), ctx)).toEqual({ kind: "merge", notice: null });
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
        pr({ review: "verdict", verdictCount: 1, acknowledgedAtVerdictCount: 1, files: ["server/routes/billing.ts"] }),
        ctx,
      ),
    ).toEqual({ kind: "merge", notice: null });
  });

  it("STOPS on a PR touching review.yml — the reviewer reads the change to its own rules (#165 → #1065)", () => {
    const a = decideMergeAction(
      pr({ review: "no-verdict", files: [REVIEWER_WORKFLOW_PATH] }),
      ctx,
    );
    expect(a.kind).toBe("stop");
    expect(a.kind === "stop" && a.reason).toMatch(/rules of the review itself/);
  });

  it("and merges it once hand-reviewed", () => {
    expect(
      decideMergeAction(
        pr({ review: "no-verdict", acknowledgedAtVerdictCount: 0, files: [REVIEWER_WORKFLOW_PATH] }),
        ctx,
      ),
    ).toEqual({ kind: "merge", notice: null });
  });

  /**
   * #987. The PR shape the path half cannot see: a casting refund fix, on a
   * path no money list names, whose changed line calls the credit API. The
   * gate labels it `founder-review`; before #987 this tool merged it.
   */
  const refundFix = {
    files: ["server/castingV2/refineService.test.ts"],
    patches: [
      {
        filename: "server/castingV2/refineService.test.ts",
        patch: '@@ -10,2 +10,3 @@\n   it("refunds", async () => {\n+    const { recordRefund } = await import("../casting/atomicCredits");\n   });',
      },
    ],
  };

  it("STOPS on a money PR the path list misses — a changed line names the credit API (#987)", () => {
    const a = decideMergeAction(pr({ review: "no-verdict", ...refundFix }), ctx);
    expect(a.kind).toBe("stop");
    expect(a.kind === "stop" && a.reason).toMatch(/money\/auth/);
    expect(a.kind === "stop" && a.reason).toContain("server/castingV2/refineService.test.ts");
  });

  it("and holds it on `declined` too, like the path half — a label nobody applied does not un-owe money", () => {
    expect(decideMergeAction(pr({ review: "declined", ...refundFix }), ctx).kind).toBe("stop");
  });

  it("but merges it once hand-reviewed, or with a read verdict", () => {
    expect(
      decideMergeAction(pr({ review: "no-verdict", acknowledgedAtVerdictCount: 0, ...refundFix }), ctx),
    ).toEqual({ kind: "merge", notice: null });
    expect(
      decideMergeAction(
        pr({ review: "verdict", verdictCount: 1, acknowledgedAtVerdictCount: 1, ...refundFix }),
        ctx,
      ),
    ).toEqual({ kind: "merge", notice: null });
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

  /**
   * ⚠ THE COMBINATION EVERY ARM IN THIS BLOCK MISSED, AND IT IS THE COMMONEST
   * ONE THIS TOOL MEETS (measured 2026-09-07).
   *
   * Every conflict arm above takes the fixture's default `gate: "green"` — so
   * all of them passed while the real case hung for ever. **A CONFLICTING PR
   * gets no gate run at all**: GitHub creates no check suite for it, so the
   * gate reads `absent`, and the `absent` wait used to sit ABOVE the sync.
   *
   * The instance: #627 merged, #628 went CONFLICTING on the generated atlas
   * fingerprint seconds later — the collision this module's header calls
   * *"nearly always non-empty in this repository"* — and the tool printed
   * `WAIT — no gate-checks run on this head commit yet` every 32 seconds while
   * holding the one action that would have produced a gate run. The sync road
   * is why this tool exists, and it was unreachable in the exact scenario it
   * was written for.
   *
   * A green fixture cannot see an ordering bug between two branches when it
   * only ever exercises one of them.
   */
  it("⚠ syncs a CONFLICTING branch whose gate is ABSENT — a conflict gets no gate run", () => {
    const a = decideMergeAction(pr({ mergeable: "CONFLICTING", mergeStateStatus: "DIRTY", gate: "absent" }), ctx);
    expect(a.kind, "it waited for a gate run a conflicting PR can never get").toBe("sync-main");
  });

  it("syncs a BEHIND branch whose gate is ABSENT, for the same reason", () => {
    expect(decideMergeAction(pr({ mergeStateStatus: "BEHIND", gate: "absent" }), ctx).kind).toBe("sync-main");
  });

  it("still WAITS on an absent gate when the branch is CLEAN — the stall reading is intact", () => {
    /* THE NEGATIVE CONTROL, and it is the one that matters: the repair must not
       turn every slow gate start into a sync. Below the conflict branches an
       absent gate is the genuine #368 stall. */
    const a = decideMergeAction(pr({ gate: "absent" }), ctx);
    expect(a.kind).toBe("wait");
    expect(a.kind === "wait" && a.reason).toMatch(/gate-stall-check/);
  });

  it("does NOT sync past a RED gate — that would be the retry this tool refuses", () => {
    /* Only `absent` moved. A red gate is a real reading of the head the branch
       has NOW, and syncing it would produce a fresh run over a known failure —
       indistinguishable from the gate retry this tool exists not to perform. */
    const a = decideMergeAction(pr({ mergeable: "CONFLICTING", gate: "red" }), ctx);
    expect(a.kind).toBe("stop");
    expect(a.kind === "stop" && a.reason).toMatch(/never retries a gate/);
  });

  it("does NOT sync past a RUNNING gate — the run is about to answer", () => {
    const a = decideMergeAction(pr({ mergeable: "CONFLICTING", gate: "running" }), ctx);
    expect(a.kind).toBe("wait");
    expect(a.kind === "wait" && a.reason).toMatch(/gate-checks is running/);
  });

  it("an unacknowledged verdict STILL outranks a conflict with an absent gate", () => {
    /* The reviewer read is above both, and moving `absent` must not have
       reordered it: a shift must still read the verdict before anything is
       pushed to the branch. */
    const a = decideMergeAction(
      pr({ review: "verdict", verdictCount: 1, mergeable: "CONFLICTING", gate: "absent" }),
      ctx,
    );
    expect(a.kind).toBe("stop");
    expect(a.kind === "stop" && a.reason).toMatch(/has not been acknowledged/);
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
    const a = decideMergeAction(pr({ review: "verdict", verdictCount: 1, mergeable: "CONFLICTING" }), ctx);
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

// ---------------------------------------------------------------------------
// The seven findings from the gate review of PR #558, each with the arm that
// would have caught it. Findings 1 and 2 are the severe pair: as first written,
// the team's own draft-then-ready flow made "merged past the review" the
// DEFAULT first-round outcome rather than the exception.
describe("#1065 · the verdict is a HAND verdict, and the merge reads it", () => {
  it("an unread verdict STOPS — a verdict is never a pass by itself", () => {
    const a = decideMergeAction(pr({ review: "verdict", verdictCount: 1 }), ctx);
    expect(a.kind).toBe("stop");
    expect(a.kind === "stop" && a.reason).toMatch(/Fable review — by hand/);
  });

  it("🟠 6 · an acknowledgement is pinned to what was read, not to the PR", () => {
    const a = decideMergeAction(
      pr({ review: "verdict", verdictCount: 2, acknowledgedAtVerdictCount: 1 }),
      ctx,
    );
    expect(a.kind).toBe("stop");
    expect(a.kind === "stop" && a.reason).toMatch(/NEWER verdict landed/);
  });

  it("🟠 6 · and it still covers the verdict it was given for", () => {
    expect(
      decideMergeAction(pr({ review: "verdict", verdictCount: 1, acknowledgedAtVerdictCount: 1 }), ctx),
    ).toEqual({ kind: "merge", notice: null });
  });

  it("a money PR with no verdict is HELD, and the stop names the relay and the comment heading", () => {
    const a = decideMergeAction(pr({ review: "no-verdict", files: ["server/routes/billing.ts"] }), ctx);
    expect(a.kind).toBe("stop");
    const reason = a.kind === "stop" ? a.reason : "";
    expect(reason).toMatch(/money\/auth/);
    expect(reason).toMatch(/relay/);
    expect(reason).toMatch(/Fable review — by hand/);
    // The old remedy — a label that re-ran a machine — is gone with the machine.
    expect(reason).not.toMatch(/re-add/);
  });

  it("🟠 5 · a money PR whose review was DECLINED is held too — money is owed a look whatever triage labelled", () => {
    const a = decideMergeAction(pr({ review: "declined", files: ["server/routes/billing.ts"] }), ctx);
    expect(a.kind).toBe("stop");
    expect(a.kind === "stop" && a.reason).toMatch(/whatever the label says/);
  });

  it("🟠 5 · an ordinary declined PR still merges — the hold is money-only", () => {
    expect(decideMergeAction(pr({ review: "declined" }), ctx)).toEqual({ kind: "merge", notice: null });
  });

  it("an ordinary PR that is OWED a review but has none still merges on the gate alone — the standing orders' road", () => {
    expect(decideMergeAction(pr({ review: "no-verdict" }), ctx)).toEqual({ kind: "merge", notice: null });
  });

  it("🔴 R3-1 · a change to review.yml with no verdict is held — the reviewer reads its own rules", () => {
    const a = decideMergeAction(pr({ review: "declined", files: [REVIEWER_WORKFLOW_PATH] }), ctx);
    expect(a.kind).toBe("stop");
    expect(a.kind === "stop" && a.reason).toMatch(/rules of the review itself/);
  });

  it("🔴 R3-1 · and it still merges once hand-reviewed", () => {
    expect(
      decideMergeAction(
        pr({ review: "declined", acknowledgedAtVerdictCount: 0, files: [REVIEWER_WORKFLOW_PATH] }),
        ctx,
      ),
    ).toEqual({ kind: "merge", notice: null });
  });

  it("⚠ a DECLINED merge carries NO notice — the design working is not an alarm", () => {
    const a = decideMergeAction(pr({ review: "declined" }), ctx);
    expect(a).toEqual({ kind: "merge", notice: null });
    expect(describeAction(pr({ review: "declined" }), a)).not.toMatch(/⚠/);
  });

  it("mergeNotice is silent on every state — `absent` is retired with the machine", () => {
    for (const review of ["verdict", "no-verdict", "declined"] as const) {
      expect(mergeNotice(pr({ review }))).toBeNull();
    }
  });

  it("reviewAbsenceClause speaks only for `declined`, and never sends a shift hunting a label", () => {
    expect(reviewAbsenceClause("no-verdict")).toBe("");
    expect(reviewAbsenceClause("verdict")).toBe("");
    expect(reviewAbsenceClause("declined")).toMatch(/needs-fable/);
    expect(reviewAbsenceClause("declined")).not.toMatch(/skip-review/);
  });
});

describe("🟡 4 · the sync refuses a dirty worktree and tells a stopped merge from one that never began", () => {
  it("a clean worktree is not refused", () => {
    expect(refuseDirtyWorktree("")).toBeNull();
    expect(refuseDirtyWorktree("\n  \n")).toBeNull();
  });

  it("REFUSES, naming the files, on anything uncommitted", () => {
    // The overlap rule makes these worktrees a shift's ACTIVE workspace, so
    // "there is probably nothing important there" is exactly the assumption
    // that would push half-finished work onto a PR.
    const refusal = refuseDirtyWorktree(" M server/thing.ts\n?? scratch.md\n");
    expect(refusal).not.toBeNull();
    expect(refusal).toMatch(/server\/thing\.ts/);
    expect(refusal).toMatch(/scratch\.md/);
    expect(refusal).toMatch(/2 entries/);
  });

  it("refuses on a STAGED file too — that is the one a merge commit swallows", () => {
    expect(refuseDirtyWorktree("A  server/new.ts\n")).toMatch(/server\/new\.ts/);
  });

  it("a merge that exits 0 is clean", () => {
    expect(
      classifyMergeOutcome({ exitCode: 0, unmergedPaths: "", mergeHeadExists: true }),
    ).toBe("clean");
  });

  it("unmerged paths are a real conflict, whatever the exit code", () => {
    expect(
      classifyMergeOutcome({ exitCode: 1, unmergedPaths: "server/x.ts\n", mergeHeadExists: true }),
    ).toBe("conflict");
  });

  it("a non-zero merge WITH MERGE_HEAD is the atlas driver waiting for its commit", () => {
    expect(
      classifyMergeOutcome({ exitCode: 1, unmergedPaths: "", mergeHeadExists: true }),
    ).toBe("atlas-driver-stop");
  });

  it("a non-zero merge with NO MERGE_HEAD never started — a blind commit here is the bug", () => {
    expect(
      classifyMergeOutcome({ exitCode: 128, unmergedPaths: "", mergeHeadExists: false }),
    ).toBe("never-started");
  });
});

describe("🟡 3 · the job names are asserted against the workflows, not mirrored", () => {
  const reviewJobs = extractJobNames(reviewYml);
  const gateJobs = extractJobNames(
    readFileSync(join(REPO_ROOT, ".github/workflows/gate.yml"), "utf8"),
  );

  it("reads the real review.yml's jobs — triage only; the `review` job is retired with the action (#1065)", () => {
    expect(reviewJobs).toContain("triage");
    expect(reviewJobs).not.toContain("review");
  });

  it("reads the real gate.yml's jobs", () => {
    expect(gateJobs).toContain("gate-checks");
    expect(gateJobs).toContain("founder-gate");
    expect(gateJobs).toContain("static-shapes");
    expect(gateJobs).toContain("bundle-budget");
  });

  it("the names this tool keys on are declared by those files", () => {
    expect(refuseUnknownJobName("triage", reviewJobs, "review.yml")).toBeNull();
    expect(refuseUnknownJobName("gate-checks", gateJobs, "gate.yml")).toBeNull();
    expect(refuseUnknownJobName("static-shapes", gateJobs, "gate.yml")).toBeNull();
    expect(refuseUnknownJobName("bundle-budget", gateJobs, "gate.yml")).toBeNull();
  });

  it("REFUSES a name the workflow does not declare, naming what it does", () => {
    const refusal = refuseUnknownJobName("review", reviewJobs, "review.yml");
    expect(refusal).not.toBeNull();
    expect(refusal).toMatch(/`triage`/);
    expect(refusal).toMatch(/SILENTLY/);
  });

  it("falls back to the job KEY when a job declares no name", () => {
    expect(extractJobNames("jobs:\n  build:\n    runs-on: ubuntu-latest\n")).toEqual(["build"]);
  });

  it("prefers the declared name over the key", () => {
    expect(extractJobNames("jobs:\n  a:\n    name: pretty\n  b:\n    runs-on: x\n")).toEqual([
      "pretty",
      "b",
    ]);
  });

  it("does not mistake the `on:` block's keys for jobs", () => {
    // `on:\n  pull_request:` sits at the same indent as a job key.
    const names = extractJobNames("on:\n  pull_request:\n    branches: [main]\njobs:\n  only:\n    runs-on: x\n");
    expect(names).toEqual(["only"]);
  });

  it("REFUSES a workflow with no jobs block rather than returning an empty list", () => {
    expect(() => extractJobNames("name: x\non:\n  push:\n")).toThrow(/jobs:/);
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
  headCommittedAt: "2026-09-05T08:15:00Z",
  ownerLogin: "michaelpaulrattray",
};

const verdictBody =
  "**Fable review — by hand, on his word** (founder's lane). Read the whole diff. **Verdict: merge.**";

const comment = (over: Partial<HandVerdictReading> = {}): HandVerdictReading => ({
  id: 1,
  authorLogin: "michaelpaulrattray",
  createdAt: "2026-09-05T08:19:36Z",
  body: verdictBody,
  ...over,
});

describe("#1065 · a verdict is a comment by the founder's account, headed by the marker, on the current head", () => {
  it("the marker is the heading every hand verdict has carried", () => {
    expect(HAND_VERDICT_MARKER).toBe("**Fable review — by hand");
    expect(isHandVerdict(verdictBody)).toBe(true);
    expect(isHandVerdict("  \n**Fable review — by hand**")).toBe(true);
  });

  it("a fresh verdict by the owner is a verdict", () => {
    expect(classifyComment(comment(), identity)).toBe("verdict");
  });

  it("the same words by any other account are NOT a verdict — the floor, not the fence", () => {
    expect(classifyComment(comment({ authorLogin: "dependabot[bot]" }), identity)).toBe("not-a-verdict");
    expect(classifyComment(comment({ authorLogin: "some-shift" }), identity)).toBe("not-a-verdict");
  });

  it("an ordinary comment by the owner is not a verdict, even one that says merge", () => {
    expect(classifyComment(comment({ body: "Looks fine, merge it." }), identity)).toBe("not-a-verdict");
    expect(classifyComment(comment({ body: "taken by the relay" }), identity)).toBe("not-a-verdict");
    // The marker mid-body is a quotation, not a verdict.
    expect(
      classifyComment(comment({ body: "As I said in **Fable review — by hand yesterday…" }), identity),
    ).toBe("not-a-verdict");
  });

  it("a verdict posted BEFORE the current head was committed is STALE — a verdict is on a diff, not a PR", () => {
    expect(classifyComment(comment({ createdAt: "2026-09-05T08:10:00Z" }), identity)).toBe("stale-verdict");
  });

  it("a verdict in the same second as the head commit is fresh — the relay pushes and posts in one sitting", () => {
    expect(classifyComment(comment({ createdAt: "2026-09-05T08:15:00Z" }), identity)).toBe("verdict");
  });

  it("a comment older than the PR is not this PR's — the branch-reuse bound", () => {
    expect(classifyComment(comment({ createdAt: "2026-09-04T00:00:00Z" }), identity)).toBe("not-a-verdict");
  });

  it("tallies oldest-first, fresh apart from stale", () => {
    const tally = tallyRounds(
      [
        comment({ id: 3, createdAt: "2026-09-05T09:00:00Z" }),
        comment({ id: 1, createdAt: "2026-09-05T08:10:00Z" }),
        comment({ id: 2, createdAt: "2026-09-05T08:30:00Z" }),
        comment({ id: 4, body: "taken by the relay" }),
      ],
      identity,
    );
    expect(tally.verdicts.map((c) => c.id)).toEqual([2, 3]);
    expect(tally.stale.map((c) => c.id)).toEqual([1]);
  });

  it("presence is VERDICT when a fresh one exists, whatever is owed", () => {
    const tally = tallyRounds([comment()], identity);
    expect(reviewPresence(tally, true)).toBe("verdict");
    expect(reviewPresence(tally, false)).toBe("verdict");
  });

  it("presence is NO-VERDICT when a review is owed and only a stale one exists", () => {
    const tally = tallyRounds([comment({ createdAt: "2026-09-05T08:10:00Z" })], identity);
    expect(tally.stale).toHaveLength(1);
    expect(reviewPresence(tally, true)).toBe("no-verdict");
  });

  it("presence is DECLINED when nobody owes a look and none exists — the design working", () => {
    expect(reviewPresence(tallyRounds([], identity), false)).toBe("declined");
  });

  it("presence is NO-VERDICT when a look is owed and nothing at all was posted", () => {
    expect(reviewPresence(tallyRounds([], identity), true)).toBe("no-verdict");
  });
});

/**
 * THE RECEIPT (#568) — a failure AFTER the irreversible act must not read as a
 * failure BEFORE it.
 *
 * The incident this drives: `gh pr merge --delete-branch` merged PR #567 and
 * then threw doing its own LOCAL tidy-up, which cannot work from a shift
 * worktree because the main tree holds `main`. The tool reported a crash over a
 * pull request that was already in `main`, and the shift only learned the truth
 * by running `gh pr view` by hand.
 *
 * The two inputs are deliberately independent — what `gh` did, and what the
 * record says — because the whole defect was one standing in for the other.
 */
describe("the merge receipt is read back from GitHub, never inferred from an exit code", () => {
  it("the ordinary road: gh returned and the record says MERGED", () => {
    expect(classifyPrMergeReceipt({ mergeError: null, stateAfter: "MERGED" })).toEqual({
      kind: "merged",
    });
  });

  it("⚠ THE #568 STATE: gh threw and the record says MERGED — merged, then something failed", () => {
    const receipt = classifyPrMergeReceipt({
      mergeError: "fatal: 'main' is already used by worktree at 'C:/Users/Admin/Drape'",
      stateAfter: "MERGED",
    });
    expect(receipt.kind).toBe("merged-then-failed");
    /* The detail is the thing a shift needs to act on, so it is carried whole
       rather than summarised into "something went wrong". */
    expect(receipt.kind === "merged-then-failed" && receipt.detail).toMatch(/already used by worktree/);
  });

  it("a real failure: gh threw and the record agrees nothing landed", () => {
    const receipt = classifyPrMergeReceipt({
      mergeError: "GraphQL: Pull request is not mergeable",
      stateAfter: "OPEN",
    });
    expect(receipt.kind).toBe("not-merged");
    expect(receipt.kind === "not-merged" && receipt.detail).toMatch(/not mergeable/);
  });

  it("gh returning while the record says OPEN is still not-merged — the artifact wins", () => {
    const receipt = classifyPrMergeReceipt({ mergeError: null, stateAfter: "OPEN" });
    expect(receipt.kind).toBe("not-merged");
    expect(receipt.kind === "not-merged" && receipt.detail).toMatch(/state=OPEN/);
  });

  it("⚠ an unreadable record is its OWN state and never a vote for 'nothing landed'", () => {
    /* Working law 2's direction: a broken reader that quietly votes for the
       status quo would send a shift to re-merge a pull request that may
       already be in main. */
    const afterThrow = classifyPrMergeReceipt({ mergeError: "some gh error", stateAfter: null });
    expect(afterThrow.kind).toBe("merge-state-unknown");
    expect(afterThrow.kind === "merge-state-unknown" && afterThrow.detail).toMatch(/could not be read back/);

    const afterSuccess = classifyPrMergeReceipt({ mergeError: null, stateAfter: null });
    expect(afterSuccess.kind).toBe("merge-state-unknown");
  });

  it("the four states are mutually exclusive over the whole input square", () => {
    /* The negative control for the arms above: two gh outcomes × three record
       answers must produce six readings and never a gap. */
    const kinds = new Set<string>();
    for (const mergeError of [null, "boom"]) {
      for (const stateAfter of ["MERGED", "OPEN", null]) {
        kinds.add(classifyPrMergeReceipt({ mergeError, stateAfter }).kind);
      }
    }
    expect([...kinds].sort()).toEqual(["merge-state-unknown", "merged", "merged-then-failed", "not-merged"]);
  });
});

/**
 * THE REMOTE BRANCH DELETE (#568 recommendation 2) — the cleanup is done where
 * it is legal, so the local checkout is never touched and the failure above
 * cannot occur at all.
 */
describe("deleting the remote branch: already-gone is a success, not a failure", () => {
  it("a clean delete", () => {
    expect(classifyRemoteBranchDeletion({ exitCode: 0, output: "" })).toBe("deleted");
  });

  it("⚠ a ref GitHub already removed satisfies the post-condition and must not fail", () => {
    /* A repository with 'Automatically delete head branches' on removes it
       during the merge; the thing this tool wants is that the branch is not
       there, and both roads give that. 422 is the one answer that can only
       mean absence. */
    expect(
      classifyRemoteBranchDeletion({
        exitCode: 1,
        output: 'gh: Reference does not exist (HTTP 422)',
      }),
    ).toBe("already-gone");
  });

  it("⚠ A 404 IS NOT ABSENCE — GitHub answers it for a token without push rights", () => {
    /* PR #612 review, finding 3. The first shape read 404 as already-gone, so a
       scoped-down token would have been told the branch was tidied while it
       survived. The two errors are not symmetric: a surviving branch reported
       as deleted is a lie a shift acts on; a deleted branch reported as needing
       a look costs one glance. */
    expect(classifyRemoteBranchDeletion({ exitCode: 1, output: "gh: Not Found (HTTP 404)" })).toBe(
      "failed",
    );
  });

  it("a real failure stays a failure — the negative control the arm above needs", () => {
    expect(
      classifyRemoteBranchDeletion({ exitCode: 1, output: "gh: Resource protected by organization SAML enforcement" }),
    ).toBe("failed");
    expect(classifyRemoteBranchDeletion({ exitCode: 1, output: "" })).toBe("failed");
  });
});

/**
 * ⚠ THE CONTRACT AT THE WIRE (invariant 5, and the only arm that could have
 * caught #568 before it shipped): `--delete-branch` must NOT reach
 * `gh pr merge`, because it is that flag's LOCAL half that breaks in a
 * worktree. Asserted on the bytes of the call this tool builds, not on a
 * constant near it.
 */
describe("the merge call itself never asks gh to touch the local checkout", () => {
  const source = readFileSync(join(process.cwd(), "scripts", "pr-merge-in-order.mts"), "utf8");

  it("builds `gh pr merge --squash` with no --delete-branch", () => {
    const call = source.match(/const args = \[[^\]]*\];/);
    expect(call).not.toBeNull();
    expect(call?.[0]).toContain('"--squash"');
    expect(call?.[0]).not.toContain("--delete-branch");
  });

  it("still honours the flag, through the API road that touches nothing local", () => {
    expect(source).toContain("deleteRemoteBranch");
    expect(source).toMatch(/git\/refs\/heads\//);
  });

  it("⚠ EVERY gh call in the branch delete is INSIDE its guard — it runs after the merge", () => {
    /* PR #612 review, finding 1: the repo-name lookup sat OUTSIDE the try, so a
       transient failure there threw uncaught after the irreversible act and
       killed every later PR in the order — #568's own shape one call to the
       right, under a docblock promising "never fatal". Asserted on the bytes of
       the function rather than on the comment above it. */
    const fn = source.slice(source.indexOf("function deleteRemoteBranch"));
    const end = fn.search(/^\}$/m);
    expect(end).toBeGreaterThan(-1);
    const body = fn.slice(0, end);
    const guardOpens = body.indexOf("try {");
    expect(guardOpens).toBeGreaterThan(-1);
    const beforeGuard = body.slice(0, guardOpens);
    expect(beforeGuard).not.toContain("gh(");
  });
});

// ---------------------------------------------------------------------------
/*
  THE CHECK CLASSIFICATION, driven on the REAL rollup (#1051). This is the
  `statusCheckRollup` GitHub returned for PR #1048's first head `40f73361`,
  read back through GraphQL on 2026-09-21 — the shape the tool reads, with its
  UPPER-CASE enums and no title. Socket read the head seven seconds after the
  draft opened and posted NEUTRAL "Skipped un-mergeable pull request"; the
  tool called that a refusal, and a shift spent ~25 minutes reading alerts
  that did not exist.
*/
const SOCKET_CHECK = "Socket Security: Pull Request Alerts";
const SKIPPED_HEAD_ROLLUP: readonly Rollup[] = [
  {
    __typename: "CheckRun",
    name: "Socket Security: Pull Request Alerts",
    status: "COMPLETED",
    conclusion: "NEUTRAL",
    startedAt: "2026-09-20T22:04:03Z",
    workflowName: "",
  },
  {
    __typename: "CheckRun",
    name: "Socket Security: Project Report",
    status: "COMPLETED",
    conclusion: "SUCCESS",
    startedAt: "2026-09-20T22:04:01Z",
    workflowName: "",
  },
];

describe("the check classification reads a Socket skip as `skipped`, never as a refusal (#1051)", () => {
  it("#1048's real skipped head reads `skipped` through the Socket reader", () => {
    expect(supplyChainStateOf(SKIPPED_HEAD_ROLLUP, SOCKET_CHECK)).toBe("skipped");
  });

  it("and reads `red` through the generic reader — the reading the tool used to make, kept for gate jobs", () => {
    /* A gate job that concludes NEUTRAL or SKIPPED did not run to a pass, and
       `red` is the safe reading there. Only Socket's reader knows the fifth
       state, so this is the arm that says the two readers differ on purpose. */
    expect(checkStateOf(SKIPPED_HEAD_ROLLUP, SOCKET_CHECK)).toBe("red");
  });

  it("a real Socket FAILURE still reads `red` — the positive control on the refusal arm", () => {
    const refused = SKIPPED_HEAD_ROLLUP.map((c) => (c.name === SOCKET_CHECK ? { ...c, conclusion: "FAILURE" } : c));
    expect(supplyChainStateOf(refused, SOCKET_CHECK)).toBe("red");
    const a = decideMergeAction(pr({ supplyChain: supplyChainStateOf(refused, SOCKET_CHECK) }), ctx);
    expect(a.kind === "stop" && a.reason).toMatch(/Socket REFUSED/);
  });

  it("SUCCESS is green, an unfinished run is running, no run at all is absent — same for both readers", () => {
    const green = SKIPPED_HEAD_ROLLUP.map((c) => (c.name === SOCKET_CHECK ? { ...c, conclusion: "SUCCESS" } : c));
    expect(supplyChainStateOf(green, SOCKET_CHECK)).toBe("green");
    expect(checkStateOf(green, SOCKET_CHECK)).toBe("green");
    const running = SKIPPED_HEAD_ROLLUP.map((c) =>
      c.name === SOCKET_CHECK ? { ...c, status: "IN_PROGRESS", conclusion: null } : c,
    );
    expect(supplyChainStateOf(running, SOCKET_CHECK)).toBe("running");
    expect(checkStateOf(running, SOCKET_CHECK)).toBe("running");
    const none = SKIPPED_HEAD_ROLLUP.filter((c) => c.name !== SOCKET_CHECK);
    expect(supplyChainStateOf(none, SOCKET_CHECK)).toBe("absent");
    expect(checkStateOf(none, SOCKET_CHECK)).toBe("absent");
  });

  it("the NEWEST run by startedAt is the one read — an old skip under a fresh SUCCESS is green", () => {
    const reread: Rollup[] = [
      ...SKIPPED_HEAD_ROLLUP,
      { __typename: "CheckRun", name: SOCKET_CHECK, status: "COMPLETED", conclusion: "SUCCESS", startedAt: "2026-09-20T22:20:00Z" },
    ];
    expect(supplyChainStateOf(reread, SOCKET_CHECK)).toBe("green");
    const reversed = [...reread].reverse();
    expect(supplyChainStateOf(reversed, SOCKET_CHECK)).toBe("green");
  });

  it("the Project Report beside it is a report, not the verdict — its SUCCESS never stands in for the alerts check", () => {
    const none = SKIPPED_HEAD_ROLLUP.filter((c) => c.name !== SOCKET_CHECK);
    expect(supplyChainStateOf(none, SOCKET_CHECK)).toBe("absent");
  });
});

/**
 * WHAT A CUSTOMER SEES IS READ TWICE — #1328, and #1194 is why there are two.
 *
 * The money rule and the reviewer-workflow rule were always asked twice — once
 * by triage and once by the merge tool, on the stated ground that *a label
 * someone removed cannot un-owe a money diff*. **Triage's third limb was asked
 * once**, and a PR that never got a triage run was announced to nobody: no
 * label, no comment, and `review=declined` — the same word this tool prints for a
 * diff that genuinely earned no look.
 *
 * ⚠ **Measured on PR #1191, and the artifact is a run list rather than a
 * reading.** Opened as a draft at 23:34:51Z, marked ready at 23:35:10Z, and no
 * `Fable Review` run was created for either event: main had moved at 23:24Z, so
 * the PR was born DIRTY, and a CONFLICTING PR gets no `pull_request` run for any
 * event (#566).
 *
 * ⚠ **THE LIMB WAS SIZE AND THE FOUNDER DROPPED IT — his word, 2026-09-26:
 * "drop it".** Shown the day's tally (22 seat PRs reviewed, 0 code defects
 * found) he removed the line-count trigger outright rather than raising it. What
 * replaced it is the obligation none of the four mechanical checks can
 * discharge: a diff touching a surface a CUSTOMER sees owes the relay's eye on
 * the rendered frames, both themes (working law 6; law 9's *his eyes are king*).
 *
 * ⚠ **It changes what is REPORTED, not what merges**, and the arms say so: an
 * ordinary customer-visible diff with no verdict still merges on the gate alone.
 */
describe("what a customer sees is read twice — #1328", () => {
  const declaration = readFileSync(join(__dirname, "..", CUSTOMER_SURFACE_DECLARATION_PATH), "utf8");
  const PATHS = extractCustomerSurfacePattern(declaration);
  const EXEMPT = extractCustomerSurfaceExemptPattern(declaration);
  const owed = (...files: string[]) => touchesCustomerSurface(files, PATHS, EXEMPT);

  it("⚠ CONTROL — the real declaration parses, and both halves are real regexes", () => {
    expect(PATHS).toBe("^client/src/");
    expect(EXEMPT).toMatch(/features\/admin\//);
    expect(() => new RegExp(PATHS)).not.toThrow();
    expect(() => new RegExp(EXEMPT)).not.toThrow();
  });

  it("REFUSES a declaration whose lines have moved rather than guessing a default", () => {
    /* A guessed pattern is the silent failure this reader exists to close: one
       that matched nothing would make every customer diff read as ordinary, and
       one that lost the exemption would disagree with triage about the same
       diff. */
    expect(() => extractCustomerSurfacePattern(`CUSTOMER_SURFACE_EXEMPT='x'\n`)).toThrow(
      /CUSTOMER_SURFACE_PATHS=/,
    );
    expect(() => extractCustomerSurfaceExemptPattern(`CUSTOMER_SURFACE_PATHS='^client/src/'\n`)).toThrow(
      /CUSTOMER_SURFACE_EXEMPT=/,
    );
  });

  it("⚠ POSITIVE — a page, a component, a store and a design token each earn a look", () => {
    /* Real paths at this tree, not invented ones: the four shapes a customer-
       visible change actually takes. */
    expect(owed("client/src/pages/CastingV2.tsx")).toBe(true);
    expect(owed("client/src/features/casting/components/CastProfilePanel.tsx")).toBe(true);
    expect(owed("client/src/features/boards/stores/useCanvasLayers.ts")).toBe(true);
    expect(owed("client/src/foundation/tokens.css")).toBe(true);
  });

  /**
   * ⚠ THE STAFF PAGES ARE EXEMPT ON HIS WORD, AND THE THREE ARMS HE ASKED FOR
   * ARE HERE TOGETHER.
   *
   * #1328 first shipped with `^client/src/features/admin/` alone — the directory
   * his ruling named — and filed the fact that the admin PAGES live in
   * `client/src/pages/` as a loud default: one unnecessary reading rather than a
   * missed surface. On the relay's sentence that staff pages merge on the gate he
   * said **"keep it with you"**, so the exemption was widened rather than
   * carried. `AdminCrew.tsx` is the Desk itself and the arm below is the one that
   * would have failed before the widening.
   */
  it("⚠ the Desk PAGE and the moderator page are exempt — his 'keep it with you'", () => {
    expect(owed("client/src/pages/AdminCrew.tsx")).toBe(false);
    expect(owed("client/src/pages/AdminOverview.tsx")).toBe(false);
    expect(owed("client/src/pages/ModeratorDashboard.tsx")).toBe(false);
    expect(owed("client/src/features/moderator/AuditLogsTab.tsx")).toBe(false);
  });

  it("⚠ and a CUSTOMER page in the same directory still earns the frames", () => {
    /* The mirror of the arm above, and the reason the exemption is a NAME prefix
       rather than the whole `pages/` directory. Read at `git ls-files
       client/src/pages`: nine of the eighteen pages are staff (`Admin…` ×8,
       `Moderator…` ×1) and the other nine are all customer surfaces. */
    expect(owed("client/src/pages/CastingSheet.tsx")).toBe(true);
    expect(owed("client/src/pages/AppLobby.tsx")).toBe(true);
    expect(owed("client/src/pages/DrapeStudio.tsx")).toBe(true);
    expect(owed("client/src/pages/Login.tsx")).toBe(true);
  });

  it("⚠ NEGATIVE — the staff panels are not a customer surface (his own exemption)", () => {
    expect(owed("client/src/features/admin/AuditLogTable.tsx")).toBe(false);
    expect(owed("client/src/features/admin/BlockedIPsTab.tsx")).toBe(false);
  });

  it("⚠ NEGATIVE — the client's own test files are not a customer surface", () => {
    /* All 104 client test files at this tree are `.test.ts`; these two are real. */
    expect(owed("client/src/foundation/focusRing.test.ts")).toBe(false);
    expect(owed("client/src/components/appChrome.test.ts")).toBe(false);
  });

  it("⚠ NEGATIVE CONTROL — a server, docs, workflow or crew-script diff earns nothing here", () => {
    /* Including the big ones: the retired rule would have flagged every one of
       these on size, and that is exactly what he dropped. */
    expect(owed("server/castingV2/rollService.ts")).toBe(false);
    expect(owed("docs/specs/BIG.md")).toBe(false);
    expect(owed(".github/workflows/gate.yml")).toBe(false);
    expect(owed("scripts/lib/prMergeOrder.mts")).toBe(false);
    expect(owed("docs/architecture/drape-architecture.json")).toBe(false);
    /* And a client file OUTSIDE `src/` — the prefix is `client/src/`, not
       `client/`, so `client/index.html` and the configs are not this limb's. */
    expect(owed("client/index.html")).toBe(false);
  });

  it("ONE surviving file is enough — a diff is not excused by its exempt neighbours", () => {
    expect(
      owed(
        "client/src/features/admin/AuditLogTable.tsx",
        "client/src/foundation/focusRing.test.ts",
        "client/src/pages/CastingV2.tsx",
      ),
    ).toBe(true);
    /* And a diff of nothing but exempt files stays exempt — the mirror arm, so
       the one above is not passing because the reader says yes to everything. */
    expect(
      owed("client/src/features/admin/AuditLogTable.tsx", "client/src/foundation/focusRing.test.ts"),
    ).toBe(false);
  });

  it("⚠ the exemption is applied INSIDE the prefix, never as a standalone allowlist", () => {
    /* A reader that tested the exemption first, or tested only the exemption,
       would let every non-client file read as a surface. `server/a.test.ts`
       matches the exemption and must still be a no for the other reason. */
    expect(owed("server/a.test.ts")).toBe(false);
    expect(owed("docs/features/admin/notes.md")).toBe(false);
  });
});
