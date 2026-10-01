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
  /**
   * One candidate on a sheet that was cast from an attached face — a FOLLOW.
   *
   * ⚠ **IT IS ITS OWN LITERAL AND MUST NEVER BE DERIVED FROM `rollCandidate`**,
   * even while the two are equal. They are two prices that happen to agree
   * today, not one price read twice: #1601 item 1 sets them to **150 and 200**,
   * and a `followCandidate: rollCandidate` written now would make that edit
   * move both — which is a Roll silently repriced to a Follow. Working law 4
   * bans a second list shadowing a source of truth; it does not ask two
   * independent facts to pretend to be one.
   *
   * **Equal today on purpose, and that is what makes this slice safe.** A
   * Follow and a Roll both cost 8 × 20 = 160 right now, so wiring the product
   * to pick the right one of the two charges nobody a different number — the
   * ordering is proven correct while the amounts cannot disagree, and the price
   * change is then a literal rather than a rewrite of the money path.
   * `followSlicePrice.test.ts` pins both halves: that they are declared apart,
   * and that the product reads whichever one the roll's own shape selects.
   */
  followCandidate: 20,
  /** Candidates per roll (§F: the sheet is eight). */
  rollCandidateCount: 8,
} as const;

/** 8 × 20 = 160 credits. Derived, never hardcoded twice. */
export const CASTING_V2_ROLL_PRICE_CREDITS =
  CASTING_V2_COSTS.rollCandidate * CASTING_V2_COSTS.rollCandidateCount;

/** The same sheet, cast from an attached face. 8 × 20 = 160 credits today. */
export const CASTING_V2_FOLLOW_PRICE_CREDITS =
  CASTING_V2_COSTS.followCandidate * CASTING_V2_COSTS.rollCandidateCount;

/**
 * WHICH SLICE A ROLL IS PRICED IN — the ONE place the choice is made (#1601
 * item 2).
 *
 * Before this existed the question was answered three times, by three sites
 * that each re-derived the price from `CASTING_V2_COSTS.rollCandidate`:
 * `rollService`'s total, the roll row's `priceCredits`, and every candidate
 * row's `pointsCost`. Two of the three live in the database layer, which is
 * handed a parent linkage rather than a price — so "is this a follow?" was
 * being re-answered in a place that could only infer it. **The service decides
 * once, here, and the slice travels as data.**
 *
 * `anchored` is the product's own word for it and the only input: a roll is a
 * follow exactly when a parent face was attached and loaded
 * (`rollService`'s `anchored = anchorImage !== null`). A follow whose
 * photograph would not load never reaches a price — it is a free refusal
 * before the claim — so there is no third state to price.
 *
 * ⚠ **WHY THE TABLE IS A PARAMETER, when every production caller passes one
 * argument: because the two slices are EQUAL today and an arm over equal
 * numbers proves nothing.** With the table read from module scope, a test can
 * assert that `anchored: true` returns `followCandidate` and still pass with
 * the two branches SWAPPED — 20 either way — so the only thing that decides a
 * customer's bill would have been covered by an instrument that cannot fail
 * (working law 2). An ES const cannot be swapped from outside the module that
 * declares it, so the seam is here, with the real table as its default. The
 * arms drive it with 150 and 200 and a swap reddens them.
 */
export function castingSliceCredits(
  roll: { anchored: boolean },
  costs: { rollCandidate: number; followCandidate: number } = CASTING_V2_COSTS,
): number {
  return roll.anchored ? costs.followCandidate : costs.rollCandidate;
}

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
 * One RETRY of one failed sheet slice (#122 shape 1, founder 2026-08-26:
 * *"same prompt, one slice, 20 credits, refunded again on failure"*).
 *
 * His "20 credits" IS one slice, so this is DERIVED from the slice price and
 * never a second literal: if the slice ever moves, the retry moves with it.
 *
 * ⚠ **WHAT THIS CONSTANT IS FOR NARROWED ON 2026-10-01 (#1601 item 2), AND THE
 * CLAUSE IT REPLACES ARGUED ITSELF OUT OF EXISTENCE.** It used to end *"the
 * row's `pointsCost` — the refund authority — is set to this value at the
 * moment the slice is reset, so what is refunded is exactly what was charged."*
 * That sentence is the right rule read from the wrong end: it keeps charge and
 * refund equal by **overwriting** the row with the constant, which is only
 * harmless while every row in the table already holds the constant. Measured on
 * production the day this changed: **483 candidate rows, every one at 20, none
 * NULL and none ≤ 0** — so it was harmless, and only by arithmetic coincidence.
 *
 * The moment a Follow's slice is 200 and a Roll's is 150 (#1601 item 1), a
 * retry priced from here charges 150 for a Follow tile **and then rewrites that
 * tile's row to 150**, so the mis-price becomes the refund authority and the
 * ledger reconciles perfectly against the wrong number. That is the worst shape
 * a money bug can take, because nothing downstream disagrees.
 *
 * **So the CHARGE now reads the row** (`retryService`: a tile's retry costs
 * what that tile cost), and this constant is the account-level QUOTE only — the
 * number `castingV2.config` hands the client for the retry affordance, true of
 * every tile while the two slices agree. `followSlicePrice.test.ts` reddens the
 * moment they stop agreeing and names this quote as the thing that must then
 * become per-tile.
 */
export const CASTING_V2_RETRY_PRICE_CREDITS = CASTING_V2_COSTS.rollCandidate;

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
