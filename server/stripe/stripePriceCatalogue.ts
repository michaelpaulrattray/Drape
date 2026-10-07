/**
 * THE PRICE A CUSTOMER IS CHARGED IS AN OBJECT IN STRIPE'S CATALOGUE, FOUND BY
 * ITS LOOKUP KEY (#1605 bullet 1, P1-6).
 *
 * Until this module, both money paths MINTED their own price at the moment of
 * use: checkout built an inline `price_data` from `PLAN_TIERS`
 * (`stripeService.ts:94`) and a plan change called `stripe.prices.create`
 * (`:585`). Both worked, and both meant the charge was whatever this
 * repository happened to compute in that process — so Stripe's own catalogue,
 * which is where his finance guy and the relay look, was a parallel copy of
 * the prices rather than the thing being charged. Working law 4, on the number
 * that moves money.
 *
 * # What this module is, in one sentence
 *
 * `klieg_<plan>_<interval>_v2` → a Stripe price id, or a REFUSAL that names
 * the key. There is no third outcome, and that is the whole design.
 *
 * ## ⚠ THE WORD FOR A YEAR IS NOT THE SAME WORD ON BOTH SIDES
 *
 * This product's vocabulary is `monthly` | `annual` (`BillingIntervalChoice`);
 * the keys in Stripe's catalogue say `monthly` | **`yearly`**. Composing the
 * key from the product's own word gives `klieg_pro_annual_v2`, which does not
 * exist, and the failure would be a refusal on every annual checkout — loud,
 * but loud on the day a customer pressed the button. `KEY_INTERVAL` is the one
 * place the two dialects meet and `stripePriceCatalogue.test.ts` pins all
 * fourteen composed keys against the fourteen read out of Stripe.
 *
 * # Why it refuses rather than falling back
 *
 * The card's rule, verbatim: *"A missing lookup key is a refusal at boot or at
 * checkout that names the key, never a silent fallback to inline pricing
 * (invariant 7)."* A fallback is the worse failure in a way worth spelling
 * out: it would charge a price from this tree while the catalogue the business
 * reads says something else, and nothing anywhere would look wrong.
 *
 * ## ⚠ AT CHECKOUT, NOT AT BOOT — AND THE CARD ALLOWS EITHER
 *
 * A boot refusal on a missing key crash-loops the service. This repository has
 * paid for exactly that once (the evidence boot guards, 2026-07-31) and the
 * trade is not close: a checkout-time refusal names the key just as precisely
 * and costs only the one action that cannot be priced, where a boot refusal
 * turns "nobody can subscribe" into "nobody can use the product at all" — for
 * a product whose live accounts are, measured at P1-10 step 1, six and all
 * free. So the resolution happens on the request path.
 *
 * # Why there is no cache
 *
 * A lookup key is not a price id: Stripe lets a key be MOVED to a new price,
 * which is precisely how a price change is rolled out, and the `_v2` suffix
 * says this catalogue has already been versioned once. A cached id would go on
 * charging the old price until a deploy, silently, which is the same class of
 * defect this module exists to remove. The cost of not caching is one
 * `prices.list` on a button a customer presses by hand; the cost of caching
 * wrongly is charging the wrong amount. Measured need, not taste: if the
 * Machinist ever reads this call as a latency problem, a short TTL is the
 * answer and it belongs on a card with the number on it.
 */
import type Stripe from "stripe";
import { SUBSCRIPTION_PRODUCTS, type SubscriptionPlan } from "./stripeProducts";
import {
  type BillingIntervalChoice,
  periodPriceInCents,
  stripeIntervalOf,
} from "@shared/annualBilling";
import {
  type TopupBracket,
  topupBracketFor,
  topupBracketPackSize,
} from "@shared/creditTopups";
import { planCreditSliderPriceInCents } from "@shared/planCreditSlider";
import { planCreditSliderUnitsAllowed } from "./planCreditSlider";

/** The catalogue generation these keys belong to. Bumping it is a founder-side
 *  act in Stripe FIRST — the keys must exist before the code asks for them. */
export const PRICE_LOOKUP_KEY_VERSION = "v2";

/**
 * WHAT A CUSTOMER IS TOLD WHEN THE CATALOGUE CANNOT PRICE THEIR PLAN.
 *
 * The refusal above names the lookup key because the repair is one read in
 * Stripe and the person doing it needs the key. **The customer is not that
 * person.** The disappearing-technology law is explicit about this road — *no
 * engine name on a path someone must walk*, and *a refusal says what was
 * refused and what to do* — so the key goes to the log and this sentence goes
 * to the screen.
 *
 * ⚠ **It is authored rather than left to the client's fallback, and the
 * difference is honesty about money.** Without it, a plan change refused here
 * reaches `ChangePlanModal`'s generic line: *"We lost contact while changing
 * your plan. Check your plan before trying again."* Nothing was attempted when
 * this fires — the resolve happens before any Stripe write — so that sentence
 * sends somebody to check a plan that certainly did not change, which is the
 * class `shared/spokenError` exists because of. This one says what is true:
 * nothing happened, nothing was charged, and it is ours to fix rather than
 * theirs to retry differently.
 */
export const PRICE_UNAVAILABLE_SENTENCE =
  "We could not price that plan just now, so nothing was changed and nothing was charged. This one is on us — please try again shortly.";

/** ⚠ The product says `annual`; the catalogue says `yearly`. See the docblock. */
const KEY_INTERVAL: Record<BillingIntervalChoice, "monthly" | "yearly"> = {
  monthly: "monthly",
  annual: "yearly",
};

/** The lookup key for one plan at one interval. Pure — no network. */
export function priceLookupKey(
  plan: SubscriptionPlan,
  interval: BillingIntervalChoice,
): string {
  return `klieg_${plan}_${KEY_INTERVAL[interval]}_${PRICE_LOOKUP_KEY_VERSION}`;
}

/**
 * A price this product means to charge that the catalogue cannot supply.
 *
 * It carries the `lookupKey` as a field rather than only inside the message,
 * because the call sites turn it into a customer-facing refusal and a message
 * parsed for a key is the kind of coupling that breaks on a reworded sentence.
 */
export class StripePriceUnavailableError extends Error {
  readonly lookupKey: string;
  constructor(lookupKey: string, why: string) {
    super(`Stripe price lookup key ${lookupKey} ${why}`);
    this.name = "StripePriceUnavailableError";
    this.lookupKey = lookupKey;
  }
}

/**
 * The price id for a plan at an interval, read from Stripe's catalogue.
 *
 * Refuses — never returns a fallback — when the key is absent, when two active
 * prices claim it, when the price it names does not recur at the interval
 * asked for, or when its amount is not the amount this product's own screens
 * show.
 *
 * ⚠ **The last of those four is a CONSISTENCY refusal and is deliberately
 * separate from the other three**, because it is the only one that is not
 * about finding the price. The defect it guards is this card's own headline
 * sentence: a page that says one number above a charge that is another. Bullet
 * 2 made the two equal by construction (whole-dollar years) and all fourteen
 * agreed when read in test mode on 2026-10-01, so this arm should never fire
 * — which is exactly why it is here rather than assumed. A price edited in the
 * Stripe dashboard alone would otherwise charge a figure no screen in this
 * product has ever shown.
 */
export async function resolvePriceId(
  client: Pick<Stripe, "prices">,
  plan: SubscriptionPlan,
  interval: BillingIntervalChoice,
): Promise<string> {
  /* ⚠ `SubscriptionPlan` is `keyof` a `Record<string, …>`, so the compiler
     calls it `string` and an unknown rung type-checks all the way to the wire.
     Today's checkout would reach `product.priceInCents` on `undefined` and
     throw a TypeError naming nothing; a refusal that names the rung is the
     same stop with a readable reason. */
  const product = SUBSCRIPTION_PRODUCTS[plan];
  if (!product) {
    throw new StripePriceUnavailableError(
      `klieg_${plan}_?_${PRICE_LOOKUP_KEY_VERSION}`,
      `names no plan this product sells (${plan})`,
    );
  }

  const lookupKey = priceLookupKey(plan, interval);

  const page = await client.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 2,
  });

  /* Filtered even though we asked by key: a price whose `lookup_key` is null
     must never be accepted as the answer to a question about a key. */
  const matches = page.data.filter((price) => price.lookup_key === lookupKey);

  if (matches.length === 0) {
    throw new StripePriceUnavailableError(
      lookupKey,
      "names no active price in Stripe's catalogue",
    );
  }
  if (matches.length > 1) {
    throw new StripePriceUnavailableError(
      lookupKey,
      `is claimed by ${matches.length} active prices (${matches.map((p) => p.id).join(", ")})`,
    );
  }

  const price = matches[0];
  const wantedInterval = stripeIntervalOf(interval);
  if (price.recurring?.interval !== wantedInterval) {
    throw new StripePriceUnavailableError(
      lookupKey,
      `names price ${price.id}, which recurs ${price.recurring?.interval ?? "not at all"} and not per ${wantedInterval}`,
    );
  }

  const expected = periodPriceInCents(product.priceInCents, interval);
  if (price.unit_amount !== expected) {
    throw new StripePriceUnavailableError(
      lookupKey,
      `names price ${price.id} at ${price.unit_amount} cents, which is not the ${expected} cents this product shows for ${plan} ${interval}`,
    );
  }

  return price.id;
}

/**
 * THE LOOKUP KEY FOR THE PLAN CREDIT SLIDER'S ADD-ON (#1832).
 *
 * `klieg_<plan>_credits_<interval>_v2` — the two keys his own hand created on
 * 2026-10-07 (`klieg_studio_credits_monthly_v2` at 900¢ and
 * `klieg_studio_credits_yearly_v2` at 9000¢, both on the product that carries
 * `klieg_studio_monthly_v2`), composed from the rung id rather than typed for
 * `priceLookupKey`'s reason one function up.
 *
 * ⚠ **IT KEYS ON THE RUNG ID, WHICH IS THE HALF HIS RENAME LEAVES ALONE.** His
 * word, 2026-10-07: *"rename the Studio plan to Pro Plus, everywhere a customer
 * sees it … The internal Stripe lookup names can stay as they are if changing
 * them would break anything"* (#1900). Composing from the NAME would have
 * turned a copy change into a catalogue migration; the rung id is the
 * product's own slug and it does not move.
 *
 * ⚠ **AND IT IS A DIFFERENT KEY FROM THE PLAN'S, NOT A SUFFIX ON IT** —
 * `klieg_studio_credits_monthly_v2` sits beside `klieg_studio_monthly_v2`
 * rather than replacing it, because the subscription carries BOTH as two items
 * and the base must stay findable by its own key (`subscriptionItemsOf`, which
 * is what tells the base item from the add-on).
 */
export function planCreditsPriceLookupKey(
  plan: SubscriptionPlan,
  interval: BillingIntervalChoice,
): string {
  return `klieg_${plan}_credits_${KEY_INTERVAL[interval]}_${PRICE_LOOKUP_KEY_VERSION}`;
}

/**
 * Is this lookup key the slider's add-on rather than a plan's base price?
 *
 * ⚠ **THE PREDICATE IS DERIVED FROM THE COMPOSER, NOT A SUBSTRING GUESS.** A
 * `key.includes("_credits_")` would be a second statement of the key's shape,
 * and the drift this repository has paid for is exactly that — so the test is
 * *does any rung compose this key at either interval*, asked of the function
 * that composes them. The population is the rungs the product sells, which is
 * the same list the plan resolver parses against.
 */
export function isPlanCreditsLookupKey(key: string | null | undefined): boolean {
  if (!key) return false;
  for (const plan of Object.keys(SUBSCRIPTION_PRODUCTS) as SubscriptionPlan[]) {
    if (
      key === planCreditsPriceLookupKey(plan, "monthly")
      || key === planCreditsPriceLookupKey(plan, "annual")
    ) {
      return true;
    }
  }
  return false;
}

/**
 * The price id for the slider's add-on at an interval, read from Stripe's
 * catalogue.
 *
 * The same four refusals as the plan road — absent, ambiguous, the wrong
 * recurrence, or an amount this product's own screens do not show — with the
 * top-up road's two differences, because this price is also sold per unit:
 *
 * ⚠ **THE AMOUNT IS PER UNIT, NOT PER ORDER.** `unit_amount` is compared
 * against one step's price at this interval, because the line's total is that
 * amount times the `quantity` the subscription item carries. Comparing it
 * against a whole order would pass only for a one-step dial.
 *
 * ⚠ **AND IT MUST RECUR, unlike a pack.** A slider position is part of a
 * subscription: a one-off price under this key would be a customer paying once
 * for an allowance that arrives every month, which is the mirror of the defect
 * `resolveTopupPriceId`'s inverted check guards.
 *
 * ⚠ **THE UNIT COUNT IS REFUSED HERE TOO, past the rung's own ceiling.** The
 * input schemas bound it, and an input schema is not the only caller a money
 * helper can ever have (`topupBracketFor`'s reasoning). `units === 0` never
 * reaches this function — a plain plan sends no add-on line at all — so a zero
 * here is a caller that has not asked itself whether it needs the add-on, and
 * it refuses rather than resolving a price for nothing.
 */
export async function resolvePlanCreditsPriceId(
  client: Pick<Stripe, "prices">,
  plan: SubscriptionPlan,
  interval: BillingIntervalChoice,
  units: number,
): Promise<string> {
  const lookupKey = planCreditsPriceLookupKey(plan, interval);

  const allowed = planCreditSliderUnitsAllowed(plan);
  if (allowed === 0) {
    throw new StripePriceUnavailableError(
      lookupKey,
      `names a credit slider, and ${plan} carries none`,
    );
  }
  if (!Number.isInteger(units) || units < 1 || units > allowed) {
    throw new StripePriceUnavailableError(
      lookupKey,
      `was asked for ${String(units)} step(s), which is not between 1 and the ${allowed} this product sells`,
    );
  }

  const page = await client.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 2,
  });

  /* Asked by key and filtered by key, for `resolvePriceId`'s reason: a price
     whose own `lookup_key` is null is not the answer to a question about one. */
  const matches = page.data.filter((price) => price.lookup_key === lookupKey);

  if (matches.length === 0) {
    throw new StripePriceUnavailableError(
      lookupKey,
      "names no active price in Stripe's catalogue",
    );
  }
  if (matches.length > 1) {
    throw new StripePriceUnavailableError(
      lookupKey,
      `is claimed by ${matches.length} active prices (${matches.map((p) => p.id).join(", ")})`,
    );
  }

  const price = matches[0];
  const wantedInterval = stripeIntervalOf(interval);
  if (price.recurring?.interval !== wantedInterval) {
    throw new StripePriceUnavailableError(
      lookupKey,
      `names price ${price.id}, which recurs ${price.recurring?.interval ?? "not at all"} and not per ${wantedInterval}`,
    );
  }

  const expected = planCreditSliderPriceInCents(1, interval);
  if (price.unit_amount !== expected) {
    throw new StripePriceUnavailableError(
      lookupKey,
      `names price ${price.id} at ${price.unit_amount} cents a step, which is not the ${expected} cents this product shows for one ${interval} step`,
    );
  }

  return price.id;
}

/**
 * The lookup key for a top-up rate band (#1606).
 *
 * `klieg_topup_<the band's own pack size>_v2` — composed from the band rather
 * than typed, for the reason `priceLookupKey` above is composed: three strings
 * sitting beside three prices is a second copy of the catalogue, and the drift
 * would be a checkout that refuses while Stripe holds a perfectly good price.
 * The three keys this produces are pinned against the three his hand created
 * in `stripePriceCatalogue.test.ts`.
 */
export function topupPriceLookupKey(bracket: TopupBracket): string {
  return `klieg_topup_${topupBracketPackSize(bracket)}_${PRICE_LOOKUP_KEY_VERSION}`;
}

/**
 * The price id for a top-up of `units`, read from Stripe's catalogue.
 *
 * The same four refusals as the plan road and for the same reasons — absent,
 * ambiguous, the wrong KIND of price, or an amount this product's own screens
 * do not show — with one difference that matters:
 *
 * ⚠ **THE KIND CHECK IS INVERTED HERE.** A plan price must recur; a top-up
 * price must NOT. A recurring price sent through `mode: "payment"` is refused
 * by Stripe, but that is not the failure this arm is for: a top-up key MOVED
 * onto a recurring price would be a customer signing up to buy 5,000 credits
 * every month from a button that says *Add credits*. The refusal names the key
 * and nothing reaches the wire.
 *
 * ⚠ **AND THE AMOUNT IS PER UNIT, NOT PER ORDER.** `unit_amount` is compared
 * against the band's `centsPerUnit`, because the order's price is that amount
 * times the `quantity` the session sends. Comparing it against the whole order
 * would pass only for one-unit orders and refuse every other one.
 */
export async function resolveTopupPriceId(
  client: Pick<Stripe, "prices">,
  units: number,
): Promise<string> {
  /* Refuses on a count this product does not sell before any network call —
     the bound is `TOPUP_MAX_UNITS` and it is argued where it is declared. */
  const bracket = topupBracketFor(units);
  const lookupKey = topupPriceLookupKey(bracket);

  const page = await client.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 2,
  });

  /* Asked by key and filtered by key, for `resolvePriceId`'s reason: a price
     whose own `lookup_key` is null is not the answer to a question about one. */
  const matches = page.data.filter((price) => price.lookup_key === lookupKey);

  if (matches.length === 0) {
    throw new StripePriceUnavailableError(
      lookupKey,
      "names no active price in Stripe's catalogue",
    );
  }
  if (matches.length > 1) {
    throw new StripePriceUnavailableError(
      lookupKey,
      `is claimed by ${matches.length} active prices (${matches.map((p) => p.id).join(", ")})`,
    );
  }

  const price = matches[0];
  if (price.recurring) {
    throw new StripePriceUnavailableError(
      lookupKey,
      /* ⚠ The sentence deliberately does NOT say the word "credit": the
         credit-display guard's rule 2 indicts a credit-named value inside a
         sentence that says credits, and `price.recurring.interval` is a WORD
         ("month") in a refusal that reaches a log rather than a customer. A
         false indictment is how a guard gets deleted instead of fixed, so the
         sentence is written out of its reach — it loses nothing, because a pack
         is what this key sells. */
      `names price ${price.id}, which recurs per ${price.recurring.interval} — a pack is bought once, not subscribed to`,
    );
  }
  if (price.unit_amount !== bracket.centsPerUnit) {
    throw new StripePriceUnavailableError(
      lookupKey,
      `names price ${price.id} at ${price.unit_amount} cents a unit, which is not the ${bracket.centsPerUnit} cents this product shows for ${units} unit(s)`,
    );
  }

  return price.id;
}
