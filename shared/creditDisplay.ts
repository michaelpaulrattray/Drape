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
 * reads 3,688; a Roll of 1,600 reads 320.
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
 * # `wholeDisplayLedger` returns LEDGER, not display
 *
 * `wholeDisplayLedger` runs the conversion backwards: it answers "what is the
 * nearest ledger amount a grant may be so that no credit in it is invisible on
 * screen". It lives here rather than beside the grant maths because the scale is
 * the thing it needs, and `LEDGER_PER_DISPLAY_CREDIT` is not exported to be
 * multiplied elsewhere. Its own docblock carries the rounding argument and the
 * one case that must never be passed to it.
 *
 * # A second function returns LEDGER: `ledgerForDisplay`
 *
 * It is the one road from a number a PERSON typed on the display scale to the
 * ledger amount that moves (#1986). It exists because the admin panel's Add
 * credits sent its typed figure straight to the ledger, so the founder typed
 * 100,000 and his balance rose by 20,000. The multiplication lives here and
 * nowhere else, for the same reason the division does.
 *
 * # What does NOT come through here
 *
 * Admin and moderator surfaces that READ THE BOOKS stay in ledger units. ⚠ **The
 * admin Add/Deduct credits road is no longer one of them (#1986)**: an admin
 * adjusting a balance is answering a customer who reads display credits, so the
 * figure typed, the toast, and the panel's balance are all on the display
 * scale. ⚠ **Nor, since #2010, the moderator change-request road and the
 * moderator credit views**: a moderator types display credits, the request
 * STORES LEDGER (the unit `change_requests.creditAmount` has always carried, so
 * no stored row is reinterpreted), and every staff screen that shows a request
 * or a transaction reads the customer's figure first with the ledger beside it
 * (`staffCreditFact`). What still reads the books in ledger is the audit and
 * immutable logs and the staff CSV exports, which are the books — and since
 * #2027 the exports, the reconciliation pane and a stored transaction
 * description say so on every figure (`staffLedgerProse` for the last), because
 * an unlabelled ledger figure copied into the display-unit request form grants
 * five times what was meant.
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
 * The ledger amount that moves when a person asks for `display` credits on the
 * scale they read (#1986 — the admin panel's Add / Deduct credits).
 *
 * Signed: a deduction is a negative display figure and comes back a negative
 * ledger figure. Refuses a non-integer or non-finite figure rather than
 * rounding it, because a credit adjustment that moved a different amount from
 * the one typed is the exact defect this function exists to end.
 */
export function ledgerForDisplay(display: number): number {
  if (!Number.isSafeInteger(display)) {
    throw new TypeError(
      `ledgerForDisplay: a display credit figure must be a whole number, got ${String(display)}`,
    );
  }
  return display * LEDGER_PER_DISPLAY_CREDIT;
}

/**
 * A SIGNED ledger movement — one row of a credit history — on the customer's
 * scale (#2010, the moderator's Credits tab).
 *
 * The sign picks the rounding, for the reasons at the top of this file: a
 * credit IN is a grant and rounds down like a balance; a credit OUT is a charge
 * and its size rounds up like a price, so a row never reads as taking less
 * than it took. Zero is zero.
 */
export function displayMovement(ledger: number): DisplayCredits {
  const value = finiteLedger(ledger, "displayMovement");
  if (value >= 0) return displayBalance(value);
  return -displayPrice(-value) as DisplayCredits;
}

/**
 * How a staff surface states a credit figure: the customer's number first,
 * the ledger it was computed from beside it (#2010).
 *
 * Staff answer customers, who read display credits, so that figure leads; the
 * ledger stays on the line because it is what the audit log, the immutable log
 * and the CSV exports carry, and a moderator reconciling a request against
 * them must be able to see the same number. The caller chooses the rounding by
 * choosing which function produced `display` — this only writes the sentence.
 */
export function staffCreditFact(display: DisplayCredits, ledger: number): string {
  return `${formatCredits(display)} credits · ${finiteLedger(ledger, "staffCreditFact").toLocaleString()} ledger`;
}

/**
 * Where a stored description stops being the product's sentence and becomes a
 * person's own words (#2027).
 *
 * Three writers end a `creditTransactions.description` with what a member of
 * staff typed: `Admin adjustment by admin 7: <reason>` (`server/db/admin.ts`),
 * `Credits added via change request #12: <reason>` and `Refund via change
 * request #12: <reason>` (`server/lib/adminActions/changeRequestActions.ts`).
 * A figure inside that reason is in whatever scale its author had in mind —
 * ledger before #1986/#2010, quite possibly display after — so no conversion
 * can be honest about it, and it is left exactly as typed. The row's own
 * AMOUNT fact states the real figure on both scales.
 */
const STAFF_WORDS_FOLLOW = /(?:by admin \d+|via change request #\d+): /;

/** `N credits`, `N,NNN credit`, `N rollover` — a figure the product composed. */
const COMPOSED_LEDGER_FIGURE = /(?<![\w#.,−+-])(\d{1,3}(?:,\d{3})+|\d+)(?![\d,.])(\s+)(credits?\b|rollover\b)/gi;

/**
 * A stored transaction description, as a member of staff reads it (#2027).
 *
 * The product writes descriptions with LEDGER figures in them — *"Monthly
 * credit refresh (N credits + R rollover)"*, *"Credit top-up: N
 * credits"* — and they are stored, so they stay that way; nothing here
 * rewrites a row. What changes is the reading: every figure the product
 * composed is restated the way every other staff figure is
 * (`staffCreditFact`), so a moderator who copies a number into the request
 * form — which takes the customer's figure since #2010 — copies the
 * customer's figure and not one five times larger.
 *
 * A grant rounds down like a balance (`displayBalance`); every composed figure
 * in a stored description today is a grant, which the census arm in
 * `server/creditDisplayGuard.test.ts` drives from the writers' own templates.
 * A person's reason is left as typed (see `STAFF_WORDS_FOLLOW`).
 */
export function staffLedgerProse(description: string): string {
  const marker = STAFF_WORDS_FOLLOW.exec(description);
  const cut = marker ? marker.index + marker[0].length : description.length;
  const composed = description.slice(0, cut).replace(
    COMPOSED_LEDGER_FIGURE,
    (_whole, figure: string, _space: string, word: string) => {
      const ledger = Number(figure.replace(/,/g, ""));
      const fact = staffCreditFact(displayBalance(ledger), ledger);
      return /^rollover$/i.test(word) ? `${fact} rollover` : fact;
    },
  );
  return composed + description.slice(cut);
}

/**
 * What one credit movement is CALLED in a customer's own data export — the
 * kind and the direction, and never a reason the row does not carry (#2475).
 *
 * # Why the export composes its sentence instead of printing the stored one
 *
 * `staffLedgerProse` above is the other half of this question and takes the
 * other road: a moderator reads the STORED sentence with its composed figures
 * restated, because a moderator has the ledger figure beside every number and
 * can see which scale each is on. A customer has neither, and the stored
 * sentence cannot be made correct for them:
 *
 *   - it holds LEDGER figures — *"Monthly credit refresh (180000 credits + 0
 *     rollover)"* on a plan whose card says 36,000 — and those rows are
 *     already written, so no fix reaches them retroactively (#1736's own
 *     second bullet);
 *   - `staffLedgerProse`'s repair cannot be reused as written, because the
 *     labelled form it produces (*"36,000 credits · 180,000 ledger"*) puts the
 *     internal figure on a customer's line on purpose;
 *   - and the half-fix — converting the row's `amount` while still printing
 *     the stored sentence — is worse than today: one record would hold
 *     `"amount": 36000` beside *"(180,000 credits …)"*, two scales with nothing
 *     to tell them apart.
 *
 * So the export states the one thing it can state truthfully and completely:
 * what KIND of movement this was, which way it went, and how many credits on
 * the only scale the customer has ever been shown.
 *
 * # It never claims a reason, and that is deliberate rather than terse
 *
 * One `type` covers movements with different causes: `subscription` is both
 * the monthly refresh and the plan-credit expiry 30 days after a plan ends
 * (`server/db/billing.ts`), and `bonus` is the welcome bonus, the referral
 * bonus, goodwill credits AND the 90-day promo expiry. A sentence saying
 * *"Monthly plan refresh"* over an expiry row would be a NEW wrong statement
 * in place of a wrongly-scaled one, which is no repair at all. The direction
 * comes from the sign the row already carries; the cause does not, so it is
 * not asserted.
 *
 * ⚠ **The declared loss, so it is not discovered later as a defect**: the
 * stored sentences that hold no figure at all are correct as written and are
 * dropped with the rest — *"Plan credits expired 30 days after the plan
 * ended"*, *"Welcome bonus: referred by a friend"*, *"Wardrobe VTO
 * generation"*. Nothing of the CUSTOMER'S leaves the export (the amount, the
 * kind, the balance, the date and every other row stay, and a stored
 * description is the product's own prose or a staff member's, never theirs) —
 * but a reason they could read before is gone, and restoring one honestly
 * means naming the cause on the ROW rather than parsing it back out of our old
 * prose.
 */
const CUSTOMER_CREDIT_KIND: Readonly<Record<string, string>> = {
  generation: "Studio work",
  purchase: "Purchase",
  bonus: "Bonus",
  refund: "Refund",
  signup: "Signup bonus",
  topup: "Credit top-up",
  subscription: "Plan credits",
  admin_add: "Adjustment by the Klieg team",
  admin_deduct: "Adjustment by the Klieg team",
};

/**
 * The kind word for a `creditTransactions.type`, or a plain fallback.
 *
 * The vocabulary is held equal to the column's own enum by
 * `server/gdprExportCreditScale.test.ts`, which reads `enumValues` off the
 * schema rather than restating the nine values — a tenth kind added to the
 * column reddens there instead of shipping as "Credit movement". The fallback
 * exists anyway, because a row written before a value was retired must still
 * export rather than throw.
 */
export function customerCreditKind(type: string): string {
  return CUSTOMER_CREDIT_KIND[type] ?? "Credit movement";
}

/**
 * The sentence a customer's export states about one credit movement.
 *
 * Takes a `DisplayCredits`, so the figure in the sentence is the SAME
 * converted figure as the record's own `amount` field and cannot be a second
 * scale — which is the property the half-fix above fails. A ledger number
 * passed here does not compile.
 */
export function customerCreditNote(type: string, movement: DisplayCredits): string {
  const value = finiteLedger(movement, "customerCreditNote");
  const kind = customerCreditKind(type);
  if (value === 0) return `${kind} — no credits moved`;
  /*
    The magnitude of a display figure is still a display figure — this takes no
    scale decision, which is why it is a cast inside this module rather than a
    conversion. The sign has already chosen the rounding in `displayMovement`.
  */
  const magnitude = (value < 0 ? -value : value) as DisplayCredits;
  return `${kind} — ${value < 0 ? "used" : "added"} ${formatCredits(magnitude)} credits`;
}

/**
 * The most one admin Add or Deduct may move, in DISPLAY credits (#1986) — and,
 * since #2010, the most one moderator credit request may ask for.
 *
 * It was `100000` LEDGER until #1986 — one fifth of that on screen — so the cap and
 * the figure typed were both on a scale nobody in the panel could see. Read by
 * `server/routes/admin/users.ts` (the authority) and by `CreditModal`; and by
 * `server/routes/moderator.ts` (the authority) and `ChangeRequestModal` (#2010).
 *
 * It lives in this module rather than beside the reason cap in
 * `shared/inputLimits.ts` because it bounds a MONEY authority, and this file is
 * on `MONEY_PATHS` (`.github/money-surfaces.sh`) while that one is not — a
 * change to how many credits one action may move must read as money. It is a
 * CAP, not a price, which is why its name does not say COST, PRICE or CREDIT:
 * the Atlas's price collector reads those words as a price.
 */
export const ADMIN_ADJUST_DISPLAY_MAX: DisplayCredits = 100_000 as DisplayCredits;

/**
 * Display credits above which the product reads them in millions.
 *
 * Read from the plan table rather than chosen: Business is 2,350,000 ledger
 * (470,000 display) and Scale is 13,750,000 ledger (2,750,000 display), so a
 * threshold of one million display credits is exactly the card's "M-style from
 * Scale up" and moves with the tiers rather than needing to be re-picked.
 *
 * ⚠ **THOSE FOUR FIGURES READ 3,000,000 / 600,000 / 20,000,000 / 4,000,000
 * UNTIL #1607, AND THE RUNGS HAD ALREADY MOVED UNDER THEM** — #1602 slice 2
 * adopted his volume-discount ladder on 2026-10-01, a day after this block was
 * written. The CONCLUSION is unchanged and that is the only reason this was a
 * stale comment rather than a defect: 470,000 is still under a million and
 * 2,750,000 is still over it, so the threshold still lands exactly between
 * Business and Scale. A comment cannot fail a test, which is why it is read
 * here rather than trusted.
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
