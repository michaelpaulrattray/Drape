/**
 * The admin audit-log readers, driven against a fake `db`.
 *
 * ⚠ WHAT CHANGED HERE AND WHY (#941). The old fake resolved a statement at
 * `.offset()` or at `.limit()` and nowhere else, which was fine while every
 * query in this file ended at one of those two — and became a silent blind
 * spot the moment the pager grew a real `COUNT`, which ends at `.where()`.
 * The fake is now thenable at EVERY link, so it resolves wherever the caller
 * actually awaits, and it answers a `select({ … })` projection with a count
 * rather than with rows.
 *
 * ⚠ AND ONE ARM HERE USED TO PROVE THE DEFECT. "should filter by action
 * category" handed the fake three rows, two of them billing, and asserted the
 * result held only billing rows — which passed precisely BECAUSE the category
 * was applied in JavaScript after the fetch. With the filter in the `WHERE`
 * the database decides, so the honest question is *what statement was sent*,
 * and that is `server/auditLogFilterSql.test.ts`. What is left here is the
 * shape of what comes back.
 */
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

type FakeState = {
  /** What a `select()` of whole rows resolves to. */
  rows: unknown[];
  /** What a `select({ value: count() })` resolves to. */
  count: number;
  /** Every condition handed to `.where()`, in order. */
  wheres: unknown[];
  limits: number[];
  offsets: number[];
};

const createMockDb = () => {
  const state: FakeState = { rows: [], count: 0, wheres: [], limits: [], offsets: [] };

  /** One statement: chainable, and thenable at every link. */
  const query = (isCount: boolean) => {
    const chain: Record<string, unknown> = {};
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn((condition: unknown) => {
      state.wheres.push(condition);
      return chain;
    });
    chain.orderBy = vi.fn(() => chain);
    chain.limit = vi.fn((n: number) => {
      state.limits.push(n);
      return chain;
    });
    chain.offset = vi.fn((n: number) => {
      state.offsets.push(n);
      return chain;
    });
    chain.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve(isCount ? [{ value: state.count }] : state.rows).then(resolve);
    return chain;
  };

  return {
    state,
    /* A projection argument means an aggregate; no argument means whole rows. */
    select: vi.fn((projection?: unknown) => query(projection !== undefined)),
  };
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

    it("should draw the page at the size and offset asked for", async () => {
      const result = await getFilteredAuditLogs({
        limit: 20,
        offset: 0,
      });

      /*
        20, not 21. The old shape fetched `limit + 1` to guess whether more
        rows existed; the real COUNT answers that now, and a `limit + 1` would
        return one row too many to the panel.
      */
      expect(mockDb.state.limits).toEqual([20]);
      expect(mockDb.state.offsets).toEqual([0]);
      expect(result.hasMore).toBe(false);
    });

    it("reports hasMore from the COUNT of matching rows, not from the page", async () => {
      const page = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        action: "test.action",
        severity: "info",
        createdAt: new Date(),
      }));
      mockDb.state.rows = page;
      mockDb.state.count = 137;

      const result = await getFilteredAuditLogs({ limit: 20, offset: 0 });

      expect(result.logs).toHaveLength(20);
      expect(result.total).toBe(137);
      expect(result.hasMore).toBe(true);
    });

    /*
      THE PAGER'S HONESTY, and the reason the total stopped being derived from
      the page. `offset + logs.length + (hasMore ? 1 : 0)` could never disagree
      with the page it described, so the footer read "Showing 1–8" of a number
      it had invented. On the last page there is nothing more to show.
    */
    /*
      ⚠ THE ARM A SABOTAGE PASS ADDED. Every other hasMore arm here passes
      just as happily if `hasMore` is read off the page again
      (`logs.length >= limit`) — the two readings only disagree when the last
      page is EXACTLY full, which is the case that puts a dead **Next** button
      under a staff member. 20 rows, a page size of 20, and 20 rows in the
      whole table: there is nothing on the next page.
    */
    it("says there is no more when the last page is exactly full", async () => {
      mockDb.state.rows = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        action: "test.action",
        severity: "info",
        createdAt: new Date(),
      }));
      mockDb.state.count = 20;

      const result = await getFilteredAuditLogs({ limit: 20, offset: 0 });

      expect(result.total).toBe(20);
      expect(result.hasMore, "a full last page still offers a Next button").toBe(false);
    });

    it("says there is no more when the last page has been reached", async () => {
      mockDb.state.rows = [
        { id: 1, action: "test.action", severity: "info", createdAt: new Date() },
      ];
      mockDb.state.count = 41;

      const result = await getFilteredAuditLogs({ limit: 20, offset: 40 });

      expect(result.total).toBe(41);
      expect(result.hasMore).toBe(false);
    });

    it("should filter by severity when provided", async () => {
      await getFilteredAuditLogs({
        limit: 20,
        offset: 0,
        severity: "critical",
      });

      expect(mockDb.state.wheres.length).toBeGreaterThan(0);
      expect(mockDb.state.wheres[0]).toBeDefined();
    });

    it("should filter by userId when provided", async () => {
      await getFilteredAuditLogs({
        limit: 20,
        offset: 0,
        userId: 123,
      });

      expect(mockDb.state.wheres[0]).toBeDefined();
    });

    /*
      The rows the database returns are the answer — they are NOT re-filtered
      in JavaScript on the way out. The fake returns a row that is not a
      billing row; if anything downstream of the query still second-guesses
      the database, this row disappears and the count below drops to one.

      What was ASKED for is proven at the statement, in
      `server/auditLogFilterSql.test.ts`.
    */
    it("returns what the database returned, without a second filter pass", async () => {
      mockDb.state.rows = [
        { id: 1, action: "subscription.created", severity: "info", createdAt: new Date() },
        { id: 2, action: "casting.refusal", severity: "info", createdAt: new Date() },
      ];
      mockDb.state.count = 2;

      const result = await getFilteredAuditLogs({
        limit: 20,
        offset: 0,
        actionCategory: "billing",
      });

      expect(result.logs).toHaveLength(2);
      expect(result.total).toBe(2);
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
      mockDb.state.rows = [
        { id: 1, action: "abuse.detected", severity: "critical", createdAt: new Date(), metadata: { patternName: "Test" } },
        { id: 2, action: "abuse.detected", severity: "warning", createdAt: new Date(), metadata: { patternName: "Test" } },
        { id: 3, action: "abuse.detected", severity: "critical", createdAt: new Date(), metadata: { patternName: "Other" } },
      ];

      const result = await getAbuseAlertsSummary(10);

      expect(result.criticalCount).toBe(2);
      expect(result.warningCount).toBe(1);
    });

    it("should aggregate patterns from metadata", async () => {
      mockDb.state.rows = [
        { id: 1, action: "abuse.detected", severity: "critical", createdAt: new Date(), metadata: { patternName: "Credits Exploit" } },
        { id: 2, action: "abuse.detected", severity: "warning", createdAt: new Date(), metadata: { patternName: "Credits Exploit" } },
        { id: 3, action: "abuse.detected", severity: "critical", createdAt: new Date(), metadata: { patternName: "Rate Limit Abuse" } },
      ];

      const result = await getAbuseAlertsSummary(10);

      expect(result.recentPatterns).toContainEqual({ pattern: "Credits Exploit", count: 2 });
      expect(result.recentPatterns).toContainEqual({ pattern: "Rate Limit Abuse", count: 1 });
    });

    /*
      The limit is asked of the DATABASE now rather than sliced off an
      over-fetched hundred, so this reads it where it is spent.
    */
    it("should ask the database for no more rows than the caller wanted", async () => {
      await getAbuseAlertsSummary(5);

      expect(mockDb.state.limits).toEqual([5]);
      expect(mockDb.state.wheres[0], "the abuse summary sent no condition at all").toBeDefined();
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
      mockDb.state.rows = [
        { id: 1, action: "test.action", severity: "info", createdAt: new Date() },
        { id: 2, action: "test.action", severity: "info", createdAt: new Date() },
        { id: 3, action: "test.action", severity: "warning", createdAt: new Date() },
        { id: 4, action: "test.action", severity: "critical", createdAt: new Date() },
      ];

      const result = await getAuditStatistics();

      expect(result.bySeverity).toContainEqual({ severity: "info", count: 2 });
      expect(result.bySeverity).toContainEqual({ severity: "warning", count: 1 });
      expect(result.bySeverity).toContainEqual({ severity: "critical", count: 1 });
    });

    it("should count logs by category", async () => {
      mockDb.state.rows = [
        { id: 1, action: "subscription.created", severity: "info", createdAt: new Date() },
        { id: 2, action: "model.deleted", severity: "info", createdAt: new Date() },
        { id: 3, action: "abuse.detected", severity: "critical", createdAt: new Date() },
      ];

      const result = await getAuditStatistics();

      expect(result.byCategory).toContainEqual({ category: "billing", count: 1 });
      expect(result.byCategory).toContainEqual({ category: "model", count: 1 });
      expect(result.byCategory).toContainEqual({ category: "abuse", count: 1 });
    });

    it("should return last24Hours count", async () => {
      mockDb.state.rows = Array.from({ length: 15 }, (_, i) => ({
        id: i + 1,
        action: "test.action",
        severity: "info",
        createdAt: new Date(),
      }));

      const result = await getAuditStatistics();

      expect(result.last24Hours).toBe(15);
    });

    /*
      "Total entries" is a COUNT of the table, not the length of a page of it.
      It used to fetch up to 10,000 whole rows and return their length, so the
      tile stopped at exactly 10,000 however large the table grew. The fake
      returns 15 rows and a count of 48,231; a reader that still measures the
      page would say 15.
    */
    it("reports the table's real size, not the size of the page it fetched", async () => {
      mockDb.state.rows = Array.from({ length: 15 }, (_, i) => ({
        id: i + 1,
        action: "test.action",
        severity: "info",
        createdAt: new Date(),
      }));
      mockDb.state.count = 48231;

      const result = await getAuditStatistics();

      expect(result.totalLogs).toBe(48231);
      expect(mockDb.state.limits, "the total is still fetching a capped page of rows").toEqual([]);
    });
  });

  describe("getAuditLogById", () => {
    it("should return null when database is unavailable", async () => {
      (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await getAuditLogById(1);

      expect(result).toBeNull();
    });

    it("should return null when log not found", async () => {
      mockDb.state.rows = [];

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
      mockDb.state.rows = [mockLog];

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
    mockDb.state.rows = [
      { id: 1, action: "abuse.detected", severity: "critical", createdAt: new Date(), metadata: null },
      { id: 2, action: "abuse.detected", severity: "warning", createdAt: new Date(), resourceId: "pattern_name" },
    ];

    const result = await getAbuseAlertsSummary(10);

    // Should use resourceId as fallback when metadata.patternName is missing
    expect(result.recentPatterns.length).toBeGreaterThan(0);
  });

  it("should handle date range filtering", async () => {
    const startDate = new Date("2024-01-01");
    const endDate = new Date("2024-01-31");

    await getFilteredAuditLogs({
      limit: 20,
      offset: 0,
      startDate,
      endDate,
    });

    expect(mockDb.state.wheres[0]).toBeDefined();
  });

  it("should handle combined filters", async () => {
    await getFilteredAuditLogs({
      limit: 20,
      offset: 0,
      severity: "critical",
      actionCategory: "abuse",
      userId: 123,
    });

    expect(mockDb.state.wheres[0]).toBeDefined();
    /* The page and the count ask the same question — two statements, one condition. */
    expect(mockDb.state.wheres).toHaveLength(2);
    expect(mockDb.state.wheres[0]).toEqual(mockDb.state.wheres[1]);
  });
});
