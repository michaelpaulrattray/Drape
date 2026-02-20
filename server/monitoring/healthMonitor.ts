/**
 * Health Monitor — Periodic system health checks with Slack alerting.
 *
 * Runs every 5 minutes and checks:
 *   1. Generation success rate (24h) — alerts when below threshold
 *   2. DB connectivity — alerts on connection failure
 *   3. Error spike detection — alerts when critical audit events spike
 *
 * Uses a 15-minute cooldown per alert type to prevent spam.
 */

import { dispatch } from "../slack/slackDispatcher";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("monitoring/healthMonitor");

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
      await dispatch({
        type: "system_health_generation_rate",
        title: "Generation Success Rate Below Threshold",
        description: `The 24-hour generation success rate has dropped to *${health.successRate}%* (threshold: ${SUCCESS_RATE_THRESHOLD}%).`,
        severity: health.successRate < 50 ? "critical" : "warning",
        fields: [
          { title: "Success Rate", value: `${health.successRate}%`, short: true },
          { title: "Total (24h)", value: `${health.total24h}`, short: true },
          { title: "Completed", value: `${health.completed24h}`, short: true },
          { title: "Failed", value: `${health.failed24h}`, short: true },
          { title: "Pending", value: `${health.pending}`, short: true },
          { title: "Processing", value: `${health.processing}`, short: true },
        ],
        channels: ["system-alerts"],
        skipDedup: true,
      });
      recordAlert(alertType);
      log.info(`[HealthMonitor] Alert sent: generation success rate ${health.successRate}%`);
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
      await dispatch({
        type: "system_health_db_down",
        title: "Database Connection Unavailable",
        description: "The database connection pool returned null. The application cannot serve data until connectivity is restored.",
        severity: "critical",
        channels: ["system-alerts"],
        skipDedup: true,
      });
      recordAlert(alertType);
      log.info("[HealthMonitor] Alert sent: DB connection unavailable");
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

      await dispatch({
        type: "system_health_db_latency",
        title: "Database Latency Critically High",
        description: `Database ping latency is *${latencyMs}ms* (>5000ms threshold). This may indicate connection pool exhaustion or database overload.`,
        severity: "warning",
        fields: [
          { title: "Latency", value: `${latencyMs}ms`, short: true },
          { title: "Threshold", value: "5000ms", short: true },
        ],
        channels: ["system-alerts"],
        skipDedup: true,
      });
      recordAlert(latencyAlertType);
      log.info(`[HealthMonitor] Alert sent: DB latency ${latencyMs}ms`);
    }
  } catch (error) {
    // DB query itself failed — critical alert
    await dispatch({
      type: "system_health_db_error",
      title: "Database Query Failed",
      description: `A health check query to the database failed with: \`${error instanceof Error ? error.message : String(error)}\``,
      severity: "critical",
      channels: ["system-alerts"],
      skipDedup: true,
    });
    recordAlert(alertType);
    log.error({ err: error }, "[HealthMonitor] Alert sent: DB query failed:");
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
      await dispatch({
        type: "system_health_error_spike",
        title: "Critical Event Spike Detected",
        description: `*${criticalCount}* critical audit events logged in the last hour (threshold: ${ERROR_SPIKE_THRESHOLD}). This may indicate a security incident, system failure, or abuse pattern.`,
        severity: "critical",
        fields: [
          { title: "Critical Events (1h)", value: `${criticalCount}`, short: true },
          { title: "Threshold", value: `${ERROR_SPIKE_THRESHOLD}`, short: true },
        ],
        channels: ["system-alerts"],
        skipDedup: true,
      });
      recordAlert(alertType);
      log.info(`[HealthMonitor] Alert sent: ${criticalCount} critical events in 1h`);
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
      await dispatch({
        type: "system_health_queue_backup",
        title: "Generation Queue Backup",
        description: `There are *${queueSize}* generations in the queue (${health.pending} pending, ${health.processing} processing). This may indicate a processing bottleneck.`,
        severity: "warning",
        fields: [
          { title: "Pending", value: `${health.pending}`, short: true },
          { title: "Processing", value: `${health.processing}`, short: true },
          { title: "Failed (24h)", value: `${health.failed24h}`, short: true },
        ],
        channels: ["system-alerts"],
        skipDedup: true,
      });
      recordAlert(alertType);
      log.info(`[HealthMonitor] Alert sent: queue backup ${queueSize} items`);
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
