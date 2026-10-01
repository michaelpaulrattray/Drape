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
