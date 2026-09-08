import { describe, it, expect, vi, beforeEach } from "vitest";
import { moderatorRouter } from "./routes/moderator";
import { changeRequestsRouter } from "./routes/admin/changeRequests";
import { CHANGE_REQUEST_ACTION_BY_TYPE } from "./lib/adminActions";
import { CHANGE_REQUEST_TYPES } from "@shared/changeRequestLabels";

// Mock the slackNotification module
vi.mock("./slack/slackNotification", () => ({
  sendAdminActionNotification: vi.fn().mockResolvedValue(true),
  sendAuditLogEntry: vi.fn().mockResolvedValue(true),
  sendSlackAlert: vi.fn().mockResolvedValue(true),
  // Reached by the REAL `adminSecurity`, which the admin-gate arms drive
  // rather than stub — see the note on that mock below.
  SlackAlerts: {
    unauthorizedAdminAccess: vi.fn().mockResolvedValue(undefined),
    securityAlert: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock the auditLog module
// The Slack approval store, doubled so the post-approval procedure below can
// be driven without a webhook. `requestApproval` is what the review procedure
// calls; `getApprovalStatus` is what the execute procedure reads back.
const slackApprovalStatus = vi.fn();
vi.mock("./slack/slackApproval", () => ({
  requestApproval: vi.fn().mockResolvedValue({ success: true, actionId: "slack-1", sent: true }),
  getApprovalStatus: (...args: unknown[]) => slackApprovalStatus(...args),
  markExecuted: vi.fn(),
  markFailed: vi.fn(),
}));

vi.mock("./lib/adminActions", async (importOriginal) => {
  // The dispatcher itself is driven in `adminActionDispatch.test.ts`; here it
  // is doubled so the procedure's own branches are what is under test.
  const actual = await importOriginal<typeof import("./lib/adminActions")>();
  return { ...actual, executeApprovedAdminAction: vi.fn().mockResolvedValue({ message: "done" }) };
});

vi.mock("./auditLog", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: {
    CHANGE_REQUEST_CREATED: "moderator.change_request_created",
    CHANGE_REQUEST_APPROVED: "admin.change_request_approved",
    CHANGE_REQUEST_DENIED: "admin.change_request_denied",
    CHANGE_REQUEST_CANCELLED: "moderator.change_request_cancelled",
    CREDITS_REFUNDED: "credits.refunded",
    CREDITS_ADDED: "credits.admin_added",
    ACCOUNT_SUSPENDED: "admin.account_suspended",
    ACCOUNT_UNSUSPENDED: "admin.account_unsuspended",
    IP_BLOCKED: "admin.ip_blocked",
  },
}));

// Mock the adminSecurity module.
//
// ⚠ `validateAdminAccess` and `logUnauthorizedAdminAccess` PASS THROUGH to the
// real module on purpose (3g's D). `validateAdminAccess` IS the admin gate the
// refusal arms below drive; stubbing it would make those arms assert this mock,
// which is the exact defect this row exists to remove. Everything else here is
// a genuine side effect (audit writes, Slack) that a unit test must not fire.
vi.mock("./security/adminSecurity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./security/adminSecurity")>();
  return {
    ...actual,
    logAdminAction: vi.fn().mockResolvedValue(undefined),
    isSensitiveAction: vi.fn().mockReturnValue(false),
    writeImmutableLog: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock the db module
vi.mock("./db", () => ({
  createChangeRequest: vi.fn().mockResolvedValue({ success: true, requestId: 1 }),
  // #418: the stripe_refund creation road derives its credits figure from the
  // customer's own ledger row. Default null — an arm that wants the road open
  // queues a row with mockResolvedValueOnce.
  getCreditTransactionByRef: vi.fn().mockResolvedValue(null),
  getChangeRequestById: vi.fn().mockImplementation((id: number) => {
    if (id === 1) {
      return Promise.resolve({
        id: 1,
        type: "refund_credits",
        status: "pending",
        priority: "normal",
        submittedById: 10,
        submittedByName: "Mod User",
        targetUserId: 42,
        targetUserName: "Test User",
        title: "Refund credits for service disruption",
        description: "User experienced a service disruption during generation and lost 50 credits",
        evidenceSummary: "Ticket #12345",
        relatedAuditLogId: null,
        creditAmount: 50,
        creditReason: "Service disruption",
        ipAddress: null,
        reviewedById: null,
        reviewedByName: null,
        reviewedAt: null,
        reviewNotes: null,
        createdAt: new Date("2026-01-15T10:00:00Z"),
        updatedAt: new Date("2026-01-15T10:00:00Z"),
      });
    }
    if (id === 2) {
      return Promise.resolve({
        id: 2,
        type: "flag_account",
        status: "approved",
        priority: "high",
        submittedById: 10,
        submittedByName: "Mod User",
        targetUserId: 99,
        targetUserName: "Suspicious User",
        title: "Flag account for suspicious activity",
        description: "Multiple rate limit violations detected",
        evidenceSummary: null,
        relatedAuditLogId: 501,
        creditAmount: null,
        creditReason: null,
        ipAddress: null,
        reviewedById: 1,
        reviewedByName: "Admin",
        reviewedAt: new Date("2026-01-15T12:00:00Z"),
        reviewNotes: "Confirmed suspicious activity",
        createdAt: new Date("2026-01-15T10:00:00Z"),
        updatedAt: new Date("2026-01-15T12:00:00Z"),
      });
    }
    // Mock for suspend_user auto-execute test
    if (id === 3) {
      return Promise.resolve({
        id: 3, type: "suspend_user", status: "pending", priority: "high",
        submittedById: 10, submittedByName: "Mod User",
        targetUserId: 55, targetUserName: "Bad Actor",
        title: "Suspend user for abuse", description: "Repeated TOS violations",
        evidenceSummary: "Multiple warnings issued", relatedAuditLogId: null,
        creditAmount: null, creditReason: null, ipAddress: null,
        reviewedById: null, reviewedByName: null, reviewedAt: null, reviewNotes: null,
        createdAt: new Date("2026-01-15T10:00:00Z"), updatedAt: new Date("2026-01-15T10:00:00Z"),
      });
    }
    // Mock for unsuspend_user auto-execute test
    if (id === 4) {
      return Promise.resolve({
        id: 4, type: "unsuspend_user", status: "pending", priority: "normal",
        submittedById: 10, submittedByName: "Mod User",
        targetUserId: 55, targetUserName: "Reformed User",
        title: "Unsuspend user after review", description: "User has served suspension period",
        evidenceSummary: null, relatedAuditLogId: null,
        creditAmount: null, creditReason: null, ipAddress: null,
        reviewedById: null, reviewedByName: null, reviewedAt: null, reviewNotes: null,
        createdAt: new Date("2026-01-15T10:00:00Z"), updatedAt: new Date("2026-01-15T10:00:00Z"),
      });
    }
    // Mock for block_ip auto-execute test
    if (id === 5) {
      return Promise.resolve({
        id: 5, type: "block_ip", status: "pending", priority: "urgent",
        submittedById: 10, submittedByName: "Mod User",
        targetUserId: 55, targetUserName: "Attacker",
        title: "Block malicious IP", description: "Brute force attack detected",
        evidenceSummary: "500+ failed login attempts", relatedAuditLogId: null,
        creditAmount: null, creditReason: null, ipAddress: "192.168.1.100",
        reviewedById: null, reviewedByName: null, reviewedAt: null, reviewNotes: null,
        createdAt: new Date("2026-01-15T10:00:00Z"), updatedAt: new Date("2026-01-15T10:00:00Z"),
      });
    }
    // Mock for add_credits auto-execute test
    if (id === 6) {
      return Promise.resolve({
        id: 6, type: "add_credits", status: "pending", priority: "normal",
        submittedById: 10, submittedByName: "Mod User",
        targetUserId: 42, targetUserName: "Loyal User",
        title: "Bonus credits for loyalty", description: "User has been active for 12 months",
        evidenceSummary: null, relatedAuditLogId: null,
        creditAmount: 100, creditReason: "Loyalty bonus", ipAddress: null,
        reviewedById: null, reviewedByName: null, reviewedAt: null, reviewNotes: null,
        createdAt: new Date("2026-01-15T10:00:00Z"), updatedAt: new Date("2026-01-15T10:00:00Z"),
      });
    }
    // Mock for the stripe_refund review test (#418)
    if (id === 8) {
      return Promise.resolve({
        id: 8, type: "stripe_refund", status: "pending", priority: "high",
        submittedById: 10, submittedByName: "Mod User",
        targetUserId: 42, targetUserName: "Refund User",
        title: "Refund top-up charge", description: "Customer asked for their top-up back",
        evidenceSummary: null, relatedAuditLogId: null,
        creditAmount: null, creditReason: null, ipAddress: null,
        stripeSessionId: "cs_live_418", refundType: "proportional",
        originalCredits: 5000, refundAmountCents: null, creditsToDeduct: null,
        reviewedById: null, reviewedByName: null, reviewedAt: null, reviewNotes: null,
        createdAt: new Date("2026-01-15T10:00:00Z"), updatedAt: new Date("2026-01-15T10:00:00Z"),
      });
    }
    // Mock for note_incident (no auto-execute)
    if (id === 7) {
      return Promise.resolve({
        id: 7, type: "note_incident", status: "pending", priority: "low",
        submittedById: 10, submittedByName: "Mod User",
        targetUserId: 42, targetUserName: "Test User",
        title: "Note: unusual activity", description: "User reported unusual behavior",
        evidenceSummary: null, relatedAuditLogId: null,
        creditAmount: null, creditReason: null, ipAddress: null,
        reviewedById: null, reviewedByName: null, reviewedAt: null, reviewNotes: null,
        createdAt: new Date("2026-01-15T10:00:00Z"), updatedAt: new Date("2026-01-15T10:00:00Z"),
      });
    }
    return Promise.resolve(null);
  }),
  listChangeRequests: vi.fn().mockResolvedValue({
    requests: [
      {
        id: 1,
        type: "refund_credits",
        status: "pending",
        priority: "normal",
        submittedById: 10,
        submittedByName: "Mod User",
        targetUserId: 42,
        targetUserName: "Test User",
        title: "Refund credits for service disruption",
        description: "User lost credits during outage",
        creditAmount: 50,
        createdAt: new Date("2026-01-15T10:00:00Z"),
        updatedAt: new Date("2026-01-15T10:00:00Z"),
      },
    ],
    total: 1,
    summary: {
      pendingCount: 1,
      approvedCount: 0,
      deniedCount: 0,
      totalCount: 1,
    },
  }),
  updateChangeRequestStatus: vi.fn().mockResolvedValue({ success: true }),
  addCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 150 }),
  suspendUser: vi.fn().mockResolvedValue({ success: true }),
  unsuspendUser: vi.fn().mockResolvedValue({ success: true }),
  blockIp: vi.fn().mockResolvedValue({ success: true, id: 1 }),
  getChangeRequestsByModerator: vi.fn().mockResolvedValue({
    requests: [
      {
        id: 1,
        type: "refund_credits",
        status: "pending",
        priority: "normal",
        submittedById: 10,
        submittedByName: "Mod User",
        targetUserId: 42,
        targetUserName: "Test User",
        title: "Refund credits",
        description: "Service disruption refund",
        creditAmount: 50,
        createdAt: new Date("2026-01-15T10:00:00Z"),
        updatedAt: new Date("2026-01-15T10:00:00Z"),
      },
    ],
    total: 1,
    summary: {
      pendingCount: 1,
      approvedCount: 0,
      deniedCount: 0,
      totalCount: 1,
    },
  }),
}));

// The Stripe read the creation road performs since #418: the charged amount
// comes from the session itself, never from input. Default answers 6000 so
// the happy arms need no key; a refusal arm queues null with ...Once.
const stripeService = {
  getSessionChargedAmountCents: vi.fn().mockResolvedValue(6000),
};
vi.mock("./stripe/stripeService", () => stripeService);

// ============================================================
// THE PRODUCT'S OWN VOCABULARIES, READ OFF THE RUNNING ROUTERS
// ============================================================
/*
 * Every list in this file used to be typed out by hand, and three of them had
 * drifted from the product without a single arm going red (#679, #681). These
 * readers exist so no arm below has to state a vocabulary the routers already
 * declare. Each REFUSES rather than returning an empty list -- a reader that
 * reads nothing agrees with everything.
 */
type RouterWithProcedures = {
  _def: { procedures: Record<string, { _def: { inputs: unknown[] } }> };
};

/**
 * zod 4 keeps a wrapped schema's real one under `_def.innerType`, so an
 * `.optional()` object -- which `listChangeRequests` declares, because it takes
 * no argument at all from `BillingTab`-style callers -- has no `.shape` of its
 * own. Unwrap, then read.
 */
function unwrapSchema<T extends { _def?: { innerType?: unknown } }>(schema: T | undefined): T | undefined {
  let node = schema;
  for (let hop = 0; node && hop < 5; hop++) {
    const inner = node._def?.innerType as T | undefined;
    if (!inner) return node;
    node = inner;
  }
  return node;
}

function inputShapeOf(router: unknown, procedure: string): Record<string, unknown> {
  const procedures = (router as unknown as RouterWithProcedures)._def.procedures;
  const proc = procedures[procedure];
  if (!proc) throw new Error(`no procedure "${procedure}" on this router`);
  const declared = proc._def.inputs[0] as { shape?: Record<string, unknown>; _def?: { innerType?: unknown } } | undefined;
  const schema = unwrapSchema(declared);
  if (!schema?.shape) throw new Error(`procedure "${procedure}" declares no object input schema`);
  return schema.shape;
}

/*
 * zod 4 wraps an enum in ZodDefault/ZodOptional, so `.options` is one or two
 * hops in. Measured on zod 4.1.12 rather than assumed: `.default()` is one hop,
 * `.optional().default()` is two.
 */
function enumOptionsOf(router: unknown, procedure: string, field: string): string[] {
  const declared = inputShapeOf(router, procedure)[field] as
    | { options?: string[]; _def?: { innerType?: unknown } }
    | undefined;
  const options = unwrapSchema(declared)?.options;
  if (!options?.length) {
    throw new Error(`"${field}" on "${procedure}" is not an enum this reader can read`);
  }
  return [...options];
}

// ============================================================
// Change Request Types & Validation
// ============================================================
describe("Change Request - Types & Validation (DRIVEN and DERIVED)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function modCaller() {
    return moderatorRouter.createCaller({
      user: { id: 10, role: "moderator", name: "Mod User", suspendedAt: null },
    } as never);
  }

  /** An input that passes every rule, so an arm can change exactly one thing. */
  function validCreateInput(overrides: Record<string, unknown> = {}) {
    return {
      type: "note_incident",
      priority: "normal",
      targetUserId: 42,
      title: "Incident note",
      description: "Something happened that needs to be recorded",
      ...overrides,
    };
  }

  /**
   * This arm used to hand-type EIGHT types and then assert its own list was
   * eight long (#679). The product accepts nine; `stripe_refund` was never
   * added here. It was green throughout, because nothing in it referred to the
   * product at all -- and a later shift, finding the same drift, added a
   * corrective arm further down this file rather than removing the wrong one,
   * so the suite stated both numbers at once.
   */
  it("names every type the product accepts, derived from the shared declaration", () => {
    expect(CHANGE_REQUEST_TYPES).toContain("stripe_refund");
    expect(CHANGE_REQUEST_TYPES).toHaveLength(9);
    for (const type of CHANGE_REQUEST_TYPES) {
      expect(typeof type).toBe("string");
      expect(type.length).toBeGreaterThan(0);
    }
  });

  /*
   * THIS ARM DECLARED SIX STATUS STRINGS AND ASSERTED ITS OWN ARRAY WAS SIX
   * LONG. The vocabulary it was describing is declared on the admin list
   * procedure's own input, one hop away, and nothing compared the two.
   */
  it("the status vocabulary is the product's own -- and `all` is a FILTER word, not a status", () => {
    const declared = enumOptionsOf(changeRequestsRouter, "listChangeRequests", "status");
    expect(declared).toContain("all");
    const statuses = declared.filter((s) => s !== "all");
    expect([...statuses].sort()).toEqual([
      "approved", "cancelled", "denied", "expired", "pending", "pending_execution",
    ]);
  });

  it("the priority levels are the create procedure's own enum, not a copy of it", () => {
    expect([...enumOptionsOf(moderatorRouter, "createChangeRequest", "priority")].sort()).toEqual([
      "high", "low", "normal", "urgent",
    ]);
  });

  /*
   * FOUR ARMS STOOD FOR THE LENGTH RULES and not one of them touched the
   * product: each declared a string and asserted `String.length` against a
   * number typed on the line above ("Hi".length < 5). They would have been
   * green with `.min(5)` deleted from the router. The bounds are DRIVEN now,
   * and each arm carries the positive control that proves it is not simply
   * refusing everything.
   */
  it("the title bounds are the product's -- too short and too long are both REFUSED", async () => {
    await expect(
      modCaller().createChangeRequest(validCreateInput({ title: "Hi" }) as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      modCaller().createChangeRequest(validCreateInput({ title: "x".repeat(513) }) as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    // POSITIVE CONTROL -- the boundary values themselves are ACCEPTED, so the
    // two refusals above are the bounds and not a broken fixture.
    await expect(
      modCaller().createChangeRequest(validCreateInput({ title: "Fiver" }) as never),
    ).resolves.toBeDefined();
    await expect(
      modCaller().createChangeRequest(validCreateInput({ title: "x".repeat(512) }) as never),
    ).resolves.toBeDefined();
  });

  it("the description bounds are the product's -- too short and too long are both REFUSED", async () => {
    await expect(
      modCaller().createChangeRequest(validCreateInput({ description: "Bad user" }) as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      modCaller().createChangeRequest(validCreateInput({ description: "x".repeat(5001) }) as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    // POSITIVE CONTROL, at both boundaries.
    await expect(
      modCaller().createChangeRequest(validCreateInput({ description: "x".repeat(10) }) as never),
    ).resolves.toBeDefined();
    await expect(
      modCaller().createChangeRequest(validCreateInput({ description: "x".repeat(5000) }) as never),
    ).resolves.toBeDefined();
  });

  /*
   * THESE TWO ASSERTED THAT AN OBJECT LITERAL HELD THE KEYS TYPED INTO IT two
   * lines above (`expect(refundRequest.creditAmount).toBeGreaterThan(0)`). The
   * rule they were named for is a real refusal in the procedure body, and it is
   * driven here -- including the message, because there are four such refusals
   * in that procedure and a bare BAD_REQUEST does not say which one fired.
   */
  it("a credit request with no amount is REFUSED by the product, and says which rule", async () => {
    for (const type of ["refund_credits", "add_credits"]) {
      await expect(
        modCaller().createChangeRequest(validCreateInput({ type }) as never),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringContaining("Credit amount is required"),
      });
    }
    // POSITIVE CONTROL -- with the amount, the same input is accepted.
    await expect(
      modCaller().createChangeRequest(
        validCreateInput({ type: "refund_credits", creditAmount: 50 }) as never,
      ),
    ).resolves.toBeDefined();
  });

  /*
   * #418 — a stripe_refund's money facts are DERIVED, never typed. The client
   * used to send `originalAmountCents` computed by a bare magic float
   * (`credits * 0.00072` — a 10,000-credit top-up became a 7-cent refund);
   * now the customer's own ledger row names the credits, the Stripe charge
   * names the amount, and an input that still carries the old fields cannot
   * influence what is stored.
   */
  it("#418 — a stripe_refund is REFUSED when no purchase matches the session, or Stripe cannot name the charge", async () => {
    // No ledger row for that (user, session) → refused at submit. This is
    // also what pins the session to the TARGET user: the lookup is keyed on
    // both, so someone else's session id refuses identically.
    await expect(
      modCaller().createChangeRequest(
        validCreateInput({ type: "stripe_refund", stripeSessionId: "cs_x", refundType: "full" }) as never,
      ),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("No credit purchase matches"),
    });

    // Ledger row present but Stripe cannot say what was charged → refused.
    const { getCreditTransactionByRef } = await import("./db");
    vi.mocked(getCreditTransactionByRef).mockResolvedValueOnce({ amount: 5000 } as never);
    stripeService.getSessionChargedAmountCents.mockResolvedValueOnce(null);
    await expect(
      modCaller().createChangeRequest(
        validCreateInput({ type: "stripe_refund", stripeSessionId: "cs_x", refundType: "full" }) as never,
      ),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Could not read the original charge"),
    });
  });

  it("#418 — the stored request carries the DERIVED figures, and a smuggled amount changes nothing", async () => {
    const { getCreditTransactionByRef, createChangeRequest } = await import("./db");

    // FULL refund: the preview stored for admin review is the ledger's
    // credits and the session's charged amount — not the 7 cents the old
    // client field would have put there.
    vi.mocked(getCreditTransactionByRef).mockResolvedValueOnce({ amount: 5000 } as never);
    vi.mocked(createChangeRequest).mockClear();
    await modCaller().createChangeRequest(
      validCreateInput({
        type: "stripe_refund", stripeSessionId: "cs_x", refundType: "full",
        originalAmountCents: 7, originalCredits: 1,
      }) as never,
    );
    expect(vi.mocked(getCreditTransactionByRef)).toHaveBeenCalledWith(42, "cs_x");
    expect(vi.mocked(createChangeRequest).mock.calls[0][0]).toMatchObject({
      originalCredits: 5000,
      refundAmountCents: 6000,
      creditsToDeduct: 5000,
    });

    // PROPORTIONAL: the credits are stored, the amount deliberately is not —
    // it depends on the balance at execution and is read from Stripe then.
    // (The full arm above is the positive control for this absence.)
    vi.mocked(getCreditTransactionByRef).mockResolvedValueOnce({ amount: 5000 } as never);
    vi.mocked(createChangeRequest).mockClear();
    await modCaller().createChangeRequest(
      validCreateInput({ type: "stripe_refund", stripeSessionId: "cs_x", refundType: "proportional" }) as never,
    );
    const stored = vi.mocked(createChangeRequest).mock.calls[0][0] as Record<string, unknown>;
    expect(stored).toMatchObject({ originalCredits: 5000 });
    expect(stored).not.toHaveProperty("refundAmountCents");
  });

  it("a block_ip request with no address is REFUSED by the product, and says which rule", async () => {
    await expect(
      modCaller().createChangeRequest(validCreateInput({ type: "block_ip" }) as never),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("IP address is required"),
    });
    // POSITIVE CONTROL.
    await expect(
      modCaller().createChangeRequest(
        validCreateInput({ type: "block_ip", ipAddress: "192.168.1.100" }) as never,
      ),
    ).resolves.toBeDefined();
  });

  /*
   * "should allow optional fields" IS DELETED, category (2) -- worthless. It
   * built an object with five keys and asserted it did not have the four it had
   * never been given. There is no reading of it that can fail, and nothing in
   * the product it could be pointed at: `evidenceSummary`, `relatedAuditLogId`,
   * `creditAmount` and `ipAddress` are `.optional()` on the schema, which every
   * driven arm above already exercises by omitting them.
   */
});

// ============================================================
// Change Request CRUD Helpers -- THE WHOLE DESCRIBE IS DELETED (#681)
// ============================================================
/*
 * SIXTEEN ARMS STOOD HERE AND NONE OF THEM REACHED THE PRODUCT. `./db` is
 * replaced wholesale by `vi.mock` at the top of this file, so every one of them
 * imported a `vi.fn()`, called it, and asserted either what the fixture had
 * been configured to return or that the mock had been called with what the arm
 * had just passed it:
 *
 *     const { getChangeRequestById } = await import("./db");
 *     const request = await getChangeRequestById(1);
 *     expect(request!.creditAmount).toBe(50);        // the fixture, 60 lines up
 *
 *     await listChangeRequests({ status: "pending" });
 *     expect(listChangeRequests).toHaveBeenCalledWith(
 *       expect.objectContaining({ status: "pending" }),   // its own argument
 *     );
 *
 * They were green on the day they were written, green when the helpers they
 * name changed, and green if `createChangeRequest` were deleted from `server/db`
 * entirely -- a whole describe of sixteen that cannot fail, under a heading
 * claiming to cover the CRUD layer. The real db helpers need a database and are
 * out of a unit suite's reach; what a unit suite CAN reach is the procedures
 * that call them, and those are driven for real below (`createChangeRequest`,
 * `getMyChangeRequests`, `listChangeRequests`, `getChangeRequest`,
 * `reviewChangeRequest`, `executeChangeRequestAfterSlack`), each asserting the
 * db call as a CONSEQUENCE of the procedure rather than of the test.
 *
 * Deleting them removes no coverage, which is the whole finding: the file
 * reported sixteen arms' worth of it and held none.
 */

// ============================================================
// Moderator Change Request Procedures
// ============================================================
describe("Change Request - Moderator Procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createChangeRequest mutation", () => {
    /*
     * ⚠ THIS ARM CALLED THE MOCKED `createChangeRequest`, `logAuditEvent` AND
     * `sendAdminActionNotification` ITSELF and then asserted each had been
     * called with what it had just passed. It never touched the procedure.
     *
     * The real one is driven below: a live moderator creates a request, and
     * the db write, the audit row and the Slack notification are asserted as
     * consequences of the CALL rather than of the test. Filed under 3g's D.
     */
    it("a moderator creates a change request — the db write, the audit row and the Slack note all follow", async () => {
      const { createChangeRequest } = await import("./db");
      const { logAuditEvent } = await import("./auditLog");
      const { sendAdminActionNotification } = await import("./slack/slackNotification");

      await moderatorRouter
        .createCaller({ user: { id: 10, role: "moderator", name: "Mod User", suspendedAt: null } } as never)
        .createChangeRequest({
          type: "refund_credits",
          priority: "normal",
          targetUserId: 42,
          targetUserName: "Test User",
          title: "Refund credits for service disruption",
          description: "User experienced a service disruption during generation and lost 50 credits",
          creditAmount: 50,
          creditReason: "Service disruption",
        } as never);

      // The SUBMITTER comes from ctx, never from input — invariant 3.
      expect(createChangeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "refund_credits",
          targetUserId: 42,
          submittedById: 10,
        }),
      );
      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ resourceType: "change_request" }),
      );
      expect(sendAdminActionNotification).toHaveBeenCalled();
    });

    it("FROM THE DIFF — the submitter cannot be forged through the input", async () => {
      // The old arm passed `submittedById: 10` in by hand, so it could not
      // have noticed the procedure reading it from anywhere.
      const { createChangeRequest } = await import("./db");
      vi.mocked(createChangeRequest).mockClear();
      await moderatorRouter
        .createCaller({ user: { id: 10, role: "moderator", name: "Mod User", suspendedAt: null } } as never)
        .createChangeRequest({
          type: "note_incident",
          priority: "normal",
          targetUserId: 42,
          title: "An incident worth noting",
          description: "A description long enough to pass the minimum length rule.",
          submittedById: 999,
        } as never);
      expect(vi.mocked(createChangeRequest).mock.calls[0][0]).toEqual(
        expect.objectContaining({ submittedById: 10 }),
      );
    });

    /**
     * ## This arm used to declare its own map and then assert about it (#679)
     *
     * It held eight pairs in Title Case, checked three of them against the
     * literals two lines above, and asserted the length was 8. Every one of
     * those statements was true of the arm's own declaration and NONE of them
     * touched the product: the route's map had NINE entries, and this one was
     * missing `stripe_refund`. It was green while the thing it named had
     * drifted -- a scripted reader agreeing with itself.
     *
     * It reads the real declaration now, so it can fail.
     */
    it("names every request type from the one shared declaration", async () => {
      const { CHANGE_REQUEST_TYPE_LABELS, changeRequestTypeLabel } = await import(
        "@shared/changeRequestLabels"
      );

      // The population the route can actually be handed: the create
      // procedure's own enum, derived rather than re-typed here.
      const declared = Object.keys(CHANGE_REQUEST_TYPE_LABELS);
      expect(declared).toContain("stripe_refund");
      expect(declared).toHaveLength(9);

      // Every type has a label that is not just its key echoed back.
      for (const type of declared) {
        expect(changeRequestTypeLabel(type)).not.toBe(type);
        expect(changeRequestTypeLabel(type).length).toBeGreaterThan(0);
      }

      // House voice: sentence case, with `IP` kept as an initialism.
      expect(changeRequestTypeLabel("refund_credits")).toBe("Refund credits");
      expect(changeRequestTypeLabel("block_ip")).toBe("Block IP");

      // POSITIVE CONTROL for the fallback: an unknown key comes back as
      // itself, which is what every call site relied on before this map
      // existed -- and is the behaviour that made the drift show as a raw
      // `stripe_refund` on the moderator's own list.
      expect(changeRequestTypeLabel("no_such_type")).toBe("no_such_type");
    });

    /*
     * TWO ARMS STOOD HERE THAT BUILT THE SLACK PAYLOAD THEMSELVES -- declaring
     * a `fields` array, pushing to it under the same `if` the product uses, and
     * then asserting their own array held what they had just pushed. They were
     * a transcription of the procedure written as a test of it.
     *
     * Driving the real one immediately caught something the transcription could
     * not: the credit arm asserted a "Credit Reason" field, and the product has
     * never sent one. `moderator.ts` pushes "Credit Amount", "IP Address" and
     * "Evidence" and nothing else -- so the suite's only description of the
     * admin's Slack card named a field that does not exist. That is the THIRD
     * wrong statement about the product found in this file, after the eight-vs-
     * nine type count and the five-vs-six sensitive list (#679).
     */
    async function slackFieldsFromCreate(input: Record<string, unknown>) {
      const { sendAdminActionNotification } = await import("./slack/slackNotification");
      vi.mocked(sendAdminActionNotification).mockClear();
      await moderatorRouter
        .createCaller({ user: { id: 10, role: "moderator", name: "Mod User", suspendedAt: null } } as never)
        .createChangeRequest(input as never);
      const call = vi.mocked(sendAdminActionNotification).mock.calls[0]?.[0] as
        | { fields?: Array<{ title: string; value: string }> }
        | undefined;
      if (!call?.fields?.length) throw new Error("the create procedure sent no Slack fields to read");
      return call.fields;
    }

    it("a credit request's Slack card carries the AMOUNT -- and no Credit Reason field, which the old arm invented", async () => {
      const fields = await slackFieldsFromCreate({
        type: "refund_credits",
        priority: "normal",
        targetUserId: 42,
        title: "Refund credits for service disruption",
        description: "User experienced a service disruption during generation and lost 50 credits",
        creditAmount: 50,
        creditReason: "Service disruption",
      });
      expect(fields.find((f) => f.title === "Credit Amount")?.value).toBe("50 credits");
      expect(fields.map((f) => f.title)).not.toContain("Credit Reason");

      // POSITIVE CONTROL for the absence above -- a field the card DOES carry,
      // so "not.toContain" is not passing on an empty read (`absence-only
      // expect passes on nothing`).
      expect(fields.map((f) => f.title)).toContain("Title");
    });

    it("a block_ip request's Slack card carries the ADDRESS, and a non-IP request does not", async () => {
      const withIp = await slackFieldsFromCreate({
        type: "block_ip",
        priority: "urgent",
        targetUserId: 0,
        title: "Block suspicious IP address",
        description: "IP address has been making brute force login attempts",
        ipAddress: "192.168.1.100",
      });
      expect(withIp.find((f) => f.title === "IP Address")?.value).toBe("192.168.1.100");

      // NEGATIVE CONTROL -- the field is conditional, so a request without an
      // address must not carry it. Without this the arm passes on a card that
      // always holds every field.
      const withoutIp = await slackFieldsFromCreate({
        type: "note_incident",
        priority: "normal",
        targetUserId: 42,
        title: "Incident note",
        description: "Something happened that needs to be recorded",
      });
      expect(withoutIp.map((f) => f.title)).not.toContain("IP Address");
    });
  });

  describe("getMyChangeRequests query", () => {
    /*
     * BOTH ARMS HERE CALLED THE MOCKED db HELPER THEMSELVES and asserted it had
     * been called with the argument they had just passed it. The procedure was
     * never invoked, so the fact that actually matters -- that the moderator id
     * comes from `ctx.user.id` and NOT from input (invariant 3) -- was the one
     * thing they could not see.
     */
    /*
     * SABOTAGE NOTE, and it is the reason this arm has two halves. The first
     * shape of it drove the procedure with a forged `submittedById: 999` and
     * asserted the session id reached the helper -- which reads like invariant
     * 3 and PROVES NOTHING: the input schema does not declare that field, so
     * zod strips it before the handler runs, and the arm stayed green with the
     * handler sabotaged to read `input.submittedById ?? ctx.user.id`. It was a
     * guard over a defect its own fixture could not express.
     *
     * The two halves below are each sabotage-proven: changing what the handler
     * passes reddens the first, and DECLARING a caller-identity field on the
     * schema -- which is what would make the forgery reachable in the first
     * place -- reddens the second.
     */
    it("the moderator id handed to the db helper is the SESSION's", async () => {
      const { getChangeRequestsByModerator } = await import("./db");
      vi.mocked(getChangeRequestsByModerator).mockClear();

      await moderatorRouter
        .createCaller({ user: { id: 10, role: "moderator", suspendedAt: null } } as never)
        .getMyChangeRequests({} as never);

      expect(vi.mocked(getChangeRequestsByModerator).mock.calls[0][0]).toBe(10);
    });

    it("and the input declares no caller identity for it to be read from (invariant 3)", () => {
      const declared = Object.keys(inputShapeOf(moderatorRouter, "getMyChangeRequests"));
      // Population control -- an empty read would agree with everything.
      expect(declared).toContain("status");
      for (const field of declared) {
        expect(field).not.toMatch(/^(submittedBy|userId|moderatorId|submittedById)/i);
      }
    });

    it("a status filter reaches the db helper, and `all` is translated to no filter", async () => {
      const { getChangeRequestsByModerator } = await import("./db");
      const caller = moderatorRouter.createCaller({
        user: { id: 10, role: "moderator", suspendedAt: null },
      } as never);

      vi.mocked(getChangeRequestsByModerator).mockClear();
      await caller.getMyChangeRequests({ status: "approved" } as never);
      expect(getChangeRequestsByModerator).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ status: "approved" }),
      );

      // `all` is a filter word rather than a status, and the procedure turns it
      // into `undefined` -- the arm that used to stand here could not have
      // noticed either way, because it never ran the procedure.
      vi.mocked(getChangeRequestsByModerator).mockClear();
      await caller.getMyChangeRequests({ status: "all" } as never);
      expect(getChangeRequestsByModerator).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ status: undefined }),
      );
    });
  });
});

// ============================================================
// Admin Change Request Review Procedures
// ============================================================
describe("Change Request - Admin Review Procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function adminCallerHere() {
    return changeRequestsRouter.createCaller({
      user: { id: 1, role: "admin", email: "admin@example.com", name: "Admin", openId: null, suspendedAt: null },
      req: { headers: {}, socket: {} },
    } as never);
  }

  describe("listChangeRequests (admin)", () => {
    /*
     * BOTH ARMS HERE IMPORTED THE MOCKED db HELPER AND CALLED IT THEMSELVES.
     * The admin procedure was never invoked, so neither arm could have noticed
     * the `all` translation below, and neither would have gone red if the
     * procedure stopped passing the filter through at all.
     */
    it("the admin list returns the db's summary, and passes a status filter through", async () => {
      const { listChangeRequests } = await import("./db");
      vi.mocked(listChangeRequests).mockClear();

      const result = await adminCallerHere().listChangeRequests({ status: "pending" } as never);
      expect(result.summary).toBeDefined();
      expect(listChangeRequests).toHaveBeenCalledWith(
        expect.objectContaining({ status: "pending" }),
      );
    });

    it("`all` is a filter word, not a status -- the procedure sends no status at all", async () => {
      const { listChangeRequests } = await import("./db");
      vi.mocked(listChangeRequests).mockClear();

      await adminCallerHere().listChangeRequests({ status: "all" } as never);
      expect(listChangeRequests).toHaveBeenCalledWith(
        expect.objectContaining({ status: undefined }),
      );
    });
  });

  describe("getChangeRequest (admin)", () => {
    /*
     * THE SECOND ARM HERE WAS NAMED "should throw for non-existent request" AND
     * ASSERTED `expect(request).toBeNull()` on the MOCK -- the title claimed a
     * throw the arm never asked for, and the procedure does throw. A title is
     * not an assertion.
     */
    it("an existing request comes back whole", async () => {
      const request = await adminCallerHere().getChangeRequest({ id: 1 } as never);
      expect(request).toMatchObject({ id: 1, type: "refund_credits" });
    });

    it("a request that does not exist is NOT_FOUND -- the throw the old arm only claimed", async () => {
      await expect(
        adminCallerHere().getChangeRequest({ id: 999 } as never),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("reviewChangeRequest mutation", () => {
    /*
     * ⚠ THREE ARMS STOOD HERE and none of them reached the procedure. Two
     * called the mocked `updateChangeRequestStatus` and `logAuditEvent`
     * themselves and asserted their own calls; the third fetched a fixture,
     * asserted its status was "approved", and left a COMMENT saying "the
     * procedure would throw TRPCError with code CONFLICT" — a comment where
     * an assertion should have been, and the code it names is not even the
     * one the product throws.
     *
     * All three are driven now. Filed under 3g's D.
     */
    function adminCaller() {
      return changeRequestsRouter.createCaller({
        user: { id: 1, role: "admin", email: "admin@example.com", name: "Admin", openId: null, suspendedAt: null },
        req: { headers: {}, socket: {} },
      } as never);
    }

    it("approving a SENSITIVE request sets pending_execution rather than approving outright", async () => {
      const { updateChangeRequestStatus } = await import("./db");
      // Fixture 1 is `refund_credits` — sensitive, so it must go to Slack for
      // confirmation before anything is executed.
      await adminCaller().reviewChangeRequest({
        id: 1,
        action: "approved",
        reviewNotes: "Approved - credits will be refunded",
      } as never);
      expect(updateChangeRequestStatus).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ status: "pending_execution", reviewedById: 1 }),
      );
    });

    it("#418 — approving a stripe_refund hands the executor the session, type and credits, and NO amount", async () => {
      /*
       * Until #418 these params carried only `changeRequestId` and `reason`,
       * so every approved Stripe refund died at execution on "Missing Stripe
       * session ID" — the road was wired to refuse itself. Asserted at the
       * wire (invariant 5): on what is handed to the approval store, not on a
       * constant near it. The AMOUNT is asserted absent on purpose — the
       * executor reads it from the charge at the moment money moves.
       */
      const { requestApproval } = await import("./slack/slackApproval");
      vi.mocked(requestApproval).mockClear();
      await adminCaller().reviewChangeRequest({ id: 8, action: "approved" } as never);
      expect(requestApproval).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "cr_stripeRefund",
          params: expect.objectContaining({
            stripeSessionId: "cs_live_418",
            refundType: "proportional",
            originalCredits: 5000,
          }),
        }),
      );
      const sent = vi.mocked(requestApproval).mock.calls[0][0] as unknown as { params: Record<string, unknown> };
      expect(sent.params).not.toHaveProperty("originalAmountCents");
    });

    it("denying a request marks it denied, and executes nothing", async () => {
      const { updateChangeRequestStatus } = await import("./db");
      await adminCaller().reviewChangeRequest({
        id: 1,
        action: "denied",
        reviewNotes: "Insufficient evidence to justify refund",
      } as never);
      expect(updateChangeRequestStatus).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ status: "denied", reviewedById: 1 }),
      );
    });

    it("FROM THE DIFF — an ALREADY-REVIEWED request is refused, and the old arm only left a comment about it", async () => {
      // Fixture 2 is already approved. The comment that stood here said the
      // procedure "would throw TRPCError with code CONFLICT"; it throws
      // BAD_REQUEST. An assertion cannot be wrong about that the way a comment
      // was for as long as nobody ran it.
      await expect(
        adminCaller().reviewChangeRequest({ id: 2, action: "approved" } as never),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("FROM THE DIFF — a request that does not exist is NOT_FOUND", async () => {
      await expect(
        adminCaller().reviewChangeRequest({ id: 999, action: "approved" } as never),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    /*
     * THREE ARMS STOOD HERE AND EACH ONE CALLED THE MOCK ITSELF: two invoked
     * `sendAdminActionNotification` with a payload they had typed and then
     * asserted it had been called with it, and the third did the same with
     * `writeImmutableLog`. None of them ran `reviewChangeRequest`. The
     * procedure genuinely sends both, so all three are driven now.
     */
    it("an approval and a denial each announce themselves, in the product's own words", async () => {
      const { sendAdminActionNotification } = await import("./slack/slackNotification");

      vi.mocked(sendAdminActionNotification).mockClear();
      await adminCaller().reviewChangeRequest({
        id: 1, action: "approved", reviewNotes: "Approved - credits will be refunded",
      } as never);
      expect(sendAdminActionNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringContaining("Approved") }),
      );

      vi.mocked(sendAdminActionNotification).mockClear();
      await adminCaller().reviewChangeRequest({
        id: 1, action: "denied", reviewNotes: "Insufficient evidence",
      } as never);
      expect(sendAdminActionNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringContaining("Denied") }),
      );
    });

    it("a review writes the immutable audit record, as a consequence of the procedure", async () => {
      const { writeImmutableLog } = await import("./security/adminSecurity");
      vi.mocked(writeImmutableLog).mockClear();

      await adminCaller().reviewChangeRequest({
        id: 1, action: "approved", reviewNotes: "Approved - credits will be refunded",
      } as never);

      expect(writeImmutableLog).toHaveBeenCalled();
      const [action, detail] = vi.mocked(writeImmutableLog).mock.calls[0] as [string, Record<string, unknown>];
      expect(action).toEqual(expect.stringContaining("change_request"));
      expect(detail).toMatchObject({ requestId: 1 });
    });
  });
});

// ============================================================
// Change Request - Security Boundaries
// ============================================================
/*
 * ⚠ EVERY ARM IN THIS DESCRIBE ASSERTED A JAVASCRIPT OPERATOR ON A LITERAL
 * IT HAD JUST TYPED, under a heading that says "Security Boundaries".
 * Verbatim:
 *
 *     it("only admins can review change requests", () => {
 *       const admin = { id: 1, role: "admin" };
 *       expect(admin.role === "admin").toBe(true);          // "admin" === "admin"
 *     });
 *
 *     it("moderators can only view their own requests", () => {
 *       const moderatorId = 10;
 *       const request = { submittedById: 10 };
 *       expect(request.submittedById === moderatorId).toBe(true);   // 10 === 10
 *     });
 *
 * The second is **invariant 1** — *scope the owner in the statement that
 * reads or writes* — asserted as `10 === 10`. Move `reviewChangeRequest` to
 * `moderatorProcedure`, or read `getMyChangeRequests`' moderator id out of
 * procedure INPUT instead of `ctx.user.id`, and every one of them stays
 * green. Invariant 7: a test must prove it BLOCKS.
 *
 * The product was read at the router when these were replaced (2026-08-25)
 * and every clause was correct: `createChangeRequest` is `moderatorProcedure`,
 * `reviewChangeRequest` and `listChangeRequests` are `adminProcedure`, and
 * `getMyChangeRequests` passes `ctx.user.id` INTO the db helper rather than
 * filtering after the fact. These arms exist for the day that changes.
 */
describe("Change Request - Security Boundaries (DRIVEN through the real procedures)", () => {
  function callerFor(user: { id: number; role: string } | null) {
    return moderatorRouter.createCaller({ user, ...(user ? {} : {}) } as never);
  }

  it("a plain user is REFUSED createChangeRequest — the middleware blocks, it is not recited", async () => {
    await expect(
      callerFor({ id: 42, role: "user" }).createChangeRequest({
        type: "refund_credits",
        priority: "normal",
        targetUserId: 7,
        title: "Refund credits for service disruption",
        description: "A description long enough to pass the minimum length rule.",
      } as never),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("an unauthenticated caller is REFUSED, and with UNAUTHORIZED rather than FORBIDDEN", async () => {
    await expect(
      callerFor(null).getMyChangeRequests({} as never),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("a SUSPENDED moderator is refused even though the role is right", async () => {
    const caller = moderatorRouter.createCaller({
      user: { id: 10, role: "moderator", suspendedAt: new Date() },
    } as never);
    await expect(caller.getMyChangeRequests({} as never)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("POSITIVE CONTROL — a live moderator is ALLOWED, so the three refusals above are not refusing everyone", async () => {
    const caller = moderatorRouter.createCaller({
      user: { id: 10, role: "moderator", suspendedAt: null },
    } as never);
    await expect(caller.getMyChangeRequests({} as never)).resolves.toBeDefined();
  });

  /*
   * 3g's D read (2026-08-25): NOTHING in the suite drove `reviewChangeRequest`
   * or `listChangeRequests`. What stood for them were arms that asserted
   * `expect(admin.role === "admin").toBe(true)` over a literal, and arms that
   * called a mocked db helper themselves and then asserted the mock. The two
   * below are the refusal actually happening.
   */

  it("a MODERATOR is refused reviewChangeRequest — the admin gate blocks, it is not recited", async () => {
    const caller = changeRequestsRouter.createCaller({
      user: { id: 10, role: "moderator", email: "mod@example.com", name: "Mod", suspendedAt: null },
    } as never);
    await expect(
      caller.reviewChangeRequest({ requestId: 1, action: "approved" } as never),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("a MODERATOR is refused listChangeRequests — every admin's-eyes-only read, not just the write", async () => {
    const caller = changeRequestsRouter.createCaller({
      user: { id: 10, role: "moderator", email: "mod@example.com", name: "Mod", suspendedAt: null },
    } as never);
    await expect(caller.listChangeRequests({} as never)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("an UNAUTHENTICATED caller is refused with UNAUTHORIZED, not FORBIDDEN", async () => {
    const caller = changeRequestsRouter.createCaller({ user: null } as never);
    await expect(caller.listChangeRequests({} as never)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  /*
   * THESE TWO CLOSED A DESCRIBE CALLED "Security Boundaries" BY ASSERTING
   * LITERALS: one declared `["approved", "denied"]` and asked its own array
   * what it contained; the other declared `"x".repeat(2001)` and asserted 2001
   * is more than 2000. Both are real rules on the review procedure's input, and
   * both are read from it now.
   */
  it("the review actions are the product's own enum -- approve and deny, nothing else", () => {
    const actions = enumOptionsOf(changeRequestsRouter, "reviewChangeRequest", "action");
    expect([...actions].sort()).toEqual(["approved", "denied"]);
  });

  it("a review note past the product's limit is REFUSED, and one at the limit is accepted", async () => {
    const caller = changeRequestsRouter.createCaller({
      user: { id: 1, role: "admin", email: "admin@example.com", name: "Admin", openId: null, suspendedAt: null },
      req: { headers: {}, socket: {} },
    } as never);

    await expect(
      caller.reviewChangeRequest({ id: 1, action: "denied", reviewNotes: "x".repeat(2001) } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // POSITIVE CONTROL at the boundary itself.
    await expect(
      caller.reviewChangeRequest({ id: 1, action: "denied", reviewNotes: "x".repeat(2000) } as never),
    ).resolves.toBeDefined();
  });
});

// ============================================================
// Update moderator.test.ts references
// ============================================================
describe("Change Request - Replaces Escalation", () => {
  /*
   * ⚠ AN ARM STOOD HERE THAT TYPED THE MODERATOR SURFACE OUT BY HAND AND
   * ASSERTED ITS OWN ARRAY: `expect(moderatorQueries).toContain(…)` over a
   * `const moderatorQueries = [...]` on the line above.
   *
   * It had drifted, and this is the specimen the census kept. It named
   * SEVEN procedures. **The router holds FIFTEEN**, and **two of its seven
   * do not exist**:
   *
   *     getAuditStatistics   → the router has `getAuditStats`
   *     getBlockedIps        → the router has `listBlockedIPs`
   *
   * Nine real procedures were absent from it. Two fictional names sat in a
   * list describing an access-control surface and nothing could notice,
   * because nothing ever compared the list to the router it named.
   *
   * The surface is now DERIVED off `moderatorRouter._def.procedures` in
   * `server/moderator.test.ts` — "Moderator Role - Security Boundaries
   * (DERIVED from the running router)" — where a second write operation or
   * a renamed query reddens an arm. This arm is deleted rather than moved:
   * a second place stating the same surface is the disease it died of.
   */

  it("moderators may only REQUEST a change; only admins may act on one — asked of both ROUTERS", () => {
    const moderatorSurface = Object.keys(
      (moderatorRouter as unknown as { _def: { procedures: Record<string, unknown> } })._def.procedures,
    );
    const adminSurface = Object.keys(
      (changeRequestsRouter as unknown as { _def: { procedures: Record<string, unknown> } })._def.procedures,
    );
    // Population control — a reader that reads nothing agrees with everything.
    expect(moderatorSurface.length).toBeGreaterThan(0);
    expect(adminSurface.length).toBeGreaterThan(0);

    // The request half is the moderator's, and the escalation it replaced is gone.
    expect(moderatorSurface).toContain("createChangeRequest");
    expect(moderatorSurface).toContain("getMyChangeRequests");
    expect(moderatorSurface).not.toContain("escalateToAdmin");

    // The acting half is the admin's, and is NOT on the moderator router.
    expect(adminSurface).toContain("reviewChangeRequest");
    expect(adminSurface).toContain("listChangeRequests");
    expect(moderatorSurface).not.toContain("reviewChangeRequest");
    expect(moderatorSurface).not.toContain("listChangeRequests");
  });

  /*
   * THE TWO ARMS THAT STOOD HERE ARE #681'S OWN HEADLINE SPECIMENS, AND BOTH
   * ARE DELETED, category (2) -- worthless.
   *
   *   "change request should have structured fields instead of free-text
   *   reason" declared a seven-key object and then asserted, seven times, that
   *   the object it had just written held the keys it had just written.
   *
   *   "change requests should be trackable with status workflow" declared an
   *   object of four strings, ASSIGNED three new strings to it, and asserted it
   *   now held the strings that had been assigned to it two lines above.
   *
   * Neither refers to the product in any way, so neither can be pointed at it:
   * the structured fields are the create procedure's input schema, which the
   * driven bound arms at the top of this file exercise, and the status workflow
   * is the vocabulary read off `listChangeRequests` in the same place. There is
   * nothing here to derive that is not already derived.
   */
});

// ============================================================
// Auto-Execute on Approval Tests
// ============================================================

/*
 * THE "Auto-Execute on Approval" DESCRIBE -- NINETEEN ARMS -- IS DELETED IN
 * FULL, category (3): every case in it is covered for real elsewhere, and not
 * one of the nineteen ran a line of product code.
 *
 * What they did instead, in three shapes:
 *
 *   1. FETCH A FIXTURE, THEN HAND-EXECUTE THE PRODUCT. The add_credits,
 *      suspend_user, unsuspend_user and block_ip arms each read a mock fixture,
 *      then called the mocked `addCredits`/`suspendUser`/`blockIp` and
 *      `logAuditEvent` themselves, in the order the product calls them, and
 *      asserted each had been called with what the arm had just passed. They
 *      were `executeChangeRequestAction` transcribed into a test of itself.
 *
 *   2. DECLARE A PREDICATE AND ASSERT IT. "should not execute if creditAmount
 *      is null or zero" declared `const shouldExecute = (n) => n !== null &&
 *      n > 0` and then checked that function against three numbers. The
 *      product's rule was never consulted.
 *
 *   3. ASSERT A LITERAL. The three "execution result structure" arms declared
 *      `{ executed: false }` and asserted it was `{ executed: false }`.
 *
 * WHERE THE REAL COVERAGE IS, read at the artifacts rather than assumed:
 *
 *   server/adminActionHandlers.test.ts drives the actual handlers --
 *   `cr_suspendUser` (including its refusal to suspend an ADMIN, which no arm
 *   here imagined), `cr_unsuspendUser`, `cr_refundCredits` (including the
 *   `cr-<id>` reference that makes a repeated approval idempotent),
 *   `cr_addCredits` (including that a BONUS and a REFUND are not the same row),
 *   `cr_blockIP` and `cr_stripeRefund` -- and each has its own "does NOT settle
 *   when the action failed" arm, which is the failure handling these four
 *   "gracefully" arms were reaching for by re-configuring a mock to fail and
 *   then asserting the mock had failed.
 *
 *   server/adminActionDispatch.test.ts drives the routing, and its first arm
 *   holds the SIX cr_ actions to the one declaration.
 *
 *   The denial case -- "denial should NOT auto-execute" -- is driven in this
 *   file, in "denying a request marks it denied, and executes nothing", where
 *   the procedure runs and the dispatcher is asserted never to have been
 *   called. The sensitive-approval case is driven beside it.
 *
 * Deleting nineteen arms that cannot fail, whose subject is covered by arms
 * that can, is the whole of #681 in one block.
 */

// ============================================================
// Slack Approval Gating for Sensitive Change Requests
// ============================================================
describe("Change Request - Slack Approval Gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /*
   * ⚠ THIS BLOCK DECLARED ITS OWN SENSITIVE/NON-SENSITIVE LISTS AND ASSERTED
   * THEIR LENGTHS — and it had DRIFTED, in a way its own arms could not see:
   *
   *     const SENSITIVE_TYPES = [... five entries ...];
   *     it("should classify 5 types as sensitive", () => {
   *       expect(SENSITIVE_TYPES).toHaveLength(5);      // its own array
   *     });
   *     it("should cover all 8 change request types", …) // the product has NINE
   *
   * `stripe_refund` was missing from both. The product treats SIX types as
   * sensitive and accepts NINE, so the suite's only description of which
   * change requests need Slack approval said a Stripe refund does not — and
   * the arm that would have caught it was counting its own literal.
   *
   * Everything below is DERIVED: the vocabulary off the running
   * `moderatorRouter`'s own input schema, and sensitivity off
   * `CHANGE_REQUEST_ACTION_BY_TYPE`, which the review procedure now uses too.
   * Filed under 3g's D.
   */
  function changeRequestTypes(): string[] {
    const procedures = (moderatorRouter as unknown as {
      _def: { procedures: Record<string, { _def: { inputs: unknown[] } }> };
    })._def.procedures;
    const schema = procedures.createChangeRequest!._def.inputs[0] as {
      shape: { type: { options: string[] } };
    };
    const types = schema.shape.type.options;
    // Population control: a reader that reads nothing agrees with everything.
    if (!types?.length) throw new Error("read no change-request types off the router");
    return [...types];
  }

  /*
   * Both lists are DERIVED, and the neighbouring arms in this describe use
   * them. They were hand-typed literals until 2026-08-25, and the sensitive
   * one had drifted to five (see the block above).
   */
  const SENSITIVE_TYPES = Object.keys(CHANGE_REQUEST_ACTION_BY_TYPE);
  const NON_SENSITIVE_TYPES = changeRequestTypes().filter(
    (t) => !SENSITIVE_TYPES.includes(t),
  );

  describe("sensitive type classification, DERIVED", () => {
    it("a type is sensitive EXACTLY when it has a Slack approval action", () => {
      const sensitive = Object.keys(CHANGE_REQUEST_ACTION_BY_TYPE);
      // Quoted independently, because deriving BOTH sides would agree with
      // anything: this is the product's contract, stated once, in a test.
      expect([...sensitive].sort()).toEqual([
        "add_credits", "block_ip", "refund_credits",
        "stripe_refund", "suspend_user", "unsuspend_user",
      ]);
    });

    it("FROM THE DIFF — stripe_refund IS sensitive, which the old five-member list denied", () => {
      expect(Object.keys(CHANGE_REQUEST_ACTION_BY_TYPE)).toContain("stripe_refund");
      expect(changeRequestTypes()).toContain("stripe_refund");
    });

    it("FROM THE DIFF — the product accepts NINE types, not the eight this file counted", () => {
      expect(changeRequestTypes()).toHaveLength(9);
    });

    it("every sensitive type is one the product actually accepts", () => {
      const accepted = changeRequestTypes();
      for (const type of Object.keys(CHANGE_REQUEST_ACTION_BY_TYPE)) {
        expect(accepted, `${type} has an approval action but is not an accepted type`).toContain(type);
      }
    });

    it("the non-sensitive types are the remainder, derived rather than listed twice", () => {
      const sensitive = new Set(Object.keys(CHANGE_REQUEST_ACTION_BY_TYPE));
      const nonSensitive = changeRequestTypes().filter((t) => !sensitive.has(t));
      expect([...nonSensitive].sort()).toEqual(["flag_account", "note_incident", "other"]);
      // Sensitive and non-sensitive partition the vocabulary — no type falls
      // through either side, which is what "covers all types" was reaching for.
      expect(nonSensitive.length + sensitive.size).toBe(changeRequestTypes().length);
    });
  });

  describe("CR to Slack approval action mapping", () => {
    /*
     * ⚠ A FIFTH HAND-TYPED COPY OF THE MAP STOOD HERE, and it had drifted to
     * FIVE entries — `stripe_refund` missing, exactly as in the sensitive list
     * above. It went unnoticed because the arm below iterated the file's OWN
     * five-member `SENSITIVE_TYPES`, so the two short lists agreed with each
     * other. Deriving the sensitive list made this arm fail on the first run,
     * which is the derivation catching its neighbour.
     */
    const CR_TO_APPROVAL_ACTION: Record<string, string> = CHANGE_REQUEST_ACTION_BY_TYPE;

    it("should map all sensitive types to cr_ prefixed actions", () => {
      for (const type of SENSITIVE_TYPES) {
        expect(CR_TO_APPROVAL_ACTION[type]).toBeDefined();
        expect(CR_TO_APPROVAL_ACTION[type]).toMatch(/^cr_/);
      }
    });

    it("should not have mappings for non-sensitive types", () => {
      for (const type of NON_SENSITIVE_TYPES) {
        expect(CR_TO_APPROVAL_ACTION[type]).toBeUndefined();
      }
    });
  });

  /**
   * Every arm below sets its OWN fixture. `vi.clearAllMocks()` clears CALLS and
   * not implementations, so a `mockResolvedValue` left by a neighbour is still
   * in force when the next arm runs -- which is how one of the arms deleted
   * here came to depend on the row its predecessor happened to leave behind.
   */
  async function givenRequest(row: Record<string, unknown>) {
    const { getChangeRequestById } = await import("./db");
    vi.mocked(getChangeRequestById).mockResolvedValue(row as never);
  }

  function adminCallerG() {
    return changeRequestsRouter.createCaller({
      user: { id: 1, role: "admin", email: "admin@example.com", name: "Admin", openId: null, suspendedAt: null },
      req: { headers: {}, socket: {} },
    } as never);
  }

  describe("sensitive approval flow", () => {
    /*
     * THREE ARMS STOOD HERE. One declared a `result` object with
     * `pendingExecution: true` typed into it and asserted it was true. One
     * iterated `SENSITIVE_TYPES` and asserted each member of that array was in
     * that array. The third called the mocked `updateChangeRequestStatus`
     * itself and asserted its own call.
     *
     * The first two are DELETED, category (3) -- the sensitive road is driven
     * in "approving a SENSITIVE request sets pending_execution rather than
     * approving outright" above, where the procedure actually runs. The third
     * named a real fact nothing else asserted -- that the Slack action id is
     * STORED on the request -- so it is driven rather than dropped.
     */
    it("the Slack approval id is stored on the request, by the procedure", async () => {
      const { updateChangeRequestStatus } = await import("./db");
      await givenRequest({
        id: 1, type: "refund_credits", status: "pending", submittedById: 10,
        targetUserId: 42, creditAmount: 50, title: "Refund", reviewNotes: null,
      });
      vi.mocked(updateChangeRequestStatus).mockClear();

      await adminCallerG().reviewChangeRequest({ id: 1, action: "approved" } as never);

      /*
       * TWO writes, and the second is the one this arm is about: the procedure
       * moves the request to `pending_execution` first, then stores the Slack
       * action id in a SECOND call that also passes the expected current status
       * as a third argument -- an optimistic-concurrency guard. Asserting two
       * arguments would not have matched it at all, which is what the first
       * shape of this arm did.
       */
      expect(updateChangeRequestStatus).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: "pending_execution",
          slackApprovalId: expect.any(String),
        }),
        "pending_execution",
      );
    });
  });

  describe("non-sensitive approval flow", () => {
    /*
     * BOTH ARMS ASSERTED A `result` LITERAL they had typed, one of them after
     * reading a fixture that played no part in the assertion. The distinction
     * they were reaching for is real and is driven here: a non-sensitive type
     * goes STRAIGHT to its final status, with no Slack hop in between.
     */
    it("a non-sensitive approval goes straight to approved -- no pending_execution, no Slack id", async () => {
      const { updateChangeRequestStatus } = await import("./db");
      await givenRequest({
        id: 7, type: "note_incident", status: "pending", submittedById: 10,
        targetUserId: 42, title: "Note", reviewNotes: null,
      });
      expect(SENSITIVE_TYPES).not.toContain("note_incident");
      vi.mocked(updateChangeRequestStatus).mockClear();

      await adminCallerG().reviewChangeRequest({ id: 7, action: "approved" } as never);

      const [, update] = vi.mocked(updateChangeRequestStatus).mock.calls[0] as [number, Record<string, unknown>];
      expect(update.status).toBe("approved");
      expect(update).not.toHaveProperty("slackApprovalId");
    });
  });

  describe("denial bypasses Slack", () => {
    /*
     * ONE ARM DECLARED `const shouldRouteToSlack = action === "approved" && ...`
     * and asserted its own boolean; the other called the mocked db helper
     * itself. The claim -- that even a SENSITIVE type is denied outright,
     * without waiting for Slack -- is worth keeping, so it is driven.
     */
    it("a SENSITIVE type is denied outright, with no Slack hop and nothing executed", async () => {
      const { updateChangeRequestStatus } = await import("./db");
      const { requestApproval } = await import("./slack/slackApproval");
      await givenRequest({
        id: 3, type: "suspend_user", status: "pending", submittedById: 10,
        targetUserId: 55, title: "Suspend", reviewNotes: null,
      });
      expect(SENSITIVE_TYPES).toContain("suspend_user");
      vi.mocked(updateChangeRequestStatus).mockClear();
      vi.mocked(requestApproval).mockClear();

      await adminCallerG().reviewChangeRequest({
        id: 3, action: "denied", reviewNotes: "Insufficient evidence",
      } as never);

      expect(updateChangeRequestStatus).toHaveBeenCalledWith(
        3,
        expect.objectContaining({ status: "denied" }),
      );
      expect(requestApproval).not.toHaveBeenCalled();
    });
  });

  describe("checkChangeRequestSlackStatus", () => {
    /*
     * FOUR ARMS STOOD HERE AND ALL FOUR BUILT THEIR OWN `result` OBJECT and
     * asserted its fields -- including the message strings, which they typed
     * themselves. The procedure exists, is an `adminProcedure`, and was driven
     * by nothing at all. It is driven now.
     */
    it("a request that is not awaiting Slack reports no Slack status", async () => {
      await givenRequest({ id: 1, status: "approved", slackApprovalId: null });
      const result = await adminCallerG().checkChangeRequestSlackStatus({ changeRequestId: 1 } as never);
      expect(result).toMatchObject({ status: "approved", slackStatus: null });
    });

    it("a request awaiting Slack reports what Slack says -- pending, approved and denied", async () => {
      await givenRequest({ id: 3, status: "pending_execution", slackApprovalId: "slack-1" });

      slackApprovalStatus.mockReturnValue({ status: "pending", resolvedBy: null, resolvedAt: null });
      expect(
        await adminCallerG().checkChangeRequestSlackStatus({ changeRequestId: 3 } as never),
      ).toMatchObject({ status: "pending_execution", slackStatus: "pending" });

      slackApprovalStatus.mockReturnValue({ status: "approved", resolvedBy: "slack-admin" });
      expect(
        await adminCallerG().checkChangeRequestSlackStatus({ changeRequestId: 3 } as never),
      ).toMatchObject({ slackStatus: "approved", resolvedBy: "slack-admin" });

      slackApprovalStatus.mockReturnValue({ status: "denied", resolvedBy: "slack-admin" });
      expect(
        await adminCallerG().checkChangeRequestSlackStatus({ changeRequestId: 3 } as never),
      ).toMatchObject({ slackStatus: "denied" });
    });

    it("an approval Slack has forgotten reads as not_found rather than as pending", async () => {
      await givenRequest({ id: 3, status: "pending_execution", slackApprovalId: "slack-1" });
      slackApprovalStatus.mockReturnValue(undefined);
      expect(
        await adminCallerG().checkChangeRequestSlackStatus({ changeRequestId: 3 } as never),
      ).toMatchObject({ slackStatus: "not_found" });
    });
  });

  describe("executeChangeRequestAfterSlack", () => {
    /*
     * THREE ARMS STOOD HERE and each declared a boolean and asserted it:
     * `const shouldReject = request.status !== "pending_execution" || ...;
     * expect(shouldReject).toBe(true)`. They restated the procedure's guard in
     * the test's own words, one line before asserting the restatement. All
     * three conditions are DRIVEN by the four arms below -- a denial, an
     * expiry, an approval, and a request that was never pending Slack at all.
     */
    /** A request that HAS been admin-approved and is awaiting Slack. */
    async function givenPendingExecution() {
      const { getChangeRequestById } = await import("./db");
      vi.mocked(getChangeRequestById).mockResolvedValue({
        id: 3,
        type: "refund_credits",
        status: "pending_execution",
        slackApprovalId: "slack-1",
        submittedById: 10,
        targetUserId: 42,
        creditAmount: 50,
        reviewNotes: "Approved pending Slack",
      } as never);
    }

    function adminCallerFor() {
      return changeRequestsRouter.createCaller({
        user: { id: 1, role: "admin", email: "admin@example.com", name: "Admin", openId: null, suspendedAt: null },
        req: { headers: {}, socket: {} },
      } as never);
    }

    it("a Slack DENIAL marks the change request denied, and executes nothing", async () => {
      await givenPendingExecution();
      const { updateChangeRequestStatus } = await import("./db");
      const { executeApprovedAdminAction } = await import("./lib/adminActions");
      slackApprovalStatus.mockReturnValue({ status: "denied", resolvedBy: "slack-admin" });

      const result = await adminCallerFor().executeChangeRequestAfterSlack({ changeRequestId: 3 } as never);
      expect(result).toMatchObject({ success: false });
      expect(updateChangeRequestStatus).toHaveBeenCalledWith(
        3,
        expect.objectContaining({ status: "denied" }),
        "pending_execution",
      );
      expect(executeApprovedAdminAction).not.toHaveBeenCalled();
    });

    it("a Slack EXPIRY marks it expired, and executes nothing", async () => {
      await givenPendingExecution();
      const { updateChangeRequestStatus } = await import("./db");
      const { executeApprovedAdminAction } = await import("./lib/adminActions");
      slackApprovalStatus.mockReturnValue({ status: "expired" });

      const result = await adminCallerFor().executeChangeRequestAfterSlack({ changeRequestId: 3 } as never);
      expect(result).toMatchObject({ success: false });
      expect(updateChangeRequestStatus).toHaveBeenCalledWith(
        3,
        expect.objectContaining({ status: "expired" }),
        "pending_execution",
      );
      expect(executeApprovedAdminAction).not.toHaveBeenCalled();
    });

    it("FROM THE DIFF — a Slack APPROVAL is what reaches the dispatcher, and only then", async () => {
      await givenPendingExecution();
      const { executeApprovedAdminAction } = await import("./lib/adminActions");
      slackApprovalStatus.mockReturnValue({ status: "approved", action: "cr_refundCredits", resolvedBy: "slack-admin" });

      const result = await adminCallerFor().executeChangeRequestAfterSlack({ changeRequestId: 3 } as never);
      expect(result).toMatchObject({ success: true });
      expect(executeApprovedAdminAction).toHaveBeenCalled();
    });

    it("FROM THE DIFF — a request NOT pending Slack execution is refused before anything is read", async () => {
      // A request still `pending` has not been admin-approved, so there is
      // nothing for Slack to have confirmed. Set explicitly rather than relying
      // on the shared fixture, because the arms above leave a resolved value on
      // the mock and a fixture inherited from a neighbour is not a fixture.
      const { getChangeRequestById } = await import("./db");
      vi.mocked(getChangeRequestById).mockResolvedValue({
        id: 1, type: "refund_credits", status: "pending", slackApprovalId: null,
      } as never);
      slackApprovalStatus.mockReturnValue({ status: "approved" });
      await expect(
        adminCallerFor().executeChangeRequestAfterSlack({ changeRequestId: 1 } as never),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  describe("Slack approval action types", () => {
    /*
     * A THIRD WRONG NUMBER, and #681 did not know about this one -- it named
     * the eight-vs-nine type count and the five-vs-six sensitive list. This arm
     * hand-typed FIVE `cr_` actions and asserted its own array was five long.
     * The product declares SIX: `cr_stripeRefund` was missing here too, in the
     * same file, from the same drift, for the same reason.
     */
    it("the cr_ actions are the product's own, and every one is prefixed", () => {
      const actions = Object.values(CHANGE_REQUEST_ACTION_BY_TYPE);
      expect(actions).toHaveLength(6);
      expect([...actions].sort()).toEqual([
        "cr_addCredits", "cr_blockIP", "cr_refundCredits",
        "cr_stripeRefund", "cr_suspendUser", "cr_unsuspendUser",
      ]);
      for (const action of actions) expect(action).toMatch(/^cr_/);
    });

    /*
     * A FOURTH WRONG STATEMENT ABOUT THE PRODUCT, and this one is not a count.
     * "should map cr_ actions to correct labels" declared its own label map --
     * `cr_suspendUser: "CR: Suspend User"` -- and asserted that map contained
     * "Suspend". The product's labels read "Change Request: Suspend User". So
     * the suite's only description of what an admin sees in Slack used a prefix
     * the product has never sent, and its assertions were loose enough
     * (`toContain("Suspend")`) that the difference could not show.
     *
     * DELETED rather than derived, and the reason is stated so the next reader
     * does not re-derive it: `ACTION_LABELS` is module-private in
     * `server/slack/slackApproval.ts` and that module is mocked in this file,
     * so there is nothing here to read. Exporting it is a product change, and
     * this card is test-only by its own terms. Filed on #681 instead.
     */
  });

  /*
   * "should include pendingExecutionCount in list summary" IS DELETED,
   * category (2). It declared a five-key summary object and asserted the object
   * held the key and the value it had just been given. The real summary is
   * built inside the db helper, which this suite mocks wholesale, so there is
   * no product reading available at this level -- and the admin list
   * procedure's own passthrough is already driven above.
   */

  describe("end-to-end flow simulation", () => {
    /*
     * ⚠ TWO ARMS STOOD HERE that hand-walked the whole flow — calling the
     * mocked `updateChangeRequestStatus` three times in the order the product
     * calls it, then `addCredits`, then asserting
     * `toHaveBeenCalledTimes(3)` on their own calls. They asserted the shape
     * of a script the test itself had written, and they depended on a shared
     * mutable fixture, which is how one of them broke the moment a neighbouring
     * arm set its own.
     *
     * The flow is driven for real below: admin review, then the post-Slack
     * execute procedure, with the dispatcher doubled (it has its own suite in
     * `adminActionDispatch.test.ts`). Filed under 3g's D.
     */
    it("the whole flow: admin approves a sensitive request, Slack confirms, the dispatcher runs", async () => {
      const { getChangeRequestById, updateChangeRequestStatus } = await import("./db");
      const { executeApprovedAdminAction } = await import("./lib/adminActions");
      const caller = changeRequestsRouter.createCaller({
        user: { id: 1, role: "admin", email: "admin@example.com", name: "Admin", openId: null, suspendedAt: null },
        req: { headers: {}, socket: {} },
      } as never);

      // 1. the admin approves a SENSITIVE request - it goes to pending_execution.
      //
      // The starting row is set HERE rather than inherited. This arm used to
      // rely on whichever fixture the preceding describe happened to leave on
      // the mock -- `vi.clearAllMocks()` clears calls, not implementations --
      // which is the same "a fixture inherited from a neighbour is not a
      // fixture" note its own sibling below already carries.
      vi.mocked(getChangeRequestById).mockResolvedValue({
        id: 1, type: "refund_credits", status: "pending", submittedById: 10,
        targetUserId: 42, creditAmount: 50, title: "Refund", reviewNotes: null,
      } as never);
      await caller.reviewChangeRequest({ id: 1, action: "approved" } as never);
      expect(updateChangeRequestStatus).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ status: "pending_execution" }),
      );
      expect(executeApprovedAdminAction).not.toHaveBeenCalled();

      // 2. Slack confirms — and only now does anything execute
      vi.mocked(getChangeRequestById).mockResolvedValue({
        id: 1, type: "refund_credits", status: "pending_execution",
        slackApprovalId: "slack-1", targetUserId: 42, creditAmount: 50,
      } as never);
      slackApprovalStatus.mockReturnValue({ status: "approved", action: "cr_refundCredits" });

      await caller.executeChangeRequestAfterSlack({ changeRequestId: 1 } as never);
      expect(executeApprovedAdminAction).toHaveBeenCalled();
    });

    it("the same flow with a Slack DENIAL never reaches the dispatcher", async () => {
      const { getChangeRequestById } = await import("./db");
      const { executeApprovedAdminAction } = await import("./lib/adminActions");
      const caller = changeRequestsRouter.createCaller({
        user: { id: 1, role: "admin", email: "admin@example.com", name: "Admin", openId: null, suspendedAt: null },
        req: { headers: {}, socket: {} },
      } as never);

      // Set the starting state explicitly: the arm above leaves a
      // `pending_execution` fixture on the shared mock, and a fixture
      // inherited from a neighbour is not a fixture.
      vi.mocked(getChangeRequestById).mockResolvedValue({
        id: 1, type: "refund_credits", status: "pending", submittedById: 10,
        targetUserId: 42, creditAmount: 50, reviewNotes: "",
      } as never);
      await caller.reviewChangeRequest({ id: 1, action: "approved" } as never);
      vi.mocked(getChangeRequestById).mockResolvedValue({
        id: 1, type: "refund_credits", status: "pending_execution",
        slackApprovalId: "slack-1", reviewNotes: "",
      } as never);
      slackApprovalStatus.mockReturnValue({ status: "denied", resolvedBy: "slack-admin" });

      const result = await caller.executeChangeRequestAfterSlack({ changeRequestId: 1 } as never);
      expect(result).toMatchObject({ success: false });
      expect(executeApprovedAdminAction).not.toHaveBeenCalled();
    });
  });
});
