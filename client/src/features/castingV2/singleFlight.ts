/**
 * A single-flight latch for paid actions.
 *
 * Born from a real defect: Follow gave no visible response for the ~2.5s until
 * the next session poll, the founder clicked again, and each click was a
 * separate paid roll — four extra rolls, 640 credits. Every click did exactly
 * what the code told it to do.
 *
 * Two properties, and both matter:
 *
 *   1. **It closes synchronously.** A guard written as React state
 *      (`if (starting) return`) does not close until the next render, so two
 *      clicks in one frame both pass it. This is plain mutable state, so the
 *      second click sees the first one's effect immediately.
 *   2. **It opens on arrival, not on completion.** A roll takes over a minute
 *      to finish but exists within a poll or two. Holding the latch until the
 *      work completed would lock the dock for the whole minute, which is a
 *      second bug wearing the first one's clothes.
 *
 * Deliberately not a React hook: hooks cannot be called from an event handler,
 * and the whole point is to act at click time rather than at render time.
 */
export type DispatchLatch = {
  /**
   * Try to start a flight, recording what we are waiting to change.
   * Returns false if a flight is already up — the caller must then do nothing
   * at all, because doing something is what spends money twice.
   */
  tryAcquire: (waitingFor: string | null) => boolean;
  /** Give it back — a failed dispatch, so the user can retry immediately. */
  release: () => void;
  /**
   * Report the current id of the thing being waited for. When it differs from
   * the id recorded at acquire time, what we paid for has arrived and the
   * latch opens. Returns true on the transition, so a caller can sync UI once.
   */
  settleIfArrived: (currentId: string | null) => boolean;
  readonly held: boolean;
};

export function createDispatchLatch(): DispatchLatch {
  let held = false;
  let waitingFor: string | null = null;

  return {
    tryAcquire(next) {
      if (held) return false;
      held = true;
      waitingFor = next;
      return true;
    },
    release() {
      held = false;
      waitingFor = null;
    },
    settleIfArrived(currentId) {
      if (!held) return false;
      // Only a *change* counts. Being handed the same id we started with means
      // nothing has arrived yet — which is exactly the window the user was
      // clicking through.
      if (currentId !== null && currentId !== waitingFor) {
        held = false;
        waitingFor = null;
        return true;
      }
      return false;
    },
    get held() {
      return held;
    },
  };
}
