/**
 * Tests for Admin Time-Series helper functions.
 *
 * Tests the pure date-range generation and date-filling logic used
 * by the admin overview charts, without hitting the database.
 */

import { describe, it, expect } from "vitest";

// ============================================================================
// DATE RANGE GENERATION
// ============================================================================

function getDateRange(days: number): string[] {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

describe("getDateRange", () => {
  it("should return correct number of dates", () => {
    expect(getDateRange(7)).toHaveLength(7);
    expect(getDateRange(14)).toHaveLength(14);
    expect(getDateRange(1)).toHaveLength(1);
  });

  it("should end with today's date", () => {
    const range = getDateRange(7);
    const today = new Date().toISOString().slice(0, 10);
    expect(range[range.length - 1]).toBe(today);
  });

  it("should be in ascending order", () => {
    const range = getDateRange(14);
    for (let i = 1; i < range.length; i++) {
      expect(range[i] > range[i - 1]).toBe(true);
    }
  });

  it("should produce YYYY-MM-DD format", () => {
    const range = getDateRange(3);
    for (const d of range) {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

// ============================================================================
// DATE FILLING
// ============================================================================

function fillDates<T extends Record<string, unknown>>(
  dates: string[],
  rows: Array<{ date: string } & T>,
  defaults: Omit<T, "date">
): Array<{ date: string } & T> {
  const map = new Map(rows.map(r => [r.date, r]));
  return dates.map(date => {
    const existing = map.get(date);
    if (existing) return existing;
    return { date, ...defaults } as { date: string } & T;
  });
}

describe("fillDates", () => {
  it("should fill missing dates with defaults", () => {
    const dates = ["2026-01-01", "2026-01-02", "2026-01-03"];
    const rows = [{ date: "2026-01-02", signups: 5 }];
    const filled = fillDates(dates, rows, { signups: 0 });

    expect(filled).toHaveLength(3);
    expect(filled[0]).toEqual({ date: "2026-01-01", signups: 0 });
    expect(filled[1]).toEqual({ date: "2026-01-02", signups: 5 });
    expect(filled[2]).toEqual({ date: "2026-01-03", signups: 0 });
  });

  it("should preserve all existing data", () => {
    const dates = ["2026-01-01", "2026-01-02"];
    const rows = [
      { date: "2026-01-01", completed: 10, failed: 2 },
      { date: "2026-01-02", completed: 15, failed: 0 },
    ];
    const filled = fillDates(dates, rows, { completed: 0, failed: 0 });

    expect(filled[0].completed).toBe(10);
    expect(filled[0].failed).toBe(2);
    expect(filled[1].completed).toBe(15);
    expect(filled[1].failed).toBe(0);
  });

  it("should return all defaults when no rows exist", () => {
    const dates = ["2026-01-01", "2026-01-02", "2026-01-03"];
    const filled = fillDates(dates, [], { consumed: 0, purchased: 0, refunded: 0 });

    expect(filled).toHaveLength(3);
    for (const row of filled) {
      expect(row.consumed).toBe(0);
      expect(row.purchased).toBe(0);
      expect(row.refunded).toBe(0);
    }
  });

  it("should handle single date range", () => {
    const dates = ["2026-01-01"];
    const rows = [{ date: "2026-01-01", value: 42 }];
    const filled = fillDates(dates, rows, { value: 0 });

    expect(filled).toHaveLength(1);
    expect(filled[0].value).toBe(42);
  });

  it("should ignore rows outside the date range", () => {
    const dates = ["2026-01-02", "2026-01-03"];
    const rows = [
      { date: "2026-01-01", signups: 10 }, // outside range
      { date: "2026-01-02", signups: 5 },
    ];
    const filled = fillDates(dates, rows, { signups: 0 });

    expect(filled).toHaveLength(2);
    expect(filled[0]).toEqual({ date: "2026-01-02", signups: 5 });
    expect(filled[1]).toEqual({ date: "2026-01-03", signups: 0 });
  });
});

// ============================================================================
// SUCCESS RATE COMPUTATION FOR DAILY STATS
// ============================================================================

function computeDailySuccessRate(completed: number, failed: number): number {
  const denom = completed + failed;
  return denom > 0 ? Math.round((completed / denom) * 100) : 100;
}

describe("Daily Success Rate Computation", () => {
  it("should return 100 when all completed", () => {
    expect(computeDailySuccessRate(50, 0)).toBe(100);
  });

  it("should return 0 when all failed", () => {
    expect(computeDailySuccessRate(0, 10)).toBe(0);
  });

  it("should return 100 when no data (0/0)", () => {
    expect(computeDailySuccessRate(0, 0)).toBe(100);
  });

  it("should compute correct percentage", () => {
    expect(computeDailySuccessRate(80, 20)).toBe(80);
    expect(computeDailySuccessRate(2, 1)).toBe(67);
    expect(computeDailySuccessRate(1, 2)).toBe(33);
  });
});

// ============================================================================
// CREDIT FLOW DATA SHAPE
// ============================================================================

describe("Credit Flow Data Shape", () => {
  it("should have correct fields for each day", () => {
    const dates = ["2026-01-01", "2026-01-02"];
    const rows = [{ date: "2026-01-01", consumed: 100, purchased: 500, refunded: 10 }];
    const filled = fillDates(dates, rows, { consumed: 0, purchased: 0, refunded: 0 });

    for (const row of filled) {
      expect(row).toHaveProperty("date");
      expect(row).toHaveProperty("consumed");
      expect(row).toHaveProperty("purchased");
      expect(row).toHaveProperty("refunded");
    }
  });

  it("should handle large credit values", () => {
    const dates = ["2026-01-01"];
    const rows = [{ date: "2026-01-01", consumed: 1_000_000, purchased: 5_000_000, refunded: 50_000 }];
    const filled = fillDates(dates, rows, { consumed: 0, purchased: 0, refunded: 0 });

    expect(filled[0].consumed).toBe(1_000_000);
    expect(filled[0].purchased).toBe(5_000_000);
  });
});

// ============================================================================
// CHANGE REQUEST DISTRIBUTION SHAPE
// ============================================================================

describe("Change Request Distribution", () => {
  it("should correctly aggregate status counts", () => {
    const dist = [
      { status: "pending", count: 5 },
      { status: "approved", count: 10 },
      { status: "rejected", count: 2 },
      { status: "completed", count: 8 },
    ];

    const total = dist.reduce((sum, d) => sum + d.count, 0);
    expect(total).toBe(25);
  });

  it("should handle empty distribution", () => {
    const dist: Array<{ status: string; count: number }> = [];
    const total = dist.reduce((sum, d) => sum + d.count, 0);
    expect(total).toBe(0);
  });

  it("should handle single status", () => {
    const dist = [{ status: "pending", count: 3 }];
    expect(dist).toHaveLength(1);
    expect(dist[0].status).toBe("pending");
  });
});
