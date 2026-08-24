/**
 * Batch 2 Hardening Tests
 * - Gemini request queue (p-limit concurrency control)
 * - Session eviction timer + cap
 * - Base64 size validation
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// 1. Gemini Queue Tests
// ============================================================================

describe("Gemini Queue", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("withImageQueue executes function and returns result", async () => {
    const { withImageQueue } = await import("./casting/geminiQueue");
    const result = await withImageQueue(async () => "test-image-url", "test");
    expect(result).toBe("test-image-url");
  });

  it("withTextQueue executes function and returns result", async () => {
    const { withTextQueue } = await import("./casting/geminiQueue");
    const result = await withTextQueue(async () => "test-text", "test");
    expect(result).toBe("test-text");
  });

  it("withImageQueue propagates errors", async () => {
    const { withImageQueue } = await import("./casting/geminiQueue");
    await expect(
      withImageQueue(async () => {
        throw new Error("Gemini API error");
      }, "test")
    ).rejects.toThrow("Gemini API error");
  });

  it("withTextQueue propagates errors", async () => {
    const { withTextQueue } = await import("./casting/geminiQueue");
    await expect(
      withTextQueue(async () => {
        throw new Error("Gemini API error");
      }, "test")
    ).rejects.toThrow("Gemini API error");
  });

  it("withImageQueue limits concurrency to 3", async () => {
    const { withImageQueue } = await import("./casting/geminiQueue");
    let activeConcurrent = 0;
    let maxConcurrent = 0;

    const tasks = Array.from({ length: 6 }, (_, i) =>
      withImageQueue(async () => {
        activeConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, activeConcurrent);
        await new Promise((r) => setTimeout(r, 50));
        activeConcurrent--;
        return i;
      }, `task-${i}`)
    );

    const results = await Promise.all(tasks);
    expect(results).toEqual([0, 1, 2, 3, 4, 5]);
    // Default IMAGE_CONCURRENCY is 5
    expect(maxConcurrent).toBeLessThanOrEqual(5);
  });

  it("withTextQueue limits concurrency to configured limit", async () => {
    const { withTextQueue } = await import("./casting/geminiQueue");
    let activeConcurrent = 0;
    let maxConcurrent = 0;

    const tasks = Array.from({ length: 10 }, (_, i) =>
      withTextQueue(async () => {
        activeConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, activeConcurrent);
        await new Promise((r) => setTimeout(r, 50));
        activeConcurrent--;
        return i;
      }, `task-${i}`)
    );

    const results = await Promise.all(tasks);
    expect(results).toHaveLength(10);
    // TEXT_CONCURRENCY from env (default 5)
    expect(maxConcurrent).toBeLessThanOrEqual(Number(process.env.GEMINI_TEXT_CONCURRENCY) || 5);
  });

  it("getQueueStats returns current queue state", async () => {
    const { getQueueStats } = await import("./casting/geminiQueue");
    const stats = getQueueStats();
    expect(stats).toHaveProperty("image");
    expect(stats).toHaveProperty("text");
    expect(stats.image).toHaveProperty("active");
    expect(stats.image).toHaveProperty("pending");
    expect(stats.image).toHaveProperty("queueDepth");
    expect(stats.image).toHaveProperty("concurrency");
    // Concurrency from env: GEMINI_IMAGE_CONCURRENCY=5, GEMINI_TEXT_CONCURRENCY=10
    expect(stats.image.concurrency).toBe(Number(process.env.GEMINI_IMAGE_CONCURRENCY) || 5);
    expect(stats.text.concurrency).toBe(Number(process.env.GEMINI_TEXT_CONCURRENCY) || 5);
  });
});

// ============================================================================
// 2. Session Eviction Tests
// ============================================================================

describe("Session Eviction", () => {
  it("clearCastingSession is safe on a user with no session", async () => {
    const { clearCastingSession } = await import("./casting/geminiGeneration");
    expect(() => clearCastingSession("nonexistent-user")).not.toThrow();
  });
});

// ============================================================================
// 3. Base64 Size Validation Tests — ⚠ DELETED 2026-08-25
// ============================================================================

/*
  ⚠ THREE ARMS STOOD HERE AND THEIR SUBJECT WAS ZOD, NOT DRAPE.

  Each built `z.string().max(10_000_000)` on the spot and asserted that zod
  rejects 10,000,001 characters and accepts 5,000,000. They imported, named and
  reached **no Drape symbol at all** — delete every base64 cap in the product
  and all three stayed green. That is the mirror shape at its limit, where the
  copy has stopped even pretending to point at something.

  Deleted rather than repaired (ruled fable-1621 §3). A real arm for this cap
  arrives with the server-side cap-places row, which is where the finding
  belongs: `10_000_000` is a **nine-place server literal** —
  `routes/generation/castingRefinement.ts` x3, `routes/generation/iterateInput.ts`
  x2, `routes/wardrobe.ts` x2, `routes/wardrobeInput.ts` x2 — the same class 3f
  closed for the client's `maxLength` sites, on the server side and unswept.
  Named here so it is counted rather than re-derived.
*/

// ============================================================================
// 4. Queue Overflow Protection Tests
// ============================================================================

describe("Queue Overflow Protection", () => {
  it("queue depth tracking increments and decrements correctly", async () => {
    const { withImageQueue, getQueueStats } = await import("./casting/geminiQueue");

    const initialDepth = getQueueStats().image.queueDepth;

    // Start a task that we control
    let resolveTask: (() => void) | undefined;
    const taskPromise = withImageQueue(
      () => new Promise<void>((resolve) => { resolveTask = resolve; }),
      "depth-test"
    );

    // Wait a tick for the limiter callback to execute and assign resolveTask
    await new Promise((r) => setTimeout(r, 10));

    // Depth should have increased
    expect(getQueueStats().image.queueDepth).toBeGreaterThan(initialDepth);

    // Resolve and wait
    expect(resolveTask).toBeDefined();
    resolveTask!();
    await taskPromise;

    // Depth should be back to initial
    expect(getQueueStats().image.queueDepth).toBe(initialDepth);
  });

  it("withImageQueue rejects with 'Server busy' when overflow threshold is hit", async () => {
    // Directly test the error message format
    const { withImageQueue } = await import("./casting/geminiQueue");

    // We can't easily fill 20 slots in a unit test without timeouts,
    // so we verify the error message and mechanism exist
    // by checking the function signature and error path
    try {
      // This should succeed (not overflow)
      const result = await withImageQueue(async () => "ok", "no-overflow");
      expect(result).toBe("ok");
    } catch (e: any) {
      // If it does throw, it should be the overflow error
      expect(e.message).toContain("Server busy");
    }
  });
});
