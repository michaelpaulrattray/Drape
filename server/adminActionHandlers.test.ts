/**
 * `executeChangeRequestAction` — the six cases that actually do the work once
 * an admin approves a change request in the panel. (`executeDirectAction` and
 * its five cases were deleted by #800: their only entrances were the Slack
 * approval router — zero client callers — and the Slack message buttons; the
 * admin panel's own procedures in `routes/admin/users.ts` are how an admin
 * acts directly.)
 *
 * ⚠ BOTH HANDLERS HAD ZERO TESTS. 629 lines, eleven cases, every one of them
 * doing real database work — suspensions, credit moves, IP blocks, Stripe
 * refunds — and a repository-wide grep for either symbol across `*.test.ts`
 * returned nothing (3g's D read, 2026-08-25). What stood in their place were
 * arms in `changeRequests.test.ts` that called a mocked db helper themselves
 * and then asserted the mock had been called.
 *
 * THREE THINGS ARE ASSERTED PER CASE, and the third is the one the dispatcher's
 * own hazard names (fable-1629):
 *   1. the right db action is called with the right arguments,
 *   2. its own guards REFUSE, and refuse before anything is written,
 *   3. SETTLEMENT ON COMPLETION — a `cr_*` case must move its change request
 *      out of `pending_execution`, and must NOT settle it when the work failed.
 *      Executing without settling is exactly what the dispatcher's silent
 *      fallthrough would cause one layer up, so it is pinned one layer down.
 *
 * Every `cr_*` case settles its change request on completion — read at the
 * source: `updateChangeRequestStatus` appears 11 times in
 * `changeRequestActions.ts`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const db = {
  getUserById: vi.fn(),
  getUserCredits: vi.fn(),
  suspendUser: vi.fn(),
  unsuspendUser: vi.fn(),
  addCredits: vi.fn(),
  adjustUserCredits: vi.fn(),
  blockIp: vi.fn(),
  unblockIp: vi.fn(),
  updateChangeRequestStatus: vi.fn(),
};

const stripe = {
  issueStripeRefund: vi.fn(),
  calculateProportionalRefund: vi.fn(),
  getSessionChargedAmountCents: vi.fn(),
};

vi.mock("./db", () => db);
vi.mock("./stripe/stripeService", () => stripe);

vi.mock("./auditLog", async (importOriginal) => {
  // AUDIT_ACTIONS passes through: the action NAME an audit row carries is the
  // product's, and a stub here would let it drift past a green suite.
  const actual = await importOriginal<typeof import("./auditLog")>();
  return { ...actual, logAuditEvent: vi.fn().mockResolvedValue(undefined) };
});

vi.mock("./security/adminSecurity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./security/adminSecurity")>();
  return { ...actual, writeImmutableLog: vi.fn().mockResolvedValue(undefined) };
});

const CTX = {
  user: { id: 2, name: "Admin", email: "admin@example.com", role: "admin" },
  req: { headers: { "user-agent": "test" }, socket: {} },
  res: {},
} as never;

const CR_ID = 7;

function pending(action: string, params: Record<string, unknown> = {}, targetId = "42") {
  return {
    action,
    targetId,
    resolvedBy: "Admin",
    params: { changeRequestId: CR_ID, ...params },
  } as never;
}

/** The settlement every cr_ case owes: out of pending_execution, into approved. */
function expectSettled() {
  expect(db.updateChangeRequestStatus).toHaveBeenCalledWith(
    CR_ID,
    expect.objectContaining({ status: "approved" }),
    "pending_execution",
  );
}

const ORDINARY_USER = { id: 42, role: "user", email: "u@example.com", name: "User" };

beforeEach(() => {
  vi.clearAllMocks();
  db.getUserById.mockResolvedValue(ORDINARY_USER);
  db.getUserCredits.mockResolvedValue({ balance: 500 });
  db.suspendUser.mockResolvedValue({ success: true });
  db.unsuspendUser.mockResolvedValue({ success: true });
  db.addCredits.mockResolvedValue({ success: true, newBalance: 600 });
  db.adjustUserCredits.mockResolvedValue({ success: true, newBalance: 400 });
  db.blockIp.mockResolvedValue({ success: true });
  db.unblockIp.mockResolvedValue(true);
  db.updateChangeRequestStatus.mockResolvedValue({ success: true });
  stripe.issueStripeRefund.mockResolvedValue({ success: true, refundId: "re_1" });
  stripe.getSessionChargedAmountCents.mockResolvedValue(1000);
  stripe.calculateProportionalRefund.mockReturnValue({
    refundAmountCents: 500,
    creditsToDeduct: 50,
  });
});

async function runCr(action: string, params?: Record<string, unknown>, targetId?: string) {
  const { executeChangeRequestAction } = await import("./lib/adminActions/changeRequestActions");
  return executeChangeRequestAction(pending(action, params, targetId), CTX);
}

// ── cr_suspendUser ──────────────────────────────────────────────────────────

describe("cr_suspendUser", () => {
  it("suspends the user, with the reason and the acting admin, and SETTLES", async () => {
    await runCr("cr_suspendUser", { reason: "abuse" });
    expect(db.suspendUser).toHaveBeenCalledWith(42, "abuse", 2);
    expectSettled();
  });

  it("REFUSES to suspend an ADMIN account, and suspends nothing", async () => {
    db.getUserById.mockResolvedValue({ ...ORDINARY_USER, role: "admin" });
    await expect(runCr("cr_suspendUser")).rejects.toThrow("Cannot suspend admin accounts");
    expect(db.suspendUser).not.toHaveBeenCalled();
    expect(db.updateChangeRequestStatus).not.toHaveBeenCalled();
  });

  it("refuses a target that does not exist", async () => {
    db.getUserById.mockResolvedValue(null);
    await expect(runCr("cr_suspendUser")).rejects.toThrow("User not found");
    expect(db.suspendUser).not.toHaveBeenCalled();
  });

  it("does NOT settle when the suspension itself failed", async () => {
    db.suspendUser.mockResolvedValue({ success: false, error: "database down" });
    await expect(runCr("cr_suspendUser")).rejects.toThrow("database down");
    expect(db.updateChangeRequestStatus).not.toHaveBeenCalled();
  });
});

// ── cr_unsuspendUser ────────────────────────────────────────────────────────

describe("cr_unsuspendUser", () => {
  const SUSPENDED = { ...ORDINARY_USER, suspendedAt: new Date("2026-08-01") };

  it("unsuspends the user and SETTLES", async () => {
    db.getUserById.mockResolvedValue(SUSPENDED);
    await runCr("cr_unsuspendUser");
    expect(db.unsuspendUser).toHaveBeenCalled();
    expectSettled();
  });

  it("FROM THE DIFF — REFUSES to unsuspend a user who is not suspended", async () => {
    // Found by writing the happy path: the fixture was an ordinary user and
    // the product refused it. The guard is real and nothing had ever named it —
    // it is what stops an approved unsuspend settling a change request against
    // an account that was never suspended in the first place.
    db.getUserById.mockResolvedValue(ORDINARY_USER);
    await expect(runCr("cr_unsuspendUser")).rejects.toThrow("User is not suspended");
    expect(db.unsuspendUser).not.toHaveBeenCalled();
    expect(db.updateChangeRequestStatus).not.toHaveBeenCalled();
  });

  it("does NOT settle when the unsuspend failed", async () => {
    db.getUserById.mockResolvedValue(SUSPENDED);
    db.unsuspendUser.mockResolvedValue({ success: false, error: "nope" });
    await expect(runCr("cr_unsuspendUser")).rejects.toThrow();
    expect(db.updateChangeRequestStatus).not.toHaveBeenCalled();
  });
});

// ── cr_refundCredits / cr_addCredits ────────────────────────────────────────

describe("cr_refundCredits", () => {
  it("adds credits as a REFUND, under a reference derived from the change request, and SETTLES", async () => {
    await runCr("cr_refundCredits", { creditAmount: 50, creditReason: "service disruption" });
    expect(db.addCredits).toHaveBeenCalledWith(
      42,
      50,
      "refund",
      expect.stringContaining("change request #7"),
      `cr-${CR_ID}`,
    );
    expectSettled();
  });

  it("FROM THE DIFF — the reference is what makes a repeated approval idempotent", async () => {
    // `cr-<id>` is the R7-1B unique-index key. If it ever stopped deriving from
    // the change request id, two approvals of one request would pay twice and
    // nothing would notice. This is the arm that dies if that changes.
    await runCr("cr_refundCredits", { creditAmount: 50 });
    expect(db.addCredits.mock.calls[0][4]).toBe(`cr-${CR_ID}`);
  });

  it("refuses a non-positive or non-numeric amount, and moves nothing", async () => {
    for (const creditAmount of [0, -5, "50" as unknown as number, undefined]) {
      vi.clearAllMocks();
      db.getUserById.mockResolvedValue(ORDINARY_USER);
      await expect(runCr("cr_refundCredits", { creditAmount })).rejects.toThrow("Invalid credit amount");
      expect(db.addCredits).not.toHaveBeenCalled();
      expect(db.updateChangeRequestStatus).not.toHaveBeenCalled();
    }
  });

  it("does NOT settle when the credit write failed", async () => {
    db.addCredits.mockResolvedValue({ success: false, error: "ledger unavailable" });
    await expect(runCr("cr_refundCredits", { creditAmount: 50 })).rejects.toThrow("ledger unavailable");
    expect(db.updateChangeRequestStatus).not.toHaveBeenCalled();
  });
});

describe("cr_addCredits", () => {
  it("adds credits as a BONUS — not a refund — and SETTLES", async () => {
    await runCr("cr_addCredits", { creditAmount: 25 });
    expect(db.addCredits).toHaveBeenCalledWith(
      42,
      25,
      "bonus",
      expect.stringContaining("change request #7"),
      `cr-${CR_ID}`,
    );
    expectSettled();
  });

  it("FROM THE DIFF — the credit TYPE separates a refund from a bonus, and they are not the same row", async () => {
    // The two cases are otherwise near-identical; the type is what the ledger,
    // the reconciliation report and the discrepancy scan all key on.
    await runCr("cr_addCredits", { creditAmount: 25 });
    expect(db.addCredits.mock.calls[0][2]).toBe("bonus");
    vi.clearAllMocks();
    db.getUserById.mockResolvedValue(ORDINARY_USER);
    db.addCredits.mockResolvedValue({ success: true, newBalance: 600 });
    await runCr("cr_refundCredits", { creditAmount: 25 });
    expect(db.addCredits.mock.calls[0][2]).toBe("refund");
  });

  it("refuses a non-positive amount", async () => {
    await expect(runCr("cr_addCredits", { creditAmount: 0 })).rejects.toThrow("Invalid credit amount");
    expect(db.addCredits).not.toHaveBeenCalled();
  });
});

// ── cr_blockIP ──────────────────────────────────────────────────────────────

describe("cr_blockIP", () => {
  it("blocks the address and SETTLES", async () => {
    await runCr("cr_blockIP", { reason: "brute force" }, "10.0.0.1");
    expect(db.blockIp).toHaveBeenCalled();
    expect(db.blockIp.mock.calls[0][0]).toBe("10.0.0.1");
    expectSettled();
  });

  it("does NOT settle when the block failed", async () => {
    db.blockIp.mockResolvedValue({ success: false, error: "nope" });
    await expect(runCr("cr_blockIP", {}, "10.0.0.1")).rejects.toThrow();
    expect(db.updateChangeRequestStatus).not.toHaveBeenCalled();
  });
});

// ── cr_stripeRefund ─────────────────────────────────────────────────────────

describe("cr_stripeRefund", () => {
  // No `originalAmountCents` in the params, because there is none in the
  // product (#418): the amount is read from the Stripe charge at execution.
  const PURCHASE = {
    stripeSessionId: "cs_test_1",
    originalCredits: 100,
  };

  it("issues the Stripe refund, deducts the credits it bought, and SETTLES", async () => {
    await runCr("cr_stripeRefund", PURCHASE);
    // The proportional split is computed from the CHARGED amount (the mocked
    // session read, 1000), the purchase's credits, and the live balance.
    expect(stripe.calculateProportionalRefund).toHaveBeenCalledWith(1000, 100, 500);
    expect(stripe.issueStripeRefund).toHaveBeenCalledWith(
      "cs_test_1",
      500,
      expect.stringContaining("#7"),
      /* #771: who and which request ride on the refund's Stripe metadata, so
         a `refund.failed` event days later can find the deduction below. */
      { userId: 42, changeRequestId: CR_ID },
    );
    expect(db.adjustUserCredits).toHaveBeenCalledWith(
      42,
      -50,
      expect.stringContaining("#7"),
      2,
      `cr-stripe-refund:${CR_ID}`,
    );
    expectSettled();
  });

  it("a FULL refund returns the whole amount and deducts no more than the balance holds", async () => {
    db.getUserCredits.mockResolvedValue({ balance: 30 });
    await runCr("cr_stripeRefund", { ...PURCHASE, refundType: "full" });
    expect(stripe.issueStripeRefund.mock.calls[0][1]).toBe(1000);
    // 100 credits bought, only 30 left — a customer is never taken below zero.
    expect(db.adjustUserCredits.mock.calls[0][1]).toBe(-30);
  });

  it("#418 PINNED — a figure smuggled into params cannot set the refund; the charge itself does", async () => {
    // The exact defect: the client used to compute `credits * 0.00072` and
    // send it. If a stale approval, an old bundle or anything else puts an
    // `originalAmountCents` into params, it must be IGNORED.
    await runCr("cr_stripeRefund", { ...PURCHASE, refundType: "full", originalAmountCents: 7 });
    expect(stripe.issueStripeRefund.mock.calls[0][1]).toBe(1000);
  });

  it("PR #704 finding 1 — a proportional refund with nothing to claw back REFUSES; zero must never become 'refund everything'", async () => {
    // A spent-out balance yields refundAmountCents 0. Passing that 0 onward
    // would have it OMITTED at the Stripe layer, and an omitted amount means
    // FULL refund — the customer gets the whole charge back and keeps every
    // credit they spent. The executor must refuse before money moves.
    db.getUserCredits.mockResolvedValue({ balance: 0 });
    stripe.calculateProportionalRefund.mockReturnValue({ refundAmountCents: 0, creditsToDeduct: 0 });
    await expect(runCr("cr_stripeRefund", PURCHASE)).rejects.toThrow("Nothing to refund proportionally");
    expect(stripe.issueStripeRefund).not.toHaveBeenCalled();
    expect(db.adjustUserCredits).not.toHaveBeenCalled();
    expect(db.updateChangeRequestStatus).not.toHaveBeenCalled();
  });

  it("refuses, and moves NOTHING, when the charge cannot be read from Stripe", async () => {
    stripe.getSessionChargedAmountCents.mockResolvedValue(null);
    await expect(runCr("cr_stripeRefund", PURCHASE)).rejects.toThrow(
      "Could not read the original charge",
    );
    expect(stripe.issueStripeRefund).not.toHaveBeenCalled();
    expect(db.adjustUserCredits).not.toHaveBeenCalled();
    expect(db.updateChangeRequestStatus).not.toHaveBeenCalled();
  });

  it("refuses without a Stripe session, and without the original purchase details", async () => {
    await expect(runCr("cr_stripeRefund", { ...PURCHASE, stripeSessionId: "" })).rejects.toThrow(
      "Missing Stripe session ID",
    );
    await expect(runCr("cr_stripeRefund", { ...PURCHASE, originalCredits: 0 })).rejects.toThrow(
      "Missing original purchase details",
    );
    expect(stripe.issueStripeRefund).not.toHaveBeenCalled();
  });

  it("does NOT settle, and deducts nothing, when Stripe refuses the refund", async () => {
    stripe.issueStripeRefund.mockResolvedValue({ success: false, error: "charge already refunded" });
    await expect(runCr("cr_stripeRefund", PURCHASE)).rejects.toThrow("charge already refunded");
    expect(db.adjustUserCredits).not.toHaveBeenCalled();
    expect(db.updateChangeRequestStatus).not.toHaveBeenCalled();
  });

  it("#771 — a refund Stripe CREATED and reported FAILED in the same breath moves NOTHING: no deduction, no approval, no audit row saying issued", async () => {
    /* The shape `issueStripeRefund` now returns for a create-time `failed` /
       `canceled`: success false WITH a refund id and status. Before #771 it
       returned success true and this executor deducted the credits, marked
       the request approved and wrote STRIPE_REFUND_ISSUED — every screen a
       support person could reach agreeing with the wrong answer. */
    stripe.issueStripeRefund.mockResolvedValue({
      success: false,
      refundId: "re_dead",
      status: "failed",
      error: "Stripe reported the refund as failed (expired_or_canceled_card) — no money went back",
    });
    await expect(runCr("cr_stripeRefund", PURCHASE)).rejects.toThrow("no money went back");
    expect(db.adjustUserCredits).not.toHaveBeenCalled();
    expect(db.updateChangeRequestStatus).not.toHaveBeenCalled();
    const { logAuditEvent } = await import("./auditLog");
    expect(logAuditEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "billing.stripe_refund_issued" }),
    );
  });

  it("FROM THE DIFF — a FAILED credit deduction after a SUCCESSFUL Stripe refund does NOT abort, and the request still settles", async () => {
    /*
     * Pinned as the behaviour it IS rather than filed as a defect. The money
     * has already left Stripe by this point, so throwing would leave the
     * change request unsettled and the refund done — worse than continuing.
     * The product logs the refund id for manual recovery and carries on, and
     * the customer keeps credits they were refunded for.
     *
     * That is a real, accepted exposure. This arm exists so that changing it
     * — to a compensating action, a flagged row, anything — is a decision
     * somebody makes, not a behaviour somebody discovers.
     */
    db.adjustUserCredits.mockResolvedValue({ success: false, error: "ledger unavailable" });
    await expect(runCr("cr_stripeRefund", PURCHASE)).resolves.toBeDefined();
    expectSettled();
  });
});
