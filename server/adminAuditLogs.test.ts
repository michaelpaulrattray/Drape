import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getFilteredAuditLogs,
  getAbuseAlertsSummary,
  getAuditStatistics,
  getAuditLogById,
} from "./auditLog";

// Mock the database
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

import { getDb } from "./db";

const createMockDb = () => {
  const mock: Record<string, ReturnType<typeof vi.fn>> = {};
  mock.select = vi.fn().mockReturnValue(mock);
  mock.from = vi.fn().mockReturnValue(mock);
  mock.where = vi.fn().mockReturnValue(mock);
  mock.orderBy = vi.fn().mockReturnValue(mock);
  mock.limit = vi.fn().mockReturnValue(mock);
  mock.offset = vi.fn().mockResolvedValue([]);
  return mock;
};

let mockDb = createMockDb();

describe("Admin Audit Logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(mockDb);
  });

  describe("getFilteredAuditLogs", () => {
    it("should return empty results when database is unavailable", async () => {
      (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await getFilteredAuditLogs({
        limit: 20,
        offset: 0,
      });

      expect(result).toEqual({ logs: [], total: 0, hasMore: false });
    });

    it("should apply default pagination", async () => {
      mockDb.offset.mockResolvedValue([]);

      const result = await getFilteredAuditLogs({
        limit: 20,
        offset: 0,
      });

      expect(mockDb.limit).toHaveBeenCalledWith(21); // limit + 1 for hasMore check
      expect(mockDb.offset).toHaveBeenCalledWith(0);
      expect(result.hasMore).toBe(false);
    });

    it("should detect hasMore when results exceed limit", async () => {
      const mockLogs = Array(21).fill({
        id: 1,
        action: "test.action",
        severity: "info",
        createdAt: new Date(),
      });
      mockDb.offset.mockResolvedValue(mockLogs);

      const result = await getFilteredAuditLogs({
        limit: 20,
        offset: 0,
      });

      expect(result.hasMore).toBe(true);
      expect(result.logs.length).toBe(20);
    });

    it("should filter by severity when provided", async () => {
      mockDb.offset.mockResolvedValue([]);

      await getFilteredAuditLogs({
        limit: 20,
        offset: 0,
        severity: "critical",
      });

      expect(mockDb.where).toHaveBeenCalled();
    });

    it("should filter by userId when provided", async () => {
      mockDb.offset.mockResolvedValue([]);

      await getFilteredAuditLogs({
        limit: 20,
        offset: 0,
        userId: 123,
      });

      expect(mockDb.where).toHaveBeenCalled();
    });

    it("should filter by action category", async () => {
      const mockLogs = [
        { id: 1, action: "subscription.created", severity: "info", createdAt: new Date() },
        { id: 2, action: "model.deleted", severity: "info", createdAt: new Date() },
        { id: 3, action: "credits.deducted", severity: "info", createdAt: new Date() },
      ];
      mockDb.offset.mockResolvedValue(mockLogs);

      const result = await getFilteredAuditLogs({
        limit: 20,
        offset: 0,
        actionCategory: "billing",
      });

      // Should filter to only billing-related actions
      expect(result.logs.every(log => 
        log.action.startsWith("subscription.") || log.action.startsWith("credits.")
      )).toBe(true);
    });
  });

  describe("getAbuseAlertsSummary", () => {
    it("should return empty summary when database is unavailable", async () => {
      (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await getAbuseAlertsSummary(10);

      expect(result).toEqual({
        alerts: [],
        criticalCount: 0,
        warningCount: 0,
        recentPatterns: [],
      });
    });

    it("should count alerts by severity", async () => {
      const mockLogs = [
        { id: 1, action: "abuse.detected", severity: "critical", createdAt: new Date(), metadata: { patternName: "Test" } },
        { id: 2, action: "abuse.detected", severity: "warning", createdAt: new Date(), metadata: { patternName: "Test" } },
        { id: 3, action: "abuse.detected", severity: "critical", createdAt: new Date(), metadata: { patternName: "Other" } },
      ];
      mockDb.limit.mockResolvedValue(mockLogs);

      const result = await getAbuseAlertsSummary(10);

      expect(result.criticalCount).toBe(2);
      expect(result.warningCount).toBe(1);
    });

    it("should aggregate patterns from metadata", async () => {
      const mockLogs = [
        { id: 1, action: "abuse.detected", severity: "critical", createdAt: new Date(), metadata: { patternName: "Credits Exploit" } },
        { id: 2, action: "abuse.detected", severity: "warning", createdAt: new Date(), metadata: { patternName: "Credits Exploit" } },
        { id: 3, action: "abuse.detected", severity: "critical", createdAt: new Date(), metadata: { patternName: "Rate Limit Abuse" } },
      ];
      mockDb.limit.mockResolvedValue(mockLogs);

      const result = await getAbuseAlertsSummary(10);

      expect(result.recentPatterns).toContainEqual({ pattern: "Credits Exploit", count: 2 });
      expect(result.recentPatterns).toContainEqual({ pattern: "Rate Limit Abuse", count: 1 });
    });

    it("should respect limit parameter", async () => {
      const mockLogs = Array(20).fill({
        id: 1,
        action: "abuse.detected",
        severity: "warning",
        createdAt: new Date(),
        metadata: {},
      });
      mockDb.limit.mockResolvedValue(mockLogs);

      const result = await getAbuseAlertsSummary(5);

      expect(result.alerts.length).toBeLessThanOrEqual(5);
    });
  });

  describe("getAuditStatistics", () => {
    it("should return empty stats when database is unavailable", async () => {
      (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await getAuditStatistics();

      expect(result).toEqual({
        totalLogs: 0,
        last24Hours: 0,
        bySeverity: [],
        byCategory: [],
      });
    });

    it("should count logs by severity", async () => {
      const mockLogs = [
        { id: 1, action: "test.action", severity: "info", createdAt: new Date() },
        { id: 2, action: "test.action", severity: "info", createdAt: new Date() },
        { id: 3, action: "test.action", severity: "warning", createdAt: new Date() },
        { id: 4, action: "test.action", severity: "critical", createdAt: new Date() },
      ];
      mockDb.orderBy.mockResolvedValue(mockLogs);
      mockDb.limit.mockResolvedValue(mockLogs);

      const result = await getAuditStatistics();

      expect(result.bySeverity).toContainEqual({ severity: "info", count: 2 });
      expect(result.bySeverity).toContainEqual({ severity: "warning", count: 1 });
      expect(result.bySeverity).toContainEqual({ severity: "critical", count: 1 });
    });

    it("should count logs by category", async () => {
      const mockLogs = [
        { id: 1, action: "subscription.created", severity: "info", createdAt: new Date() },
        { id: 2, action: "model.deleted", severity: "info", createdAt: new Date() },
        { id: 3, action: "abuse.detected", severity: "critical", createdAt: new Date() },
      ];
      mockDb.orderBy.mockResolvedValue(mockLogs);
      mockDb.limit.mockResolvedValue(mockLogs);

      const result = await getAuditStatistics();

      expect(result.byCategory).toContainEqual({ category: "billing", count: 1 });
      expect(result.byCategory).toContainEqual({ category: "model", count: 1 });
      expect(result.byCategory).toContainEqual({ category: "abuse", count: 1 });
    });

    it("should return last24Hours count", async () => {
      const mockLogs = Array(15).fill({
        id: 1,
        action: "test.action",
        severity: "info",
        createdAt: new Date(),
      });
      mockDb.orderBy.mockResolvedValue(mockLogs);
      mockDb.limit.mockResolvedValue(mockLogs);

      const result = await getAuditStatistics();

      expect(result.last24Hours).toBe(15);
    });
  });

  describe("getAuditLogById", () => {
    it("should return null when database is unavailable", async () => {
      (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await getAuditLogById(1);

      expect(result).toBeNull();
    });

    it("should return null when log not found", async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await getAuditLogById(999);

      expect(result).toBeNull();
    });

    it("should return the audit log when found", async () => {
      const mockLog = {
        id: 1,
        userId: 123,
        action: "subscription.created",
        resourceType: "subscription",
        resourceId: "sub_123",
        metadata: { plan: "pro" },
        severity: "info",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        createdAt: new Date(),
      };
      mockDb.limit.mockResolvedValue([mockLog]);

      const result = await getAuditLogById(1);

      expect(result).toEqual(mockLog);
    });
  });
});

describe("Admin Audit Logs - Edge Cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(mockDb);
  });

  it("should handle empty metadata in abuse alerts", async () => {
    const mockLogs = [
      { id: 1, action: "abuse.detected", severity: "critical", createdAt: new Date(), metadata: null },
      { id: 2, action: "abuse.detected", severity: "warning", createdAt: new Date(), resourceId: "pattern_name" },
    ];
    mockDb.limit.mockResolvedValue(mockLogs);

    const result = await getAbuseAlertsSummary(10);

    // Should use resourceId as fallback when metadata.patternName is missing
    expect(result.recentPatterns.length).toBeGreaterThan(0);
  });

  it("should handle date range filtering", async () => {
    mockDb.offset.mockResolvedValue([]);

    const startDate = new Date("2024-01-01");
    const endDate = new Date("2024-01-31");

    await getFilteredAuditLogs({
      limit: 20,
      offset: 0,
      startDate,
      endDate,
    });

    expect(mockDb.where).toHaveBeenCalled();
  });

  it("should handle combined filters", async () => {
    mockDb.offset.mockResolvedValue([]);

    await getFilteredAuditLogs({
      limit: 20,
      offset: 0,
      severity: "critical",
      actionCategory: "abuse",
      userId: 123,
    });

    expect(mockDb.where).toHaveBeenCalled();
  });
});
