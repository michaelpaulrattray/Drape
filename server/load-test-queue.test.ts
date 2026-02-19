/**
 * Load Test — Gemini Queue & Circuit Breaker
 *
 * Simulates concurrent generation requests to verify:
 *   1. Queue concurrency limits are enforced (env-configurable)
 *   2. Overflow rejection triggers at MAX_QUEUE_DEPTH
 *   3. Circuit breaker trips after 5 retryable failures
 *   4. Circuit breaker rejects all requests while OPEN
 *   5. Queue stats report accurate active/pending counts
 *   6. Mixed image + text lanes operate independently
 *
 * These tests use mock delays (no real Gemini calls) to exercise
 * the concurrency infrastructure in isolation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Load Test: Queue Concurrency", () => {
  let queue: typeof import("./casting/geminiQueue");
  let cb: typeof import("./casting/geminiCircuitBreaker");

  beforeEach(async () => {
    vi.resetModules();
    queue = await import("./casting/geminiQueue");
    cb = await import("./casting/geminiCircuitBreaker");
    cb.resetCircuitBreaker();
  });

  // ── Test 1: Image lane enforces concurrency limit ────────────────────

  it("enforces IMAGE_CONCURRENCY with 20 concurrent requests", async () => {
    const config = queue.getQueueConfig();
    let peakActive = 0;

    const tasks = Array.from({ length: 20 }, (_, i) =>
      queue.withImageQueue(async () => {
        const stats = queue.getQueueStats();
        if (stats.image.active > peakActive) peakActive = stats.image.active;
        await new Promise((r) => setTimeout(r, 50));
        return i;
      }, `image-task-${i}`),
    );

    const results = await Promise.all(tasks);

    expect(results).toHaveLength(20);
    // Peak active should never exceed configured IMAGE_CONCURRENCY
    expect(peakActive).toBeLessThanOrEqual(config.imageConcurrency);
    expect(peakActive).toBeGreaterThanOrEqual(1);

    const finalStats = queue.getQueueStats();
    expect(finalStats.image.active).toBe(0);
    expect(finalStats.image.queueDepth).toBe(0);
  }, 30_000);

  // ── Test 2: Text lane enforces concurrency limit ─────────────────────

  it("enforces TEXT_CONCURRENCY with 20 concurrent requests", async () => {
    const config = queue.getQueueConfig();
    let peakActive = 0;

    const tasks = Array.from({ length: 20 }, (_, i) =>
      queue.withTextQueue(async () => {
        const stats = queue.getQueueStats();
        if (stats.text.active > peakActive) peakActive = stats.text.active;
        await new Promise((r) => setTimeout(r, 50));
        return i;
      }, `text-task-${i}`),
    );

    const results = await Promise.all(tasks);

    expect(results).toHaveLength(20);
    expect(peakActive).toBeLessThanOrEqual(config.textConcurrency);
    expect(peakActive).toBeGreaterThanOrEqual(1);

    const finalStats = queue.getQueueStats();
    expect(finalStats.text.active).toBe(0);
    expect(finalStats.text.queueDepth).toBe(0);
  }, 30_000);

  // ── Test 3: Mixed lanes operate independently ────────────────────────

  it("image and text lanes run independently at full concurrency", async () => {
    const config = queue.getQueueConfig();
    let peakImageActive = 0;
    let peakTextActive = 0;

    const imageTasks = Array.from({ length: 10 }, (_, i) =>
      queue.withImageQueue(async () => {
        const stats = queue.getQueueStats();
        if (stats.image.active > peakImageActive)
          peakImageActive = stats.image.active;
        await new Promise((r) => setTimeout(r, 80));
        return `img-${i}`;
      }, `mixed-image-${i}`),
    );

    const textTasks = Array.from({ length: 10 }, (_, i) =>
      queue.withTextQueue(async () => {
        const stats = queue.getQueueStats();
        if (stats.text.active > peakTextActive)
          peakTextActive = stats.text.active;
        await new Promise((r) => setTimeout(r, 80));
        return `txt-${i}`;
      }, `mixed-text-${i}`),
    );

    const results = await Promise.all([...imageTasks, ...textTasks]);

    expect(results).toHaveLength(20);
    expect(peakImageActive).toBeLessThanOrEqual(config.imageConcurrency);
    expect(peakTextActive).toBeLessThanOrEqual(config.textConcurrency);
    // Both lanes should have had at least 2 concurrent (proving independence)
    expect(peakImageActive).toBeGreaterThanOrEqual(2);
    expect(peakTextActive).toBeGreaterThanOrEqual(2);
  }, 30_000);

  // ── Test 4: Queue stats accuracy under load ──────────────────────────

  it("reports accurate queue stats during concurrent execution", async () => {
    const config = queue.getQueueConfig();

    // Fire 10 image tasks that each take 100ms
    const tasks = Array.from({ length: 10 }, (_, i) =>
      queue.withImageQueue(async () => {
        await new Promise((r) => setTimeout(r, 100));
        return i;
      }, `stats-task-${i}`),
    );

    // Check stats while tasks are running (after a brief delay)
    await new Promise((r) => setTimeout(r, 20));
    const midStats = queue.getQueueStats();

    // Should have some active and some pending
    expect(midStats.image.active).toBeGreaterThan(0);
    expect(midStats.image.active).toBeLessThanOrEqual(config.imageConcurrency);
    expect(midStats.image.queueDepth).toBeGreaterThan(0);

    await Promise.all(tasks);

    // After completion, everything should be zero
    const finalStats = queue.getQueueStats();
    expect(finalStats.image.active).toBe(0);
    expect(finalStats.image.pending).toBe(0);
    expect(finalStats.image.queueDepth).toBe(0);
  }, 30_000);
});

describe("Load Test: Overflow Rejection", () => {
  let queue: typeof import("./casting/geminiQueue");
  let cb: typeof import("./casting/geminiCircuitBreaker");

  beforeEach(async () => {
    vi.resetModules();
    queue = await import("./casting/geminiQueue");
    cb = await import("./casting/geminiCircuitBreaker");
    cb.resetCircuitBreaker();
  });

  // ── Test 5: Overflow rejection at MAX_QUEUE_DEPTH ────────────────────

  it("rejects image requests when queue depth exceeds limit", async () => {
    const config = queue.getQueueConfig();
    const maxDepth = config.maxQueueDepth;

    // Use a shared gate that blocks all tasks until we release them.
    let gate: () => void;
    const gatePromise = new Promise<void>((r) => {
      gate = r;
    });

    // Fill the queue to maxDepth
    const blockingTasks = Array.from({ length: maxDepth }, (_, i) =>
      queue.withImageQueue(
        () => gatePromise.then(() => i),
        `blocking-${i}`,
      ),
    );

    // Wait a tick for all depth++ to execute
    await new Promise((r) => setTimeout(r, 50));

    // Verify queue is full
    const stats = queue.getQueueStats();
    expect(stats.image.queueDepth).toBe(maxDepth);

    // The next request should be rejected immediately (queue full)
    let rejectedCount = 0;
    try {
      await queue.withImageQueue(async () => "overflow", "overflow-task");
    } catch (err: any) {
      if (err.message.includes("Server busy")) rejectedCount++;
    }

    expect(rejectedCount).toBe(1);

    // Clean up: open the gate so all tasks complete
    gate!();
    await Promise.all(blockingTasks);
  }, 60_000);

  // ── Test 6: Text queue also rejects on overflow ──────────────────────

  it("rejects text requests when queue depth exceeds limit", async () => {
    const config = queue.getQueueConfig();
    const maxDepth = config.maxQueueDepth;

    let gate: () => void;
    const gatePromise = new Promise<void>((r) => {
      gate = r;
    });

    const blockingTasks = Array.from({ length: maxDepth }, (_, i) =>
      queue.withTextQueue(
        () => gatePromise.then(() => i),
        `text-blocking-${i}`,
      ),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(queue.getQueueStats().text.queueDepth).toBe(maxDepth);

    // Overflow attempts should all be rejected
    let rejectedCount = 0;
    const overflowAttempts = Array.from({ length: 3 }, (_, i) =>
      queue
        .withTextQueue(async () => "overflow", `text-overflow-${i}`)
        .catch((err: any) => {
          if (err.message.includes("Server busy")) rejectedCount++;
          return null;
        }),
    );

    await Promise.all(overflowAttempts);
    expect(rejectedCount).toBe(3);

    gate!();
    await Promise.all(blockingTasks);
  }, 60_000);
});

describe("Load Test: Circuit Breaker Under Load", () => {
  let queue: typeof import("./casting/geminiQueue");
  let cb: typeof import("./casting/geminiCircuitBreaker");

  beforeEach(async () => {
    vi.resetModules();
    queue = await import("./casting/geminiQueue");
    cb = await import("./casting/geminiCircuitBreaker");
    cb.resetCircuitBreaker();
  });

  // ── Test 7: Circuit trips after 5 consecutive failures ───────────────

  it("trips circuit breaker after 5 retryable failures from queue", async () => {
    // Fire 5 tasks sequentially that all fail with retryable errors
    for (let i = 0; i < 5; i++) {
      try {
        await queue.withImageQueue(async () => {
          throw new Error("503 Service Unavailable");
        }, `failing-${i}`);
      } catch {
        // expected
      }
    }

    // Circuit should now be OPEN
    const stats = cb.getCircuitBreakerStats();
    expect(stats.state).toBe("OPEN");

    // New requests should be rejected immediately by circuit breaker
    let circuitRejected = false;
    try {
      await queue.withImageQueue(async () => "should-not-run", "post-trip");
    } catch (err: any) {
      if (err.message.includes("AI engine temporarily unavailable")) {
        circuitRejected = true;
      }
    }
    expect(circuitRejected).toBe(true);
  }, 15_000);

  // ── Test 8: Circuit breaker rejects both lanes simultaneously ────────

  it("rejects both image and text requests when circuit is OPEN", async () => {
    // Trip the circuit via image lane failures
    for (let i = 0; i < 5; i++) {
      try {
        await queue.withImageQueue(async () => {
          throw new Error("500 Internal Server Error");
        }, `trip-${i}`);
      } catch {
        // expected
      }
    }

    expect(cb.getCircuitBreakerStats().state).toBe("OPEN");

    // Both lanes should reject
    let imageRejected = false;
    let textRejected = false;

    try {
      await queue.withImageQueue(async () => "nope", "img-after-trip");
    } catch (err: any) {
      if (err.message.includes("AI engine temporarily unavailable"))
        imageRejected = true;
    }

    try {
      await queue.withTextQueue(async () => "nope", "txt-after-trip");
    } catch (err: any) {
      if (err.message.includes("AI engine temporarily unavailable"))
        textRejected = true;
    }

    expect(imageRejected).toBe(true);
    expect(textRejected).toBe(true);
  }, 15_000);

  // ── Test 9: Non-retryable errors don't trip the breaker ──────────────

  it("does not trip circuit on non-retryable errors", async () => {
    // Fire 10 tasks with validation errors (not retryable)
    for (let i = 0; i < 10; i++) {
      try {
        await queue.withImageQueue(async () => {
          throw new Error("Invalid input: missing prompt field");
        }, `validation-fail-${i}`);
      } catch {
        // expected
      }
    }

    // Circuit should still be CLOSED
    const stats = cb.getCircuitBreakerStats();
    expect(stats.state).toBe("CLOSED");
  }, 15_000);

  // ── Test 10: Recovery after circuit reset ─────────────────────────────

  it("allows requests again after circuit is reset", async () => {
    // Trip the circuit
    for (let i = 0; i < 5; i++) {
      try {
        await queue.withImageQueue(async () => {
          throw new Error("429 Too Many Requests");
        }, `trip-${i}`);
      } catch {
        // expected
      }
    }

    expect(cb.getCircuitBreakerStats().state).toBe("OPEN");

    // Reset the circuit
    cb.resetCircuitBreaker();
    expect(cb.getCircuitBreakerStats().state).toBe("CLOSED");

    // Requests should work again
    const result = await queue.withImageQueue(async () => {
      return "recovered";
    }, "recovery-task");

    expect(result).toBe("recovered");
  }, 15_000);
});

describe("Load Test: Error Propagation", () => {
  let queue: typeof import("./casting/geminiQueue");
  let cb: typeof import("./casting/geminiCircuitBreaker");

  beforeEach(async () => {
    vi.resetModules();
    queue = await import("./casting/geminiQueue");
    cb = await import("./casting/geminiCircuitBreaker");
    cb.resetCircuitBreaker();
  });

  // ── Test 11: Errors propagate correctly through the queue ────────────

  it("propagates task errors to callers without corrupting the queue", async () => {
    const results: string[] = [];

    // Mix of succeeding and failing tasks
    const tasks = Array.from({ length: 10 }, (_, i) =>
      queue
        .withImageQueue(async () => {
          if (i % 3 === 0) throw new Error(`Task ${i} failed intentionally`);
          await new Promise((r) => setTimeout(r, 30));
          return `success-${i}`;
        }, `mixed-${i}`)
        .then((r) => {
          results.push(r);
          return r;
        })
        .catch((err) => {
          results.push(`error-${i}`);
          return `error-${i}`;
        }),
    );

    await Promise.all(tasks);

    // All 10 tasks should have resolved (either success or caught error)
    expect(results).toHaveLength(10);

    // Tasks 0, 3, 6, 9 should have errored
    expect(results.filter((r) => r.startsWith("error-"))).toHaveLength(4);
    expect(results.filter((r) => r.startsWith("success-"))).toHaveLength(6);

    // Queue should be clean after mixed results
    const finalStats = queue.getQueueStats();
    expect(finalStats.image.active).toBe(0);
    expect(finalStats.image.queueDepth).toBe(0);
  }, 15_000);

  // ── Test 12: Queue depth tracking stays accurate after errors ────────

  it("queue depth returns to zero after all tasks complete (including errors)", async () => {
    const tasks = Array.from({ length: 15 }, (_, i) =>
      queue
        .withTextQueue(async () => {
          await new Promise((r) => setTimeout(r, 20));
          if (i < 5) throw new Error("Simulated failure");
          return i;
        }, `depth-test-${i}`)
        .catch(() => null),
    );

    await Promise.all(tasks);

    const stats = queue.getQueueStats();
    expect(stats.text.queueDepth).toBe(0);
    expect(stats.text.active).toBe(0);
    expect(stats.text.pending).toBe(0);
  }, 15_000);
});
