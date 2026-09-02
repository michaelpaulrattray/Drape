/**
 * THE CREDIT-DISCREPANCY THRESHOLD, IN ONE PLACE (#416).
 *
 * `FlaggedDiscrepanciesCard` owns the *lens* — a moderator picks any of the six
 * below to widen or narrow the list they are investigating. The account menu's
 * `Moderation` badge cannot ask a question; it has to state a number. So it
 * counts at the DEFAULT, and the default now lives here rather than inside the
 * card, because a badge and a card each holding their own `500` is working law
 * 4 with a money-adjacent number in it.
 *
 * ⚠ **The badge and the card can legitimately differ, and that is not the drift
 * this module prevents.** Narrowing the card's chip to `5000+` filters a LIST;
 * it does not change how many accounts need attention. The badge is the count
 * at the attention threshold, the chips are a lens over it — the same
 * relationship an unread count has to a search box. What must never happen is
 * the two disagreeing about what "the default" IS, which is the only part a
 * shared constant can actually guarantee.
 *
 * Measured the day this shipped, through the product's own reader, in BOTH
 * worlds — because the two disagree and only one of them is where he looks:
 *
 * - **production**: 1 flagged at every one of the six (his own account, −11,600),
 *   so no divergence is visible there at all;
 * - **dev**: 1 flagged at 100 and 500, **0 at 2000 and 5000** (verify-bot, 750).
 *
 * So the divergence is not hypothetical — dev shows it today. A moderator with
 * the card on `2000+` sees an empty list beside a badge reading 1, and that is
 * CORRECT: one account needs attention, and they are looking through a narrower
 * lens. The rule above is what makes that readable rather than a bug.
 */

/** What the badge counts at, and what the card opens on. */
export const DEFAULT_DISCREPANCY_THRESHOLD = 500;

/** The lenses the card offers. The default must be one of them. */
export const DISCREPANCY_THRESHOLDS = [100, 250, 500, 1000, 2000, 5000] as const;
