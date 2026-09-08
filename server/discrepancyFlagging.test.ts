/**
 * Tests for the credit discrepancy flagging logic.
 *
 * These tests verify the pure computation that determines which users
 * have discrepancies above a given threshold, without hitting the DB.
 *
 * ⚠ THE RULE THESE ARMS TEST CHANGED ON 2026-08-26 (#119), after the scan
 * froze the founder's own account for 22 hours on a number that was two
 * rulings out of date. Read the header of `server/db/discrepancyQueries.ts`
 * for the whole reading; the two facts every fixture below is built on are:
 *
 *   expectedCost = unlinkedCost + operationCost   (a charge is explained by
 *                                                  the record that recorded it)
 *   discrepancy  = grossDeductions − expectedCost
 *
 * So REFUNDS no longer move the discrepancy (they move `netCost` only), and a
 * FAILED row is not a discrepancy — failures refund only catastrophically by
 * founder ruling, so an unrefunded failure is the ruled outcome and is
 * reported as `unrefundedFailureCost` rather than flagged.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

/** This file lives at `server/`, so the repository root is one level up. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The threshold every surface actually asks with, READ OUT OF THE ONE FILE
 * THAT DECLARES IT rather than re-typed here.
 *
 * `DEFAULT_DISCREPANCY_THRESHOLD` lives in `client/`, which server code must
 * not import (#416 removed a server-side `.default(50)` for being a second
 * declaration one layer down, where the client's single-source guard cannot
 * walk). Typing `500` into a server test would put it back in a third place —
 * so the value is parsed from the declaring file, and a suite that cannot find
 * it refuses rather than falling back to a number of its own.
 */
const BADGE_THRESHOLD = (() => {
  const rel = "client/src/features/moderator/flagThresholds.ts";
  const source = readFileSync(resolve(REPO_ROOT, rel), "utf8");
  const match = source.match(/DEFAULT_DISCREPANCY_THRESHOLD\s*=\s*(\d+)/);
  if (!match) throw new Error(`${rel} no longer declares DEFAULT_DISCREPANCY_THRESHOLD`);
  return Number(match[1]);
})();

/*
 * ⚠ SIXTY LINES OF `discrepancyQueries.ts` USED TO BE RE-TYPED HERE, under a
 * heading that said so: "Mirror the core computation logic from
 * discrepancyQueries.ts". Every arm below tested that copy — the netCost
 * subtraction, the `Math.max(0, …)` floor on refunds, the `>=` threshold and
 * the abs-descending sort — so the CREDIT DISCREPANCY ARITHMETIC could have
 * been changed in the product with this file green about it.
 *
 * The copy was faithful when it was read (2026-08-25) and that is luck rather
 * than a property: a mirror is not caught being wrong, it makes the catching
 * assertion unwritable. `computeFlaggedDiscrepancies` and
 * `attachUserInfoToFlagged` are now named exports of the production module
 * with `getUsersWithDiscrepancies` as their first reader, and the arms drive
 * those. Filed under 3g's A. Working law 4: derive, never mirror.
 *
 * The formula change of #119 is exactly why that matters: fifteen arms below
 * went RED on it, which is the whole point of not owning a copy.
 */
import { generations } from "../drizzle/schema";
import { EVIDENCE_CANDIDATE_GENERATION_TYPE } from "./casting/evidence/evidenceCandidateContract";
import {
  attachUserInfoToFlagged,
  computeDiscrepancy,
  computeFlaggedDiscrepancies,
  type DiscrepancyCreditAgg,
  type DiscrepancyGenAgg,
  type DiscrepancyOperationAgg,
  type FlaggedUserDiscrepancy,
} from "./db/discrepancyQueries";

type CreditAgg = DiscrepancyCreditAgg;
type GenAgg = DiscrepancyGenAgg;
type OpAgg = DiscrepancyOperationAgg;

/** The production trio, composed the way `getUsersWithDiscrepancies` composes them. */
function computeDiscrepancies(
  creditAgg: CreditAgg[],
  genAgg: GenAgg[],
  operationAgg: OpAgg[],
  userInfo: Array<{ id: number; name: string | null; email: string | null }>,
  threshold: number,
): { users: FlaggedUserDiscrepancy[]; scannedCount: number } {
  const { flagged, scannedCount } = computeFlaggedDiscrepancies(
    creditAgg,
    genAgg,
    operationAgg,
    threshold,
  );
  return { users: attachUserInfoToFlagged(flagged, userInfo), scannedCount };
}

// ── Tests ──

describe("Credit Discrepancy Flagging", () => {
  const users = [
    { id: 1, name: "Alice", email: "alice@test.com" },
    { id: 2, name: "Bob", email: "bob@test.com" },
    { id: 3, name: "Charlie", email: "charlie@test.com" },
    { id: 4, name: null, email: null },
  ];

  it("should flag users with discrepancy above threshold", () => {
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 500, totalRefunds: 0 },
      { userId: 2, grossDeductions: 200, totalRefunds: 0 },
    ];
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 400, pendingCost: 0, failedCost: 0, unlinkedCost: 400, totalGenerations: 10, failedGenerations: 0 },
      { userId: 2, completedCost: 200, pendingCost: 0, failedCost: 0, unlinkedCost: 200, totalGenerations: 5, failedGenerations: 0 },
    ];
    const ops: OpAgg[] = [];

    const result = computeDiscrepancies(credits, gens, ops, users, 50);

    // User 1: 500 charged, 400 recorded → +100. User 2: 200 against 200 → 0.
    expect(result.users).toHaveLength(1);
    expect(result.users[0].userId).toBe(1);
    expect(result.users[0].discrepancy).toBe(100);
    expect(result.users[0].expectedCost).toBe(400);
    expect(result.scannedCount).toBe(2);
  });

  it("should return empty when no discrepancies exceed threshold", () => {
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 100, totalRefunds: 0 },
    ];
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 100, pendingCost: 0, failedCost: 0, unlinkedCost: 100, totalGenerations: 5, failedGenerations: 0 },
    ];

    const result = computeDiscrepancies(credits, gens, [], users, 50);

    expect(result.users).toHaveLength(0);
    expect(result.scannedCount).toBe(1);
  });

  it("refunds change netCost but NOT the discrepancy", () => {
    // This arm used to be "should account for refunds when computing net cost",
    // and it asserted that a 200-credit refund closed a 200-credit gap. It no
    // longer does: a refund is written by the product or by staff, and a
    // correction of DELIVERED work is unbounded by anything a record holds, so
    // a refund-side term was a false-positive generator (#119 header).
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 500, totalRefunds: 200 },
    ];

    // (i) records explain the whole charge → no discrepancy, netCost still moves.
    const aligned = computeDiscrepancies(
      credits,
      [{ userId: 1, completedCost: 500, pendingCost: 0, failedCost: 0, unlinkedCost: 500, totalGenerations: 10, failedGenerations: 2 }],
      [],
      users,
      1,
    );
    expect(aligned.users).toHaveLength(0);
    const alignedReading = computeDiscrepancy({
      grossDeductions: 500, totalRefunds: 200, completedCost: 500, pendingCost: 0,
      failedCost: 0, unlinkedCost: 500, operationCost: 0,
    });
    expect(alignedReading.netCost).toBe(300);
    expect(alignedReading.discrepancy).toBe(0);

    // (ii) 300 recorded against 500 charged. The OLD formula read
    //      (500 − 200) − 300 = 0 and said nothing. The rule reads +200.
    const gap = computeDiscrepancies(
      credits,
      [{ userId: 1, completedCost: 300, pendingCost: 0, failedCost: 0, unlinkedCost: 300, totalGenerations: 10, failedGenerations: 2 }],
      [],
      users,
      50,
    );
    expect(gap.users).toHaveLength(1);
    expect(gap.users[0].discrepancy).toBe(200);
    expect(gap.users[0].netCost).toBe(300);
  });

  it("pending cost is reported, and counts as a record only through unlinkedCost", () => {
    // Previously "should account for pending costs", where `pendingCost` was a
    // term of the formula. It is not one now — a pending row's cost reaches the
    // record side the same way any other row's does, by being unlinked (or by
    // belonging to an operation). `pendingCost` is carried for the reader.
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 500, totalRefunds: 0 },
    ];

    const counted = computeDiscrepancies(
      credits,
      [{ userId: 1, completedCost: 400, pendingCost: 100, failedCost: 0, unlinkedCost: 500, totalGenerations: 12, failedGenerations: 0 }],
      [],
      users,
      1,
    );
    expect(counted.users).toHaveLength(0);

    // The same rows with the pending one still unrecorded: 500 charged, 400 recorded.
    const notYetRecorded = computeDiscrepancies(
      credits,
      [{ userId: 1, completedCost: 400, pendingCost: 100, failedCost: 0, unlinkedCost: 400, totalGenerations: 12, failedGenerations: 0 }],
      [],
      users,
      50,
    );
    expect(notYetRecorded.users).toHaveLength(1);
    expect(notYetRecorded.users[0].discrepancy).toBe(100);
    expect(notYetRecorded.users[0].pendingCost).toBe(100);
  });

  it("should sort results by absolute discrepancy descending", () => {
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 200, totalRefunds: 0 },
      { userId: 2, grossDeductions: 500, totalRefunds: 0 },
      { userId: 3, grossDeductions: 350, totalRefunds: 0 },
    ];
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 100, pendingCost: 0, failedCost: 0, unlinkedCost: 100, totalGenerations: 5, failedGenerations: 0 },
      { userId: 2, completedCost: 200, pendingCost: 0, failedCost: 0, unlinkedCost: 200, totalGenerations: 10, failedGenerations: 0 },
      { userId: 3, completedCost: 200, pendingCost: 0, failedCost: 0, unlinkedCost: 200, totalGenerations: 8, failedGenerations: 0 },
    ];

    const result = computeDiscrepancies(credits, gens, [], users, 50);

    expect(result.users).toHaveLength(3);
    expect(result.users[0].userId).toBe(2); // 300 discrepancy
    expect(result.users[1].userId).toBe(3); // 150 discrepancy
    expect(result.users[2].userId).toBe(1); // 100 discrepancy
  });

  it("should handle users with only credit transactions (no records at all)", () => {
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 100, totalRefunds: 0 },
    ];

    const result = computeDiscrepancies(credits, [], [], users, 50);

    expect(result.users).toHaveLength(1);
    expect(result.users[0].discrepancy).toBe(100);
    expect(result.users[0].expectedCost).toBe(0);
    expect(result.users[0].totalGenerations).toBe(0);
  });

  it("should handle users with only generations (no credit transactions)", () => {
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 100, pendingCost: 0, failedCost: 0, unlinkedCost: 100, totalGenerations: 5, failedGenerations: 0 },
    ];

    const result = computeDiscrepancies([], gens, [], users, 50);

    // 0 charged, 100 recorded → -100
    expect(result.users).toHaveLength(1);
    expect(result.users[0].discrepancy).toBe(-100);
  });

  it("should flag negative discrepancies (more recorded cost than deductions)", () => {
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 50, totalRefunds: 0 },
    ];
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 200, pendingCost: 0, failedCost: 0, unlinkedCost: 200, totalGenerations: 10, failedGenerations: 0 },
    ];

    const result = computeDiscrepancies(credits, gens, [], users, 50);

    expect(result.users).toHaveLength(1);
    expect(result.users[0].discrepancy).toBe(-150);
  });

  it("should respect different threshold values", () => {
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 130, totalRefunds: 0 },
    ];
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 100, pendingCost: 0, failedCost: 0, unlinkedCost: 100, totalGenerations: 5, failedGenerations: 0 },
    ];

    // Discrepancy = 30
    expect(computeDiscrepancies(credits, gens, [], users, 25).users).toHaveLength(1);
    expect(computeDiscrepancies(credits, gens, [], users, 30).users).toHaveLength(1);
    expect(computeDiscrepancies(credits, gens, [], users, 31).users).toHaveLength(0);
    expect(computeDiscrepancies(credits, gens, [], users, 100).users).toHaveLength(0);
  });

  it("should include user info for flagged users", () => {
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 200, totalRefunds: 0 },
    ];
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 100, pendingCost: 0, failedCost: 0, unlinkedCost: 100, totalGenerations: 5, failedGenerations: 1 },
    ];

    const result = computeDiscrepancies(credits, gens, [], users, 50);

    expect(result.users[0].userName).toBe("Alice");
    expect(result.users[0].email).toBe("alice@test.com");
    expect(result.users[0].failedGenerations).toBe(1);
  });

  it("should handle unknown users gracefully (null name/email)", () => {
    const credits: CreditAgg[] = [
      { userId: 4, grossDeductions: 200, totalRefunds: 0 },
    ];
    const gens: GenAgg[] = [
      { userId: 4, completedCost: 100, pendingCost: 0, failedCost: 0, unlinkedCost: 100, totalGenerations: 5, failedGenerations: 0 },
    ];

    const result = computeDiscrepancies(credits, gens, [], users, 50);

    expect(result.users[0].userName).toBeNull();
    expect(result.users[0].email).toBeNull();
  });

  it("should handle user not found in user info", () => {
    const credits: CreditAgg[] = [
      { userId: 999, grossDeductions: 200, totalRefunds: 0 },
    ];
    const gens: GenAgg[] = [
      { userId: 999, completedCost: 100, pendingCost: 0, failedCost: 0, unlinkedCost: 100, totalGenerations: 5, failedGenerations: 0 },
    ];

    const result = computeDiscrepancies(credits, gens, [], users, 50);

    expect(result.users[0].userId).toBe(999);
    expect(result.users[0].userName).toBeNull();
    expect(result.users[0].email).toBeNull();
  });

  it("should clamp negative refunds to zero (netCost only — the discrepancy never saw them)", () => {
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 100, totalRefunds: -50 },
    ];
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 50, pendingCost: 0, failedCost: 0, unlinkedCost: 50, totalGenerations: 3, failedGenerations: 0 },
    ];

    const result = computeDiscrepancies(credits, gens, [], users, 50);

    // totalRefunds clamped to 0, netCost = 100, discrepancy = 100 - 50 = 50
    expect(result.users).toHaveLength(1);
    expect(result.users[0].totalRefunds).toBe(0);
    expect(result.users[0].netCost).toBe(100);
    expect(result.users[0].discrepancy).toBe(50);
  });

  it("should count scanned users correctly across all three tables", () => {
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 10, totalRefunds: 0 },
      { userId: 2, grossDeductions: 10, totalRefunds: 0 },
    ];
    const gens: GenAgg[] = [
      { userId: 2, completedCost: 10, pendingCost: 0, failedCost: 0, unlinkedCost: 10, totalGenerations: 1, failedGenerations: 0 },
      { userId: 3, completedCost: 10, pendingCost: 0, failedCost: 0, unlinkedCost: 10, totalGenerations: 1, failedGenerations: 0 },
    ];
    const ops: OpAgg[] = [{ userId: 3, operationCost: 10 }];

    const result = computeDiscrepancies(credits, gens, ops, users, 1000);

    // Users 1, 2, 3 are scanned (deduplicated across all three)
    expect(result.scannedCount).toBe(3);
  });

  it("should handle empty inputs", () => {
    const result = computeDiscrepancies([], [], [], users, 50);

    expect(result.users).toHaveLength(0);
    expect(result.scannedCount).toBe(0);
  });

  // ── The shapes production actually holds (#119) ──

  it("a REFINE: charged through its operation with no `generations` row is NOT a discrepancy", () => {
    // Casting V2 charges a refine 25 credits through `generation_operations`
    // and writes no `generations` row at all. On one production account that
    // was 221 refines, 5,525 credits — read by the OLD rows-only formula as
    // 5,525 credits of missing records, which is how the founder's own account
    // came to be frozen.
    const credits: CreditAgg[] = [{ userId: 1, grossDeductions: 25, totalRefunds: 0 }];
    const gens: GenAgg[] = [];
    const ops: OpAgg[] = [{ userId: 1, operationCost: 25 }];

    const reading = computeDiscrepancy({
      grossDeductions: 25, totalRefunds: 0, completedCost: 0, pendingCost: 0,
      failedCost: 0, unlinkedCost: 0, operationCost: 25,
    });
    expect(reading.expectedCost).toBe(25);
    expect(reading.discrepancy).toBe(0); // the OLD formula would have read 25

    // and it reaches no moderator's screen, even at the lowest threshold.
    expect(computeDiscrepancies(credits, gens, ops, users, 1).users).toHaveLength(0);
  });

  it("a SIGN: the operation's own 450 charge is the record, not its five 50-credit audit rows", () => {
    // A Sign charges 450 through its operation and writes five `generations`
    // rows at 50 each, all LINKED to that operation (so `unlinkedCost` is 0).
    // Counting the rows instead would read 450 − 250 = +200, and climb 200 per
    // Sign for ever — #119's own defect class, a premise that drifts with
    // ordinary use.
    const credits: CreditAgg[] = [{ userId: 1, grossDeductions: 450, totalRefunds: 0 }];
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 250, pendingCost: 0, failedCost: 0, unlinkedCost: 0, totalGenerations: 5, failedGenerations: 0 },
    ];
    const ops: OpAgg[] = [{ userId: 1, operationCost: 450 }];

    const reading = computeDiscrepancy({
      grossDeductions: 450, totalRefunds: 0, completedCost: 250, pendingCost: 0,
      failedCost: 0, unlinkedCost: 0, operationCost: 450,
    });
    expect(reading.operationCost).toBe(450);
    expect(reading.expectedCost).toBe(450);
    expect(reading.discrepancy).toBe(0); // rows-only would read +200

    expect(computeDiscrepancies(credits, gens, ops, users, 1).users).toHaveLength(0);
  });

  it("an UNREFUNDED FAILURE is the ruled outcome, reported and never flagged", () => {
    // Failures refund only catastrophically (founder ruling, `5c5a1f3f`), so a
    // failed row's cost is an explained charge. Production held 10,730 credits
    // of failed rows against 9,750 refunded overall.
    const credits: CreditAgg[] = [{ userId: 1, grossDeductions: 350, totalRefunds: 0 }];
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 0, pendingCost: 0, failedCost: 350, unlinkedCost: 350, totalGenerations: 1, failedGenerations: 1 },
    ];

    const reading = computeDiscrepancy({
      grossDeductions: 350, totalRefunds: 0, completedCost: 0, pendingCost: 0,
      failedCost: 350, unlinkedCost: 350, operationCost: 0,
    });
    expect(reading.discrepancy).toBe(0);
    expect(reading.failedCost).toBe(350);
    expect(reading.unrefundedFailureCost).toBe(350);

    expect(computeDiscrepancies(credits, gens, [], users, 1).users).toHaveLength(0);
  });

  it("a GENUINE discrepancy still flags, in both directions", () => {
    // The rule is narrower, not blind: money charged that no record explains
    // is still the thing this scan exists to surface.
    const over = computeDiscrepancies(
      [{ userId: 1, grossDeductions: 5000, totalRefunds: 0 }],
      [{ userId: 1, completedCost: 1000, pendingCost: 0, failedCost: 0, unlinkedCost: 1000, totalGenerations: 20, failedGenerations: 0 }],
      [{ userId: 1, operationCost: 1500 }],
      users,
      2000,
    );
    expect(over.users).toHaveLength(1);
    expect(over.users[0].expectedCost).toBe(2500);
    expect(over.users[0].discrepancy).toBe(2500);

    // and the other direction — records showing more than was ever charged.
    const under = computeDiscrepancies(
      [{ userId: 2, grossDeductions: 2500, totalRefunds: 0 }],
      [{ userId: 2, completedCost: 3500, pendingCost: 0, failedCost: 0, unlinkedCost: 3500, totalGenerations: 20, failedGenerations: 0 }],
      [{ userId: 2, operationCost: 1500 }],
      users,
      2000,
    );
    expect(under.users).toHaveLength(1);
    expect(under.users[0].expectedCost).toBe(5000);
    expect(under.users[0].discrepancy).toBe(-2500);
  });

  it("REFUND ANOMALY: refunds exceeding every generation charge flag the account whatever the threshold", () => {
    // The refund-lane bound (module header): the charge-side rule cannot see
    // a double-fired refund, so an account credited more than it was ever
    // charged is flagged on that fact alone. 1,000 charged, 1,200 refunded,
    // records 1,000 — discrepancy 0, and it is still listed.
    const credits: CreditAgg[] = [{ userId: 1, grossDeductions: 1000, totalRefunds: 1200 }];
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 700, pendingCost: 0, failedCost: 300, unlinkedCost: 1000, totalGenerations: 4, failedGenerations: 1 },
    ];
    const result = computeDiscrepancies(credits, gens, [], users, 2000);
    expect(result.users).toHaveLength(1);
    expect(result.users[0].discrepancy).toBe(0);
    expect(result.users[0].refundAnomaly).toBe(true);

    // Negative control: refunds AT the charges is not an anomaly (a fully refunded account is ordinary).
    const even = computeDiscrepancies(
      [{ userId: 1, grossDeductions: 1000, totalRefunds: 1000 }], gens, [], users, 2000,
    );
    expect(even.users).toHaveLength(0);
  });

  it("scannedCount counts a user present ONLY in the operation aggregation", () => {
    // A Casting V2 refine account can have no `credit_transactions` row in the
    // window and no `generations` row at all. Before the operation
    // aggregation existed, such a user was not scanned — invisible rather
    // than clean.
    const ops: OpAgg[] = [{ userId: 7, operationCost: 25 }];

    const result = computeDiscrepancies([], [], ops, users, 1);

    expect(result.scannedCount).toBe(1);
    // 0 charged against 25 recorded → -25, flagged at threshold 1.
    expect(result.users).toHaveLength(1);
    expect(result.users[0].userId).toBe(7);
    expect(result.users[0].discrepancy).toBe(-25);
  });
});

/*
 * THE PRODUCTION RESIDUAL ON THE FOUNDER'S ACCOUNT, PINNED AT ITS OWN SHAPE.
 *
 * (Card 0462.) The scan flags account 1 at −11,600 and puts a `1` on his
 * account menu's Moderation badge. These arms exist so that number is a
 * REPRODUCIBLE consequence of the formula rather than a sentence in a
 * docblock — which is precisely how the previous reading of this account
 * ("+1,050") survived twelve days while being unreproducible.
 *
 * Every figure below was read at the production rows on 2026-09-07 and is
 * quoted in the header of `server/db/discrepancyQueries.ts` with its
 * decomposition. They are pinned as CURRENT BEHAVIOUR, not as correct
 * behaviour: the double-count these arms exhibit is the open defect, and a
 * repair has to come here and change an arm that says what it is changing.
 * That repair is card 0638, which carries the three roads and the
 * recommendation; 0462 measured the cause and closed.
 */
describe("the founder's account: what the residual is made of", () => {
  /** Read at production 2026-09-07 — the three aggregations for user 1. */
  const GROSS = 117_890;
  const UNLINKED = 70_750;
  const OPERATION = 58_740;
  /** The 45 `evidenceCandidate` rows, every one with `operationId IS NULL`. */
  const EVIDENCE_UNLINKED = 11_450;

  const users = [{ id: 1, name: "founder", email: "f@example.com" }];

  function reading(unlinkedCost: number, failedCost = 11_110) {
    return computeDiscrepancies(
      [{ userId: 1, grossDeductions: GROSS, totalRefunds: 10_230 }],
      [{
        userId: 1,
        completedCost: 97_030,
        pendingCost: 350,
        failedCost,
        unlinkedCost,
        totalGenerations: 2_145,
        failedGenerations: 82,
      }],
      [{ userId: 1, operationCost: OPERATION }],
      users,
      50,
    );
  }

  /*
   * ⚠ THIS ARM NOW PINS WHAT THE SCAN READ *BEFORE* #638, AND IT IS KEPT
   * BECAUSE THE ARITHMETIC IS WHAT THE REPAIR HAD TO ANSWER. `unlinkedCost`
   * is an INPUT here, so this reading is unchanged by the exclusion — what
   * changed is which rows the SQL puts into it, and that is the arm below.
   */
  it("reproduces the -11,600 the scan reported before the family was excluded", () => {
    const result = reading(UNLINKED);

    expect(result.users).toHaveLength(1);
    expect(result.users[0].discrepancy).toBe(-11_600);
    // And it is what put a 1 on his Moderation badge: one account, flagged.
    expect(result.scannedCount).toBe(1);
  });

  /*
   * ⚠ THE CONSTANT MUST NAME A TYPE THE COLUMN ACTUALLY HAS, AND THIS ARM
   * EXISTS BECAUSE A SABOTAGE PROVED NOTHING ELSE COULD SAY SO.
   *
   * Every other arm compares the constant to ITSELF — the SQL arm asserts the
   * bound parameter equals `EVIDENCE_CANDIDATE_GENERATION_TYPE`, the writers
   * arm greps for the identifier — so misspelling its VALUE left all thirty
   * green while the predicate excluded nothing and the badge stayed lit. An
   * assertion that reads its own subject is not a reader of it.
   *
   * The enum is the independent side: `generations.type` is where the product
   * declares what a row may be, and it is not derived from this constant.
   */
  it("the excluded type is one the generations column can actually hold", () => {
    expect(generations.type.enumValues).toContain(EVIDENCE_CANDIDATE_GENERATION_TYPE);
  });

  /*
   * ⚠ THE POPULATION CANNOT GROW, AND THAT IS THE WHOLE CASE FOR AN EXCLUSION
   * KEYED ON A `type` VALUE BEING NARROW RATHER THAN AN OPEN EXEMPTION.
   *
   * The predicate can only ever drop a row that has NO operation. Both live
   * writers of this type set `operationId` in the same INSERT, so no road the
   * product still runs can create a row it would drop. Asserted at the writers'
   * own bytes rather than promised in prose: a writer that quietly stopped
   * setting `operationId` would reopen the exemption with nothing going red,
   * which is the shape this repair's whole narrowness rests on.
   */
  it("both live writers of the evidence type set operationId, so the exclusion cannot grow", () => {
    const writers = [
      "server/db/inkAddCandidates.ts",
      "server/casting/evidence/evidenceFork.ts",
    ];

    for (const rel of writers) {
      const source = readFileSync(resolve(REPO_ROOT, rel), "utf8");

      // It names the family through the shared constant, never a re-typed literal.
      expect(source, rel).not.toContain('"evidenceCandidate"');

      const uses = [...source.matchAll(/type:\s*EVIDENCE_CANDIDATE_GENERATION_TYPE/g)];
      expect(uses.length, `${rel} writes the family`).toBeGreaterThan(0);

      // Every insert of it carries an operationId in the same values object.
      for (const use of uses) {
        const valuesBlockStart = source.lastIndexOf("userId:", use.index);
        expect(valuesBlockStart, `${rel}: a values object above the type`).toBeGreaterThan(-1);
        const block = source.slice(valuesBlockStart, use.index);
        expect(block, `${rel}: operationId beside the type it writes`).toContain("operationId:");
      }
    }
  });

  /*
   * THE REPAIR SHOWN RATHER THAN ASSERTED. The 45 evidence rows are the work
   * of operations that charged 9,300 and own no rows at all, so the same work
   * enters `expected` twice. Excluding them from `unlinkedCost` — which is what
   * `UNLINKED_ROW_SQL` now does — moves the reading by exactly their cost, and
   * takes it under the threshold the badge is drawn at.
   *
   * ⚠ THIS ARM USED TO BE NAMED FOR THE OTHER ROAD, AND THE NAME WAS THE BUG.
   * It read "attributing the evidence rows to the operations that charged for
   * them leaves -150", and its comment said `operationCost` is "deliberately
   * UNCHANGED between the two: linking a row to an operation that already
   * recorded a charge adds nothing". That premise is true of 34 of the 46
   * operations and FALSE of the other 12, which recorded `chargedCredits = 0`
   * and would therefore pick their rows back up through the fallback branch.
   * So the arm modelled EXCLUSION and was named for LINKING, and -150 — the
   * exclusion's number — was read as the linking road's number. #638's
   * recommendation was built on it. Driven at the production rows on
   * 2026-09-09: linking lands on -4,100, not -150, and leaves him flagged.
   * A double that answers like the outcome is not a reader of the outcome.
   */
  it("excluding the parked evidence family from the unlinked side leaves -150", () => {
    const asShipped = reading(UNLINKED).users[0].discrepancy;
    const ifExcluded = reading(UNLINKED - EVIDENCE_UNLINKED).users[0].discrepancy;

    expect(asShipped).toBe(-11_600);
    expect(ifExcluded).toBe(-150);
    expect(ifExcluded - asShipped).toBe(EVIDENCE_UNLINKED);
    // And that is the half that matters: the badge is drawn at 500.
    expect(Math.abs(ifExcluded)).toBeLessThan(BADGE_THRESHOLD);
    expect(Math.abs(asShipped)).toBeGreaterThanOrEqual(BADGE_THRESHOLD);
  });

  /*
   * ⚠ THE ROAD THAT WAS DECLINED, PINNED SO IT CANNOT BE RE-RECOMMENDED FROM
   * MEMORY. Linking the rows was #638's own recommendation and it is possible:
   * all 45 match one `evidence_candidate_generate` operation each, 0 orphans,
   * 0 ambiguous, every charged operation's linked-row sum equal to its charge.
   * It was declined because of what it LANDS ON, and this arm is that number.
   *
   * 12 of the 46 operations recorded no charge while owning a cost-bearing row
   * (3,950 credits between them), so linking moves that cost out of the
   * unlinked side and straight back in through `operationCost`'s fallback.
   */
  it("linking the rows instead would land on -4,100 and leave the badge lit", () => {
    const FALLBACK_PICKUP = 3_950; // the 12 zero-charge operations' rows

    const ifLinked = computeDiscrepancies(
      [{ userId: 1, grossDeductions: GROSS, totalRefunds: 10_230 }],
      [{
        userId: 1,
        completedCost: 97_030,
        pendingCost: 350,
        failedCost: 11_110,
        unlinkedCost: UNLINKED - EVIDENCE_UNLINKED,
        totalGenerations: 2_145,
        failedGenerations: 82,
      }],
      // The fallback branch picks the zero-charge operations' rows back up.
      [{ userId: 1, operationCost: OPERATION + FALLBACK_PICKUP }],
      users,
      50,
    ).users[0].discrepancy;

    // The mechanism: the pickup comes back through operationCost, credit for credit.
    expect(ifLinked).toBe(-150 - FALLBACK_PICKUP);
    // And the measured number itself, so the arm is not merely self-consistent
    // for whatever pickup someone types above it.
    expect(ifLinked).toBe(-4_100);
    expect(Math.abs(ifLinked)).toBeGreaterThanOrEqual(BADGE_THRESHOLD);
  });

  /*
   * THE REFUTED LEAD, KEPT. The card was filed on the theory that FAILED
   * generations are counted into `expected` and never charged. Failure status
   * is not an input to the discrepancy at all: it is reported, never summed.
   * A reading that differs only in `failedCost` — here, every failed credit on
   * the account against none of them — gives the same number.
   */
  it("failure status does not move the discrepancy, so failed rows are not the mechanism", () => {
    const withFailures = reading(UNLINKED, 11_110);
    const withNone = reading(UNLINKED, 0);

    expect(withFailures.users[0].discrepancy).toBe(withNone.users[0].discrepancy);
    expect(withFailures.users[0].discrepancy).toBe(-11_600);
    // It is reported instead, net of refunds — the ruled outcome, shown, never flagged.
    expect(withFailures.users[0].failedCost).toBe(11_110);
  });

  /*
   * THE LIVE ROAD IS CLEAN, and this is the arm that says the residual is
   * historical rather than growing. On production the V2 side balances to the
   * credit on every account that has one — 58,740 charged against 58,740
   * recorded here, 3,750 against 3,750 on the other — so an account whose
   * charges all travel the operation road reads zero however much it rolls.
   */
  it("an account whose charges all travel the operation road reads zero", () => {
    const result = computeDiscrepancies(
      [{ userId: 17_603, grossDeductions: 3_750, totalRefunds: 0 }],
      [],
      [{ userId: 17_603, operationCost: 3_750 }],
      [{ id: 17_603, name: "a customer", email: "c@example.com" }],
      1,
    );

    expect(result.scannedCount).toBe(1);
    expect(result.users).toHaveLength(0);
  });
});
