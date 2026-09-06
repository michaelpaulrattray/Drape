import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PLAN_TIERS, PlanTier } from "../drizzle/schema";
import {
  HIDDEN_PLAN_TIERS,
  OFFERED_PLAN_ORDER,
  OFFERED_PLAN_TIERS,
  PAID_PLAN_ORDER,
  PLAN_ORDER,
  PURCHASABLE_PLANS,
  SUBSCRIPTION_PRODUCTS,
  ownPlanFacts,
} from "./stripe/stripeProducts";
import { mapPlanToTier } from "./stripe/stripeService";
import { billingRouter } from "./routes/billing";

/**
 * CARD #391 — THE LADDER FOLD, held where each half of his ruling can fail.
 *
 * The ruling (Crew reply #132, 2026-09-05, approving the card's
 * recommendation): drop the four Plus rungs, HIDE Ultimate and offer it by
 * email on request, and leave the seven survivors' prices and credit amounts
 * exactly where they are. Two halves matter to a customer and each has arms
 * here:
 *
 * 1. **HIDDEN MEANS NOT OFFERED, ANYWHERE ON THE WIRE.** `billing.getPlans`
 *    is public, and Ultimate's $48,000 price is deliberately unpublished — so
 *    the whole payload is swept for it, not just the field somebody thought
 *    of. And a rung the UI does not offer must not be a rung the API accepts
 *    (invariant 5): the three checkout-path input parsers are driven with the
 *    hidden rung and must refuse it, alongside a POSITIVE control proving the
 *    parser still admits the offered top — an arm that only rejects would
 *    also pass by rejecting customers.
 *
 * 2. **THE DOOR EXISTS.** His words: "just an email link for now, keep it
 *    simple." Hiding the top of the ladder without the email line removes the
 *    answer to "we need more than Scale" and puts nothing in its place, so
 *    the line is part of the fold, not a follow-up. The arm reads the modal's
 *    CODE (comments stripped — a rule written in prose is not a rule shipped)
 *    for the mailto on the one address the product already puts in front of
 *    customers.
 *
 * The derivation arms exist because the rung set used to be stated in five
 * places and three of them were hand-typed copies (working law 4). Now every
 * list is derived from `PLAN_TIERS`; these arms pin the derivations so a
 * future rung lands everywhere by being declared once.
 */

const HIDDEN = HIDDEN_PLAN_TIERS as readonly string[];

const HERE = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

/** Source with comments stripped — a rule written in prose is not a rule shipped. */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** The real input parser of a procedure — the same object the wire runs. */
function parserOf(name: string): { parse: (input: unknown) => unknown } {
  const procedure = (billingRouter as unknown as Record<string, any>)._def.procedures[name];
  if (!procedure) throw new Error(`no procedure named ${name} on billingRouter`);
  const inputs: Array<{ parse?: (input: unknown) => unknown }> = procedure._def.inputs ?? [];
  const schema = inputs[0];
  if (!schema || typeof schema.parse !== "function") {
    throw new Error(`procedure ${name} has no parseable input schema`);
  }
  return schema as { parse: (input: unknown) => unknown };
}

describe("card #391 — every rung list is derived from PLAN_TIERS", () => {
  it("PLAN_ORDER is the table's own key order, nothing retyped", () => {
    expect(PLAN_ORDER).toEqual(Object.keys(PLAN_TIERS));
  });

  it("the four orders nest exactly: paid ⊂ all, offered = all − hidden, purchasable = paid − hidden", () => {
    expect(PAID_PLAN_ORDER).toEqual(PLAN_ORDER.filter((tier) => tier !== "free"));
    expect(OFFERED_PLAN_ORDER).toEqual(PLAN_ORDER.filter((tier) => !HIDDEN.includes(tier)));
    expect([...PURCHASABLE_PLANS]).toEqual(
      PAID_PLAN_ORDER.filter((tier) => !HIDDEN.includes(tier)),
    );
  });

  it("SUBSCRIPTION_PRODUCTS declares exactly the paid rungs — drift in either direction reddens", () => {
    expect(Object.keys(SUBSCRIPTION_PRODUCTS)).toEqual(PAID_PLAN_ORDER);
  });

  it("his ruling's shape: seven offered rungs ending at Enterprise, Ultimate the one hidden rung", () => {
    expect(OFFERED_PLAN_ORDER).toEqual([
      "free",
      "starter",
      "pro",
      "studio",
      "business",
      "scale",
      "enterprise",
    ]);
    expect(HIDDEN_PLAN_TIERS).toEqual(["ultimate"]);
    /* The hidden rung still EXISTS — an account on it keeps working. */
    expect(PLAN_TIERS.ultimate).toBeDefined();
    expect(SUBSCRIPTION_PRODUCTS.ultimate).toBeDefined();
  });
});

describe("card #391 — the hidden rung is structurally unbuyable (invariant 5, at the wire)", () => {
  const CHECKOUT_ARMS: Array<{ name: string; valid: (plan: string) => Record<string, unknown> }> = [
    { name: "createSubscriptionCheckout", valid: (plan) => ({ plan }) },
    { name: "changePlan", valid: (plan) => ({ newPlan: plan }) },
    { name: "previewPlanChange", valid: (plan) => ({ newPlan: plan }) },
  ];

  for (const arm of CHECKOUT_ARMS) {
    it(`${arm.name} refuses the hidden rung and every folded rung`, () => {
      const parser = parserOf(arm.name);
      for (const gone of ["ultimate", "studio_plus", "business_plus", "scale_plus", "enterprise_plus"]) {
        expect(() => parser.parse(arm.valid(gone)), `${arm.name} accepted "${gone}"`).toThrow();
      }
    });

    it(`${arm.name} still admits the offered ladder — the positive control`, () => {
      const parser = parserOf(arm.name);
      for (const plan of PURCHASABLE_PLANS) {
        expect(() => parser.parse(arm.valid(plan)), `${arm.name} refused "${plan}"`).not.toThrow();
      }
    });
  }
});

describe("card #391 — getPlans serves the offered ladder and never the hidden price", () => {
  const caller = billingRouter.createCaller({} as never);

  it("planOrder is the offered seven and tiers carries no hidden key", async () => {
    const plans = await caller.getPlans();
    expect(plans.planOrder).toEqual(OFFERED_PLAN_ORDER);
    expect(Object.keys(plans.tiers)).toEqual(OFFERED_PLAN_ORDER);
    expect(plans.subscriptions.map((plan) => plan.id)).toEqual([...PURCHASABLE_PLANS]);
  });

  it("the WHOLE payload is swept: no hidden rung id, name or price — with a positive control", async () => {
    const plans = await caller.getPlans();
    const wire = JSON.stringify(plans);
    /* Positive control first: an empty payload must not pass the absence arms. */
    expect(wire).toContain("enterprise");
    expect(wire).toContain(String(PLAN_TIERS.enterprise.price));
    for (const tier of HIDDEN) {
      expect(wire, `hidden rung id "${tier}" crossed the public wire`).not.toContain(`"${tier}"`);
    }
    expect(wire, "the hidden rung's display name crossed the public wire").not.toContain("Ultimate");
    expect(wire, "the hidden rung's price crossed the public wire").not.toContain(
      String(PLAN_TIERS.ultimate.price),
    );
    /* And the OFFERED_PLAN_TIERS projection itself, not only this payload. */
    expect(Object.keys(OFFERED_PLAN_TIERS)).not.toContain("ultimate");
  });
});

describe("card #391 — an account ON the hidden rung still knows its own plan (PR #583 finding 1)", () => {
  it("ownPlanFacts names every declared tier, the hidden one included", () => {
    expect(ownPlanFacts("enterprise")).toEqual({
      planName: "Enterprise",
      planPriceInCents: PLAN_TIERS.enterprise.price,
      planMonthlyCredits: PLAN_TIERS.enterprise.monthlyCredits,
    });
    /* The hidden rung is hidden from the OFFER, never from its own owner. */
    expect(ownPlanFacts("ultimate").planName).toBe("Ultimate");
    expect(ownPlanFacts("ultimate").planMonthlyCredits).toBe(PLAN_TIERS.ultimate.monthlyCredits);
  });

  it("a folded legacy value is captioned as words, never as the pipeline slug, and claims nothing", () => {
    const facts = ownPlanFacts("studio_plus");
    expect(facts.planName).not.toContain("_");
    expect(facts.planName.toLowerCase()).toContain("studio");
    expect(facts.planPriceInCents).toBe(0);
    expect(facts.planMonthlyCredits).toBe(0);
  });

  it("getStatus actually serves it — the fix must be invoked, not merely exported (invariant 7)", () => {
    const billing = readFileSync(join(HERE, "routes", "billing.ts"), "utf8");
    expect(code(billing)).toContain("ownPlanFacts(");
  });

  it("Settings actually reads it — the caption prefers the own-row fields over the catalogue", () => {
    const surfaces = readFileSync(
      join(HERE, "..", "client", "src", "features", "settings", "AccountSurfaces.tsx"),
      "utf8",
    );
    const src = code(surfaces);
    expect(src).toContain("status?.planName");
    expect(src).toContain("status?.planMonthlyCredits");
    expect(src).toContain("status?.planPriceInCents");
  });
});

describe("card #391 — the back door matches the front (PR #583 finding 2)", () => {
  it("mapPlanToTier answers null for a plan the product no longer declares", () => {
    expect(mapPlanToTier("studio_plus" as never)).toBeNull();
    expect(mapPlanToTier("nonesuch" as never)).toBeNull();
    /* Positive control: declared plans still map to themselves. */
    expect(mapPlanToTier("starter")).toBe("starter");
    expect(mapPlanToTier("ultimate")).toBe("ultimate");
  });
});

describe("card #391 — the email door ships with the fold", () => {
  const MODAL = join(HERE, "..", "client", "src", "features", "billing", "ChangePlanModal.tsx");
  const CSS = join(HERE, "..", "client", "src", "features", "settings", "settings.css");

  it("the plan modal's CODE carries the mailto, on the address the product already uses", () => {
    const modal = code(readFileSync(MODAL, "utf8"));
    expect(modal).toContain("mailto:support@klieglabs.com");
    expect(modal).toContain("dp-plan__request");
    /* His ruling forbids publishing the hidden price at the door. */
    expect(modal).not.toContain("48,000");
    expect(modal).not.toContain("$48");
  });

  it("the line is styled as a sentence, never a card", () => {
    const css = readFileSync(CSS, "utf8");
    expect(css).toContain(".dp-plan__request");
  });
});
