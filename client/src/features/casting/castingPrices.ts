/**
 * THE PRICE ON A SPEND SURFACE COMES FROM THE SERVER.
 *
 * D-15: *"every paid affordance shows its cost before firing, computed
 * server-side from `CREDIT_COSTS`"*, and `castViewPackage.ts` states the same
 * rule about its own number — *"the client is served this number; it never
 * carries a literal (D-15)."*
 *
 * ⚠ **THE CLIENT HAS ITS OWN `CREDIT_COSTS` AND THREE SITES READ IT.** Found
 * 2026-08-23 by the Atlas price list, once that list could show both copies at
 * once (working law 4 — a price list that cannot show you a second copy of the
 * prices cannot show you the thing about prices that most matters):
 *
 *   ImageViewerPanel      `costsQuery.data?.iterate ?? CREDIT_COSTS.iteration`
 *                         — server first, literal as fallback. The right shape.
 *   ControlPanel          the ARMED CAST BUTTON's price, from the literal, with
 *                         no server query at all — and its own comment cites D-15.
 *   useCastingGeneration  the PRE-FLIGHT AFFORDABILITY GATE: "Insufficient
 *                         credits. Need N credits."
 *
 * Every price the two copies SHARE agrees today, so nobody has been quoted a
 * wrong number. The defect is that nothing stops them diverging, and two of the
 * three sites would not notice: raise `castingImage` server-side and the armed
 * button keeps saying the old figure while the charge changes, and the
 * affordability gate waves someone into a server refusal.
 *
 * Approved fable-1435 §1 as the `ImageViewerPanel` pattern — server value
 * first, today's literal as the fallback, **which cannot regress because the
 * fallback IS today's behaviour.**
 *
 * The client copy is deliberately NOT deleted here. It is the fallback, and a
 * spend button with no number while a query is in flight is worse than a number
 * that is right today and mechanically checked tomorrow.
 */

/** What `credits.getCosts` serves — the server's own `CREDIT_COSTS` object. */
export type ServedCosts = Partial<Record<string, number>> | undefined;

/**
 * The served price, or the local literal when the server has not answered.
 *
 * ⚠ `typeof === "number"` rather than `??`, and the difference is a real price:
 * `masterPrompt` is **0**, and `served?.[key] ?? fallback` is correct for it
 * only by accident — `0 ?? x` is 0 — while `served?.[key] || fallback` would
 * silently replace a genuine zero with the literal. Stated because the next
 * person to touch this will reach for `||`.
 */
export function servedCost(served: ServedCosts, key: string, fallback: number): number {
  const value = served?.[key];
  return typeof value === "number" ? value : fallback;
}
