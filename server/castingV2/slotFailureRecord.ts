/**
 * WHAT A FAILED VIEW'S ROW SAYS — the record, and the one composition of it.
 *
 * # Why this is its own module
 *
 * It was six lines inside `server/db/castingV2Sign.ts`, written out twice: once
 * in the live writer and once in the recovery sweep's writer. Both named the
 * fields they inserted one at a time, so `earlierAttempts` — composed by
 * `packageOrchestrator`'s `failView` since D-114, under a comment promising *"a
 * slot that failed twice now says so, and says what the first draw was rejected
 * for"* — was **dropped by both of them, for thirteen months, and reached no
 * row ever** (#1492).
 *
 * Nothing went red, and the reason is worth more than the repair: the arm for
 * that promise asserts against the INJECTED `recordFailure` dependency, so it
 * proved the COMPOSER and stopped at the seam. On the far side of the seam the
 * write is inside a transaction that needs a database, which no unit suite has
 * — so the half that was broken was the half nothing could reach.
 *
 * Pulling the pure part out here is what makes the seam drivable at all: the
 * suite mocks the whole db module, so a function living there can only ever be
 * driven as a mock of itself. `packageOrchestrator.test.ts` now takes the
 * record its own orchestrator composed and runs it through THIS function, which
 * is the real one both writers call.
 *
 * # Derived, never re-listed (working law 4)
 *
 * `slotFailureStatus` spreads whatever the record carries rather than naming
 * the fields it knows about. A field added to `SlotFailureRecord` therefore
 * reaches the row by construction, and the next `earlierAttempts` cannot happen
 * — which is the actual fix, the missing field being only its first instance.
 */

export type SlotFailureRecord = {
  reason: string;
  refunded: number;
  refundReference: string;
  /** The per-axis verdict, so a dispute is answerable from the record. */
  conformance?: unknown;
  /**
   * The verdicts of the attempts BEFORE the last one, oldest first.
   *
   * ⚠ **DECLARED AND WRITTEN SINCE #1492, AND IT WAS NEITHER BEFORE.** See this
   * module's header: composed since D-114, stored by nothing.
   */
  earlierAttempts?: unknown;
};

/**
 * The `status` a failed slot is stored with.
 *
 * Pure and exported so the composition is driven directly rather than through a
 * database — the defect this replaces was invisible to a suite that could reach
 * the writer's caller and not the writer's insert.
 */
export function slotFailureStatus(
  failure: SlotFailureRecord,
  at: string,
): Record<string, unknown> {
  const { reason, refunded, refundReference, ...rest } = failure;
  return {
    state: "failed",
    reason,
    refunded,
    refundReference,
    /* Every remaining field of the record, present only when it has a value.
       Both writers used to name `conformance` in a conditional spread of its
       own and knew of nothing else, which is why `earlierAttempts` never
       reached a row. */
    ...Object.fromEntries(
      Object.entries(rest).filter(([, value]) => value !== undefined && value !== null),
    ),
    at,
  };
}
