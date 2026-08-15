/**
 * WHEN DID THE PRODUCTION PROCESS START? — one implementation, because two
 * private copies of this arithmetic had already drifted apart.
 *
 * The anchor exists to answer a single question across shifts: is the process
 * answering /api/health the same one the last shift saw, or did it restart?
 * Park blocks quote it, retire old values, and read a change as a restart.
 *
 * It was computed in two places as
 *
 *     Date.now() - healths[0].uptime
 *
 * where the uptime came from the FIRST of three health reads but `Date.now()`
 * ran after the read loop, which sleeps between reads. That subtracts an uptime
 * sampled at time T from a clock read at time T+delta, so the anchor lands late
 * by delta — the sleeps plus however long the network took. `deploy-rite.mts`
 * slept 2x3000ms and `park-state.mts` 2x2000ms, so the two instruments were
 * biased by different amounts and disagreed about one unmoving process.
 *
 * Measured against production on 2026-08-16 (six reads, one process):
 *
 *     honest anchor   2026-08-15T23:13:43.726Z   spread 0 ms across all six
 *     deploy-rite     late by 8.009 s
 *     park-state      late by 6.059 s
 *     the two shipped instruments disagreed with each other by 1.950 s
 *
 * The payload already carries the fix: `timestamp` and `uptime` are adjacent
 * fields of one object literal in `server/health.ts:91`, taken from the same
 * clock at the same instant. Subtracting them uses no local clock at all, so
 * the result is immune both to the delay above and to any skew on the machine
 * running the script.
 */

/** The two fields of /api/health this derivation needs. */
export type HealthReading = {
  /** `process.uptime()` on the server, seconds. */
  uptime: number;
  /** ISO string taken on the server in the same object literal as `uptime`. */
  timestamp: string;
};

/**
 * The instant the process started, as an ISO string.
 *
 * Depends ONLY on the reading — never on when it is called. That invariance is
 * the property under test in `server/uptimeAnchor.test.ts`, and it is the whole
 * difference from the shape it replaced.
 */
export function uptimeAnchor(reading: HealthReading): string {
  const observedAt = new Date(reading.timestamp).getTime();
  if (!Number.isFinite(observedAt)) throw new Error(`health timestamp unreadable: ${reading.timestamp}`);
  if (!Number.isFinite(reading.uptime)) throw new Error(`health uptime unreadable: ${reading.uptime}`);
  return new Date(observedAt - reading.uptime * 1000).toISOString();
}
