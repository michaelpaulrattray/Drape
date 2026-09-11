/**
 * `voidInvoice` — WHAT EACH NON-VOIDABLE STATUS MEANS, SAID DIFFERENTLY (#767).
 *
 * The webhook road is driven in `planChangeSettlement.test.ts`: those arms prove
 * WHICH statuses get voided. This file drives the function directly and asks the
 * other question — what it SAYS when it does not void, because that sentence is
 * the only trace a finally-failed renewal leaves.
 *
 * `draft` and `void` mean the invoice cannot take money, which is what the call
 * wanted: info, "nothing to do". `paid` means it already took it, for a plan
 * being cancelled and credits that will never move: warn, and its own return
 * shape. Both halves are asserted, because a checker that warns on everything
 * would pass the paid arm while saying nothing.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const { invoicesRetrieve, invoicesVoid } = vi.hoisted(() => ({
  invoicesRetrieve: vi.fn(),
  invoicesVoid: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class StripeDouble {
    invoices = { retrieve: invoicesRetrieve, voidInvoice: invoicesVoid };
    customers = { retrieve: vi.fn(), create: vi.fn() };
    subscriptions = { retrieve: vi.fn(), update: vi.fn() };
    checkout = { sessions: { create: vi.fn(), retrieve: vi.fn() } };
    billingPortal = { sessions: { create: vi.fn() } };
    prices = { create: vi.fn() };
    webhooks = { constructEvent: vi.fn() };
    refunds = { create: vi.fn() };
  },
}));

const logged = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("../logging/logger", () => ({
  logger: logged,
  createModuleLogger: () => logged,
}));

const audit = vi.hoisted(() => ({ logAuditEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../auditLog", async () => {
  const schema = await vi.importActual<typeof import("../../drizzle/schema")>("../../drizzle/schema");
  return { logAuditEvent: audit.logAuditEvent, AUDIT_ACTIONS: schema.AUDIT_ACTIONS };
});

import { voidInvoice } from "./stripeService";

beforeEach(() => {
  vi.clearAllMocks();
});

/** Everything the one log call of a run said, whatever level it used. */
function saidAt(level: "info" | "warn"): string {
  return logged[level].mock.calls.map((call) => String(call[0])).join(" | ");
}

describe("voidInvoice — a status that cannot take money, and the one that already did", () => {
  for (const status of ["draft", "void"] as const) {
    it(`a "${status}" invoice is benign: info, "nothing to do", and no warning`, async () => {
      invoicesRetrieve.mockResolvedValue({ id: "in_1", status });

      const result = await voidInvoice("in_1");

      expect(result).toBe("already-closed");
      expect(invoicesVoid).not.toHaveBeenCalled();
      expect(saidAt("info")).toContain("nothing to do");
      expect(logged.warn).not.toHaveBeenCalled();
    });
  }

  /*
    THE ARM THIS FILE EXISTS FOR. Before #767 this returned "already-closed" and
    logged, at info, that the invoice "cannot take money; nothing to do" — of a
    status that means money was taken. A finally-failed RENEWAL carries no
    settlement row, so `planChangeSettlement.ts`'s late-payment warning never
    fires for it and this line is the whole record.
  */
  it('a "paid" invoice warns instead, names what happened, and returns its own shape', async () => {
    invoicesRetrieve.mockResolvedValue({ id: "in_paid", status: "paid" });

    const result = await voidInvoice("in_paid");

    expect(result).toBe("already-paid");
    expect(invoicesVoid).not.toHaveBeenCalled();
    expect(logged.warn).toHaveBeenCalledTimes(1);
    expect(saidAt("warn")).toContain("PAID");
    expect(saidAt("warn")).not.toContain("nothing to do");
    expect(saidAt("info")).not.toContain("nothing to do");
    /* #771: the warn alone was a surface nobody reads — the audit row is what
       puts it on the admin overview's alerts feed and the staff audit log. */
    expect(audit.logAuditEvent).toHaveBeenCalledTimes(1);
    expect(audit.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "billing.invoice_paid_after_plan_ended",
        resourceId: "in_paid",
        severity: "critical",
      }),
    );
  });

  it("a benign status writes NO audit row — the panel is for money that went wrong, not for redeliveries", async () => {
    invoicesRetrieve.mockResolvedValue({ id: "in_void", status: "void" });
    await voidInvoice("in_void");
    expect(audit.logAuditEvent).not.toHaveBeenCalled();
  });

  /* The positive control: a voidable status still voids and still says so. */
  for (const status of ["open", "uncollectible"] as const) {
    it(`a "${status}" invoice is still voided`, async () => {
      invoicesRetrieve.mockResolvedValue({ id: "in_open", status });
      invoicesVoid.mockResolvedValue({ id: "in_open", status: "void" });

      const result = await voidInvoice("in_open");

      expect(result).toBe("voided");
      expect(invoicesVoid).toHaveBeenCalledWith("in_open");
      expect(logged.warn).not.toHaveBeenCalled();
    });
  }

  it("a read that throws is reported as a failure, not as a closed invoice", async () => {
    invoicesRetrieve.mockRejectedValue(new Error("stripe said no"));

    expect(await voidInvoice("in_boom")).toBe("failed");
    expect(logged.error).toHaveBeenCalledTimes(1);
  });
});
