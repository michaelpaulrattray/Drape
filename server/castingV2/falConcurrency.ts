/**
 * THE ACCOUNT HAS TWENTY CONCURRENT REQUESTS, AND THE SCAN NEVER KNEW
 * (fable-505/506 — the founder's panels missing eyes, brows and ears).
 *
 * # What was measured
 *
 * His fresh casts showed five rows where eight belong. Re-driven on his own
 * frames the segmenter finds everything and the panel composes all eight, so
 * neither was blind. Driving production's own `faceScan` for eight fresh faces
 * AT ONCE — which is one minute of clicking through a new roll — reproduced it
 * exactly:
 *
 * ```
 * one at a time   Eyes · Brows · Nose · Lips · Ears · Hair · Build · Skin
 * eight at once   5 of 8 faces returned NO ROWS AT ALL; two returned one or two
 * ```
 *
 * And the container said why, in the provider's own words:
 *
 * ```
 * 429 {"detail":"Reached concurrent requests limit of 20",
 *      "type":"concurrent_requests_limit"}
 * ```
 *
 * A scan asks eleven questions at once, and every BILATERAL one becomes two
 * more (a half-frame each), so a single panel is already near the ceiling and a
 * second panel goes straight through it. Each failure was swallowed per region
 * — a scan is a courtesy, so a failed read costs nothing and shows nothing —
 * which is why it surfaced as *features quietly missing* rather than an error.
 *
 * # What this does
 *
 * Two things, and nothing clever:
 *
 *  1. **A gate.** Every fal call waits for one of `FAL_CONCURRENCY` slots, so a
 *     burst QUEUES instead of failing. A read that takes two seconds longer is
 *     a row on the panel; a read that 429s is a feature the customer is told
 *     she does not have.
 *  2. **A retry, only for the limit.** The provider names this failure as a
 *     concurrency ceiling, which is by definition transient, so it is worth
 *     waiting out — with a cap, and with jitter so the queue does not
 *     re-collide. Every other status fails immediately, because a 400 does not
 *     improve on the second ask.
 *
 * The default is deliberately below the ceiling rather than at it: the roll
 * engine's own image dispatch runs against the SAME account limit, so the
 * segmenter may not spend the whole allowance even when it is alone.
 */
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("castingV2/falConcurrency");

/** How many fal calls this process may have in flight at once. */
export function falConcurrencyLimit(): number {
  const raw = Number(process.env.FAL_CONCURRENCY ?? "6");
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 6;
}

/** How many times a concurrency 429 is waited out before it becomes a failure. */
export const LIMIT_RETRIES = 4;

/** The provider's own name for the one failure worth retrying. */
export const CONCURRENCY_LIMIT_MARKER = "concurrent_requests_limit";

export function isConcurrencyLimit(error: unknown): boolean {
  return String(error instanceof Error ? error.message : error).includes(CONCURRENCY_LIMIT_MARKER);
}

let inFlight = 0;
const waiting: Array<() => void> = [];

/** For the report and the tests — never a decision. */
export function falGateStats(): { inFlight: number; waiting: number; limit: number } {
  return { inFlight, waiting: waiting.length, limit: falConcurrencyLimit() };
}

async function acquire(): Promise<void> {
  if (inFlight < falConcurrencyLimit()) {
    inFlight += 1;
    return;
  }
  await new Promise<void>((resolve) => waiting.push(resolve));
  inFlight += 1;
}

function release(): void {
  inFlight -= 1;
  const next = waiting.shift();
  if (next) next();
}

/**
 * Run one fal call inside the gate, waiting out a concurrency 429.
 *
 * `sleep` is injected so the retry can be driven without a real clock — a
 * backoff tested through `setTimeout` is a test that waits, and a test that
 * waits gets shortened until it proves nothing.
 */
export async function throughFalGate<T>(
  call: () => Promise<T>,
  options: { sleep?: (ms: number) => Promise<void>; jitter?: () => number } = {},
): Promise<T> {
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const jitter = options.jitter ?? (() => 0.5);

  for (let attempt = 0; ; attempt += 1) {
    /* The slot is held for the CALL and released before any wait — sleeping
       inside a slot would starve the very queue the wait is for. */
    let outcome: { ok: true; value: T } | { ok: false; error: unknown };
    await acquire();
    try {
      outcome = { ok: true, value: await call() };
    } catch (error) {
      outcome = { ok: false, error };
    } finally {
      release();
    }
    if (outcome.ok) return outcome.value;
    if (!isConcurrencyLimit(outcome.error) || attempt >= LIMIT_RETRIES) throw outcome.error;
    const wait = Math.round(250 * 2 ** attempt * (0.5 + jitter()));
    log.warn({ attempt: attempt + 1, waitMs: wait }, "[falGate] the account's concurrency ceiling — waiting");
    await sleep(wait);
  }
}
