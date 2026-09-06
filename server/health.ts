/**
 * Deep-Check Health Endpoint
 *
 * Verifies database connectivity with latency measurement.
 * Returns server uptime, DB status, and timestamp.
 * Rate-limited to prevent abuse (10 req/min per IP).
 */

import type { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { deployedCommitSha } from "./_core/env";
import { getDb } from "./db/connection";
import { checkRateLimit } from "./security/rateLimit";
import { getClientIp } from "./security/rateLimit";

const RATE_LIMIT_CONFIG = {
  windowMs: 60_000, // 1 minute
  // 30, not 10: this endpoint becomes Railway's healthcheck path (#508), and
  // the checker (hostname healthcheck.railway.app) polls during a deploy's
  // cutover window. A checker starved into a 429 reads as an unhealthy build
  // and fails the deploy spuriously. The work per hit is one SELECT 1.
  maxRequests: 30,
  keyPrefix: "health",
};

export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  uptime: number;
  timestamp: string;
  /**
   * The commit this process was built from (Railway's stamp), `null` off the
   * platform. Public on purpose (#508): it lets any caller tell WHICH tree
   * answered, which a 200 alone never could — the #296 trap class. A commit
   * sha of a private repository discloses nothing by itself.
   */
  build: string | null;
  checks: {
    database: {
      status: "up" | "down";
      latencyMs: number;
      error?: string;
    };
  };
}

/**
 * Ping the database with a lightweight query and measure round-trip latency.
 */
export async function checkDatabase(): Promise<{
  status: "up" | "down";
  latencyMs: number;
  error?: string;
}> {
  const start = performance.now();
  try {
    const db = await getDb();
    if (!db) {
      return { status: "down", latencyMs: 0, error: "No database connection" };
    }
    await db.execute(sql`SELECT 1`);
    const latencyMs = Math.round((performance.now() - start) * 100) / 100;
    return { status: "up", latencyMs };
  } catch (err) {
    const latencyMs = Math.round((performance.now() - start) * 100) / 100;
    return {
      status: "down",
      latencyMs,
      error: err instanceof Error ? err.message : "Unknown database error",
    };
  }
}

/**
 * Derive overall status from individual check results.
 */
export function deriveOverallStatus(
  dbStatus: "up" | "down"
): "healthy" | "degraded" | "unhealthy" {
  if (dbStatus === "up") return "healthy";
  return "unhealthy";
}

/**
 * Express route handler for GET /api/health
 */
export async function healthHandler(req: Request, res: Response): Promise<void> {
  // Rate limit
  const ip = getClientIp(req);
  const rateCheck = checkRateLimit(ip, RATE_LIMIT_CONFIG);
  if (!rateCheck.allowed) {
    res.status(429).json({
      error: "Too many health check requests",
      retryAfterMs: rateCheck.resetIn,
    });
    return;
  }

  const dbCheck = await checkDatabase();
  const overallStatus = deriveOverallStatus(dbCheck.status);

  const result: HealthCheckResult = {
    status: overallStatus,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    build: deployedCommitSha(),
    checks: {
      database: dbCheck,
    },
  };

  const httpStatus = overallStatus === "healthy" ? 200 : 503;
  res.status(httpStatus).json(result);
}
