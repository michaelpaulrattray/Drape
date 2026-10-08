import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { billingRouter } from "../routes/billing";
import { PURCHASABLE_PLANS, SUBSCRIPTION_PRODUCTS } from "./stripeProducts";

/**
 * CARD #1953 — THE PLAN FEATURES NOBODY DELIVERS ARE OFF THE WIRE.
 *
 * **His word, 2026-10-08 (terminal): *"yes"***, approving the relay's
 * recommendation on the Notion Founder Desk pricing-wording item: the feature
 * lines **"Standard support"**, **"Priority support"** and **"Early access to
 * new features"** describe things this product does not have — there are no
 * support tiers and no early-access programme — so they stop being served.
 * The **"N% unused credit rollover"** lines are TRUE (`webhooks.ts` performs
 * the rollover, and every rung's `rolloverPercent` was read at
 * `drizzle/schema.ts` the day this landed — 50 / 75 / 100 / 100 / 100 / 100 /
 * 100) and stay, which is why the arms below assert their SURVIVAL rather than
 * only an absence.
 *
 * ⚠ **THE ARMS ARE AT THE WIRE, NOT AT THE CONSTANT (working law 5).** The
 * promise a customer can be shown is the one `billing.getPlans` SERVES, and
 * that projection is hand-written (`server/routes/billing.ts`, invariant 8) —
 * so a line deleted from `SUBSCRIPTION_PRODUCTS` and re-added by a second
 * source inside the projection would satisfy a constant-only arm and still
 * reach the public endpoint. `createCaller` runs the real procedure.
 *
 * ⚠ **AND THE MEASURED STATE WHEN THIS LANDED, recorded because it changes
 * what the card MEANS rather than whether it is right: `features` has exactly
 * ONE non-test consumer — the projection at `server/routes/billing.ts` — and
 * NOTHING on the client renders it.** Read 2026-10-08 across `client/src`: the
 * two surfaces that call `getPlans` (`AddCreditsModal`, `ChangePlanModal`) take
 * `name`, `priceInCents`, `credits`, `tiers`, `planOrder` and `selfServeOrder`
 * and never touch `features` — the Phase 2 compare table (#1834) replaced the
 * old feature list. So no screen was showing these three lines; the endpoint is
 * PUBLIC, so they were on the wire for anyone who asked, which is what this
 * closes. **That `features` is now a field nobody reads is #1605's exact
 * finding one field over, and it is FILED rather than fixed here** — removing a
 * field from a public money projection is its own decision and this card did
 * not ask for one.
 *
 * ⚠ **FOUR SIBLING STRINGS WERE SWEPT UP AND DELIBERATELY LEFT (law 7).** The
 * same arrays carry *"Dedicated account manager"*, *"Custom integrations"*,
 * *"SLA guarantee"* and *"White-glove onboarding"*, undelivered in the same
 * sense. They sit ONLY on `business`/`scale`/`enterprise` — the Enterprise
 * band, which #1833 made *a sales conversation* — and on the hidden `ultimate`
 * rung. **A thing a salesperson can agree to in a conversation is not the same
 * as a self-serve plan card promising it**, so whether that band may offer them
 * is his call and not a sweep's. Filed; not widened here.
 */

const HERE = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

/**
 * THE THREE LINES HIS RULING NAMED, kept verbatim as the exact-string arm.
 *
 * Nine occurrences across the seven rungs when this was written: "Standard
 * support" once (starter), "Priority support" six times (every paid rung above
 * starter, the hidden one included), "Early access to new features" twice (pro,
 * studio).
 */
const REMOVED_LINES = [
  "Standard support",
  "Priority support",
  "Early access to new features",
] as const;

/**
 * IS THIS FEATURE LINE A SUPPORT TIER OR AN EARLY-ACCESS PROMISE?
 *
 * ⚠ **IT MATCHES THE SHAPE, NOT THE THREE STRINGS, so a fourth spelling
 * cannot walk in** — "Premium support" and "Email support" are the same promise
 * and read the same way to a customer.
 *
 * ⚠ **AND IT IS ANCHORED AT THE END OF THE LINE ON PURPOSE.** A bare
 * `/support/i` would refuse correct copy the day a true line says *"Supports 4K
 * export"* — and `checkoutProductText.test.ts`'s own percentage arm is the
 * worked example of that mistake being made and then narrowed, with its own
 * comment saying *"an arm that refuses correct copy gets deleted rather than
 * fixed"*. A support TIER is a noun phrase that ENDS in the word; a sentence
 * about what the product supports does not.
 */
function promisesUndelivered(line: string): boolean {
  const text = line.trim();
  return /\bsupport$/i.test(text) || /\bearly access\b/i.test(text);
}

describe("card #1953 — the predicate can fail (the negative control comes first)", () => {
  it("flags all three lines it was written for", () => {
    for (const line of REMOVED_LINES) {
      expect(promisesUndelivered(line), `the predicate missed "${line}"`).toBe(true);
    }
    /* Two spellings the card never named, proving it reads the shape. */
    expect(promisesUndelivered("Premium support")).toBe(true);
    expect(promisesUndelivered("Early access to the cinema studio")).toBe(true);
  });

  it("does NOT flag the lines that stay — an arm that refuses correct copy is worthless", () => {
    for (const line of [
      "100% unused credit rollover",
      "50% unused credit rollover",
      "All generation features",
      "Dedicated account manager",
      "Custom integrations",
      "SLA guarantee",
      "White-glove onboarding",
      "Supports 4K export",
    ]) {
      expect(promisesUndelivered(line), `the predicate wrongly flagged "${line}"`).toBe(false);
    }
  });
});

describe("card #1953 — billing.getPlans serves no support or early-access line", () => {
  const caller = billingRouter.createCaller({} as never);

  it("the population is the whole purchasable ladder, so an empty read cannot pass as a clean one", async () => {
    const plans = await caller.getPlans();
    expect(plans.subscriptions.map((plan) => plan.id)).toEqual([...PURCHASABLE_PLANS]);
    /* A floor beneath the derivation: six rungs were served the day this landed. */
    expect(plans.subscriptions.length).toBeGreaterThanOrEqual(6);
    /*
      And every rung still carries feature lines AT ALL — the positive control
      for every absence arm below. A projection that served `features: []`
      would otherwise satisfy all of them.
    */
    for (const plan of plans.subscriptions) {
      expect(plan.features.length, `${plan.id} serves no feature lines at all`).toBeGreaterThan(0);
    }
  });

  it("no served feature line is a support tier or an early-access promise", async () => {
    const plans = await caller.getPlans();
    const offending = plans.subscriptions.flatMap((plan) =>
      plan.features.filter(promisesUndelivered).map((line) => `${plan.id}: ${line}`),
    );
    expect(offending).toEqual([]);
  });

  it("the three lines are gone from the WHOLE payload, not only the field we thought of", async () => {
    const wire = JSON.stringify(await caller.getPlans());
    /* Positive control first: the payload really was read. */
    expect(wire).toContain("unused credit rollover");
    for (const line of REMOVED_LINES) {
      expect(wire, `the wire still carries "${line}"`).not.toContain(line);
    }
  });

  it("the rollover line SURVIVES on every purchasable rung — his ruling kept it", async () => {
    const plans = await caller.getPlans();
    for (const plan of plans.subscriptions) {
      expect(
        plan.features.some((line) => /unused credit rollover$/i.test(line.trim())),
        `${plan.id} lost its rollover line`,
      ).toBe(true);
    }
  });
});

describe("card #1953 — the table itself is clean, hidden rung included", () => {
  it("no rung in SUBSCRIPTION_PRODUCTS carries one of the three lines", () => {
    /*
      The wire arms above cannot see `ultimate`: it is hidden, so `getPlans`
      never maps it. The line came off it in the same edit, and this is the only
      arm that can say so.
    */
    const offending = Object.entries(SUBSCRIPTION_PRODUCTS).flatMap(([rung, product]) =>
      product.features
        .filter((line) => (REMOVED_LINES as readonly string[]).includes(line.trim()))
        .map((line) => `${rung}: ${line}`),
    );
    expect(offending).toEqual([]);
    /* Positive control: the table was actually read, hidden rung included. */
    expect(Object.keys(SUBSCRIPTION_PRODUCTS).length).toBeGreaterThanOrEqual(7);
    expect(SUBSCRIPTION_PRODUCTS.ultimate.features.length).toBeGreaterThan(0);
  });
});

describe("card #1953 — the Follow cost note reads the measured figure", () => {
  /**
   * His finance guy's refresh (Squall's line, on the card): a Follow measures
   * about $0.19–0.26 — 8 × $0.0232, measured 2026-09-30, plus the interpreter —
   * not the $0.32–0.52 the comment carried from the old engine. So *"roughly a
   * third"* overstated the gap by about a factor of two.
   *
   * ⚠ **Nothing a customer meets changes, and the comment now says so**: the
   * 320 display price was set by his *"one price is better and we earn more for
   * rolls simple"* (#1753) and never by the ratio. A reader who finds a
   * corrected cost figure beside a price constant must not have to guess
   * whether the price moved with it.
   */
  const source = readFileSync(join(HERE, "..", "casting", "castingCreditCosts.ts"), "utf8");

  it("the stale reading is gone as a LIVE claim and the measured one is there", () => {
    /* Positive control: the right file was read, and the right block in it. */
    expect(source).toContain("THE TWO PRICES AGREE AND THEY ARE STILL TWO PRICES");

    /*
      ⚠ **ANCHORED ON THE LIVE SENTENCE, NOT ON THE PHRASE — and the first
      draft of this arm was anchored on the phrase and FAILED, correctly.**
      The dated correction note below the constant QUOTES the old wording
      (*"It read … roughly a third of what a follow does …"*), which is this
      repository's house style for a superseded figure and is the thing that
      stops the next reader rediscovering it. A bare `not.toContain("roughly a
      third of what a follow does")` therefore cannot tell a live claim from
      its own obituary, and would force the provenance to be deleted to go
      green. The live claim read *"A roll costs the house roughly a third of
      what a follow does"*; the quotation does not carry "the house".
    */
    expect(source).not.toContain("the house roughly a third of what a follow does");
    expect(source).not.toContain("$0.32-0.52, the reading he decided on");

    expect(source).toContain("$0.19–0.26");
    expect(source).toContain("8 × $0.0232 measured 2026-09-30");
    /* The one thing a reader of a repriced constant must not have to guess. */
    expect(source).toContain("His 320 display price is untouched by this");
  });

  it("the correction keeps its provenance — the superseded figure is still quoted, dated", () => {
    /*
      The other half of the arm above, and the reason it is anchored the way it
      is: a later shift tidying the docblock could satisfy every absence
      assertion by deleting the correction note wholesale, and the figure's
      history would go with it. #1699's reading was not wrong when it was
      taken — it was true of the engine that road ran then — so the record is
      worth as much as the number.
    */
    expect(source).toContain("roughly a third of what a follow does");
    expect(source).toContain("2026-10-08");
    expect(source).toContain("#1953");
  });
});
