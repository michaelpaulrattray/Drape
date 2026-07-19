import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
    const route = source("./routes/billing.ts");
    const clients = [
      source("../client/src/features/billing/BillingModal.tsx"),
      source("../client/src/features/billing/CreditTopupModal.tsx"),
      source("../client/src/features/billing/DowngradeConfirmModal.tsx"),
    ];
    expect(route).toContain("clientRequestId: z.string().uuid().optional()");
    expect(route).toContain("`plan-change:${input.clientRequestId}`");
    for (const client of clients) {
      expect(client).toContain("clientRequestId: crypto.randomUUID()");
    }
  });

  it("keys the externally retried change-request deduction", () => {
    const actions = source("./lib/adminActions/changeRequestActions.ts");
    const admin = source("./db/admin.ts");
    expect(actions).toContain("`cr-stripe-refund:${changeRequestId}`");
    expect(admin).toContain("referenceId: ledgerReferenceId");
    expect(admin).toContain("CRITICAL admin-adjustment reference collision");
  });
});
