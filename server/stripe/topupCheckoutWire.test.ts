/**
 * WHAT A TOP-UP CHECKOUT SESSION ACTUALLY CARRIES (#1606, P1-7) — working law
 * 5: a contract about what gets SENT is proven on the outgoing request, never
 * on a constant near it.
 *
 * Four things about this object decide whether a customer gets what they paid
 * for, and all four are read off the arguments
 * `stripe.checkout.sessions.create` was really passed:
 *
 *  1 · **`mode: "payment"`** — a credit pack is bought once. Sent as
 *      `subscription` it would enrol the customer in a monthly charge from a
 *      button that says *Add credits*.
 *  2 · **one price id and `quantity: units`** — no amount is composed here, and
 *      the quantity is what the volume ladder's rate is multiplied by. A
 *      session carrying `quantity: 1` for a five-unit order charges a fifth of
 *      the money and grants all the credits.
 *  3 · **`metadata.ledgerCredits`** — the webhook grants this figure and
 *      computes nothing, so if it is absent, wrong-scaled or the display number
 *      the customer is paid a fifth of what they bought.
 *  4 · **`metadata.env`** — `checkout.session.completed` is a tagged event
 *      type, so a session minted without the tag has its own completion
 *      REFUSED at production's webhook: the customer pays and no credits
 *      arrive, with nothing in the request path looking wrong.
 *
 * The Stripe double carries `prices.list` so the REAL resolver runs — mocking
 * it would assert that this builder forwards whatever it is handed, which is
 * not the contract. The harness is `checkoutProductText.test.ts`'s.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const { sessionsCreate, pricesList } = vi.hoisted(() => ({
  sessionsCreate: vi.fn(),
  pricesList: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class StripeDouble {
    checkout = { sessions: { create: sessionsCreate, retrieve: vi.fn() } };
    prices = { create: vi.fn(), list: pricesList };
    subscriptions = { retrieve: vi.fn(), update: vi.fn() };
    invoices = { retrieve: vi.fn() };
    customers = { retrieve: vi.fn(), create: vi.fn() };
    billingPortal = { sessions: { create: vi.fn() } };
    webhooks = { constructEvent: vi.fn() };
    refunds = { create: vi.fn() };
  },
}));

import { createTopupCheckoutSession } from "./stripeService";
import { topupPriceLookupKey, StripePriceUnavailableError } from "./stripePriceCatalogue";
import {
  TOPUP_CHECKOUT_KIND,
  TOPUP_BRACKETS,
  TOPUP_MAX_UNITS,
  topupBracketFor,
  topupBracketPackSize,
  topupLedgerCredits,
  topupPriceInCents,
} from "@shared/creditTopups";
import { ENV_TAG_KEY } from "./environmentTag";

/** The catalogue's answer for the band `units` falls in, as Stripe returns it. */
function catalogueHolds(units: number) {
  const bracket = topupBracketFor(units);
  pricesList.mockResolvedValue({
    data: [
      {
        id: `price_topup_${topupBracketPackSize(bracket)}`,
        lookup_key: topupPriceLookupKey(bracket),
        unit_amount: bracket.centsPerUnit,
        recurring: null,
      },
    ],
  });
}

/** The one outgoing session object, or a failure that says none was sent. */
function sentSession(): Record<string, unknown> {
  expect(sessionsCreate).toHaveBeenCalledTimes(1);
  return sessionsCreate.mock.calls[0][0] as Record<string, unknown>;
}

async function mint(units: number, userId = 42) {
  catalogueHolds(units);
  sessionsCreate.mockResolvedValue({ id: `cs_test_${units}`, url: "https://checkout.stripe.com/c/pay/topup" });
  return createTopupCheckoutSession(
    "cus_test_1606",
    units,
    "https://klieglabs.com/app?credits=added",
    "https://klieglabs.com/app?credits=canceled",
    userId,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the session is a one-off purchase of N units at the band's own price", () => {
  it("sends `mode: payment` — never a subscription", async () => {
    await mint(1);
    expect(sentSession().mode).toBe("payment");
  });

  it("sends ONE line item: the band's price id and `quantity` units", async () => {
    await mint(3);
    const session = sentSession();
    expect(session.line_items).toEqual([{ price: "price_topup_10000", quantity: 3 }]);
  });

  it("⚠ sends NO amount — the charge is Stripe's object times the quantity", async () => {
    await mint(5);
    const session = sentSession();

    /* The defect this guards is the one #1605 removed from the plan road: an
       amount computed in this process, with Stripe's catalogue as a parallel
       copy of the prices rather than the thing being charged.
    
       ⚠ Read at the KEYS, not as a substring over the JSON. The first shape of
       this arm searched the serialised session for the order's own price —
       5,000 cents — and found it inside `price_topup_25000` and inside
       `ledgerCredits: 125000`. A money arm that reddens on a digit appearing in
       an unrelated id is noise, and the version of it that passes is worse:
       pick a different unit count and the same arm goes green while proving
       nothing. The structural reading cannot be satisfied by a neighbour. */
    const keys = new Set<string>();
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) return value.forEach(walk);
      if (value && typeof value === "object") {
        for (const [key, child] of Object.entries(value)) {
          keys.add(key);
          walk(child);
        }
      }
    };
    walk(session);

    expect(keys).not.toContain("price_data");
    expect(keys).not.toContain("unit_amount");
    expect(keys).not.toContain("amount");
    expect(keys).not.toContain("currency");
    /* The population control: the walk really did reach the line item, so the
       four absences above are readings rather than an empty set. */
    expect(keys).toContain("line_items");
    expect(keys).toContain("price");
    expect(keys).toContain("quantity");

    /* And the line item carries nothing but the two fields it should. */
    const lineItems = session.line_items as Array<Record<string, unknown>>;
    expect(lineItems).toHaveLength(1);
    expect(Object.keys(lineItems[0]).sort()).toEqual(["price", "quantity"]);
  });

  it("asks the catalogue for the BAND's key, at every sellable size", async () => {
    for (let units = 1; units <= TOPUP_MAX_UNITS; units++) {
      vi.clearAllMocks();
      await mint(units);
      expect(pricesList).toHaveBeenCalledWith({
        lookup_keys: [topupPriceLookupKey(topupBracketFor(units))],
        active: true,
        limit: 2,
      });
      expect((sentSession().line_items as Array<{ quantity: number }>)[0].quantity).toBe(units);
    }
  });

  it("his three packs reach the wire as their own band's price, one each", async () => {
    for (const bracket of TOPUP_BRACKETS) {
      vi.clearAllMocks();
      await mint(bracket.fromUnits);
      expect(sentSession().line_items).toEqual([
        {
          price: `price_topup_${topupBracketPackSize(bracket)}`,
          quantity: bracket.fromUnits,
        },
      ]);
    }
  });
});

describe("the metadata the webhook will read back", () => {
  it("carries the LEDGER credit figure the grant pays, and the unit count beside it", async () => {
    await mint(2);
    expect(sentSession().metadata).toMatchObject({
      userId: "42",
      type: TOPUP_CHECKOUT_KIND,
      topupUnits: "2",
      ledgerCredits: String(topupLedgerCredits(2)),
    });
  });

  it("⚠ the credit figure is the ledger one, not the display one", async () => {
    /* 10,000 display credits is 50,000 ledger credits. The display number on
       this field would pay the customer a fifth of what they bought, and every
       screen would agree with itself. */
    await mint(2);
    const metadata = sentSession().metadata as Record<string, string>;
    expect(metadata.ledgerCredits).toBe("50000");
    expect(metadata.ledgerCredits).not.toBe("10000");
  });

  it("carries the environment tag, without which this session's own completion is refused", async () => {
    await mint(1);
    const metadata = sentSession().metadata as Record<string, string>;
    expect(metadata[ENV_TAG_KEY]).toBeTruthy();
  });

  it("names the account, so the grant does not need a customer lookup", async () => {
    await mint(1, 823);
    expect((sentSession().metadata as Record<string, string>).userId).toBe("823");
  });

  it("every figure on the wire agrees with the ladder, at every sellable size", async () => {
    for (let units = 1; units <= TOPUP_MAX_UNITS; units++) {
      vi.clearAllMocks();
      await mint(units);
      const metadata = sentSession().metadata as Record<string, string>;
      expect(metadata.topupUnits).toBe(String(units));
      expect(metadata.ledgerCredits).toBe(String(topupLedgerCredits(units)));
    }
  });
});

describe("nothing is sent when the catalogue cannot price the order", () => {
  it("an absent key refuses and no session is minted", async () => {
    pricesList.mockResolvedValue({ data: [] });
    await expect(
      createTopupCheckoutSession("cus_x", 1, "https://ok", "https://no", 42),
    ).rejects.toBeInstanceOf(StripePriceUnavailableError);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("an unsellable unit count refuses before Stripe is asked anything at all", async () => {
    await expect(
      createTopupCheckoutSession("cus_x", 0, "https://ok", "https://no", 42),
    ).rejects.toThrow(RangeError);
    expect(pricesList).not.toHaveBeenCalled();
    expect(sessionsCreate).not.toHaveBeenCalled();
  });
});
