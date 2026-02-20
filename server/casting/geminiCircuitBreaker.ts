import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("casting/geminiCircuitBreaker");

/**
 * Gemini Circuit Breaker — Prevents cascading failures when Gemini API is down.
 *
 * States:
 *   CLOSED  → Normal operation. Failures are counted.
 *   OPEN    → API is considered down. All requests rejected immediately.
 *   HALF    → After cooldown, allow ONE probe request to test recovery.
 *
 * Transitions:
 *   CLOSED → OPEN:  When failure count hits FAILURE_THRESHOLD within WINDOW_MS
 *   OPEN   → HALF:  After COOLDOWN_MS elapses
 *   HALF   → CLOSED: If probe succeeds
 *   HALF   → OPEN:  If probe fails (reset cooldown timer)
 */

// ── Configuration ──────────────────────────────────────────────────────────
const FAILURE_THRESHOLD = 5; // Consecutive failures to trip
const WINDOW_MS = 60_000; // 60s failure window
const COOLDOWN_MS = 30_000; // 30s before allowing a probe

// ── State ──────────────────────────────────────────────────────────────────
type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

let state: CircuitState = "CLOSED";
let failureTimestamps: number[] = [];
let lastOpenedAt = 0;
let totalTrips = 0;

// ── Helpers ────────────────────────────────────────────────────────────────

function pruneOldFailures(): void {
  const cutoff = Date.now() - WINDOW_MS;
  failureTimestamps = failureTimestamps.filter((t) => t > cutoff);
}

function isRetryableError(error: any): boolean {
  const msg = error?.message || error?.toString() || "";
  return (
    msg.includes("429") ||
    msg.includes("500") ||
    msg.includes("503") ||
    msg.includes("timed out") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("fetch failed")
  );
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Record a successful Gemini call. Resets failure state.
 */
export function recordSuccess(): void {
  if (state === "HALF_OPEN") {
    log.info("[CircuitBreaker] Probe succeeded — closing circuit");
    state = "CLOSED";
    failureTimestamps = [];
  }
  // In CLOSED state, success is a no-op (already healthy)
}

/**
 * Record a failed Gemini call. May trip the breaker.
 */
export function recordFailure(error: any): void {
  if (!isRetryableError(error)) return; // Don't trip on validation errors

  const now = Date.now();

  if (state === "HALF_OPEN") {
    log.warn("[CircuitBreaker] Probe failed — reopening circuit");
    state = "OPEN";
    lastOpenedAt = now;
    totalTrips++;
    return;
  }

  // CLOSED state: track failures
  failureTimestamps.push(now);
  pruneOldFailures();

  if (failureTimestamps.length >= FAILURE_THRESHOLD) {
    log.warn(
      `[CircuitBreaker] ${failureTimestamps.length} failures in ${WINDOW_MS / 1000}s — OPENING circuit`,
    );
    state = "OPEN";
    lastOpenedAt = now;
    totalTrips++;
    failureTimestamps = [];
  }
}

/**
 * Check if a request should be allowed through.
 * Throws if the circuit is OPEN (with cooldown info).
 * Returns normally if CLOSED or HALF_OPEN (probe allowed).
 */
export function checkCircuit(): void {
  if (state === "CLOSED") return;

  if (state === "OPEN") {
    const elapsed = Date.now() - lastOpenedAt;
    if (elapsed >= COOLDOWN_MS) {
      log.info("[CircuitBreaker] Cooldown elapsed — entering HALF_OPEN for probe");
      state = "HALF_OPEN";
      return; // Allow the probe request
    }

    const remainingSec = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
    throw new Error(
      `AI engine temporarily unavailable. Automatic recovery in ~${remainingSec}s. Please try again shortly.`,
    );
  }

  // HALF_OPEN: allow the probe through
}

