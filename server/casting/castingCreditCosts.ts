/**
 * Server-owned credit prices.
 *
 * Keep this module declaration-only so read-only planners can quote prices
 * without importing provider, queue, storage, or logging modules.
 */
export const CREDIT_COSTS = {
  castingImage: 350,
  fullBody: 300,
  multiView: 300,
  allViews: 900,
  iterate: 350,
  eraser: 350,
  flashMultiplier: 0.5,
} as const;

// Legacy alias for backward compatibility during migration.
export const POINT_COSTS = CREDIT_COSTS;

/**
 * Casting V2 prices (plan §H.10, founder-decided 2026-07-30).
 *
 * A roll is priced as **eight integer slices**, never as a total that is later
 * divided. The ledger is integer-only, and every refund slice is read from the
 * candidate's own persisted `pointsCost` — so if the roll size ever changes,
 * the arithmetic still lands on whole credits and conservation still holds.
 */
export const CASTING_V2_COSTS = {
  /** One candidate on a sheet. The refundable unit. */
  rollCandidate: 20,
  /** Candidates per roll (§F: the sheet is eight). */
  rollCandidateCount: 8,
} as const;

/** 8 × 20 = 160 credits. Derived, never hardcoded twice. */
export const CASTING_V2_ROLL_PRICE_CREDITS =
  CASTING_V2_COSTS.rollCandidate * CASTING_V2_COSTS.rollCandidateCount;

/**
 * One refinement of one candidate (D-121, founder ruling 2026-08-03).
 *
 * **Priced on behaviour more than on margin**, though both point the same way.
 * A refine runs on the identity engine — dearer than the roll engine behind a
 * 20-credit sheet candidate, cheaper than the 2K package view at 50 — so the
 * number sits where the cost sits.
 *
 * The stronger half is what it does to exploring. Refine is the path to a
 * 450-credit Sign: every refine is a deposit toward one, and it cuts post-Sign
 * revision churn because identity decisions get made against one cheap image
 * instead of a whole package. At package-view parity, three variants would cost
 * 150 — a third of a Sign — and people stop exploring exactly where the product
 * wants them to continue. At 25, three variants cost 75: visible, and not a
 * decision of its own.
 *
 * **One unit, not eight slices.** A refine is a single image, so the whole
 * charge refunds on any failure. Per-slice accounting exists because a roll has
 * eight things that can fail independently; inventing it for one would be
 * ceremony with nothing to reconcile.
 */
export const CASTING_V2_REFINE_PRICE_CREDITS = 25;

/**
 * Sign (§H.4/H.10, founder-decided 2026-07-30): one price, one operation,
 * **decomposed** — because a failed view has to refund its exact slice under
 * the same charge reference, and a slice you cannot name is a slice you cannot
 * give back.
 *
 * The promotion portion buys the thing that cannot fail once it exists: the
 * face lock, the likeness anchor, the KI id, the lineage. It is never refunded
 * once the candidate CAS is set, because at that point the Cast exists and the
 * candidate is spent — undoing it would mean un-signing.
 *
 * The per-view portion is the refundable unit, exactly as `rollCandidate` is
 * for a sheet. The total lives beside the canonical view list rather than here
 * (`castViewPackage.ts`), so the price is derived from the number of views the
 * cohort actually promises and cannot drift from it.
 */
export const CASTING_V2_SIGN_COSTS = {
  /** Face lock, anchor, KI id, lineage. Not refundable past the boundary. */
  promotion: 200,
  /** One canonical view. The refundable slice. */
  view: 50,
} as const;
