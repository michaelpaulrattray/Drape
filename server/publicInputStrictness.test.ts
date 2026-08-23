/**
 * EVERY PUBLIC ENDPOINT REJECTS AN UNDECLARED FIELD.
 *
 * Access-control invariant 4 says `.strict()` on every input schema, and
 * invariant 5 says a public endpoint is an enumerated allowlist that is
 * `.strict()`-validated. Measured 2026-08-23 against the fixed Atlas extractor,
 * **five of the twelve public endpoints were open**: `access.validate`,
 * `newsletter.subscribe`, `referral.validate`, `system.health`, `waitlist.join`.
 * The rule had been read as a description of the product for long enough that
 * nobody checked. Closed on fable-1435 §2's ruling — *invariant 4 already
 * mandates strict on public surfaces; this is enforcement, not policy.*
 *
 * # WHY THIS WAS SAFE, CHECKED RATHER THAN ASSUMED
 *
 * Tightening a schema can reject an in-flight client, which is precisely why
 * the BILLING five were left alone (fable-1435 §2 again — `changePlan`'s own
 * input carries a deploy-skew comment, and that timing question gets its own
 * note). So each of these five was read at its call sites first:
 *
 *   newsletter.subscribe   no client caller at all
 *   referral.validate      no client caller at all
 *   system.health          no client caller at all (the Express `/api/health`
 *                          the deploy rite reads is a DIFFERENT surface)
 *   access.validate        one caller, `client/src/pages/Login.tsx`, sends
 *                          `{ code }` alone
 *   waitlist.join          four callers — HeroContent, WaitlistModal (twice),
 *                          Login — and every one sends a SUBSET of the declared
 *                          fields
 *
 * No shipped bundle can be sending a field these schemas do not declare.
 *
 * # WHY THIS ARM DRIVES THE SCHEMAS AND DOES NOT GREP FOR `.strict()`
 *
 * The Atlas already reads the source, and it was wrong about exactly this for
 * months: `strictInput` was a substring test over the whole builder chain, so a
 * NAMED schema read as open and a `.strict()` on a nested field would have read
 * as closed. A second reader that greps for the same token learns nothing the
 * first one did not already believe. This one takes the REAL routers, pulls each
 * procedure's parser off the tRPC definition, and PARSES an object carrying an
 * extra key — the behaviour the invariant is actually about, at the only place
 * it can be observed.
 */
import { describe, expect, it } from "vitest";

import { accessRouter } from "./routes/access";
import { newsletterRouter } from "./routes/newsletter";
import { referralRouter } from "./routes/referral";
import { systemRouter } from "./_core/systemRouter";
import { waitlistRouter } from "./routes/waitlist";
import { billingRouter } from "./routes/billing";

/** The five, with an input the schema DOES accept, so the extra key is the only variable. */
const CLOSED_PUBLIC = [
  { id: "access.validate", router: accessRouter, name: "validate", valid: { code: "ABC123" } },
  {
    id: "newsletter.subscribe",
    router: newsletterRouter,
    name: "subscribe",
    valid: { email: "someone@example.com" },
  },
  { id: "referral.validate", router: referralRouter, name: "validate", valid: { code: "ABC123" } },
  { id: "system.health", router: systemRouter, name: "health", valid: { timestamp: 1 } },
  {
    id: "waitlist.join",
    router: waitlistRouter,
    name: "join",
    valid: { email: "someone@example.com" },
  },
] as const;

/** The zod parser tRPC holds for a procedure, reached without running a handler. */
function parserOf(router: unknown, name: string): { parse: (input: unknown) => unknown } {
  const procedure = (router as Record<string, any>)._def.procedures[name];
  if (!procedure) throw new Error(`no procedure named ${name} on this router`);
  const inputs = procedure._def.inputs as Array<{ parse: (input: unknown) => unknown }>;
  if (!inputs?.length) throw new Error(`${name} declares no input parser`);
  /* One schema per procedure here; if that ever stops being true, the LAST is
     the one tRPC applies outermost and the assertion below would be about the
     wrong object. Refuse rather than guess. */
  if (inputs.length !== 1) throw new Error(`${name} declares ${inputs.length} input parsers`);
  return inputs[0]!;
}

/**
 * THE BILLING FIVE, closed on fable-1446.
 *
 * They were held open for months by `changePlan`'s own deploy-skew comment —
 * *"an older bundle may omit it until the new client is live"* — which argues
 * the OTHER way once read: `.strict()` rejects an UNKNOWN key and says nothing
 * about a MISSING optional one. An in-flight bundle only breaks against a newly
 * strict schema if a field was REMOVED, and this change removes nothing.
 *
 * Read at the call sites first, exactly as the public five were:
 *
 *   createSubscriptionCheckout  { plan, interval }           BillingModal, DowngradeConfirmModal
 *   changePlan                  { newPlan, clientRequestId }  BillingModal, CreditTopupModal,
 *                                                             DowngradeConfirmModal
 *   previewPlanChange           { newPlan }                  CreditTopupModal
 *   getInvoices                 { limit: 5 }                 BillingTab
 *   getAllInvoices              no input at all              BillingTab
 *
 * `undefined` is in the population on purpose. Two of these take an OPTIONAL
 * object, and `.strict()` belongs INSIDE that wrapper; a hand that hoisted it
 * outward, or dropped the `.optional()` while adding it, would break the one
 * caller that sends nothing — on a money surface, mid-deploy, in a way every
 * rejection arm here would happily pass.
 */
const CLOSED_BILLING = [
  {
    id: "billing.createSubscriptionCheckout",
    name: "createSubscriptionCheckout",
    accepts: [{ plan: "pro", interval: "monthly" }, { plan: "pro" }],
  },
  {
    id: "billing.changePlan",
    name: "changePlan",
    accepts: [
      { newPlan: "pro", clientRequestId: "6f9619ff-8b86-4d01-b42d-00c04fc964ff" },
      /* The older bundle's shape — the very thing the deploy-skew comment is
         about — must still parse. */
      { newPlan: "pro" },
    ],
  },
  { id: "billing.previewPlanChange", name: "previewPlanChange", accepts: [{ newPlan: "studio" }] },
  { id: "billing.getInvoices", name: "getInvoices", accepts: [{ limit: 5 }, {}, undefined] },
  { id: "billing.getAllInvoices", name: "getAllInvoices", accepts: [{ cursor: "abc" }, {}, undefined] },
] as const;

describe("the billing five, closed on fable-1446", () => {
  it("⚠ CONTROL — every one still ACCEPTS every shape a live bundle sends", () => {
    /*
      The control that matters on money. `.strict()` on the wrong object passes
      a rejection arm by rejecting CUSTOMERS, and the failure would be a
      BAD_REQUEST on a checkout during a deploy.
    */
    for (const endpoint of CLOSED_BILLING) {
      for (const valid of endpoint.accepts) {
        expect(
          () => parserOf(billingRouter, endpoint.name).parse(valid),
          `${endpoint.id} must still accept ${JSON.stringify(valid) ?? "undefined"}`,
        ).not.toThrow();
      }
    }
    expect(CLOSED_BILLING.length, "the population is the five CLAUDE.md named as still open").toBe(5);
  });

  it("rejects an undeclared field on every one of the five", () => {
    for (const endpoint of CLOSED_BILLING) {
      /* The first accepted shape is always an OBJECT, so the extra key is the
         only variable. `undefined` cannot carry one and is not a case here. */
      const valid = endpoint.accepts[0] as Record<string, unknown>;
      expect(
        () => parserOf(billingRouter, endpoint.name).parse({ ...valid, somethingNobodyDeclared: "x" }),
        `${endpoint.id} silently dropped an undeclared field — invariant 4 is not enforced on it`,
      ).toThrow();
    }
  });

  it("⚠ the two OPTIONAL readers still take no input at all", () => {
    /*
      Said as its own arm rather than folded into the control above, because
      this is the one a "tidy-up" breaks: `.strict()` cannot be applied to a
      `ZodOptional` in zod 4, so the tempting repair is to drop the
      `.optional()` — and `BillingTab` calls `getAllInvoices` with nothing.
    */
    for (const name of ["getInvoices", "getAllInvoices"] as const) {
      expect(() => parserOf(billingRouter, name).parse(undefined), `${name} must still accept no input`).not.toThrow();
    }
  });
});

describe("the public endpoints closed on fable-1435 §2", () => {
  it("⚠ CONTROL — every one still ACCEPTS the input it is supposed to", () => {
    /*
      POSITIVE CONTROL, and it is the one that matters here. `.strict()` on the
      wrong object, or on a schema whose valid shape I guessed at, would make
      every arm below pass by rejecting everything — including real customers.
      This proves the endpoint still works before anything is claimed about what
      it refuses.
    */
    for (const endpoint of CLOSED_PUBLIC) {
      expect(
        () => parserOf(endpoint.router, endpoint.name).parse(endpoint.valid),
        `${endpoint.id} must still accept its own declared input`,
      ).not.toThrow();
    }
    expect(CLOSED_PUBLIC.length, "the population is the five that were open").toBe(5);
  });

  it("rejects an undeclared field on every one of the five", () => {
    for (const endpoint of CLOSED_PUBLIC) {
      expect(
        () =>
          parserOf(endpoint.router, endpoint.name).parse({
            ...endpoint.valid,
            somethingNobodyDeclared: "x",
          }),
        `${endpoint.id} silently dropped an undeclared field — invariant 4 is not enforced on it`,
      ).toThrow();
    }
  });

  it("⚠ CONTROL — the reader can find a procedure and would refuse a missing one", () => {
    /* NEGATIVE CONTROL for the harness itself: an arm that silently found no
       procedure would report five clean endpoints over nothing. */
    expect(() => parserOf(systemRouter, "aProcedureNobodyWrote")).toThrow(/no procedure named/);
  });
});
