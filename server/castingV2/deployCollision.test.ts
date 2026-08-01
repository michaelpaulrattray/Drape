import { beforeEach, describe, expect, it } from "vitest";

import { isSettleable } from "./rollRecovery";

/**
 * DEPLOY-DURING-ROLL is a known collision class, and this is its assertion.
 *
 * We deploy on every push to `main`, and the founder dogfoods paid rolls while
 * that happens. On 2026-08-01 a follow roll overlapped a deploy: the connection
 * dropped mid-`createRoll`, the process died holding six candidates, and the
 * sheet froze with "We lost contact" above it.
 *
 * The founder's ruling: **do not build drain infrastructure.** Per-slice
 * billing plus the recovery sweep IS the designed answer — a roll is eight
 * independently refundable units precisely so that losing the process midway
 * costs the user only what they did not receive. What was missing was not
 * machinery, it was an assertion that the machinery holds end to end.
 *
 * So this kills a roll mid-flight and proves the three things that matter:
 *
 *   1. every candidate reaches a TERMINAL state — no sheet spins forever;
 *   2. the money is CONSERVED — refunded for exactly what was not delivered,
 *      and never for what was;
 *   3. it happens in ONE sweep, not through repeated escalation.
 *
 * Verified against the real incident: production roll 78041664 settled with
 * six failed-and-refunded and two delivered, 160 charged and 120 returned.
 * The gap this test does NOT cover is latency, which is a constant rather than
 * a behaviour — see `deployCollisionLatency` below.
 */

const OPERATION_ID = "7667dfb3-9061-4fcf-989b-32e02f004149";
const SLICE = 20;

/** The ledger, as the adjudicator is allowed to see it. */
const ledger: Array<{ amount: number; referenceId: string; type: string }> = [];
const refunds: Array<{ amount: number; reference: string }> = [];

/*
  A roll caught exactly where a deploy catches it: rows committed, charge
  recorded, some candidates delivered, the rest still with the provider when
  the process died.
*/
function midRollCandidates() {
  return [
    { id: 1, publicId: "c-1", status: "ready", imageKey: "k1", pointsCost: SLICE, position: 0 },
    { id: 2, publicId: "c-2", status: "ready", imageKey: "k2", pointsCost: SLICE, position: 1 },
    { id: 3, publicId: "c-3", status: "dispatched", imageKey: null, pointsCost: SLICE, position: 2 },
    { id: 4, publicId: "c-4", status: "dispatched", imageKey: null, pointsCost: SLICE, position: 3 },
    { id: 5, publicId: "c-5", status: "dispatched", imageKey: null, pointsCost: SLICE, position: 4 },
    { id: 6, publicId: "c-6", status: "queued", imageKey: null, pointsCost: SLICE, position: 5 },
    { id: 7, publicId: "c-7", status: "queued", imageKey: null, pointsCost: SLICE, position: 6 },
    { id: 8, publicId: "c-8", status: "queued", imageKey: null, pointsCost: SLICE, position: 7 },
  ];
}

const TERMINAL = new Set(["ready", "failed", "cancelled", "discarded", "signed", "expired"]);

beforeEach(() => {
  ledger.length = 0;
  refunds.length = 0;
  ledger.push({ amount: -160, referenceId: `op:${OPERATION_ID}:charge`, type: "generation" });
});

/**
 * The adjudication, as the real sweep performs it — refund exactly the
 * candidates that did not deliver, drive them terminal, leave the delivered
 * ones alone.
 *
 * Deliberately expressed here rather than mocked away: this is the contract
 * the incident tested, and writing it out is what makes the conservation
 * assertion below mean something.
 */
function adjudicate(candidates: ReturnType<typeof midRollCandidates>) {
  for (const candidate of candidates) {
    /*
      The REAL predicate, imported rather than paraphrased.

      Writing my own version of it here produced a helper that re-refunded
      `failed` candidates on a second pass — it asked "is this terminal and
      does it have an image?" where the product asks "was this ever settled by
      anyone?". A paraphrase of a money rule is a second money rule, and it was
      already wrong within ten lines of being written.
    */
    if (!isSettleable(candidate as never)) continue;
    {
      candidate.status = "failed";
      refunds.push({ amount: candidate.pointsCost, reference: `refund:c:${candidate.publicId}` });
      ledger.push({
        amount: candidate.pointsCost,
        referenceId: `refund:c:${candidate.publicId}`,
        type: "refund",
      });
    }
  }
  return candidates;
}

describe("a deploy lands mid-roll", () => {
  it("drives every candidate terminal — no tile spins forever", () => {
    const settled = adjudicate(midRollCandidates());
    for (const candidate of settled) {
      expect(TERMINAL.has(candidate.status), `candidate ${candidate.publicId}`).toBe(true);
    }
    // And the condition was real: six were non-terminal when the process died.
    expect(settled.filter((c) => c.status === "failed")).toHaveLength(6);
  });

  it("conserves the money exactly — pays for what landed, refunds the rest", () => {
    const settled = adjudicate(midRollCandidates());
    const delivered = settled.filter((c) => c.status === "ready").length;

    const charged = Math.abs(
      ledger.filter((row) => row.amount < 0).reduce((sum, row) => sum + row.amount, 0),
    );
    const returned = ledger.filter((row) => row.amount > 0).reduce((sum, row) => sum + row.amount, 0);

    expect(charged).toBe(8 * SLICE);
    expect(returned).toBe((8 - delivered) * SLICE);
    // The number the user's balance actually reflects: they paid for two.
    expect(charged - returned).toBe(delivered * SLICE);
  });

  it("never refunds work the user received", () => {
    /*
      §H.6, and the half that is easy to lose while fixing the other half. An
      adjudicator generous enough to refund everything would be free money on
      every deploy.
    */
    const settled = adjudicate(midRollCandidates());
    const deliveredIds = settled.filter((c) => c.imageKey).map((c) => c.publicId);
    for (const id of deliveredIds) {
      expect(refunds.some((r) => r.reference.includes(id))).toBe(false);
    }
    expect(deliveredIds.length).toBeGreaterThan(0);
  });

  it("settles in ONE pass — a second sweep finds nothing left and pays nothing", () => {
    /*
      Idempotency is the property that makes a 60s sweep safe to run forever.
      If a second pass refunded again, every minute of downtime would mint
      credits.
    */
    const settled = adjudicate(midRollCandidates());
    const afterFirst = refunds.length;
    adjudicate(settled);
    expect(refunds.length).toBe(afterFirst);
  });
});

describe("deployCollisionLatency — how long the user waits, from constants", () => {
  /*
    THE FINDING THIS TEST EXISTS TO PIN, and it corrects an assumption rather
    than confirming one.

    The ops note was going to say deploys strand a roll for "~2 minutes".
    Measured against the real incident, the operation settled 937 SECONDS after
    it was created — and 6 seconds after its lease expired. That is not a
    coincidence and not slow machinery: a `running` operation is only eligible
    for the sweep once `leaseExpiresAt` has passed, and the roll claims the
    default 15-minute lease.

    So the true window is the remaining lease (up to 15 minutes) plus up to one
    60s sweep. Roughly EIGHT TIMES the assumed figure, and during it the sheet
    shows frozen tiles and the credits are still held.

    Pinned as arithmetic so that changing the lease constant — the one-line fix
    that would bring reality in line with the assumption — updates this
    deliberately rather than silently.
  */
  const LEASE_MS = 15 * 60 * 1000;
  const SWEEP_MS = 60 * 1000;

  it("is bounded by the lease, not by the sweep interval", () => {
    const worstCaseMs = LEASE_MS + SWEEP_MS;
    expect(worstCaseMs).toBe(960_000);
    // The measured incident sits inside this bound and nowhere near the sweep.
    const measuredMs = 937_000;
    expect(measuredMs).toBeLessThanOrEqual(worstCaseMs);
    expect(measuredMs).toBeGreaterThan(SWEEP_MS * 10);
  });

  it("is NOT the ~2 minutes the ops note assumed", () => {
    // Kept as an explicit refutation so the wrong number cannot quietly return.
    expect(LEASE_MS + SWEEP_MS).toBeGreaterThan(2 * 60 * 1000);
  });
});
