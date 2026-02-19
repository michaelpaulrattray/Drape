/**
 * Request Correlation ID Middleware
 *
 * Assigns a unique correlation ID to every incoming HTTP request.
 * The ID is:
 *   1. Read from the `X-Request-ID` header if provided by an upstream proxy/LB
 *   2. Generated as a compact UUID v4 if absent
 *   3. Attached to `req.correlationId` for server-side access
 *   4. Echoed back in the `X-Request-ID` response header for client tracing
 *
 * Format: `req_<12-char-hex>` (e.g., `req_a1b2c3d4e5f6`)
 * Total length: 16 characters — compact enough for log lines, unique enough
 * for production traffic (4.7 × 10^14 combinations).
 */

import { randomBytes } from "crypto";
import type { Request, Response, NextFunction } from "express";

const HEADER_NAME = "X-Request-ID";
const PREFIX = "req_";

/**
 * Validate that an incoming correlation ID looks safe (alphanumeric + dashes/underscores, max 64 chars).
 */
function isValidCorrelationId(value: string): boolean {
  return /^[\w-]{1,64}$/.test(value);
}

/**
 * Generate a new correlation ID.
 */
function generateCorrelationId(): string {
  return PREFIX + randomBytes(6).toString("hex"); // 12 hex chars
}

/**
 * Express middleware that attaches a correlation ID to every request.
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers[HEADER_NAME.toLowerCase()] as string | undefined;

  const correlationId =
    incoming && isValidCorrelationId(incoming) ? incoming : generateCorrelationId();

  // Attach to request for downstream access
  (req as any).correlationId = correlationId;

  // Echo back in response
  res.setHeader(HEADER_NAME, correlationId);

  next();
}

/**
 * Helper to extract the correlation ID from a request object.
 * Falls back to "unknown" if not set (should never happen with middleware active).
 */
export function getCorrelationId(req: Request): string {
  return (req as any).correlationId ?? "unknown";
}
