/**
 * Health Monitor — periodic system health checks that alert onto the ADMIN
 * PANEL: each alert is a warning/critical `system.health_alert` audit row,
 * which the admin overview's alerts feed and the staff audit log both read.
 * (Until #800 these went to a Slack channel production never had.)
 *
 * Runs every 5 minutes and checks:
 *   1. Generation success rate (24h) — alerts when below threshold
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

    // Only alert if there are actual generations to evaluate
    if (health.total24h === 0) return;

    if (health.successRate < SUCCESS_RATE_THRESHOLD) {
      await recordHealthAlert({
        alertType,
        title: "Generation Success Rate Below Threshold",
        description: `The 24-hour generation success rate has dropped to ${health.successRate}% (threshold: ${SUCCESS_RATE_THRESHOLD}%).`,
        severity: health.successRate < 50 ? "critical" : "warning",
        metadata: {
          successRate: health.successRate,
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
