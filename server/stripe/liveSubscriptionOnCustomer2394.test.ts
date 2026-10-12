/**
 * #2394 — `findLiveSubscriptionOnCustomer`, the question the checkout road
 * asks Stripe before it sells a subscription, proven ON THE OUTGOING REQUEST
 * (working law 5) rather than on a stubbed method.
 *
 * `stripe` is the real library; only the network is replaced (the
 * `stripeApiVersionPin.test.ts` harness): a recording fetch answers the list
 * request locally with pages this suite writes, so nothing leaves the machine
 * and no key is used. What is asserted is what the library actually sent —
 * the customer, `status=all`, and the second page's cursor — and what the
 * helper concluded from the pages it was given.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { harness } = vi.hoisted(() => ({
  harness: {
    sent: [] as URL[],
    /* Each entry is one page answered in order; a number is an HTTP error. */
    pages: [] as Array<
      | { data: Array<{ id: string; status: string; pause_collection?: unknown }>; has_more: boolean }
      | number
    >,
  },
}));

vi.mock("stripe", async (importOriginal) => {
  const actual = (await importOriginal()) as { default: any };
  const RealStripe = actual.default;

  const recordingFetch = async (url: unknown) => {
    harness.sent.push(new URL(String(url)));
    const page = harness.pages.shift();
    if (page === undefined || typeof page === "number") {
      return new Response(JSON.stringify({ error: { type: "api_error", message: "boom" } }), {
        status: typeof page === "number" ? page : 500,
        headers: { "content-type": "application/json", "request-id": "req_2394" },
      });
    }
    return new Response(
      JSON.stringify({
        object: "list",
        url: "/v1/subscriptions",
        has_more: page.has_more,
        data: page.data.map((s) => ({ object: "subscription", pause_collection: null, ...s })),
      }),
      { status: 200, headers: { "content-type": "application/json", "request-id": "req_2394" } },
    );
  };

  class LocalStripe extends RealStripe {
    constructor(key: string, config?: Record<string, unknown>) {
      super(key || "sk_test_2394_guard", {
        ...config,
        httpClient: RealStripe.createFetchHttpClient(recordingFetch),
        maxNetworkRetries: 0,
      });
    }
  }
  return { ...actual, default: LocalStripe };
});

import { findLiveSubscriptionOnCustomer } from "./stripeService";

beforeEach(() => {
  harness.sent.length = 0;
  harness.pages.length = 0;
});

describe("#2394 — does this customer already hold a live subscription?", () => {
  it("asks Stripe about the whole customer, including the statuses its default list leaves out", async () => {
    harness.pages.push({ data: [], has_more: false });

    await expect(findLiveSubscriptionOnCustomer("cus_2394")).resolves.toEqual({ outcome: "none" });

    expect(harness.sent).toHaveLength(1);
    const [request] = harness.sent;
    expect(request.pathname).toBe("/v1/subscriptions");
    expect(request.searchParams.get("customer")).toBe("cus_2394");
    expect(request.searchParams.get("status")).toBe("all");
  });

  it("negative control: a customer whose every subscription is dead holds none — a resubscribe still sells", async () => {
    harness.pages.push({
      data: [
        { id: "sub_old", status: "canceled" },
        { id: "sub_never", status: "incomplete_expired" },
      ],
      has_more: false,
    });

    await expect(findLiveSubscriptionOnCustomer("cus_2394")).resolves.toEqual({ outcome: "none" });
  });

  it.each(["past_due", "unpaid", "active", "paused", "trialing", "incomplete"])(
    "a %s subscription is live, beside a dead one",
    async (status) => {
      harness.pages.push({
        data: [
          { id: "sub_old", status: "canceled" },
          { id: "sub_live", status },
        ],
        has_more: false,
      });

      await expect(findLiveSubscriptionOnCustomer("cus_2394")).resolves.toEqual({
        outcome: "live",
        subscriptionId: "sub_live",
        status,
        collectionPaused: false,
      });
    },
  );

  it("an active plan with collection paused says so, so the caller can word the pause", async () => {
    harness.pages.push({
      data: [{ id: "sub_paused", status: "active", pause_collection: { behavior: "void" } }],
      has_more: false,
    });

    await expect(findLiveSubscriptionOnCustomer("cus_2394")).resolves.toMatchObject({
      outcome: "live",
      collectionPaused: true,
    });
  });

  it("walks past the first page — a live plan on page two is still found", async () => {
    harness.pages.push({ data: [{ id: "sub_dead_1", status: "canceled" }], has_more: true });
    harness.pages.push({ data: [{ id: "sub_live", status: "past_due" }], has_more: false });

    await expect(findLiveSubscriptionOnCustomer("cus_2394")).resolves.toMatchObject({
      outcome: "live",
      subscriptionId: "sub_live",
    });
    expect(harness.sent).toHaveLength(2);
    expect(harness.sent[1].searchParams.get("starting_after")).toBe("sub_dead_1");
    expect(harness.sent[1].searchParams.get("status")).toBe("all");
  });

  it("a failed read is `failed`, never `none` — the caller must not sell on a question it could not ask", async () => {
    harness.pages.push(500);

    const out = await findLiveSubscriptionOnCustomer("cus_2394");
    expect(out.outcome).toBe("failed");
  });
});
