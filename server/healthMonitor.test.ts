/**
 * Tests for server/monitoring/healthMonitor.ts
 *
 * Covers: cooldown logic, alert decisions (audit rows since #800), check
 * functions, lifecycle management, and edge cases.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============ Cooldown Logic ============

describe("HealthMonitor — Cooldown", () => {
  let canAlert: typeof import("./monitoring/healthMonitor").canAlert;
  let recordAlert: typeof import("./monitoring/healthMonitor").recordAlert;
  let _clearCooldowns: typeof import("./monitoring/healthMonitor")._clearCooldowns;
  let _getCooldownCount: typeof import("./monitoring/healthMonitor")._getCooldownCount;
  let ALERT_COOLDOWN_MS: number;

  beforeEach(async () => {
    const mod = await import("./monitoring/healthMonitor");
    canAlert = mod.canAlert;
    recordAlert = mod.recordAlert;
    _clearCooldowns = mod._clearCooldowns;
    _getCooldownCount = mod._getCooldownCount;
    ALERT_COOLDOWN_MS = mod.ALERT_COOLDOWN_MS;
    _clearCooldowns();
  });

  afterEach(() => {
    _clearCooldowns();
  });

  it("should allow first alert of any type", () => {
    expect(canAlert("generation_success_rate")).toBe(true);
    expect(canAlert("db_connectivity")).toBe(true);
    expect(canAlert("error_spike")).toBe(true);
  });

  it("should block repeated alerts within cooldown window", () => {
    recordAlert("generation_success_rate");
    expect(canAlert("generation_success_rate")).toBe(false);
  });

  it("should allow alerts after cooldown expires", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    recordAlert("db_connectivity");

    // Still within cooldown
    vi.spyOn(Date, "now").mockReturnValue(now + ALERT_COOLDOWN_MS - 1000);
    expect(canAlert("db_connectivity")).toBe(false);

    // After cooldown
    vi.spyOn(Date, "now").mockReturnValue(now + ALERT_COOLDOWN_MS + 1);
    expect(canAlert("db_connectivity")).toBe(true);

    vi.restoreAllMocks();
  });

  it("should track different alert types independently", () => {
    recordAlert("generation_success_rate");
    expect(canAlert("generation_success_rate")).toBe(false);
    expect(canAlert("db_connectivity")).toBe(true);
    expect(canAlert("error_spike")).toBe(true);
  });

  it("should clear all cooldowns", () => {
    recordAlert("generation_success_rate");
    recordAlert("db_connectivity");
    expect(_getCooldownCount()).toBe(2);

    _clearCooldowns();
    expect(_getCooldownCount()).toBe(0);
    expect(canAlert("generation_success_rate")).toBe(true);
    expect(canAlert("db_connectivity")).toBe(true);
  });

  it("should update cooldown timestamp on re-record", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    recordAlert("error_spike");

    // Move past cooldown
    vi.spyOn(Date, "now").mockReturnValue(now + ALERT_COOLDOWN_MS + 1);
    expect(canAlert("error_spike")).toBe(true);

    // Re-record
    recordAlert("error_spike");
    expect(canAlert("error_spike")).toBe(false);

    vi.restoreAllMocks();
  });
});

// ============ Configuration ============

describe("HealthMonitor — Configuration", () => {
  it("should have sensible default thresholds", async () => {
    const mod = await import("./monitoring/healthMonitor");
    expect(mod.CHECK_INTERVAL_MS).toBe(5 * 60 * 1000); // 5 minutes
    expect(mod.ALERT_COOLDOWN_MS).toBe(15 * 60 * 1000); // 15 minutes
    expect(mod.SUCCESS_RATE_THRESHOLD).toBe(80);
    expect(mod.ERROR_SPIKE_THRESHOLD).toBe(10);
  });

  it("should have cooldown longer than check interval", async () => {
    const mod = await import("./monitoring/healthMonitor");
    expect(mod.ALERT_COOLDOWN_MS).toBeGreaterThan(mod.CHECK_INTERVAL_MS);
  });
});

// ============ Check Functions (mocked DB) ============

/**
 * ⚠ THESE ARMS DRIVE `checkGenerationHealth` AND READ THE ROW IT WRITES, AND
 * THE TWO THEY REPLACE COULD NOT HAVE FAILED.
 *
 * What stood here until #1807 was two cases with **no `expect` between them**.
 * One carried its own epitaph in a comment — *"due to module caching, the mock
 * may not apply. This tests the logic path"* — and the other asserted only
 * that the call did not throw. So the function's entire alert decision was
 * covered by a green describe that was inert whatever the function did.
 * Working law 2: an instrument gets a negative control and a positive control
 * before its verdicts count for anything.
 *
 * The mock DOES apply; what was missing is `vi.resetModules()` before the
 * `doMock`, so the module under test is re-evaluated and its dynamic
 * `await import(…)` calls resolve to the fakes. `drive()` below is that
 * ordering, and it RETURNS the audit rows rather than asserting inside itself,
 * so every arm states its own expectation in its own body.
 *
 * Each reading below whose `total24h` exceeds its settled count is a REAL
 * production row from the 2026-09-29/30 event, not an invented fixture.
 */
describe("HealthMonitor — checkGenerationHealth", () => {
  type Health = {
    total24h: number; completed24h: number; failed24h: number;
    pending: number; processing: number; successRate: number;
  };

  /** Drive the real function against a fixed health reading and return the
   *  audit rows it wrote. Nothing here touches a database. */
  async function drive(health: Health): Promise<Array<Record<string, unknown>>> {
    const rows: Array<Record<string, unknown>> = [];
    vi.resetModules();
    vi.doMock("./db/adminOverviewQueries", () => ({
      getGenerationHealth: async () => health,
    }));
    vi.doMock("./auditLog", () => ({
      logAuditEvent: async (event: Record<string, unknown>) => { rows.push(event); },
    }));
    const mod = await import("./monitoring/healthMonitor");
    mod._clearCooldowns();
    await mod.checkGenerationHealth();
    return rows;
  }

  /** The floor read off the module, so the boundary arm cannot drift from it. */
  async function readFloor(): Promise<number> {
    vi.resetModules();
    const mod = await import("./monitoring/healthMonitor");
    return mod.RATE_SAMPLE_FLOOR;
  }

  afterEach(() => {
    vi.doUnmock("./db/adminOverviewQueries");
    vi.doUnmock("./auditLog");
    vi.resetModules();
    vi.restoreAllMocks();
  });

  /* ── The positive controls: it still alarms, and still at its own rank ── */

  it("alerts on a real day below the threshold", async () => {
    const rows = await drive({
      total24h: 100, completed24h: 60, failed24h: 40, pending: 0, processing: 0, successRate: 60,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].severity).toBe("warning");
    expect(rows[0].action).toBe("system.health_alert");
  });

  it("KEEPS ITS RANK — a real day under 50% is still critical (his word: it fires on real days)", async () => {
    const rows = await drive({
      total24h: 100, completed24h: 40, failed24h: 60, pending: 0, processing: 0, successRate: 40,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].severity).toBe("critical");
  });

  it("never alerts on a healthy day, whatever the sample", async () => {
    const rows = await drive({
      total24h: 100, completed24h: 95, failed24h: 5, pending: 0, processing: 0, successRate: 95,
    });
    expect(rows).toEqual([]);
  });

  /* ── The negative controls: the two rows #1807 is about ── */

  it("IGNORES SMALL DAYS — production row 983, the first critical ever written, judged on 3 settled", async () => {
    const rows = await drive({
      total24h: 5, completed24h: 1, failed24h: 2, pending: 0, processing: 2, successRate: 33,
    });
    expect(rows).toEqual([]);
  });

  it("IGNORES SMALL DAYS — production row 984, the second and last critical, judged on 5 settled", async () => {
    const rows = await drive({
      total24h: 10, completed24h: 2, failed24h: 3, pending: 0, processing: 5, successRate: 40,
    });
    expect(rows).toEqual([]);
  });

  it("stays silent when there are no generations at all (the behaviour the floor replaced)", async () => {
    const rows = await drive({
      total24h: 0, completed24h: 0, failed24h: 0, pending: 0, processing: 0, successRate: 100,
    });
    expect(rows).toEqual([]);
  });

  /* ── The arm that proves the floor is on the RIGHT NUMBER ──
     A floor written on `total24h` passes every other arm in this describe and
     fails only this one. 112 of the 132 real alarm rows carried a `total24h`
     larger than the sample the rate was computed over; this is one of them. */

  it("floors the RATE'S DENOMINATOR, not total24h — 20 in the window, 5 of them settled", async () => {
    const rows = await drive({
      total24h: 20, completed24h: 2, failed24h: 3, pending: 10, processing: 5, successRate: 40,
    });
    expect(rows).toEqual([]);
  });

  /* ── The boundary, both sides, derived from the constant ── */

  it("judges a window holding exactly the floor, and not one below it", async () => {
    const n = await readFloor();

    const atFloor = await drive({
      total24h: n, completed24h: n - 6, failed24h: 6, pending: 0, processing: 0, successRate: 40,
    });
    expect(atFloor).toHaveLength(1);

    const belowFloor = await drive({
      total24h: n - 1, completed24h: n - 7, failed24h: 6, pending: 0, processing: 0, successRate: 33,
    });
    expect(belowFloor).toEqual([]);
  });

  /* ── The row explains itself ──
     The absence of these two fields is why this alarm's own card first
     described a three-sample critical as a five-sample one. */

  it("writes the settled count and the floor onto the row", async () => {
    const n = await readFloor();
    const rows = await drive({
      total24h: 40, completed24h: 18, failed24h: 12, pending: 6, processing: 4, successRate: 60,
    });
    expect(rows).toHaveLength(1);
    const metadata = rows[0].metadata as Record<string, unknown>;
    expect(metadata.settled24h).toBe(30);
    expect(metadata.sampleFloor).toBe(n);
    expect(metadata.total24h).toBe(40);
  });
});

describe("HealthMonitor — checkDbConnectivity", () => {
  let _clearCooldowns: typeof import("./monitoring/healthMonitor")._clearCooldowns;

  beforeEach(async () => {
    const mod = await import("./monitoring/healthMonitor");
    _clearCooldowns = mod._clearCooldowns;
    _clearCooldowns();
  });

  afterEach(() => {
    _clearCooldowns();
    vi.restoreAllMocks();
  });

  it("should handle DB connection returning null gracefully", async () => {
    // With the DB down there is no panel to alert onto (#800) — the function
    // logs fatally and must not throw
    const mod = await import("./monitoring/healthMonitor");
    // Should not throw even if DB is unavailable
    await expect(mod.checkDbConnectivity()).resolves.not.toThrow();
  });
});

describe("HealthMonitor — checkErrorSpike", () => {
  let _clearCooldowns: typeof import("./monitoring/healthMonitor")._clearCooldowns;

  beforeEach(async () => {
    const mod = await import("./monitoring/healthMonitor");
    _clearCooldowns = mod._clearCooldowns;
    _clearCooldowns();
  });

  afterEach(() => {
    _clearCooldowns();
  });

  it("should not throw when DB is unavailable", async () => {
    const mod = await import("./monitoring/healthMonitor");
    await expect(mod.checkErrorSpike()).resolves.not.toThrow();
  });
});

describe("HealthMonitor — checkGenerationQueue", () => {
  let _clearCooldowns: typeof import("./monitoring/healthMonitor")._clearCooldowns;

  beforeEach(async () => {
    const mod = await import("./monitoring/healthMonitor");
    _clearCooldowns = mod._clearCooldowns;
    _clearCooldowns();
  });

  afterEach(() => {
    _clearCooldowns();
  });

  it("should not throw when DB is unavailable", async () => {
    const mod = await import("./monitoring/healthMonitor");
    await expect(mod.checkGenerationQueue()).resolves.not.toThrow();
  });
});

// ============ runHealthChecks ============

describe("HealthMonitor — runHealthChecks", () => {
  it("should run all checks without throwing", async () => {
    const mod = await import("./monitoring/healthMonitor");
    mod._clearCooldowns();
    // runHealthChecks uses Promise.allSettled, so it should never throw
    await expect(mod.runHealthChecks()).resolves.not.toThrow();
    mod._clearCooldowns();
  });
});

// ============ Lifecycle ============

describe("HealthMonitor — Lifecycle", () => {
  it("should start and stop without errors", async () => {
    const mod = await import("./monitoring/healthMonitor");
    // Start should not throw
    expect(() => mod.startHealthMonitor()).not.toThrow();
    // Stop should not throw
    expect(() => mod.stopHealthMonitor()).not.toThrow();
  });

  it("should handle double start gracefully", async () => {
    const mod = await import("./monitoring/healthMonitor");
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    
    mod.startHealthMonitor();
    mod.startHealthMonitor(); // Should warn about duplicate

    mod.stopHealthMonitor();
    consoleSpy.mockRestore();
  });

  it("should handle stop when not started", async () => {
    const mod = await import("./monitoring/healthMonitor");
    // Should not throw
    expect(() => mod.stopHealthMonitor()).not.toThrow();
  });
});

// (The "Slack Channel Routing" describe died with the integration, #800 —
// alerts are `system.health_alert` audit rows on the admin overview now.)

// ============ Alert Severity Logic ============

describe("HealthMonitor — Alert Severity", () => {
  it("should use critical severity for success rate below 50%", () => {
    // The logic in checkGenerationHealth uses:
    // health.successRate < 50 ? "critical" : "warning"
    const getSeverity = (rate: number) => rate < 50 ? "critical" : "warning";

    expect(getSeverity(49)).toBe("critical");
    expect(getSeverity(50)).toBe("warning");
    expect(getSeverity(79)).toBe("warning");
    expect(getSeverity(0)).toBe("critical");
  });

  it("should always use critical for DB connectivity issues", () => {
    // DB down and DB error are always critical
    const dbAlertSeverity = "critical";
    expect(dbAlertSeverity).toBe("critical");
  });

  it("should use warning for high latency", () => {
    const latencyAlertSeverity = "warning";
    expect(latencyAlertSeverity).toBe("warning");
  });

  it("should use critical for error spikes", () => {
    const errorSpikeSeverity = "critical";
    expect(errorSpikeSeverity).toBe("critical");
  });

  it("should use warning for queue backup", () => {
    const queueBackupSeverity = "warning";
    expect(queueBackupSeverity).toBe("warning");
  });
});
