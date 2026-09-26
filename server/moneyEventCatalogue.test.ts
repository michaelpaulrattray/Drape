/**
 * THE CONTROL ON THE MONEY EDGES (#509 part 2, the money remainder).
 *
 * Part 2's own catalogue suite holds the GENERATION half honest by reading the
 * operation kinds out of `operationContract.ts`. This is the same idea pointed
 * at the second lifecycle, and the source of truth it reads is awkward in a way
 * the first one was not: **there is no exported list of the Stripe types this
 * product handles.** They are `case` labels in a `switch`. So the reader here is
 * a SOURCE reader, and it is deliberately a different kind of reader from the
 * thing it checks — `MONEY_EVENT_FOR_STRIPE_TYPE` is a `Record` a human typed,
 * the switch is control flow the runtime obeys, and neither can be derived from
 * the other without one of them stopping being the real answer.
 *
 * What it proves:
 *
 *   1. Every Stripe type the dispatcher handles has a product word — and every
 *      word belongs to a handled type. A new `case` cannot ship silently
 *      recording nothing, and a word left behind by a deleted `case` reddens.
 *   2. The population it read is REAL. A regex that matched nothing would make
 *      arm 1 pass by comparing two empty sets, which is the shape
 *      `sabotage-population-has-a-floor` is about.
 *   3. No money event can carry free text, over the WHOLE declared population
 *      rather than the properties somebody thought of.
 *   4. The bug-report categories are the SHARED list, not a fourth copy.
 *   5. The names contain no pipeline vocabulary — no Stripe type leaks into a
 *      word the founder reads (the DT law on a staff surface).
 */
import { describe, expect, it, vi } from "vitest";
import { resolve } from "node:path";

import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";
import { readListedSource } from "./testing/listedSource";
import { BUG_REPORT_CATEGORIES } from "../shared/bugReportVocabulary";
import {
  BUG_REPORT_EVENTS,
  MONEY_EVENT_FOR_STRIPE_TYPE,
  MONEY_EVENTS,
  PRODUCT_EVENT_PROPERTIES,
  PRODUCT_EVENTS,
  projectProductEvent,
} from "../shared/productEventCatalogue";

/* This suite reads a tracked source file through `readListedSource`, which puts
   it in the contended population. */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const WEBHOOKS = resolve(import.meta.dirname, "stripe", "webhooks.ts");

/** A world and a release that pass, so an arm tests the property it names. */
const WORLD = { world: "railway:production", release: "0123456789abcdef0123456789abcdef01234567" };

/**
 * The `case` labels of `handleStripeWebhook`'s own switch, and nothing else's.
 *
 * ⚠ It is scoped to that switch on purpose: `webhooks.ts` holds other switches,
 * and a file-wide `case "…"` sweep would fold their labels into this population
 * and then demand product words for things that are not Stripe event types.
 */
function handledStripeTypes(): string[] {
  const source = readListedSource(WEBHOOKS);
  if (source === null) throw new Error(`${WEBHOOKS} could not be read — this suite cannot answer`);

  const open = source.indexOf("switch (event.type) {");
  if (open === -1) throw new Error("the dispatcher's `switch (event.type)` could not be found");

  /* The `default:` closes the population — every handled type is named above it. */
  const close = source.indexOf("default:", open);
  if (close === -1) throw new Error("the dispatcher's switch has no `default:` to bound the read");

  return [...source.slice(open, close).matchAll(/case\s+"([^"]+)"\s*:/g)].map((m) => m[1]);
}

describe("every money edge the dispatcher handles has a product word", () => {
  it("the population it reads is REAL — an empty read cannot pass the arms below", () => {
    const handled = handledStripeTypes();
    expect(handled.length, "the case labels of the dispatcher's switch").toBeGreaterThanOrEqual(9);
    /* Two labels a reader can check by eye against the file, so a regex that
       started matching the wrong thing is visible here rather than inferred. */
    expect(handled).toContain("invoice.payment_succeeded");
    expect(handled).toContain("charge.dispute.created");
    expect(new Set(handled).size, "a duplicated case label would be a real defect").toBe(handled.length);
  });

  it("⚠ names EVERY handled Stripe type — a new case cannot ship recording nothing", () => {
    const unnamed = handledStripeTypes().filter((type) => !(type in MONEY_EVENT_FOR_STRIPE_TYPE));
    expect(unnamed, "these Stripe types are handled and have no product word").toEqual([]);
  });

  it("⚠ names NOTHING THAT IS NOT HANDLED — a word left by a deleted case is dead weight", () => {
    const handled = new Set(handledStripeTypes());
    const orphans = Object.keys(MONEY_EVENT_FOR_STRIPE_TYPE).filter((type) => !handled.has(type));
    expect(orphans, "these have a product word and no handler").toEqual([]);
  });

  it("every word it maps to is a declared event with a declared property row", () => {
    for (const [type, name] of Object.entries(MONEY_EVENT_FOR_STRIPE_TYPE)) {
      expect(MONEY_EVENTS, `${type} maps outside the money family`).toContain(name);
      expect(PRODUCT_EVENTS, `${type} maps to an undeclared event`).toContain(name);
      expect(PRODUCT_EVENT_PROPERTIES[name], `${name} declares no properties`).toBeTruthy();
    }
  });

  it("the map is one-to-one — two Stripe types sharing a word would make a chart unreadable", () => {
    const words = Object.values(MONEY_EVENT_FOR_STRIPE_TYPE);
    expect(new Set(words).size).toBe(words.length);
  });
});

describe("the money and bug-report events cannot carry a customer's words", () => {
  const edges = [...MONEY_EVENTS, ...BUG_REPORT_EVENTS];

  it("declares no property anywhere that would accept free text", () => {
    for (const name of edges) {
      for (const [key, shape] of Object.entries(PRODUCT_EVENT_PROPERTIES[name])) {
        if (key === "world" || key === "release") continue;
        expect(
          shape.type,
          `${name}.${key} is a ${shape.type} — the only shapes allowed are count, boolean and vocabulary`,
        ).toMatch(/^(count|boolean|vocabulary)$/);
      }
    }
  });

  it("⚠ REFUSES a bug report's description — the property this stream exists to not have", () => {
    /* Driven rather than reasoned about: the description is DROPPED, and the
       event still sends without it, which is the behaviour a caller who meant
       well must get. The catalogue has no shape that could accept it. */
    const verdict = projectProductEvent("bug report sent", {
      ...WORLD,
      category: "billing",
      description: "my card was charged twice and the cast looks nothing like my brief",
    });

    expect(verdict.verdict).toBe("send");
    if (verdict.verdict !== "send") return;
    expect(verdict.dropped).toContain("description");
    expect(Object.keys(verdict.properties)).not.toContain("description");
    expect(JSON.stringify(verdict.properties)).not.toContain("charged twice");
  });

  it("⚠ carries the credits a payment granted, and refuses a fractional or negative one", () => {
    const good = projectProductEvent("payment made", { ...WORLD, creditsGranted: 600 });
    expect(good.verdict).toBe("send");
    if (good.verdict === "send") expect(good.properties.creditsGranted).toBe(600);

    /* A wrong SHAPE refuses the whole event rather than trimming it — our own
       code put something unexpected on the money path and that is a defect to
       read about, not an event to quietly tidy. */
    expect(projectProductEvent("payment made", { ...WORLD, creditsGranted: -1 }).verdict).toBe("refuse");
    expect(projectProductEvent("payment made", { ...WORLD, creditsGranted: 1.5 }).verdict).toBe("refuse");
  });

  it("the money events carry NO amount of money — an uninterpretable number is worse than none", () => {
    for (const name of MONEY_EVENTS) {
      const declared = Object.keys(PRODUCT_EVENT_PROPERTIES[name]);
      for (const forbidden of ["amount", "amountCents", "currency", "total", "price"]) {
        expect(declared, `${name} declares ${forbidden}`).not.toContain(forbidden);
      }
    }
  });
});

describe("the bug-report vocabulary is the shared one, not a copy", () => {
  it("⚠ accepts EVERY category the shared list declares, including the ones the submit route omits", () => {
    for (const category of BUG_REPORT_CATEGORIES) {
      const verdict = projectProductEvent("bug report sent", { ...WORLD, category });
      expect(verdict.verdict, `${category} is a declared category and was refused`).toBe("send");
    }
  });

  it("refuses a category nobody declared", () => {
    expect(projectProductEvent("bug report sent", { ...WORLD, category: "wardrobe-ish" }).verdict).toBe("refuse");
  });

  it("the population is real", () => {
    expect(BUG_REPORT_CATEGORIES.length).toBeGreaterThanOrEqual(6);
  });
});

describe("no pipeline vocabulary reaches a word the founder reads", () => {
  it("no event name contains a Stripe type, a dot, or an underscore", () => {
    for (const name of [...MONEY_EVENTS, ...BUG_REPORT_EVENTS]) {
      expect(name, `${name} reads like a Stripe type`).not.toContain(".");
      expect(name, `${name} reads like a Stripe type`).not.toContain("_");
      expect(name).toBe(name.toLowerCase());
    }
  });

  it("⚠ no event is named for something the product cannot honestly claim happened", () => {
    /*
      The two names this arm exists for, and both were nearly written the other
      way. `customer.subscription.updated` fires for a renewal, a payment-method
      change or a metadata edit, and `handleSubscriptionUpdated` has paths that
      apply nothing — so "plan changed" would be false most deliveries. And
      `invoice.payment_succeeded` grants no credits on a proration-only invoice,
      so "credits bought" would be false exactly when a customer changes plan.
    */
    expect(MONEY_EVENT_FOR_STRIPE_TYPE["customer.subscription.updated"]).toBe("subscription updated");
    expect(MONEY_EVENTS).not.toContain("plan changed");
    expect(MONEY_EVENT_FOR_STRIPE_TYPE["invoice.payment_succeeded"]).toBe("payment made");
    expect(MONEY_EVENTS).not.toContain("credits bought");
  });
});
