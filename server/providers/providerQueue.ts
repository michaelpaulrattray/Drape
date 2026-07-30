import pLimit from "p-limit";

import { createModuleLogger } from "../logging/logger";
import { ProviderError, isRetryable, type ProviderFailureClass } from "./types";

const log = createModuleLogger("providers/providerQueue");

/**
 * Per-provider admission control (plan §H.8, §E).
 *
 * A generalization of the *pattern* proven by `server/casting/geminiQueue.ts`
 * and `geminiCircuitBreaker.ts` — deliberately a new module rather than a
 * refactor of those. Gemini's queue is live in production serving the legacy
 * flow; it keeps its own until M14, so this carries zero risk to what is
 * running today.
 *
 * Three jobs:
 *   - a concurrency budget per provider, so eight parallel candidates cannot
 *     become eighty;
 *   - a queue-depth cap, so pressure produces an honest refusal at roll
 *     creation rather than an unbounded backlog of paid work (§H.8);
 *   - a circuit breaker per provider, so a provider having a bad day refuses
 *     new rolls instead of burning credits into a wall.
 *
 * Admission refusal is `capability`-classed and non-retryable on purpose: the
 * caller must surface a real `TOO_MANY_REQUESTS` (invariant 6), not silently
 * enqueue spend.
 */

export type ProviderQueueConfig = {
  name: string;
  concurrency: number;
  maxQueueDepth: number;
  /** Consecutive failures before the breaker opens. */
  failureThreshold?: number;
  /** How long the breaker stays open before allowing one probe. */
  cooldownMs?: number;
};

type BreakerState = "closed" | "open" | "half-open";

export class ProviderQueue {
  private readonly limiter: ReturnType<typeof pLimit>;
  private readonly config: Required<ProviderQueueConfig>;
  private depth = 0;
  private breaker: BreakerState = "closed";
  private consecutiveFailures = 0;
  private openedAt = 0;

  constructor(config: ProviderQueueConfig) {
    this.config = {
      failureThreshold: 5,
      cooldownMs: 30_000,
      ...config,
    };
    this.limiter = pLimit(this.config.concurrency);
  }

  /**
   * Runs `task` under this provider's budget.
   *
   * Throws before dispatching — never after — when the breaker is open or the
   * queue is full, so a refused call has provably cost nothing.
   */
  async run<T>(label: string, task: () => Promise<T>): Promise<T> {
    this.admit(label);

    this.depth += 1;
    try {
      const result = await this.limiter(task);
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error);
      throw error;
    } finally {
      this.depth -= 1;
    }
  }

  private admit(label: string): void {
    if (this.breaker === "open") {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed < this.config.cooldownMs) {
        throw new ProviderError(
          "capability",
          `${this.config.name} is temporarily unavailable`,
        );
      }
      // One probe is allowed through; its outcome decides the breaker.
      this.breaker = "half-open";
      log.info({ provider: this.config.name }, "[ProviderQueue] breaker half-open — probing");
    }

    if (this.depth >= this.config.maxQueueDepth) {
      log.warn(
        { provider: this.config.name, depth: this.depth, label },
        "[ProviderQueue] admission refused — queue full",
      );
      throw new ProviderError("capability", `${this.config.name} is busy`);
    }
  }

  private recordSuccess(): void {
    if (this.breaker === "half-open") {
      log.info({ provider: this.config.name }, "[ProviderQueue] breaker closed — probe succeeded");
    }
    this.breaker = "closed";
    this.consecutiveFailures = 0;
  }

  private recordFailure(error: unknown): void {
    const failureClass: ProviderFailureClass =
      error instanceof ProviderError ? error.failureClass : "unknown";

    // A refusal the provider made about *this request* — bad content, an
    // unsupported ask — says nothing about provider health. Counting it would
    // let a run of policy refusals trip the breaker for everyone.
    if (failureClass === "content_policy" || failureClass === "capability") return;

    this.consecutiveFailures += 1;
    if (this.breaker === "half-open" || this.consecutiveFailures >= this.config.failureThreshold) {
      this.breaker = "open";
      this.openedAt = Date.now();
      log.error(
        { provider: this.config.name, consecutiveFailures: this.consecutiveFailures, failureClass },
        "[ProviderQueue] breaker opened",
      );
    }
  }

  stats() {
    return {
      provider: this.config.name,
      depth: this.depth,
      concurrency: this.config.concurrency,
      maxQueueDepth: this.config.maxQueueDepth,
      breaker: this.breaker,
      consecutiveFailures: this.consecutiveFailures,
    };
  }
}

/**
 * Retry with exponential backoff, within the caller's existing budget (§H.5).
 *
 * Never charges again and never duplicates a stored image: the caller owns the
 * attempt-scoped storage key, and landing is idempotent per candidate. Only
 * retryable classes are retried; everything else fails immediately so the
 * refund path runs without burning time.
 */
export async function withRetry<T>(
  label: string,
  attempt: () => Promise<T>,
  options: { retries?: number; baseDelayMs?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const retries = options.retries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 500;

  let lastError: unknown;
  for (let tryIndex = 0; tryIndex <= retries; tryIndex += 1) {
    if (options.signal?.aborted) {
      throw new ProviderError("capability", "cancelled before dispatch");
    }
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
      const failureClass =
        error instanceof ProviderError ? error.failureClass : ("unknown" as ProviderFailureClass);
      if (!isRetryable(failureClass) || tryIndex === retries) throw error;

      const delay = baseDelayMs * 2 ** tryIndex;
      log.warn(
        { label, failureClass, attempt: tryIndex + 1, delay },
        "[ProviderQueue] retrying after retryable failure",
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
