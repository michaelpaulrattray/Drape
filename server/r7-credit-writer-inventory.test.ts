import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
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

    const root = new URL("../client/src/", import.meta.url).pathname.replace(
      /^\/([A-Za-z]:)/,
      "$1",
    );
    const walk = (dir: string, out: string[] = []): string[] => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
      }
      return out;
    };
    const files = walk(root);
    expect(files.length, "the sweep found almost nothing — check the path").toBeGreaterThan(300);

    const callers = files.filter((file) =>
      /trpc\.billing\.changePlan\.useMutation/.test(readFileSync(file, "utf8")),
    );
    /* The control: a ban asked of an empty population proves nothing. */
    expect(callers.length, "no client calls changePlan at all — the ban is inert")
      .toBeGreaterThan(0);

    const unkeyed = callers.filter(
      (file) => !readFileSync(file, "utf8").includes("clientRequestId: crypto.randomUUID()"),
    );
    expect(
      unkeyed.map((file) => file.slice(root.length)),
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
