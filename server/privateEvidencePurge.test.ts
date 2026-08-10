/**
 * THE PURGE PROMISE THE FOUNDER WAS GIVEN, AND THE TWO WAYS IT WAS BROKEN.
 *
 * He approved keeping the painted frame and mask of a refused render on one
 * condition, in his own approval: only until the cleanup worker sweeps them.
 * On 2026-08-10 production said it had not swept a single one.
 *
 *     failed batches   5   all `casting_diagnostic_cleanup`, all user 1
 *     items held       6   all `private_storage_invalid_request`, attempts=1,
 *                          nextAttemptAt NULL — no retry ever scheduled
 *     keys             casting-v2/diagnostics/1/<operationId>/{painted,composite}.png
 *
 * **Cause.** `deleteExact` guarded itself with `parseEvidenceStorageKey`, which
 * only knows the R7 evidence shape `users/…/models/…/evidence/…webp`. A
 * diagnostic key is not that shape, so every delete was classified as an
 * invalid request and — being non-retryable — stopped forever. The guard was
 * not wrong to exist. It was implemented as a narrower rule than the one it
 * meant, and became incorrect the moment the bucket held a second kind of
 * object.
 *
 * **And nobody heard it**, which is the second half. The health counts are
 * cumulative, so the worker warned every 60 seconds with the same five numbers
 * for two days. That is invariant 7 with a schedule: a control that fires
 * constantly is a control nobody reads.
 *
 * Both halves are tested here, and both are tested for the thing they must
 * still REFUSE — a guard that deletes everything would pass the first half.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isPrivateEvidenceDeletableKey } from "./casting/evidence/evidenceDelivery";
import {
  reportStorageCleanupHealth,
  resetStorageCleanupHealthReport,
  STORAGE_CLEANUP_HEALTH_HEARTBEAT_MS,
} from "./casting/storageCleanupWorker";

const OPERATION = "d1f48893-7ddf-4555-8721-a161ff2c5090";
/** The exact keys production could not delete. */
const STUCK = [
  `casting-v2/diagnostics/1/${OPERATION}/painted.png`,
  `casting-v2/diagnostics/1/${OPERATION}/composite.png`,
];

describe("the private bucket's deleter knows every shape the bucket holds", () => {
  it("accepts the diagnostic frames that were stuck in production", () => {
    for (const key of STUCK) {
      expect(isPrivateEvidenceDeletableKey(key), key).toBe(true);
    }
  });

  it("still accepts an R7 evidence key", () => {
    expect(isPrivateEvidenceDeletableKey(
      "users/1/models/42/evidence/plates/d1f48893-7ddf-4555-8721-a161ff2c5090.webp",
    )).toBe(true);
  });

  /*
    THE HALF THAT MATTERS MORE. Widening a delete guard is how a deleter learns
    to delete a stranger's object, so every one of these must still be refused —
    a fix that made the first test pass by returning `true` would be a worse
    defect than the one it repaired.
  */
  it.each([
    ["a key outside both namespaces", "some/other/place/frame.png"],
    ["the public variant prefix", "casting-v2/variants/one.png"],
    ["the segment prefix — public bucket, not this one", "casting-v2/segments/abc-mask.png"],
    ["a traversal out of the diagnostics prefix", `casting-v2/diagnostics/1/${OPERATION}/../../../secrets.png`],
    ["user id zero", `casting-v2/diagnostics/0/${OPERATION}/painted.png`],
    ["a non-numeric user", `casting-v2/diagnostics/one/${OPERATION}/painted.png`],
    ["a missing operation id", "casting-v2/diagnostics/1//painted.png"],
    ["an operation id that is not a uuid", "casting-v2/diagnostics/1/not-a-uuid/painted.png"],
    ["a nested path under the operation", `casting-v2/diagnostics/1/${OPERATION}/deeper/painted.png`],
    ["a non-png extension", `casting-v2/diagnostics/1/${OPERATION}/painted.webp`],
    ["the prefix alone", "casting-v2/diagnostics/"],
    ["an empty key", ""],
  ])("refuses %s", (_label, key) => {
    expect(isPrivateEvidenceDeletableKey(key)).toBe(false);
  });
});

describe("the cleanup health alert speaks on change, not on a timer", () => {
  const clear = {
    partialBatches: 0, failedBatches: 0, staleLeases: 0,
    cleanupPendingEvidenceReceipts: 0, failedEvidenceManifests: 0,
    pendingPrivateBatches: 0, retainedFailedItems: 0,
    oldestNonAttachedEvidenceAgeMs: null, succeededBatches: 72,
    pendingBatches: 0, processingBatches: 0, storedEvidenceReceipts: 0,
    plannedEvidenceReceipts: 0,
  } as never;
  const bad = (failedBatches: number, retainedFailedItems: number) =>
    ({ ...(clear as object), failedBatches, retainedFailedItems }) as never;

  let sink: { warn: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    resetStorageCleanupHealthReport();
    sink = { warn: vi.fn(), info: vi.fn() };
  });

  it("turns two days of a line a minute into two days of a line an hour", () => {
    const at = 1_000_000;
    const MINUTES = 48 * 60;
    let logged = 0;
    /* Production's own cadence and duration: a sweep every 60 seconds, the same
       five numbers, for two days. The old predicate warned on every one. */
    for (let minute = 0; minute <= MINUTES; minute += 1) {
      if (reportStorageCleanupHealth(bad(5, 6), at + minute * 60_000, sink as never) === "logged") {
        logged += 1;
      }
    }
    expect(sink.warn).toHaveBeenCalledTimes(logged);
    /* One on the change, then one an hour. The number that matters is that it
       is not 2,881. */
    expect(logged).toBe(49);
    expect(MINUTES + 1).toBe(2881);
  });

  it("speaks again the moment the numbers change", () => {
    const at = 1_000_000;
    reportStorageCleanupHealth(bad(5, 6), at, sink as never);
    expect(reportStorageCleanupHealth(bad(6, 7), at + 60_000, sink as never)).toBe("logged");
    expect(sink.warn).toHaveBeenCalledTimes(2);
    expect(sink.warn.mock.calls[1]![0]).toMatchObject({ why: "changed" });
  });

  it("keeps a heartbeat, so an unchanged problem is not silently forgotten", () => {
    const at = 1_000_000;
    reportStorageCleanupHealth(bad(5, 6), at, sink as never);
    expect(reportStorageCleanupHealth(bad(5, 6), at + STORAGE_CLEANUP_HEALTH_HEARTBEAT_MS - 1, sink as never))
      .toBe("suppressed");
    expect(reportStorageCleanupHealth(bad(5, 6), at + STORAGE_CLEANUP_HEALTH_HEARTBEAT_MS, sink as never))
      .toBe("logged");
    expect(sink.warn.mock.calls[1]![0]).toMatchObject({ why: "hourly heartbeat" });
  });

  it("says so when it clears — silence must not have to mean two things", () => {
    const at = 1_000_000;
    reportStorageCleanupHealth(bad(5, 6), at, sink as never);
    expect(reportStorageCleanupHealth(clear, at + 60_000, sink as never)).toBe("recovered");
    expect(sink.info).toHaveBeenCalledTimes(1);
    /* And having recovered, it does not keep announcing the good news. */
    expect(reportStorageCleanupHealth(clear, at + 120_000, sink as never)).toBe("suppressed");
    expect(sink.info).toHaveBeenCalledTimes(1);
  });

  it("is silent on a healthy worker that was never bad", () => {
    expect(reportStorageCleanupHealth(clear, 1_000_000, sink as never)).toBe("suppressed");
    expect(sink.warn).not.toHaveBeenCalled();
    expect(sink.info).not.toHaveBeenCalled();
  });
});
