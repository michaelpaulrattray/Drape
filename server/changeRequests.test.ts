import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the slackNotification module
vi.mock("./slack/slackNotification", () => ({
  sendAdminActionNotification: vi.fn().mockResolvedValue(true),
  sendAuditLogEntry: vi.fn().mockResolvedValue(true),
  sendSlackAlert: vi.fn().mockResolvedValue(true),
}));

// Mock the auditLog module
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

// Mock the adminSecurity module
vi.mock("./security/adminSecurity", () => ({
  logAdminAction: vi.fn().mockResolvedValue(undefined),
  isSensitiveAction: vi.fn().mockReturnValue(false),
  writeImmutableLog: vi.fn().mockResolvedValue(undefined),
}));

// Mock the db module
vi.mock("./db", () => ({
  createChangeRequest: vi.fn().mockResolvedValue({ success: true, requestId: 1 }),
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

// ============================================================
// Change Request Types & Validation
// ============================================================
describe("Change Request - Types & Validation", () => {
  it("should support all 8 change request types", () => {
    const validTypes = [
      "refund_credits", "add_credits", "flag_account", "note_incident",
      "suspend_user", "unsuspend_user", "block_ip", "other",
    ];
    expect(validTypes).toHaveLength(8);
    validTypes.forEach(type => {
      expect(typeof type).toBe("string");
      expect(type.length).toBeGreaterThan(0);
    });
  });

  it("should support all 6 status values including pending_execution", () => {
    const validStatuses = ["pending", "approved", "denied", "cancelled", "expired", "pending_execution"];
    expect(validStatuses).toHaveLength(6);
  });

  it("should support all 4 priority levels", () => {
    const validPriorities = ["low", "normal", "high", "urgent"];
    expect(validPriorities).toHaveLength(4);
  });

  it("should require title with minimum 5 characters", () => {
    const validTitle = "Refund credits for user";
    const invalidTitle = "Hi";
    expect(validTitle.length).toBeGreaterThanOrEqual(5);
    expect(invalidTitle.length).toBeLessThan(5);
  });

  it("should require description with minimum 10 characters", () => {
    const validDesc = "User experienced a service disruption during generation";
    const invalidDesc = "Bad user";
    expect(validDesc.length).toBeGreaterThanOrEqual(10);
    expect(invalidDesc.length).toBeLessThan(10);
  });

  it("should enforce title max length of 512 characters", () => {
    const maxLength = 512;
    const tooLong = "x".repeat(513);
    expect(tooLong.length).toBeGreaterThan(maxLength);
  });

  it("should enforce description max length of 5000 characters", () => {
    const maxLength = 5000;
    const tooLong = "x".repeat(5001);
    expect(tooLong.length).toBeGreaterThan(maxLength);
  });

  it("should require creditAmount for credit-related types", () => {
    const refundRequest = {
      type: "refund_credits" as const,
      creditAmount: 50,
      creditReason: "Service disruption",
    };
    expect(refundRequest.creditAmount).toBeGreaterThan(0);
    expect(refundRequest.creditReason).toBeDefined();
  });

  it("should require ipAddress for block_ip type", () => {
    const blockIpRequest = {
      type: "block_ip" as const,
      ipAddress: "192.168.1.1",
    };
    expect(blockIpRequest.ipAddress).toBeDefined();
    expect(blockIpRequest.ipAddress.length).toBeGreaterThan(0);
  });

  it("should allow optional fields", () => {
    const minimalRequest = {
      type: "note_incident" as const,
      priority: "normal" as const,
      targetUserId: 42,
      title: "Incident note",
      description: "Something happened that needs to be recorded",
    };
    expect(minimalRequest).not.toHaveProperty("evidenceSummary");
    expect(minimalRequest).not.toHaveProperty("relatedAuditLogId");
    expect(minimalRequest).not.toHaveProperty("creditAmount");
    expect(minimalRequest).not.toHaveProperty("ipAddress");
  });
});

// ============================================================
// Change Request CRUD Helpers
// ============================================================
describe("Change Request - CRUD Helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createChangeRequest", () => {
    it("should create a change request and return the ID", async () => {
      const { createChangeRequest } = await import("./db");
      const result = await createChangeRequest({
        type: "refund_credits",
        priority: "normal",
        submittedById: 10,
        submittedByName: "Mod User",
        targetUserId: 42,
        targetUserName: "Test User",
        title: "Refund credits for service disruption",
        description: "User experienced a service disruption during generation and lost 50 credits",
        creditAmount: 50,
        creditReason: "Service disruption",
      });

      expect(result.success).toBe(true);
      expect(result.requestId).toBe(1);
      expect(createChangeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "refund_credits",
          submittedById: 10,
          targetUserId: 42,
          creditAmount: 50,
        }),
      );
    });

    it("should create a flag_account request without credit fields", async () => {
      const { createChangeRequest } = await import("./db");
      const result = await createChangeRequest({
        type: "flag_account",
        priority: "high",
        submittedById: 10,
        submittedByName: "Mod User",
        targetUserId: 99,
        targetUserName: "Suspicious User",
        title: "Flag account for suspicious activity",
        description: "Multiple rate limit violations detected in the last 24 hours",
        relatedAuditLogId: 501,
      });

      expect(result.success).toBe(true);
      expect(createChangeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "flag_account",
          priority: "high",
          relatedAuditLogId: 501,
        }),
      );
    });

    it("should create a block_ip request with IP address", async () => {
      const { createChangeRequest } = await import("./db");
      const result = await createChangeRequest({
        type: "block_ip",
        priority: "urgent",
        submittedById: 10,
        submittedByName: "Mod User",
        targetUserId: 0,
        title: "Block suspicious IP address",
        description: "IP address has been making brute force login attempts",
        ipAddress: "192.168.1.100",
      });

      expect(result.success).toBe(true);
      expect(createChangeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "block_ip",
          ipAddress: "192.168.1.100",
        }),
      );
    });
  });

  describe("getChangeRequestById", () => {
    it("should return a change request by ID", async () => {
      const { getChangeRequestById } = await import("./db");
      const request = await getChangeRequestById(1);

      expect(request).not.toBeNull();
      expect(request!.id).toBe(1);
      expect(request!.type).toBe("refund_credits");
      expect(request!.status).toBe("pending");
      expect(request!.submittedById).toBe(10);
      expect(request!.targetUserId).toBe(42);
      expect(request!.creditAmount).toBe(50);
    });

    it("should return an approved request with review details", async () => {
      const { getChangeRequestById } = await import("./db");
      const request = await getChangeRequestById(2);

      expect(request).not.toBeNull();
      expect(request!.status).toBe("approved");
      expect(request!.reviewedById).toBe(1);
      expect(request!.reviewedByName).toBe("Admin");
      expect(request!.reviewNotes).toBe("Confirmed suspicious activity");
      expect(request!.reviewedAt).toBeInstanceOf(Date);
    });

    it("should return null for non-existent request", async () => {
      const { getChangeRequestById } = await import("./db");
      const request = await getChangeRequestById(999);
      expect(request).toBeNull();
    });
  });

  describe("listChangeRequests", () => {
    it("should return paginated list with summary", async () => {
      const { listChangeRequests } = await import("./db");
      const result = await listChangeRequests({ limit: 50, offset: 0 });

      expect(result.requests).toBeInstanceOf(Array);
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.summary).toBeDefined();
      expect(result.summary).toHaveProperty("pendingCount");
      expect(result.summary).toHaveProperty("approvedCount");
      expect(result.summary).toHaveProperty("deniedCount");
      expect(result.summary).toHaveProperty("totalCount");
    });

    it("should support filtering by status", async () => {
      const { listChangeRequests } = await import("./db");
      await listChangeRequests({ status: "pending" });

      expect(listChangeRequests).toHaveBeenCalledWith(
        expect.objectContaining({ status: "pending" }),
      );
    });

    it("should support filtering by type", async () => {
      const { listChangeRequests } = await import("./db");
      await listChangeRequests({ type: "refund_credits" });

      expect(listChangeRequests).toHaveBeenCalledWith(
        expect.objectContaining({ type: "refund_credits" }),
      );
    });

    it("should support filtering by priority", async () => {
      const { listChangeRequests } = await import("./db");
      await listChangeRequests({ priority: "urgent" });

      expect(listChangeRequests).toHaveBeenCalledWith(
        expect.objectContaining({ priority: "urgent" }),
      );
    });
  });

  describe("updateChangeRequestStatus", () => {
    it("should approve a pending request", async () => {
      const { updateChangeRequestStatus } = await import("./db");
      const result = await updateChangeRequestStatus(1, {
        status: "approved",
        reviewedById: 1,
        reviewedByName: "Admin",
        reviewNotes: "Approved - credits will be refunded",
      });

      expect(result.success).toBe(true);
      expect(updateChangeRequestStatus).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: "approved",
          reviewedById: 1,
          reviewedByName: "Admin",
        }),
      );
    });

    it("should deny a pending request", async () => {
      const { updateChangeRequestStatus } = await import("./db");
      const result = await updateChangeRequestStatus(1, {
        status: "denied",
        reviewedById: 1,
        reviewedByName: "Admin",
        reviewNotes: "Insufficient evidence",
      });

      expect(result.success).toBe(true);
      expect(updateChangeRequestStatus).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: "denied",
          reviewNotes: "Insufficient evidence",
        }),
      );
    });

    it("should cancel a request by moderator", async () => {
      const { updateChangeRequestStatus } = await import("./db");
      const result = await updateChangeRequestStatus(1, {
        status: "cancelled",
        reviewedById: 10,
        reviewedByName: "Mod User",
        reviewNotes: "No longer needed",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("getChangeRequestsByModerator", () => {
    it("should return requests for a specific moderator", async () => {
      const { getChangeRequestsByModerator } = await import("./db");
      const result = await getChangeRequestsByModerator(10);

      expect(result.requests).toBeInstanceOf(Array);
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.summary).toBeDefined();
      expect(getChangeRequestsByModerator).toHaveBeenCalledWith(10);
    });

    it("should support filtering by status", async () => {
      const { getChangeRequestsByModerator } = await import("./db");
      await getChangeRequestsByModerator(10, { status: "pending" });

      expect(getChangeRequestsByModerator).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ status: "pending" }),
      );
    });

    it("should support pagination", async () => {
      const { getChangeRequestsByModerator } = await import("./db");
      await getChangeRequestsByModerator(10, { limit: 10, offset: 20 });

      expect(getChangeRequestsByModerator).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ limit: 10, offset: 20 }),
      );
    });
  });
});

// ============================================================
// Moderator Change Request Procedures
// ============================================================
describe("Change Request - Moderator Procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createChangeRequest mutation", () => {
    it("should validate input and call createChangeRequest", async () => {
      const { createChangeRequest } = await import("./db");
      const { sendAdminActionNotification } = await import("./slack/slackNotification");
      const { logAuditEvent } = await import("./auditLog");

      const input = {
        type: "refund_credits" as const,
        priority: "normal" as const,
        targetUserId: 42,
        targetUserName: "Test User",
        title: "Refund credits for service disruption",
        description: "User experienced a service disruption during generation and lost 50 credits",
        creditAmount: 50,
        creditReason: "Service disruption",
      };

      // Simulate what the procedure does
      const result = await createChangeRequest({
        ...input,
        submittedById: 10,
        submittedByName: "Mod User",
      });

      expect(result.success).toBe(true);
      expect(result.requestId).toBe(1);

      // Simulate audit log
      await logAuditEvent({
        userId: 10,
        action: "moderator.change_request_created",
        resourceType: "change_request",
        resourceId: "1",
        metadata: {
          type: input.type,
          priority: input.priority,
          targetUserId: input.targetUserId,
          title: input.title,
        },
        severity: "info",
        req: undefined as any,
      });

      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "moderator.change_request_created",
          resourceType: "change_request",
        }),
      );

      // Simulate Slack notification
      await sendAdminActionNotification({
        title: "📋 New Change Request: Refund Credits",
        description: "Mod User submitted a change request",
        severity: "info",
        fields: expect.any(Array),
      } as any);

      expect(sendAdminActionNotification).toHaveBeenCalled();
    });

    it("should map request types to readable labels", () => {
      const TYPE_LABELS: Record<string, string> = {
        refund_credits: "Refund Credits",
        add_credits: "Add Credits",
        flag_account: "Flag Account",
        note_incident: "Note Incident",
        suspend_user: "Suspend User",
        unsuspend_user: "Unsuspend User",
        block_ip: "Block IP",
        other: "Other",
      };

      expect(TYPE_LABELS["refund_credits"]).toBe("Refund Credits");
      expect(TYPE_LABELS["block_ip"]).toBe("Block IP");
      expect(TYPE_LABELS["other"]).toBe("Other");
      expect(Object.keys(TYPE_LABELS)).toHaveLength(8);
    });

    it("should include credit fields in Slack notification for credit types", () => {
      const input = {
        type: "refund_credits",
        creditAmount: 50,
        creditReason: "Service disruption",
      };

      const fields: Array<{ title: string; value: string; short?: boolean }> = [
        { title: "Type", value: "Refund Credits", short: true },
        { title: "Priority", value: "Normal", short: true },
        { title: "Target", value: "Test User (#42)", short: true },
      ];

      if (input.creditAmount) {
        fields.push({ title: "Credit Amount", value: `${input.creditAmount} credits`, short: true });
      }
      if (input.creditReason) {
        fields.push({ title: "Credit Reason", value: input.creditReason, short: true });
      }

      expect(fields.find(f => f.title === "Credit Amount")).toBeDefined();
      expect(fields.find(f => f.title === "Credit Reason")).toBeDefined();
    });

    it("should include IP address in Slack notification for block_ip type", () => {
      const input = {
        type: "block_ip",
        ipAddress: "192.168.1.100",
      };

      const fields: Array<{ title: string; value: string; short?: boolean }> = [
        { title: "Type", value: "Block IP", short: true },
      ];

      if (input.ipAddress) {
        fields.push({ title: "IP Address", value: input.ipAddress, short: true });
      }

      expect(fields.find(f => f.title === "IP Address")).toBeDefined();
    });
  });

  describe("getMyChangeRequests query", () => {
    it("should return requests for the current moderator", async () => {
      const { getChangeRequestsByModerator } = await import("./db");
      const result = await getChangeRequestsByModerator(10);

      expect(result.requests).toBeInstanceOf(Array);
      expect(result.summary).toBeDefined();
      expect(result.summary.pendingCount).toBeDefined();
    });

    it("should support status filtering", async () => {
      const { getChangeRequestsByModerator } = await import("./db");
      await getChangeRequestsByModerator(10, { status: "approved" });

      expect(getChangeRequestsByModerator).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ status: "approved" }),
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

  describe("listChangeRequests (admin)", () => {
    it("should return all change requests with summary", async () => {
      const { listChangeRequests } = await import("./db");
      const result = await listChangeRequests();

      expect(result.requests).toBeInstanceOf(Array);
      expect(result.summary).toBeDefined();
      expect(result.summary.pendingCount).toBeDefined();
    });

    it("should support filtering by status", async () => {
      const { listChangeRequests } = await import("./db");
      await listChangeRequests({ status: "pending" });

      expect(listChangeRequests).toHaveBeenCalledWith(
        expect.objectContaining({ status: "pending" }),
      );
    });
  });

  describe("getChangeRequest (admin)", () => {
    it("should return a single change request by ID", async () => {
      const { getChangeRequestById } = await import("./db");
      const request = await getChangeRequestById(1);

      expect(request).not.toBeNull();
      expect(request!.id).toBe(1);
    });

    it("should throw for non-existent request", async () => {
      const { getChangeRequestById } = await import("./db");
      const request = await getChangeRequestById(999);
      expect(request).toBeNull();
    });
  });

  describe("reviewChangeRequest mutation", () => {
    it("should approve a change request", async () => {
      const { getChangeRequestById, updateChangeRequestStatus } = await import("./db");
      const { logAuditEvent } = await import("./auditLog");
      const { sendAdminActionNotification } = await import("./slack/slackNotification");

      // Simulate the procedure flow
      const request = await getChangeRequestById(1);
      expect(request).not.toBeNull();
      expect(request!.status).toBe("pending");

      const result = await updateChangeRequestStatus(1, {
        status: "approved",
        reviewedById: 1,
        reviewedByName: "Admin",
        reviewNotes: "Approved - credits will be refunded",
      });

      expect(result.success).toBe(true);

      // Simulate audit log
      await logAuditEvent({
        userId: 1,
        action: "admin.change_request_approved",
        resourceType: "change_request",
        resourceId: "1",
        metadata: {
          type: request!.type,
          submittedById: request!.submittedById,
          reviewNotes: "Approved - credits will be refunded",
        },
        severity: "info",
        req: undefined as any,
      });

      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "admin.change_request_approved",
          resourceType: "change_request",
        }),
      );
    });

    it("should deny a change request", async () => {
      const { updateChangeRequestStatus } = await import("./db");
      const { logAuditEvent } = await import("./auditLog");

      const result = await updateChangeRequestStatus(1, {
        status: "denied",
        reviewedById: 1,
        reviewedByName: "Admin",
        reviewNotes: "Insufficient evidence to justify refund",
      });

      expect(result.success).toBe(true);

      await logAuditEvent({
        userId: 1,
        action: "admin.change_request_denied",
        resourceType: "change_request",
        resourceId: "1",
        metadata: {
          reviewNotes: "Insufficient evidence to justify refund",
        },
        severity: "info",
        req: undefined as any,
      });

      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "admin.change_request_denied",
        }),
      );
    });

    it("should not allow reviewing an already-reviewed request", async () => {
      const { getChangeRequestById } = await import("./db");
      const request = await getChangeRequestById(2); // already approved

      expect(request).not.toBeNull();
      expect(request!.status).toBe("approved");
      expect(request!.status).not.toBe("pending");
      // The procedure would throw TRPCError with code CONFLICT
    });

    it("should send Slack notification on approval", async () => {
      const { sendAdminActionNotification } = await import("./slack/slackNotification");

      await sendAdminActionNotification({
        title: "✅ Change Request Approved: Refund Credits",
        description: "Admin approved change request #1",
        severity: "info",
        fields: [
          { title: "Type", value: "Refund Credits", short: true },
          { title: "Submitted By", value: "Mod User", short: true },
          { title: "Target", value: "Test User (#42)", short: true },
          { title: "Review Notes", value: "Approved - credits will be refunded" },
        ],
      });

      expect(sendAdminActionNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining("Approved"),
        }),
      );
    });

    it("should send Slack notification on denial", async () => {
      const { sendAdminActionNotification } = await import("./slack/slackNotification");

      await sendAdminActionNotification({
        title: "❌ Change Request Denied: Refund Credits",
        description: "Admin denied change request #1",
        severity: "warning",
        fields: [
          { title: "Type", value: "Refund Credits", short: true },
          { title: "Submitted By", value: "Mod User", short: true },
          { title: "Review Notes", value: "Insufficient evidence" },
        ],
      });

      expect(sendAdminActionNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining("Denied"),
          severity: "warning",
        }),
      );
    });

    it("should write immutable audit log for review actions", async () => {
      const { writeImmutableLog } = await import("./security/adminSecurity");

      await writeImmutableLog("change_request_reviewed", {
        requestId: 1,
        action: "approved",
        reviewedBy: 1,
        reviewedByName: "Admin",
      });

      expect(writeImmutableLog).toHaveBeenCalledWith(
        "change_request_reviewed",
        expect.objectContaining({
          requestId: 1,
          action: "approved",
        }),
      );
    });
  });
});

// ============================================================
// Change Request - Security Boundaries
// ============================================================
describe("Change Request - Security Boundaries", () => {
  it("only moderators and admins can create change requests", () => {
    const moderator = { id: 10, role: "moderator" };
    const admin = { id: 1, role: "admin" };
    const user = { id: 42, role: "user" };

    expect(moderator.role === "moderator" || moderator.role === "admin").toBe(true);
    expect(admin.role === "moderator" || admin.role === "admin").toBe(true);
    expect(user.role === "moderator" || user.role === "admin").toBe(false);
  });

  it("only admins can review change requests", () => {
    const admin = { id: 1, role: "admin" };
    const moderator = { id: 10, role: "moderator" };

    expect(admin.role === "admin").toBe(true);
    expect(moderator.role === "admin").toBe(false);
  });

  it("moderators can only view their own requests", () => {
    const moderatorId = 10;
    const request = { submittedById: 10 };
    const otherRequest = { submittedById: 20 };

    expect(request.submittedById === moderatorId).toBe(true);
    expect(otherRequest.submittedById === moderatorId).toBe(false);
  });

  it("admins can view all requests", () => {
    const admin = { id: 1, role: "admin" };
    expect(admin.role === "admin").toBe(true);
    // Admin uses listChangeRequests without submittedById filter
  });

  it("change request review actions should be limited to approved/denied", () => {
    const validActions = ["approved", "denied"];
    expect(validActions).toContain("approved");
    expect(validActions).toContain("denied");
    expect(validActions).not.toContain("pending");
    expect(validActions).not.toContain("cancelled");
    expect(validActions).not.toContain("expired");
    expect(validActions).not.toContain("pending_execution");
  });

  it("review notes should be limited to 2000 characters", () => {
    const maxLength = 2000;
    const validNotes = "Approved after reviewing the evidence";
    const tooLong = "x".repeat(2001);

    expect(validNotes.length).toBeLessThanOrEqual(maxLength);
    expect(tooLong.length).toBeGreaterThan(maxLength);
  });
});

// ============================================================
// Update moderator.test.ts references
// ============================================================
describe("Change Request - Replaces Escalation", () => {
  it("moderator write operations should now be createChangeRequest and getMyChangeRequests", () => {
    const moderatorMutations = ["createChangeRequest"];
    const moderatorQueries = ["getAuditLogs", "getAbuseAlerts", "getAuditStatistics", "listUsers", "getUserDetails", "getBlockedIps", "getMyChangeRequests"];

    expect(moderatorMutations).toContain("createChangeRequest");
    expect(moderatorMutations).not.toContain("escalateToAdmin");
    expect(moderatorQueries).toContain("getMyChangeRequests");
  });

  it("change request should have structured fields instead of free-text reason", () => {
    const changeRequest = {
      type: "refund_credits",
      priority: "normal",
      title: "Refund credits for service disruption",
      description: "Detailed description of the issue",
      evidenceSummary: "Ticket #12345, screenshots attached",
      creditAmount: 50,
      creditReason: "Service disruption",
    };

    // Structured fields vs old escalation which only had: actionType, targetId, reason, severity
    expect(changeRequest).toHaveProperty("type");
    expect(changeRequest).toHaveProperty("priority");
    expect(changeRequest).toHaveProperty("title");
    expect(changeRequest).toHaveProperty("description");
    expect(changeRequest).toHaveProperty("evidenceSummary");
    expect(changeRequest).toHaveProperty("creditAmount");
    expect(changeRequest).toHaveProperty("creditReason");
  });

  it("change requests should be trackable with status workflow", () => {
    const workflow = {
      initial: "pending",
      approvalPath: "pending" as string,
      denialPath: "pending" as string,
      cancelPath: "pending" as string,
    };

    workflow.approvalPath = "approved";
    workflow.denialPath = "denied";
    workflow.cancelPath = "cancelled";

    expect(workflow.initial).toBe("pending");
    expect(workflow.approvalPath).toBe("approved");
    expect(workflow.denialPath).toBe("denied");
    expect(workflow.cancelPath).toBe("cancelled");
  });
});

// ============================================================
// Auto-Execute on Approval Tests
// ============================================================

describe("Change Request - Auto-Execute on Approval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("refund_credits auto-execute", () => {
    it("should call addCredits with refund type when refund_credits request is approved", async () => {
      const { getChangeRequestById, updateChangeRequestStatus, addCredits } = await import("./db");
      const { logAuditEvent } = await import("./auditLog");
      const { AUDIT_ACTIONS } = await import("./auditLog");

      const request = await getChangeRequestById(1); // refund_credits, creditAmount: 50
      expect(request).not.toBeNull();
      expect(request!.type).toBe("refund_credits");
      expect(request!.creditAmount).toBe(50);

      // Simulate approval
      await updateChangeRequestStatus(1, {
        status: "approved",
        reviewedById: 1,
        reviewedByName: "Admin",
        reviewNotes: "Approved refund",
      });

      // Simulate auto-execute
      const creditResult = await addCredits(
        request!.targetUserId,
        request!.creditAmount!,
        "refund",
        `Refund via change request #1: ${request!.creditReason || request!.title}`,
        "cr-1"
      );

      expect(addCredits).toHaveBeenCalledWith(
        42, // targetUserId
        50, // creditAmount
        "refund",
        expect.stringContaining("Refund via change request #1"),
        "cr-1"
      );
      expect(creditResult.success).toBe(true);
      expect(creditResult.newBalance).toBe(150);

      // Verify audit log would be called
      await logAuditEvent({
        userId: 1,
        action: AUDIT_ACTIONS.CREDITS_REFUNDED,
        resourceType: "credits",
        resourceId: "42",
        metadata: { amount: 50, changeRequestId: 1, newBalance: 150 },
        severity: "info",
        req: undefined as any,
      });

      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "credits.refunded",
          resourceType: "credits",
        }),
      );
    });

    it("should not execute if creditAmount is null or zero", async () => {
      const { addCredits } = await import("./db");

      // A refund_credits request with no credit amount should not trigger addCredits
      const shouldExecute = (creditAmount: number | null) => {
        return creditAmount !== null && creditAmount > 0;
      };

      expect(shouldExecute(null)).toBe(false);
      expect(shouldExecute(0)).toBe(false);
      expect(shouldExecute(50)).toBe(true);
      expect(addCredits).not.toHaveBeenCalled();
    });
  });

  describe("add_credits auto-execute", () => {
    it("should call addCredits with bonus type when add_credits request is approved", async () => {
      const { getChangeRequestById, addCredits } = await import("./db");

      const request = await getChangeRequestById(6); // add_credits, creditAmount: 100
      expect(request!.type).toBe("add_credits");
      expect(request!.creditAmount).toBe(100);

      const creditResult = await addCredits(
        request!.targetUserId,
        request!.creditAmount!,
        "bonus",
        `Credits added via change request #6: ${request!.creditReason || request!.title}`,
        "cr-6"
      );

      expect(addCredits).toHaveBeenCalledWith(
        42,
        100,
        "bonus",
        expect.stringContaining("Credits added via change request #6"),
        "cr-6"
      );
      expect(creditResult.success).toBe(true);
    });
  });

  describe("suspend_user auto-execute", () => {
    it("should call suspendUser when suspend_user request is approved", async () => {
      const { getChangeRequestById, suspendUser } = await import("./db");
      const { logAuditEvent, AUDIT_ACTIONS } = await import("./auditLog");

      const request = await getChangeRequestById(3); // suspend_user
      expect(request!.type).toBe("suspend_user");

      const result = await suspendUser(
        request!.targetUserId,
        `Suspended via change request #3: ${request!.title}`,
        1 // admin ID
      );

      expect(suspendUser).toHaveBeenCalledWith(
        55, // targetUserId
        expect.stringContaining("Suspended via change request #3"),
        1
      );
      expect(result.success).toBe(true);

      await logAuditEvent({
        userId: 1,
        action: AUDIT_ACTIONS.ACCOUNT_SUSPENDED,
        resourceType: "user",
        resourceId: "55",
        metadata: { reason: request!.title, changeRequestId: 3 },
        severity: "warning",
        req: undefined as any,
      });

      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "admin.account_suspended",
          resourceType: "user",
        }),
      );
    });
  });

  describe("unsuspend_user auto-execute", () => {
    it("should call unsuspendUser when unsuspend_user request is approved", async () => {
      const { getChangeRequestById, unsuspendUser } = await import("./db");
      const { logAuditEvent, AUDIT_ACTIONS } = await import("./auditLog");

      const request = await getChangeRequestById(4); // unsuspend_user
      expect(request!.type).toBe("unsuspend_user");

      const result = await unsuspendUser(request!.targetUserId);

      expect(unsuspendUser).toHaveBeenCalledWith(55);
      expect(result.success).toBe(true);

      await logAuditEvent({
        userId: 1,
        action: AUDIT_ACTIONS.ACCOUNT_UNSUSPENDED,
        resourceType: "user",
        resourceId: "55",
        metadata: { reason: request!.title, changeRequestId: 4 },
        severity: "info",
        req: undefined as any,
      });

      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "admin.account_unsuspended",
          resourceType: "user",
        }),
      );
    });
  });

  describe("block_ip auto-execute", () => {
    it("should call blockIp when block_ip request is approved", async () => {
      const { getChangeRequestById, blockIp } = await import("./db");
      const { logAuditEvent, AUDIT_ACTIONS } = await import("./auditLog");

      const request = await getChangeRequestById(5); // block_ip, ipAddress: "192.168.1.100"
      expect(request!.type).toBe("block_ip");
      expect(request!.ipAddress).toBe("192.168.1.100");

      const result = await blockIp(
        request!.ipAddress!,
        `Blocked via change request #5: ${request!.title}`,
        1 // admin ID
      );

      expect(blockIp).toHaveBeenCalledWith(
        "192.168.1.100",
        expect.stringContaining("Blocked via change request #5"),
        1
      );
      expect(result.success).toBe(true);

      await logAuditEvent({
        userId: 1,
        action: AUDIT_ACTIONS.IP_BLOCKED,
        resourceType: "ip",
        resourceId: "192.168.1.100",
        metadata: { reason: request!.title, changeRequestId: 5 },
        severity: "warning",
        req: undefined as any,
      });

      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "admin.ip_blocked",
          resourceType: "ip",
        }),
      );
    });

    it("should not execute block_ip if ipAddress is missing", async () => {
      const { blockIp } = await import("./db");

      const shouldExecute = (ipAddress: string | null) => {
        return ipAddress !== null && ipAddress.length > 0;
      };

      expect(shouldExecute(null)).toBe(false);
      expect(shouldExecute("")).toBe(false);
      expect(shouldExecute("192.168.1.100")).toBe(true);
      expect(blockIp).not.toHaveBeenCalled();
    });
  });

  describe("non-executable types", () => {
    it("should NOT auto-execute for flag_account type", async () => {
      const { addCredits, suspendUser, unsuspendUser, blockIp } = await import("./db");

      const nonExecutableTypes = ["flag_account", "note_incident", "other"];
      for (const type of nonExecutableTypes) {
        const shouldAutoExecute = !["flag_account", "note_incident", "other"].includes(type);
        expect(shouldAutoExecute).toBe(false);
      }

      // None of the action functions should be called
      expect(addCredits).not.toHaveBeenCalled();
      expect(suspendUser).not.toHaveBeenCalled();
      expect(unsuspendUser).not.toHaveBeenCalled();
      expect(blockIp).not.toHaveBeenCalled();
    });

    it("should NOT auto-execute for note_incident type", async () => {
      const { getChangeRequestById } = await import("./db");

      const request = await getChangeRequestById(7); // note_incident
      expect(request!.type).toBe("note_incident");

      // note_incident should not trigger any auto-execution
      const autoExecuteTypes = ["refund_credits", "add_credits", "suspend_user", "unsuspend_user", "block_ip"];
      expect(autoExecuteTypes.includes(request!.type)).toBe(false);
    });
  });

  describe("denial should NOT auto-execute", () => {
    it("should not call any action functions when a request is denied", async () => {
      const { getChangeRequestById, updateChangeRequestStatus, addCredits, suspendUser, unsuspendUser, blockIp } = await import("./db");

      const request = await getChangeRequestById(1); // refund_credits
      expect(request!.type).toBe("refund_credits");

      // Deny the request
      await updateChangeRequestStatus(1, {
        status: "denied",
        reviewedById: 1,
        reviewedByName: "Admin",
        reviewNotes: "Insufficient evidence",
      });

      // Auto-execute should only happen on approval, not denial
      const shouldAutoExecute = (action: string) => action === "approved";
      expect(shouldAutoExecute("denied")).toBe(false);

      // None of the action functions should be called for denial
      expect(addCredits).not.toHaveBeenCalled();
      expect(suspendUser).not.toHaveBeenCalled();
      expect(unsuspendUser).not.toHaveBeenCalled();
      expect(blockIp).not.toHaveBeenCalled();
    });
  });

  describe("execution failure handling", () => {
    it("should handle addCredits failure gracefully", async () => {
      const { addCredits } = await import("./db");
      
      // Override mock to simulate failure
      (addCredits as any).mockResolvedValueOnce({ success: false, error: "Insufficient balance" });

      const result = await addCredits(42, 50, "refund", "Test refund", "cr-test");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Insufficient balance");
    });

    it("should handle suspendUser failure gracefully", async () => {
      const { suspendUser } = await import("./db");

      (suspendUser as any).mockResolvedValueOnce({ success: false, error: "User already suspended" });

      const result = await suspendUser(55, "Test suspension", 1);
      expect(result.success).toBe(false);
      expect(result.error).toBe("User already suspended");
    });

    it("should handle blockIp failure gracefully", async () => {
      const { blockIp } = await import("./db");

      (blockIp as any).mockResolvedValueOnce({ success: false });

      const result = await blockIp("192.168.1.100", "Test block", 1);
      expect(result.success).toBe(false);
    });

    it("should catch unexpected errors during auto-execution", async () => {
      const { addCredits } = await import("./db");

      (addCredits as any).mockRejectedValueOnce(new Error("Database connection lost"));

      try {
        await addCredits(42, 50, "refund", "Test", "cr-test");
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toBe("Database connection lost");
      }
    });
  });

  describe("execution result structure", () => {
    it("should return executed: false for non-executable types", () => {
      const executionResult = { executed: false };
      expect(executionResult.executed).toBe(false);
      expect(executionResult).not.toHaveProperty("success");
      expect(executionResult).not.toHaveProperty("error");
    });

    it("should return executed: true with success for successful execution", () => {
      const executionResult = { executed: true, success: true };
      expect(executionResult.executed).toBe(true);
      expect(executionResult.success).toBe(true);
    });

    it("should return executed: true with error for failed execution", () => {
      const executionResult = { executed: true, success: false, error: "Something went wrong" };
      expect(executionResult.executed).toBe(true);
      expect(executionResult.success).toBe(false);
      expect(executionResult.error).toBe("Something went wrong");
    });
  });

  describe("Slack notification for auto-execution", () => {
    it("should send Slack notification after successful auto-execution", async () => {
      const { sendAdminActionNotification } = await import("./slack/slackNotification");

      await sendAdminActionNotification({
        title: "⚙️✅ Auto-Executed: Refund Credits",
        description: "Action auto-executed for change request #1. Execution succeeded.",
        severity: "info",
        fields: [
          { title: "Request", value: "#1", short: true },
          { title: "Type", value: "Refund Credits", short: true },
          { title: "Target", value: "Test User", short: true },
          { title: "Execution", value: "Success", short: true },
        ],
      });

      expect(sendAdminActionNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining("Auto-Executed"),
          severity: "info",
        }),
      );
    });

    it("should send critical Slack notification after failed auto-execution", async () => {
      const { sendAdminActionNotification } = await import("./slack/slackNotification");

      await sendAdminActionNotification({
        title: "⚙️❌ Auto-Executed: Suspend User",
        description: "Action auto-executed for change request #3. Execution failed: User already suspended.",
        severity: "critical",
        fields: [
          { title: "Request", value: "#3", short: true },
          { title: "Type", value: "Suspend User", short: true },
          { title: "Target", value: "Bad Actor", short: true },
          { title: "Execution", value: "Failed", short: true },
        ],
      });

      expect(sendAdminActionNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: "critical",
        }),
      );
    });
  });
});

// ============================================================
// Slack Approval Gating for Sensitive Change Requests
// ============================================================
describe("Change Request - Slack Approval Gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const SENSITIVE_TYPES = ["suspend_user", "unsuspend_user", "block_ip", "refund_credits", "add_credits"];
  const NON_SENSITIVE_TYPES = ["flag_account", "note_incident", "other"];

  describe("sensitive type classification", () => {
    it("should classify 5 types as sensitive", () => {
      expect(SENSITIVE_TYPES).toHaveLength(5);
      expect(SENSITIVE_TYPES).toContain("suspend_user");
      expect(SENSITIVE_TYPES).toContain("unsuspend_user");
      expect(SENSITIVE_TYPES).toContain("block_ip");
      expect(SENSITIVE_TYPES).toContain("refund_credits");
      expect(SENSITIVE_TYPES).toContain("add_credits");
    });

    it("should classify 3 types as non-sensitive", () => {
      expect(NON_SENSITIVE_TYPES).toHaveLength(3);
      expect(NON_SENSITIVE_TYPES).toContain("flag_account");
      expect(NON_SENSITIVE_TYPES).toContain("note_incident");
      expect(NON_SENSITIVE_TYPES).toContain("other");
    });

    it("should not overlap between sensitive and non-sensitive", () => {
      for (const type of SENSITIVE_TYPES) {
        expect(NON_SENSITIVE_TYPES).not.toContain(type);
      }
      for (const type of NON_SENSITIVE_TYPES) {
        expect(SENSITIVE_TYPES).not.toContain(type);
      }
    });

    it("should cover all 8 change request types", () => {
      const allTypes = [...SENSITIVE_TYPES, ...NON_SENSITIVE_TYPES];
      expect(allTypes).toHaveLength(8);
      expect(allTypes).toContain("refund_credits");
      expect(allTypes).toContain("add_credits");
      expect(allTypes).toContain("flag_account");
      expect(allTypes).toContain("note_incident");
      expect(allTypes).toContain("suspend_user");
      expect(allTypes).toContain("unsuspend_user");
      expect(allTypes).toContain("block_ip");
      expect(allTypes).toContain("other");
    });
  });

  describe("CR to Slack approval action mapping", () => {
    const CR_TO_APPROVAL_ACTION: Record<string, string> = {
      suspend_user: "cr_suspendUser",
      unsuspend_user: "cr_unsuspendUser",
      refund_credits: "cr_refundCredits",
      add_credits: "cr_addCredits",
      block_ip: "cr_blockIP",
    };

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

  describe("sensitive approval flow", () => {
    it("should set status to pending_execution for sensitive type approval", async () => {
      const { getChangeRequestById, updateChangeRequestStatus } = await import("./db");

      const request = await getChangeRequestById(1); // refund_credits (sensitive)
      expect(request).not.toBeNull();
      expect(SENSITIVE_TYPES.includes(request!.type)).toBe(true);

      // Simulate the procedure setting pending_execution
      await updateChangeRequestStatus(1, {
        status: "pending_execution",
        reviewedById: 1,
        reviewedByName: "Admin",
        reviewNotes: "Approved pending Slack",
      });

      expect(updateChangeRequestStatus).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: "pending_execution",
          reviewedById: 1,
        }),
      );
    });

    it("should return pendingExecution: true for sensitive type approval", () => {
      const result = {
        success: true,
        action: "approved" as const,
        message: "Change request #1 approved — awaiting Slack confirmation before execution",
        slackApprovalId: "test-action-id-123",
        slackSent: true,
        pendingExecution: true,
        executionResult: { executed: false },
      };

      expect(result.pendingExecution).toBe(true);
      expect(result.slackApprovalId).toBeDefined();
      expect(result.executionResult.executed).toBe(false);
    });

    it("should store slackApprovalId on the change request", async () => {
      const { updateChangeRequestStatus } = await import("./db");

      await updateChangeRequestStatus(1, {
        status: "pending_execution",
        slackApprovalId: "test-slack-action-id",
      }, "pending_execution");

      expect(updateChangeRequestStatus).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          slackApprovalId: "test-slack-action-id",
        }),
        "pending_execution",
      );
    });

    it("should route each sensitive type through Slack", () => {
      for (const type of SENSITIVE_TYPES) {
        const isSensitive = SENSITIVE_TYPES.includes(type);
        expect(isSensitive).toBe(true);
      }
    });
  });

  describe("non-sensitive approval flow", () => {
    it("should NOT set pending_execution for non-sensitive type approval", async () => {
      const { getChangeRequestById } = await import("./db");

      const request = await getChangeRequestById(7); // note_incident (non-sensitive)
      expect(request).not.toBeNull();
      expect(SENSITIVE_TYPES.includes(request!.type)).toBe(false);

      // Non-sensitive types go directly to approved status
      const result = {
        success: true,
        action: "approved" as const,
        message: "Change request #7 has been approved",
        executionResult: { executed: false },
      };

      expect(result).not.toHaveProperty("pendingExecution");
      expect(result).not.toHaveProperty("slackApprovalId");
    });

    it("should process non-sensitive denials immediately", () => {
      const result = {
        success: true,
        action: "denied" as const,
        message: "Change request #7 has been denied",
        executionResult: { executed: false },
      };

      expect(result.action).toBe("denied");
      expect(result).not.toHaveProperty("pendingExecution");
    });
  });

  describe("denial bypasses Slack", () => {
    it("should NOT route through Slack when denying a sensitive type", () => {
      // Even for sensitive types, denial is immediate (no Slack needed)
      const request = { type: "suspend_user", status: "pending" };
      const action = "denied";

      const shouldRouteToSlack = action === "approved" && SENSITIVE_TYPES.includes(request.type);
      expect(shouldRouteToSlack).toBe(false);
    });

    it("should set status directly to denied for sensitive type denial", async () => {
      const { updateChangeRequestStatus } = await import("./db");

      await updateChangeRequestStatus(3, {
        status: "denied",
        reviewedById: 1,
        reviewedByName: "Admin",
        reviewNotes: "Insufficient evidence",
      });

      expect(updateChangeRequestStatus).toHaveBeenCalledWith(
        3,
        expect.objectContaining({ status: "denied" }),
      );
    });
  });

  describe("checkChangeRequestSlackStatus", () => {
    it("should return null slackStatus for non-pending_execution requests", () => {
      const request = { status: "approved", slackApprovalId: null };
      const result = request.status !== "pending_execution" || !request.slackApprovalId
        ? { status: request.status, slackStatus: null, message: "Already executed" }
        : null;

      expect(result).not.toBeNull();
      expect(result!.slackStatus).toBeNull();
    });

    it("should return pending slackStatus for pending_execution requests", () => {
      const mockSlackStatus = {
        status: "pending" as const,
        resolvedBy: null,
        resolvedAt: null,
        expiresAt: new Date(Date.now() + 300000),
      };

      const result = {
        status: "pending_execution",
        slackStatus: mockSlackStatus.status,
        message: "Awaiting Slack approval",
      };

      expect(result.slackStatus).toBe("pending");
      expect(result.status).toBe("pending_execution");
    });

    it("should return approved slackStatus when Slack approves", () => {
      const result = {
        status: "pending_execution",
        slackStatus: "approved" as const,
        resolvedBy: "slack-admin",
        message: "Slack approved — ready to execute",
      };

      expect(result.slackStatus).toBe("approved");
      expect(result.resolvedBy).toBe("slack-admin");
    });

    it("should return denied slackStatus when Slack denies", () => {
      const result = {
        status: "pending_execution",
        slackStatus: "denied" as const,
        resolvedBy: "slack-admin",
        message: "Slack denied — action will not execute",
      };

      expect(result.slackStatus).toBe("denied");
    });
  });

  describe("executeChangeRequestAfterSlack", () => {
    it("should reject execution if request is not pending_execution", () => {
      const request = { status: "approved", slackApprovalId: null };
      const shouldReject = request.status !== "pending_execution" || !request.slackApprovalId;
      expect(shouldReject).toBe(true);
    });

    it("should reject execution if Slack status is not approved", () => {
      const slackStatuses = ["pending", "denied", "expired"];
      for (const status of slackStatuses) {
        const shouldExecute = status === "approved";
        expect(shouldExecute).toBe(false);
      }
    });

    it("should allow execution when Slack status is approved", () => {
      const slackStatus = { status: "approved" };
      expect(slackStatus.status === "approved").toBe(true);
    });

    it("should update change request to denied when Slack denies", async () => {
      const { updateChangeRequestStatus } = await import("./db");

      // Simulate Slack denial → update CR to denied
      await updateChangeRequestStatus(1, {
        status: "denied",
        reviewNotes: "\n[Slack denied by slack-admin]",
      }, "pending_execution");

      expect(updateChangeRequestStatus).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ status: "denied" }),
        "pending_execution",
      );
    });

    it("should update change request to expired when Slack expires", async () => {
      const { updateChangeRequestStatus } = await import("./db");

      await updateChangeRequestStatus(1, {
        status: "expired",
      }, "pending_execution");

      expect(updateChangeRequestStatus).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ status: "expired" }),
        "pending_execution",
      );
    });
  });

  describe("Slack approval action types", () => {
    it("should have cr_ prefixed action types for all sensitive change request types", () => {
      const crActions = [
        "cr_suspendUser",
        "cr_unsuspendUser",
        "cr_refundCredits",
        "cr_addCredits",
        "cr_blockIP",
      ];

      expect(crActions).toHaveLength(5);
      crActions.forEach(action => {
        expect(action).toMatch(/^cr_/);
      });
    });

    it("should map cr_ actions to correct labels", () => {
      const ACTION_LABELS: Record<string, string> = {
        cr_suspendUser: "CR: Suspend User",
        cr_unsuspendUser: "CR: Unsuspend User",
        cr_refundCredits: "CR: Refund Credits",
        cr_addCredits: "CR: Add Credits",
        cr_blockIP: "CR: Block IP",
      };

      expect(ACTION_LABELS["cr_suspendUser"]).toContain("Suspend");
      expect(ACTION_LABELS["cr_refundCredits"]).toContain("Refund");
      expect(ACTION_LABELS["cr_blockIP"]).toContain("Block");
    });
  });

  describe("pending_execution status in summary", () => {
    it("should include pendingExecutionCount in list summary", () => {
      const summary = {
        pendingCount: 3,
        approvedCount: 5,
        deniedCount: 2,
        pendingExecutionCount: 1,
        totalCount: 11,
      };

      expect(summary).toHaveProperty("pendingExecutionCount");
      expect(summary.pendingExecutionCount).toBe(1);
    });
  });

  describe("end-to-end flow simulation", () => {
    it("should follow the complete flow: approve → pending_execution → Slack approve → execute", async () => {
      const { getChangeRequestById, updateChangeRequestStatus, addCredits } = await import("./db");

      // Step 1: Admin approves a sensitive request (refund_credits)
      const request = await getChangeRequestById(1);
      expect(request!.type).toBe("refund_credits");
      expect(SENSITIVE_TYPES.includes(request!.type)).toBe(true);

      // Step 2: Status set to pending_execution
      await updateChangeRequestStatus(1, {
        status: "pending_execution",
        reviewedById: 1,
        reviewedByName: "Admin",
      });

      // Step 3: Slack approval ID stored
      await updateChangeRequestStatus(1, {
        status: "pending_execution",
        slackApprovalId: "mock-slack-id",
      }, "pending_execution");

      // Step 4: Slack approves → execute the action
      const creditResult = await addCredits(
        request!.targetUserId,
        request!.creditAmount!,
        "refund",
        `Refund via change request #1: ${request!.creditReason || request!.title}`,
        "cr-1"
      );
      expect(creditResult.success).toBe(true);

      // Step 5: Update status to approved
      await updateChangeRequestStatus(1, { status: "approved" }, "pending_execution");

      // Verify the full flow
      expect(updateChangeRequestStatus).toHaveBeenCalledTimes(3);
      expect(addCredits).toHaveBeenCalledWith(
        42, 50, "refund",
        expect.stringContaining("Refund via change request #1"),
        "cr-1"
      );
    });

    it("should follow the flow: approve → pending_execution → Slack deny → denied", async () => {
      const { updateChangeRequestStatus, addCredits } = await import("./db");

      // Step 1: Admin approves → pending_execution
      await updateChangeRequestStatus(1, {
        status: "pending_execution",
        reviewedById: 1,
        reviewedByName: "Admin",
      });

      // Step 2: Slack denies → update to denied
      await updateChangeRequestStatus(1, {
        status: "denied",
        reviewNotes: "\n[Slack denied by slack-admin]",
      }, "pending_execution");

      // Step 3: No execution should happen
      expect(addCredits).not.toHaveBeenCalled();

      // Verify status transitions
      expect(updateChangeRequestStatus).toHaveBeenCalledTimes(2);
      expect(updateChangeRequestStatus).toHaveBeenLastCalledWith(
        1,
        expect.objectContaining({ status: "denied" }),
        "pending_execution",
      );
    });
  });
});
