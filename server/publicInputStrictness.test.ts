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
