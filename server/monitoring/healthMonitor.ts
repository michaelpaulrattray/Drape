/**
 * Health Monitor — periodic system health checks that alert onto the ADMIN
 * PANEL: each alert is a warning/critical `system.health_alert` audit row,
 * which the admin overview's alerts feed and the staff audit log both read.
 * (Until #800 these went to a Slack channel production never had.)
 *
 * Runs every 5 minutes and checks:
 *   1. Generation success rate (24h) — alerts when below threshold, and only
 *      once the window holds `RATE_SAMPLE_FLOOR` settled generations (#1807,
 *      his "ignore small days")
 *   2. DB connectivity — alerts on high latency / query failure. ⚠ The
 *      DB-DOWN case cannot alert onto a panel a database serves: it stays a
 *      fatal log line, and that limit is stated here rather than shipped
 *      quietly.
 *   3. Error spike detection — alerts when critical audit events spike
 *
 * Uses a 15-minute cooldown per alert type to prevent spam.
 */

import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("monitoring/healthMonitor");

/**
 * Write one health alert as an audit row. Best-effort by construction:
 * `logAuditEvent` swallows its own failures, so the monitor can never take
 * the app down over a reporting failure.
 */
async function recordHealthAlert(options: {
  alertType: string;
  title: string;
  description: string;
  severity: "warning" | "critical";
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { logAuditEvent } = await import("../auditLog");
  const { AUDIT_ACTIONS } = await import("../../drizzle/schema");
  await logAuditEvent({
    userId: 0,
    action: AUDIT_ACTIONS.SYSTEM_HEALTH_ALERT,
    resourceType: "system",
    resourceId: options.alertType,
    metadata: { title: options.title, description: options.description, ...options.metadata },
    severity: options.severity,
  });
}

// ============ Configuration ============

/** How often to run health checks (ms) */
export const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/** Cooldown between repeated alerts of the same type (ms) */
export const ALERT_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

/** Generation success rate threshold — alert when below this % */
export const SUCCESS_RATE_THRESHOLD = 80;

/**
 * ⚠ THE SAMPLE FLOOR — "ignore small days" (his word, 2026-10-03, #1807,
 * verbatim and entire). Below this many SETTLED generations in the window the
 * rate is not judged at all.
 *
 * # Why the alarm needed one
 *
 * The threshold above is a percentage and nothing was asking how many jobs the
 * percentage was computed over. Measured on production the day this landed:
 * the audit log held **1,120 rows all time — 980 info, 138 warning, 2
 * critical**, and *both* criticals were this alarm. Before 2026-09-29 the table
 * had never carried a critical row at all, which means the only answer the
 * question "what was critical" has ever had is a rate computed on a handful of
 * jobs. **A severity level whose only occupant is a false alarm is one a reader
 * learns to skip**, and that is the cost — not the noise.
 *
 * # Why TEN, measured rather than guessed
 *
 * Production's own settled success rate is **94.7% lifetime (2,659 of 2,808)**
 * and 90.1% over the last 30 days, so against that baseline the chance a
 * HEALTHY window lands below 80% by luck alone is:
 *
 *   3 settled -> 15.1%     5 settled -> 2.5%
 *   10 settled -> 1.3%     15 settled -> 0.7%
 *
 * Ten is where the number starts meaning something. It is also the smallest
 * floor that removes **both** critical rows — they fired on denominators of
 * **3 and 5** — together with every alarm row computed on fewer than ten
 * settled jobs (22 of the 132).
 *
 * # The price, stated, and the alternative declined
 *
 * 15 of the 47 calendar days that have ever carried a generation hold fewer
 * than ten settled jobs, so about a third of days go unjudged — by
 * construction the days with nothing to judge. The median day is 16 settled
 * and is still judged, as are five of the six days in the whole record that
 * have ever been under 80%.
 *
 * **A floor of 20 was declined and it is the tempting one**, because it
 * silences all 132 rows. It also silences 60% of all days and five of those
 * six real dips — including 2026-09-29's five failures in fifteen, which
 * against a 94.7% baseline is a 0.7% event and is exactly the day the alarm
 * exists for. Fitting the floor to the rows we happen to dislike is not the
 * same as fixing the judgement.
 *
 * ⚠ **What this does NOT fix, said out loud: the 132 rows were one condition
 * holding for 28 hours and the alarm saying so every cooldown.** Collapsing
 * repeats to one row per window was option two of the three he was offered and
 * he did not pick it; it is not folded in here.
 */
export const RATE_SAMPLE_FLOOR = 10;

/** Critical audit events threshold — alert when more than this many in 1 hour */
export const ERROR_SPIKE_THRESHOLD = 10;

// ============ Cooldown Tracking ============

const lastAlertTimes: Map<string, number> = new Map();

export function canAlert(alertType: string): boolean {
  const lastSent = lastAlertTimes.get(alertType);
  if (!lastSent) return true;
  return Date.now() - lastSent >= ALERT_COOLDOWN_MS;
}

export function recordAlert(alertType: string): void {
  lastAlertTimes.set(alertType, Date.now());
}

export function _clearCooldowns(): void {
  lastAlertTimes.clear();
}

export function _getCooldownCount(): number {
  return lastAlertTimes.size;
}

// ============ Health Check Functions ============

/**
 * Check generation success rate and alert if below threshold.
 */
export async function checkGenerationHealth(): Promise<void> {
  const alertType = "generation_success_rate";
  if (!canAlert(alertType)) return;

  try {
    const { getGenerationHealth } = await import("../db/adminOverviewQueries");
    const health = await getGenerationHealth();

    /*
      ⚠ THE FLOOR IS ON THE RATE'S OWN DENOMINATOR, NOT ON `total24h`, AND
      THAT IS DRIVEN RATHER THAN ARGUED. `getGenerationHealth` counts
      `pending` and `processing` into `total24h` but divides only by
      `completed + failed`, so the two numbers are different questions.
      Measured over every alarm row this monitor has ever written: **112 of 132
      carried a `total24h` larger than the sample the rate was computed on**,
      and both critical rows are among them — `total24h 5 -> 3 settled` and
      `total24h 10 -> 5 settled`. A floor on `total24h` would therefore have
      judged the first critical on three jobs while believing it had five.

      This also subsumes the `total24h === 0` early return it replaces: no
      generations at all is zero settled, which is below any floor.
    */
    const settled24h = health.completed24h + health.failed24h;
    if (settled24h < RATE_SAMPLE_FLOOR) {
      /* `debug`, not `info`: this check runs every 5 minutes and the cooldown
         only starts once something has ALERTED, so an `info` line here would
         be its own feed of noise on every quiet day — the defect one level
         down. Production runs at `info`. */
      log.debug(
        `[HealthMonitor] Success rate not judged — ${settled24h} settled generations in 24h, floor is ${RATE_SAMPLE_FLOOR}`,
      );
      return;
    }

    if (health.successRate < SUCCESS_RATE_THRESHOLD) {
      await recordHealthAlert({
        alertType,
        title: "Generation Success Rate Below Threshold",
        description: `The 24-hour generation success rate has dropped to ${health.successRate}% (threshold: ${SUCCESS_RATE_THRESHOLD}%).`,
        severity: health.successRate < 50 ? "critical" : "warning",
        metadata: {
          successRate: health.successRate,
          /* The number the rate was actually computed over, and the floor it
             cleared — on the row, because the row is the only thing a reader
             has months later, and the absence of these two is why this
             alarm's own card first described a three-sample critical as a
             five-sample one. */
          settled24h,
          sampleFloor: RATE_SAMPLE_FLOOR,
          total24h: health.total24h,
          completed24h: health.completed24h,
          failed24h: health.failed24h,
          pending: health.pending,
          processing: health.processing,
        },
      });
      recordAlert(alertType);
      log.info(`[HealthMonitor] Alert recorded: generation success rate ${health.successRate}%`);
    }
  } catch (error) {
    log.error({ err: error }, "[HealthMonitor] Failed to check generation health:");
  }
}

/**
 * Check database connectivity and alert on failure.
 */
export async function checkDbConnectivity(): Promise<void> {
  const alertType = "db_connectivity";
  if (!canAlert(alertType)) return;

  try {
    const { getDb } = await import("../db/connection");
    const db = await getDb();

    if (!db) {
      // A panel alert is an audit row and audit rows live in the database
      // that just failed — this one case has no panel road, on purpose
      // rather than by omission. The fatal log line is the record.
      log.fatal("[HealthMonitor] Database connection unavailable — the application cannot serve data until connectivity is restored");
      recordAlert(alertType);
      return;
    }

    // Ping the database with a simple query
    const start = Date.now();
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`SELECT 1`);
    const latencyMs = Date.now() - start;

    // Alert if latency is extremely high (>5 seconds)
    if (latencyMs > 5000) {
      const latencyAlertType = "db_high_latency";
      if (!canAlert(latencyAlertType)) return;

      await recordHealthAlert({
        alertType: latencyAlertType,
        title: "Database Latency Critically High",
        description: `Database ping latency is ${latencyMs}ms (>5000ms threshold). This may indicate connection pool exhaustion or database overload.`,
        severity: "warning",
        metadata: { latencyMs, thresholdMs: 5000 },
      });
      recordAlert(latencyAlertType);
      log.info(`[HealthMonitor] Alert recorded: DB latency ${latencyMs}ms`);
    }
  } catch (error) {
    // DB query itself failed — the follow-up audit write is best-effort by
    // the same reasoning as the db-down case above
    await recordHealthAlert({
      alertType,
      title: "Database Query Failed",
      description: `A health check query to the database failed with: ${error instanceof Error ? error.message : String(error)}`,
      severity: "critical",
    });
    recordAlert(alertType);
    log.error({ err: error }, "[HealthMonitor] Alert recorded: DB query failed:");
  }
}

/**
 * Check for critical audit event spikes in the last hour.
 */
export async function checkErrorSpike(): Promise<void> {
  const alertType = "error_spike";
  if (!canAlert(alertType)) return;

  try {
    const { getDb } = await import("../db/connection");
    const db = await getDb();
    if (!db) return;

    const { sql } = await import("drizzle-orm");
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const [result] = await db.execute(
      sql`SELECT COUNT(*) as count FROM audit_logs WHERE severity = 'critical' AND createdAt >= ${oneHourAgo}`
    );

    const criticalCount = Number((result as any)?.count ?? 0);

    if (criticalCount >= ERROR_SPIKE_THRESHOLD) {
      await recordHealthAlert({
        alertType,
        title: "Critical Event Spike Detected",
        description: `${criticalCount} critical audit events logged in the last hour (threshold: ${ERROR_SPIKE_THRESHOLD}). This may indicate a security incident, system failure, or abuse pattern.`,
        severity: "critical",
        metadata: { criticalCount1h: criticalCount, threshold: ERROR_SPIKE_THRESHOLD },
      });
      recordAlert(alertType);
      log.info(`[HealthMonitor] Alert recorded: ${criticalCount} critical events in 1h`);
    }
  } catch (error) {
    log.error({ err: error }, "[HealthMonitor] Failed to check error spike:");
  }
}

/**
 * Check for high number of failed/pending generations (queue backup).
 */
export async function checkGenerationQueue(): Promise<void> {
  const alertType = "generation_queue_backup";
  if (!canAlert(alertType)) return;

  try {
    const { getGenerationHealth } = await import("../db/adminOverviewQueries");
    const health = await getGenerationHealth();

    // Alert if more than 20 pending or processing generations
    const queueSize = health.pending + health.processing;
    if (queueSize > 20) {
      await recordHealthAlert({
        alertType,
        title: "Generation Queue Backup",
        description: `There are ${queueSize} generations in the queue (${health.pending} pending, ${health.processing} processing). This may indicate a processing bottleneck.`,
        severity: "warning",
        metadata: { pending: health.pending, processing: health.processing, failed24h: health.failed24h },
      });
      recordAlert(alertType);
      log.info(`[HealthMonitor] Alert recorded: queue backup ${queueSize} items`);
    }
  } catch (error) {
    log.error({ err: error }, "[HealthMonitor] Failed to check generation queue:");
  }
}

// ============ Main Runner ============

/**
 * Run all health checks. Called periodically by the scheduler.
 */
export async function runHealthChecks(): Promise<void> {
  log.info("[HealthMonitor] Running health checks...");
  try {
    await Promise.allSettled([
      checkGenerationHealth(),
      checkDbConnectivity(),
      checkErrorSpike(),
      checkGenerationQueue(),
    ]);
    log.info("[HealthMonitor] Health checks complete");
  } catch (error) {
    log.error({ err: error }, "[HealthMonitor] Unexpected error in health checks:");
  }
}

// ============ Lifecycle ============

let healthCheckInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the periodic health monitor.
 * Called once during server startup.
 */
export function startHealthMonitor(): void {
  if (healthCheckInterval) {
    log.warn("[HealthMonitor] Already running, skipping duplicate start");
    return;
  }

  log.info(`[HealthMonitor] Starting (interval: ${CHECK_INTERVAL_MS / 1000}s, cooldown: ${ALERT_COOLDOWN_MS / 1000}s)`);

  // Run first check after 60s delay to let DB fully connect
  setTimeout(runHealthChecks, 60_000);

  // Then run every CHECK_INTERVAL_MS
  healthCheckInterval = setInterval(runHealthChecks, CHECK_INTERVAL_MS);

  // Don't block process exit
  if (healthCheckInterval.unref) healthCheckInterval.unref();
}

/**
 * Stop the periodic health monitor.
 * Called during graceful shutdown.
 */
export function stopHealthMonitor(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    log.info("[HealthMonitor] Stopped");
  }
}
