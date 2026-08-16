/**
 * WHEN A WAIT HAS GONE ON LONG ENOUGH TO SAY SO.
 *
 * Two surfaces confess an unusual wait — the sheet's still-casting tile and the
 * refine panel's note — and both used to reach the decision the same wrong way:
 * a server-written moment (`createdAt`, `startedAt`) subtracted from the
 * BROWSER's `Date.now()`. Two moments off two clocks, which is entry 13 of
 * `docs/specs/INSTRUMENT_DOCTRINE.md` living in the product rather than in an
 * instrument (found by re-running that entry's sweep wider than the script
 * tree; fable-670).
 *
 * It failed in both directions and worse in the quiet one: a laptop two minutes
 * fast confessed an unusual wait on every roll a second in, and a laptop two
 * minutes slow never confessed one at all — the supervised-wait promise
 * CLAUDE.md writes down, and the "your credits come back on their own" line,
 * silently absent for that user.
 *
 * So the server subtracts, because the server owns both terms, and this side
 * compares one duration to one threshold. The number is refreshed by the poll
 * each surface already runs (2.5s), so it is stale by at most one tick — and
 * that staleness is a duration on ONE clock, which is the honest kind.
 *
 * THE THRESHOLDS STAY WHERE THEY ARE USED and are deliberately not unified
 * here. A roll takes 66–82 seconds and a refine edit's median wall is closer to
 * three minutes: they are two different facts about two different waits, and
 * one shared constant would be a single number pretending to know both.
 */
export function waitExceeds(
  elapsedMs: number | null | undefined,
  thresholdMs: number,
): boolean {
  /*
    An absent duration is NOT a long wait. A payload written before this field
    existed, or a query that has not answered yet, must read as "nothing to
    confess" rather than as a wait of NaN — which compares false anyway, but by
    accident rather than on purpose.
  */
  return typeof elapsedMs === "number" && Number.isFinite(elapsedMs) && elapsedMs > thresholdMs;
}
