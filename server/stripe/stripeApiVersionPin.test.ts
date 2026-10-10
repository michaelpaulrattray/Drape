/**
 * THE PRODUCT'S STRIPE CLIENT ASKS FOR THE VERSION WE CHOSE, NOT THE ONE THE
 * LIBRARY SHIPS WITH (#2181) — working law 5: proven on the outgoing request's
 * `Stripe-Version` header, never on the constant beside the constructor.
 *
 * Today the pin and the installed library's default are the same string, so a
 * header read alone could not tell a pinned client from an unpinned one. The
 * harness therefore SIMULATES THE BUMP: `stripe` is the real library, wrapped
 * so that a client built without `apiVersion` defaults to a version no real
 * library has ever shipped — exactly what `props.apiVersion ||
 * DEFAULT_API_VERSION` does in a newer package. The request then goes through
 * the library's real request builder and its real fetch client, and only the
 * network is replaced: the recording fetch answers locally, so nothing leaves
 * the machine and no key is used.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const { harness, BUMPED_LIBRARY_DEFAULT } = vi.hoisted(() => ({
  BUMPED_LIBRARY_DEFAULT: "2099-12-31.guard2181",
  harness: {
    sentVersions: [] as Array<string | null>,
    installedDefault: "" as string,
  },
}));

vi.mock("stripe", async (importOriginal) => {
  const actual = (await importOriginal()) as { default: any };
  const RealStripe = actual.default;
  harness.installedDefault = RealStripe.API_VERSION;

  const recordingFetch = async (_url: unknown, init?: { headers?: unknown }) => {
    const headers = new Headers(init?.headers as HeadersInit | undefined);
    harness.sentVersions.push(headers.get("Stripe-Version"));
    return new Response(JSON.stringify({ id: "cus_2181", object: "customer" }), {
      status: 200,
      headers: { "content-type": "application/json", "request-id": "req_2181" },
    });
  };

  class BumpedStripe extends RealStripe {
    constructor(key: string, config?: Record<string, unknown>) {
      super(key || "sk_test_2181_guard", {
        ...config,
        apiVersion: config?.apiVersion ?? BUMPED_LIBRARY_DEFAULT,
        httpClient: RealStripe.createFetchHttpClient(recordingFetch),
        maxNetworkRetries: 0,
      });
    }
  }
  return { ...actual, default: BumpedStripe };
});

import Stripe from "stripe";
import { getOrCreateStripeCustomer, STRIPE_API_VERSION } from "./stripeService";

beforeEach(() => {
  harness.sentVersions.length = 0;
});

describe("the Stripe API version is pinned at the wire (#2181)", () => {
  it("instrument control: an UNPINNED client under the simulated bump sends the bumped version", async () => {
    const unpinned = new Stripe("sk_test_2181_guard");
    await unpinned.customers.retrieve("cus_2181");
    expect(harness.sentVersions).toEqual([BUMPED_LIBRARY_DEFAULT]);
  });

  it("the product's client sends the pinned version, not the library's default", async () => {
    const id = await getOrCreateStripeCustomer(1, "guard@example.test", undefined, "cus_2181");
    expect(id).toBe("cus_2181");
    expect(harness.sentVersions).toEqual([STRIPE_API_VERSION]);
    expect(harness.sentVersions).not.toContain(BUMPED_LIBRARY_DEFAULT);
  });

  it("the pin is the version the installed library already sent, so pinning moved nothing", () => {
    expect(harness.installedDefault).toMatch(/^\d{4}-\d{2}-\d{2}\.\w+$/);
    expect(STRIPE_API_VERSION).toBe(harness.installedDefault);
  });
});
