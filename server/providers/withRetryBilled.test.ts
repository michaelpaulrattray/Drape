/**
 * `withRetry` asks whose frame it was before it asks what went wrong (#2032).
 *
 * Driven directly, with no engine and no delay, so the rule is proven on the
 * function every fal, OpenRouter and segmenter road reaches its provider
 * through. The driven fal arms live in `falPostCompletionFault.test.ts`.
 */
import { describe, expect, it } from "vitest";

import { withRetry } from "./providerQueue";
import { ProviderError, RETRYABLE_FAILURES } from "./types";

async function attemptsFor(error: unknown): Promise<number> {
  let attempts = 0;
  await withRetry(
    "test",
    async () => {
      attempts += 1;
      throw error;
    },
    { retries: 2, baseDelayMs: 0 },
  ).catch(() => undefined);
  return attempts;
}

describe("#2032 — withRetry and an already-billed frame", () => {
  for (const failureClass of RETRYABLE_FAILURES) {
    it(`a completed '${failureClass}' fault is thrown on the first attempt`, async () => {
      expect(await attemptsFor(new ProviderError(failureClass, "bought", { completed: true }))).toBe(1);
    });

    it(`THE CONTROL — an unflagged '${failureClass}' fault is still retried to the budget`, async () => {
      expect(await attemptsFor(new ProviderError(failureClass, "never ran"))).toBe(3);
    });
  }

  it("rethrows the very error it was given, flag and all", async () => {
    const bought = new ProviderError("transport", "bought", { completed: true });
    await expect(
      withRetry("test", async () => { throw bought; }, { retries: 2, baseDelayMs: 0 }),
    ).rejects.toBe(bought);
  });
});
