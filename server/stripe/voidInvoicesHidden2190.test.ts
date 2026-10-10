/**
 * #2190, the relay's note on head dd580ce2: every declined plan change now
 * leaves a VOIDED invoice (that is how its hold is cancelled), and a voided
 * invoice charged nothing — so the customer's invoice history must not grow a
 * line per declined attempt. Driven through both readers with Stripe's list
 * doubled; the paid and open invoices are the positive control.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoicesList = vi.hoisted(() => vi.fn());
vi.mock("stripe", () => ({
  default: class StripeDouble {
    invoices = { list: invoicesList, retrieve: vi.fn(), voidInvoice: vi.fn() };
    subscriptions = { retrieve: vi.fn(), update: vi.fn() };
    prices = { list: vi.fn(), create: vi.fn() };
    customers = { retrieve: vi.fn(), create: vi.fn() };
    checkout = { sessions: { create: vi.fn(), retrieve: vi.fn() } };
    billingPortal = { sessions: { create: vi.fn() } };
    webhooks = { constructEvent: vi.fn() };
    refunds = { create: vi.fn() };
  },
}));

import { getAllCustomerInvoices, getCustomerInvoices } from "./stripeService";

const inv = (id: string, status: string) => ({
  id,
  status,
  created: 1_790_000_000,
  amount_paid: status === "paid" ? 4_100 : 0,
  invoice_pdf: null,
  hosted_invoice_url: null,
  description: null,
  lines: { data: [] },
});

beforeEach(() => {
  invoicesList.mockReset().mockResolvedValue({
    data: [inv("in_paid", "paid"), inv("in_declined", "void"), inv("in_open", "open"), inv("in_declined_2", "void")],
    has_more: false,
  });
});

describe("a voided invoice is not in the customer's history", () => {
  it("getCustomerInvoices shows the paid and the open, never the void", async () => {
    const { invoices, hasMore } = await getCustomerInvoices("cus_1", 5);
    expect(invoices.map((i) => i.id)).toEqual(["in_paid", "in_open"]);
    expect(hasMore).toBe(false);
  });

  it("getAllCustomerInvoices filters the same way and pages from the last RAW invoice, so none is skipped", async () => {
    const { invoices, nextCursor } = await getAllCustomerInvoices("cus_1");
    expect(invoices.map((i) => i.id)).toEqual(["in_paid", "in_open"]);
    expect(nextCursor).toBe("in_declined_2");
  });
});
