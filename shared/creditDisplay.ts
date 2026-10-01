/**
 * THE ONE PLACE A CREDIT NUMBER BECOMES A NUMBER A CUSTOMER READS (#1600, P1-1).
 *
 * His ruling, verbatim, in the terminal: *"Squall recommends the app works out
 * every credit number people see, with the Stripe numbers kept only as a
 * reference to check against. I agree, because it keeps one source of truth."*
 *
 * # Two scales, and only this module knows there are two
 *
 * The **ledger** is what the database stores, what is charged, and what is
 * refunded. It does not change under P1 and nothing here writes it. The
 * **display** scale is what a customer reads: `ledger / 5`. A balance of 18,440
 * reads 3,688; a Roll of 1,200 reads 240.
 *
 * `LEDGER_PER_DISPLAY_CREDIT` is the ONLY place that 5 lives. A second copy —
 * a `/ 5` at a render site, a `* 50` left over from the legacy multiplier — is
 * working law 4, and `server/creditDisplayGuard.test.ts` refuses one.
 *
 * # Rounding is not symmetric, and the asymmetry is the whole safety property
 *
 * A balance rounds DOWN and a price rounds UP, so the product never shows a
 * balance higher than what is spendable, nor a price lower than what is
 * charged. Rounding the other way produces the one defect a pricing surface
 * cannot have: a customer who is shown enough credits, presses the button, and
 * is refused by the server.
 *
 * The two are therefore separate functions rather than one with a mode flag —
 * a flag is a decision at every call site, and a call site that gets it wrong
 * looks exactly like one that got it right.
 *
 * # `DisplayCredits` is a brand, and it is the guard that cannot be grepped past
 *
 * `formatCredits` accepts only a value one of these functions produced. So a
 * raw ledger number cannot be formatted for a customer by accident: it is a
 * TYPE error, caught by `pnpm check` at the call site, before any reader runs.
 *
 * ⚠ **The brand binds NEW code from the moment it lands and nothing else.**
 * Today no site calls `formatCredits`, so nothing breaks; each site routed
 * under P1-1's remaining slices gains compile-time enforcement as it is routed.
 * The textual guard covers what a type cannot see — scale arithmetic written
 * out by hand, and the sites not yet routed.
 *
 * # One function here returns LEDGER, not display
 *
 * `wholeDisplayLedger` runs the conversion backwards: it answers "what is the
 * nearest ledger amount a grant may be so that no credit in it is invisible on
 * screen". It lives here rather than beside the grant maths because the scale is
 * the thing it needs, and `LEDGER_PER_DISPLAY_CREDIT` is not exported to be
 * multiplied elsewhere. Its own docblock carries the rounding argument and the
 * one case that must never be passed to it.
 *
 * # What does NOT come through here
 *
 * Admin and moderator surfaces stay in **ledger units, labelled "units"**. They
 * are reading the books, not being quoted a price, and a staff figure that
 * silently changed scale would make every support conversation ambiguous.
 */

/**
 * Ledger credits per displayed credit.
 *
 * ⚠ **THE ONLY PLACE THIS NUMBER EXISTS.** Everything else divides by calling
 * a function below, so the scale can never be half-changed.
 */
export const LEDGER_PER_DISPLAY_CREDIT = 5;

declare const DISPLAY_CREDITS: unique symbol;

/**
 * A credit number on the customer's scale, produced by one of the functions
 * below and by nothing else.
 *
 * It is a `number` at runtime — the brand exists only in the type system, so
 * it costs nothing and arithmetic on it still works. What it buys is that
 * `formatCredits(someLedgerValue)` does not compile.
 */
export type DisplayCredits = number & { readonly [DISPLAY_CREDITS]: true };

/**
 * Refuse a value that cannot be divided into a number worth showing.
 *
 * A non-finite ledger value means an upstream defect, and the two ways of
 * tolerating it are both worse than this: `NaN` renders to a customer as
 * literally "NaN credits", and a silent 0 tells them they have nothing. Both
 * are quieter than a throw and neither is safer.
 *
 * A NON-integer is deliberately NOT refused. `CREDIT_COSTS.flashMultiplier` is
 * `0.5` and produces fractional ledger costs today, so a guard against them
 * would refuse a price the product really charges. `floor` and `ceil` already
 * take fractions in the conservative direction, which is the whole contract.
 */
function finiteLedger(ledger: number, caller: string): number {
  if (!Number.isFinite(ledger)) {
    throw new TypeError(
      `${caller}: a credit number reaching a customer must be finite, got ${String(ledger)}`,
    );
  }
  return ledger;
}

/**
 * A balance, allowance, grant, "left", earned or referral amount — anything the
 * customer HAS.
 *
 * Rounds DOWN, so the number shown is never more than what can be spent.
 */
export function displayBalance(ledger: number): DisplayCredits {
  return (Math.floor(finiteLedger(ledger, "displayBalance") / LEDGER_PER_DISPLAY_CREDIT)) as DisplayCredits;
}

/**
 * An amount given back.
 *
 * Rounds DOWN for the same reason a balance does — it lands ON a balance, and a
 * refund quoted above what arrives is a support conversation.
 *
 * Separate from `displayBalance` despite the identical arithmetic, because the
 * two answer different questions and the day one of them needs to move, the
 * call sites must already be distinguishable. Held equal by a property test
 * rather than by one calling the other, so neither silently inherits a change
 * meant for the other.
 */
export function displayRefund(ledger: number): DisplayCredits {
  return (Math.floor(finiteLedger(ledger, "displayRefund") / LEDGER_PER_DISPLAY_CREDIT)) as DisplayCredits;
}

/**
 * A cost, price, estimate, or "Need N credits" — anything the customer PAYS.
 *
 * Rounds UP, so the number shown is never less than what is charged.
 */
export function displayPrice(ledger: number): DisplayCredits {
  return (Math.ceil(finiteLedger(ledger, "displayPrice") / LEDGER_PER_DISPLAY_CREDIT)) as DisplayCredits;
}

/**
 * The spent half of an "X of Y spent" pair, derived from the two DISPLAYED
 * numbers so that the pair adds up on screen (#1600's own requirement).
 *
 * Rounding each of three numbers independently is what breaks such a pair:
 * `floor(spent/5) + floor(remaining/5)` can come to one less than
 * `floor(total/5)`, and a customer reading "3,687 of 3,688" with nothing
 * missing is being shown an arithmetic error. Subtracting the two displayed
 * numbers cannot produce one.
 */
export function displaySpent(spentLedger: number, remainingLedger: number): DisplayCredits {
  const total = displayBalance(
    finiteLedger(spentLedger, "displaySpent") + finiteLedger(remainingLedger, "displaySpent"),
  );
  return (total - displayBalance(remainingLedger)) as DisplayCredits;
}

/**
 * A ledger amount a GRANT or a DEDUCTION may safely be: truncated toward zero
 * to a whole number of display credits (#1604 slice 2, P1-5 done-when 2).
 *
 * # Why a grant has to be quantised at all
 *
 * Everything above converts a stored number into a shown one. This converts in
 * the other direction, and it is the only function here that returns LEDGER.
 * The reason it exists is that `displayBalance` rounds DOWN: a rollover of
 * 7,333 ledger reads 1,466, and `1,466 × 5` is 7,330 — so three ledger credits
 * sit on the balance that the customer can never be shown and will never
 * knowingly spend. They are not stolen and they are not a rounding error in the
 * usual sense; they are permanently invisible, which is worse, because no screen
 * can ever be made to add up while they are there.
 *
 * Granting 7,330 instead costs the customer three ledger credits — six tenths of
 * one display credit — and buys exactness: every grant this function produces
 * satisfies `wholeDisplayLedger(x) / 5 === displayBalance(x)`, so the ledger and
 * the screen agree by construction rather than by luck.
 *
 * # Toward zero, not down, and the sign is the whole reason
 *
 * `calculateCreditAdjustment` returns a SIGNED number: positive when an upgrade
 * grants credits, negative when a downgrade takes them back. Truncating toward
 * zero is conservative in BOTH directions — a grant is never more than can be
 * shown, and a deduction is never more than the mirror grant would have been.
 * `Math.floor` would be wrong on the negative half: it rounds −3,666.5 to
 * −3,667, making the deduction BIGGER than the upgrade that earned it, which is
 * one half of the credit-minting loop the #664 review closed. That function
 * already truncates toward zero for exactly this reason; this preserves the
 * property rather than replacing it.
 *
 * # What must NOT be passed through here
 *
 * ⚠ **A balance being CARRIED, never.** On an early renewal
 * `webhooks.ts` passes `(balance) => balance` so the whole balance survives in
 * full (#664 review finding 1). Quantising that would take up to four ledger
 * credits off a customer for no reason at all — it is not a grant being
 * computed, it is money they already hold. This is why the quantiser sits in the
 * three functions that COMPUTE a grant or a deduction and not at
 * `refreshMonthlyCredits`'s chokepoint, which would have caught the carry too.
 *
 * # What this does not yet make exact
 *
 * A renewal writes `monthlyCredits + rollover + purchased`. This makes the
 * rollover a whole number of display credits; the other two are other cards'
 * (`PLAN_TIERS` is #1602's, top-up grants are #1606's). Every
 * `PLAN_TIERS.monthlyCredits` value happens to be a multiple of 5 today —
 * measured, not assumed — so the rollover and proration shares are the only
 * sources of a fractional display credit on that sum right now. A balance is
 * therefore not guaranteed exact by this function alone, and nothing here
 * claims it is.
 */
export function wholeDisplayLedger(ledger: number): number {
  const magnitude =
    displayBalance(Math.abs(finiteLedger(ledger, "wholeDisplayLedger"))) * LEDGER_PER_DISPLAY_CREDIT;
  return ledger < 0 ? -magnitude : magnitude;
}

/**
 * Display credits above which the product reads them in millions.
 *
 * Read from the plan table rather than chosen: Business is 3,000,000 ledger
 * (600,000 display) and Scale is 20,000,000 ledger (4,000,000 display), so a
 * threshold of one million display credits is exactly the card's "M-style from
 * Scale up" and moves with the tiers rather than needing to be re-picked.
 */
export const MILLIONS_STYLE_FROM: DisplayCredits = 1_000_000 as DisplayCredits;

/**
 * The string a customer reads.
 *
 * Takes only a `DisplayCredits`, so a ledger number cannot reach a screen
 * through it. Grouping is `toLocaleString`, which is what every site does today;
 * from a million up it reads "4M" rather than "4,000,000", because a plan card
 * comparing 600,000 with 20,000,000 is a row of digits nobody counts.
 */
export function formatCredits(display: DisplayCredits): string {
  const value = finiteLedger(display, "formatCredits");
  if (Math.abs(value) < MILLIONS_STYLE_FROM) return value.toLocaleString();
  const millions = value / 1_000_000;
  /* One decimal only when it says something: 4M, not 4.0M; 1.5M, not 1.5000M. */
  const rounded = Math.round(millions * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}M`;
}
