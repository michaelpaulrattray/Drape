/**
 * What a still-running refinement is HONESTLY doing — the third state.
 *
 * # The incident (fable-466/467, founder, 2026-08-14)
 *
 * A refine's worker died about a minute in. The row stayed `dispatched`,
 * because nothing was alive to change it, and the client — which reads
 * in-flight state from the server on purpose (D-161) — went on saying
 * "Refining…", hiding the picture's regions and holding the ask box disabled.
 * The founder's words: *"i cant even click on anything or type anything i cant
 * even load her original its sort of just stuck in this state."* It lasted
 * until the lease expired and the recovery sweep settled it — about six
 * minutes — and only a manual refresh escaped, which no customer knows to do.
 *
 * The client was mirroring the server faithfully. The server was the one
 * saying something untrue: `dispatched` means *a worker has this*, and no
 * worker had it.
 *
 * # The rule
 *
 * A live render renews its lease every 30 seconds (`heartbeat`), so a lease in
 * the future is a worker that was alive within the last half-minute. A lease
 * in the PAST is a row the recovery sweep now owns: it will be settled and
 * refunded within a sweep interval, and it will never produce a picture.
 * Saying so is not progress — there is still no percentage and nothing to
 * measure — it is a different fact about who holds the row.
 *
 * `now` is a parameter because a clock read inside a derivation is a
 * derivation that cannot be driven to either side of its own boundary.
 */

/** The two states a live row can be in, plus the one a dead row is in. */
export type PendingStage = "queued" | "dispatched" | "settling";

export function pendingStage(input: {
  status: "queued" | "dispatched";
  /** The owning operation's lease. Null means the operation could not be read. */
  leaseExpiresAt: Date | null;
  now: Date;
}): PendingStage {
  const lease = input.leaseExpiresAt;
  /*
    FAIL TOWARDS STILL-RUNNING. Without a lease we do not know that nobody is
    working, and announcing "settling" over a live render would re-arm the ask
    box beside a render that is about to land — inviting a second charge for
    the same edit, which is the defect D-161 was written about. The honest
    default when we cannot tell is the one that claims less.
  */
  if (!lease) return input.status;
  return lease.getTime() <= input.now.getTime() ? "settling" : input.status;
}
