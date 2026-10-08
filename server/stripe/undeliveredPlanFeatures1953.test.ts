import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PLAN_TIERS } from "../../drizzle/schema";
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
 * ✅ **AND IT IS FIXED NOW — CARD #1972 HALF 1, on the relay's ruling: the
 * field leaves the public projection on #1605's ground.** Re-read at the code
 * the day it landed: no client file has read `features` off `getPlans` since
 * the Section 03 rebuild (#370, 2026-09-01), and `pnpm check` compiles the
 * whole client with the field gone — so no deployed bundle reads it and the
 * removal is skew-safe. **That moves this file's centre of gravity**: the wire
 * arms no longer look for bad lines among the served ones, they assert that NO
 * line is served (the exact key set, and every table line absent from the whole
 * payload), and the rulings on WHICH lines the table may hold — #1953's
 * removals, #1973's kept three, the rollover survival — are held at the table,
 * hidden rung included. The lines stay in `SUBSCRIPTION_PRODUCTS`: removing
 * them is a further decision nobody asked for.
 *
 * ⚠ **FOUR SIBLING STRINGS WERE SWEPT UP AND DELIBERATELY LEFT (law 7).** The
 * same arrays carry *"Dedicated account manager"*, *"Custom integrations"*,
 * *"SLA guarantee"* and *"White-glove onboarding"*, undelivered in the same
 * sense. They sit ONLY on `business`/`scale`/`enterprise` — the Enterprise
 * band, which #1833 made *a sales conversation* — and on the hidden `ultimate`
 * rung. **A thing a salesperson can agree to in a conversation is not the same
 * as a self-serve plan card promising it**, so whether that band may offer them
 * is his call and not a sweep's. Filed; not widened here.
 *
 * ✅ **AND HE CALLED IT — CARD #1973, 2026-10-08 (terminal), verbatim: *"go
 * with B"*.** Keep *"Dedicated account manager"*, *"Custom integrations"* and
 * *"White-glove onboarding"* — things he can agree to and deliver himself in an
 * Enterprise deal — and REMOVE *"SLA guarantee"*, a formal uptime commitment we
 * have no way to measure or back. So the predicate below now refuses an SLA,
 * uptime or guarantee line too, and the three kept lines sit in its does-NOT-
 * flag control AND in arms asserting they are still on their rungs — a
 * ruling that kept three lines is as much a contract as the one that removed
 * one. Swept (law 7) the same day: `stripeProducts.ts` was the only live place
 * the product stated an SLA or uptime promise; the compare table
 * (`ChangePlanModal.tsx`) and `PRICING_PHASE2_PLANS_DESIGN.md` already say the
 * copy claims NO SLA, and the crew briefing's mentions are the card's history.
 *
 * ✅ **CARD #1972 HALF 2 RIDES WITH IT — the same lines.** Five rungs typed
 * `"100% unused credit rollover"` while `starter` and `pro` derived the figure
 * from `PLAN_TIERS`; all were right, and all now derive, so the day he changes
 * a rollover percent it is one edit. The last-but-one describe block pins it in
 * the table and at the source.
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
  /* #1973, "go with B": it sat on `enterprise` and the hidden `ultimate`. */
  "SLA guarantee",
] as const;

/**
 * THE THREE LINES #1973 KEPT, on the rungs each sat on the day he ruled.
 * `ultimate` is hidden, so only the table arm can see its row.
 */
const KEPT_ENTERPRISE_LINES: Record<string, readonly string[]> = {
  business: ["Dedicated account manager"],
  scale: ["Dedicated account manager", "Custom integrations"],
  enterprise: ["Dedicated account manager", "Custom integrations"],
  ultimate: ["Dedicated account manager", "Custom integrations", "White-glove onboarding"],
};

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
  return (
    /\bsupport$/i.test(text) ||
    /\bearly access\b/i.test(text) ||
    /*
      #1973: an SLA, an uptime figure or a guarantee is a written commitment
      we have no instrument to measure or back. Whole words, so "Guaranteed"
      and "SLAs" are caught and "Slack" is not.
    */
    /\bSLAs?\b/i.test(text) ||
    /\bservice[- ]level\b/i.test(text) ||
    /\buptime\b/i.test(text) ||
    /\bguarantee(?:s|d)?\b/i.test(text)
  );
}

describe("card #1953 — the predicate can fail (the negative control comes first)", () => {
  it("flags every line it was written for (#1953's three, #1973's one)", () => {
    for (const line of REMOVED_LINES) {
      expect(promisesUndelivered(line), `the predicate missed "${line}"`).toBe(true);
    }
    /* Two spellings the card never named, proving it reads the shape. */
    expect(promisesUndelivered("Premium support")).toBe(true);
    expect(promisesUndelivered("Early access to the cinema studio")).toBe(true);
    /* #1973's shape, in spellings the card never named. */
    expect(promisesUndelivered("99.9% uptime")).toBe(true);
    expect(promisesUndelivered("Guaranteed response times")).toBe(true);
    expect(promisesUndelivered("Enterprise SLA")).toBe(true);
    expect(promisesUndelivered("Service-level agreement")).toBe(true);
  });

  it("does NOT flag the lines that stay — an arm that refuses correct copy is worthless", () => {
    for (const line of [
      "100% unused credit rollover",
      "50% unused credit rollover",
      "All generation features",
      "Dedicated account manager",
      "Custom integrations",
      "White-glove onboarding",
      "Supports 4K export",
      "Slack-style shortcuts",
    ]) {
      expect(promisesUndelivered(line), `the predicate wrongly flagged "${line}"`).toBe(false);
    }
  });
});

describe("card #1972 half 1 — billing.getPlans serves no feature lines at all", () => {
  const caller = billingRouter.createCaller({} as never);

  /**
   * THE FIELDS THE PUBLIC PROJECTION MAY CARRY, written out rather than read
   * off the procedure — reading them off the thing under test would make this
   * arm agree with whatever it serves. `description` left with #1605,
   * `features` with this card; a key added here is a deliberate edit to a
   * public money wire, which is the point of having to type it.
   */
  const SERVED_KEYS = ["credits", "id", "interval", "name", "priceInCents"];

  it("the population is the whole purchasable ladder, so an empty read cannot pass as a clean one", async () => {
    const plans = await caller.getPlans();
    expect(plans.subscriptions.map((plan) => plan.id)).toEqual([...PURCHASABLE_PLANS]);
    /* A floor beneath the derivation: six rungs were served the day this landed. */
    expect(plans.subscriptions.length).toBeGreaterThanOrEqual(6);
  });

  it("every served rung carries exactly the declared keys — no `features`, no `description`", async () => {
    const plans = await caller.getPlans();
    for (const plan of plans.subscriptions) {
      expect(Object.keys(plan).sort(), `${plan.id} serves an undeclared key`).toEqual(SERVED_KEYS);
    }
  });

  it("no feature line from the table reaches the WHOLE payload, under any key", async () => {
    const wire = JSON.stringify(await caller.getPlans());
    /* Positive control: the payload really was read, and it is the ladder. */
    for (const key of PURCHASABLE_PLANS) {
      expect(wire).toContain(JSON.stringify(SUBSCRIPTION_PRODUCTS[key].name));
    }
    let checked = 0;
    for (const key of PURCHASABLE_PLANS) {
      /* And the table still HAS lines to leak — an empty list would pass this arm by having nothing to find. */
      expect(SUBSCRIPTION_PRODUCTS[key].features.length, `${key} has no feature lines to check`).toBeGreaterThan(0);
      for (const line of SUBSCRIPTION_PRODUCTS[key].features) {
        expect(wire, `the wire still carries ${key}'s "${line}"`).not.toContain(line);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
    /* #1953's and #1973's removed lines, by their own spelling, whatever the table says. */
    for (const line of REMOVED_LINES) {
      expect(wire, `the wire still carries "${line}"`).not.toContain(line);
    }
  });
});

describe("card #1973 — the three lines he kept are still in the table on their rungs", () => {
  it("hidden rung included", () => {
    let checked = 0;
    for (const [rung, lines] of Object.entries(KEPT_ENTERPRISE_LINES)) {
      for (const line of lines) {
        expect(SUBSCRIPTION_PRODUCTS[rung].features, `${rung} lost "${line}"`).toContain(line);
        checked += 1;
      }
    }
    /* business 1 + scale 2 + enterprise 2 + ultimate 3 — an arm that checked nothing cannot pass. */
    expect(checked).toBe(8);
  });
});

describe("card #1953 — the table itself is clean, hidden rung included", () => {
  it("no rung in SUBSCRIPTION_PRODUCTS carries one of the three lines", () => {
    /*
      Since #1972 half 1 the wire carries no feature lines at all, so this
      table arm is the one that holds #1953's ruling on every rung — `ultimate`
      included, which `getPlans` never mapped even when it served them.
    */
    const offending = Object.entries(SUBSCRIPTION_PRODUCTS).flatMap(([rung, product]) =>
      product.features
        .filter(
          (line) =>
            (REMOVED_LINES as readonly string[]).includes(line.trim()) || promisesUndelivered(line),
        )
        .map((line) => `${rung}: ${line}`),
    );
    expect(offending).toEqual([]);
    /* Positive control: the table was actually read, hidden rung included. */
    expect(Object.keys(SUBSCRIPTION_PRODUCTS).length).toBeGreaterThanOrEqual(7);
    expect(SUBSCRIPTION_PRODUCTS.ultimate.features.length).toBeGreaterThan(0);
  });
});

describe("card #1972 half 2 — every rollover line derives from PLAN_TIERS", () => {
  /* Also #1953's survival arm: his ruling KEPT the rollover line on every rung. */
  it("in the table, hidden rung included", () => {
    for (const [rung, product] of Object.entries(SUBSCRIPTION_PRODUCTS)) {
      const tier = PLAN_TIERS[rung as keyof typeof PLAN_TIERS];
      expect(product.features).toContain(`${tier.rolloverPercent}% unused credit rollover`);
    }
  });

  it("the source types no literal percentage — a hardcoded 100% equal to today's value is the drift this closes", () => {
    /*
      The arm above cannot tell `"100% …"` from the derived form while
      the value is 100, which is exactly how five rungs sat hardcoded and
      green. Only the source can see the difference.
    */
    const source = readFileSync(join(HERE, "stripeProducts.ts"), "utf8");
    /* Positive control: the right file, with one derived line per rung. */
    const derived =
      source.match(/`\$\{PLAN_TIERS\.\w+\.rolloverPercent\}% unused credit rollover`/g) ?? [];
    expect(derived.length).toBe(Object.keys(SUBSCRIPTION_PRODUCTS).length);
    expect(source).not.toMatch(/["'`]\d+% unused credit rollover/);
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
