import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";
import { CLIENT_SRC, sourcesUnder } from "./testing/sourceTree";

/* This suite reads every app source under `client/src` off the real tree,
   which puts it in #741's population — through `testing/sourceTree.ts` since
   #2289, one hop, which that deriver resolves. */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const source = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

describe("R7-1B deterministic retryable credit writers", () => {
  it("defines and migrates the unique non-null ledger reference authority", () => {
    const schema = source("../drizzle/schema.ts");
    const migration = source("../drizzle/0006_sticky_eternals.sql");
    expect(schema).toContain('uniqueIndex("uq_point_txn_user_ref")');
    expect(schema).not.toContain('index("idx_credit_txn_user_ref")');
    expect(migration).toContain("DROP INDEX `idx_credit_txn_user_ref`");
    expect(migration).toContain("CONSTRAINT `uq_point_txn_user_ref` UNIQUE(`userId`,`referenceId`)");
  });

  it("keys monthly refresh to the Stripe invoice and persists it in the ledger", () => {
    const webhook = source("./stripe/webhooks.ts");
    const billing = source("./db/billing.ts");
    expect(webhook).toContain("`stripe-invoice:${invoice.id}`");
    expect(billing).toContain("referenceId: ledgerReferenceId");
    expect(billing).toContain("isDuplicateCreditReferenceError(error)");
  });

  it("gives every connected plan-change client action a stable request id", () => {
    /*
      ⚠ **THE POPULATION IS DERIVED NOW, NOT LISTED (2026-09-01, section 03).**
      It used to name three files — `BillingModal`, `CreditTopupModal` and
      `DowngradeConfirmModal` — and section 03 deleted all three, which is the
      moment a hand-kept list of money-path callers is worth nothing: a fourth
      caller added tomorrow would never have been on it, and this arm would have
      stayed green over an unkeyed plan change. Working law 4.

      So the sweep walks `client/src` for anything that CALLS `changePlan` and
      requires the request id on each. A caller that stops carrying it reddens
      the day it lands, whatever it is called and wherever it lives.
    */
    const route = source("./routes/billing.ts");
    expect(route).toContain("clientRequestId: z.string().uuid().optional()");
    expect(route).toContain("`plan-change:${input.clientRequestId}`");

    /* Since #711 the PRIMARY ledger key for a plan change is the change's
       own INVOICE — one invoice, one credit move, whatever the client
       retries — shared by changePlan and the webhook so their race is safe.
       The clientRequestId keying above survives only on the declared
       no-invoice fallback road.

       ⚠ **IT IS DECLARED IN server/db/planChangeSettlements.ts SINCE PR
       #1946's REVIEW, NOT IN THE STRIPE MODULE, AND THIS ARM IS WHAT CAUGHT
       THE MOVE.** The renewal's netting reader looks a move up in the ledger
       by this key and lives beside the table; the stripe module imports
       ../db, so reading it the other way would have closed an import cycle.
       A guard that names a symbol need not live beside it — the suites of
       all four changed files were green when this arm reddened. */
    const settlement = source("./db/planChangeSettlements.ts");
    expect(settlement).toContain("`plan-change-settle:${stripeInvoiceId}`");
    /* And it is re-exported rather than re-declared, so every importer keeps
       its path and there is ONE spelling of the string two racing appliers
       rely on (working law 4). */
    const applier = source("./stripe/planChangeSettlement.ts");
    expect(applier).toContain('export { settlementLedgerRef } from "../db/planChangeSettlements";');
    expect(
      applier,
      "a second declaration of the ref would be the drift this re-export exists to stop",
    ).not.toContain("function settlementLedgerRef");

    /* The walk is `testing/sourceTree.ts`'s since #2289 — this file carried
       the fifth distinct derivation of the client root in the tree.
       `tests: "exclude"` is this suite's own population: a suite calling the
       mutation is a fixture, not a writer. */
    const files = sourcesUnder(CLIENT_SRC, { tests: "exclude" });
    expect(files.length, "the sweep found almost nothing — check the path").toBeGreaterThan(300);

    const callers = files.filter((file) =>
      /trpc\.billing\.changePlan\.useMutation/.test(file.source),
    );
    /* The control: a ban asked of an empty population proves nothing. */
    expect(callers.length, "no client calls changePlan at all — the ban is inert")
      .toBeGreaterThan(0);

    const unkeyed = callers.filter(
      (file) => !file.source.includes("clientRequestId: crypto.randomUUID()"),
    );
    expect(
      /* The offender is named relative to the walk root, as it was: the shared
         walk hands that back rather than having it sliced off by length. */
      unkeyed.map((file) => file.relative),
      "a client changes a plan without a stable request id — a retry double-charges",
    ).toEqual([]);
  });

  it("keys the externally retried change-request deduction", () => {
    const actions = source("./lib/adminActions/changeRequestActions.ts");
    const admin = source("./db/admin.ts");
    expect(actions).toContain("`cr-stripe-refund:${changeRequestId}`");
    expect(admin).toContain("referenceId: ledgerReferenceId");
    expect(admin).toContain("CRITICAL admin-adjustment reference collision");
  });
});
