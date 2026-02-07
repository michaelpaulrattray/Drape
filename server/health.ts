/**
 * Deep-Check Health Endpoint
 *
 * Verifies database connectivity with latency measurement.
 * Returns server uptime, DB status, and timestamp.
 * Rate-limited to prevent abuse (10 req/min per IP).
 */

import type { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { getDb } from "./db/connection";
import { checkRateLimit } from "./security/rateLimit";
import { getClientIp } from "./security/rateLimit";

const RATE_LIMIT_CONFIG = {
  windowMs: 60_000, // 1 minute
  maxRequests: 10,
  keyPrefix: "health",
};

export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  uptime: number;
  timestamp: string;
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
    checks: {
      database: dbCheck,
    },
  };

  const httpStatus = overallStatus === "healthy" ? 200 : 503;
  res.status(httpStatus).json(result);
}
