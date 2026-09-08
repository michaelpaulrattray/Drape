/*
 * ⚠ THIS FILE ASSERTED DRAPE'S MODERATOR SURFACE AGAINST LITERALS IT TYPED ON
 * THE LINE ABOVE, AND CALLED IT "Access Control" WHILE DOING IT. 42 of its 46
 * arms could not fail. Repaired 2026-09-09 (#697, the law-7 class of #681).
 *
 * The three shapes that were here, all three of #681's:
 *
 *   1. ASSERTS ITS OWN LITERAL —
 *          const user = { id: 10, role: "moderator" };
 *          expect(user.role === "moderator" || user.role === "admin").toBe(true);
 *      That is `"moderator" === "moderator"`, under a heading reading
 *      **Moderator Role - Access Control**. Eight arms of it, plus six more
 *      reciting the same boolean as "UI Access Control", plus
 *          it("should not provide unblock capability", () => expect(true).toBe(true))
 *      — a tautology standing in for a security claim.
 *
 *   2. CALLS A MODULE THIS FILE MOCKS, THEN ASSERTS THE MOCK — fourteen arms.
 *          const { getFilteredAuditLogs } = await import("./auditLog");
 *          await getFilteredAuditLogs({ severity: "warning" });
 *          expect(getFilteredAuditLogs).toHaveBeenCalledWith(
 *            expect.objectContaining({ severity: "warning" }));
 *      No line of `moderatorRouter` runs in that. Delete the procedure it
 *      names and it stays green.
 *
 *   3. TRANSCRIBES THE PRODUCT AND TESTS THE TRANSCRIPTION — the eight-arm
 *      change-request describe, whose subject is genuinely and better covered
 *      in `changeRequests.test.ts` (read at that file, not assumed).
 *
 * ⚠ AND SHAPE 3 HAD ALREADY DRIFTED, WHICH IS THE SPECIMEN WORTH KEEPING:
 *          it("should support all 8 change request types", …)
 *      **The product declares NINE** — `CHANGE_REQUEST_TYPE_LABELS` in
 *      `shared/changeRequestLabels.ts` — and `stripe_refund` was the missing
 *      one, for the third time in this suite's history. #681 corrected exactly
 *      this count in `changeRequests.test.ts` on 2026-09-09; the copy in THIS
 *      file was a second statement of the same wrong number, still green.
 *      Working law 4 on a test: a second list shadowing a source of truth
 *      always drifts from it.
 *
 * WHAT REPLACED THEM, and the rule applied to each:
 *
 * - **Covered next door → DELETED, not rewritten.** `moderatorProcedure`'s
 *   refusals (plain user, unauthenticated, suspended moderator, and a live
 *   moderator as the positive control) are DRIVEN in
 *   `changeRequests.test.ts`'s "Security Boundaries (DRIVEN through the real
 *   procedures)". Re-driving them here would be the mirror this file was
 *   caught being. The change-request validation, the type list, the Slack
 *   note and the audit row are likewise driven there and are gone from here.
 *
 * - **NOT covered anywhere → DRIVEN here, because this is the router's own
 *   file.** Two gaps were measured before a line was written:
 *     · **No ADMIN is driven through `moderatorRouter` anywhere in the tree**
 *       (`grep -rn 'moderatorRouter.createCaller' server/` — every existing
 *       one is a moderator, a plain user, or null). The capability grid's
 *       footnote 1 — *admins pass the moderator middleware, so they inherit
 *       the entire moderator surface* — had no test that could fail.
 *     · **No moderator READ procedure was driven anywhere.** Not one of the
 *       router's TWELVE reads had a driven caller in the repository; the
 *       fourteen arms of shape 2 stood in for all of them. ⚠ **This sentence
 *       first said "seven" and drove seven, which the reviewer of PR #698
 *       caught: the file then read as coverage it did not have, and two of the
 *       five it left out — `getUserCreditHistory` and
 *       `getUserGenerationHistory` — carry the SAME `all`-collapse and
 *       date-conversion translations, one of them on the credits read a staff
 *       member opens to investigate a complaint.** All twelve are driven now,
 *       and the last describe in this file derives the population from the
 *       running router so the claim cannot quietly stop being true.
 *
 * - **The client's guard is NOT recited here.** The six "UI Access Control"
 *   arms transcribed `ModeratorDashboard.tsx:180`'s
 *   `user?.role !== "moderator" && user?.role !== "admin"` into a server
 *   suite. A server test cannot render that component, so the transcription
 *   was the whole arm. Deleted; the untested client guard is filed as a card
 *   rather than faked here.
 *
 * THE BAR: every arm below was proven by SABOTAGING THE PRODUCT and watching
 * exactly it redden — not by reading. #681's repair produced one arm that read
 * like invariant 3 and stayed green under sabotage because zod stripped the
 * forged field before the handler saw it. That is what this class does even to
 * someone repairing it, which is why the sabotage is the receipt.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { moderatorRouter } from "./routes/moderator";
import { users } from "../drizzle/schema";

// Mock the slackNotification module
vi.mock("./slack/slackNotification", () => ({
  sendEmergencyActionsToAdminChannel: vi.fn().mockResolvedValue(true),
  sendAdminActionNotification: vi.fn().mockResolvedValue(true),
  sendAuditLogEntry: vi.fn().mockResolvedValue(true),
  sendSlackAlert: vi.fn().mockResolvedValue(true),
}));

// Mock the auditLog module
vi.mock("./auditLog", () => ({
  getFilteredAuditLogs: vi.fn().mockResolvedValue({
    logs: [
      {
        id: 1,
        userId: 42,
        action: "abuse.rate_limit",
        resourceType: "api",
        resourceId: "endpoint-1",
        metadata: { ipAddress: "1.2.3.4" },
        ipAddress: "1.2.3.4",
        userAgent: "test-agent",
        severity: "warning",
        createdAt: new Date("2026-01-15T10:00:00Z"),
      },
    ],
    total: 1,
  }),
  getAbuseAlertsSummary: vi.fn().mockResolvedValue({
    alerts: [],
    criticalCount: 0,
    warningCount: 2,
  }),
  getAuditStatistics: vi.fn().mockResolvedValue({
    totalLogs: 150,
    last24Hours: 12,
    last7Days: 78,
    bySeverity: { info: 100, warning: 40, critical: 10 },
  }),
  getAuditLogById: vi.fn().mockResolvedValue({
    id: 1,
    userId: 42,
    action: "abuse.rate_limit",
    severity: "warning",
    createdAt: new Date("2026-01-15T10:00:00Z"),
  }),
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: {
    MODERATOR_ESCALATION: "moderator.escalation",
  },
}));

// Mock the db module
vi.mock("./db", () => ({
  getUserById: vi.fn().mockResolvedValue({
    id: 42,
    name: "Test User",
    email: "test@example.com",
    role: "user",
    suspendedAt: null,
    suspendedReason: null,
    lockedUntil: null,
    failedLoginAttempts: 0,
    createdAt: new Date("2025-06-01"),
    lastSignedIn: new Date("2026-01-15"),
    /*
     * ⚠ THE FORBIDDEN SIX ARE SEEDED HERE ON PURPOSE, AND THE INVARIANT-8 ARM
     * BELOW CANNOT FAIL WITHOUT THEM (PR #698 review, round 2).
     *
     * That arm asserts these six never cross the boundary — but the fixture
     * held none of them, so `getUserDetails`' explicit projection regressing to
     * `user: { ...user }` would have left every key coming from a clean
     * fixture and all six assertions green. It could only ever have caught
     * someone writing `passwordHash: user.passwordHash` deliberately, which is
     * not how `passwordHash` reached `auth.me`.
     *
     * With them seeded, a spread LEAKS them and the arm reddens — driven, not
     * argued. This is the very class this file was repaired for, surviving in
     * the one arm the rewrite kept verbatim.
     */
    passwordHash: "seeded-forbidden-hash",
    apiKey: "seeded-forbidden-key",
    stripeCustomerId: "cus_seededforbidden",
    masterPrompt: "seeded forbidden master prompt",
    technicalSchema: { seeded: "forbidden" },
    preferences: { seeded: "forbidden" },
  }),
  getBlockedIps: vi.fn().mockResolvedValue({
    ips: [
      {
        id: 1,
        ipAddress: "10.0.0.1",
        reason: "Brute force",
        blockedBy: 1,
        expiresAt: null,
        createdAt: new Date("2026-01-10"),
      },
    ],
    total: 1,
  }),
  /*
   * Mirrors `listAllUsers`' OWN select (`server/db/admin.ts`) field for field,
   * plus the forbidden six seeded on top - the #700 shape. A short fixture
   * would let the router drop a real field with nothing going red, and an
   * unseeded one would let a spread regression pass (the PR #698 round-2
   * lesson, one procedure along).
   */
  listAllUsers: vi.fn().mockResolvedValue({
    users: [
      {
        id: 42,
        openId: "open-42",
        name: "Test User",
        email: "test@example.com",
        avatarUrl: "https://example.test/a.png",
        role: "user",
        suspendedAt: null,
        suspendedReason: null,
        /* Seeded NON-NULL on purpose (PR #701 review, finding 3): this surface
           passes `frozenAt` through RAW while the admin one converts it to ISO,
           and at `null` those two are the same value — so the divergence, and
           any silent convergence, would have been invisible to every arm. */
        frozenAt: new Date("2026-02-01"),
        lockedUntil: null,
        createdAt: new Date("2025-06-01"),
        lastSignedIn: new Date("2026-01-15"),
        passwordHash: "seeded-forbidden-hash",
        apiKey: "seeded-forbidden-key",
        stripeCustomerId: "cus_seededforbidden",
        masterPrompt: "seeded forbidden master prompt",
        technicalSchema: { seeded: "forbidden" },
        preferences: { seeded: "forbidden" },
      },
    ],
    total: 1,
  }),
  /* Mirrors `getUserFullDetails`' own returned object, forbidden six seeded. */
  getUserFullDetails: vi.fn().mockResolvedValue({
    user: {
      id: 42,
      openId: "open-42",
      name: "Test User",
      displayName: "Testy",
      email: "test@example.com",
      avatarUrl: "https://example.test/a.png",
      bannerUrl: null,
      bio: null,
      role: "user",
      storageUsed: 1024,
      storageLimit: 104857600,
      suspendedAt: null,
      suspendedReason: null,
      suspendedBy: null,
      frozenAt: new Date("2026-02-01"),
      frozenReason: null,
      frozenBy: null,
      lockedUntil: null,
      failedLoginAttempts: 0,
      createdAt: new Date("2025-06-01"),
      lastSignedIn: new Date("2026-01-15"),
      passwordHash: "seeded-forbidden-hash",
      apiKey: "seeded-forbidden-key",
      stripeCustomerId: "cus_seededforbidden",
      masterPrompt: "seeded forbidden master prompt",
      technicalSchema: { seeded: "forbidden" },
      preferences: { seeded: "forbidden" },
    },
    credits: { balance: 100 },
    stats: { totalModels: 5, totalGenerations: 50 },
  }),
  getUserCredits: vi.fn().mockResolvedValue({ balance: 100 }),
  getUserStatistics: vi.fn().mockResolvedValue({
    totalUsers: 100,
    activeUsers: 80,
    suspendedUsers: 5,
  }),
  getDetailedCreditHistory: vi.fn().mockResolvedValue({ transactions: [], total: 0 }),
  getDetailedGenerationHistory: vi.fn().mockResolvedValue({ generations: [], total: 0 }),
  getFlaggedReferrals: vi.fn().mockResolvedValue({ items: [], total: 0 }),
}));

/*
 * The three callers every arm below uses. `suspendedAt: null` is part of the
 * fixture rather than an afterthought — `moderatorProcedure` checks the role
 * FIRST and the suspension SECOND, so a context missing the field would pass
 * the role arms for the wrong reason.
 */
const MODERATOR = { id: 10, role: "moderator", suspendedAt: null };
const ADMIN = { id: 1, role: "admin", suspendedAt: null };
const PLAIN_USER = { id: 42, role: "user", suspendedAt: null };

function callerFor(user: unknown) {
  return moderatorRouter.createCaller({ user } as never);
}

/*
 * What a mocked reader was HANDED, with a population control on the way past.
 *
 * ⚠ The difference between this and the shape this file was repaired for is
 * WHO CALLED IT. Every use below drives a real procedure first and then reads
 * the argument the ROUTER passed on — the mock is the far end of the product,
 * not the subject. An arm that calls the reader itself and asserts its own
 * argument is the defect; `expect(calls.length).toBe(1)` is what keeps the two
 * apart, because a procedure that never reached its reader has ZERO calls and
 * would otherwise read as agreement.
 */
function soleCallTo(fn: unknown): Record<string, unknown> {
  const { calls } = (fn as { mock: { calls: unknown[][] } }).mock;
  if (calls.length !== 1) {
    throw new Error(`expected the procedure to reach its reader exactly once, saw ${calls.length}`);
  }
  return calls[0][0] as Record<string, unknown>;
}

/* The same control for a reader taking more than one argument — the credit and
   generation histories pass the userId FIRST and the filters second, and an
   arm that only looked at the filters could not see the id go wrong. */
function soleCallArgsTo(fn: unknown): unknown[] {
  const { calls } = (fn as { mock: { calls: unknown[][] } }).mock;
  if (calls.length !== 1) {
    throw new Error(`expected the procedure to reach its reader exactly once, saw ${calls.length}`);
  }
  return calls[0];
}

/*
 * ⚠ THE REFUSALS ARE NOT HERE, ON PURPOSE. A plain user, an unauthenticated
 * caller and a SUSPENDED moderator are each driven against this same
 * middleware in `changeRequests.test.ts` ("Security Boundaries (DRIVEN
 * through the real procedures)"), with a live moderator as the positive
 * control. Re-driving them here would be a second copy of a source of truth —
 * working law 4, and the exact habit this file was repaired for.
 *
 * What is here is the half NOTHING in the tree drove: an ADMIN. Measured
 * before writing — every `moderatorRouter.createCaller` in the repository
 * passed a moderator, a plain user, or null. The capability grid's footnote 1
 * (*"Admins pass the moderator middleware, so they inherit the entire
 * moderator surface"*) is a stated product commitment, and the only thing
 * standing for it was `expect("admin" === "moderator" || "admin" === "admin")`.
 */
describe("Moderator Role — the middleware's ADMIN half, DRIVEN", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("an ADMIN is allowed through moderatorProcedure — the capability grid's footnote, driven not recited", async () => {
    await expect(callerFor(ADMIN).getAuditStats()).resolves.toBeDefined();
  });

  it("a plain user is REFUSED that same procedure — the control that makes the arm above mean something", async () => {
    await expect(callerFor(PLAIN_USER).getAuditStats()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

/*
 * ⚠ NOTHING IN THIS REPOSITORY DROVE A SINGLE MODERATOR READ PROCEDURE.
 * `getAuditLogs`, `getAuditStats`, `getAbuseAlerts`, `getUserActivity`,
 * `listUsers`, `listBlockedIPs` and `getUserFullDetails` had zero driven
 * callers anywhere; fourteen arms that called the mocked readers themselves
 * stood in for all of them, and every one would have survived the deletion of
 * the procedure it was named after.
 *
 * These are the router's own translations — the work it does BETWEEN the
 * panel and the reader, which is the only part of a read path that can be
 * wrong: `all` collapsing to no filter, a date string becoming a `Date`, a
 * `Date` becoming an ISO string, and its own page sizes.
 */
describe("Moderator Role — the read surface, DRIVEN through the router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAuditLogs", () => {
    it("`all` is a filter word, not a severity — the router sends NO severity for it", async () => {
      const { getFilteredAuditLogs } = await import("./auditLog");
      await callerFor(MODERATOR).getAuditLogs({ severity: "all" });
      expect(soleCallTo(getFilteredAuditLogs).severity).toBeUndefined();
    });

    it("a real severity travels whole", async () => {
      const { getFilteredAuditLogs } = await import("./auditLog");
      await callerFor(MODERATOR).getAuditLogs({ severity: "warning" });
      expect(soleCallTo(getFilteredAuditLogs).severity).toBe("warning");
    });

    it("`all` is a filter word for the category too", async () => {
      const { getFilteredAuditLogs } = await import("./auditLog");
      await callerFor(MODERATOR).getAuditLogs({ actionCategory: "all" });
      expect(soleCallTo(getFilteredAuditLogs).actionCategory).toBeUndefined();
    });

    it("a real category travels whole", async () => {
      const { getFilteredAuditLogs } = await import("./auditLog");
      await callerFor(MODERATOR).getAuditLogs({ actionCategory: "abuse" });
      expect(soleCallTo(getFilteredAuditLogs).actionCategory).toBe("abuse");
    });

    it("a userId filter travels whole", async () => {
      const { getFilteredAuditLogs } = await import("./auditLog");
      await callerFor(MODERATOR).getAuditLogs({ userId: 42 });
      expect(soleCallTo(getFilteredAuditLogs).userId).toBe(42);
    });

    it("the date STRINGS the panel sends become real Dates on the way to the reader", async () => {
      const { getFilteredAuditLogs } = await import("./auditLog");
      await callerFor(MODERATOR).getAuditLogs({
        startDate: "2026-01-01T00:00:00.000Z",
        endDate: "2026-02-01T00:00:00.000Z",
      });
      const sent = soleCallTo(getFilteredAuditLogs);
      expect(sent.startDate).toBeInstanceOf(Date);
      expect((sent.startDate as Date).toISOString()).toBe("2026-01-01T00:00:00.000Z");
      expect(sent.endDate).toBeInstanceOf(Date);
      expect((sent.endDate as Date).toISOString()).toBe("2026-02-01T00:00:00.000Z");
    });

    it("no dates asked for means NONE sent — never an Invalid Date, which reads as a filter", async () => {
      const { getFilteredAuditLogs } = await import("./auditLog");
      await callerFor(MODERATOR).getAuditLogs({});
      const sent = soleCallTo(getFilteredAuditLogs);
      expect(sent.startDate).toBeUndefined();
      expect(sent.endDate).toBeUndefined();
    });

    it("asked for nothing at all, the router's own page size is what reaches the reader", async () => {
      const { getFilteredAuditLogs } = await import("./auditLog");
      await callerFor(MODERATOR).getAuditLogs();
      const sent = soleCallTo(getFilteredAuditLogs);
      expect(sent.limit).toBe(20);
      expect(sent.offset).toBe(0);
    });
  });

  describe("getUserActivity", () => {
    it("the userId asked for reaches the reader, with this procedure's own page size of 50", async () => {
      const { getFilteredAuditLogs } = await import("./auditLog");
      await callerFor(MODERATOR).getUserActivity({ userId: 42 });
      const sent = soleCallTo(getFilteredAuditLogs);
      expect(sent.userId).toBe(42);
      expect(sent.limit).toBe(50);
      expect(sent.offset).toBe(0);
    });
  });

  describe("getAbuseAlerts", () => {
    it("asked for nothing, the router's own default of 10 reaches the summary reader", async () => {
      const { getAbuseAlertsSummary } = await import("./auditLog");
      await callerFor(MODERATOR).getAbuseAlerts();
      expect(getAbuseAlertsSummary).toHaveBeenCalledWith(10);
    });

    it("an asked-for limit replaces it", async () => {
      const { getAbuseAlertsSummary } = await import("./auditLog");
      await callerFor(MODERATOR).getAbuseAlerts({ limit: 25 });
      expect(getAbuseAlertsSummary).toHaveBeenCalledWith(25);
    });
  });

  describe("getUserDetails", () => {
    it("a user who does not exist comes back as NULL — not an error, not an empty shell", async () => {
      const { getUserById } = await import("./db");
      /* Fixture control, not the subject: the reader is posed so the ROUTER's
         own `if (!user) return null` branch can be driven. The assertion is on
         what the router RETURNED. */
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      await expect(callerFor(MODERATOR).getUserDetails({ userId: 99999 })).resolves.toBeNull();
    });
  });

  describe("listUsers", () => {
    it("a search term reaches the db helper", async () => {
      const { listAllUsers } = await import("./db");
      await callerFor(MODERATOR).listUsers({ search: "test" });
      expect(soleCallTo(listAllUsers).search).toBe("test");
    });

    it("no search term sends none, and the router's own defaults go with it", async () => {
      const { listAllUsers } = await import("./db");
      await callerFor(MODERATOR).listUsers();
      const sent = soleCallTo(listAllUsers);
      expect(sent.search).toBeUndefined();
      expect(sent.limit).toBe(20);
      expect(sent.offset).toBe(0);
      expect(sent.status).toBe("all");
      expect(sent.role).toBe("all");
      expect(sent.sortBy).toBe("createdAt");
      expect(sent.sortOrder).toBe("desc");
    });

    it("the dates cross the boundary as ISO STRINGS — a Date would reach the panel as something else", async () => {
      const result = await callerFor(MODERATOR).listUsers();
      expect(result.users[0].createdAt).toBe("2025-06-01T00:00:00.000Z");
      expect(result.users[0].lastSignedIn).toBe("2026-01-15T00:00:00.000Z");
      expect(result.users[0].suspendedAt).toBeNull();
      expect(result.total).toBe(1);
    });

    it("the projection the ROUTER builds, whole — invariant 8, and the fixture holds the forbidden six so it can fail", async () => {
      const result = await callerFor(MODERATOR).listUsers();
      /*
       * #700. The row this reads comes from a fixture seeded with
       * passwordHash/apiKey/stripeCustomerId/masterPrompt/technicalSchema/
       * preferences, so a router that SPREADS the row puts all six on a staff
       * wire and this reddens. Asserted whole rather than six `not.toContain`
       * checks: a field added to the helper's select upstream must redden here
       * too, which is the half a forbidden-list can never see.
       */
      expect(result.users[0]).toEqual({
        id: 42,
        openId: "open-42",
        name: "Test User",
        email: "test@example.com",
        avatarUrl: "https://example.test/a.png",
        role: "user",
        suspendedAt: null,
        suspendedReason: null,
        /* RAW Date, not ISO — this is what the moderator wire actually carries
           today, and the admin twin carries the same column as a STRING. The
           divergence is preserved deliberately (converging it is a wire-type
           change, filed separately); pinning it here is what makes either
           state provable instead of invisible. */
        frozenAt: new Date("2026-02-01"),
        lockedUntil: null,
        createdAt: "2025-06-01T00:00:00.000Z",
        lastSignedIn: "2026-01-15T00:00:00.000Z",
      });
    });
  });

  describe("listBlockedIPs", () => {
    it("the projection the ROUTER builds, whole — ISO dates, and a null expiry kept null", async () => {
      const result = await callerFor(MODERATOR).listBlockedIPs();
      /* Asserted WHOLE rather than field by field: this is a staff read path,
         and invariant 8 is about what crosses the boundary. A field added to
         the row upstream reddens here instead of arriving unnoticed. */
      expect(result.ips[0]).toEqual({
        id: 1,
        ipAddress: "10.0.0.1",
        reason: "Brute force",
        blockedBy: 1,
        expiresAt: null,
        createdAt: "2026-01-10T00:00:00.000Z",
      });
      expect(result.total).toBe(1);
    });
  });

  describe("getUserFullDetails", () => {
    it("a user who does not exist comes back as NULL", async () => {
      const { getUserFullDetails } = await import("./db");
      (getUserFullDetails as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      await expect(
        callerFor(MODERATOR).getUserFullDetails({ userId: 99999 }),
      ).resolves.toBeNull();
    });

    it("the dates cross as ISO strings, and the credits and stats ride along untouched", async () => {
      const result = await callerFor(MODERATOR).getUserFullDetails({ userId: 42 });
      expect(result).not.toBeNull();
      expect(result!.user.createdAt).toBe("2025-06-01T00:00:00.000Z");
      expect(result!.user.lastSignedIn).toBe("2026-01-15T00:00:00.000Z");
      expect(result!.user.suspendedAt).toBeNull();
      expect(result!.credits).toEqual({ balance: 100 });
      expect(result!.stats).toEqual({ totalModels: 5, totalGenerations: 50 });
    });

    it("the user projection the ROUTER builds, whole — invariant 8, forbidden six seeded", async () => {
      const result = await callerFor(MODERATOR).getUserFullDetails({ userId: 42 });
      expect(result).not.toBeNull();
      // #700, same reasoning as `listUsers` above — this is the deeper of the
      // two reads and the one a moderator opens to investigate an account.
      expect(result!.user).toEqual({
        id: 42,
        openId: "open-42",
        name: "Test User",
        displayName: "Testy",
        email: "test@example.com",
        avatarUrl: "https://example.test/a.png",
        bannerUrl: null,
        bio: null,
        role: "user",
        storageUsed: 1024,
        storageLimit: 104857600,
        suspendedAt: null,
        suspendedReason: null,
        suspendedBy: null,
        frozenAt: new Date("2026-02-01"), // raw here, ISO on the admin twin
        frozenReason: null,
        frozenBy: null,
        lockedUntil: null,
        failedLoginAttempts: 0,
        createdAt: "2025-06-01T00:00:00.000Z",
        lastSignedIn: "2026-01-15T00:00:00.000Z",
      });
    });
  });

  /*
   * ⚠ THE FIVE BELOW WERE THE REVIEWER'S FINDING ON THIS PR, AND IT WAS RIGHT.
   * The docblock above this describe said NOTHING drove a moderator read
   * procedure and then drove seven — while the router declares TWELVE reads.
   * The other five were neither driven nor named, so the file read as coverage
   * it did not have, which is the same sentence this whole repair was about.
   *
   * Two of them carry the EXACT translation shape driven above — `all`
   * collapsing to no filter, a date string becoming a `Date` — and one of
   * those two is the CREDITS read a staff member opens to investigate a
   * customer's complaint. Named rather than enumerated as a remainder,
   * because law 7's bar is fix or file, and these cost four arms.
   */
  describe("getUserCreditHistory — a CREDITS read, carrying the same translations", () => {
    it("`all` is a filter word, not a transaction type — the router sends none for it", async () => {
      const { getDetailedCreditHistory } = await import("./db");
      await callerFor(MODERATOR).getUserCreditHistory({ userId: 42, type: "all" });
      const [userId, options] = soleCallArgsTo(getDetailedCreditHistory);
      expect(userId).toBe(42);
      expect((options as Record<string, unknown>).type).toBeUndefined();
    });

    it("a real transaction type travels whole, and the dates become Dates", async () => {
      const { getDetailedCreditHistory } = await import("./db");
      await callerFor(MODERATOR).getUserCreditHistory({
        userId: 42,
        type: "topup",
        startDate: "2026-01-01T00:00:00.000Z",
      });
      const sent = soleCallArgsTo(getDetailedCreditHistory)[1] as Record<string, unknown>;
      expect(sent.type).toBe("topup");
      expect(sent.startDate).toBeInstanceOf(Date);
      expect((sent.startDate as Date).toISOString()).toBe("2026-01-01T00:00:00.000Z");
      expect(sent.endDate).toBeUndefined();
      expect(sent.limit).toBe(50);
    });
  });

  describe("getUserGenerationHistory — two `all`s, both of which must collapse", () => {
    it("neither `all` reaches the reader as a filter", async () => {
      const { getDetailedGenerationHistory } = await import("./db");
      await callerFor(MODERATOR).getUserGenerationHistory({
        userId: 42,
        status: "all",
        type: "all",
      });
      const sent = soleCallArgsTo(getDetailedGenerationHistory)[1] as Record<string, unknown>;
      expect(sent.status).toBeUndefined();
      expect(sent.type).toBeUndefined();
    });

    it("a real status and a real type both travel whole", async () => {
      const { getDetailedGenerationHistory } = await import("./db");
      await callerFor(MODERATOR).getUserGenerationHistory({
        userId: 42,
        status: "failed",
        type: "castingImage",
      });
      const sent = soleCallArgsTo(getDetailedGenerationHistory)[1] as Record<string, unknown>;
      expect(sent.status).toBe("failed");
      expect(sent.type).toBe("castingImage");
    });
  });

  describe("getFlaggedReferrals", () => {
    it("the router's own defaults reach the reader when nothing is asked for", async () => {
      const { getFlaggedReferrals } = await import("./db");
      await callerFor(MODERATOR).getFlaggedReferrals();
      expect(getFlaggedReferrals).toHaveBeenCalledWith(50, 0);
    });
  });

  describe("getAuditLogById", () => {
    it("the id asked for is the id read — not a default, not the first row", async () => {
      const { getAuditLogById } = await import("./auditLog");
      await callerFor(MODERATOR).getAuditLogById({ id: 77 });
      expect(getAuditLogById).toHaveBeenCalledWith(77);
    });
  });

  describe("getUserStats", () => {
    it("the statistics reader is reached, and its answer is what comes back", async () => {
      const { getUserStatistics } = await import("./db");
      const result = await callerFor(MODERATOR).getUserStats();
      expect(getUserStatistics).toHaveBeenCalled();
      expect(result.totalUsers).toBe(100);
    });
  });
});

/*
 * ⚠ AND THIS IS THE ARM THAT KEEPS THE SENTENCE ABOVE TRUE TOMORROW.
 *
 * The claim "every read on this router is driven" is exactly the kind of
 * sentence that stops being true without anybody editing it — a new procedure
 * is added to the router and no test anywhere goes red. That is
 * `list-stops-being-the-list`, and it is what put two FICTIONAL procedure
 * names into a security describe in this suite's own history.
 *
 * So the population is DERIVED from the running router and compared against
 * what this file accounts for. Add a procedure tomorrow and this reddens until
 * someone drives it or names where it is driven.
 *
 * ⚠ WHAT IT CANNOT CATCH, said plainly rather than left to be assumed: it
 * compares NAMES. Listing a procedure below without actually driving it would
 * pass. It catches the drift that happens by accident — a surface growing —
 * not a deliberate untruth.
 */
describe("Moderator Role — every procedure on the router is accounted for, DERIVED", () => {
  /* Driven by an arm in THIS file, above. */
  const DRIVEN_HERE = [
    "getAuditLogs", "getAbuseAlerts", "getAuditStats", "getAuditLogById",
    "getUserDetails", "getUserActivity", "listBlockedIPs", "listUsers",
    "getUserFullDetails", "getUserStats", "getUserCreditHistory",
    "getUserGenerationHistory", "getFlaggedReferrals",
  ];

  /* Driven elsewhere, read at that file before being written here. */
  const DRIVEN_ELSEWHERE: Record<string, string> = {
    createChangeRequest:
      "changeRequests.test.ts — the db write, the audit row and the Slack note, plus the refusals",
    getMyChangeRequests:
      "changeRequests.test.ts — the session's moderator id reaching the db helper, and the status filter",
  };

  it("no procedure on the moderator router is unaccounted for", () => {
    const surface = Object.keys(
      (moderatorRouter as unknown as { _def: { procedures: Record<string, unknown> } })._def
        .procedures,
    );
    expect(surface.length).toBeGreaterThan(0);
    const accounted = new Set([...DRIVEN_HERE, ...Object.keys(DRIVEN_ELSEWHERE)]);
    expect(surface.filter((name) => !accounted.has(name)).sort()).toEqual([]);
  });

  it("and nothing is accounted for that the router does not have — the list cannot outlive the surface", () => {
    const surface = new Set(
      Object.keys(
        (moderatorRouter as unknown as { _def: { procedures: Record<string, unknown> } })._def
          .procedures,
      ),
    );
    const fictional = [...DRIVEN_HERE, ...Object.keys(DRIVEN_ELSEWHERE)].filter(
      (name) => !surface.has(name),
    );
    expect(fictional.sort()).toEqual([]);
  });
});

/*
 * ⚠ THIS DESCRIBE USED TO ASSERT DRAPE'S ACCESS CONTROL AGAINST ARRAYS IT
 * TYPED ON THE LINE ABOVE, and it was called "Security Boundaries" while
 * doing it. Verbatim, the shape of all three arms:
 *
 *     const moderatorWriteOperations = ["createChangeRequest"];
 *     adminOnlyOperations.forEach(op =>
 *       expect(moderatorWriteOperations).not.toContain(op));
 *
 * That asserts a literal against itself. Add `suspendUser` to the moderator
 * router tomorrow and it stays green — which is the capability grid's
 * moderator row with no test that BLOCKS (invariant 7).
 *
 * ⚠ AND IT HAD ALREADY DRIFTED, WHICH IS THE SPECIMEN WORTH KEEPING. The
 * sibling list in `changeRequests.test.ts` named SEVEN procedures where the
 * router holds FIFTEEN, and **two of its seven do not exist**:
 * `getAuditStatistics` (the router has `getAuditStats`) and `getBlockedIps`
 * (the router has `listBlockedIPs`). Two fictional procedure names sat in a
 * security describe, unassertable, because nothing ever compared the list to
 * the thing it named. `list-stops-being-the-list`, on the security surface.
 *
 * Every arm below now DERIVES its population from the running router —
 * `moderatorRouter._def.procedures`, the same technique `wardrobe.test.ts`
 * uses for schemas. No list is typed here that the code does not state.
 *
 * The product was verified correct at the router when these were written
 * (2026-08-25): createChangeRequest is the only mutation, review and list are
 * `adminProcedure` in `routes/admin/changeRequests.ts`, and
 * `getMyChangeRequests` scopes on `ctx.user.id`. These arms exist for the day
 * that stops being true.
 */
describe("Moderator Role - Security Boundaries (DERIVED from the running router)", () => {
  type ProcedureDef = { _def: { type?: string } };

  function moderatorSurface(): Record<string, ProcedureDef> {
    const procedures = (moderatorRouter as unknown as {
      _def: { procedures: Record<string, ProcedureDef> };
    })._def.procedures;
    const names = Object.keys(procedures);
    // Population control: a reader that reads nothing agrees with everything.
    if (names.length === 0) throw new Error("read no procedures off moderatorRouter");
    return procedures;
  }

  function namesOfType(type: "mutation" | "query"): string[] {
    return Object.entries(moderatorSurface())
      .filter(([, p]) => p._def.type === type)
      .map(([name]) => name)
      .sort();
  }

  it("has exactly ONE write operation and it is createChangeRequest", () => {
    expect(namesOfType("mutation")).toEqual(["createChangeRequest"]);
  });

  it("carries none of the admin-only write operations — asked of the ROUTER, not of a list", () => {
    const surface = Object.keys(moderatorSurface());
    for (const adminOnly of [
      "suspendUser", "unsuspendUser", "blockIP", "unblockIP",
      "adjustCredits", "exportAuditLogs", "deleteAuditLogs",
      "reviewChangeRequest", "listChangeRequests",
    ]) {
      expect(surface).not.toContain(adminOnly);
    }
  });

  it("every procedure it does carry is a read, save that one write", () => {
    const surface = Object.keys(moderatorSurface()).sort();
    // Derived, not typed: queries + the one mutation must account for ALL of
    // them, so a procedure declared with neither type cannot hide here.
    expect([...namesOfType("query"), ...namesOfType("mutation")].sort()).toEqual(surface);
  });

  it("getUserDetails hands back the projection the ROUTER builds, driven not recited", async () => {
    const caller = moderatorRouter.createCaller({
      user: { id: 10, role: "moderator", suspendedAt: null },
    } as never);
    const result = await caller.getUserDetails({ userId: 42 });
    const user = (result as { user: Record<string, unknown> }).user;

    // Invariant 8 — an explicit projection, proven on what CROSSES the
    // boundary rather than on a list of what we hope it contains.
    for (const forbidden of [
      "passwordHash", "apiKey", "stripeCustomerId", "masterPrompt",
      "technicalSchema", "preferences",
    ]) {
      expect(Object.keys(user)).not.toContain(forbidden);
    }
    // Positive control: the arm above passes trivially if the call returned
    // an empty object, so pin that it actually carried the user through.
    expect(user.id).toBe(42);
    expect(user.email).toBe("test@example.com");
  });
});

/*
 * ⚠ THREE ARMS HERE RECITED THE ROLE VOCABULARY AT ITSELF —
 *     expect(["user", "admin", "moderator"]).toContain("moderator");
 *     expect("moderator").not.toBe("admin");
 *     expect("moderator").not.toBe("user");
 * — under the heading "Database Schema", while touching no schema. Drop
 * `moderator` from the column tomorrow and all three stay green.
 *
 * One arm replaces them, read off the column the product actually declares.
 */
describe("Moderator Role — the role vocabulary, DERIVED from the schema", () => {
  it("the users table's role column declares the moderator role — read off the column, not recited", () => {
    expect(users.role.enumValues).toEqual(["user", "admin", "moderator"]);
  });
});
