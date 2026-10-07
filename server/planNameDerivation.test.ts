import { describe, expect, it } from "vitest";
import { PLAN_TIERS, type PlanTier } from "../drizzle/schema";
import {
  OFFERED_PLAN_ORDER,
  OFFERED_PLAN_TIERS,
  PURCHASABLE_PLANS,
  SUBSCRIPTION_PRODUCTS,
  ownPlanFacts,
} from "./stripe/stripeProducts";

/**
 * ⚠ **CARD #1900 — THE STUDIO RUNG IS CALLED PRO PLUS, AND THIS SUITE IS WHY
 * THAT WAS ONE WORD OF PRODUCT CODE.**
 *
 * His order, 2026-10-07, verbatim: *"rename the Studio plan to Pro Plus,
 * everywhere a customer sees it (the plan cards, the slider, the compare
 * table, checkout, invoices and emails, and the product name in Stripe). Keep
 * the same price, credits and features. Only the name changes."*
 *
 * The card asked for the real count before anybody branched, and the answer
 * was **ONE**: `PLAN_TIERS[tier].name` in `drizzle/schema.ts`. That answer was
 * produced by reading the tree, and **a grep is not a guard** — it is true of
 * the tree the day it ran and says nothing about tomorrow's. So the claim the
 * whole card rests on is pinned here instead:
 *
 *   1. the rung's figures are UNCHANGED, which is his *"only the name
 *      changes"* made provable rather than asserted;
 *   2. every name a customer can be served is **derived** from that one
 *      field — through `SUBSCRIPTION_PRODUCTS` (the `getPlans` wire) and
 *      through `ownPlanFacts` (the account's own rung) — so the next rename
 *      is one word too;
 *   3. and the reader that proves (2) is shown able to FAIL, because an
 *      equality arm over two expressions that both read the same constant is
 *      the shape that passes while proving nothing (working law 2).
 *
 * ⚠ **WHAT THIS SUITE DELIBERATELY DOES NOT COVER, named rather than left to
 * be discovered.** `planTier` is an enum that still accepts four folded legacy
 * values, `studio_plus` among them (`drizzle/schema.ts`). `ownPlanFacts`
 * captions an unknown rung from its id, so such a row would read *"Studio
 * plus"* — a name the product no longer states. **Zero rows hold any of the
 * four**, narrowing the column is a destructive migration and therefore his
 * hand, and inventing a caption for a retired rung would be claiming a plan.
 * So the derivation arms below run over the OFFERED ladder — the rungs a
 * customer can actually be served — and the legacy values stay as they are.
 *
 * ⚠ **AND THE WORD IS NOT BANNED, ON PURPOSE.** `Casting Studio` is a
 * feature, `Klieg Studio` is the product's name in the app header
 * (`foundation/brand.ts`), `studio` is this rung's id and the stem of the
 * `klieg_studio_*_v2` lookup keys he expressly allowed to stay. An arm
 * refusing the string `Studio` anywhere would redden on all four and teach a
 * later shift to delete the wrong one. What is asserted is narrower and is the
 * thing he actually asked for: **no OFFERED PLAN is NAMED Studio.**
 */

const PLAN_NAME_TYPED_IN = "drizzle/schema.ts";

describe(`#1900 — the plan's name is typed once, in ${PLAN_NAME_TYPED_IN}, and every surface derives it`, () => {
  it("the renamed rung keeps its id, its price, its allowance and its rollover — his 'only the name changes'", () => {
    expect(
      PLAN_TIERS.studio.name,
      "the rung he renamed is not called Pro Plus — #1900 is his order and this field is the only place it is said",
    ).toBe("Pro Plus");

    /*
      The three figures he said must not move, read back off the table rather
      than off a test's own copy of them. The id is asserted by the property
      access itself: `PLAN_TIERS.studio` would not compile if the key had been
      renamed with the name, which is the mistake this card most invited.
    */
    expect(
      {
        price: PLAN_TIERS.studio.price,
        monthlyCredits: PLAN_TIERS.studio.monthlyCredits,
        rolloverPercent: PLAN_TIERS.studio.rolloverPercent,
      },
      "the rename moved a price, an allowance or a rollover — it was supposed to move a word",
    ).toEqual({ price: 15900, monthlyCredits: 430000, rolloverPercent: 100 });
  });

  it("no offered plan is NAMED Studio — his 'Studio nowhere', asked of the names a customer can be served", () => {
    const stillNamedStudio = OFFERED_PLAN_ORDER.filter(
      (tier) => ownPlanFacts(tier).planName === "Studio",
    );

    expect(
      stillNamedStudio,
      "an offered rung is still called Studio — the rename did not reach the field every surface reads",
    ).toEqual([]);

    /*
      The positive control for the arm above, and it is the one that matters:
      an empty filter is also what a reader looking at the wrong field returns.
      So the same reader is pointed at the name the rung USED to carry and must
      find it.
    */
    const namedProPlus = OFFERED_PLAN_ORDER.filter(
      (tier) => ownPlanFacts(tier).planName === "Pro Plus",
    );
    expect(
      namedProPlus,
      "the reader cannot find Pro Plus either, so its empty answer above proved nothing",
    ).toEqual(["studio"]);
  });

  /**
   * The derivation reader, written once and run over three roads and two
   * fabricated tables. It compares what a surface would be SERVED against the
   * single field that is typed.
   *
   * ⚠ **THE POPULATION IS AN ARGUMENT, NOT A CONSTANT INSIDE IT**, because the
   * three roads do not serve the same rungs: `SUBSCRIPTION_PRODUCTS` holds the
   * PURCHASABLE ladder (no `free` — there is no Stripe product to buy), while
   * `ownPlanFacts` and the wire's `tiers` payload answer for every OFFERED
   * rung including `free`. Walking one road's population down another read
   * `undefined.name` and threw, which is the reader being broken rather than
   * the product — and a reader that throws is at least loud; one that had
   * silently skipped the gap would have passed.
   */
  const namesNotDerivedFrom = (
    population: readonly PlanTier[],
    table: Record<string, { name: string }>,
    served: (tier: PlanTier) => string,
  ): string[] => population.filter((tier) => served(tier) !== table[tier]?.name);

  it("the getPlans wire serves the typed name and never a second copy of it", () => {
    expect(
      namesNotDerivedFrom(PURCHASABLE_PLANS, PLAN_TIERS, (tier) => SUBSCRIPTION_PRODUCTS[tier].name),
      `a rung's product name disagrees with ${PLAN_NAME_TYPED_IN} — somebody typed a plan name twice`,
    ).toEqual([]);

    /*
      ⚠ Every purchasable rung is reached, not just the renamed one: a reader
      that happened to walk an empty list would pass the arm above in silence.
    */
    expect(
      PURCHASABLE_PLANS.length,
      "no purchasable rungs were walked — the reader is broken, not the product",
    ).toBeGreaterThan(0);
    expect(PURCHASABLE_PLANS).toContain("studio");
  });

  it("the account's own rung is captioned from the same field — ownPlanFacts invents nothing", () => {
    expect(
      namesNotDerivedFrom(OFFERED_PLAN_ORDER, PLAN_TIERS, (tier) => ownPlanFacts(tier).planName),
      `an account would be captioned a name ${PLAN_NAME_TYPED_IN} does not state`,
    ).toEqual([]);

    /*
      And the wire's `tiers` payload — the client reads `tiers[id].name` for the
      Enterprise band's caption, so it is a third road to the same field.
    */
    expect(
      namesNotDerivedFrom(
        OFFERED_PLAN_ORDER,
        PLAN_TIERS,
        (tier) => (OFFERED_PLAN_TIERS as Record<string, { name: string }>)[tier].name,
      ),
      "the served tier table carries a name of its own",
    ).toEqual([]);
  });

  it("⚠ THE DERIVATION READER IS SHOWN ABLE TO FAIL — otherwise the three green arms above are self-agreement", () => {
    /*
      Working law 2. The arms above compare two expressions that both trace
      back to `PLAN_TIERS`, which is exactly the shape that passes no matter
      what. So the same reader is run against a table whose name has been
      moved, and it must name the rung.
    */
    /*
      ⚠ **THE FABRICATED NAME IS A SENTINEL, NOT THE OLD ONE.** The first draft
      of this arm used `"Studio"`, and reverting the rename then reddened THREE
      arms instead of one — because a fabrication that happens to match reality
      has stopped being a fabrication. A sentinel keeps the arms independent, so
      a sabotage names its own cause ("bench arms must be independent"). The
      cost of a sentinel is that it could silently become a no-op if it ever
      equalled a real name, so that is asserted rather than assumed.
    */
    const SENTINEL = "a name no plan has";
    expect(
      Object.values(PLAN_TIERS).map((tier) => tier.name),
      "the sentinel is a real plan name, so the controls below fabricate nothing",
    ).not.toContain(SENTINEL);

    const renamedAwayFromTheWire = {
      ...PLAN_TIERS,
      studio: { ...PLAN_TIERS.studio, name: SENTINEL },
    } as unknown as Record<string, { name: string }>;

    expect(
      namesNotDerivedFrom(
        PURCHASABLE_PLANS,
        renamedAwayFromTheWire,
        (tier) => SUBSCRIPTION_PRODUCTS[tier].name,
      ),
      "the reader cannot see a product name that disagrees with the table — it proves nothing about the wire",
    ).toEqual(["studio"]);

    expect(
      namesNotDerivedFrom(
        OFFERED_PLAN_ORDER,
        renamedAwayFromTheWire,
        (tier) => ownPlanFacts(tier).planName,
      ),
      "the reader cannot see a caption that disagrees with the table",
    ).toEqual(["studio"]);

    /* And the other direction: a surface that types its own name is caught. */
    expect(
      namesNotDerivedFrom(OFFERED_PLAN_ORDER, PLAN_TIERS, (tier) =>
        tier === "studio" ? SENTINEL : PLAN_TIERS[tier].name,
      ),
      "a surface typing its own plan name reads as derived — the reader is pointed at the wrong thing",
    ).toEqual(["studio"]);
  });

  it("an unknown rung is captioned from its id and claims no plan — the fallback is not a road to a real name", () => {
    /*
      The four folded legacy values named in the docblock. The fallback must
      caption them as words and claim nothing, and in particular it must not
      reach into the table and hand back a live rung's name or figures.
    */
    const legacy = ownPlanFacts("studio_plus");
    expect(legacy.planName).toBe("Studio plus");
    expect(
      { price: legacy.planPriceInCents, credits: legacy.planMonthlyCredits },
      "a retired rung was handed a live rung's price or allowance",
    ).toEqual({ price: 0, credits: 0 });

    expect(
      legacy.planName,
      "the fallback handed back the renamed rung's name, so a retired value would impersonate a live plan",
    ).not.toBe(PLAN_TIERS.studio.name);
  });
});
