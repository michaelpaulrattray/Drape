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
 * not what that commit did. The Atlas is this repository's deletion authority
 * and nothing is removed while its retirement view shows live callers, so
 * retiring these numbers is a DELETION card with a manifest, not a line inside
 * a price change. **That conclusion is unchanged and the reading below makes it
 * stronger, not weaker.**
 *
 * ⚠ **THIS PARAGRAPH NAMED THREE READERS WHERE THERE ARE SEVEN, AND CALLED
 * THEM ALL "the legacy lane, which has been admin-only since #1654" — IT IS
 * NOT ADMIN-ONLY, AND TWO OF THE READERS IT DID NOT NAME ARE PUBLIC
 * ENDPOINTS** (corrected #1786, read at the code 2026-10-02). The sentence was
 * the stated ground for three separate declines on #1601 — item 1's
 * retirement, the wardrobe fold, and `flashMultiplier`'s no-card — and every
 * one of those answers was right. What was wrong is the premise under them, and
 * a wrong premise that happens to support a right answer is the shape that
 * costs something the fourth time it is used: following this reader list to the
 * code is what found **#1785**, a customer-hittable charge on an engine Google
 * shut down in June.
 *
 * ⚠ **WHY A SHORT LIST READ AS A COMPLETE ONE, WHICH IS THE PART WORTH
 * KEEPING: `CREDIT_COSTS` HAS EXACTLY TWO DIRECT IMPORTERS AND ONE OF THEM
 * READS NOTHING.** They are `packagePricing.ts:2`, which reads it, and
 * `aiService.ts:84`, which is a bare `export { CREDIT_COSTS } from
 * "./castingCreditCosts"`. **Every other reader reaches this table through that
 * re-export** — the barrel shape `CLAUDE.md` records the Atlas edge graph
 * having been blind to until `d614320f`, where 65 modules read as having no
 * caller at all.
 *
 * **The seven, with each reach read at its own declaration rather than
 * inferred** (value reads = `CREDIT_COSTS.<key>` outside comments and the
 * import line):
 *
 * - `packagePricing.ts:6` (`slotCost`, 2) — **NOT admin-only**; see below.
 * - `routes/generation/castingImaging.ts` (13) — `generation.castingImage`,
 *   `adminProcedure` (`:80`). Admin-only, as claimed.
 * - `routes/generation/castingRefinement.ts` (11) — `generation.iterate`,
 *   `adminProcedure` (`:125`). Admin-only, as claimed.
 * - `lib/boardOps.ts` (6) — the canvas plan/execute cores. **NOT admin-only.**
 * - `routes/boardOps.ts` (3) — `boardOps.runGeneration.execute`,
 *   `applyModelEdit.execute` and `runVariations.execute`, every one
 *   `protectedProcedure`; the file imports **only** `protectedProcedure`
 *   (`:8`), so there is no admin procedure anywhere on those paths. ⚠ Their
 *   operation `kind` strings are `canvas.cast` / `canvas.recast` /
 *   `canvas.variations`, and those are **not** callable ids — naming a reach
 *   from the convenient string instead of the declaration is this correction's
 *   own class of mistake, so the ids are written out above.
 * - `routes/credits.ts:51` — **`credits.getCosts`, `publicProcedure`**,
 *   returning the whole object. Read by three live client surfaces
 *   (`ControlPanel.tsx`, `hooks/useCastingGeneration.ts`,
 *   `ImageViewerPanel.tsx`), each with the local literal as its fallback
 *   (`castingPrices.servedCost`).
 * - `routes/generation/castingExport.ts:98` — **`generation.costs`,
 *   `publicProcedure`**, the same object. (The callable id carries no
 *   `castingExport` segment: the router is merged into `generation` by
 *   procedure spread.)
 *
 * Both public ids are on `CLAUDE.md`'s enumerated public-endpoint allowlist —
 * so **the two that serve this table to anyone are two the old sentence did not
 * mention.** A price served publicly is the fact most likely to be wanted by
 * the next reader, which is why they are named first among the corrections.
 *
 * ⚠ **AND THE OTHER REACH CLAIM IN THIS PARAGRAPH WAS UNDERSTATED THE SAME
 * WAY.** It read *"`packagePricing.slotCost` (the D-15 package slots, reached
 * from `mintPackage` and the whole PARKED R7 evidence family)"*, which says
 * *parked*. `slotCost` has **nine production importers**, and two of them are
 * neither `mintPackage` nor parked: `refreshSlots.ts` — the **LIVE canvas
 * Refresh**, `generation.refreshSlots` and `refreshSlotsPlan`, both
 * `protectedProcedure` (`castingExport.ts:889`, `:831`) — and
 * `operationRecovery.ts`, the live recovery sweep started from
 * `_core/index.ts:421`. The rest are `evidence/evidencePackageExecution.ts`,
 * `evidence/evidencePackagePlan.ts`, `evidence/inkAcceptanceCommit.ts`,
 * `evidence/inkCandidateGeneration.ts`, `mintPackage.ts` (which re-exports it
 * again at `:79`) and `db/inkAddCandidates.ts`. **So this table is charged on a
 * customer-reachable path through `slotCost` as well as through boards: the
 * *sealed* reading fails twice over, not once.** `shared/vendorModelStatus.ts`
 * already carries the `refreshSlots` half — #1654's own correction of this same
 * premise, made one day earlier on the same table.
 *
 * The numbers are multiples of 5 already, so the price-scale sweep passes over
 * them without anybody having had to think about it; `flashMultiplier` is a
 * RATIO rather than a price and that sweep names it as one. ⚠ **It also has no
 * production reader** — every mention outside this declaration is a test or a
 * comment — so #1601's decision not to card it is right on sounder ground than
 * the one it used: not *"it dies with its module because the lane is
 * admin-only"*, but *nothing in production reads it*. Its **value** still
 * leaves the building, because both public endpoints return the whole object.
 *
 * The retirement itself is deferred to the legacy studio's own (#29, rung N8),
 * which carries it in its body so that #1601 closing does not take the deferral
 * with it.
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
   * **200 = 40 display** — the same slice a Follow is priced in, on his
   * ruling of 2026-10-02 (#1753), verbatim: *"go with your reccomendation on the
   * roll and follow one price is better and we earn more for rolls simple"*.
   * Eight of them is a sheet at 1,600 ledger / 320 display, and that is what a
   * Roll and a Follow each cost.
   *
   * ⚠ **THE TWO PRICES AGREE AND THEY ARE STILL TWO PRICES.** A roll costs
   * the house less than a follow does (about $0.12 of engine time against about
   * $0.19–0.26 for a Follow — 8 × $0.0232 measured 2026-09-30, plus the
   * interpreter), so one price does not mean one margin: it means a roll earns
   * more, and a customer reads one number instead of two. Where the two differ
   * now is the books, not the screen.
   *
   * ⚠ **THE FIGURE THIS CARRIED UNTIL 2026-10-08 WAS THE OLD ENGINE'S AND IT
   * OVERSTATED THE GAP BY ABOUT A FACTOR OF TWO** (#1953, from his finance
   * guy's refresh). It read *"roughly a third of what a follow does … against
   * $0.32-0.52"* — the reading #1699 was decided on, and true of the engine
   * that road ran then. Measured on today's engine a Follow is about
   * $0.19–0.26, so a roll costs about two thirds of one rather than a third.
   * ⚠ **His 320 display price is untouched by this, and the ratio was never
   * what set it** — his *"one price is better and we earn more for rolls
   * simple"* (#1753) was, and that is still true, by a smaller margin.
   *
   * It was **150** (30 display) for one day, 2026-10-01 to 2026-10-02, and
   * **20** from 2026-07-30 to 2026-10-01.
   */
  rollCandidate: 200,
  /**
   * One candidate on a sheet that was cast from an attached face — a FOLLOW.
   *
   * **200 = 40 display**, so a Follow is 1,600 ledger / 320 display.
   *
   * ⚠ **IT WAS DEARER THAN A ROLL FOR ONE DAY AND IS NOT ANY MORE.** The
   * spec priced a follow candidate above an open roll because it carries the
   * anchor photograph and the lineage prompt through the engine, and that cost
   * reading still holds — what changed is his answer to it (#1753): one price
   * for both, taken at the FOLLOW's number, so the dearer road sets the price and
   * the cheaper one earns more. This slice did not move; `rollCandidate` came up
   * to meet it.
   *
   * ⚠ **IT IS ITS OWN LITERAL AND MUST NEVER BE DERIVED FROM `rollCandidate`.**
   * That sentence carried the caveat *"even while the two are equal"*, dropped
   * it on 2026-10-01 when the two diverged, and **the caveat is back and is
   * load-bearing again** (#1753). They are two prices that agree, and a
   * `followCandidate: rollCandidate` would reprice a Follow to a Roll by a diff
   * that looks like it changed one number. Working law 4 bans a second list
   * shadowing a source of truth; it does not ask two independent facts to pretend
   * to be one. `followSlicePrice.test.ts` reads the DECLARATION and refuses
   * anything here but a bare numeral — and while the two values agree that arm
   * is the ONLY one in the file that can see this particular mistake, because
   * every arm comparing values is satisfied by either answer.
   */
  followCandidate: 200,
  /** Candidates per roll (§F: the sheet is eight). */
  rollCandidateCount: 8,
} as const;

/** 8 × 200 = 1,600 credits (320 display). Derived, never hardcoded twice. */
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
 * delete this arm then."* That commit was #1601 item 1: `castingV2.config` hands
 * it to the sheet, because the dock's single price line could stand for both
 * actions only while the two slices agreed. That arm is gone, and the quoter is
 * the whole reason this symbol may exist.
 *
 * ⚠ **THE SLICES AGREE AGAIN SINCE #1753, SO THE REASON ABOVE HAS EXPIRED
 * AND THE CONSTANT STAYS ON A DIFFERENT ONE.** A Follow has its own declared
 * price, and a total derived from it is how a surface quotes a Follow without
 * quoting a Roll and trusting the two to match. Deleting it would put the sheet
 * back to inferring a follow's price from the roll's — the mirror working law
 * 4 bans — and would have to be undone the next time he moves one price and
 * not the other. The quoter is still real (`routes/castingV2.ts`), so invariant 7
 * is satisfied either way; what changed is only that the figure it carries now
 * equals its neighbour's.
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
 * ⚠ **THE TABLE IS A PARAMETER BECAUSE THE TWO SLICES AGREE, AND THAT
 * REASON IS LOAD-BEARING AGAIN SINCE #1753.** An arm over equal numbers proves
 * nothing (working law 2): with the table read from module scope, an arm could
 * assert that `anchored: true` returns `followCandidate` and still pass with the
 * two branches SWAPPED — 200 either way. The real table disagreed with itself
 * for exactly one day (150 against 200, #1601 item 1 until #1753), which is the
 * only window in which the default alone would have caught a swap. It would not
 * now. **So the injected table is not a nicety — it is the whole reason any arm
 * in `followSlicePrice.test.ts` can see a branch swap at all**, and it is what
 * reddens the day somebody prices a Follow at a Roll for real.
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
 * The FREE Try again is a different fact entirely, and this constant is now
 * BOTH of its prices. An UNCHECKED view's FIRST ask is free (his #1220 *"go
 * with the free try again"*) and `castSlotRetryOffer` returns 0 for it; its
 * SECOND ask is an ordinary paid ask at this number — his rule on #1601, *"the
 * first Try again on an unchecked view is free, once; the second is paid"*.
 *
 * ⚠ **THIS PARAGRAPH SAID THE ONCE-ONLY RULE WAS NOT BUILT UNTIL #1601 ITEM 4,
 * AND WHAT IT DESCRIBED WAS A FREE RENDER WITH NO CEILING.** The free branch was
 * a pure function of the slot's state, and a free retry does not move that
 * state: a view delivered unchecked whose retry also arrived unchecked is still
 * unchecked. So the free ask renewed itself for as long as the conformance judge
 * stayed unavailable. The fact the slot could not carry lived on the operation
 * rows (`listSpentFreeViewRetryAngles`), which is where #1235 already proved a
 * per-slot fact can be read without a column.
 *
 * ⚠ **ALL OF THAT IS HISTORY AS OF #1903 SLICE 3 (2026-10-07) AND THE PRICE
 * BELOW IS NOT.** His ruling retired the free Try again, the reader above and
 * the once-only accounting; **this constant is what a Try again costs, and it
 * is now what EVERY Try again costs** — the only road left to one is a view
 * that was refunded, and there is no free branch to choose between. The
 * paragraphs above are kept because a reader meeting a `plannedCredits = 0`
 * row in the database needs to know what wrote it and that nothing can again.
 *
 * Charge and refund are one number here: `viewRetryService` charges
 * `offer.priceCredits` and refunds the same figure, so conservation does not
 * depend on this constant's value.
 */
export const CASTING_V2_VIEW_RETRY_PRICE_CREDITS = 1850;

/**
 * A WHOLE PACKAGE AGAIN, FLAT (#1903 slice 2) — every view of a signed Cast
 * rendered once more for a customer who simply does not like what arrived.
 *
 * **His price, verbatim, 2026-10-08 (terminal, on #1968):** *"on this card make
 * both sign and redo/regenerate 650 credis"*. **650 display = 3,250 ledger**,
 * and it is ONE number for the whole press however many views the Cast owns.
 *
 * ⚠ **IT WAS 350 PER VIEW UNTIL THIS COMMIT, AND THE SHAPE MOVED WITH
 * THE NUMBER.** The old constant was `CASTING_V2_PACKAGE_REDO_VIEW_PRICE_CREDITS`
 * — a per-SLOT price, five of which made 1,750 ledger — and a view that did not
 * arrive refunded its own slice. His word of 2026-10-08 ends both halves:
 *
 *   > *"Drop the 700 base + 200 per view split, since views are cut from two
 *   > sheets and can't be refunded one by one... Credits only come back if the
 *   > Sign can't be delivered at all."*
 *
 * The redo renders from the same two sheets, so the same sentence is true of
 * it: a refused view costs the house a whole re-rendered sheet, not a fifth of
 * one, and a per-slice refund would pay a customer back for a frame we bought.
 *
 * ⚠ **SO THERE IS NO PER-SLOT CONSTANT, AND THAT ABSENCE IS THE CONTROL.**
 * A surviving `*_VIEW_PRICE_CREDITS` for this road would be a back door: the
 * arithmetic for a slice refund would still be sitting there, one `/ 5` away
 * from being re-added by somebody reading an older comment.
 * `server/castingV2/packageRedoPrice.test.ts` refuses the name's return.
 *
 * **What a customer is never charged twice for**: the whole press is one
 * charge on one operation, and the only way credits come back is zero views
 * delivered — the total-loss road, which gives back all 3,250 exactly once.
 */
export const CASTING_V2_PACKAGE_REDO_PRICE_CREDITS = 3250;

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
