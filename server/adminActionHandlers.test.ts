/**
 * `executeChangeRequestAction` and `executeDirectAction` — the eleven cases
 * that actually do the work once an admin action is approved.
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
 * Only `cr_*` cases settle. The five direct cases are admin-initiated and carry
 * no change request at all — read at the source: `updateChangeRequestStatus`
 * appears 11 times in `changeRequestActions.ts` and ZERO times in
 * `directActions.ts`, and an arm below asserts that rather than assuming it.
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

vi.mock("./slack/slackNotification", () => ({
  sendAdminActionNotification: vi.fn().mockResolvedValue(true),
  sendAuditLogEntry: vi.fn().mockResolvedValue(true),
  sendSlackAlert: vi.fn().mockResolvedValue(true),
  // The three the handlers and the real adminSecurity actually reach, derived
  // by grepping `SlackAlerts.<method>` across both handler files and
  // adminSecurity.ts rather than guessed at.
  SlackAlerts: {
    adminAction: vi.fn().mockResolvedValue(undefined),
    sensitiveAdminAction: vi.fn().mockResolvedValue(undefined),
    unauthorizedAdminAccess: vi.fn().mockResolvedValue(undefined),
  },
}));

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
    resolvedBy: "slack-admin",
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
  stripe.calculateProportionalRefund.mockReturnValue({
    refundAmountCents: 500,
    creditsToDeduct: 50,
  });
});

async function runCr(action: string, params?: Record<string, unknown>, targetId?: string) {
  const { executeChangeRequestAction } = await import("./lib/adminActions/changeRequestActions");
  return executeChangeRequestAction(pending(action, params, targetId), CTX);
}

async function runDirect(action: string, params?: Record<string, unknown>, targetId?: string) {
  const { executeDirectAction } = await import("./lib/adminActions/directActions");
  return executeDirectAction(pending(action, params, targetId), CTX);
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
  const PURCHASE = {
    stripeSessionId: "cs_test_1",
    originalCredits: 100,
    originalAmountCents: 1000,
  };

  it("issues the Stripe refund, deducts the credits it bought, and SETTLES", async () => {
    await runCr("cr_stripeRefund", PURCHASE);
    expect(stripe.issueStripeRefund).toHaveBeenCalledWith(
      "cs_test_1",
      500,
      expect.stringContaining("#7"),
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

// ── the direct half ─────────────────────────────────────────────────────────

describe("executeDirectAction — admin-initiated, and it settles NOTHING", () => {
  it("suspendUser suspends, and REFUSES an admin target", async () => {
    await runDirect("suspendUser", { reason: "abuse" });
    expect(db.suspendUser).toHaveBeenCalledWith(42, "abuse", 2);

    vi.clearAllMocks();
    db.getUserById.mockResolvedValue({ ...ORDINARY_USER, role: "admin" });
    await expect(runDirect("suspendUser")).rejects.toThrow("Cannot suspend admin accounts");
    expect(db.suspendUser).not.toHaveBeenCalled();
  });

  it("unsuspendUser, blockIP, unblockIP and adjustCredits each reach their own db action", async () => {
    db.getUserById.mockResolvedValue({ ...ORDINARY_USER, suspendedAt: new Date("2026-08-01") });
    await runDirect("unsuspendUser");
    expect(db.unsuspendUser).toHaveBeenCalled();

    vi.clearAllMocks();
    db.blockIp.mockResolvedValue({ success: true });
    await runDirect("blockIP", { reason: "brute force" }, "10.0.0.1");
    expect(db.blockIp.mock.calls[0][0]).toBe("10.0.0.1");

    vi.clearAllMocks();
    db.unblockIp.mockResolvedValue(true);
    await runDirect("unblockIP", {}, "10.0.0.1");
    expect(db.unblockIp).toHaveBeenCalledWith("10.0.0.1");

    vi.clearAllMocks();
    db.getUserById.mockResolvedValue(ORDINARY_USER);
    db.adjustUserCredits.mockResolvedValue({ success: true, newBalance: 400 });
    await runDirect("adjustCredits", { amount: -25, reason: "correction" });
    expect(db.adjustUserCredits).toHaveBeenCalled();
  });

  it("FROM THE DIFF — NO direct case settles a change request, because none of them has one", async () => {
    // Asserted rather than assumed: `updateChangeRequestStatus` appears zero
    // times in `directActions.ts`. If a direct case ever started settling, it
    // would be settling a request that did not authorise it.
    for (const action of ["suspendUser", "unsuspendUser", "blockIP", "unblockIP", "adjustCredits"]) {
      vi.clearAllMocks();
      db.getUserById.mockResolvedValue(ORDINARY_USER);
      db.suspendUser.mockResolvedValue({ success: true });
      db.unsuspendUser.mockResolvedValue({ success: true });
      db.blockIp.mockResolvedValue({ success: true });
      db.unblockIp.mockResolvedValue(true);
      db.adjustUserCredits.mockResolvedValue({ success: true, newBalance: 400 });
      await runDirect(action, { reason: "r", amount: -25 }, "10.0.0.1").catch(() => {});
      expect(db.updateChangeRequestStatus, `${action} must settle nothing`).not.toHaveBeenCalled();
    }
  });
});
