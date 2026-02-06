import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AUDIT_ACTIONS } from "../drizzle/schema";

// Mock the database
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

// Mock the notification system
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

import { getDb } from "./db";
import { notifyOwner } from "./_core/notification";

describe("Audit Logging", () => {
  let mockDb: any;
  let mockInsert: any;
  let mockSelect: any;
  let mockWhere: any;
  let mockOrderBy: any;
  let mockLimit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock chain for insert
    mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    
    // Setup mock chain for select
    mockLimit = vi.fn().mockResolvedValue([]);
    mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
    mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
    mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({ where: mockWhere, orderBy: mockOrderBy }),
    });
    
    mockDb = {
      insert: mockInsert,
      select: mockSelect,
    };
    
    (getDb as any).mockResolvedValue(mockDb);
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("logAuditEvent", () => {
    it("should log an audit event to the database", async () => {
      // Re-import to get fresh module with mocks
      const { logAuditEvent } = await import("./auditLog");
      
      await logAuditEvent({
        userId: 123,
        action: AUDIT_ACTIONS.MODEL_DELETED,
        resourceType: "model",
        resourceId: "456",
        metadata: { modelName: "Test Model" },
      });

      expect(mockInsert).toHaveBeenCalled();
      const insertCall = mockInsert.mock.results[0].value;
      expect(insertCall.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 123,
          action: AUDIT_ACTIONS.MODEL_DELETED,
          resourceType: "model",
          resourceId: "456",
        })
      );
    });

    it("should handle null userId for system events", async () => {
      const { logAuditEvent } = await import("./auditLog");
      
      await logAuditEvent({
        userId: null,
        action: AUDIT_ACTIONS.ABUSE_DETECTED,
        resourceType: "system",
        metadata: { reason: "automated check" },
      });

      expect(mockInsert).toHaveBeenCalled();
      const insertCall = mockInsert.mock.results[0].value;
      expect(insertCall.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: null,
          action: AUDIT_ACTIONS.ABUSE_DETECTED,
        })
      );
    });

    it("should extract IP address from request headers", async () => {
      const { logAuditEvent } = await import("./auditLog");
      
      const mockReq = {
        headers: {
          "x-forwarded-for": "192.168.1.1, 10.0.0.1",
          "user-agent": "Mozilla/5.0 Test Browser",
        },
      };

      await logAuditEvent({
        userId: 123,
        action: AUDIT_ACTIONS.SUBSCRIPTION_CREATED,
        req: mockReq as any,
      });

      expect(mockInsert).toHaveBeenCalled();
      const insertCall = mockInsert.mock.results[0].value;
      expect(insertCall.values).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0 Test Browser",
        })
      );
    });

    it("should use x-real-ip header as fallback", async () => {
      const { logAuditEvent } = await import("./auditLog");
      
      const mockReq = {
        headers: {
          "x-real-ip": "10.0.0.5",
        },
      };

      await logAuditEvent({
        userId: 123,
        action: AUDIT_ACTIONS.LOGIN_SUCCESS,
        req: mockReq as any,
      });

      expect(mockInsert).toHaveBeenCalled();
      const insertCall = mockInsert.mock.results[0].value;
      expect(insertCall.values).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: "10.0.0.5",
        })
      );
    });

    it("should set default severity to info", async () => {
      const { logAuditEvent } = await import("./auditLog");
      
      await logAuditEvent({
        userId: 123,
        action: AUDIT_ACTIONS.MODEL_CREATED,
      });

      expect(mockInsert).toHaveBeenCalled();
      const insertCall = mockInsert.mock.results[0].value;
      expect(insertCall.values).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: "info",
        })
      );
    });

    it("should allow custom severity levels", async () => {
      const { logAuditEvent } = await import("./auditLog");
      
      await logAuditEvent({
        userId: 123,
        action: AUDIT_ACTIONS.SUBSCRIPTION_CANCELED,
        severity: "warning",
      });

      expect(mockInsert).toHaveBeenCalled();
      const insertCall = mockInsert.mock.results[0].value;
      expect(insertCall.values).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: "warning",
        })
      );
    });

    it("should not throw when database is unavailable", async () => {
      (getDb as any).mockResolvedValue(null);
      const { logAuditEvent } = await import("./auditLog");
      
      // Should not throw
      await expect(
        logAuditEvent({
          userId: 123,
          action: AUDIT_ACTIONS.MODEL_DELETED,
        })
      ).resolves.toBeUndefined();
    });

    it("should not throw when insert fails", async () => {
      mockInsert.mockReturnValue({
        values: vi.fn().mockRejectedValue(new Error("DB error")),
      });
      const { logAuditEvent } = await import("./auditLog");
      
      // Should not throw
      await expect(
        logAuditEvent({
          userId: 123,
          action: AUDIT_ACTIONS.MODEL_DELETED,
        })
      ).resolves.toBeUndefined();
    });
  });

  describe("AUDIT_ACTIONS constants", () => {
    it("should have billing-related actions", () => {
      expect(AUDIT_ACTIONS.SUBSCRIPTION_CREATED).toBe("subscription.created");
      expect(AUDIT_ACTIONS.SUBSCRIPTION_CANCELED).toBe("subscription.canceled");
      expect(AUDIT_ACTIONS.SUBSCRIPTION_UPDATED).toBe("subscription.updated");
      expect(AUDIT_ACTIONS.CREDITS_PURCHASED).toBe("credits.purchased");
    });

    it("should have model-related actions", () => {
      expect(AUDIT_ACTIONS.MODEL_CREATED).toBe("model.created");
      expect(AUDIT_ACTIONS.MODEL_DELETED).toBe("model.deleted");
      expect(AUDIT_ACTIONS.MODEL_MINTED).toBe("model.minted");
    });

    it("should have security-related actions", () => {
      expect(AUDIT_ACTIONS.LOGIN_SUCCESS).toBe("auth.login");
      expect(AUDIT_ACTIONS.RATE_LIMIT_EXCEEDED).toBe("security.rate_limit");
      expect(AUDIT_ACTIONS.INSUFFICIENT_CREDITS).toBe("security.insufficient_credits");
    });

    it("should have abuse detection actions", () => {
      expect(AUDIT_ACTIONS.ABUSE_DETECTED).toBe("abuse.detected");
      expect(AUDIT_ACTIONS.ABUSE_PATTERN_CREDITS).toBe("abuse.credits_exploit_attempt");
      expect(AUDIT_ACTIONS.ABUSE_PATTERN_DELETION).toBe("abuse.rapid_deletion");
      expect(AUDIT_ACTIONS.ABUSE_PATTERN_BILLING).toBe("abuse.billing_anomaly");
    });
  });

  describe("Query Helpers", () => {
    it("getUserAuditLogs should return empty array when db unavailable", async () => {
      (getDb as any).mockResolvedValue(null);
      const { getUserAuditLogs } = await import("./auditLog");
      
      const result = await getUserAuditLogs(123);
      expect(result).toEqual([]);
    });

    it("getAuditLogsByAction should return empty array when db unavailable", async () => {
      (getDb as any).mockResolvedValue(null);
      const { getAuditLogsByAction, AUDIT_ACTIONS } = await import("./auditLog");
      
      const result = await getAuditLogsByAction(AUDIT_ACTIONS.MODEL_DELETED);
      expect(result).toEqual([]);
    });

    it("getCriticalAuditLogs should return empty array when db unavailable", async () => {
      (getDb as any).mockResolvedValue(null);
      const { getCriticalAuditLogs } = await import("./auditLog");
      
      const result = await getCriticalAuditLogs();
      expect(result).toEqual([]);
    });
  });
});

describe("Abuse Detection", () => {
  let mockDb: any;
  let mockInsert: any;
  let mockSelect: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    
    mockDb = {
      insert: mockInsert,
      select: vi.fn(),
    };
    
    (getDb as any).mockResolvedValue(mockDb);
  });

  it("should detect credits exploit pattern when threshold exceeded", async () => {
    // Mock returning many INSUFFICIENT_CREDITS events
    const mockEvents = Array(12).fill(null).map((_, i) => ({
      id: i + 1,
      userId: 123,
      action: AUDIT_ACTIONS.INSUFFICIENT_CREDITS,
      createdAt: new Date(),
    }));

    mockDb.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mockEvents),
        }),
      }),
    });

    const { logAuditEvent } = await import("./auditLog");
    
    await logAuditEvent({
      userId: 123,
      action: AUDIT_ACTIONS.INSUFFICIENT_CREDITS,
    });

    // Should have logged the original event plus abuse detection event
    expect(mockInsert).toHaveBeenCalledTimes(2);
    
    // Check that notifyOwner was called for critical pattern
    expect(notifyOwner).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining("Security Alert"),
      })
    );
  });

  it("should not trigger abuse detection below threshold", async () => {
    // Mock returning few events (below threshold)
    const mockEvents = Array(3).fill(null).map((_, i) => ({
      id: i + 1,
      userId: 123,
      action: AUDIT_ACTIONS.INSUFFICIENT_CREDITS,
      createdAt: new Date(),
    }));

    mockDb.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mockEvents),
        }),
      }),
    });

    const { logAuditEvent } = await import("./auditLog");
    
    await logAuditEvent({
      userId: 123,
      action: AUDIT_ACTIONS.INSUFFICIENT_CREDITS,
    });

    // Should only have logged the original event
    expect(mockInsert).toHaveBeenCalledTimes(1);
    
    // Should not notify owner
    expect(notifyOwner).not.toHaveBeenCalled();
  });

  it("should detect rapid model deletion pattern", async () => {
    // Mock returning many MODEL_DELETED events
    const mockEvents = Array(6).fill(null).map((_, i) => ({
      id: i + 1,
      userId: 456,
      action: AUDIT_ACTIONS.MODEL_DELETED,
      createdAt: new Date(),
    }));

    mockDb.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mockEvents),
        }),
      }),
    });

    const { logAuditEvent } = await import("./auditLog");
    
    await logAuditEvent({
      userId: 456,
      action: AUDIT_ACTIONS.MODEL_DELETED,
      resourceType: "model",
      resourceId: "789",
    });

    // Should have logged the original event plus abuse detection event
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it("should not check patterns for unrelated actions", async () => {
    // Mock returning events
    mockDb.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const { logAuditEvent } = await import("./auditLog");
    
    // MODEL_CREATED is not in any abuse pattern
    await logAuditEvent({
      userId: 123,
      action: AUDIT_ACTIONS.MODEL_CREATED,
    });

    // Should only have logged the original event
    expect(mockInsert).toHaveBeenCalledTimes(1);
    
    // Select should not be called for pattern checking since MODEL_CREATED
    // is not in any abuse pattern
    expect(mockDb.select).not.toHaveBeenCalled();
  });
});
