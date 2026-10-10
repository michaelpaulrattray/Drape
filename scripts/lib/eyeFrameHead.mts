/**
 * THE ONE EYE-FRAME HEAD — THE FETCH POLICY BOTH CALLERS OF THE JUDGE USE (#2232).
 *
 * `judgeEyeFramePresence` (`eyeFramePresence.mts`) owns no fetch policy, by its
 * own docblock, and takes a `head` from its caller. It has two callers that can
 * refuse something: `scripts/check-eye-frames.mts` (the gate step) and
 * `scripts/deploy-rite.mts` (the only road a shift may push `main` by).
 *
 * ⚠ **#1177's medicine reached ONE of them.** The checker grew a pause-retry —
 * re-ask an unanswered HEAD once, after a real gap — measured at *"9 runs of 9
 * green after this, against 2 refusals in 4 before"*, every failure UNREAD and
 * never missing. The rite kept a bare head. On the Retro's patrol #7 the rite
 * then refused a record push with **365 of 365 frames UNREAD**, and the checker
 * alone, two minutes later on the same tree and bucket, answered *"every key
 * answered first time"*. The road the repair missed was the one that blocks.
 *
 * That is working law 4: a policy written into one caller is a policy the other
 * caller does not have. So it lives here, once, and both callers build their
 * head from it. The judge still owns no policy; this module is the policy.
 *
 * # WHAT IT DOES
 *
 * - One HEAD with a cleared ten-second timeout (#1517's form — the timer is
 *   cleared on both roads, because both callers `process.exit` soon after).
 * - **A STATUS is an answer, whatever it says.** A 404 is the finding, not a
 *   failure, and re-asking it would only make an absent frame cost twice as long
 *   to report. Only an unmade request is re-asked.
 * - An unmade request is re-asked ONCE, after `EYE_FRAME_HEAD_RETRY_PAUSE_MS`.
 *   ⚠ **The pause is the whole medicine**: the judge's own serial retry fires
 *   immediately, while the burst it is recovering from is still draining.
 *
 * It counts the re-asks so a caller can print them: a 34-second run and a
 * 6-second run are the same verdict about the frames and different facts about
 * the network (D-235). A stalled ask burns the whole timeout before its retry,
 * so the run's length IS the drop count — measured on #1177's machine, `1 retry
 * → 13.8 s · 16 → 26.0 s · 26 → 34.0 s`, against 5.6 s for a run that needed none.
 */
import { fetchWithClearedTimeout } from "./exitSafeFetch.mts";

/** How long one HEAD may wait for an answer. ~100x a live HEAD against this bucket. */
export const EYE_FRAME_HEAD_TIMEOUT_MS = 10_000;

/** The gap before the one re-ask of an unanswered HEAD (#1177's measured medicine). */
export const EYE_FRAME_HEAD_RETRY_PAUSE_MS = 400;

export type EyeFrameHead = {
  /** The status the bucket gave, or `null` if no answer came on either ask. */
  head: (url: string) => Promise<number | null>;
  /** How many keys needed a second ask so far. */
  retried: () => number;
};

/** One real HEAD: the status, or `null` when the request could not be made. */
const askOnce = async (url: string): Promise<number | null> =>
  await fetchWithClearedTimeout(url, { method: "HEAD" }, EYE_FRAME_HEAD_TIMEOUT_MS)
    .then((response) => response.status)
    .catch(() => null);

/**
 * Build the head both callers hand the judge. The arguments exist so the suite
 * can drive the policy without the network; the callers pass none.
 */
export const createEyeFrameHead = (
  ask: (url: string) => Promise<number | null> = askOnce,
  pauseMs: number = EYE_FRAME_HEAD_RETRY_PAUSE_MS,
): EyeFrameHead => {
  let retried = 0;
  const head = async (url: string): Promise<number | null> => {
    const first = await ask(url).catch(() => null);
    if (first !== null) return first;
    retried += 1;
    await new Promise((resolve) => setTimeout(resolve, pauseMs));
    return await ask(url).catch(() => null);
  };
  return { head, retried: () => retried };
};
