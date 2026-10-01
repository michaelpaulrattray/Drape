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
