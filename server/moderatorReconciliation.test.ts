/**
 * Tests for the moderator credit reconciliation logic.
 *
 * ⚠ THE "KEY ACCOUNTING RULE" THIS DOCBLOCK USED TO STATE — *"failed
 * generations are refunded via a 'refund' credit transaction, so they should
 * NOT count toward net credits used"* — IS FALSE, and had been since the
 * founder's catastrophic-only refund ruling (`5c5a1f3f`). It is what froze his
 * own account for 22 hours (#119).
 *
 * THE RULE NOW (`server/db/discrepancyQueries.ts`, header): a charge is
 * explained by the record that recorded it.
 *
 *   expectedCost = unlinkedCost + operationCost
 *   discrepancy  = grossDeductions − expectedCost
 *
 * Refunds move `netCost` and nothing else — a correction of DELIVERED work is
 * legitimately unbounded by anything a record holds, so a refund-side term was
 * a false-positive generator rather than a control. A FAILED row is not a
 * discrepancy either; its unrefunded cost is reported for what it is.
 *
 * ⚠ AND WHY THIS FILE WAS REWRITTEN AT ALL. It used to re-type `buildSummary`
 * and the ENTIRE route arithmetic as local functions, under headings that said
 * so ("mirrors server/routes/moderatorReconciliation.ts"), and every arm drove
 * the copy. So the formula changed in the product and this suite STAYED GREEN
 * about it — a mirror is never caught being wrong, it makes the catching
 * assertion unwritable (working law 4: derive, never mirror). The copies are
 * deleted. The arms below drive the real `computeDiscrepancy` and the real,
 * now-exported `buildSummary`.
 */

// The route module reaches the database and Klaviyo at import time through its
// own imports; these doubles keep the import graph inert. `discrepancyQueries`
// is deliberately NOT mocked — it is the subject.
vi.mock("./db/moderatorQueries", () => ({
  getDetailedCreditHistory: vi.fn(),
  getDetailedGenerationHistory: vi.fn(),
  getUsersWithDiscrepancies: vi.fn(),
}));

vi.mock("./db", () => ({
  freezeUser: vi.fn(),
  unfreezeUser: vi.fn(),
}));

vi.mock("./db/connection", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

vi.mock("./klaviyo", () => ({
  sendAccountFrozenEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./slack/slackNotification", () => ({
  SlackAlerts: { accountFrozenByStaff: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("./auditLog", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: {
    ACCOUNT_AUTO_FROZEN: "account.auto_frozen",
    ACCOUNT_FROZEN: "account.frozen",
    ACCOUNT_UNFROZEN: "account.unfrozen",
  },
}));

import { describe, it, expect, vi, beforeEach } from "vitest";

import { computeDiscrepancy, type DiscrepancyInputs } from "./db/discrepancyQueries";
import { buildSummary } from "./routes/moderatorReconciliation";

// ── Helper: build mock credit data ──

function buildCreditData(transactions: Array<{ amount: number; type: string }>) {
  return {
    transactions: transactions.map((t, i) => ({
      id: i + 1,
      amount: t.amount,
      type: t.type,
      description: null,
      referenceId: null,
      balanceAfter: 0,
      engineUsed: null,
      createdAt: new Date("2026-01-15"),
    })),
    total: transactions.length,
    // Summary is intentionally wrong — reconciliation should NOT use it
    summary: {
      totalCreditsEarned: 999999,
      totalCreditsSpent: 888888,
      netChange: 111111,
      transactionsByType: {},
    },
  };
}

function buildGenData(
  gens: Array<{ status: string; type: string; pointsCost: number; operationId?: number }>
) {
  return {
    generations: gens.map((g, i) => ({
      id: i + 1,
      modelId: 1,
      type: g.type,
      status: g.status,
      pointsCost: g.pointsCost,
      // A row that names an operation is recorded by that operation, not by
      // itself — the whole content of the #119 correction.
      operationId: g.operationId ?? null,
      resultUrl: g.status === "completed" ? "https://example.com/img.png" : null,
      errorMessage: g.status === "failed" ? "Generation failed" : null,
      metadata: null,
      createdAt: new Date("2026-01-15"),
      completedAt: g.status === "completed" ? new Date("2026-01-15") : null,
      modelName: "Test Model",
    })),
    total: gens.length,
    // Summary is intentionally wrong — reconciliation should NOT use it
    summary: {
      totalGenerations: 777777,
      completedCount: 666666,
      failedCount: 555555,
      pendingCount: 444444,
      totalCreditsUsed: 333333,
      generationsByType: {},
      failureRate: 99.99,
    },
  };
}

/**
 * ── Fixture plumbing, NOT a copy of the rule ──
 *
 * The route reads its rows out of two query helpers and hands the totals to
 * `computeDiscrepancy`; these fixtures hold rows, so something has to fold
 * them into `DiscrepancyInputs`. That fold is bookkeeping — summing a column,
 * counting a status — and it decides NOTHING: no threshold, no direction, no
 * subtraction that the discrepancy depends on. The rule itself (what counts as
 * a record, what a refund does, whether a failure is a discrepancy) is
 * `computeDiscrepancy`, imported above and never restated here. `operationCost`
 * is passed in because in production it comes from a SQL aggregate over
 * `generation_operations`, which a row fixture cannot stand in for.
 */
function fold(
  creditData: ReturnType<typeof buildCreditData>,
  genData: ReturnType<typeof buildGenData>,
  operationCost = 0,
): { inputs: DiscrepancyInputs; failedCount: number; pendingCount: number; completedCount: number } {
  let grossDeductions = 0;
  let totalRefunds = 0;
  for (const txn of creditData.transactions) {
    if (txn.type === "generation") grossDeductions += Math.abs(txn.amount);
    else if (txn.type === "refund") totalRefunds += txn.amount;
  }

  let completedCost = 0;
  let pendingCost = 0;
  let failedCost = 0;
  let unlinkedCost = 0;
  let completedCount = 0;
  let failedCount = 0;
  let pendingCount = 0;

  for (const gen of genData.generations) {
    if (gen.status === "completed") {
      completedCount++;
      completedCost += gen.pointsCost;
    } else if (gen.status === "failed") {
      failedCount++;
      failedCost += gen.pointsCost;
    } else {
      pendingCount++;
      pendingCost += gen.pointsCost;
    }
    if (gen.operationId === null) unlinkedCost += gen.pointsCost;
  }

  return {
    inputs: { grossDeductions, totalRefunds, completedCost, pendingCost, failedCost, unlinkedCost, operationCost },
    failedCount,
    pendingCount,
    completedCount,
  };
}

/** Drive the real rule and the real summary over a fixture pair. */
function reconcile(
  creditData: ReturnType<typeof buildCreditData>,
  genData: ReturnType<typeof buildGenData>,
  operationCost = 0,
) {
  const { inputs, failedCount, pendingCount, completedCount } = fold(creditData, genData, operationCost);
  const reading = computeDiscrepancy(inputs);
  return {
    reading,
    failedCount,
    pendingCount,
    completedCount,
    hasDiscrepancy: Math.abs(reading.discrepancy) > 0,
    summary: buildSummary({ reading, failedCount, pendingCount }),
  };
}

// ── Tests ──

describe("Credit Reconciliation Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Perfect alignment — no discrepancy", () => {
    it("should report no discrepancy when the records explain the charge", () => {
      const credits = buildCreditData([
        { amount: 5000, type: "subscription" },
        { amount: -350, type: "generation" },
        { amount: -300, type: "generation" },
      ]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
        { status: "completed", type: "fullBody", pointsCost: 300 },
      ]);

      const result = reconcile(credits, gens);

      expect(result.hasDiscrepancy).toBe(false);
      expect(result.reading.discrepancy).toBe(0);
      expect(result.reading.expectedCost).toBe(650);
      expect(result.reading.netCost).toBe(650);
      // The no-discrepancy sentence names both sides rather than asserting virtue.
      expect(result.summary).toContain("No discrepancy.");
      expect(result.summary).toContain("650 credits charged");
      expect(result.summary).toContain("650 recorded");
    });

    it("should read the charge from the filtered rows, never from the helpers' summary", () => {
      const credits = buildCreditData([
        { amount: 5000, type: "subscription" },
        { amount: 12500, type: "referral" },
        { amount: -350, type: "generation" },
      ]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
      ]);

      const result = reconcile(credits, gens);

      // The fixtures carry deliberately bogus summaries; nothing reads them.
      expect(credits.summary.totalCreditsSpent).toBe(888888);
      expect(gens.summary.totalCreditsUsed).toBe(333333);
      expect(result.reading.grossDeductions).toBe(350);
      expect(result.reading.netCost).toBe(350);
      expect(result.reading.discrepancy).toBe(0);
    });
  });

  describe("Failed generations", () => {
    it("refunds move netCost and NOT the discrepancy", () => {
      // Scenario unchanged: 3 generations attempted, 1 failed and was refunded.
      const credits = buildCreditData([
        { amount: 5000, type: "subscription" },
        { amount: -350, type: "generation" },  // casting (completed)
        { amount: -300, type: "generation" },  // full body (completed)
        { amount: -350, type: "generation" },  // casting (failed)
        { amount: 350, type: "refund" },       // refund for failed
      ]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
        { status: "completed", type: "fullBody", pointsCost: 300 },
        { status: "failed", type: "castingImage", pointsCost: 350 },
      ]);

      const result = reconcile(credits, gens);

      expect(result.reading.grossDeductions).toBe(1000);
      expect(result.reading.totalRefunds).toBe(350);
      expect(result.reading.netCost).toBe(650);
      // All three rows are records: 1000 charged, 1000 recorded.
      expect(result.reading.expectedCost).toBe(1000);
      expect(result.reading.discrepancy).toBe(0);
      expect(result.hasDiscrepancy).toBe(false);
    });

    it("should handle multiple failed generations with refunds", () => {
      const credits = buildCreditData([
        { amount: -350, type: "generation" },
        { amount: -300, type: "generation" },
        { amount: -350, type: "generation" },
        { amount: 350, type: "refund" },
        { amount: 300, type: "refund" },
      ]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
        { status: "failed", type: "fullBody", pointsCost: 300 },
        { status: "failed", type: "castingImage", pointsCost: 350 },
      ]);

      const result = reconcile(credits, gens);

      expect(result.reading.grossDeductions).toBe(1000);
      expect(result.reading.totalRefunds).toBe(650);
      expect(result.reading.netCost).toBe(350);
      expect(result.reading.discrepancy).toBe(0);
      expect(result.reading.unrefundedFailureCost).toBe(0);
      expect(result.hasDiscrepancy).toBe(false);
    });

    it("should track failedCost, and report the unrefunded remainder", () => {
      const credits = buildCreditData([
        { amount: -700, type: "generation" },
        { amount: 350, type: "refund" },
      ]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
        { status: "failed", type: "castingImage", pointsCost: 350 },
      ]);

      const result = reconcile(credits, gens);

      expect(result.reading.failedCost).toBe(350);
      expect(result.reading.completedCost).toBe(350);
      expect(result.reading.unrefundedFailureCost).toBe(0);
      expect(result.reading.discrepancy).toBe(0);
    });

    it("an UNREFUNDED failure is not a discrepancy, and the summary says why", () => {
      // This arm used to be "should NOT flag discrepancy when refunds account
      // for failed gens" — it needed the refund. It no longer does: failures
      // refund only catastrophically by founder ruling, so the charge on a
      // failed row is explained by that row.
      const credits = buildCreditData([
        { amount: -700, type: "generation" },
      ]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
        { status: "failed", type: "castingImage", pointsCost: 350 },
      ]);

      const result = reconcile(credits, gens);

      expect(result.reading.discrepancy).toBe(0);
      expect(result.hasDiscrepancy).toBe(false);
      expect(result.reading.unrefundedFailureCost).toBe(350);
      expect(result.summary).toContain("1 failed generation(s)");
      expect(result.summary).toContain("failures refund only catastrophically");
      expect(result.summary).toContain("unrefunded 350 is expected");
    });

    it("no failure note appears when there are no failures", () => {
      // The negative control for the arm above — otherwise "contains the note"
      // is satisfied by a sentence that always carries it.
      const credits = buildCreditData([{ amount: -350, type: "generation" }]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
      ]);

      const result = reconcile(credits, gens);

      expect(result.failedCount).toBe(0);
      expect(result.summary).not.toContain("failures refund only catastrophically");
    });
  });

  describe("Discrepancy detection", () => {
    it("should detect a charge the records do not explain", () => {
      // Deducted 700, only 350 recorded.
      const credits = buildCreditData([
        { amount: -700, type: "generation" },
      ]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
      ]);

      const result = reconcile(credits, gens);

      expect(result.hasDiscrepancy).toBe(true);
      expect(result.reading.discrepancy).toBe(350); // 700 − 350
      expect(result.summary).toContain("Discrepancy of 350 credits");
      expect(result.summary).toContain("charged more than the records show");
      expect(result.summary).toContain("700 charged against 350 recorded");
    });

    it("should detect records showing more than was ever charged", () => {
      const credits = buildCreditData([
        { amount: -350, type: "generation" },
      ]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
        { status: "completed", type: "fullBody", pointsCost: 300 },
      ]);

      const result = reconcile(credits, gens);

      expect(result.hasDiscrepancy).toBe(true);
      expect(result.reading.discrepancy).toBe(-300); // 350 − 650
      expect(result.summary).toContain("charged less than the records show");
    });

    it("a REFINE charged through its operation with no `generations` row is explained", () => {
      // 221 of these, 5,525 credits, on one account — read by the old
      // rows-only formula as 5,525 credits unaccounted for (#119).
      const credits = buildCreditData([{ amount: -25, type: "generation" }]);
      const gens = buildGenData([]);

      const result = reconcile(credits, gens, 25);

      expect(result.reading.operationCost).toBe(25);
      expect(result.reading.expectedCost).toBe(25);
      expect(result.reading.discrepancy).toBe(0);
      expect(result.hasDiscrepancy).toBe(false);
    });

    it("a SIGN is explained by its operation's 450 charge, not by its five 50-credit rows", () => {
      const credits = buildCreditData([{ amount: -450, type: "generation" }]);
      const gens = buildGenData(
        Array.from({ length: 5 }, () => ({
          status: "completed", type: "castingImage", pointsCost: 50, operationId: 77,
        })),
      );

      const result = reconcile(credits, gens, 450);

      // Rows-only would read 450 − 250 = +200, and climb 200 per Sign for ever.
      expect(result.reading.unlinkedCost).toBe(0);
      expect(result.reading.completedCost).toBe(250);
      expect(result.reading.expectedCost).toBe(450);
      expect(result.reading.discrepancy).toBe(0);
    });
  });

  describe("Pending generations", () => {
    it("names generations still in flight when a discrepancy is reported", () => {
      const credits = buildCreditData([
        { amount: -1000, type: "generation" },
      ]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
        // Two rows already charged, both belonging to an operation that has
        // not recorded its charge yet — a charge can precede its record.
        { status: "pending", type: "fullBody", pointsCost: 300, operationId: 9 },
        { status: "pending", type: "castingImage", pointsCost: 350, operationId: 9 },
      ]);

      const result = reconcile(credits, gens, 0);

      expect(result.pendingCount).toBe(2);
      expect(result.reading.pendingCost).toBe(650);
      expect(result.reading.expectedCost).toBe(350);
      expect(result.reading.discrepancy).toBe(650);
      expect(result.summary).toContain("2 generation(s) still in flight");
      expect(result.summary).toContain("re-read once they settle");
    });

    it("no in-flight note appears when nothing is pending", () => {
      const credits = buildCreditData([{ amount: -700, type: "generation" }]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
      ]);

      const result = reconcile(credits, gens);

      expect(result.pendingCount).toBe(0);
      expect(result.hasDiscrepancy).toBe(true);
      expect(result.summary).not.toContain("still in flight");
    });
  });

  /*
   * ⚠ FIVE DESCRIBES ARE GONE FROM THIS FILE AND THEIR ARMS ARE NOT REPLACED,
   * which is worth saying out loud rather than leaving as an absence.
   *
   *   "Generation type breakdown", "Credit type breakdown", "Failure rate
   *   calculation" — their whole subject was the local `computeReconciliation`
   *   copy's row folding. There is no exported product function to point them
   *   at; re-writing them against the fixture fold above would test the
   *   fixture. They are dropped rather than re-mirrored (working law 4).
   *
   *   "Summary messaging — likely cause detection" (4 arms) — its subject was
   *   sentences the product no longer says: "pre-atomic-credits", "Partial
   *   refunds detected", "likely caused by … without matching refunds". Each
   *   asserted that an unrefunded failure CAUSED a discrepancy, which is the
   *   premise #119 overturned. The sentences the product says now are asserted
   *   in the arms above, each with a negative control.
   */

  describe("Edge cases", () => {
    it("should handle empty data gracefully", () => {
      const result = reconcile(buildCreditData([]), buildGenData([]));

      expect(result.reading.grossDeductions).toBe(0);
      expect(result.reading.expectedCost).toBe(0);
      expect(result.reading.netCost).toBe(0);
      expect(result.hasDiscrepancy).toBe(false);
      expect(result.summary).toContain("No discrepancy.");
    });

    it("should handle credits with no generation transactions", () => {
      const credits = buildCreditData([
        { amount: 5000, type: "subscription" },
        { amount: 12500, type: "referral" },
      ]);

      const result = reconcile(credits, buildGenData([]));

      expect(result.reading.grossDeductions).toBe(0);
      expect(result.reading.netCost).toBe(0);
      expect(result.hasDiscrepancy).toBe(false);
    });

    it("should handle generations with no credit transactions", () => {
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
      ]);

      const result = reconcile(buildCreditData([]), gens);

      expect(result.hasDiscrepancy).toBe(true);
      expect(result.reading.discrepancy).toBe(-350);
      expect(result.summary).toContain("charged less than the records show");
    });

    it("refunds against a mixed ledger move netCost only", () => {
      // Only "generation" transactions are the charge, and only "refund" ones
      // are the refund; an "export" spend is neither. The claim under test is
      // the rule's output: the refund moves `netCost` and leaves `discrepancy`
      // exactly where it was.
      const credits = buildCreditData([
        { amount: 5000, type: "subscription" },
        { amount: -350, type: "generation" },
        { amount: -100, type: "export" },
        { amount: -300, type: "generation" },
        { amount: 50, type: "refund" },
      ]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
        { status: "completed", type: "fullBody", pointsCost: 300 },
      ]);

      const result = reconcile(credits, gens);

      expect(result.reading.grossDeductions).toBe(650);
      expect(result.reading.totalRefunds).toBe(50);
      expect(result.reading.netCost).toBe(600);
      expect(result.reading.discrepancy).toBe(0);
    });

    it("all generations failed and refunded: no discrepancy, and the note is honest", () => {
      const credits = buildCreditData([
        { amount: -350, type: "generation" },
        { amount: -300, type: "generation" },
        { amount: 350, type: "refund" },
        { amount: 300, type: "refund" },
      ]);
      const gens = buildGenData([
        { status: "failed", type: "castingImage", pointsCost: 350 },
        { status: "failed", type: "fullBody", pointsCost: 300 },
      ]);

      const result = reconcile(credits, gens);

      expect(result.reading.netCost).toBe(0);
      expect(result.reading.discrepancy).toBe(0);
      expect(result.reading.unrefundedFailureCost).toBe(0);
      expect(result.summary).toContain("No discrepancy.");
      expect(result.summary).toContain("2 failed generation(s)");
      expect(result.summary).toContain("650 refunded");
    });
  });
});
