/**
 * Server-owned credit prices.
 *
 * Keep this module declaration-only so read-only planners can quote prices
 * without importing provider, queue, storage, or logging modules.
 *
 * ⚠ **EVERY PRICE HERE IS A LEDGER NUMBER AND MUST BE A MULTIPLE OF 5.** What
 * a customer reads is `ledger ÷ 5` through `shared/creditDisplay.ts` (#1600),
 * so a ledger price that is not a multiple of 5 cannot be displayed exactly:
 * `displayPrice` rounds UP, and a customer would be quoted a number the
 * product then does not charge. `server/creditPriceScale.test.ts` reads every
 * declared price in the product — this module, wardrobe's, `PLAN_TIERS`, the
 * free grant — and refuses one that is not.
 */

/**
 * THE LEGACY STUDIO'S PRICES — not part of the new scale, and deliberately
 * left where they are (#1601 item 1, 2026-10-01).
 *
 * The card's own words were *"retire the legacy `CREDIT_COSTS`"*, and that is
 * not what this commit does. Read at the code: its live readers are
 * `packagePricing.slotCost` (the D-15 package slots, reached from
 * `mintPackage` and the whole PARKED R7 evidence family),
 * `routes/generation/castingRefinement.ts` and `castingImaging.ts` — the
 * legacy lane, which has been **admin-only since #1654** and retires with the
 * legacy studio itself (#29, rung N8). The Atlas is this repository's deletion
 * authority and nothing is removed while its retirement view shows live
 * callers, so retiring these numbers is a DELETION card with a manifest, not a
 * line inside a price change.
 *
 * They are multiples of 5 already, so the price-scale sweep passes over them
 * without anybody having had to think about it; `flashMultiplier` is a RATIO
 * rather than a price and that sweep names it as one.
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
 *
 * ⚠ **THE TWO SLICES DIVERGED ON 2026-10-01 (#1601 item 1) AND EVERYTHING
 * ITEM 2 BUILT WAS FOR THIS DAY.** They were both 20 from 2026-07-30 until
 * today, which is why the money path could be taught to pick between them
 * while a wrong pick cost nobody anything. It can cost something from this
 * commit on: `castingSliceCredits` is the one place the choice is made, the
 * database layer is handed the slice as data and may not declare one, and a
 * retry charges and refunds the tile's own recorded figure.
 */
export const CASTING_V2_COSTS = {
  /**
   * One candidate on a sheet. The refundable unit.
   *
   * **150 = 30 display** (his approved pricing, rev 21, adopted 2026-09-30;
   * the rung is #1598). Eight of them is a Roll at 1,200 ledger / 240 display.
   * It was **20** from 2026-07-30 to 2026-10-01.
   */
  rollCandidate: 150,
  /**
   * One candidate on a sheet that was cast from an attached face — a FOLLOW.
   *
   * **200 = 40 display**, so a Follow is 1,600 ledger / 320 display. Dearer
   * than a Roll because a follow candidate carries the anchor photograph and
   * the lineage prompt through the engine, which the spec's own cost reading
   * prices above an open roll.
   *
   * ⚠ **IT IS ITS OWN LITERAL AND MUST NEVER BE DERIVED FROM `rollCandidate`.**
   * That sentence used to carry the caveat *"even while the two are equal"*;
   * the equality is gone and the rule is simply the rule. They are two prices,
   * and a `followCandidate: rollCandidate` would reprice a Follow to a Roll by
   * a diff that looks like it changed one number. Working law 4 bans a second
   * list shadowing a source of truth; it does not ask two independent facts to
   * pretend to be one. `followSlicePrice.test.ts` reads the DECLARATION and
   * refuses anything here but a bare numeral.
   */
  followCandidate: 200,
  /** Candidates per roll (§F: the sheet is eight). */
  rollCandidateCount: 8,
} as const;

/** 8 × 150 = 1,200 credits (240 display). Derived, never hardcoded twice. */
export const CASTING_V2_ROLL_PRICE_CREDITS =
  CASTING_V2_COSTS.rollCandidate * CASTING_V2_COSTS.rollCandidateCount;

/**
 * 8 × 200 = 1,600 credits (320 display). Derived, never hardcoded twice.
 *
 * ⚠ **THIS CONSTANT WAS WRITTEN AND DELETED INSIDE #1601 ITEM 2, AND IT IS
 * BACK ONLY BECAUSE SOMETHING QUOTES IT NOW.** Item 2 removed it on
 * `check-cleanup-dispositions`'s reading — an exported price with no
 * production reader is invariant 7's shape — and left an arm pinning its
 * absence with the instruction *"add it in the commit that quotes it, and
 * delete this arm then."* This is that commit: `castingV2.config` hands it to
 * the sheet, because the dock's single price line could stand for both actions
 * only while the two slices agreed. That arm is gone, and the quoter is the
 * whole reason this symbol may exist.
 */
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
 * ⚠ **THE TABLE IS STILL A PARAMETER, AND THE REASON HAS CHANGED RATHER THAN
 * EXPIRED.** It was a seam because the two slices were equal and an arm over
 * equal numbers proves nothing (working law 2): with the table read from
 * module scope, an arm could assert that `anchored: true` returns
 * `followCandidate` and still pass with the two branches SWAPPED. The real
 * table now disagrees with itself — 150 against 200 — so the default alone
 * would catch a swap today. The seam stays because the arms must keep failing
 * for a reason that does not depend on today's two numbers: the day somebody
 * prices a Follow at a Roll again, the injected table is what keeps every arm
 * in `followSlicePrice.test.ts` non-vacuous.
 */
export function castingSliceCredits(
  roll: { anchored: boolean },
  costs: { rollCandidate: number; followCandidate: number } = CASTING_V2_COSTS,
): number {
  return roll.anchored ? costs.followCandidate : costs.rollCandidate;
}

/**
 * One refinement of one candidate (D-121, founder ruling 2026-08-03; repriced
 * 2026-10-01 under his approved pricing, #1601 item 1).
 *
 * **1,750 = 350 display.** It was 25 from 2026-08-03 to 2026-10-01, under a
 * scale where a sheet candidate was 20 and a package view 50.
 *
 * **Priced on behaviour more than on margin**, though both point the same way.
 * A refine runs on the identity engine — dearer than the roll engine behind a
 * sheet candidate, and it carries checks of its own — so the number sits where
 * the cost sits. What a Refine actually spends is being read rather than
 * assumed: #1689 is his order to count the checks one makes and report the
 * cost per Refine before any price moves again.
 *
 * The stronger half is what it does to exploring. Refine is the path to a
 * Sign: every refine is a deposit toward one, and it cuts post-Sign revision
 * churn because identity decisions get made against one cheap image instead of
 * a whole package. Against a Sign at 8,500, three variants at 1,750 come to
 * 5,250 — visible, and still less than the ceremony they protect.
 *
 * **One unit, not eight slices.** A refine is a single image, so the whole
 * charge refunds on any failure. Per-slice accounting exists because a roll has
 * eight things that can fail independently; inventing it for one would be
 * ceremony with nothing to reconcile.
 */
export const CASTING_V2_REFINE_PRICE_CREDITS = 1750;

/*
  ⚠ `CASTING_V2_RETRY_PRICE_CREDITS` IS GONE, AND LEAVING IT WOULD HAVE BEEN
  THE QUIETEST MONEY DEFECT IN THIS COMMIT (#1601 item 1, 2026-10-01).

  It was `CASTING_V2_COSTS.rollCandidate` — a single ACCOUNT-level quote for
  the retry of one failed sheet slice, handed to the client by
  `castingV2.config` and printed on the tile as `Retry · N credits`. It was
  true of every tile on every sheet for exactly as long as the two slices
  agreed. From this commit a follow sheet's tiles cost 200 and a roll sheet's
  cost 150, and item 2 already made the SERVER charge the tile's own recorded
  `pointsCost` — so the one number would have been wrong on screen for every
  follow sheet in the product while the charge beneath it was right.

  `followSlicePrice.test.ts`'s tripwire named this and offered two ways out:
  the quote becomes per-tile, or it LEAVES `config`. It leaves. The door it was
  bundled with is `retryEnabled`, which was always its own field, and the sheet
  derives the number from the roll row's own total ÷ its candidate count — the
  same derivation the cancel line already used, now written once and read twice
  rather than written twice. A price nothing quotes may not sit in this module
  (invariant 7), so the constant goes with its quoter.
*/

/**
 * ONE PAID *TRY AGAIN* ON A SIGNED VIEW — its own price since 2026-10-01
 * (#1601 item 1).
 *
 * **1,850 = 370 display.** His price change of this morning, verbatim from his
 * finance guy's note and recorded on #1601 at 08:59Z: *"Also: paid Try again
 * 350 -> 370 credits (needed to keep every worst case profitable)."*
 *
 * ⚠ **IT USED TO BE THE VIEW PRICE ITSELF, AND THAT IS NOW A DIFFERENT NUMBER
 * RATHER THAN A WRONG ONE.** Both `castProjection` and `viewRetryService`
 * passed `CAST_PACKAGE_VIEW_PRICE` into `castSlotRetryOffer`, on his #1208
 * word — *"trying again deducts another 50cr. its not completely free"* —
 * said when a view WAS 50. A view is 1,000 now and a Try again is 1,850,
 * because a Try again is not an amortised fifth of a package: it is one render
 * plus its own check, and the spec priced it to stay profitable in the case
 * where that check has to run twice.
 *
 * The FREE Try again is untouched by this constant and is a different fact
 * entirely: an UNCHECKED view's ask is free (his #1220 *"go with the free try
 * again"*), and `castSlotRetryOffer` returns 0 for it. Making that free ask
 * durable and once-only is item 4 of #1601 and is NOT built — today an
 * unchecked view can be asked again free more than once.
 *
 * Charge and refund are one number here: `viewRetryService` charges
 * `offer.priceCredits` and refunds the same figure, so conservation does not
 * depend on this constant's value.
 */
export const CASTING_V2_VIEW_RETRY_PRICE_CREDITS = 1850;

/**
 * Sign (§H.4/H.10, founder-decided 2026-07-30; repriced 2026-10-01 under his
 * approved pricing, #1601 item 1): one price, one operation, **decomposed** —
 * because a failed view has to refund its exact slice under the same charge
 * reference, and a slice you cannot name is a slice you cannot give back.
 *
 * **3,500 + 5 × 1,000 = 8,500 ledger (700 + 5 × 200 = 1,700 display).** Both
 * parts divide by 5 exactly, which is the whole reason the spec chose them: a
 * refund a customer can read has to be a whole display number too. It was
 * 200 + 5 × 50 = 450 from 2026-07-30 to 2026-10-01.
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
  promotion: 3500,
  /** One canonical view. The refundable slice. */
  view: 1000,
} as const;
