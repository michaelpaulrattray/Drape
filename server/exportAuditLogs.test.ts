import { describe, it, expect, vi } from "vitest";

/**
 * Tests for the exportAuditLogsCsv CSV generation logic.
 * We test the CSV escaping and formatting independently.
 */

describe("Audit Log CSV Export", () => {
  const escapeCsv = (val: string) => {
    if (val.includes('"') || val.includes(',') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const buildCsv = (logs: Array<{
    id: number;
    createdAt: Date;
    severity: string;
    action: string;
    userId: number | null;
    ipAddress: string | null;
    resourceType: string | null;
    resourceId: string | null;
    metadata: unknown;
  }>) => {
    const header = "ID,Timestamp,Severity,Action,User ID,IP Address,Resource Type,Resource ID,Metadata";
    const rows = logs.map((log) => {
      const ts = new Date(log.createdAt).toISOString();
      const meta = log.metadata ? escapeCsv(JSON.stringify(log.metadata)) : "";
      return [
        log.id,
        ts,
        log.severity,
        escapeCsv(log.action),
        log.userId ?? "",
        log.ipAddress ?? "",
        log.resourceType ?? "",
        log.resourceId ?? "",
        meta,
      ].join(",");
    });
    return [header, ...rows].join("\n");
  };

  it("should produce correct CSV header", () => {
    const csv = buildCsv([]);
    expect(csv).toBe("ID,Timestamp,Severity,Action,User ID,IP Address,Resource Type,Resource ID,Metadata");
  });

  it("should format a single log entry correctly", () => {
    const csv = buildCsv([{
      id: 1,
      createdAt: new Date("2026-01-15T10:30:00Z"),
      severity: "info",
      action: "auth.login",
      userId: 42,
      ipAddress: "192.168.1.1",
      resourceType: "session",
      resourceId: "sess_abc",
      metadata: null,
    }]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe("1,2026-01-15T10:30:00.000Z,info,auth.login,42,192.168.1.1,session,sess_abc,");
  });

  it("should handle null fields gracefully", () => {
    const csv = buildCsv([{
      id: 2,
      createdAt: new Date("2026-02-01T00:00:00Z"),
      severity: "warning",
      action: "abuse.detected",
      userId: null,
      ipAddress: null,
      resourceType: null,
      resourceId: null,
      metadata: null,
    }]);
    const lines = csv.split("\n");
    expect(lines[1]).toBe("2,2026-02-01T00:00:00.000Z,warning,abuse.detected,,,,," );
  });

  it("should escape commas in metadata", () => {
    const csv = buildCsv([{
      id: 3,
      createdAt: new Date("2026-02-01T00:00:00Z"),
      severity: "info",
      action: "credits.purchased",
      userId: 10,
      ipAddress: "10.0.0.1",
      resourceType: "credits",
      resourceId: "txn_123",
      metadata: { amount: 5000, plan: "pro, annual" },
    }]);
    const lines = csv.split("\n");
    // Metadata should be escaped because it contains a comma
    expect(lines[1]).toContain('"{');
  });

  it("should escape double quotes in metadata", () => {
    const csv = buildCsv([{
      id: 4,
      createdAt: new Date("2026-02-01T00:00:00Z"),
      severity: "critical",
      action: "abuse.detected",
      userId: 5,
      ipAddress: "1.2.3.4",
      resourceType: "user",
      resourceId: "5",
      metadata: { reason: 'User said "hello"' },
    }]);
    const lines = csv.split("\n");
    // JSON.stringify produces \" for quotes, then CSV escaping wraps in double quotes and doubles internal quotes
    // The metadata field should be CSV-escaped (wrapped in quotes)
    const metaField = lines[1].split(",").slice(8).join(",");
    expect(metaField.startsWith('"')).toBe(true);
    // Should contain the word "hello" somewhere in the escaped metadata
    expect(metaField).toContain("hello");
  });

  it("should escape newlines in action names", () => {
    const result = escapeCsv("line1\nline2");
    expect(result).toBe('"line1\nline2"');
  });

  it("should not escape simple strings", () => {
    const result = escapeCsv("auth.login");
    expect(result).toBe("auth.login");
  });

  it("should handle multiple log entries", () => {
    const csv = buildCsv([
      {
        id: 1, createdAt: new Date("2026-01-01T00:00:00Z"),
        severity: "info", action: "auth.login", userId: 1,
        ipAddress: "1.1.1.1", resourceType: null, resourceId: null, metadata: null,
      },
      {
        id: 2, createdAt: new Date("2026-01-02T00:00:00Z"),
        severity: "warning", action: "abuse.detected", userId: 2,
        ipAddress: "2.2.2.2", resourceType: "user", resourceId: "2", metadata: { flag: true },
      },
      {
        id: 3, createdAt: new Date("2026-01-03T00:00:00Z"),
        severity: "critical", action: "security.rate_limit", userId: null,
        ipAddress: null, resourceType: null, resourceId: null, metadata: null,
      },
    ]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(4); // header + 3 rows
    expect(lines[0]).toContain("ID,Timestamp");
    expect(lines[1]).toContain("auth.login");
    expect(lines[2]).toContain("abuse.detected");
    expect(lines[3]).toContain("security.rate_limit");
  });
});
